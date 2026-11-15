import * as T from "three";
import { disposeEquipment, LANDER_ASSET, loadLanderAsset, type EquipmentStatus } from "../../../lib/equipment";

/** Synchronous scene handle; the actual NASA GLB arrives asynchronously. */
export function createLander(options: {
  onStatus?: (status: EquipmentStatus, error?: string) => void;
  load?: (signal: AbortSignal) => Promise<T.Object3D>;
} = {}) {
  const group = new T.Group();
  group.name = "NASA Apollo Lunar Module (display geometry)";
  group.userData.equipment = LANDER_ASSET;
  const controller = new AbortController();
  let disposed = false;
  const status = (value: EquipmentStatus, error?: string) => {
    group.userData.equipmentStatus = value;
    group.userData.equipmentError = error;
    options.onStatus?.(value, error);
  };
  // This illustrative exhaust is not part of the NASA mesh or an engine model.
  const plume = new T.Mesh(
    new T.ConeGeometry(0.8, 4, 24, 1, true),
    new T.MeshBasicMaterial({ color: 0xffe3aa, transparent: true, opacity: 0.65, depthWrite: false }),
  );
  plume.position.y = -1.55;
  plume.visible = false;
  group.add(plume);
  group.scale.setScalar(0.001); // Runtime world coordinates are kilometres.
  status("loading");
  const ready = (options.load ?? loadLanderAsset)(controller.signal).then((model) => {
    if (disposed) { disposeEquipment(model); return; }
    group.add(model);
    status("ready");
  }).catch((error: unknown) => {
    if (disposed) return;
    const message = error instanceof Error ? error.message : "NASA lander could not load";
    status("error", message);
    console.error("NASA lander geometry could not load:", error);
  });
  return {
    group, plume, ready,
    dispose() {
      if (disposed) return;
      disposed = true;
      controller.abort();
      disposeEquipment(group);
      status("disposed");
    },
  };
}
