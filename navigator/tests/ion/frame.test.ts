import assert from "node:assert/strict";
import { test } from "node:test";
import { Vector3 } from "three";
import { ionBodyToLocalMatrix } from "../../lib/ion/frame";
import { nasaLatLonToXyz, nasaSiteFrame } from "../../lib/nasa-model";

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} differs from ${b}`);

test("Ion metres map to the existing NASA local frame at poles and both sides of the dateline", () => {
  for (const [lat, lon] of [[0, 0], [0, 90], [-89.9, 123], [-90, 0], [-90, 180], [90, -179], [-83, 180], [-83, -180], [-83, 540]]) {
    const matrix = ionBodyToLocalMatrix(lat, lon, 1737.7);
    const frame = nasaSiteFrame(lat, lon);
    for (const [pointLat, pointLon] of [[lat, lon], [lat + (lat === 90 ? -0.01 : 0.01), lon], [0, 0], [-40, -170]]) {
      const nasa = nasaLatLonToXyz(pointLat, pointLon, 1738000);
      const local = new Vector3(nasa[0], -nasa[2], nasa[1]).applyMatrix4(matrix);
      close(local.x, new Vector3(...nasa).dot(new Vector3(...frame.east)) / 1000);
      close(local.y, new Vector3(...nasa).dot(new Vector3(...frame.up)) / 1000 - 1737.7);
      close(local.z, -new Vector3(...nasa).dot(new Vector3(...frame.north)) / 1000);
    }
    const p = lat * Math.PI / 180, l = lon * Math.PI / 180;
    const up = new Vector3(Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p));
    const east = new Vector3(-Math.sin(l), Math.cos(l), 0);
    const north = new Vector3(-Math.sin(p) * Math.cos(l), -Math.sin(p) * Math.sin(l), Math.cos(p));
    const origin = up.clone().multiplyScalar(1737700);
    const at = origin.clone().applyMatrix4(matrix);
    close(at.length(), 0);
    const eastDelta = origin.clone().addScaledVector(east, 1000).applyMatrix4(matrix).sub(at);
    const northDelta = origin.clone().addScaledVector(north, 1000).applyMatrix4(matrix).sub(at);
    close(eastDelta.x, 1); close(eastDelta.y, 0); close(eastDelta.z, 0);
    close(northDelta.x, 0); close(northDelta.y, 0); close(northDelta.z, -1);
    assert.ok(Math.abs(matrix.determinant() - 1e-9) < 1e-18);
    const restored = at.clone().applyMatrix4(matrix.clone().invert());
    assert.ok(restored.distanceTo(origin) < 1e-6);
  }
});

test("Ion frame rejects unknown/nonfinite coordinates and preserves positive subsurface reference radii", () => {
  for (const [lat, lon, radius] of [[NaN, 0, 1], [0, Infinity, 1], [-91, 0, 1], [91, 0, 1], [0, 0, 0], [0, 0, -1]])
    assert.throws(() => ionBodyToLocalMatrix(lat, lon, radius), /finite latitude/);
  const matrix = ionBodyToLocalMatrix(0, 0, 1736);
  close(new Vector3(1737400, 0, 0).applyMatrix4(matrix).y, 1.4);
});
