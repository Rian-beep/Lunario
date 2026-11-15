import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSeries, projectedToLatLon, summarize} from '../../lib/astro';
import {terrainForGlobal} from '../../lib/global-horizon';
import {screeningPoint} from '../../lib/suitability';
import {coarseHorizon, regionalSlope} from '../../lib/suitability/geometry';
import {actualCatalog, globalTerrain, localTerrain, request} from './fixtures';

function drain<T>(work: Generator<void, T>): T {let next = work.next(); while (!next.done) next = work.next(); return next.value;}
const near = (value: number | null, expected: number, tolerance = 1e-9) => {assert.notEqual(value, null); assert.ok(Math.abs(value! - expected) < tolerance, `${value} != ${expected}`);};

test('regional plane slope derives measured rectangular spacing, corrects polar projection and ignores named slope metadata', () => {
  const d = localTerrain(.1, .2), slope = regionalSlope(d, null, -90, 0);
  near(slope.slopeDeg, Math.atan(Math.hypot(.1, .2)) * 180 / Math.PI); near(slope.spacingM, 40);
  assert.match(slope.source, /synthetic:plane/); assert.match(slope.notes.join(' '), /20 × 40 m/);
  const p = projectedToLatLon(20, 40), at = regionalSlope(d, null, p.lat, p.lon);
  const scale = 2 / (1 - Math.sin(p.lat * Math.PI / 180));
  near(at.slopeDeg, Math.atan(Math.hypot(.1, .2) * scale) * 180 / Math.PI);
  near(at.spacingM, 40 / scale);
  assert.equal(screeningPoint(request(), 0, 0).slopeDeg, null);
});

test('slope ranking uses its declared scale with saturation and monotonic preference changes', () => {
  const r = {...request(), terrain: localTerrain(.1, 0), weights: {sun: 0, dark: 0, slope: 1, comms: 0}};
  const slope = Math.atan(.1) * 180 / Math.PI;
  near(screeningPoint(r, -90, 0).score, 100 * (1 - slope / 10));
  near(screeningPoint({...r, slopeScaleDeg: 20}, -90, 0).score, 100 * (1 - slope / 20));
  assert.equal(screeningPoint({...r, slopeScaleDeg: 1}, -90, 0).score, 0);
});

test('missing fine stencil uses explicitly coarse global elevations, never imagery or the overview', () => {
  const local = localTerrain(.1, 0), global = globalTerrain();
  local.patches[0].heights.fill(null);
  const missing = regionalSlope(local, null, -90, 0); assert.equal(missing.slopeDeg, null); assert.equal(missing.spacingM, null);
  const fallback = regionalSlope(local, global, -90, 0);
  assert.equal(fallback.slopeDeg, 0); assert.equal(fallback.spacingM, global.outputSpacingM); assert.match(fallback.source, /Coarse numerical LOLA/);
  local.patches = []; local.overview.heights.fill(0);
  assert.equal(regionalSlope(local, null, -90, 0).slopeDeg, null);
  assert.equal(regionalSlope(local, global, -90, 0).spacingM, global.outputSpacingM);
  global.samples.fill(global.nodata); global.northPoleM = null; global.southPoleM = null;
  assert.equal(regionalSlope(null, global, 0, 0).slopeDeg, null);
});

test('coarse global slope matches independent north-south ramp, and is stable at poles and seam', () => {
  const R = 1737400, stepDeg = 360 / 512, gradient = 100 / (R * stepDeg * Math.PI / 180);
  // Exactly representable 100 m per row avoids introducing quantization error into the analytic oracle.
  const global = globalTerrain(lat => 100 * lat / stepDeg);
  near(regionalSlope(null, global, 0, 0).slopeDeg, Math.atan(gradient) * 180 / Math.PI);
  const flat = globalTerrain();
  for (const lat of [-90, 90]) for (const lon of [0, 17, 180, 359]) assert.equal(regionalSlope(null, flat, lat, lon).slopeDeg, 0);
  assert.deepEqual(regionalSlope(null, global, 0, -180), regionalSlope(null, global, 0, 180));
});

test('cooperative coarse horizons retain existing numerical horizon policy, including poles, seam, bump and missing rays', () => {
  const data = globalTerrain((lat, lon) => Math.abs(lat) < 1 && lon > 2 && lon < 4 ? 2000 : 0);
  for (const [lat, lon, height] of [[0, 0, 2], [90, 17, 10], [-90, 27, 0], [10, 180, 2]]) {
    const actual = drain(coarseHorizon(data, lat, lon, height))!, reference = terrainForGlobal(data, lat, lon, height);
    assert.equal(actual.mask.length, 180);
    for (let i = 0; i < actual.mask.length; i++) near(actual.mask[i], reference.mask[i], 1e-10);
  }
  const missing = globalTerrain(); missing.samples.fill(missing.nodata); missing.northPoleM = null; missing.southPoleM = null;
  assert.equal(drain(coarseHorizon(missing, 0, 0, 2)), null);
  assert.equal(drain(coarseHorizon(data, 0, 0, 10001)), null);
  assert.equal(drain(coarseHorizon(data, 0, 0, -1)), null);
});

test('coarse horizon geometry is reused across date/weight changes, with an LRU bound of 576 masks', () => {
  const d = globalTerrain();
  // A sparse supported origin leaves unknown remote rays; these are valid cacheable partial masks.
  d.samples.fill(d.nodata);
  const x = 40, y = 120;
  for (let row = y; row <= y + 1; row++) for (let col = x; col <= x + 1; col++) d.samples[row * d.width + col] = 0;
  const lat = 90 - (y + .5) * d.angularStepDeg, lon = (x + .5) * d.angularStepDeg;
  for (let height = 0; height < 577; height++) drain(coarseHorizon(d, lat, lon, height));
  assert.equal(coarseHorizon(d, lat, lon, 576).next().done, true, 'warm geometry returns without ray work');
  assert.equal(coarseHorizon(d, lat, lon, 0).next().done, false, 'oldest geometry was evicted');
});

test('real prepared polar cell uses its own mask and coordinates exactly; nearby off-cell locations remain unknown without coarse input', () => {
  const c = actualCatalog(), i = 777, lat = c.grid.lat[i], lon = c.grid.lon[i];
  const r = {...request(c), startIndex: 5000, endIndex: 5335, weights: {sun: 1, dark: 1, slope: 0, comms: 1}};
  const p = screeningPoint(r, lat, lon), terrain = {heightM: c.grid.heightM, stepDeg: c.grid.stepDeg, mask: c.grid.mask.subarray(i * c.grid.nAz, (i + 1) * c.grid.nAz), distanceKm: 0, cellLat: lat, cellLon: lon, exact: true};
  const summary = summarize(buildSeries(c, lat, lon, terrain, r.startIndex, r.endIndex), c.meta.stepHours, {antennaMaskDeg: 0});
  assert.equal(p.lat, lat); assert.equal(p.lon, lon); assert.match(p.source, /Prepared polar LOLA cell 777/);
  near(p.sunFraction, summary.exposureTerrain); near(p.longestDarkHours, summary.longestDarkTerrain); near(p.commsFraction, summary.earthTerrain);
  const nearby = screeningPoint(r, lat + 1e-9, lon); assert.equal(nearby.sunFraction, null); assert.equal(nearby.score, null);
  const unsupportedHeight = screeningPoint({...r, arrayHeightM: 10}, lat, lon);
  assert.equal(unsupportedHeight.sunFraction, null); assert.equal(unsupportedHeight.commsFraction, p.commsFraction);
  assert.deepEqual(screeningPoint(r, lat, lon - 360), p);
});

test('explicit coarse fallback at an arbitrary coordinate is labelled and keeps height/coverage unknowns', () => {
  const r = {...request(), globalTerrain: globalTerrain()};
  const p = screeningPoint(r, 10, 40);
  assert.notEqual(p.sunFraction, null); assert.notEqual(p.commsFraction, null); assert.notEqual(p.score, null);
  assert.match(p.source, /Coarse global LOLA/); assert.ok(p.spacingM! > 4200); assert.match(p.notes.join(' '), /not a landing-footprint safety limit/);
  const height = screeningPoint({...r, arrayHeightM: 10001}, 10, 40);
  assert.equal(height.sunFraction, null); assert.notEqual(height.commsFraction, null);
  r.globalTerrain.samples.fill(r.globalTerrain.nodata); r.globalTerrain.northPoleM = null; r.globalTerrain.southPoleM = null;
  // New object is a distinct dataset/cache identity; loaded inputs are immutable by contract.
  const nodata = screeningPoint({...r, globalTerrain: {...r.globalTerrain}}, 10, 40);
  assert.equal(nodata.sunFraction, null); assert.equal(nodata.commsFraction, null); assert.equal(nodata.score, null);
});

test('changing dates and weights reuses only geometry, while physical metrics are recomputed', () => {
  const data = globalTerrain(), samples = data.samples;
  let reads = 0;
  Object.defineProperty(data, 'samples', {get: () => {reads++; return samples;}});
  const r = {...request(), globalTerrain: data, weights: {sun: 1, dark: 0, slope: 0, comms: 0}};
  screeningPoint(r, 5, 30);
  assert.ok(reads > 10000);
  reads = 0;
  r.catalog.subsolarLon[1] = 180;
  const next = screeningPoint({...r, startIndex: 1, endIndex: 1}, 5, 30);
  assert.equal(next.sunFraction, 0); assert.equal(next.score, 0);
  assert.ok(reads < 100, `cache hit should only sample the small slope stencil: ${reads} reads`);
});
