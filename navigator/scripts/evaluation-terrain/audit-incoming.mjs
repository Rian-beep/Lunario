import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {Group,PerspectiveCamera} from 'three';
import {LunarTerrain} from '../../components/workbench/scene/lunar-terrain.js';
const manifest=JSON.parse(fs.readFileSync('public/data/south-pole-detail/manifest.json','utf8'));
const grids=manifest.datasets.map(d=>{
 const compressed=fs.readFileSync(`public/data/south-pole-detail/${d.file}`),raw=gunzipSync(compressed);
 let nodata=0,min=Infinity,max=-Infinity;for(let i=0;i<raw.length;i+=2){const n=raw.readInt16LE(i);if(n===d.nodata)nodata++;else{const h=n*d.scale+d.offset;min=Math.min(min,h);max=Math.max(max,h);}}
 const row={id:d.id,width:d.width,height:d.height,spacing:d.spacing,nativeSpacing:d.nativeSpacing,
  bytes:compressed.length,decodedBytes:raw.length,sha256:createHash('sha256').update(compressed).digest('hex'),nodata,minM:min,maxM:max,
  countMatches:raw.length===d.width*d.height*2&&nodata===d.nodataSamples,hashMatches:createHash('sha256').update(compressed).digest('hex')===d.sha256,
  registrationMatches:d.xMax===d.xMin+(d.width-1)*d.spacing&&d.yMin===d.yMax-(d.height-1)*d.spacing};
 if(d.blendMaskFile){const b=fs.readFileSync(`public/data/south-pole-detail/${d.blendMaskFile}`),mask=gunzipSync(b);row.blendMask={bytes:b.length,decodedBytes:mask.length,hashMatches:createHash('sha256').update(b).digest('hex')===d.blendMaskSha256};}
 return row;
});
const previousFetch=globalThis.fetch,previousLocation=globalThis.location,requests=[];
globalThis.location=new URL('https://fixture.invalid/lunario/index.html');
globalThis.fetch=async url=>{requests.push(String(url));const p=new URL(url,location).pathname;
 if(p.endsWith('/manifest.json'))return Response.json(manifest);
 return new Response(fs.readFileSync(`public/data/south-pole-detail/${p.split('/').at(-1)}`));};
const terrain=new LunarTerrain(new Group(),{manifestUrl:'https://fixture.invalid/lunario/data/south-pole-detail/manifest.json',quality:'high',viewportHeight:()=>900});
try{
 await terrain.init();const startupRequests=[...requests];
 for(const data of terrain.datasets)await terrain._loadDataset(data);
 const target=terrain.toWorld(-3000,-7000),camera=new PerspectiveCamera(43,16/9,.0005,18000);
 camera.position.copy(target).addScaledVector(target.clone().add({x:0,y:1737.4,z:0}).normalize(),1);camera.up.set(0,0,-1);camera.lookAt(target);camera.updateMatrixWorld(true);
 terrain._focus.copy(target);terrain._plan(camera,target);
 const nodes=terrain._pending.nodes;
 const nearby=nodes.filter(n=>n.xMin<=-2000&&n.xMax>=-4000&&n.yMin<=-6000&&n.yMax>=-8000);
 const roundTrips=[[-3000,-7000],[-153600,153600],[0,0]].map(([x,y])=>{const p=terrain.toWorld(x,y,1200),r=terrain.fromWorld(p);return{x,y,errorXYM:Math.hypot(r.x-x,r.y-y),errorHeightM:r.elevation-1200};});
 const seams=[];
 let blendedSample=null;
 const stereo=terrain._loaded.find(d=>d.blendWeights);
 for(let i=0;i<stereo.blendWeights.length&&!blendedSample;i++){
  if(stereo.blendWeights[i]===0||stereo.blendWeights[i]===255)continue;
  const x=stereo.xMin+(i%stereo.width)*stereo.spacing,y=stereo.yMax-Math.floor(i/stereo.width)*stereo.spacing;
  const s=terrain._sample(x,y);if(s?.data===stereo&&s.blendWeight<1)blendedSample={x,y,sourceM:terrain._height(stereo,x,y),underlayM:terrain._sample(x,y,1)?.elevation,weight:s.blendWeight,inspection:terrain.getElevation(x,y)};
 }
 for(const d of terrain._loaded.filter(d=>!d.blendMaskFile&&d.spacing<150)){
  for(const [x,y] of [[d.xMin,(d.yMin+d.yMax)/2],[d.xMax,(d.yMin+d.yMax)/2],[(d.xMin+d.xMax)/2,d.yMin],[(d.xMin+d.xMax)/2,d.yMax]]){
   const finer=terrain._height(d,x,y),under=terrain._sample(x,y,terrain._loaded.indexOf(d)+1);if(finer!==null&&under)seams.push({id:d.id,x,y,layerStepM:finer-under.elevation});
  }
 }
 const result={sourceCommit:'3c82b5aa02c4da52053fd3c12c180cca18fd6d4e',grids,startupRequests,totalCompressedDemBytes:grids.reduce((n,g)=>n+g.bytes,0),
  imageryManifestPresent:fs.existsSync('public/data/south-pole-detail/'+manifest.imageryManifest),blendedSample,
  lod1km:{focus:{x:-3000,y:-7000},tiles:nodes.length,nearbyTiles:nearby.length,nearbySpacingsM:[...new Set(nearby.map(n=>n.step))].sort((a,b)=>a-b),minSpacingM:Math.min(...nodes.map(n=>n.step)),triangles:nodes.length*(64*64*2+256*2)},roundTrips,seams};
 console.log(JSON.stringify(result,null,2));
}finally{terrain.dispose();globalThis.fetch=previousFetch;globalThis.location=previousLocation;}
