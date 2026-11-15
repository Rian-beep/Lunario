import type { Catalog } from '../../lib/catalog';
import type { GlobalTerrainData } from '../../lib/global-terrain';
import type { IceFeature, IceSource } from '../../lib/ice';
import type { MapMetric, MapScreenRaster, ScreeningViewport } from '../../lib/map-overlays';
import type { ScenarioState } from '../../lib/scenario';
import type { ScreeningPoint, ScreeningWeights } from '../../lib/suitability';
import type { TerrainData } from '../../lib/terrain';

export type { ScreeningViewport } from '../../lib/map-overlays';
export type MapLayerSettings = {
  enabled: boolean; metric: MapMetric; weights: ScreeningWeights; slopeScaleDeg: number; opacity: number; iceEnabled: boolean;
};
export const DEFAULT_MAP_LAYERS: MapLayerSettings = Object.freeze({
  enabled: false, metric: 'combined', weights: Object.freeze({ sun: 1, dark: 1, slope: 1, comms: 1 }),
  slopeScaleDeg: 10, opacity: .55, iceEnabled: false,
});
export type MapLayerInput = {
  catalog: Catalog | null; state: ScenarioState | null; terrain: TerrainData | null;
  projection: 'polar' | 'global'; visible: boolean; settings: MapLayerSettings; viewport?: ScreeningViewport;
};
export type MapLayerModel = {
  raster: MapScreenRaster | null; iceFeatures: IceFeature[]; points: ScreeningPoint[];
  status: string; progress: number; error: string; busy: boolean; iceStatus: string; iceError: string;
  iceSources: readonly Readonly<IceSource>[]; dates: string; sampling: string; source: string;
  viewport?: ScreeningViewport; globalTerrain: GlobalTerrainData | null; retry: () => void;
};
