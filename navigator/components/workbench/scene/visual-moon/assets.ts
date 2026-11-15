import * as T from 'three';
import {acquireVisualMoonBitmap} from './bitmap-atlas';
import {acquireMoonAtlas,waitForMoonAtlas} from '@/lib/moon-atlas-texture';
import {publicAssetURL} from '@/lib/public-assets';
import {decodeVisualMoonRadii,VISUAL_MOON,visualMoonTiers,type VisualMoonDevice} from '@/lib/visual-moon';

declare global {
  interface Window {
    __LUNARIO_VISUAL_MOON__?: {radiiGzipBase64:string;textures:Record<string,string>};
  }
}
export type VisualMoonOptions = {
  device:VisualMoonDevice;
  /** Web-only opt-in: decode the unchanged WebP Blob asynchronously before upload.
   * Unsupported browsers retain HTML images through 4K; embedded offline stays unchanged. */
  bitmapDecode?:boolean;
  /** Optional pre-upload on the owning renderer, before a progressive map swap. */
  prepareTexture?:(texture:T.Texture)=>void;
};
export type VisualMoonStatus = {colour:'legacy'|'NASA 2025'|'unavailable';width:number;relief:'authored'|'LOLA 1x';warnings:string[]};

let radiiCache:Promise<Float32Array>|undefined;
export async function loadVisualMoonRadii(vertexCount:number,signal:AbortSignal) {
  signal.throwIfAborted();
  radiiCache??=(async()=>{
    const embedded=typeof window!=='undefined'?window.__LUNARIO_VISUAL_MOON__:undefined;
    let compressed:Uint8Array;
    if(embedded){compressed=Uint8Array.from(atob(embedded.radiiGzipBase64),c=>c.charCodeAt(0));}
    else {
      const response=await fetch(publicAssetURL(VISUAL_MOON.relief.url));
      if(!response.ok)throw new Error(`Visual Moon relief HTTP ${response.status}`);
      compressed=new Uint8Array(await response.arrayBuffer());
    }
    if(compressed.byteLength!==VISUAL_MOON.relief.bytes)throw new Error('Visual Moon relief compressed length mismatch');
    const decoded=await new Response(new Blob([compressed as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    return decodeVisualMoonRadii(decoded,VISUAL_MOON.relief.vertexCount);
  })().catch(error=>{radiiCache=undefined;throw error;});
  // One bounded shared fetch/decode may finish after a consumer cancels.
  return new Promise<Float32Array>((resolve,reject)=>{
    const abort=()=>{signal.removeEventListener('abort',abort);reject(signal.reason);};
    signal.addEventListener('abort',abort,{once:true});
    radiiCache!.then(value=>{signal.removeEventListener('abort',abort);if(signal.aborted){reject(signal.reason);return;}
      if(value.length!==vertexCount){reject(new Error('Visual Moon mesh identity mismatch'));return;}resolve(value);
    },error=>{signal.removeEventListener('abort',abort);reject(error);});
  });
}

/** Owns every progressive lease; no date/camera operation starts a request. */
export async function loadVisualMoonTexture(options:VisualMoonOptions,signal:AbortSignal,status:VisualMoonStatus) {
  let tiers=visualMoonTiers(options.device);
  if(!tiers.length)throw new Error('No NASA 2025 texture fits the device budget');
  const urlFor=(url:string)=>{
    const embedded=typeof window!=='undefined'?window.__LUNARIO_VISUAL_MOON__:undefined;
    if(!embedded)return url;
    const data=embedded.textures[url];
    if(!data?.startsWith('data:image/webp;base64,'))throw new Error('Embedded visual Moon tier unavailable');
    return data;
  };
  const embedded=typeof window!=='undefined'&&window.__LUNARIO_VISUAL_MOON__;
  let useBitmap=options.bitmapDecode&&typeof createImageBitmap==='function'&&!embedded;
  if(options.bitmapDecode&&!useBitmap){
    tiers=tiers.filter(tier=>tier.width<=4096);
    if(!embedded)status.warnings.push('Asynchronous colour decode unsupported; using HTML images through 4096px');
  }
  const acquire=(tier:typeof tiers[number])=>useBitmap
    ?acquireVisualMoonBitmap(tier,options.device.maxAnisotropy)
    :acquireMoonAtlas(urlFor(tier.url),Math.min(8,options.device.maxAnisotropy));
  const verify=(texture:T.Texture,tier:typeof tiers[number])=>{
    const image=texture.image as {width:number;height:number}|undefined;
    if(image?.width!==tier.width||image?.height!==tier.height)throw new Error('Visual Moon primary texture dimensions mismatch');
    texture.colorSpace=T.SRGBColorSpace;texture.wrapS=T.RepeatWrapping;texture.wrapT=T.ClampToEdgeWrapping;
    texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;texture.generateMipmaps=true;
    options.prepareTexture?.(texture);
  };
  let current=acquire(tiers[0]);
  try {await waitForMoonAtlas(current,signal);signal.throwIfAborted();verify(current.texture,tiers[0]);}
  catch(error){
    current.release();signal.throwIfAborted();
    if(!useBitmap)throw error;
    status.warnings.push('Asynchronous colour decode unavailable; using HTML images through 4096px');
    useBitmap=false;tiers=tiers.filter(tier=>tier.width<=4096);current=acquire(tiers[0]);
    try{await waitForMoonAtlas(current,signal);signal.throwIfAborted();verify(current.texture,tiers[0]);}
    catch(fallbackError){current.release();throw fallbackError;}
  }
  status.colour='NASA 2025';status.width=tiers[0].width;
  const lifetime=new AbortController();
  let pending:ReturnType<typeof acquire>|undefined,disposed=false,started=false;
  return {texture:current.texture,
    async upgrade(publish:(texture:T.Texture)=>void){
      if(started||disposed)return;started=true;
      for(const tier of tiers.slice(1)){
        if(disposed)return;
        // Yield between levels; the caller can render the already-ready lower tier.
        await new Promise(resolve=>setTimeout(resolve,0));
        if(disposed)return;
        try {
          const lease=acquire(tier);pending=lease;
          const texture=await waitForMoonAtlas(lease,lifetime.signal);
          if(disposed){lease.release();pending=undefined;return;}
          verify(texture,tier);publish(texture);
          const previous=current;current=pending;pending=undefined;previous.release();
          status.width=tier.width;
        }catch(error){pending?.release();pending=undefined;
          if(!disposed)status.warnings.push(`Retained ${status.width}px colour tier: ${error instanceof Error?error.message:String(error)}`);
          return;
        }
      }
    },
    dispose(){if(disposed)return;disposed=true;lifetime.abort();pending?.release();pending=undefined;current.release();},
  };
}
