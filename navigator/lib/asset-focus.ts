import {shortestArcDirection, type Point3} from './site-transition';

export type AssetFocus = 'moon' | 'earth' | 'lander';
export const ASSET_RADII_KM = {moon: 1737.4, earth: 6378.137, sun: 695700} as const;
export const ASSET_FOCUS_MS = {clearance: 3200, transfer: 2600, approach: 4200} as const;
const length = (v: Point3) => Math.hypot(...v);
const subtract = (a: Point3, b: Point3): Point3 => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const mix = (a: Point3, b: Point3, t: number): Point3 => [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
const scale = (v: Point3, n: number): Point3 => [v[0]*n,v[1]*n,v[2]*n];
const ease = (t: number) => t*t*t*(10+t*(-15+6*t));

/** Catalogue centre range plus the existing display direction; no substitute orbit. */
export function physicalAsset(kind: 'earth' | 'sun', rangeKm: number | undefined) {
  const radiusKm = ASSET_RADII_KM[kind];
  return Number.isFinite(rangeKm) && rangeKm! > radiusKm + ASSET_RADII_KM.moon
    ? {rangeKm: rangeKm!, radiusKm} : null;
}

export type AssetFlight = {
  startMs: number;
  fromCamera: Point3;
  fromTarget: Point3;
  fromCentre: Point3;
  toCamera: Point3;
  toTarget: Point3;
  toCentre: Point3;
  clearanceKm: number;
};

/** Camera-only display travel. Retarget by replacing the plan from the current pose.
 * Logarithmic radial legs leave the old body before a clear, wide transfer.
 */
export function sampleAssetFlight(flight: AssetFlight, now: number, reducedMotion = false) {
  const {fromCamera, fromTarget, fromCentre, toCamera, toTarget, toCentre} = flight;
  const from = subtract(fromCamera, fromCentre), to = subtract(toCamera, toCentre);
  const fromRadius = length(from), toRadius = length(to);
  if (![now, flight.startMs, flight.clearanceKm, ...fromCamera, ...fromTarget, ...fromCentre, ...toCamera, ...toTarget, ...toCentre].every(Number.isFinite) || Math.min(fromRadius, toRadius, flight.clearanceKm) <= 0) throw new RangeError('Invalid asset camera flight');
  const total = ASSET_FOCUS_MS.clearance + ASSET_FOCUS_MS.transfer + ASSET_FOCUS_MS.approach;
  const elapsed = Math.max(0, now-flight.startMs);
  if (reducedMotion || elapsed >= total) return {camera: [...toCamera] as Point3, target: [...toTarget] as Point3, progress: 1, complete: true};
  if (elapsed === 0) return {camera: [...fromCamera] as Point3, target: [...fromTarget] as Point3, progress: 0, complete: false};
  const displacement=subtract(toCentre,fromCentre),separation=length(displacement);
  const clearance = Math.max(flight.clearanceKm, fromRadius, toRadius, separation*2);
  let escape:Point3|null=null;
  if(separation>1e-6){
    const axis=scale(displacement,1/separation),dot=from[0]*axis[0]+from[1]*axis[1]+from[2]*axis[2];
    let perpendicular:Point3=[from[0]-axis[0]*dot,from[1]-axis[1]*dot,from[2]-axis[2]*dot];
    if(length(perpendicular)<1e-6){
      const basis:Point3=Math.abs(axis[0])<.9?[1,0,0]:[0,1,0];
      const projection=basis[0]*axis[0]+basis[1]*axis[1]+basis[2]*axis[2];
      perpendicular=[basis[0]-axis[0]*projection,basis[1]-axis[1]*projection,basis[2]-axis[2]*projection];
    }
    escape=scale(perpendicular,1/length(perpendicular));
  }
  let centre: Point3, direction: Point3, radius: number, target: Point3;
  if (elapsed < ASSET_FOCUS_MS.clearance) {
    const t = ease(elapsed/ASSET_FOCUS_MS.clearance);
    centre=fromCentre;
    radius=Math.exp(Math.log(fromRadius)*(1-t)+Math.log(clearance)*t);
    // Turn away before the radial leg can encounter the destination body.
    const turn=Math.min(1,Math.max(0,(radius-fromRadius)/(Math.max(fromRadius*1.2,separation*.25)-fromRadius)));
    direction=escape?shortestArcDirection(from,escape,ease(turn)):scale(from,1/fromRadius);
    target=mix(fromTarget,fromCentre,t);
  } else if (elapsed < ASSET_FOCUS_MS.clearance+ASSET_FOCUS_MS.transfer) {
    const t=ease((elapsed-ASSET_FOCUS_MS.clearance)/ASSET_FOCUS_MS.transfer);
    centre=mix(fromCentre,toCentre,t);direction=escape??shortestArcDirection(from,to,t);radius=clearance;target=centre;
  } else {
    const t=ease((elapsed-ASSET_FOCUS_MS.clearance-ASSET_FOCUS_MS.transfer)/ASSET_FOCUS_MS.approach);
    centre=toCentre;
    radius=Math.exp(Math.log(clearance)*(1-t)+Math.log(toRadius)*t);
    const turn=Math.min(1,Math.max(0,(Math.max(toRadius*1.2,separation*.25)-radius)/(Math.max(toRadius*1.2,separation*.25)-toRadius)));
    direction=escape?shortestArcDirection(escape,to,ease(turn)):scale(to,1/toRadius);
    target=mix(toCentre,toTarget,t);
  }
  return {camera: [centre[0]+direction[0]*radius,centre[1]+direction[1]*radius,centre[2]+direction[2]*radius] as Point3, target, progress: elapsed/total, complete: false};
}

/** A distant body's presence must not force a lunar ground camera's near plane out. */
export function assetClipPlanes(cameraKm: Point3, bodies: readonly {centreKm: Point3;radiusKm: number}[], targetDistanceKm: number) {
  if (!cameraKm.every(Number.isFinite) || !Number.isFinite(targetDistanceKm) || targetDistanceKm < 0 || !bodies.length || bodies.some(b=>!b.centreKm.every(Number.isFinite)||!Number.isFinite(b.radiusKm)||b.radiusKm<=0)) throw new RangeError('Invalid asset clip geometry');
  let nearest=Infinity, far=18000;
  for (const body of bodies) {
    const distance=length(subtract(cameraKm,body.centreKm));
    nearest=Math.min(nearest,Math.max(.001,distance-body.radiusKm));
    far=Math.max(far,(distance+body.radiusKm)*1.1);
  }
  return {near:Math.max(.0001,Math.min(nearest*.02,Math.max(.0001,targetDistanceKm/10000))),far};
}

/** NASA display axes (+Y north, −Z east) to numerical Moon body (+Z north, +Y east), km. */
export function nasaDirectionToBodyPoint(direction:readonly [number,number,number],rangeKm:number):Point3{
 if(!direction.every(Number.isFinite)||!Number.isFinite(rangeKm)||rangeKm<=0||Math.abs(Math.hypot(...direction)-1)>1e-6)throw new RangeError('A unit Moon-fixed direction and positive centre range are required');
 return [direction[0]*rangeKm,-direction[2]*rangeKm,direction[1]*rangeKm];
}
