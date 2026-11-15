import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function fixture(scheduler?: {yield: () => Promise<void>}, channels = true) {
  const messages: (() => void)[] = [], timers: (() => void)[] = [];
  let closed = 0;
  class Channel {
    port1 = {onmessage: null as (() => void) | null, close() {closed++;}};
    port2 = {postMessage: () => messages.push(() => this.port1.onmessage?.()), close() {closed++;}};
  }
  const context = vm.createContext({exports: {}, window: {}, scheduler, MessageChannel: channels ? Channel : undefined,
    setTimeout: (fn: () => void) => timers.push(fn)});
  vm.runInContext(ts.transpile(readFileSync('lib/yield-main-thread.ts', 'utf8'),
    {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}), context);
  return {context, yieldTask: context.exports.yieldMainThread as () => Promise<void>, messages, timers, closed: () => closed};
}

test('contact work resumes through the browser scheduler instead of the starved timer queue', async () => {
  let resume!: () => void, called = 0, completed = false;
  const scheduler = {yield() {assert.equal(this, scheduler); called++; return new Promise<void>(resolve => {resume = resolve;});}};
  const f = fixture(scheduler);
  const work = f.yieldTask().then(() => {completed = true;});
  assert.equal(called, 1); assert.equal(completed, false); assert.equal(f.timers.length, 0);
  resume(); await work; assert.equal(completed, true);
});

test('unsupported browsers yield a real message task and close both ports on every completion', async () => {
  const f = fixture(); const order: number[] = [];
  const one = f.yieldTask().then(() => order.push(1)), two = f.yieldTask().then(() => order.push(2));
  assert.deepEqual(order, []); assert.equal(f.timers.length, 0); assert.equal(f.messages.length, 2);
  f.messages.shift()!(); await one; assert.equal(f.closed(), 2);
  f.messages.shift()!(); await two; assert.equal(f.closed(), 4); assert.deepEqual(order, [1, 2]);
});

test('non-browser environments without either task API keep an asynchronous timer fallback', async () => {
  const f = fixture(undefined, false); let completed = false;
  const work = f.yieldTask().then(() => {completed = true;});
  assert.equal(completed, false); assert.equal(f.timers.length, 1);
  f.timers.shift()!(); await work; assert.equal(completed, true);
});

test('legacy fallback batches only within an eight millisecond slice, then yields a real task again', async () => {
  let now = 0;
  const f = fixture();
  f.context.performance = {now: () => now};
  const yieldTask = f.context.exports.createPreparationYield();
  let completed = false;
  const first = yieldTask().then(() => {completed = true;});
  assert.equal(completed, false); assert.equal(f.messages.length, 1);
  f.messages.shift()!(); await first;
  now = 7; await yieldTask(); assert.equal(f.messages.length, 0);
  now = 8; const next = yieldTask(); assert.equal(f.messages.length, 1);
  f.messages.shift()!(); await next; assert.equal(f.closed(), 4);
});
