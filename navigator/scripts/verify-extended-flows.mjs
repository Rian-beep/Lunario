#!/usr/bin/env node
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i++){const key=args[i];if(key==='--offline'){options.offline=true;continue;}if(!['--base-url','--file','--output'].includes(key)||!args[i+1])throw Error(`Invalid option ${key}`);options[key]=args[++i];}
if(!options['--output']||Boolean(options['--file'])===Boolean(options['--base-url']))throw Error('Required: (--base-url URL | --file PATH) [--offline] --output DIR');
const target=options['--file']?pathToFileURL(resolve(options['--file'])).href:options['--base-url'],output=resolve(options['--output']);await mkdir(output,{recursive:true});
const report={schemaVersion:1,checkedUtc:new Date().toISOString(),target,offline:Boolean(options.offline),viewport:{width:1600,height:1000},checks:[],requests:[],modelRequests:[],pageErrors:[],consoleErrors:[],consoleWarnings:[],incomplete:['Physical frame equivalence and independent fine terrain truth are outside this browser test; coarse global outcomes must remain conditional.']};
if(options['--file']){const bytes=await readFile(resolve(options['--file']));report.artifact={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};}
const {chromium}=await import('playwright-core');const executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';await access(executablePath);
const browser=await chromium.launch({executablePath,headless:true});report.browser={version:browser.version(),headless:true,dedicatedContexts:true};let context;
async function run(reduced=false){
 context=await browser.newContext({viewport:report.viewport,reducedMotion:reduced?'reduce':'no-preference',acceptDownloads:true,deviceScaleFactor:1,hasTouch:true});
 if(options.offline){await context.route(/^https?:\/\//,route=>{report.requests.push({url:route.request().url(),blocked:true});return route.abort();});await context.setOffline(true);}
 await context.addInitScript(()=>{
  window.__extended={navigation:[],frames:[],frameSamples:[],shared:null};let last=performance.now(),previous='';
  function frame(now){if(window.__extended.frames.length<12000){window.__extended.frames.push(now-last);window.__extended.frameSamples.push({time:now,dt:now-last});}last=now;requestAnimationFrame(frame);}requestAnimationFrame(frame);
  const observer=new MutationObserver(()=>{const text=document.querySelector('.sq-scene .sr-only[role="status"]')?.textContent||'';if(text&&text!==previous){window.__extended.navigation.push({time:performance.now(),text});previous=text;if(/Approaching/.test(text)&&window.__extended.cancelNextApproach){window.__extended.cancelNextApproach=false;window.__extendedCancelApproach({time:performance.now(),events:[...window.__extended.navigation]}).catch(error=>{window.__extended.inputError=error.message;});}}});
  observer.observe(document,{subtree:true,childList:true,characterData:true});
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__extended.shared=text;}}});
 });
 const page=await context.newPage();page.setDefaultTimeout(12000);const input=await context.newCDPSession(page);await page.exposeBinding('__extendedCancelApproach',(_source,payload)=>{report.wheelBefore=payload;return input.send('Input.dispatchMouseEvent',{type:'mouseWheel',x:880,y:430,deltaX:0,deltaY:250});});
 page.on('request',request=>{if(/data\/(?:celestial-models|equipment|nasa-moon)|imagery\/nasa-moon/.test(request.url()))report.modelRequests.push({reducedMotion:reduced,url:request.url()});});
 page.on('requestfailed',request=>report.requests.push({url:request.url().slice(0,300),failure:request.failure()?.errorText}));
 page.on('pageerror',error=>report.pageErrors.push(error.message));page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text());if(message.type()==='warning')report.consoleWarnings.push(message.text());});
 page.on('response',async response=>{if(/celestial-models|global-terrain|global-lola/.test(response.url())){let headers={};try{headers=await response.allHeaders();}catch(error){report.requests.push({url:response.url(),captureError:error.message});return;}report.requests.push({reducedMotion:reduced,url:response.url(),status:response.status(),bytes:Number(headers['content-length'])||null});}});
 const button=name=>page.getByRole('button',{name,exact:true});
 const dismissGuide=async()=>{const guide=page.locator('dialog[aria-labelledby="audience-guide-title"]');if(await guide.isVisible()){await page.keyboard.press('Escape');await guide.waitFor({state:'hidden'});}};
 const check=async(name,fn)=>{try{await dismissGuide();const detail=await fn();report.checks.push({name,reducedMotion:reduced,status:'pass',detail:detail??null});}catch(error){report.checks.push({name,reducedMotion:reduced,status:'fail',detail:error.stack||error.message,navigation:await page.evaluate(()=>window.__extended.navigation)});await page.screenshot({path:resolve(output,`${reduced?'reduced-':''}${name}-failure.png`)}).catch(()=>{});}const latest=report.checks.at(-1);console.log(JSON.stringify({check:name,status:latest.status,error:latest.status==='fail'?String(latest.detail).split('\n')[0]:null}));await writeFile(resolve(output,'extended-progress.json'),JSON.stringify(report,null,2));};
 const displayedEpoch=()=>page.getByRole('slider',{name:'Mission time',exact:true}).evaluate(element=>{const slider=element.matches('[aria-valuenow]')?element:element.querySelector('[aria-valuenow]');if(!slider)throw Error('Displayed mission slider value unavailable');return slider.getAttribute('aria-valuenow');});
 const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('solarreach-workbench-v1')||'null'));
 const phase=async pattern=>page.waitForFunction(pattern=>window.__extended.navigation.some(entry=>new RegExp(pattern,'i').test(entry.text)),pattern,{timeout:24000});
 const clearTrace=()=>page.evaluate(()=>{window.__extended.navigation=[];});
 const drawer=async()=>{if(await button('Show site drawer').isVisible())await button('Show site drawer').click();};
 const select=async(name)=>{await drawer();await page.getByLabel('Filter landing sites').selectOption('all');await page.getByLabel('Search landing sites').fill(name);await page.locator('.site-list .site-item').filter({hasText:name}).first().click();if(await button('Close site drawer').isVisible())await button('Close site drawer').click();};
 const inspector=async()=>{if(await button('Show inspector').isVisible())await button('Show inspector').click();};
 const overview=async()=>{await inspector();await button('Site overview').click();};
 const controls=async()=>{const details=page.locator('.scene-camera');if(!await details.evaluate(element=>element.open))await page.getByLabel('Camera and lighting controls').click();};
 const exported=async(name)=>{const pending=page.waitForEvent('download');await button('Export').click();const download=await pending;const path=resolve(output,name);await download.saveAs(path);return JSON.parse(await readFile(path,'utf8'));};
 await page.goto(target,{waitUntil:'load',timeout:90000});await page.getByLabel('Lunar workbench',{exact:true}).waitFor({timeout:90000});
 if(await button('Dismiss introduction').isVisible())await page.keyboard.press('Escape');
 await page.getByRole('dialog').waitFor({state:'hidden'});await button('3D terrain').click();
 await page.waitForFunction(()=>document.querySelector('.scene-host')?.dataset.moonModel==='ready',null,{timeout:90000});
 await page.waitForFunction(()=>{const d=document.querySelector('.scene-host')?.dataset;return d?.sunModel==='ready'&&d?.earthModel==='ready';},null,{timeout:90000});
 const initialScene=await page.locator('.scene-host').evaluate(node=>{window.__sceneCanvas=node.querySelector('canvas');window.__sceneAssetResets=[];new MutationObserver(records=>{for(const record of records)if(node.getAttribute(record.attributeName)!=='ready')window.__sceneAssetResets.push(record.attributeName);}).observe(node,{attributes:true,attributeFilter:['data-sun-model','data-earth-model']});return node.dataset.sceneInstance;});
 const modelRequestCount=report.modelRequests.length;
 const persistentScene=async()=>{const value=await page.locator('.scene-host').evaluate(node=>({instance:node.dataset.sceneInstance,sameCanvas:node.querySelector('canvas')===window.__sceneCanvas,resets:window.__sceneAssetResets,sun:node.dataset.sunModel,earth:node.dataset.earthModel,surfaceSite:node.dataset.surfaceSite,surfaceStatus:node.dataset.surfaceStatus}));assert.equal(value.instance,initialScene);assert.equal(value.sameCanvas,true);assert.deepEqual(value.resets,[]);assert.equal(value.sun,'ready');assert.equal(value.earth,'ready');assert.equal(report.modelRequests.length,modelRequestCount,'NASA model refetched during site navigation');return value;};

 const checkGlobeInputs=async()=>{
 await check('globe-wheel-pinch-orbit-and-pan',async()=>{
  await controls();await page.locator('.scene-camera').getByRole('button',{name:'Moon',exact:true}).click();await page.getByLabel('Camera and lighting controls').click();
  const read=()=>page.locator('.scene-host').evaluate(node=>({radius:Number(node.dataset.cameraBodyRadiusKm),minimum:Number(node.dataset.globeMinimumRadiusKm),camera:node.dataset.cameraPosition.split(',').map(Number),target:node.dataset.cameraTarget.split(',').map(Number),instance:node.dataset.sceneInstance,zoom:node.dataset.zoomEnabled,pan:node.dataset.panEnabled,rotate:node.dataset.rotateEnabled}));
  const difference=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
  await page.waitForTimeout(300);const initial=await read();assert.equal(initial.zoom,'true');assert.equal(initial.pan,'true');assert.equal(initial.rotate,'true');
  await page.mouse.move(850,430);await page.mouse.wheel(0,-800);await page.waitForTimeout(100);const inward=await read();assert.ok(inward.radius<initial.radius);
  for(let i=0;i<12;i++){await page.mouse.wheel(0,-800);await page.waitForTimeout(40);}const near=await read();assert.ok(near.radius>=near.minimum-1e-6);assert.ok(near.radius<near.minimum*1.15,'Globe remained stuck far above the surface');
  await page.mouse.wheel(0,1200);await page.waitForTimeout(150);const outward=await read();assert.ok(outward.radius>near.radius);
  await input.send('Input.dispatchMouseEvent',{type:'mouseWheel',x:850,y:430,deltaX:0,deltaY:-150,modifiers:2});await page.waitForTimeout(150);const pinch=await read();assert.ok(pinch.radius<outward.radius,'Ctrl-wheel pinch did not zoom');
  await page.mouse.wheel(0,1600);await page.waitForTimeout(150);const beforeOrbit=await read();await page.mouse.move(850,430);await page.mouse.down({button:'left'});await page.mouse.move(920,470,{steps:12});await page.mouse.up({button:'left'});await page.waitForTimeout(150);const orbit=await read();assert.ok(difference(orbit.camera,beforeOrbit.camera)>1);assert.ok(difference(orbit.target,beforeOrbit.target)<1e-6);
  await page.mouse.move(850,430);await page.mouse.down({button:'right'});await page.mouse.move(900,450,{steps:10});await page.mouse.up({button:'right'});await page.waitForTimeout(150);const pan=await read();assert.ok(difference(pan.target,orbit.target)>1,'Right-drag pan did not move the orbit target');
  const touch=(type,points)=>input.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y,id])=>({x,y,id,radiusX:1,radiusY:1,force:1}))});
  await touch('touchStart',[[830,420,1]]);await touch('touchMove',[[890,450,1]]);await touch('touchEnd',[]);await page.waitForTimeout(150);const touchOrbit=await read();assert.ok(difference(touchOrbit.camera,pan.camera)>1,'One-touch orbit did not move camera');
  await touch('touchStart',[[800,420,1],[900,420,2]]);await touch('touchMove',[[780,440,1],[930,440,2]]);await touch('touchEnd',[]);await page.waitForTimeout(150);const touchPanPinch=await read();assert.ok(difference(touchPanPinch.target,touchOrbit.target)>1,'Two-touch pan did not move target');assert.ok(Math.abs(touchPanPinch.radius-touchOrbit.radius)>1,'Two-touch pinch did not zoom');
  assert.equal(touchPanPinch.instance,initial.instance);await page.screenshot({path:resolve(output,`${reduced?'reduced-':''}globe-input-controls.png`)});return {initial,inward,near,outward,pinch,orbit,pan,touchOrbit,touchPanPinch};
 });
 };
 const checkGeographicNavigation=async()=>{await check('geographic-directions-and-sourced-poi',async()=>{
  await controls();await page.locator('.scene-camera').getByRole('button',{name:'Moon',exact:true}).click();await page.getByLabel('Camera and lighting controls').click();
  const geo=page.getByRole('region',{name:'Globe geographic navigation',exact:true});await geo.waitFor();
  const before=await state();
  await geo.getByRole('button',{name:/North pole/}).click();await page.waitForFunction(()=>Number(document.querySelector('.scene-host')?.dataset.viewLatitude)>89.999999,null,{timeout:6000});
  const north=await page.locator('.scene-host').evaluate(node=>({lat:Number(node.dataset.viewLatitude),lon:Number(node.dataset.viewLongitude)}));
  let previous=north.lon,crossed=false;const steps=Math.ceil((180-previous)/30);
  for(let i=0;i<steps;i++){const expected=((previous+30+540)%360)-180;await geo.getByRole('button',{name:/30° east/}).click();await page.waitForFunction(expected=>Math.abs(Number(document.querySelector('.scene-host')?.dataset.viewLongitude)-expected)<.1,expected,{timeout:6000});crossed ||= expected<previous;previous=expected;}
  assert.ok(crossed,'East stepping did not normalize the dateline');
  const expectedWest=((previous-30+540)%360)-180;await geo.getByRole('button',{name:/30° west/}).click();await page.waitForFunction(expected=>Math.abs(Number(document.querySelector('.scene-host')?.dataset.viewLongitude)-expected)<.1,expectedWest,{timeout:6000});
  await geo.getByRole('button',{name:/South pole/}).click();await page.waitForFunction(()=>Number(document.querySelector('.scene-host')?.dataset.viewLatitude)<-89.999999,null,{timeout:6000});assert.deepEqual(await state(),before,'Geographic camera commands changed mission state');
  await geo.getByRole('button',{name:'Minimize globe navigation',exact:true}).click();await geo.getByRole('button',{name:'Expand globe navigation',exact:true}).click();await geo.getByRole('button',{name:'Dismiss globe navigation',exact:true}).click();await button('Restore globe navigation').click();
  const host=page.locator('.scene-host'),bounds=await host.boundingBox();
  const pois=await host.evaluate(node=>JSON.parse(node.dataset.visiblePois||'[]'));
  const candidate=pois.find(poi=>poi.x>620&&poi.x<1150&&poi.y>220&&poi.y<680);assert.ok(candidate,'No sourced front-side point is available in the unobstructed globe');
  await page.mouse.move(bounds.x+candidate.x,bounds.y+candidate.y);await geo.getByText(/^Point under pointer:/).waitFor();
  const openName=await geo.getByRole('button',{name:/^Open /}).innerText(),picked=pois.find(poi=>`Open ${poi.name}`===openName);assert.ok(picked,'Hovered marker is not a sourced catalogue point');
  await clearTrace();await page.mouse.click(bounds.x+candidate.x,bounds.y+candidate.y);await page.waitForFunction(id=>JSON.parse(localStorage.getItem('solarreach-workbench-v1')).siteId===id,picked.id);await phase('reached');
  await page.screenshot({path:resolve(output,`${reduced?'reduced-':''}sourced-poi-selection.png`)});return {north,eastSteps:steps,datelineCrossed:crossed,clickedPoi:picked,persistentScene:await persistentScene()};
 });};
 await check(reduced?'reduced-motion-instant':'physical-navigation-and-newest-target',async()=>{
  await select('Connecting Ridge');await page.waitForTimeout(reduced?500:11000);const baseline=await state(),baselineEpoch=await displayedEpoch();await clearTrace();
  await select('Apollo 11');
  if(reduced){await phase('reached');const trace=await page.evaluate(()=>window.__extended.navigation);assert.ok(!trace.some(event=>/Zooming out|Moving around|Approaching/.test(event.text)));return {trace,persistentScene:await persistentScene()};}
  await phase('Zooming out');await phase('Moving around');await select('Apollo 17');await phase('Approaching');await phase('reached');
  const current=await state();assert.match(current.siteId,/apollo.?17/i);
  for(const key of ['startIndex','endIndex','mission','flight','arrayHeightM','antennaHeightM','terrainMode'])assert.deepEqual(current[key],baseline[key],`${key} changed during navigation`);
  assert.ok(await button('Play environmental playback').isVisible(),'environmental playback started');assert.equal(await displayedEpoch(),baselineEpoch,'Displayed epoch changed during site navigation');
  await page.screenshot({path:resolve(output,'newest-target-apollo17.png')});return {trace:await page.evaluate(()=>window.__extended.navigation),baseline,current,epoch:baselineEpoch,persistentScene:await persistentScene()};
 });
 if(reduced){await checkGlobeInputs();await checkGeographicNavigation();await context.close();context=null;return;}
 await check('overview-direct-approach-and-wheel-cancel',async()=>{
  await controls();await page.getByRole('group',{name:'3D camera'}).getByRole('button',{name:'Moon',exact:true}).click();await page.waitForTimeout(400);await clearTrace();
  await page.evaluate(()=>{window.__extended.cancelNextApproach=true;});await select('Apollo 12');await phase('Approaching');
  const direct=await page.evaluate(()=>window.__extended.navigation);assert.ok(!direct.some(event=>/Zooming out|Moving around/.test(event.text)),'overview unnecessarily repeated outgoing arc');
  await phase('canceled');
  await select('Apollo 15');await phase('reached');assert.match((await state()).siteId,/apollo.?15/i);return {direct,trace:await page.evaluate(()=>window.__extended.navigation),persistentScene:await persistentScene()};
 });
 await checkGlobeInputs();
 await checkGeographicNavigation();
 await check('actual-nasa-model-ready-and-canvas-evidence' ,async()=>{
  await controls();const notes=page.locator('.scene-camera .sq-notes');if(!await notes.evaluate(element=>element.open))await notes.locator('summary').click();
  await notes.getByText(/Sun.*ready/i).waitFor({timeout:45000});await notes.getByText(/Earth.*ready/i).waitFor({timeout:45000});
  const text=await notes.innerText();assert.match(text,/Sun.*ready/i);assert.match(text,/Earth.*ready/i);assert.ok(await page.locator('.scene-host canvas').isVisible());
  const beforeFocus=await state();const drawn={};
  for(const kind of ['sun','earth']){
   await controls();const count=await page.locator('.scene-host').evaluate((element,kind)=>Number(element.dataset[kind+'Draws']||0),kind);
   await page.getByRole('group',{name:'3D camera'}).getByRole('button',{name:kind==='sun'?'Sun':'Earth',exact:true}).click();
   await page.waitForFunction(({kind,count})=>Number(document.querySelector('.scene-host')?.dataset[kind+'Draws'])>count,{kind,count},{timeout:30000});
   await page.waitForTimeout(250);drawn[kind]=await page.locator('.scene-host').evaluate((element,kind)=>Number(element.dataset[kind+'Draws']),kind);await page.screenshot({path:resolve(output,`nasa-${kind}-actual-draw.png`)});
  }
  assert.deepEqual(await state(),beforeFocus,'Celestial display focus changed scientific inputs');
  await controls();if(!await notes.evaluate(element=>element.open))await notes.locator('summary').click();
  await page.screenshot({path:resolve(output,'nasa-sun-earth-ready.png')});await page.locator('.scene-host').screenshot({path:resolve(output,'nasa-sun-earth-canvas.png')});
  if(!options.offline){for(const kind of ['sun','earth'])assert.ok(report.requests.some(request=>request.url.includes(`/assets/${kind}.glb`)&&request.status===200),`${kind} GLB response missing`);}
  const diagnostics=await page.locator('.scene-host').evaluate(element=>({...element.dataset}));assert.equal(diagnostics.sunModel,'ready');assert.equal(diagnostics.earthModel,'ready');return {notes:text,diagnostics,drawn,assetResponses:report.requests.filter(request=>/\.glb/.test(request.url))};
 });
 await check('arbitrary-coordinate-coarse-prepared-and-roundtrip',async()=>{
  await drawer();const custom=page.locator('details.coordinate-form');if(!await custom.evaluate(element=>element.open))await custom.locator('summary').click();await page.getByLabel('Custom latitude',{exact:true}).fill('20 N');await page.getByLabel('Custom longitude',{exact:true}).fill('150 E');await button('Use coordinates').click();await button('Close site drawer').click();await overview();
  await page.getByLabel('Terrain calculation mode').selectOption('global-context');await page.getByText(/Approximately 4\.3 km equatorial output spacing/).waitFor({timeout:30000});
  const before=await state();assert.deepEqual(before.custom,{lat:20,lon:150});const coarse=await exported('global-context-decision.json');
  const refs=coarse.assessment.evidence.filter(ref=>/global|coarse/i.test(ref.id+' '+ref.label+' '+ref.notes.join(' ')));assert.ok(refs.length>0);assert.ok(refs.some(ref=>ref.coverage==='partial'));assert.ok(coarse.assessment.mission.timeline.some(row=>row.powerW!==null));
  await page.getByLabel('Terrain calculation mode').selectOption('prepared');await page.waitForFunction(()=>JSON.parse(localStorage.getItem('solarreach-workbench-v1')).terrainMode==='prepared');const prepared=await exported('prepared-only-decision.json');assert.equal(prepared.assessment.mission.generatedWh,null);assert.notEqual(prepared.assessment.outcome,'passes-assessed');
  await page.getByLabel('Terrain calculation mode').selectOption('global-context');await button('Save to comparison').click();if(await button('Close comparisons').isVisible())await button('Close comparisons').click();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('solarreach-comparisons-v1')||'[]'));assert.equal(saved.at(-1).state.terrainMode,'global-context');assert.deepEqual(saved.at(-1).state.custom,{lat:20,lon:150});
  await button('Share current scenario').click();const shared=await page.evaluate(()=>window.__extended.shared);assert.ok(shared);const sharedState=JSON.parse(Buffer.from(new URL(shared).searchParams.get('scenario'),'base64url').toString('utf8'));assert.equal(sharedState.terrainMode,'global-context');
  const roundtrip=await exported('roundtrip-global-decision.json');assert.equal(roundtrip.scenario.terrainMode,'global-context');assert.ok(roundtrip.sources.some(source=>source.sha256&&/global|lola/i.test(source.id+' '+source.productId)));
  await button('Planner').click();await dismissGuide();await inspector();const packages=page.locator('details.planning-details').filter({has:page.locator('summary').filter({hasText:'Export, import & print evidence'})});await packages.locator('summary').click();await packages.locator('input[type=file]').setInputFiles(resolve(output,'roundtrip-global-decision.json'));await packages.getByText(/Recomputed using/).waitFor();assert.deepEqual((await state()).custom,{lat:20,lon:150});assert.equal((await state()).terrainMode,'global-context');
  await page.screenshot({path:resolve(output,'global-coordinate-roundtrip.png')});return {coarseOutcome:coarse.assessment.outcome,coarseEvidence:refs,preparedOutcome:prepared.assessment.outcome,preparedGeneratedWh:prepared.assessment.mission.generatedWh,sourceHashes:roundtrip.sources,sharedState,savedState:saved.at(-1).state};
 });
 await check('paired-number-fields-level-1600-and-390',async()=>{
  await overview();await button('Find landing dates').click();const samples=[];
  for(const width of [1600,390]){await page.setViewportSize({width,height:1000});const first=page.locator('.number-field').filter({hasText:'Stay length'}).locator('input'),second=page.locator('.number-field').filter({hasText:'Minimum Earth visibility'}).locator('input');await first.scrollIntoViewIfNeeded();const a=await first.boundingBox(),b=await second.boundingBox();assert.ok(a&&b);samples.push({width,first:a,second:b});assert.ok(Math.abs(a.y-b.y)<=1,`Paired input tops differ at ${width}px: ${a.y} vs ${b.y}`);await page.screenshot({path:resolve(output,`paired-fields-${width}.png`)});}
  await page.setViewportSize(report.viewport);return samples;
 });
 await check('hide-panels-actual-visibility-and-restoration',async()=>{
  await overview();await drawer();await button('Save to comparison').click();await button('Find landing dates').focus();await page.keyboard.press('Enter');const draft=page.locator('.number-field').filter({hasText:'Stay length'}).locator('input');await draft.fill('');const before=await state();const selectors=['header.app-header','.inspector','.site-drawer','.timeline','.comparison-sheet','.sq-camera','.view-switch','.map-bottom-tools'];const visibility={};for(const selector of selectors)visibility[selector]=await page.locator(selector).first().isVisible();
  await button('Hide panels for unobstructed view').click();await button('Show controls').waitFor();for(const selector of selectors)assert.equal(await page.locator(selector).first().isVisible(),false,`${selector} remained visibly overlaid`);await page.screenshot({path:resolve(output,'unobstructed-actual-hidden.png')});assert.deepEqual(await state(),before);
  await button('Show controls').click();for(const selector of selectors)if(visibility[selector])assert.equal(await page.locator(selector).first().isVisible(),true,`${selector} did not restore`);assert.deepEqual(await state(),before);assert.equal(await draft.inputValue(),'','Numeric draft was reset by Hide panels');return {beforeVisibility:visibility,restored:true,scientificStateUnchanged:true,numericDraftPreserved:true};
 });
 const timing=await page.evaluate(()=>{const values=window.__extended.frames.filter(value=>value>0).sort((a,b)=>a-b);return {frames:values.length,p50Ms:values[Math.floor(values.length*.5)],p95Ms:values[Math.floor(values.length*.95)],maxMs:values.at(-1),navigation:window.__extended.navigation};});report.performanceByContext??={};report.performanceByContext[reduced?'reduced':'normal']=timing;if(!reduced)report.performance=timing;
 const phaseEvents=report.checks.filter(check=>check.reducedMotion===reduced).flatMap(check=>check.detail?.trace??check.navigation??[]).sort((a,b)=>a.time-b.time),windows=[];let start=null;
 for(const event of phaseEvents){if(/Zooming out|Moving around|Approaching/.test(event.text)&&start===null)start=event.time;if(/reached|canceled/.test(event.text)&&start!==null){windows.push({start,end:event.time});start=null;}}
 const frameSamples=await page.evaluate(()=>window.__extended.frameSamples),transitionFrames=frameSamples.filter(sample=>windows.some(window=>sample.time>=window.start&&sample.time<=window.end)).map(sample=>sample.dt).sort((a,b)=>a-b);
 timing.transitionOnly={windows,frames:transitionFrames.length,p50Ms:transitionFrames[Math.floor(transitionFrames.length*.5)]??null,p95Ms:transitionFrames[Math.floor(transitionFrames.length*.95)]??null,maxMs:transitionFrames.at(-1)??null,note:'Observed browser frame intervals during DOM-announced navigation windows, not physical model precision or a hard performance guarantee.'};
 const allPhaseEvents=phaseEvents.filter(event=>/Zooming out|Moving around|Approaching|reached|canceled/.test(event.text));
 timing.byPhase={};
 for(const [name,pattern] of [['zoomOut','Zooming out'],['rotate','Moving around'],['approach','Approaching']]){
  const intervals=[];for(let i=0;i<allPhaseEvents.length-1;i++)if(allPhaseEvents[i].text.includes(pattern))intervals.push({start:allPhaseEvents[i].time,end:allPhaseEvents[i+1].time});
  const values=frameSamples.filter(sample=>intervals.some(interval=>sample.time>=interval.start&&sample.time<=interval.end)).map(sample=>sample.dt).sort((a,b)=>a-b);
  timing.byPhase[name]={intervals,frames:values.length,p95Ms:values[Math.floor(values.length*.95)]??null,maxMs:values.at(-1)??null};
 }
 report.resourceTiming=await page.evaluate(()=>performance.getEntriesByType('resource').filter(entry=>/celestial-models|global-terrain|global-lola/.test(entry.name)).map(entry=>({url:entry.name,transferSize:entry.transferSize,encodedBodySize:entry.encodedBodySize,durationMs:entry.duration}))); 
 await context.close();context=null;
}
try{await run(false);await run(true);assert.equal(report.pageErrors.length,0,'Browser page errors');assert.equal(report.consoleErrors.length,0,'Browser console errors');assert.equal(report.consoleWarnings.filter(warning=>/Too many active WebGL contexts|PCFSoftShadowMap/.test(warning)).length,0,'WebGL context budget or removed shadow map warning');if(options.offline)assert.ok(!report.requests.some(request=>/^https?:/.test(request.url)),'Offline workflow attempted HTTP(S)');}
catch(error){report.checks.push({name:'browser-fatal-or-clean-console',status:'fail',detail:error.stack||error.message});}
finally{if(context)await context.close();await browser.close();report.summary={pass:report.checks.filter(check=>check.status==='pass').length,fail:report.checks.filter(check=>check.status==='fail').length,incomplete:report.incomplete.length};await writeFile(resolve(output,'extended-flows.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary));process.exitCode=report.summary.fail?1:0;}
