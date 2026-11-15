import type { Catalog } from "@/lib/catalog";
import { horizonAt, projectedToLatLon, sunAzEl } from "@/lib/astro";

export type LightingIndex = {
  cols: number;
  rows: number;
  cellOfPixel: Uint16Array;
  nCells: number;
};

const EMPTY = 65535;

/** Nearest precomputed horizon cell for each pixel of a coarse south-polar overlay. */
export function prepareLighting(catalog: Catalog, cols = 180, rows = 180): LightingIndex {
  const { grid, map } = catalog;
  const byLat = new Map<number, number[]>();
  for (let i = 0; i < grid.lat.length; i++) {
    const key = Math.round(grid.lat[i] * 100);
    const list = byLat.get(key);
    if (list) list.push(i);
    else byLat.set(key, [i]);
  }
  const latKeys = [...byLat.keys()];
  const cellOfPixel = new Uint16Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ix = ((c + 0.5) / cols) * map.width;
      const iy = ((r + 0.5) / rows) * map.height;
      const x = map.tieX + (ix + map.centerOffset) * map.scaleM;
      const y = map.tieY - (iy + map.centerOffset) * map.scaleM;
      const { lat, lon } = projectedToLatLon(x, y);
      const slot = r * cols + c;
      if (lat > -79.6 || latKeys.length === 0) {
        cellOfPixel[slot] = EMPTY;
        continue;
      }
      let bestKey = latKeys[0];
      let bestD = Infinity;
      for (const key of latKeys) {
        const d = Math.abs(key / 100 - lat);
        if (d < bestD) {
          bestD = d;
          bestKey = key;
        }
      }
      const list = byLat.get(bestKey) ?? [];
      const lonN = ((lon % 360) + 360) % 360;
      let best = list[0] ?? 0;
      let bestLon = Infinity;
      for (const idx of list) {
        let d = Math.abs(grid.lon[idx] - lonN);
        if (d > 180) d = 360 - d;
        if (d < bestLon) {
          bestLon = d;
          best = idx;
        }
      }
      cellOfPixel[slot] = best;
    }
  }
  return { cols, rows, cellOfPixel, nCells: grid.lat.length };
}

/** 0 shadowed, 1 sunlit (any solar disk), 2 unknown. One value per horizon-grid cell. */
export function sunlitCells(catalog: Catalog, timeIndex: number, nCells: number): Uint8Array {
  const i = Math.max(0, Math.min(catalog.meta.n - 1, timeIndex | 0));
  const flags = new Uint8Array(nCells);
  const sslat = catalog.subsolarLat[i];
  const sslon = catalog.subsolarLon[i];
  const radius = catalog.sunRadiusDeg[i];
  const { grid } = catalog;
  for (let c = 0; c < nCells; c++) {
    const mask = grid.mask.subarray(c * grid.nAz, (c + 1) * grid.nAz);
    const [az, el] = sunAzEl(grid.lat[c], grid.lon[c], sslat, sslon);
    const horizon = horizonAt(mask, grid.stepDeg, az);
    if (!Number.isFinite(horizon)) flags[c] = 2;
    else flags[c] = el + radius > horizon ? 1 : 0;
  }
  return flags;
}

export function lightingPixels(index: LightingIndex, flags: Uint8Array): ImageData {
  const pixels = new Uint8ClampedArray(index.cols * index.rows * 4);
  for (let p = 0; p < index.cellOfPixel.length; p++) {
    const cell = index.cellOfPixel[p];
    if (cell === EMPTY || cell >= flags.length) continue;
    const o = p * 4;
    const flag = flags[cell];
    if (flag === 1) {
      pixels[o] = 230;
      pixels[o + 1] = 150;
      pixels[o + 2] = 30;
      pixels[o + 3] = 78;
    } else if (flag === 0) {
      pixels[o] = 16;
      pixels[o + 1] = 36;
      pixels[o + 2] = 78;
      pixels[o + 3] = 88;
    }
  }
  return new ImageData(pixels, index.cols, index.rows);
}
