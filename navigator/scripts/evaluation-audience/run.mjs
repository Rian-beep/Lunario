#!/usr/bin/env node
// Read-only production evaluation. Launches an isolated browser, never a server.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {hostname,cpus} from 'node:os';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright-core';
import {nativeZoomEstablished,changedPaths,contrastRatio,summarizeChecks} from './checks.mjs';
const opt={url:'http://127.0.0.1:4357/web/index.html',file:'public/solarreach-navigator.html',out:'/tmp/lunario-audience-baseline',section:'journeys',transport:'web',chrome:'/opt/google/chrome/chrome'};
for(let i=2;i<process.argv.length;i+=2){const k=process.argv[i].replace(/^--/,'');if(!(k in opt)||!process.argv[i+1])throw Error(`Unknown/missing option ${k}`);opt[k]=process.argv[i+1];}
assert.ok(['journeys','surfaces','offline'].includes(opt.section));assert.ok(['web','file'].includes(opt.transport));
await mkdir(opt.out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const report={schemaVersion:1,startedUtc:new Date().toISOString(),sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceBase:'3c82b5aa02c4da52053fd3c12c180cca18fd6d4e',hostname:hostname(),cpu:cpus()[0]?.model,options:opt,offlineSha256:sha(await readFile(opt.file)),scriptSha256:sha(await readFile(new URL(import.meta.url))),sessions:[],checks:[],limits:['Agent browser tasks, no human participant or real screen reader.','Mobile is touch/viewport emulation, not real hardware.','SwiftShader is software rendering; reverse tunnel timings do not establish target-device performance.','Selected opaque DOM text contrast only; no global accessibility or imagery-overlay contrast pass.']};
const flags=['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'];
const browser=await chromium.launch({executablePath:opt.chrome,headless:true,args:flags});report.browser=browser.version();
const save=()=>writeFile(join(opt.out,'observations.json'),JSON.stringify(report,null,2)+'\n');
async function snapshot(s,name){const filename=`${s.id}-${name}`;await writeFile(join(opt.out,filename+'.txt'),await s.page.locator('body').innerText());const cdp=await s.context.newCDPSession(s.page);try{const p=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});await writeFile(join(opt.out,filename+'.png'),Buffer.from(p.data,'base64'));}finally{await cdp.detach();}return filename;}
async function step(s,name,actions,fn){const c={session:s.id,name,actions,status:'fail',startedUtc:new Date().toISOString()};report.checks.push(c);console.log('START',s.id,name);try{c.evidence=await fn();c.status=c.evidence?.ok===false?'fail':'pass';}catch(e){c.error=e.stack??String(e);c.dom=await s.page.locator('.site-drawer,.site-list,.site-filter,.coordinate-form,.site-drawer-footer,.inspector').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {class:e.className,rect:{x:r.x,y:r.y,width:r.width,height:r.height},clientHeight:e.clientHeight,scrollHeight:e.scrollHeight};})).catch(()=>[]);}try{c.snapshot=await snapshot(s,name);}catch(e){c.snapshotError=String(e);}await save();console.log(c.status.toUpperCase(),s.id,name,c.error?.split('\n')[0]??'');return c;}
const button=(s,name)=>s.page.getByRole('button',{name,exact:true});
async function dismiss(s){const b=button(s,'Dismiss introduction');if(await b.isVisible())await b.click();}
async function mode(s,name){await s.page.getByRole('group',{name:'Audience mode',exact:true}).getByRole('button',{name,exact:true}).click();await dismiss(s);}
async function details(scope,text){const summary=scope.locator('summary').filter({hasText:text}).first();await summary.waitFor();const d=summary.locator('..');if(!(await d.getAttribute('open')!==null))await summary.click();return d;}
async function state(s){return s.page.evaluate(()=>JSON.parse(localStorage.getItem('solarreach-workbench-v1')));}
async function session(id,{offline=false,mobile=false,context:given}={}){
 const context=given??await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1600,height:1000},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1,acceptDownloads:true});
 offline=offline||opt.transport==='file';if(offline)await context.setOffline(true);
 const page=given?context.pages()[0]:await context.newPage();page.setDefaultTimeout(15000);
 const s={id,context,page,http:[],errors:[],consoleErrors:[],failedRequests:[],responses:[],assetHashes:[],pendingHashes:[],loader:[],offline,mobile};report.sessions.push(s);
 // Keep only serializable evidence on the report object.
 Object.defineProperties(s,{context:{value:context,enumerable:false},page:{value:page,enumerable:false}});
 page.on('pageerror',e=>s.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')s.consoleErrors.push(m.text());});page.on('request',r=>{if(/^https?:/.test(r.url()))s.http.push(r.url());});page.on('requestfailed',r=>s.failedRequests.push({url:r.url(),error:r.failure()?.errorText}));
 page.on('response',r=>{if(/\.(js|css)$|\/(catalog|evidence-manifest)\.json$/.test(r.url()))s.pendingHashes.push(r.body().then(b=>s.assetHashes.push({url:r.url(),status:r.status(),bytes:b.length,sha256:sha(b)})).catch(e=>s.assetHashes.push({url:r.url(),error:String(e)})));if(r.status()>=400)s.responses.push({url:r.url(),status:r.status()});});
 await context.addInitScript(()=>{window.__audienceLoader=[];new MutationObserver(()=>{const visible=!!document.querySelector('.lunario-loader');const a=window.__audienceLoader;if(!a.length||a.at(-1).visible!==visible)a.push({visible,ms:performance.now()});}).observe(document,{subtree:true,childList:true});});
 await step(s,'first-load','Fresh storage/cache context; navigate; wait for original loader and guide; no seed or loader skip.',async()=>{
  const target=offline?pathToFileURL(resolve(opt.file)).href:opt.url;s.url=target;
  await page.goto(target,{waitUntil:'domcontentloaded',timeout:120000});await button(s,'Dismiss introduction').waitFor({timeout:120000});await page.locator('.lunario-loader').waitFor({state:'hidden',timeout:120000});
  s.loader=await page.evaluate(()=>window.__audienceLoader);s.initialTheme=await page.evaluate(()=>document.documentElement.dataset.uiTheme);
  const shown=s.loader.find(x=>x.visible),hidden=s.loader.find(x=>!x.visible&&x.ms>shown?.ms);assert.ok(shown&&hidden);assert.ok(hidden.ms-shown.ms>=2900);
  assert.ok(await button(s,'Play environmental playback').isVisible());return {loaderObservedMs:hidden.ms-shown.ms,pausedOnLoad:true,initialTheme:s.initialTheme};
 });
 await dismiss(s);return s;
}
async function download(s,scope,label){const pending=s.page.waitForEvent('download');await scope.getByRole('button',{name:label==='Download PNG'?/^Download PNG/:label,exact:true}).click();const d=await pending;const path=join(opt.out,`${s.id}-${d.suggestedFilename()}`);await d.saveAs(path);const data=await readFile(path);return {file:path,sha256:sha(data),bytes:data.length};}
async function renderer(s){return s.page.locator('.scene-host canvas').evaluate(c=>{const gl=c.getContext('webgl2')??c.getContext('webgl');const ext=gl?.getExtension('WEBGL_debug_renderer_info');return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl?.getParameter(gl.RENDERER),vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):null};});}
async function journeys(){const s=await session('web');const p=s.page;
 try{
 await step(s,'public-pick-site','Public: Pick a site → Malapert Massif; expand inspector to inspect paired terrain/sphere.',async()=>{
  await button(s,'Pick a site').click();await p.getByRole('button',{name:/^Malapert Massif/}).click();await button(s,'Show inspector').click();assert.equal((await state(s)).siteId,'malapert-massif');const text=await p.locator('.inspector').innerText();assert.match(text,/Smooth sphere/);return {siteId:(await state(s)).siteId,pairedSphere:true};
 });
 await step(s,'public-open-lander','Click Preview a lunar flight, observe deferred view at 5 s, then wait up to 120 s for mounted scene and usable model.',async()=>{
  const start=Date.now();await button(s,'Preview a lunar flight').click();await p.waitForTimeout(5000);const at5s={sceneHosts:await p.locator('.scene-host').count(),terrainText:await p.locator('.terrain-pane').innerText(),elapsedMs:Date.now()-start};await snapshot(s,'lander-at5s');
  await p.locator('.scene-host').waitFor({timeout:120000});await p.waitForFunction(()=>document.querySelector('.scene-host')?.dataset.moonModel==='ready',null,{timeout:120000});
  return {at5s,readyElapsedMs:Date.now()-start,renderer:await renderer(s),dataset:await p.locator('.scene-host').evaluate(e=>({...e.dataset}))};
 });
 await step(s,'public-play-edit-explain-retry','Load assisted reference → speed 50× → Play → pause → edit only Thrust 4000 N → read verdict → reload same reference and replay.',async()=>{
  await p.getByLabel('Reference to load',{exact:true}).selectOption('assisted');await button(s,'Load reference').click();await p.getByLabel('Flight playback speed',{exact:true}).selectOption('50');
  await button(s,'Play experiment').click();await p.waitForFunction(()=>Number(document.querySelector('.scene-host')?.dataset.flightTimeS)>1,null,{timeout:120000});if(await button(s,'Pause experiment').isVisible())await button(s,'Pause experiment').click();
  const before=await state(s),verdictBefore=await p.locator('[data-public-flight-verdict]').innerText();
  const field=p.locator('label.number-field').filter({has:p.getByRole('button',{name:'About Thrust',exact:true})});await field.getByRole('spinbutton').fill('4000');
  await p.waitForFunction(()=>document.querySelector('[data-flight-edit-feedback]')?.textContent.includes('Changed Thrust'));await p.waitForFunction(()=>Number(document.querySelector('.scene-host')?.dataset.flightTimeS)<.1);
  const after=await state(s),verdictAfter=await p.locator('[data-public-flight-verdict]').innerText(),feedback=await p.locator('[data-flight-edit-feedback]').innerText();assert.match(feedback,/reset and paused/);
  const help=field.getByRole('button',{name:'About Thrust',exact:true});await help.focus();await p.keyboard.press('Enter');await p.getByRole('dialog',{name:'About Thrust',exact:true}).waitFor();await snapshot(s,'thrust-help');await p.keyboard.press('Escape');
  await p.getByLabel('Reference to load',{exact:true}).selectOption('assisted');await button(s,'Load reference').click();await button(s,'Replay experiment').click();await p.waitForFunction(()=>Number(document.querySelector('.scene-host')?.dataset.flightTimeS)>1,null,{timeout:120000});if(await button(s,'Pause experiment').isVisible())await button(s,'Pause experiment').click();
  return {verdictBefore,verdictAfter,feedback,changedPaths:changedPaths(before,after),retryStarted:true};
 });
 await step(s,'educator-site-date-native-formula','Select Educator; inspect three native MathML relations; open a relation; preserve current site/date question.',async()=>{
  await mode(s,'Educator');const math=p.locator('.audience-context math');assert.ok(await math.count()>=3);const summary=p.locator('.audience-context summary').filter({hasText:'Understand this relation'}).first();await summary.click();
  return {nativeMath:await math.count(),relations:await math.evaluateAll(es=>es.map(e=>({text:e.textContent,label:e.getAttribute('aria-label')}))),scenario:await state(s)};
 });
 await step(s,'educator-predict-result','Open Teaching studio; predict raised array effect; capture baseline; reveal; compare table; inspect exact plot samples; save conclusion.',async()=>{
  await button(s,'Teaching studio').click();const studio=p.getByRole('dialog',{name:'Teaching studio',exact:true});await studio.getByLabel('Your prediction',{exact:true}).fill('Raising only the array may change generation while antenna contact stays fixed.');await studio.getByRole('button',{name:'Capture current scenario as baseline',exact:true}).click();await studio.getByRole('button',{name:'Reveal computed response',exact:true}).click();
  const table=studio.getByRole('table').filter({hasText:'Full-stay computed results'});await table.waitFor();
  const plot=studio.locator('figure').filter({hasText:'Controlled response across tested inputs'});await plot.locator('summary').filter({hasText:'Exact plotted values'}).click();
  const rows=await table.innerText();const baseline=await state(s);await studio.getByLabel('What did the computed evidence show?',{exact:true}).fill('Agent observation: use the displayed paired terrain/sphere table; array height varies independently of antenna height. No universal or operational conclusion.');await studio.getByRole('button',{name:'Save prediction and conclusion',exact:true}).click();assert.deepEqual(await state(s),baseline);
  s.notebookExport=await download(s,studio,'Export notebook JSON');return {fullStayTable:rows,exactPlotRows:await plot.locator('tbody tr').count(),nativeMath:await studio.locator('math').count(),notebookExport:s.notebookExport};
 });
 await step(s,'educator-export-material','In Teaching studio expand material builder; capture selected scenario; export student worksheet and separate teacher key/JSON; check exact model/scenario and no student answer key.',async()=>{
  const studio=p.getByRole('dialog',{name:'Teaching studio',exact:true});await details(studio,'Create a problem set and teaching materials');await studio.getByRole('button',{name:'Capture current scenario for worksheet',exact:true}).click();
  const student=await download(s,studio,'Export student worksheet'),teacher=await download(s,studio,'Export teacher answer key'),json=await download(s,studio,'Export teacher JSON');const material=JSON.parse(await readFile(json.file,'utf8'));assert.ok(material.questions.length>0);assert.ok(material.modelVersion);await studio.getByRole('button',{name:'Close teaching studio',exact:true}).click();
  return {student,teacher,json,questions:material.questions.length,model:material.modelVersion,focusRestored:await button(s,'Teaching studio').evaluate(e=>e===document.activeElement)};
 });
 await step(s,'planner-delay-alternatives-why','Select Planner → Replan mission → delay candidate +1 day → run explicit 0,24,48 h alternatives → inspect first failure; compare held inputs.',async()=>{
  await mode(s,'Planner');await button(s,'Replan mission').first().click();const dialog=p.getByRole('dialog',{name:'Mission scenario comparisons',exact:true});await dialog.getByRole('button',{name:'Delay candidate by 1 day',exact:true}).click();
  const alternatives=dialog.getByRole('region',{name:'Controlled alternatives',exact:true});await details(alternatives,'Test a bounded date/site grid');await alternatives.getByRole('button',{name:'Test these alternatives',exact:true}).click();await alternatives.getByRole('status').filter({hasText:/Completed/}).waitFor({timeout:90000});
  const inputs=dialog.locator('details').filter({has:dialog.locator('summary').filter({hasText:'Changed and held inputs'})});if(await inputs.count())await inputs.locator('summary').click();
  const why=dialog.getByRole('button',{name:/Inspect first failure/}).first();await why.click();s.replanText=await dialog.innerText();
  return {alternatives:await alternatives.innerText(),text:s.replanText};
 });
 await step(s,'planner-save-export-import','Save delayed candidate with a distinct name; open it; Export current scenario → export decision JSON; import exact download and recompute.',async()=>{
  const dialog=p.getByRole('dialog',{name:'Mission scenario comparisons',exact:true});await dialog.getByLabel('Saved case name',{exact:true}).fill('Agent audience delayed case');await dialog.getByRole('button',{name:'Save candidate',exact:true}).click();await dialog.getByRole('button',{name:'Open candidate',exact:true}).click();
  if(await button(s,'Close comparisons').isVisible())await button(s,'Close comparisons').click();await button(s,'Export current scenario').click();const exports=await details(p,'Export, import & print evidence');s.decisionExport=await download(s,exports,'Export decision JSON');const pkg=JSON.parse(await readFile(s.decisionExport.file,'utf8'));assert.deepEqual(pkg.scenario,await state(s));await exports.locator('input[type=file]').setInputFiles(s.decisionExport.file);await exports.getByRole('status').filter({hasText:/recomputed|imported/i}).waitFor();assert.deepEqual(pkg.scenario,await state(s));return {download:s.decisionExport,model:pkg.modelVersion,scenarioKey:pkg.assessment.scenarioKey,events:pkg.events.length};
 });
 await step(s,'errors-and-artifact-identity','Record actual JS/data resource identities; check browser errors separately from optional requests.',async()=>{
  s.resourceTimings=await p.evaluate(()=>performance.getEntriesByType('resource').map(e=>({url:e.name,durationMs:e.duration,transferSize:e.transferSize})));
  assert.deepEqual(s.errors,[]);return {errors:s.errors,consoleErrors:s.consoleErrors,failedRequests:s.failedRequests,httpErrors:s.responses};
 });
 }finally{await Promise.allSettled(s.pendingHashes);delete s.pendingHashes;await s.context.close();}
}
async function geometry(s){return s.page.evaluate(()=>({dpr:devicePixelRatio,innerWidth,innerHeight,outerWidth,visualScale:visualViewport.scale,documentWidth:document.documentElement.scrollWidth}));}
async function controlBounds(locator){return locator.evaluateAll(es=>es.filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {name:e.getAttribute('aria-label')??e.textContent?.trim(),rect:{x:r.x,y:r.y,width:r.width,height:r.height},inViewport:r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,centerHit:!!hit&&(hit===e||e.contains(hit))};}));}
async function surfaceTasks(s){const p=s.page;
 for(const theme of ['dark','light']){
  if(await button(s,'Close inspector').isVisible())await button(s,'Close inspector').click();
  if(await p.evaluate(()=>document.documentElement.dataset.uiTheme)!==theme)await button(s,`Switch to ${theme} mode`).click();
  await step(s,`${theme}-keyboard-guide-focus`,'Focus Mode guide → Enter → Tab/Shift+Tab loop → Escape → check opener focus. Body Space toggles environmental playback twice.',async()=>{
   const opener=button(s,'Open current mode guide');await opener.focus();await p.keyboard.press('Enter');await button(s,'Dismiss introduction').waitFor();const focus=[];for(let i=0;i<5;i++){await p.keyboard.press('Tab');focus.push(await p.evaluate(()=>({text:document.activeElement.textContent?.slice(0,160),tag:document.activeElement.tagName,inDialog:!!document.activeElement.closest('dialog[open]')})));}await p.keyboard.press('Shift+Tab');await p.keyboard.press('Escape');const restored=await opener.evaluate(e=>e===document.activeElement);await p.locator('body').evaluate(e=>{e.tabIndex=-1;e.focus();});await p.keyboard.press('Space');await button(s,'Pause environmental playback').waitFor();await p.keyboard.press('Space');await button(s,'Play environmental playback').waitFor();assert.ok(restored);assert.ok(focus.every(f=>f.inDialog||f.tag==='BODY'));return {restored,focus,space:true};
  });
  await step(s,`${theme}-site-controls-reflow`,`${s.mobile?'Tap':'Click'} Pick a site; search; select; open inspector; record bounds and document overflow.`,async()=>{
   const hide=button(s,'Hide pick-a-site drawer');if(await hide.isVisible())await hide.click();
   const close=button(s,'Close inspector');if(await close.isVisible())await close.click();
   const pick=button(s,'Pick a site');if(s.mobile)await pick.tap();else await pick.click();const search=p.getByRole('textbox',{name:'Search landing sites',exact:true});await search.fill('Malapert');
   const result=p.getByRole('button',{name:/^Malapert Massif/});const listBefore=await controlBounds(p.locator('.site-list,.site-item,.site-search,.site-filter,.coordinate-form,.site-drawer-footer'));
   let pointerError=null;try{if(s.mobile)await result.tap({timeout:3000});else await result.click({timeout:3000});}catch(e){pointerError=e.message;await snapshot(s,`${theme}-site-pointer-blocked`);await result.focus();await p.keyboard.press('Enter');}
   await button(s,'Show inspector').click();
   const m=await geometry(s);const controls=await controlBounds(p.locator('.app-header button, .view-switch button, .drawer-toggles button'));assert.ok(m.documentWidth<=m.innerWidth+1);return {ok:!pointerError,geometry:m,controls,listBefore,pointerError,keyboardWorkaround:!!pointerError,smallTargets:controls.filter(c=>c.rect.width<24||c.rect.height<24),offscreenControls:controls.filter(c=>!c.inViewport||!c.centerHit)};
  });
  await step(s,`${theme}-charts-copy-contrast`,'Open horizon; inspect axes/units and keyboard sample controls; export PNG; sample opaque text paint; no canvas-wide contrast inference.',async()=>{
   const hide=button(s,'Hide pick-a-site drawer');if(await hide.isVisible())await hide.click();if(await button(s,'Show inspector').isVisible())await button(s,'Show inspector').click();await button(s,'Site overview').click();await button(s,'Inspect the horizon').click();const fig=p.locator('.science-figure').first();await fig.waitFor();const text=await fig.innerText();assert.match(text,/°|deg|elevation|Elevation/);const chart=fig.locator('[tabindex="0"]').first();await chart.focus();await p.keyboard.press('ArrowRight');await p.keyboard.press('End');const image=await download(s,fig,'Download PNG');await s.context.grantPermissions(['clipboard-read','clipboard-write']);await fig.getByRole('button',{name:/^Copy chart image/}).click();await p.waitForTimeout(500);const clipboard=await p.evaluate(async()=>{const items=await navigator.clipboard.read();return Promise.all(items.map(async item=>({types:item.types,pngBytes:item.types.includes('image/png')?(await item.getType('image/png')).size:0})));});
   const paints=await fig.locator('figcaption,svg text,.chart-image-note').evaluateAll(es=>es.filter(e=>e.getClientRects().length).slice(0,30).map(e=>{let a=e,bg;while(a){const c=getComputedStyle(a).backgroundColor;if(/^rgb\(/.test(c)){bg=c;break;}a=a.parentElement;}return {text:e.textContent,fg:getComputedStyle(e).color,fill:e instanceof SVGElement?getComputedStyle(e).fill:null,bg};}));
   const rgb=x=>x?.match(/[\d.]+/g)?.slice(0,3).map(Number);const contrast=paints.map(x=>({...x,ratio:x.bg&&/^rgb\(/.test(x.fill??x.fg)?contrastRatio(rgb(x.fill??x.fg),rgb(x.bg)):null}));return {axes:text.slice(0,4500),image,clipboard,selectedOpaqueContrast:contrast};
  });
 }
}
async function surfaces(){const mobile=await session('mobile',{mobile:true});try{await surfaceTasks(mobile);}finally{await mobile.context.close();}
 const measurements=[];
 for(const factor of [1,2]){const profile=await mkdtemp('/tmp/lunario-audience-zoom-');let context;try{await mkdir(join(profile,'Default'));await writeFile(join(profile,'Default','Preferences'),JSON.stringify({partition:{default_zoom_level:{x:Math.log(factor)/Math.log(1.2)}}}));context=await chromium.launchPersistentContext(profile,{executablePath:opt.chrome,headless:true,viewport:null,args:[...flags,'--window-size=1600,1080']});const s=await session(`native${factor*100}`,{context});const m=await geometry(s);const cdp=await context.newCDPSession(s.page);const raw=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});await cdp.detach();measurements.push({...m,factor,screenshotWidth:Buffer.from(raw.data,'base64').readUInt32BE(16)});if(factor===2)await surfaceTasks(s);}finally{await context?.close();await rm(profile,{recursive:true,force:true});}}
 report.nativeZoom={measurements,established:nativeZoomEstablished(...measurements)};assert.ok(report.nativeZoom.established);await save();
}
async function offline(){const s=await session('offline',{offline:true});try{
 await step(s,'offline-agent-tasks','Disconnected incoming HTML: select Malapert, Public 3D/lander; Educator native formula, teaching studio; keep separate from rebuilt web.',async()=>{
  await button(s,'Pick a site').click();await s.page.getByRole('button',{name:/^Malapert Massif/}).click();await button(s,'Show inspector').click();await button(s,'Preview a lunar flight').click();await s.page.locator('.scene-host').waitFor({timeout:120000});await s.page.waitForFunction(()=>document.querySelector('.scene-host')?.dataset.moonModel==='ready',null,{timeout:120000});await mode(s,'Educator');await button(s,'Teaching studio').click();await s.page.getByRole('dialog',{name:'Teaching studio',exact:true}).getByLabel('Your prediction',{exact:true}).waitFor();return {renderer:await renderer(s),httpRequests:s.http.length};
 });
 await step(s,'offline-no-network-errors','Check HTTP attempts and uncaught errors; record missing optional data without suppressing warnings.',async()=>{assert.deepEqual(s.http,[]);assert.deepEqual(s.errors,[]);return {errors:s.errors,consoleErrors:s.consoleErrors,http:s.http};});
 }finally{await Promise.allSettled(s.pendingHashes);delete s.pendingHashes;await s.context.close();}}
try{
 if(opt.section==='journeys'&&opt.transport==='web'){
  const receipt=await fetch(new URL('build-receipt.json',opt.url),{signal:AbortSignal.timeout(20000)});if(receipt.ok){const bytes=Buffer.from(await receipt.arrayBuffer());report.servedBuildReceipt={sha256:sha(bytes)};await writeFile(join(opt.out,'served-build-receipt.json'),bytes);}
  const res=await fetch(opt.url,{signal:AbortSignal.timeout(20000)});const b=Buffer.from(await res.arrayBuffer());report.webIndex={sha256:sha(b),bytes:b.length};await writeFile(join(opt.out,'served-index.html'),b);
 }
 if(opt.section==='journeys')await journeys();else if(opt.section==='surfaces')await surfaces();else await offline();
}catch(e){report.fatal=e.stack??String(e);}finally{
 report.offlineSha256After=sha(await readFile(opt.file));report.scriptSha256After=sha(await readFile(new URL(import.meta.url)));assert.equal(report.scriptSha256After,report.scriptSha256);report.finishedUtc=new Date().toISOString();report.summary=summarizeChecks(report.checks);await save();await browser.close();console.log(JSON.stringify({summary:report.summary,nativeZoom:report.nativeZoom,fatal:report.fatal}));if(report.fatal||report.summary.failed)process.exitCode=1;
}
