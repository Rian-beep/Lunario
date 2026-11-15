import test from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate} from 'node:timers/promises';
import {gzipSync} from 'node:zlib';
import * as T from 'three';
import {LunarTerrain} from '../../components/workbench/scene/lunar-terrain.js';
import * as detail from '../../components/workbench/scene/south-pole-detail';
import {siteFrame} from '../../components/workbench/scene/surface';

function browserGlobals(href='https://fixture.invalid/lunario/index.html') {
 const originals=['location','document','__LUNARIO_PUBLIC_BASE__'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)] as const);
 Object.defineProperty(globalThis,'location',{configurable:true,value:new URL(href)});
 Object.defineProperty(globalThis,'document',{configurable:true,value:{documentURI:href}});
 globalThis.__LUNARIO_PUBLIC_BASE__='../public/';
 return ()=>{for(const [key,d] of originals)if(d)Object.defineProperty(globalThis,key,d);else Reflect.deleteProperty(globalThis,key);};
}
const manifest={datasets:[{id:'small',width:2,height:2,xMin:0,yMax:1,spacing:1,file:'grid.bin',scale:.5}]};
const bytes=()=>new Int16Array([100,100,100,100]).buffer;
function deferred<V>() {let resolve!:(value:V)=>void;const promise=new Promise<V>(r=>{resolve=r;});return {promise,resolve};}

test('HTTP detail resolves the configured public base; offline never asks for external grids',()=>{
 const restore=browserGlobals();try {
  assert.equal(detail.southPoleManifestUrl(),'https://fixture.invalid/public/data/south-pole-detail/manifest.json');
  assert.equal(detail.southPoleManifestUrl(true),'');
  Object.defineProperty(globalThis,'location',{configurable:true,value:new URL('file:///tmp/solarreach-navigator.html')});
  assert.equal(detail.southPoleManifestUrl(),'');
 } finally {restore();}
});

test('dispose during manifest decoding leaves no metadata, requests, allocation or callbacks',async()=>{
 const restore=browserGlobals(),fetchOriginal=fetch,pendingJSON=deferred<typeof manifest>(),events:unknown[]=[];
 let requests=0;
 const terrain=new LunarTerrain(new T.Scene(),{manifestUrl:'https://fixture.invalid/manifest.json',onStatus:(s:unknown)=>events.push(s)});
 try {
  globalThis.fetch=async()=>{requests++;return {ok:true,json:()=>pendingJSON.promise} as Response;};
  const pending=terrain.init();await setImmediate();terrain.dispose();const count=events.length;
  pendingJSON.resolve(manifest);await pending;
  assert.equal(requests,1);assert.equal(terrain.datasets.length,0);assert.equal(terrain.manifest,null);assert.equal(events.length,count);
 } finally {terrain.dispose();globalThis.fetch=fetchOriginal;restore();}
});

for(const phase of ['grid','mask','stream'] as const)test(`dispose during ${phase} completion cannot recreate DEM values/textures or emit status`,async()=>{
 const restore=browserGlobals(),fetchOriginal=fetch,read=deferred<ArrayBuffer>(),streamRead=deferred<ReadableStreamReadResult<Uint8Array>>(),events:unknown[]=[];
 const terrain=new LunarTerrain(new T.Scene(),{manifestUrl:'https://fixture.invalid/manifest.json',onStatus:(s:unknown)=>events.push(s)});
 let reached=false;
 try {
  globalThis.fetch=async url=>{
   if(String(url).endsWith('manifest.json'))return Response.json({datasets:[{...manifest.datasets[0],...(phase==='mask'?{blendMaskFile:'mask.bin'}:{})}]});
   if(phase==='stream')return {ok:true,headers:new Headers(),body:{getReader:()=>({read:()=>{reached=true;return streamRead.promise;}})}} as unknown as Response;
   if(phase==='grid'||String(url).endsWith('mask.bin'))return {ok:true,headers:new Headers(),body:null,arrayBuffer:()=>{reached=true;return read.promise;}} as Response;
   return new Response(bytes());
  };
  const pending=terrain.init();await setImmediate();assert.ok(reached);
  terrain.dispose();const count=events.length;
  read.resolve(phase==='mask'?new Uint8Array(4).buffer:bytes());streamRead.resolve({done:true,value:undefined});await pending;
  assert.equal(terrain.ready,false);assert.equal(terrain.datasets[0].loaded,false);
  assert.equal(terrain.datasets[0].values,undefined);assert.equal(terrain.datasets[0].heightTexture,undefined);assert.equal(events.length,count);
  assert.equal(terrain._queue.length,0);assert.equal(terrain._loading.size,0);
 } finally {terrain.dispose();globalThis.fetch=fetchOriginal;restore();}
});

test('unchanged lighting does not invalidate shadow field; changed scene Sun is rotated into terrain space',()=>{
 const terrain=new LunarTerrain(new T.Scene());try {
  terrain.setSun(225,28);terrain._shadowDirty=false;terrain.setSun(225,28);assert.equal(terrain._shadowDirty,false);
  const frame=detail.southPoleTerrainMatrix(siteFrame(-89,40,0));
  const sceneDirection=new T.Vector3(.3,-.2,.7).normalize();
  const local=sceneDirection.clone().applyMatrix3(detail.sceneToTerrainRotation(frame));
  terrain.setSunDirection(local);assert.ok(terrain.uniforms.sunDirection.value.distanceTo(local)<1e-12);
  terrain._shadowDirty=false;terrain.setSunDirection(local);terrain.setStyle(terrain.style);assert.equal(terrain._shadowDirty,false);
  terrain.setSunDirection(local.clone().negate());assert.equal(terrain._shadowDirty,true);
 } finally {terrain.dispose();}
});

test('recursive feather provenance weights match actual rendered height, including unavailable fine source fallback',()=>{
 const terrain=new LunarTerrain(new T.Scene());
 const layer=(id:string,spacing:number,height:number,mask?:number)=>({id,name:id,spacing,nativeSpacing:spacing,width:2,height:2,xMin:0,xMax:1,yMin:0,yMax:1,nodata:-32768,scale:1,offset:0,values:new Int16Array(4).fill(height),...(mask===undefined?{}:{blendWeights:new Uint8Array(4).fill(mask)}),loaded:true});
 try {
  terrain._loaded=[layer('fine',2,100,51),layer('regional',20,50,128),layer('overview',150,0)];
  const sample=terrain.getElevation(.5,.5)!;
  assert.deepEqual(sample.contributors.map((c:{dataset:string})=>c.dataset),['fine','regional','overview']);
  assert.ok(Math.abs(sample.contributors.reduce((s:number,c:{weight:number})=>s+c.weight,0)-1)<1e-12);
  assert.ok(Math.abs(sample.elevation-(100*.2+50*.8*128/255))<1e-10);
  assert.equal(sample.effectiveSpacing,150);assert.match(sample.effectiveSource,/overview/);
  terrain._loaded.shift();assert.equal(terrain.getElevation(.5,.5)!.contributors[0].dataset,'regional');
 } finally {terrain.dispose();}
});

test('detail demand excludes all active flights, offline, distant and unrelated inspection',()=>{
 const close={offline:false,showFlight:false,globalSurface:false,navigating:false,geography:{latDeg:-89,lonDeg:0},distanceKm:1,mode:'orbit'};
 assert.equal(detail.wantsSouthPoleDetail(close),true);
 for(const mode of ['orbit','surface','globe','flight','follow','vehicle'])assert.equal(detail.wantsSouthPoleDetail({...close,showFlight:true,mode}),false);
 for(const override of [{offline:true},{globalSurface:true},{navigating:true},{geography:null},{distanceKm:80},{distanceKm:NaN},{geography:{latDeg:0,lonDeg:0}},{mode:'earth'},{mode:'sun'}])assert.equal(detail.wantsSouthPoleDetail({...close,...override}),false);
});

test('imagery manifest and texture completions are inert after disposal',async()=>{
 const restore=browserGlobals(),fetchOriginal=fetch,loadOriginal=T.TextureLoader.prototype.loadAsync;
 const manifestRead=deferred<object>(),textureRead=deferred<T.Texture<HTMLImageElement>>();
 const events:unknown[]=[];
 const terrain=new LunarTerrain(new T.Scene(),{onStatus:(s:unknown)=>events.push(s)});
 try {
  globalThis.fetch=async()=>({ok:true,json:()=>manifestRead.promise}) as Response;
  const first=terrain.loadImagery('https://fixture.invalid/images.json');await setImmediate();terrain.dispose();const count=events.length;
  manifestRead.resolve({tiles:[{id:'late',file:'image.png'}]});await first;
  assert.equal(terrain.imagery,null);assert.equal(terrain.imageTiles.length,0);assert.equal(events.length,count);
  const second=new LunarTerrain(new T.Scene(),{onStatus:(s:unknown)=>events.push(s)});
  try {
   globalThis.fetch=async()=>Response.json({tiles:[{id:'late',file:'image.png',xMin:0,yMax:1,width:2,height:2,spacing:1}]});
   T.TextureLoader.prototype.loadAsync=()=>textureRead.promise;
   const pending=second.loadImagery('https://fixture.invalid/images.json');await setImmediate();second.dispose();const atDispose=events.length;
   const texture=new T.Texture<HTMLImageElement>();let retired=0;texture.addEventListener('dispose',()=>retired++);textureRead.resolve(texture);await pending;
   assert.equal(retired,1);assert.equal(events.length,atDispose);assert.equal(second.imageTiles[0].loaded,false);
  } finally {second.dispose();}
 } finally {terrain.dispose();globalThis.fetch=fetchOriginal;T.TextureLoader.prototype.loadAsync=loadOriginal;restore();}
});

test('failed optional grids report fallback while a failed overview never becomes ready',async()=>{
 const restore=browserGlobals(),fetchOriginal=fetch,terrain=new LunarTerrain(new T.Scene(),{manifestUrl:'https://fixture.invalid/manifest.json'});
 try {
  globalThis.fetch=async url=>String(url).endsWith('manifest.json')?Response.json({...manifest,datasets:[{...manifest.datasets[0],spacing:150},{...manifest.datasets[0],id:'missing-fine',spacing:2,file:'missing.bin'}]}):String(url).endsWith('missing.bin')?new Response('',{status:404}):new Response(bytes());
  await terrain.init();await terrain._loadDataset(terrain.datasets[1]);
  assert.equal(terrain.ready,true);assert.equal(terrain.datasets[1].failed,true);assert.match((terrain.status as {error?:string}).error!,/404/);
  assert.equal(terrain.getElevation(.5,.5)!.effectiveSource,'small');
  const broken=new LunarTerrain(new T.Scene(),{manifestUrl:'https://fixture.invalid/manifest.json'});
  try {globalThis.fetch=async()=>new Response('',{status:404});await assert.rejects(broken.init(),/404/);assert.equal(broken.ready,false);assert.equal(broken.meshes.length,0);}finally{broken.dispose();}
 } finally {terrain.dispose();globalThis.fetch=fetchOriginal;restore();}
});

for(const target of ['grid','mask'])test(`dispose while native ${target} gzip decompression finishes cannot publish resources`,{timeout:10000},async()=>{
 const restore=browserGlobals(),fetchOriginal=fetch,native=Object.getOwnPropertyDescriptor(globalThis,'DecompressionStream')!;
 const Native=globalThis.DecompressionStream,gate=deferred<void>(),entered=deferred<void>();let reached=false;
 const terrain=new LunarTerrain(new T.Scene(),{manifestUrl:'https://fixture.invalid/manifest.json'});
 try {
  // Gate the real native decoded output, after fetch/body has already completed.
  Object.defineProperty(globalThis,'DecompressionStream',{configurable:true,value:class {
   constructor(format:CompressionFormat){
    const decoder=new Native(format);
    return {writable:decoder.writable,readable:decoder.readable.pipeThrough(new TransformStream({async transform(chunk,controller){reached=true;entered.resolve();await gate.promise;controller.enqueue(chunk);}}))};
   }
  }});
  globalThis.fetch=async url=>{
   if(String(url).endsWith('manifest.json'))return Response.json({datasets:[{...manifest.datasets[0],...(target==='mask'?{blendMaskFile:'mask.bin'}:{})}]});
   const payload=String(url).endsWith('mask.bin')?new Uint8Array(4).fill(255):new Uint8Array(bytes());
   return new Response(target==='mask'&&String(url).endsWith('grid.bin')?payload:new Uint8Array(gzipSync(payload)).buffer);
  };
  const pending=terrain.init();await entered.promise;assert.ok(reached);
  terrain.dispose();gate.resolve();await pending;
  assert.equal(terrain.ready,false);assert.equal(terrain.datasets[0].values,undefined);assert.equal(terrain.datasets[0].heightTexture,undefined);
 }finally {gate.resolve();terrain.dispose();Object.defineProperty(globalThis,'DecompressionStream',native);globalThis.fetch=fetchOriginal;restore();}
});
