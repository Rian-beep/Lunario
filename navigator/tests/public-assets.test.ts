import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as T from "three";
import { publicAssetURL } from "../lib/public-assets";
import { loadCatalog } from "../lib/catalog";
import { loadImagery } from "../lib/imagery";
import { loadGlobalTerrain } from "../lib/global-terrain";
import { loadNasaModel } from "../lib/nasa-model";
import { equipmentUrl, LANDER_ASSET } from "../lib/equipment";
import { celestialAssetUrl, CELESTIAL_ASSETS } from "../lib/celestial-assets";
import { dsnEarthTextureUrl, DSN_EARTH_TEXTURE_PATH } from "../lib/dsn";
import { acquireMoonAtlas } from "../lib/moon-atlas-texture";

function hosted(uri = "https://example.org/nested/Lunario/web/index.html?scenario=kept#view") {
  const keys = ["document", "__LUNARIO_PUBLIC_BASE__"];
  const saved = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    documentURI: uri, baseURI: "https://untrusted.example/ignored-base-tag/",
  } });
  globalThis.__LUNARIO_PUBLIC_BASE__ = "../navigator/public/";
  return () => keys.forEach((key, i) => {
    if (saved[i]) Object.defineProperty(globalThis, key, saved[i]!);
    else Reflect.deleteProperty(globalThis, key);
  });
}
const base = "https://example.org/nested/Lunario/navigator/public/";

test("Next default and embedded/external URLs preserve their exact transport strings", () => {
  assert.equal(publicAssetURL("/data/catalog.json"), "/data/catalog.json");
  const restore = hosted();
  try {
    for (const url of ["https://nasa.gov/a?x=1#credit", "http://localhost:4317/a", "//cdn.example/a", "data:image/svg+xml,<svg xmlns='x' />", "blob:https://example.org/id"]) {
      assert.equal(publicAssetURL(url), url);
    }
    // Embedded transports are usable even if a hosted configuration is invalid.
    globalThis.__LUNARIO_PUBLIC_BASE__ = "javascript:bad";
    assert.equal(publicAssetURL("data:image/jpeg;base64,abc"), "data:image/jpeg;base64,abc");
  } finally { restore(); }
});

test("nested Pages asset paths use documentURI, leave scenario state and source strings unchanged", () => {
  const restore = hosted();
  try {
    for (const path of ["/data/catalog.json", "/data/global-terrain.bin.gz", "/fonts/lunario/geist-var.woff2", "/data/equipment/draco/"]) {
      assert.equal(publicAssetURL(path), base + path.slice(1));
    }
    assert.match(document.documentURI, /\?scenario=kept#view$/);
    globalThis.__LUNARIO_PUBLIC_BASE__ = base;
    assert.equal(publicAssetURL("/data/a"), base + "data/a");
    globalThis.__LUNARIO_PUBLIC_BASE__ = "/nested/Lunario/navigator/public/";
    assert.equal(publicAssetURL("/data/a"), base + "data/a");
  } finally { restore(); }
});

test("traversal, unsafe schemes and invalid bases fail before a network request", () => {
  const restore = hosted();
  try {
    for (const path of ["", "data/catalog.json", "/data/../private", "/data/./a", "/data/%2e%2e/a", "/data/a\\b", "/data/a?x=b", "/data/a#x", "/data/a\nb", "javascript:alert(1)", "/javascript:alert(1)", "/data:abc", "file:///private", "/data//a"]) {
      assert.throws(() => publicAssetURL(path), Error, path);
    }
    for (const config of ["", "../navigator/public", "../../public/", "../data/../public/", "../%2e%2e/", "../public\\/", "../public/?x=y", "../public/#a", "//evil.org/public/", "https://evil.org/public/", "https://user:pass@example.org/public/", "file:///tmp/", "https:public/", "data:text/plain,bad/", " ../public/"]) {
      globalThis.__LUNARIO_PUBLIC_BASE__ = config;
      assert.throws(() => publicAssetURL("/data/a"), Error, config);
    }
    Reflect.set(globalThis, "__LUNARIO_PUBLIC_BASE__", null);
    assert.throws(() => publicAssetURL("/data/a"));
    Reflect.deleteProperty(globalThis, "document");
    globalThis.__LUNARIO_PUBLIC_BASE__ = "../navigator/public/";
    assert.throws(() => publicAssetURL("/data/a"), /document URI/);
  } finally { restore(); }
  assert.throws(() => publicAssetURL("/data/../a"));
});

test("catalog/imagery fetch only transport URLs, with imagery coalescing and failure retry preserved", async () => {
  const restore = hosted(), original = globalThis.fetch;
  const raw = JSON.parse(await readFile(new URL("../public/data/catalog.json", import.meta.url), "utf8"));
  const images = JSON.parse(await readFile(new URL("../public/data/imagery.json", import.meta.url), "utf8"));
  const requests: string[] = []; let fail = true;
  globalThis.fetch = async input => {
    const url = String(input); requests.push(url);
    if (url === base + "data/catalog.json") return Response.json(raw);
    assert.equal(url, base + "data/imagery.json");
    if (fail) return new Response(null, { status: 503 });
    return Response.json(images);
  };
  try {
    const catalog = await loadCatalog();
    assert.equal(catalog.map.url, raw.map.url);
    assert.ok(catalog.map.url.startsWith("/data/"));
    const first = loadImagery(), second = loadImagery();
    assert.equal(first, second);
    await assert.rejects(first, /imagery unavailable/); fail = false;
    const [a, b] = await Promise.all([loadImagery(), loadImagery()]);
    assert.equal(a, b); assert.deepEqual(a, images);
    assert.equal(requests.length, 3);
    assert.equal(await loadImagery(), a); assert.equal(requests.length, 3);
  } finally { globalThis.fetch = original; restore(); }
});

test("global and NASA nested binary fetches preserve canonical metadata, signal and validation paths", async () => {
  const restore = hosted(), original = globalThis.fetch;
  const global = JSON.parse(await readFile(new URL("../public/data/global-terrain.json", import.meta.url), "utf8"));
  const nasa = JSON.parse(await readFile(new URL("../public/data/nasa-model.json", import.meta.url), "utf8"));
  const requests: string[] = [], controller = new AbortController();
  globalThis.fetch = async (input, options) => {
    const url = String(input); requests.push(url);
    if (url.includes("nasa-")) assert.equal(options?.signal, controller.signal);
    if (url === base + "data/global-terrain.json") return Response.json(global);
    if (url === base + "data/nasa-model.json") return Response.json(nasa);
    assert.ok([base + global.packed.url.slice(1), base + nasa.mesh.url.slice(1)].includes(url));
    return new Response(null, { status: 503 });
  };
  try {
    await assert.rejects(loadGlobalTerrain(), /terrain asset unavailable/);
    await assert.rejects(loadGlobalTerrain(), /terrain asset unavailable/);
    await assert.rejects(loadNasaModel({ signal: controller.signal }), /HTTP 503/);
    assert.equal(requests.length, 6);
    assert.equal(global.packed.url, "/data/global-terrain.bin.gz");
    assert.equal(nasa.mesh.url, "/data/nasa-moon-mesh.bin.gz");
  } finally { globalThis.fetch = original; restore(); }
});

test("equipment, Draco, DSN, celestial and shared atlas resolve I/O without changing identities", async () => {
  const restore = hosted(), original = T.TextureLoader.prototype.load;
  const requests: string[] = [];
  T.TextureLoader.prototype.load = function (url, onLoad) {
    requests.push(url); const texture = new T.Texture<HTMLImageElement>();
    queueMicrotask(() => onLoad?.(texture)); return texture;
  };
  try {
    assert.equal(equipmentUrl(LANDER_ASSET.path), base + LANDER_ASSET.path.slice(1));
    assert.equal(equipmentUrl("/data/equipment/draco/draco_decoder.js"), base + "data/equipment/draco/draco_decoder.js");
    assert.equal(celestialAssetUrl("earth"), base + CELESTIAL_ASSETS.earth.path.slice(1));
    assert.equal(dsnEarthTextureUrl(), base + DSN_EARTH_TEXTURE_PATH.slice(1));
    const a = acquireMoonAtlas("/data/imagery/nasa-moon-8k.jpg", 4);
    const b = acquireMoonAtlas("/data/imagery/nasa-moon-8k.jpg", 4);
    await Promise.all([a.ready, b.ready]); a.release(); b.release();
    assert.deepEqual(requests, [base + "data/imagery/nasa-moon-8k.jpg"]);
    assert.equal(LANDER_ASSET.path, "/data/equipment/apollo-lunar-module.glb");
    assert.equal(CELESTIAL_ASSETS.earth.path, "/data/celestial-models/assets/earth.glb");
  } finally { T.TextureLoader.prototype.load = original; restore(); }
});

test("terrain, provenance and demo error paths resolve hosted transport and terrain failures remain retryable", async () => {
  const { loadTerrain } = await import("../lib/terrain");
  const { loadEvidenceManifest } = await import("../lib/provenance");
  const { loadPlanningDemo } = await import("../lib/planning-demo-loader");
  const restore = hosted(), original = globalThis.fetch, requests: string[] = [];
  globalThis.fetch = async input => { requests.push(String(input)); return new Response(null, { status: 503 }); };
  try {
    const a = loadTerrain(), b = loadTerrain(); assert.equal(a, b);
    await assert.rejects(a, /terrain could not be loaded/);
    await assert.rejects(loadTerrain(), /terrain could not be loaded/);
    await assert.rejects(loadEvidenceManifest(), /manifest unavailable/);
    // Fetch failure precedes access to these inputs; no fabricated scientific fixture.
    await assert.rejects(loadPlanningDemo(null as never, null as never), /demonstration could not load/);
    assert.deepEqual(requests, [base + "data/terrain.json", base + "data/terrain.json", base + "data/evidence-manifest.json", base + "data/planning-demo.json"]);
  } finally { globalThis.fetch = original; restore(); }
});
