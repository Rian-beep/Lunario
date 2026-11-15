import {buildSeries,indexToMs,terrainForCustom,terrainForSite,unavailableTerrain,type TerrainChoice} from './astro';
import {terrainForGlobal} from './global-horizon';
import type {Catalog,Site} from './catalog';
import type {AnalysisRequest,AssessmentContext,EvidenceManifest,EvidenceRef} from './planning-types';
import {evidenceById} from './provenance';
/** Display and planning use the same priority: matching prepared evidence, then explicit coarse context. */
export function resolveTerrainChoice(catalog:Catalog,site:Site,custom:{lat:number;lon:number}|null,heightM:number,mode:'prepared'|'global-context'|'global-at-point'='prepared'):TerrainChoice{
 if(![0,2,10].includes(heightM))return unavailableTerrain(heightM);
 let prepared:TerrainChoice=unavailableTerrain(heightM);
 if(!custom)prepared=terrainForSite(site,heightM);
 else if(heightM===catalog.grid.heightM&&catalog.grid.lat.length){const candidate=terrainForCustom(catalog,custom.lat,custom.lon);if(candidate?.mask.length&&Number.isFinite(candidate.distanceKm))prepared=candidate;}
 if(mode==='global-at-point'&&custom){return catalog.globalTerrain?terrainForGlobal(catalog.globalTerrain,custom.lat,custom.lon,heightM):unavailableTerrain(heightM);}
 if(prepared.mask.some(Number.isFinite))return prepared;
 if(mode!=='prepared'&&catalog.globalTerrain){const location=custom??site;return terrainForGlobal(catalog.globalTerrain,location.lat,location.lon,heightM);}
 return prepared;
}
export const isGlobalTerrainChoice=(terrain:TerrainChoice)=>'kind' in terrain&&terrain.kind==='global-coarse';
export function resolveAnalysisContext(catalog:Catalog,request:AnalysisRequest,manifest:EvidenceManifest):AssessmentContext{
 const site=catalog.sites.find(s=>s.id===request.siteId);
 if(!site)throw new Error('Unknown scenario site');
 const {startIndex,endIndex}=request;
 const start=indexToMs(catalog,startIndex),end=indexToMs(catalog,endIndex+1);
 if(!Number.isInteger(startIndex)||!Number.isInteger(endIndex)||startIndex<0||endIndex<startIndex||endIndex>=catalog.meta.n-1||start<Date.parse(manifest.validFromUtc)||end>Date.parse(manifest.validUntilUtcExclusive))throw new Error('The complete stay is outside prepared evidence coverage; dates were not trimmed.');
 const location=request.custom??{lat:site.lat,lon:site.lon};
 if(!Number.isFinite(location.lat)||Math.abs(location.lat)>90||!Number.isFinite(location.lon)||location.lon< -180||location.lon>360)throw new Error('Invalid lunar coordinates');
 const warnings:string[]=[];
 const resolve=(height:number)=>resolveTerrainChoice(catalog,site,request.custom,height,request.terrainMode??'prepared');
 const arrayTerrain=resolve(request.arrayHeightM),antennaTerrain=resolve(request.antennaHeightM);
 const channel=(name:string,height:number,terrain:TerrainChoice):EvidenceRef=>{
  const global=isGlobalTerrainChoice(terrain);
  const original=evidenceById(manifest,global?'horizon-global':request.custom?'horizon-custom':'horizon-catalog');
  const finite=Array.from(terrain.mask).filter(Number.isFinite).length;
  const available=finite>0&&original.coverage!=='unavailable';
  const coverage=!available?'unavailable':global?'partial':!terrain.exact?'borrowed':finite<terrain.mask.length?'partial':original.coverage;
  const notes=[...original.notes,`Requested and effective subsystem height: ${height} m.`];
  if(!available){notes.push('No matching prepared horizon. Terrain obstruction is unknown.');warnings.push(`${name}: terrain horizon unavailable at ${height} m.`);}
  else if(global){const text=`${name}: coarse global numerical LOLA horizon at requested coordinates; approximately ${((catalog.globalTerrain?.outputSpacingM??0)/1000).toFixed(2)} km equatorial output spacing. Local obstacles and fine touchdown hazards are unresolved.`;notes.push(text);warnings.push(text);}
  else if(!terrain.exact){const text=`${name}: borrowed grid horizon at ${terrain.cellLat}°, ${terrain.cellLon}°, ${terrain.distanceKm?.toFixed(3)} km from requested point; no guaranteed safe borrowing distance.`;notes.push(text);warnings.push(text);}
  return {...original,id:`${name}-horizon`,label:`${name} horizon at ${height} m`,coverage,notes};
 };
 const arrayEvidence=channel('array',request.arrayHeightM,arrayTerrain),antennaEvidence=channel('antenna',request.antennaHeightM,antennaTerrain);
 // Missing manifest evidence cannot silently become a measured terrain result.
 const arrayResolved=arrayEvidence.coverage==='unavailable'?unavailableTerrain(request.arrayHeightM):arrayTerrain;
 const antennaResolved=antennaEvidence.coverage==='unavailable'?unavailableTerrain(request.antennaHeightM):antennaTerrain;
 const arraySeries=buildSeries(catalog,location.lat,location.lon,arrayResolved,startIndex,endIndex),antennaSeries=buildSeries(catalog,location.lat,location.lon,antennaResolved,startIndex,endIndex);
 for(let k=0;k<arraySeries.sunEl.length;k++){
  const i=startIndex+k;
  for(const series of [arraySeries,antennaSeries]){
   if(evidenceById(manifest,'ephemeris').coverage==='unavailable'||!(catalog.sunRadiusDeg[i]>0)||!Number.isFinite(catalog.sunRadiusDeg[i])){series.sunEl[k]=Number.NaN;series.sunRadius[k]=Number.NaN;}
   if(evidenceById(manifest,'ephemeris').coverage==='unavailable'||!(catalog.earthRangeKm[i]>catalog.meta.moonRadiusM/1000)||!Number.isFinite(catalog.earthRangeKm[i])){series.earthEl[k]=Number.NaN;series.earthRadius[k]=Number.NaN;}
  }
 }
 return {datasetId:manifest.datasetId,site,location,arrayTerrain:arrayResolved,antennaTerrain:antennaResolved,arraySeries,antennaSeries,startUtc:new Date(start).toISOString(),endUtcExclusive:new Date(end).toISOString(),evidence:[evidenceById(manifest,'ephemeris'),arrayEvidence,antennaEvidence,evidenceById(manifest,'mission-locations')],warnings};
}
