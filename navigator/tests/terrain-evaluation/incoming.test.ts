import test from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate} from 'node:timers/promises';
import {Group} from 'three';
import {LunarTerrain} from '../../components/workbench/scene/lunar-terrain.js';
import {southPoleManifestUrl} from '../../components/workbench/scene/south-pole-detail';
import {existsSync,readFileSync} from 'node:fs';

const fixture={datasets:[{id:'small',width:2,height:2,xMin:0,yMax:1,spacing:1,file:'grid.bin',scale:.5}]};

test('incoming URL reproducer: hosted subpath escapes its base and file mode needs external files',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'location');
 try{
  Object.defineProperty(globalThis,'location',{configurable:true,value:new URL('https://fixture.invalid/lunario/index.html')});
  assert.equal(new URL(southPoleManifestUrl(),location.href).pathname,'/data/south-pole-detail/manifest.json');
  Object.defineProperty(globalThis,'location',{configurable:true,value:new URL('file:///tmp/solarreach-navigator.html')});
  assert.equal(southPoleManifestUrl(),'file:///tmp/data/south-pole-detail/manifest.json');
 }finally{if(descriptor)Object.defineProperty(globalThis,'location',descriptor);else Reflect.deleteProperty(globalThis,'location');}
});

test('incoming late-completion reproducer: disposed terrain reacquires a height texture',async()=>{
 const nativeFetch=globalThis.fetch,descriptor=Object.getOwnPropertyDescriptor(globalThis,'location');
 let finish!:(buffer:ArrayBuffer)=>void;
 const events:unknown[]=[];
 const terrain=new LunarTerrain(new Group(),{manifestUrl:'https://fixture.invalid/manifest.json',onStatus:(s:unknown)=>events.push(s)});
 try{
  Object.defineProperty(globalThis,'location',{configurable:true,value:new URL('https://fixture.invalid/')});
  globalThis.fetch=async url=>String(url).endsWith('manifest.json')?Response.json(fixture):({ok:true,body:null,headers:new Headers(),arrayBuffer:()=>new Promise<ArrayBuffer>(resolve=>{finish=resolve;})} as Response);
  const pending=terrain.init();await setImmediate();assert.ok(finish);
  terrain.dispose();const count=events.length;finish(new Int16Array([100,100,100,100]).buffer);await pending;
  assert.equal(terrain.ready,false);
  assert.equal(terrain.datasets[0].loaded,true,'observed defect: load continuation marks disposed data loaded');
  assert.ok(terrain.datasets[0].heightTexture,'observed defect: texture created after dispose');
  assert.ok(events.length>count,'observed defect: status callback runs after dispose');
 }finally{terrain.datasets[0]?.heightTexture?.dispose();globalThis.fetch=nativeFetch;if(descriptor)Object.defineProperty(globalThis,'location',descriptor);else Reflect.deleteProperty(globalThis,'location');}
});

test('incoming manifest advertises an imagery manifest absent from this checkout',()=>{
 const manifest=JSON.parse(readFileSync('public/data/south-pole-detail/manifest.json','utf8'));
 assert.equal(manifest.imageryManifest,'imagery/manifest.json');
 assert.equal(existsSync('public/data/south-pole-detail/'+manifest.imageryManifest),false);
});
