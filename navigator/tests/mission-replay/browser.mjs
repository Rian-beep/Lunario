/** Private component browser regression; never starts an app server or changes shared artifacts. */
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../../', import.meta.url));
const outputDir = process.env.REPLAY_BROWSER_OUTPUT ?? '/tmp/lunario-mission-replay-browser';
await mkdir(outputDir, { recursive: true });
const compiled = await build({
  stdin: { resolveDir: root, loader: 'tsx', contents: `
import React from 'react';
import {createRoot} from 'react-dom/client';
import * as T from 'three';
import {PublishedTrajectoryReplay} from './components/mission-trajectories/replay';
import {MissionPathsWorkspace} from './components/mission-trajectories/workspace';
import {MISSION_TRAJECTORIES} from './lib/mission-trajectories-catalog';
import {parseMissionTrajectory,trajectorySceneKm} from './lib/mission-trajectories';
window.datasets=MISSION_TRAJECTORIES;
const root=createRoot(document.getElementById('root'));
window.showReplay=(id,patch={})=>{
 const source=MISSION_TRAJECTORIES.find(d=>d.id===id)??MISSION_TRAJECTORIES[0];
 const data=parseMissionTrajectory({...source,...patch});
 const points=data.samples.map(s=>new T.Vector3(...trajectorySceneKm(s.position)));
 const bounds=new T.Box3().setFromPoints(points),target=bounds.getCenter(new T.Vector3());
 const span=Math.max(bounds.getSize(new T.Vector3()).length(),2);
 window.expected={target:target.toArray(),destination:target.clone().addScaledVector(target.clone().normalize(),span*1.4).add(new T.Vector3(0,span*.3,0)).toArray(),data};
 window.probe=null;window.requestedRevision=(window.requestedRevision??0)+1;
 root.render(<PublishedTrajectoryReplay key={id+JSON.stringify(patch)} data={data}/>);
};
window.captureRenderer=renderer=>{const revision=window.requestedRevision;const original=renderer.render;renderer.render=function(scene,camera){
 const paths=scene.children.filter(o=>o.isLine||o.isPoints);
 const marker=scene.children.find(o=>o.isMesh);
 window.probe={revision,camera:camera.position.toArray(),target:window.controls.target.toArray(),paths:paths.map(o=>({type:o.type,positions:Array.from(o.geometry.attributes.position.array)})),markerVisible:marker?.visible,markerPosition:marker?.position.toArray()};
 window.firstProbes??={};window.firstProbes[revision]??=window.probe;
 return original.call(this,scene,camera);
};};
window.simulations=0;window.closes=0;
window.showWorkspace=siteId=>{window.requestedRevision=(window.requestedRevision??0)+1;root.render(<MissionPathsWorkspace site={{id:siteId,name:siteId}} onSimulation={()=>window.simulations++} onClose={()=>window.closes++}/>);};
window.showReplay(MISSION_TRAJECTORIES[0].id);
` }, bundle: true, write: false, platform: 'browser', jsx: 'automatic', minify: true,
  plugins: [{ name: 'read-only-renderer-probe', setup(build) {
    build.onLoad({ filter: /components\/mission-trajectories\/replay\.tsx$/ }, async args => {
      const source = await readFile(args.path, 'utf8');
      assert.ok(source.includes('element.append(renderer.domElement);'), 'renderer probe seam');
      assert.ok(source.includes('controls.maxPolarAngle=Math.PI;'), 'controls probe seam');
      return { contents: source.replace('element.append(renderer.domElement);', 'element.append(renderer.domElement);window.captureRenderer(renderer);')
        .replace('controls.maxPolarAngle=Math.PI;', 'controls.maxPolarAngle=Math.PI;window.controls=controls;'), loader: 'tsx' };
    });
  } }],
});
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = { browser: browser.version(), scope: 'Actual replay/workspace components in a private Chromium/SwiftShader fixture. NASA globe deliberately unavailable. No shared server/profile, generated app, science qualification or human acceptance.',
  sourceSha256: createHash('sha256').update(await readFile(new URL('../../components/mission-trajectories/replay.tsx', import.meta.url))).digest('hex'), checks: [], errors: [], blockedRequests: [] };
const closeVector = (actual, expected) => actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-8, `${actual} != ${expected}`));
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 1000 }, reducedMotion: 'reduce' });
  page.on('pageerror', error => report.errors.push(error.message));
  await page.route('**/*', route => { report.blockedRequests.push(route.request().url()); return route.abort(); });
  await page.setContent('<!doctype html><style>body{font:16px system-ui}button,input{font:inherit}.button-row{display:flex;flex-wrap:wrap;gap:8px}</style><main id="root"></main>');
  await page.addScriptTag({ content: compiled.outputFiles[0].text });
  const ready = () => page.waitForFunction(() => window.probe?.revision === window.requestedRevision && document.querySelector('canvas'));
  const show = async (id, patch = {}) => { await page.evaluate(({ id, patch }) => window.showReplay(id, patch), { id, patch }); await ready(); };
  const scrub = async seconds => {
    await page.getByRole('slider', { name: 'Historical replay elapsed seconds' }).evaluate((input, value) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(value));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, seconds);
    await page.waitForFunction(value => document.querySelector('[data-replay-seconds]')?.dataset.replaySeconds === String(value), seconds);
  };
  await ready();
  let observed = await page.evaluate(() => ({ probe: window.firstProbes[window.requestedRevision], expected: window.expected }));
  closeVector(observed.probe.camera, observed.expected.destination); closeVector(observed.probe.target, observed.expected.target);
  report.checks.push('Reduced motion arrives at selected path on first render');
  await page.locator('canvas').dispatchEvent('wheel', { deltaY: -150 });
  await page.waitForFunction(before => window.probe.camera.some((v, i) => Math.abs(v - before[i]) > .001), observed.probe.camera);
  report.checks.push('Reduced-motion arrival releases camera for user zoom');

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await show('blue-ghost-1-descent-reconstructed');
  await page.waitForFunction(() => window.probe.camera.every((v, i) => Math.abs(v - window.expected.destination[i]) < 1e-8), undefined, { timeout: 6500 });
  observed = await page.evaluate(() => ({ probe: window.probe, expected: window.expected }));
  closeVector(observed.probe.target, observed.expected.target);
  report.checks.push('Normal camera reaches exact final position and target after 3 seconds');
  await page.emulateMedia({ reducedMotion: 'reduce' });

  const source = await page.evaluate(() => window.datasets[0]);
  const gapSamples = source.samples.filter(s => s.t !== 10);
  await show(source.id, { samples: gapSamples });
  observed = await page.evaluate(() => window.probe);
  assert.deepEqual(observed.paths.map(p => p.type).sort(), ['Line', 'Points']);
  assert.deepEqual(observed.paths.map(p => p.positions.length / 3).sort((a,b) => a-b), [1, gapSamples.length - 1]);
  await scrub(10);
  assert.equal(await page.evaluate(() => window.probe.markerVisible), false);
  assert.match(await page.locator('.published-replay').innerText(), /missing coverage/i);
  await scrub(20); assert.equal(await page.evaluate(() => window.probe.markerVisible), true);
  report.checks.push('Gap is not bridged; isolated sample retained; beacon hidden and missing coverage visible inside gap');

  await show(source.id, { coverage: { ...source.coverage, interpolation: 'none' } });
  observed = await page.evaluate(() => window.probe);
  assert.deepEqual(observed.paths.map(p => p.type), ['Points']);
  assert.equal(observed.paths[0].positions.length / 3, source.samples.length);
  await scrub(5); assert.equal(await page.evaluate(() => window.probe.markerVisible), false);
  await scrub(10); assert.equal(await page.evaluate(() => window.probe.markerVisible), true);
  report.checks.push('Exact-only data draws points with no interpolated beacon');

  for (const name of ['J2000', 'ICRF']) {
    await page.evaluate(({ id, frame }) => window.showReplay(id, { frame }), { id: source.id, frame: { ...source.frame, name, type: 'inertial' } });
    await page.getByRole('alert').filter({ hasText: name }).waitFor();
    assert.equal(await page.locator('canvas').count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Play replay at 1×' }).count(), 0);
  }
  report.checks.push('J2000 and ICRF display an actionable rejection without a Moon-fixed scene or playback controls');

  for (const siteId of ['odysseus', 'blue-ghost-1', 'athena']) {
    await page.evaluate(siteId => window.showWorkspace(siteId), siteId);
    await page.getByRole('button', { name: 'Select reconstructed descent' }).click(); await ready();
    const data = await page.evaluate(siteId => window.datasets.find(d => d.siteId === siteId), siteId);
    assert.equal(await page.getByRole('button', { name: 'Play replay at 1×' }).count(), 1);
    assert.equal(await page.locator('[data-replay-seconds]').getAttribute('data-replay-seconds'), '0');
    assert.deepEqual(await page.evaluate(() => window.probe.paths.map(p => [p.type, p.positions.length / 3])), [['Line', data.samples.length]]);
    await page.getByRole('button', { name: 'Follow position' }).click();
    await page.waitForFunction(() => window.probe.target.every((v,i) => Math.abs(v-window.probe.markerPosition[i]) < 1e-8));
    await page.getByRole('button', { name: 'Release camera' }).click();
    const label = await page.locator('.published-replay').innerText();
    assert.match(label, /Starts .* UTC/); assert.ok(label.includes(data.epoch.utc)); assert.ok(label.includes(data.epoch.calendar)); assert.match(label, /TDB/);
    const startLabel = await page.locator('.published-replay p').first().innerText();
    await page.getByRole('button', { name: 'Play replay at 1×' }).click();
    await page.waitForFunction(() => Number(document.querySelector('[data-replay-seconds]')?.dataset.replaySeconds) >= .2);
    await page.getByRole('button', { name: 'Pause replay' }).click();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const paused = await page.locator('[data-replay-seconds]').getAttribute('data-replay-seconds');
    await page.waitForTimeout(150); assert.equal(await page.locator('[data-replay-seconds]').getAttribute('data-replay-seconds'), paused);
    await scrub(data.coverage.end);
    observed = await page.evaluate(() => window.probe);
    closeVector(observed.markerPosition, [data.samples.at(-1).position[0], data.samples.at(-1).position[2], -data.samples.at(-1).position[1]]);
    assert.equal(await page.locator('.published-replay p').first().innerText(), startLabel);
    await page.locator('.published-replay summary').click();
    assert.ok(await page.locator('.published-replay details').getByText(data.uncertainty, { exact: true }).isVisible());
    if (siteId === 'athena') assert.ok(await page.locator('.published-replay details').getByText(/no EDL states between first contact/).isVisible());
    await page.getByRole('button', { name: 'Play replay at 1×' }).click();
    await page.waitForFunction(() => {const s=Number(document.querySelector('[data-replay-seconds]')?.dataset.replaySeconds);return s>0 && s<1;});
    await page.getByRole('button', { name: 'Restart', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-replay-seconds]')?.dataset.replaySeconds === '0');
    await page.getByRole('button', { name: 'Select educational simulation' }).click();
    assert.equal(await page.locator('.published-replay').count(), 0);
    assert.equal(await page.evaluate(() => window.simulations), ['odysseus', 'blue-ghost-1', 'athena'].indexOf(siteId) + 1);
  }
  report.checks.push('All three CLPS workspaces select paused historical replay, play/pause, follow/release, scrub exact endpoint, preserve static UTC start/source TDB labels and source limitations, replay from end, restart and delegate educational flight separately');
  await page.evaluate(() => window.showWorkspace('blue-ghost-1'));
  await page.getByRole('button', { name: 'Select reconstructed descent' }).click(); await ready();
  await page.evaluate(() => window.showWorkspace('apollo-11'));
  assert.equal(await page.locator('.published-replay').count(), 0);
  await page.getByRole('button', { name: 'Close mission paths' }).click();
  assert.equal(await page.evaluate(() => window.closes), 1);
  report.checks.push('Changing sites discards visible replay; close delegates to host');
  await page.setViewportSize({ width: 390, height: 844 });
  await show('athena-descent-reconstructed');
  const sizes = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  assert.ok(sizes.document <= sizes.viewport, JSON.stringify(sizes));
  await page.screenshot({ path: `${outputDir}/replay-mobile.png`, fullPage: true });
  report.checks.push('390 px component replay has no horizontal page overflow');
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.stack;
  throw error;
} finally {
  await browser.close();
  await writeFile(`${outputDir}/report.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
