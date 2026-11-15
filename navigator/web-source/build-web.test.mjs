import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createElement } from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import dynamic from './lazy-dynamic.mjs';
import { buildWeb, staticClosure } from '../scripts/build-web.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function render(Component) {
  return new Promise((resolve, reject) => {
    let html = '';
    const sink = new Writable({ write(chunk, encoding, next) { html += chunk.toString(); next(); } });
    sink.on('finish', () => resolve(html));
    const stream = renderToPipeableStream(createElement(Component, { label: 'loaded' }), {
      onAllReady() { stream.pipe(sink); }, onError: reject,
    });
  });
}

test('hosted adapter defers, normalizes named/default exports and preserves successful/rejected lazy caching', async () => {
  let calls = 0;
  const Named = dynamic(async () => { calls++; return function NamedView({ label }) { return createElement('p', null, label); }; }, { ssr: false });
  assert.equal(calls, 0);
  assert.match(await render(Named), /<p>loaded<\/p>/);
  assert.match(await render(Named), /<p>loaded<\/p>/);
  assert.equal(calls, 1);
  assert.match(await render(dynamic(async () => ({ default: function DefaultView() { return createElement('b', null, 'default'); } }))), /<b>default<\/b>/);
  let failures = 0;
  const Failed = dynamic(async () => { failures++; throw new Error('missing chunk'); });
  await assert.rejects(render(Failed), /missing chunk/);
  await assert.rejects(render(Failed), /missing chunk/);
  assert.equal(failures, 1);
  assert.throws(() => dynamic(Promise.resolve({})));
  assert.throws(() => dynamic(async () => ({}), { unsupported: true }));
  // Exercise the actual scoped boundary's terminal UI and deliberate page reload.
  const boundaryElement = Failed({}), Boundary = boundaryElement.type;
  const boundary = new Boundary({ children: 'view' });
  assert.equal(boundary.render(), 'view');
  boundary.state = Boundary.getDerivedStateFromError(new Error('missing chunk'));
  const fallback = boundary.render();
  assert.equal(fallback.props.role, 'alert');
  assert.match(fallback.props.children[0].props.children, /could not load/);
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window'); let reloads = 0;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { reload() { reloads++; } } } });
  try { fallback.props.children[1].props.onClick(); assert.equal(reloads, 1); }
  finally { if (previous) Object.defineProperty(globalThis, 'window', previous); else Reflect.deleteProperty(globalThis, 'window'); }
});

test('static closure counts cycles once, defers heavy branches and rejects dangling static/dynamic modules', () => {
  const outputs = {
    main: { imports: [{ path: 'shared', kind: 'import-statement' }, { path: 'heavy', kind: 'dynamic-import' }] },
    shared: { imports: [{ path: 'main', kind: 'import-statement' }] }, heavy: { imports: [] },
  };
  assert.deepEqual(staticClosure(outputs, 'main'), ['main', 'shared']);
  assert.throws(() => staticClosure({ a: { imports: [{ path: 'gone', kind: 'dynamic-import' }] } }, 'a'), /Missing emitted module/);
  assert.throws(() => staticClosure({ a: { imports: [{ path: 'external', external: true }] } }, 'a'), /external/);
});

test('actual hosted build is deterministic, has complete nested ESM/CSS/font outputs and excludes heavy initial modules', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'lunario-web-builder-test-'));
  const before = await Promise.all(['scripts/build-standalone.mjs', 'standalone/main.tsx', '../index.html', 'package.json', 'public/solarreach-navigator.html'].map(async file => [file, hash(await readFile(path.join(root, file)))]));
  try {
    const first = path.join(folder, 'one'), second = path.join(folder, 'two');
    const receipt = await buildWeb({ output: first });
    // Test the real CLI environment override independently of the API argument.
    execFileSync(process.execPath, ['scripts/build-web.mjs'], { cwd: root,
      env: { ...process.env, LUNARIO_WEB_OUTPUT: second }, stdio: 'pipe' });
    assert.deepEqual(JSON.parse(await readFile(path.join(second, 'build-receipt.json'), 'utf8')), receipt);
    assert.equal(await readFile(path.join(first, 'metafile.json'), 'utf8'), await readFile(path.join(second, 'metafile.json'), 'utf8'));
    assert.ok(receipt.files.length > 20);
    assert.ok(receipt.initialJSBytes < 2_000_000);
    assert.ok(receipt.totalJSBytes > receipt.initialJSBytes * 3);
    assert.ok(!receipt.initialInputs.some(file => /node_modules\/(three|@dimforge\/rapier)|workbench\/scene\/runtime/.test(file)));
    assert.ok(!receipt.initialInputs.some(file => /node_modules\/next\//.test(file)));
    const meta = JSON.parse(await readFile(path.join(first, 'metafile.json'), 'utf8'));
    assert.ok(Object.keys(meta.inputs).some(file => file.includes('node_modules/three/')));
    assert.ok(Object.keys(meta.inputs).some(file => file.includes('@dimforge/rapier')));
    assert.ok(Object.keys(meta.inputs).includes('components/navigator.tsx'));
    assert.ok(Object.keys(meta.inputs).includes('components/branding/lunario-loader-runtime.ts'));
    assert.ok(Object.keys(meta.inputs).includes('app/mission-theme.css'));
    for (const key of Object.keys(meta.outputs)) staticClosure(meta.outputs, key);
    const html = await readFile(path.join(first, 'index.html'), 'utf8');
    assert.ok(Buffer.byteLength(html) < 4096);
    assert.match(html, /type="module"/);
    assert.match(html, /__LUNARIO_PUBLIC_BASE__='\.\.\/navigator\/public\/'/);
    assert.doesNotMatch(html, /__SOLARREACH_CATALOG__|base64|<iframe|modulepreload/);
    assert.equal(receipt.initialJSBytes, receipt.files.filter(file => receipt.initialJS.includes(file.path)).reduce((sum, file) => sum + file.bytes, 0));
    const localReference = async (reference, from) => {
      if (reference.startsWith('data:')) return;
      const base = 'https://example.org/nested/Lunario/web/';
      const url = new URL(reference, base + from);
      assert.ok(url.href.startsWith(base), `Reference escaped hosted tree: ${url}`);
      await readFile(path.join(first, url.href.slice(base.length)));
    };
    for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) await localReference(match[1], 'index.html');
    for (const file of receipt.files) {
      const bytes = await readFile(path.join(first, file.path));
      assert.equal(bytes.length, file.bytes); assert.equal(hash(bytes), file.sha256);
      assert.equal(hash(await readFile(path.join(second, file.path))), file.sha256);
      if (file.path.endsWith('.css')) {
        for (const match of bytes.toString().matchAll(/url\(["']?([^"')]+)["']?\)/g)) await localReference(match[1], file.path);
      }
      if (file.path.endsWith('.js')) {
        for (const match of bytes.toString().matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["']([^"']+)["']/g)) {
          if (match[1].startsWith('.')) await localReference(match[1], file.path);
        }
      }
    }
    const font = receipt.files.find(file => file.path.endsWith('.woff2'));
    assert.ok(font); assert.equal(font.sha256, hash(await readFile(path.join(root, 'public/fonts/lunario/geist-var.woff2'))));
    assert.ok(receipt.files.some(file => file.path.endsWith('/OFL.txt')));
    const tailwind = receipt.files.find(file => file.path.includes('/tailwind-'));
    assert.match(await readFile(path.join(first, tailwind.path), 'utf8'), /\.antialiased/);
    const appCSS = await readFile(path.join(first, meta.outputs[receipt.entry].cssBundle), 'utf8');
    assert.match(appCSS, /@font-face/);
    assert.match(appCSS, /--font-display/);
    assert.doesNotMatch(appCSS, /url\(["']?\//);
    for (const [file, digest] of before) assert.equal(hash(await readFile(path.join(root, file))), digest, `${file} was mutated`);
  } finally { await rm(folder, { recursive: true, force: true }); }
});
