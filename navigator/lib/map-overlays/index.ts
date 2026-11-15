import { latLonToProjected } from '../astro';
import type { Catalog } from '../catalog';
import type { IceFeature } from '../ice';
import type { ScreeningPoint } from '../suitability';

export type MapMetric = 'combined' | 'sun' | 'dark' | 'slope' | 'comms';
export type MapBounds = { west: number; east: number; south: number; north: number };
export type ScreeningViewport = MapBounds & { cols: number; rows: number };
export type MapScreenRaster = {
  canvas: HTMLCanvasElement;
  projection: 'polar' | 'global';
  bounds?: MapBounds;
};
export type ScreenCell = MapBounds & { point: ScreeningPoint };
export const GLOBAL_BOUNDS: Readonly<MapBounds> = Object.freeze({ west: -180, east: 180, south: -90, north: 90 });
export const INDEX_PALETTE = ['#7652a3', '#efb34c', '#91d5ba'] as const;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
export const wrapLongitude = (lon: number) => ((lon + 180) % 360 + 360) % 360 - 180;
const key = (lat: number, lon: number) => `${lat.toFixed(8)}:${wrapLongitude(lon).toFixed(8)}`;

/** Preserve unwrapped seam-crossing bounds; reduce density rather than oversampling the DEM. */
export function viewportGrid(viewport: ScreeningViewport, minimumStepDeg: number): ScreeningViewport {
  const { west, east, south, north, cols, rows } = viewport;
  if (![west, east, south, north].every(Number.isFinite) || east <= west || east - west > 360 ||
      south < -90 || north > 90 || north <= south || !Number.isInteger(cols) || !Number.isInteger(rows) ||
      cols < 1 || rows < 1 || cols * rows > 256 || !Number.isFinite(minimumStepDeg) || minimumStepDeg <= 0) {
    throw new RangeError('Viewport needs ordered geographic bounds and 1–256 point centres.');
  }
  // A narrower view can contain no supported sample cell; do not invent finer resolution.
  const maxCols = Math.floor((east - west) / minimumStepDeg + 1e-10);
  const maxRows = Math.floor((north - south) / minimumStepDeg + 1e-10);
  return { west, east, south, north, cols: Math.min(cols, maxCols), rows: Math.min(rows, maxRows) };
}

export function viewportLocations(grid: ScreeningViewport): { lat: number; lon: number }[] {
  if (grid.cols === 0 || grid.rows === 0) return [];
  return Array.from({ length: grid.cols * grid.rows }, (_, i) => ({
    lat: grid.north - (Math.floor(i / grid.cols) + .5) * (grid.north - grid.south) / grid.rows,
    lon: grid.west + (i % grid.cols + .5) * (grid.east - grid.west) / grid.cols,
  }));
}

export function metricValue(point: ScreeningPoint, metric: MapMetric): number | null {
  const value = metric === 'combined' ? point.score : metric === 'sun' ? point.sunFraction === null ? null : point.sunFraction * 100
    : metric === 'dark' ? point.longestDarkHours : metric === 'slope' ? point.slopeDeg
      : point.commsFraction === null ? null : point.commsFraction * 100;
  return value !== null && Number.isFinite(value) ? value : null;
}

/** Low→high always means the displayed raw quantity, including hours and degrees. */
export function metricRange(metric: MapMetric, points: readonly ScreeningPoint[]): [number, number] {
  if (metric === 'combined' || metric === 'sun' || metric === 'comms') return [0, 100];
  return [0, Math.max(1, ...points.map(p => metricValue(p, metric) ?? 0))];
}

export function rampColor(value: number | null, range: readonly [number, number]): string | null {
  if (value === null || !Number.isFinite(value) || !range.every(Number.isFinite) || range[1] <= range[0]) return null;
  const t = clamp((value - range[0]) / (range[1] - range[0])) * 2;
  const stops = [[118, 82, 163], [239, 179, 76], [145, 213, 186]];
  const i = Math.min(1, Math.floor(t)), f = t - i;
  return `rgb(${stops[i].map((v, j) => Math.round(v + (stops[i + 1][j] - v) * f)).join(', ')})`;
}

/** Cells are display support around actual centres, never interpolated physical measurements. */
export function screeningCells(points: readonly ScreeningPoint[], projection: 'polar' | 'global', catalog: Catalog,
  viewport?: ScreeningViewport): ScreenCell[] {
  const lookup = new Map(points.map(p => [key(p.lat, p.lon), p]));
  if (projection === 'global') {
    const grid = viewport ?? { ...GLOBAL_BOUNDS, cols: 24, rows: 12 };
    return viewportLocations(grid).flatMap(p => {
      const point = lookup.get(key(p.lat, p.lon));
      if (!point) return [];
      const dx = (grid.east - grid.west) / grid.cols / 2, dy = (grid.north - grid.south) / grid.rows / 2;
      return [{ point, west: p.lon - dx, east: p.lon + dx, south: p.lat - dy, north: p.lat + dy }];
    });
  }
  const rows = new Map<number, number[]>();
  catalog.grid.lat.forEach((lat, i) => {
    const lons = rows.get(lat) ?? [];
    lons.push(wrapLongitude(catalog.grid.lon[i])); rows.set(lat, lons);
  });
  const lats = [...rows.keys()].sort((a, b) => a - b);
  return lats.flatMap((lat, row) => {
    const below = lats[row - 1] ?? lat - (lats[row + 1] - lat);
    const above = lats[row + 1] ?? lat + (lat - lats[row - 1]);
    if (!Number.isFinite(below + above)) return [];
    const lons = [...new Set(rows.get(lat)!)].sort((a, b) => a - b);
    if (lons.length < 2) return [];
    return lons.flatMap((lon, col) => {
      const point = lookup.get(key(lat, lon));
      if (!point) return [];
      const previous = col ? lons[col - 1] : lons[lons.length - 1] - 360;
      const next = col + 1 < lons.length ? lons[col + 1] : lons[0] + 360;
      return [{ point, west: (previous + lon) / 2, east: (lon + next) / 2,
        south: Math.max(-90, (lat + below) / 2), north: Math.min(0, (lat + above) / 2) }];
    });
  });
}

export function cellAt(cells: readonly ScreenCell[], lat: number, lon: number): ScreenCell | null {
  if (!Number.isFinite(lat + lon) || Math.abs(lat) > 90) return null;
  return cells.find(cell => {
    const unwrapped = cell.west + ((lon - cell.west) % 360 + 360) % 360;
    return lat >= cell.south && (lat < cell.north || lat === 90 && cell.north === 90) && unwrapped < cell.east;
  }) ?? null;
}

export function polarPixel(catalog: Catalog, lat: number, lon: number): { x: number; y: number } {
  const p = latLonToProjected(lat, lon), m = catalog.map;
  return { x: (p.x - m.tieX) / m.scaleM - m.centerOffset, y: (m.tieY - p.y) / m.scaleM - m.centerOffset };
}

/** Call only in a browser. Importing this module is safe during SSR. Opacity is baked in once. */
export function createMapScreenRaster(input: { catalog: Catalog; points: readonly ScreeningPoint[];
  projection: 'polar' | 'global'; metric: MapMetric; opacity: number; viewport?: ScreeningViewport }): MapScreenRaster | null {
  if (typeof document === 'undefined') return null;
  const { catalog, points, projection, metric, viewport } = input;
  const canvas = document.createElement('canvas');
  canvas.width = projection === 'polar' ? catalog.map.width : 960;
  canvas.height = projection === 'polar' ? catalog.map.height : 480;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.globalAlpha = Number.isFinite(input.opacity) ? clamp(input.opacity) : 0;
  const bounds = viewport ?? GLOBAL_BOUNDS, range = metricRange(metric, points);
  for (const cell of screeningCells(points, projection, catalog, viewport)) {
    const color = rampColor(metricValue(cell.point, metric), range);
    if (!color) continue;
    ctx.fillStyle = color;
    if (projection === 'global') {
      ctx.fillRect((cell.west - bounds.west) / (bounds.east - bounds.west) * canvas.width,
        (bounds.north - cell.north) / (bounds.north - bounds.south) * canvas.height,
        (cell.east - cell.west) / (bounds.east - bounds.west) * canvas.width,
        (cell.north - cell.south) / (bounds.north - bounds.south) * canvas.height);
    } else {
      ctx.beginPath();
      // Follow both latitude arcs; clipping is the catalogue's full map pixel rectangle.
      const steps = Math.max(1, Math.ceil(cell.east - cell.west));
      for (let i = 0; i <= steps; i++) {
        const p = polarPixel(catalog, cell.south, cell.west + (cell.east - cell.west) * i / steps);
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      for (let i = steps; i >= 0; i--) {
        const p = polarPixel(catalog, cell.north, cell.west + (cell.east - cell.west) * i / steps);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath(); ctx.fill();
    }
  }
  return { canvas, projection, ...(projection === 'global' ? { bounds: { west: bounds.west, east: bounds.east, south: bounds.south, north: bounds.north } } : {}) };
}

/** No polygon centroid or boundary is manufactured: only published Point references are annotated. */
export function iceReference(feature: IceFeature): { lat: number; lon: number } | null {
  return feature.geometry.type === 'Point' ? { lat: feature.geometry.coordinates[1], lon: feature.geometry.coordinates[0] } : null;
}

/** Project into the caller's annotation coordinate space; marker radius is in those same units. */
export function drawIceMarkers(ctx: CanvasRenderingContext2D, features: readonly IceFeature[],
  project: (lat: number, lon: number) => { x: number; y: number } | null): void {
  ctx.save();
  try {
    ctx.globalAlpha = 1; ctx.lineWidth = 1.5; ctx.strokeStyle = '#102d45'; ctx.fillStyle = '#78c8f1';
    for (const feature of features) {
      const reference = iceReference(feature), p = reference && project(reference.lat, reference.lon);
      if (!p || !Number.isFinite(p.x + p.y)) continue;
      ctx.beginPath();
      // Diamonds for PSR/surface references; a cross for impact-ejecta evidence.
      if (feature.evidence === 'impact-water-detection') {
        ctx.moveTo(p.x - 4, p.y); ctx.lineTo(p.x + 4, p.y);
        ctx.moveTo(p.x, p.y - 4); ctx.lineTo(p.x, p.y + 4);
        ctx.strokeStyle = '#78c8f1'; ctx.stroke(); ctx.strokeStyle = '#102d45';
      } else {
        ctx.moveTo(p.x, p.y - 4); ctx.lineTo(p.x + 4, p.y); ctx.lineTo(p.x, p.y + 4); ctx.lineTo(p.x - 4, p.y);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
  } finally { ctx.restore(); }
}
