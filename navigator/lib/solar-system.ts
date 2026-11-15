import type {Catalog} from './catalog';
import {earthMoonContext} from './dsn';
import {shortestArcDirection, type Point3} from './site-transition';

export type SolarBody = 'sun' | 'earth' | 'moon';
export type SolarFocus = SolarBody | 'system' | 'stations';
export type SolarBodyState = {centreKm: Point3; radiusKm: number};
export type SolarSystemState = {epochMs: number; bodies: Record<SolarBody, SolarBodyState>; centreKm: Point3; radiusKm: number};
const length = (v: Point3) => Math.hypot(...v);
const mix = (a: Point3, b: Point3, t: number): Point3 => a.map((v, i) => v + (b[i] - v) * t) as [number, number, number];
const scale = (v: Point3, n: number): Point3 => [v[0] * n, v[1] * n, v[2] * n];
const ease = (t: number) => { const u = Math.max(0, Math.min(1, t)); return u * u * u * (10 + u * (-15 + 6 * u)); };

/** IAU Moon-fixed (+X prime meridian, +Y east, +Z north) → NASA
 * (+X prime meridian, +Y north, −Z east). A proper rotation, not a reflection.
 * This axis adapter does not resolve ME / PA / IAU source-frame differences.
 */
export function moonFixedToNasa([x, y, z]: Point3): [number, number, number] { return [x, z, -y]; }

export function lunarSiteDirection(lat: number, lon: number): Point3 {
  if (![lat, lon].every(Number.isFinite) || Math.abs(lat) > 90) throw new RangeError('Invalid lunar coordinates');
  const p = lat * Math.PI / 180, l = lon * Math.PI / 180;
  return moonFixedToNasa([Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)]);
}

/** Reuse the existing JPL-derived context. Directions already use NASA axes;
 * do not apply the IAU adapter a second time. No fallback orbital positions.
 */
export function solarSystemState(catalog: Catalog, timeIndex: number): SolarSystemState | null {
  const c = earthMoonContext(catalog, timeIndex);
  if (!c?.earthDirection || !c.sunDirection || !c.sunRangeKm || !Number.isFinite(c.sunRangeKm) || !Number.isFinite(c.epochMs)) return null;
  if (![c.sunRadiusKm, c.earthRadiusKm, c.moonRadiusKm].every(r => Number.isFinite(r) && r > 0)) return null;
  const bodies: Record<SolarBody, SolarBodyState> = {
    moon: {centreKm: [0, 0, 0], radiusKm: c.moonRadiusKm},
    earth: {centreKm: scale(c.earthDirection, c.rangeKm), radiusKm: c.earthRadiusKm},
    sun: {centreKm: scale(c.sunDirection, c.sunRangeKm), radiusKm: c.sunRadiusKm},
  };
  const min = [0, 1, 2].map(i => Math.min(...Object.values(bodies).map(b => b.centreKm[i] - b.radiusKm)));
  const max = [0, 1, 2].map(i => Math.max(...Object.values(bodies).map(b => b.centreKm[i] + b.radiusKm)));
  const centreKm = min.map((v, i) => (v + max[i]) / 2) as [number, number, number];
  const radiusKm = Math.max(...Object.values(bodies).map(b => Math.hypot(...b.centreKm.map((v, i) => v - centreKm[i])) + b.radiusKm));
  return {epochMs: c.epochMs, bodies, centreKm, radiusKm};
}

export function framingDistanceKm(radiusKm: number, aspect: number, fovDeg = 40): number {
  if (![radiusKm, aspect, fovDeg].every(Number.isFinite) || radiusKm <= 0 || aspect <= 0 || fovDeg <= 0 || fovDeg >= 180) throw new RangeError('Invalid camera framing');
  const vertical = fovDeg * Math.PI / 360, half = Math.min(vertical, Math.atan(Math.tan(vertical) * aspect));
  return radiusKm * 1.16 / Math.sin(half);
}

/** Distances in kilometres; nearest surface controls near, every real body fits far.
 * Used with a floating origin and logarithmic depth, including during transfers.
 */
export function solarClipPlanes(cameraKm: Point3, bodies: readonly SolarBodyState[]) {
  if (!cameraKm.every(Number.isFinite) || bodies.length === 0 || bodies.some(b => !b.centreKm.every(Number.isFinite) || !Number.isFinite(b.radiusKm) || b.radiusKm <= 0)) throw new RangeError('Invalid clip geometry');
  const distances = bodies.map(b => ({distance: Math.hypot(...cameraKm.map((v, i) => v - b.centreKm[i])), radius: b.radiusKm}));
  const nearest = Math.min(...distances.map(b => Math.max(.01, b.distance - b.radius)));
  const near = Math.max(.001, nearest * .02), far = Math.max(near * 100, ...distances.map(b => (b.distance + b.radius) * 1.2));
  return {near, far};
}

export type FocusFlight = {startMs: number; fromCamera: Point3; fromTarget: Point3; toOffset: Point3; travelKm: number; reducedMotion: boolean};
export const SOLAR_FOCUS_MS = {lift: 1000, transfer: 1400, approach: 2400} as const;
/** Camera-only three-phase flight: leave the old body before crossing the system.
 * Caller owns cancellation/retargeting; sampling has no stale completion effects.
 */
export function sampleFocusFlight(flight: FocusFlight, now: number): {camera: Point3; target: Point3; complete: boolean} {
  const {fromCamera, fromTarget, toOffset, travelKm, startMs, reducedMotion} = flight;
  if (![now, startMs, travelKm, ...fromCamera, ...fromTarget, ...toOffset].every(Number.isFinite) || travelKm <= 0 || length(toOffset) === 0) throw new RangeError('Invalid focus flight');
  const offset = fromCamera.map((v, i) => v - fromTarget[i]) as [number, number, number];
  const startRadius = length(offset);
  if (startRadius === 0) throw new RangeError('Camera cannot coincide with its target');
  const endRadius = length(toOffset), travel = Math.max(travelKm, startRadius, endRadius);
  const elapsed = Math.max(0, now - startMs), total = SOLAR_FOCUS_MS.lift + SOLAR_FOCUS_MS.transfer + SOLAR_FOCUS_MS.approach;
  if (reducedMotion || elapsed >= total) return {camera: [...toOffset], target: [0, 0, 0], complete: true};
  if (elapsed === 0) return {camera: [...fromCamera], target: [...fromTarget], complete: false};
  let target: Point3, direction: Point3, radius: number;
  if (elapsed < SOLAR_FOCUS_MS.lift) {
    const t = ease(elapsed / SOLAR_FOCUS_MS.lift);
    target = fromTarget; direction = scale(offset, 1 / startRadius);
    radius = Math.exp(Math.log(startRadius) * (1 - t) + Math.log(travel) * t);
  } else if (elapsed < SOLAR_FOCUS_MS.lift + SOLAR_FOCUS_MS.transfer) {
    const t = ease((elapsed - SOLAR_FOCUS_MS.lift) / SOLAR_FOCUS_MS.transfer);
    target = mix(fromTarget, [0, 0, 0], t); direction = shortestArcDirection(offset, toOffset, t); radius = travel;
  } else {
    const t = ease((elapsed - SOLAR_FOCUS_MS.lift - SOLAR_FOCUS_MS.transfer) / SOLAR_FOCUS_MS.approach);
    target = [0, 0, 0]; direction = scale(toOffset, 1 / endRadius);
    radius = Math.exp(Math.log(travel) * (1 - t) + Math.log(endRadius) * t);
  }
  const camera = direction.map((v, i) => target[i] + v * radius) as [number, number, number];
  return {camera, target, complete: false};
}
