import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { decodeNasaMesh, loadNasaModel, nasaLatLonToXyz, nasaSiteFrame, type NasaModelMetadata } from "../lib/nasa-model";

const root = new URL("../public/data/", import.meta.url);
const metadata = JSON.parse(readFileSync(new URL("nasa-model.json", root), "utf8"));
const gzip = readFileSync(new URL("nasa-moon-mesh.bin.gz", root));
const binary = gunzipSync(gzip);
const jpeg = readFileSync(new URL("imagery/nasa-moon-8k.jpg", root));
const arrayBuffer = (b: Uint8Array): ArrayBuffer => Uint8Array.from(b).buffer;
const hash = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const close = (a: number, b: number, tolerance = 1e-12) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
function fixture() {
  const b = new ArrayBuffer(96), v = new DataView(b);
  new Uint8Array(b, 0, 8).set(new TextEncoder().encode("NASAMOON"));
  v.setUint32(8, 1, true); v.setUint32(12, 48, true);
  v.setUint32(16, 3, true); v.setUint32(20, 3, true);
  v.setFloat64(24, 0.98, true); v.setFloat64(32, 1737.4, true);
  [1, 0, 0, 0, 1, 0, 0, 0, -1].forEach((x, i) => v.setFloat32(48 + i * 4, x, true));
  [0, 1, 2].forEach((x, i) => v.setUint32(84 + i * 4, x, true));
  return b;
}

test("decoder returns Float32 positions, Uint32 triangles and explicit km conversion", () => {
  const mesh = decodeNasaMesh(fixture());
  assert.ok(mesh.positions instanceof Float32Array);
  assert.ok(mesh.indices instanceof Uint32Array);
  assert.deepEqual(Array.from(mesh.indices), [0, 1, 2]);
  close(mesh.radiusNormalizationDivisor * mesh.positionToKm, 1737.4);
});

test("decoder rejects truncated, trailing, mismatched and unsupported headers", () => {
  assert.throws(() => decodeNasaMesh(new ArrayBuffer(47)), /truncated/);
  assert.throws(() => decodeNasaMesh(fixture().slice(0, 95)), /length/);
  const extra = new Uint8Array(97); extra.set(new Uint8Array(fixture()));
  assert.throws(() => decodeNasaMesh(extra.buffer), /length/);
  for (const [offset, value, error] of [[0, 0, /magic/], [8, 2, /version/], [12, 32, /header/], [16, 0, /count/], [16, 0xffffffff, /length/], [20, 2, /count/], [40, 1, /reserved/], [44, 1, /reserved/]] as const) {
    const b = fixture(); new DataView(b).setUint32(offset, value, true);
    assert.throws(() => decodeNasaMesh(b), error);
  }
});

test("decoder rejects non-finite/zero geometry, invalid scales and out-of-bounds indices", () => {
  for (const invalid of [NaN, Infinity, -Infinity]) {
    const b = fixture(); new DataView(b).setFloat32(48, invalid, true);
    assert.throws(() => decodeNasaMesh(b), /non-finite/);
  }
  for (const offset of [24, 32]) for (const invalid of [NaN, Infinity, 0, -1]) {
    const b = fixture(); new DataView(b).setFloat64(offset, invalid, true);
    assert.throws(() => decodeNasaMesh(b), /scale/);
  }
  const zero = fixture(); new DataView(zero).setFloat32(48, 0, true);
  assert.throws(() => decodeNasaMesh(zero), /zero-radius/);
  const badIndex = fixture(); new DataView(badIndex).setUint32(84, 3, true);
  assert.throws(() => decodeNasaMesh(badIndex), /index/);
});

test("NASA prime meridian, east longitudes and poles map to the verified source axes", () => {
  for (const [lat, lon, expected] of [[0, 0, [1, 0, 0]], [0, 90, [0, 0, -1]], [0, -90, [0, 0, 1]], [0, 180, [-1, 0, 0]], [90, 0, [0, 1, 0]], [-90, 0, [0, -1, 0]]] as const)
    nasaLatLonToXyz(lat, lon).forEach((v, i) => close(v, expected[i]));
  nasaLatLonToXyz(-89.5, 204, 1737.4).forEach((x, i) => close(x, nasaLatLonToXyz(-89.5, -156, 1737.4)[i]));
  for (const [lat, lon, r] of [[91, 0, 1], [NaN, 0, 1], [0, Infinity, 1], [0, 0, -1]])
    assert.throws(() => nasaLatLonToXyz(lat, lon, r), /coordinates/);
});

test("recorded NASA source UV/XYZ samples independently constrain axis signs and orientation", () => {
  const mesh = decodeNasaMesh(arrayBuffer(binary));
  for (const sample of metadata.coordinates.evidence.samples) {
    const p: number[] = sample.position, uv: number[] = sample.uv;
    const r = Math.hypot(...p);
    const expected = nasaLatLonToXyz(90 - uv[1] * 180, uv[0] * 360 - 180);
    const angle = Math.acos(Math.min(1, Math.max(-1, expected.reduce((s, x, i) => s + x * p[i] / r, 0)))) * 180 / Math.PI;
    assert.ok(angle < 1.56, `Source UV sample ${sample.originalVertex}: ${angle} degrees`);
    p.forEach((x, i) => assert.equal(mesh.positions[sample.weldedVertex * 3 + i], x));
  }
  close(metadata.coordinates.evidence.maxAngularErrorDeg, 1.5536320822929512, 1e-10);
});

test("site basis converts NASA XYZ to east/up/north km, including polar sites", () => {
  for (const [lat, lon] of [[0, 0], [-89.5, 204], [-90, 45], [90, -30]]) {
    const { east, up, north } = nasaSiteFrame(lat, lon);
    const basis = [east, up, north];
    basis.forEach((a, i) => basis.forEach((b, j) => close(a.reduce((s, v, k) => s + v * b[k], 0), i === j ? 1 : 0)));
    const eastCrossUp = [east[1] * up[2] - east[2] * up[1], east[2] * up[0] - east[0] * up[2], east[0] * up[1] - east[1] * up[0]];
    eastCrossUp.forEach((x, i) => close(x, -north[i]));
    // A point 2 km east, 3 km above the nominal site, 4 km north.
    const p = up.map((x, i) => (1737.4 + 3) * x + 2 * east[i] + 4 * north[i]);
    const components = basis.map((axis) => axis.reduce((s, x, i) => s + x * (p[i] - 1737.4 * up[i]), 0));
    components.forEach((x, i) => close(x, [2, 3, 4][i], 1e-9));
  }
});

test("committed NASA assets match provenance, complete counts and nominal lunar scale", () => {
  assert.equal(metadata.source.sha256, "c4b65fb4df622a37fd75366c2ed9bf9e163e41c0fde178b3b27e31b0173e6953");
  assert.equal(hash(gzip), metadata.mesh.sha256);
  assert.equal(hash(binary), metadata.mesh.decodedSha256);
  assert.equal(hash(jpeg), metadata.texture.sha256);
  assert.equal(jpeg.byteLength, 4631745);
  assert.equal(jpeg.readUInt16BE(0), 0xffd8);
  assert.equal(metadata.texture.width, 8192); assert.equal(metadata.texture.height, 4096);
  const mesh = decodeNasaMesh(arrayBuffer(binary));
  assert.equal(metadata.mesh.originalVertexCount, 2021340);
  assert.equal(mesh.positions.length / 3, 507906);
  assert.equal(mesh.indices.length, 3047424);
  assert.equal(mesh.indices.length / 3, 1015808);
  assert.ok(gzip.byteLength < 10_000_000);
  let min = Infinity, max = 0;
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const r = Math.hypot(mesh.positions[i], mesh.positions[i + 1], mesh.positions[i + 2]);
    min = Math.min(min, r); max = Math.max(max, r);
  }
  close(min, metadata.scale.sourceRadiusMin); close(max, metadata.scale.sourceRadiusMax);
  close(mesh.radiusNormalizationDivisor, metadata.scale.radiusNormalizationDivisor);
  close(mesh.referenceRadiusKm, 1737.4);
  close(mesh.positionToKm * mesh.radiusNormalizationDivisor, 1737.4);
  // Display scale is nominal, not evidence of physical GLB terrain elevations.
  assert.ok(min * mesh.positionToKm > 1700 && max * mesh.positionToKm < 1770);
});

test("online loader fetches metadata and gzip and returns the unchanged texture URL", async (t) => {
  const requests: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    requests.push(url);
    return new Response(url.endsWith(".json") ? JSON.stringify(metadata) : arrayBuffer(gzip));
  });
  const model = await loadNasaModel();
  assert.deepEqual(requests, ["/data/nasa-model.json", "/data/nasa-moon-mesh.bin.gz"]);
  assert.equal(model.textureUrl, "/data/imagery/nasa-moon-8k.jpg");
  assert.equal(model.indices.length, 3047424);
});

test("offline gzip/base64 loader makes no network requests", async (t) => {
  t.mock.method(globalThis, "fetch", () => { throw new Error("Offline must not fetch"); });
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  const encoded = { metadata: metadata as NasaModelMetadata, meshGzipBase64: gzip.toString("base64"), textureDataUrl: `data:image/jpeg;base64,${jpeg.toString("base64")}` };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { __SOLARREACH_NASA_MODEL__: encoded } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, "window", previous); else Reflect.deleteProperty(globalThis, "window"); });
  const model = await loadNasaModel();
  assert.equal(model.textureUrl, encoded.textureDataUrl);
  assert.equal(model.positions.length / 3, 507906);
  encoded.meshGzipBase64 = "%%%";
  await assert.rejects(loadNasaModel(), /base64/);
  encoded.meshGzipBase64 = Buffer.alloc(gzip.length).toString("base64");
  await assert.rejects(loadNasaModel(), /decompression failed/);
});

test("loader reports HTTP, metadata disagreement, missing gzip support and cancellation", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => new Response("missing", { status: 404 }));
  await assert.rejects(loadNasaModel(), /HTTP 404/);
  fetchMock.mock.mockImplementation(async (url) => new Response(String(url).endsWith(".json") ? JSON.stringify({ ...metadata, scale: { ...metadata.scale, referenceRadiusKm: 1 } }) : arrayBuffer(gzip)));
  await assert.rejects(loadNasaModel(), /metadata disagree/);
  const previous = Object.getOwnPropertyDescriptor(globalThis, "DecompressionStream");
  Object.defineProperty(globalThis, "DecompressionStream", { configurable: true, value: undefined });
  try { await assert.rejects(loadNasaModel(), /requires gzip DecompressionStream/); }
  finally { if (previous) Object.defineProperty(globalThis, "DecompressionStream", previous); }
  fetchMock.mock.mockImplementation(async (url) => new Response(String(url).endsWith(".json") ? JSON.stringify(metadata) : arrayBuffer(gzip)));
  const abort = new AbortController(); abort.abort();
  await assert.rejects(loadNasaModel({ signal: abort.signal }), { name: "AbortError" });
});
