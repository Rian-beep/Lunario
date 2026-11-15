import * as T from "three";
import { latLonToProjected } from "@/lib/astro";
import { bodyToScene, siteFrame, type SiteFrame } from "./surface";
import { publicAssetURL } from "@/lib/public-assets";

/** Half-width of the bundled 150 m polar overview, in stereographic metres. */
const OVERVIEW_HALF_M = 153_600;

/** True when a geographic point lies inside the measured south-pole close-up. */
export function insideSouthPoleDetail(latDeg: number, lonDeg: number) {
  if (!Number.isFinite(latDeg) || !Number.isFinite(lonDeg) || latDeg > -80) return false;
  const projected = latLonToProjected(latDeg, lonDeg);
  return Math.abs(projected.x) <= OVERVIEW_HALF_M && Math.abs(projected.y) <= OVERVIEW_HALF_M;
}

/**
 * Rigid transform from the south-pole terrain frame into the scene frame.
 * Terrain space has its origin on the reference sphere at the pole, +X east,
 * +Y up, and +Z south. The scene uses the same kilometres with the selected
 * site as its origin.
 */
export function southPoleTerrainMatrix(frame: SiteFrame) {
  const pole = siteFrame(-90, 0, 0);
  const south = pole.north.clone().multiplyScalar(-1);
  const column = (axis: T.Vector3) => new T.Vector3(axis.dot(frame.east), axis.dot(frame.up), -axis.dot(frame.north));
  const matrix = new T.Matrix4().makeBasis(column(pole.east), column(pole.up), column(south));
  matrix.setPosition(bodyToScene(pole.up, 0, frame));
  return matrix;
}

/** Rotates scene-space view directions back into the terrain's own lighting frame. */
export function sceneToTerrainRotation(matrix: T.Matrix4) {
  return new T.Matrix3().setFromMatrix4(matrix).invert();
}

/** Empty URL offline: detail grids are not embedded; keep canonical embedded terrain. */
export function southPoleManifestUrl(offline = false) {
  if (offline || (typeof location !== "undefined" && location.protocol === "file:")) return "";
  const resolve = globalThis.__LUNARIO_PUBLIC_ASSET_URL__;
  return typeof resolve === "function" ? resolve("/data/south-pole-detail/manifest.json") : publicAssetURL("/data/south-pole-detail/manifest.json");
}

export function wantsSouthPoleDetail(options: {
  offline: boolean; showFlight: boolean; globalSurface: boolean; navigating: boolean;
  geography: {latDeg: number; lonDeg: number} | null; distanceKm: number; mode: string;
}) {
  const {offline, showFlight, globalSurface, navigating, geography, distanceKm, mode} = options;
  // Visual detail is not registered to the numerical flight/contact terrain.
  return !offline && !showFlight && !globalSurface && !navigating &&
    ["orbit", "surface", "globe"].includes(mode) && Number.isFinite(distanceKm) && distanceKm < 80 &&
    !!geography && insideSouthPoleDetail(geography.latDeg, geography.lonDeg);

}
