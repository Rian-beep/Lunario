import {type Catalog} from '../catalog';
import {latLonToProjected, type TerrainChoice} from '../astro';
import {GLOBAL_HORIZON_AZIMUTH_STEP_DEG, globalHorizonDistances} from '../global-horizon';
import {sampleGlobalHeight, type GlobalTerrainData} from '../global-terrain';
import {sampleGrid, type TerrainData} from '../terrain';

const rad = Math.PI / 180;
const MAX_HORIZONS = 576; // One 288-centre global job at two independent instrument heights.
const horizons = new WeakMap<GlobalTerrainData, Map<string, TerrainChoice>>();
export const longitude = (lon: number) => lon >= 0 && lon < 360 ? lon : ((lon % 360) + 360) % 360;

/** Same ENU great-circle construction as global-horizon.ts, stable at either pole. */
function destination(lat: number, lon: number, az: number, theta: number) {
  const p = lat * rad, l = lon * rad, ct = Math.cos(theta), st = Math.sin(theta);
  const up = [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
  const east = [-Math.sin(l), Math.cos(l), 0];
  const north = [-Math.sin(p) * Math.cos(l), -Math.sin(p) * Math.sin(l), Math.cos(p)];
  const v = up.map((u, j) => u * ct + (north[j] * Math.cos(az) + east[j] * Math.sin(az)) * st);
  return {lat: Math.atan2(v[2], Math.hypot(v[0], v[1])) / rad, lon: Math.atan2(v[1], v[0]) / rad};
}

/** No nearest-cell borrowing: a prepared mask belongs only to its actual coordinate and height. */
export function prepared(catalog: Catalog, lat: number, lon: number, heightM: number): {terrain: TerrainChoice; source: string} | null {
  for (const site of catalog.sites) {
    if (site.lat !== lat || longitude(site.lon) !== lon) continue;
    const h = site.horizons.find(h => h.heightM === heightM);
    if (h) return {terrain: {...h, distanceKm: 0, cellLat: lat, cellLon: lon, exact: true}, source: `Prepared named LOLA horizon: ${site.id}; ${h.stepDeg}° azimuth; ${heightM} m`};
  }
  const grid = catalog.grid;
  if (grid.heightM !== heightM) return null;
  for (let i = 0; i < grid.lat.length; i++) {
    if (grid.lat[i] !== lat || longitude(grid.lon[i]) !== lon) continue;
    const mask = grid.mask.subarray(i * grid.nAz, (i + 1) * grid.nAz);
    if (mask.length !== grid.nAz || grid.nAz < 1) return null;
    return {terrain: {mask, stepDeg: grid.stepDeg, heightM, distanceKm: 0, cellLat: lat, cellLon: lon, exact: true}, source: `Prepared polar LOLA cell ${i}; ${grid.stepDeg}° azimuth; ${heightM} m`};
  }
  return null;
}

/** Cooperative counterpart of terrainForGlobal; identical radial/azimuth policy, tested against it. */
export function* coarseHorizon(data: GlobalTerrainData, lat: number, lon: number, heightM: number): Generator<void, TerrainChoice | null> {
  if (!Number.isFinite(heightM) || heightM < 0 || heightM > 10000) return null;
  const key = `${lat}|${lon}|${heightM}`;
  let cache = horizons.get(data);
  if (!cache) { cache = new Map(); horizons.set(data, cache); }
  const hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit; }
  const ground = sampleGlobalHeight(data, lat, lon);
  if (ground === null) return null;
  const R = data.radiusM, r0 = R + ground + heightM;
  const stepDeg = GLOBAL_HORIZON_AZIMUTH_STEP_DEG, mask = new Float64Array(360 / stepDeg);
  const distances = globalHorizonDistances();
  for (let i = 0; i < mask.length; i++) {
    let maximum = -Math.PI / 2, missing = false;
    for (const distance of distances) {
      const theta = distance / R, p = destination(lat, lon, i * stepDeg * rad, theta);
      const h = sampleGlobalHeight(data, p.lat, p.lon);
      if (h === null) { missing = true; break; }
      maximum = Math.max(maximum, Math.atan2((R + h) * Math.cos(theta) - r0, (R + h) * Math.sin(theta)));
    }
    mask[i] = missing ? NaN : maximum / rad;
    yield;
  }
  const result = {mask, stepDeg, heightM, distanceKm: 0, cellLat: lat, cellLon: lon, exact: false};
  cache.set(key, result);
  if (cache.size > MAX_HORIZONS) cache.delete(cache.keys().next().value!);
  return result;
}

export type Slope = {slopeDeg: number | null; spacingM: number | null; source: string; notes: string[]};

export function regionalSlope(terrain: TerrainData | null | undefined, global: GlobalTerrainData | null | undefined, lat: number, lon: number): Slope {
  if (terrain && lat < 0) {
    const p = latLonToProjected(lat, lon), scale = 2 / (1 - Math.sin(lat * rad));
    // Only fine numerical patches; the overview is visualization context, not invented fine support.
    const grids = terrain.patches.filter(g => (g.inputPixelM ?? terrain.sourcePixelM) <= 80)
      .sort((a, b) => Math.max(a.stepM, a.stepYM ?? a.stepM, a.inputPixelM ?? terrain.sourcePixelM) - Math.max(b.stepM, b.stepYM ?? b.stepM, b.inputPixelM ?? terrain.sourcePixelM));
    for (const g of grids) {
      const dx = Math.max(g.stepM, g.inputPixelM ?? terrain.sourcePixelM), dy = Math.max(g.stepYM ?? g.stepM, g.inputPixelM ?? terrain.sourcePixelM);
      if (!(dx > 0 && dy > 0 && Number.isFinite(dx + dy))) continue;
      const values = [sampleGrid(g, p.x - dx, p.y), sampleGrid(g, p.x + dx, p.y), sampleGrid(g, p.x, p.y - dy), sampleGrid(g, p.x, p.y + dy)];
      if (!values.every((v): v is number => v !== null && Number.isFinite(v))) continue;
      const [w, e, s, n] = values as number[];
      return {slopeDeg: Math.atan(Math.hypot((e - w) / (2 * dx), (n - s) / (2 * dy)) * scale) / rad,
        spacingM: Math.max(dx, dy) / scale, source: `Numerical LOLA patch ${g.id}: ${g.sourceUrl ?? terrain.source}`,
        notes: [`Regional central differences; projected grid ${g.stepM} × ${g.stepYM ?? g.stepM} m, input pixels ${g.inputPixelM ?? terrain.sourcePixelM} m; stereographic scale corrected. Stencil spans twice the reported spacing on each axis.`, `Terrain frame: ${terrain.frame}. Effective resolution and slope accuracy are unquantified.`]};
    }
  }
  if (global && global.outputSpacingM > 0 && Number.isFinite(global.outputSpacingM)) {
    const d = global.outputSpacingM;
    const values = [0, 90, 180, 270].map(az => { const p = destination(lat, lon, az * rad, d / global.radiusM); return sampleGlobalHeight(global, p.lat, p.lon); });
    if (sampleGlobalHeight(global, lat, lon) !== null && values.every((v): v is number => v !== null && Number.isFinite(v))) {
      const [n, e, s, w] = values as number[];
      return {slopeDeg: Math.atan(Math.hypot((e - w) / (2 * d), (n - s) / (2 * d))) / rad, spacingM: d,
        source: `Coarse numerical LOLA ${global.source.productId} ${global.source.version}: ${global.source.url}`,
        notes: [`Regional ENU central differences at ${d} m spacing (stencil diameter ${2 * d} m). Source pixels ${global.source.sourceSpacingM} m; area-averaged output. No fine patch support.`, `Terrain frame: ${global.source.frame}. Effective resolution and slope accuracy are unquantified.`]};
    }
  }
  return {slopeDeg: null, spacingM: null, source: 'Regional slope unavailable', notes: ['No supported numerical elevation stencil; imagery, named slope metadata and smooth sphere are not slope evidence.']};
}
