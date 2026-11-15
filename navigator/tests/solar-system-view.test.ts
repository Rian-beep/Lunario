import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {decodeCatalog, type Catalog} from '../lib/catalog';
import {earthMoonContext, DSN_STATIONS, stationEcefKm, dsnEarthUv} from '../lib/dsn';
import {nasaLatLonToXyz, nasaSiteFrame} from '../lib/nasa-model';
import {framingDistanceKm, lunarSiteDirection, moonFixedToNasa, sampleFocusFlight, solarClipPlanes, solarSystemState, SOLAR_FOCUS_MS, type FocusFlight} from '../lib/solar-system';

const catalog = decodeCatalog(JSON.parse(readFileSync(new URL('../public/data/catalog.json', import.meta.url), 'utf8')));
const close = (a: number, b: number, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} differs from ${b}`);
const vectorClose = (a: readonly number[], b: readonly number[], tolerance = 1e-8) => a.forEach((v, i) => close(v, b[i], tolerance));

test('IAU-to-NASA axis adapter is a right-handed rotation and preserves angular separation', () => {
  const x = new T.Vector3(...moonFixedToNasa([1, 0, 0])), y = new T.Vector3(...moonFixedToNasa([0, 1, 0])), z = new T.Vector3(...moonFixedToNasa([0, 0, 1]));
  vectorClose(x.toArray(), [1, 0, 0]); vectorClose(y.toArray(), [0, 0, -1]); vectorClose(z.toArray(), [0, 1, 0]);
  vectorClose(x.clone().cross(y).toArray(), z.toArray());
  const a: [number, number, number] = [.3, -.8, .51], b: [number, number, number] = [-.5, .2, .77];
  close(new T.Vector3(...a).dot(new T.Vector3(...b)), new T.Vector3(...moonFixedToNasa(a)).dot(new T.Vector3(...moonFixedToNasa(b))));
});

test('lunar location markers agree with the NASA texture frame at poles, meridians and catalogue sites', () => {
  for (const [lat, lon] of [[90, 0], [-90, 0], [0, 0], [0, 90], [0, -90], [0, 180], ...catalog.sites.map(s => [s.lat, s.lon])]) {
    const expected = nasaLatLonToXyz(lat, lon, 1);
    vectorClose(lunarSiteDirection(lat, lon), expected);
  }
  assert.throws(() => lunarSiteDirection(91, 0), RangeError);
  assert.throws(() => lunarSiteDirection(0, NaN), RangeError);
});

test('inverse local NASA globe transform returns source mesh axes and centre without a second rotation', () => {
  const radius = catalog.meta.moonRadiusM / 1000, frame = nasaSiteFrame(0, 0);
  const inverse = new T.Matrix4().set(0, 1, 0, radius, 0, 0, -1, 0, -1, 0, 0, 0, 0, 0, 0, 1);
  for (const p of [[radius, 0, 0], [0, radius, 0], [0, 0, -radius], [0, 0, 0]]) {
    const dot = (a: readonly number[], b: readonly number[]) => a.reduce((n, v, i) => n + v * b[i], 0);
    const local = new T.Vector3(dot(p, frame.east), dot(p, frame.up) - radius, -dot(p, frame.north));
    vectorClose(local.applyMatrix4(inverse).toArray(), p);
  }
});

test('physical kilometre radii, directions and ranges reuse context at fractional epochs and both endpoints', () => {
  for (const index of [0, .5, 1123.25, catalog.meta.n - 1]) {
    const c = earthMoonContext(catalog, index)!, s = solarSystemState(catalog, index)!;
    assert.ok(s); close(Math.hypot(...s.bodies.earth.centreKm), c.rangeKm);
    close(Math.hypot(...s.bodies.sun.centreKm), c.sunRangeKm!, 1e-6);
    vectorClose(s.bodies.earth.centreKm.map(v => v / c.rangeKm), c.earthDirection!);
    vectorClose(s.bodies.sun.centreKm.map(v => v / c.sunRangeKm!), c.sunDirection!);
    assert.equal(s.bodies.sun.radiusKm, catalog.meta.sunRadiusKm);
    assert.equal(s.bodies.earth.radiusKm, catalog.meta.earthRadiusKm);
    assert.equal(s.bodies.moon.radiusKm, catalog.meta.moonRadiusM / 1000);
    assert.deepEqual(s.bodies.moon.centreKm, [0, 0, 0]); assert.equal(s.epochMs, c.epochMs);
    for (const b of Object.values(s.bodies)) assert.ok(Math.hypot(...b.centreKm.map((v, i) => v - s.centreKm[i])) + b.radiusKm <= s.radiusKm + 1e-6);
  }
});

test('unsupported times or absent source directions/ranges never produce fallback orbital measurements', () => {
  for (const index of [-1, NaN, Infinity, catalog.meta.n]) assert.equal(solarSystemState(catalog, index), null);
  const broken = (key: keyof Catalog) => ({...catalog, [key]: new Float64Array(catalog.meta.n).fill(NaN)});
  for (const key of ['subearthLat', 'subsolarLon', 'sunRadiusDeg', 'earthRangeKm'] as const) assert.equal(solarSystemState(broken(key), 0), null);
  assert.equal(solarSystemState({...catalog, meta: {...catalog.meta, sunRadiusKm: -1}}, 0), null);
});

test('framing includes a full physical sphere on portrait and landscape canvases', () => {
  for (const aspect of [.25, .5, 1, 2, 4]) for (const radius of [1737.4, 6378.137, 695700, 8e7]) {
    const distance = framingDistanceKm(radius, aspect), vertical = 20 * Math.PI / 180, horizontal = Math.atan(Math.tan(vertical) * aspect);
    assert.ok(Math.asin(radius / distance) < Math.min(vertical, horizontal));
  }
  for (const args of [[0, 1], [1, 0], [NaN, 1], [1, Infinity], [1, 1, 180]]) assert.throws(() => framingDistanceKm(args[0], args[1], args[2]), RangeError);
});

test('floating-origin shifts preserve physical distances and clip every body from lunar focus through system focus', () => {
  const s = solarSystemState(catalog, 1234.5)!;
  for (const origin of [s.centreKm, ...Object.values(s.bodies).map(b => b.centreKm)]) {
    const bodies = Object.values(s.bodies).map(b => ({...b, centreKm: b.centreKm.map((v, i) => v - origin[i]) as [number, number, number]}));
    for (const offset of [[0, 0, 6000], [0, 0, 2e8], [1, 1, 1]] as const) {
      const c = solarClipPlanes(offset, bodies); assert.ok(c.near > 0 && c.far > c.near);
      for (const b of bodies) {
        const d = Math.hypot(...offset.map((v, i) => v - b.centreKm[i]));
        assert.ok(c.far > d + b.radiusKm);
        if (d > b.radiusKm) assert.ok(c.near < d - b.radiusKm);
      }
    }
  }
  assert.throws(() => solarClipPlanes([0, 0, 0], []), RangeError);
});

const duration = SOLAR_FOCUS_MS.lift + SOLAR_FOCUS_MS.transfer + SOLAR_FOCUS_MS.approach;
const flight: FocusFlight = {startMs: 0, fromCamera: [-1.5e8, 0, 6000], fromTarget: [-1.5e8, 0, 0], toOffset: [0, 0, 24000], travelKm: 3e8, reducedMotion: false};
test('focus flight lifts before transferring, keeps endpoints exact and respects reduced motion', () => {
  const copy = structuredClone(flight);
  assert.deepEqual(sampleFocusFlight(flight, 0), {camera: flight.fromCamera, target: flight.fromTarget, complete: false});
  assert.deepEqual(sampleFocusFlight(flight, SOLAR_FOCUS_MS.lift).target, flight.fromTarget);
  const transferred = sampleFocusFlight(flight, SOLAR_FOCUS_MS.lift + SOLAR_FOCUS_MS.transfer);
  vectorClose(transferred.target, [0, 0, 0]); close(Math.hypot(...transferred.camera), flight.travelKm, 1e-6);
  assert.deepEqual(sampleFocusFlight(flight, duration), {camera: flight.toOffset, target: [0, 0, 0], complete: true});
  assert.deepEqual(sampleFocusFlight({...flight, reducedMotion: true}, 0), sampleFocusFlight(flight, duration));
  for (let ms = 0; ms <= duration; ms += 16) assert.ok(sampleFocusFlight(flight, ms).camera.every(Number.isFinite));
  assert.deepEqual(flight, copy);
});

test('retargeting starts from the current physical pose, phase boundaries are continuous and invalid samples fail', () => {
  const pose = sampleFocusFlight(flight, 1800), retarget: FocusFlight = {...flight, startMs: 1800, fromCamera: pose.camera, fromTarget: pose.target, toOffset: [0, 6000, 0]};
  assert.deepEqual(sampleFocusFlight(retarget, 1800).camera, pose.camera);
  assert.deepEqual(sampleFocusFlight(retarget, 1800).target, pose.target);
  assert.deepEqual(sampleFocusFlight(retarget, duration + 1800).camera, retarget.toOffset);
  for (const ms of [SOLAR_FOCUS_MS.lift, SOLAR_FOCUS_MS.lift + SOLAR_FOCUS_MS.transfer, duration]) {
    const a = sampleFocusFlight(flight, ms - .01), b = sampleFocusFlight(flight, ms);
    vectorClose(a.camera, b.camera, .001); vectorClose(a.target, b.target, .001);
  }
  assert.throws(() => sampleFocusFlight(flight, NaN), RangeError);
  assert.throws(() => sampleFocusFlight({...flight, toOffset: [0, 0, 0]}, 0), RangeError);
});

test('Earth-fixed station registration retains WGS84 coordinates without a celestial transform', () => {
  for (const station of DSN_STATIONS) {
    const [x, y, z] = stationEcefKm(station), displayed = [x, z, -y];
    const geocentricLatitude = Math.atan2(displayed[1], Math.hypot(displayed[0], displayed[2])) * 180 / Math.PI;
    assert.equal(Math.sign(geocentricLatitude), Math.sign(station.latitudeDeg));
    close(((Math.atan2(-displayed[2], displayed[0]) * 180 / Math.PI + 360) % 360), station.longitudeEastDeg);
    // Geodetic latitude, rather than geocentric latitude, registers Blue Marble.
    const uv = dsnEarthUv(station.latitudeDeg, station.longitudeEastDeg);
    close(uv.v, (station.latitudeDeg + 90) / 180); assert.ok(uv.u >= 0 && uv.u <= 1);
  }
});
