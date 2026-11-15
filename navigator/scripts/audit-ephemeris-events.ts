import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {decodeCatalog} from '../lib/catalog';
import {buildSeries} from '../lib/astro';
import {auditDirectory,loadResponse,type RequestSpec} from './audit-ephemeris-support';
async function main(){
 const c=decodeCatalog(JSON.parse(await fs.readFile('public/data/catalog.json','utf8')));
 const flat={mask:new Float64Array(360),stepDeg:1,heightM:0,distanceKm:0,cellLat:null,cellLon:null,exact:true};
 const events=[];
 for(const body of ['10','399'] as const){
  const site=body==='10'?{lat:0,lon:0}:{lat:89.99,lon:0};
  const s=buildSeries(c,site.lat,site.lon,flat,0,c.meta.n-1);
  for(const meaning of ['centre','upper-limb'] as const){
   const clearance=(i:number)=>(body==='10'?s.sunEl[i]:s.earthEl[i])+(meaning==='upper-limb'?(body==='10'?s.sunRadius[i]:s.earthRadius[i]):0);
   const start=(Date.parse('2027-06-01T00:00:00Z')-c.t0ms)/3600000,end=start+90*24;
   let index=-1;
   for(let i=start+1;i<end;i++)if(clearance(i-1)>0&&clearance(i)<=0){index=i;break;}
   assert(index>=0,'No requested setting event in bounded search');
   const begin=c.t0ms+(index-1)*3600000;
   const times=Array.from({length:25},(_,i)=>new Date(begin-1800000+i*300000).toISOString());
   const spec:RequestSpec={id:`event-${body}-${meaning}`,target:body,center:'coord@301',quantities:'4,13,20',site,times};
   const ref=await loadResponse(spec,process.argv.includes('--live'));
   const refClearance=ref.rows.map(r=>r[2]+(meaning==='upper-limb'?r[3]/7200:0));
   const k=refClearance.findIndex((x,i)=>i>0&&refClearance[i-1]>0&&x<=0);
   const referenceBracket=k>0?[times[k-1],times[k]]:null;
   const modelBracket=[new Date(begin).toISOString(),new Date(begin+3600000).toISOString()];
   events.push({body:body==='10'?'Sun':'Earth',meaning,site,modelHourlyBracketUtc:modelBracket,modelClearanceDeg:[clearance(index-1),clearance(index)],referenceFiveMinuteBracketUtc:referenceBracket,referenceBracketContained:k>0&&Date.parse(times[k-1])>=begin&&Date.parse(times[k])<=begin+3600000,referenceIdentity:ref.identity,limit:'3600 s adjacent forcing samples; not sub-hour physical accuracy; straight zero-degree horizon only'});
  }
 }
 await fs.writeFile(`${auditDirectory}/events.json`,JSON.stringify(events,null,2)+'\n');
 console.log(JSON.stringify(events.map(e=>({body:e.body,meaning:e.meaning,model:e.modelHourlyBracketUtc,reference:e.referenceFiveMinuteBracketUtc,contained:e.referenceBracketContained})),null,2));
 if(events.some(e=>!e.referenceBracketContained))process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
