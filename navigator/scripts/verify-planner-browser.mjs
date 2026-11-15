#!/usr/bin/env node
import { mkdir, writeFile, access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

function options(args) {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key === '--offline') { out.offline = true; continue; }
    if (!['--base-url', '--file', '--output'].includes(key)) throw Error(`Unknown option: ${key}`);
    if (!args[i + 1] || args[i + 1].startsWith('--')) throw Error(`Missing value: ${key}`);
    if (out[key]) throw Error(`Duplicate option: ${key}`);
    out[key] = args[++i];
  }
  if (!out['--output'] || Boolean(out['--base-url']) === Boolean(out['--file']))
    throw Error('Required: (--base-url URL | --file PATH) [--offline] --output DIR');
  if (out['--base-url'] && !['http:', 'https:'].includes(new URL(out['--base-url']).protocol)) throw Error('Base URL must use HTTP(S)');
  return out;
}
let opts;
try { opts = options(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exit(2); }
const output = resolve(opts['--output']);
await mkdir(output, { recursive: true });
const report = { schemaVersion: 1, createdUtc: new Date().toISOString(), target: opts['--file'] ? pathToFileURL(resolve(opts['--file'])).href : opts['--base-url'], offline: Boolean(opts.offline), checks: [], manualGates: [
  'Real browser zoom at 200%: manual gate; viewport resizing and CDP pageScaleFactor are not browser zoom.',
  'Actual screen-reader navigation and announcements remain unverified.',
  'Glass contrast over imagery/canvas requires actual backdrop compositing and manual visual review; computed foreground/background alone cannot prove contrast.',
  'Later planning UI, assessment/export/sensitivity flows and complete T17 coverage remain incomplete.',
] };
const record = (name, status, detail) => report.checks.push({ name, status, detail });
// Chromium stores browser zoom as log(factor)/log(1.2); isolated profile only.
async function verifyBrowserZoom(chromium, executablePath) {
  const samples = [];
  for (const factor of [1, 2]) {
    const profile = await mkdtemp(join(tmpdir(), 'solarreach-verify-zoom-'));
    let context;
    try {
      await mkdir(join(profile, 'Default'));
      await writeFile(join(profile, 'Default', 'Preferences'), JSON.stringify({ partition: { default_zoom_level: { x: Math.log(factor) / Math.log(1.2) } } }));
      context = await chromium.launchPersistentContext(profile, { executablePath, headless: true, viewport: null, reducedMotion: 'reduce', args: ['--window-size=1600,1080'] });
      if (opts.offline) await context.setOffline(true);
      const page = context.pages()[0]; page.setDefaultTimeout(8000);
      await page.goto(report.target, { waitUntil: 'load', timeout: 60000 });
      await page.getByLabel('Lunar workbench', { exact: true }).waitFor({ state: 'visible', timeout: 60000 });
      await page.getByRole('button', { name: 'Dismiss introduction', exact: true }).waitFor({ state: 'visible' });
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      const measurement = await page.evaluate(() => ({ dpr: devicePixelRatio, innerWidth, innerHeight, outerWidth, outerHeight, visualScale: visualViewport.scale, documentWidth: document.documentElement.scrollWidth }));
      // Playwright screenshots normalize CSS pixels under native browser zoom.
      // Direct surface capture retains physical pixel dimensions without changing zoom.
      const cdp = await context.newCDPSession(page);
      const capture = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
      const png = Buffer.from(capture.data, 'base64');
      await writeFile(resolve(output, `planner-browser-zoom-${factor * 100}.png`), png);
      await cdp.detach();
      measurement.screenshotWidthPx = png.readUInt32BE(16); measurement.screenshotHeightPx = png.readUInt32BE(20);
      samples.push({ factor, ...measurement });
      if (factor === 2) {
        // Real layout zoom must preserve keyboard focus/activation without pointer forcing.
        await page.locator('body').evaluate(el => { el.tabIndex = -1; el.focus(); });
        await page.keyboard.press('Space');
        await page.getByRole('button', { name: 'Pause environmental playback', exact: true }).waitFor({ state: 'visible' });
        await page.keyboard.press('Space');
        await page.getByRole('button', { name: 'Play environmental playback', exact: true }).waitFor({ state: 'visible' });
        await page.getByRole('button', { name: 'Open current mode guide', exact: true }).focus();
        await page.keyboard.press('Space');
        await page.getByRole('dialog').waitFor({ state: 'visible' });
        await page.keyboard.press('Escape');
        await page.getByRole('dialog').waitFor({ state: 'hidden' });
      }
    } finally { if (context) await context.close(); await rm(profile, { recursive: true, force: true }); }
  }
  const [normal, zoomed] = samples;
  const near = (a, b) => Math.abs(a - b) <= .03 * Math.max(1, Math.abs(b));
  if (!near(zoomed.dpr / normal.dpr, 2) || !near(normal.innerWidth / zoomed.innerWidth, 2) || !near(normal.outerWidth, zoomed.outerWidth) || !near(normal.screenshotWidthPx, zoomed.screenshotWidthPx) || !near(zoomed.visualScale, 1)) throw Error('Browser zoom was not established: ' + JSON.stringify(samples));
  if (zoomed.documentWidth > zoomed.innerWidth + 1) throw Error('Document overflow at verified browser zoom: ' + JSON.stringify(samples));
  record('real-browser-zoom-200', 'pass', { samples, keyboard: 'Body Space toggles playback; unrelated button Space opens guide; Escape dismisses it.', scope: 'Dedicated headless Chrome layout zoom at fixed physical window width; not complete zoom accessibility validation.' });
  report.manualGates = report.manualGates.filter(g => !g.startsWith('Real browser zoom at 200%:'));
}
let browser;
try {
  if (opts['--file']) await access(resolve(opts['--file']));
  const { chromium } = await import('playwright-core');
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  await access(executablePath);
  try { await verifyBrowserZoom(chromium, executablePath); } catch (e) { record('real-browser-zoom-200', 'fail', e.stack || e.message); }
  browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({ reducedMotion: 'reduce', deviceScaleFactor: 1 });
  if (opts.offline) await context.setOffline(true);
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(report.target, { waitUntil: 'load', timeout: 60000 });
  const button = label => page.getByRole('button', { name: label, exact: true });
  const check = async (name, fn) => {
    try { await fn(); record(name, 'pass', 'Observed in dedicated headless context.'); }
    catch (e) { record(name, 'fail', e.message); }
  };
  await page.getByLabel('Lunar workbench', { exact: true }).waitFor({ state: 'visible', timeout: 60000 });
  // A fresh context receives the onboarding guide after the catalog loads.
  await check('initial-guide-dismiss', async () => {
    await button('Dismiss introduction').waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
  });
  for (const width of [1920, 1600, 1024, 390]) {
    await page.setViewportSize({ width, height: 1080 });
    await page.screenshot({ path: resolve(output, `planner-${width}.png`), fullPage: true });
    await check(`document-overflow-${width}`, async () => {
      const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      if (sizes.scroll > sizes.client + 1) throw Error(JSON.stringify(sizes));
    });
  }
  await page.setViewportSize({ width: 1600, height: 1080 });
  await check('reduced-motion-media', async () => {
    if (!await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)) throw Error('Reduced-motion media query false');
  });
  await check('guide-Escape', async () => {
    await button('Open current mode guide').click();
    await page.getByRole('dialog').waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
  });
  for (const [open, close, panel] of [
    ['Show site drawer', 'Close site drawer', 'Landing sites'],
    ['Show inspector', 'Close inspector', 'Scenario inspector'],
  ]) await check(`panel-close-${panel}`, async () => {
    if (await button(open).isVisible()) await button(open).click();
    await button(close).click();
    await page.getByLabel(panel, { exact: true }).waitFor({ state: 'hidden' });
    await button(open).click();
    await page.getByLabel(panel, { exact: true }).waitFor({ state: 'visible' });
  });
  for (const [min, expand] of [['Minimize location card', 'Expand location card'], ['Minimize timeline', 'Expand timeline']])
    await check(min, async () => { if (await button(expand).isVisible()) await button(expand).click(); await button(min).click(); await button(expand).waitFor({ state: 'visible' }); await button(expand).click(); });
  await check('Space-body-toggle', async () => {
    const playing = () => button('Pause environmental playback').isVisible();
    if (await playing()) await button('Pause environmental playback').click();
    await page.locator('body').evaluate(el => { el.tabIndex = -1; el.focus(); });
    await page.keyboard.press('Space');
    await button('Pause environmental playback').waitFor({ state: 'visible' });
    await page.keyboard.press('Space');
    await button('Play environmental playback').waitFor({ state: 'visible' });
  });
  await check('Space-input-guard', async () => {
    const input = page.getByLabel('Search landing sites', { exact: true });
    await input.fill(''); await input.focus(); await page.keyboard.press('Space');
    if (await button('Pause environmental playback').isVisible()) throw Error('Space in input started environmental playback');
    await input.fill('');
  });
  await check('Space-button-guard', async () => {
    await button('Open current mode guide').focus(); await page.keyboard.press('Space');
    await page.getByRole('dialog').waitFor({ state: 'visible' });
    if (await button('Pause environmental playback').isVisible()) throw Error('Space on unrelated button started playback');
    await page.keyboard.press('Escape');
  });
  await check('chart-captions', async () => {
    await button('Horizon analysis').click();
    // Optional equation lessons retain figures inside closed native details.
    // The active horizon charts, rather than a hidden lesson, must be labelled.
    await page.locator('figure:visible figcaption:visible').first().waitFor({ state: 'visible' });
    const captions = await page.locator('figure:visible figcaption:visible').allTextContents();
    if (!captions.length || captions.some(text => !text.trim())) throw Error('Missing or empty chart caption');
  });
  const charts = await page.locator('figure').evaluateAll(els => els.map(el => ({ caption: el.querySelector('figcaption')?.textContent?.trim() || '', text: el.textContent?.trim().slice(0, 700), canvas: !!el.querySelector('canvas') })));
  record('chart-text-inventory', charts.length ? 'observed' : 'unverified', charts);
  record('chart-equivalence', 'unverified', 'Text inventory cannot establish equivalent access to chart values; manual review required.');
  const glass = await page.locator('.glass').evaluateAll(els => els.map(el => { const s = getComputedStyle(el); return { role: el.getAttribute('aria-label'), color: s.color, backgroundColor: s.backgroundColor, opacity: s.opacity, backdropFilter: s.backdropFilter }; }));
  record('glass-computed-colors', 'unverified', { samples: glass, reason: 'Backdrop includes rendered imagery/canvas; no safe pixel compositing performed, no contrast ratio asserted.' });
  const contrast = await page.locator('.planning-table-scroll td, .planning-table-scroll th, .planning-decision label').evaluateAll(elements => {
    const measured = [], skipped = [];
    const rgba = text => { const m = text.match(/^rgba?\(([^)]+)\)$/); if (!m) return null; const v = m[1].split(/[, /]+/).filter(Boolean).map(Number); return v.length >= 3 && v.every(Number.isFinite) ? [...v.slice(0, 3), v[3] ?? 1] : null; };
    const luminance = c => c.slice(0, 3).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    for (const el of elements) {
      const directText = [...el.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join('').trim();
      if (!el.getClientRects().length || !directText || getComputedStyle(el).visibility !== 'visible') continue;
      const style = getComputedStyle(el), foreground = rgba(style.color), text = directText.slice(0, 100);
      let background = null, reason = null;
      for (let node = el; node; node = node.parentElement) {
        const s = getComputedStyle(node);
        if (Number(s.opacity) !== 1 || s.filter !== 'none' || s.mixBlendMode !== 'normal') { reason = 'Ancestor opacity/filter/blending requires pixel compositing'; break; }
        if (!background) {
          const color = rgba(s.backgroundColor);
          if (s.backgroundImage !== 'none') { reason = 'Background image requires pixel compositing'; break; }
          if (!color || (color[3] > 0 && color[3] < 1)) { reason = 'Translucent/unsupported background requires pixel compositing'; break; }
          if (color[3] === 1) background = color;
        }
      }
      if (reason || !background || !foreground || foreground[3] !== 1) { skipped.push({ text, reason: reason || 'No verified opaque foreground/background pair' }); continue; }
      const a = luminance(foreground), b = luminance(background), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.6667 && Number(style.fontWeight) >= 700);
      measured.push({ text, foreground, background, ratio, threshold: large ? 3 : 4.5, meetsTextThreshold: ratio >= (large ? 3 : 4.5) });
    }
    return { measured, skipped };
  });
  record('opaque-planning-text-contrast', contrast.measured.some(s => !s.meetsTextThreshold) ? 'fail' : contrast.measured.length ? 'observed' : 'unverified', { ...contrast, scope: 'Only visible text with a verified opaque solid pair and no ancestor blending; no glass/canvas or WCAG conformance claim.' });
  record('new-planning-ui-presence', await page.getByLabel('Mission decision assessment', { exact: true }).count() ? 'observed' : 'unverified', 'Presence only; absent or hidden new controls are not an interaction pass. Rebuild the intended artifact before assessing the current source.');
  record('runtime-errors', errors.length ? 'fail' : 'pass', errors);
  await context.close();
} catch (e) { record('harness-or-navigation', 'fail', e.stack || e.message); }
finally {
  if (browser) await browser.close();
  report.failed = report.checks.filter(c => c.status === 'fail').length;
  report.status = report.failed ? 'failed' : 'incomplete';
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`${report.status}: ${report.failed} failed checks; report ${resolve(output, 'report.json')}`);
  process.exitCode = report.failed ? 1 : 0;
}
