import assert from 'node:assert/strict';
import test from 'node:test';
import { flightPointInFrame, horizonSegments, sceneResourcesChanged } from './flight-visuals';

test('reference-radius edits shift flight origin without changing mounted ENU basis', () => {
  const point = { eastM: 1200, northM: -300, yM: 20 };
  const before = flightPointInFrame(point, 100, 100);
  const after = flightPointInFrame(point, 2100, 100);
  assert.deepEqual(before.toArray(), [1.2, .02, .3]);
  assert.deepEqual(after.toArray(), [1.2, 2.02, .3]);
  assert.equal((after.y - before.y) * 1000, 2000);
  assert.deepEqual(point, { eastM: 1200, northM: -300, yM: 20 });
});

test('horizon updates preserve azimuth convention and break unknown sectors', () => {
  const mask = new Float64Array([0, 0, NaN, 0]);
  const points = horizonSegments({ mask, stepDeg: 90 });
  assert.equal(points.length, 4); // 0→90 and 270→360 only
  assert.ok(Math.abs(points[0].z + 200) < 1e-9);
  assert.ok(Math.abs(points[1].x - 200) < 1e-9);
  const higher = horizonSegments({ mask: new Float64Array([30, 30, 30, 30]), stepDeg: 90 });
  assert.equal(higher.length, 8);
  assert.ok(higher.every(point => Math.abs(point.y - 100) < 1e-9));
  assert.ok(Number.isNaN(mask[2]));
});

test('live physics, date, visibility and observer edits do not invalidate mounted resources', () => {
  const resources = { terrain: {}, imagery: {}, map: {}, lat: -89, lon: 10 };
  const initial = { ...resources, flight: {}, horizon: {}, showFlight: false, referenceHeightM: 100, pose: {} };
  const edited = { ...resources, flight: {}, horizon: {}, showFlight: true, referenceHeightM: 2000, pose: {} };
  assert.equal(sceneResourcesChanged(initial, edited), false);
  assert.equal(sceneResourcesChanged(initial, { ...edited, lon: 370 }), false);
  assert.equal(sceneResourcesChanged(initial, { ...edited, lat: -88 }), true);
  assert.equal(sceneResourcesChanged(initial, { ...edited, terrain: {} }), true);
  assert.equal(sceneResourcesChanged(initial, { ...edited, imagery: {} }), true);
  assert.equal(sceneResourcesChanged(null, edited), true);
});
