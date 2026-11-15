/** Isolated fixture: intercepted HTTP transport, private Chromium, no app server. */
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';

const output=resolve(process.argv[2]??'/tmp/lunario-visual-moon-browser');await mkdir(output,{recursive:true});
const requestedWidth=Number(process.argv[3]??4096),textureBudgetMiB=Number(process.argv[4]??128);
assert.ok([1024,2048,4096,8192].includes(requestedWidth));assert.ok(textureBudgetMiB>0);
const entry=`
import * as T from 'three';
import {createNasaGlobe} from './components/workbench/scene/nasa-globe';
import {createVisualMoonMaterial} from './components/workbench/scene/visual-moon/material';
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(800,800);renderer.setPixelRatio(1);
renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
document.body.appendChild(renderer.domElement);const scene=new T.Scene(),camera=new T.PerspectiveCamera(34,1,1,20000);
scene.background=new T.Color(0x030508);let globe;
const sun=new T.DirectionalLight(0xffffff,2.5);sun.position.set(4500,6000,3000);scene.add(sun);scene.add(new T.AmbientLight(0xffffff,.015));
window.fixture={
 memory(){renderer.render(new T.Scene(),camera);return {...renderer.info.memory};},
 async load(upgraded=true,limitTexture=false){globe?.dispose();if(globe)scene.remove(globe.mesh);const started=performance.now();
  globe=await createNasaGlobe(0,0,0,new AbortController().signal,upgraded?{
   device:{maxTextureSize:limitTexture?512:Math.min(renderer.capabilities.maxTextureSize,${requestedWidth}),textureBudgetMiB:${textureBudgetMiB},maxAnisotropy:renderer.capabilities.getMaxAnisotropy()},
   prepareTexture(texture){renderer.initTexture(texture);}
  }:undefined);globe.mesh.visible=true;scene.add(globe.mesh);this.view(0,0,true);
  return {ms:performance.now()-started,status:globe.visualStatus,triangles:globe.mesh.geometry.index.count/3,
   maxRadiusKm:globe.maxRadiusKm,maxTextureSize:renderer.capabilities.maxTextureSize};},
 status(){return {...globe.visualStatus,width:globe.mesh.material.map?.image?.width??0,space:globe.mesh.material.map?.colorSpace,
   textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries};},
 stability(lat,lon){
  const gl=renderer.getContext(),read=()=>{const pixels=new Uint8Array(800*800*4);gl.readPixels(0,0,800,800,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;};
  this.view(lat,lon,false);const a=read();this.view(lat,lon,false);const b=read();this.view(lat,lon+.01,false);const c=read();
  let repeated=0,moved=0;for(let i=0;i<a.length;i++)if(i%4!==3){repeated+=Math.abs(a[i]-b[i]);moved+=Math.abs(b[i]-c[i]);}
  return {repeatMeanCodeDelta:repeated/(800*800*3),orbitMeanCodeDelta:moved/(800*800*3),orbitStepDeg:.01};
 },
 view(lat,lon,atlas=true){
  const p=lat*Math.PI/180,l=lon*Math.PI/180;
  const direction=new T.Vector3(Math.cos(p)*Math.sin(l),Math.cos(p)*Math.cos(l),-Math.sin(p));
  camera.position.copy(direction.multiplyScalar(6900));camera.up.set(0,0,-1);if(Math.abs(lat)>89.5)camera.up.set(0,1,0);
  camera.lookAt(0,0,0);globe.setAtlasAppearance(atlas);renderer.render(scene,camera);
 },
 colourProbe(){
  const tex=new T.DataTexture(new Uint8Array([209,160,90,255]),1,1);tex.colorSpace=T.SRGBColorSpace;tex.needsUpdate=true;
  const appearance=createVisualMoonMaterial(tex,true),g=new T.PlaneGeometry(2,2);
  g.setAttribute('bodyDirection',new T.Float32BufferAttribute([1,0,0,1,0,0,1,0,0,1,0,0],3));
  const s=new T.Scene(),mesh=new T.Mesh(g,appearance.material);s.add(mesh);const c=new T.OrthographicCamera(-1,1,1,-1,.1,10);c.position.z=2;
  renderer.render(s,c);const pixel=new Uint8Array(4);renderer.getContext().readPixels(400,400,1,1,renderer.getContext().RGBA,renderer.getContext().UNSIGNED_BYTE,pixel);
  tex.dispose();g.dispose();appearance.material.dispose();return Array.from(pixel);
 },
 dispose(){globe.dispose();scene.remove(globe.mesh);renderer.render(scene,camera);return {textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries};}
};`;
const compiled=await build({stdin:{contents:entry,loader:'ts',resolveDir:process.cwd()},bundle:true,write:false,format:'iife',platform:'browser'});
const browser=await chromium.launch({executablePath:'/opt/google/chrome/chrome',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:800,height:800},deviceScaleFactor:1});
const requests=[],errors=[];page.on('pageerror',error=>errors.push(String(error)));page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
await page.route('http://visual-moon.test/**',async route=>{
 const path=new URL(route.request().url()).pathname;requests.push(path);
 if(path==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><style>body{margin:0;background:#030508}canvas{display:block}</style><body><script src="/fixture.js"></script></body>'});
 if(path==='/fixture.js')return route.fulfill({contentType:'text/javascript',body:compiled.outputFiles[0].text});
 if(!/^\/data\/[a-zA-Z0-9/_.-]+$/.test(path)||path.includes('..'))return route.abort();
 const contentType={'.json':'application/json','.webp':'image/webp','.jpg':'image/jpeg','.gz':'application/gzip'}[extname(path)];
 try{return await route.fulfill({contentType,body:await readFile(resolve('public',path.slice(1)))});}catch{return route.fulfill({status:404,body:'missing fixture asset'});}
});
try {
 await page.goto('http://visual-moon.test/');await page.waitForFunction(()=>window.fixture);
 const probe=await page.evaluate(()=>window.fixture.colourProbe());assert.deepEqual(probe,[209,160,90,255],'actual custom shader preserves sRGB code values through GPU decode/output');
 const baselineMemory=await page.evaluate(()=>window.fixture.memory());
 const loaded=await page.evaluate(()=>window.fixture.load(true));assert.equal(loaded.triangles,1015808);assert.equal(loaded.status.relief,'LOLA 1x');
 await page.waitForFunction(width=>window.fixture.status().width===width,Math.min(loaded.maxTextureSize,requestedWidth),{timeout:120000});
 const state=await page.evaluate(()=>window.fixture.status());assert.equal(state.space,'srgb');assert.equal(state.colour,'NASA 2025');
 for(const [name,lat,lon,atlas] of [['near-side',0,0,true],['far-side',0,180,true],['south-pole',-89.9,0,true],['south-pole-epoch',-89.9,0,false],['seam-minus',0,179.9,true],['seam-plus',0,-179.9,true]]){
  await page.evaluate(([lat,lon,atlas])=>window.fixture.view(lat,lon,atlas),[lat,lon,atlas]);
  await page.screenshot({path:resolve(output,name+'.png')});
 }
 const before=requests.length;
 const stability=await page.evaluate(()=>({seam:window.fixture.stability(0,179.999),pole:window.fixture.stability(-89.9,0)}));
 for(const check of Object.values(stability)){assert.equal(check.repeatMeanCodeDelta,0);assert.ok(check.orbitMeanCodeDelta<2,'small orbit cannot cause a whole-frame shading jump');}
 await page.evaluate(()=>{for(let i=0;i<24;i++)window.fixture.view(-85+i*.01,170+i*.02,i%2===0);});
 assert.equal(requests.length,before,'date/appearance/camera updates cannot refetch textures');
 const disposal=await page.evaluate(()=>window.fixture.dispose());console.log({baselineMemory,disposal,state});
 assert.equal(disposal.textures,baselineMemory.textures);assert.equal(disposal.geometries,baselineMemory.geometries);
 const legacy=await page.evaluate(()=>window.fixture.load(false));
 await page.evaluate(()=>window.fixture.view(-89.9,0,false));await page.screenshot({path:resolve(output,'legacy-south-pole-epoch.png')});
 await page.evaluate(()=>window.fixture.dispose());
 const beforeFallback=requests.length,fallback=await page.evaluate(()=>window.fixture.load(true,true));
 assert.equal(fallback.status.colour,'unavailable');assert.equal(fallback.status.width,0);
 assert.equal(requests.slice(beforeFallback).filter(url=>/\.(webp|jpg)$/.test(url)).length,0,'unsupported device must not fall back to an oversized primary texture');
 await page.evaluate(()=>{window.fixture.view(0,0,false);window.fixture.dispose();});
 assert.deepEqual(errors,[]);
 const result={scope:'Private Chromium SwiftShader fixture; no app server or integrated-app/browser acceptance',probe,loaded,state,requests,errors,baselineMemory,disposal,legacy,stability,fallback};
 await writeFile(resolve(output,'results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}catch(error){
 await writeFile(resolve(output,'failure.json'),JSON.stringify({error:String(error),errors,requests},null,2)+'\n');
 console.error(errors);throw error;
}finally{await browser.close();}
