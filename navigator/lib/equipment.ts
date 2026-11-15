import { publicAssetURL } from "./public-assets";
import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

export const LANDER_ASSET = {
  id: "apollo-lunar-module",
  name: "Apollo Lunar Module",
  credit: "NASA/Michael D. Carbajal",
  page: "https://science.nasa.gov/3d-resources/apollo-lunar-module/",
  path: "/data/equipment/apollo-lunar-module.glb",
  sha256: "379101dfcee399267addf771709107c35e826b0b9e5233272f123e4c8a585c4e",
  // Deliberate display normalization; not a recovered CAD measurement.
  displayHeightM: 7,
  scope: "NASA geometry; nominal 7 m display height; generic flight physics, not an Apollo simulation.",
} as const;
export type EquipmentStatus = "loading" | "ready" | "error" | "disposed";

declare global {
  // Standalone builder supplies data URLs indexed by the same root-relative paths.
  var __SOLARREACH_EQUIPMENT__: Record<string, string> | undefined;
}
export function equipmentUrl(path: string): string {
  if (!path.startsWith("/data/equipment/")) return path;
  const embedded = globalThis.__SOLARREACH_EQUIPMENT__?.[path];
  if (embedded) return embedded;
  if (typeof location !== "undefined" && location.protocol === "file:") {
    throw new Error(`Offline equipment asset is missing: ${path}`);
  }
  return publicAssetURL(path);
}

/** glTF is Y-up; translate the lowest point to the ground and centre X/Z. */
export function normalizeEquipment(scene: T.Object3D, heightM = LANDER_ASSET.displayHeightM) {
  const bounds = new T.Box3().setFromObject(scene);
  const size = bounds.getSize(new T.Vector3());
  if (!Number.isFinite(size.y) || size.y <= 0 || !Number.isFinite(heightM) || heightM <= 0) {
    throw new Error("Equipment has invalid display bounds");
  }
  const wrapper = new T.Group();
  const centre = bounds.getCenter(new T.Vector3());
  const scale = heightM / size.y;
  scene.position.sub(new T.Vector3(centre.x, bounds.min.y, centre.z));
  wrapper.add(scene);
  wrapper.scale.setScalar(scale);
  scene.traverse((object) => {
    if (object instanceof T.Mesh) object.castShadow = object.receiveShadow = true;
  });
  return wrapper;
}
export function disposeEquipment(object: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>(), textures = new Set<T.Texture>();
  object.traverse((child) => {
    if (!(child instanceof T.Mesh)) return;
    geometries.add(child.geometry);
    for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof T.Texture) textures.add(value);
    }
  });
  geometries.forEach((value) => value.dispose());
  textures.forEach((value) => value.dispose());
  materials.forEach((value) => value.dispose());
}
export async function loadLanderAsset(signal?: AbortSignal): Promise<T.Object3D> {
  const response = await fetch(equipmentUrl(LANDER_ASSET.path), { signal });
  if (!response.ok) throw new Error(`NASA lander asset unavailable (${response.status})`);
  const bytes = await response.arrayBuffer();
  const manager = new T.LoadingManager();
  manager.setURLModifier(equipmentUrl);
  const decoder = new DRACOLoader(manager);
  decoder.setDecoderPath("/data/equipment/draco/");
  decoder.setDecoderConfig({ type: "js" });
  const loader = new GLTFLoader(manager).setDRACOLoader(decoder);
  try {
    const gltf = await loader.parseAsync(bytes, "");
    try { return normalizeEquipment(gltf.scene); }
    catch (error) { disposeEquipment(gltf.scene); throw error; }
  } finally { decoder.dispose(); }
}
