#!/usr/bin/env node
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const virtual = path.join(root, '.lunario-web-virtual');
const slash = value => value.split(path.sep).join('/');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

/** Complete static import closure, including shared chunks, with deferred imports excluded. */
export function staticClosure(outputs, entry) {
  const seen = new Set();
  const visit = key => {
    if (seen.has(key)) return;
    const output = outputs[key];
    if (!output) throw new Error(`Missing emitted module ${key}`);
    seen.add(key);
    for (const item of output.imports) {
      if (item.external) throw new Error(`Unexpected external module ${item.path}`);
      if (!outputs[item.path]) throw new Error(`Missing emitted module ${item.path}`);
      if (item.kind !== 'dynamic-import') visit(item.path);
    }
  };
  visit(entry);
  return [...seen].sort();
}

/** Output paths never contain the chosen temporary/publish directory. */
function normalizeMetafile(metafile) {
  const name = key => slash(path.relative(virtual, path.resolve(root, key)));
  return {
    inputs: Object.fromEntries(Object.entries(metafile.inputs).sort(([a], [b]) => a.localeCompare(b))),
    outputs: Object.fromEntries(Object.entries(metafile.outputs).map(([key, output]) => [name(key), {
      ...output,
      ...(output.cssBundle ? { cssBundle: name(output.cssBundle) } : {}),
      imports: output.imports.map(item => ({ ...item, path: item.external ? item.path : name(item.path) })),
    }]).sort(([a], [b]) => a.localeCompare(b))),
  };
}

export async function buildWeb({ output = process.env.LUNARIO_WEB_OUTPUT ?? path.join(root, '../web') } = {}) {
  const target = path.resolve(output);
  if ([root, path.dirname(root), path.join(root, 'public')].includes(target)) throw new Error('Choose a dedicated web output directory');
  const scratch = await mkdtemp(path.join(tmpdir(), 'lunario-web-css-'));
  try {
    const cssPath = path.join(scratch, 'tailwind.css');
    execFileSync(process.execPath, [path.join(root, 'node_modules/@tailwindcss/cli/dist/index.mjs'),
      '-i', path.join(root, 'app/globals.css'), '-o', cssPath, '--minify'], { cwd: root, stdio: 'pipe' });
    const result = await build({
      absWorkingDir: root, entryPoints: ['web-source/main.tsx'], outdir: path.join(virtual, 'assets'),
      entryNames: '[name]-[hash]', chunkNames: 'chunks/[name]-[hash]', assetNames: 'fonts/[name]-[hash]',
      bundle: true, splitting: true, format: 'esm', minify: true, write: false, metafile: true,
      jsx: 'automatic', target: ['es2020'], preserveSymlinks: true, loader: { '.woff2': 'file' },
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{ name: 'hosted-client-dynamic', setup(plugin) {
        plugin.onResolve({ filter: /^next\/dynamic$/ }, () => ({ path: path.join(root, 'web-source/lazy-dynamic.mjs') }));
      } }],
    });
    const metafile = normalizeMetafile(result.metafile);
    const entry = Object.keys(metafile.outputs).find(key => metafile.outputs[key].entryPoint === 'web-source/main.tsx' && key.endsWith('.js'));
    if (!entry) throw new Error('Hosted entry output missing');
    // Validate *every* deferred branch as well as the initial graph.
    for (const key of Object.keys(metafile.outputs)) staticClosure(metafile.outputs, key);
    const initial = staticClosure(metafile.outputs, entry).filter(key => key.endsWith('.js'));
    const initialInputs = [...new Set(initial.flatMap(key => Object.keys(metafile.outputs[key].inputs)))].sort();
    if (initialInputs.some(key => /(?:node_modules\/(?:three|@dimforge\/rapier)|workbench\/scene\/runtime)/.test(key))) {
      throw new Error('Three/Rapier renderer entered the hosted initial static graph');
    }
    const files = new Map(result.outputFiles.map(file => [slash(path.relative(virtual, file.path)), Buffer.from(file.contents)]));
    const tailwind = await readFile(cssPath);
    const tailwindName = `assets/tailwind-${sha256(tailwind).slice(0, 12)}.css`;
    files.set(tailwindName, tailwind);
    files.set('assets/favicon.ico', await readFile(path.join(root, 'app/favicon.ico')));
    for (const [name, source] of [
      ['assets/fonts/OFL.txt', 'public/fonts/lunario/OFL.txt'],
      ['assets/licenses/satellite-js.txt', 'public/licenses/satellite-js.txt'],
      ['assets/licenses/gods-eye-view.txt', 'public/licenses/gods-eye-view.txt'],
    ]) files.set(name, await readFile(path.join(root, source)));
    const appCSS = metafile.outputs[entry].cssBundle;
    if (!appCSS || !files.has(appCSS)) throw new Error('Mission theme CSS output missing');
    // Match app/layout.tsx's preference boot without touching scenario/deep-link state.
    const themeBoot = `(function(){try{var k='lunario-ui-theme';var t=localStorage.getItem(k);if(t!=='light'){document.documentElement.setAttribute('data-ui-theme','dark');document.documentElement.classList.add('dark');if(t!=='dark')localStorage.setItem(k,'dark');}}catch(e){document.documentElement.setAttribute('data-ui-theme','dark');document.documentElement.classList.add('dark');}})();`;
    const html = `<!doctype html>
<html lang="en" data-ui-theme="dark" class="dark"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lunario — Lunar Landing Site Navigator</title>
<meta name="description" content="Compare lunar south-pole landing sites and dates. Sun and Earth against the real LOLA horizon, for power and direct-to-Earth contact.">
<link rel="icon" href="./assets/favicon.ico">
<link rel="stylesheet" href="./${tailwindName}"><link rel="stylesheet" href="./${appCSS}">
<script>window.__LUNARIO_PUBLIC_BASE__='../navigator/public/';${themeBoot}</script>
</head><body class="antialiased"><div id="root"></div>
<noscript>Lunario needs JavaScript to display the lunar map and planning tools.</noscript>
<script type="module" src="./${entry}"></script>
</body></html>
`;
    files.set('index.html', Buffer.from(html));
    files.set('metafile.json', Buffer.from(`${JSON.stringify(metafile, null, 2)}\n`));
    const inventory = [...files].sort(([a], [b]) => a.localeCompare(b)).map(([name, bytes]) => ({
      path: name, bytes: bytes.length, sha256: sha256(bytes),
      gzip6EstimateBytes: gzipSync(bytes, { level: 6 }).length,
    }));
    const receipt = {
      schemaVersion: 1, publicBase: '../navigator/public/', entry, initialJS: initial,
      initialJSBytes: inventory.filter(file => initial.includes(file.path)).reduce((sum, file) => sum + file.bytes, 0),
      initialJSGzip6EstimateBytes: inventory.filter(file => initial.includes(file.path)).reduce((sum, file) => sum + file.gzip6EstimateBytes, 0),
      totalJSBytes: inventory.filter(file => file.path.endsWith('.js')).reduce((sum, file) => sum + file.bytes, 0),
      initialInputs, files: inventory,
      limits: 'Static transitive import closure; render-triggered imports may add requests. Gzip6 estimates, not browser timings or CDN wire bytes.',
    };
    files.set('build-receipt.json', Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`));
    for (const [name, bytes] of files) {
      const destination = path.join(target, name);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, bytes);
    }
    return receipt;
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length > 2) throw new Error('Usage: [LUNARIO_WEB_OUTPUT=DIR] node scripts/build-web.mjs');
  const receipt = await buildWeb();
  console.log(JSON.stringify({ output: path.resolve(process.env.LUNARIO_WEB_OUTPUT ?? path.join(root, '../web')),
    entry: receipt.entry, files: receipt.files.length, initialJSBytes: receipt.initialJSBytes,
    initialJSGzip6EstimateBytes: receipt.initialJSGzip6EstimateBytes, totalJSBytes: receipt.totalJSBytes }, null, 2));
}
