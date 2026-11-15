import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import vm from "node:vm";
import * as T from "three";
import { equipmentUrl, LANDER_ASSET, normalizeEquipment } from "../lib/equipment";
import { createLander } from "../components/workbench/scene/vehicle";

test("NASA source is pinned, self-contained and every Draco mesh decodes locally", async () => {
  const bytes = await readFile(new URL("../public/data/equipment/apollo-lunar-module.glb", import.meta.url));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), LANDER_ASSET.sha256);
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  const jsonSize = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonSize).toString());
  assert.ok(gltf.images.every((image: { uri?: string }) => !image.uri));
  assert.ok(gltf.buffers.every((buffer: { uri?: string }) => !buffer.uri));
  const code = await readFile(new URL("../public/data/equipment/draco/draco_decoder.js", import.meta.url), "utf8");
  const context = vm.createContext({ console, TextDecoder, setTimeout, clearTimeout });
  vm.runInContext(code, context);
  const dracoModule = await context.DracoDecoderModule();
  const binOffset = 20 + jsonSize + 8;
  let count = 0;
  for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
    const view = gltf.bufferViews[primitive.extensions.KHR_draco_mesh_compression.bufferView];
    const compressed = bytes.subarray(binOffset + (view.byteOffset ?? 0), binOffset + (view.byteOffset ?? 0) + view.byteLength);
    const decoder = new dracoModule.Decoder(), buffer = new dracoModule.DecoderBuffer(), geometry = new dracoModule.Mesh();
    buffer.Init(new Int8Array(compressed), compressed.length);
    const result = decoder.DecodeBufferToMesh(buffer, geometry);
    assert.ok(result.ok(), result.error_msg());
    assert.ok(geometry.num_points() > 0);
    dracoModule.destroy(geometry); dracoModule.destroy(buffer); dracoModule.destroy(decoder);
    count++;
  }
  assert.ok(count > 50, "the actual multi-part NASA mesh was decoded");
});
test("normalization keeps feet on ground, Y up and metre geometry before runtime km scale", () => {
  const model = new T.Mesh(new T.BoxGeometry(4, 10, 6));
  model.position.set(2, 20, -5);
  const normalized = normalizeEquipment(model);
  const bounds = new T.Box3().setFromObject(normalized);
  assert.equal(bounds.min.y, 0);
  assert.equal(bounds.max.y, 7);
  assert.equal(bounds.getCenter(new T.Vector3()).x, 0);
  assert.throws(() => normalizeEquipment(new T.Group()), /invalid display bounds/);
});
test("embedded assets override local paths without intercepting embedded texture blobs", () => {
  globalThis.__SOLARREACH_EQUIPMENT__ = { [LANDER_ASSET.path]: "data:model/gltf-binary;base64,AAAA" };
  assert.equal(equipmentUrl(LANDER_ASSET.path), "data:model/gltf-binary;base64,AAAA");
  assert.equal(equipmentUrl("blob:texture"), "blob:texture");
  delete globalThis.__SOLARREACH_EQUIPMENT__;
  assert.equal(equipmentUrl(LANDER_ASSET.path), LANDER_ASSET.path);
});
test("synchronous handle exposes loading and late async disposal releases geometry", async () => {
  const states: string[] = [];
  let resolve!: (model: T.Object3D) => void;
  const handle = createLander({ load: () => new Promise((done) => { resolve = done; }), onStatus: (state) => states.push(state) });
  assert.equal(handle.group.scale.x, 0.001);
  assert.equal(handle.group.children.length, 1, "no procedural fallback spacecraft");
  handle.dispose();
  const mesh = new T.Mesh(new T.BoxGeometry(), new T.MeshBasicMaterial());
  let disposed = false;
  mesh.geometry.addEventListener("dispose", () => { disposed = true; });
  resolve(mesh);
  await handle.ready;
  assert.equal(disposed, true);
  assert.deepEqual(states, ["loading", "disposed"]);
});
test("asset failure produces explicit error without procedural replacement", async () => {
  const original = console.error;
  console.error = () => {};
  try {
    const handle = createLander({ load: async () => { throw new Error("missing asset"); } });
    await handle.ready;
    assert.equal(handle.group.userData.equipmentStatus, "error");
    assert.equal(handle.group.userData.equipmentError, "missing asset");
    assert.equal(handle.group.children.length, 1);
    handle.dispose();
  } finally { console.error = original; }
});
test("successful loading adds the real asset group and reports ready", async () => {
  const model = new T.Group();
  const states: string[] = [];
  const handle = createLander({ load: async () => model, onStatus: (state) => states.push(state) });
  await handle.ready;
  assert.ok(handle.group.children.includes(model));
  assert.deepEqual(states, ["loading", "ready"]);
  handle.dispose();
});
test("file-open mode rejects missing embedded equipment explicitly", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "location");
  Object.defineProperty(globalThis, "location", { configurable: true, value: { protocol: "file:" } });
  try { assert.throws(() => equipmentUrl(LANDER_ASSET.path), /Offline equipment asset is missing/); }
  finally {
    if (descriptor) Object.defineProperty(globalThis, "location", descriptor);
    else Reflect.deleteProperty(globalThis, "location");
  }
});
