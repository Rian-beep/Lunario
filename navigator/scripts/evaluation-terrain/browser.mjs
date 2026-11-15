// Private Chromium + intercepted local transport; no server, token, or provider-success claim.
import fs from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
const output=process.argv[2]||'/tmp/lunario-eval-terrain-browser';await fs.mkdir(output,{recursive:true});
const bundle=await build({stdin:{contents:`import * as THREE from 'three';import {LunarTerrain} from './components/workbench/scene/lunar-terrain.js';import {southPoleManifestUrl} from './components/workbench/scene/south-pole-detail';import {useStreamedAtlasMaterials} from './components/workbench/scene/ion/atlas-material';window.api={THREE,LunarTerrain,southPoleManifestUrl,useStreamedAtlasMaterials};`,resolveDir:process.cwd()},bundle:true,write:false,format:'iife',platform:'browser'});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:800,height:450},deviceScaleFactor:1});const page=await context.newPage(),requests=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',async route=>{
 const url=new URL(route.request().url());requests.push(url.href);
 if(url.pathname==='/lunario/index.html')return route.fulfill({contentType:'text/html',body:'<html><body style="margin:0"></body></html>'});
 if(url.pathname.startsWith('/lunario/data/south-pole-detail/')){
  const file=path.join(process.cwd(),'public',url.pathname.slice('/lunario/'.length));
  try{return await route.fulfill({body:await fs.readFile(file),contentType:file.endsWith('.json')?'application/json':'application/octet-stream'});}catch(error){if(error.code!=='ENOENT')throw error;}
 }
 return route.fulfill({status:404,body:'not found'});
});
try{
 await page.goto('https://terrain-fixture.invalid/lunario/index.html');await page.addScriptTag({content:bundle.outputFiles[0].text});
 const wrongPath=await page.evaluate(async()=>{const url=api.southPoleManifestUrl();return{url,status:(await fetch(url)).status};});
 const observation=await page.evaluate(async()=>{
  const {THREE:T,LunarTerrain}=api,renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,logarithmicDepthBuffer:true});renderer.setSize(800,450);renderer.setClearColor('#11151b');document.body.appendChild(renderer.domElement);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(43,800/450,.0005,18000),terrain=new LunarTerrain(scene,{renderer,quality:'high',viewportHeight:()=>450,manifestUrl:'/lunario/data/south-pole-detail/manifest.json'});
  await terrain.init();const startup=terrain.datasets.filter(d=>d.loaded).map(d=>d.id);
  for(const d of terrain.datasets)await terrain._loadDataset(d);
  const target=terrain.toWorld(-3000,-7000),up=target.clone().add(new T.Vector3(0,1737.4,0)).normalize();
  camera.position.copy(target).addScaledVector(up,1);camera.up.set(0,0,-1);camera.lookAt(target);camera.updateMatrixWorld(true);terrain.setSun(225,28);
  for(let i=0;i<150;i++){terrain.update(camera,target);if(!terrain._pending&&!terrain._queue.length)break;await new Promise(requestAnimationFrame);}
  renderer.render(scene,camera);
  const pixels=new Uint8Array(4*800*450),gl=renderer.getContext();gl.readPixels(0,0,800,450,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  let min=255,max=0,nonBackground=0;for(let i=0;i<pixels.length;i+=4){min=Math.min(min,pixels[i]);max=Math.max(max,pixels[i]);if(pixels[i]!==17||pixels[i+1]!==21||pixels[i+2]!==27)nonBackground++;}
  window.proof={renderer,scene,camera,terrain,target};
  const debug=gl.getExtension('WEBGL_debug_renderer_info');
  return{renderer:gl.getParameter(gl.RENDERER),unmaskedRenderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null,maxTextureSize:gl.getParameter(gl.MAX_TEXTURE_SIZE),startup,
   loaded:terrain.datasets.filter(d=>d.loaded).map(d=>d.id),tiles:terrain.meshes.length,triangles:renderer.info.render.triangles,redChannelRange:[min,max],nonBackground,canvases:document.querySelectorAll('canvas').length,imageryEnabled:terrain.uniforms.imageryEnabled.value};
 });
 await page.screenshot({path:path.join(output,'incoming-1km.png')});
 const repeat=await page.evaluate(()=>{const {renderer,scene,camera}=proof;const before=renderer.domElement.toDataURL();renderer.render(scene,camera);return before===renderer.domElement.toDataURL();});
 const adjacent=await page.evaluate(async()=>{
  const {terrain,renderer,scene,camera,target}=proof;
  const next=terrain.toWorld(-2500,-7000);camera.position.add(next.clone().sub(target));camera.lookAt(next);camera.updateMatrixWorld(true);terrain._lastPlan=-Infinity;
  for(let i=0;i<150;i++){terrain.update(camera,next);if(!terrain._pending&&!terrain._queue.length)break;await new Promise(requestAnimationFrame);}
  renderer.render(scene,camera);
  return{tiles:terrain.meshes.length,triangles:renderer.info.render.triangles,pending:!!terrain._pending,canvases:document.querySelectorAll('canvas').length};
 });
 await page.screenshot({path:path.join(output,'incoming-1km-adjacent.png')});
 const cleanup=await page.evaluate(()=>{const {terrain,renderer}=proof;terrain.dispose();renderer.render(new api.THREE.Scene(),proof.camera);const info={geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures};renderer.dispose();return info;});
 const filePage=await context.newPage();const file=path.join(output,'solarreach-navigator.html');await fs.writeFile(file,'<!doctype html><title>private terrain URL check</title>');await filePage.goto('file://'+file);await filePage.addScriptTag({content:bundle.outputFiles[0].text});
 const offline=await filePage.evaluate(async()=>{const url=api.southPoleManifestUrl();try{await fetch(url);return{url,loaded:true};}catch(e){return{url,loaded:false,error:e.message};}});
 const result={browser:browser.version(),transport:'intercepted committed local data; no authenticated provider',wrongPath,observation,identicalRepeatFrame:repeat,adjacent,cleanup,offline,requests,errors};
 await fs.writeFile(path.join(output,'results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
 if(errors.length||!observation.nonBackground||!repeat)process.exitCode=1;
}finally{await context.close();await browser.close();}
