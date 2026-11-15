import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [], requests = [], checks = [];
page.on('pageerror', e => errors.push(e.message));
await page.route(/^https?:/, route => { requests.push(route.request().url()); return route.abort(); });
try {
  for (const dark of [false, true]) for (const width of [390, 800]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('file:///tmp/lunario-comms-component.html');
    await page.evaluate(dark => document.documentElement.dataset.uiTheme = dark ? 'dark' : 'light', dark);
    const summary = page.locator('#fixture > details > summary');
    assert.equal(await page.locator('#fixture > details').evaluate(el => el.open), false);
    await summary.focus(); await page.keyboard.press('Enter');
    assert.equal(await page.locator('#fixture > details').evaluate(el => el.open), true);
    await page.locator('#fixture details details > summary').click();
    const sizes = await page.evaluate(() => ({ viewport: innerWidth, body: document.body.scrollWidth, root: document.documentElement.scrollWidth }));
    const colors = await page.locator('#fixture > details').evaluate(el => ({ background: getComputedStyle(el).backgroundColor, foreground: getComputedStyle(el).color }));
    assert.notEqual(colors.background, colors.foreground);
    if (dark) assert.notDeepEqual(colors, checks.find(c => c.width === width && !c.dark).colors);
    assert.ok(sizes.body <= width && sizes.root <= width, JSON.stringify(sizes));
    assert.match(await page.locator('#fixture').innerText(), /conditional-meets/);
    assert.match(await page.locator('#fixture').innerText(), /Acquisition, compatibility and actual support · unknown/);
    if ((!dark && width === 390) || (dark && width === 800))
      await page.screenshot({ path: `docs/qa/evaluation/comms/component-${dark ? 'dark' : 'light'}-${width}.png`, fullPage: true });
    checks.push({ dark, width, sizes, colors, defaultCollapsed: true, keyboardDisclosure: true, criticalDisclosure: true });
  }
  assert.deepEqual(errors, []); assert.deepEqual(requests, []);
  await writeFile('docs/qa/evaluation/comms/component-browser.json', JSON.stringify({ browser: browser.version(),
    context: 'Isolated file fixture with baseline embedded styles; no shared profile/server or production app wiring',
    checks, errors, httpRequests: requests, limitations: 'Not a full app, native 200% zoom, touch-device, contrast or screen-reader acceptance check.' }, null, 2) + '\n');
  console.log(`${checks.length}/4 isolated layout/disclosure cases passed; 0 page errors; 0 HTTP requests`);
} finally { await browser.close(); }
