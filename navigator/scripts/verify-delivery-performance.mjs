#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';import os from 'node:os';import {createHash} from 'node:crypto';
import {build} from 'esbuild';import {chromium} from 'playwright-core';
const opts={};for(let i=2;i<process.argv.length;i++){const k=process.argv[i];if(k==='--offline'){opts.offline=true;continue;}if(!['--base-url','--file','--output'].includes(k)||!process.argv[i+1]||opts[k])throw Error('Usage: (--base-url URL | --file PATH) --output DIR [--offline]');opts[k]=process.argv[++i];}
if(!opts['--output']||Boolean(opts['--file'])===Boolean(opts['--base-url']))throw Error('Choose exactly one target and output');
if(opts['--base-url']&&!['http:','https:'].includes(new URL(opts['--base-url']).protocol))throw Error('HTTP(S) URL required');
const root=process.cwd(),output=resolve(opts['--output']);await mkdir(output,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
const target=opts['--file']?pathToFileURL(resolve(opts['--file'])).href:opts['--base-url'];
const imp=path=>JSON.stringify(resolve(root,path));
const bridge=await build({stdin:{contents:`import {loadCatalog} from ${imp('lib/catalog.ts')};import {loadEvidenceManifest} from ${imp('lib/provenance.ts')};import {searchMissionWindows} from ${imp('lib/planning-search.ts')};import {PLANNING_MODEL_VERSION} from ${imp('lib/assessment.ts')};globalThis.__deliveryBridge={loadCatalog,loadEvidenceManifest,searchMissionWindows,modelVersion:PLANNING_MODEL_VERSION};`,resolveDir:root,loader:'ts'},bundle:true,write:false,format:'iife',platform:'browser',target:'es2020',metafile:true});
const sourceHashes=[];for(const file of Object.keys(bridge.metafile.inputs).filter(f=>f!=='<stdin>').sort()){const bytes=await readFile(resolve(root,file));sourceHashes.push({path:file,sha256:hash(bytes),bytes:bytes.length});}
const report={checkedUtc:new Date().toISOString(),target,offline:!!opts.offline,hardware:{hostname:os.hostname(),platform:os.platform(),release:os.release(),architecture:os.arch(),cpuModel:os.cpus()[0]?.model,cpuCount:os.cpus().length,totalMemoryBytes:os.totalmem()},viewport:{width:1600,height:1000},sourceHashes,bridgeSha256:hash(bridge.outputFiles[0].contents),checks:[],pageErrors:[],httpRequests:[],limits:['Single cold browser-context observations; OS/disk cache not flushed; no CPU throttling or universal latency cutoff.','Bridge bundles the actual production modules from the command working directory; it is not a separate search model.','App-ready means named workbench visible; 3D-ready means canvas, NASA Moon and equipment ready, with no surface preparation in progress.']};
if(opts['--file']){const bytes=await readFile(resolve(opts['--file']));report.artifact={path:resolve(opts['--file']),bytes:bytes.length,sha256:hash(bytes)};}
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});report.browser=browser.version();
async function open(){const context=await browser.newContext({viewport:report.viewport,reducedMotion:'reduce'});if(opts.offline)await context.setOffline(true);const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.pageErrors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))report.httpRequests.push(r.url());});return{context,page};}
async function step(name,fn){try{const detail=await fn();report.checks.push({name,status:'pass',detail});console.log(`PASS ${name} ${JSON.stringify(detail)}`);return detail;}catch(e){report.checks.push({name,status:'fail',error:e.stack});console.error(`FAIL ${name}: ${e.message}`);throw e;}}
try{
 const {context,page}=await open();
 await step('initial-application-ready',async()=>{const start=performance.now(),response=await page.goto(target,{waitUntil:'domcontentloaded',timeout:120000});if(!report.artifact&&response){const bytes=await response.body();report.document={bytes:bytes.length,sha256:hash(bytes),status:response.status()};}await page.getByLabel('Lunar workbench',{exact:true}).waitFor({timeout:120000});return{elapsedMs:performance.now()-start,navigation:await page.evaluate(()=>performance.getEntriesByType('navigation')[0]?.toJSON())};});
 await step('3d-activation-to-nasa-terrain-and-lander-ready',async()=>{const dismiss=page.getByRole('button',{name:'Dismiss introduction',exact:true});if(await dismiss.isVisible())await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});const start=performance.now();await page.getByRole('button',{name:'3D terrain',exact:true}).click();await page.waitForFunction(()=>{const h=document.querySelector('.scene-host');return h?.querySelector('canvas')&&h.dataset.moonModel==='ready'&&h.dataset.surfaceStatus!=='preparing'&&document.body.textContent.includes('Equipment status: ready');},null,{timeout:120000});const elapsedMs=performance.now()-start;await page.screenshot({path:resolve(output,'3d-ready.png')});return{elapsedMs,scene:await page.locator('.scene-host').evaluate(n=>({...n.dataset}))};});
 await context.close();
 const search=await open();await search.page.goto(target,{waitUntil:'load',timeout:120000});await search.page.getByLabel('Lunar workbench',{exact:true}).waitFor({timeout:120000});await search.page.addScriptTag({content:bridge.outputFiles[0].text});
 const metrics=await step('actual-1000-start-search-and-cancel',()=>search.page.evaluate(async()=>{
  const rawCatalog=globalThis.__SOLARREACH_CATALOG__??await(await fetch('/data/catalog.json')).json(),rawManifest=globalThis.__SOLARREACH_EVIDENCE__??await(await fetch('/data/evidence-manifest.json')).json();
  globalThis.__SOLARREACH_CATALOG__=rawCatalog;globalThis.__SOLARREACH_EVIDENCE__=rawManifest;
  const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))).map(n=>n.toString(16).padStart(2,'0')).join('');
  const dataHashes={encoding:'SHA-256 of JSON.stringify parsed/injected raw values',catalog:await digest(rawCatalog),manifest:await digest(rawManifest)};
  const b=globalThis.__deliveryBridge,catalog=await b.loadCatalog(),manifest=await b.loadEvidenceManifest(),demo=globalThis.__SOLARREACH_PLANNING_DEMO__??await(await fetch('/data/planning-demo.json')).json();
  const base=structuredClone(demo.cases.find(c=>c.role==='baseline').state),step=1/catalog.meta.stepHours,duration=336/catalog.meta.stepHours;
  if(!Number.isInteger(step)||!Number.isInteger(duration))throw Error('Hourly/14-day benchmark is unsupported by actual catalog cadence');
  const first=Math.max(0,Math.min(base.startIndex,catalog.meta.n-1-duration-999*step));base.startIndex=first;base.endIndex=first+duration-1;base.terrainMode='prepared';
  const request={base,siteIds:[base.siteId],firstStartIndex:first,lastStartIndex:first+999*step,durationSamples:duration,startStepSamples:step,maxResults:20};
  let timerTicks=0,frames=0,last=performance.now(),maxTimerGapMs=0,run=true;
  const timer=setInterval(()=>{const now=performance.now();maxTimerGapMs=Math.max(maxTimerGapMs,now-last);last=now;timerTicks++;},10);
  const raf=()=>{if(run){frames++;requestAnimationFrame(raf);}};requestAnimationFrame(raf);
  const progress=[],start=performance.now();let result;
  try{result=await b.searchMissionWindows(catalog,manifest,request,{onProgress:p=>progress.push({completed:p.completed,elapsedMs:performance.now()-start})});}finally{run=false;clearInterval(timer);}
  const elapsedMs=performance.now()-start;
  const controller=new AbortController();let requestedAt=null,completedAtAbort=null,cancelName=null,cancelElapsedMs=null;
  try{await b.searchMissionWindows(catalog,manifest,request,{signal:controller.signal,onProgress:p=>{if(p.completed>0&&requestedAt===null){completedAtAbort=p.completed;requestedAt=performance.now();controller.abort();}}});}catch(e){cancelName=e.name;cancelElapsedMs=requestedAt===null?null:performance.now()-requestedAt;}
  return{elapsedMs,dataHashes,counts:result.counts,retained:result.rows.length,request,modelVersion:b.modelVersion,datasetId:manifest.datasetId,timerTicks,frames,maxTimerGapMs,progress,cancel:{name:cancelName,elapsedMs:cancelElapsedMs,completedAtAbort}};
 }));
 await step('benchmark-counts-responsiveness-and-abort-assertions',async()=>{assert.equal(metrics.counts.evaluated,1000);assert.equal(metrics.counts.outside,0);assert.ok(metrics.timerTicks>0,'Search must yield to timer heartbeat');assert.ok(metrics.frames>0,'Search must yield to rendering heartbeat');assert.equal(metrics.cancel.name,'AbortError');assert.ok(metrics.cancel.completedAtAbort>0&&metrics.cancel.completedAtAbort<1000);assert.ok(metrics.cancel.elapsedMs!==null);return{evaluated:metrics.counts.evaluated,timerTicks:metrics.timerTicks,frames:metrics.frames,cancel:metrics.cancel};});
 await search.context.close();
 await step('browser-errors-and-offline-network',async()=>{assert.deepEqual(report.pageErrors,[]);if(opts.offline)assert.deepEqual(report.httpRequests,[]);return{httpRequests:report.httpRequests.length};});
}catch(error){report.failure=error.stack;}
finally{await browser.close();report.failed=report.checks.filter(c=>c.status==='fail').length+(report.failure&&!report.checks.some(c=>c.status==='fail')?1:0);await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));}
if(report.failed)process.exitCode=1;
