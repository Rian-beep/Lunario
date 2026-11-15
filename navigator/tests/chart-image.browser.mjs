// Isolated file:// browser checks; no app server, shared profile, or generated app output.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

test('chart PNGs in an isolated offline browser', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'lunario-chart-images-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const executablePath = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => p && existsSync(p));
  assert.ok(executablePath, 'Set CHROME_PATH to a local Chromium browser to run PNG checks.');
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 900, height: 1000 }, deviceScaleFactor: 1, acceptDownloads: true, offline: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const bundled = await build({
    stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {HorizonGraph} from './components/workbench/science-charts';
      import {ResponsePlot} from './components/audience/response-plot';
      import {HorizonPanorama, ElevationChart, ObliqueSketch} from './components/sky-views';
      import * as images from './lib/chart-image';
      const a=(values)=>new Float64Array(values);
      const series={index0:10,sunAz:a([5,15,25]),sunEl:a([2,NaN,4]),earthAz:a([60,70,80]),earthEl:a([3,4,5]),sunHorizon:a([1,NaN,2]),earthHorizon:a([2,3,4]),sunRadius:a([.27,.27,.27]),earthRadius:a([1,1,1])};
      const mask=a([1,2,NaN,3]);
      const terrain={mask,stepDeg:90,heightM:2,distanceKm:null,cellLat:null,cellLon:null,exact:false};
      window.chartImages=images;
      createRoot(document.getElementById('app')).render(<>
        <div id="science"><HorizonGraph series={series} terrain={terrain} cursor={0}/></div>
        <div id="response"><ResponsePlot title="Test response" points={[{x:0,label:'0',terrain:1,sphere:2},{x:1,label:'1',terrain:null,sphere:3},{x:2,label:'2',terrain:4,sphere:5}]} xLabel="Load (W)" yLabel="Battery (Wh)"/></div>
        <div id="panorama"><HorizonPanorama series={series} cursor={0} mask={mask} stepDeg={90}/></div>
        <div id="elevation"><ElevationChart series={series} cursor={0} onCursor={()=>{}}/></div>
        <div id="oblique"><ObliqueSketch series={series} cursor={0} mask={mask} stepDeg={90}/></div>
      </>);
    ` },
    bundle: true, write: false, outfile: join(directory, 'fixture.js'), jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
  });
  const js = bundled.outputFiles.find((file) => file.path.endsWith('.js')).text;
  const css = bundled.outputFiles.find((file) => file.path.endsWith('.css'))?.text ?? '';
  const globalCss = (await readFile('app/globals.css', 'utf8')).replace(/^@(?:import|source).*$/gm, '');
  const theme = await readFile('app/mission-theme.css', 'utf8');
  await writeFile(join(directory, 'fixture.html'), `<!doctype html><meta charset="utf-8"><style>${globalCss}\n${theme}\n${css}\nbody{margin:24px}#app{max-width:760px}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}</style><div id="app"></div><script>${js.replace(/<\/script/gi, '<\\/script')}</script>`);
  await page.goto(pathToFileURL(join(directory, 'fixture.html')).href);
  await page.waitForFunction(() => document.querySelectorAll('.chart-image-actions').length === 5 && document.querySelector('#panorama canvas')?.width > 0);

  await t.test('white plot, axis and legend surfaces retain series paint and gaps under the real theme', async () => {
    const result = await page.evaluate(() => {
      const figure = document.querySelector('#science figure');
      const svg = figure.querySelector('.plot-area svg');
      const paths = [...svg.querySelectorAll('path')].filter((p) => p.getAttribute('stroke'));
      const response = document.querySelector('#response svg path[stroke="#515c35"]');
      return {
        surfaces: [figure, svg, figure.querySelector('.chart-legend'), figure.querySelector('.chart-axis-heading'), document.querySelector('#response svg')].map((el) => getComputedStyle(el).backgroundColor),
        labels: [...svg.querySelectorAll('text')].map((el) => getComputedStyle(el).fill),
        sun: paths.find((p) => p.getAttribute('stroke') === '#ae7317')?.style.stroke,
        earth: paths.find((p) => p.getAttribute('stroke') === '#376c82')?.getAttribute('stroke-dasharray'),
        response: response.getAttribute('d'),
      };
    });
    assert.ok(result.surfaces.every((color) => color === 'rgb(255, 255, 255)'), JSON.stringify(result));
    assert.ok(result.labels.every((color) => color === 'rgb(28, 25, 21)'));
    assert.equal(result.sun, 'rgb(174, 115, 23)');
    assert.equal(result.earth, '8 3');
    assert.equal((result.response.match(/M/g) ?? []).length, 2);
  });

  await t.test('safe SVG serialization removes active content and external references, preserves clipping and metadata', async () => {
    const result = await page.evaluate(() => {
      const svg = document.querySelector('#science .plot-area svg').cloneNode(true);
      // Detached hostile additions never execute or load in the fixture.
      svg.insertAdjacentHTML('beforeend', '<script>alert(1)</script><foreignObject><button>Copy chart image</button></foreignObject><image href="https://invalid.test/x.png"/><path d="M0 0L1 1" onclick="alert(1)" stroke="url(https://invalid.test/x.svg)"/>');
      document.querySelector('#science').appendChild(svg);
      const result = window.chartImages.serializeChartImage(svg, {
        title: '<Research & "review">', xAxis: 'Azimuth (°)', yAxis: 'Elevation (°)',
        legend: [{ label: 'Sun centre', color: '#ae7317', shape: 'sun' }, { label: 'Earth centre', color: '#376c82', dash: '8 3', shape: 'earth' }],
        notes: ['JPL Horizons / LOLA; terrain unknowns leave gaps.'],
      });
      svg.remove();
      return result;
    });
    assert.doesNotMatch(result.svg, /<script|foreignObject|<button|onclick|https:\/\/invalid/);
    assert.match(result.svg, /clip-path="url\(#/);
    assert.match(result.svg, /&lt;Research &amp; &quot;review&quot;&gt;/);
    assert.match(result.svg, /JPL Horizons \/ LOLA/);
    assert.match(result.svg, /Earth centre/);
    assert.equal(result.pixelWidth, result.width * 2);
    assert.equal(result.pixelHeight, result.height * 2);
  });

  await t.test('PNG download works offline for both SVG families and all sky canvases, at 2× with white opaque corners', async () => {
    for (const id of ['science', 'response', 'panorama', 'elevation', 'oblique']) {
      const downloaded = page.waitForEvent('download');
      await page.locator(`#${id}`).getByRole('button', { name: /Download PNG/ }).click();
      const download = await downloaded;
      const file = join(directory, `${id}.png`);
      await download.saveAs(file);
      const metadata = await sharp(file).metadata();
      assert.equal(metadata.format, 'png');
      assert.ok(metadata.width >= 960 && metadata.height > 590, `${id}: meaningful export dimensions`);
      assert.equal(metadata.width % 2, 0);
      const pixel = await sharp(file).extract({ left: 0, top: 0, width: 1, height: 1 }).ensureAlpha().raw().toBuffer();
      assert.deepEqual([...pixel], [255, 255, 255, 255]);
      await page.locator(`#${id} [role="status"]`).filter({ hasText: 'PNG download started.' }).waitFor();
      if (id === 'science') await download.saveAs('/tmp/lunario-chart-image-science.png');
      if (id === 'panorama') await download.saveAs('/tmp/lunario-chart-image-panorama.png');
    }
  });

  await t.test('capability failure and denied clipboard write never announce success; successful write contains PNG', async () => {
    await page.evaluate(() => Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false }));
    const science = page.locator('#science');
    await science.getByRole('button', { name: /Copy chart image/ }).click();
    await science.getByRole('status').filter({ hasText: /Copy failed:.*secure.*Download PNG/ }).waitFor();
    await page.evaluate(() => {
      Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
      window.ClipboardItem = class { static supports = () => true; constructor(data) { this.data = data; } };
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write: async () => { throw new DOMException('Denied', 'NotAllowedError'); } } });
    });
    await science.getByRole('button', { name: /Copy chart image/ }).click();
    await science.getByRole('status').filter({ hasText: /Copy failed:.*denied.*Download PNG/ }).waitFor();
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write: async (items) => {
        const blob = await items[0].data['image/png'];
        window.copiedPng = { type: blob.type, size: blob.size };
      } } });
    });
    await science.getByRole('button', { name: /Copy chart image/ }).click();
    await science.getByRole('status').filter({ hasText: 'Chart image copied.' }).waitFor();
    const copied = await page.evaluate(() => window.copiedPng);
    assert.equal(copied.type, 'image/png');
    assert.ok(copied.size > 1000);
  });

  await t.test('resize redraws canvas backing stores at 2× without stretching', async () => {
    await page.setViewportSize({ width: 420, height: 1000 });
    await page.waitForFunction(() => {
      const canvas = document.querySelector('#panorama canvas');
      return canvas.width === Math.floor(canvas.parentElement.clientWidth * 2);
    });
    for (const id of ['panorama', 'elevation', 'oblique']) {
      const size = await page.locator(`#${id} canvas`).evaluate((canvas) => ({ width: canvas.width, height: canvas.height, displayWidth: parseFloat(canvas.style.width), displayHeight: parseFloat(canvas.style.height) }));
      assert.equal(size.width, size.displayWidth * 2);
      assert.equal(size.height, size.displayHeight * 2);
    }
    await page.screenshot({ path: '/tmp/lunario-chart-image-evidence.png', fullPage: true });
  });
  assert.deepEqual(errors, []);
});
