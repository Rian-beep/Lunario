import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import type { ReactElement, ReactNode } from 'react';
import type { LessonMaterial } from '../../lib/education-materials';
import { catalog, manifest, state } from './fixture';

type Node = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): Node[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== 'object' || !('props' in node)) return [];
  return [node as Node, ...nodes((node as Node).props.children as ReactNode)];
}
function text(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(text).join('');
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  return node && typeof node === 'object' && 'props' in node ? text((node as Node).props.children as ReactNode) : '';
}

// Exercise the real component callbacks with deterministic hook state. This does not
// mount a DOM or claim browser focus, layout or native print-dialog verification.
async function controls() {
  const slots: unknown[] = [];
  let cursor = 0;
  const files: Array<{ name: string; body: string }> = [];
  const harness = {
    useId: () => 'worksheet-controls',
    useState: (initial: unknown) => {
      const i = cursor++;
      if (!(i in slots)) slots[i] = initial;
      return [slots[i], (v: unknown) => { slots[i] = typeof v === 'function' ? v(slots[i]) : v; }];
    },
    download: (name: string, body: string) => files.push({ name, body }),
  };
  const compiled = await build({ stdin: { contents: "export {MaterialBuilder} from './components/education-materials/material-builder';", resolveDir: process.cwd(), loader: 'tsx' },
    outfile: '/tmp/ted-controls.cjs', bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', jsx: 'automatic',
    plugins: [{ name: 'worksheet-controls', setup(p) {
      p.onResolve({ filter: /^react$/ }, args => args.importer.endsWith('/material-builder.tsx') ? { path: 'hooks', namespace: 'worksheet-test' } : undefined);
      p.onResolve({ filter: /study-capture$/ }, args => args.importer.endsWith('/material-builder.tsx') ? { path: 'downloads', namespace: 'worksheet-test' } : undefined);
      p.onLoad({ filter: /.*/, namespace: 'worksheet-test' }, args => ({ contents: args.path === 'hooks'
        ? 'export const useId=worksheetHarness.useId; export const useState=worksheetHarness.useState;'
        : 'export const downloadAudienceFile=worksheetHarness.download;' }));
    } }],
  });
  const output = { exports: {} as { MaterialBuilder: typeof import('../../components/education-materials/material-builder').MaterialBuilder } };
  new Function('require', 'module', 'exports', 'worksheetHarness', compiled.outputFiles.find(f => f.path.endsWith('.cjs'))!.text)(createRequire(import.meta.url), output, output.exports, harness);
  let current = state;
  const render = () => { cursor = 0; return nodes(output.exports.MaterialBuilder({ catalog, manifest, state: current })); };
  const click = (label: string) => {
    const found = render().find(n => typeof n.props.onClick === 'function' && text(n.props.children as ReactNode) === label);
    assert.ok(found, `Missing action ${label}`);
    (found.props.onClick as () => void)();
  };
  const change = (node: Node | undefined, target: Record<string, unknown>) => {
    assert.ok(node, 'Missing control');
    (node.props.onChange as (event: unknown) => void)({ target });
  };
  return { render, click, change, files, setScenario: (value: typeof state) => { current = value; } };
}

test('real worksheet controls select topics, title, level and hints, then export matching frozen student and teacher files', async () => {
  const h = await controls();
  for (const checkbox of h.render().filter(n => n.type === 'input' && n.props.type === 'checkbox').slice(0, 7)) h.change(checkbox, { checked: false });
  const title = h.render().find(n => n.props.maxLength === 160);
  h.change(title, { value: 'Resource investigation class' });
  h.change(h.render().find(n => n.type === 'select'), { value: 'advanced' });
  h.change(h.render().filter(n => n.type === 'input' && n.props.type === 'checkbox').at(-1), { checked: false });
  h.click('Capture current scenario for worksheet');
  h.click('Export student worksheet'); h.click('Export teacher answer key'); h.click('Export teacher JSON');
  const [student, teacher, json] = h.files;
  assert.match(student.body, /Resource investigation class/);
  assert.match(student.body, /Advanced investigation/); assert.doesNotMatch(student.body, /<p>Hint:|Mark for/);
  assert.match(teacher.body, /<p>Hint:|Mark for/);
  const sheet = JSON.parse(json.body) as LessonMaterial;
  assert.deepEqual(sheet.questions.map(q => q.topic), ['extraction-power']);
  assert.deepEqual(sheet.options, { audience: 'advanced', includeHints: false });
  h.change(h.render().find(n => n.props.maxLength === 160), { value: 'Next capture title' });
  h.setScenario({ ...structuredClone(state), mission: { ...state.mission, loadW: 12345 } });
  h.click('Export teacher JSON');
  assert.equal(h.files.at(-1)!.body, json.body);
  h.click('Replace capture with current scenario'); h.click('Export teacher JSON');
  const replacement = JSON.parse(h.files.at(-1)!.body) as LessonMaterial;
  assert.equal(replacement.title, 'Next capture title'); assert.equal(replacement.scenario.mission.loadW, 12345);
  assert.notEqual(replacement.scenarioKey, sheet.scenarioKey);
});

test('real question and hint edit callbacks reach both exports; empty topic selection disables capture', async () => {
  const h = await controls();
  h.click('Capture current scenario for worksheet');
  h.change(h.render().find(n => n.props['aria-label'] === 'Question'), { value: '<script>Edited student task</script>' });
  h.change(h.render().find(n => n.props['aria-label'] === 'Hint'), { value: 'Edited teaching hint' });
  h.click('Export student worksheet'); h.click('Export teacher answer key');
  for (const file of h.files) {
    assert.match(file.body, /Edited student task/); assert.match(file.body, /Edited teaching hint/);
    assert.doesNotMatch(file.body, /<script>/); assert.match(file.body, /<math/);
  }
  for (const checkbox of h.render().filter(n => n.type === 'input' && n.props.type === 'checkbox').slice(0, 8)) h.change(checkbox, { checked: false });
  const capture = h.render().find(n => text(n.props.children as ReactNode) === 'Replace capture with current scenario');
  assert.equal(capture?.props.disabled, true);
});
