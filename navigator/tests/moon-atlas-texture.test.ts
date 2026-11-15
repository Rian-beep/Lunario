import {test} from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {acquireMoonAtlas} from '../lib/moon-atlas-texture';
test('globe and local surface share one GPU texture and last-owner release retires it exactly once',async()=>{
 const original=T.TextureLoader.prototype.load;let loads=0,disposals=0;
 T.TextureLoader.prototype.load=function(_url,onLoad){loads++;const texture=new T.Texture<HTMLImageElement>();texture.addEventListener('dispose',()=>disposals++);queueMicrotask(()=>{texture.image={width:8,height:8} as HTMLImageElement;onLoad?.(texture);});return texture;};
 try{const a=acquireMoonAtlas('test-atlas',4),b=acquireMoonAtlas('test-atlas',16);assert.equal(loads,1);assert.equal(a.texture,b.texture);assert.equal(a.texture.anisotropy,8);assert.equal(await a.ready,await b.ready);a.release();a.release();assert.equal(disposals,0);b.release();assert.equal(disposals,1);const c=acquireMoonAtlas('test-atlas',1);assert.equal(loads,2);await c.ready;c.release();assert.equal(disposals,2);}finally{T.TextureLoader.prototype.load=original;}
});
test('early release settles the pending request, clears late decoded image, and allows retry',async()=>{
 const original=T.TextureLoader.prototype.load;let finish:(()=>void)|undefined,disposals=0;
 T.TextureLoader.prototype.load=function(_url,onLoad){const texture=new T.Texture<HTMLImageElement>();texture.addEventListener('dispose',()=>disposals++);finish=()=>{texture.image={width:16,height:16} as HTMLImageElement;onLoad?.(texture);};return texture;};
 try{const a=acquireMoonAtlas('aborted-atlas',4);const rejected=assert.rejects(a.ready,{name:'AbortError'});a.release();await rejected;finish!();assert.equal(a.texture.image,null);assert.equal(disposals,1);}finally{T.TextureLoader.prototype.load=original;}
});
test('failed request cannot poison the next attempt or dispose another owner',async()=>{
 const original=T.TextureLoader.prototype.load;let loads=0;
 T.TextureLoader.prototype.load=function(_url,onLoad,_progress,onError){loads++;const texture=new T.Texture<HTMLImageElement>();if(loads===1)queueMicrotask(()=>onError?.(new Error('source unavailable')));else queueMicrotask(()=>{texture.image={width:8,height:8} as HTMLImageElement;onLoad?.(texture);});return texture;};
 try{const a=acquireMoonAtlas('retry-atlas',4);await assert.rejects(a.ready,/source unavailable/);const b=acquireMoonAtlas('retry-atlas',4);await b.ready;assert.notEqual(a.texture,b.texture);a.release();const c=acquireMoonAtlas('retry-atlas',4);assert.equal(b.texture,c.texture);b.release();c.release();}finally{T.TextureLoader.prototype.load=original;}
});
test('synchronous image-loader failure is an owned rejected lease, not an unhandled null texture',async()=>{
 const original=T.TextureLoader.prototype.load;T.TextureLoader.prototype.load=function(){throw Error('decoder setup failed');};
 try{const lease=acquireMoonAtlas('throws-atlas',4);await assert.rejects(lease.ready,/decoder setup failed/);assert.ok(lease.texture.isTexture);lease.release();lease.release();}finally{T.TextureLoader.prototype.load=original;}
});
test('aborting a stalled globe lease settles immediately while a surface owner retains the shared texture',async()=>{
 const {waitForMoonAtlas}=await import('../lib/moon-atlas-texture');
 const original=T.TextureLoader.prototype.load;let disposals=0,finish:(()=>void)|undefined;
 T.TextureLoader.prototype.load=function(_url,onLoad){const texture=new T.Texture<HTMLImageElement>();texture.addEventListener('dispose',()=>disposals++);finish=()=>{texture.image={width:8,height:8} as HTMLImageElement;onLoad?.(texture);};return texture;};
 try{const surface=acquireMoonAtlas('stall-owner',8);surface.ready.catch(()=>{});const globe=acquireMoonAtlas('stall-owner',4),controller=new AbortController();const pending=waitForMoonAtlas(globe,controller.signal);controller.abort();await assert.rejects(pending,{name:'AbortError'});assert.equal(disposals,0);surface.release();assert.equal(disposals,1);finish!();assert.equal(surface.texture.image,null);globe.release();assert.equal(disposals,1);}finally{T.TextureLoader.prototype.load=original;}
});
test('already-aborted and successfully loaded globe leases remove their abort subscription safely',async()=>{
 const {waitForMoonAtlas}=await import('../lib/moon-atlas-texture');const original=T.TextureLoader.prototype.load;
 T.TextureLoader.prototype.load=function(_url,onLoad){const texture=new T.Texture<HTMLImageElement>();queueMicrotask(()=>{texture.image={width:8,height:8} as HTMLImageElement;onLoad?.(texture);});return texture;};
 try{const aborted=new AbortController();aborted.abort();await assert.rejects(waitForMoonAtlas(acquireMoonAtlas('already-aborted',4),aborted.signal),{name:'AbortError'});const controller=new AbortController(),lease=acquireMoonAtlas('loaded-signal',4);assert.equal(await waitForMoonAtlas(lease,controller.signal),lease.texture);controller.abort();assert.ok(lease.texture.image!==null);lease.release();}finally{T.TextureLoader.prototype.load=original;}
});
