import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sampleGrid,
  localToLunar,
  lunarToLocal,
  type TerrainGrid,
} from "../lib/terrain";
const grid: TerrainGrid = {
  id: "test",
  width: 2,
  height: 2,
  x0: 0,
  y0: 10,
  stepM: 10,
  heights: [0, 10, 20, 30],
};
test("numerical terrain bilinear interpolation respects raster axis directions", () => {
  assert.equal(sampleGrid(grid, 5, 5), 15);
  assert.equal(sampleGrid(grid, 0, 10), 0);
});
test("outside or nodata terrain cannot become invented height", () => {
  assert.equal(sampleGrid(grid, -1, 10), null);
  assert.equal(
    sampleGrid({ ...grid, heights: [null, 10, 20, 30] }, 5, 5),
    null,
  );
});
test("local coordinates roundtrip at a polar landing site", () => {
  const p = localToLunar(1000, 500, -89, 204);
  const q = lunarToLocal(p.lat, p.lon, -89, 204);
  assert.ok(Math.abs(q.eastM - 1000) < 0.01);
  assert.ok(Math.abs(q.northM - 500) < 0.01);
});
test("rectangular source windows retain their separate north-south spacing", () => {
  assert.equal(sampleGrid({ ...grid, stepYM: 20 }, 5, 0), 15);
});
test("height lookup uses the finest available measured patch before coarse context", async () => {
  const { heightAt } = await import("../lib/terrain");
  const coarse = {
      ...grid,
      id: "coarse",
      x0: -5,
      y0: 5,
      inputPixelM: 80,
      heights: [10, 10, 10, 10],
    },
    fine = { ...coarse, id: "fine", inputPixelM: 5, heights: [20, 20, 20, 20] };
  const data = {
    patches: [coarse, fine],
    overview: coarse,
  } as import("../lib/terrain").TerrainData;
  assert.equal(heightAt(data, -90, 0)?.heightM, 20);
});
test("packed height decoding preserves missing samples and physical scale", async () => {
  const { decodeTerrain } = await import("../lib/terrain");
  const bytes = Buffer.alloc(8);
  [0, 12, -4, -32768].forEach((v, i) => bytes.writeInt16LE(v, i * 2));
  const g = {
    ...grid,
    heights: undefined,
    encodedHeights: bytes.toString("base64"),
    heightOffsetM: 100,
    heightScaleM: 0.1,
  };
  const d = decodeTerrain({ overview: g, patches: [] } as never);
  assert.deepEqual(d.overview.heights, [100, 101.2, 99.6, null]);
});
