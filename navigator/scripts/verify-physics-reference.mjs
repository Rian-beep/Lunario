#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
const args = process.argv.slice(2), options = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--offline') { options.offline = true; continue; }
  if (!['--base-url', '--file', '--output'].includes(args[i]) || !args[i + 1]) throw Error(`Invalid option ${args[i]}`);
  options[args[i]] = args[++i];
}
if (!options['--output'] || Boolean(options['--file']) === Boolean(options['--base-url'])) throw Error('Use (--base-url URL | --file PATH) [--offline] --output DIR');
const output = resolve(options['--output']); await mkdir(output, { recursive: true });
const target = options['--file'] ? pathToFileURL(resolve(options['--file'])).href : options['--base-url'];
const report = { target, utc: new Date().toISOString(), checks: [], errors: [], httpRequests: [] };
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
try {
  for (const [mode, label] of [['public', 'Public'], ['teach', 'Educator'], ['plan', 'Planner']]) {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, reducedMotion: 'reduce' });
    if (options.offline) { await context.route(/^https?:\/\//, route => { report.httpRequests.push(route.request().url()); return route.abort(); }); await context.setOffline(true); }
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
    try {
      await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 60000 });
      const initialGuide = page.locator('dialog[aria-labelledby="audience-guide-title"]');
      await page.getByRole('group', { name: 'Audience mode' }).waitFor();
      if (await initialGuide.isVisible()) { await page.keyboard.press('Escape'); await initialGuide.waitFor({ state: 'hidden' }); }
      await page.getByRole('group', { name: 'Audience mode' }).getByRole('button', { name: label, exact: true }).click();
      const guide = page.locator('dialog[aria-labelledby="audience-guide-title"]');
      if (await guide.isVisible()) { await page.keyboard.press('Escape'); await guide.waitFor({ state: 'hidden' }); }
      const reference = page.getByRole('complementary', { name: 'Physics reference', exact: true });
      await reference.waitFor({ state: 'visible' });
      const outer = reference.locator(':scope > details');
      assert.equal(await outer.getAttribute('open'), null, 'reference starts collapsed');
      await outer.locator(':scope > summary').click();
      const selector = reference.getByLabel('Topic', { exact: true });
      const topics = await selector.locator('option').evaluateAll(nodes => nodes.map(node => ({ id: node.value, label: node.textContent })));
      assert.equal(topics.length, 7);
      for (const topic of topics) {
        await selector.selectOption(topic.id);
        await reference.getByRole('heading', { name: topic.label, exact: true }).waitFor();
        for (const heading of ['Current model boundary', 'User-supplied inputs', 'Requires external evidence']) assert.ok(await reference.getByText(heading, { exact: true }).isVisible());
        const relations = reference.locator('details').filter({ has: page.locator('summary', { hasText: 'Relations, symbols and limits' }) }).last();
        assert.equal(await relations.evaluate(node => node.open), mode !== 'public');
        if (mode === 'public') await relations.locator('summary').click();
        assert.ok(await reference.getByRole('math').first().isVisible());
        assert.match(await relations.innerText(), /Frame:.*|Assumptions:/s);
        assert.match(await relations.innerText(), /\((?:m|W|Pa|J|kg|s|rad|Hz|K)/);
        assert.doesNotMatch((await reference.getByRole('math').allTextContents()).join(' '), /\\|\$/);
        for (const href of await reference.locator('a').evaluateAll(nodes => nodes.map(node => node.href))) assert.ok(new URL(href).hostname.endsWith('nasa.gov'));
      }
      await page.screenshot({ path: resolve(output, `${mode}-reference.png`) });
      await reference.getByRole('button', { name: 'Dismiss', exact: true }).click();
      assert.equal(await reference.count(), 0);
      await page.getByRole('button', { name: 'Show physics reference', exact: true }).click();
      await reference.waitFor({ state: 'visible' });
      assert.equal(await reference.locator(':scope > details').getAttribute('open'), null);
      await reference.locator(':scope > details > summary').click();
      assert.equal(await reference.getByLabel('Topic', { exact: true }).inputValue(), topics.at(-1).id);
      report.checks.push({ mode, status: 'pass', topics: topics.length, dismissedAndRestored: true, defaultEquationsOpen: mode !== 'public' });
    } catch (error) {
      report.checks.push({ mode, status: 'fail', error: error.stack });
      await page.screenshot({ path: resolve(output, `${mode}-failure.png`) }).catch(() => {});
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
await writeFile(resolve(output, 'physics-reference.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (report.errors.length || report.httpRequests.length || report.checks.some(check => check.status !== 'pass')) process.exitCode = 1;
