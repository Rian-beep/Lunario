import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { latLonToProjected } from "@/lib/astro";
import type { TerrainData, TerrainGrid } from "@/lib/terrain";
import { bodyToScene, buildSurface, displayHeight, flightVector, siteFrame, skyDirection } from "./surface";
import { imageUv } from "./material";

const close = (actual: number, expected: number, epsilon = 1e-7) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} ≠ ${expected}`);
const grid = (id: string, heightM: number, overrides: Partial<TerrainGrid> = {}): TerrainGrid => ({
  id, x0: -5000, y0: 5000, width: 11, height: 11, stepM: 1000,
  heights: Array(121).fill(heightM), ...overrides,
});
const terrain = (overview: TerrainGrid, patches: TerrainGrid[] = []): TerrainData => ({
  version: 1, frame: "MOON_ME", source: "test", sourcePage: "test", retrievedUtc: "test", sourcePixelM: 80, sampling: "test", overview, patches,
});

test("render frame preserves east/north/tangent-up metres with no radial-altitude substitution", () => {
  assert.deepEqual(flightVector({ eastM: 120000, northM: -6000, yM: -2500 }).toArray(), [120, -2.5, 6]);
  const frame = siteFrame(-86, 311, 3200);
  const site = bodyToScene(frame.up, 3200, frame);
  close(site.length(), 0);
  close(frame.up.dot(frame.east), 0);
  close(frame.up.dot(frame.north), 0);
  const a = 150000 / frame.referenceRadiusM;
  const direction = frame.up.clone().multiplyScalar(Math.cos(a)).addScaledVector(frame.east, Math.sin(a));
  const point = bodyToScene(direction, 3200, frame);
  close(point.clone().add(new T.Vector3(0, frame.referenceRadiusM / 1000, 0)).length(), frame.referenceRadiusM / 1000);
  assert.ok(point.y < -6, "reference surface must visibly curve below the tangent plane over 150 km");
});

test("missing DEM samples stay unknown and use the flight's site-radius sphere", () => {
  assert.deepEqual(displayHeight(null, -90, 0, 3200), { heightM: 3200, coverage: 0 });
  const unknown = grid("overview", 500, { heights: Array(121).fill(null) });
  assert.deepEqual(displayHeight(terrain(unknown), -90, 0, -1400), { heightM: -1400, coverage: 0 });
});

test("fine measured heights take precedence and blend only at numerical grid edges", () => {
  const data = terrain(grid("overview", 100), [grid("fine", 900)]);
  close(displayHeight(data, -90, 0).heightM, 900);
  close(displayHeight(data, -90, 0).coverage, 1);
  const edge = grid("fine", 900, { x0: 0 });
  const base = grid("overview", 100);
  close(displayHeight(terrain(base, [edge]), -90, 0).heightM, 100);
  const coarse = grid("coarse", 400, { inputPixelM: 160 });
  const nested = grid("nested", 900, { x0: 0, inputPixelM: 5 });
  close(displayHeight(terrain(base, [coarse, nested]), -90, 0).heightM, 400);
  close(displayHeight(terrain(base, [nested, coarse]), -90, 0).heightM, 400);
});

test("image metadata maps polar extent with north at the top, for non-square images", () => {
  const patch = { id: "patch", url: "test", width: 100, height: 50, stepM: 80, sourcePixelM: 100, x0: -500, y0: 800 };
  assert.deepEqual(imageUv(patch, -500, 800), { u: 0, v: 1 });
  assert.deepEqual(imageUv(patch, 7500, -3200), { u: 1, v: 0 });
  assert.deepEqual(imageUv(patch, 3500, -1200), { u: 0.5, v: 0.5 });
  const projected = latLonToProjected(-90, 0);
  close(projected.x, 0); close(projected.y, 0);
});

test("continuous sphere provides finite outward-facing surface beyond a 100 km footprint", () => {
  const frame = siteFrame(-86, 40, 2500);
  const geometry = buildSurface(null, frame);
  const position = geometry.getAttribute("position"), normals = geometry.getAttribute("normal");
  const centre = new T.Vector3(0, -frame.referenceRadiusM / 1000, 0);
  let near = false, far = false;
  for (let i = 0; i < position.count; i += 29) {
    const point = new T.Vector3().fromBufferAttribute(position, i);
    const normal = new T.Vector3().fromBufferAttribute(normals, i);
    assert.ok(point.toArray().every(Number.isFinite));
    close(point.distanceTo(centre), frame.referenceRadiusM / 1000, 0.0003);
    assert.ok(point.clone().sub(centre).normalize().dot(normal) > 0.98, "surface normals must face outwards");
    if (point.x > 100 && point.x < 200) near = true;
    if (point.y < -2000) far = true;
  }
  assert.ok(near && far);
  geometry.dispose();
});

test("Sun and Earth compass directions use north zero and clockwise azimuth", () => {
  close(skyDirection(0, 0).distanceTo(new T.Vector3(0, 0, -1)), 0);
  close(skyDirection(90, 0).distanceTo(new T.Vector3(1, 0, 0)), 0);
  close(skyDirection(0, 90).distanceTo(new T.Vector3(0, 1, 0)), 0);
});

test('global calibrated numerical heights support display context without becoming fine terrain',async()=>{
 const {readFileSync}=await import('node:fs');
 const {decodeGlobalTerrain}=await import('@/lib/global-terrain');
 const metadata=JSON.parse(readFileSync('public/data/global-terrain.json','utf8'));
 const global=await decodeGlobalTerrain(metadata,new Uint8Array(readFileSync('public/data/global-terrain.bin.gz')));
 const {sampleGlobalHeight}=await import('@/lib/global-terrain');
 const data={...terrain(grid('empty',0,{heights:Array(121).fill(null)})),globalTerrain:global};
 const actual=displayHeight(data,0.674,23.473,999);
 close(actual.heightM,sampleGlobalHeight(global,0.674,23.473)!);assert.equal(actual.coverage,.25);
 const fine={...terrain(grid('fine',900)),globalTerrain:global};
 close(displayHeight(fine,-90,0).heightM,900);assert.equal(displayHeight(fine,-90,0).coverage,1);
});

test('cooperative destination preparation preserves body location in a fixed render frame', async () => {
  const { buildSurfaceCooperatively } = await import('./surface');
  const mounted = siteFrame(-89, 10, 100), destination = siteFrame(20, 150, 2000);
  let yields = 0;
  const geometry = await buildSurfaceCooperatively(null, destination, mounted, new AbortController().signal, async () => { yields++; });
  assert.ok(yields > 0);
  const actual = new T.Vector3().fromBufferAttribute(geometry.getAttribute('position'), 0);
  const expected = bodyToScene(destination.up, 2000, mounted);
  assert.ok(actual.distanceTo(expected) < .001, 'Float32 display coordinates preserve destination to metre precision');
  const normal = new T.Vector3().fromBufferAttribute(geometry.getAttribute('normal'), 0);
  const expectedNormal = new T.Vector3(destination.up.dot(mounted.east), destination.up.dot(mounted.up), -destination.up.dot(mounted.north));
  assert.ok(normal.distanceTo(expectedNormal) < 1e-6);
  geometry.dispose();
});

test('cooperative destination work can be canceled at a yield before publishing geometry', async () => {
  const { buildSurfaceCooperatively } = await import('./surface');
  const abort = new AbortController(); let yielded = false;
  await assert.rejects(buildSurfaceCooperatively(null, siteFrame(0, 0, 0), siteFrame(-89, 0, 0), abort.signal, async () => { yielded = true; abort.abort(); }), { name: 'AbortError' });
  assert.ok(yielded);
});
