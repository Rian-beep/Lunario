#!/usr/bin/env node
/** Independent UI verifier. Never imports an engine, changes physics in the DOM,
 * starts a server, rebuilds an artifact, or attaches to a shared browser. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile, mkdir, stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import os from 'node:os';
import {execFileSync} from 'node:child_process';

const options = {
  artifact: '/tmp/solarreach-landing-final.html', marker: '/tmp/solarreach-landing-preview-ready',
  url: 'http://127.0.0.1:43317', output: '/tmp/solarreach-guided-landing-evidence',
  executable: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/usr/bin/google-chrome',
  playwrightModule: process.env.PLAYWRIGHT_CORE_MODULE || 'playwright-core',
  waitSeconds: 7200,
};
for (let i = 2; i < process.argv.length; i++) {
  const key = process.argv[i].replace(/^--/, '');
  if (!Object.hasOwn(options, key) || !process.argv[i + 1]) throw Error(`Unknown/missing option ${process.argv[i]}`);
  options[key] = key === 'waitSeconds' ? Number(process.argv[++i]) : process.argv[++i];
}
assert.ok(Number.isFinite(options.waitSeconds) && options.waitSeconds >= 0);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const requestUrl = url => url.startsWith('data:') ? `${url.slice(0, url.indexOf(',') + 1)}[length=${url.length};sha256=${sha(url)}]` : url;
const assetRequest = request => /\.(?:glb|gltf|wasm|png|jpe?g|webp)(?:[?#]|$)/i.test(request.url)
  || request.url.startsWith('blob:') || ['image', 'media', 'font', 'script', 'stylesheet'].includes(request.type)
  || /^data:(?:model\/|image\/|application\/(?:wasm|javascript))/.test(request.url);
const output = resolve(options.output);
await mkdir(output, {recursive: true});
const report = {
  startedUtc: new Date().toISOString(), options, checks: [], sessions: [],
  hardware: {hostname: os.hostname(), platform: os.platform(), release: os.release(),
    arch: os.arch(), cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length,
    totalMemoryBytes: os.totalmem()},
  script: {path: fileURLToPath(import.meta.url), sha256: sha(await readFile(fileURLToPath(import.meta.url)))},
  scope: [
    'Black-box interactions via real pointer/keyboard; no force clicks or DOM physics mutation.',
    'Own headless Chrome contexts, normal pointer, deviceScaleFactor 1, no emulated browser zoom.',
    'No application numerical helper is imported or reimplemented.',
    'Frame timing measures this machine/session, not a universal performance guarantee.',
    'HTTP identity is streamed before navigation; browser contexts are fresh, but origin/OS/disk caches are not flushed.',
    'Screen-reader, native 200% browser zoom and terrain/vehicle qualification require separate evidence.',
  ],
};
const findingsFile = '/tmp/landing-verifier-findings.txt';
async function save() {
  report.updatedUtc = new Date().toISOString();
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  const problems = report.checks.filter(c => c.status !== 'pass');
  await writeFile(findingsFile, `${report.updatedUtc} independent landing verifier\nArtifact: ${JSON.stringify(report.artifact ?? null)}\nEvidence: ${output}/report.json\n${problems.map(c => `${c.status.toUpperCase()} ${c.name}: ${c.error || JSON.stringify(c.detail)}`).join('\n')}\n${report.finishedUtc ? `Finished; overall ${report.overall}` : 'Work in progress; final gates not complete.'}\nManual/visual findings and scope: ${resolve('docs/qa/planning/guided-landing-review.md')}\n`);
}
class Incomplete extends Error {}
async function check(name, fn, page) {
  const start = performance.now();
  try {
    const detail = await fn();
    report.checks.push({name, status: 'pass', elapsedMs: performance.now() - start,
      detail: detail instanceof Uint8Array ? {bytes: detail.byteLength, sha256: sha(detail)} : detail});
    console.log(`PASS ${name}`);
    return detail;
  } catch (error) {
    const status = error instanceof Incomplete ? 'incomplete' : 'fail';
    report.checks.push({name, status, elapsedMs: performance.now() - start, error: error.stack});
    console.log(`${status.toUpperCase()} ${name}: ${error.message}`);
    if (page && !page.isClosed()) {
      const stem = name.replace(/[^a-z0-9-]/gi, '_');
      await page.screenshot({path: resolve(output, `${stem}.png`)}).catch(() => {});
      await writeFile(resolve(output, `${stem}.txt`), await page.locator('body').innerText().catch(() => 'Page unavailable'));
    }
    return null;
  } finally { await save(); }
}
async function awaitMarker() {
  const deadline = Date.now() + options.waitSeconds * 1000;
  for (;;) {
    try {
      const marker = await readFile(options.marker, 'utf8');
      const bytes = await readFile(options.artifact);
      const info = await stat(options.artifact);
      let manifest;
      try { manifest = JSON.parse(marker); } catch { manifest = {raw: marker}; }
      report.marker = {path: options.marker, text: marker, sha256: sha(marker)};
      report.artifact = {path: resolve(options.artifact), bytes: bytes.length, sha256: sha(bytes), modifiedUtc: info.mtime.toISOString()};
      if (manifest.artifactSha256) assert.equal(report.artifact.sha256, manifest.artifactSha256);
      report.sourceIdentity = manifest;
      return bytes;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      if (Date.now() >= deadline) throw new Incomplete('Final ready marker/artifact absent; no old application was tested.');
      console.log(`WAIT ${new Date().toISOString()} for ${options.marker}`);
      await sleep(15000);
    }
  }
}
async function httpIdentity() {
  const start = performance.now();
  const response = await fetch(options.url, {signal: AbortSignal.timeout(120000), cache: 'no-store'});
  assert.ok(response.ok, `HTTP document status ${response.status}`);
  const hash = createHash('sha256'); let bytes = 0;
  for await (const chunk of response.body) { bytes += chunk.length; hash.update(chunk); }
  const sha256 = hash.digest('hex');
  assert.equal(sha256, report.artifact.sha256, 'HTTP must serve the exact same immutable offline HTML');
  assert.equal(bytes, report.artifact.bytes);
  return {sha256, bytes, status: response.status, elapsedMs: performance.now() - start, checkedUtc: new Date().toISOString()};
}
const button = (page, name) => page.getByRole('button', {name, exact: true});
const host = page => page.locator('.scene-host');
const slider = page => page.getByRole('slider', {name: 'Flight time in seconds', exact: true});
const sliderMaximum = page => slider(page).evaluate(n => Number(n.getAttribute('aria-valuemax') ?? n.getAttribute('max')));
const field = (page, name) => page.locator('label.number-field').filter({hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)}).locator('input');
const settle = page => page.waitForTimeout(350);
async function ensureInspector(page) {
  const show = button(page, 'Show inspector'); if (await show.isVisible()) await show.click();
}
async function dismiss(page) {
  const intro = page.locator('dialog[aria-labelledby="audience-guide-title"]');
  if (await intro.isVisible()) { await page.keyboard.press('Escape'); await intro.waitFor({state: 'hidden'}); }
}
async function edit(page, name, value) {
  await ensureInspector(page);
  const input = field(page, name);
  await input.fill(String(value)); await input.blur(); await settle(page);
  assert.equal(Number(await input.inputValue()), Number(value));
}
async function disclosure(page, text, open = true) {
  const summary = page.locator('summary').filter({hasText: text});
  assert.equal(await summary.count(), 1, `Unique disclosure ${text}`);
  if (await summary.evaluate(n => n.parentElement.open) !== open) await summary.click();
}
async function cameraControl(page, name) {
  await disclosure(page, /^Camera & lighting$/);
  await page.getByRole('group', {name: '3D camera', exact: true}).getByRole('button', {name, exact: true}).click();
  await page.keyboard.press('Escape');
}
async function scene(page) {
  return host(page).evaluate(n => ({dataset: {...n.dataset}, canvas: !!n.querySelector('canvas'), text: n.innerText}));
}
async function screenshot(page, name) { await page.screenshot({path: resolve(output, `${name}.png`)}); }
async function seek(page, time) {
  const s = slider(page); await s.focus(); await s.press('Home');
  if (time === 'end') await s.press('End');
  else for (let i = 0; i < Math.round(time); i++) await s.press('ArrowRight');
  await settle(page);
  const selected = Number(await s.getAttribute('aria-valuenow'));
  await page.waitForFunction(value => Math.abs(Number(document.querySelector('.scene-host')?.dataset.flightTimeS) - value) < 1e-6, selected);
  return selected;
}
function vector(text) { return typeof text === 'string' ? text.split(',').map(Number) : null; }
function distance(a, b) { assert.ok(a?.length === 3 && b?.length === 3 && [...a, ...b].every(Number.isFinite), 'Expected finite 3D position'); return Math.hypot(...a.map((v, i) => v - b[i])); }
function embeddedAssets(bytes) {
  const html = bytes.toString('utf8');
  const get = name => {
    const match = html.match(new RegExp(`window\\.__SOLARREACH_${name}__=(.*?);(?:window\\.|</script>)`));
    assert.ok(match, `Embedded ${name} assets missing`);
    return JSON.parse(match[1]);
  };
  const equipment = get('EQUIPMENT'), celestial = get('CELESTIAL_MODELS');
  const pinned = [
    ['/data/equipment/apollo-lunar-module.glb', '379101dfcee399267addf771709107c35e826b0b9e5233272f123e4c8a585c4e', equipment],
    ['/data/celestial-models/assets/earth.glb', '05a5aea99db8ab472487a06debc3b5d0b2cae7636a1a6b9ecfa40b7d1722ba23', celestial],
    ['/data/celestial-models/assets/sun.glb', 'a178f5c43c2c9a6ee6c011c315149a7ab5a2594fd5aa9119ee219625a18da1dd', celestial],
  ];
  return pinned.map(([path, expected, assets]) => {
    assert.ok(assets[path]?.startsWith('data:model/gltf-binary;base64,'));
    const glb = Buffer.from(assets[path].split(',')[1], 'base64');
    assert.equal(sha(glb), expected, `Original NASA GLB changed: ${path}`);
    assert.equal(glb.readUInt32LE(0), 0x46546c67); assert.equal(glb.readUInt32LE(4), 2);
    assert.equal(glb.readUInt32LE(8), glb.length); assert.equal(glb.readUInt32LE(16), 0x4e4f534a);
    const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8'));
    const primitives = json.meshes.reduce((n, m) => n + m.primitives.length, 0);
    if (path.includes('apollo')) assert.equal(primitives, 157, 'Expected actual 157 NASA mesh primitives');
    return {path, bytes: glb.length, sha256: sha(glb), primitives};
  });
}
async function timelineSample(page) {
  return page.evaluate(() => {
    const node = document.querySelector('.scene-host');
    const timeControl = document.querySelector('input[type="range"][aria-label="Flight time in seconds"], [role="slider"][aria-label="Flight time in seconds"]');
    return {utc: new Date().toISOString(), time: Number(timeControl?.getAttribute('aria-valuenow') ?? timeControl?.value),
      scene: {dataset: {...node.dataset}, canvas: !!node.querySelector('canvas'), text: node.innerText},
      hud: document.querySelector('[aria-label="Flight telemetry"]').innerText};
  });
}
async function contactSummary(page) {
  await ensureInspector(page);
  const constraint = page.locator('.constraint').filter({hasText: /(?:Within entered contact limits|Outside entered contact limits|Contact unresolved)/});
  assert.equal(await constraint.count(), 1, 'Contact result must have readable text');
  return {text: await constraint.innerText(), color: await constraint.evaluate(n => getComputedStyle(n).color)};
}
async function readyScene(page) {
  await page.waitForFunction(() => {
    const n = document.querySelector('.scene-host');
    return n?.querySelector('canvas') && n.dataset.moonModel === 'ready' && n.dataset.earthModel === 'ready'
      && n.dataset.sunModel === 'ready' && n.dataset.surfaceStatus !== 'preparing'
      && document.body.textContent.includes('Equipment status: ready');
  }, null, {timeout: 180000});
}
async function frameIntervals(page, ms = 2000) {
  return page.evaluate(duration => new Promise(resolve => {
    const intervals = []; let previous, start, renderedBefore;
    function frame(now) {
      if (start === undefined) {
        start = now;
        renderedBefore = Number(document.querySelector('.scene-host')?.dataset.renderFrame);
      }
      if (previous !== undefined) intervals.push(now - previous);
      previous = now;
      if (now - start < duration) requestAnimationFrame(frame);
      else { const sorted = [...intervals].sort((a, b) => a - b);
        const renderedAfter = Number(document.querySelector('.scene-host')?.dataset.renderFrame);
        resolve({durationMs: now - start, frames: intervals.length,
        fps: intervals.length * 1000 / (now - start), intervalsMs: intervals,
        renderedFrames: Number.isFinite(renderedBefore) && Number.isFinite(renderedAfter) ? renderedAfter - renderedBefore : null,
        renderedFps: Number.isFinite(renderedBefore) && Number.isFinite(renderedAfter) ? (renderedAfter - renderedBefore) * 1000 / (now - start) : null,
        medianMs: sorted[Math.floor(sorted.length / 2)], p95Ms: sorted[Math.floor(sorted.length * .95)], maxMs: Math.max(...intervals)}); }
    }
    requestAnimationFrame(frame);
  }), ms);
}
async function playThrough(page, label) {
  const expand = button(page, 'Expand flight telemetry'); if (await expand.isVisible()) await expand.click();
  const hideInspector = button(page, 'Hide inspector'), restoreInspector = await hideInspector.isVisible();
  if (restoreInspector) await hideInspector.click();
  try {
  await seek(page, 0); await cameraControl(page, 'Follow');
  await page.waitForFunction(() => {
    const d = document.querySelector('.scene-host')?.dataset;
    return d?.cameraMode === 'follow' && d.assetFlight === 'idle';
  }, null, {timeout: 90000});
  await page.getByLabel('Flight playback speed', {exact: true}).selectOption('10');
  const samples = [], deadline = Date.now() + 120000;
  await button(page, 'Play flight').click();
  const frameTiming = frameIntervals(page).catch(error => ({error: error.message}));
  while (Date.now() < deadline) {
    samples.push(await timelineSample(page));
    if (await button(page, 'Play flight').isVisible()) break;
    await page.waitForTimeout(200);
  }
  assert.ok(await button(page, 'Play flight').isVisible(), 'Preview must reach its end');
  await page.waitForFunction(() => {
    const control = document.querySelector('input[type="range"][aria-label="Flight time in seconds"]');
    return Math.abs(Number(document.querySelector('.scene-host')?.dataset.flightTimeS) - Number(control?.getAttribute('aria-valuenow'))) < 1e-6;
  });
  samples.push(await timelineSample(page));
  const max = await sliderMaximum(page);
  assert.ok(samples.at(-1).time >= max - .05, `Clock stopped at ${samples.at(-1).time}, expected ${max}`);
  assert.ok(samples.every(s => ['follow', 'vehicle'].includes(s.scene.dataset.cameraMode)), 'Follow must stay with selected flight through contact');
  await writeFile(resolve(output, `${label}-samples.json`), JSON.stringify(samples, null, 2));
  await screenshot(page, `${label}-end`);
  return {max, samples, frameTiming: await frameTiming};
  } finally {
    if (restoreInspector && !page.isClosed() && await button(page, 'Show inspector').isVisible()) await button(page, 'Show inspector').click();
  }
}
async function exactEvidence(page, samples) {
  // Only consume production-owned readouts. Missing data is explicitly incomplete.
  const datasets = samples.map(s => s.scene.dataset);
  const required = ['vehicleWorldPosition', 'landingContact', 'landingDynamics', 'vehicleVisible', 'landingFragmentCount', 'landingMassKg', 'terrainClearanceM'];
  const missing = required.filter(key => !datasets.some(d => d[key] !== undefined));
  if (missing.length) throw new Incomplete(`Production read-only datasets missing: ${missing.join(', ')}. Cannot prove COM tracking, HUD velocity, mass or terrain clearance from rounded text/screenshots.`);
  const contact = datasets.map(d => d.landingContact && JSON.parse(d.landingContact)).find(Boolean);
  assert.ok(contact, 'Need exact production contact state');
  for (const key of ['timeS', 'eastM', 'northM', 'yM', 'massKg', 'terrainHeightM', 'targetErrorM']) assert.ok(Number.isFinite(contact[key]), `Exact contact ${key}`);
  assert.ok(contact.velocityMps?.length === 3 && contact.velocityMps.every(Number.isFinite), 'Exact signed incoming velocity');
  assert.equal(contact.terrainKnown, true, 'Known numerical terrain required');
  const rows = [];
  for (const sample of samples) {
    const d = sample.scene.dataset;
    const point = vector(d.vehicleWorldPosition), target = vector(d.cameraTarget), camera = vector(d.cameraPosition);
    assert.ok(distance(point, target) < .0001, 'Follow target must track rendered vehicle COM within 0.1 m');
    assert.equal(d.vehicleVisible, 'true', 'Physical lander/fragments must remain visible');
    const clearance = d.terrainClearanceM?.trim();
    if (!clearance && sample.time >= contact.timeS) throw new Incomplete('Post-contact terrain clearance unavailable, including beyond the finite contact patch; blank is not zero');
    if (clearance) assert.ok(Number.isFinite(Number(clearance)) && Number(clearance) >= -.05, 'Collider geometry must not penetrate numerical terrain by >5 cm');
    rows.push({time: sample.time, sceneTime: Number(d.flightTimeS), physicalFrameTime: Number(d.landingContactFrameTimeS),
      domMinusSceneS: sample.time - Number(d.flightTimeS), clearanceM: clearance ? Number(clearance) : null,
      offsetKm: camera.map((v, i) => v - point[i]), massKg: Number(d.landingMassKg), fragmentCount: Number(d.landingFragmentCount)});
    if (d.landingDynamics) {
      const dynamics = JSON.parse(d.landingDynamics);
      if (dynamics && dynamics.phase !== 'unsupported') {
        assert.ok(Math.abs(dynamics.elapsedContactS - (Number(d.landingContactFrameTimeS) - contact.timeS)) < 1e-6, 'Readout must match its declared physical frame');
        assert.ok(Math.abs(Number(d.flightTimeS) - Number(d.landingContactFrameTimeS)) <= 1 / 120 + 1e-6, 'Scene must use the current 120Hz cache sample');
        assert.ok(Math.abs(Number(d.landingMassKg) - contact.massKg) < Math.max(1e-6, contact.massKg * 1e-12), 'Post-contact body mass must equal exact incoming mass');
      }
    }
  }
  const origin = rows.find(r => r.time > 1)?.offsetKm;
  assert.ok(origin, 'Need moving samples');
  assert.ok(rows.filter(r => r.time > 1).every(r => distance(r.offsetKm, origin) < .0001), 'Follow relative offset/angle must stay fixed within 0.1 m');
  const masses = rows.map(r => r.massKg).filter(Number.isFinite);
  assert.ok(masses.length === rows.length && masses.every(m => m > 0), 'Real assumed mass must be exposed');
  const postContact = datasets.map(d => d.landingDynamics && JSON.parse(d.landingDynamics)).filter(Boolean);
  assert.ok(postContact.length > 1, 'Need several live post-contact frames');
  const broken = rows.filter(r => r.fragmentCount > 0);
  if (broken.length) {
    assert.ok(broken.every(r => r.fragmentCount === 157), 'Expected actual 157 NASA mesh parts');
    assert.ok(broken.every(r => Math.abs(r.massKg - broken[0].massKg) < 1e-6), 'Breakup must conserve assumed mass');
  }
  await writeFile(resolve(output, 'physical-observation-latest.json'), JSON.stringify({contact, rows}, null, 2));
  if (postContact.some(value => value.phase === 'unsupported')) throw new Incomplete('Contact continuation reaches a disclosed numerical bound before requested end; full interval cannot be certified by this replay');
  return {contact, rows, final: await scene(page)};
}
async function pausedHudEvidence(page, contact) {
  const results = [];
  for (const elapsed of [1, 3, 5, 10]) {
    const selected = await seek(page, contact.timeS + elapsed);
    await page.waitForFunction(time => Math.abs(Number(document.querySelector('.scene-host')?.dataset.flightTimeS) - time) < 1e-6, selected);
    await page.waitForTimeout(300);
    const sample = await timelineSample(page), d = sample.scene.dataset, dynamics = d.landingDynamics && JSON.parse(d.landingDynamics);
    assert.ok(dynamics, 'Physical paused readout available');
    if (dynamics.phase === 'unsupported') throw new Incomplete(`Paused ${selected}s reaches bounded replay stop: ${dynamics.note}`);
    const match = sample.hud.match(/Speed[\s\S]*?([\d,.]+)\s*m\/s/i);
    assert.ok(match, 'Expanded HUD speed must be visible at settled paused time');
    assert.ok(Math.abs(Number(match[1].replaceAll(',', '')) - dynamics.speedMps) <= .15, 'Paused HUD speed agrees with actual physical velocity');
    results.push(sample);
  }
  return results;
}

let browser;
try {
  const artifact = await check('final-ready-marker-and-artifact', awaitMarker);
  if (!artifact) throw new Incomplete('No final immutable artifact; browser runs skipped.');
  await check('artifact-size-and-source-identity', async () => {
    assert.ok(artifact.length > 70_000_000, 'Expected full approximately 80 MB offline artifact');
    if (!report.sourceIdentity.sourceCommit && !report.sourceIdentity.sourceHashes) throw new Incomplete('Ready marker needs integrated sourceCommit/sourceHashes, not verifier baseline source identity.');
    return report.artifact;
  });
  await check('embedded-original-nasa-glbs-and-157-primitives', async () => embeddedAssets(artifact));
  const flags = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'];
  report.launchFlags = flags;
  report.chromeExecutableVersion = execFileSync(options.executable, ['--version'], {encoding: 'utf8'}).trim();
  const moduleId = options.playwrightModule.startsWith('/') ? pathToFileURL(options.playwrightModule).href : options.playwrightModule;
  const {chromium} = await import(moduleId);
  report.playwrightModule = moduleId;
  const moduleUrl = import.meta.resolve(moduleId);
  const packageBytes = await readFile(new URL('./package.json', moduleUrl));
  report.playwrightVersion = JSON.parse(packageBytes).version;
  report.playwrightPackageSha256 = sha(packageBytes);
  browser = await chromium.launch({headless: true, executablePath: options.executable, args: flags});
  report.browserVersion = browser.version();
  for (const mode of ['http', 'file']) for (const width of [1280, 1728, 800]) {
    const id = `${mode}-${width}`, requests = [], failures = [], errors = [], consoleErrors = [], responses = [];
    const context = await browser.newContext({viewport: {width, height: 1000}, deviceScaleFactor: 1, hasTouch: false, reducedMotion: 'no-preference', acceptDownloads: true});
    // Chrome's offline flag blocks HTTP while retaining native blob-load events.
    // Broad route interception suppresses those observations for file documents.
    if (mode === 'file') await context.setOffline(true);
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on('request', r => requests.push({url: requestUrl(r.url()), type: r.resourceType()}));
    page.on('requestfailed', r => failures.push({url: requestUrl(r.url()), error: r.failure()?.errorText}));
    page.on('response', r => { if (r.status() >= 400) responses.push({url: requestUrl(r.url()), status: r.status()}); });
    page.on('pageerror', e => errors.push(e.stack));
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push({text: m.text(), location: m.location()}); });
    const session = {id, mode, viewport: {width, height: 1000}, requests, failures, errors, consoleErrors, responses}; report.sessions.push(session);
    try {
      const opened = await check(`${id}-identical-document-and-ready`, async () => {
        if (mode === 'http') session.httpIdentity = await httpIdentity();
        const start = performance.now();
        const response = await page.goto(mode === 'http' ? options.url : pathToFileURL(resolve(options.artifact)).href, {waitUntil: 'domcontentloaded', timeout: 180000});
        if (mode === 'http') { assert.ok(response?.ok()); assert.equal(Number(response.headers()['content-length']), report.artifact.bytes); session.documentSha256 = session.httpIdentity.sha256; }
        await page.getByRole('group', {name: 'Audience mode', exact: true}).waitFor({timeout: 120000});
        session.initialReadyMs = performance.now() - start;
        await dismiss(page); await button(page, 'Planner').click(); await dismiss(page);
        return {initialReadyMs: session.initialReadyMs, pointerFine: await page.evaluate(() => matchMedia('(pointer:fine)').matches), devicePixelRatio: await page.evaluate(() => devicePixelRatio)};
      }, page);
      if (!opened) continue;
      await check(`${id}-normal-pointer-map-selector`, async () => {
        await button(page, '2D map').click();
        const select = page.getByLabel('Map region', {exact: true});
        await select.click(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
        assert.equal(await select.inputValue(), 'global');
        await select.click(); await page.keyboard.press('Home'); await page.keyboard.press('Enter');
        assert.equal(await select.inputValue(), 'polar');
        return {pointer: 'normal fine pointer; no force', selector: await select.boundingBox()};
      }, page);
      await check(`${id}-learn-native-math-and-dismiss`, async () => {
        await button(page, 'Learn').click();
        const dialog = page.getByRole('dialog'); await dialog.waitFor();
        assert.ok(await dialog.locator('math').count() > 0, 'Learn must contain semantic native MathML');
        const box = await dialog.boundingBox(); assert.ok(box.width >= Math.min(700, width - 48), 'Learn needs roomy readable width');
        await screenshot(page, `${id}-learn`); await page.keyboard.press('Escape'); await dialog.waitFor({state: 'hidden'});
        return {box, nativeMath: true};
      }, page);
      const first = await check(`${id}-first-lander-configures-approach`, async () => {
        const start = performance.now(); await button(page, 'Lander').click(); await readyScene(page);
        await screenshot(page, `${id}-first-lander`); await ensureInspector(page);
        await button(page, 'Reset 300 m approach').waitFor();
        assert.equal(Number(await field(page, 'Start altitude').inputValue()), 300);
        assert.equal(Number(await field(page, 'Start east offset').inputValue()), -300);
        assert.equal(Number(await field(page, 'Vertical speed').inputValue()), -8);
        session.sceneReadyMs = performance.now() - start;
        const canvas = await host(page).locator('canvas').elementHandle();
        session.renderer = await canvas.evaluate(n => { const gl = n.getContext('webgl2') || n.getContext('webgl'); const ext = gl?.getExtension('WEBGL_debug_renderer_info'); return {vendor: ext && gl.getParameter(ext.UNMASKED_VENDOR_WEBGL), renderer: ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL), version: gl?.getParameter(gl.VERSION)}; });
        return {sceneReadyMs: session.sceneReadyMs, snapshot: await scene(page)};
      }, page);
      if (!first) continue;
      const canvas = await host(page).locator('canvas').elementHandle();
      const instance = (await scene(page)).dataset.sceneInstance;
      await check(`${id}-header-camera-portal`, async () => {
        await disclosure(page, /^Camera & lighting$/);
        const group = page.getByRole('group', {name: '3D camera', exact: true});
        assert.ok(await group.evaluate(n => !!n.closest('header') && !n.closest('.scene-wrap')), 'Camera controls must be in header portal');
        await screenshot(page, `${id}-header-camera`); await page.keyboard.press('Escape');
        return {inHeader: true};
      }, page);
      await check(`${id}-edits-and-rapid-focus-preserve-scene`, async () => {
        await page.waitForTimeout(1500); const assetsBefore = requests.filter(assetRequest).length;
        if (!assetsBefore) throw new Incomplete('No observable baseline asset requests; cannot establish no refetch from a zero counter');
        const physicalBefore = (await scene(page)).dataset;
        const oldMass = Number(await field(page, 'Wet mass').inputValue());
        const beforeRevision = Number((await scene(page)).dataset.flightRevision), start = performance.now();
        const massInput = field(page, 'Wet mass');
        await massInput.fill(String(oldMass + 100)); await massInput.blur();
        await page.waitForFunction(revision => Number(document.querySelector('.scene-host')?.dataset.flightRevision) > revision, beforeRevision);
        session.inputEditToSceneMs = performance.now() - start;
        for (const mode of ['Flight', 'Follow']) {
          await cameraControl(page, mode);
          await page.waitForFunction(expected => document.querySelector('.scene-host')?.dataset.cameraMode === expected, mode.toLowerCase());
          await button(page, 'Lander').click();
          await page.waitForFunction(() => document.querySelector('.scene-host')?.dataset.cameraMode === 'vehicle');
        }
        for (const name of ['Moon', 'Earth', 'Lander', 'Moon', 'Earth', 'Lander', 'Lander']) await button(page, name).click();
        await page.waitForFunction(() => {
          const d = document.querySelector('.scene-host')?.dataset;
          return d?.cameraMode === 'vehicle' && d.assetFlight === 'idle';
        }, null, {timeout: 90000});
        const focused = (await scene(page)).dataset;
        const cameraTargetErrorM = 1000 * distance(vector(focused.cameraTarget), vector(focused.vehicleWorldPosition));
        assert.ok(cameraTargetErrorM < .1, 'Repeated Lander actually arrives at the current vehicle, including from Flight/Follow');
        await ensureInspector(page);
        assert.equal(Number(await field(page, 'Wet mass').inputValue()), oldMass + 100);
        assert.equal((await scene(page)).dataset.sceneInstance, instance);
        assert.ok(await host(page).evaluate((n, original) => n.querySelector('canvas') === original, canvas), 'Actual canvas identity must remain');
        const assetsAfter = requests.filter(assetRequest).length;
        assert.equal(assetsAfter, assetsBefore, 'Input edits and focus must not refetch assets');
        const physicalAfter = (await scene(page)).dataset;
        assert.equal(Number(physicalAfter.vehicleScale), 1, 'Camera never rescales nominal 7 m vehicle');
        for (const key of ['sunRangeKm', 'earthRangeKm']) {
          assert.ok(Number(physicalBefore[key]) > 0, `Physical ${key} supplied`);
          assert.equal(physicalAfter[key], physicalBefore[key], `${key} unchanged by input/focus edits`);
        }
        await edit(page, 'Wet mass', oldMass);
        return {inputEditToSceneMs: session.inputEditToSceneMs, instance, assetsBefore, assetsAfter,
          canvasIdentity: true, repeatedFrom: ['Flight', 'Follow'], cameraTargetErrorM};
      }, page);
      await check(`${id}-all-three-named-dsn-and-weather-context`, async () => {
        await button(page, 'Earth').click();
        const results = [];
        for (const name of ['Goldstone', 'Madrid', 'Canberra']) {
          await button(page, name).click(); await disclosure(page, /^Ground complex details$/);
          const details = page.locator('.header-station-details');
          const text = await details.innerText(); assert.match(text, new RegExp(name)); assert.match(text, /Mission epoch|Selected mission|mission-time|Mission-time/i);
          if (mode === 'file') { assert.match(text, /Offline: fetching is disabled/); const fetch = details.getByRole('button', {name: /Fetch.*dated|Refresh.*dated/i}); if (await fetch.count()) assert.ok(await fetch.isDisabled()); }
          results.push({name, text}); await page.keyboard.press('Escape');
        }
        await button(page, 'Lander').click(); return results;
      }, page);
      // Full physics/contact proof runs at 1280 in both delivery forms; responsive
      // contexts above still perform real edits/focus/header controls at all widths.
      if (width === 1280) {
        await check(`${id}-nominal-text-limits-and-preview-clock`, async () => {
          await ensureInspector(page);
          await button(page, 'Reset 300 m approach').click(); await settle(page);
          const summary = await contactSummary(page); assert.match(summary.text, /Within entered contact limits/);
          assert.match(summary.text, /m\/s/); assert.match(summary.text, /kg/); assert.match(summary.text, /not|limit|reference/);
          const contact = Number(summary.text.match(/Contact at ([\d,.]+) s/)?.[1]?.replaceAll(',', ''));
          assert.ok(Number.isFinite(contact));
          const max = await sliderMaximum(page);
          assert.ok(max >= contact + 11.9, `Clock ${max} must include 12 s contact continuation after ${contact}`);
          session.nominal = summary; return {summary, contact, previewEndS: max};
        }, page);
        const nominal = await check(`${id}-nominal-full-follow-playback`, async () => {
          const result = await playThrough(page, `${id}-nominal`);
          const altitudes = result.samples.map(s => s.hud.match(/Radial altitude[\s\S]*?(-?[\d,.]+)\s*km/))
            .filter(Boolean).map(m => Number(m[1].replaceAll(',', '')) * 1000);
          assert.ok(altitudes.length > 5, 'Observe descending nominal approach');
          assert.ok(altitudes.every((v, i) => !i || v <= altitudes[i - 1]), 'No outward hump in displayed nominal radial altitude');
          return {...result, displayedAltitudeM: altitudes, altitudeDisplayResolutionM: 10};
        }, page);
        if (nominal) await check(`${id}-exact-com-follow-velocity-mass-clearance`, () => exactEvidence(page, nominal.samples), page);
        if (nominal) await check(`${id}-paused-hud-matches-physical-velocity`, async () => pausedHudEvidence(page, JSON.parse(nominal.samples.at(-1).scene.dataset.landingContact)), page);
        await check(`${id}-pause-backward-scrub-and-reset`, async () => {
          const end = await seek(page, 'end'); const a = await timelineSample(page);
          await page.waitForTimeout(700); const b = await timelineSample(page);
          assert.equal(a.time, b.time);
          assert.ok(distance(vector(a.scene.dataset.cameraPosition), vector(b.scene.dataset.cameraPosition)) <= 1e-9, 'Paused camera stays fixed within 1 micrometre');
          await seek(page, 0); await seek(page, 'end'); const c = await timelineSample(page);
          for (const key of ['cameraPosition', 'cameraTarget']) assert.ok(distance(vector(c.scene.dataset[key]), vector(a.scene.dataset[key])) <= 1e-9, `Deterministic backward replay ${key} within 1 micrometre`);
          for (const key of ['landingDynamics', 'vehicleWorldPosition']) {
            if (!a.scene.dataset[key] || !c.scene.dataset[key]) throw new Incomplete(`Exact replay dataset ${key} absent`);
            assert.equal(c.scene.dataset[key], a.scene.dataset[key], `Deterministic backward replay ${key}`);
          }
          await seek(page, 0); await button(page, 'Reset 300 m approach').click(); await settle(page);
          assert.equal(await slider(page).getAttribute('aria-valuenow'), '0');
          assert.equal((await scene(page)).dataset.sceneInstance, instance);
          await screenshot(page, `${id}-reset`); return {end, reset: await timelineSample(page)};
        }, page);
        const base = Object.fromEntries(await Promise.all(['Wet mass', 'Dry mass', 'Thrust', 'Burn duration'].map(async name => [name, await field(page, name).inputValue()])));
        await disclosure(page, /^Edit contact limits & continuation$/);
        const baselineBreakup = await field(page, 'Breakup energy threshold').inputValue();
        const baselineRadius = await field(page, 'Target radius').inputValue();
        for (const scenario of [
          {name: 'low-thrust-crash', edits: {'Thrust': 100, 'Breakup energy threshold': 0}},
          {name: 'fuel-exhaustion', edits: {'Wet mass': Number(base['Dry mass']) + 1}},
          {name: 'target-miss', edits: {'Target radius': 0}},
          {name: 'bounce-tumble', manual: true, edits: {'Thrust': 0, 'Burn duration': 0, 'Initial pitch': 45, 'Final burn pitch': 45, 'Breakup energy threshold': 1e12, 'Contact restitution': .8, 'Contact friction': .8}},
        ]) {
          let observed;
          await check(`${id}-${scenario.name}`, async () => {
            await seek(page, 0); await button(page, 'Reset 300 m approach').click();
            for (const [name, value] of Object.entries(base)) await edit(page, name, value);
            await disclosure(page, /^Edit contact limits & continuation$/);
            await edit(page, 'Breakup energy threshold', baselineBreakup); await edit(page, 'Target radius', baselineRadius);
            if (scenario.manual) await button(page, 'Manual pitch & burn').click();
            for (const [name, value] of Object.entries(scenario.edits)) await edit(page, name, value);
            const summary = await contactSummary(page);
            assert.match(summary.text, /Outside entered contact limits/);
            if (session.nominal) assert.notEqual(summary.color, session.nominal.color, 'Failure changes color as well as text');
            if (scenario.name === 'target-miss') assert.match(summary.text, /target|radius/i);
            if (scenario.name === 'fuel-exhaustion') assert.match(await page.getByLabel('Scenario inspector', {exact: true}).innerText(), /Propellant exhausted/);
            const playback = await playThrough(page, `${id}-${scenario.name}`);
            observed = playback;
            const final = playback.samples.at(-1).scene;
            if (scenario.name === 'low-thrust-crash') assert.ok(playback.samples.some(s => Number(s.scene.dataset.landingFragmentCount) === 157), 'Actual NASA pieces must appear during crash');
            await writeFile(resolve(output, `${id}-${scenario.name}-result.json`), JSON.stringify({summary, final}, null, 2));
            return {summary, end: final};
          }, page);
          if (observed && ['low-thrust-crash', 'bounce-tumble'].includes(scenario.name)) {
            await check(`${id}-${scenario.name}-physical-evidence`, async () => {
              const exact = await exactEvidence(page, observed.samples);
              const states = observed.samples.map(s => ({dataset: s.scene.dataset,
                dynamics: s.scene.dataset.landingDynamics && JSON.parse(s.scene.dataset.landingDynamics)}))
                .filter(s => s.dynamics && s.dynamics.phase !== 'unsupported');
              if (scenario.name === 'low-thrust-crash') assert.ok(states.some(s => s.dynamics.phase === 'broken' && s.dynamics.fragmentCount === 157), 'Observe actual 157-part breakup');
              else {
                assert.ok(states.some(s => s.dynamics.verticalMps > .1), 'Observe actual upward rebound velocity');
                if (states.some(s => !s.dataset.vehicleQuaternion)) throw new Incomplete('Production vehicleQuaternion (actual physical x,y,z,w) needed to prove post-contact tumbling');
                const rotations = states.map(s => vector(s.dataset.vehicleQuaternion));
                assert.ok(rotations.length > 1 && rotations.every(q => q.length === 4 && q.every(Number.isFinite) && Math.abs(Math.hypot(...q) - 1) < 1e-6), 'Need actual normalized post-contact pose samples');
                assert.ok(rotations.some(q => Math.abs(q.reduce((sum, n, i) => sum + n * rotations[0][i], 0)) < Math.cos(Math.PI / 12)), 'Observe at least 30 degrees of actual post-contact rotation');
              }
              return exact;
            }, page);
          }
        }
        await check(`${id}-launch-full-follow-and-pause`, async () => {
          await seek(page, 0);
          for (const [name, value] of Object.entries(base)) await edit(page, name, value);
          await button(page, 'Ascent').click();
          await edit(page, 'Start altitude', 1); await edit(page, 'Horizontal speed', 0);
          await edit(page, 'Vertical speed', 0); await edit(page, 'Preview duration', 60);
          const launch = await playThrough(page, `${id}-launch`);
          assert.ok(launch.samples.length > 5, 'Observe launch in motion');
          assert.ok(new Set(launch.samples.map(s => s.scene.dataset.cameraPosition)).size > 5, 'Follow moves through launch');
          await seek(page, 0); await button(page, 'Reset landing preset').click();
          return {samples: launch.samples.length, end: launch.samples.at(-1), frameTiming: launch.frameTiming};
        }, page);
        await check(`${id}-touchdown-lab-real-mesh-run-pause-reset`, async () => {
          await button(page, 'Lab').click(); const dialog = page.getByRole('dialog', {name: 'Touchdown experiment', exact: true});
          try {
          await dialog.waitFor(); const run = dialog.getByRole('button', {name: 'Run', exact: true});
          await run.waitFor(); await page.waitForFunction(() => document.querySelector('[data-phase="ready"]'), null, {timeout: 120000});
          await dialog.locator('summary').filter({hasText: 'Model & physics notes'}).click();
          assert.match(await dialog.innerText(), /157 NASA mesh primitives/); assert.match(await dialog.innerText(), /Nominal 7 m/i);
          await dialog.getByLabel('Breakup threshold (J)', {exact: true}).fill('0');
          await dialog.getByLabel('Descent speed (m/s)', {exact: true}).fill('8');
          await run.click();
          await page.waitForFunction(() => document.querySelector('[data-phase="broken"]'), null, {timeout: 120000});
          await dialog.getByRole('button', {name: 'Pause', exact: true}).click();
          const readout = dialog.locator('dl').filter({hasText: 'Fragments'});
          const paused = await readout.innerText(); assert.match(paused, /Fragments\s*157/i);
          await page.waitForTimeout(600); assert.equal(await readout.innerText(), paused);
          await screenshot(page, `${id}-lab-fragments`);
          await dialog.getByRole('button', {name: 'Reset', exact: true}).click();
          await page.waitForFunction(() => document.querySelector('[data-phase="ready"]'), null, {timeout: 120000});
          assert.match(await readout.innerText(), /Fragments\s*0/i);
          await screenshot(page, `${id}-lab-reset`); await page.keyboard.press('Escape'); await dialog.waitFor({state: 'hidden'});
          return {paused, resetRestoresIntact: true, nativeEscape: true};
          } finally {
            if (await dialog.isVisible()) await dialog.getByRole('button', {name: 'Close touchdown lab', exact: true}).click();
          }
        }, page);
        await check(`${id}-measured-frame-intervals`, async () => {
          session.frameTiming = await frameIntervals(page); return session.frameTiming;
        }, page);
        await check(`${id}-actual-rendered-fps-evidence`, async () => {
          if (session.frameTiming?.renderedFps == null) throw new Incomplete('Production renderFrame counter absent; rAF scheduling is measured but actual rendered FPS is unproven.');
          assert.ok(session.frameTiming.renderedFps > 0); return session.frameTiming;
        }, page);
      }
      await check(`${id}-custom-pin-through-normal-ui`, async () => {
        await button(page, '2D map').click();
        const showSites = button(page, 'Show site drawer'); if (await showSites.isVisible()) await showSites.click();
        await disclosure(page, /^Use custom coordinates/);
        await page.getByLabel('Custom latitude', {exact: true}).fill('-89.5');
        await page.getByLabel('Custom longitude', {exact: true}).fill('45');
        await button(page, 'Use coordinates').click(); await settle(page);
        await screenshot(page, `${id}-custom-pin-map`);
        // The production POI readout intentionally covers globe annotations.
        // Use a separate global custom point to assert that readout; the polar
        // map's cross remains captured above rather than misusing globe data.
        await page.getByLabel('Custom latitude', {exact: true}).fill('-45');
        await button(page, 'Use coordinates').click(); await settle(page);
        await button(page, '3D terrain').click(); await button(page, 'Moon').click(); await readyScene(page);
        await page.waitForFunction(() => {
          const raw = document.querySelector('.scene-host')?.dataset.visiblePois;
          return raw && JSON.parse(raw).some(p => p.id === 'user-custom-point');
        }, null, {timeout: 30000});
        const pin = JSON.parse((await scene(page)).dataset.visiblePois).find(p => p.id === 'user-custom-point');
        assert.equal(pin.lat, -45); assert.equal(pin.lon, 45);
        await screenshot(page, `${id}-custom-pin-3d`); return pin;
      }, page);
      await screenshot(page, `${id}-final`);
      await check(`${id}-error-and-offline-network-gates`, async () => {
        assert.deepEqual(errors, [], 'No uncaught JS errors'); assert.deepEqual(consoleErrors, [], 'No console errors');
        assert.deepEqual(responses, [], 'No HTTP >=400'); assert.deepEqual(failures, [], 'No failed requests');
        if (mode === 'file') assert.deepEqual(requests.filter(r => /^https?:/.test(r.url)), [], 'Offline artifact must issue zero HTTP requests');
        return {requests: requests.length, offlineHttp: requests.filter(r => /^https?:/.test(r.url)).length};
      }, page);
    } finally { await context.close(); await save(); }
  }
  await check('immutable-artifact-and-script-after-tests', async () => {
    assert.equal(sha(await readFile(options.artifact)), report.artifact.sha256, 'Artifact changed during tests');
    assert.equal(sha(await readFile(fileURLToPath(import.meta.url))), report.script.sha256, 'Verifier changed during tests');
    assert.equal(sha(await readFile(options.marker)), report.marker.sha256, 'Ready identity changed during tests');
    report.finalHttpIdentity = await httpIdentity();
    return {artifactSha256: report.artifact.sha256, scriptSha256: report.script.sha256};
  });
} catch (error) {
  report.checks.push({name: 'workflow', status: error instanceof Incomplete ? 'incomplete' : 'fail', error: error.stack});
} finally {
  await browser?.close();
  report.finishedUtc = new Date().toISOString();
  report.overall = report.checks.some(c => c.status === 'fail') ? 'fail' : report.checks.some(c => c.status === 'incomplete') ? 'incomplete' : 'pass';
  await save(); console.log(`${report.overall.toUpperCase()} ${output}/report.json`);
  if (report.overall !== 'pass') process.exitCode = 1;
}
