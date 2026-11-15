import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {decodeGlobalTerrain,sampleGlobalHeight,validateGlobalTerrainMetadata,type GlobalTerrainData,type GlobalTerrainMetadata} from '../lib/global-terrain';
import {terrainForGlobal,globalHorizonDistances,GLOBAL_HORIZON_MAX_DISTANCE_M} from '../lib/global-horizon';
const metadata=JSON.parse(readFileSync('public/data/global-terrain.json','utf8')) as GlobalTerrainMetadata;
function fixture(fn:(lat:number,lon:number)=>number=()=>0):GlobalTerrainData{const width=512,height=256,step=360/width,samples=Int16Array.from({length:width*height},(_,i)=>Math.round(fn(90-(Math.floor(i/width)+.5)*step,(i%width+.5)*step)*2));const mean=(row:number)=>Array.from(samples.slice(row*width,(row+1)*width)).reduce((a,b)=>a+b*.5,0)/width;return {...metadata,width,height,angularStepDeg:step,samples,northPoleM:mean(0),southPoleM:mean(height-1),packed:{...metadata.packed,decodedSha256:'fixture-'+createHash('sha256').update(new Uint8Array(samples.buffer)).digest('hex')}};}
test('committed calibrated numerical asset hashes and source label fixtures agree',async()=>{
 const data=await decodeGlobalTerrain(metadata,new Uint8Array(readFileSync('public/data/global-terrain.bin.gz')));
 assert.equal(data.samples.length,2560*1280);assert.equal(createHash('sha256').update(data.source.labelText).digest('hex'),data.source.labelSha256);assert.equal(data.source.frame,'MEAN EARTH/POLAR AXIS OF DE421');assert.match(data.source.labelText,/SCALING_FACTOR\s*= 0.5/);assert.match(data.source.labelText,/OFFSET\s*= 1737400/);assert.match(data.source.labelText,/COORDINATE_SYSTEM_NAME\s*= "MEAN EARTH\/POLAR AXIS OF DE421"/);assert.equal(data.heightScaleM,.5);
 const raw=JSON.parse(readFileSync('public/data/global-terrain.json','utf8'));for(const sample of raw.validation.outputSamples)assert.equal(data.samples[sample.index]*data.heightScaleM,sample.heightM);
 assert.throws(()=>validateGlobalTerrainMetadata({...metadata,heightScaleM:1}),/uncalibrated/);assert.throws(()=>validateGlobalTerrainMetadata({...metadata,radiusM:1000}),/uncalibrated/);
 await assert.rejects(decodeGlobalTerrain(metadata,new Uint8Array([0])),/hash mismatch/);
 const injected=await decodeGlobalTerrain({...metadata,encodedHeights:readFileSync('public/data/global-terrain.bin.gz').toString('base64')});assert.equal(injected.samples[12345],data.samples[12345]);
 assert.ok(Number.isFinite(sampleGlobalHeight(data,0,0)));assert.ok(sampleGlobalHeight(data,0,0)!<11000);assert.ok(sampleGlobalHeight(data,0,0)!> -10000);
});
test('flat spherical skyline agrees with analytic tangent dip within explicit radial discretization bound',()=>{
 const data=fixture(),R=data.radiusM,height=1000,analytic=-Math.acos(R/(R+height))*180/Math.PI;
 const distances=globalHorizonDistances(),theta=Math.acos(R/(R+height)),distance=theta*R;
 const below=[...distances].filter(d=>d<=distance).at(-1)!,above=[...distances].find(d=>d>=distance)!;
 const elevation=(d:number)=>Math.atan2(R*Math.cos(d/R)-(R+height),R*Math.sin(d/R))*180/Math.PI;
 const discretized=Math.max(elevation(below),elevation(above)),result=terrainForGlobal(data,0,0,height);
 for(const value of result.mask){assert.ok(value<=analytic+1e-10);assert.ok(Math.abs(value-discretized)<1e-10);}
 assert.equal(distances[0],1);assert.ok(Math.abs(distances.at(-1)!-GLOBAL_HORIZON_MAX_DISTANCE_M)<1e-8);assert.equal(result.coverage,'partial');assert.equal(result.kind,'global-coarse');assert.equal(result.exact,false);
});
test('known synthetic height bump raises the corresponding eastern ENU horizon',()=>{
 const flat=fixture(),bump=fixture((lat,lon)=>Math.abs(lat)<1&&lon>2&&lon<4?2000:0),a=terrainForGlobal(flat,0,0,2),b=terrainForGlobal(bump,0,0,2);
 assert.ok(b.mask[45]>a.mask[45]);assert.ok(b.mask[45]>0);assert.equal(b.mask[0],a.mask[0]);
});
test('longitude wrap and poles are stable without silently rounding input coordinates',()=>{
 const d=fixture((lat,lon)=>100*Math.sin(lon*Math.PI/180));assert.equal(sampleGlobalHeight(d,0,-180),sampleGlobalHeight(d,0,180));assert.equal(sampleGlobalHeight(d,90,0),sampleGlobalHeight(d,90,140));assert.equal(sampleGlobalHeight(d,-90,-20),sampleGlobalHeight(d,-90,190));
 for(const lat of [-90,90])assert.ok(terrainForGlobal(d,lat,17,2).mask.every(Number.isFinite));
 const a=terrainForGlobal(d,10.00000001,30,2),b=terrainForGlobal(d,10.00000002,30,2);assert.equal(a.cellLat,10.00000001);assert.equal(b.cellLat,10.00000002);
 const c=terrainForGlobal(d,0,-180,2),e=terrainForGlobal(d,0,180,2);assert.deepEqual(c.mask,e.mask);
});
test('missing observer/ray support remains unknown, cache cannot be poisoned by returned masks',()=>{
 const d=fixture();d.samples.fill(d.nodata);d.northPoleM=null;d.southPoleM=null;assert.equal(sampleGlobalHeight(d,0,0),null);assert.equal(terrainForGlobal(d,0,0,2).coverage,'unavailable');
 const rows=fixture();rows.samples.fill(rows.nodata,128*rows.width,129*rows.width);assert.equal(sampleGlobalHeight(rows,0,0),null);
 const known=fixture(),a=terrainForGlobal(known,0,0,2);a.mask.fill(999);assert.ok(terrainForGlobal(known,0,0,2).mask.every(v=>v!==999));
 assert.equal(terrainForGlobal(known,91,0,2).coverage,'unavailable');assert.equal(terrainForGlobal(known,0,0,-1).coverage,'unavailable');assert.equal(terrainForGlobal(known,0,0,NaN).coverage,'unavailable');
});
