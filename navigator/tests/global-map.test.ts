import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_MAP_ZOOM, OVERVIEW_CAMERA, clampFinite, clusterMapPins, constrainMapCamera,
  focusMapCamera, labelOverlaps, latLonToMap, mapToLatLon, mapToScreen,
  mapWorldWidth, panMapCamera, placeMapLabel, screenToLatLon, wrapLongitude, zoomMapCamera,
} from "../lib/global-map";

const size = { width: 1200, height: 700 };
const close = (a: number, b: number, tolerance = 1e-9) => assert.ok(Math.abs(a - b) < tolerance, `${a} ≈ ${b}`);

test("equirectangular corners run west to east and north to south with a true 2:1 extent", () => {
  assert.deepEqual(latLonToMap(90, -180), { x: 0, y: 0 });
  assert.deepEqual(latLonToMap(-90, 180), { x: 1, y: 0.5 });
  assert.deepEqual(latLonToMap(0, 0), { x: 0.5, y: 0.25 });
  close(mapWorldWidth(size), 1168);
  const wide = { width: 1800, height: 400 };
  close(mapWorldWidth(wide), 736);
  const nw = mapToScreen(latLonToMap(90, -180), OVERVIEW_CAMERA, wide);
  const se = mapToScreen(latLonToMap(-90, 180), OVERVIEW_CAMERA, wide);
  close(se.x - nw.x, 2 * (se.y - nw.y));
});

test("longitude wraps negative, positive and multi-turn values at the dateline", () => {
  for (const lon of [-180, 180, 540, -540]) assert.equal(wrapLongitude(lon), -180);
  assert.equal(wrapLongitude(361), 1);
  assert.equal(wrapLongitude(-361), -1);
  close(wrapLongitude(179.9 + 360 * 100), 179.9);
});

test("finite guards clamp poles, zoom and malformed camera input", () => {
  assert.equal(clampFinite(NaN, -90, 90, 0), 0);
  assert.equal(clampFinite(Infinity, 1, 24, 1), 1);
  assert.equal(wrapLongitude(Infinity), 0);
  assert.deepEqual(latLonToMap(NaN, NaN), { x: 0.5, y: 0.25 });
  assert.deepEqual(latLonToMap(1000, 0), { x: 0.5, y: 0 });
  assert.deepEqual(mapToLatLon(Infinity, NaN), { lat: 0, lon: 0 });
  const camera = constrainMapCamera({ x: NaN, y: Infinity, zoom: NaN }, size);
  assert.deepEqual(camera, OVERVIEW_CAMERA);
  assert.equal(constrainMapCamera({ x: 20, y: -20, zoom: 1000 }, size).zoom, MAX_MAP_ZOOM);
  assert.ok(Object.values(constrainMapCamera({ x: NaN, y: NaN, zoom: NaN }, { width: NaN, height: NaN })).every(Number.isFinite));
});

test("map inverse round trips arbitrary hemispheres and longitudes", () => {
  for (const lat of [-90, -85.4, -3.1, 0, 26.13, 90]) {
    for (const lon of [-180, -179.99, -23.47, 0, 179.99, 180, 725]) {
      const point = latLonToMap(lat, lon);
      const inverse = mapToLatLon(point.x, point.y);
      close(inverse.lat, lat);
      close(wrapLongitude(inverse.lon - lon), 0);
    }
  }
});

test("clicks in letterbox margins are rejected, including invalid pointer input", () => {
  assert.equal(screenToLatLon({ x: 0, y: 350 }, OVERVIEW_CAMERA, size), null);
  assert.equal(screenToLatLon({ x: 600, y: 0 }, OVERVIEW_CAMERA, size), null);
  assert.equal(screenToLatLon({ x: NaN, y: 350 }, OVERVIEW_CAMERA, size), null);
  assert.deepEqual(screenToLatLon({ x: 600, y: 350 }, OVERVIEW_CAMERA, size), { lat: 0, lon: 0 });
  const edge = mapToScreen(latLonToMap(90, -180), OVERVIEW_CAMERA, size);
  assert.deepEqual(screenToLatLon(edge, OVERVIEW_CAMERA, size), { lat: 90, lon: -180 });
});

test("dateline neighbours stay adjacent, pick correctly and pan across the seam", () => {
  const camera = constrainMapCamera({ x: 0.999, y: 0.25, zoom: 5 }, size);
  const west = mapToScreen(latLonToMap(4, 179), camera, size);
  const east = mapToScreen(latLonToMap(4, -179), camera, size);
  close(east.x - west.x, mapWorldWidth(size, camera.zoom) * 2 / 360);
  close(screenToLatLon(west, camera, size)!.lon, 179);
  close(screenToLatLon(east, camera, size)!.lon, -179);
  const panned = panMapCamera(camera, size, -200, 0);
  assert.ok(panned.x >= 0 && panned.x < 0.1);
});

test("mobile, panoramic and resized views preserve inverse coordinates at both poles", () => {
  for (const viewport of [{ width: 375, height: 640 }, { width: 2048, height: 320 }, { width: 1280, height: 721 }]) {
    for (const lat of [-90, -88.2, 0, 90]) {
      for (const lon of [-179.9, 179.9]) {
        const camera = focusMapCamera(OVERVIEW_CAMERA, viewport, lat, lon);
        const screen = mapToScreen(latLonToMap(lat, lon), camera, viewport);
        const inverse = screenToLatLon(screen, camera, viewport);
        assert.ok(inverse);
        close(inverse.lat, lat);
        close(wrapLongitude(inverse.lon - lon), 0);
      }
    }
  }
  assert.equal(screenToLatLon({ x: 1201, y: 200 }, { ...OVERVIEW_CAMERA, zoom: 5 }, size), null);
});

test("zoom preserves an off-centre geographic anchor and respects polar limits", () => {
  const camera = constrainMapCamera({ x: 0.6, y: 0.25, zoom: 4 }, size);
  const anchor = { x: 400, y: 280 };
  const before = screenToLatLon(anchor, camera, size)!;
  // Zoom is applied via the same public helper as pointer and wheel gestures.
  const afterCamera = zoomMapCamera(camera, size, 2, anchor);
  const after = screenToLatLon(anchor, afterCamera, size)!;
  close(after.lat, before.lat); close(after.lon, before.lon);
  assert.equal(zoomMapCamera(camera, size, 100, anchor).zoom, MAX_MAP_ZOOM);
  const north = constrainMapCamera({ x: 0.5, y: -50, zoom: 5 }, size);
  close(screenToLatLon({ x: 600, y: 16 }, north, size)!.lat, 90);
  assert.equal(screenToLatLon({ x: 600, y: 0 }, north, size), null);
  const south = constrainMapCamera({ x: 0.5, y: 50, zoom: 5 }, size);
  close(screenToLatLon({ x: 600, y: 684 }, south, size)!.lat, -90);
});

test("regional selection focuses once while nearby selection preserves a manual camera", () => {
  const focused = focusMapCamera(OVERVIEW_CAMERA, size, 26.13, 3.63);
  assert.equal(focused.zoom, 3);
  const screen = mapToScreen(latLonToMap(26.13, 3.63), focused, size);
  close(screen.x, size.width / 2); close(screen.y, size.height / 2);
  assert.equal(focusMapCamera(focused, size, 26, 4), focused);
  const farSide = focusMapCamera(focused, size, -45, 177);
  assert.notDeepEqual(farSide, focused);
  assert.equal(farSide.zoom, focused.zoom);
});

test("clusters retain every site id, isolate selection/compare and accept arbitrary groups", () => {
  const clusters = clusterMapPins([
    { id: "robotic", x: 10, y: 10 }, { id: "historic", x: 12, y: 12 },
    { id: "selected", x: 11, y: 11, priority: true }, { id: "compare", x: 10, y: 10, priority: true },
    { id: "far", x: 150, y: 20 }, { id: "invalid", x: NaN, y: 0 },
  ]);
  assert.deepEqual(clusters.map((c) => c.ids).flat().sort(), ["compare", "far", "historic", "robotic", "selected"]);
  assert.deepEqual(clusters.find((c) => c.ids.includes("selected"))!.ids, ["selected"]);
  assert.deepEqual(clusters.find((c) => c.ids.includes("compare"))!.ids, ["compare"]);
  close(clusters.find((c) => c.ids.length === 2)!.x, 11);
});

test("label placement avoids earlier labels, pins and viewport edges", () => {
  const occupied = [{ x: 190, y: 90, width: 20, height: 20 }];
  const first = placeMapLabel({ x: 200, y: 100 }, 100, size, occupied)!;
  assert.ok(first);
  assert.ok(!labelOverlaps(first, occupied[0]));
  const second = placeMapLabel({ x: 202, y: 100 }, 100, size, [...occupied, first])!;
  assert.ok(second);
  assert.ok(!labelOverlaps(second, first));
  const rightEdge = placeMapLabel({ x: 1190, y: 300 }, 120, size, [])!;
  assert.ok(rightEdge.x < 1190);
  assert.equal(placeMapLabel({ x: 600, y: 350 }, 100, size, [{ x: 0, y: 0, width: 1200, height: 700 }]), null);
});
