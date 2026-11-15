import assert from "node:assert/strict";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { build } from "esbuild";
import { BufferGeometry, DoubleSide, Group, Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, Quaternion, Vector2, Vector3, type WebGLRenderer } from "three";
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

type RuntimeTile = Tile & { engineData: { scene: Group | null } };
type TestRenderer = IonTilesRenderer & {
  requestTileContents(tile: Tile): Promise<void>;
  ensureChildrenArePreprocessed(tile: Tile, forceImmediate: boolean): void;
  setTileActive(tile: Tile, active: boolean): void;
  setTileVisible(tile: Tile, visible: boolean): void;
  raycast: (raycaster: unknown, intersects: unknown[]) => void;
  stats: { loaded: unknown };
};

async function loadTile(tiles: IonTilesRenderer, tile: Tile) {
  const pending = (tiles as TestRenderer).requestTileContents(tile);
  for (const queue of tiles.downloadQueue.originQueues.values()) queue.tryRunJobs();
  await setImmediate();
  tiles.parseQueue.tryRunJobs();
  await pending;
}

async function parsedSurface(lat = 0, lon = 0) {
  const api = await compiled;
  const p = lat * Math.PI / 180, l = lon * Math.PI / 180;
  const radial = new Vector3(Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p));
  const rotation = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), radial);
  const children = [1300, 300, 2300].map((height, i) => ({
    boundingVolume: { sphere: [0, 0, 0, 1000] }, geometricError: 0,
    transform: new Matrix4().compose(radial.clone().multiplyScalar(1737400 + height), rotation, new Vector3(1.2, .8, 2)).toArray(),
    content: { uri: `surface-${i}.fixture` }, children: [],
  }));
  const json = { asset: { version: "1.0" }, geometricError: 100, root: {
    boundingVolume: { sphere: [0, 0, 0, 1750000] }, geometricError: 100, children,
  } } as unknown as Tileset;
  let requests = 0;
  globalThis.fetch = async url => {
    requests++;
    if (String(url).includes("api.cesium.com")) return Response.json({ type: "3DTILES", url: "https://tiles.invalid/root.json", accessToken: "provider-fixture" });
    if (String(url).includes("root.json")) return Response.json(json);
    return new Response(new Uint8Array(4));
  };
  const settings = { ...options(), lat, lon };
  const moon = api.createIonMoon(settings);
  moon.update(); await setImmediate();
  const tiles = engine(moon) as TestRenderer;
  let geometriesDisposed = 0, materialsDisposed = 0;
  tiles.registerPlugin({ parseToMesh: () => {
    const scene = new Group(); scene.position.z = 50;
    const geometry = new PlaneGeometry(1000, 1000), material = new MeshBasicMaterial({ side: DoubleSide });
    geometry.addEventListener("dispose", () => geometriesDisposed++);
    material.addEventListener("dispose", () => materialsDisposed++);
    scene.add(new Mesh(geometry, material));
    return scene;
  } });
  const root = tiles.root!;
  root.traversal.used = true;
  tiles.ensureChildrenArePreprocessed(root, true);
  for (const tile of root.children!) {
    // Use the renderer's preprocessing, request/cache and parse paths, not mocked hits.
    await loadTile(tiles, tile);
    tile.traversal.used = true;
    tiles.setTileActive(tile, true);
    tiles.setTileVisible(tile, tile !== root.children![2]);
    Object.assign(tile.traversal, { active: true, visible: tile !== root.children![2] });
  }
  return { moon, tiles, radial, camera: settings.camera, requests: () => requests, disposed: () => [geometriesDisposed, materialsDisposed] };
}

const nearVector = (actual: Vector3 | null, expected: Vector3) => {
  assert.ok(actual, "expected an actual streamed mesh hit");
  assert.ok(actual.distanceTo(expected) < 1e-8, `${actual.toArray()} differs from ${expected.toArray()}`);
};

test("surface probe measures closest visible parsed meshes at pole and equator with current world matrices and 1 km clearance", async () => environment(async () => {
  for (const [lat, lon] of [[0, 0], [-90, 37]]) {
    const { moon, tiles, radial, camera, requests, disposed } = await parsedSurface(lat, lon);
    const parent = new Group(); parent.add(moon.group);
    // Parent changes happen after the last update; the probe must refresh matrices itself.
    parent.position.set(12, -4, 33); parent.rotation.set(.2, -.5, .3); parent.scale.setScalar(2);
    parent.updateMatrix();
    const expectedMatrix = parent.matrix.clone().multiply(moon.group.matrix);
    const direction = radial.clone().transformDirection(expectedMatrix);
    const expected = radial.clone().multiplyScalar(1738800).applyMatrix4(expectedMatrix);
    let rendererCasts = 0, meshCasts = 0;
    const originalRaycast = tiles.raycast;
    tiles.raycast = function (ray, hits) { rendererCasts++; originalRaycast.call(this, ray, hits); };
    const visibleMesh = ((tiles.root!.children![0] as RuntimeTile).engineData.scene!.children[0] as Mesh);
    const originalMeshCast = visibleMesh.raycast;
    visibleMesh.raycast = function (ray, hits) { meshCasts++; originalMeshCast.call(this, ray, hits); };
    const before = requests(), status = moon.status;
    const cameraMatrix = camera.matrixWorld.clone(), cameraPosition = camera.position.clone(), cameraProjection = camera.projectionMatrix.clone();
    const hit = moon.surfacePoint(direction.clone().multiplyScalar(7));
    nearVector(hit, expected);
    assert.equal(rendererCasts, 1); assert.equal(meshCasts, 1, "TilesGroup must stop the duplicate child traversal");
    // One physical kilometre is 1000 body metres, not 1000 scene units.
    const cameraAtOneKm = hit!.clone().addScaledVector(direction, 2);
    const bodyCamera = cameraAtOneKm.applyMatrix4(moon.group.matrixWorld.clone().invert());
    assert.ok(Math.abs(bodyCamera.length() - 1739800) < 1e-6);
    assert.deepEqual(camera.matrixWorld, cameraMatrix); assert.deepEqual(camera.position, cameraPosition); assert.deepEqual(camera.projectionMatrix, cameraProjection);
    assert.equal(moon.status, status); assert.equal(requests(), before);
    nearVector(moon.surfacePoint(direction.clone().multiplyScalar(1e300)), expected);
    parent.scale.setScalar(1); parent.position.set(-8, 19, 2); parent.rotation.set(0, 0, 0);
    moon.setFrame(lat, lon + 13, 1736);
    parent.updateMatrix();
    const changedMatrix = parent.matrix.clone().multiply(moon.group.matrix);
    const changedDirection = radial.clone().transformDirection(changedMatrix);
    nearVector(moon.surfacePoint(changedDirection), radial.clone().multiplyScalar(1738800).applyMatrix4(changedMatrix));
    const oneKm = radial.clone().multiplyScalar(1739800).applyMatrix4(moon.group.matrixWorld);
    assert.ok(Math.abs(oneKm.distanceTo(moon.surfacePoint(changedDirection)!) - 1) < 1e-8);
    moon.dispose(); assert.deepEqual(disposed(), [3, 3]);
  }
}));

test("surface probe rejects absent, hidden and invalid geometry without requests, traversal updates or exceptions", async () => environment(async () => {
  const api = await compiled;
  const idle = api.createIonMoon(options());
  assert.equal(idle.surfacePoint(new Vector3(0, 1, 0)), null);
  idle.dispose();
  const { moon, tiles, radial, requests } = await parsedSurface();
  const before = requests(), stats = moon.stats;
  assert.equal(moon.appearance.meshes,2,'cached hidden tile is excluded from appearance evidence');
  assert.equal(moon.appearance.unlit,2);
  assert.equal(moon.appearance.withBaseColorMap,0,'synthetic geometry does not establish photographic content');
  tiles.update = () => assert.fail("probe must not update tile selection");
  for (const direction of [new Vector3(), new Vector3(NaN, 1, 0), new Vector3(0, Infinity, 0), null, {}, undefined]) {
    assert.equal(moon.surfacePoint(direction as Vector3), null);
  }
  const direction = radial.clone().transformDirection(moon.group.matrix);
  nearVector(moon.surfacePoint(new Vector3(0, 1e-320, 0)), new Vector3(0, 1.4, 0));
  assert.equal(moon.surfacePoint(new Vector3(1, 0, 0)), null, "uncovered direction has no mesh hit");
  for (const tile of [...tiles.visibleTiles]) tiles.setTileVisible(tile, false);
  assert.equal(moon.surfacePoint(direction), null, "active cached geometry is not visible");
  tiles.setTileVisible(tiles.root!.children![0], true);
  moon.group.visible = false;
  assert.equal(moon.appearance.meshes,0);
  assert.equal(moon.surfacePoint(direction), null);
  moon.group.visible = true;
  (tiles.root!.children![0] as RuntimeTile).engineData.scene!.visible = false;
  assert.equal(moon.surfacePoint(direction), null);
  (tiles.root!.children![0] as RuntimeTile).engineData.scene!.visible = true;
  const scene = (tiles.root!.children![0] as RuntimeTile).engineData.scene!;
  const mesh = scene.children[0]; scene.remove(mesh);
  assert.equal(moon.surfacePoint(direction), null, "a loaded tile with no mesh supplies no radius fallback");
  scene.add(mesh);
  const parent = new Group(); parent.add(moon.group); parent.scale.setScalar(0);
  assert.equal(moon.surfacePoint(direction), null, "singular world transforms have no measurable surface");
  parent.scale.setScalar(1);
  tiles.raycast = () => { throw new Error("probe failure"); };
  assert.equal(moon.surfacePoint(direction), null);
  assert.equal(moon.status.phase, "loading", "probe misses/errors must not fail the stream");
  assert.equal(requests(), before); assert.equal(moon.stats.loadedTiles, stats.loadedTiles);
  tiles.dispatchEvent({ type: "load-error", tile: null, url: "", error: new Error("fixture") });
  assert.equal(moon.surfacePoint(direction), null);
  assert.deepEqual(moon.stats, { visibleTiles: 0, activeTiles: 0, loadedTiles: 0, cacheBytes: 0 });
  await setImmediate(); moon.dispose();
  assert.equal(moon.surfacePoint(direction), null);
}));

test("readonly statistics report renderer counts/cache estimates, handle unknowns and reset after cleanup", async () => environment(async () => {
  const { moon, tiles, disposed } = await parsedSurface();
  const snapshot = moon.stats;
  assert.equal(Object.isFrozen(snapshot), true);
  // Three planes: 48 bytes each for positions/normals, 32 for UVs, 12 for indices.
  assert.deepEqual(snapshot, { visibleTiles: 2, activeTiles: 3, loadedTiles: 3, cacheBytes: 420 });
  const originalLoaded = tiles.stats.loaded;
  const cache = tiles.lruCache as typeof tiles.lruCache & { cachedBytes: unknown };
  const originalBytes = cache.cachedBytes;
  for (const value of [undefined, null, "5", NaN, Infinity, -1]) {
    tiles.stats.loaded = value; cache.cachedBytes = value;
    assert.equal(moon.stats.loadedTiles, 0); assert.equal(moon.stats.cacheBytes, 0);
  }
  tiles.stats.loaded = originalLoaded; cache.cachedBytes = originalBytes;
  tiles.lruCache.remove(tiles.root!.children![0]);
  assert.equal(moon.stats.loadedTiles, 2); assert.equal(moon.stats.visibleTiles, 1);
  assert.ok(moon.stats.cacheBytes < snapshot.cacheBytes);
  assert.equal(snapshot.loadedTiles, 3, "a readonly snapshot does not mutate later");
  moon.dispose(); moon.dispose();
  assert.deepEqual(disposed(), [3, 3]);
  assert.deepEqual(moon.stats, { visibleTiles: 0, activeTiles: 0, loadedTiles: 0, cacheBytes: 0 });
}));

test("camera/frustum error refines several adjacent tiles at 1 km AGL within the existing budgets", async () => environment(async () => {
  const api = await compiled;
  const rotation = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), new Vector3(1, 0, 0));
  const children = [-250, 250].flatMap(x => [-250, 250].map(y => ({
    boundingVolume: { sphere: [0, 0, 0, 360] }, geometricError: 50,
    transform: new Matrix4().compose(new Vector3(1737400, x, y), rotation, new Vector3(1, 1, 1)).toArray(),
    content: { uri: `coarse-${x}-${y}.fixture` }, extras: { width: 500 },
    children: [-125, 125].flatMap(a => [-125, 125].map(b => ({
      boundingVolume: { sphere: [0, 0, 0, 180] }, geometricError: 0,
      transform: new Matrix4().makeTranslation(a, b, 0).toArray(),
      content: { uri: `fine-${x}-${y}-${a}-${b}.fixture` }, extras: { width: 250 }, children: [],
    }))),
  })));
  const json = { asset: { version: "1.0" }, geometricError: 1000, root: {
    boundingVolume: { sphere: [0, 0, 0, 1750000] }, geometricError: 1000, children,
  } } as unknown as Tileset;
  const urls: string[] = [];
  globalThis.fetch = async url => {
    urls.push(String(url));
    if (String(url).includes("api.cesium.com")) return Response.json({ type: "3DTILES", url: "https://tiles.invalid/root.json", accessToken: "provider-fixture" });
    if (String(url).includes("root.json")) return Response.json(json);
    return new Response(new Uint8Array(4));
  };
  const settings = { ...options(), lat: 0, lon: 0 };
  settings.camera.position.set(0, 100, 0); settings.camera.up.set(0, 0, -1); settings.camera.lookAt(0, 0, 0);
  const moon = api.createIonMoon(settings); moon.update(); await setImmediate();
  const tiles = engine(moon) as TestRenderer;
  tiles.registerPlugin({ parseToMesh: (_buffer: ArrayBuffer, tile: Tile & { extras: { width: number } }) => {
    const scene = new Group(); scene.add(new Mesh(new PlaneGeometry(tile.extras.width, tile.extras.width), new MeshBasicMaterial({ side: DoubleSide })));
    return scene;
  } });
  async function settle() {
    for (let frame = 0; frame < 100; frame++) {
      moon.update();
      tiles.processNodeQueue.tryRunJobs();
      for (const queue of tiles.downloadQueue.originQueues.values()) queue.tryRunJobs();
      await setImmediate(); tiles.parseQueue.tryRunJobs(); await setImmediate();
    }
  }
  try {
    await settle();
    assert.equal(moon.stats.visibleTiles, 4);
    assert.equal(urls.filter(url => url.includes("fine-")).length, 0, "distant view must not prefetch fine tiles");
    settings.camera.position.set(0, 1, 0); settings.camera.lookAt(0, 0, 0);
    await settle();
    assert.equal(moon.stats.visibleTiles, 16, "all four neighbouring parents refine into visible children");
    assert.equal(urls.filter(url => url.includes("fine-")).length, 16);
    assert.equal(moon.stats.loadedTiles, 20);
    assert.ok(moon.stats.cacheBytes > 0 && moon.stats.cacheBytes <= 128 * 1024 * 1024);
    assert.equal(tiles.errorTarget, 2); assert.equal(tiles.downloadQueue.maxJobsPerOrigin, 4); assert.equal(tiles.parseQueue.maxJobs, 1);
    const target = new Vector3(.05, 0, .08);
    const direction = target.clone().sub(new Vector3(0, -1737.4, 0)).normalize();
    nearVector(moon.surfacePoint(direction), target);
    const before = urls.length, snapshot = moon.stats;
    for (let i = 0; i < 8; i++) nearVector(moon.surfacePoint(direction), target);
    assert.equal(urls.length, before); assert.deepEqual(moon.stats, snapshot);
  } finally { moon.dispose(); }
}));

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
  const listeners=(tiles as unknown as {_listeners:Record<string,unknown[]>})._listeners;
  assert.equal(listeners['load-error']?.length??0,0,'teardown removes the registered failure callback');
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
