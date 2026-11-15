#!/usr/bin/env node
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, stat, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { tmpdir, cpus } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const compressedBytes = bytes => gzipSync(bytes, { level: 6 }).length;

// Resolve only the transport URL: never mutate canonical source/metadata URLs.
export function publicAssetURL(asset, publicBase) {
  const base = new URL(publicBase);
  if (!['https:', 'http:'].includes(base.protocol) || !base.pathname.endsWith('/') || base.search || base.hash) {
    throw Error('Public base must be an HTTP(S) directory URL');
  }
  if (!/^\/(data|fonts|branding)\//.test(asset) || asset.includes('..') || /[\\?#%]/.test(asset)) {
    throw Error('Expected a canonical local public asset path');
  }
  return new URL(asset.slice(1), base).href;
}

// Count the complete transitive static graph, not just the entry file.
export function staticClosure(outputs, entry) {
  const seen = new Set();
  function visit(key) {
    if (seen.has(key)) return;
    const output = outputs[key];
    if (!output) throw Error(`Missing static output ${key}`);
    seen.add(key);
    for (const item of output.imports) {
      if (item.kind === 'dynamic-import') continue;
      if (item.external) throw Error(`Unexpected external static import ${item.path}`);
      visit(item.path);
    }
  }
  visit(entry);
  return [...seen].sort();
}

export function inspectHTML(bytes) {
  const html = bytes.toString('utf8');
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(match => ({
    startByte: Buffer.byteLength(html.slice(0, match.index)),
    bodyBytes: Buffer.byteLength(match[1]),
    sha256: sha(match[1]),
    embeddedData: match[1].includes('window.__SOLARREACH_CATALOG__='),
  }));
  return { bytes: bytes.length, sha256: sha(bytes), gzip6EstimateBytes: compressedBytes(bytes), scripts };
}

async function bundleProfile(mode) {
  const split = mode !== 'iife';
  const result = await build({
    absWorkingDir: root, entryPoints: ['standalone/main.tsx'], bundle: true,
    minify: true, write: false, metafile: true, outdir: path.join(root, '.startup-profile-virtual'),
    format: split ? 'esm' : 'iife', splitting: split, jsx: 'automatic', target: ['es2020'],
    define: { 'process.env.NODE_ENV': '"production"', ...(!split ? { 'import.meta.url': 'document.baseURI' } : {}) },
    plugins: mode === 'esm-lazy-shim' ? [{
      name: 'profile-client-dynamic', setup(plugin) {
        plugin.onResolve({ filter: /^next\/dynamic$/ }, () => ({ path: path.join(root, 'scripts/startup-profile/lazy-dynamic.mjs') }));
      },
    }] : [],
  });
  const outputs = result.metafile.outputs;
  const entry = Object.keys(outputs).find(key => outputs[key].entryPoint === 'standalone/main.tsx');
  const closure = staticClosure(outputs, entry);
  const files = result.outputFiles.map(file => {
    const key = path.relative(root, file.path).split(path.sep).join('/');
    return { path: key, bytes: file.contents.length, gzip6EstimateBytes: compressedBytes(file.contents),
      initialJS: closure.includes(key), entryPoint: outputs[key].entryPoint ?? null,
      imports: outputs[key].imports, sha256: sha(file.contents) };
  });
  const initialJS = files.filter(file => file.initialJS);
  const totalJS = files.filter(file => file.path.endsWith('.js'));
  const initialInputs = new Map();
  for (const key of closure) for (const [name, input] of Object.entries(outputs[key].inputs)) {
    initialInputs.set(name, (initialInputs.get(name) ?? 0) + input.bytesInOutput);
  }
  const inputs = Object.keys(result.metafile.inputs).sort();
  return {
    mode, entry, initialJSBytes: initialJS.reduce((sum, file) => sum + file.bytes, 0),
    initialJSGzip6EstimateBytes: initialJS.reduce((sum, file) => sum + file.gzip6EstimateBytes, 0),
    totalJSBytes: totalJS.reduce((sum, file) => sum + file.bytes, 0),
    jsFiles: totalJS.length, cssBytes: files.filter(file => file.path.endsWith('.css')).reduce((sum, file) => sum + file.bytes, 0),
    initialContains: Object.fromEntries(['three', 'rapier', 'next/dist', 'scene/runtime', 'flight.ts'].map(term => [term, [...initialInputs.keys()].some(name => name.includes(term))])),
    largestInitialInputs: [...initialInputs].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([name, bytesInOutput]) => ({ name, bytesInOutput })),
    files, inputs,
  };
}

async function localCPU() {
  // Measure the real terrain decoder in Node; this is not browser CPU/paint timing.
  const terrainBuild = await build({ absWorkingDir: root,
    stdin: { contents: "export {decodeTerrain} from './lib/terrain';export {simulateFlight,DEFAULT_FLIGHT} from './lib/flight';", resolveDir: root, loader: 'ts' },
    bundle: true, write: false, format: 'esm', platform: 'node' });
  const { decodeTerrain, simulateFlight, DEFAULT_FLIGHT } = await import(`data:text/javascript;base64,${Buffer.from(terrainBuild.outputFiles[0].contents).toString('base64')}`);
  const text = await readFile(path.join(root, 'public/data/terrain.json'), 'utf8');
  const samples = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    const raw = JSON.parse(text);
    const parsed = performance.now();
    const decoded = decodeTerrain(raw);
    const end = performance.now();
    const grids = [decoded.overview, ...decoded.patches];
    samples.push({ jsonParseMs: parsed - start, actualDecodeTerrainMs: end - parsed,
      cells: grids.reduce((sum, grid) => sum + grid.heights.length, 0) });
  }
  const flightSamples = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    const result = simulateFlight(DEFAULT_FLIGHT);
    flightSamples.push({ simulateFlightMs: performance.now() - start, points: result.points.length, status: result.status });
  }
  return { runtime: process.version, cpu: cpus()[0]?.model, samples, flightSamples,
    flightScope: 'Actual production simulateFlight(DEFAULT_FLIGHT), default reference sphere, no terrain callback; not a restored scenario or a measured first UI render.',
    limits: 'Five sequential warm filesystem/string Node observations, no cache flush or CPU throttle. No browser/mobile latency or memory-peak claim.' };
}

async function request(url, folder, name, head = false) {
  const headers = path.join(folder, `${name}.headers`);
  const body = path.join(folder, `${name}.body`);
  const format = '%{http_code}\n%{size_download}\n%{time_namelookup}\n%{time_connect}\n%{time_appconnect}\n%{time_starttransfer}\n%{time_total}\n%{url_effective}\n';
  // Fresh curl process, no browser disk cache; CDN/OS caches remain uncontrolled.
  const args = ['--silent', '--show-error', '--location', '--max-time', '120', '--proto', '=https', '--proto-redir', '=https',
    '--compressed', '--dump-header', headers, '--output', body, '--write-out', format];
  if (head) args.push('--head');
  args.push(url);
  const startedUtc = new Date().toISOString();
  const values = execFileSync('curl', args, { encoding: 'utf8', timeout: 125000 }).trim().split('\n');
  const rawHeaders = await readFile(headers, 'utf8');
  const selected = {};
  for (const line of rawHeaders.split(/\r?\n/)) {
    const colon = line.indexOf(':');
    const key = line.slice(0, colon).toLowerCase();
    if (colon > 0 && ['content-type', 'content-encoding', 'content-length', 'cache-control', 'etag', 'last-modified', 'x-cache', 'age', 'vary'].includes(key)) selected[key] = line.slice(colon + 1).trim();
  }
  const bytes = head ? Buffer.alloc(0) : await readFile(body);
  return { startedUtc, method: head ? 'HEAD' : 'GET', url, effectiveURL: values[7], status: Number(values[0]),
    wireBodyBytes: Number(values[1]), decodedBodyBytes: bytes.length, sha256: head ? null : sha(bytes),
    seconds: Object.fromEntries(['dns', 'connect', 'tls', 'firstByte', 'total'].map((name, i) => [name, Number(values[i + 2])])),
    headers: selected, bytes };
}

async function deliveryProfile() {
  const folder = await mkdtemp(path.join(tmpdir(), 'lunario-startup-http-'));
  const base = 'https://rian-beep.github.io/Lunario/';
  const observations = [];
  try {
    const index = await request(base, folder, 'index');
    const text = index.bytes.toString('utf8');
    const iframe = text.match(/<iframe\b[^>]*\bsrc="([^"]+)"/i)?.[1];
    if (index.status !== 200 || !iframe) throw Error(`Pages index status ${index.status}; navigator iframe not found`);
    const frameURL = new URL(iframe, base);
    if (frameURL.origin !== new URL(base).origin || !frameURL.pathname.startsWith('/Lunario/')) throw Error('Unexpected public iframe target');
    const frame = await request(frameURL.href, folder, 'frame');
    if (frame.status !== 200) throw Error(`Navigator iframe HTTP ${frame.status}`);
    observations.push({ ...index, bytes: undefined, iframe }, { ...frame, bytes: undefined, html: inspectHTML(frame.bytes) });
    for (const [name, url] of [
      ['loader', new URL('loader/loader.js', base).href],
      ['css', new URL('css/site.css', base).href],
      ['wrong-origin-data', new URL('/data/catalog.json', base).href],
      ['public-data', new URL('navigator/public/data/catalog.json', base).href],
    ]) {
      const result = await request(url, folder, name, true);
      observations.push({ ...result, bytes: undefined });
    }
    return { observations, limits: 'One sequential GET per document and four HEAD probes from Clevo. No browser/cache-controlled navigation, FCP/LCP, React readiness, screenshot, iframe paint, or first 3D timing. CDN cache state is recorded, not flushed.' };
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

export async function profile({ remote = false } = {}) {
  const offline = inspectHTML(await readFile(path.join(root, 'public/solarreach-navigator.html')));
  const imagery = JSON.parse(await readFile(path.join(root, 'public/data/imagery.json'), 'utf8'));
  const paths = ['public/data/catalog.json', 'public/data/map.png', 'public/data/terrain.json', 'public/data/global-terrain.json',
    'public/data/global-terrain.bin.gz', 'public/data/imagery.json', 'public/data/nasa-model.json', 'public/data/nasa-moon-mesh.bin.gz',
    'public/data/imagery/nasa-moon-8k.jpg', 'public/data/equipment/apollo-lunar-module.glb', 'public/data/evidence-manifest.json',
    'public/data/planning-demo.json', 'public/fonts/lunario/geist-var.woff2',
    ...[imagery.overview, ...imagery.patches, imagery.global].map(image => {
      if (!image.url.startsWith('/data/imagery/')) throw Error('Unexpected public imagery path');
      return `public${image.url}`;
    })];
  const assets = [];
  for (const name of [...new Set(paths)]) {
    const bytes = await readFile(path.join(root, name));
    assets.push({ path: name, bytes: bytes.length, sha256: sha(bytes), gzip6EstimateBytes: compressedBytes(bytes) });
  }
  const builds = [];
  for (const mode of ['iife', 'esm-next-dynamic', 'esm-lazy-shim']) builds.push(await bundleProfile(mode));
  const sources = [...new Set(builds.flatMap(item => item.inputs).filter(name => !name.includes('node_modules/') && !name.startsWith('<')))];
  sources.push('scripts/build-standalone.mjs', '../index.html', '../css/site.css', '../loader/loader.js', 'package.json', 'package-lock.json');
  const sourceIdentity = [];
  for (const name of [...new Set(sources)].sort()) {
    const file = path.resolve(root, name);
    const bytes = await readFile(file);
    sourceIdentity.push({ path: name, bytes: (await stat(file)).size, sha256: sha(bytes) });
  }
  const output = { checkedUtc: new Date().toISOString(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    node: process.version, offline, assets,
    builds: builds.map(({ inputs, ...summary }) => ({ ...summary, inputCount: inputs.length })),
    sourceIdentity, localCPU: await localCPU(),
    assetBaseExample: { base: 'https://rian-beep.github.io/Lunario/navigator/public/',
      catalog: publicAssetURL('/data/catalog.json', 'https://rian-beep.github.io/Lunario/navigator/public/'),
      wrongOriginAbsolute: new URL('/data/catalog.json', 'https://rian-beep.github.io/Lunario/').href },
    limits: ['Builds run with write:false, no generated application or dependency edits. CSS byte counts exclude the separate Tailwind CLI output.',
      'ESM static graph sizes are compile-time estimates; render-triggered dynamic imports can still be needed on initial UI.',
      'gzip level 6 estimates are not measured CDN wire bytes. No server/browser, bundler build duration, or localhost timings.'] };
  if (remote) output.publicDelivery = await deliveryProfile();
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const remote = args[0] === '--remote';
  if (remote) args.shift();
  if (args.length !== 2 || args[0] !== '--output') throw Error('Usage: node scripts/startup-profile/profile.mjs [--remote] --output PATH');
  const result = await profile({ remote });
  await writeFile(args[1], `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ output: args[1], offlineBytes: result.offline.bytes,
    builds: result.builds.map(({ mode, initialJSBytes, initialJSGzip6EstimateBytes, totalJSBytes, jsFiles }) => ({ mode, initialJSBytes, initialJSGzip6EstimateBytes, totalJSBytes, jsFiles })),
    remote: result.publicDelivery?.observations.map(({ url, status, wireBodyBytes, decodedBodyBytes, seconds }) => ({ url, status, wireBodyBytes, decodedBodyBytes, seconds })) }, null, 2));
}
