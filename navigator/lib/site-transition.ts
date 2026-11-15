/** Camera-only Moon-body coordinates, kilometres. No scientific scenario state. */
export type Point3 = readonly [number, number, number];
export type SiteTransitionPhase = 'zoom-out' | 'rotate' | 'zoom-in' | 'complete';
export type SiteTransitionInput = {
  key: string; now: number; fromCamera: Point3; fromTarget: Point3;
  toCamera: Point3; toTarget: Point3; overviewRadiusKm: number;
  alreadyOverview: boolean; reducedMotion: boolean;
};
export type SiteTransitionSample = {key:string;generation:number;phase:SiteTransitionPhase;progress:number;camera:Point3;target:Point3};
const length = (p:Point3) => Math.hypot(...p);
const multiply = (p:Point3,n:number):Point3 => [p[0]*n,p[1]*n,p[2]*n];
const unit = (p:Point3):Point3 => { const n=length(p);if(!Number.isFinite(n)||n===0)throw new RangeError('Camera direction must be finite and nonzero');return multiply(p,1/n); };
const dot=(a:Point3,b:Point3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:Point3,b:Point3):Point3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const mix=(a:Point3,b:Point3,t:number):Point3=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const ease=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);};
export function shortestArcDirection(from:Point3,to:Point3,t:number):Point3 {
 const a=unit(from),b=unit(to),cos=Math.max(-1,Math.min(1,dot(a,b)));
 if(t<=0)return a;if(t>=1)return b;if(cos>1-1e-12)return unit(mix(a,b,t));
 let axis=cross(a,b);
 if(length(axis)<1e-10){const basis:Point3=Math.abs(a[0])<=Math.abs(a[1])&&Math.abs(a[0])<=Math.abs(a[2])?[1,0,0]:Math.abs(a[1])<=Math.abs(a[2])?[0,1,0]:[0,0,1];axis=cross(a,basis);}
 axis=unit(axis);const angle=Math.acos(cos)*t,c=Math.cos(angle),s=Math.sin(angle),perp=cross(axis,a);
 return unit([a[0]*c+perp[0]*s,a[1]*c+perp[1]*s,a[2]*c+perp[2]*s]);
}
export const siteNavigationKey = (lat:number,lon:number) => `${lat}:${((lon % 360) + 540) % 360 - 180}`;
export const SITE_TRANSITION_MS={zoomOut:2200,rotate:2600,zoomIn:5200} as const;
/** Interpolate clearance, not Moon radius: kilometres near the surface retain time.
 * A center target or a retarget pose below the new site's radius has no usable
 * surface reference; zero then preserves a finite, monotone radial path.
 */
function clearanceRadius(start:number,end:number,surface:number,t:number):number {
 const reference=surface>0&&surface<Math.min(start,end)?surface:0;
 return reference+Math.exp(Math.log(start-reference)*(1-t)+Math.log(end-reference)*t);
}
const radialProgress=(start:number,end:number,current:number,t:number)=>start===end?t:Math.max(0,Math.min(1,(current-start)/(end-start)));
/** Latest request wins; cancellation prevents a completed stale request being published. */
export function createSiteTransition() {
 let generation=0,active:SiteTransitionInput|null=null;
 return {
  begin(input:SiteTransitionInput){
   for(const p of [input.fromCamera,input.fromTarget,input.toCamera,input.toTarget])if(!p.every(Number.isFinite))throw new RangeError('Camera positions must be finite');
   if(!Number.isFinite(input.now)||!Number.isFinite(input.overviewRadiusKm)||input.overviewRadiusKm<=0)throw new RangeError('Transition timing and overview radius must be finite');
   unit(input.fromCamera);unit(input.toCamera);active=structuredClone(input);return ++generation;
  },
  cancel(){active=null;generation++;},
  isCurrent(token:number){return active!==null&&token===generation;},
  sample(now:number):SiteTransitionSample|null{
   if(!Number.isFinite(now))throw new RangeError('Sample time must be finite');
   if(!active)return null;const a=active;
   let elapsed=Math.max(0,now-a.now);let phase:SiteTransitionPhase;
   let camera:Point3,target:Point3,progress=0;const overview=Math.max(a.overviewRadiusKm,length(a.fromCamera),length(a.toCamera));
   if(a.reducedMotion||(a.alreadyOverview?elapsed>=SITE_TRANSITION_MS.zoomIn:elapsed>=SITE_TRANSITION_MS.zoomOut+SITE_TRANSITION_MS.rotate+SITE_TRANSITION_MS.zoomIn))return {key:a.key,generation,phase:'complete',progress:1,camera:a.toCamera,target:a.toTarget};
   if(!a.alreadyOverview&&elapsed<SITE_TRANSITION_MS.zoomOut){
    phase='zoom-out';const t=ease(elapsed/SITE_TRANSITION_MS.zoomOut),start=length(a.fromCamera);
    const radius=clearanceRadius(start,overview,length(a.fromTarget),t);
    camera=multiply(unit(a.fromCamera),radius);target=mix(a.fromTarget,[0,0,0],radialProgress(start,overview,radius,t));progress=t;
    if(elapsed===0){camera=a.fromCamera;target=a.fromTarget;}
   }else if(!a.alreadyOverview&&elapsed<SITE_TRANSITION_MS.zoomOut+SITE_TRANSITION_MS.rotate){
    phase='rotate';const t=ease((elapsed-SITE_TRANSITION_MS.zoomOut)/SITE_TRANSITION_MS.rotate);camera=multiply(shortestArcDirection(a.fromCamera,a.toCamera,t),overview);target=[0,0,0];progress=t;
   }else{
    phase='zoom-in';if(!a.alreadyOverview)elapsed-=SITE_TRANSITION_MS.zoomOut+SITE_TRANSITION_MS.rotate;
    const t=ease(elapsed/SITE_TRANSITION_MS.zoomIn),radius=a.alreadyOverview?length(a.fromCamera):overview;
    const direction=a.alreadyOverview?shortestArcDirection(a.fromCamera,a.toCamera,t):unit(a.toCamera);
    const nextRadius=clearanceRadius(radius,length(a.toCamera),length(a.toTarget),t);
    camera=multiply(direction,nextRadius);
    // Match look-target motion to radial travel, avoiding a late surface pitch whip.
    target=mix(a.alreadyOverview?a.fromTarget:[0,0,0],a.toTarget,radialProgress(radius,length(a.toCamera),nextRadius,t));progress=t;
    if(elapsed===0&&a.alreadyOverview){camera=a.fromCamera;target=a.fromTarget;}
   }
   return {key:a.key,generation,phase,progress,camera,target};
  },
 };
}

/** Recheck at consumption: a completion accepted last frame may already be stale. */
export function reconcileSiteHandoff<T extends {key:string;resume:boolean}>(handoff:T,destinationKey:string):T {
 return handoff.key===destinationKey?handoff:{...handoff,key:destinationKey,resume:true};
}
/** Globe presets must not push an interrupted physical pose to a larger radius. */
export function canKeepOverviewMode(radiusKm:number,targetDistanceKm:number,minimumKm:number):boolean {
 return radiusKm>=minimumKm&&targetDistanceKm>=minimumKm;
}

/** Display framing follows sample spacing, not a landing-safety or resolution claim.
 * Preserve the existing close view for prepared detail. Coarser/unknown terrain
 * gets a wider, 15-degree context view so real relief and the skyline can be seen.
 */
export function siteCameraOffset(sampleSpacingM:number|null):Point3 {
 const close:Point3=[2.4,1.8,2.8],nearHorizontal=Math.hypot(close[0],close[2]);
 if(sampleSpacingM!==null&&(!Number.isFinite(sampleSpacingM)||sampleSpacingM<=0))throw new RangeError('Display sample spacing must be positive or unknown');
 const horizontal=sampleSpacingM===null?36:Math.max(nearHorizontal,8*sampleSpacingM/1000);
 if(horizontal===nearHorizontal)return close;
 return [horizontal*close[0]/nearHorizontal,horizontal*Math.tan(Math.PI/12),horizontal*close[2]/nearHorizontal];
}

/** A completed site approach must not consume a newer asset/follow request. */
export function retainCameraAfterSiteArrival(start: {mode:string;reset:number}, current: {mode:string;reset:number}): boolean {
 return ['vehicle','follow','earth','sun'].includes(current.mode) || current.mode!==start.mode || current.reset!==start.reset;
}
