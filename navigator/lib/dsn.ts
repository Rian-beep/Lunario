import type {Catalog} from './catalog';
export const DSN_SOURCES={overview:'https://www.nasa.gov/communicating-with-missions/dsn/',live:'https://www.jpl.nasa.gov/deep-space-network-now/',coordinates:'https://deepspace.jpl.nasa.gov/dsndocs/810-005/301/301O.pdf',weather:'https://open-meteo.com/en/docs'} as const;
export const DSN_EARTH_TEXTURE_PATH='/data/dsn/earth-blue-marble-2048.jpg';
export const DSN_EARTH_TEXTURE_GLOBAL='__SOLARREACH_DSN_EARTH_TEXTURE__';
declare global {var __SOLARREACH_DSN_EARTH_TEXTURE__:string|undefined;}
export function dsnEarthTextureUrl():string{
 if(globalThis.__SOLARREACH_DSN_EARTH_TEXTURE__)return globalThis.__SOLARREACH_DSN_EARTH_TEXTURE__;
 if(typeof location!=='undefined'&&location.protocol==='file:')throw Error('Offline georeferenced Earth texture is missing');
 return DSN_EARTH_TEXTURE_PATH;
}
const dms=(d:number,m:number,s:number)=>Math.sign(d)*(Math.abs(d)+m/60+s/3600);
export type DsnStation={id:'goldstone'|'madrid'|'canberra';name:string;country:string;antenna:string;latitudeDeg:number;longitudeEastDeg:number;heightM:number;description:string};
/** Representative 70 m antennas, not an invented centre for each complex.
 * JPL 810-005/301 Rev O (1 July 2024), Table 5, WGS84 geodetic positions.
 */
export const DSN_STATIONS:readonly DsnStation[]=[
 {id:'goldstone',name:'Goldstone',country:'California, United States',antenna:'DSS-14',latitudeDeg:dms(35,25,33.24312),longitudeEastDeg:dms(243,6,37.66244),heightM:1001.390,description:'Desert ground complex near Barstow. DSS-14 is its representative 70 m antenna.'},
 {id:'madrid',name:'Madrid',country:'Robledo de Chavela, Spain',antenna:'DSS-63',latitudeDeg:dms(40,25,52.35510),longitudeEastDeg:dms(355,45,7.16924),heightM:864.816,description:'Ground complex west of Madrid. DSS-63 is its representative 70 m antenna.'},
 {id:'canberra',name:'Canberra',country:'Tidbinbilla, Australia',antenna:'DSS-43',latitudeDeg:dms(-35,24,8.72724),longitudeEastDeg:dms(148,58,52.56231),heightM:688.867,description:'Southern-hemisphere ground complex near Canberra. DSS-43 is its representative 70 m antenna.'},
];
export const WGS84={aKm:6378.137,flattening:1/298.2572236} as const;
/** Earth-fixed ECEF km: +X Greenwich/equator, +Y 90°E/equator, +Z north. */
export function stationEcefKm(station:Pick<DsnStation,'latitudeDeg'|'longitudeEastDeg'|'heightM'>):[number,number,number]{
 const {latitudeDeg,longitudeEastDeg,heightM}=station;
 if(![latitudeDeg,longitudeEastDeg,heightM].every(Number.isFinite)||Math.abs(latitudeDeg)>90)throw new RangeError('Invalid Earth-fixed station coordinates');
 const p=latitudeDeg*Math.PI/180,l=longitudeEastDeg*Math.PI/180,e2=WGS84.flattening*(2-WGS84.flattening),n=WGS84.aKm/Math.sqrt(1-e2*Math.sin(p)**2),h=heightM/1000;
 return[(n+h)*Math.cos(p)*Math.cos(l),(n+h)*Math.cos(p)*Math.sin(l),(n*(1-e2)+h)*Math.sin(p)];
}
/** Independent texture registration: west edge 180°W, north edge 90°N.
 * Three Texture.flipY=true uses v=1 at the image's northern edge.
 */
export function dsnEarthUv(latitudeDeg:number,longitudeEastDeg:number):{u:number;v:number}{
 if(!Number.isFinite(latitudeDeg)||Math.abs(latitudeDeg)>90||!Number.isFinite(longitudeEastDeg))throw new RangeError('Invalid texture coordinates');
 return{u:(((longitudeEastDeg+180)%360)+360)%360/360,v:(latitudeDeg+90)/180};
}
function bodyDirection(lat:number,lon:number):[number,number,number]{const p=lat*Math.PI/180,l=lon*Math.PI/180;return[Math.cos(p)*Math.cos(l),Math.sin(p),-Math.cos(p)*Math.sin(l)];}
export function earthMoonContext(catalog:Catalog,timeIndex:number){
 if(!Number.isFinite(timeIndex)||timeIndex<0||timeIndex>catalog.meta.n-1)return null;
 const i=Math.floor(timeIndex),j=Math.min(i+1,catalog.meta.n-1),a=catalog.earthRangeKm[i],b=catalog.earthRangeKm[j];
 if(!Number.isFinite(a)||!Number.isFinite(b)||Math.min(a,b)<=catalog.meta.earthRadiusKm+catalog.meta.moonRadiusM/1000)return null;
 const rangeKm=a+(b-a)*(timeIndex-i);
 const direction=(lat:Float64Array|undefined,lon:Float64Array|undefined)=>{
  if(!lat||!lon||![lat[i],lat[j],lon[i],lon[j]].every(Number.isFinite))return null;
  const a=bodyDirection(lat[i],lon[i]),b=bodyDirection(lat[j],lon[j]),f=timeIndex-i;
  const v=a.map((n,k)=>n+(b[k]-n)*f),length=Math.hypot(...v);return length>0?v.map(n=>n/length) as [number,number,number]:null;
 };
 const earthDirection=direction(catalog.subearthLat,catalog.subearthLon);
 const sunDirection=direction(catalog.subsolarLat,catalog.subsolarLon);
 const radius=catalog.sunRadiusDeg?.[i],nextRadius=catalog.sunRadiusDeg?.[j],angularRadius=radius+(nextRadius-radius)*(timeIndex-i);
 const sunRangeKm=Number.isFinite(angularRadius)&&angularRadius>0&&angularRadius<90?catalog.meta.sunRadiusKm/Math.sin(angularRadius*Math.PI/180):null;
 return{earthDirection,sunDirection,sunRangeKm,rangeKm,earthRadiusKm:catalog.meta.earthRadiusKm,moonRadiusKm:catalog.meta.moonRadiusM/1000,sunRadiusKm:catalog.meta.sunRadiusKm,oneWayCentreLightSeconds:rangeKm/299792.458,epochMs:catalog.t0ms+timeIndex*catalog.meta.stepHours*3600000};
}
export const DSN_GEOMETRY_STATUS={state:'not-assessed',reason:'Station-to-Moon visibility is not assessed: a qualified terrestrial-rotation / inertial Moon transform and station horizon are not supplied. Station scheduling and service availability are also unknown.'} as const;
export type DsnWeather={stationId:DsnStation['id'];fetchedUtc:string;provider:'Open-Meteo model forecast';sourceUrl:string;hours:Array<{epochMs:number;temperatureC:number|null;windKmh:number|null;precipitationMm:number|null;cloudPercent:number|null}>};
export function parseDsnWeather(value:unknown,station:DsnStation,fetchedUtc:string,sourceUrl:string):DsnWeather{
 const d=value as {utc_offset_seconds?:unknown;hourly?:Record<string,unknown>;hourly_units?:Record<string,unknown>};
 if(!d||d.utc_offset_seconds!==0||!d.hourly||!Array.isArray(d.hourly.time)||d.hourly.time.length<1||d.hourly.time.length>192||!Number.isFinite(Date.parse(fetchedUtc)))throw Error('Invalid or unbounded UTC weather forecast');
 const units=d.hourly_units;if(!units||units.temperature_2m!=='°C'||units.wind_speed_10m!=='km/h'||units.precipitation!=='mm'||units.cloud_cover!=='%')throw Error('Unexpected weather units');
 const timestamps=d.hourly.time as unknown[];
 const keys=['temperature_2m','wind_speed_10m','precipitation','cloud_cover'] as const;
 if(keys.some(k=>!Array.isArray(d.hourly![k])||(d.hourly![k] as unknown[]).length!==timestamps.length))throw Error('Weather series lengths differ');
 let previous=-Infinity;
 const hours=timestamps.map((t:unknown,i:number)=>{
  if(typeof t!=='number'||!Number.isFinite(t)||t*1000<=previous)throw Error('Weather epochs must increase');
  const epochMs=t*1000;if(previous!==-Infinity&&epochMs-previous!==3600000)throw Error('Weather coverage must be contiguous hourly UTC');previous=epochMs;
  const number=(key:typeof keys[number])=>{const v=(d.hourly![key] as unknown[])[i];if(v===null)return null;if(typeof v!=='number'||!Number.isFinite(v))throw Error('Invalid weather measurement');return v;};
  const temperatureC=number('temperature_2m'),windKmh=number('wind_speed_10m'),precipitationMm=number('precipitation'),cloudPercent=number('cloud_cover');
  if((windKmh!==null&&windKmh<0)||(precipitationMm!==null&&precipitationMm<0)||(cloudPercent!==null&&(cloudPercent<0||cloudPercent>100)))throw Error('Weather value outside declared units');
  return{epochMs,temperatureC,windKmh,precipitationMm,cloudPercent};
 });
 return{stationId:station.id,fetchedUtc,provider:'Open-Meteo model forecast',sourceUrl,hours};
}
/** Never relabel present-day weather as selected future mission weather. */
export function dsnWeatherAt(forecast:DsnWeather|null|undefined,epochMs:number){
 if(!forecast||!Number.isFinite(epochMs))return null;
 return forecast.hours.find(row=>epochMs>=row.epochMs&&epochMs<row.epochMs+3600000)??null;
}
export async function fetchDsnWeather(station:DsnStation,signal:AbortSignal):Promise<DsnWeather>{
 if(typeof navigator!=='undefined'&&navigator.onLine===false)throw Error('Offline: no dated station weather is available');
 const lon=((station.longitudeEastDeg+540)%360)-180;
 const url=new URL('https://api.open-meteo.com/v1/forecast');
 Object.entries({latitude:String(station.latitudeDeg),longitude:String(lon),hourly:'temperature_2m,precipitation,wind_speed_10m,cloud_cover',forecast_days:'7',timezone:'UTC',timeformat:'unixtime',temperature_unit:'celsius',wind_speed_unit:'kmh',precipitation_unit:'mm'}).forEach(([k,v])=>url.searchParams.set(k,v));
 const response=await fetch(url,{signal});if(!response.ok)throw Error(`Weather provider unavailable (${response.status})`);
 const text=await response.text();if(text.length>200000)throw Error('Weather response exceeds bound');
 return parseDsnWeather(JSON.parse(text),station,new Date().toISOString(),url.href);
}
