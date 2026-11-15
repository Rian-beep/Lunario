export type GlobalTerrainMetadata={schemaVersion:1;id:string;width:number;height:number;radiusM:number;westEdgeDeg:number;northEdgeDeg:number;angularStepDeg:number;heightScaleM:number;heightOffsetM:number;nodata:number;outputSpacingM:number;effectiveResolutionM:null;accuracyM:null;coverage:'partial';sampling:string;source:{productId:string;version:string;url:string;labelUrl:string;sha256:string;labelSha256:string;labelText:string;sourceWidth:number;sourceHeight:number;sourceScaleM:number;sourceOffsetM:number;sourceSpacingM:number;frame:string};packed:{url:string;encoding:'gzip-int16-le';sha256:string;decodedSha256:string;bytes:number;decodedBytes:number};notes:string[];encodedHeights?:string};
export type GlobalTerrainData=GlobalTerrainMetadata&{samples:Int16Array;northPoleM:number|null;southPoleM:number|null};
const hex=(bytes:ArrayBuffer)=>Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
export function validateGlobalTerrainMetadata(value:unknown):GlobalTerrainMetadata{
 const d=value as GlobalTerrainMetadata;
 if(!d||d.schemaVersion!==1||typeof d.id!=='string'||!Number.isInteger(d.width)||!Number.isInteger(d.height)||d.width<4||d.width>6000||d.height<2||d.width!==2*d.height||d.radiusM!==1737400||d.westEdgeDeg!==0||d.northEdgeDeg!==90||d.angularStepDeg!==360/d.width||d.heightScaleM!==.5||d.heightOffsetM!==0||d.nodata!==-32768||d.coverage!=='partial'||d.source?.frame!=='MEAN EARTH/POLAR AXIS OF DE421'||d.source.sourceWidth!==5760||d.source.sourceHeight!==2880||d.source.productId!=='LDEM_16'||d.source.version!=='V3.1'||d.source.sourceScaleM!==.5||d.source.sourceOffsetM!==0||d.packed?.encoding!=='gzip-int16-le'||d.packed.decodedBytes!==d.width*d.height*2||!/^([a-f0-9]{64})$/.test(d.packed.sha256)||!/^([a-f0-9]{64})$/.test(d.packed.decodedSha256)||d.outputSpacingM!==2*Math.PI*d.radiusM/d.width||d.source.sourceSpacingM!==1895.21||d.effectiveResolutionM!==null||d.accuracyM!==null||!Number.isInteger(d.packed.bytes)||d.packed.bytes<1||d.packed.bytes>40_000_000||typeof d.packed.url!=='string'||!d.packed.url.startsWith('/data/')||!Array.isArray(d.notes)||!d.notes.every(note=>typeof note==='string'))throw Error('Invalid or uncalibrated global numerical terrain');
 return d;
}
export async function decodeGlobalTerrain(value:unknown,packedBytes?:Uint8Array):Promise<GlobalTerrainData>{
 const d=validateGlobalTerrainMetadata(value);
 let packed=packedBytes;
 if(!packed&&d.encodedHeights){const binary=atob(d.encodedHeights);packed=Uint8Array.from(binary,c=>c.charCodeAt(0));}
 if(!packed)throw Error('Global terrain packed data unavailable');
 if(packed.byteLength!==d.packed.bytes||hex(await crypto.subtle.digest('SHA-256',new Uint8Array(packed)))!==d.packed.sha256)throw Error('Global terrain packed hash mismatch');
 const stream=new Blob([new Uint8Array(packed)]).stream().pipeThrough(new DecompressionStream('gzip'));
 const reader=stream.getReader(),chunks:Uint8Array[]=[];let length=0;
 try{for(;;){const part=await reader.read();if(part.done)break;length+=part.value.byteLength;if(length>d.packed.decodedBytes){await reader.cancel();throw Error('Global terrain decompression exceeds declared bound');}chunks.push(part.value);}}finally{reader.releaseLock();}
 const decoded=new Uint8Array(length);let position=0;for(const chunk of chunks){decoded.set(chunk,position);position+=chunk.byteLength;}const raw=decoded.buffer;
 if(raw.byteLength!==d.packed.decodedBytes||hex(await crypto.subtle.digest('SHA-256',raw))!==d.packed.decodedSha256)throw Error('Global terrain decoded hash mismatch');
 const littleEndian=new Uint8Array(new Uint16Array([1]).buffer)[0]===1;
 const samples=littleEndian?new Int16Array(raw):Int16Array.from({length:d.width*d.height},(_,i)=>new DataView(raw).getInt16(i*2,true));
 const pole=(row:number)=>{let sum=0;for(let x=0;x<d.width;x++){const v=samples[row*d.width+x];if(v===d.nodata)return null;sum+=v*d.heightScaleM+d.heightOffsetM;}return sum/d.width;};
 return {...d,samples,northPoleM:pole(0),southPoleM:pole(d.height-1)};
}
declare global{interface Window{__SOLARREACH_GLOBAL_TERRAIN__?:GlobalTerrainMetadata}}
let pending:Promise<GlobalTerrainData>|null=null;
export function loadGlobalTerrain():Promise<GlobalTerrainData>{
 if(!pending)pending=(async()=>{let metadata:GlobalTerrainMetadata;if(typeof window!=='undefined'&&window.__SOLARREACH_GLOBAL_TERRAIN__)metadata=validateGlobalTerrainMetadata(window.__SOLARREACH_GLOBAL_TERRAIN__);else{const response=await fetch('/data/global-terrain.json');if(!response.ok)throw Error('Global numerical terrain metadata unavailable');metadata=validateGlobalTerrainMetadata(await response.json());}if(metadata.encodedHeights)return decodeGlobalTerrain(metadata);const response=await fetch(metadata.packed.url);if(!response.ok)throw Error('Global numerical terrain asset unavailable');return decodeGlobalTerrain(metadata,new Uint8Array(await response.arrayBuffer()));})().catch(error=>{pending=null;throw error;});
 return pending;
}
/** Bilinear interpolation on an area-averaged coarse numerical raster, not fine terrain. */
export function sampleGlobalHeight(data:GlobalTerrainData,lat:number,lon:number):number|null{
 if(!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lon)||data.samples.length!==data.width*data.height)return null;
 const longitude=lon>=0&&lon<360?lon:((lon%360)+360)%360,fx=longitude/data.angularStepDeg-.5,ix=Math.floor(fx),wx=fx-ix,fy=(90-lat)/data.angularStepDeg-.5;
 const row=(y:number)=>{const x0=((ix%data.width)+data.width)%data.width,x1=(x0+1)%data.width,a=data.samples[y*data.width+x0],b=data.samples[y*data.width+x1];if(a===data.nodata||b===data.nodata)return null;return (a+(b-a)*wx)*data.heightScaleM+data.heightOffsetM;};
 if(fy<0){const r=row(0);return r===null||data.northPoleM===null?null:r*(fy+.5)*2+data.northPoleM*(1-(fy+.5)*2);}
 if(fy>data.height-1){const r=row(data.height-1),t=(fy-(data.height-1))*2;return r===null||data.southPoleM===null?null:r*(1-t)+data.southPoleM*t;}
 const y=Math.floor(fy),wy=fy-y,a=row(y);if(a===null)return null;if(wy===0||y===data.height-1)return a;const b=row(y+1);return b===null?null:a+(b-a)*wy;
}
