import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSeries, earthAzEl, summarize, terrainForSite} from '../../lib/astro';
import {screeningPoint, DEFAULT_SCREENING_WEIGHTS, DEFAULT_SLOPE_SCALE_DEG, type ScreeningPoint, type ScreeningRequest} from '../../lib/suitability';
import {actualCatalog, catalog, globalTerrain, request} from './fixtures';

const near = (a: number | null, b: number, epsilon = 1e-10) => {assert.notEqual(a, null); assert.ok(Math.abs(a! - b) <= epsilon, `${a} != ${b}`);};

test('locked function API, explicit defaults and independently calculated weighted normalization', () => {
  const fn: (r: ScreeningRequest, lat: number, lon: number) => ScreeningPoint = screeningPoint;
  assert.deepEqual(DEFAULT_SCREENING_WEIGHTS, {sun: 1, dark: 1, slope: 1, comms: 1}); assert.equal(DEFAULT_SLOPE_SCALE_DEG, 10);
  const c = catalog(); c.subsolarLon.set([180, 90, 0, 0]); c.subearthLon.set([0, 180, 0, 0]);
  const r = {...request(c), globalTerrain: globalTerrain(), weights: {sun: 2, dark: 3, slope: 5, comms: 7}};
  const point = fn(r, 0, 0);
  near(point.sunFraction, .5); near(point.longestDarkHours, 1); near(point.commsFraction, 2 / 3); near(point.slopeDeg, 0);
  near(point.score, 100 * (2 * .5 + 3 * (1 - 1 / 3) + 5 + 7 * 2 / 3) / 17);
  near(screeningPoint({...r, weights: {sun: 2e250, dark: 3e250, slope: 5e250, comms: 7e250}}, 0, 0).score, point.score!);
  assert.equal(point.darkLowerBound, true); assert.ok(point.notes.some(s => s.includes('ranking preference')));
  assert.ok(point.notes.some(s => s.includes('not probability')));
});

test('disk exposure uses fractional solar disk; any visible limb ends darkness', () => {
  const c = catalog(); c.subsolarLon.fill(90);
  const p = screeningPoint(request(c), 0, 0);
  near(p.sunFraction, .5); assert.equal(p.longestDarkHours, 0); assert.equal(p.darkLowerBound, false);
});

test('observed darkness crosses 64-sample chunks and preserves complete versus censored runs', () => {
  const c = catalog(202); c.subsolarLon.fill(180, 50, 150);
  const p = screeningPoint(request(c), 0, 0);
  assert.equal(p.longestDarkHours, 100); assert.equal(p.darkLowerBound, false);
  assert.equal(p.longestDarkHours, summarize(buildSeries(c, 0, 0, terrainForSite(c.sites[0], 2), 0, 200), 1).longestDarkTerrain);
  c.subsolarLon.fill(180);
  const dark = screeningPoint(request(c), 0, 0);
  assert.equal(dark.longestDarkHours, 201); assert.equal(dark.darkLowerBound, true); assert.equal(dark.sunFraction, 0);
  c.subsolarLon.fill(0); c.subsolarLon.fill(180, 0, 2); c.subsolarLon.fill(180, 10, 12);
  assert.equal(screeningPoint(request(c), 0, 0).darkLowerBound, true);
  c.subsolarLon.fill(0, 0, 2); c.subsolarLon.fill(180, 199, 201);
  assert.equal(screeningPoint(request(c), 0, 0).darkLowerBound, true);
});

test('absolute antenna zero cutoff is active over a depressed terrain horizon and equality fails', () => {
  const c = catalog(); c.sites[0].horizons[0].mask.fill(-10); c.subearthLon.fill(90);
  const r = request(c), p = screeningPoint(r, 0, 0);
  assert.equal(p.commsFraction, 0);
  assert.equal(screeningPoint({...r, antennaMaskDeg: -10}, 0, 0).commsFraction, 1);
  c.subearthLon.fill(80);
  const [, el] = earthAzEl(0, 0, 0, 80, 384400);
  assert.equal(screeningPoint({...r, antennaMaskDeg: el}, 0, 0).commsFraction, 0);
  assert.equal(screeningPoint({...r, antennaMaskDeg: el - .001}, 0, 0).commsFraction, 1);
  assert.equal(screeningPoint({...r, antennaMaskDeg: NaN}, 0, 0).commsFraction, null);
});

test('independent array and antenna heights use exact masks without nearest-height borrowing', () => {
  const c = catalog(); c.sites[0].horizons.push({heightM: 10, stepDeg: 90, mask: new Float64Array(4).fill(100)});
  const r = {...request(c), antennaHeightM: 10};
  const p = screeningPoint(r, 0, 0); assert.equal(p.sunFraction, 1); assert.equal(p.commsFraction, 0);
  const swapped = screeningPoint({...r, arrayHeightM: 10, antennaHeightM: 2}, 0, 0);
  assert.equal(swapped.sunFraction, 0); assert.equal(swapped.commsFraction, 1);
  const unsupported = screeningPoint({...r, arrayHeightM: 3}, 0, 0);
  assert.equal(unsupported.sunFraction, null); assert.equal(unsupported.longestDarkHours, null); assert.equal(unsupported.commsFraction, 0);
  for (const arrayHeightM of [-1, NaN, Infinity]) {
    const invalid = screeningPoint({...r, arrayHeightM}, 0, 0);
    assert.equal(invalid.sunFraction, null); assert.equal(invalid.commsFraction, 0);
  }
});

test('partial rays and missing epochs remain unknown, independent solar and Earth support stay independent', () => {
  const c = catalog(); c.subsolarLon.fill(90); c.sites[0].horizons[0].mask[0] = NaN;
  const p = screeningPoint(request(c), 0, 0);
  near(p.sunFraction, .5); assert.equal(p.longestDarkHours, 0); assert.equal(p.commsFraction, null); assert.equal(p.score, null);
  c.sites[0].horizons[0].mask[0] = 0; c.sites[0].horizons[0].mask[1] = NaN;
  const missingSun = screeningPoint(request(c), 0, 0);
  assert.equal(missingSun.sunFraction, null); assert.equal(missingSun.longestDarkHours, null); assert.equal(missingSun.commsFraction, 1);
  c.sites[0].horizons[0].mask.fill(0); c.sunRadiusDeg[1] = NaN;
  assert.equal(screeningPoint(request(c), 0, 0).sunFraction, null);
  assert.equal(screeningPoint(request(c), 0, 0).longestDarkHours, null);
});

test('unknown positive-weight components invalidate score; zero weight does not invent measurements', () => {
  const r = request(), p = screeningPoint(r, 0, 0);
  assert.equal(p.slopeDeg, null); assert.equal(p.spacingM, null); assert.equal(p.score, null);
  const noSlope = screeningPoint({...r, weights: {sun: 1, dark: 1, slope: 0, comms: 1}}, 0, 0);
  assert.equal(noSlope.slopeDeg, null); assert.equal(noSlope.score, 100);
  const offsite = screeningPoint({...r, weights: {sun: 0, dark: 0, slope: 0, comms: 1}}, 1, 0);
  assert.equal(offsite.commsFraction, null); assert.equal(offsite.score, null);
});

test('rank weights are scale invariant, robust to large finite inputs and reject invalid settings', () => {
  const r = {...request(), globalTerrain: globalTerrain()};
  for (const v of [1, 1e300, Number.MAX_VALUE]) assert.equal(screeningPoint({...r, weights: {sun: v, dark: v, slope: v, comms: v}}, 0, 0).score, 100);
  for (const v of [-1, NaN, Infinity]) assert.throws(() => screeningPoint({...r, weights: {...r.weights, sun: v}}, 0, 0), /weights/);
  assert.throws(() => screeningPoint({...r, weights: {sun: 0, dark: 0, slope: 0, comms: 0}}, 0, 0), /weights/);
  for (const v of [0, -1, NaN, Infinity]) assert.throws(() => screeningPoint({...r, slopeScaleDeg: v}, 0, 0), /scale/);
});

test('stay indices include forcing intervals only; final epoch cannot add an hour', () => {
  const r = request();
  assert.equal(screeningPoint({...r, startIndex: 2, endIndex: 2}, 0, 0).sunFraction, 1);
  for (const [startIndex, endIndex] of [[-1, 1], [1, 0], [0, 3], [3, 3], [.5, 1], [0, NaN]]) assert.throws(() => screeningPoint({...r, startIndex, endIndex}, 0, 0), /stay/);
  for (const [lat, lon] of [[91, 0], [-91, 0], [NaN, 0], [0, Infinity]]) assert.throws(() => screeningPoint(r, lat, lon), /coordinates/);
});

test('date changes recompute metrics, no stale scores or input mutations', () => {
  const c = catalog(); c.subsolarLon[1] = 180;
  const r = request(c), before = structuredClone(r);
  const sun = screeningPoint({...r, startIndex: 0, endIndex: 0}, 0, 0);
  const dark = screeningPoint({...r, startIndex: 1, endIndex: 1}, 0, 0);
  assert.equal(sun.sunFraction, 1); assert.equal(dark.sunFraction, 0); assert.equal(dark.longestDarkHours, 1);
  sun.notes.push('mutation'); assert.ok(!screeningPoint(r, 0, 0).notes.includes('mutation'));
  assert.deepEqual(r, before);
});

test('real prepared named horizons match canonical reference across subsystem heights and current 336-hour stay', () => {
  const c = actualCatalog(); assert.equal(c.grid.lat.length, 1980); assert.equal(c.grid.nAz, 120); assert.equal(c.meta.n, 17521);
  const site = c.sites.find(s => s.horizons.some(h => h.heightM === 10))!;
  const startIndex = 11000, endIndex = startIndex + 335;
  for (const [arrayHeightM, antennaHeightM] of [[2, 10], [10, 0]]) {
    const r = {...request(c), startIndex, endIndex, arrayHeightM, antennaHeightM, antennaMaskDeg: 5};
    const p = screeningPoint(r, site.lat, site.lon);
    const solar = summarize(buildSeries(c, site.lat, site.lon, terrainForSite(site, arrayHeightM), startIndex, endIndex), c.meta.stepHours);
    const comms = summarize(buildSeries(c, site.lat, site.lon, terrainForSite(site, antennaHeightM), startIndex, endIndex), c.meta.stepHours, {antennaMaskDeg: 5});
    near(p.sunFraction, solar.exposureTerrain); near(p.longestDarkHours, solar.longestDarkTerrain); near(p.commsFraction, comms.earthTerrain);
    assert.match(p.source, /Prepared named LOLA/); assert.equal(p.slopeDeg, null); assert.equal(p.score, null);
  }
});
