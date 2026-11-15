// Bounded fresh NASA range comparison. Raw responses remain under /tmp.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {fromUrl} from 'geotiff';
const output=process.argv[2]||'/tmp/lunario-eval-terrain-primary';
await fs.mkdir(output,{recursive:true});
const nativeFetch=globalThis.fetch,receipts=[];
let total=0;
globalThis.fetch=async(input,options={})=>{
 const url=String(input),range=new Headers(options.headers).get('range');
 if(!['pgda.gsfc.nasa.gov','pds.lroc.im-ldi.com'].includes(new URL(url).hostname)||!range)throw new Error('Only bounded primary range reads allowed');
 let response;
 for(let attempt=0;attempt<3;attempt++){
  try{response=await nativeFetch(input,{...options,headers:{...options.headers,Connection:'close'},signal:AbortSignal.timeout(25000)});break;}
  catch(error){if(attempt===2)throw error;}
 }
 if(response.status!==206){await response.body?.cancel();throw new Error(`Expected range HTTP 206, got ${response.status}`);}
 const reader=response.body.getReader(),chunks=[];let bytes=0;
 for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.length;total+=value.length;
  if(total>8*1024*1024){await reader.cancel();throw new Error('8 MiB total response budget exceeded');}chunks.push(value);}
 const body=Buffer.concat(chunks),file=`range-${receipts.length}.bin`;
 await fs.writeFile(path.join(output,file),body);
 receipts.push({url,range,status:response.status,bytes,sha256:createHash('sha256').update(body).digest('hex'),file,
  contentRange:response.headers.get('content-range'),etag:response.headers.get('etag'),lastModified:response.headers.get('last-modified')});
 return new Response(body,{status:response.status,headers:response.headers});
};
const manifest=JSON.parse(await fs.readFile('public/data/south-pole-detail/manifest.json','utf8'));
const results=[];
try{
 for(const id of ['shackleton-rim-5m','shackleton-20m','shackleton-stereo-2m']){
  const data=manifest.datasets.find(d=>d.id===id),tiff=await fromUrl(data.sourceUrl,{allowFullFile:false,blockSize:65536,cacheSize:20});
  const image=await tiff.getImage(),origin=image.getOrigin(),resolution=image.getResolution();
  const packed=await fs.readFile(`public/data/south-pole-detail/${data.file}`),raw=gunzipSync(packed),samples=[];
  for(const [row,startCol] of [[Math.floor(data.height/2),Math.floor(data.width/2)],[Math.floor(data.height/3),Math.floor(data.width/3)],[Math.floor(data.height*2/3),Math.floor(data.width*2/3)]]){
   let col=startCol;while(col<data.width&&raw.readInt16LE((row*data.width+col)*2)===data.nodata)col++;
   if(col>=data.width)throw new Error('No valid sample in selected source row');
   const x=data.xMin+col*data.spacing,y=data.yMax-row*data.spacing;
   const u=(x-origin[0])/resolution[0]-.5,v=(y-origin[1])/resolution[1]-.5,c=Math.floor(u),r=Math.floor(v),fx=u-c,fy=v-r;
   const values=await image.readRasters({window:[c,r,c+2,r+2],interleave:true});
   const source=(values[0]*(1-fx)+values[1]*fx)*(1-fy)+(values[2]*(1-fx)+values[3]*fx)*fy;
   const decoded=raw.readInt16LE((row*data.width+col)*2)*data.scale+data.offset;
   samples.push({row,col,x,y,sourcePixelCentre:[u,v],sourceStencil:Array.from(values),sourceM:source,decodedM:decoded,errorM:decoded-source});
   if(!Number.isFinite(source)||Math.abs(decoded-source)>data.maxQuantizationError+1e-7)process.exitCode=1;
  }
  results.push({id,sourceUrl:data.sourceUrl,width:image.getWidth(),height:image.getHeight(),origin,resolution,pixelIsArea:image.pixelIsArea(),geoKeys:image.getGeoKeys(),samples});
  await tiff.close();
 }
}catch(error){results.push({error:error.message});process.exitCode=1;}
const report={retrievedUtc:new Date().toISOString(),sourceCommit:'3c82b5aa02c4da52053fd3c12c180cca18fd6d4e',bytes:total,receipts,results};
await fs.writeFile(path.join(output,'results.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
