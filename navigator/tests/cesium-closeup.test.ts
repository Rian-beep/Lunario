import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { cesiumCloseupDesired, CESIUM_MOON_ASSET_ID, reduceCesiumCloseup } from "../lib/cesium-closeup";

test("Cesium Moon opens on a close lunar orbit or surface view", () => {
  assert.equal(CESIUM_MOON_ASSET_ID, 2684829);
  assert.equal(cesiumCloseupDesired(0.003, "surface", "moon"), true);
  assert.equal(cesiumCloseupDesired(8, "orbit", "moon"), true);
  assert.equal(cesiumCloseupDesired(40, "orbit", "moon"), false);
  assert.equal(cesiumCloseupDesired(1, "globe", "moon"), false);
  assert.equal(cesiumCloseupDesired(1, "surface", "earth"), false);
});

test("dismiss stays on the Lunario view until the camera leaves the close band", () => {
  const open = reduceCesiumCloseup({ open: false, dismissed: false }, true, 0.003);
  assert.equal(open.open, true);
  const dismissed = reduceCesiumCloseup(open, true, 0.003, true);
  assert.deepEqual(dismissed, { open: false, dismissed: true });
  assert.equal(reduceCesiumCloseup(dismissed, true, 0.003).open, false);
  const released = reduceCesiumCloseup(dismissed, false, 25);
  assert.deepEqual(released, { open: false, dismissed: false });
  assert.equal(reduceCesiumCloseup(released, true, 4).open, true);
});

test("scene publishes the range the close-up watches", () => {
  const runtime = readFileSync(join(process.cwd(), "components/workbench/scene/runtime.ts"), "utf8");
  assert.match(runtime, /host\.dataset\.terrainRangeKm/);
  const scene = readFileSync(join(process.cwd(), "components/workbench/scene.tsx"), "utf8");
  assert.match(scene, /CesiumMoonCloseup/);
});
