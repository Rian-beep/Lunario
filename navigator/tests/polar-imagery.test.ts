import { test } from "node:test";
import assert from "node:assert/strict";
import { onlineNacLevel, polarTileSamplingM, polarSamplingLabel, bundledPatchUseful } from "../lib/polar-imagery";

test("regional NAC cannot cover a finer WAC basemap with the coarse polar-cap overview", () => {
  // Captured before fix: regional request z3 = 1070.244 m/px over bundled WAC267.561 m/px.
  assert.equal(polarTileSamplingM(3), 1070.244140625);
  for (const displayM of [1070, 812, 500, 267.56103515625, 101]) assert.equal(onlineNacLevel(displayM, 100), null, `${displayM} m/px is regional WAC context`);
});
test("detail NAC chooses a pyramid level no coarser than the requested screen sampling", () => {
  assert.equal(onlineNacLevel(100, 100), 7);
  assert.equal(onlineNacLevel(50, 100), 8);
  for (const displayM of [100, 99, 67, 50, 20, 10]) {
    const level = onlineNacLevel(displayM, 100);
    assert.ok(level !== null); assert.ok(polarTileSamplingM(level) <= displayM);
  }
  assert.equal(onlineNacLevel(1, 100), 10, "server request cap remains bounded; output label must retain actual 8.36m sampling");
});
test("nonfinite/invalid map sampling never requests a tile", () => {
  for (const value of [NaN, Infinity, -1, 0]) assert.equal(onlineNacLevel(value), null);
});
test("credits distinguish source family from output pixels without claiming 1m display detail", () => {
  assert.equal(polarSamplingLabel(100, 267.56103515625), "Finest visible WAC source ≈100 m/px · output sampling 268 m/px");
  assert.equal(polarSamplingLabel(1, polarTileSamplingM(8)), "Finest visible NAC source ≈1 m/px · output sampling 33 m/px; WAC/coarser imagery elsewhere");
  assert.match(polarSamplingLabel(1, 4.180641174316406), /output sampling 4 m\/px/);
});

test("finer bundled NAC is useful at reachable detail zoom without pretending output pixels are native resolution", () => {
  const nac = { stepM: 4.180641174316406, sourcePixelM: 1 };
  assert.equal(bundledPatchUseful(nac, 63), true);
  assert.equal(bundledPatchUseful(nac, 99), true);
  assert.equal(bundledPatchUseful(nac, 268), false);
  assert.equal(bundledPatchUseful({ stepM: 39.0625, sourcePixelM: 100 }, 100), true);
});
test("detail tile choice covers the viewport within24requests without reverting to coarse polar-cap pixels", () => {
  assert.equal(onlineNacLevel(63, 100, { width: 1280, height: 640 }), 7);
  assert.equal(onlineNacLevel(29, 100, { width: 1600, height: 856 }), 7);
  assert.equal(onlineNacLevel(99, 100, { width: 16000, height: 1000 }), null, "keep coherent WAC if budget cannot cover this field of view below100m output");
});
