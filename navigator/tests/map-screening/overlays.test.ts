import test from 'node:test';
import assert from 'node:assert/strict';
import { actualCatalog, catalog } from '../suitability/fixtures';
import type { ScreeningPoint } from '../../lib/suitability';
import { cellAt, createMapScreenRaster, drawIceMarkers, iceReference, metricRange, metricValue, polarPixel, rampColor,
  screeningCells, viewportGrid, viewportLocations, wrapLongitude } from '../../lib/map-overlays';
import { loadStaticIce } from '../../components/map-screening/runner';

const point = (lat: number, lon: number, score: number | null = 0): ScreeningPoint => ({ lat, lon, score,
  sunFraction: 0, longestDarkHours: 0, darkLowerBound: false, commsFraction: 0, slopeDeg: 0, source: 'synthetic', spacingM: null, notes: [] });

test('unknown remains transparent while every known zero has a colour and raw metric value', () => {
  const p = point(0, 0);
  for (const metric of ['combined', 'sun', 'dark', 'slope', 'comms'] as const) {
    assert.equal(metricValue(p, metric), 0);
    assert.equal(rampColor(metricValue(p, metric), [0, 100]), 'rgb(118, 82, 163)');
    assert.equal(metricValue({ ...p, score: null, sunFraction: null, longestDarkHours: null, slopeDeg: null, commsFraction: null }, metric), null);
  }
  assert.equal(rampColor(null, [0, 100]), null);
  assert.equal(rampColor(NaN, [0, 100]), null);
  assert.equal(rampColor(100, [0, 100]), 'rgb(145, 213, 186)');
  assert.equal(rampColor(50, [0, 100]), 'rgb(239, 179, 76)');
  assert.equal(rampColor(-5, [0, 100]), rampColor(0, [0, 100]));
  assert.equal(rampColor(101, [0, 100]), rampColor(100, [0, 100]));
  assert.deepEqual(metricRange('dark', [{ ...p, longestDarkHours: 168 }]), [0, 168]);
  assert.deepEqual(metricRange('slope', [{ ...p, slopeDeg: 12 }]), [0, 12]);
});

test('whole-Moon cells join at the seam, include pole edges and never fill missing centres', () => {
  const c = catalog(), points = [point(82.5, 172.5), point(-82.5, 187.5), point(7.5, 7.5, null)];
  const cells = screeningCells(points, 'global', c);
  assert.equal(cells.length, 3);
  assert.equal(cellAt(cells, 90, 179)?.point, points[0]);
  assert.equal(cellAt(cells, -90, -180)?.point, points[1]);
  assert.equal(cellAt(cells, -90, 180)?.point, points[1]);
  assert.equal(cellAt(cells, -89, 540)?.point, points[1]);
  assert.equal(cellAt(cells, 7.5, 0)?.point.score, null);
  assert.equal(cellAt(cells, 7.5, 15), null);
  assert.equal(cellAt(cells, 91, 0), null);
  assert.equal(cellAt(cells, 0, NaN), null);
  assert.equal(wrapLongitude(540), -180);
});

test('viewport cells preserve unwrapped seam bounds and cannot sample more finely than DEM spacing', () => {
  const grid = viewportGrid({ west: 170, east: 190, south: -10, north: 10, cols: 12, rows: 8 }, 3);
  assert.deepEqual([grid.cols, grid.rows], [6, 6]);
  const locations = viewportLocations(grid);
  assert.equal(locations.length, 36);
  const points = locations.map(p => point(p.lat, wrapLongitude(p.lon)));
  const cells = screeningCells(points, 'global', catalog(), grid);
  assert.equal(cells.length, 36);
  assert.equal(cellAt(cells, 0, -175)?.point.lon, cellAt(cells, 0, 185)?.point.lon);
  assert.equal(cellAt(cells, 0, 169), null);
  assert.equal(cellAt(cells, 0, 191), null);
  const tiny = viewportGrid({ west: 0, east: .01, south: 0, north: .01, cols: 12, rows: 8 }, .14);
  assert.equal(viewportLocations(tiny).length, 0);
  for (const bad of [{ cols: 257, rows: 1 }, { cols: 0 }, { rows: 1.1 }, { west: 20, east: 10 }, { south: -91 }, { east: 600 }, { north: Infinity }]) {
    assert.throws(() => viewportGrid({ west: 0, east: 20, south: -10, north: 10, cols: 12, rows: 8, ...bad }, .14), RangeError);
  }
  assert.throws(() => viewportGrid(grid, 0), RangeError);
});

test('polar display support uses all 1980 actual centres, clips outside sampled cap and keeps map projection', () => {
  const c = actualCatalog();
  const points = Array.from(c.grid.lat, (lat, i) => point(lat, c.grid.lon[i]));
  const cells = screeningCells(points, 'polar', c);
  assert.equal(cells.length, 1980);
  for (const p of points) assert.equal(cellAt(cells, p.lat, p.lon)?.point, p);
  assert.equal(cellAt(cells, -90, 0), null);
  assert.equal(cellAt(cells, -79, 0), null);
  assert.equal(cellAt(cells, 90, 0), null);
  const north = polarPixel(c, -85, 0), south = polarPixel(c, -85, 180), east = polarPixel(c, -85, 90), pole = polarPixel(c, -90, 0);
  assert.ok(north.y < pole.y && south.y > pole.y && east.x > pole.x);
  assert.ok(Math.abs(north.y + south.y - 2 * pole.y) < 1e-8);
  assert.deepEqual(screeningCells(points.slice(0, 1), 'polar', c).map(cell => cell.point), points.slice(0, 1));
});

test('raster creation is SSR safe; canvas retains bounds, zero colour, alpha and transparent unknown cells', () => {
  assert.equal(createMapScreenRaster({ catalog: catalog(), points: [], projection: 'global', metric: 'combined', opacity: .55 }), null);
  const fills: unknown[][] = [];
  const context = { fillStyle: '', globalAlpha: 1, fillRect(...args: number[]) { fills.push([this.fillStyle, this.globalAlpha, ...args]); } };
  const canvas = { width: 0, height: 0, getContext: () => context };
  const old = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => canvas } });
  try {
    const bounds = { west: 170, east: 190, south: -10, north: 10, cols: 2, rows: 1 };
    const points = [point(0, 175), point(0, 185, null)];
    const raster = createMapScreenRaster({ catalog: catalog(), points, projection: 'global', viewport: bounds, metric: 'combined', opacity: .55 });
    assert.equal(raster?.canvas, canvas);
    assert.deepEqual(raster?.bounds, { west: 170, east: 190, south: -10, north: 10 });
    assert.deepEqual(fills, [['rgb(118, 82, 163)', .55, 0, 0, 480, 480]]);
  } finally { if (old) Object.defineProperty(globalThis, 'document', old); else Reflect.deleteProperty(globalThis, 'document'); }
});

test('offline static ice is validated without HTTP; markers preserve locations, shapes and canvas state', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Unexpected HTTP'); };
  try {
    const { features, sources } = await loadStaticIce();
    assert.equal(features.length, 170); assert.equal(sources.length, 2);
    const psr = features[0], impact = features.find(f => f.evidence === 'impact-water-detection')!;
    const projected: number[][] = [], commands: string[] = [];
    const context = new Proxy({}, { set: () => true, get: (_, name) => () => commands.push(String(name)) }) as CanvasRenderingContext2D;
    drawIceMarkers(context, [psr, impact], (lat, lon) => { projected.push([lon, lat]); return { x: lon, y: lat }; });
    assert.deepEqual(projected, [psr.geometry.coordinates, impact.geometry.coordinates]);
    assert.equal(commands[0], 'save'); assert.equal(commands.at(-1), 'restore');
    assert.equal(commands.filter(command => command === 'closePath').length, 1);
    assert.equal(commands.filter(command => command === 'fill').length, 1);
    assert.equal(commands.filter(command => command === 'stroke').length, 2);
    const polygon = { ...psr, geometry: { type: 'Polygon' as const, coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } };
    assert.equal(iceReference(polygon), null);
    let called = false; drawIceMarkers(context, [polygon], () => { called = true; return null; }); assert.equal(called, false);
    commands.length = 0;
    assert.throws(() => drawIceMarkers(context, [psr], () => { throw new Error('projection failure'); }), /projection failure/);
    assert.equal(commands.at(-1), 'restore');
  } finally { globalThis.fetch = original; }
});
