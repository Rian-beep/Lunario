import {test} from 'node:test';
import assert from 'node:assert/strict';
import {screeningPoint, screeningSamples, type ScreeningPoint, type ScreeningRequest} from '../../lib/suitability';
import {actualCatalog, catalog, globalTerrain, request} from './fixtures';

test('locked async API and global 15° lattice has exactly 288 unique centres without invented filled support', async () => {
  const fn: (r: ScreeningRequest, p: 'polar' | 'global', options: {signal?: AbortSignal; onProgress?: (completed: number, total: number) => void}) => Promise<ScreeningPoint[]> = screeningSamples;
  const progress: number[][] = [], r = request();
  const points = await fn(r, 'global', {onProgress: (n, total) => progress.push([n, total])});
  assert.equal(points.length, 288); assert.equal(new Set(points.map(p => `${p.lat}|${p.lon}`)).size, 288);
  assert.deepEqual(points[0], screeningPoint(r, -82.5, 7.5)); assert.equal(points.at(-1)!.lat, 82.5); assert.equal(points.at(-1)!.lon, 352.5);
  assert.ok(points.every(p => p.score === null && p.sunFraction === null && p.slopeDeg === null));
  assert.deepEqual(progress, Array.from({length: 289}, (_, i) => [i, 288]));
});

test('real polar sample job retains all 1980 actual cell coordinates and matches point inspection', async () => {
  const c = actualCatalog(), r = {...request(c), startIndex: 11000, endIndex: 11335};
  const points = await screeningSamples(r, 'polar', {});
  assert.equal(points.length, 1980);
  for (let i = 0; i < points.length; i++) {assert.equal(points[i].lat, c.grid.lat[i]); assert.equal(points[i].lon, c.grid.lon[i]);}
  assert.deepEqual(points[600], screeningPoint(r, c.grid.lat[600], c.grid.lon[600]));
});

test('completed global coarse job reports physical metrics and exactly matches synchronous inspection', async () => {
  const r = {...request(), globalTerrain: globalTerrain()};
  const points = await screeningSamples(r, 'global', {});
  assert.equal(points.length, 288);
  assert.ok(points.every(p => p.score !== null && p.score >= 0 && p.score <= 100 && p.slopeDeg === 0));
  for (const i of [0, 44, 144, 287]) assert.deepEqual(points[i], screeningPoint(r, points[i].lat, points[i].lon));
});

test('abort before work or in initial yield publishes nothing and rejects AbortError', async () => {
  const a = new AbortController(); a.abort(); const progress: number[] = [];
  await assert.rejects(screeningSamples(request(), 'global', {signal: a.signal, onProgress: n => progress.push(n)}), {name: 'AbortError'});
  const b = new AbortController(), pending = screeningSamples(request(), 'polar', {signal: b.signal, onProgress: n => progress.push(n)}); b.abort();
  await assert.rejects(pending, {name: 'AbortError'}); assert.deepEqual(progress, []);
});

test('abort at progress stops stale completion; each completed point yields to timer tasks', async () => {
  const c = catalog(); c.grid.lat = new Float64Array([0, 0, 0]); c.grid.lon = new Float64Array([0, 0, 0]); c.grid.mask = new Float64Array(12);
  const a = new AbortController(), progress: number[] = []; let timerRan = false;
  const pending = screeningSamples(request(c), 'polar', {signal: a.signal, onProgress: n => {
    progress.push(n);
    if (n === 1) setTimeout(() => {timerRan = true; a.abort();}, 0);
  }});
  await assert.rejects(pending, {name: 'AbortError'});
  assert.equal(timerRan, true); assert.deepEqual(progress, [0, 1]);
});

test('coarse geometry yields within the first point and cancellation prevents publication or partial-cache reuse', async () => {
  const a = new AbortController(), progress: number[] = [], r = {...request(), globalTerrain: globalTerrain()};
  await assert.rejects(screeningSamples(r, 'global', {signal: a.signal, onProgress: n => {
    progress.push(n); if (n === 0) setTimeout(() => a.abort(), 0);
  }}), {name: 'AbortError'});
  assert.deepEqual(progress, [0]);
  // Restart on the same dataset must give complete geometry, never an aborted partial mask.
  const p = screeningPoint(r, -82.5, 7.5);
  assert.notEqual(p.sunFraction, null); assert.notEqual(p.commsFraction, null);
});

test('long ephemeris stays yield inside a point, not just between completed points', async () => {
  const c = catalog(17521), a = new AbortController(), progress: number[] = [];
  const pending = screeningSamples(request(c), 'polar', {signal: a.signal, onProgress: n => {
    progress.push(n); if (n === 0) setTimeout(() => a.abort(), 0);
  }});
  await assert.rejects(pending, {name: 'AbortError'}); assert.deepEqual(progress, [0]);
});

test('progress errors propagate and cancelled concurrent jobs cannot overwrite a fresh job', async () => {
  await assert.rejects(screeningSamples(request(), 'polar', {onProgress: () => {throw new Error('consumer failed');}}), /consumer failed/);
  const a = new AbortController(), old = screeningSamples(request(), 'polar', {signal: a.signal}); a.abort();
  const latest = screeningSamples({...request(), startIndex: 1, endIndex: 1}, 'polar', {});
  await assert.rejects(old, {name: 'AbortError'});
  assert.deepEqual(await latest, [screeningPoint({...request(), startIndex: 1, endIndex: 1}, 0, 0)]);
});
