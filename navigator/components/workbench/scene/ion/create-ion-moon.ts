import { Group, PerspectiveCamera, Vector2, WebGLRenderer } from "three";
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
export type IonMoon = {
  readonly group: Group;
  readonly ready: boolean;
  readonly status: IonMoonStatus;
  readonly attribution: readonly IonAttribution[];
  update(): void;
  setFrame(lat: number, lon: number, radiusKm: number): void;
  dispose(): void;
};

const FAILURE = "Online Moon tiles could not be loaded. Check connectivity and that your Cesium Ion token can read asset 2684829. The local Moon remains available.";
const CREDITS: readonly IonAttribution[] = Object.freeze([
  Object.freeze({ type: "text", value: "NASA / USGS — lunar surface data; streamed through Cesium Ion." }),
]);

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
        group.updateWorldMatrix(true, true);
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
