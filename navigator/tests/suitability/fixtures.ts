import {readFileSync} from 'node:fs';
import {decodeCatalog, type Catalog, type Site} from '../../lib/catalog';
import type {GlobalTerrainData, GlobalTerrainMetadata} from '../../lib/global-terrain';
import type {TerrainData, TerrainGrid} from '../../lib/terrain';
import {DEFAULT_SCREENING_WEIGHTS, type ScreeningRequest} from '../../lib/suitability';

export function catalog(n = 4): Catalog {
  const values = (v: number) => new Float64Array(n).fill(v);
  const site: Site = {id: 'synthetic', name: 'Synthetic', lat: 0, lon: 0, group: 'reference', summary: '', source: 'Synthetic test', sourceUrl: '', demHeightM: null, slopeDeg: 89,
    horizons: [{heightM: 2, stepDeg: 90, mask: new Float64Array(4)}]};
  return {meta: {n, stepHours: 1, moonRadiusM: 1737400} as Catalog['meta'], t0ms: 0,
    subsolarLat: values(0), subsolarLon: values(0), subearthLat: values(0), subearthLon: values(0),
    earthRangeKm: values(384400), sunRadiusDeg: values(.25), map: {} as Catalog['map'], sites: [site],
    grid: {heightM: 2, stepDeg: 90, lat: new Float64Array([0]), lon: new Float64Array([0]), mask: new Float64Array(4), nAz: 4}};
}

export function request(c = catalog()): ScreeningRequest {
  return {catalog: c, startIndex: 0, endIndex: c.meta.n - 2, arrayHeightM: 2, antennaHeightM: 2, antennaMaskDeg: 0,
    slopeScaleDeg: 10, weights: {...DEFAULT_SCREENING_WEIGHTS}};
}

export const globalMetadata = JSON.parse(readFileSync('public/data/global-terrain.json', 'utf8')) as GlobalTerrainMetadata;
export function globalTerrain(fn: (lat: number, lon: number) => number = () => 0): GlobalTerrainData {
  const width = 512, height = 256, angularStepDeg = 360 / width;
  const samples = Int16Array.from({length: width * height}, (_, i) => Math.round(2 * fn(90 - (Math.floor(i / width) + .5) * angularStepDeg, (i % width + .5) * angularStepDeg)));
  const pole = (row: number) => [...samples.slice(row * width, (row + 1) * width)].reduce((sum, v) => sum + v * .5, 0) / width;
  return {...globalMetadata, samples, width, height, angularStepDeg, northPoleM: pole(0), southPoleM: pole(height - 1)};
}

export function localTerrain(gradientX = 0, gradientY = 0): TerrainData {
  const width = 9, stepM = 20, stepYM = 40;
  const patch: TerrainGrid = {id: 'synthetic-plane', width, height: width, x0: -80, y0: 160, stepM, stepYM,
    inputPixelM: 5, sourceUrl: 'synthetic:plane', heights: Array.from({length: width * width}, (_, i) => (-80 + (i % width) * stepM) * gradientX + (160 - Math.floor(i / width) * stepYM) * gradientY)};
  return {version: 1, source: 'synthetic:plane', sourcePage: '', retrievedUtc: '', frame: 'Synthetic south polar stereographic', sourcePixelM: 5, sampling: 'Synthetic', overview: patch, patches: [patch]};
}

export function actualCatalog(): Catalog {
  return decodeCatalog(JSON.parse(readFileSync('public/data/catalog.json', 'utf8')));
}
