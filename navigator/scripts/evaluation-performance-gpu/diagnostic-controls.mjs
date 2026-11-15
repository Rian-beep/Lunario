import * as T from 'three';
// Experiments only; production never patches a Three loader.
export function installDiagnosticControls(record){
const decodeMode=new URL(location.href).searchParams.get('decode');
const eagerDecode=!!decodeMode;
if(eagerDecode){const original=T.TextureLoader.prototype.load;
 T.TextureLoader.prototype.load=function(url,onLoad,onProgress,onError){
 if(decodeMode==='blob'){
  const texture=new T.Texture(),start=performance.now();
  fetch(url).then(r=>r.blob()).then(blob=>createImageBitmap(blob,{imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:'none'})).then(bitmap=>{
   texture.image=bitmap;texture.flipY=false;texture.needsUpdate=true;texture.addEventListener('dispose',()=>bitmap.close());
   record({mode:decodeMode,width:bitmap.width,decodeMs:performance.now()-start});onLoad?.(texture);
  },onError);return texture;
 }
 return original.call(this,url,texture=>{
  const start=performance.now();(decodeMode==='bitmap'?createImageBitmap(texture.image,{imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:'none'}).then(bitmap=>{texture.image=bitmap;texture.flipY=false;texture.addEventListener('dispose',()=>bitmap.close());}):(texture.image).decode()).then(()=>{
   record({mode:decodeMode,width:texture.image.width,decodeMs:performance.now()-start});onLoad?.(texture);
  },onError);
 },onProgress,onError);};
}
}
