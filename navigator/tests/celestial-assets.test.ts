import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import * as T from "three";
import sharp from "sharp";
import { CELESTIAL_ASSETS, celestialAssetUrl, loadCelestialAsset, normalizeCelestialModel } from "../lib/celestial-assets";

test("original NASA GLB bytes are pinned with every image and buffer embedded", async () => {
  const provenance = JSON.parse(await readFile(new URL("../public/data/celestial-models/provenance.json", import.meta.url), "utf8"));
  for (const kind of ["sun", "earth"] as const) {
    const metadata = CELESTIAL_ASSETS[kind], bytes = await readFile(new URL(`../public${metadata.path}`, import.meta.url));
    assert.equal(bytes.length, metadata.bytes); assert.ok(bytes.length < 20_000_000);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), metadata.sha256);
    assert.equal(provenance.assets.find((asset: { kind: string }) => asset.kind === kind).sha256, metadata.sha256);
    assert.equal(bytes.readUInt32LE(0), 0x46546c67); assert.equal(bytes.readUInt32LE(4), 2); assert.equal(bytes.readUInt32LE(8), bytes.length);
    const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    assert.ok(gltf.images.length > 0); assert.ok(gltf.meshes.length > 0);
    assert.ok(gltf.images.every((image: { uri?: string; bufferView?: number }) => !image.uri && Number.isInteger(image.bufferView)));
    assert.ok(gltf.buffers.every((buffer: { uri?: string }) => !buffer.uri));
    assert.deepEqual(gltf.extensionsRequired ?? [], [], "these specific models require no external decoder");
  }
});
/** Actual GLTFLoader, geometry and PNG decoding; only GPU bitmap allocation is substituted in Node. */
async function withNodeImages(run: (state: { decoded: number; closed: number; requests: string[] }) => Promise<void>, onImage?: () => void) {
  const saved = new Map(["self", "createImageBitmap", "ProgressEvent"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const originalFetch = globalThis.fetch, state = { decoded: 0, closed: 0, requests: [] as string[] };
  Object.defineProperty(globalThis, "self", { configurable: true, value: globalThis });
  Object.defineProperty(globalThis, "createImageBitmap", { configurable: true, value: async (blob: Blob) => {
    const { info } = await sharp(Buffer.from(await blob.arrayBuffer())).raw().toBuffer({ resolveWithObject: true });
    state.decoded++; onImage?.();
    return { width: info.width, height: info.height, close() { state.closed++; } };
  } });
  Object.defineProperty(globalThis, "ProgressEvent", { configurable: true, value: class extends Event { constructor(type: string) { super(type); } } });
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    state.requests.push(url);
    if (url.startsWith("blob:")) return originalFetch(input, init);
    const metadata = Object.values(CELESTIAL_ASSETS).find((asset) => asset.path === url);
    assert.ok(metadata, `Unexpected external dependency: ${url}`);
    const bytes = await readFile(new URL(`../public${metadata.path}`, import.meta.url));
    return new Response(bytes, { headers: { "Content-Type": "model/gltf-binary" } });
  };
  try { await run(state); }
  finally {
    globalThis.fetch = originalFetch;
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
}
test("real Sun and Earth geometry loads, PNG textures decode, bounds normalize and disposal closes all images once", async () => {
  await withNodeImages(async (state) => {
    for (const kind of ["sun", "earth"] as const) {
      const handle = await loadCelestialAsset(kind);
      const box = new T.Box3().setFromObject(handle.group), size = box.getSize(new T.Vector3());
      assert.ok(Math.abs(Math.max(size.x, size.y, size.z) - 2) < 1e-6);
      assert.ok(box.getCenter(new T.Vector3()).length() < 1e-6);
      let vertices = 0, textureCount = 0;
      handle.group.traverse((object) => {
        const mesh = object as T.Mesh;
        if (!mesh.isMesh) return;
        vertices += mesh.geometry.getAttribute("position").count;
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) for (const value of Object.values(material)) if ((value as T.Texture | null)?.isTexture) textureCount++;
      });
      assert.ok(vertices > 1000); assert.ok(textureCount >= 1); assert.equal(handle.metadata, CELESTIAL_ASSETS[kind]);
      handle.dispose(); const closed = state.closed; handle.dispose(); assert.equal(state.closed, closed);
    }
    assert.equal(state.decoded, 3); assert.equal(state.closed, 3);
    assert.ok(state.requests.every((url) => url.startsWith("/data/celestial-models/") || url.startsWith("blob:")));
  });
});
test("abort during real texture decode disposes the late model and pre-aborted requests do not fetch", async () => {
  const controller = new AbortController();
  await withNodeImages(async (state) => {
    await assert.rejects(loadCelestialAsset("sun", controller.signal), { name: "AbortError" });
    assert.equal(state.decoded, 1); assert.equal(state.closed, 1);
    const calls = state.requests.length;
    await assert.rejects(loadCelestialAsset("earth", controller.signal), { name: "AbortError" });
    assert.equal(state.requests.length, calls);
  }, () => controller.abort());
});
test("missing local models fail explicitly and offline embedding never guesses a remote substitute", async () => {
  const oldFetch = globalThis.fetch, descriptor = Object.getOwnPropertyDescriptor(globalThis, "location");
  try {
    globalThis.fetch = async () => new Response("missing", { status: 404 });
    await assert.rejects(loadCelestialAsset("earth"), /unavailable \(404\)/);
    Object.defineProperty(globalThis, "location", { configurable: true, value: { protocol: "file:" } });
    assert.throws(() => celestialAssetUrl("sun"), /Offline NASA Sun model is missing/);
    globalThis.__SOLARREACH_CELESTIAL_MODELS__ = { [CELESTIAL_ASSETS.sun.path]: "data:model/gltf-binary;base64,AAAA" };
    assert.equal(celestialAssetUrl("sun"), "data:model/gltf-binary;base64,AAAA");
    assert.throws(() => celestialAssetUrl("mars" as "sun"), /Unknown celestial asset/);
    assert.throws(() => normalizeCelestialModel(new T.Group(), CELESTIAL_ASSETS.sun), /invalid bounds/);
  } finally {
    globalThis.fetch = oldFetch; delete globalThis.__SOLARREACH_CELESTIAL_MODELS__;
    if (descriptor) Object.defineProperty(globalThis, "location", descriptor); else Reflect.deleteProperty(globalThis, "location");
  }
});
test("complete bounded source inventories distinguish original Git textures/data from official model downloads", async () => {
  const inventory = JSON.parse(await readFile(new URL("../public/data/celestial-models/inventory.json", import.meta.url), "utf8"));
  const branches = JSON.parse(await readFile(new URL("../public/data/celestial-models/source-git/original-branches.json", import.meta.url), "utf8"));
  assert.equal(inventory.nasaGit.revision, "11ebb4ee043715aefbba6aeec8a61746fad67fa7");
  assert.equal(inventory.nasaGit.treeTruncated, false); assert.ok(inventory.nasaGit.totalBlobBytes > 4e9);
  assert.equal(branches.length, 10); assert.ok(branches.every((branch: { truncated: boolean }) => branch.truncated === false));
  assert.deepEqual(inventory.originalGit.glbOrGltfFiles, []);
  assert.equal(inventory.originalGit.terrainSummary.rows, 432); assert.equal(inventory.originalGit.terrainSummary.analysisResolutionM, 80);
  assert.ok(Object.values(inventory.originalGit.sharedScienceFiles).every((value) => (value as { gitBlobs: string[] }).gitBlobs.length === 1));
});

test('renderer handoffs share pinned source bytes while one canceled view cannot abort its successor',async()=>{
 const controller=new AbortController();
 await withNodeImages(async(state)=>{
  const first=loadCelestialAsset('earth',controller.signal),second=loadCelestialAsset('earth');controller.abort();
  await assert.rejects(first,{name:'AbortError'});const ready=await second;
  assert.equal(state.requests.filter(url=>url===CELESTIAL_ASSETS.earth.path).length,1);
  assert.ok(ready.group.children.length>0);ready.dispose();
 });
});

test('a canceled caller settles before a shared download finishes while its successor can complete',async()=>{
 await withNodeImages(async()=>{
  const transport=globalThis.fetch;let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  globalThis.fetch=async(input,init)=>{if(String(input)===CELESTIAL_ASSETS.earth.path)await gate;return transport(input,init);};
  const controller=new AbortController(),first=loadCelestialAsset('earth',controller.signal);controller.abort();
  await assert.rejects(first,{name:'AbortError'});
  const successor=loadCelestialAsset('earth');release();const asset=await successor;assert.ok(asset.group.children.length);asset.dispose();
 });
});
