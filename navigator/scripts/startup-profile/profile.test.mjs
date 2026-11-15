import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import { Writable } from 'node:stream';
import { build } from 'esbuild';
import path from 'node:path';
import dynamic from './lazy-dynamic.mjs';
import { publicAssetURL, staticClosure, inspectHTML, root } from './profile.mjs';

test('asset transport preserves the project/public base without changing canonical identities', () => {
  assert.equal(publicAssetURL('/data/catalog.json', 'https://rian-beep.github.io/Lunario/navigator/public/'),
    'https://rian-beep.github.io/Lunario/navigator/public/data/catalog.json');
  assert.equal(publicAssetURL('/data/global-terrain.bin.gz', 'https://example.org/'), 'https://example.org/data/global-terrain.bin.gz');
  for (const input of ['/data/../private', 'https://elsewhere.org/data/a', '/data/a?token=b', '/data/%2e%2e/a', '/data/a\\b']) {
    assert.throws(() => publicAssetURL(input, 'https://example.org/Lunario/'));
  }
  assert.throws(() => publicAssetURL('/data/a', 'https://example.org/Lunario'));
});

test('static closure counts shared cyclic dependencies once and excludes deferred branches', () => {
  const output = {
    entry: { imports: [{ path: 'shared', kind: 'import-statement' }, { path: 'heavy', kind: 'dynamic-import' }] },
    shared: { imports: [{ path: 'entry', kind: 'import-statement' }] }, heavy: { imports: [] },
  };
  assert.deepEqual(staticClosure(output, 'entry'), ['entry', 'shared']);
  assert.throws(() => staticClosure({ entry: { imports: [{ path: 'missing' }] } }, 'entry'));
});

test('HTML accounting uses UTF8 bytes and finds data before app code', () => {
  const html = Buffer.from('🌙<script>window.__SOLARREACH_CATALOG__={};</script><script>app()</script>');
  const result = inspectHTML(html);
  assert.equal(result.bytes, html.length);
  assert.equal(result.scripts[0].startByte, 4);
  assert.equal(result.scripts[0].embeddedData, true);
  assert.equal(result.scripts[1].bodyBytes, 5);
});

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

test('client shim defers loader until render, normalizes named component and caches successful load', async () => {
  let calls = 0;
  const Component = dynamic(async () => { calls++; return function Named({ label }) { return createElement('p', null, label); }; }, { ssr: false });
  assert.equal(calls, 0);
  assert.match(await render(Component), /<p>loaded<\/p>/);
  assert.match(await render(Component), /<p>loaded<\/p>/);
  assert.equal(calls, 1);
  const Default = dynamic(async () => ({ default: function Default() { return createElement('b', null, 'default'); } }));
  assert.match(await render(Default), /<b>default<\/b>/);
  assert.throws(() => dynamic(Promise.resolve({})));
  assert.throws(() => dynamic(async () => ({}), { unsupported: true }));
});

test('failed lazy imports surface the error and stay cached until a new lazy identity is made', async () => {
  let calls = 0;
  const Component = dynamic(async () => { calls++; throw Error('chunk unavailable'); });
  await assert.rejects(render(Component), /chunk unavailable/);
  await assert.rejects(render(Component), /chunk unavailable/);
  assert.equal(calls, 1);
  const Retry = dynamic(async () => function Recovered() { return createElement('p', null, 'retried'); });
  assert.match(await render(Retry), /retried/);
});

for (const useShim of [false, true]) test(`ESM ${useShim ? 'shim' : 'Next'} keeps actual Three renderer and Rapier outside entry static graph`, async () => {
  const result = await build({
    absWorkingDir: root, entryPoints: ['standalone/main.tsx'], bundle: true, minify: true, write: false,
    metafile: true, outdir: path.join(root, '.startup-profile-virtual'), splitting: true, format: 'esm', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: useShim ? [{ name: 'profile-shim', setup(plugin) {
      plugin.onResolve({ filter: /^next\/dynamic$/ }, () => ({ path: path.join(root, 'scripts/startup-profile/lazy-dynamic.mjs') }));
    } }] : [],
  });
  const outputs = result.metafile.outputs;
  const entry = Object.keys(outputs).find(name => outputs[name].entryPoint === 'standalone/main.tsx');
  const inputs = staticClosure(outputs, entry).flatMap(name => Object.keys(outputs[name].inputs));
  assert.ok(inputs.includes('components/navigator.tsx'));
  assert.ok(!inputs.some(name => name.includes('three/build') || name.includes('@dimforge/rapier')));
  assert.ok(Object.values(outputs).some(output => output.entryPoint === 'components/workbench/scene.tsx'));
  assert.ok(Object.values(outputs).flatMap(output => output.imports).some(item => item.kind === 'dynamic-import'));
});
