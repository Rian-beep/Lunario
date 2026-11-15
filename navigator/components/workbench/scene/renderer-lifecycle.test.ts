import assert from 'node:assert/strict';
import test from 'node:test';
import {releaseRenderer} from './renderer-lifecycle';

test('intentional renderer release detaches context-loss handlers before freeing the context', () => {
  const events: string[] = [];
  releaseRenderer({forceContextLoss(){events.push('context-release');},dispose(){events.push('renderer-dispose');}},()=>events.push('detach-listeners'));
  assert.deepEqual(events,['detach-listeners','context-release','renderer-dispose']);
});
test('renderer cleanup still completes if explicit context release fails', () => {
  let disposed=false;
  assert.throws(()=>releaseRenderer({forceContextLoss(){throw Error('driver release');},dispose(){disposed=true;}}),/driver release/);
  assert.equal(disposed,true);
});
