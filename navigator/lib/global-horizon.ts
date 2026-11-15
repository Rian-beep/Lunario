import {unavailableTerrain,type TerrainChoice} from './astro';
import {sampleGlobalHeight,type GlobalTerrainData} from './global-terrain';
export type GlobalTerrainChoice=TerrainChoice&{kind:'global-coarse';coverage:'partial'|'unavailable';sourceSpacingM:number;outputSpacingM:number;notes:string[]};
export const GLOBAL_HORIZON_AZIMUTH_STEP_DEG=2;
export const GLOBAL_HORIZON_RADIAL_SAMPLES=200;
export const GLOBAL_HORIZON_MAX_DISTANCE_M=1_000_000;
export const globalHorizonDistances=()=>Float64Array.from({length:GLOBAL_HORIZON_RADIAL_SAMPLES},(_,i)=>Math.exp(Math.log(GLOBAL_HORIZON_MAX_DISTANCE_M)*i/(GLOBAL_HORIZON_RADIAL_SAMPLES-1)));
const caches=new WeakMap<GlobalTerrainData,Map<string,GlobalTerrainChoice>>();
const copy=(value:GlobalTerrainChoice):GlobalTerrainChoice=>({...value,mask:value.mask.slice(),notes:[...value.notes]});
/** Coarse computed ENU skyline. Prepared named/polar masks take precedence at integration. */
export function terrainForGlobal(data:GlobalTerrainData,lat:number,lon:number,heightM:number):GlobalTerrainChoice{
 const unavailable=():GlobalTerrainChoice=>({...unavailableTerrain(heightM),kind:'global-coarse',coverage:'unavailable',sourceSpacingM:data.source.sourceSpacingM,outputSpacingM:data.outputSpacingM,notes:['Global coarse numerical horizon unavailable: invalid coordinates/height or missing DEM support.']});
 if(!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lon)||!Number.isFinite(heightM)||heightM<0||heightM>10000)return unavailable();
 const longitude=lon>=0&&lon<360?lon:((lon%360)+360)%360,key=`${data.packed.decodedSha256}|${lat}|${longitude}|${heightM}`;
 let cache=caches.get(data);if(!cache){cache=new Map();caches.set(data,cache);}const hit=cache.get(key);if(hit){cache.delete(key);cache.set(key,hit);return copy(hit);}
 const ground=sampleGlobalHeight(data,lat,longitude);if(ground===null)return unavailable();
 const R=data.radiusM,r0=R+ground+heightM,latr=lat*Math.PI/180,lonr=longitude*Math.PI/180,sinLat=Math.sin(latr),cosLat=Math.cos(latr),mask=new Float64Array(180),distances=globalHorizonDistances();
 for(let i=0;i<mask.length;i++){
  const az=i*GLOBAL_HORIZON_AZIMUTH_STEP_DEG*Math.PI/180;let maximum=-Math.PI/2,missing=false;
  // Vector ENU construction remains stable at either pole; azimuth convention at the exact pole uses the selected meridian.
  const origin=[cosLat*Math.cos(lonr),cosLat*Math.sin(lonr),sinLat],east=[-Math.sin(lonr),Math.cos(lonr),0],north=[-sinLat*Math.cos(lonr),-sinLat*Math.sin(lonr),cosLat];
  for(const distance of distances){const theta=distance/R,ct=Math.cos(theta),st=Math.sin(theta),p=origin.map((v,j)=>v*ct+(north[j]*Math.cos(az)+east[j]*Math.sin(az))*st),lat2=Math.atan2(p[2],Math.hypot(p[0],p[1]))*180/Math.PI,lon2=Math.atan2(p[1],p[0])*180/Math.PI,h=sampleGlobalHeight(data,lat2,lon2);if(h===null){missing=true;break;}const r=R+h,el=Math.atan2(r*ct-r0,r*st);maximum=Math.max(maximum,el);}
  mask[i]=missing?NaN:maximum*180/Math.PI;
 }
 const result:GlobalTerrainChoice={mask,stepDeg:GLOBAL_HORIZON_AZIMUTH_STEP_DEG,heightM,distanceKm:0,cellLat:lat,cellLon:longitude,exact:false,kind:'global-coarse',coverage:mask.some(Number.isFinite)?'partial':'unavailable',sourceSpacingM:data.source.sourceSpacingM,outputSpacingM:data.outputSpacingM,notes:[`Computed at requested coordinates from coarse numerical LOLA DEM, not a borrowed prepared polar mask. ${GLOBAL_HORIZON_RADIAL_SAMPLES} logarithmic radial samples from 1 m to ${GLOBAL_HORIZON_MAX_DISTANCE_M} m; 2° azimuth.`,`Source spacing ${data.source.sourceSpacingM} m; output equatorial spacing ${data.outputSpacingM} m. Interpolated near samples do not recover fine terrain.`,`Observer height ${heightM} m above the coarse interpolated physical surface; no height-specific prepared-mask claim. Coverage remains partial; missing samples retain unknown rays.`,`DE421 mean-Earth frame; no transformed frame-equivalence or propagated uncertainty guarantee. Not local landing-hazard certification.`]};
 cache.set(key,result);if(cache.size>64)cache.delete(cache.keys().next().value!);return copy(result);
}
