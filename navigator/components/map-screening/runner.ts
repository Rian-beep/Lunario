import type { GlobalTerrainData } from '../../lib/global-terrain';
import { viewportGrid, viewportLocations, wrapLongitude, type ScreeningViewport } from '../../lib/map-overlays';
import type { ScreeningPoint, ScreeningRequest } from '../../lib/suitability';
import type { TerrainData } from '../../lib/terrain';
import type { MapLayerSettings } from './model';

export type PhysicalInput = Pick<ScreeningRequest, 'catalog' | 'startIndex' | 'endIndex' | 'arrayHeightM' | 'antennaHeightM' | 'antennaMaskDeg'> & {
  terrain: TerrainData | null; projection: 'polar' | 'global'; viewport?: ScreeningViewport;
};
export type ScreeningLane = Pick<typeof import('../../lib/suitability'), 'screeningSamples' | 'screeningLocations' | 'reweightScreeningPoints'>;
export type LayerDependencies = {
  screening: () => Promise<ScreeningLane>;
  terrain: () => Promise<TerrainData>;
  globalTerrain: () => Promise<GlobalTerrainData>;
};
export const layerDependencies: LayerDependencies = {
  screening: () => import('../../lib/suitability'),
  terrain: async () => (await import('../../lib/terrain')).loadTerrain(),
  globalTerrain: async () => (await import('../../lib/global-terrain')).loadGlobalTerrain(),
};
export type PhysicalResult = {
  input: PhysicalInput; points: ScreeningPoint[]; request: ScreeningRequest; lane: ScreeningLane;
  viewport?: ScreeningViewport; sampling: string; warnings: string[];
};
type JobCallbacks = {
  onStart: () => void; onProgress: (fraction: number) => void;
  onResult: (result: PhysicalResult) => void; onError: (error: unknown) => void;
};
const message = (e: unknown) => e instanceof Error ? e.message : String(e);
export function checkCancelled(signal: AbortSignal): void {
  if (signal.aborted) { const error = new Error('Map screening cancelled'); error.name = 'AbortError'; throw error; }
}

/** Per-hook two-result LRU. Shared source loaders coalesce DEM requests and retain their retry policy. */
export class ScreeningRunner {
  private cache: { input: PhysicalInput; result: PhysicalResult }[] = [];
  constructor(private readonly dependencies = layerDependencies) {}
  get cacheSize() { return this.cache.length; }
  clear() { this.cache = []; }

  /** Effect cleanup cancels both the viewport debounce and later asynchronous publication. */
  schedule(input: PhysicalInput, callbacks: JobCallbacks): () => void {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      callbacks.onStart();
      void this.run(input, controller.signal, progress => {
        if (!controller.signal.aborted) callbacks.onProgress(progress);
      }).then(result => {
        if (!controller.signal.aborted) callbacks.onResult(result);
      }).catch(error => {
        if (!controller.signal.aborted) callbacks.onError(error);
      });
    }, input.viewport ? 250 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }

  async run(input: PhysicalInput, signal: AbortSignal, onProgress: (fraction: number) => void): Promise<PhysicalResult> {
    checkCancelled(signal);
    if (input.projection === 'global' && input.viewport) viewportGrid(input.viewport, 1);
    const same = (a: PhysicalInput, b: PhysicalInput) => a.catalog === b.catalog && a.terrain === b.terrain &&
      a.startIndex === b.startIndex && a.endIndex === b.endIndex && a.arrayHeightM === b.arrayHeightM &&
      a.antennaHeightM === b.antennaHeightM && a.antennaMaskDeg === b.antennaMaskDeg && a.projection === b.projection &&
      JSON.stringify(a.viewport) === JSON.stringify(b.viewport);
    const index = this.cache.findIndex(entry => same(entry.input, input));
    if (index >= 0) {
      const hit = this.cache.splice(index, 1)[0]; this.cache.push(hit); onProgress(1); checkCancelled(signal); return hit.result;
    }
    const suppliedGlobal = input.catalog.globalTerrain ?? input.terrain?.globalTerrain;
    const [laneResult, local, global] = await Promise.allSettled([
      this.dependencies.screening(), input.terrain ? Promise.resolve(input.terrain) : this.dependencies.terrain(),
      suppliedGlobal ? Promise.resolve(suppliedGlobal) : this.dependencies.globalTerrain(),
    ]);
    checkCancelled(signal);
    if (laneResult.status === 'rejected') throw laneResult.reason;
    const lane = laneResult.value;
    const warnings = [local.status === 'rejected' ? `Local elevations unavailable: ${message(local.reason)}` : '',
      global.status === 'rejected' ? `Global elevations unavailable: ${message(global.reason)}` : ''].filter(Boolean);
    const globalData = global.status === 'fulfilled' ? global.value : null;
    const request: ScreeningRequest = { ...input, weights: { sun: 1, dark: 1, slope: 1, comms: 1 }, slopeScaleDeg: 10,
      terrain: local.status === 'fulfilled' ? local.value : null, globalTerrain: globalData };
    // Without DEM spacing evidence, use the verified 15° coarse lattice rather than fabricate refinement.
    const viewport = input.projection === 'global' && input.viewport && globalData
      ? viewportGrid(input.viewport, globalData.angularStepDeg) : undefined;
    if (input.viewport && input.projection === 'global' && !globalData) warnings.push('Viewport refinement unavailable without global DEM spacing; showing the 15° lattice.');
    let last = -Infinity;
    const progress = (completed: number, total: number) => {
      checkCancelled(signal);
      const now = performance.now();
      if (now - last >= 100 || completed === total) { last = now; onProgress(total ? completed / total : 1); }
    };
    const options = { signal, onProgress: progress };
    const points = viewport
      ? await lane.screeningLocations(request, viewportLocations(viewport), options)
      : await lane.screeningSamples(request, input.projection, options);
    checkCancelled(signal);
    const sampling = input.projection === 'polar'
      ? polarSampling(input.catalog)
      : viewport ? `${viewport.cols} × ${viewport.rows} viewport centres; ${viewport.cols ? ((viewport.east - viewport.west) / viewport.cols).toFixed(4) : 'no supported'}° longitude × ${viewport.rows ? ((viewport.north - viewport.south) / viewport.rows).toFixed(4) : 'no supported'}° latitude cells. Minimum DEM step ${globalData!.angularStepDeg}°.`
        : '288 global centres; 15° latitude × 15° longitude cells. Coarse regional screening.';
    const result = { input, points, request, lane, viewport, sampling, warnings };
    this.cache.push({ input, result });
    if (this.cache.length > 2) this.cache.shift();
    return result;
  }
}

function polarSampling(catalog: PhysicalInput['catalog']): string {
  const rings = new Map<number, number[]>();
  catalog.grid.lat.forEach((lat, i) => { const lons = rings.get(lat) ?? []; lons.push(wrapLongitude(catalog.grid.lon[i])); rings.set(lat, lons); });
  const lats = [...rings.keys()].sort((a, b) => a - b);
  const latSteps = lats.slice(1).map((lat, i) => lat - lats[i]);
  const lonSteps = [...rings.values()].flatMap(lons => {
    const sorted = [...new Set(lons)].sort((a, b) => a - b);
    return sorted.length < 2 ? [] : sorted.map((lon, i) => (sorted[i + 1] ?? sorted[0] + 360) - lon);
  });
  const range = (values: number[]) => values.length ? `${Number(Math.min(...values).toFixed(4))}–${Number(Math.max(...values).toFixed(4))}°` : 'unspecified';
  return `${catalog.grid.lat.length} exact prepared polar centres; ${range(latSteps)} latitude steps, ${range(lonSteps)} longitude sectors. No polar-cap fill beyond sampled support.`;
}

export function recolourScreening(result: PhysicalResult, settings: Pick<MapLayerSettings, 'weights' | 'slopeScaleDeg'>): ScreeningPoint[] {
  return result.lane.reweightScreeningPoints({ ...result.request, weights: settings.weights, slopeScaleDeg: settings.slopeScaleDeg }, result.points)
    .map(point => ({ ...point, notes: point.notes.map(note => note.startsWith('Slope scale ')
      ? `Slope scale ${settings.slopeScaleDeg}° is a ranking preference, not a landing-footprint safety limit. Score is a weighted arithmetic index (0–100), not probability or mission readiness.` : note) }));
}

/** Static JSON lives inside the on-demand chunk and is validated without file:// HTTP. */
export async function loadStaticIce() {
  const [lane, data] = await Promise.all([import('../../lib/ice'), import('../../public/data/ice/catalog.json')]);
  return { features: lane.parseIceCatalog(data.default).features, sources: lane.ICE_SOURCES };
}
