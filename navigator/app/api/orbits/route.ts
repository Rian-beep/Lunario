import bundled from '@/public/data/orbits/catalog.json';
import {ORBIT_SOURCE,ORBIT_MISSIONS,parseOrbitCatalog,type OrbitCatalog} from '@/lib/orbits';
export const runtime='nodejs';
const TTL=2*3600000;
let cached:OrbitCatalog=parseOrbitCatalog(bundled),attemptedAt=Date.parse(cached.fetchedUtc),pending:Promise<OrbitCatalog>|null=null;
async function refresh(){
 const rows=await Promise.all(ORBIT_MISSIONS.map(async m=>{const response=await fetch(`${ORBIT_SOURCE}?CATNR=${m.id}&FORMAT=JSON`,{signal:AbortSignal.timeout(12000),next:{revalidate:7200}});if(!response.ok)throw Error('Orbital provider unavailable');const text=await response.text();if(text.length>16000)throw Error('Orbital response limit');const records=JSON.parse(text);if(!Array.isArray(records)||records.length!==1||records[0].NORAD_CAT_ID!==m.id)throw Error('Orbital response identity mismatch');return records[0];}));
 return parseOrbitCatalog({source:'CelesTrak GP JSON',fetchedUtc:new Date().toISOString(),elements:rows});
}
export async function GET(){
 if(Date.now()-attemptedAt>=TTL){if(!pending){attemptedAt=Date.now();pending=refresh().then(value=>(cached=value)).finally(()=>{pending=null;});}try{await pending;}catch{return Response.json({...cached,refreshStatus:'Provider unavailable; prior dated catalogue retained'},{status:200,headers:{'Cache-Control':'public, max-age=7200'}});}}
 return Response.json(cached,{headers:{'Cache-Control':'public, max-age=7200'}});
}
