import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import * as T from 'three';
import {acquireVisualMoonBitmap} from '../components/workbench/scene/visual-moon/bitmap-atlas';
import {loadVisualMoonTexture,type VisualMoonStatus} from '../components/workbench/scene/visual-moon/assets';
import {VISUAL_MOON} from '../lib/visual-moon';
const tiers=VISUAL_MOON.colour.assets;
const state=():VisualMoonStatus=>({colour:'legacy',width:0,relief:'LOLA 1x',warnings:[]});
const options={bitmapDecode:true,device:{maxTextureSize:8192,textureBudgetMiB:512,maxAnisotropy:8}};
async function until(fn:()=>boolean){for(let n=0;n<1000&&!fn();n++)await delay(1);assert.ok(fn());}
function fixture(t:TestContext){
 const requests:{url:string;signal:AbortSignal;credentials:RequestCredentials}[]=[],decodes:{width:number;closeCount:number;finish:(width?:number,height?:number)=>void;fail:()=>void;options?:ImageBitmapOptions}[]=[];
 t.mock.method(globalThis,'fetch',async (input:RequestInfo|URL,init?:RequestInit)=>{
  const url=String(input),tier=tiers.find(tier=>url.endsWith(tier.url))!;
  requests.push({url,signal:init!.signal!,credentials:init!.credentials!});
  return new Response(new Blob([new Uint8Array(tier.bytes)]));
 });
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'createImageBitmap');
 Object.defineProperty(globalThis,'createImageBitmap',{configurable:true,writable:true,value:async(blob:Blob,options:ImageBitmapOptions)=>new Promise<ImageBitmap>((resolve,reject)=>{
  const tier=tiers.find(tier=>tier.bytes===blob.size)!;
  const decoded={width:tier.width,closeCount:0,options,finish(width=tier.width,height=tier.height){resolve({width,height,close(){decoded.closeCount++;}} as ImageBitmap);},fail(){reject(new Error('decode failed'));}};
  decodes.push(decoded);
 })});
 t.after(()=>{if(descriptor)Object.defineProperty(globalThis,'createImageBitmap',descriptor);else Reflect.deleteProperty(globalThis,'createImageBitmap');});
 return {requests,decodes};
}

test('bitmap leases share one fetch/decode and close exactly once after their last owner',async t=>{
 const f=fixture(t),a=acquireVisualMoonBitmap(tiers[0],4),b=acquireVisualMoonBitmap(tiers[0],8);
 await until(()=>f.decodes.length===1);assert.equal(f.requests.length,1);
 f.decodes[0].finish();assert.equal(await a.ready,await b.ready);
 assert.deepEqual(f.decodes[0].options,{imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:'none'});
 assert.equal(a.texture.flipY,false);assert.equal(f.requests[0].credentials,'omit');
 a.release();a.release();assert.equal(f.decodes[0].closeCount,0);assert.ok(b.texture.image);
 b.release();b.release();assert.equal(f.decodes[0].closeCount,1);assert.equal(b.texture.image,null);
});

test('only one decode runs; cancelled queued work never fetches, and cancelled active work closes its late bitmap',async t=>{
 const f=fixture(t),a=acquireVisualMoonBitmap(tiers[0],4),b=acquireVisualMoonBitmap(tiers[1],4);
 const rejectedA=assert.rejects(a.ready,{name:'AbortError'}),rejectedB=assert.rejects(b.ready,{name:'AbortError'});
 await until(()=>f.decodes.length===1);assert.equal(f.requests.length,1);
 a.release();b.release();await Promise.all([rejectedA,rejectedB]);
 f.decodes[0].finish();await delay(1);assert.equal(f.decodes[0].closeCount,1);assert.equal(f.requests.length,1);
 const c=acquireVisualMoonBitmap(tiers[0],4);await until(()=>f.decodes.length===2);f.decodes[1].finish();await c.ready;c.release();
 assert.equal(f.decodes[1].closeCount,1);
});

test('progressive bitmap path keeps the last tier on failure and transfers lifetime beyond the old signal',async t=>{
 const f=fixture(t),controller=new AbortController(),status=state(),published:T.Texture[]=[];
 const loading=loadVisualMoonTexture(options,controller.signal,status);
 await until(()=>f.decodes.length===1);f.decodes[0].finish();const asset=await loading;t.after(()=>asset.dispose());
 controller.abort();const upgrades=asset.upgrade(texture=>published.push(texture));
 await until(()=>f.decodes.length===2);f.decodes[1].finish();
 await until(()=>f.decodes.length===3);f.decodes[2].fail();await upgrades;
 assert.equal(status.width,2048);assert.equal(published.length,1);assert.equal(status.warnings.length,1);
 assert.equal(published[0].colorSpace,T.SRGBColorSpace);assert.equal(published[0].wrapS,T.RepeatWrapping);
 assert.equal(f.decodes[0].closeCount,1);assert.equal(f.decodes[1].closeCount,0);
 asset.dispose();assert.equal(f.decodes[1].closeCount,1);
});

test('dispose during bitmap decode prevents publish, immediately settles upgrade and closes the late result',async t=>{
 const f=fixture(t),status=state();const loading=loadVisualMoonTexture(options,new AbortController().signal,status);
 await until(()=>f.decodes.length===1);f.decodes[0].finish();const asset=await loading;
 const upgrade=asset.upgrade(()=>assert.fail('disposed texture published'));
 await until(()=>f.decodes.length===2);asset.dispose();await upgrade;
 assert.ok(f.requests[1].signal.aborted);assert.equal(status.warnings.length,0);
 f.decodes[1].finish();await delay(1);assert.equal(f.decodes[1].closeCount,1);
});

test('startup cancellation during bitmap decode rejects immediately without HTML fallback',async t=>{
 const f=fixture(t),controller=new AbortController();
 const loading=loadVisualMoonTexture(options,controller.signal,state());await until(()=>f.decodes.length===1);
 controller.abort();await assert.rejects(loading,{name:'AbortError'});f.decodes[0].finish();await delay(1);
 assert.equal(f.decodes[0].closeCount,1);assert.equal(f.requests.length,1);
});

test('bitmap startup failure falls back conservatively to existing HTML images through 4K',async t=>{
 const f=fixture(t),status=state(),widths:number[]=[];
 t.mock.method(T.TextureLoader.prototype,'load',function(url:string,onLoad?:(texture:T.Texture)=>void){
  const tier=tiers.find(tier=>url===tier.url)!,texture=new T.Texture();widths.push(tier.width);
  texture.image={width:tier.width,height:tier.height};queueMicrotask(()=>onLoad?.(texture));return texture;
 });
 const loading=loadVisualMoonTexture(options,new AbortController().signal,status);
 await until(()=>f.decodes.length===1);f.decodes[0].fail();const asset=await loading;t.after(()=>asset.dispose());
 await asset.upgrade(()=>{});assert.deepEqual(widths,[1024,2048,4096]);assert.equal(f.requests.length,1);
 assert.equal(status.width,4096);assert.match(status.warnings[0],/4096/);
});

test('offline embedding keeps HTML data-image leases and never invokes bitmap fetch/decode',async t=>{
 const f=fixture(t),urls:string[]=[],status=state();
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'window');
 Object.defineProperty(globalThis,'window',{configurable:true,value:{__LUNARIO_VISUAL_MOON__:{textures:Object.fromEntries(tiers.map(tier=>[tier.url,'data:image/webp;base64,'+tier.width]))}}});
 t.after(()=>{if(descriptor)Object.defineProperty(globalThis,'window',descriptor);else Reflect.deleteProperty(globalThis,'window');});
 t.mock.method(T.TextureLoader.prototype,'load',function(url:string,onLoad?:(texture:T.Texture)=>void){
  urls.push(url);const width=Number(url.split(',')[1]),texture=new T.Texture();texture.image={width,height:width/2};queueMicrotask(()=>onLoad?.(texture));return texture;
 });
 const asset=await loadVisualMoonTexture(options,new AbortController().signal,status);t.after(()=>asset.dispose());
 await asset.upgrade(()=>{});assert.equal(status.width,4096);assert.equal(f.requests.length,0);assert.equal(f.decodes.length,0);
 assert.equal(urls.length,3);assert.ok(urls.every(url=>url.startsWith('data:image/webp;base64,')));
});


test('bitmap rejects malformed dimensions and closes the rejected image',async t=>{
 const f=fixture(t),lease=acquireVisualMoonBitmap(tiers[0],4);
 await until(()=>f.decodes.length===1);f.decodes[0].finish(32,16);
 await assert.rejects(lease.ready,/dimensions/);assert.equal(f.decodes[0].closeCount,1);
 lease.release();assert.equal(f.decodes[0].closeCount,1);
});

test('HTTP and encoded-length failures never decode or upload',async t=>{
 const f=fixture(t);
 for(const [response,message] of [[new Response(null,{status:503}),/HTTP 503/],[new Response('bad data'),/encoded length/]] as const){
  t.mock.method(globalThis,'fetch',async()=>response);
  const lease=acquireVisualMoonBitmap(tiers[0],4);await assert.rejects(lease.ready,message);lease.release();
 }
 assert.equal(f.decodes.length,0);
});

test('release aborts active transport and rejects the lease without waiting for the network',async t=>{
 const f=fixture(t);let signal:AbortSignal|undefined;
 t.mock.method(globalThis,'fetch',(_input:RequestInfo|URL,init?:RequestInit)=>new Promise<Response>((_resolve,reject)=>{
  signal=init!.signal!;signal.addEventListener('abort',()=>reject(signal!.reason),{once:true});
 }));
 const lease=acquireVisualMoonBitmap(tiers[0],4),rejected=assert.rejects(lease.ready,{name:'AbortError'});
 lease.release();await rejected;await delay(1);assert.ok(signal?.aborted);assert.equal(f.decodes.length,0);
});

test('unknown bitmap tiers are rejected before allocating or fetching',async t=>{
 const f=fixture(t);assert.throws(()=>acquireVisualMoonBitmap({...tiers[0],url:'/not-a-manifest-tier'},4),/Unknown/);
 assert.equal(f.requests.length,0);
});

test('unsupported bitmap API uses original HTML images with a 4K cap',async t=>{
 const f=fixture(t),status=state(),widths:number[]=[];Reflect.deleteProperty(globalThis,'createImageBitmap');
 t.mock.method(T.TextureLoader.prototype,'load',function(url:string,onLoad?:(texture:T.Texture)=>void){
  const tier=tiers.find(tier=>url===tier.url)!,texture=new T.Texture();widths.push(tier.width);
  texture.image={width:tier.width,height:tier.height};queueMicrotask(()=>onLoad?.(texture));return texture;
 });
 const asset=await loadVisualMoonTexture(options,new AbortController().signal,status);t.after(()=>asset.dispose());
 await asset.upgrade(()=>{});assert.deepEqual(widths,[1024,2048,4096]);assert.equal(f.requests.length,0);
});
