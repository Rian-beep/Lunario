import * as T from "three";
import { latLonToProjected } from "@/lib/astro";
import { bodyToScene, siteFrame, type SiteFrame } from "./surface";

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

/** Manifest URL for both the Next app and the static navigator file. */
export function southPoleManifestUrl() {
  if (typeof location !== "undefined" && /solarreach-navigator\.html$/.test(location.pathname)) {
    return new URL("data/south-pole-detail/manifest.json", location.href).href;
  }
  return "/data/south-pole-detail/manifest.json";
}
