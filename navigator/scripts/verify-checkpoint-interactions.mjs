#!/usr/bin/env node
// Read-only browser evidence. This script never starts a server or builds the app.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, mkdir, writeFile, stat} from 'node:fs/promises';
import {cpus, hostname, platform, release, totalmem} from 'node:os';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const options = {};
for (let i = 2; i < process.argv.length; i++) {
  const key = process.argv[i];
  if (!['--base-url', '--file', '--output', '--ready', '--targets'].includes(key) || !process.argv[i + 1] || process.argv[i + 1].startsWith('--') || options[key]) {
    throw Error('Usage: --base-url URL --file PATH --output DIR [--ready PATH] [--targets http-source,http-identical-bundle,offline-file]');
  }
  options[key] = process.argv[++i];
}
assert.ok(options['--base-url'] && options['--file'] && options['--output'], 'HTTP, file and output are required');
assert.match(new URL(options['--base-url']).protocol, /^https?:$/);
const ready = resolve(options['--ready'] || '/tmp/solarreach-final-qa-ready');
const artifact = resolve(options['--file']);
const output = resolve(options['--output']);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function checkpoint() {
  const marker = await readFile(ready, 'utf8');
  const markerStat = await stat(ready);
  const bytes = await readFile(artifact);
  return {marker, markerMtimeMs: markerStat.mtimeMs, bytes: bytes.length, sha256: hash(bytes)};
}
// A missing marker is an explicit stop, never permission to test a partial copy.
const initial = await checkpoint();
await mkdir(output, {recursive: true});
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const executable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/usr/bin/google-chrome';
const browser = await chromium.launch({headless: true, executablePath: executable});
const report = {
  checkedUtc: new Date().toISOString(), artifact, checkpoint: initial,
  browser: {version: browser.version(), executable, headless: true, freshContexts: true},
  hardware: {hostname: hostname(), platform: platform(), release: release(), cpu: cpus()[0]?.model, logicalCpus: cpus().length, memoryBytes: totalmem()},
  viewport: {width: 1600, height: 1000}, runs: [], failures: [],
  limits: ['No human screen-reader test.', 'No general WCAG, scientific validity, flight-readiness or whole-app completion claim.', 'Viewport resizing below is not native Chrome 200% zoom.', 'Cold DEMO interpretation is recorded separately; automation is not a novice user study.'],
};
const availableTargets = [
  {name: 'http-source', url: options['--base-url'], offline: false},
  {name: 'http-identical-bundle', url: new URL('/solarreach-navigator.html', options['--base-url']).href, offline: false, identical: true},
  {name: 'offline-file', url: pathToFileURL(artifact).href, offline: true, identical: true},
];
const selectedTargets = options['--targets']?.split(',') || availableTargets.map(t => t.name);
assert.ok(selectedTargets.length && new Set(selectedTargets).size === selectedTargets.length && selectedTargets.every(name => availableTargets.some(t => t.name === name)), 'Choose unique known target names');
const targets = availableTargets.filter(t => selectedTargets.includes(t.name));
report.selectedTargets = targets.map(t => t.name);

try {
  for (const target of targets) {
    const dir = resolve(output, target.name);
    await mkdir(dir, {recursive: true});
    const run = {name: target.name, target: target.url, checkpoint: initial, offline: target.offline, startedUtc: new Date().toISOString(), checks: [], httpAttempts: [], httpErrors: [], pageErrors: [], consoleErrors: []};
    report.runs.push(run);
    const context = await browser.newContext({viewport: report.viewport, deviceScaleFactor: 1, reducedMotion: 'reduce', serviceWorkers: 'block', recordVideo: {dir: resolve(dir, 'video'), size: report.viewport}});
    await context.tracing.start({screenshots: true, snapshots: true});
    if (target.offline) {
      await context.route(/^https?:\/\//, route => route.abort());
      await context.setOffline(true);
    }
    context.on('request', request => {if (/^https?:/.test(request.url())) run.httpAttempts.push({url: request.url(), method: request.method()});});
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => run.pageErrors.push(error.message));
    page.on('console', message => {if (message.type() === 'error') run.consoleErrors.push(message.text());});
    page.on('response', response => {if (response.status() >= 400) run.httpErrors.push({url: response.url(), status: response.status()});});
    const button = name => page.getByRole('button', {name, exact: true});
    const inspector = page.getByRole('complementary', {name: 'Scenario inspector', exact: true});
    const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('solarreach-workbench-v1')));
    const dismiss = async () => {
      const guide = button('Dismiss introduction');
      if (await guide.isVisible()) {await guide.click(); await guide.waitFor({state: 'hidden'});}
    };
    async function details(text, scope = page) {
      const summary = scope.locator('summary').filter({hasText: text}).first();
      if (!await summary.evaluate(node => node.parentElement.open)) {await summary.focus(); await summary.press('Enter');}
      return summary.locator('..');
    }
    async function evidence(name, scope = page.locator('body')) {
      await writeFile(resolve(dir, `${name}.aria.txt`), await scope.ariaSnapshot());
      await page.screenshot({path: resolve(dir, `${name}.png`), animations: 'disabled'});
    }
    async function check(name, action) {
      try {
        const value = await action();
        run.checks.push({name, status: 'pass', checkedUtc: new Date().toISOString(), ...value});
        console.log(`PASS ${target.name}: ${name}`);
      } catch (error) {
        run.checks.push({name, status: 'fail', checkedUtc: new Date().toISOString(), error: error.stack});
        report.failures.push(`${target.name}: ${name}: ${error.message}`);
        await evidence(`${name}-FAIL`).catch(() => {});
        console.error(`FAIL ${target.name}: ${name}: ${error.message}`);
      }
      await writeFile(resolve(dir, 'progress.json'), JSON.stringify(run, null, 2));
    }
    try {
      await check('load-and-identity', async () => {
        if (target.name === 'http-identical-bundle') {
          // Hash a real HTTP GET outside Chrome's size-limited inspector cache.
          // Browser navigation remains direct: no routing/fulfilment or mocks.
          const probe = await fetch(target.url, {signal: AbortSignal.timeout(120000)});
          assert.equal(probe.status, 200);
          const bytes = Buffer.from(await probe.arrayBuffer());
          run.bundleSha256 = hash(bytes);
          run.bundleCapture = {method: 'separate HTTP GET hash; direct browser navigation with matching ETag', bytes: bytes.length, etag: probe.headers.get('etag'), contentType: probe.headers.get('content-type')};
          assert.equal(run.bundleSha256, initial.sha256, 'HTTP standalone differs from supplied file');
          assert.ok(run.bundleCapture.etag, 'HTTP bundle has no validator for navigation parity');
        }
        const response = await page.goto(target.url, {waitUntil: 'load', timeout: 120000});
        if (!target.offline) assert.equal(response.status(), 200);
        if (target.name === 'http-identical-bundle') {
          const headers = await response.allHeaders();
          run.bundleCapture.browserNavigationHeaders = headers;
          assert.equal(headers.etag, run.bundleCapture.etag, 'HTTP object changed between hashing and browser navigation');
          assert.equal(headers['content-type'], run.bundleCapture.contentType);
        } else if (target.offline) run.bundleSha256 = hash(await readFile(artifact));
        else run.sourceDocumentSha256 = hash(await response.body());
        await page.getByLabel('Lunar workbench', {exact: true}).waitFor({timeout: 90000});
        await dismiss();
        await button('Planner').click(); await dismiss();
        const contextPanel = page.getByRole('region', {name: 'Operational decision context', exact: true});
        await contextPanel.waitFor();
        run.modelIdentity = (await contextPanel.innerText()).match(/Dataset .*?model [^.]+/)?.[0];
        assert.ok(run.modelIdentity, 'No rendered dataset/model identity');
        return {modelIdentity: run.modelIdentity};
      });
      if (run.checks.at(-1).status !== 'pass') continue;
      await check('map-region-by-view', async () => {
        await button('2D map').click(); assert.ok(await page.getByRole('combobox', {name: 'Map region', exact: true}).isVisible());
        await button('3D terrain').click(); assert.equal(await page.getByRole('combobox', {name: 'Map region', exact: true}).isVisible(), false);
        await page.waitForFunction(() => document.querySelector('.scene-host')?.dataset.moonModel === 'ready', null, {timeout: 90000});
        run.graphics = await page.locator('.scene-host canvas').evaluate(canvas => {
          const gl = canvas.getContext('webgl2');
          if (!gl) return {webgl2: false};
          const extension = gl.getExtension('WEBGL_debug_renderer_info');
          return {webgl2: true, vendor: gl.getParameter(gl.VENDOR), renderer: gl.getParameter(gl.RENDERER), unmaskedRenderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : null};
        });
        await button('Split map and 3D').click(); assert.ok(await page.getByRole('combobox', {name: 'Map region', exact: true}).isVisible());
        await evidence('map-region-split');
        await button('3D terrain').click();
        return {twoD: 'visible', threeD: 'hidden', split: 'visible'};
      });
      await check('vertical-pointer-north-south', async () => {
        if (await button('Hide inspector').isVisible()) await button('Hide inspector').click();
        await page.getByLabel('Camera and lighting controls', {exact: true}).click();
        await page.getByRole('group', {name: '3D camera', exact: true}).getByRole('button', {name: 'Moon', exact: true}).click();
        await page.getByLabel('Camera and lighting controls', {exact: true}).click();
        const host = page.locator('.scene-host');
        await page.waitForFunction(() => Number.isFinite(Number(document.querySelector('.scene-host')?.dataset.viewLatitude)));
        const before = await state();
        const samples = [];
        const read = () => host.evaluate(node => ({latitude: Number(node.dataset.viewLatitude), longitude: Number(node.dataset.viewLongitude), camera: node.dataset.cameraPosition, target: node.dataset.cameraTarget, radiusKm: Number(node.dataset.cameraBodyRadiusKm), minimumKm: Number(node.dataset.globeMinimumRadiusKm)}));
        const bounds = await host.boundingBox();
        const x = bounds.x + bounds.width * .52, top = bounds.y + bounds.height * .24, bottom = bounds.y + bounds.height * .84;
        run.pointerEvents = await page.evaluate(() => {
          window.__checkpointPointerEvents = [];
          document.querySelector('.scene-host canvas').addEventListener('pointermove', event => {
            if (event.buttons === 1) window.__checkpointPointerEvents.push({x: event.clientX, y: event.clientY, trusted: event.isTrusted});
          });
          return [];
        });
        samples.push(await read());
        const capturedPoles = new Set();
        // No pole buttons, camera mutation or synthetic DOM-dispatched events.
        for (const [from, to] of [[top, bottom], [bottom, top]]) {
          await page.mouse.move(x, from); await page.mouse.down();
          await page.mouse.move(x, to, {steps: 16});
          await page.mouse.up();
          // Read the settled endpoint; per-move screenshots would add rendering
          // work between events and turn the gesture into a sequence of pauses.
          await page.waitForTimeout(400);
          const sample = await read(); samples.push(sample);
          const pole = sample.latitude > 0 ? 'north' : 'south';
          if (Math.abs(sample.latitude) > 85 && !capturedPoles.has(pole)) {
            await page.screenshot({path: resolve(dir, `pole-${pole}.png`)});
            capturedPoles.add(pole);
          }
        }
        run.pointerEvents = await page.evaluate(() => window.__checkpointPointerEvents);
        const min = Math.min(...samples.map(s => s.latitude)), max = Math.max(...samples.map(s => s.latitude));
        const result = {minLatitude: min, maxLatitude: max, samples, pointerEvents: run.pointerEvents,
          geographySource: 'host data-view-latitude / data-view-longitude produced by runtime cameraBodyGeography(sceneToBody(camera.position))', thresholdDegrees: 85};
        await writeFile(resolve(dir, 'vertical-pointer-geography.json'), JSON.stringify(result, null, 2));
        assert.ok(run.pointerEvents.length >= 32 && run.pointerEvents.every(e => e.trusted && Math.abs(e.x - x) < 1), 'No trusted constant-x vertical drag proof');
        assert.ok(min < -85 && max > 85, `Vertical drag did not reach both polar regions: ${min} to ${max}`);
        assert.ok(samples.every(s => s.radiusKm >= s.minimumKm - .001), 'Camera entered globe collision bound');
        assert.deepEqual(await state(), before, 'Camera drag changed scientific scenario');
        return result;
      });
      await check('public-failure-and-planner-detail', async () => {
        await button('2D map').click();
        if (await button('Show inspector').isVisible()) await button('Show inspector').click();
        await button('Planner').click(); await dismiss();
        await button('Explore a real delay contingency').click();
        const comparison = page.getByRole('dialog', {name: 'Mission scenario comparisons', exact: true});
        await comparison.waitFor({timeout: 60000});
        await page.getByRole('combobox', {name: 'Reference scenario', exact: true}).selectOption({label: 'Demo · delayed arrival'});
        const alternative = comparison.getByRole('row').filter({has: page.getByRole('button', {name: 'Demo · alternative site', exact: true})});
        assert.match(await alternative.innerText(), /Site-only comparison/);
        await evidence('controlled-comparison', comparison);
        await button('Demo · delayed arrival').click();
        const before = await state();
        const planner = page.getByRole('region', {name: 'Operational decision context', exact: true});
        assert.match(await planner.innerText(), /Fails an assessed requirement/);
        assert.match(await planner.innerText(), /14 Jul 2027, 18:00 UTC.*14 Jul 2027, 19:00 UTC/s);
        assert.match(await planner.innerText(), /-2,000 Wh/);
        assert.match(await planner.innerText(), /planning-4/);
        const assessment = page.getByRole('region', {name: 'Mission decision assessment', exact: true});
        assert.match(await assessment.innerText(), /31\.18[\d]* h from arrival/);
        await evidence('planner-failure', inspector);
        await button('Public').click(); await dismiss();
        const publicGuide = page.getByRole('region', {name: 'Understand this lunar stay', exact: true});
        const text = await publicGuide.innerText();
        assert.match(text, /This stay needs a change/);
        assert.match(text, /cannot supply all electrical demand/);
        assert.match(text, /one at a time/);
        assert.match(text, /More array helps only while usable sunlight is available/);
        assert.match(text, /Missing information is not a favorable result/);
        assert.deepEqual(await state(), before, 'Audience switch changed scientific scenario');
        await evidence('public-failure', publicGuide);
        return {publicExplanation: text, plannerBracket: '2027-07-14 18:00–19:00 UTC', scientificStatePreserved: true};
      });
      await check('equations-and-units', async () => {
        await details('See the model relations');
        assert.ok(await page.getByRole('math').first().isVisible());
        const explorer = await details('Explore a symbol, unit and physical meaning');
        const selector = explorer.getByRole('combobox', {name: 'Model variable', exact: true});
        const variables = await selector.locator('option').evaluateAll(nodes => nodes.map(node => ({value: node.value, label: node.textContent})));
        const measured = [];
        for (const variable of variables.filter(v => /area|flux|efficiency|stored|capacity|time|frequency|elevation|mass/i.test(v.label)).slice(0,14)) {
          await selector.selectOption(variable.value);
          const data = await explorer.evaluate(node => ({heading: node.querySelector('h3')?.textContent, equation: node.querySelector('[role=math]')?.getAttribute('aria-label'), definitions: [...node.querySelectorAll('dl > div')].map(row => [row.querySelector('dt')?.textContent, row.querySelector('dd')?.textContent])}));
          assert.ok(data.equation && !/[\\$]/.test(data.equation));
          for (const label of ['Units', 'Meaning', 'What it measures', 'Intuition', 'Limits']) assert.ok(data.definitions.find(([key, value]) => key === label && value?.trim()), `${variable.label}: missing ${label}`);
          measured.push({...variable, ...data});
        }
        assert.ok(measured.length >= 6, 'Too few variable/unit checks');
        await explorer.scrollIntoViewIfNeeded(); await evidence('public-variable-units', explorer);
        await button('Educator').click(); await dismiss();
        const educator = page.getByRole('region', {name: 'Explore the model', exact: true});
        assert.match(await educator.innerText(), /Δt must be in hours: 1 Wh = 3600 J/);
        assert.match(await educator.innerText(), /Controls show degrees; trigonometric evaluation uses radians/);
        await evidence('educator-equation-units', educator);
        return {availableVariables: variables.length, measured};
      });
      await check('panel-resize-and-right-overflow', async () => {
        await button('Planner').click(); await dismiss();
        const handle = page.getByRole('separator', {name: 'Resize scenario inspector', exact: true});
        const before = await state();
        const measurements = [];
        const measure = async label => {
          const value = await inspector.evaluate(node => {
            const r = node.getBoundingClientRect();
            const scroll = [...node.querySelectorAll('*')].filter(e => getComputedStyle(e).overflowX === 'auto' || getComputedStyle(e).overflowX === 'scroll');
            const escaped = [...node.querySelectorAll('input,select,textarea,button,[role=math],p,h2,h3,dl')].filter(e => {
              const q = e.getBoundingClientRect();
              if (!q.width || !q.height || q.bottom < r.top || q.top > r.bottom) return false;
              if (scroll.some(s => s.contains(e))) return false; // intentional table scroll regions are reported separately
              return q.right > r.right + 1 || q.left < r.left - 1;
            }).map(e => ({tag: e.tagName, text: e.textContent.slice(0,100), right: e.getBoundingClientRect().right}));
            return {width: r.width, right: r.right, viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, inspectorClientWidth: node.clientWidth, inspectorScrollWidth: node.scrollWidth, escaped, intentionalScrollRegions: scroll.map(e => ({className: e.className, clientWidth: e.clientWidth, scrollWidth: e.scrollWidth}))};
          });
          measurements.push({label, ...value});
          assert.ok(value.right <= value.viewport + 1 && value.documentWidth <= value.viewport + 1, `${label}: page/panel exceeds viewport`);
          assert.ok(value.inspectorScrollWidth <= value.inspectorClientWidth + 1, `${label}: inspector has horizontal overflow`);
          assert.deepEqual(value.escaped, [], `${label}: controls/text escape inspector`);
          return value;
        };
        await handle.focus(); await handle.press('Home'); const compact = await measure('compact-1600');
        await handle.press('End'); const wide = await measure('wide-1600');
        assert.ok(wide.width > compact.width + 100, 'Keyboard resize did not widen panel');
        const bounds = await handle.boundingBox();
        await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2); await page.mouse.down();
        await page.mouse.move(bounds.x + bounds.width / 2 + 140, bounds.y + bounds.height / 2, {steps: 12}); await page.mouse.up();
        const dragged = await measure('pointer-resize-1600');
        assert.ok(dragged.width < wide.width - 80, 'Pointer resize did not shrink panel');
        await evidence('panel-pointer-resize', inspector);
        await details('Assessed requirements & margins'); await measure('requirements-open-1600');
        for (const width of [1280, 900, 800]) {
          await page.setViewportSize({width, height: 1000});
          await measure(`viewport-${width}`);
          await evidence(`panel-viewport-${width}`, inspector);
        }
        assert.deepEqual(await state(), before, 'Panel resize changed scientific scenario');
        await page.setViewportSize(report.viewport);
        return {measurements, scientificStatePreserved: true};
      });
      await check('narrow-map-region-pointer-access', async () => {
        try {
          await button('2D map').click();
          await page.setViewportSize({width: 800, height: 1000});
          const selector = page.getByRole('combobox', {name: 'Map region', exact: true});
          const hit = await selector.evaluate(element => {
            const r = element.getBoundingClientRect();
            const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return {rect: {x: r.x, y: r.y, width: r.width, height: r.height}, unobstructed: top === element || element.contains(top), topElement: {tag: top?.tagName, className: top?.className}};
          });
          let clickError = null;
          try {await selector.click({timeout: 3000});} catch (error) {clickError = error.message;}
          if (!clickError) await page.keyboard.press('Escape');
          const result = {viewport: {width: 800, height: 1000}, hit, clickError};
          await writeFile(resolve(dir, 'narrow-map-region-pointer-access.json'), JSON.stringify(result, null, 2));
          await evidence('narrow-map-region-pointer-access');
          assert.ok(hit.unobstructed && !clickError, `800px Map region pointer blocked by ${hit.topElement.className}: ${clickError?.split('\n')[0] || 'center hit target differs'}`);
          return result;
        } finally {await page.setViewportSize(report.viewport);}
      });
      await check('offline-network-and-runtime', async () => {
        assert.deepEqual(run.pageErrors, [], 'Uncaught browser error');
        assert.deepEqual(run.httpErrors, [], 'HTTP resource error');
        if (target.offline) assert.equal(run.httpAttempts.length, 0, 'Offline flow attempted HTTP(S)');
        return {httpAttemptCount: run.httpAttempts.length, consoleErrors: run.consoleErrors};
      });
    } finally {
      run.finishedUtc = new Date().toISOString();
      await context.tracing.stop({path: resolve(dir, 'trace.zip')});
      await context.close();
      await writeFile(resolve(dir, 'report.json'), JSON.stringify(run, null, 2));
    }
  }
  const final = await checkpoint(); report.finalCheckpoint = final;
  assert.deepEqual(final, initial, 'Ready marker/artifact refreshed during verification: rerun against the new checkpoint');
} catch (error) {
  report.failures.push(error.stack || error.message);
} finally {
  report.finishedUtc = new Date().toISOString();
  await browser.close();
  report.summary = {checks: report.runs.reduce((n, r) => n + r.checks.length, 0), failures: report.failures.length};
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({artifactSha256: initial.sha256, ...report.summary, output}, null, 2));
if (report.failures.length) process.exitCode = 1;
