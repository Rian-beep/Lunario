import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog, globalTerrain, localTerrain } from '../suitability/fixtures';
import { reweightScreeningPoints, type ScreeningPoint } from '../../lib/suitability';
import { createMapScreenRaster } from '../../lib/map-overlays';
import { DEFAULT_MAP_LAYERS } from '../../components/map-screening/model';
import { ScreeningRunner, recolourScreening, type LayerDependencies, type PhysicalInput, type ScreeningLane } from '../../components/map-screening/runner';

const raw: ScreeningPoint = { lat: 0, lon: 0, sunFraction: .8, longestDarkHours: 1, darkLowerBound: true,
  commsFraction: .6, slopeDeg: 5, score: null, source: 'Synthetic source', spacingM: 40,
  notes: ['Slope scale 10° is a ranking preference, not a landing-footprint safety limit.'] };
const input = (): PhysicalInput => ({ catalog: catalog(), terrain: null, startIndex: 0, endIndex: 2,
  arrayHeightM: 2, antennaHeightM: 2, antennaMaskDeg: 0, projection: 'global' });
function fixture() {
  const calls = { local: 0, global: 0, lane: 0, jobs: 0, locations: [] as { lat: number; lon: number }[] };
  const lane: ScreeningLane = {
    reweightScreeningPoints,
    screeningSamples: async (request, _projection, options) => {
      calls.jobs++;
      assert.deepEqual(request.weights, { sun: 1, dark: 1, slope: 1, comms: 1 });
      assert.equal(request.slopeScaleDeg, 10);
      for (let n = 0; n <= 1000; n++) options?.onProgress?.(n, 1000);
      return [raw];
    },
    screeningLocations: async (_request, locations, options) => {
      calls.jobs++; calls.locations = [...locations]; options?.onProgress?.(locations.length, locations.length); return [raw];
    },
  };
  const dependencies: LayerDependencies = {
    screening: async () => { calls.lane++; return lane; },
    terrain: async () => { calls.local++; return localTerrain(); },
    globalTerrain: async () => { calls.global++; return globalTerrain(); },
  };
  return { calls, lane, dependencies, runner: new ScreeningRunner(dependencies) };
}

test('constructing a runner performs no imports, loads or jobs; first demand loads both DEMs', async () => {
  const f = fixture();
  assert.deepEqual([f.calls.lane, f.calls.local, f.calls.global, f.calls.jobs], [0, 0, 0, 0]);
  const progress: number[] = [];
  await f.runner.run(input(), new AbortController().signal, fraction => progress.push(fraction));
  assert.deepEqual([f.calls.lane, f.calls.local, f.calls.global, f.calls.jobs], [1, 1, 1, 1]);
  assert.deepEqual(progress, [0, 1]);
});

test('weight, scale, metric and opacity edits reuse physical data and shared reweight semantics', async () => {
  const f = fixture(), physical = input(), original = JSON.stringify(raw);
  const result = await f.runner.run(physical, new AbortController().signal, () => {});
  const sun = recolourScreening(result, { weights: { sun: 1, dark: 0, slope: 0, comms: 0 }, slopeScaleDeg: 10 });
  assert.equal(sun[0].score, 80);
  const slope = recolourScreening(result, { weights: { sun: 0, dark: 0, slope: 1, comms: 0 }, slopeScaleDeg: 20 });
  assert.equal(slope[0].score, 75); assert.match(slope[0].notes[0], /scale 20°/);
  for (const metric of ['combined', 'sun', 'dark', 'slope', 'comms'] as const) {
    for (const opacity of [0, .55, 1]) {
      assert.equal(createMapScreenRaster({ catalog: physical.catalog, points: slope, projection: 'global', metric, opacity }), null);
      assert.equal(await f.runner.run({ ...physical }, new AbortController().signal, () => {}), result);
    }
  }
  assert.equal(f.calls.jobs, 1); assert.equal(f.calls.local, 1); assert.equal(JSON.stringify(raw), original);
  assert.equal(slope[0].longestDarkHours, 1); assert.equal(slope[0].darkLowerBound, true);
  assert.throws(() => recolourScreening(result, { ...DEFAULT_MAP_LAYERS, weights: { sun: 0, dark: 0, slope: 0, comms: 0 } }), /positive total/);
  const unknown = { ...result, points: [{ ...raw, slopeDeg: null }] };
  assert.equal(recolourScreening(unknown, DEFAULT_MAP_LAYERS)[0].score, null);
  assert.equal(recolourScreening(unknown, { weights: { sun: 1, dark: 0, slope: 0, comms: 0 }, slopeScaleDeg: 10 })[0].score, 80);
});

test('all physical inputs invalidate the screen; completed result cache is bounded to two', async () => {
  const f = fixture(), base = input(), signal = new AbortController().signal;
  const first = await f.runner.run(base, signal, () => {});
  const changes: Partial<PhysicalInput>[] = [
    { startIndex: 1 }, { endIndex: 1 }, { arrayHeightM: 10 }, { antennaHeightM: 10 }, { antennaMaskDeg: 3 },
    { projection: 'polar' }, { terrain: localTerrain() }, { catalog: catalog() },
    { viewport: { west: 170, east: 190, south: -20, north: 20, cols: 12, rows: 8 } },
  ];
  for (const patch of changes) {
    assert.notEqual(await f.runner.run({ ...base, ...patch }, signal, () => {}), first);
    assert.ok(f.runner.cacheSize <= 2);
  }
  assert.equal(f.calls.jobs, 1 + changes.length);
  await f.runner.run(base, signal, () => {});
  assert.equal(f.calls.jobs, 2 + changes.length);
  f.runner.clear(); assert.equal(f.runner.cacheSize, 0);
});

test('viewport refinement is bounded, debuggable and respects DEM spacing; supplied DEMs are reused', async () => {
  const f = fixture(), physical = input();
  physical.terrain = localTerrain(); physical.catalog.globalTerrain = globalTerrain();
  physical.viewport = { west: 179, east: 181, south: -1, north: 1, cols: 12, rows: 8 };
  const result = await f.runner.run(physical, new AbortController().signal, () => {});
  assert.equal(f.calls.global, 0); assert.equal(f.calls.local, 0);
  assert.equal(f.calls.locations.length, 4);
  assert.deepEqual(result.viewport, { ...physical.viewport, cols: 2, rows: 2 });
  assert.ok(f.calls.locations.every(p => p.lon >= 179 && p.lon <= 181));
  assert.match(result.sampling, /Minimum DEM step/);
  await assert.rejects(f.runner.run({ ...physical, viewport: { ...physical.viewport, cols: 257 } }, new AbortController().signal, () => {}), RangeError);
  assert.equal(f.calls.jobs, 1);
});

test('DEM failures stay explicit while prepared/unknown metrics can still publish; retry can reload', async () => {
  const f = fixture(); let recovered = false;
  f.dependencies.terrain = async () => { if (!recovered) throw Error('local missing'); return localTerrain(); };
  f.dependencies.globalTerrain = async () => { if (!recovered) throw Error('global missing'); return globalTerrain(); };
  const physical = { ...input(), viewport: { west: 0, east: 20, south: -10, north: 10, cols: 12, rows: 8 } };
  const partial = await f.runner.run(physical, new AbortController().signal, () => {});
  assert.equal(partial.request.terrain, null); assert.equal(partial.request.globalTerrain, null);
  assert.equal(partial.warnings.length, 3); assert.match(partial.warnings.join(' '), /local missing.*global missing.*15° lattice/);
  assert.equal(partial.viewport, undefined); assert.equal(partial.points[0], raw);
  recovered = true; f.runner.clear();
  const complete = await f.runner.run(physical, new AbortController().signal, () => {});
  assert.deepEqual(complete.warnings, []); assert.ok(complete.request.globalTerrain); assert.ok(complete.viewport);
});

test('cancelled imports and sampling never publish or populate the result cache', async () => {
  const f = fixture(), physical = input(), controller = new AbortController();
  let release!: (value: ScreeningLane) => void;
  f.dependencies.screening = () => new Promise(resolve => { release = resolve; });
  const progress: number[] = [];
  const pending = f.runner.run(physical, controller.signal, n => progress.push(n));
  controller.abort(); release(f.lane);
  await assert.rejects(pending, { name: 'AbortError' });
  assert.deepEqual(progress, []); assert.equal(f.calls.jobs, 0); assert.equal(f.runner.cacheSize, 0);
  const g = fixture(), second = new AbortController();
  await assert.rejects(g.runner.run(physical, second.signal, () => second.abort()), { name: 'AbortError' });
  assert.equal(g.runner.cacheSize, 0);
  const before = new AbortController(); before.abort();
  await assert.rejects(g.runner.run(physical, before.signal, () => {}), { name: 'AbortError' });
  const result = await g.runner.run(physical, new AbortController().signal, () => {});
  assert.ok(result.points.length); assert.equal(g.runner.cacheSize, 1);
  const cached = new AbortController();
  await assert.rejects(g.runner.run(physical, cached.signal, () => cached.abort()), { name: 'AbortError' });
});

test('numerical lane failures propagate instead of becoming fabricated empty screens', async () => {
  const f = fixture();
  f.dependencies.screening = async () => { throw Error('module unavailable'); };
  await assert.rejects(f.runner.run(input(), new AbortController().signal, () => {}), /module unavailable/);
  assert.equal(f.runner.cacheSize, 0);
});

test('viewport jobs debounce for 250 ms, cancelled views do no work, and only the latest view publishes', async () => {
  const f = fixture(), base = input();
  const events: string[] = [];
  let ready!: () => void;
  const completed = new Promise<void>(resolve => { ready = resolve; });
  const callbacks = (name: string) => ({ onStart: () => events.push(`${name}:start`), onProgress: () => {},
    onResult: () => { events.push(`${name}:result`); ready(); }, onError: (error: unknown) => { throw error; } });
  const viewport = { west: 170, east: 190, south: -20, north: 20, cols: 12, rows: 8 };
  const cancelOld = f.runner.schedule({ ...base, viewport }, callbacks('old'));
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(f.calls.lane, 0); assert.deepEqual(events, []);
  cancelOld();
  const cancelNew = f.runner.schedule({ ...base, viewport: { ...viewport, west: 171 } }, callbacks('new'));
  try {
    await completed;
    assert.deepEqual(events, ['new:start', 'new:result']); assert.equal(f.calls.jobs, 1);
  } finally { cancelNew(); }
});

test('effect cleanup suppresses publication and errors after a scheduled job is already loading', async () => {
  const f = fixture(); let release!: (value: ScreeningLane) => void, began!: () => void;
  const started = new Promise<void>(resolve => { began = resolve; });
  const loaded = new Promise<ScreeningLane>(resolve => { release = resolve; });
  f.dependencies.screening = () => loaded;
  const events: string[] = [];
  const cancel = f.runner.schedule(input(), { onStart: began, onProgress: () => events.push('progress'),
    onResult: () => events.push('result'), onError: () => events.push('error') });
  await started; cancel(); release(f.lane);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.deepEqual(events, []); assert.equal(f.runner.cacheSize, 0); assert.equal(f.calls.jobs, 0);
});

test('real numerical lane preserves supported solar/contact factors and unknown slope after DEM failure', async () => {
  const runner = new ScreeningRunner({ screening: () => import('../../lib/suitability'),
    terrain: async () => { throw Error('no local DEM'); }, globalTerrain: async () => { throw Error('no global DEM'); } });
  const result = await runner.run({ ...input(), projection: 'polar' }, new AbortController().signal, () => {});
  assert.equal(result.points.length, 1);
  assert.notEqual(result.points[0].sunFraction, null); assert.notEqual(result.points[0].commsFraction, null);
  assert.equal(result.points[0].slopeDeg, null); assert.equal(result.points[0].score, null);
  assert.match(result.points[0].source, /Prepared named LOLA horizon/);
  assert.equal(result.warnings.length, 2);
  const reweighted = recolourScreening(result, { weights: { sun: 1, dark: 0, slope: 0, comms: 0 }, slopeScaleDeg: 10 });
  assert.equal(reweighted[0].score, result.points[0].sunFraction! * 100);
  assert.equal(reweighted[0].slopeDeg, null);
});
