#!/usr/bin/env node
// Source-level browser regression: intercepted local assets, no app server or
// production build outputs. Native zoom uses an isolated Chrome preference.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, join, extname, relative } from 'node:path';
import { nativeZoomEstablished } from './checks.mjs';

const root = process.cwd();
const out = resolve(process.env.AUDIENCE_DRAWER_OUT ?? '/tmp/lunario-fix-audience');
const cssRef = process.env.AUDIENCE_DRAWER_CSS_REF;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir(out, { recursive: true });
const globals = cssRef ? execFileSync('git', ['show', `${cssRef}:navigator/app/globals.css`], { cwd: root }) : await readFile('app/globals.css');
// Compile the actual CSS input in memory, resolving its existing imports.
const css = execFileSync(process.execPath, [join(root, 'node_modules/@tailwindcss/cli/dist/index.mjs'), '-i', '-', '--minify'], {
  cwd: join(root, 'app'), input: globals, maxBuffer: 16 * 1024 * 1024,
});
const app = await build({
  absWorkingDir: root, entryPoints: ['standalone/main.tsx'], bundle: true,
  format: 'iife', minify: true, write: false, outdir: '/__audience_memory__',
  jsx: 'automatic', target: ['es2020'],
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.url': 'document.baseURI' },
});
const js = app.outputFiles.find(file => file.path.endsWith('.js')).contents;
const themeCSS = app.outputFiles.filter(file => file.path.endsWith('.css')).map(file => file.text).join('\n');
const html = `<!doctype html><html lang="en" data-ui-theme="dark" class="dark"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lunario drawer source regression</title><style>${css}\n${themeCSS}
@font-face{font-family:"Lunario Geist";src:url(/fonts/lunario/geist-var.woff2);font-weight:100 900;font-display:swap}
:root{--font-sans:"Lunario Geist","Segoe UI",Arial,sans-serif;--font-display:var(--font-sans);--font-serif:var(--font-sans)}body{font-family:var(--font-sans)}</style>
</head><body><div id="root"></div><script src="/audience-source.js"></script></body></html>`;
const mime = { '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.js': 'text/javascript' };
const report = {
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  cssRef: cssRef ?? 'working tree', globalsSHA256: sha(globals), sourceBundleSHA256: sha(js), themeCSSSHA256: sha(themeCSS), scriptSHA256: sha(await readFile(new URL(import.meta.url))),
  startedUtc: new Date().toISOString(), cases: [], nativeMeasurements: [],
  scope: 'Real Navigator and committed public data; source bundled in memory; all HTTP served by isolated Playwright routes. No server or generated production artifact.',
  limits: ['Agent automation; mobile touch emulation, no physical device or screen reader.', 'No final hosted/offline artifact acceptance; integrator rebuild and replay required.'],
};
const flags = ['--no-sandbox', '--disable-dev-shm-usage'];
const chrome = process.env.AUDIENCE_CHROME ?? '/opt/google/chrome/chrome';
const browser = await chromium.launch({ executablePath: chrome, headless: true, args: flags });
report.browser = browser.version();
const button = (page, name) => page.getByRole('button', { name, exact: true });

async function tabTo(page, target, reverse = false) {
  for (let i = 0; i < 250; i++) {
    if (await target.evaluate(el => el === document.activeElement)) return i;
    await page.keyboard.press(reverse ? 'Shift+Tab' : 'Tab');
  }
  throw Error(`Keyboard could not reach ${await target.textContent()}`);
}
async function geometry(page) {
  return page.evaluate(() => ({ dpr: devicePixelRatio, innerWidth, innerHeight, outerWidth, visualScale: visualViewport.scale, documentWidth: document.documentElement.scrollWidth }));
}
async function drawerGeometry(page) {
  return page.locator('.site-drawer,.site-list,.site-item,.site-search,.site-filter,.coordinate-form,.site-drawer-footer').evaluateAll(elements => elements.map(el => {
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return { class: el.className, x: r.x, y: r.y, width: r.width, height: r.height, clientHeight: el.clientHeight, scrollHeight: el.scrollHeight, scrollTop: el.scrollTop, overflow: style.overflowY, maxHeight: style.maxHeight, gridArea: style.gridArea, position: style.position, bottom: style.bottom };
  }));
}
async function visibleHit(target) {
  return target.evaluate(el => {
    const r = el.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    return r.height > 0 && x >= 0 && x < innerWidth && y >= 0 && y < innerHeight && !!hit && (hit === el || el.contains(hit));
  });
}
async function waitForHit(target) {
  // Info explanations intentionally linger for 250 ms after keyboard blur.
  // Wait for that real transition instead of sampling its intermediate paint.
  for (let i = 0; i < 20; i++) {
    if (await visibleHit(target)) return;
    await target.page().waitForTimeout(100);
  }
  assert.fail('Focused control did not become visible and hit-testable');
}
async function screenshot(page, name) {
  const cdp = await page.context().newCDPSession(page);
  try {
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
    await writeFile(join(out, name + '.png'), Buffer.from(shot.data, 'base64'));
  } finally { await cdp.detach(); }
}
async function touchScrollTo(page, target) {
  const cdp = await page.context().newCDPSession(page);
  try {
    for (let i = 0; i < 30; i++) {
      if (await visibleHit(target)) return i;
      const r = await page.locator('.site-drawer').boundingBox();
      const x = r.x + r.width / 2, startY = r.y + r.height * .8, endY = r.y + r.height * .2;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: startY }] });
      for (let step = 1; step <= 8; step++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: startY + (endY - startY) * step / 8 }] });
        await page.waitForTimeout(20);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(120);
    }
    throw Error('Touch scrolling could not reach target');
  } finally { await cdp.detach(); }
}
async function wheelScrollTo(page, target) {
  for (let i = 0; i < 20; i++) {
    if (await visibleHit(target)) return i;
    const r = await page.locator('.site-drawer').boundingBox();
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
    await page.mouse.wheel(0, 80);
    await page.waitForTimeout(100);
  }
  assert.fail('Wheel scrolling could not reveal site result');
}
async function exercise(context, label, touch = false) {
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [], requests = [], missing = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    requests.push(url.href);
    if (url.origin !== 'http://lunario-audience.test') return route.abort();
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: html });
    if (url.pathname === '/audience-source.js') return route.fulfill({ contentType: 'text/javascript', body: Buffer.from(js) });
    const file = resolve(root, 'public', '.' + decodeURIComponent(url.pathname));
    assert.ok(!relative(join(root, 'public'), file).startsWith('..'));
    try { return await route.fulfill({ contentType: mime[extname(file)] ?? 'application/octet-stream', body: await readFile(file) }); }
    catch (error) { if (error.code !== 'ENOENT') throw error; missing.push(url.pathname); return route.fulfill({ status: 404 }); }
  });
  await page.goto('http://lunario-audience.test/');
  await button(page, 'Dismiss introduction').waitFor({ timeout: 30000 });
  await page.locator('.lunario-loader').waitFor({ state: 'hidden', timeout: 30000 });
  await button(page, 'Dismiss introduction').click();
  await page.evaluate(() => document.fonts.ready);
  const cdp = await context.newCDPSession(page);
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  await cdp.detach();
  report.nativeMeasurements.push({ label, ...await geometry(page), screenshotWidth: Buffer.from(shot.data, 'base64').readUInt32BE(16) });
  for (const theme of ['dark', 'light']) {
    const entry = { label, theme, status: 'fail', steps: [] };
    report.cases.push(entry);
    try {
      if (await page.evaluate(() => document.documentElement.dataset.uiTheme) !== theme) await button(page, `Switch to ${theme} mode`).click();
      const activate = async target => { if (touch) await target.tap(); else await target.click(); };
      const open = async () => {
        if (!(await page.locator('.site-drawer').count())) await activate(button(page, 'Pick a site'));
      };
      await open();
      const search = page.getByRole('textbox', { name: 'Search landing sites', exact: true });
      await activate(search); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.type('Malapert');
      const result = page.getByRole('button', { name: /^Malapert Massif/ });
      entry.searchedGeometry = await drawerGeometry(page);
      assert.ok((await page.locator('.site-list').boundingBox()).height > 20, 'AUD01: searched result list collapsed');
      entry.resultScrolls = touch ? await touchScrollTo(page, result) : await wheelScrollTo(page, result);
      await screenshot(page, `${label}-${theme}-search`);
      await activate(result);
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('solarreach-workbench-v1')).siteId === 'malapert-massif');
      assert.equal(await page.locator('.site-drawer').count(), 0, 'Public site selection dismisses drawer');
      entry.steps.push(touch ? 'touch search, actual Malapert tap, state update and automatic dismissal' : 'pointer search, actual Malapert click, state update and automatic dismissal');

      await open();
      await tabTo(page, search); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.type('zz-no-site');
      await page.getByText('No matching site. Try another name or coordinates.', { exact: true }).waitFor();
      await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.type('Shackleton');
      const keyboardResult = page.locator('.site-list .site-item').first();
      const expectedName = await keyboardResult.locator('strong').textContent();
      await tabTo(page, keyboardResult); await waitForHit(keyboardResult);
      await page.keyboard.press('Enter');
      await page.waitForFunction(name => document.querySelector('.workspace-heading h1')?.textContent === name, expectedName);
      assert.equal(await page.locator('.site-drawer').count(), 0);
      entry.steps.push('Tab to search, no-match recovery, Tab to visible result, Enter selection and dismissal');

      await open();
      await activate(search); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.press('Backspace');
      const filter = page.getByLabel('Filter landing sites', { exact: true });
      await tabTo(page, filter); await page.keyboard.press('Home'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
      assert.equal(await filter.inputValue(), 'polar');
      assert.ok(await page.locator('.site-item').count() > 0);
      await page.keyboard.press('Home'); await page.keyboard.press('Enter');
      assert.equal(await filter.inputValue(), 'all');
      entry.steps.push('native filter keyboard selection and reset');

      // Expanded chrome must not collapse the list or clip the footer.
      const coordinates = page.locator('.coordinate-form > summary');
      if (touch) await touchScrollTo(page, coordinates); else await tabTo(page, coordinates);
      await (touch ? coordinates.tap() : page.keyboard.press('Enter'));
      assert.equal(await page.locator('.coordinate-form').getAttribute('open'), '');
      entry.expandedGeometry = await drawerGeometry(page);
      assert.ok((await page.locator('.site-list').boundingBox()).height > 20, 'AUD01: expanded coordinates collapse list');
      const footer = button(page, 'Source details');
      entry.footerScrolls = touch ? await touchScrollTo(page, footer) : await tabTo(page, footer);
      await waitForHit(footer);
      entry.footerGeometry = await drawerGeometry(page);
      await screenshot(page, `${label}-${theme}-footer`);
      await (touch ? footer.tap() : page.keyboard.press('Enter'));
      await page.getByRole('complementary', { name: 'Scenario inspector' }).waitFor();
      assert.ok(await page.locator('.inspector').getByText('Data, with a paper trail', { exact: true }).isVisible());
      entry.steps.push('expanded custom coordinates, natural scroll to footer, Source details opens actual inspector');
      // Drawer retains its established placement with the inspector open.
      const close = button(page, 'Close site drawer');
      await tabTo(page, close, true); await waitForHit(close);
      await page.keyboard.press('Enter'); assert.equal(await page.locator('.site-drawer').count(), 0);
      await open(); await activate(search); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.type('Malapert');
      if (touch) await touchScrollTo(page, result); else await wheelScrollTo(page, result);
      await activate(result);
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('solarreach-workbench-v1')).siteId === 'malapert-massif');
      assert.equal(await page.locator('.site-drawer').count(), 0);
      entry.steps.push('actual site selection and automatic dismissal while inspector remains open');
      await activate(button(page, 'Close inspector'));
      await open(); await activate(close); assert.equal(await page.locator('.site-drawer').count(), 0);
      entry.steps.push('keyboard dismissal with inspector open; ordinary pointer/touch dismissal');
      entry.geometry = await geometry(page);
      assert.ok(entry.geometry.documentWidth <= entry.geometry.innerWidth + 1);
      assert.deepEqual(errors, []);
      assert.deepEqual(missing, []);
      entry.status = 'pass';
    } catch (error) {
      entry.error = error.stack;
      entry.failureGeometry = await drawerGeometry(page);
      entry.workspace = await page.locator('.workspace').evaluate(el => ({ height: el.clientHeight, rows: getComputedStyle(el).gridTemplateRows, columns: getComputedStyle(el).gridTemplateColumns }));
      await screenshot(page, `${label}-${theme}-failure`);
      // Reload between themes after failure; do not repair state with forced input.
      await page.reload(); await button(page, 'Dismiss introduction').waitFor({ timeout: 30000 });
      await page.locator('.lunario-loader').waitFor({ state: 'hidden', timeout: 30000 });
      await button(page, 'Dismiss introduction').click();
    }
    console.log(`${entry.status.toUpperCase()} ${label} ${theme}: ${entry.error?.split('\n')[0] ?? entry.steps.join('; ')}`);
  }
  report.requests = [...new Set([...(report.requests ?? []), ...requests])];
  await page.close();
}
try {
  if (!process.env.AUDIENCE_DRAWER_NATIVE_ONLY) {
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    try { await exercise(mobile, 'mobile390', true); } finally { await mobile.close(); }
  }
  for (const factor of [1, 2]) {
    const profile = await mkdtemp('/tmp/lunario-drawer-zoom-');
    let context;
    try {
      await mkdir(join(profile, 'Default'));
      await writeFile(join(profile, 'Default', 'Preferences'), JSON.stringify({ partition: { default_zoom_level: { x: Math.log(factor) / Math.log(1.2) } } }));
      context = await chromium.launchPersistentContext(profile, { executablePath: chrome, headless: true, viewport: null, args: [...flags, '--window-size=1600,1080'] });
      await exercise(context, `native${factor * 100}`);
    } finally { await context?.close(); await rm(profile, { recursive: true, force: true }); }
  }
  report.nativeZoomEstablished = nativeZoomEstablished(report.nativeMeasurements.find(m => m.label === 'native100'), report.nativeMeasurements.find(m => m.label === 'native200'));
  assert.ok(report.nativeZoomEstablished, 'must establish actual native 200% zoom');
} catch (error) { report.fatal = error.stack; }
finally {
  await browser.close();
  report.finishedUtc = new Date().toISOString();
  report.summary = { total: report.cases.length, passed: report.cases.filter(c => c.status === 'pass').length, failed: report.cases.filter(c => c.status !== 'pass').length };
  await writeFile(join(out, 'site-drawer.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ summary: report.summary, nativeMeasurements: report.nativeMeasurements, nativeZoomEstablished: report.nativeZoomEstablished, fatal: report.fatal }, null, 2));
  if (report.fatal || report.summary.failed) process.exitCode = 1;
}
