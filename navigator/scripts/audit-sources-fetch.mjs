#!/usr/bin/env node
// Bounded primary-source capture. Writes only this audit lane and /tmp; never public data.
import {fromUrl} from 'geotiff';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const out='docs/qa/scientific-audit/sources/references';
const cache='/tmp/lunario-audit-sources-cache';
await mkdir(out,{recursive:true});await mkdir(cache,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const native=globalThis.fetch, receipts=[];let total=0;
// Preserve exact successful response bytes for offline replay, with a hard aggregate cap.
globalThis.fetch=async(input,options={})=>{
 const url=String(input),range=new Headers(options.headers).get('range');
 const key=sha(url+'|'+range),file=`${cache}/${key}.json`;
 let row;
 try{row=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(!row){const response=await native(input,{...options,signal:AbortSignal.timeout(45000)});
  const bound=range?8_000_000:1_600_000;let length=0;const chunks=[];
  for await(const chunk of response.body){length+=chunk.length;if(length>bound)throw Error('Source response exceeds bound: '+url);chunks.push(chunk);}
  const bytes=Buffer.concat(chunks);if(!response.ok)throw Error(`HTTP ${response.status}: ${url}`);
  if(range&&response.status!==206)throw Error('Range not honored: '+url);
  row={url,range,status:response.status,retrievedUtc:new Date().toISOString(),headers:Object.fromEntries(['content-range','content-type','etag','last-modified','content-length'].map(k=>[k,response.headers.get(k)])),bytes:bytes.length,sha256:sha(bytes),bodyBase64:bytes.toString('base64')};await writeFile(file,JSON.stringify(row));
 }
 total+=row.bytes;if(total>24_000_000)throw Error('Audit response budget exceeded');receipts.push(row);
 return new Response(Buffer.from(row.bodyBase64,'base64'),{status:row.status,headers:row.headers});
};
const terrain=JSON.parse(await readFile('public/data/terrain.json','utf8'));
const capture={schemaVersion:1,baseline:'96079ae',createdUtc:new Date().toISOString(),sources:[],failures:[]};
for(const [name,url] of Object.entries({pgda90:'https://pgda.gsfc.nasa.gov/products/90',pgda81:'https://pgda.gsfc.nasa.gov/products/81',usgs:'https://psdi.astrogeology.usgs.gov/moon/standards/data_standards/',pdsLabel:'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_16.lbl',lemelin:'https://zenodo.org/api/records/4646092/files/Lemelin_et_al_2021_PSJ_south_pole_volatiles_ROIs_supp.zip/content',lemelinAlternate:'https://zenodo.org/records/4646092/files/Lemelin_et_al_2021_PSJ_south_pole_volatiles_ROIs_supp.zip?download=1',lcross:'https://ntrs.nasa.gov/api/citations/20140005563/downloads/20140005563.pdf'})){
 try{await fetch(url);console.log('Captured',name);}catch(error){capture.failures.push({name,url,error:String(error)});console.log(name,String(error));}
}
for(const g of [terrain.patches.find(g=>g.lod==='fine5'),terrain.patches.find(g=>g.lod==='fine10'),terrain.patches.find(g=>g.lod==='fine40'),terrain.overview]){
 const url=g.sourceUrl??terrain.source;
 try{
 const t=await fromUrl(url,{allowFullFile:false,blockSize:65536,cacheSize:64}),base=await t.getImage();let im=base,ifd=0;
 if(g.inputPixelM!==Math.abs(base.getResolution()[0]))for(let i=1;i<await t.getImageCount();i++){const candidate=await t.getImage(i);if(Math.abs(base.getResolution()[0])*base.getWidth()/candidate.getWidth()===g.inputPixelM){im=candidate;ifd=i;break;}}
 const origin=base.getOrigin(),pixel=g.inputPixelM,source={url,gridId:g.id,lod:g.lod??'overview',ifd,width:im.getWidth(),height:im.getHeight(),origin,resolutionM:pixel,geoKeys:base.getGeoKeys(),nodata:String(base.getGDALNoData()),samples:[]};
 const middle=Math.floor(g.width/2)+Math.floor(g.height/2)*g.width;
 const indices=g.lod==='fine10'?[0,middle,middle-1,middle+1,middle-g.width,middle+g.width,g.width*g.height-1]:[0,middle,g.width*g.height-1];
 for(const index of indices){const x=g.x0+(index%g.width)*g.stepM,y=g.y0-Math.floor(index/g.width)*(g.stepYM??g.stepM);
 const col=(x-origin[0])/pixel-.5,row=(origin[1]-y)/pixel-.5,c=Math.floor(col),r=Math.floor(row);
 const windowCol=Math.round((g.x0-origin[0])/pixel-.5),windowRow=Math.round((origin[1]-g.y0)/pixel-.5),windowWidth=Math.round(g.stepM*g.width/pixel),windowHeight=Math.round((g.stepYM??g.stepM)*g.height/pixel);
 const clampedCol=Math.min(col,windowCol+windowWidth-1),clampedRow=Math.min(row,windowRow+windowHeight-1);
 if(c<0||r<0||c+1>=im.getWidth()||r+1>=im.getHeight()){source.samples.push({index,xM:x,yM:y,outside:true,clampShiftXM:(clampedCol-col)*pixel,clampShiftYM:(row-clampedRow)*pixel});continue;}
 const values=Array.from(await im.readRasters({window:[c,r,c+2,r+2],interleave:true}));
 const u=col-c,v=row-r,expected=(values[0]*(1-u)+values[1]*u)*(1-v)+(values[2]*(1-u)+values[3]*u)*v;
 const dn=Buffer.from(g.encodedHeights,'base64').readInt16LE(index*2),actual=dn===-32768?null:g.heightOffsetM+dn*g.heightScaleM;
 const uc=clampedCol-c,vc=clampedRow-r,clamped=(values[0]*(1-uc)+values[1]*uc)*(1-vc)+(values[2]*(1-uc)+values[3]*uc)*vc;
 source.samples.push({index,xM:x,yM:y,clampedHeightM:clamped,clampedErrorM:actual===null?null:actual-clamped,clampShiftXM:(clampedCol-col)*pixel,clampShiftYM:(row-clampedRow)*pixel,sourceCol:col,sourceRow:row,window:[c,r,c+2,r+2],sourceHeightsM:values,expectedHeightM:expected,bundledHeightM:actual,errorM:actual===null?null:actual-expected,toleranceM:g.heightScaleM/2+(g.lod?.startsWith('fine')?.005:.05)+.0001});
 }
 capture.sources.push(source);console.log('Sampled',source.lod,source.samples.map(x=>x.errorM));
 }catch(error){capture.failures.push({url,error:String(error),details:JSON.stringify(error,Object.getOwnPropertyNames(error))});console.log('COG failure',url,String(error));}
}
// Exact original DN rectangles suffice to independently reproduce selected area averages.
const global=JSON.parse(await readFile('public/data/global-terrain.json','utf8'));
capture.globalSamples=[];
for(const [x,y] of [[0,0],[1280,640],[2559,1279],[100,1100],[1700,1200]]){
 const x0=x*5760/global.width,x1=(x+1)*5760/global.width,y0=y*2880/global.height,y1=(y+1)*2880/global.height,rows=[];
 try{for(let r=Math.floor(y0);r<Math.ceil(y1);r++){const c0=Math.floor(x0),c1=Math.ceil(x1),start=(r*5760+c0)*2,end=(r*5760+c1)*2-1;
 const res=await fetch(global.source.url,{headers:{Range:`bytes=${start}-${end}`}}),b=Buffer.from(await res.arrayBuffer());rows.push({row:r,col:c0,dn:Array.from({length:c1-c0},(_,i)=>b.readInt16LE(i*2))});}
 capture.globalSamples.push({x,y,x0,x1,y0,y1,rows});}catch(error){capture.failures.push({name:'global-sample',x,y,error:String(error)});}
}
await writeFile(`${out}/capture.json`,JSON.stringify(capture,null,2)+'\n');
const unique=[...new Map(receipts.map(r=>[r.url+'|'+r.range,r])).values()];
await writeFile(`${out}/responses.json`,JSON.stringify(unique)+'\n');
console.log('Saved',unique.length,'exact HTTP responses;',unique.reduce((s,r)=>s+r.bytes,0),'bytes;',capture.failures.length,'failures');
