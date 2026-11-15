import type {GlobalTerrainData} from "./global-terrain";
import { latLonToProjected } from "./astro";
export type TerrainGrid = {
  id: string;
  width: number;
  height: number;
  x0: number;
  y0: number;
  stepM: number;
  stepYM?: number;
  inputPixelM?: number;
  heights: Array<number | null>;
  lod?: string;
  sourceUrl?: string;
};
export type TerrainData = {
  /** Display fallback only: never a fine collision/hazard substitute. */
  globalTerrain?:GlobalTerrainData;
  version: number;
  source: string;
  sourcePage: string;
  retrievedUtc: string;
  frame: string;
  sourcePixelM: number;
  sampling: string;
  overview: TerrainGrid;
  patches: TerrainGrid[];
};
export type SerializedTerrainGrid = Omit<TerrainGrid, "heights"> & {
  heights?: Array<number | null>;
  encodedHeights?: string;
  heightOffsetM?: number;
  heightScaleM?: number;
};
export type SerializedTerrainData = Omit<
  TerrainData,
  "overview" | "patches"
> & { overview: SerializedTerrainGrid; patches: SerializedTerrainGrid[] };
export function decodeTerrain(
  raw: SerializedTerrainData | TerrainData,
): TerrainData {
  const decode = (g: SerializedTerrainGrid): TerrainGrid => {
    if (g.heights) return g as TerrainGrid;
    if (
      !g.encodedHeights ||
      !Number.isFinite(g.heightOffsetM) ||
      !(g.heightScaleM! > 0)
    )
      throw new Error("Invalid packed terrain metadata");
    const binary = atob(g.encodedHeights),
      bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    if (bytes.byteLength !== g.width * g.height * 2)
      throw new Error("Packed terrain sample count does not match its grid");
    const view = new DataView(bytes.buffer),
      heights = Array.from({ length: g.width * g.height }, (_, i) => {
        const v = view.getInt16(i * 2, true);
        return v === -32768 ? null : g.heightOffsetM! + v * g.heightScaleM!;
      });
    return { ...g, heights };
  };
  return {
    ...raw,
    overview: decode(raw.overview),
    patches: raw.patches.map(decode),
  };
}
const sortedPatches = new WeakMap<TerrainData, TerrainGrid[]>();
declare global {
  interface Window {
    __SOLARREACH_TERRAIN__?: TerrainData | SerializedTerrainData;
  }
}
export async function loadTerrain(): Promise<TerrainData> {
  if (window.__SOLARREACH_TERRAIN__)
    return decodeTerrain(window.__SOLARREACH_TERRAIN__);
  const r = await fetch("/data/terrain.json");
  if (!r.ok)
    throw new Error(
      "Numerical terrain could not be loaded. The map and horizon analysis remain available.",
    );
  return decodeTerrain(await r.json());
}
export function sampleGrid(
  g: TerrainGrid,
  x: number,
  y: number,
): number | null {
  const c = (x - g.x0) / g.stepM,
    r = (g.y0 - y) / (g.stepYM ?? g.stepM);
  if (
    !Number.isFinite(c) ||
    !Number.isFinite(r) ||
    c < 0 ||
    r < 0 ||
    c > g.width - 1 ||
    r > g.height - 1
  )
    return null;
  const c0 = Math.min(g.width - 2, Math.floor(c)),
    r0 = Math.min(g.height - 2, Math.floor(r));
  const a = g.heights[r0 * g.width + c0],
    b = g.heights[r0 * g.width + c0 + 1],
    d = g.heights[(r0 + 1) * g.width + c0],
    e = g.heights[(r0 + 1) * g.width + c0 + 1];
  if (
    a == null ||
    b == null ||
    d == null ||
    e == null ||
    ![a, b, d, e].every(Number.isFinite)
  )
    return null;
  const u = c - c0,
    v = r - r0;
  return (a * (1 - u) + b * u) * (1 - v) + (d * (1 - u) + e * u) * v;
}
export function heightAt(
  data: TerrainData,
  lat: number,
  lon: number,
  localOnly = false,
): { heightM: number; stepM: number; inputPixelM: number } | null {
  const p = latLonToProjected(lat, lon);
  let patches = sortedPatches.get(data);
  if (!patches) {
    patches = [...data.patches].sort(
      (a, b) => (a.inputPixelM ?? a.stepM) - (b.inputPixelM ?? b.stepM),
    );
    sortedPatches.set(data, patches);
  }
  for (const g of [...patches, ...(localOnly ? [] : [data.overview])]) {
    const h = sampleGrid(g, p.x, p.y);
    if (h != null)
      return {
        heightM: h,
        stepM: g.stepM,
        inputPixelM: g.inputPixelM ?? g.stepM,
      };
  }
  return null;
}
const R = 1737400,
  rad = Math.PI / 180;
export function localToLunar(
  eastM: number,
  northM: number,
  lat: number,
  lon: number,
): { lat: number; lon: number } {
  const p = lat * rad,
    l = lon * rad;
  const up = [
    Math.cos(p) * Math.cos(l),
    Math.cos(p) * Math.sin(l),
    Math.sin(p),
  ];
  const e = [-Math.sin(l), Math.cos(l), 0],
    n = [-Math.sin(p) * Math.cos(l), -Math.sin(p) * Math.sin(l), Math.cos(p)];
  const v = up.map((x, i) => R * x + eastM * e[i] + northM * n[i]);
  return {
    lat: Math.atan2(v[2], Math.hypot(v[0], v[1])) / rad,
    lon: (Math.atan2(v[1], v[0]) / rad + 360) % 360,
  };
}
export function lunarToLocal(
  lat: number,
  lon: number,
  originLat: number,
  originLon: number,
) {
  const p = lat * rad,
    l = lon * rad,
    o = originLat * rad,
    q = originLon * rad;
  const v = [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
  const up = [
    Math.cos(o) * Math.cos(q),
    Math.cos(o) * Math.sin(q),
    Math.sin(o),
  ];
  const e = [-Math.sin(q), Math.cos(q), 0],
    n = [-Math.sin(o) * Math.cos(q), -Math.sin(o) * Math.sin(q), Math.cos(o)];
  const dot = (a: number[]) => v.reduce((s, x, i) => s + x * a[i], 0);
  const d = dot(up);
  return { eastM: (R * dot(e)) / d, northM: (R * dot(n)) / d };
}
