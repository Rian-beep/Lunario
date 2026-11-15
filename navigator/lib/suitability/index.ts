import {buildSeries, diskFraction, summarize, type TerrainChoice} from '../astro';
import type {Catalog} from '../catalog';
import type {TerrainData} from '../terrain';
import type {GlobalTerrainData} from '../global-terrain';
import {observedAbsence} from '../observed-duration';
import {coarseHorizon, longitude, prepared, regionalSlope} from './geometry';

export type ScreeningWeights = {sun: number; dark: number; slope: number; comms: number};
export type ScreeningRequest = {
  catalog: Catalog; startIndex: number; endIndex: number;
  arrayHeightM: number; antennaHeightM: number; antennaMaskDeg: number;
  slopeScaleDeg: number; weights: ScreeningWeights;
  terrain?: TerrainData | null; globalTerrain?: GlobalTerrainData | null;
};
export type ScreeningPoint = {
  lat: number; lon: number; sunFraction: number | null; longestDarkHours: number | null;
  darkLowerBound: boolean; commsFraction: number | null; slopeDeg: number | null;
  score: number | null; source: string; spacingM: number | null; notes: string[];
};
export const DEFAULT_SCREENING_WEIGHTS: Readonly<ScreeningWeights> = Object.freeze({sun: 1, dark: 1, slope: 1, comms: 1});
export const DEFAULT_SLOPE_SCALE_DEG = 10;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const finite = (v: number) => Number.isFinite(v) ? v : null;

function validate(request: ScreeningRequest) {
  const weights = request.weights ?? DEFAULT_SCREENING_WEIGHTS;
  const values = [weights.sun, weights.dark, weights.slope, weights.comms];
  if (!values.every(v => Number.isFinite(v) && v >= 0) || !values.some(v => v > 0)) throw new RangeError('Screening weights must be finite, nonnegative and have positive total.');
  const slopeScaleDeg = request.slopeScaleDeg ?? DEFAULT_SLOPE_SCALE_DEG;
  if (!Number.isFinite(slopeScaleDeg) || slopeScaleDeg <= 0) throw new RangeError('Slope ranking scale must be positive and finite.');
  const {catalog, startIndex, endIndex} = request;
  if (!Number.isInteger(startIndex) || !Number.isInteger(endIndex) || startIndex < 0 || endIndex < startIndex || endIndex > catalog.meta.n - 2 || !(catalog.meta.stepHours > 0) || !Number.isFinite(catalog.meta.stepHours)) throw new RangeError('Unsupported screening stay: use inclusive forcing indices through n−2; the last epoch is only an endpoint.');
  return {...request, weights: {...weights}, slopeScaleDeg};
}

function score(request: ScreeningRequest, point: ScreeningPoint) {
  const hours = (request.endIndex - request.startIndex + 1) * request.catalog.meta.stepHours;
  const components = [point.sunFraction, point.longestDarkHours === null ? null : 1 - point.longestDarkHours / hours,
    point.slopeDeg === null ? null : 1 - point.slopeDeg / request.slopeScaleDeg, point.commsFraction];
  const weights = [request.weights.sun, request.weights.dark, request.weights.slope, request.weights.comms];
  // Scale before summing so even very large finite weights retain a finite arithmetic mean.
  const max = Math.max(...weights);
  let sum = 0, total = 0;
  for (let i = 0; i < components.length; i++) {
    if (weights[i] === 0) continue;
    const value = components[i];
    if (value === null || !Number.isFinite(value)) return null;
    sum += clamp(value) * (weights[i] / max); total += weights[i] / max;
  }
  return 100 * clamp(sum / total);
}

/** Recolour an existing physical screen without rerunning horizons or ephemeris. */
export function reweightScreeningPoints(request:ScreeningRequest,points:readonly ScreeningPoint[]):ScreeningPoint[]{
  const validated=validate(request);return points.map(point=>({...point,score:score(validated,point)}));
}
export const SCREENING_MODEL_VERSION='regional-screening-1';

function* resolveHorizon(request: ScreeningRequest, lat: number, lon: number, heightM: number): Generator<void, {terrain: TerrainChoice | null; source: string}> {
  if (!Number.isFinite(heightM) || heightM < 0) return {terrain: null, source: `Unsupported instrument height ${heightM} m`};
  const exact = prepared(request.catalog, lat, lon, heightM);
  if (exact) return exact;
  const data = request.globalTerrain;
  if (!data) return {terrain: null, source: `No exact prepared horizon at ${heightM} m; coarse global DEM not supplied`};
  const terrain = yield* coarseHorizon(data, lat, lon, heightM);
  return {terrain, source: `Coarse global LOLA ${data.source.productId} ${data.source.version}; ${data.outputSpacingM} m output; ${heightM} m instrument; 2° azimuth, 200 logarithmic rays 1 m–1000 km`};
}

function* pointWork(request: ScreeningRequest, lat: number, lon: number): Generator<void, ScreeningPoint> {
  const array = yield* resolveHorizon(request, lat, lon, request.arrayHeightM);
  const antenna = request.arrayHeightM === request.antennaHeightM ? array : yield* resolveHorizon(request, lat, lon, request.antennaHeightM);
  const slope = regionalSlope(request.terrain, request.globalTerrain, lat, lon);
  yield;
  let exposure = 0, solarKnown = !!array.terrain, contact = 0, contactKnown = !!antenna.terrain;
  const visible: (boolean | null)[] = [];
  const {catalog, startIndex, endIndex} = request, n = endIndex - startIndex + 1;
  for (let i = startIndex; i <= endIndex; i += 64) {
    const end = Math.min(i + 63, endIndex);
    const solarSeries = array.terrain ? buildSeries(catalog, lat, lon, array.terrain, i, end) : null;
    if (solarSeries) {
      const series = solarSeries;
      for (let k = 0; k < series.sunEl.length; k++) {
        const el = series.sunEl[k], horizon = series.sunHorizon[k], radius = series.sunRadius[k];
        const known = [el, horizon, radius].every(Number.isFinite) && radius > 0;
        const disk = known ? diskFraction(el, horizon, radius) : NaN;
        if (!known) solarKnown = false;
        exposure += Number.isFinite(disk) ? disk : 0;
        visible.push(known ? el + radius > horizon : null);
      }
    }
    if (antenna.terrain) {
      const series = antenna === array && solarSeries ? solarSeries : buildSeries(catalog, lat, lon, antenna.terrain, i, end);
      const summary = summarize(series, catalog.meta.stepHours, {antennaMaskDeg: request.antennaMaskDeg});
      if (!Number.isFinite(summary.earthTerrain)) contactKnown = false;
      else contact += summary.earthTerrain * summary.samples;
    }
    yield;
  }
  const absence = solarKnown ? observedAbsence(visible, catalog.meta.stepHours) : null;
  const point: ScreeningPoint = {lat, lon, sunFraction: solarKnown ? finite(exposure / n) : null,
    longestDarkHours: absence?.hours ?? null, darkLowerBound: absence?.lowerBound ?? false,
    commsFraction: contactKnown ? finite(contact / n) : null, slopeDeg: slope.slopeDeg, score: null,
    source: `Sun: ${array.source}. Earth: ${antenna.source}. Slope: ${slope.source}.`, spacingM: slope.spacingM,
    notes: [...slope.notes, `Sun is mean uniform visible-disk fraction, not electrical power. Darkness uses any visible solar limb; ${catalog.meta.stepHours} h forcing.`,
      `Earth-centre contact requires elevation strictly above max(terrain, ${request.antennaMaskDeg}° absolute antenna cutoff); not a ground-station service or RF margin.`,
      `Slope scale ${request.slopeScaleDeg}° is a ranking preference, not a landing-footprint safety limit. Score is a weighted arithmetic index (0–100), not probability or mission readiness.`,
      'Prepared horizons use original 40 m LOLA with 240 m fallback; frame equivalence, effective resolution and propagated uncertainty remain unresolved. Coarse global rays do not resolve subpixel obstacles.']};
  if (point.darkLowerBound) point.notes.push('Longest observed darkness touches a stay boundary: duration is a lower bound and may extend outside the selected dates.');
  if (point.sunFraction === null) point.notes.push('Solar coverage or array-height horizon unsupported: sunlight and darkness remain unknown.');
  if (point.commsFraction === null) point.notes.push('Earth coverage, antenna height or antenna cutoff unsupported: contact remains unknown.');
  point.score = score(request, point);
  return point;
}

function coordinates(lat: number, lon: number) {
  if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon)) throw new RangeError('Screening coordinates must be finite with latitude in [−90,90].');
  return {lat, lon: longitude(lon)};
}

/** Synchronous inspection at this exact coordinate; use screeningSamples for cooperative map jobs. */
export function screeningPoint(request: ScreeningRequest, lat: number, lon: number): ScreeningPoint {
  const validated = validate(request), p = coordinates(lat, lon), work = pointWork(validated, p.lat, p.lon);
  let next = work.next();
  while (!next.done) next = work.next();
  return next.value;
}

function abort(signal?: AbortSignal) {
  if (signal?.aborted) { const error = new Error('Screening cancelled'); error.name = 'AbortError'; throw error; }
}
const yieldTask = () => new Promise<void>(resolve => setTimeout(resolve, 0));

type ScreeningJobOptions={signal?:AbortSignal;onProgress?:(completed:number,total:number)=>void};
async function sampleCoordinates(request:ScreeningRequest,locations:readonly {lat:number;lon:number}[],options:ScreeningJobOptions):Promise<ScreeningPoint[]>{
  abort(options.signal);const validated=validate(request),total=locations.length,results:ScreeningPoint[]=[];
  await yieldTask();abort(options.signal);options.onProgress?.(0,total);abort(options.signal);
  for(const location of locations){
    const p=coordinates(location.lat,location.lon),work=pointWork(validated,p.lat,p.lon);
    let began=performance.now(),steps=0,next=work.next();
    while(!next.done){abort(options.signal);if(++steps>=32||performance.now()-began>=6){await yieldTask();abort(options.signal);began=performance.now();steps=0;}next=work.next();}
    abort(options.signal);results.push(next.value);options.onProgress?.(results.length,total);abort(options.signal);await yieldTask();abort(options.signal);
  }
  return results;
}
/** Bounded viewport refinement: never create an unbounded global fine-grid job. */
export async function screeningLocations(request:ScreeningRequest,locations:readonly {lat:number;lon:number}[],options:ScreeningJobOptions={}):Promise<ScreeningPoint[]>{
  if(locations.length>256)throw new RangeError('Viewport screening is limited to256 samples.');
  return sampleCoordinates(request,locations,options);
}
export async function screeningSamples(request:ScreeningRequest,projection:'polar'|'global',options:ScreeningJobOptions={}):Promise<ScreeningPoint[]>{
  abort(options.signal);if(projection!=='polar'&&projection!=='global')throw new RangeError('Unsupported screening projection.');
  const locations=projection==='polar'?Array.from(request.catalog.grid.lat,(lat,i)=>({lat,lon:request.catalog.grid.lon[i]})):Array.from({length:288},(_,i)=>({lat:-82.5+Math.floor(i/24)*15,lon:7.5+(i%24)*15}));
  return sampleCoordinates(request,locations,options);
}
