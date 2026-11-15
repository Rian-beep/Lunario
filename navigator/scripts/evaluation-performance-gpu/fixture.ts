import * as T from 'three';
import {createNasaGlobe} from '../../components/workbench/scene/nasa-globe';
import {createVisualMoonMaterial} from '../../components/workbench/scene/visual-moon/material';
import {VISUAL_MOON} from '../../lib/visual-moon';

declare global {interface Window {fixture:unknown}}
import {installDiagnosticControls} from './diagnostic-controls.mjs';
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(800,800);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
document.body.appendChild(renderer.domElement);
const scene=new T.Scene(),camera=new T.PerspectiveCamera(34,1,1,20000);
camera.position.set(0,6900,0);camera.up.set(0,0,-1);camera.lookAt(0,0,0);
scene.background=new T.Color(0x030508);
const sun=new T.DirectionalLight(0xffffff,2.5);sun.position.set(4500,6000,3000);
scene.add(sun,new T.AmbientLight(0xffffff,.015));
const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
const textureCalls:{name:string;ms:number}[]=[];
const contextMethods=gl as unknown as Record<string,(...args:unknown[])=>unknown>;
for(const name of ['texImage2D','texSubImage2D','texStorage2D','generateMipmap']){
 const original=contextMethods[name];contextMethods[name]=(...args)=>{
  const start=performance.now();try{return original.apply(gl,args);}finally{textureCalls.push({name,ms:performance.now()-start});}
 };
}
const frames:{t:number;gap:number;renderMs:number;width:number}[]=[],uploads:unknown[]=[],decodes:unknown[]=[];
installDiagnosticControls((record:unknown)=>decodes.push(record));
let orbiting=new URL(location.href).searchParams.has('orbit'),motionStart=performance.now();
let last=performance.now(),running=true,globe:Awaited<ReturnType<typeof createNasaGlobe>>|undefined;
function frame(){if(!running)return;const t=performance.now(),start=t;
 if(orbiting){const angle=(t-motionStart)*.00005;camera.position.set(Math.sin(angle)*6900,Math.cos(angle)*6900,0);camera.lookAt(0,0,0);}
 renderer.render(scene,camera);
 frames.push({t,gap:t-last,renderMs:performance.now()-start,width:globe?.visualStatus.width??0});last=t;requestAnimationFrame(frame);}
requestAnimationFrame(frame);
window.fixture={
 device:{renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):null,maxTextureSize:renderer.capabilities.maxTextureSize},
 async load(bitmapDecode=false){
  const start=performance.now();
  globe=await createNasaGlobe(0,0,0,new AbortController().signal,{
   bitmapDecode,device:{maxTextureSize:8192,textureBudgetMiB:512,maxAnisotropy:renderer.capabilities.getMaxAnisotropy()},
   prepareTexture(texture){const image=texture.image as {width:number;height:number};const start=performance.now(),callStart=textureCalls.length;renderer.initTexture(texture);
    uploads.push({width:image.width,height:image.height,start,end:performance.now(),ms:performance.now()-start,compressed:!!(texture as T.CompressedTexture).isCompressedTexture,calls:textureCalls.slice(callStart)});}
  });globe.mesh.visible=true;scene.add(globe.mesh);motionStart=performance.now();
  return {start,ready:performance.now(),triangles:globe.mesh.geometry.index!.count/3,status:globe.visualStatus};
 },
 state(){return globe?.visualStatus;},
 report(){return {frames,uploads,decodes,memory:{...renderer.info.memory}};},
 async view(lat:number,lon:number,atlas=true){
  orbiting=false;
  const p=lat*Math.PI/180,l=lon*Math.PI/180;
  camera.position.set(Math.cos(p)*Math.sin(l)*6900,Math.cos(p)*Math.cos(l)*6900,-Math.sin(p)*6900);
  camera.up.set(0,0,-1);if(Math.abs(lat)>89.5)camera.up.set(0,1,0);
  camera.lookAt(0,0,0);globe!.setAtlasAppearance(atlas);renderer.render(scene,camera);
  const pixels=new Uint8Array(800*800*4);gl.readPixels(0,0,800,800,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  const digest=await crypto.subtle.digest('SHA-256',pixels);
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 },
 landmarks(){
  const appearance=createVisualMoonMaterial(globe!.mesh.material.map,true),geometry=new T.PlaneGeometry(2,2);
  const probeScene=new T.Scene(),probeCamera=new T.OrthographicCamera(-1,1,1,-1,.1,10);probeCamera.position.z=2;
  probeScene.add(new T.Mesh(geometry,appearance.material));
  const results=VISUAL_MOON.colour.calibration.map(sample=>{
   const [x,y]=sample.pixel,lon=((x+.5)/8192-.5)*2*Math.PI,lat=(.5-(y+.5)/4096)*Math.PI;
   const direction=[Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)];
   geometry.setAttribute('bodyDirection',new T.Float32BufferAttribute([...direction,...direction,...direction,...direction],3));
   renderer.render(probeScene,probeCamera);const pixel=new Uint8Array(4);gl.readPixels(400,400,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
   return {pixel:sample.pixel,expected:sample.runtimeRgb8,actual:Array.from(pixel).slice(0,3)};
  });geometry.dispose();appearance.material.dispose();return results;
 },
 async decode(mode:'main'|'worker',width:number){
  const tier=VISUAL_MOON.colour.assets.find(t=>t.width===width)!;
  const fetchStart=performance.now(),blob=await (await fetch(tier.url)).blob(),fetched=performance.now();
  if(mode==='main'){
   const start=performance.now(),bitmap=await createImageBitmap(blob,{imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:'none'});
   const result={mode,width,fetchMs:fetched-fetchStart,decodeMs:performance.now()-start,wallMs:performance.now()-fetchStart};bitmap.close();decodes.push(result);return result;
  }
  const code=`onmessage=async e=>{const start=performance.now();const b=await createImageBitmap(e.data,{imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:'none'});postMessage({bitmap:b,ms:performance.now()-start},[b]);}`;
  const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'})),worker=new Worker(url);
  try {return await new Promise((resolve,reject)=>{worker.onerror=reject;worker.onmessage=e=>{
   e.data.bitmap.close();const result={mode,width,fetchMs:fetched-fetchStart,decodeMs:e.data.ms,wallMs:performance.now()-fetchStart};decodes.push(result);resolve(result);
  };worker.postMessage(blob);});}finally{worker.terminate();URL.revokeObjectURL(url);}
 },
 dispose(){globe?.dispose();if(globe)scene.remove(globe.mesh);renderer.render(scene,camera);running=false;
  return {...renderer.info.memory};}
};
