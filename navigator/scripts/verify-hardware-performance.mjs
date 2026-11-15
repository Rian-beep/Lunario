#!/usr/bin/env node
// Private-browser observations only; no application bridge, renderer patch or state injection.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import os from 'node:os';

const options={marker:'/tmp/solarreach-refinement-c15-ready.json',instructions:'/tmp/refinement-c15-qa-instructions.txt',sourceBundle:'/tmp/lunar-window-c15-source.bundle',output:`/tmp/refinement-hardware-c15/run-${Date.now()}`,mode:'both'};
for(let i=2;i<process.argv.length;i+=2){const key=process.argv[i].replace(/^--/,'');assert.ok(key in options&&process.argv[i+1],`Unknown/missing option ${key}`);options[key]=process.argv[i+1];}
assert.ok(['both','http','file'].includes(options.mode));
await mkdir(options.output,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const scriptPath=new URL(import.meta.url),script=await readFile(scriptPath);
const marker=JSON.parse(await readFile(options.marker));
const git=(...args)=>execFileSync('git',['-C',marker.sourceCheckPath,...args],{encoding:'utf8'}).trim();
const pinnedPaths=[scriptPath,options.marker,options.instructions,options.sourceBundle,marker.artifactPath];
async function identities(){return{files:await Promise.all(pinnedPaths.map(async path=>({path:String(path),sha256:sha(await readFile(path))}))),sourceCommit:git('rev-parse','HEAD'),sourceStatus:git('status','--porcelain'),sourceFiles:await Promise.all(git('ls-files','-z').split('\0').filter(Boolean).map(async path=>({path,sha256:sha(await readFile(resolve(marker.sourceCheckPath,path)))}))),httpSha256:sha(Buffer.from(await(await fetch(marker.url)).arrayBuffer()))};}
const before=await identities();
assert.equal(before.sourceCommit,marker.sourceCommit);assert.equal(before.sourceStatus,'');
assert.equal(before.files.at(-1).sha256,marker.artifactSha256);assert.equal(before.httpSha256,marker.artifactSha256);
execFileSync('git',['bundle','verify',options.sourceBundle],{cwd:marker.sourceCheckPath,stdio:'pipe'});
assert.ok(execFileSync('git',['bundle','list-heads',options.sourceBundle],{encoding:'utf8'}).includes(marker.sourceCommit));
await writeFile(resolve(options.output,'verifier.mjs'),script);
await writeFile(resolve(options.output,'inputs-before.json'),JSON.stringify(before,null,2));
const flags=['--no-sandbox','--enable-gpu','--use-gl=angle','--use-angle=vulkan'];
const modulePath=process.env.PLAYWRIGHT_CORE_MODULE||'/home/luke/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs';
const {chromium}=await import(modulePath.startsWith('/')?pathToFileURL(modulePath).href:modulePath);
const report={startedUtc:new Date().toISOString(),marker,before,flags,playwrightModule:modulePath,host:{hostname:os.hostname(),cpu:os.cpus()[0]?.model,cpuCount:os.cpus().length,memoryBytes:os.totalmem(),platform:os.platform(),release:os.release(),loadAverage:os.loadavg()},viewport:{width:1600,height:1000},cases:[],limits:[
  'Fresh private browser per transport; OS/disk caches warm, local HTTP, no cold internet claim. Normal motion, DPR 1; no CPU/network throttling.',
  'Frame timestamps are MutationObserver delivery after production renderFrame increments (renderer.render returned), not GPU fences, scanout, presentation FPS or RAF callback counts.',
  'Short single-device samples under concurrent workstation load; no universal FPS/latency acceptance threshold and no optimization comparison.',
  'Resource/request observations cannot prove internal GPU allocation reuse or unobservable embedded decodes. Contact replay precomputation is separate from terrain/texture readiness.',
  'Human, other device/network, screen-reader, full scene/viewport and qualified mission acceptance are outside this benchmark.'
]};
async function run(mode){
 const result={mode,loadAverage:os.loadavg(),errors:[],consoleErrors:[],warnings:[],requestFailures:[],httpRequests:[],resourceRequests:[],checks:[]};report.cases.push(result);
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/usr/bin/google-chrome',args:flags});
 result.browser=browser.version();
 const context=await browser.newContext({viewport:report.viewport,deviceScaleFactor:1,reducedMotion:'no-preference'});
 if(mode==='file')await context.setOffline(true);
 const page=await context.newPage();page.setDefaultTimeout(30000);
 let currentPhase='startup';
 const shortUrl=url=>url.startsWith('data:')?`data:sha256:${sha(url)}`:url;
 page.on('pageerror',e=>result.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')result.consoleErrors.push(m.text());if(m.type()==='warning')result.warnings.push(m.text());});
 page.on('requestfailed',r=>result.requestFailures.push({url:shortUrl(r.url()),failure:r.failure()}));
 page.on('request',r=>{const entry={url:shortUrl(r.url()),type:r.resourceType(),phase:currentPhase};result.resourceRequests.push(entry);if(/^https?:/.test(r.url()))result.httpRequests.push(entry);});
 page.on('response',r=>{if(r.status()>=400)result.errors.push(`HTTP ${r.status()} ${shortUrl(r.url())}`);});
 async function check(name,fn){const detail=await fn();result.checks.push({name,detail});console.log(`${mode} PASS ${name}`);return detail;}
 const scene=()=>page.locator('.scene-host').evaluate(h=>({...h.dataset}));
 const idle=()=>page.waitForFunction(()=>{const d=document.querySelector('.scene-host')?.dataset;return d?.assetFlight==='idle'&&d.surfaceStatus!=='preparing'&&d.surfaceStatus!=='error';},null,{timeout:120000});
 // Site flight has no dataset flag: require its actual arrival announcement and
 // subsequent completed renders with a stable, visible, framed vehicle.
 const vehicleStable=(site=null,arrival=false,timeout=120000)=>page.waitForFunction(({site,arrival})=>{
  const o=window.__hardwareObservation,now=performance.now();
  const recent=o.frames.filter(f=>f.t>=now-750);
  const first=recent.findIndex(f=>f.t>=now-550),frames=recent.slice(Math.max(0,first-1));
  if(frames.length<2||frames[0].t>now-500||frames.at(-1).t<now-100)return false;
  const ready=frames.every(f=>f.camera==='vehicle'&&f.vehicleVisible==='true'&&f.vehicleFraming==='framed'&&f.assetFlight==='idle'&&f.moonModel==='ready'&&f.equipmentReady&&
   (site===null?f.surfaceStatus===null||f.surfaceStatus==='ready':f.surfaceSite===site&&f.surfaceStatus==='ready')&&
   (f.contactReplay==='ready'||f.contactReplay==='idle'&&!f.hasLandingContact)&&(!arrival||f.navigationStatus==='Selected lunar site reached.'));
  const distances=frames.map(f=>f.cameraDistanceKm);
  return ready&&distances.every(Number.isFinite)&&Math.max(...distances)-Math.min(...distances)<0.000001;
 },{site,arrival},{timeout});
 const button=(name)=>page.getByRole('button',{name,exact:true});
 async function screenshot(name){await page.screenshot({path:resolve(options.output,`${mode}-${name}.png`)});}
 async function phase(name,action){
  currentPhase=name;
  const start=await page.evaluate(name=>{const o=window.__hardwareObservation;o.phase=name;const start=performance.now();o.windows.push({name,start});return start;},name);
  let end;
  try{await action();}finally{end=await page.evaluate(()=>{const o=window.__hardwareObservation,end=performance.now();o.windows.at(-1).end=end;o.phase=null;return end;});currentPhase=null;}
  return{elapsedMs:end-start,scene:await scene()};
 }
 try{
  const start=performance.now();const response=await page.goto(mode==='file'?pathToFileURL(marker.artifactPath).href:marker.url,{waitUntil:'load',timeout:120000});
  result.load={elapsedMs:performance.now()-start,navigation:await page.evaluate(()=>performance.getEntriesByType('navigation')[0].toJSON())};
  if(mode==='http'){assert.equal(response.status(),200);assert.equal(response.url(),marker.url);}
  await page.getByLabel('Lunar workbench',{exact:true}).waitFor();result.workbenchReadyMs=performance.now()-start;
  if(await button('Dismiss introduction').isVisible())await button('Dismiss introduction').click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  const activation=performance.now();await button('3D terrain').click();
  await page.waitForFunction(()=>{const h=document.querySelector('.scene-host');return h?.dataset.moonModel==='ready'&&h.dataset.surfaceStatus!=='preparing'&&h.dataset.surfaceStatus!=='error'&&document.body.textContent.includes('Equipment status: ready');},null,{timeout:120000});
  await idle();result.assetsReadyAfterActivationMs=performance.now()-activation;result.assetsReadyAfterNavigationMs=performance.now()-start;
  await check('actual-app-hardware-and-original-assets',async()=>{
   const proof=await page.locator('.scene-host canvas').evaluate(canvas=>{const gl=canvas.getContext('webgl2');if(!gl)return null;const ext=gl.getExtension('WEBGL_debug_renderer_info');return{vendor:ext&&gl.getParameter(ext.UNMASKED_VENDOR_WEBGL),renderer:ext&&gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),version:gl.getParameter(gl.VERSION),contextLost:gl.isContextLost(),width:canvas.width,height:canvas.height};});
   assert.ok(proof);assert.match(proof.renderer,/Radeon 8060S/);assert.doesNotMatch(proof.renderer,/SwiftShader|llvmpipe|software/i);assert.equal(proof.contextLost,false);
   const state=await scene();assert.equal(state.vehicleScale,'1');assert.equal(state.moonModel,'ready');assert.equal(state.lightingMode,'atlas');
   const embedded=await page.evaluate(async()=>{
    const hash=async encoded=>{const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));return{bytes:bytes.length,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('')};};
    const nasa=window.__SOLARREACH_NASA_MODEL__,lander=window.__SOLARREACH_EQUIPMENT__['/data/equipment/apollo-lunar-module.glb'];
    return{mesh:await hash(nasa.meshGzipBase64),atlas:await hash(nasa.textureDataUrl.split(',')[1]),lander:await hash(lander.split(',')[1]),originalTriangles:nasa.metadata.mesh.triangleCount,atlasWidth:nasa.metadata.texture.width,atlasHeight:nasa.metadata.texture.height};
   });
   for(const [key,path] of [['mesh','public/data/nasa-moon-mesh.bin.gz'],['atlas','public/data/imagery/nasa-moon-8k.jpg'],['lander','public/data/equipment/apollo-lunar-module.glb']])assert.equal(embedded[key].sha256,sha(await readFile(resolve(marker.sourceCheckPath,path))),`Original embedded ${key}`);
   return{webgl:proof,scene:state,embedded,equipmentReady:true,atlasReadyEvidence:'Production moonModel ready follows awaited waitForMoonAtlas; original 8K JPEG is the shared globe/terrain atlas.'};
  });
  const initialScene=(await scene()).sceneInstance;
  await page.evaluate(()=>{
   const host=document.querySelector('.scene-host');
   const o=window.__hardwareObservation={phase:null,windows:[],frames:[],changes:[],contexts:[],edit:null};
   const last=new Map();
   const equipmentReady=()=>Array.from(document.querySelectorAll('.sq-notes-body p')).some(p=>p.textContent.includes('Equipment status: ready'));
   const propellant=()=>document.querySelector('.flight-telemetry button[aria-label="About Propellant"]')?.closest('div')?.querySelector('strong')?.textContent.trim();
   const observer=new MutationObserver(records=>{
    const now=performance.now(),d=host.dataset;
    if(records.some(r=>r.target===host&&r.attributeName==='data-render-frame'))o.frames.push({t:now,frame:Number(d.renderFrame),phase:o.phase,scene:d.sceneInstance,revision:d.flightRevision,camera:d.cameraMode,position:d.cameraPosition,target:d.cameraTarget,assetFlight:d.assetFlight,
     surfaceStatus:d.surfaceStatus??null,surfaceSite:d.surfaceSite??null,surfaceRevision:d.surfaceRevision??null,surfacePreparationMs:d.surfacePreparationMs??null,
     contactReplay:d.contactReplay,hasLandingContact:!!d.landingContact,vehicleVisible:d.vehicleVisible,vehicleFraming:d.vehicleFraming,cameraDistanceKm:Number(d.vehicleCameraDistanceKm),
     moonModel:d.moonModel,equipmentReady:equipmentReady(),navigationStatus:host.parentElement.querySelector('span.sr-only[role="status"]')?.textContent??null});
    for(const r of records)if(r.target===host&&['data-scene-instance','data-flight-revision','data-moon-model','data-surface-status','data-surface-site','data-contact-replay','data-vehicle-visible','data-vehicle-framing','data-asset-flight'].includes(r.attributeName)){const value=host.getAttribute(r.attributeName);if(last.get(r.attributeName)!==value){o.changes.push({t:now,attribute:r.attributeName,value});last.set(r.attributeName,value);}}
    const e=o.edit;
    if(e?.inputAt!==undefined){
     const text=propellant();if(e.uiAt===undefined&&text&&text!==e.beforePropellant){e.uiAt=now;e.propellant=text;}
     if(e.revisionAt===undefined&&d.flightRevision!==e.beforeRevision){e.revisionAt=now;e.revision=d.flightRevision;}
     if(e.renderAt===undefined&&e.revisionAt!==undefined&&records.some(r=>r.target===host&&r.attributeName==='data-render-frame')){e.renderAt=now;e.renderFrame=d.renderFrame;e.massKg=d.landingMassKg;}
    }
   });observer.observe(host,{attributes:true});observer.observe(document.body,{childList:true,subtree:true,characterData:true});
   document.addEventListener('input',event=>{const e=o.edit;if(e&&event.target===e.input&&event.target.value===e.expected){e.inputAt=performance.now();e.eventTimestamp=event.timeStamp;e.trusted=event.isTrusted;}},true);
   host.querySelector('canvas').addEventListener('webglcontextlost',()=>o.contexts.push({t:performance.now(),type:'lost'}));
  });
  result.idle=await phase('idle',()=>page.waitForTimeout(2200));
  const focus=page.getByRole('group',{name:'3D asset focus',exact:true});
  result.focus=[];
  for(const [name,expected] of [['Moon','globe'],['Earth','earth'],['Lander','vehicle']]){
   const detail=await phase(`focus-${name}`,async()=>{await focus.getByRole('button',{name,exact:true}).click();await page.waitForFunction(expected=>document.querySelector('.scene-host')?.dataset.cameraMode===expected,expected);await idle();if(expected==='vehicle')await vehicleStable();await page.waitForTimeout(350);});
   assert.equal(detail.scene.cameraMode,expected);assert.equal(await focus.getByRole('button',{name,exact:true}).getAttribute('aria-pressed'),'true');assert.equal(detail.scene.sceneInstance,initialScene);result.focus.push({name,...detail});await screenshot(name);
  }
  await check('visible-focus-controls-and-persistent-scene',async()=>result.focus.map(f=>({name:f.name,elapsedMs:f.elapsedMs,scene:f.scene.sceneInstance,assetFlight:f.scene.assetFlight})));
  if(await button('Show site drawer').isVisible())await button('Show site drawer').click();
  const selected=await page.locator('.site-item.selected strong').innerText();
  const candidates=await page.locator('.site-item strong').allTextContents();
  const next=candidates.find(n=>n!==selected&&/Shackleton|Connecting|Malapert|de Gerlache/i.test(n));assert.ok(next,`No different prepared polar site: ${candidates.join(', ')}`);
  const oldSite=(await scene()).surfaceSite;
  result.datasetKeysBeforeSite=Object.keys(await scene()).sort();
  result.site=await phase('site-selection',async()=>{
   await page.locator('.site-item').filter({has:page.getByText(next,{exact:true})}).click();
   await page.waitForFunction(old=>{const o=window.__hardwareObservation,w=o.windows.at(-1),f=o.frames.at(-1);return f?.t>=w.start&&f.surfaceSite!==old&&f.surfaceStatus==='ready'&&f.navigationStatus==='Selected lunar site reached.';},oldSite,{timeout:120000});
   // Keep transition + recovery under one 120 s budget, including terrain/contact preparation.
   const elapsed=await page.evaluate(()=>performance.now()-window.__hardwareObservation.windows.at(-1).start);
   assert.ok(elapsed<120000,'Site transition exhausted 120 s budget');
   await vehicleStable((await scene()).surfaceSite,true,Math.max(1,120000-elapsed)).catch(error=>{throw new Error(`Site vehicle baseline did not settle: ${error.message}`);});
  });
  assert.ok(result.site.elapsedMs<=120000,'Site full transition/recovery exceeded 120 s');
  assert.equal(result.site.scene.sceneInstance,initialScene);result.site.from=selected;result.site.to=next;
  result.site.milestones=await page.evaluate(({site,revision})=>{
   const o=window.__hardwareObservation,w=o.windows.find(w=>w.name==='site-selection'),fs=o.frames.filter(f=>f.phase==='site-selection'&&f.surfaceSite===site&&f.revision===revision);
   const since=predicate=>{const f=fs.find(predicate);return f?f.t-w.start:null;};
   return{surfaceReadyMs:since(f=>f.surfaceStatus==='ready'),arrivalAnnouncedMs:since(f=>f.navigationStatus==='Selected lunar site reached.'),firstVisibleFramedAfterArrivalMs:since(f=>f.navigationStatus==='Selected lunar site reached.'&&f.vehicleVisible==='true'&&f.vehicleFraming==='framed'),contactReadyMs:since(f=>f.contactReplay==='ready'),settledMs:w.end-w.start};
  },{site:result.site.scene.surfaceSite,revision:result.site.scene.flightRevision});
  await screenshot('settled-site');
  if(await button('Close site drawer').isVisible())await button('Close site drawer').click();
  if(await button('Show inspector').isVisible())await button('Show inspector').click();
  await button('Flight preview').click();
  if(await button('Expand flight telemetry').isVisible())await button('Expand flight telemetry').click();
  await page.getByLabel('Flight telemetry',{exact:true}).getByRole('button',{name:'About Propellant',exact:true}).waitFor({state:'visible'});
  const mass=page.locator('label.number-field').filter({has:page.getByRole('button',{name:'About Wet mass',exact:true})}).getByRole('spinbutton');await mass.waitFor();await mass.scrollIntoViewIfNeeded();
  result.editBaseline=await phase('edit-baseline',()=>vehicleStable(result.site.scene.surfaceSite,true));
  assert.equal(await focus.getByRole('button',{name:'Lander',exact:true}).getAttribute('aria-pressed'),'true');
  result.editBaseline.landerSelected=true;
  await screenshot('settled-edit-baseline');
  const original=await mass.inputValue(),edited=String(Number(original)+100);
  await mass.evaluate((input,expected)=>{const o=window.__hardwareObservation;o.edit={input,expected,beforeRevision:document.querySelector('.scene-host').dataset.flightRevision,beforePropellant:document.querySelector('.flight-telemetry button[aria-label="About Propellant"]')?.closest('div')?.querySelector('strong')?.textContent.trim()};},edited);
  result.editWindow=await phase('wet-mass-edit',async()=>{
   await mass.fill(edited);await page.waitForFunction(()=>{const e=window.__hardwareObservation.edit;return e?.uiAt!==undefined&&e.renderAt!==undefined;},null,{timeout:120000});
   const elapsed=await page.evaluate(()=>performance.now()-window.__hardwareObservation.windows.at(-1).start);
   assert.ok(elapsed<117800,'Isolated edit reflection exhausted 120 s budget');
   await vehicleStable(result.site.scene.surfaceSite,true,Math.max(1,117800-elapsed));await page.waitForTimeout(2200);
  });
  assert.ok(result.editWindow.elapsedMs<=120000,'Isolated edit/recovery exceeded 120 s');
  assert.equal(await mass.inputValue(),edited);
  result.edit=await page.evaluate(()=>{const {input,...e}=window.__hardwareObservation.edit;return{...e,inputValue:input.value,uiLatencyMs:e.uiAt-e.inputAt,renderLatencyMs:e.renderAt-e.inputAt,revisionLatencyMs:e.revisionAt-e.inputAt,contactReadyLatencyMs:window.__hardwareObservation.frames.find(f=>f.phase==='wet-mass-edit'&&f.t>=e.inputAt&&f.revision===e.revision&&f.contactReplay==='ready')?.t-e.inputAt};});
  assert.equal(result.edit.trusted,true);assert.equal(Number(result.edit.massKg),Number(edited));assert.equal(Number(result.edit.propellant.replace(/[^\d.-]/g,''))-Number(result.edit.beforePropellant.replace(/[^\d.-]/g,'')),100);assert.ok(Number(result.edit.revision)>Number(result.edit.beforeRevision));assert.equal(result.editWindow.scene.sceneInstance,initialScene);await screenshot('settled-edit');
  await check('isolated-edit-visible-framed-continuity',async()=>{
   const frames=await page.evaluate(()=>window.__hardwareObservation.frames.filter(f=>f.phase==='wet-mass-edit'&&f.t>=window.__hardwareObservation.edit.inputAt));
   const failures=frames.filter(f=>f.vehicleVisible!=='true'||f.vehicleFraming!=='framed'||f.camera!=='vehicle'||f.assetFlight!=='idle'||f.surfaceStatus!=='ready'||f.surfaceSite!==result.site.scene.surfaceSite||f.moonModel!=='ready'||!f.equipmentReady||f.scene!==initialScene);
   result.editContinuity={completedFrames:frames.length,failures,contactReplayStates:[...new Set(frames.map(f=>f.contactReplay))],minCameraDistanceKm:Math.min(...frames.map(f=>f.cameraDistanceKm)),maxCameraDistanceKm:Math.max(...frames.map(f=>f.cameraDistanceKm))};
   assert.ok(frames.length>1);assert.deepEqual(failures,[],'Vehicle/surface continuity failed during isolated edit');return result.editContinuity;
  });
  await check('visible-wet-mass-edit-ui-and-completed-render',async()=>result.edit);
  await mass.fill(original);await page.waitForFunction(rev=>Number(document.querySelector('.scene-host')?.dataset.flightRevision)>Number(rev),result.edit.revision,{timeout:120000});
  await button('Hide inspector').click();
  if(await button('Show site drawer').isVisible())await button('Show site drawer').click();await page.locator('.site-item').filter({has:page.getByText(selected,{exact:true})}).click();await idle();
  await button('Close site drawer').click();await focus.getByRole('button',{name:'Moon',exact:true}).click();await idle();
  await check('fixture-restored-through-controls',async()=>{assert.equal(await mass.count(),0);const state=await scene();assert.equal(state.sceneInstance,initialScene);assert.equal(state.cameraMode,'globe');return{wetMass:original,site:selected,scene:state};});
  result.observation=await page.evaluate(()=>{const {frames,windows,changes,contexts}=window.__hardwareObservation;return{frames,windows,changes,contexts,resources:performance.getEntriesByType('resource').map(r=>({name:r.name.startsWith('data:')?`data:${r.name.slice(5,40)} [${r.name.length} chars]`:r.name,type:r.initiatorType,start:r.startTime,end:r.responseEnd,duration:r.duration})),navigationCount:performance.getEntriesByType('navigation').length};});
  const windows=[...new Set(result.observation.frames.map(f=>f.phase).filter(Boolean))];result.frameMetrics=[];
  for(const name of windows){const frames=result.observation.frames.filter(f=>f.phase===name);const deltas=frames.slice(1).map((f,i)=>f.t-frames[i].t);if(!deltas.length)continue;const sorted=[...deltas].sort((a,b)=>a-b),span=frames.at(-1).t-frames[0].t;
   const window=result.observation.windows.find(w=>w.name===name);
   result.frameMetrics.push({name,observedCompletedFrames:frames.length,counterAdvance:frames.at(-1).frame-frames[0].frame,missedCounterSteps:frames.at(-1).frame-frames[0].frame-(frames.length-1),spanMs:span,firstRenderAfterWindowStartMs:frames[0].t-window.start,lastRenderBeforeWindowEndMs:window.end-frames.at(-1).t,completedFramesPerSecond:1000*(frames.length-1)/span,p50Ms:sorted[Math.ceil(sorted.length*.5)-1],p95Ms:sorted[Math.ceil(sorted.length*.95)-1],maxMs:sorted.at(-1),deltasMs:deltas,cameraChanges:frames.slice(1).filter((f,i)=>f.position!==frames[i].position||f.target!==frames[i].target).length});
  }
  await check('bounded-observations-no-errors-reloads-context-loss',async()=>{assert.deepEqual(result.errors,[]);assert.deepEqual(result.consoleErrors,[]);assert.deepEqual(result.requestFailures,[]);assert.deepEqual(result.observation.contexts,[]);assert.equal(result.observation.navigationCount,1);assert.deepEqual([...new Set(result.observation.frames.map(f=>f.scene))],[initialScene]);assert.ok(result.frameMetrics.length>=5);if(mode==='file')assert.deepEqual(result.httpRequests,[]);return{windows:result.frameMetrics.length,httpRequests:result.httpRequests.length,scene:initialScene};});
  const counts=new Map();for(const r of result.resourceRequests)counts.set(r.url,(counts.get(r.url)||0)+1);result.duplicateRequests=[...counts].filter(([,count])=>count>1).map(([url,count])=>({url,count,requests:result.resourceRequests.filter(r=>r.url===url)}));
  await check('no-duplicate-observed-asset-requests',async()=>{const workers=result.duplicateRequests.filter(r=>r.url.startsWith('blob:')&&r.count===4&&r.requests.every(q=>q.type==='script'&&q.phase==='startup'));assert.deepEqual(result.duplicateRequests.filter(r=>!workers.includes(r)),[]);return{requests:result.resourceRequests.length,decoderWorkerStarts:workers,limit:'Four startup script loads of the same blob match the pinned DRACOLoader four-worker pool. These are not model/atlas/equipment reloads. Embedded assets may not emit requests; no hidden decode/allocation count claim.'};});
  result.status='pass';
 }catch(error){result.status='fail';result.failure=error.stack;console.error(`${mode} FAIL ${error.message}`);result.failureObservation=await page.evaluate(()=>({scene:{...document.querySelector('.scene-host')?.dataset},text:document.body.innerText,edit:window.__hardwareObservation?.edit?{...window.__hardwareObservation.edit,input:undefined}:null})).catch(()=>null);await screenshot('failure').catch(e=>{result.screenshotError=e.message;});}
 finally{
  if(!result.observation)result.observation=await page.evaluate(()=>{const o=window.__hardwareObservation;return o?{frames:o.frames,windows:o.windows,changes:o.changes,contexts:o.contexts}:null;}).catch(()=>null);
  await context.close();await browser.close();await writeFile(resolve(options.output,`${mode}.json`),JSON.stringify(result,null,2));
 }
}
try{for(const mode of options.mode==='both'?['http','file']:[options.mode])await run(mode);}
finally{report.after=await identities();report.finishedUtc=new Date().toISOString();try{assert.deepEqual(report.after,before);}catch(error){report.identityFailure=error.stack;}report.status=report.identityFailure||report.cases.some(c=>c.status!=='pass')?'fail':'pass';await writeFile(resolve(options.output,'report.json'),JSON.stringify(report,null,2));}
if(report.status!=='pass')process.exitCode=1;
