import assert from "node:assert/strict";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { build } from "esbuild";
import { BufferGeometry, Group, Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera, Vector2, type WebGLRenderer } from "three";
import type { Tile, Tileset } from "3d-tiles-renderer/core";
import type { IonMoon, IonMoonOptions } from "../../components/workbench/scene/ion/create-ion-moon";
import type { IonTilesRenderer } from "../../components/workbench/scene/ion/pinned-runtime";
import type { AbortableDracoLoader } from "../../components/workbench/scene/ion/pinned-runtime";

type Api = {
  createIonMoon(options: IonMoonOptions): IonMoon;
  IonTilesRenderer: typeof IonTilesRenderer;
  AbortableDracoLoader: typeof AbortableDracoLoader;
  configureIonLimits: typeof import("../../lib/ion/limits").configureIonLimits;
};
const compiled = build({
  stdin: { contents: `export * from './components/workbench/scene/ion/create-ion-moon'; export * from './components/workbench/scene/ion/pinned-runtime'; export * from './lib/ion/limits';`, resolveDir: process.cwd(), loader: "ts" },
  bundle: true, write: false, platform: "node", format: "cjs", external: ["three"],
}).then(result => {
  const output = { exports: {} };
  new Function("require", "module", "exports", result.outputFiles[0].text)(createRequire(resolve("package.json")), output, output.exports);
  return output.exports as Api;
});

function options(): IonMoonOptions {
  return {
    camera: new PerspectiveCamera(60, 2, 0.001, 10000),
    renderer: { getSize: (target: Vector2) => target.set(800, 400) } as WebGLRenderer,
    lat: -89, lon: 179, referenceRadiusKm: 1737.4, accessToken: "fixture",
  };
}

async function environment(run: () => Promise<void>) {
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalRaf = globalThis.requestAnimationFrame, originalCancel = globalThis.cancelAnimationFrame;
  let id = 0;
  globalThis.requestAnimationFrame = () => ++id;
  globalThis.cancelAnimationFrame = () => {};
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { href: "https://app.invalid/" } } });
  globalThis.fetch = async () => { throw new Error("Unexpected request in network-free test."); };
  try { await run(); }
  finally {
    globalThis.fetch = originalFetch;
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.cancelAnimationFrame = originalCancel;
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

function engine(moon: IonMoon): IonTilesRenderer {
  return (moon.group.children[0] as Group & { tilesRenderer: IonTilesRenderer }).tilesRenderer;
}

test("factory is inert; explicit update starts one abortable endpoint request; dispose prevents late initialization", async () => environment(async () => {
  const api = await compiled;
  let requests = 0, signal: AbortSignal | null | undefined;
  let finish!: (value: Response) => void;
  globalThis.fetch = async (_url, init) => {
    requests++; signal = init?.signal;
    return new Promise<Response>(resolveResponse => { finish = resolveResponse; });
  };
  const moon = api.createIonMoon(options());
  assert.equal(requests, 0); assert.equal(moon.status.phase, "idle"); assert.equal(moon.ready, false);
  const group = moon.group;
  moon.update(); moon.update();
  assert.equal(requests, 1); assert.equal(moon.status.fallbackRequired, true);
  const tiles = engine(moon);
  assert.equal(tiles.errorTarget, 2);
  moon.dispose(); moon.dispose();
  assert.equal(signal?.aborted, true);
  finish(Response.json({ type: "3DTILES", url: "https://tiles.invalid/root.json", accessToken: "provider-fixture" }));
  await setImmediate();
  assert.equal(requests, 1); assert.equal(moon.group, group); assert.equal(group.children.length, 0);
  assert.equal(moon.status.phase, "disposed"); assert.equal(moon.ready, false);
}));

test("root download is not readiness; visible tiles control fallback and reframing reuses the renderer", async () => environment(async () => {
  const api = await compiled;
  let requests = 0;
  globalThis.fetch = async () => { requests++; return new Promise<Response>(() => {}); };
  const moon = api.createIonMoon(options());
  moon.update();
  const tiles = engine(moon), group = moon.group;
  assert.equal(moon.ready, false);
  const tile = {} as Tile;
  tiles.visibleTiles.add(tile);
  moon.update();
  assert.equal(moon.ready, true); assert.equal(moon.status.fallbackRequired, false);
  tiles.visibleTiles.delete(tile);
  moon.update();
  assert.equal(moon.ready, false);
  moon.setFrame(-90, -180, 1736);
  moon.update();
  assert.equal(engine(moon), tiles); assert.equal(moon.group, group); assert.equal(requests, 1);
  const inverse = (tiles.group as Group & { matrixWorldInverse: Matrix4 }).matrixWorldInverse;
  inverse.clone().multiply(tiles.group.matrixWorld).elements.forEach((value, i) =>
    assert.ok(Math.abs(value - new Matrix4().elements[i]) < 1e-8));
  moon.dispose();
}));

test("endpoint and malformed-provider failures produce safe terminal fallback, with no raw error logging", async () => environment(async () => {
  const api = await compiled;
  const originalError = console.error;
  const errors: unknown[][] = [];
  console.error = (...args) => { errors.push(args); };
  try {
    for (const response of [new Response("rejected", { status: 401 }), Response.json({ type: "UNSUPPORTED" }), Response.json({ type: "3DTILES", url: "not-a-url" })]) {
      globalThis.fetch = async () => response;
      const moon = api.createIonMoon(options());
      moon.update();
      await setImmediate();
      assert.equal(moon.status.phase, "error"); assert.equal(moon.status.fallbackRequired, true);
      assert.equal(JSON.stringify(moon.status).includes("fixture"), false);
      assert.match(moon.status.error!, /connectivity/);
      assert.equal(moon.group.children.length, 0);
      moon.dispose();
    }
    assert.deepEqual(errors, []);
  } finally { console.error = originalError; }
}));

test("empty configuration and invalid frame never initialize; callback exceptions cannot prevent disposal", async () => environment(async () => {
  const api = await compiled;
  let requests = 0;
  globalThis.fetch = async () => { requests++; throw new Error("not expected"); };
  const moon = api.createIonMoon({ ...options(), accessToken: "", onStatus: () => { throw new Error("parent handler"); } });
  moon.update(); assert.equal(moon.status.phase, "error"); assert.equal(requests, 0); moon.dispose();
  const other = api.createIonMoon(options());
  other.setFrame(NaN, 0, 1); other.update(); assert.equal(requests, 0); assert.equal(other.ready, false); other.dispose();
}));

test("owned cache and queues enforce 300 tiles / 128 MiB, four total downloads and one parse", async () => environment(async () => {
  const api = await compiled;
  const tiles = new api.IonTilesRenderer(() => assert.fail("unexpected tile error"));
  api.configureIonLimits(tiles, () => assert.fail("unexpected queue error"));
  const cache = tiles.lruCache;
  const items = Array.from({ length: 301 }, () => ({}));
  for (const item of items.slice(0, 300)) assert.equal(cache.add(item, () => {}), true);
  assert.equal(cache.add(items[300], () => {}), false);
  for (const item of items) cache.remove(item);
  cache.add(items[0], () => {}); cache.setMemoryUsage(items[0], 128 * 1024 * 1024);
  assert.equal(cache.isFull(), true); assert.equal(cache.add(items[1], () => {}), false); cache.remove(items[0]);
  let active = 0, max = 0;
  const completions: (() => void)[] = [];
  const jobs = items.slice(0, 8).map((item, i) => tiles.downloadQueue.add(`https://host-${i}.invalid/`, item, () => {
    active++; max = Math.max(max, active);
    return new Promise<void>(finish => { completions.push(() => { active--; finish(); }); });
  }));
  assert.equal(tiles.downloadQueue.originQueues.size, 1);
  const queue = [...tiles.downloadQueue.originQueues.values()][0];
  queue.tryRunJobs(); assert.equal(max, 4); assert.equal(completions.length, 4);
  completions.splice(0).forEach(finish => finish()); await setImmediate();
  queue.tryRunJobs(); completions.splice(0).forEach(finish => finish()); await Promise.all(jobs);
  assert.equal(max, 4); assert.equal(tiles.parseQueue.maxJobs, 1); tiles.dispose();
}));

test("aborted late tile parses dispose geometry/materials missed by the pinned renderer", async () => environment(async () => {
  const api = await compiled;
  let failures = 0;
  const tiles = new api.IonTilesRenderer(() => failures++);
  let finish!: (scene: Group) => void;
  tiles.registerPlugin({ parseToMesh: () => new Promise<Group>(resolveScene => { finish = resolveScene; }) });
  const geometry = new BufferGeometry(), material = new MeshBasicMaterial();
  let geometries = 0, materials = 0;
  geometry.addEventListener("dispose", () => geometries++); material.addEventListener("dispose", () => materials++);
  const scene = new Group(); scene.add(new Mesh(geometry, material));
  const tile = { engineData: { transform: new Matrix4() } } as unknown as Tile;
  const abort = new AbortController();
  const parsing = tiles.parseTile(new ArrayBuffer(4), tile, "fixture", "https://tiles.invalid/content", abort.signal);
  abort.abort(); tiles.dispose(); finish(scene); await parsing;
  assert.equal(geometries, 1); assert.equal(materials, 1); assert.equal(failures, 0);
}));

test("pinned root API parses mocked Moon body tileset without contacting a service", async () => environment(async () => {
  const api = await compiled;
  let requests = 0;
  // Wire JSON has no renderer-managed Tile fields until preprocessing.
  const root = { asset: { version: "1.0" }, geometricError: 100, root: { boundingVolume: { sphere: [0, 0, 0, 1737400] }, geometricError: 100, children: [] } } as unknown as Tileset;
  globalThis.fetch = async () => {
    requests++;
    return Response.json(requests === 1 ? { type: "3DTILES", url: "https://tiles.invalid/root.json", accessToken: "provider-fixture", attributions: [{ html: "NASA / USGS / Cesium", collapsible: false }, { html: "fixture provider-fixture", collapsible: false }] } : root);
  };
  const moon = api.createIonMoon(options()); moon.update(); await setImmediate();
  const tiles = engine(moon);
  assert.equal(requests, 2); assert.ok(tiles.root); assert.equal(moon.ready, false);
  tiles.visibleTiles.add(tiles.root!);
  assert.ok(moon.attribution.some(credit => credit.value.includes("NASA / USGS / Cesium")));
  assert.equal(JSON.stringify(moon.attribution).includes("fixture"), false);
  tiles.visibleTiles.clear(); moon.dispose();
}));

test("decoder fetch is lazy, uses the chosen directory and is aborted without starting a stale worker", async () => environment(async () => {
  const api = await compiled;
  const abort = new AbortController();
  let requests = 0, requestSignal: AbortSignal | null | undefined;
  let finish!: (response: Response) => void;
  globalThis.fetch = async (url, init) => {
    requests++; requestSignal = init?.signal;
    assert.equal(url, "/chosen/draco/draco_decoder.js");
    return new Promise<Response>(resolveResponse => { finish = resolveResponse; });
  };
  const loader = new api.AbortableDracoLoader("/chosen/draco/", abort.signal);
  assert.equal(requests, 0);
  const pending = loader._initDecoder();
  assert.equal(requests, 1);
  abort.abort(); loader.dispose();
  assert.equal(requestSignal?.aborted, true);
  finish(new Response("unused decoder fixture"));
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(requests, 1);
}));

test("terminal tile/parse failures hide streamed output and clear pending work without logging provider data", async () => environment(async () => {
  const api = await compiled;
  globalThis.fetch = async () => new Promise<Response>(() => {});
  const moon = api.createIonMoon(options()); moon.update();
  const tiles = engine(moon);
  const parseItem = {}, downloadItem = {};
  tiles.parseQueue.autoUpdate = false;
  // Match the pinned renderer, which ignores this deferred-node promise.
  tiles.processNodeQueue.add({}, () => assert.fail("stale node expansion ran"));
  const pendingParse = tiles.parseQueue.add(parseItem, () => assert.fail("stale parse ran"));
  const pendingDownload = tiles.downloadQueue.add("https://tiles.invalid/", downloadItem, () => assert.fail("stale download ran"));
  // Attach rejection handlers before disposal drains either queue.
  const cancelledParse = assert.rejects(pendingParse, { name: "AbortError" });
  const cancelledDownload = assert.rejects(pendingDownload, { name: "AbortError" });
  tiles.dispatchEvent({ type: "load-error", tile: null, url: "https://provider.invalid/", error: new Error("provider detail") });
  await setImmediate(); await Promise.all([cancelledParse, cancelledDownload]);
  assert.equal(moon.status.phase, "error"); assert.equal(moon.group.visible, false); assert.equal(moon.ready, false);
  assert.equal(tiles.parseQueue.has(parseItem), false); assert.equal(tiles.downloadQueue.has(downloadItem), false);
  assert.equal(JSON.stringify(moon.status).includes("provider detail"), false);
  const status = moon.status;
  tiles.dispatchEvent({ type: "load-error", tile: null, url: "", error: new Error("stale") });
  moon.update(); assert.equal(moon.status, status); moon.dispose();
}));

test("normal cached tile disposal releases actual parsed geometry and materials", async () => environment(async () => {
  const api = await compiled;
  const tiles = new api.IonTilesRenderer(() => assert.fail("unexpected parse failure"));
  api.configureIonLimits(tiles, () => assert.fail("unexpected queue error"));
  globalThis.fetch = async () => new Response(new Uint8Array([0, 0, 0, 0]));
  const geometry = new BufferGeometry(), material = new MeshBasicMaterial();
  let geometries = 0, materials = 0;
  geometry.addEventListener("dispose", () => geometries++); material.addEventListener("dispose", () => materials++);
  const scene = new Group(); scene.add(new Mesh(geometry, material));
  tiles.registerPlugin({ parseToMesh: () => scene });
  const json = { asset: { version: "1.0" }, geometricError: 10, root: { boundingVolume: { sphere: [0, 0, 0, 100] }, geometricError: 10, content: { uri: "content.fixture" } } } as unknown as Tileset;
  tiles.preprocessTileset(json, "https://tiles.invalid/root.json");
  Object.assign(tiles, { rootTileset: json });
  const pending = (tiles as IonTilesRenderer & { requestTileContents(tile: Tile): Promise<void> }).requestTileContents(json.root);
  for (const queue of tiles.downloadQueue.originQueues.values()) queue.tryRunJobs();
  await setImmediate(); tiles.parseQueue.tryRunJobs(); await pending;
  assert.equal(tiles.lruCache.has(json.root), true);
  assert.equal(geometries, 0); assert.equal(materials, 0);
  tiles.dispose(); tiles.dispose();
  assert.equal(tiles.lruCache.has(json.root), false);
  assert.equal(geometries, 1); assert.equal(materials, 1);
}));
