import * as T from 'three';
import {publicAssetURL} from '@/lib/public-assets';
import {VISUAL_MOON,type VisualMoonTier} from '@/lib/visual-moon';

// Only the four manifest tiers use this lane. One non-cancellable browser decode
// may finish after release; pending work is removed, and its late bitmap is closed.
type Entry={
  tier:VisualMoonTier;texture:T.Texture;ready:Promise<T.Texture>;
  resolve:(texture:T.Texture)=>void;reject:(error:unknown)=>void;
  references:number;controller:AbortController;
};
const entries=new Map<string,Entry>(),queue:Entry[]=[];
let active=false;
const aborted=()=>new DOMException('Visual Moon bitmap released','AbortError');

function pump(){
  if(active)return;
  const entry=queue.shift();if(!entry)return;
  active=true;
  void (async()=>{
    let bitmap:ImageBitmap|undefined;
    try{
      entry.controller.signal.throwIfAborted();
      const response=await fetch(publicAssetURL(entry.tier.url),{signal:entry.controller.signal,credentials:'omit'});
      if(!response.ok)throw new Error(`Visual Moon bitmap HTTP ${response.status}`);
      const blob=await response.blob();
      if(blob.size!==entry.tier.bytes)throw new Error('Visual Moon bitmap encoded length mismatch');
      entry.controller.signal.throwIfAborted();
      // Passing the Blob directly avoids the synchronous HTMLImageElement decode
      // observed during HTML-image upload. Bitmap unpack ignores Texture.flipY.
      bitmap=await createImageBitmap(blob,{imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:'none'});
      entry.controller.signal.throwIfAborted();
      if(bitmap.width!==entry.tier.width||bitmap.height!==entry.tier.height)throw new Error('Visual Moon bitmap dimensions mismatch');
      entry.texture.image=bitmap;bitmap=undefined;
      entry.texture.needsUpdate=true;entry.resolve(entry.texture);
    }catch(error){
      bitmap?.close();entry.reject(error);
    }finally{active=false;pump();}
  })();
}

/** Separate opt-in leases: no shared HTML-image mutation or date-dependent key. */
export function acquireVisualMoonBitmap(tier:VisualMoonTier,maxAnisotropy:number){
  if(!VISUAL_MOON.colour.assets.includes(tier))throw new Error('Unknown visual Moon bitmap tier');
  let entry=entries.get(tier.url);
  if(!entry){
    let resolve!:(texture:T.Texture)=>void,reject!:(error:unknown)=>void;
    const ready=new Promise<T.Texture>((done,fail)=>{resolve=done;reject=fail;});
    const texture=new T.Texture();texture.flipY=false;
    texture.anisotropy=Math.min(8,maxAnisotropy);
    entry={tier,texture,ready,resolve,reject,references:0,controller:new AbortController()};
    entries.set(tier.url,entry);queue.push(entry);pump();
  }
  entry.texture.anisotropy=Math.max(entry.texture.anisotropy,Math.min(8,maxAnisotropy));
  entry.references++;const held=entry;let released=false;
  return {texture:held.texture,ready:held.ready,release(){
    if(released)return;released=true;
    if(--held.references!==0)return;
    if(entries.get(tier.url)===held)entries.delete(tier.url);
    const pending=queue.indexOf(held);if(pending!==-1)queue.splice(pending,1);
    held.controller.abort();held.reject(aborted());
    const bitmap=held.texture.image as ImageBitmap|null;
    held.texture.dispose();held.texture.image=null;bitmap?.close();
  }};
}
