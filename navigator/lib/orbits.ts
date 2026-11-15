import {json2satrec,propagate,gstime,eciToEcf,eciToGeodetic,ecfToLookAngles} from 'satellite.js';
import {DSN_STATIONS} from './dsn';
export type OrbitElement={[K in typeof numeric[number]]:number}&{OBJECT_NAME:string;OBJECT_ID:string;EPOCH:string;EPHEMERIS_TYPE:0;CLASSIFICATION_TYPE?:'U'|'C';TIME_SYSTEM?:'UTC';REF_FRAME?:'TEME';CENTER_NAME?:'EARTH';MEAN_ELEMENT_THEORY?:'SGP4'};
export type OrbitCatalog={source:string;sourceBase:string;fetchedUtc:string;elements:OrbitElement[]};
export const ORBIT_MAX_AGE_MS=72*3600000;
export const ORBIT_SOURCE='https://celestrak.org/NORAD/elements/gp.php';
export const ORBIT_MISSIONS=[
 {id:66303,name:'Starcloud-1',match:/^STARCLOUD[- ]1$/i,kind:'Orbital computing',description:'A technology demonstration carrying an NVIDIA H100 GPU. Processing data aboard a spacecraft can reduce how much raw data must be sent to Earth. This does not make it a lunar relay or a booked computing service.',url:'https://www.starcloud.com/starcloud-1'},
 {id:25544,name:'International Space Station',match:/^ISS \(ZARYA\)$/i,kind:'Research station',description:'A crewed research laboratory in low Earth orbit. Its rapid motion illustrates why a ground antenna sees a pass rather than continuous overhead coverage.',url:'https://www.nasa.gov/international-space-station/'},
 {id:20580,name:'Hubble',match:/^HST$/i,kind:'Space astronomy',description:'An orbiting telescope. NASA describes its data/command path through TDRS and the White Sands ground facilities; being above a DSN dish alone does not describe that operational network.',url:'https://science.nasa.gov/mission/hubble/observatory/design/design-communications/'},
 {id:43013,name:'NOAA-20',match:/^NOAA 20 \(JPSS-1\)$/i,kind:'Polar weather observation',description:'A polar-orbiting weather observatory. Satellite observations help weather analysis, but this moving point is not a weather measurement or a forecast of radio attenuation.',url:'https://www.nesdis.noaa.gov/our-satellites/currently-flying/joint-polar-satellite-system'},
 {id:60133,name:'GOES-19',match:/^GOES[- ]19$/i,kind:'Geostationary weather observation',description:'A geostationary weather observatory. Its near-fixed Earth view differs from a low-orbiting weather satellite. The marker does not contain live cloud or rain measurements.',url:'https://www.goes-r.gov/mission/mission.html'},
 {id:42915,name:'TDRS-13',match:/^TDRS[- ]13$/i,kind:'Space communications relay',description:'A NASA Tracking and Data Relay Satellite. TDRS supports Earth-orbit mission communications; this catalogue does not establish lunar relay compatibility, current service availability or a reservation.',url:'https://www.nasa.gov/mission/tracking-and-data-relay-satellites/'},
] as const;
const numeric=['MEAN_MOTION','ECCENTRICITY','INCLINATION','RA_OF_ASC_NODE','ARG_OF_PERICENTER','MEAN_ANOMALY','NORAD_CAT_ID','BSTAR','MEAN_MOTION_DOT','MEAN_MOTION_DDOT','ELEMENT_SET_NO','REV_AT_EPOCH'] as const;
export function orbitEpoch(element:OrbitElement){return Date.parse(element.EPOCH.endsWith('Z')?element.EPOCH:element.EPOCH+'Z');}
export function parseOrbitCatalog(value:unknown):OrbitCatalog{
 const v=value as OrbitCatalog;if(!v||!Array.isArray(v.elements)||v.elements.length<1||v.elements.length>128||typeof v.source!=='string'||v.source.length>160||typeof v.fetchedUtc!=='string'||!Number.isFinite(Date.parse(v.fetchedUtc)))throw Error('Expected a dated catalogue with 1–128 orbital records.');
 const ids=new Set<number>();const elements=v.elements.map(raw=>{
  if(!raw||typeof raw.OBJECT_NAME!=='string'||raw.OBJECT_NAME.length>80||typeof raw.OBJECT_ID!=='string'||raw.OBJECT_ID.length>40||typeof raw.EPOCH!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z?$/.test(raw.EPOCH)||!Number.isFinite(orbitEpoch(raw))||new Date(orbitEpoch(raw)).toISOString().slice(0,19)!==raw.EPOCH.slice(0,19)||numeric.some(k=>typeof raw[k]!=='number'||!Number.isFinite(raw[k])))throw Error('Malformed OMM orbital record.');
  if((raw.TIME_SYSTEM&&raw.TIME_SYSTEM!=='UTC')||(raw.REF_FRAME&&raw.REF_FRAME!=='TEME')||(raw.CENTER_NAME&&raw.CENTER_NAME!=='EARTH')||(raw.MEAN_ELEMENT_THEORY&&raw.MEAN_ELEMENT_THEORY!=='SGP4')||raw.EPHEMERIS_TYPE!==0)throw Error('Only Earth-centred TEME / UTC SGP4 records are supported.');
  if(!Number.isSafeInteger(raw.NORAD_CAT_ID)||raw.NORAD_CAT_ID<=0||ids.has(raw.NORAD_CAT_ID)||raw.MEAN_MOTION<=0||raw.MEAN_MOTION>18||raw.ECCENTRICITY<0||raw.ECCENTRICITY>=1||raw.INCLINATION<0||raw.INCLINATION>180||[raw.RA_OF_ASC_NODE,raw.ARG_OF_PERICENTER,raw.MEAN_ANOMALY].some(x=>x<0||x>=360))throw Error('Duplicate identity or unsupported orbital range.');
  const mission=ORBIT_MISSIONS.find(m=>m.id===raw.NORAD_CAT_ID);if(mission&&!mission.match.test(raw.OBJECT_NAME))throw Error('NORAD identity and known mission name disagree.');ids.add(raw.NORAD_CAT_ID);
  return {OBJECT_NAME:raw.OBJECT_NAME,OBJECT_ID:raw.OBJECT_ID,EPOCH:raw.EPOCH,EPHEMERIS_TYPE:0,CLASSIFICATION_TYPE:'U',...Object.fromEntries(numeric.map(k=>[k,raw[k]]))} as OrbitElement;
 });return{source:v.source,sourceBase:ORBIT_SOURCE,fetchedUtc:v.fetchedUtc,elements};
}
const records=new WeakMap<OrbitElement,ReturnType<typeof json2satrec>>();
export function orbitState(element:OrbitElement,atMs:number){
 if(!Number.isFinite(atMs)||Math.abs(atMs-orbitEpoch(element))>ORBIT_MAX_AGE_MS)return null;
 let record=records.get(element);if(!record){record=json2satrec(element);records.set(element,record);}
 const date=new Date(atMs),state=propagate(record,date);if(!state||!state.position||typeof state.position==='boolean'||!state.velocity||typeof state.velocity==='boolean'||record.error)return null;
 const fixed=eciToEcf(state.position,gstime(date)),geo=eciToGeodetic(state.position,gstime(date));const r=Math.hypot(fixed.x,fixed.y,fixed.z);
 if(![fixed.x,fixed.y,fixed.z,geo.height].every(Number.isFinite)||r<6370)return null;
 return{ecefKm:[fixed.x,fixed.y,fixed.z] as [number,number,number],sceneKm:[fixed.x,fixed.z,-fixed.y] as [number,number,number],latitudeDeg:geo.latitude*180/Math.PI,longitudeDeg:geo.longitude*180/Math.PI,altitudeKm:geo.height,speedKms:Math.hypot(state.velocity.x,state.velocity.y,state.velocity.z)};
}
/** Predicted trajectory samples expressed in ONE Earth-fixed frame at orbit UTC. */
export function orbitTrack(element:OrbitElement,atMs:number){
 if(!orbitState(element,atMs))return [];
 const record=records.get(element)!,gmst=gstime(new Date(atMs)),periodMs=86400000/element.MEAN_MOTION,points:Array<[number,number,number]>=[];
 for(let i=0;i<=96;i++){
  const time=atMs+(i/96-.5)*periodMs;if(Math.abs(time-orbitEpoch(element))>ORBIT_MAX_AGE_MS)return [];
  const state=propagate(record,new Date(time));if(!state||!state.position||typeof state.position==='boolean'||record.error)return [];
  const p=eciToEcf(state.position,gmst);if(![p.x,p.y,p.z].every(Number.isFinite))return [];points.push([p.x,p.z,-p.y]);
 }return points;
}
export function stationSatelliteAngles(element:OrbitElement,atMs:number){
 const state=orbitState(element,atMs);if(!state)return [];
 const [x,y,z]=state.ecefKm;return DSN_STATIONS.map(station=>{const a=ecfToLookAngles({latitude:station.latitudeDeg*Math.PI/180,longitude:station.longitudeEastDeg*Math.PI/180,height:station.heightM/1000},{x,y,z});return{id:station.id,name:station.name,azimuthDeg:a.azimuth*180/Math.PI,elevationDeg:a.elevation*180/Math.PI,rangeKm:a.rangeSat};});
}
export function catalogEpoch(catalog:OrbitCatalog){return Math.max(...catalog.elements.map(orbitEpoch));}
export type OrbitLayerState={catalog:OrbitCatalog;atMs:number;enabled:boolean;selectedId:number;rate:number;startedPerf:number};
export function orbitTime(state:OrbitLayerState,perfMs:number){return state.atMs+state.rate*Math.max(0,perfMs-state.startedPerf);}
