import { Box3, Group, PerspectiveCamera, Raycaster, Vector2, Vector3, WebGLRenderer, type Object3D } from "three";
import { GLTFExtensionsPlugin } from "3d-tiles-renderer/plugins";
import { validateIonConfiguration } from "../../../../lib/ion/config";
import { ionBodyToLocalMatrix, validateIonFrame } from "../../../../lib/ion/frame";
import { configureIonLimits } from "../../../../lib/ion/limits";
import { AbortableDracoLoader, AbortableIonAuthPlugin, IonTilesRenderer } from "./pinned-runtime";

export type IonMoonStatus = Readonly<{
  phase: "idle" | "loading" | "ready" | "error" | "disposed";
  ready: boolean;
  fallbackRequired: boolean;
  error: string | null;
}>;
export type IonMoonOptions = {
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  lat: number;
  lon: number;
  referenceRadiusKm: number;
  accessToken: string;
  decoderUrl?: string;
  onStatus?: (status: IonMoonStatus) => void;
};
export type IonAttribution = Readonly<{ type: "text" | "html"; value: string }>;
export type IonMoonStats = Readonly<{
  visibleTiles: number;
  activeTiles: number;
  loadedTiles: number;
  cacheBytes: number;
}>;
export type IonMoon = {
  readonly group: Group;
  readonly ready: boolean;
  readonly status: IonMoonStatus;
  readonly attribution: readonly IonAttribution[];
  readonly stats: IonMoonStats;
  /** Measured visible geometry in scene km, along a body-centred scene direction. No loading. */
  surfacePoint(radialSceneDirection: Vector3): Vector3 | null;
  update(): void;
  setFrame(lat: number, lon: number, radiusKm: number): void;
  dispose(): void;
};

const FAILURE = "Online Moon tiles could not be loaded. Check connectivity and that your Cesium Ion token can read asset 2684829. The local Moon remains available.";
const CREDITS: readonly IonAttribution[] = Object.freeze([
  Object.freeze({ type: "text", value: "NASA / USGS — lunar surface data; streamed through Cesium Ion." }),
]);
const EMPTY_STATS: IonMoonStats = Object.freeze({ visibleTiles: 0, activeTiles: 0, loadedTiles: 0, cacheBytes: 0 });
const count = (value: unknown): number => typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;

/** Explicit opt-in factory; importing or constructing never starts network work. */
export function createIonMoon(options: IonMoonOptions): IonMoon {
  const { camera, renderer, onStatus } = options;
  const group = new Group();
  group.name = "Optional online Moon tiles (visual only)";
  let status: IonMoonStatus = Object.freeze({ phase: "idle", ready: false, fallbackRequired: true, error: null });
  let tiles: IonTilesRenderer | null = null;
  let draco: AbortableDracoLoader | null = null;
  let auth: AbortableIonAuthPlugin | null = null;
  let stopped = false;
  const abort = new AbortController();
  const viewport = new Vector2();
  const credentials = validateIonConfiguration({ accessToken: options.accessToken, decoderUrl: options.decoderUrl });
  const frameError = validateIonFrame(options.lat, options.lon, options.referenceRadiusKm);

  function publish(phase: IonMoonStatus["phase"], ready = false, error: string | null = null) {
    if (status.phase === phase && status.ready === ready && status.error === error) return;
    status = Object.freeze({ phase, ready, fallbackRequired: !ready, error });
    try { onStatus?.(status); }
    catch { /* A parent status handler must not interrupt resource cleanup. */ }
  }

  function release() {
    abort.abort();
    if (credentials.ok) credentials.value.accessToken = "";
    const current = tiles, decoder = draco;
    tiles = null;
    draco = null;
    auth = null;
    if (current) {
      current.removeEventListener("load-error", fail);
      current.processNodeQueue.autoUpdate = false;
      current.processNodeQueue.removeByFilter(() => true);
      current.parseQueue.autoUpdate = false;
      for (const queue of current.downloadQueue.originQueues.values()) queue.autoUpdate = false;
      try { current.dispose(); }
      catch { publish("error", false, FAILURE); }
      current.parseQueue.removeByFilter(() => true);
      for (const queue of current.downloadQueue.originQueues.values()) queue.removeByFilter(() => true);
      current.group.removeFromParent();
    }
    decoder?.dispose();
    group.clear();
  }

  function fail() {
    if (stopped) return;
    stopped = true;
    group.visible = false;
    publish("error", false, FAILURE);
    // Finish the current upstream traversal/event before draining its queues.
    queueMicrotask(release);
  }

  if (!credentials.ok || frameError) {
    stopped = true;
    publish("error", false, frameError ?? (!credentials.ok ? credentials.error : FAILURE));
  } else {
    group.matrixAutoUpdate = false;
    group.matrix.copy(ionBodyToLocalMatrix(options.lat, options.lon, options.referenceRadiusKm));
    group.matrixWorldNeedsUpdate = true;
  }

  return {
    group,
    get ready() { return status.ready; },
    get status() { return status; },
    get stats() {
      if (!tiles || stopped) return EMPTY_STATS;
      // These two fields exist in 0.5.4 but are omitted from its declarations.
      const runtime = tiles as IonTilesRenderer & { stats?: { loaded?: unknown } };
      const cache = tiles.lruCache as typeof tiles.lruCache & { cachedBytes?: unknown };
      return Object.freeze({
        visibleTiles: count(tiles.visibleTiles?.size), activeTiles: count(tiles.activeTiles?.size),
        loadedTiles: count(runtime.stats?.loaded), cacheBytes: count(cache?.cachedBytes),
      });
    },
    surfacePoint(radialSceneDirection) {
      try {
        if (!tiles || stopped || !group.visible || !tiles.visibleTiles.size) return null;
        const direction = new Vector3().copy(radialSceneDirection);
        if (![direction.x, direction.y, direction.z].every(Number.isFinite)) return null;
        const magnitude = Math.max(Math.abs(direction.x), Math.abs(direction.y), Math.abs(direction.z));
        if (magnitude === 0) return null;
        direction.set(direction.x / magnitude, direction.y / magnitude, direction.z / magnitude).normalize();
        // r187 needs force for a manual-matrix group after an ancestor changes.
        group.updateWorldMatrix(true, true, true);
        if (!group.matrixWorld.elements.every(Number.isFinite) || group.matrixWorld.determinant() === 0) return null;
        // Root bounds determine an outside origin only; every returned point is a mesh hit.
        const bounds = new Box3();
        if (!tiles.getBoundingBox(bounds)) return null;
        bounds.applyMatrix4(tiles.group.matrixWorld);
        const centre = new Vector3().applyMatrix4(group.matrixWorld);
        const extent = bounds.getSize(new Vector3()).length() / 2;
        const outside = bounds.getCenter(new Vector3()).distanceTo(centre) + extent + Math.max(1, extent * 1e-6);
        if (bounds.isEmpty() || !Number.isFinite(outside)) return null;
        const ray = new Raycaster(centre.clone().addScaledVector(direction, outside), direction.negate(), 0, outside * 2);
        // TilesGroup calls the renderer's accelerated traversal and returns false,
        // preventing Three from also raycasting every child without tile culling.
        const hits = ray.intersectObject(tiles.group, true);
        for (const hit of hits) {
          if (!tiles.visibleTiles.has(hit.object.userData.tile) || !Number.isFinite(hit.distance) || ![hit.point.x, hit.point.y, hit.point.z].every(Number.isFinite)) continue;
          let visible = true;
          for (let object: Object3D | null = hit.object; object; object = object.parent) {
            if (!object.visible) { visible = false; break; }
          }
          if (visible) return hit.point.clone();
        }
        return null;
      } catch { return null; }
    },
    get attribution() {
      if (!tiles || stopped) return CREDITS;
      try {
        const provider = tiles.getAttributions().flatMap(({ type, value }) =>
          (type === "text" || type === "html") && typeof value === "string"
            ? [{ type, value: auth?.redactAttribution(value) ?? value } as IonAttribution] : []);
        return [...CREDITS, ...provider];
      } catch { fail(); return CREDITS; }
    },
    update() {
      if (stopped || !credentials.ok) return;
      try {
        if (!tiles) {
          tiles = new IonTilesRenderer(fail);
          configureIonLimits(tiles, fail);
          // The committed decoder is JS only; do not request missing WASM files.
          draco = new AbortableDracoLoader(credentials.value.decoderUrl, abort.signal);
          tiles.registerPlugin(new GLTFExtensionsPlugin({ dracoLoader: draco, autoDispose: false }));
          auth = new AbortableIonAuthPlugin(credentials.value.accessToken, abort.signal, fail);
          tiles.registerPlugin(auth);
          tiles.addEventListener("load-error", fail);
          tiles.setCamera(camera);
          group.add(tiles.group);
          publish("loading");
        }
        camera.updateWorldMatrix(true, false);
        group.updateWorldMatrix(true, true, true);
        renderer.getSize(viewport);
        viewport.multiplyScalar(Math.min(1, 1920 / Math.max(viewport.x, viewport.y, 1)));
        tiles.setResolution(camera, Math.max(1, viewport.x), Math.max(1, viewport.y));
        tiles.update();
        if (!stopped) publish(tiles.visibleTiles.size > 0 ? "ready" : "loading", tiles.visibleTiles.size > 0);
      } catch { fail(); }
    },
    setFrame(lat, lon, radiusKm) {
      if (stopped) return;
      const error = validateIonFrame(lat, lon, radiusKm);
      if (error) { stopped = true; publish("error", false, error); release(); return; }
      group.matrix.copy(ionBodyToLocalMatrix(lat, lon, radiusKm));
      group.matrixWorldNeedsUpdate = true;
      // Readiness is specific to the current view, never to a downloaded root.
      publish(tiles ? "loading" : "idle");
    },
    dispose() {
      if (status.phase === "disposed") return;
      stopped = true;
      release();
      group.removeFromParent();
      publish("disposed");
    },
  };
}
