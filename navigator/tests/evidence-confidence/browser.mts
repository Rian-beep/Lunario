import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { catalog, manifest, scenario } from './fixtures';
import { evaluateEvidenceConfidence } from '../../lib/evidence-confidence';

// Isolated file fixture only; no app server, shared profile or production artifact.
const dir = mkdtempSync(join(tmpdir(), 'lunario-confidence-browser-'));
const summary = evaluateEvidenceConfidence({ catalog, state: scenario(), manifest });
const output = await build({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {EvidenceConfidence} from './components/evidence-confidence/summary';
let audience='planner'; window.renderAudience=(value)=>{audience=value; render();}; window.renderSummary=(value)=>{window.summary=value;render();}; window.defaultExport=()=>{window.useDefaultExport=true;render();};
function render(){ root.render(<EvidenceConfidence summary={window.summary} audience={audience} onClose={()=>window.closedCount++} onExport={window.useDefaultExport?undefined:json=>window.exported=json}/>); }
const root=createRoot(document.getElementById('root'));window.closedCount=0;render();`, loader: 'tsx', resolveDir: process.cwd() }, outfile: join(dir, 'fixture.js'), bundle: true, write: false, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' } });
for (const file of output.outputFiles!) writeFileSync(file.path, file.contents);
writeFileSync(join(dir, 'fixture.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Isolated confidence component</title><style>${readFileSync('app/mission-theme.css', 'utf8')}
body{margin:0;padding:16px;font-family:Arial,sans-serif} #root{width:100%;max-width:640px;margin:auto}*{box-sizing:border-box} button{font:inherit;padding:8px;border:1px solid var(--border);background:var(--secondary);color:var(--foreground)} button:focus-visible{outline:2px solid var(--ring);outline-offset:3px}</style><link rel="stylesheet" href="fixture.css"></head><body><main id="root"></main><script>window.summary=${JSON.stringify(summary).replace(/</g, '\\u003c')};</script><script src="fixture.js"></script></body></html>`);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 720, height: 1000 }, deviceScaleFactor: 1 });
const errors: string[] = [], requests: string[] = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
const checks: Array<{ name: string; pass: true; detail?: unknown }> = [];
const check = (name: string, detail?: unknown) => checks.push({ name, pass: true, ...(detail ? { detail } : {}) });
try {
  await page.goto(pathToFileURL(join(dir, 'fixture.html')).href);
  await page.getByRole('heading', { name: 'The modeled result remains conditional' }).waitFor();
  assert.ok(await page.getByText('Physical uncertainty is unquantified.', { exact: false }).isVisible());
  assert.equal(await page.locator('table th').allTextContents().then(values => values.includes('Terrain') && values.includes('Smooth sphere')), true);
  check('canonical conditional outcome and terrain/sphere comparison visible');
  const terrain = page.locator('summary').filter({ hasText: 'Solar array terrain at 2 m' });
  await terrain.focus(); await page.keyboard.press('Enter');
  assert.equal(await terrain.evaluate(el => el.parentElement!.hasAttribute('open')), true);
  assert.ok(await terrain.locator('..').getByText('Physical skyline error, unsampled ridges', { exact: false }).isVisible());
  await page.keyboard.press('Space');
  assert.equal(await terrain.evaluate(el => el.parentElement!.hasAttribute('open')), false);
  check('native details opens with Enter and closes with Space');
  await page.getByRole('button', { name: 'Export evidence summary' }).click();
  const record = await page.evaluate(() => JSON.parse((window as unknown as { exported: string }).exported));
  assert.equal(record.scenarioKey, summary.scenarioKey); assert.equal(record.heldScenario.antennaHeightM, 10);
  check('export callback receives selected scenario, full inputs and limitations');
  await page.getByRole('button', { name: 'Close evidence' }).click();
  assert.equal(await page.evaluate(() => (window as unknown as { closedCount: number }).closedCount), 1);
  check('close delegates to host');
  for (const audience of ['public', 'educator', 'planner']) {
    await page.evaluate(a => (window as unknown as { renderAudience: (a: string) => void }).renderAudience(a), audience);
    if (audience === 'educator') await page.getByText('Compare what the model calculates', { exact: false }).waitFor();
    if (audience === 'public') await page.getByText('Sampling and source details', { exact: true }).waitFor();
    await page.screenshot({ path: join(dir, `${audience}.png`), fullPage: true });
    assert.ok(await page.getByText('Physical uncertainty is unquantified.', { exact: false }).isVisible());
  }
  check('public, educator and planner have visible evidence boundary and distinct disclosure');
  const nextSummary = evaluateEvidenceConfidence({ catalog, state: { ...scenario(), custom: { lat: -85, lon: 0 }, arrayHeightM: 10 }, manifest });
  await page.evaluate(s => (window as unknown as { renderSummary: (s: typeof nextSummary) => void }).renderSummary(s), nextSummary);
  await page.getByText('Selected custom point', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Export evidence summary' }).click();
  const nextRecord = await page.evaluate(() => JSON.parse((window as unknown as { exported: string }).exported));
  assert.equal(nextRecord.scenarioKey, nextSummary.scenarioKey); assert.equal(nextRecord.metrics[0].terrain, null);
  assert.equal(await page.locator('td').filter({ hasText: /^Unknown$/ }).count() > 0, true);
  check('live summary props replace old selection, preserve unknowns and export the new identity');
  await page.evaluate(() => (window as unknown as { defaultExport: () => void }).defaultExport());
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export evidence summary' }).click();
  const downloaded = await downloadEvent;
  assert.equal(downloaded.suggestedFilename(), 'solarreach-evidence-confidence.json');
  const downloadedRecord = JSON.parse(readFileSync((await downloaded.path())!, 'utf8'));
  assert.equal(downloadedRecord.scenarioKey, nextSummary.scenarioKey);
  assert.deepEqual(downloadedRecord.heldScenario, nextSummary.heldScenario);
  assert.equal(downloadedRecord.physicalOutcomeInterval, null);
  check('default offline Blob download contains replayable full selected inputs and null physical interval');
  for (const width of [320, 360, 720]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.locator('details').evaluateAll(nodes => nodes.forEach(node => node.setAttribute('open', '')));
    const size = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }));
    assert.ok(size.document <= size.viewport, `overflow at ${width}: ${JSON.stringify(size)}`);
  }
  check('all cards expanded: no page overflow at 320/360/720 CSS px');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
  // Pinch/page scale is recorded separately; it is not native browser 200% reflow.
  check('page-scale 2 emulation only; native browser 200% acceptance pending');
  await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
  await page.setViewportSize({ width: 360, height: 1000 });
  await page.screenshot({ path: join(dir, 'expanded-360.png'), fullPage: true });
  await page.context().close();
  const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const mobile = await touch.newPage(); await mobile.goto(pathToFileURL(join(dir, 'fixture.html')).href);
  const mobileCard = mobile.locator('summary').filter({ hasText: 'Solar array terrain at 2 m' }); await mobileCard.tap();
  assert.equal(await mobileCard.evaluate(el => el.parentElement!.hasAttribute('open')), true);
  check('touch emulation toggles disclosure');
  await touch.close();
  assert.deepEqual(errors, []); assert.deepEqual(requests, []);
  check('zero page errors and zero HTTP requests in file fixture');
  const result = { artifact: 'Isolated component fixture; not parent application', sourceCommit: process.env.SOURCE_COMMIT ?? 'working tree; see REPORT.md for commit', browser: browser.version(), platform: process.platform, checks, errors, requests, screenshots: dir, limitations: ['No human participants or screen-reader acceptance', 'No integrated workspace, native browser 200% zoom or target-device acceptance', 'No physical uncertainty qualification'] };
  writeFileSync(join(dir, 'browser.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
