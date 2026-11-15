#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright-core';

// Read rendered pixels, public DOM telemetry and network events; never inspect React state.
const { values } = parseArgs({ options: {
  url: { type: 'string', default: 'http://127.0.0.1:4356/' },
  file: { type: 'string', default: '/tmp/lunario-map-qa-offline.html' },
  out: { type: 'string', default: `/tmp/lunario-map-qa-${Date.now()}` },
  mode: { type: 'string', default: 'all' },
  help: { type: 'boolean', default: false },
} });
if (values.help) {
  console.log('node scripts/verify-map-screening.mjs --mode all|web|file --url http://host/nested/ --file /tmp/app.html --out /tmp/new-evidence-directory');
  process.exit(0);
}
assert.ok(['all', 'web', 'file'].includes(values.mode), '--mode must be all, web or file');
const webURL = new URL(values.url);
assert.ok(['http:', 'https:'].includes(webURL.protocol));
assert.ok(!webURL.username && !webURL.password && !webURL.search, 'Use a public URL without credentials or query parameters');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(values.out);
await mkdir(out, { recursive: true });
const outReal = await realpath(out), rootReal = await realpath(root);
const rel = relative(rootReal, outReal);
assert.ok(rel.startsWith('..') || isAbsolute(rel), 'Evidence must stay outside the repository');
try { await readFile(join(out, 'report.json')); throw new Error('Use a fresh --out directory; existing evidence is immutable'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const modes = values.mode === 'all' ? ['web', 'file'] : [values.mode];
const executable = process.env.LUNARIO_QA_CHROME ?? (process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'/usr/bin/google-chrome');
const flags = process.platform==='darwin' ? ['--force-color-profile=srgb'] : ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--disable-dev-shm-usage', '--force-color-profile=srgb'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const report = {
  createdUtc: new Date().toISOString(), sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  verifierSha256: sha(await readFile(fileURLToPath(import.meta.url))),
  chrome: execFileSync(executable, ['--version'], { encoding: 'utf8' }).trim(), flags,
  targets: { web: webURL.origin + webURL.pathname, file: resolve(values.file) },
  scope: ['Real pointer/keyboard/select/input UI; no React internals or response fixtures.', 'Fresh contexts measure a cold browser cache, not a throttled link or production latency.', 'External HTTP is blocked; authenticated terrain providers are never exercised.', 'Native zoom uses isolated Chrome profile preferences; no viewport/page-scale substitute.', 'No screen-reader, scientific accuracy, general WCAG or human acceptance claim.'],
  checks: [], sessions: [],
};
if (modes.includes('file')) report.offlineSha256 = sha(await readFile(resolve(values.file)));
const save = async () => {
  report.status = report.checks.some(c => c.status === 'fail') ? 'fail' : 'running';
  await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const cleanError = error => String(error?.message ?? error).replace(/https?:\/\/[^\s"'<>]+/g, '[URL omitted]');
async function screenshotPNG(s, path = null) {
  // Playwright's viewport:null screenshot clip can use CSS width at native zoom.
  // CDP without a clip retains the physical window raster at both zoom levels.
  const cdp = await s.context.newCDPSession(s.page);
  try {
    const result = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
    const png = Buffer.from(result.data, 'base64'); if (path) await writeFile(path, png); return png;
  } finally { await cdp.detach(); }
}
async function until(fn, message, timeout = 90000) {
  const end = Date.now() + timeout;
  let value;
  do { value = await fn(); if (value) return value; await sleep(150); } while (Date.now() < end);
  throw new Error(`Timed out: ${message}; last observed ${JSON.stringify(value)}`);
}
async function step(session, name, fn) {
  const started = Date.now(), record = { session: session.id, name };
  try { record.evidence = await fn(); record.status = 'pass'; }
  catch (error) { record.status = 'fail'; record.error = cleanError(error); }
  record.ms = Date.now() - started;
  const screenshot = `${session.id}-${name}-${record.status}.png`;
  try { await screenshotPNG(session, join(out, screenshot)); record.screenshot = screenshot; }
  catch (error) { record.screenshotError = cleanError(error); record.status = 'fail'; }
  report.checks.push(record);
  console.log(`${record.status.toUpperCase()} ${session.id} ${name}${record.error ? ': ' + record.error : ''}`);
  await save();
  return record;
}

// Passive instrumentation: observe canvas-to-canvas paints and their pixels, not app data.
function observeDOM() {
  const evidence = globalThis.__mapScreeningQA = { loaders: [], paints: [], dates: [], errors: [] };
  const start = performance.now();
  let loaderStart = null, lastDate = '';
  const sample = () => {
    const visible = [...document.querySelectorAll('.lunario-loader')].some(e => {
      const r = e.getBoundingClientRect(), s = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0;
    });
    if (visible && loaderStart === null) loaderStart = performance.now() - start;
    if (!visible && loaderStart !== null) {
      evidence.loaders.push({ startMs: loaderStart, endMs: performance.now() - start }); loaderStart = null;
    }
    const date = document.querySelector('.map-screening-dates')?.textContent ?? '';
    const status = [...document.querySelectorAll('.map-screening-legend [role="status"]')].map(e => e.textContent).join(' | ');
    const value = `${date}|${status}`;
    if (value !== lastDate) { evidence.dates.push({ at: performance.now(), date, status, sampling: document.querySelector('.map-screening-dates')?.nextElementSibling?.textContent ?? '' }); lastDate = value; }
  };
  setInterval(sample, 50);
  const draw = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (...args) {
    const result = Reflect.apply(draw, this, args), source = args[0];
    if (source instanceof HTMLCanvasElement && !source.isConnected && this.canvas.isConnected &&
        ((source.width === 960 && source.height === 480) || (source.width === 1013 && source.height === 1013))) {
      try {
        const data = source.getContext('2d').getImageData(0, 0, source.width, source.height).data;
        let hash = 2166136261, transparent = 0, coloured = 0, alphaSum = 0;
        for (let i = 0; i < data.length; i += 16) {
          const a = data[i + 3]; if (!a) transparent++; else coloured++;
          alphaSum += a;
          for (let j = 0; j < 4; j++) hash = Math.imul(hash ^ data[i + j], 16777619) >>> 0;
        }
        const previous = evidence.paints.at(-1);
        if (!previous || previous.hash !== hash || previous.width !== source.width) {
          evidence.paints.push({ at: performance.now(), width: source.width, height: source.height, hash, transparent, coloured, alphaSum,
            date: document.querySelector('.map-screening-dates')?.textContent ?? '',
            sampling: document.querySelector('.map-screening-dates')?.nextElementSibling?.textContent ?? '',
            transform: this.canvas.dataset.mapTransform ?? '' });
          if (evidence.paints.length > 250) evidence.paints.shift();
        }
      } catch (error) { evidence.errors.push(error.name); }
    }
    return result;
  };
}

async function newSession(browser, mode, id, context = null) {
  context ??= await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const session = { id, mode, context, requests: [], httpErrors: [], pageErrors: [], failedRequests: [], consoleErrors: [] };
  report.sessions.push(session);
  // Only serialize receipts, never Playwright handles/context or raw URLs.
  session.toJSON = () => Object.fromEntries(Object.entries(session).filter(([key]) => !['context', 'page', 'app', 'toJSON'].includes(key)));
  if (mode === 'file') await context.setOffline(true);
  await context.addInitScript(observeDOM);
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (['http:', 'https:'].includes(url.protocol) && (mode === 'file' || url.origin !== webURL.origin)) return route.abort('blockedbyclient');
    return route.continue();
  });
  const page = session.page = await context.newPage(); page.setDefaultTimeout(12000);
  const safeRequest = request => {
    const url = new URL(request.url());
    return { path: url.origin === webURL.origin ? url.pathname.replace(/\/[^/]*(?:token|secret|key)[^/]*/ig, '/[redacted]') : '[external HTTP blocked]', type: request.resourceType() };
  };
  page.on('request', request => {
    if (/^https?:/.test(request.url())) session.requests.push({ ...safeRequest(request), atMs: Date.now() - session.started });
  });
  page.on('response', response => {
    if (response.status() >= 400) session.httpErrors.push({ ...safeRequest(response.request()), status: response.status() });
  });
  page.on('requestfailed', request => session.failedRequests.push({ ...safeRequest(request), error: cleanError(request.failure()?.errorText) }));
  page.on('pageerror', error => session.pageErrors.push(cleanError(error)));
  page.on('console', message => { if (message.type() === 'error') session.consoleErrors.push(cleanError(message.text())); });
  session.started = Date.now();
  await page.goto(mode === 'file' ? pathToFileURL(resolve(values.file)).href : webURL.href, { waitUntil: 'domcontentloaded', timeout: 120000 });
  session.app = await until(async () => {
    for (const frame of page.frames()) if (await frame.getByRole('group', { name: 'Audience mode', exact: true }).count()) return frame;
    return null;
  }, 'real Navigator frame mounted', 120000);
  session.appReadyMs = Date.now() - session.started;
  session.publicBase = await session.app.evaluate(() => new URL(globalThis.__LUNARIO_PUBLIC_BASE__ || '/', document.baseURI).pathname);
  return session;
}
const button = (s, name) => s.app.getByRole('button', { name, exact: true });
const legend = s => s.app.getByRole('complementary', { name: 'Regional map layer legend' });
const controls = s => s.app.getByRole('region', { name: 'Regional map layers' });
const mapCanvas = s => s.app.locator('.map-pane canvas').first();
const scene = s => s.app.locator('.scene-host');
const sceneData = s => scene(s).evaluate(e => ({ ...e.dataset }));
async function dismissIntroduction(s) {
  if (s.introDismissed) return;
  await until(async () => !(await s.page.locator('.lunario-loader').isVisible()) && !(await s.app.locator('.lunario-loader').isVisible()), 'startup loader releases pointer', 65000);
  const dismiss = button(s, 'Dismiss introduction');
  await dismiss.waitFor({ state: 'visible', timeout: 30000 });
  await dismiss.click({ timeout: 65000 });
  s.introDismissed = true;
}
async function openLayers(s) {
  if (!await controls(s).isVisible()) await button(s, 'Layers').click();
  await controls(s).waitFor({ state: 'visible' });
}
async function closeLayers(s) {
  if (await controls(s).isVisible()) await button(s, 'Dismiss map layers').click();
}
async function rank(s, enabled = true) {
  await openLayers(s);
  await controls(s).getByRole('checkbox', { name: 'Rank sampled map cells' }).setChecked(enabled);
  await closeLayers(s);
  if (enabled) await settledRanking(s);
}
async function settledRanking(s) {
  await until(async () => {
    const text = await legend(s).innerText().catch(() => '');
    if (/Regional screening unavailable/.test(text)) throw new Error(text);
    return /\d+ sampled centres; \d+ unknown combined indices/.test(text);
  }, 'completed real regional sampling', 120000);
}
async function raster(s) {
  return s.app.evaluate(() => globalThis.__mapScreeningQA.paints.at(-1) ?? null);
}
async function chooseMetric(s, metric) {
  await openLayers(s);
  await controls(s).getByRole('combobox', { name: /^Map ranking factor/ }).selectOption(metric);
  await closeLayers(s); await settledRanking(s);
  await sleep(300);
}
async function canvasPixels(locator) {
  return locator.evaluate(canvas => {
    const { width, height } = canvas, data = canvas.getContext('2d').getImageData(0, 0, width, height).data;
    let hash = 2166136261, nonGrey = 0, nonBlack = 0;
    for (let i = 0; i < data.length; i += 64) {
      if (Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]) > 20) nonGrey++;
      if (Math.max(data[i], data[i + 1], data[i + 2]) > 25) nonBlack++;
      for (let j = 0; j < 4; j++) hash = Math.imul(hash ^ data[i + j], 16777619) >>> 0;
    }
    return { width, height, hash, nonGrey, nonBlack, transform: canvas.dataset.mapTransform, atlas: canvas.dataset.lunarAtlasReady };
  });
}
async function assertCanvas(s) {
  const pixels = await canvasPixels(mapCanvas(s));
  assert.ok(pixels.width > 200 && pixels.height > 100 && pixels.nonBlack > 500, `Map pixels missing: ${JSON.stringify(pixels)}`);
  assert.equal(pixels.atlas, 'true', 'Real bundled atlas is ready'); return pixels;
}
async function set2D(s, region) {
  await button(s, '2D map').click();
  await s.app.getByRole('combobox', { name: 'Map region', exact: true }).selectOption(region);
  await until(async () => (await canvasPixels(mapCanvas(s))).atlas === 'true', 'map imagery ready');
}
async function revealDates(s) {
  const expand = button(s, 'Expand timeline');
  if (await expand.isVisible()) await expand.click();
  await s.app.getByLabel('Landing date and time UTC', { exact: true }).waitFor({ state: 'visible' });
}
async function cameraAt(s, latitude, longitude = null) {
  await until(async () => {
    const d = await sceneData(s), lat = Number(d.viewLatitude), lon = Number(d.viewLongitude);
    return Number.isFinite(lat) && Math.abs(lat - latitude) < .3 && (longitude === null || Math.abs(((lon - longitude + 540) % 360) - 180) < .3);
  }, `camera at ${latitude}, ${longitude}`, 90000);
}
async function prepareGlobe(s, split = false) {
  await closeLayers(s);
  await button(s, split ? 'Split map and 3D' : '3D terrain').click();
  await s.app.locator('.app-header').getByRole('button', { name: 'Moon', exact: true }).click();
  await until(async () => (await sceneData(s)).moonModel === 'ready', 'NASA globe loaded', 120000);
  const cameraMenu = s.app.locator('.header-camera > summary'); await cameraMenu.click();
  await button(s, 'Globe').click(); await cameraMenu.click();
  await until(async () => {
    const data = await sceneData(s);
    return data.cameraMode === 'globe' && data.assetFlight === 'idle' && Number(data.cameraBodyRadiusKm) > 3500;
  }, 'explicit Globe overview completed', 90000);
  const labels = button(s, 'Map labels');
  if (await labels.getAttribute('aria-pressed') !== 'true') await labels.click();
}

async function mainChecks(s) {
  await step(s, 'loader-and-introduction', async () => {
    await until(async () => !(await s.page.locator('.lunario-loader').isVisible()) && !(await s.app.locator('.lunario-loader').isVisible()), 'loader clears', 65000);
    await dismissIntroduction(s);
    const timings = await Promise.all(s.page.frames().map(f => f.evaluate(() => globalThis.__mapScreeningQA?.loaders ?? [])));
    const spans = timings.flat().map(t => t.endMs - t.startMs);
    assert.ok(spans.length, 'Observed the actual startup loader');
    assert.ok(Math.max(...spans) >= 2800 && Math.max(...spans) <= 6500, `Expected approximately 3 s loader; observed ${spans.map(Math.round)} ms (cold source timing recorded separately)`);
    return { spansMs: spans, appReadyMs: s.appReadyMs };
  });
  // Keep independent scenarios runnable after a genuine loader failure.
  await step(s, 'initial-map-no-eager-dem', async () => {
    await dismissIntroduction(s);
    const cold = s.requests.slice(); s.coldRequests = cold;
    assert.deepEqual(cold.filter(r => /\/(?:global-)?terrain\.json$/.test(r.path)), [], 'No numerical DEM before ranking or 3D is requested');
    await set2D(s, 'polar'); return { coldRequests: cold, pixels: await assertCanvas(s) };
  });
  await step(s, 'polar-ranking-and-unknown-pixels', async () => {
    await set2D(s, 'polar'); const before = await assertCanvas(s);
    await rank(s); const after = await assertCanvas(s), paint = await raster(s);
    assert.ok(paint?.coloured > 0, 'Ranking paints coloured cells into actual map');
    assert.ok(paint.transparent > 0, 'Unsupported/unknown raster area remains transparent');
    assert.notEqual(after.hash, before.hash, 'Ranking changes actual map pixels');
    assert.match(await legend(s).innerText(), /1980 sampled centres/);
    assert.match(await legend(s).innerText(), /Unknown is uncoloured/);
    return { before, after, raster: paint, legend: await legend(s).innerText() };
  });
  const metrics = [['sun', 'Mean visible solar disk (%)', '%'], ['dark', 'Longest observed darkness (h)', 'h'], ['slope', 'Regional slope (°)', '°'], ['comms', 'Earth-centre contact geometry (%)', '%'], ['combined', 'Combined preference index (0–100)', '']];
  for (const [metric, label, unit] of metrics) await step(s, `metric-${metric}`, async () => {
    const before = await raster(s), requestCount = s.requests.length;
    await chooseMetric(s, metric);
    const paint = await raster(s), pixels = await assertCanvas(s);
    assert.equal(await legend(s).getByText(label, { exact: true }).count(), 1);
    const range = await legend(s).locator('.map-screening-range').innerText();
    if (unit) assert.ok(range.includes(unit), `Legend range reports ${unit}`);
    assert.ok(paint?.coloured > 0, `${metric} paints actual coloured raster`);
    if (before) assert.notEqual(paint.hash, before.hash, 'Factor selection recolours canvas');
    assert.equal(s.requests.length, requestCount, 'Factor edit makes no new HTTP requests');
    return { range, raster: paint, pixels, requestsAdded: s.requests.length - requestCount };
  });
  await step(s, 'opacity-and-weight-recolour-without-fetch', async () => {
    await chooseMetric(s, 'combined'); const before = await raster(s), count = s.requests.length;
    await openLayers(s); const slider = controls(s).getByRole('slider', { name: /Ranking overlay opacity/ });
    await slider.focus(); await slider.press('Home'); await slider.press('ArrowRight');
    await closeLayers(s); await sleep(400); const opacity = await raster(s);
    assert.notEqual(opacity.hash, before.hash); assert.ok(opacity.alphaSum < before.alphaSum, 'Keyboard opacity change reaches raster alpha');
    await openLayers(s); await slider.focus(); await slider.press('End');
    await controls(s).getByText('Ranking preferences', { exact: true }).click();
    const weight = controls(s).getByLabel('Visible solar disk weight', { exact: true });
    await weight.fill('100'); await closeLayers(s); await sleep(400); const weighted = await raster(s);
    assert.notEqual(weighted.hash, opacity.hash);
    // Compare weights at identical opacity, rather than attributing the opacity edit to weights.
    await openLayers(s); await controls(s).getByText('Ranking preferences', { exact: true }).click();
    await weight.fill('1'); await closeLayers(s); await sleep(400); const restored = await raster(s);
    assert.notEqual(restored.hash, weighted.hash, 'Weight alone recolours cached physical samples');
    assert.equal(s.requests.length, count, 'Opacity and weights never request new sources');
    return { before, opacity, weighted, restored, requestsAdded: s.requests.length - count };
  });
  await step(s, 'ice-170-published-references-and-sources', async () => {
    await openLayers(s); await controls(s).getByRole('checkbox', { name: 'Published ice evidence references' }).check();
    await until(async () => (await controls(s).innerText()).includes('170 published reference locations'), '170 real ice references');
    await controls(s).getByText('Published ice evidence and sources', { exact: true }).click();
    const select = controls(s).getByRole('combobox', { name: /^Published region or impact reference/ });
    assert.equal(await select.locator('option').count(), 171, '170 named choices plus prompt');
    const sources = await controls(s).locator('.map-screening-help > details').evaluateAll(es => es.map(e => ({ title: e.querySelector('summary')?.textContent, links: [...e.querySelectorAll('a')].map(a => ({ text: a.textContent, href: a.getAttribute('href') })) })));
    assert.equal(sources.length, 2, 'Both source publications remain attached');
    for (const source of sources) {
      assert.ok(source.links.some(a => a.text === 'Publication' && /^https:/.test(a.href)));
      assert.ok(source.links.some(a => a.text === 'Dataset' && /^https:/.test(a.href)));
    }
    const before = await canvasPixels(mapCanvas(s));
    await select.selectOption('lcross-centaur-2009');
    assert.match(await controls(s).innerText(), /impact ejecta|Water vapor/);
    assert.match(await controls(s).innerText(), /coverage.*unknown|unknown.*coverage/i);
    await closeLayers(s); const ice = await assertCanvas(s);
    // Verify marker pixels by switching just ice off and on at a fixed camera/time.
    await openLayers(s); await controls(s).getByRole('checkbox', { name: 'Published ice evidence references' }).uncheck(); await closeLayers(s);
    const off = await canvasPixels(mapCanvas(s));
    assert.notEqual(ice.hash, off.hash, 'Ice markers alter the rendered map');
    await openLayers(s); await controls(s).getByRole('checkbox', { name: 'Published ice evidence references' }).check(); await closeLayers(s);
    return { sources, choices: 170, before, ice, off };
  });
  await step(s, 'whole-moon-ranking-and-ice', async () => {
    await set2D(s, 'global'); await settledRanking(s); const on = await assertCanvas(s), paint = await raster(s);
    assert.equal(paint.width, 960); assert.ok(paint.coloured > 0);
    assert.match(await legend(s).innerText(), /170 published reference locations/);
    await rank(s, false); await until(async () => (await canvasPixels(mapCanvas(s))).hash !== on.hash, "Ranking removal repaints canvas", 3000); const off = await assertCanvas(s);
    assert.notEqual(on.hash, off.hash, 'Whole-Moon ranking paints real atlas');
    await rank(s); return { on, off, raster: paint, legend: await legend(s).innerText() };
  });
  await step(s, 'date-and-viewport-cancel-no-stale-publication', async () => {
    await set2D(s, 'global'); await rank(s); await revealDates(s);
    const field = s.app.getByLabel('Landing date and time UTC', { exact: true }), original = await field.inputValue();
    const date = new Date(original + 'Z'); date.setUTCDate(date.getUTCDate() + 1); const intermediate = date.toISOString().slice(0, 16);
    date.setUTCDate(date.getUTCDate() + 1); const final = date.toISOString().slice(0, 16);
    await s.app.evaluate(() => { globalThis.__mapScreeningQA.dates = []; globalThis.__mapScreeningQA.paints = []; });
    const samplingInProgress = async () => {
      const text = await legend(s).innerText();
      const match = text.match(/Sampling regional centres: (\d+)%/);
      return match && Number(match[1]) > 0 && Number(match[1]) < 100;
    };
    await field.fill(intermediate);
    await until(samplingInProgress, 'intermediate date job is running before cancellation');
    await field.fill(final);
    const changedAt = await s.app.evaluate(() => performance.now());
    // Keyboard zoom/pan follows the same public canvas event path as a user.
    const canvas = mapCanvas(s); await canvas.focus(); await canvas.press('+');
    await until(samplingInProgress, 'zoomed viewport job is running before pan cancels it');
    await canvas.press('ArrowRight'); await canvas.press('ArrowRight');
    await settledRanking(s); await sleep(800);
    const dates = await s.app.evaluate(() => globalThis.__mapScreeningQA.dates);
    const paints = await s.app.evaluate(() => globalThis.__mapScreeningQA.paints);
    const finalISO = final + ':00.000Z';
    assert.ok((await legend(s).locator('.map-screening-dates').innerText()).startsWith(finalISO));
    assert.ok(dates.some(d => /Waiting|Preparing|Sampling/.test(d.status)), 'Observed invalidation/in-progress state');
    assert.ok(dates.some(d => d.at >= changedAt && /sampled centres/.test(d.status)), 'Final date publishes completed samples');
    assert.deepEqual(dates.filter(d => d.at > changedAt + 100 && /sampled centres/.test(d.status) && !d.date.startsWith(finalISO)), [], 'Earlier dates never publish after final edit');
    assert.ok(paints.length && paints.every(p => p.at < changedAt + 100 || p.date.startsWith(finalISO)), 'Painted ranking belongs to final dates');
    const pixels = await assertCanvas(s);
    assert.ok(JSON.parse(pixels.transform).zoom > 1, 'Viewport actually changed');
    const sampling = await legend(s).locator('.map-screening-dates + p').innerText();
    assert.match(sampling, /12 × 8 viewport centres/, 'Final viewport publishes its bounded refinement');
    assert.ok(paints.every(p => p.at < changedAt + 100 || p.transform === pixels.transform), 'No cancelled viewport raster is painted after final edit');
    // Replay the final date without racing it. Compare raster content, not a date
    // label which could otherwise be attached to an obsolete published result.
    await field.fill(original); await settledRanking(s);
    await field.fill(final); await settledRanking(s); await sleep(300);
    const referenceRaster = await raster(s);
    assert.ok(paints.filter(p => p.at > changedAt + 100).every(p => p.hash === referenceRaster.hash), 'Every raced publication matches the independently settled final date/viewport raster');
    return { original, intermediate, final, dates, paints, pixels, sampling, referenceRaster };
  });
  await step(s, 'legend-minimize-expand-dismiss-and-panels', async () => {
    await closeLayers(s); const before = await raster(s);
    await button(s, 'Minimize legend').click();
    assert.equal(await legend(s).locator('.map-screening-ramp').isVisible(), false);
    assert.equal((await raster(s)).hash, before.hash, 'Minimize preserves ranking');
    await button(s, 'Expand legend').click(); assert.ok(await legend(s).locator('.map-screening-ramp').isVisible());
    await button(s, 'Dismiss map layers and legend').click(); assert.equal(await legend(s).count(), 0);
    await openLayers(s);
    assert.equal(await controls(s).getByRole('checkbox', { name: 'Rank sampled map cells' }).isChecked(), false);
    assert.equal(await controls(s).getByRole('checkbox', { name: 'Published ice evidence references' }).isChecked(), false);
    await closeLayers(s); await button(s, 'Hide panels for unobstructed view').click();
    await button(s, 'Show controls').click();
    await button(s, 'Dismiss location card').click(); assert.equal(await button(s, 'Dismiss location card').count(), 0);
    return { legendDismissedLayers: true, controlsRestored: true, locationDismissed: true };
  });
  await step(s, 'globe-overview-poles-landmarks-and-label-click', async () => {
    await prepareGlobe(s);
    const initial = await sceneData(s);
    const labels = s.app.locator('[data-globe-label]');
    assert.ok(await labels.filter({ hasText: 'North pole' }).isVisible(), 'North pole label available in overview');
    assert.ok(await labels.filter({ hasText: 'South pole' }).isVisible(), 'South pole label available in overview');
    assert.ok(await s.app.locator('[data-globe-label]:not([data-globe-label^="nav-"])').count() > 0, 'Actual named lunar landmarks visible');
    await labels.filter({ hasText: 'North pole' }).click(); await cameraAt(s, 90);
    const north = await sceneData(s); await screenshotPNG(s, join(out, `${s.id}-north-pole.png`));
    await labels.filter({ hasText: 'South pole' }).click(); await cameraAt(s, -90);
    const south = await sceneData(s);
    await button(s, 'View north pole').click(); await cameraAt(s, 90);
    await button(s, 'View south pole').click(); await cameraAt(s, -90);
    const frame = Number((await sceneData(s)).renderFrame);
    await until(async () => Number((await sceneData(s)).renderFrame) > frame + 2, 'real WebGL frame advances');
    assert.equal((await sceneData(s)).sceneInstance, initial.sceneInstance, 'One live renderer across navigation');
    const cdp = await s.context.newCDPSession(s.page);
    const gpu = await cdp.send('SystemInfo.getInfo').catch(() => null); await cdp.detach();
    return { initial, north, south, landmarks: await labels.allTextContents(), gpu: gpu?.gpu?.devices ?? 'SystemInfo unavailable on page session; SwiftShader explicitly requested' };
  });
  await step(s, 'globe-dateline-east-west', async () => {
    await prepareGlobe(s); await button(s, 'View south pole').click(); await cameraAt(s, -90);
    const transitions = []; let crossed = false;
    for (let i = 0; i < 13; i++) {
      const before = Number((await sceneData(s)).viewLongitude);
      await button(s, 'Rotate view east').click(); const expected = ((before + 30 + 180) % 360 + 360) % 360 - 180;
      await cameraAt(s, -90, expected); const after = Number((await sceneData(s)).viewLongitude);
      transitions.push({ before, after }); crossed ||= before > 140 && after < -140;
    }
    assert.ok(crossed, 'East navigation crosses +180 into west longitude');
    for (let i = transitions.length - 1; i >= 0; i--) {
      await button(s, 'Rotate view west').click(); await cameraAt(s, -90, transitions[i].before);
    }
    return { transitions, final: await sceneData(s), readout: await s.app.getByLabel('Current globe orientation', { exact: true }).innerText() };
  });
  await step(s, 'split-canvas-ray-picking-auto-region', async () => {
    await prepareGlobe(s, true);
    // Start with the polar map, then click the north-facing Moon's actual mesh.
    await s.app.getByRole('combobox', { name: 'Map region', exact: true }).selectOption('polar');
    await button(s, 'View north pole').click(); await cameraAt(s, 90);
    const picked = [];
    for (const [pole, expected] of [['north', 'global'], ['south', 'polar']]) {
      await button(s, pole === 'north' ? 'View north pole' : 'View south pole').click(); await cameraAt(s, pole === 'north' ? 90 : -90);
      const canvas = s.app.locator('.scene-host canvas').first(), box = await canvas.boundingBox(); assert.ok(box);
      // Slightly off centre avoids the geographic pole label/pin; hit the rendered sphere.
      const x = box.x + box.width * .54, y = box.y + box.height * .52;
      const hitTarget = await s.app.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, { x, y });
      assert.equal(hitTarget, 'CANVAS', 'Pointer reaches WebGL canvas without bypassing overlays');
      await s.page.mouse.click(x, y);
      await until(async () => await s.app.getByRole('combobox', { name: 'Map region', exact: true }).inputValue() === expected, `${pole} canvas pick switches map to ${expected}`, 30000);
      const data = await sceneData(s);
      assert.ok(Number.isFinite(Number(data.surfacePickMs)), 'Actual production ray picking ran');
      const coordinate = await s.app.locator('.location-heading').innerText().catch(() => '');
      // Public coordinate inputs are independent evidence of the picked mission site.
      const showSites = button(s, 'Pick a site'); if (await showSites.isVisible()) await showSites.click();
      const latitude = await s.app.getByLabel('Custom latitude', { exact: true }).inputValue();
      const longitude = await s.app.getByLabel('Custom longitude', { exact: true }).inputValue();
      const match = latitude.match(/([\d.]+)\s*([NS])/i); assert.ok(match, `Picked custom latitude displayed: ${latitude}`);
      const lat = Number(match[1]) * (match[2].toUpperCase() === 'S' ? -1 : 1);
      assert.ok(pole === 'north' ? lat > 80 : lat < -80, `Picked physical latitude matches viewed pole: ${lat}`);
      const hide = button(s, 'Hide pick-a-site drawer'); if (await hide.isVisible()) await hide.click();
      picked.push({ pole, expected, latitude, longitude, coordinate, surfacePickMs: data.surfacePickMs });
    }
    return { picked };
  });
  await networkCheck(s);
}

async function networkCheck(s) {
  await step(s, 'network-and-browser-errors', async () => {
    assert.deepEqual(s.pageErrors, [], 'No unhandled browser errors');
    assert.deepEqual(s.httpErrors, [], 'No failed HTTP responses');
    assert.deepEqual(s.consoleErrors, [], 'No console errors');
    assert.deepEqual(s.failedRequests, [], 'No failed or external requests');
    if (s.mode === 'file') assert.deepEqual(s.requests, [], 'Disconnected offline ranking, ice and globe attempt zero HTTP');
    const dataRequests = s.requests.filter(r => r.path.includes('/data/'));
    const expected = s.publicBase.replace(/\/$/, '') + '/data/';
    for (const request of dataRequests) assert.ok(request.path.startsWith(expected), `Data path must be qualified under ${expected}: ${request.path}`);
    return { requests: s.requests, publicBase: s.publicBase, dataRequests, httpErrors: s.httpErrors, pageErrors: s.pageErrors };
  });
}

async function nativeZoom(mode) {
  const measurements = [];
  for (const factor of [1, 2]) {
    const profile = await mkdtemp(join(tmpdir(), 'lunario-map-native-zoom-')); let context, s;
    try {
      await mkdir(join(profile, 'Default'));
      await writeFile(join(profile, 'Default', 'Preferences'), JSON.stringify({ partition: { default_zoom_level: { x: Math.log(factor) / Math.log(1.2) } } }));
      context = await chromium.launchPersistentContext(profile, { executablePath: executable, headless: true, viewport: null, args: [...flags, '--window-size=1600,1080'] });
      s = await newSession(null, mode, `${mode}-native${factor * 100}`, context);
      await step(s, 'native-zoom-measurement-and-controls', async () => {
        await dismissIntroduction(s); await set2D(s, 'polar');
        const geometry = await s.page.evaluate(() => ({ dpr: devicePixelRatio, innerWidth, outerWidth, innerHeight, visualScale: visualViewport.scale, documentWidth: document.documentElement.scrollWidth }));
        const appGeometry = await s.app.evaluate(() => ({ innerWidth, innerHeight, documentWidth: document.documentElement.scrollWidth }));
        const png = await screenshotPNG(s); const measurement = { factor, ...geometry, appGeometry, screenshotWidth: png.readUInt32BE(16) }; measurements.push(measurement);
        assert.ok(geometry.documentWidth <= geometry.innerWidth + 1, 'No document horizontal overflow');
        assert.ok(appGeometry.documentWidth <= appGeometry.innerWidth + 1, 'No nested app document horizontal overflow');
        await rank(s); await openLayers(s);
        // Use ordinary pointer/keyboard actions, including clipped overflow detection.
        const select = controls(s).getByRole('combobox', { name: /^Map ranking factor/ }); await select.selectOption('sun');
        const bounds = await select.boundingBox(); assert.ok(bounds.width > 100 && bounds.x >= 0 && bounds.x + bounds.width <= geometry.innerWidth + 1, 'Ranking select fits native CSS viewport');
        const text = await select.evaluate(e => ({ font: parseFloat(getComputedStyle(e).fontSize), width: e.clientWidth, scrollWidth: e.scrollWidth }));
        assert.ok(text.font >= 12, 'Controls retain readable font size'); assert.ok(text.scrollWidth <= text.width + 2, 'No clipped horizontal select contents');
        await closeLayers(s);
        s.legendGeometry = await legend(s).evaluate(e => {
          const r = e.getBoundingClientRect(), control = e.querySelector('button'), b = control.getBoundingClientRect();
          const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
          return { legend: { x: r.x, y: r.y, width: r.width, height: r.height }, control: { x: b.x, y: b.y, width: b.width, height: b.height }, pointerTarget: hit?.getAttribute('aria-label') ?? hit?.textContent?.slice(0, 80) };
        });
        await button(s, 'Minimize legend').click(); await button(s, 'Expand legend').click();
        const legendBounds = await legend(s).boundingBox(); assert.ok(legendBounds.x >= 0 && legendBounds.x + legendBounds.width <= geometry.innerWidth + 1 && legendBounds.y >= 0 && legendBounds.y + legendBounds.height <= geometry.innerHeight + 1, 'Legend stays within viewport');
        const canvas = await mapCanvas(s).boundingBox(); assert.ok(canvas.width > 200 && canvas.height > 100 && canvas.x >= 0 && canvas.x + canvas.width <= geometry.innerWidth + 1, 'Map canvas stays within native viewport');
        await button(s, 'Dismiss map layers and legend').click();
        return { measurement, select: { bounds, ...text }, legendBounds, canvas, pixels: await assertCanvas(s) };
      });
      await networkCheck(s);
    } catch (error) {
      report.checks.push({ session: `${mode}-native${factor * 100}`, name: 'native-session', status: 'fail', error: cleanError(error) }); await save();
    } finally { await context?.close(); await rm(profile, { recursive: true, force: true }); }
  }
  const [normal, enlarged] = measurements;
  const evidence = { session: `${mode}-native`, name: 'genuine-200-percent-layout-zoom', evidence: measurements };
  try {
    assert.equal(measurements.length, 2);
    const near = (a, b) => Math.abs(a - b) < .04 * Math.max(1, Math.abs(b));
    assert.ok(near(enlarged.dpr / normal.dpr, 2) && near(normal.innerWidth / enlarged.innerWidth, 2) && near(normal.outerWidth, enlarged.outerWidth) && near(normal.screenshotWidth, enlarged.screenshotWidth) && near(enlarged.visualScale, 1), 'DPR doubles, layout width halves, physical width remains fixed, visual scale remains 1');
    evidence.status = 'pass';
  } catch (error) { evidence.status = 'fail'; evidence.error = cleanError(error); }
  report.checks.push(evidence); await save();
}

let browser;
try {
  browser = await chromium.launch({ executablePath: executable, headless: true, args: flags });
  const cdp = await browser.newBrowserCDPSession();
  const gpu = await cdp.send('SystemInfo.getInfo'); report.gpu = { devices: gpu.gpu.devices, featureStatus: gpu.gpu.featureStatus }; await cdp.detach();
  for (const mode of modes) {
    let s;
    try { s = await newSession(browser, mode, `${mode}-cold`); await mainChecks(s); }
    catch (error) { report.checks.push({ session: `${mode}-cold`, name: 'session-bootstrap', status: 'fail', error: cleanError(error) }); await save(); }
    finally { await s?.context.close(); }
  }
  await browser.close(); browser = null;
  for (const mode of modes) await nativeZoom(mode);
} catch (error) { report.checks.push({ name: 'verifier-runtime', status: 'fail', error: cleanError(error) }); }
finally {
  await browser?.close();
  report.finishedUtc = new Date().toISOString();
  report.status = report.checks.length > 0 && report.checks.every(c => c.status === 'pass') ? 'pass' : 'fail';
  await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(`${report.status.toUpperCase()}: ${report.checks.filter(c => c.status === 'pass').length} passed, ${report.checks.filter(c => c.status === 'fail').length} failed. ${join(out, 'report.json')}`);
process.exitCode = report.status === 'pass' ? 0 : 1;
