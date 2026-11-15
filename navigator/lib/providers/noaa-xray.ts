import {providerRequestKey,validateMissionPeriod,validUtc,type MissionPeriod,type ProviderEnvelope} from './contract';
export const NOAA_XRAY_URL='https://services.swpc.noaa.gov/json/goes/primary/xrays-6-hour.json';
export const NOAA_XRAY_PARSER='goes-xray-1';
export const XRAY_DISPLAY_MAX_AGE_MS=10*60_000;
export const MAX_XRAY_BYTES=1_000_000;
export type XrayObservation={latest:{observedUtc:string;fluxWm2:number;flareClass:string};sampleCount:number;discardedRows:number};
export function xrayClass(fluxWm2:number):string{
 if(!Number.isFinite(fluxWm2)||fluxWm2<=0)throw new RangeError('X-ray flux must be positive finite W/m²');
 for(const [letter,floor] of [['X',1e-4],['M',1e-5],['C',1e-6],['B',1e-7],['A',1e-8]] as const)if(fluxWm2>=floor){const ratio=fluxWm2/floor;if(!Number.isFinite(ratio))throw new RangeError('X-ray class calculation overflow');return `${letter}${ratio.toFixed(1)}`;}
 return `A${(fluxWm2/1e-8).toPrecision(2)}`;
}
/** Finite validated dated observations only. Never converts a reading into a mission forecast. */
export function parseNoaaXray(payload:unknown,period:MissionPeriod,nowMs:number):ProviderEnvelope<XrayObservation>{
 validateMissionPeriod(period);if(!Number.isFinite(nowMs))throw new RangeError('Observation retrieval time must be finite');
 if(!Array.isArray(payload)||payload.length>5000)throw new Error('NOAA X-ray payload must be a bounded array');
 const samples=new Map<number,{observedUtc:string;fluxWm2:number}>();let discardedRows=0;
 for(const item of payload){
  if(!item||typeof item!=='object')continue;
  const row=item as Record<string,unknown>;if(row.energy!=='0.1-0.8nm')continue;
  if(typeof row.time_tag!=='string'||!validUtc(row.time_tag)||Date.parse(row.time_tag)>nowMs||typeof row.flux!=='number'||!Number.isFinite(row.flux)||row.flux<=0){discardedRows++;continue;}
  const epoch=Date.parse(row.time_tag),previous=samples.get(epoch);
  if(previous&&previous.fluxWm2!==row.flux)throw new Error('Conflicting NOAA X-ray samples at the same UTC instant');
  samples.set(epoch,{observedUtc:new Date(epoch).toISOString(),fluxWm2:row.flux});
 }
 const ordered=[...samples.entries()].sort((a,b)=>a[0]-b[0]),first=ordered[0],last=ordered.at(-1);
 const warnings=['Current GOES X-rays are observed solar context, not a future prediction or a DSN link-availability model.','Discrete sample timestamps do not establish continuous whole-mission coverage.'];
 if(discardedRows)warnings.push(`${discardedRows} invalid, nonpositive or future-dated X-ray rows were discarded.`);
 return{providerId:'noaa-goes-xray',parserVersion:NOAA_XRAY_PARSER,kind:'observation',requestKey:providerRequestKey('noaa-goes-xray',NOAA_XRAY_PARSER,period),requestedStartUtc:period.startUtc,requestedEndUtcExclusive:period.endUtcExclusive,observedStartUtc:first?.[1].observedUtc??null,observedEndUtcExclusive:last?.[1].observedUtc??null,issuedUtc:null,retrievedUtc:new Date(nowMs).toISOString(),expiresUtc:last?new Date(last[0]+XRAY_DISPLAY_MAX_AGE_MS).toISOString():null,coverage:last?'partial':'unavailable',units:{flux:'W/m²',channel:'0.1–0.8 nm',time:'UTC'},sourceUrls:[NOAA_XRAY_URL,'https://www.swpc.noaa.gov/products/goes-x-ray-flux'],sourceSha256:null,warnings,value:last?{latest:{...last[1],flareClass:xrayClass(last[1].fluxWm2)},sampleCount:ordered.length,discardedRows}:null};
}
function abortable<T>(promise:Promise<T>,signal:AbortSignal):Promise<T>{
 return new Promise((resolve,reject)=>{
  const cancel=()=>{signal.removeEventListener('abort',cancel);reject(signal.reason??new DOMException('Aborted','AbortError'));};
  if(signal.aborted){cancel();promise.catch(()=>{});return;}
  signal.addEventListener('abort',cancel,{once:true});
  promise.then(value=>{signal.removeEventListener('abort',cancel);resolve(value);},error=>{signal.removeEventListener('abort',cancel);reject(error);});
 });
}
/** Bounded browser fetch; no credentials, auto-polling, silent stale cache or proxy dependency. */
export async function fetchNoaaXray(period:MissionPeriod,options:{signal?:AbortSignal;fetchFn?:typeof fetch;nowMs?:()=>number;timeoutMs?:number}={}):Promise<ProviderEnvelope<XrayObservation>>{
 validateMissionPeriod(period);const timeoutMs=options.timeoutMs??12000;
 if(!Number.isFinite(timeoutMs)||timeoutMs<1||timeoutMs>30000)throw new RangeError('Provider timeout must be 1–30000 ms');
 const controller=new AbortController(),cancel=()=>controller.abort(options.signal?.reason);
 if(options.signal?.aborted)cancel();else options.signal?.addEventListener('abort',cancel,{once:true});
 const timer=setTimeout(()=>controller.abort(new DOMException('NOAA read timed out','TimeoutError')),timeoutMs);
 try{
  if(controller.signal.aborted)throw controller.signal.reason??new DOMException('Aborted','AbortError');
  const response=await abortable((options.fetchFn??fetch)(NOAA_XRAY_URL,{signal:controller.signal,cache:'no-store',credentials:'omit'}),controller.signal);
  if(!response.ok)throw new Error(`NOAA X-ray provider returned HTTP ${response.status}`);
  const declared=response.headers.get('content-length');if(declared&&Number(declared)>MAX_XRAY_BYTES)throw new Error('NOAA response exceeds 1 MB bound');
  if(!response.body)throw new Error('NOAA provider returned no readable body');
  const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true}),chunks:Uint8Array[]=[];let bytes=0,text='';
  try{while(true){if(controller.signal.aborted)throw controller.signal.reason??new DOMException('Aborted','AbortError');const part=await abortable(reader.read(),controller.signal);if(part.done)break;bytes+=part.value.byteLength;if(bytes>MAX_XRAY_BYTES)throw new Error('NOAA response exceeds 1 MB bound');chunks.push(part.value.slice());text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();}
  catch(error){void reader.cancel(error).catch(()=>{});throw error;}
  finally{reader.releaseLock();}
  if(controller.signal.aborted)throw controller.signal.reason??new DOMException('Aborted','AbortError');
  const result=parseNoaaXray(JSON.parse(text),period,(options.nowMs??Date.now)());
  if(globalThis.crypto?.subtle){const sourceBytes=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){sourceBytes.set(chunk,offset);offset+=chunk.length;}const digest=await crypto.subtle.digest('SHA-256',sourceBytes);result.sourceSha256=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');}
  if(controller.signal.aborted)throw controller.signal.reason??new DOMException('Aborted','AbortError');
  return result;
 }finally{clearTimeout(timer);options.signal?.removeEventListener('abort',cancel);}
}
