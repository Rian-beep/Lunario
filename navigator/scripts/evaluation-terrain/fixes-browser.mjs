// Isolated browser context and intercepted disk transport. No server or shared profile.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
const output=process.argv[2]||'/tmp/lunario-fix-terrain-browser';
await fs.mkdir(output,{recursive:true});
const contents=`
import * as T from 'three';
import {mountScene} from './components/workbench/scene/runtime';
import {LunarTerrain} from './components/workbench/scene/lunar-terrain.js';
import {siteFrame} from './components/workbench/scene/surface';
import {southPoleTerrainMatrix,sceneToTerrainRotation} from './components/workbench/scene/south-pole-detail';
import {projectedToLatLon} from './lib/astro';
import {loadTerrain} from './lib/terrain';
import {createRoot} from 'react-dom/client';
import {createElement} from 'react';
import {LunarScene} from './components/workbench/scene';
window.api={T,loadTerrain,mountScene,LunarTerrain,siteFrame,southPoleTerrainMatrix,sceneToTerrainRotation,projectedToLatLon,createRoot,createElement,LunarScene};
window.terrains=[];
const init=LunarTerrain.prototype.init;
LunarTerrain.prototype.init=function(){window.terrains.push(this);return init.call(this);};
`;
const bundle=await build({stdin:{contents,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',outdir:'/tmp/lunario-terrain-browser-bundle',define:{'import.meta.url':JSON.stringify('https://terrain-fixture.invalid/fixture.js')}});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:800,height:450},reducedMotion:'reduce'});
const requests=[],errors=[],checks=[];
const checked=message=>{checks.push(message);console.log(message);};
let failDetail=false,delayDetail=false,releaseDetail,holdModels=false;
const modelReleases=[];
await context.route('**/*',async route=>{
 const url=new URL(route.request().url());if(url.protocol==='file:')return route.continue();requests.push(url.pathname);
 if(url.pathname==='/lunario/index.html')return route.fulfill({contentType:'text/html',body:'<html><style>body{margin:0;background:#030404}#host,.scene-host{width:800px;height:450px}.scene-wrap{position:relative;width:800px;height:450px}.scene-wrap>.scene-host{position:absolute;inset:0}.scene-inline-controls{position:absolute;left:12px;top:12px}.header-dropdown-content{overflow:auto}details{color:#222;background:#faf7ec}.sq-scene{color:#eee}</style><body><div id="host"></div></body></html>'});
 if(url.pathname.startsWith('/public/data/south-pole-detail/')){
  if(failDetail)return route.fulfill({status:404,body:'forced missing detail'});
  if(delayDetail&&url.pathname.endsWith('manifest.json'))await new Promise(resolve=>{releaseDetail=resolve;});
  const file=path.join(process.cwd(),'public',url.pathname.slice('/public/'.length));
  try{return await route.fulfill({body:await fs.readFile(file),contentType:file.endsWith('.json')?'application/json':'application/octet-stream'});}catch(error){if(error.code!=='ENOENT')throw error;}
 }
 if(holdModels)await new Promise(resolve=>modelReleases.push(resolve));
 // Unrelated NASA assets deliberately fail; this fixture verifies fallback, not their fidelity.
 return route.fulfill({status:404,body:'asset excluded from terrain fixture'});
});
const page=await context.newPage();page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});
const setup=async()=>{
 await page.goto('https://terrain-fixture.invalid/lunario/index.html');await page.addScriptTag({content:bundle.outputFiles.find(f=>f.path.endsWith('.js')).text});
 await page.evaluate(()=>{
  globalThis.__LUNARIO_PUBLIC_BASE__='../public/';
  const {lat,lon}=api.projectedToLatLon(-4824,-4862);
  const grid={id:'canonical-fixture',width:3,height:3,x0:-6000,y0:-4000,stepM:1000,inputPixelM:1000,heights:Array(9).fill(1100)};
  window.live={lat,lon,terrain:{version:1,source:'synthetic canonical fixture',sourcePage:'fixture',retrievedUtc:'fixture',frame:'fixture',sourcePixelM:1000,sampling:'fixture',overview:grid,patches:[]},imagery:null,
   map:{url:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',tieX:0,tieY:0,centerOffset:0,width:1,height:1,scaleM:1000000},pose:{sunAz:90,sunEl:10,earthAz:0,earthEl:5},referenceHeightM:1100,
   horizon:{heightM:2,mask:new Float32Array(360),coverage:'fine'},flight:null,flightTime:0,showFlight:false,offline:false};
  window.settings={mode:'orbit',reset:0,horizon:false,inspection:false,guides:false};
  window.details=[];window.events=[];
  window.start=(far=false,useHandoff=true)=>{
   const frame=api.siteFrame(live.lat,live.lon,1100),target=frame.up.clone().multiplyScalar(frame.referenceRadiusM/1000);
   const camera=target.clone().addScaledVector(frame.up,far?500:2).addScaledVector(frame.north,far?500:2);
   const handoff={key:'fixture',camera:camera.toArray(),target:target.toArray(),up:frame.up.toArray(),resume:false};
   const event=(...args)=>events.push(args);
   window.stop=api.mountScene(document.querySelector('#host'),live,()=>live,()=>settings,event,event,event,event,event,useHandoff?handoff:null,()=>false,event,event,()=>{},event,event,()=>{},()=>{},value=>details.push(value));
  };
 });
};
const detailCount=()=>requests.filter(r=>r.includes('south-pole-detail')).length;
const snap=()=>page.evaluate(()=>({...document.querySelector('#host').dataset,details:details.at(-1),instances:terrains.length}));
try{
 await setup();await page.evaluate(()=>start(true));await page.waitForFunction(()=>Number(document.querySelector('#host').dataset.renderFrame)>3);
 assert.equal(detailCount(),0);assert.equal((await snap()).instances,0);checked('distant runtime allocates/requests no detail');await page.evaluate(()=>stop());
 await setup();await page.evaluate(()=>{settings.mode='globe';live.terrain.patches=[{...live.terrain.overview,id:'fine-fixture',x0:-4829,y0:-4857,stepM:5,inputPixelM:5}];start(false,false);});
 await page.waitForFunction(()=>Number(document.querySelector('#host').dataset.renderFrame)>3);assert.equal(detailCount(),0);checked('initial globe framing over fine coverage does not trigger a transient close-detail load');await page.evaluate(()=>stop());
 await setup();const before=detailCount();await page.evaluate(()=>{live.showFlight=true;start();});await page.waitForFunction(()=>Number(document.querySelector('#host').dataset.renderFrame)>3);
 assert.equal(detailCount(),before);assert.equal((await snap()).groundSurface,'canonical');checked('active flight in orbit keeps canonical ground and no detail allocation');await page.evaluate(()=>stop());
 await setup();await page.evaluate(()=>{live.offline=true;start();});await page.waitForFunction(()=>Number(document.querySelector('#host').dataset.renderFrame)>3);
 assert.equal(detailCount(),before);assert.match((await snap()).details,/embedded canonical terrain retained/);checked('explicit offline keeps embedded canonical terrain without missing-grid requests');await page.evaluate(()=>stop());
 await setup();await page.evaluate(()=>start());await page.waitForFunction(()=>document.querySelector('#host').dataset.groundSurface==='visual-detail',{},{timeout:60000});
 await page.waitForFunction(()=>terrains[0]._loaded.some(d=>d.id.includes('stereo')),{},{timeout:60000});
 await page.waitForFunction(()=>details.at(-1)?.includes('Contributors:'));
 const epoch=await snap();assert.ok(requests.some(r=>r==='/public/data/south-pole-detail/manifest.json'));
 const lighting=await page.evaluate(()=>{
  const expected=new api.T.Vector3(1,0,0); // live ENU east at az=90, adjusted below
  const frame=api.siteFrame(live.lat,live.lon,0),pole=api.siteFrame(-90,0,0),az=live.pose.sunAz*Math.PI/180,el=live.pose.sunEl*Math.PI/180;
  const body=frame.east.clone().multiplyScalar(Math.sin(az)*Math.cos(el)).addScaledVector(frame.up,Math.sin(el)).addScaledVector(frame.north,Math.cos(az)*Math.cos(el));
  expected.set(body.dot(pole.east),body.dot(pole.up),-body.dot(pole.north));
  return {error:expected.distanceTo(terrains[0].uniforms.sunDirection.value),source:terrains[0].getElevation(-4824,-4862),shadowLast:terrains[0]._lastShadow};
 });
 assert.ok(lighting.error<1e-10);assert.ok(lighting.source.contributors.length>=2);assert.ok(lighting.source.contributors.some(c=>c.weight<1));
 const first=epoch.southPoleSunDirection;await page.evaluate(()=>{live={...live,pose:{...live.pose,sunAz:270,sunEl:-10}};});await page.waitForFunction(first=>document.querySelector('#host').dataset.southPoleSunDirection!==first,first);
 assert.equal((await snap()).southPoleLighting,'epoch');checked('actual runtime transforms live Sun and responds to date/pose changes');
 await page.evaluate(()=>{settings.inspection=true;});await page.waitForFunction(()=>document.querySelector('#host').dataset.southPoleLighting==='studio');
 const studio=await page.evaluate(()=>terrains[0].uniforms.sunDirection.value.toArray());await page.evaluate(()=>{live.pose.sunAz=30;});await page.waitForTimeout(350);
 assert.deepEqual(await page.evaluate(()=>terrains[0].uniforms.sunDirection.value.toArray()),studio);checked('studio explicitly fixed; changing epoch does not rebuild studio shadow');
 const shadow=await page.evaluate(()=>terrains[0]._lastShadow);await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>terrains[0]._lastShadow),shadow);
 await page.screenshot({path:path.join(output,'runtime-detail.png')});
 await page.evaluate(()=>{live.showFlight=true;});await page.waitForFunction(()=>document.querySelector('#host').dataset.groundSurface==='canonical');checked('already loaded visual detail hides immediately when showFlight becomes active');
 await page.evaluate(()=>stop());const disposed=await page.evaluate(()=>({textures:terrains[0].datasets.some(d=>d.heightTexture),values:terrains[0].datasets.some(d=>d.values),children:terrains[0].group.children.length,events:events.length,details:details.length}));await page.waitForTimeout(300);
 assert.equal(disposed.textures,false);assert.equal(disposed.values,false);assert.equal(disposed.children,0);assert.deepEqual(await page.evaluate(()=>({events:events.length,details:details.length})),{events:disposed.events,details:disposed.details});checked('mounted cleanup releases terrain and suppresses later callbacks');
 failDetail=true;await setup();await page.evaluate(()=>start());await page.waitForFunction(()=>document.querySelector('#host').dataset.southPoleDetail==='unavailable');assert.equal((await snap()).groundSurface,'canonical');assert.match((await snap()).details,/unavailable/);checked('404 overview retains canonical terrain and truthful failure');await page.evaluate(()=>stop());failDetail=false;
 delayDetail=true;await setup();await page.evaluate(()=>start());await page.waitForFunction(()=>document.querySelector('#host').dataset.southPoleDetail==='loading');await page.evaluate(()=>stop());const late=await page.evaluate(()=>({events:events.length,details:details.length}));releaseDetail?.();await page.waitForTimeout(500);assert.deepEqual(await page.evaluate(()=>({events:events.length,details:details.length})),late);assert.equal(await page.evaluate(()=>terrains[0].datasets.length),0);checked('dispose while manifest pending prevents late initialization/status');delayDetail=false;
 // Mount the real React component to check pending status and expandable source disclosure.
 await setup();holdModels=true;await page.evaluate(()=>{
  document.querySelector('#host').innerHTML='';window.root=api.createRoot(document.querySelector('#host'));root.render(api.createElement(api.LunarScene,{...live,offline:true}));
 });
 await page.waitForSelector('.sq-loading');const pending=await page.locator('.sq-loading').innerText();assert.match(pending,/Loading Moon model/);assert.equal(await page.locator('.sq-loading').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
 const pendingBounds=await page.locator('.sq-loading').boundingBox();assert.ok(pendingBounds.y>=0&&pendingBounds.y+pendingBounds.height<=450);
 await page.screenshot({path:path.join(output,'component-pending.png')});
 await page.evaluate(()=>root.render(api.createElement(api.LunarScene,{...live,offline:false})));
 await page.waitForFunction(()=>document.querySelector('[data-surface-detail-source]')?.textContent.includes('Contributors:'),{},{timeout:60000});
 await page.waitForSelector('[data-surface-detail-source]',{state:'attached'});await page.evaluate(()=>{document.querySelector('#host .header-camera').open=true;document.querySelector('#host .sq-notes').open=true;});
 assert.match(await page.locator('[data-surface-detail-source]').textContent(),/Effective source:.*Contributors:/);assert.equal(await page.getByRole('button',{name:'Studio inspection light',exact:true}).count(),1);checked('actual React scene exposes source in expandable details and concise nonblocking pending model text');await page.locator('[data-surface-detail-source]').screenshot({path:path.join(output,'component-source.png')});assert.ok((await fs.stat(path.join(output,'component-source.png'))).size>500);await page.evaluate(()=>root.unmount());holdModels=false;for(const release of modelReleases.splice(0))release();
 const props=await page.evaluate(()=>({...live,horizon:{...live.horizon,mask:Array.from(live.horizon.mask)}}));
 const filePage=await context.newPage(),fileRequests=[];
 filePage.on('request',request=>fileRequests.push(request.url()));
 const file=path.join(output,'solarreach-navigator.html');await fs.writeFile(file,'<!doctype html><body><div id="file-host" style="width:320px;height:240px"></div></body>');
 await filePage.goto('file://'+file);await filePage.addScriptTag({content:bundle.outputFiles.find(f=>f.path.endsWith('.js')).text});
 const fileOffline=await filePage.evaluate(async props=>{
  window.__SOLARREACH_TERRAIN__=props.terrain;const terrain=await api.loadTerrain();
  window.fileLive={...props,terrain,offline:false,showFlight:false};window.fileSettings={mode:'orbit',reset:0,horizon:false,inspection:true,guides:false};
  window.fileStop=api.mountScene(document.querySelector('#file-host'),fileLive,()=>fileLive,()=>fileSettings,()=>{},()=>{},()=>{},()=>{},()=>{});
  return {embeddedHeight:terrain.overview.heights[0]};
 },props);
 await filePage.waitForFunction(()=>Number(document.querySelector('#file-host').dataset.renderFrame)>2);
 assert.equal(fileOffline.embeddedHeight,1100);assert.ok(!fileRequests.some(url=>url.includes('south-pole-detail')));assert.equal(await filePage.evaluate(()=>terrains.length),0);
 await filePage.evaluate(()=>fileStop());await filePage.close();checked('native file page retains injected embedded terrain and issues no detail requests, even without offline prop');
 const result={browser:browser.version(),scope:'private Chromium SwiftShader; actual runtime/component; committed DEMs via intercepted HTTP, unrelated model failures intentional',checks,epoch,lighting,disposed,pending,fileOffline,fileRequests,requests,errors};await fs.writeFile(path.join(output,'results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({checks,errors,output},null,2));assert.deepEqual(errors,[]);
}finally{releaseDetail?.();for(const release of modelReleases.splice(0))release();await context.close();await browser.close();}
