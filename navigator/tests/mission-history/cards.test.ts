import test from 'node:test';
import assert from 'node:assert/strict';
import React, { createElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import { MissionHistoryCard, type MissionHistoryCardProps } from '../../components/mission-history';
import { INTERNATIONAL_MISSION_HISTORY as history } from '../../lib/mission-history/international';

Object.assign(globalThis, { React });
const example = history.find(r => r.id === 'luna-23')!;
const render = (mode: MissionHistoryCardProps['mode'], record = example) => renderToStaticMarkup(createElement(MissionHistoryCard, { record, mode }));

test('SSR distinguishes public significance, teaching method and planning evidence limits', () => {
  const publicHtml = render('public');
  const teachHtml = render('teach');
  const planHtml = render('plan');
  for (const html of [publicHtml, teachHtml, planHtml]) {
    assert.ok(html.includes(example.publicSummary.value!));
    assert.ok(html.includes(example.outcome.value!.landing));
    assert.ok(html.includes(example.outcome.value!.science));
    assert.match(html, /aria-expanded="false"/);
    assert.match(html, /hidden=""/);
    assert.match(html, /var\(--card\)/);
    assert.match(html, /var\(--mission-title\)/);
    assert.match(html, /max-height:min\(55vh, 28rem\)/);
  }
  assert.equal(publicHtml.includes(example.educatorNotes.value!), false);
  assert.equal(publicHtml.includes(example.plannerNotes.value!), false);
  assert.ok(teachHtml.includes(example.educatorNotes.value!));
  assert.equal(teachHtml.includes(example.plannerNotes.value!), false);
  assert.ok(planHtml.includes(example.plannerNotes.value!));
  assert.equal(planHtml.includes(example.educatorNotes.value!), false);
});

test('all records SSR with nearby citations, explicit unknowns and original-language provenance', () => {
  for (const record of history) for (const mode of ['public', 'teach', 'plan'] as const) {
    const html = render(mode, record);
    assert.match(html, /Surface traverse distance<\/dt><dd[^>]*>/);
    assert.match(html, /Measured coverage area<\/dt><dd[^>]*><span>Unknown\./);
    assert.match(html, /Coordinate route unknown/);
    assert.match(html, /Exploration source \/ context/);
    assert.match(html, /Original sources and translation notes/);
    for (const source of record.sources) {
      assert.ok(html.includes(source.url.replaceAll('&', '&amp;')), `${record.id}: missing source ${source.id}`);
      assert.ok(html.includes(source.language));
      assert.ok(source.translationNote && html.includes(source.translationNote));
    }
    for (const sourceId of record.outcome.sourceIds) {
      const url = record.sources.find(s => s.id === sourceId)!.url;
      const outcome = html.slice(html.indexOf('Touchdown outcome'), html.indexOf('Science accomplished'));
      assert.ok(outcome.includes(url), `${record.id}: touchdown citation must be beside the outcome`);
    }
  }
  assert.match(render('public', history.find(r => r.id === 'luna-17')!), /10.54 km/);
});

test('uncatalogued selection, missing facts and broken citations do not assert a mission or invent values', () => {
  const empty = renderToStaticMarkup(createElement(MissionHistoryCard, { record: null, mode: 'plan' }));
  assert.match(empty, /No historical landing record is catalogued/);
  assert.doesNotMatch(empty, /Science accomplished|Touchdown outcome/);
  const unknown = { value: null, sourceIds: [], note: 'Not documented in this fixture.' };
  const partial = { ...example, outcome: unknown, publicSummary: { value: 'Review source', sourceIds: ['missing'] },
    exploration: { ...example.exploration, distanceKm: { value: NaN, sourceIds: ['lroc-23'] } } };
  const html = render('public', partial);
  assert.match(html, /Landing and science outcome<\/dt><dd[^>]*><span>Unknown/);
  assert.match(html, /Unknown source: missing/);
  assert.match(html, /not finite/);
  assert.doesNotMatch(html, />NaN km/);
});

test('rendering a selection is static and initiates no live requests', () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = () => { calls++; throw new Error('Selection must not fetch'); };
  try { for (const record of history) render('teach', record); }
  finally { globalThis.fetch = original; }
  assert.equal(calls, 0);
});

// Execute the actual TSX with controlled hooks and the shared Button boundary.
// This tests callbacks and keyed selection changes without a server, DOM or new dependency.
function harness() {
  let active = '', cursor = 0;
  const states = new Map<string, unknown[]>();
  const runtime = { ...React,
    useId: () => 'history-test',
    useState: (initial: unknown) => {
      const path = active, slot = cursor++, slots = states.get(path) ?? [];
      states.set(path, slots);
      if (!(slot in slots)) slots[slot] = initial;
      return [slots[slot], (next: unknown) => { slots[slot] = typeof next === 'function' ? next(slots[slot]) : next; }];
    },
  };
  const sandboxModule = { exports: {} as { MissionHistoryCard: typeof MissionHistoryCard } };
  const js = transformSync(readFileSync('components/mission-history/index.tsx', 'utf8'), { loader: 'tsx', format: 'cjs', jsx: 'transform' }).code;
  runInNewContext(js, { module: sandboxModule, exports: sandboxModule.exports, require: (id: string) => {
    if (id === 'react') return runtime;
    if (id === '../ui/button') return { Button: (props: object) => createElement('button', props) };
    throw new Error(`Unexpected runtime import: ${id}`);
  } });
  type Element = ReactElement<Record<string, unknown>>;
  let visited = new Set<string>();
  function resolve(node: ReactNode, path = 'root'): ReactNode {
    if (Array.isArray(node)) return node.map((child, i) => resolve(child, `${path}.${i}`));
    if (!React.isValidElement(node)) return node;
    const element = node as Element;
    const here = `${path}:${element.key ?? ''}`;
    if (typeof element.type === 'function') {
      active = here; cursor = 0; visited.add(here);
      const component = element.type as (props: Record<string, unknown>) => ReactNode;
      return resolve(component(element.props), `${here}/child`);
    }
    return createElement(element.type, { ...element.props, key: element.key }, resolve(element.props.children as ReactNode, `${here}/children`));
  }
  return {
    render(props: MissionHistoryCardProps) {
      visited = new Set();
      const tree = resolve(createElement(sandboxModule.exports.MissionHistoryCard, props));
      for (const key of states.keys()) if (!visited.has(key)) states.delete(key);
      return tree;
    },
  };
}
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement(node)) return [];
  const e = node as ReactElement<Record<string, unknown>>;
  return [e, ...elements(e.props.children as ReactNode)];
}
function click(tree: ReactNode, label: string) {
  const button = elements(tree).find(e => e.type === 'button' && (e.props['aria-label'] === label || e.props.children === label));
  assert.ok(button, `Missing button: ${label}`);
  (button.props.onClick as () => void)();
}

test('actual callbacks expand/collapse, dismiss/reopen and reset on changed mission identity', () => {
  const h = harness();
  const props = { record: example, mode: 'public' as const };
  let tree = h.render(props);
  click(tree, 'Expand facts');
  tree = h.render(props);
  assert.match(renderToStaticMarkup(tree), /aria-expanded="true"/);
  click(tree, 'Collapse facts');
  assert.match(renderToStaticMarkup(h.render(props)), /aria-expanded="false"/);
  click(h.render(props), `Dismiss mission history: ${example.name}`);
  tree = h.render(props);
  assert.doesNotMatch(renderToStaticMarkup(tree), /Touchdown outcome/);
  click(tree, `Reopen mission history: ${example.name}`);
  assert.match(renderToStaticMarkup(h.render(props)), /Touchdown outcome/);
  click(h.render(props), 'Expand facts');
  click(h.render(props), `Dismiss mission history: ${example.name}`);
  const next = history.find(r => r.id === 'slim')!;
  tree = h.render({ ...props, record: next });
  const html = renderToStaticMarkup(tree);
  assert.match(html, /SLIM.*History/);
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /Reopen mission history/);
  // Returning after selecting a different mission mounts fresh state too.
  assert.match(renderToStaticMarkup(h.render(props)), /Touchdown outcome/);
});
