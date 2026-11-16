"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { cesiumCloseupDesired, reduceCesiumCloseup } from "@/lib/cesium-closeup";

const CESIUM_BASE = "https://cdn.jsdelivr.net/npm/cesium@1.124.0/Build/Cesium/";

type IonConfig = { token: string | null; assetId: number; tilesetUrl: string | null };
type Phase = "off" | "hint" | "view" | "error";

type CesiumViewer = {
  scene: { primitives: { add: (tileset: unknown) => void } };
  camera: {
    setView: (options: unknown) => void;
    position: unknown;
    changed: { addEventListener: (fn: () => void) => void };
    percentageChanged: number;
  };
  destroy: () => void;
  isDestroyed?: () => boolean;
};

type CesiumGlobal = {
  Ion: { defaultAccessToken: string };
  Ellipsoid: { default: unknown; MOON: unknown };
  Viewer: new (element: HTMLElement, options: Record<string, unknown>) => CesiumViewer;
  Cesium3DTileset: {
    fromIonAssetId: (id: number) => Promise<unknown>;
    fromUrl: (url: string) => Promise<unknown>;
  };
  Cartesian3: { fromDegrees: (lon: number, lat: number, height: number) => unknown };
  Math: { toRadians: (degrees: number) => number };
  Cartographic: { fromCartesian: (cartesian: unknown) => { height: number } };
};

function cesiumFailure(error: unknown): string {
  const record = error && typeof error === "object" ? error as { message?: unknown; statusCode?: unknown } : null;
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : typeof record?.message === "string" ? record.message : "";
  if (record?.statusCode === 401) return "Cesium ion refused that access token.";
  return message || "Cesium Moon could not start";
}

function loadCesium(): Promise<CesiumGlobal> {
  const w = window as Window & { Cesium?: CesiumGlobal; CESIUM_BASE_URL?: string };
  if (w.Cesium) return Promise.resolve(w.Cesium);
  w.CESIUM_BASE_URL = CESIUM_BASE;
  if (!document.querySelector("link[data-cesium-widgets]")) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `${CESIUM_BASE}Widgets/widgets.css`;
    link.dataset.cesiumWidgets = "1";
    document.head.appendChild(link);
  }
  return new Promise((resolve, reject) => {
    const finish = () => (w.Cesium ? resolve(w.Cesium) : reject(new Error("Cesium missing after load")));
    const existing = document.querySelector("script[data-cesium]");
    if (existing) {
      existing.addEventListener("load", finish);
      existing.addEventListener("error", () => reject(new Error("Cesium failed to load")));
      return;
    }
    const script = document.createElement("script");
    script.src = `${CESIUM_BASE}Cesium.js`;
    script.async = true;
    script.dataset.cesium = "1";
    script.onload = finish;
    script.onerror = () => reject(new Error("Cesium failed to load"));
    document.body.appendChild(script);
  });
}

export function CesiumMoonCloseup({
  host,
  lat,
  lon,
  focus,
}: {
  host: RefObject<HTMLDivElement | null>;
  lat: number;
  lon: number;
  focus: string;
}) {
  const [phase, setPhase] = useState<Phase>("off");
  const [message, setMessage] = useState("");
  const gate = useRef({ open: false, dismissed: false });
  const config = useRef<IonConfig | null>(null);
  const [slotNode, setSlotNode] = useState<HTMLDivElement | null>(null);
  const asked = useRef(false);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let cancelled = false;
    const apply = () => {
      const rangeKm = Number(element.dataset.terrainRangeKm);
      const mode = element.dataset.cameraMode ?? "";
      gate.current = reduceCesiumCloseup(gate.current, cesiumCloseupDesired(rangeKm, mode, focus), rangeKm);
      if (!gate.current.open) {
        asked.current = false;
        element.classList.remove("cesium-closeup-active");
        setPhase((current) => (current === "off" ? current : "off"));
        return;
      }
      if (asked.current) return;
      asked.current = true;
      void fetch("/api/cesium-ion", { cache: "no-store" })
        .then(async (response) => {
          if (cancelled || !gate.current.open) return;
          if (!response.ok) {
            setPhase("hint");
            return;
          }
          config.current = (await response.json()) as IonConfig;
          element.classList.add("cesium-closeup-active");
          setMessage("Streaming Cesium Moon…");
          setPhase("view");
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          setPhase("error");
          setMessage(cesiumFailure(error));
        });
    };
    const observer = new MutationObserver(apply);
    observer.observe(element, { attributes: true, attributeFilter: ["data-terrain-range-km", "data-camera-mode"] });
    apply();
    return () => {
      cancelled = true;
      observer.disconnect();
      element.classList.remove("cesium-closeup-active");
    };
  }, [host, focus]);

  useEffect(() => {
    if (phase !== "view") return;
    const element = host.current;
    const root = slotNode;
    const ion = config.current;
    if (!element || !root || !ion) return;
    let dead = false;
    let viewer: CesiumViewer | null = null;
    void (async () => {
      try {
        const Cesium = await loadCesium();
        if (dead) return;
        if (ion.token) Cesium.Ion.defaultAccessToken = ion.token;
        Cesium.Ellipsoid.default = Cesium.Ellipsoid.MOON;
        viewer = new Cesium.Viewer(root, {
          globe: false,
          sceneModePicker: false,
          baseLayerPicker: false,
          geocoder: false,
          animation: false,
          timeline: false,
          homeButton: false,
          navigationHelpButton: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: false,
        });
        const tileset = ion.tilesetUrl
          ? await Cesium.Cesium3DTileset.fromUrl(ion.tilesetUrl)
          : await Cesium.Cesium3DTileset.fromIonAssetId(ion.assetId);
        if (dead) {
          viewer.destroy();
          return;
        }
        viewer.scene.primitives.add(tileset);
        const rangeKm = Number(element.dataset.terrainRangeKm);
        const height = Math.max(800, (Number.isFinite(rangeKm) ? rangeKm : 2) * 1000);
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
          orientation: { heading: 0, pitch: Cesium.Math.toRadians(-40), roll: 0 },
        });
        viewer.camera.percentageChanged = 0.2;
        viewer.camera.changed.addEventListener(() => {
          if (!viewer) return;
          const heightKm = Cesium.Cartographic.fromCartesian(viewer.camera.position).height / 1000;
          if (heightKm < 40) return;
          gate.current = reduceCesiumCloseup(gate.current, true, Number(element.dataset.terrainRangeKm), true);
          element.classList.remove("cesium-closeup-active");
          setPhase("off");
        });
        setMessage("");
      } catch (error) {
        if (dead) return;
        element.classList.remove("cesium-closeup-active");
        setPhase("error");
        setMessage(cesiumFailure(error));
      }
    })();
    return () => {
      dead = true;
      if (viewer && !viewer.isDestroyed?.()) viewer.destroy();
    };
  }, [phase, host, lat, lon, slotNode]);

  const dismiss = () => {
    const element = host.current;
    const rangeKm = Number(element?.dataset.terrainRangeKm);
    gate.current = reduceCesiumCloseup(gate.current, true, rangeKm, true);
    element?.classList.remove("cesium-closeup-active");
    setPhase("off");
  };

  const node = host.current;
  if (!node || phase === "off") return null;

  if (phase === "hint") {
    return createPortal(
      <p className="cesium-moon-hint" role="status">
        Zoomed in. Cesium Moon’s 1 m polar imagery streams when <code>CESIUM_ION_TOKEN</code> is set in <code>navigator/.env.local</code>, then reload this local server.
      </p>,
      node,
    );
  }

  return createPortal(
    <div className="cesium-moon-closeup" data-cesium-closeup={phase}>
      <div className="cesium-moon-bar">
        <span>{phase === "error" ? message : message || "Cesium Moon · polar close-up"}</span>
        <button type="button" onClick={dismiss}>Lunario view</button>
      </div>
      <div ref={setSlotNode} className="cesium-moon-viewport" data-cesium-root />
    </div>,
    node,
  );
}
