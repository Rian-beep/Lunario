import type { Catalog, Site } from "./catalog";

export const MOON_RADIUS_KM = 1737.4;
export const MOON_RADIUS_M = 1_737_400;
export const EARTH_RADIUS_KM = 6378.137;

export type TerrainChoice = {
  mask: Float64Array;
  stepDeg: number;
  heightM: number;
  distanceKm: number | null;
  cellLat: number | null;
  cellLon: number | null;
  exact: boolean;
};

export type SampleSeries = {
  index0: number;
  sunAz: Float64Array;
  sunEl: Float64Array;
  earthAz: Float64Array;
  earthEl: Float64Array;
  sunHorizon: Float64Array;
  earthHorizon: Float64Array;
  sunRadius: Float64Array;
  earthRadius: Float64Array;
};

export type Span = { startIndex: number; endIndex: number; hours: number };

export type Summary = {
  samples: number;
  known: number;
  sunlitTerrain: number;
  sunlitSphere: number;
  sunCenterTerrain: number;
  sunCenterSphere: number;
  exposureTerrain: number;
  exposureSphere: number;
  longestDarkTerrain: number;
  longestDarkSphere: number;
  earthTerrain: number;
  earthSphere: number;
  earthAnyLimb: number;
  earthWindows: Span[];
  sunWindows: Span[];
};

export function indexToMs(catalog: Catalog, index: number): number {
  return catalog.t0ms + index * catalog.meta.stepHours * 3_600_000;
}

export function msToIndex(catalog: Catalog, ms: number): number {
  const idx = Math.round((ms - catalog.t0ms) / (catalog.meta.stepHours * 3_600_000));
  return Math.max(0, Math.min(catalog.meta.n - 1, idx));
}

export function formatUtc(ms: number, withTime = true): string {
  const d = new Date(ms);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const date = `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  if (!withTime) return date;
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${date}, ${hh}:${mm} UTC`;
}

export function formatHours(hours: number): string {
  if (!Number.isFinite(hours)) return "—";
  if (hours < 36) return `${Math.round(hours)} h`;
  const days = hours / 24;
  return days >= 10 ? `${Math.round(days)} d` : `${days.toFixed(1)} d`;
}

export function formatLat(lat: number): string {
  const hemi = lat < 0 ? "S" : lat > 0 ? "N" : "";
  return `${Math.abs(lat).toFixed(4)}°${hemi}`;
}

export function formatLon(lon: number): string {
  const east = ((lon % 360) + 360) % 360;
  if (east > 180) return `${(360 - east).toFixed(3)}°W (${east.toFixed(2)}°E)`;
  return `${east.toFixed(4)}°E`;
}

export function formatPercent(fraction: number): string {
  if (!Number.isFinite(fraction)) return "—";
  return `${(fraction * 100).toFixed(1)}%`;
}

export function parseLatitude(raw: string): number | null {
  const match = raw.trim().toUpperCase().match(/^(-?\d+(?:\.\d+)?)\s*([NS])?$/);
  if (!match) return null;
  let value = Number(match[1]);
  if (match[2] === "S") value = -Math.abs(value);
  if (match[2] === "N") value = Math.abs(value);
  if (value < -90 || value > 90) return null;
  return value;
}

export function parseLongitude(raw: string): number | null {
  const match = raw.trim().toUpperCase().match(/^(-?\d+(?:\.\d+)?)\s*([EW])?$/);
  if (!match) return null;
  let value = Number(match[1]);
  if (match[2] === "W") value = -Math.abs(value);
  if (match[2] === "E") value = Math.abs(value);
  if (value < -180 || value > 360) return null;
  return value;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function sunAzEl(lat: number, lon: number, sslat: number, sslon: number): [number, number] {
  const latr = (lat * Math.PI) / 180;
  const slatr = (sslat * Math.PI) / 180;
  const dlon = ((sslon - lon) * Math.PI) / 180;
  const cosg = Math.sin(latr) * Math.sin(slatr) + Math.cos(latr) * Math.cos(slatr) * Math.cos(dlon);
  const el = 90 - (Math.acos(clamp(cosg, -1, 1)) * 180) / Math.PI;
  const y = Math.sin(dlon) * Math.cos(slatr);
  const x = Math.cos(latr) * Math.sin(slatr) - Math.sin(latr) * Math.cos(slatr) * Math.cos(dlon);
  const az = (Math.atan2(y, x) * 180) / Math.PI;
  return [(az + 360) % 360, el];
}

export function earthAzEl(lat: number, lon: number, elat: number, elon: number, rangeKm: number): [number, number] {
  const latr = (lat * Math.PI) / 180;
  const lonr = (lon * Math.PI) / 180;
  const elatr = (elat * Math.PI) / 180;
  const elonr = (elon * Math.PI) / 180;
  const cl = Math.cos(latr);
  const sl = Math.sin(latr);
  const co = Math.cos(lonr);
  const so = Math.sin(lonr);
  const up: [number, number, number] = [cl * co, cl * so, sl];
  const east: [number, number, number] = [-so, co, 0];
  const north: [number, number, number] = [-sl * co, -sl * so, cl];
  const ce = Math.cos(elatr);
  const ue: [number, number, number] = [ce * Math.cos(elonr), ce * Math.sin(elonr), Math.sin(elatr)];
  const vx = rangeKm * ue[0] - MOON_RADIUS_KM * up[0];
  const vy = rangeKm * ue[1] - MOON_RADIUS_KM * up[1];
  const vz = rangeKm * ue[2] - MOON_RADIUS_KM * up[2];
  const ve = vx * east[0] + vy * east[1] + vz * east[2];
  const vn = vx * north[0] + vy * north[1] + vz * north[2];
  const vu = vx * up[0] + vy * up[1] + vz * up[2];
  const el = (Math.atan2(vu, Math.hypot(ve, vn)) * 180) / Math.PI;
  const az = (Math.atan2(ve, vn) * 180) / Math.PI;
  return [(az + 360) % 360, el];
}

/** Site-to-Earth distance in the catalog's approximate apparent-vector model, km.
 * Input is the Moon-observed apparent Earth-centre range, km; see catalog rangeReference.
 */
export function earthRangeAtSiteKm(lat: number, lon: number, elat: number, elon: number, rangeKm: number): number {
  const r = Math.PI / 180;
  const cosAngle = Math.sin(lat * r) * Math.sin(elat * r)
    + Math.cos(lat * r) * Math.cos(elat * r) * Math.cos((elon - lon) * r);
  return Math.sqrt(rangeKm ** 2 + MOON_RADIUS_KM ** 2 - 2 * rangeKm * MOON_RADIUS_KM * cosAngle);
}

/** Fraction of a uniform disk above a straight horizon. */
export function diskFraction(elevation: number, horizon: number, radius: number): number {
  if (!(radius > 0)) return elevation > horizon ? 1 : 0;
  const c = (elevation - horizon) / radius;
  if (c >= 1) return 1;
  if (c <= -1) return 0;
  const below = (Math.acos(c) - c * Math.sqrt(Math.max(0, 1 - c * c))) / Math.PI;
  return 1 - below;
}

export function lerpAngle(a: number, b: number, t: number): number {
  const delta = ((b - a + 540) % 360) - 180;
  return (a + delta * t + 360) % 360;
}

export function poseAt(series: SampleSeries, position: number): { sunAz: number; sunEl: number; earthAz: number; earthEl: number } {
  const n = series.sunEl.length;
  const clamped = Math.max(0, Math.min(n - 1, position));
  const i = Math.floor(clamped);
  const j = Math.min(n - 1, i + 1);
  const t = clamped - i;
  return {
    sunAz: lerpAngle(series.sunAz[i], series.sunAz[j], t),
    sunEl: series.sunEl[i] * (1 - t) + series.sunEl[j] * t,
    earthAz: lerpAngle(series.earthAz[i], series.earthAz[j], t),
    earthEl: series.earthEl[i] * (1 - t) + series.earthEl[j] * t,
  };
}

export function sliceSeries(series: SampleSeries, count: number): SampleSeries {
  const n = Math.max(1, Math.min(series.sunEl.length, count));
  return {
    index0: series.index0,
    sunAz: series.sunAz.subarray(0, n),
    sunEl: series.sunEl.subarray(0, n),
    earthAz: series.earthAz.subarray(0, n),
    earthEl: series.earthEl.subarray(0, n),
    sunHorizon: series.sunHorizon.subarray(0, n),
    earthHorizon: series.earthHorizon.subarray(0, n),
    sunRadius: series.sunRadius.subarray(0, n),
    earthRadius: series.earthRadius.subarray(0, n),
  };
}

export function horizonAt(mask: Float64Array, stepDeg: number, azimuth: number): number {
  const n = mask.length;
  const a = ((azimuth % 360) + 360) % 360;
  const f = a / stepDeg;
  const i0 = Math.floor(f) % n;
  let i1 = i0 + 1;
  if (i1 >= n) i1 = 0;
  const t = f - Math.floor(f);
  const h0 = mask[i0];
  const h1 = mask[i1];
  if (t === 0) return h0;
  if (!Number.isFinite(h0) || !Number.isFinite(h1)) return Number.NaN;
  return h0 * (1 - t) + h1 * t;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * MOON_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function terrainForSite(site: Site, heightM: number): TerrainChoice {
  if (!site.horizons.length) return unavailableTerrain(heightM);
  let chosen = site.horizons[0];
  let best = Infinity;
  for (const horizon of site.horizons) {
    const d = Math.abs(horizon.heightM - heightM);
    if (d < best) {
      best = d;
      chosen = horizon;
    }
  }
  if(chosen.heightM!==heightM)return unavailableTerrain(heightM);
  return {
    mask: chosen.mask,
    stepDeg: chosen.stepDeg,
    heightM: chosen.heightM,
    distanceKm: 0,
    cellLat: site.lat,
    cellLon: site.lon,
    exact: true,
  };
}

export function unavailableTerrain(heightM=2):TerrainChoice {
  return {mask:new Float64Array(360).fill(Number.NaN),stepDeg:1,heightM,distanceKm:null,cellLat:null,cellLon:null,exact:false};
}

export function terrainForCustom(catalog: Catalog, lat: number, lon: number): TerrainChoice | null {
  const grid = catalog.grid;
  if (lat > -80 || lat < -90) return unavailableTerrain();
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < grid.lat.length; i++) {
    const d = haversineKm(lat, lon, grid.lat[i], grid.lon[i]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  const start = best * grid.nAz;
  return {
    mask: grid.mask.subarray(start, start + grid.nAz),
    stepDeg: grid.stepDeg,
    heightM: grid.heightM,
    distanceKm: bestD,
    cellLat: grid.lat[best],
    cellLon: grid.lon[best],
    exact: false,
  };
}

export function buildSeries(
  catalog: Catalog,
  lat: number,
  lon: number,
  terrain: TerrainChoice,
  i0: number,
  i1: number,
): SampleSeries {
  const n = i1 - i0 + 1;
  const sunAz = new Float64Array(n);
  const sunEl = new Float64Array(n);
  const earthAz = new Float64Array(n);
  const earthEl = new Float64Array(n);
  const sunHorizon = new Float64Array(n);
  const earthHorizon = new Float64Array(n);
  const sunRadius = new Float64Array(n);
  const earthRadius = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const i = i0 + k;
    const [saz, sel] = sunAzEl(lat, lon, catalog.subsolarLat[i], catalog.subsolarLon[i]);
    const [eaz, eel] = earthAzEl(lat, lon, catalog.subearthLat[i], catalog.subearthLon[i], catalog.earthRangeKm[i]);
    sunAz[k] = saz;
    sunEl[k] = sel;
    earthAz[k] = eaz;
    earthEl[k] = eel;
    sunHorizon[k] = horizonAt(terrain.mask, terrain.stepDeg, saz);
    earthHorizon[k] = horizonAt(terrain.mask, terrain.stepDeg, eaz);
    sunRadius[k] = catalog.sunRadiusDeg[i];
    const range = earthRangeAtSiteKm(lat, lon, catalog.subearthLat[i], catalog.subearthLon[i], catalog.earthRangeKm[i]);
    earthRadius[k] = (Math.asin(Math.min(1, EARTH_RADIUS_KM / range)) * 180) / Math.PI;
  }
  return { index0: i0, sunAz, sunEl, earthAz, earthEl, sunHorizon, earthHorizon, sunRadius, earthRadius };
}

function runs(flag: (k: number) => boolean, n: number, index0: number, stepHours: number): { spans: Span[]; longest: number } {
  const spans: Span[] = [];
  let start = -1;
  let longest = 0;
  const close = (end: number) => {
    const count = end - start;
    longest = Math.max(longest, count);
    spans.push({ startIndex: index0 + start, endIndex: index0 + end - 1, hours: count * stepHours });
  };
  for (let k = 0; k < n; k++) {
    if (flag(k)) {
      if (start < 0) start = k;
    } else if (start >= 0) {
      close(k);
      start = -1;
    }
  }
  if (start >= 0) close(n);
  return { spans, longest: longest * stepHours };
}

/** An omitted minimum means terrain-only geometry; zero is an active horizontal cutoff. */
export function earthCenterVisible(elevation: number, horizon: number, minimumElevationDeg?: number): boolean | null {
  if (!Number.isFinite(elevation) || !Number.isFinite(horizon) ||
    (minimumElevationDeg !== undefined && !Number.isFinite(minimumElevationDeg))) return null;
  return elevation > (minimumElevationDeg === undefined ? horizon : Math.max(horizon, minimumElevationDeg));
}

/** The optional antenna cutoff applies to Earth-centre fractions/windows; limb visibility remains terrain-only. */
export function summarize(series: SampleSeries, stepHours: number, options: {antennaMaskDeg?: number} = {}): Summary {
  const n = series.sunEl.length;
  const masked = options.antennaMaskDeg !== undefined;
  const earthUp = (k: number) => earthCenterVisible(series.earthEl[k], series.earthHorizon[k], options.antennaMaskDeg);
  let contactKnown = 0;
  let contact = 0;
  let sphereContactKnown = 0;
  let sphereContact = 0;
  let known = 0;
  let sunT = 0;
  let sunS = 0;
  let sunCenterT = 0;
  let sunCenterS = 0;
  let expT = 0;
  let expS = 0;
  let earthT = 0;
  let earthS = 0;
  let earthLimb = 0;
  const sunUp = (k: number) => {
    const horizon = series.sunHorizon[k];
    if (!Number.isFinite(horizon)) return false;
    return series.sunEl[k] + series.sunRadius[k] > horizon;
  };
  const sunUpSphere = (k: number) => series.sunEl[k] + series.sunRadius[k] > 0;
  for (let k = 0; k < n; k++) {
    const up = earthUp(k);
    const sphereUp = earthCenterVisible(series.earthEl[k], 0, options.antennaMaskDeg);
    if (up !== null) { contactKnown++; if (up) contact++; }
    if (sphereUp !== null) { sphereContactKnown++; if (sphereUp) sphereContact++; }
    const sh = series.sunHorizon[k];
    const eh = series.earthHorizon[k];
    const sphereDisk = diskFraction(series.sunEl[k], 0, series.sunRadius[k]);
    expS += sphereDisk;
    if (sunUpSphere(k)) sunS += 1;
    if (series.sunEl[k] > 0) sunCenterS += 1;
    if (series.earthEl[k] > 0) earthS += 1;
    if (!Number.isFinite(sh) || !Number.isFinite(eh)) continue;
    known += 1;
    const terrainDisk = diskFraction(series.sunEl[k], sh, series.sunRadius[k]);
    expT += terrainDisk;
    if (terrainDisk > 0) sunT += 1;
    if (series.sunEl[k] > sh) sunCenterT += 1;
    if (series.earthEl[k] > eh) earthT += 1;
    if (series.earthEl[k] + series.earthRadius[k] > eh) earthLimb += 1;
  }
  const darkTerrain = runs((k) => Number.isFinite(series.sunHorizon[k]) && !sunUp(k), n, series.index0, stepHours);
  const darkSphere = runs((k) => !sunUpSphere(k), n, series.index0, stepHours);
  const earthWindows = runs((k) => earthUp(k) === true, n, series.index0, stepHours);
  const sunWindows = runs(sunUp, n, series.index0, stepHours);
  const denom = known || 1;
  return {
    samples: n,
    known,
    sunlitTerrain: known ? sunT / known : Number.NaN,
    sunlitSphere: n ? sunS / n : Number.NaN,
    sunCenterTerrain: known ? sunCenterT / known : Number.NaN,
    sunCenterSphere: n ? sunCenterS / n : Number.NaN,
    exposureTerrain: known ? expT / denom : Number.NaN,
    exposureSphere: n ? expS / n : Number.NaN,
    longestDarkTerrain: series.sunHorizon.every(Number.isFinite) && series.sunEl.every(Number.isFinite) ? darkTerrain.longest : Number.NaN,
    longestDarkSphere: darkSphere.longest,
    // Operational totals require complete Earth coverage, as evaluateMission does.
    earthTerrain: masked ? n && contactKnown === n ? contact / n : Number.NaN : known ? earthT / known : Number.NaN,
    earthSphere: masked ? n && sphereContactKnown === n ? sphereContact / n : Number.NaN : n ? earthS / n : Number.NaN,
    earthAnyLimb: known ? earthLimb / known : Number.NaN,
    earthWindows: earthWindows.spans,
    sunWindows: sunWindows.spans,
  };
}

export type RankedWindow = {
  startIndex: number;
  endIndex: number;
  sunlitTerrain: number;
  sunlitSphere: number;
  earthTerrain: number;
  earthSphere: number;
  longestDarkTerrain: number;
};

export function rankWindows(
  catalog: Catalog,
  lat: number,
  lon: number,
  terrain: TerrainChoice,
  i0: number,
  i1: number,
  windowHours: number,
  minEarth: number,
): { withEarth: RankedWindow[]; brightest: RankedWindow[]; unknownWindows:number } {
  const step = catalog.meta.stepHours;
  const count = Math.max(1, Math.round(windowHours / step));
  const n = i1 - i0 + 1;
  if (n < count) return { withEarth: [], brightest: [], unknownWindows:0 };
  const sun = new Float64Array(n);
  const sphere = new Float64Array(n);
  const earth = new Float64Array(n);
  const earthSphere = new Float64Array(n);
  const known = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const i = i0 + k;
    const [saz, sel] = sunAzEl(lat, lon, catalog.subsolarLat[i], catalog.subsolarLon[i]);
    const [eaz, eel] = earthAzEl(lat, lon, catalog.subearthLat[i], catalog.subearthLon[i], catalog.earthRangeKm[i]);
    const sh = horizonAt(terrain.mask, terrain.stepDeg, saz);
    const eh = horizonAt(terrain.mask, terrain.stepDeg, eaz);
    const radius = catalog.sunRadiusDeg[i];
    known[k] = Number.isFinite(sh) && Number.isFinite(eh) ? 1 : 0;
    const lit = Number.isFinite(sh) && sel + radius > sh;
    sun[k] = lit ? 1 : 0;
    sphere[k] = sel + radius > 0 ? 1 : 0;
    earth[k] = Number.isFinite(eh) && eel > eh ? 1 : 0;
    earthSphere[k] = eel > 0 ? 1 : 0;
  }
  const ps = prefix(sun);
  const psp = prefix(sphere);
  const pe = prefix(earth);
  const pes = prefix(earthSphere);
  const pk = prefix(known);
  let unknownWindows=0;
  const candidates: RankedWindow[] = [];
  for (let s = 0; s + count <= n; s += 1) {
    if(pk[s+count]-pk[s]<count){unknownWindows++;continue;}
    candidates.push({
      startIndex: i0 + s,
      endIndex: i0 + s + count - 1,
      sunlitTerrain: (ps[s + count] - ps[s]) / count,
      sunlitSphere: (psp[s + count] - psp[s]) / count,
      earthTerrain: (pe[s + count] - pe[s]) / count,
      earthSphere: (pes[s + count] - pes[s]) / count,
      longestDarkTerrain: 0,
    });
  }
  const bySun = [...candidates].sort((a, b) => b.sunlitTerrain - a.sunlitTerrain || b.earthTerrain - a.earthTerrain);
  const withEarth = distinctWindows(bySun.filter((item) => item.earthTerrain + 1e-9 >= minEarth), 6);
  const brightest = distinctWindows(bySun, 4);
  for (const item of withEarth.concat(brightest)) {
    const s = item.startIndex - i0;
    item.longestDarkTerrain = longestZero(sun, s, s + count) * step;
  }
  return { withEarth, brightest, unknownWindows };
}

function distinctWindows(sorted: RankedWindow[], limit: number): RankedWindow[] {
  const picked: RankedWindow[] = [];
  for (const item of sorted) {
    const overlaps = picked.some((prev) => item.startIndex <= prev.endIndex && item.endIndex >= prev.startIndex);
    if (overlaps) continue;
    picked.push(item);
    if (picked.length >= limit) break;
  }
  return picked;
}

function prefix(values: Float64Array): Float64Array {
  const out = new Float64Array(values.length + 1);
  for (let i = 0; i < values.length; i++) out[i + 1] = out[i] + values[i];
  return out;
}

function longestZero(values: Float64Array, start: number, end: number): number {
  let best = 0;
  let run = 0;
  for (let i = start; i < end; i++) {
    if (values[i] === 0) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}

export function latLonToProjected(lat: number, lon: number): { x: number; y: number } {
  const latr = (lat * Math.PI) / 180;
  const lonr = (lon * Math.PI) / 180;
  const rho = 2 * MOON_RADIUS_M * Math.tan(Math.PI / 4 + latr / 2);
  return { x: rho * Math.sin(lonr), y: rho * Math.cos(lonr) };
}

export function projectedToLatLon(x: number, y: number): { lat: number; lon: number } {
  const rho = Math.hypot(x, y);
  const lon = (Math.atan2(x, y) * 180) / Math.PI;
  const t = rho / (2 * MOON_RADIUS_M);
  const lat = ((2 * Math.atan(t) - Math.PI / 2) * 180) / Math.PI;
  return { lat, lon: (lon + 360) % 360 };
}

export function csvFor(
  catalog: Catalog,
  rows: { name: string; id: string; lat: number; lon: number; terrain: TerrainChoice; series: SampleSeries }[],
): string {
  const header = [
    "time_utc",
    "site_id",
    "site_name",
    "latitude_deg",
    "longitude_east_deg",
    "observer_height_m",
    "terrain_exact",
    "sun_azimuth_deg",
    "sun_elevation_deg",
    "sun_angular_radius_deg",
    "terrain_horizon_at_sun_deg",
    "sun_above_terrain",
    "sun_above_smooth_sphere",
    "sun_disk_fraction_terrain",
    "sun_disk_fraction_sphere",
    "earth_azimuth_deg",
    "earth_elevation_deg",
    "earth_angular_radius_deg",
    "terrain_horizon_at_earth_deg",
    "earth_center_above_terrain",
    "earth_center_above_smooth_sphere",
    "earth_any_limb_above_terrain",
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    const s = row.series;
    for (let k = 0; k < s.sunEl.length; k++) {
      const sh = s.sunHorizon[k];
      const eh = s.earthHorizon[k];
      const known = Number.isFinite(sh) && Number.isFinite(eh);
      const diskT = known ? diskFraction(s.sunEl[k], sh, s.sunRadius[k]) : "";
      const diskS = diskFraction(s.sunEl[k], 0, s.sunRadius[k]);
      const cols = [
        new Date(indexToMs(catalog, s.index0 + k)).toISOString(),
        row.id,
        `"${row.name.replaceAll('"', "'")}"`,
        row.lat.toFixed(5),
        row.lon.toFixed(5),
        String(row.terrain.heightM),
        row.terrain.exact ? "yes" : "nearest-grid",
        s.sunAz[k].toFixed(3),
        s.sunEl[k].toFixed(3),
        s.sunRadius[k].toFixed(4),
        known ? sh.toFixed(3) : "",
        known ? (diskT !== "" && Number(diskT) > 0 ? "1" : "0") : "",
        diskS > 0 ? "1" : "0",
        diskT === "" ? "" : Number(diskT).toFixed(4),
        diskS.toFixed(4),
        s.earthAz[k].toFixed(3),
        s.earthEl[k].toFixed(3),
        s.earthRadius[k].toFixed(4),
        known ? eh.toFixed(3) : "",
        known ? (s.earthEl[k] > eh ? "1" : "0") : "",
        s.earthEl[k] > 0 ? "1" : "0",
        known ? (s.earthEl[k] + s.earthRadius[k] > eh ? "1" : "0") : "",
      ];
      lines.push(cols.join(","));
    }
  }
  return lines.join("\n");
}

export function downloadText(filename: string, text: string, type = "text/csv"): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
