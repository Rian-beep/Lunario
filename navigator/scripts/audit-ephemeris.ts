import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {decodeCatalog} from '../lib/catalog';
import {buildSeries,earthAzEl,sunAzEl,EARTH_RADIUS_KM,earthRangeAtSiteKm} from '../lib/astro';
import {auditDirectory,epochs,sites,loadResponse,sha256,wrapped,separation,type RequestSpec} from './audit-ephemeris-support';

export async function runAudit(live=false) {
  const catalogBytes=await fs.readFile('public/data/catalog.json','utf8');
  const c=decodeCatalog(JSON.parse(catalogBytes));
  const specs:RequestSpec[]=[{id:'earth-from-moon',target:'399',center:'500@301',quantities:'13,20'},{id:'moon-from-earth',target:'301',center:'500@399',quantities:'14,15,20'},{id:'sun-from-moon',target:'10',center:'500@301',quantities:'13,20'}];
  for(const site of sites) for(const target of ['10','399'] as const) specs.push({id:`${site.id}-${target}`,target,center:'coord@301',quantities:'4,13,20',site});
  const tables=new Map<string,Awaited<ReturnType<typeof loadResponse>>>();
  const errors:{id:string;error:string}[]=[];
  // Sequential bounded provider calls; preserve failed responses as evidence.
  for(const spec of specs) {
    try {tables.set(spec.id,await loadResponse(spec,live || (process.argv.includes('--fetch-missing') && !await fs.stat(`${auditDirectory}/raw/${spec.id}.json`).then(()=>true,()=>false))));}
    catch(error) {errors.push({id:spec.id,error:String(error)});}
  }
  const inputErrors:{epoch:string;subsolarDeg:number;subearthDeg:number;rangeKm:number;sunDiameterArcsec:number}[]=[];
  const moon=tables.get('moon-from-earth'),sun=tables.get('sun-from-moon'),earth=tables.get('earth-from-moon');
  if(moon && sun) for(let j=0;j<epochs.length;j++) {
    const i=(Date.parse(epochs[j])-c.t0ms)/3600000,m=moon.rows[j],s=sun.rows[j];
    inputErrors.push({epoch:epochs[j],subsolarDeg:Math.max(Math.abs(c.subsolarLat[i]-m[4]),Math.abs(wrapped(c.subsolarLon[i]-m[3]))),subearthDeg:Math.max(Math.abs(c.subearthLat[i]-m[2]),Math.abs(wrapped(c.subearthLon[i]-m[1]))),rangeKm:Math.abs(c.earthRangeKm[i]-earth!.rows[j][2]),sunDiameterArcsec:Math.abs(c.sunRadiusDeg[i]*7200-s[1])});
  }
  const samples=[];
  const flat={mask:new Float64Array(360),stepDeg:1,heightM:0,distanceKm:0,cellLat:null,cellLon:null,exact:true};
  for(const site of sites) for(const body of ['10','399'] as const) {
    const table=tables.get(`${site.id}-${body}`);
    if(!table) continue;
    for(let j=0;j<epochs.length;j++) {
      const i=(Date.parse(epochs[j])-c.t0ms)/3600000,row=table.rows[j];
      const local=body==='10'?sunAzEl(site.lat,site.lon,c.subsolarLat[i],c.subsolarLon[i]):earthAzEl(site.lat,site.lon,c.subearthLat[i],c.subearthLon[i],c.earthRangeKm[i]);
      const series=buildSeries(c,site.lat,site.lon,flat,i,i);
      const radius=body==='10'?series.sunRadius[0]:series.earthRadius[0];
      const siteRange=earthRangeAtSiteKm(site.lat,site.lon,c.subearthLat[i],c.subearthLon[i],c.earthRangeKm[i]);
      const directCentreRange=tables.get('earth-from-moon')?.rows[j][2];
      const diagnosticRange=directCentreRange===undefined?null:earthRangeAtSiteKm(site.lat,site.lon,c.subearthLat[i],c.subearthLon[i],directCentreRange);
      const correctedRadius=Math.asin(EARTH_RADIUS_KM/siteRange)*180/Math.PI;
      const azError=Math.abs(wrapped(local[0]-row[1])),elError=Math.abs(local[1]-row[2]),directionError=separation(local,[row[1],row[2]]);
      const radiusError=Math.abs(radius-row[3]/7200);
      const radiusTolerance=body==='10'?0.000080:0.000100;
      samples.push({site:site.id,body:body==='10'?'Sun':'Earth',epoch:epochs[j],catalogIndex:i,referenceAzDeg:row[1],referenceElDeg:row[2],azErrorDeg:azError,elErrorDeg:elError,separationDeg:directionError,directionPass:directionError<=0.02&&elError<=0.02&&azError<=0.02/Math.max(0.001,Math.abs(Math.cos(row[2]*Math.PI/180))),referenceRangeKm:row[4],siteRangeKm:body==='399'?siteRange:null,rangeErrorKm:body==='399'?Math.abs(siteRange-row[4]):null,radiusErrorDeg:radiusError,radiusPass:radiusError<=radiusTolerance,geocentricEarthRadiusErrorDeg:body==='399'?Math.abs(Math.asin(EARTH_RADIUS_KM/c.earthRangeKm[i])*180/Math.PI-row[3]/7200):null,topocentricEarthRadiusErrorDeg:body==='399'?Math.abs(correctedRadius-row[3]/7200):null,directCentreRangeKm:body==='399'?directCentreRange??null:null,diagnosticDirectRangeErrorKm:body==='399'&&diagnosticRange!==null?Math.abs(diagnosticRange-row[4]):null,diagnosticDirectRadiusErrorDeg:body==='399'&&diagnosticRange!==null?Math.abs(Math.asin(EARTH_RADIUS_KM/diagnosticRange)*180/Math.PI-row[3]/7200):null});
    }
  }
  const summary={baseline:'96079ae',catalogSha256:sha256(catalogBytes),checkedUtc:new Date().toISOString(),mode:live?'fresh-network':'cached-offline',expectedTables:specs.length,validTables:tables.size,sampleCount:samples.length,errors,inputErrors,samples,identities:[...tables.values()].map(t=>t.identity)};
  await fs.writeFile(`${auditDirectory}/comparison.json`,JSON.stringify(summary,null,2)+'\n');
  console.log(JSON.stringify({tables:tables.size,samples:samples.length,errors,directionFailures:samples.filter(s=>!s.directionPass).length,radiusFailures:samples.filter(s=>!s.radiusPass).length,rangeFailures:samples.filter(s=>(s.rangeErrorKm??0)>5).length,maxRangeErrorKm:Math.max(...samples.map(s=>s.rangeErrorKm??0)),maxDirectionDeg:Math.max(...samples.map(s=>s.separationDeg)),maxEarthRadiusBeforeDeg:Math.max(...samples.map(s=>s.geocentricEarthRadiusErrorDeg??0)),maxEarthRadiusAfterDeg:Math.max(...samples.map(s=>s.topocentricEarthRadiusErrorDeg??0))},null,2));
  if(errors.length || samples.some(s=>!s.directionPass||!s.radiusPass||(s.rangeErrorKm??0)>5) || inputErrors.some(r=>r.subsolarDeg>0.005001||r.subearthDeg>0.005001||r.rangeKm>0.05||r.sunDiameterArcsec>0.500001)) process.exitCode=1;
  return summary;
}
if(process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]) runAudit(process.argv.includes('--live')).catch(e=>{console.error(e);process.exitCode=1;});
