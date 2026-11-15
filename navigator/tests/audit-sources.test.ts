import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fromUrl} from 'geotiff';
import {decodeTerrain} from '../lib/terrain';
import {decodeGlobalTerrain,sampleGlobalHeight} from '../lib/global-terrain';
import {regionalSlope} from '../lib/suitability/geometry';
import {terrainForGlobal} from '../lib/global-horizon';
import {horizonAt} from '../lib/astro';
import {observedAbsence} from '../lib/observed-duration';
import {parseIceCatalog} from '../lib/ice';
const root='docs/qa/scientific-audit/sources/';
const json=(file:string)=>JSON.parse(readFileSync(file,'utf8'));
const capture=json(root+'references/capture.json');
const responses=json(root+'references/responses.json') as {url:string;range:string|null;status:number;headers:Record<string,string|null>;bodyBase64:string;bytes:number;sha256:string}[];
const sha=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
const metadata=json('public/data/global-terrain.json');
const terrain=decodeTerrain(json('public/data/terrain.json'));

test('audit source HTTP captures reproduce byte identities offline and respect the bounded budget',()=>{
 assert.ok(responses.length>=30);let total=0;
 for(const row of responses){const bytes=Buffer.from(row.bodyBase64,'base64');assert.equal(bytes.length,row.bytes);assert.equal(sha(bytes),row.sha256);total+=bytes.length;if(row.range){assert.equal(row.status,206);assert.match(row.headers['content-range']!,/^bytes /);}}
 assert.ok(total<24_000_000);assert.equal(capture.sources.length,4);
 const inventory=json(root+'inventory.json');
 for(const asset of inventory.assets){assert.equal(sha(readFileSync(asset.path)),asset.sha256,`stale audit input ${asset.path}`);}
});

test('audit original COG windows and metadata replay from exact HTTP responses with networking forbidden',async()=>{
 const previous=globalThis.fetch;
 globalThis.fetch=async(input,options)=>{
  const url=String(input),range=new Headers(options?.headers).get('range');
  const receipt=responses.find(row=>row.url===url&&row.range===range);
  assert.ok(receipt,`uncaptured request ${url} ${range}`);
  const headers=Object.fromEntries(Object.entries(receipt.headers).filter((entry):entry is [string,string]=>entry[1]!==null));
  return new Response(Buffer.from(receipt.bodyBase64,'base64'),{status:receipt.status,headers});
 };
 try{for(const source of capture.sources){
  const options={allowFullFile:false,blockSize:65536,cacheSize:64};
  const t=await fromUrl(source.url,options),base=await t.getImage(),im=await t.getImage(source.ifd);
  assert.equal(im.getWidth(),source.width);assert.equal(im.getHeight(),source.height);assert.deepEqual(base.getOrigin(),source.origin);
  const keys=base.getGeoKeys();assert.ok(keys);assert.equal(keys.GTRasterTypeGeoKey,1);assert.equal(keys.GeogSemiMajorAxisGeoKey,1737400);
  for(const sample of source.samples){if(sample.outside)continue;const values=Array.from(await im.readRasters({window:sample.window,interleave:true}));assert.deepEqual(values,sample.sourceHeightsM);}
 }}finally{globalThis.fetch=previous;}
});

test('audit polar interior heights match original COG interpolation within fixed encoding tolerances',()=>{
 let matched=0;
 for(const source of capture.sources)for(const sample of source.samples){
  if(sample.outside||sample.clampShiftXM||sample.clampShiftYM)continue;
  const grid=source.lod==='overview'?terrain.overview:terrain.patches.find(g=>g.id===source.gridId&&g.lod===source.lod)!;
  assert.equal(grid.heights[sample.index],sample.bundledHeightM);
  assert.ok(Math.abs(grid.heights[sample.index]!-sample.expectedHeightM)<=sample.toleranceM,`${source.lod}: ${sample.errorM}`);matched++;
 }
 assert.equal(matched,13);
});

test('audit retains the demonstrated edge registration failure rather than relaxing its tolerance',()=>{
 const source=capture.sources.find((s:{lod:string})=>s.lod==='fine40'),sample=source.samples.at(-1);
 assert.equal(sample.toleranceM,.0551);assert.ok(sample.errorM>.6);assert.ok(Math.abs(sample.clampedErrorM)<.001);
 assert.ok(Math.hypot(sample.clampShiftXM,sample.clampShiftYM)>11);
 // Green test means the discrepancy is reproduced, not that source acceptance passed.
});

test('audit fresh PDS label agrees byte-for-byte and preserves radius versus height calibration',async()=>{
 const response=responses.find(row=>row.url===metadata.source.labelUrl)!;
 assert.equal(response.sha256,metadata.source.labelSha256);
 const text=Buffer.from(response.bodyBase64,'base64').toString();assert.equal(text,metadata.source.labelText);
 assert.match(text,/HEIGHT = \(DN \* SCALING_FACTOR\)/);assert.match(text,/PLANETARY_RADIUS = \(DN \* SCALING_FACTOR\) \+ OFFSET/);
 const data=await decodeGlobalTerrain(metadata,new Uint8Array(readFileSync('public/data/global-terrain.bin.gz')));
 assert.equal(data.samples.length,3276800);assert.equal(data.heightScaleM,.5);assert.equal(data.heightOffsetM,0);assert.equal(data.radiusM,1737400);
 await assert.rejects(decodeGlobalTerrain(metadata,new Uint8Array([0])),/hash mismatch/);
});

test('audit independent quarter-pixel overlap weights reproduce five global cells from bounded PDS DN rows',async()=>{
 const data=await decodeGlobalTerrain(metadata,new Uint8Array(readFileSync('public/data/global-terrain.bin.gz')));
 for(const sample of capture.globalSamples){
  // Source/output ratio is exactly 9/4. Integer overlap weights avoid using the builder floating-point loop.
  let weighted=0,area=0;
  for(const row of sample.rows)for(let i=0;i<row.dn.length;i++){
   const col=row.col+i,wx=Math.max(0,Math.min(9*(sample.x+1),4*(col+1))-Math.max(9*sample.x,4*col)),wy=Math.max(0,Math.min(9*(sample.y+1),4*(row.row+1))-Math.max(9*sample.y,4*row.row));
   weighted+=row.dn[i]*wx*wy;area+=wx*wy;
  }
  assert.equal(area,81);assert.equal(data.samples[sample.y*data.width+sample.x],Math.round(weighted/area));
 }
 assert.equal(capture.globalSamples.length,5);
});

test('audit source-measured Malapert slope stencil agrees within propagated encoding error only',()=>{
 const source=capture.sources.find((s:{lod:string})=>s.lod==='fine10'),g=terrain.patches.find(g=>g.lod==='fine10'&&g.id===source.gridId)!;
 const mid=Math.floor(g.width/2)+Math.floor(g.height/2)*g.width;
 const sample=(i:number)=>source.samples.find((s:{index:number})=>s.index===i);
 const centre=sample(mid),rho=Math.hypot(centre.xM,centre.yM),lat=(2*Math.atan(rho/(2*1737400))-Math.PI/2)*180/Math.PI,lon=(Math.atan2(centre.xM,centre.yM)*180/Math.PI+360)%360;
 const scale=2/(1-Math.sin(lat*Math.PI/180)),dx=g.stepM,dy=g.stepYM??dx;
 const gradient=Math.hypot((sample(mid+1).expectedHeightM-sample(mid-1).expectedHeightM)/(2*dx),(sample(mid-g.width).expectedHeightM-sample(mid+g.width).expectedHeightM)/(2*dy));
 const expected=Math.atan(gradient*scale)*180/Math.PI,actual=regionalSlope(terrain,null,lat,lon).slopeDeg!;
 const tolerance=Math.hypot(.0551/dx,.0551/dy)*scale*180/Math.PI;
 assert.ok(Math.abs(actual-expected)<=tolerance);
 console.log(JSON.stringify({audit:'source-slope',lat,lon,expectedDeg:expected,actualDeg:actual,errorDeg:actual-expected,toleranceDeg:tolerance,stencilSpacingM:dx/scale}));
});

test('audit global unknown support remains unknown and analytic-sphere rays have explicit discretization error',async()=>{
 const data=await decodeGlobalTerrain(metadata,new Uint8Array(readFileSync('public/data/global-terrain.bin.gz')));
 data.samples.fill(0);data.northPoleM=0;data.southPoleM=0;
 const h=2,expected=-Math.acos(data.radiusM/(data.radiusM+h))*180/Math.PI,result=terrainForGlobal(data,0,0,h),error=Math.max(...result.mask.map(v=>Math.abs(v-expected)));
 // Algorithm-only tolerance for this analytic sphere; no topographic error bound is implied.
 assert.ok(error<.001);console.log(JSON.stringify({audit:'sphere-dip',heightM:h,expectedDeg:expected,maxErrorDeg:error,toleranceDeg:.001}));
 const missing={...data,samples:new Int16Array(data.samples.length).fill(-32768),northPoleM:null,southPoleM:null};
 assert.equal(sampleGlobalHeight(missing,0,0),null);assert.equal(terrainForGlobal(missing,0,0,2).coverage,'unavailable');assert.equal(regionalSlope(null,missing,0,0).slopeDeg,null);
});

test('audit darkness duration keeps stay censoring and unknowns distinct',()=>{
 assert.deepEqual(observedAbsence([false,false,true],1),{hours:2,lowerBound:true,entireWindow:false});
 assert.deepEqual(observedAbsence([true,false,false,true],1),{hours:2,lowerBound:false,entireWindow:false});
 assert.deepEqual(observedAbsence([false,false],1),{hours:2,lowerBound:true,entireWindow:true});
 assert.equal(observedAbsence([false,null],1),null);
});

test('audit ice evidence retains association counts and missing abundance; LCROSS facts match fresh NASA PDF',()=>{
 const ice=parseIceCatalog(json('public/data/ice/catalog.json')),psrs=ice.features.filter(f=>f.evidence==='ice-bearing-psr');
 assert.equal(psrs.length,169);assert.equal(psrs.reduce((s,f)=>s+f.value!,0),820);
 assert.ok(psrs.every(f=>f.unit==='M3 detections'&&f.observationUtc===null&&f.geometry.type==='Point'));
 const impact=ice.features.find(f=>f.evidence==='impact-water-detection')!;
 assert.equal(impact.value,null);assert.equal(impact.unit,null);assert.equal(impact.resolutionM,null);
 const response=responses.find(row=>row.url.includes('20140005563.pdf'))!,original=json('pipeline/ice/source-manifest.json').sources[1].originals[0];
 assert.equal(response.sha256,original.sha256);assert.equal(response.bytes,original.bytes);
 const dir=mkdtempSync(join(tmpdir(),'audit-sources-lcross-'));
 try{const path=join(dir,'source.pdf');writeFileSync(path,Buffer.from(response.bodyBase64,'base64'));const result=spawnSync('pdftotext',['-layout',path,'-'],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/84\.6796/);assert.match(result.stdout,/48\.7093/);assert.match(result.stdout,/11:31:19\.506/);}finally{rmSync(dir,{recursive:true,force:true});}
 // Fresh M3 archive re-extraction is uncertain when the author host returns HTTP 403.
 assert.ok(capture.failures.some((f:{name:string})=>f.name==='lemelin'));
});

test('audit unchanged Python pipeline missing-ray discrepancy remains reproducible',()=>{
 const result=spawnSync('python3',['scripts/audit-sources-pipeline.py'],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 const probe=JSON.parse(result.stdout);assert.equal(probe.unknownRayBecameFinite,true);assert.equal(probe.expectedUnknown,true);assert.equal(probe.fixed,false);
});

test('audit angular horizon interpolation wraps at north and preserves unknown sectors',()=>{
 const mask=new Float64Array([1,3,5,7]);
 assert.equal(horizonAt(mask,90,45),2);assert.equal(horizonAt(mask,90,315),4);assert.equal(horizonAt(mask,90,-45),4);
 mask[1]=NaN;assert.equal(horizonAt(mask,90,0),1);assert.ok(Number.isNaN(horizonAt(mask,90,45)));
 // This only checks interpolation of supplied sectors, not the unsampled true skyline.
});
