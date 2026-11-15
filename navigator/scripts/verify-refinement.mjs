#!/usr/bin/env node
// Independent black-box workflow checks. All scenario/evidence writes use production file import.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {appendFile, mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {arch,cpus,hostname,platform,totalmem} from 'node:os';

const options = {marker:'/tmp/solarreach-refinement-c15-ready.json', instructions:'/tmp/refinement-c15-qa-instructions.txt', sourceBundle:'/tmp/lunar-window-c15-source.bundle', output:'/tmp/solarreach-refinement-workflows-c15', section:'all', mode:'both'};
for (let i=2;i<process.argv.length;i+=2) {
  const key=process.argv[i].replace(/^--/,'');
  if (!(key in options)||!process.argv[i+1]) throw Error('Options: --marker PATH --instructions PATH --sourceBundle PATH --output DIR --section all|public|replan|teaching|engineering --mode both|http|file');
  options[key]=process.argv[i+1];
}
assert.ok(['both','http','file'].includes(options.mode));
assert.ok(['all','public','replan','teaching','engineering'].includes(options.section));
const output=resolve(options.output), findings='/tmp/refine-workflow-qa-findings.txt';
await mkdir(output,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const instructions=await readFile(options.instructions,'utf8');
console.log(instructions.trim());
const markerBytes=await readFile(options.marker), marker=JSON.parse(markerBytes);
await writeFile(resolve(output,'candidate-marker-before.json'),markerBytes);await writeFile(resolve(output,'candidate-instructions-before.txt'),instructions);
for (const k of ['artifactPath','artifactSha256','sourceCommit','sourceCheckPath','url']) assert.ok(marker[k],`Missing marker ${k}`);
const verifierPath=new URL(import.meta.url),verifierBefore=await readFile(verifierPath);
await writeFile(resolve(output,'verifier-before.mjs'),verifierBefore);
const sourcePath=resolve(marker.sourceCheckPath);
const sourceGit=(...args)=>execFileSync('git',['-C',sourcePath,...args],{encoding:'utf8'}).trim();
const sourceIdentity={path:sourcePath,commit:sourceGit('rev-parse','HEAD'),status:sourceGit('status','--porcelain')};
assert.match(marker.sourceCommit,/^[0-9a-f]{40}$/,'Full formatted sourceCommit required');
assert.equal(sourceIdentity.commit,marker.sourceCommit,'Candidate read-only source identity');
assert.equal(sourceIdentity.status,'','Candidate source must start clean');
const sourceBundleBefore=await readFile(options.sourceBundle);
const sourceBundleHeads=execFileSync('git',['bundle','list-heads',options.sourceBundle],{encoding:'utf8'}).trim();
assert.ok(sourceBundleHeads.split('\n').some(line=>line.split(' ')[0]===marker.sourceCommit),'Source bundle must contain the published source commit');
execFileSync('git',['bundle','verify',resolve(options.sourceBundle)],{cwd:sourcePath,stdio:'pipe'});
await writeFile(resolve(output,'source-bundle-before.bundle'),sourceBundleBefore);
const artifact=await readFile(marker.artifactPath);
await writeFile(resolve(output,'candidate-artifact-before.html'),artifact);
assert.equal(sha(artifact),marker.artifactSha256,'Published file hash');
const response=await fetch(marker.url);
assert.equal(response.status,200);
const httpBytes=Buffer.from(await response.arrayBuffer());
assert.equal(sha(httpBytes),marker.artifactSha256,'HTTP must serve the exact offline bytes');
const modulePath=process.env.PLAYWRIGHT_CORE_MODULE||'/home/luke/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs';
const {chromium}=await import(modulePath.startsWith('/')?pathToFileURL(modulePath).href:modulePath);
const playwrightPackage=await readFile(new URL('./package.json',import.meta.resolve(modulePath.startsWith('/')?pathToFileURL(modulePath).href:modulePath)));
const executable=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/usr/bin/google-chrome';
const flags=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'];
const report={startedUtc:new Date().toISOString(),options,marker,markerBytes:markerBytes.length,markerSha256:sha(markerBytes),artifactBytes:artifact.length,httpBytes:httpBytes.length,httpSha256:sha(httpBytes),instructions,instructionsSha256:sha(instructions),
  sourceIdentity,sourceBundle:{path:resolve(options.sourceBundle),bytes:sourceBundleBefore.length,sha256:sha(sourceBundleBefore),heads:sourceBundleHeads},verifierSha256:sha(verifierBefore),sourceCheckout:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  chrome:execFileSync(executable,['--version'],{encoding:'utf8'}).trim(),playwrightModule:modulePath,flags,checks:[],sessions:[],
  playwrightVersion:JSON.parse(playwrightPackage).version,playwrightPackageSha256:sha(playwrightPackage),host:{hostname:hostname(),platform:platform(),arch:arch(),cpu:cpus()[0]?.model,logicalCpus:cpus().length,totalMemoryBytes:totalmem()},
  limitations:['Agent walkthrough only; human acceptance, screen-reader and mission qualification unperformed.','Fresh contexts; OS/server/disk caches not flushed. SwiftShader is software rendering, not GPU performance evidence.','Provider transport mocks are labelled failure/cancellation tests; archived official observer imports are not live success.','Physical Follow/contact is owned by a separate lane. No application numerical helpers are imported or called.']};
const browser=await chromium.launch({headless:true,executablePath:executable,args:flags});
report.browserVersion=browser.version();
let serial=0;
const button=(scope,name)=>scope.getByRole('button',{name,exact:true});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,description,timeout=12000){const end=Date.now()+timeout;let result;while(Date.now()<end){result=await fn();if(result)return result;await pause(120);}throw Error(`Timed out: ${description}`);}
async function details(scope,name){const summary=scope.locator('summary').filter({hasText:name}).first();const parent=summary.locator('..');if(await parent.getAttribute('open')===null)await summary.click();return parent;}
async function downloadFile(page,scope,name,label){const pending=page.waitForEvent('download');await button(scope,name).click();const d=await pending;const path=resolve(output,`${++serial}-${label}-${d.suggestedFilename()}`);await d.saveAs(path);const bytes=await readFile(path);return {path,filename:d.suggestedFilename(),sha256:sha(bytes),text:bytes.toString()};}
async function download(page,scope,name,label){const result=await downloadFile(page,scope,name,label);return {...result,value:JSON.parse(result.text)};}
async function inspectDownloadedHtml(file,label){
 const context=await browser.newContext({viewport:{width:1100,height:1000},acceptDownloads:false});await context.setOffline(true);
 const page=await context.newPage(),requests=[],errors=[];page.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url());});page.on('pageerror',error=>errors.push(error.message));
 try{await page.goto(pathToFileURL(file.path).href,{waitUntil:'load'});
  // A loaded download can lack a composited frame; require foreground font/paint readiness before capture.
  await page.bringToFront();await page.evaluate(async()=>{await document.fonts.ready;await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));});
  const result=await page.evaluate(()=>({title:document.title,text:document.body.innerText,allText:document.documentElement.textContent,math:document.querySelectorAll('math').length,mathNamespaces:[...new Set([...document.querySelectorAll('math')].map(el=>el.namespaceURI))],tables:[...document.querySelectorAll('table')].map(table=>({caption:table.caption?.innerText,rows:[...table.querySelectorAll('tbody tr')].map(row=>row.innerText)})),scripts:[...document.scripts].map(script=>({type:script.type,text:script.textContent})),articles:[...document.querySelectorAll('article')].map(el=>el.innerText),articleDetails:[...document.querySelectorAll('article')].map(el=>({text:el.innerText,math:[...el.querySelectorAll('math')].map(m=>({label:m.getAttribute('aria-label'),text:m.textContent,subscripts:m.querySelectorAll('msub').length})),definitions:[...el.querySelectorAll('dl')].map(dl=>dl.innerText)})),givens:[...document.querySelectorAll('dl')].map(el=>[...el.children].map(item=>item.innerText)),givenValues:[...document.querySelectorAll('article')].map(el=>[...el.querySelectorAll('dl')].at(-1)).map(dl=>[...dl.querySelectorAll('dt')].map(dt=>({label:[...dt.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('').trim(),symbol:dt.querySelector('math')?{text:dt.querySelector('math').textContent,subscripts:dt.querySelector('math').querySelectorAll('msub').length}:null,value:dt.nextElementSibling.innerText}))),hidden:[...document.querySelectorAll('[hidden],input[type=hidden],template')].map(el=>el.outerHTML),editedElements:document.querySelectorAll('[data-qa-edited]').length}));
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[],'Downloaded HTML must be self-contained offline');await page.screenshot({path:resolve(output,`${label}-downloaded.png`),fullPage:true,timeout:30000});return {...result,requests,errors,path:file.path,sha256:file.sha256};
 }finally{await context.close();}
}
async function guide(page){const dismiss=button(page,'Dismiss introduction');if(await dismiss.isVisible()){await page.keyboard.press('Escape');await dismiss.waitFor({state:'hidden'});}}
async function planner(page){await button(page,'Planner').click();await guide(page);await page.getByRole('region',{name:'Mission decision assessment'}).waitFor();}
async function exportDecision(page,label){await planner(page);const controls=await details(page,'Export, import & print evidence');const result=await download(page,controls,'Export decision JSON',label);assert.ok(result.value.assessment.scenarioKey);return result.value;}
async function importDecision(page,pkg,label){await planner(page);const controls=await details(page,'Export, import & print evidence');const path=resolve(output,`${++serial}-${label}-decision-fixture.json`);await writeFile(path,JSON.stringify(pkg));await controls.locator('input[type=file]').setInputFiles(path);await controls.getByRole('status').filter({hasText:/Recomputed/}).waitFor();return path;}
async function importEngineering(scope,value,label){const path=resolve(output,`${++serial}-${label}.json`);await writeFile(path,typeof value==='string'?value:JSON.stringify(value));await scope.locator('input[type=file]').setInputFiles(path);return path;}
async function modal(page,name){const d=page.getByRole('dialog',{name,exact:true});await d.waitFor();assert.equal(await d.getAttribute('open'),'');assert.equal(await d.locator('xpath=self::dialog').count(),1);await until(async()=>await d.and(page.locator(':focus-within')).count(),'Native modal has focus (dialog itself or descendant)');return d;}
async function closeEngineering(page){const d=page.getByRole('dialog',{name:'Engineering evidence workspace',exact:true});if(await d.isVisible())await button(d,'Close engineering').click();}
async function openEngineering(page){await planner(page);await button(page,'Engineering evidence').click();return modal(page,'Engineering evidence workspace');}
async function replan(page){await button(page,'Replan mission').first().click();const r=page.locator('[data-replanning-workspace]');await r.waitFor();if(await r.locator('summary').filter({hasText:'Choose current or saved reference and candidate'}).count())await details(r,'Choose current or saved reference and candidate');return r;}
async function closeReplan(page){const b=button(page,'Close comparisons');if(await b.isVisible())await b.click();}
async function saveCandidate(r,name){await r.getByLabel('Saved case name',{exact:true}).fill(name);await button(r,'Save candidate').click();await r.getByRole('status').filter({hasText:`Saved “${name}”.`}).waitFor();}
async function documentGeometry(page){return page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,bodyScrollWidth:document.body.scrollWidth,height:innerHeight}));}
function luminance(rgb){const channels=rgb.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>{const v=n/255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;});return channels.reduce((sum,n,i)=>sum+n*[0.2126,0.7152,0.0722][i],0);}
async function sceneIdentity(page){const host=page.locator('.scene-host');await until(async()=>await host.getAttribute('data-scene-instance'),'scene instance',60000);await host.locator('canvas').waitFor();return {instance:await host.getAttribute('data-scene-instance'),canvasCount:await host.locator('canvas').count()};}

try {
 for (const mode of options.mode==='both'?['http','file']:[options.mode]) {
  const context=await browser.newContext({viewport:{width:1600,height:1100},reducedMotion:'reduce',acceptDownloads:true});
  if(mode==='file')await context.setOffline(true);
  const page=await context.newPage();page.setDefaultTimeout(12000);
  const session={mode,requests:[],failedRequests:[],httpErrors:[],pageErrors:[],consoleErrors:[],transportMock:null};report.sessions.push(session);
  page.on('request',r=>{if(/^https?:/.test(r.url()))session.requests.push({url:r.url(),mock:session.transportMock});});
  page.on('requestfailed',r=>session.failedRequests.push({url:r.url(),error:r.failure(),mock:session.transportMock}));
  page.on('response',r=>{if(r.status()>=400)session.httpErrors.push({url:r.url(),status:r.status(),mock:session.transportMock});});
  page.on('pageerror',e=>session.pageErrors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')session.consoleErrors.push({text:m.text(),mock:session.transportMock});});
  const target=mode==='file'?pathToFileURL(resolve(marker.artifactPath)).href:marker.url;
  async function step(name,fn){const start=Date.now();try{const evidence=await fn();const geometry=await documentGeometry(page);assert.ok(geometry.scrollWidth<=geometry.width+1,`Horizontal document overflow: ${JSON.stringify(geometry)}`);await page.screenshot({path:resolve(output,`${mode}-${name}.png`),timeout:name==='bootstrap-exact-artifact'?30000:12000});report.checks.push({mode,name,status:'pass',ms:Date.now()-start,evidence});console.log(`PASS ${mode} ${name}`);return true;}catch(error){const failure={mode,name,status:'fail',ms:Date.now()-start,error:error.stack};report.checks.push(failure);await page.screenshot({path:resolve(output,`${mode}-${name}-FAIL.png`)}).catch(()=>{});await writeFile(resolve(output,`${mode}-${name}-DOM.txt`),await page.locator('body').innerText().catch(()=>''));await appendFile(findings,`\n${new Date().toISOString()} ${marker.artifactSha256} ${mode} ${name}\n${error.stack}\nEvidence ${output}\n`);console.error(`FAIL ${mode} ${name}: ${error.message}`);return false;}finally{await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));}}
  try {
   if(!await step('bootstrap-exact-artifact',async()=>{await page.goto(target,{waitUntil:'load',timeout:90000});await page.getByLabel('Lunar workbench',{exact:true}).waitFor({timeout:90000});await guide(page);return {target,sha256:marker.artifactSha256};}))continue;
   await step('lunar-window-default-dark-pale-text-responsive',async()=>{
    assert.match(await page.title(),/Lunar Window/);assert.ok((await page.locator('.app-header').innerText()).includes('Lunar Window'));
    const colors=await page.locator('body').evaluate(el=>({background:getComputedStyle(el).backgroundColor,text:getComputedStyle(el).color,colorScheme:getComputedStyle(el).colorScheme}));
    const background=luminance(colors.background),foreground=luminance(colors.text);assert.ok(background<0.1,`Dark background: ${colors.background}`);assert.ok(foreground>0.55,`Pale text: ${colors.text}`);assert.ok((foreground+0.05)/(background+0.05)>=4.5);assert.match(colors.colorScheme,/dark/);
    const sizes=[];try{for(const width of [1600,800,390]){await page.setViewportSize({width,height:1100});await pause(150);const geometry=await documentGeometry(page);assert.ok(geometry.scrollWidth<=width+1,`Horizontal overflow at ${width}: ${JSON.stringify(geometry)}`);sizes.push(geometry);}}finally{await page.setViewportSize({width:1600,height:1100});}
    return {colors,backgroundLuminance:background,textLuminance:foreground,sizes,scope:'Rendered theme and document bounds only; no physical or mission qualification.'};
   });
   if(options.section==='all'||options.section==='public'){
    await step('fresh-public-guidance-dismiss-restore',async()=>{
     const strip=page.getByRole('region',{name:'Audience task context'});const text=await strip.innerText();assert.match(text,/At this sampled moment/);assert.match(text,/Whole stay/);assert.match(text,/Smooth sphere|sphere/);assert.match(text,/not assessed|missing|shortfall|conditional|unassessed|only within.*model/i);
     await button(strip,'Dismiss audience guidance').click();await button(strip,'Show stay guidance').waitFor();await button(strip,'Show stay guidance').click();assert.equal(await strip.innerText(),text);return {copy:text};
    });
    await step('audience-switch-exact-input-preservation',async()=>{const before=await exportDecision(page,'before-audiences');await button(page,'Educator').click();await guide(page);await button(page,'Public').click();await guide(page);const after=await exportDecision(page,'after-audiences');assert.deepEqual(after.scenario,before.scenario);assert.equal(after.assessment.scenarioKey,before.assessment.scenarioKey);return {scenarioKey:after.assessment.scenarioKey};});
   }
   let seed;
   if(!await step('production-scenario-export-and-reference-date-import',async()=>{
    seed=await exportDecision(page,`${mode}-initial`);const fixture=JSON.parse(await readFile(resolve(sourcePath,'public/data/engineering-evidence/goldstone-horizons.json'),'utf8'));
    const meta=JSON.parse(await readFile(resolve(sourcePath,'public/data/catalog.json'),'utf8')).meta;
    // Independent UTC arithmetic only; the imported package is explicitly a new input, not trusted historical results.
    seed.scenario.startIndex=(Date.parse(fixture.request.startUtc)-Date.parse(meta.t0))/(meta.stepHours*3600000);
    seed.scenario.endIndex=seed.scenario.startIndex+23;
    await importDecision(page,seed,'archived-station-date');seed=await exportDecision(page,'reference-date-recomputed');
    assert.equal(Date.parse(seed.interval.startUtc),Date.parse(fixture.request.startUtc));assert.equal(Date.parse(seed.interval.endUtcExclusive),Date.parse(fixture.request.endUtc));assert.equal(seed.assessment.mission.timeline.length,24);
    await importDecision(page,seed,'roundtrip');assert.deepEqual((await exportDecision(page,'roundtrip-check')).scenario,seed.scenario);return {scenarioKey:seed.assessment.scenarioKey,startUtc:seed.interval.startUtc,endUtc:seed.interval.endUtcExclusive,fixtureSha256:sha(await readFile(resolve(sourcePath,'public/data/engineering-evidence/goldstone-horizons.json')))};
   }))continue;
   if(options.section==='all'||options.section==='replan'){
    let r,referenceTimes,candidateState,deltaReadout;
    await step('replan-quick-arrival-site-invalid-and-held-state',async()=>{
     r=await replan(page);const times=await r.locator('time').allTextContents();await button(r,'Delay candidate by 1 day').click();let shifted=await r.locator('time').allTextContents();assert.equal(shifted[0],times[0]);assert.equal(Date.parse(shifted[1])-Date.parse(times[1]),24*3600000);await button(r,'Delay candidate by 7 days').click();shifted=await r.locator('time').allTextContents();assert.equal(Date.parse(shifted[1])-Date.parse(times[1]),192*3600000);
     const arrival=r.getByLabel('Candidate arrival (UTC)',{exact:true});const type=await arrival.getAttribute('type');await arrival.fill(type==='date'?'2025-01-01':'2025-01-01T00:00');await arrival.blur();assert.ok(await arrival.and(page.locator(':invalid')).count()||await r.getByRole('alert').count(),'Unavailable arrival must be invalid or explicitly rejected');assert.deepEqual(await r.locator('time').allTextContents(),shifted);await r.getByRole('combobox',{name:'Candidate case',exact:true}).selectOption('current');
     const catalog=JSON.parse(await readFile(resolve(sourcePath,'public/data/catalog.json'),'utf8'));const alternate=catalog.sites.find(s=>s.id!==seed.scenario.siteId&&s.horizons.length);await r.getByLabel('Candidate site',{exact:true}).selectOption(alternate.id);assert.match(await r.getByRole('article',{name:/^Candidate:/}).innerText(),new RegExp(alternate.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));assert.equal((await r.locator('time').allTextContents())[0],times[0]);
     await closeReplan(page);assert.deepEqual((await exportDecision(page,'quick-controls-held-active')).scenario,seed.scenario);return {afterOneAndSevenDays:shifted,alternativeSite:alternate.id,activeUnchanged:true,referenceUnchanged:true};
    });
    await closeReplan(page);
    const ready=await step('replan-independent-captures-elapsed-and-curves',async()=>{
     r=await replan(page);await r.getByRole('combobox',{name:'Reference case',exact:true}).selectOption('current');await r.getByRole('combobox',{name:'Candidate case',exact:true}).selectOption('current');
     await saveCandidate(r,'QA reference 24h');referenceTimes=await r.locator('time').allTextContents();const identicalDeltas=await r.getByRole('region',{name:'Candidate minus reference results'}).getByRole('cell').allTextContents();assert.ok(identicalDeltas.every(v=>/^0 |Unknown/.test(v)),'Identical cases must have zero or unknown deltas');
     await r.getByLabel('Date shift (h)',{exact:true}).fill('48');await button(r,'Preview controlled change').click();const times=await r.locator('time').allTextContents();assert.equal(Date.parse(times[1])-Date.parse(times[0]),48*3600000);assert.equal(times[0],referenceTimes[0]);
     const option=r.getByRole('combobox',{name:'Time alignment',exact:true}).locator('option[value=utc]');assert.notEqual(await option.getAttribute('disabled'),null,'No overlapping UTC must be disabled');
     await button(r,'Next sample').click();const advanced=await r.locator('time').allTextContents();assert.equal(Date.parse(advanced[0])-Date.parse(times[0]),3600000);assert.equal(Date.parse(advanced[1])-Date.parse(times[1]),3600000);
     const sliders=r.locator('svg[role=slider]');if(await button(r,'Show all curves').isVisible())await button(r,'Show all curves').click();assert.ok(await sliders.count()>=3);for(const s of await sliders.all()){assert.ok((await s.getAttribute('aria-valuetext')).length>20);assert.ok(await s.locator('path[d]').count()>2);}
     await r.getByRole('region',{name:'Candidate minus reference results'}).waitFor();assert.ok(await r.getByRole('cell',{name:/Wh|%|h/}).count()>10);
     const ref=r.getByRole('article',{name:/^Reference:/});const referenceRows=await ref.locator('table').first().locator('tbody tr').allTextContents();
     const storage=ref.locator('table').first().getByRole('row',{name:/Minimum storage/}).getByRole('cell');for(const [i,mission] of [seed.assessment.mission,seed.assessment.sphereMission].entries()){const value=mission.minBatteryWh;if(value===null)assert.match(await storage.nth(i).innerText(),/Unknown/);else assert.ok(Math.abs(Number((await storage.nth(i).innerText()).replaceAll(',','').replace(' Wh',''))-value)<=0.006);}
     const before=seed.scenario;await saveCandidate(r,'QA shifted 48h');await closeReplan(page);assert.deepEqual((await exportDecision(page,'browsing-does-not-apply')).scenario,before);
     r=await replan(page);await r.getByRole('combobox',{name:'Reference case',exact:true}).selectOption({label:'QA reference 24h (saved)'});await r.getByRole('combobox',{name:'Candidate case',exact:true}).selectOption({label:'QA shifted 48h (saved)'});deltaReadout=await r.getByRole('region',{name:'Candidate minus reference results'}).getByRole('row',{name:/Unserved demand/}).getByRole('cell').allTextContents();return {times,advanced,plots:await sliders.count(),referenceRows,identicalDeltas,deltaReadout};
    });
    if(ready){
     await step('replan-invalid-and-bounded-grid',async()=>{
      await r.getByLabel('Date shift (h)',{exact:true}).fill('');await button(r,'Preview controlled change').click();await r.getByRole('alert').filter({hasText:'Enter a date shift'}).waitFor();
      const grid=await details(r,'Test a bounded date/site grid');await grid.getByLabel('Date offsets from this candidate (h)',{exact:true}).fill('');assert.equal(await button(grid,'Test these alternatives').isDisabled(),true);
      await grid.getByLabel('Date offsets from this candidate (h)',{exact:true}).fill('0,24,48');await button(grid,'Test these alternatives').click();await r.getByRole('status').filter({hasText:/Completed 3 of 3 requested cases/}).waitFor({timeout:60000});assert.equal(await r.locator('tr[data-rank]').count(),3);return {testedCases:3,rows:await r.locator('tr[data-rank]').allTextContents()};
     });
     await step('replan-cancel-controlled-scan',async()=>{
      const grid=await details(r,'Test a bounded date/site grid');await grid.getByLabel('Date offsets from this candidate (h)',{exact:true}).fill('0,24,48,72,96,120,144');for(const c of (await grid.getByRole('checkbox').all()).slice(0,6))await c.check();
      const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:8});try{await button(grid,'Test these alternatives').click();await button(grid,'Cancel scan').click();await r.getByRole('status').filter({hasText:/Cancelled; retained/}).waitFor();}finally{await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});await cdp.detach();}return {status:await r.getByRole('status').allTextContents(),transport:'actual UI cancellation; CPU throttled 8x'};
     });
     await step('replan-open-candidate-exact-state',async()=>{await button(r,'Open candidate').click();await closeReplan(page);const pkg=await exportDecision(page,'opened-candidate');candidateState=pkg.scenario;const expected=structuredClone(seed.scenario);expected.startIndex+=48;expected.endIndex+=48;assert.deepEqual(candidateState,expected);for(const [i,key] of ['mission','sphereMission'].entries()){const before=seed.assessment[key].unmetWh,after=pkg.assessment[key].unmetWh;if(before===null||after===null)assert.match(deltaReadout[i],/Unknown/);else assert.ok(Math.abs(Number(deltaReadout[i].replaceAll(',','').replace(' Wh',''))-(after-before))<=0.006,'Displayed delta must match separately exported before/after results');}await importDecision(page,seed,'restore-reference');return {scenarioKey:pkg.assessment.scenarioKey,deltaReadout};});
    }
    await closeReplan(page);
    await step('replan-first-failure-exact-state-and-unknowns',async()=>{
     const failed=structuredClone(seed);failed.scenario.mission.areaM2=0;failed.scenario.mission.initialSoc=0;failed.scenario.mission.loadW=100;await importDecision(page,failed,'known-power-failure');const computed=await exportDecision(page,'known-power-failure-recomputed');assert.ok(computed.assessment.firstFailure);
     r=await replan(page);const ref=r.getByRole('article',{name:/^Reference:/});await details(ref,'Requirements, unknowns and evidence');assert.match(await ref.innerText(),/not-assessed|unknown|unquantified/i);await button(ref,'Inspect first violation').click();await button(ref,'Open failure in main view').click();await closeReplan(page);const timeline=page.getByRole('slider',{name:'Mission time',exact:true});assert.equal(Number(await timeline.getAttribute('aria-valuenow')??await timeline.inputValue()),computed.scenario.startIndex+computed.assessment.firstFailure.intervalIndex);const opened=await exportDecision(page,'failure-opened-exact');assert.deepEqual(opened.scenario,computed.scenario);assert.equal(opened.assessment.scenarioKey,computed.assessment.scenarioKey);await importDecision(page,seed,'restore-after-failure');return {firstFailure:computed.assessment.firstFailure,scenarioKey:opened.assessment.scenarioKey};
    });
   }
   if(options.section==='all'||options.section==='teaching'){
    let studio,notebook;
    const ready=await step('teaching-native-modal-focus-and-empty-study',async()=>{
     await button(page,'Educator').click();await guide(page);await button(page,'Teaching studio').click();studio=await modal(page,'Teaching studio');assert.match(await studio.innerText(),/0 locally recorded sessions · 0 labelled human observations · 0 agent/);assert.match(await studio.innerText(),/Saved experiment notebook · 0\/20/);
     await page.keyboard.press('Tab');assert.equal(await studio.locator(':focus').count(),1);return {native:true,childFocus:true,emptyStudy:true};
    });
    if(ready){
     await step('teaching-escape-restores-trigger-focus',async()=>{await page.keyboard.press('Escape');await studio.waitFor({state:'hidden'});await pause(250);assert.equal(await button(page,'Teaching studio').and(page.locator(':focus')).count(),1,'Escape must restore actual focus to Teaching studio opener');return {focusReturnsTo:'Teaching studio'};});
     await button(page,'Teaching studio').click();studio=await modal(page,'Teaching studio');
     await step('teaching-predict-capture-control-reveal-real-table',async()=>{
      await button(studio,'Capture current scenario as baseline').click();await button(studio,'Reveal computed response').click();await studio.getByRole('status').filter({hasText:'Write a prediction'}).waitFor();
      await studio.getByRole('textbox',{name:'Your prediction',exact:true}).fill('Changing array height alone can change terrain generation; antenna height, dates and all other inputs stay fixed.');await studio.getByRole('combobox',{name:'Change only array height (m)',exact:true}).selectOption(seed.scenario.arrayHeightM===10?'2':'10');await button(studio,'Reveal computed response').click();
      await studio.getByRole('table',{name:'Full-stay computed results — same dates and requirements'}).waitFor();assert.equal(await studio.getByRole('table',{name:'Full-stay computed results — same dates and requirements'}).locator('tbody tr').count(),4);assert.ok(await studio.locator('math').count()>2);
      const fig=studio.locator('figure').filter({hasText:'Controlled response across tested inputs'});await details(fig,'Exact plotted values');assert.equal(await fig.locator('tbody tr').count(),3);assert.match(await studio.innerText(),/not an instantaneous derivative|not a.*continuous height derivative/);
      await button(studio,'Save prediction and conclusion').click();await studio.getByRole('status').filter({hasText:'Write a conclusion'}).waitFor();await studio.getByRole('textbox',{name:'What did the computed evidence show?',exact:true}).fill('Agent check: the exported controlled record changes only arrayHeightM. Terrain and sphere remain separate; this sampled result does not establish a general continuous derivative.');await button(studio,'Save prediction and conclusion').click();
      notebook=(await download(page,studio,'Export notebook JSON','teaching-notebook')).value;assert.equal(notebook.records.length,1);const record=notebook.records[0];assert.deepEqual(record.changedPaths,['arrayHeightM']);assert.deepEqual(record.baseline,seed.scenario);const candidate=structuredClone(record.baseline);candidate.arrayHeightM=seed.scenario.arrayHeightM===10?2:10;assert.deepEqual(record.candidate,candidate);return {baselineKey:record.baselineKey,candidateKey:record.candidateKey,changedPaths:record.changedPaths};
     });
     await step('teaching-illustrative-versus-current-gradient-units',async()=>{
      const lesson=studio.getByRole('heading',{name:'Why does the response change?',exact:true}).locator('..');assert.match(await lesson.innerText(),/Illustrative algebra example — not selected mission data/);assert.match(await lesson.innerText(),/1\.020000 m²/);assert.match(await lesson.innerText(),/1000 W\/m².*1020 W/);
      await details(lesson.locator('figure'),'Exact plotted values');const values=await lesson.locator('figure tbody tr').allTextContents();assert.ok(values.some(s=>/1000|1,000/.test(s)&&/1,020/.test(s)));
      await button(lesson,'Populate from captured scenario').click();assert.match(await lesson.innerText(),/Populated from the captured selected scenario/);assert.ok((await lesson.innerText()).includes(`Captured area ${seed.scenario.mission.areaM2} m²`));assert.match(await lesson.innerText(),/interval.mean|interval mean/);assert.match(await lesson.innerText(),/m² = W per \(W\/m²\)/);assert.equal(await lesson.locator('math[aria-label*="deployed interval fraction"]').count(),1);await button(lesson,'Use illustrative constants').click();return {independentArithmetic:'4 × 0.30 × (1 − 0.15) = 1.02 m²; 1000 × 1.02 = 1020 W',values};
     });
     await step('teaching-notebook-reopen-no-concurrent-overwrite',async()=>{
      await button(studio,'Close teaching studio').click();const legacy=await details(page,'Experiment notebook');assert.match(await legacy.locator('summary').first().innerText(),/1 saved/);const saved=await details(legacy,notebook.records[0].question);const conclusion=saved.getByRole('textbox',{name:'Learner explanation',exact:true});assert.equal(await conclusion.inputValue(),notebook.records[0].explanation);notebook.records[0].explanation+=' Legacy notebook compatibility verified by this agent.';await conclusion.fill(notebook.records[0].explanation);
      assert.deepEqual((await exportDecision(page,'teaching-does-not-apply')).scenario,seed.scenario);await button(page,'Educator').click();await guide(page);await button(page,'Teaching studio').click();studio=await modal(page,'Teaching studio');
      const restoreStarted=Date.now(),predictionBeforeRestore=await studio.getByRole('textbox',{name:'Your prediction',exact:true}).inputValue();
      await until(async()=>await button(studio,'Export notebook JSON').isEnabled(),'Restored notebook export enabled');const restorationWaitMs=Date.now()-restoreStarted;
      assert.equal(await studio.getByRole('textbox',{name:'Your prediction',exact:true}).inputValue(),notebook.records[0].prediction);assert.deepEqual((await download(page,studio,'Export notebook JSON','teaching-reopened')).value,notebook);
      await button(studio,'Reset controls').click();assert.deepEqual((await download(page,studio,'Export notebook JSON','teaching-reset-preserves')).value,notebook);return {records:1,version:notebook.version,predictionBeforeRestore,restorationWaitMs};
     });
     let materials,sheet,studentFile,teacherFile,notebookStorage,draftStorage,recaptured;
     const title='Investigation <b data-qa-edited="yes">Moon & "light"</b>';
     const prompt='Explain <b data-qa-edited="yes">captured & "held" inputs</b> literally.';
     const hint='Use <b data-qa-edited="yes">Wh & "reserve"</b>, preserving unknowns.';
     const expectedCandidate=structuredClone(seed.scenario);expectedCandidate.arrayHeightM=seed.scenario.arrayHeightM===10?2:10;
     const notebookState=()=>page.evaluate(()=>({records:localStorage.getItem('solarreach-teaching-v1'),draft:localStorage.getItem('solarreach-teaching-v1-draft')}));
     const sheetUtc=iso=>{const d=new Date(iso);return `${d.getUTCDate()} ${d.toLocaleString('en-GB',{month:'short',timeZone:'UTC'})} ${d.getUTCFullYear()}, ${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')} UTC`;};
     const formatNumber=n=>n===null?'Unavailable (do not substitute zero)':n.toLocaleString('en-GB',{maximumFractionDigits:6});
     const worksheetReady=await step('materials-topics-explicit-capture-exact-source-values',async()=>{
      await button(studio,'Capture current scenario as baseline').click();await studio.getByRole('textbox',{name:'Your prediction',exact:true}).fill('Existing notebook draft: change array height only; preserve this prediction through material creation and audience switches.');await button(studio,'Reveal computed response').click();
      await until(async()=>{const saved=await notebookState();return JSON.parse(saved.draft).prediction.startsWith('Existing notebook draft:');},'Notebook draft saved by actual form');({records:notebookStorage,draft:draftStorage}=await notebookState());assert.deepEqual(JSON.parse(notebookStorage).records,notebook.records);
      materials=await details(studio,'Create a problem set and teaching materials');const goals=materials.getByRole('checkbox');assert.equal(await goals.count(),5);for(const goal of await goals.all())await goal.uncheck();assert.equal(await button(materials,'Capture current scenario for worksheet').isDisabled(),true);
      for(const name of ['Solar power and gradient','Battery reserve','Terrain versus smooth sphere','Earth contact and link evidence'])await materials.getByRole('checkbox',{name,exact:true}).check();await materials.getByLabel('Worksheet title',{exact:true}).fill(title);assert.equal(await button(materials,'Export teacher JSON').count(),0,'No implicit capture');await button(materials,'Capture current scenario for worksheet').click();await materials.getByRole('status').filter({hasText:'Teaching material captured.'}).waitFor();
      const result=await download(page,materials,'Export teacher JSON','materials-initial-teacher');sheet=result.value;assert.equal(sheet.version,1);assert.deepEqual(sheet.scenario,seed.scenario);assert.equal(sheet.scenarioKey,seed.assessment.scenarioKey);assert.equal(sheet.datasetId,seed.assessment.datasetId);assert.equal(sheet.modelVersion,seed.assessment.modelVersion);assert.equal(Date.parse(sheet.arrivalUtc),Date.parse(seed.interval.startUtc));assert.equal(Date.parse(sheet.endExclusiveUtc),Date.parse(seed.interval.endUtcExclusive));assert.equal(sheet.stepHours,1);assert.equal(sheet.title,title);assert.deepEqual(sheet.questions.map(q=>q.topic),['solar','reserve','terrain','contact']);
      assert.deepEqual(sheet.questions[0].values.slice(0,4).map(v=>v.value),['areaM2','efficiency','lossFraction','solarFlux'].map(k=>seed.scenario.mission[k]));assert.deepEqual(sheet.questions[1].values.map(v=>v.value),[seed.scenario.mission.batteryWh,seed.scenario.mission.reserveSoc,seed.assessment.mission.minBatteryWh]);assert.deepEqual(sheet.questions[2].values.map(v=>v.value),[seed.assessment.mission.generatedWh,seed.assessment.sphereMission.generatedWh]);assert.deepEqual(sheet.questions[3].values.map(v=>v.value),[seed.assessment.mission.contactFraction,seed.assessment.sphereMission.contactFraction]);
      const floor=seed.scenario.mission.batteryWh*seed.scenario.mission.reserveSoc,margin=seed.assessment.mission.minBatteryWh===null?null:seed.assessment.mission.minBatteryWh-floor;assert.ok(sheet.questions[1].answer.includes(`Protected floor = ${formatNumber(floor)} Wh`));assert.ok(sheet.questions[1].answer.includes(`Minimum margin = ${formatNumber(margin)}${margin===null?'':' Wh'}`));const difference=seed.assessment.mission.generatedWh===null||seed.assessment.sphereMission.generatedWh===null?null:seed.assessment.mission.generatedWh-seed.assessment.sphereMission.generatedWh;assert.ok(sheet.questions[2].answer.includes(`Terrain minus sphere = ${formatNumber(difference)}${difference===null?'':' Wh'}`));for(const [label,result] of [['Terrain',seed.assessment.mission],['sphere',seed.assessment.sphereMission]]){const percent=result.contactFraction===null?null:100*result.contactFraction;assert.ok(sheet.questions[3].answer.includes(`${label} ${formatNumber(percent)}${percent===null?'':' %'}`));}assert.ok(sheet.questions.every(q=>q.answer.length>40));return {download:result.path,sha256:result.sha256,scenarioKey:sheet.scenarioKey,arrivalUtc:sheet.arrivalUtc,endExclusiveUtc:sheet.endExclusiveUtc,questions:sheet.questions,independentReserve:{floorWh:floor,marginWh:margin}};
     });
     if(worksheetReady){
      await step('materials-captured-givens-preview-stable-field-labels',async()=>{
       const question=await details(materials,'1. What does the graph gradient mean?');
       const givens=await details(question,'Captured givens for this question');
       const text=await givens.innerText();
       for(const v of sheet.questions[0].values){assert.ok(text.includes(formatNumber(v.value)),`Preview missing captured value ${v.label}`);}
       for(const name of ['Question','Hint']){const input=question.getByRole('textbox',{name,exact:true});assert.equal(await input.count(),1);assert.equal(await input.getAttribute('aria-label'),name,'Explicit stable editable-field label');}
       return {text,labels:['Question','Hint'],values:sheet.questions[0].values};
      });
      await step('materials-edit-real-student-teacher-downloads-no-answer-leak',async()=>{
       const question=await details(materials,'1. What does the graph gradient mean?');await question.getByRole('textbox',{name:'Question',exact:true}).fill(prompt);await question.getByRole('textbox',{name:'Hint',exact:true}).fill(hint);sheet=(await download(page,materials,'Export teacher JSON','materials-edited-teacher')).value;assert.equal(sheet.questions[0].prompt,prompt);assert.equal(sheet.questions[0].hint,hint);assert.deepEqual(sheet.scenario,seed.scenario);
       studentFile=await downloadFile(page,materials,'Export student worksheet','materials-student');teacherFile=await downloadFile(page,materials,'Export teacher answer key','materials-teacher');assert.notEqual(studentFile.filename,teacherFile.filename);const student=await inspectDownloadedHtml(studentFile,`${mode}-materials-student`),teacher=await inspectDownloadedHtml(teacherFile,`${mode}-materials-teacher`);
       for(const doc of [student,teacher]){assert.doesNotMatch(doc.text,/M_reserve|E_B|C_B|f_reserve/,'Visible exported notation must be native');assert.ok(doc.math>=2);assert.deepEqual(doc.mathNamespaces,['http://www.w3.org/1998/Math/MathML']);assert.equal(doc.articles.length,4);assert.equal(doc.editedElements,0);assert.deepEqual(doc.scripts,[]);assert.deepEqual(doc.hidden,[]);for(const text of [title,prompt,hint,sheet.scenarioKey,sheet.datasetId,sheet.modelVersion,sheet.site])assert.ok(doc.text.includes(text),`Downloaded document missing literal ${text}`);assert.ok(doc.text.includes(`Arrival: ${sheetUtc(sheet.arrivalUtc)}`));assert.ok(doc.text.includes(`End, exclusive: ${sheetUtc(sheet.endExclusiveUtc)}`));assert.deepEqual(doc.givenValues,sheet.questions.map(q=>q.values.map(v=>({label:v.label,symbol:v.symbol?{text:v.symbol.replace(/_/g,''),subscripts:v.symbol.includes('_')?1:0}:null,value:`${formatNumber(v.value)}${v.value===null?'':' '+v.unit}`}))),'Exact captured givens and semantic native symbols, separately from the added notation legend');}
       for(const q of sheet.questions){assert.ok(!student.allText.includes(q.answer),'Student must not contain even hidden answers');assert.ok(teacher.text.includes(q.answer));}assert.doesNotMatch(studentFile.text,/"scenario"|"startIndex"|"initialSoc"|Answer and interpretation:|Teacher answer key/);assert.ok(!studentFile.text.includes(JSON.stringify(sheet.scenario)));assert.match(student.text,/Space for your reasoning|Student worksheet/);assert.match(teacher.text,/Teacher answer key/);for(const file of [studentFile,teacherFile]){assert.ok(file.text.includes('&lt;b data-qa-edited=&quot;yes&quot;&gt;'));assert.ok(!file.text.includes('<b data-qa-edited='));}return {student,teacher,teacherJsonIncludesAnswers:true,teacherJsonVersion:sheet.version};
      });
      await step('materials-solar-held-factor-exact-source-interval',async()=>{
       const solar=sheet.questions[0],factor=solar.values[4];
       assert.equal(solar.values.length,5,'Solar givens include the combined held geometry/deployment factor');
       assert.match(factor.label,/visible|incidence/i);assert.match(factor.label,/deploy|active/i);assert.equal(factor.unit,'1');
       const hardware=seed.scenario.mission.areaM2*seed.scenario.mission.efficiency*(1-seed.scenario.mission.lossFraction);
       const first=seed.assessment.mission.timeline[0],flux=seed.scenario.mission.solarFlux;
       assert.ok(hardware>0&&flux>0&&first.powerW!==null,'Known production baseline supports independent factor arithmetic');
       const expected=first.powerW/(flux*hardware);assert.equal(typeof factor.value,'number');assert.ok(Math.abs(factor.value-expected)<1e-10,'Held factor matches separately exported source-interval power');
       const student=await inspectDownloadedHtml(studentFile,`${mode}-materials-solar-student`);
       assert.ok(student.articleDetails[0].text.includes(factor.label));assert.ok(student.articleDetails[0].text.includes(formatNumber(factor.value)));
       return {factor,sourceInterval:first,hardwareFactorM2:hardware,independentlyDerivedFactor:expected,student:student.articleDetails[0]};
      });
      await step('materials-native-reserve-symbol-legend',async()=>{
       const student=await inspectDownloadedHtml(studentFile,`${mode}-materials-native-student`);
       const teacher=await inspectDownloadedHtml(teacherFile,`${mode}-materials-native-teacher`);
       for(const doc of [student,teacher]){const reserve=doc.articleDetails[1];assert.doesNotMatch(reserve.text,/M_reserve|E_B|C_B|f_reserve/);assert.ok(reserve.math.length>=5,'Reserve equation and four native symbol legends');assert.ok(reserve.math.reduce((n,m)=>n+m.subscripts,0)>=5,'Reserve legend symbols retain semantic subscripts');for(const definition of ['margin','stored energy','capacity','reserve fraction'])assert.ok(reserve.text.toLowerCase().includes(definition));}
       return {student:student.articleDetails[1],teacher:teacher.articleDetails[1]};
      });
      await step('materials-navigator-change-keeps-exact-capture-and-edits',async()=>{
       await button(studio,'Apply candidate to navigator').click();await materials.getByLabel('Worksheet title',{exact:true}).fill('Explicit recapture after array-height change');await materials.getByRole('checkbox',{name:'Decision and missing evidence',exact:true}).check();const frozen=(await download(page,materials,'Export teacher JSON','materials-frozen')).value;assert.deepEqual(frozen,sheet,'Navigator edits and pending topic/title edits must not silently recapture');const studentAfter=await downloadFile(page,materials,'Export student worksheet','materials-frozen-student'),teacherAfter=await downloadFile(page,materials,'Export teacher answer key','materials-frozen-teacher');assert.equal(studentAfter.sha256,studentFile.sha256);assert.equal(teacherAfter.sha256,teacherFile.sha256);assert.deepEqual(await notebookState(),{records:notebookStorage,draft:draftStorage});return {scenarioKey:frozen.scenarioKey,studentSha256:studentAfter.sha256,teacherSha256:teacherAfter.sha256,notebookAndDraftUnchanged:true};
      });
      await step('materials-explicit-recapture-changes-exact-scenario',async()=>{
       await button(materials,'Replace capture with current scenario').click();recaptured=(await download(page,materials,'Export teacher JSON','materials-explicit-recapture')).value;assert.equal(recaptured.version,1);assert.deepEqual(recaptured.scenario,expectedCandidate);assert.notEqual(recaptured.scenarioKey,sheet.scenarioKey);assert.equal(recaptured.title,'Explicit recapture after array-height change');assert.deepEqual(recaptured.questions.map(q=>q.topic),['solar','reserve','terrain','contact','evidence']);assert.notEqual(recaptured.questions[0].prompt,prompt);assert.equal(recaptured.arrivalUtc,sheet.arrivalUtc);assert.equal(recaptured.endExclusiveUtc,sheet.endExclusiveUtc);assert.deepEqual(await notebookState(),{records:notebookStorage,draft:draftStorage});return {beforeKey:sheet.scenarioKey,afterKey:recaptured.scenarioKey,changedPaths:['arrayHeightM'],topics:recaptured.questions.map(q=>q.topic)};
      });
      await step('materials-audience-inputs-notebook-and-draft-preserved',async()=>{
       await button(studio,'Close teaching studio').click();const selected=await exportDecision(page,'materials-applied-navigator');assert.deepEqual(selected.scenario,expectedCandidate);assert.equal(selected.assessment.scenarioKey,recaptured.scenarioKey);await button(page,'Public').click();await guide(page);await button(page,'Educator').click();await guide(page);const after=await exportDecision(page,'materials-audiences-preserved');assert.deepEqual(after.scenario,selected.scenario);assert.equal(after.assessment.scenarioKey,selected.assessment.scenarioKey);assert.deepEqual(await notebookState(),{records:notebookStorage,draft:draftStorage});await importDecision(page,seed,'materials-explicit-restore-reference');await button(page,'Educator').click();await guide(page);await button(page,'Teaching studio').click();studio=await modal(page,'Teaching studio');await until(async()=>await button(studio,'Export notebook JSON').isEnabled(),'Notebook restored after materials and audiences');assert.deepEqual((await download(page,studio,'Export notebook JSON','materials-notebook-preserved')).value,notebook);assert.equal(await studio.getByRole('textbox',{name:'Your prediction',exact:true}).inputValue(),JSON.parse(draftStorage).prediction);assert.equal(await studio.getByRole('combobox',{name:'Change only array height (m)',exact:true}).inputValue(),JSON.parse(draftStorage).value);assert.deepEqual(await notebookState(),{records:notebookStorage,draft:draftStorage});return {scenarioKey:after.assessment.scenarioKey,notebookRecords:notebook.records.length,legacyStorageKeys:['solarreach-teaching-v1','solarreach-teaching-v1-draft'],draft:JSON.parse(draftStorage)};
      });
     }
     await step('materials-unavailable-source-stays-unknown',async()=>{
      if(await studio.isVisible())await button(studio,'Close teaching studio').click();const input=structuredClone(seed);input.scenario.custom={lat:25,lon:30};input.scenario.terrainMode='prepared';await importDecision(page,input,'materials-no-prepared-coverage');const unknown=await exportDecision(page,'materials-unknown-recomputed');assert.equal(unknown.assessment.mission.minBatteryWh,null);assert.equal(unknown.assessment.mission.generatedWh,null);await button(page,'Educator').click();await guide(page);await button(page,'Teaching studio').click();studio=await modal(page,'Teaching studio');const builder=await details(studio,'Create a problem set and teaching materials');await button(builder,'Capture current scenario for worksheet').click();const exported=await download(page,builder,'Export teacher JSON','materials-unavailable-teacher');const sheet=exported.value;assert.deepEqual(sheet.scenario,unknown.scenario);assert.equal(sheet.scenarioKey,unknown.assessment.scenarioKey);assert.equal(sheet.questions.find(q=>q.topic==='reserve').values[2].value,null);assert.equal(sheet.questions.find(q=>q.topic==='solar').values[4].value,null,'Missing terrain leaves combined solar factor unknown');assert.ok(sheet.questions.find(q=>q.topic==='reserve').answer.includes('Unavailable (do not substitute zero)'));assert.deepEqual(sheet.questions.find(q=>q.topic==='terrain').values.map(v=>v.value),[unknown.assessment.mission.generatedWh,unknown.assessment.sphereMission.generatedWh]);const html=await downloadFile(page,builder,'Export student worksheet','materials-unavailable-student');assert.match(html.text,/Unavailable \(do not substitute zero\)/);assert.doesNotMatch(html.text,/'scenario'|"scenario"|Answer and interpretation:/);await button(studio,'Close teaching studio').click();await importDecision(page,seed,'materials-restore-after-unknown');await button(page,'Educator').click();await guide(page);await button(page,'Teaching studio').click();studio=await modal(page,'Teaching studio');await until(async()=>await button(studio,'Export notebook JSON').isEnabled(),'Restored notebook after unavailable worksheet');assert.deepEqual((await download(page,studio,'Export notebook JSON','materials-unknown-preserves-notebook')).value,notebook);if(notebookStorage)assert.deepEqual(await notebookState(),{records:notebookStorage,draft:draftStorage});return {scenarioKey:sheet.scenarioKey,customPoint:sheet.scenario.custom,minimumEnergy:null,generatedEnergy:null,sourceExport:exported.path,studentHtml:html.path};
     });
     await step('materials-evidence-student-actual-states-and-source-context',async()=>{
      const builder=await details(studio,'Create a problem set and teaching materials');
      for(const goal of await builder.getByRole('checkbox').all())await goal.check();
      await button(builder,'Capture current scenario for worksheet').click();
      const json=await download(page,builder,'Export teacher JSON','materials-evidence-teacher');
      assert.deepEqual(json.value.scenario,seed.scenario);assert.equal(json.value.scenarioKey,seed.assessment.scenarioKey);
      const file=await downloadFile(page,builder,'Export student worksheet','materials-evidence-student'),doc=await inspectDownloadedHtml(file,`${mode}-materials-evidence-student`);
      const question=json.value.questions.find(q=>q.topic==='evidence'),article=doc.articleDetails[4];assert.ok(question);
      for(const constraint of seed.assessment.constraints){assert.ok(article.text.includes(`${constraint.label}: ${constraint.required?'required':'optional'}; ${constraint.state}. ${constraint.explanation}`),`Student needs the actual named requirement, state and explanation for ${constraint.id}`);}
      for(const evidence of seed.assessment.evidence){assert.ok(article.text.includes(`${evidence.label}: ${evidence.kind}; ${evidence.coverage} coverage;`),'Student evidence exercise needs actual source and coverage');for(const note of evidence.notes)assert.ok(article.text.includes(note),'Student evidence exercise needs each actual source limitation');}
      assert.ok(article.text.includes(seed.assessment.outcome),'Student evidence exercise needs actual scoped outcome');
      for(const q of json.value.questions)assert.ok(!doc.allText.includes(q.answer),'Evidence exercise must supply givens without marking answers');assert.deepEqual(doc.hidden,[]);assert.deepEqual(doc.scripts,[]);
      assert.doesNotMatch(file.text,/"scenario"|"startIndex"|"initialSoc"|Answer and interpretation:/);
      return {json:json.path,student:file.path,question,article,requiredConstraints:seed.assessment.constraints.filter(c=>c.required),warnings:seed.assessment.warnings};
     });
     await step('materials-zero-area-explanation-and-unknown-held-factor',async()=>{
      await button(studio,'Close teaching studio').click();const input=structuredClone(seed);input.scenario.mission.areaM2=0;
      try {
      await importDecision(page,input,'materials-zero-collecting-area');const computed=await exportDecision(page,'materials-zero-area-recomputed');
      assert.equal(computed.assessment.mission.timeline[0].powerW,0);
      await button(page,'Educator').click();await guide(page);await button(page,'Teaching studio').click();studio=await modal(page,'Teaching studio');
      const builder=await details(studio,'Create a problem set and teaching materials');await button(builder,'Capture current scenario for worksheet').click();
      const exported=await download(page,builder,'Export teacher JSON','materials-zero-area-teacher'),solar=exported.value.questions.find(q=>q.topic==='solar');
      assert.deepEqual(exported.value.scenario,computed.scenario);assert.equal(solar.values[0].value,0);assert.equal(solar.values[4].value,null,'Zero hardware does not identify geometry/deployment from zero power');
      const html=await downloadFile(page,builder,'Export student worksheet','materials-zero-area-student'),doc=await inspectDownloadedHtml(html,`${mode}-materials-zero-area-student`);
      assert.match(doc.articleDetails[0].text,/Unavailable \(do not substitute zero\)/);assert.ok(!doc.allText.includes(solar.answer));
      // The explanation is visible in captured context in both documents, separately from the teacher-only answer.
      const teacherHtml=await downloadFile(page,builder,'Export teacher answer key','materials-zero-area-teacher');
      const teacher=await inspectDownloadedHtml(teacherHtml,`${mode}-materials-zero-area-teacher`);
      assert.match(teacher.articleDetails[0].text,/zero collecting area|collecting area.*zero|area.*zero/i);assert.match(solar.answer,/0 m²/);
      for(const document of [doc,teacher]){
       assert.match(document.articleDetails[0].text,/Generation evidence for this interval is available\./);
       assert.match(document.articleDetails[0].text,/If collecting area, conversion efficiency or retained fraction is zero, the power response is zero/);
      }
      assert.ok(teacher.articleDetails[0].text.includes(solar.answer));assert.match(solar.answer,/A 100 W\/m² increment produces 0 W/);
      const missing=structuredClone(input);missing.scenario.custom={lat:25,lon:30};missing.scenario.terrainMode='prepared';
      await button(studio,'Close teaching studio').click();await importDecision(page,missing,'materials-zero-hardware-missing-forcing');
      const unknown=await exportDecision(page,'materials-zero-hardware-unknown-recomputed');
      assert.deepEqual(unknown.scenario.mission,computed.scenario.mission,'Exactly the same zero hardware and mission inputs');
      assert.equal(unknown.assessment.mission.timeline[0].powerW,null);assert.equal(unknown.assessment.mission.generatedWh,null);
      await button(page,'Educator').click();await guide(page);await button(page,'Teaching studio').click();studio=await modal(page,'Teaching studio');
      const unknownBuilder=await details(studio,'Create a problem set and teaching materials');await button(unknownBuilder,'Capture current scenario for worksheet').click();
      const unknownExport=await download(page,unknownBuilder,'Export teacher JSON','materials-zero-hardware-unknown-teacher'),unknownSolar=unknownExport.value.questions[0];
      assert.deepEqual(unknownExport.value.scenario,unknown.scenario);assert.equal(unknownExport.value.scenarioKey,unknown.assessment.scenarioKey);
      assert.deepEqual(unknownSolar.values,solar.values,'Identical zero-hardware givens and undefined normalized factor cannot establish evidence availability');
      const unknownHtml=await downloadFile(page,unknownBuilder,'Export student worksheet','materials-zero-hardware-unknown-student');
      const unknownTeacherHtml=await downloadFile(page,unknownBuilder,'Export teacher answer key','materials-zero-hardware-unknown-teacher');
      const unknownDoc=await inspectDownloadedHtml(unknownHtml,`${mode}-materials-zero-hardware-unknown-student`);
      const unknownTeacher=await inspectDownloadedHtml(unknownTeacherHtml,`${mode}-materials-zero-hardware-unknown-teacher`);
      assert.notEqual(unknownDoc.articleDetails[0].text,doc.articleDetails[0].text,'Actual first student articles must distinguish known zero from missing forcing');
      for(const document of [unknownDoc,unknownTeacher]){
       assert.match(document.articleDetails[0].text,/Generation evidence for this interval is unavailable\./);
       assert.match(document.articleDetails[0].text,/Do not infer a numerical power response, including zero, from missing forcing\./);
       assert.doesNotMatch(document.articleDetails[0].text,/Generation evidence for this interval is available\./);
      }
      assert.match(unknownSolar.answer,/gradient ∂P̄☉\/∂S is Unavailable \(do not substitute zero\)/);
      assert.match(unknownSolar.answer,/A 100 W\/m² increment produces Unavailable \(do not substitute zero\)/);
      assert.ok(unknownTeacher.articleDetails[0].text.includes(unknownSolar.answer));assert.notEqual(unknownSolar.answer,solar.answer);
      for(const [document,file,capture] of [[doc,html,exported.value],[unknownDoc,unknownHtml,unknownExport.value]]){
       for(const question of capture.questions)assert.ok(!document.allText.includes(question.answer),'Teacher answers remain separate, including hidden student text');
       assert.deepEqual(document.hidden,[]);assert.deepEqual(document.scripts,[]);assert.deepEqual(document.requests,[]);
       assert.doesNotMatch(file.text,/"scenario"|"startIndex"|"initialSoc"|Answer and interpretation:|Teacher answer key/);
       assert.ok(document.math>0);assert.deepEqual(document.mathNamespaces,['http://www.w3.org/1998/Math/MathML']);
      }
      return {known:{scenarioKey:exported.value.scenarioKey,solar,teacherJson:exported.path,studentHtml:html.path,teacherHtml:teacherHtml.path,powerW:0,studentArticle:doc.articleDetails[0],teacherArticle:teacher.articleDetails[0]},unknown:{scenarioKey:unknownExport.value.scenarioKey,solar:unknownSolar,teacherJson:unknownExport.path,studentHtml:unknownHtml.path,teacherHtml:unknownTeacherHtml.path,powerW:null,studentArticle:unknownDoc.articleDetails[0],teacherArticle:unknownTeacher.articleDetails[0]},sameMissionInputs:true};
      } finally {
       if(await studio.isVisible())await button(studio,'Close teaching studio').click();await importDecision(page,seed,'materials-restore-after-zero-area');
       await button(page,'Educator').click();await guide(page);await button(page,'Teaching studio').click();studio=await modal(page,'Teaching studio');
       await until(async()=>await button(studio,'Export notebook JSON').isEnabled(),'Notebook restored after zero-area worksheet');assert.deepEqual((await download(page,studio,'Export notebook JSON','materials-zero-area-preserves-notebook')).value,notebook);if(notebookStorage)assert.deepEqual(await notebookState(),{records:notebookStorage,draft:draftStorage});
      }
     });
     if(!(await studio.isVisible())){await button(page,'Teaching studio').click();studio=await modal(page,'Teaching studio');}
     await step('study-agent-only-real-form-and-export',async()=>{
      const study=studio.getByRole('region',{name:'Audience validation evidence'});await study.getByRole('combobox',{name:'Evidence type',exact:true}).selectOption('agent');await button(study,'Save this study session').click();assert.match(await study.innerText(),/0 locally recorded sessions/);
      await study.getByLabel('Anonymous participant code (optional)',{exact:true}).fill('clevo-independent-agent');await study.getByLabel('Confidence before tasks (1–5)',{exact:true}).fill('2');await study.getByLabel('Confidence after tasks (1–5)',{exact:true}).fill('4');
      const fields=await study.locator('fieldset').all();for(let i=0;i<fields.length;i++){const f=fields[i];const answer=f.getByRole('combobox',{name:'Participant answer',exact:true});const choice=i===0?({'fails-assessed':0,incomplete:1,conditional:2,'passes-assessed':3,'not-configured':4}[seed.assessment.outcome]):i===1?1:0;await answer.selectOption(String(choice));if(i===2){await f.getByRole('checkbox').check();await f.getByLabel('Observed explanation, errors and evidence',{exact:true}).fill('Actual array-height baseline, controlled reveal, notebook save/export and exact changedPaths checked in this browser.');}}
      await button(study,'Save this study session').click();await study.getByText(/1 locally recorded sessions · 0 labelled human observations · 1 agent/).waitFor();const saved=(await download(page,study,'Export study evidence','agent-study')).value;assert.equal(saved.records.length,1);assert.equal(saved.records[0].participantType,'agent');assert.equal(saved.records[0].results.filter(t=>t.completed).length,1);assert.equal(saved.records[0].durationSeconds,null);assert.match(saved.records[0].limitations,/not human audience validation/);return saved;
     });
     if(await studio.isVisible())await button(studio,'Close teaching studio').click();await page.reload({waitUntil:'load'});await page.getByLabel('Lunar workbench',{exact:true}).waitFor();await guide(page);
     await step('teaching-reload-persistence',async()=>{await button(page,'Educator').click();await guide(page);await button(page,'Teaching studio').click();studio=await modal(page,'Teaching studio');assert.deepEqual((await download(page,studio,'Export notebook JSON','teaching-reload')).value,notebook);assert.match(await studio.innerText(),/1 locally recorded sessions · 0 labelled human observations · 1 agent/);await page.keyboard.press('Escape');return {notebookRecords:1,agentStudyRecords:1};});
    }
   }
   if(await page.getByRole('dialog',{name:'Teaching studio',exact:true}).isVisible())await page.keyboard.press('Escape');
   if(options.section==='all'||options.section==='engineering'){
    let engineering,envelope,shortfall,identity;
    const ready=await step('engineering-stations-unknowns-on-demand-modal',async()=>{
     engineering=await openEngineering(page);assert.match(await engineering.innerText(),/Delivered data: unknown/);assert.match(await engineering.innerText(),/Unquantified — no declared bounds/);const station=engineering.getByRole('combobox',{name:/^Ground station/});const stations=await station.locator('option').allTextContents();assert.equal(stations.length,3);for(const id of ['madrid','canberra','goldstone']){await station.selectOption(id);assert.match(await engineering.innerText(),/No station geometry imported/);}assert.equal(session.requests.filter(x=>x.url.includes('horizons.api')).length,0);
     await page.keyboard.press('Escape');assert.equal(await page.locator(':focus').innerText(),'Engineering evidence');engineering=await openEngineering(page);return {stations,noAutomaticProviderRequests:true};
    });
    if(ready){
     await step('engineering-empty-and-invalid-forms',async()=>{await button(engineering,'Apply hardware assumptions').click();await engineering.getByRole('alert').filter({hasText:/Add an evidence title/}).waitFor();await button(engineering,'Set requirement').click();await engineering.getByRole('alert').filter({hasText:'Enter a delivered-data requirement'}).waitFor();await button(engineering,'Add / replace bound with provenance').click();await engineering.getByRole('alert').filter({hasText:'Both finite endpoints'}).waitFor();await importEngineering(engineering,'{}','invalid-envelope');await engineering.getByRole('alert').filter({hasText:/schema/i}).waitFor();return {emptyProvenance:true,emptyRequirement:true,emptyBounds:true,invalidEnvelope:true};});
     await step('engineering-archived-official-import-export-identity',async()=>{
      const raw=JSON.parse(await readFile(resolve(sourcePath,'public/data/engineering-evidence/goldstone-horizons.json'),'utf8'));await engineering.locator('input[type=file]').setInputFiles(resolve(sourcePath,'public/data/engineering-evidence/goldstone-horizons.json'));await engineering.getByText(/25 samples; retrieved/).waitFor();envelope=(await download(page,engineering,'Export evidence','archived-envelope')).value;
      assert.equal(envelope.geometry.rawResponse,raw.response.result);assert.equal(envelope.geometry.stationId,'goldstone');assert.equal(envelope.geometry.frame,'ITRF93 / airless apparent AZ-EL');assert.equal(envelope.geometry.samples.length,25);assert.equal(Date.parse(envelope.geometry.samples[0].utc),Date.parse(seed.interval.startUtc));assert.equal(Date.parse(envelope.geometry.samples.at(-1).utc),Date.parse(seed.interval.endUtcExclusive));assert.equal(envelope.geometry.samples[0].rangeKm,402684.21438);assert.equal(envelope.geometry.samples[0].elevationDeg,26.809388501);assert.match(await engineering.innerText(),/Delivered data: unknown/);return {request:raw.request,rawSha256:sha(raw.response.result),samples:25,first:envelope.geometry.samples[0]};
     });
     if(envelope){
      await step('engineering-evidence-validation-and-missing-coverage',async()=>{
       const invalid=structuredClone(envelope);invalid.geometry.samples[0].rangeKm*=1000;await importEngineering(engineering,invalid,'invalid-km-units');await engineering.getByRole('alert').filter({hasText:/archived|source|differ|range|finite value/i}).waitFor();assert.deepEqual((await download(page,engineering,'Export evidence','invalid-retained')).value.geometry,envelope.geometry);
       const station=structuredClone(envelope);station.stationId='canberra';await importEngineering(engineering,station,'invalid-station-identity');await engineering.getByRole('alert').waitFor();assert.equal((await download(page,engineering,'Export evidence','invalid-station-retained')).value.stationId,'goldstone');
       const units=structuredClone(envelope);units.geometry.samples[0].elevationDeg=NaN;await importEngineering(engineering,units,'invalid-nonfinite');await engineering.getByRole('alert').waitFor();
       const raw=JSON.parse(await readFile(resolve(sourcePath,'public/data/engineering-evidence/goldstone-horizons.json'),'utf8'));for(const [from,to] of [['Date_________JDUT','Date_________JDTDB'],['Azimuth_(a-app)','Azimuth_(geometric)'],['Elevation_(a-app)','Elevation_(geometric)']]){const variant=structuredClone(raw);assert.ok(variant.response.result.includes(from));variant.response.result=variant.response.result.replace(from,to);await importEngineering(engineering,variant,`invalid-raw-${to.replaceAll(/[^a-zA-Z]/g,'')}`);await engineering.getByRole('alert').waitFor();assert.deepEqual((await download(page,engineering,'Export evidence','raw-semantics-retained')).value.geometry,envelope.geometry);}
       const wrongUrl=structuredClone(envelope);wrongUrl.geometry.requestUrl=JSON.parse(await readFile(resolve(sourcePath,'public/data/engineering-evidence/madrid-horizons.json'),'utf8')).requestUrl;await importEngineering(engineering,wrongUrl,'contradictory-request-station');await engineering.getByRole('alert').waitFor();await importEngineering(engineering,envelope,'restore-valid-geometry');return {invalidUnitsRejected:true,identityRejected:true,nonfiniteRejected:true,rawTimeAndApparentColumnsRejected:3,contradictoryRequestRejected:true};
      });
      await step('engineering-complete-explicit-zero-capacity-hand-case',async()=>{
       await engineering.getByLabel('Evidence title',{exact:true}).fill('Independent verifier deliberately blocked station');await engineering.getByLabel('Author',{exact:true}).fill('Clevo agent verifier');await engineering.getByLabel('Scope and assumption rationale',{exact:true}).fill('Explicit synthetic assumption, not booking or weather evidence. A 90 degree minimum excludes every archived elevation (maximum below 31 degrees), so contact and delivered capacity must be zero.');
       const fields={'Carrier frequency (GHz)':8.4,'Lunar transmitter power (W)':100,'Lunar antenna gain (dBi)':20,'Station vacuum antenna gain (dBi)':70,'Total station system noise (including sky/Moon) (K)':20,'Combined pointing loss (dB)':0,'Other RF losses (dB)':0,'Implementation loss (dB)':0,'Required coding Eb/N₀ (dB)':0,'Configured information rate (bit/s)':1000};for(const [label,value] of Object.entries(fields))await engineering.getByLabel(label,{exact:true}).fill(String(value));
       await button(engineering,'Apply hardware assumptions').click();await engineering.getByLabel('Station horizon / minimum elevation (°)',{exact:true}).fill('90');await button(engineering,'Assume constant station horizon').click();await engineering.getByLabel('Band-specific weather attenuation over stay (dB)',{exact:true}).fill('0');await button(engineering,'Assume weather loss for stay').click();await engineering.getByLabel('Assumed allocated rate over stay (bit/s)',{exact:true}).fill('1000');await button(engineering,'Assume allocation for stay').click();await button(engineering,'Assume current Earth-center contact as station proxy').click();
       let chain=(await download(page,engineering,'Export chain result','complete-without-requirement')).value;assert.equal(chain.result.deliveredBits,0);assert.equal(chain.result.contactSeconds,0);assert.equal(chain.result.status,'incomplete','No required bits entered is not adequacy');
       await engineering.getByLabel('Required delivered data (bits)',{exact:false}).fill('1');await button(engineering,'Set requirement').click();chain=(await download(page,engineering,'Export chain result','zero-capacity-shortfall')).value;assert.equal(chain.result.deliveredBits,0);assert.equal(chain.result.contactSeconds,0);assert.equal(chain.result.status,'conditional-shortfall');assert.equal(chain.result.knownDeliveredBits,0);assert.ok(chain.result.slices.every(x=>x.unknown.length===0));shortfall=chain.envelope;assert.equal(shortfall.stationHorizon.provenance.kind,'user-assumption');return {status:chain.result.status,deliveredBits:0,contactSeconds:0,independentExpectation:'All 24 hourly station elevations <31° <90° cutoff; 0 seconds × any allocated bit/s = 0 bits <1 bit requirement.',assumption:shortfall.stationHorizon.provenance};
      });
      if(shortfall){
       await step('engineering-coverage-unknown-versus-explicit-zero',async()=>{
        const overlap=structuredClone(shortfall);overlap.weather.value.push(structuredClone(overlap.weather.value[0]));await importEngineering(engineering,overlap,'overlapping-weather');await engineering.getByRole('alert').filter({hasText:/overlap/}).waitFor();const negative=structuredClone(shortfall);negative.allocations.value[0].rateLimitBps=-1;await importEngineering(engineering,negative,'negative-allocation-rate');await engineering.getByRole('alert').waitFor();
        const partial=structuredClone(shortfall);partial.weather.value[0].endUtc=new Date(Date.parse(seed.interval.startUtc)+3600000).toISOString();await importEngineering(engineering,partial,'weather-coverage-gap');let chain=(await download(page,engineering,'Export chain result','partial-coverage')).value;assert.equal(chain.result.status,'incomplete');assert.equal(chain.result.deliveredBits,null);assert.ok(chain.result.slices.some(x=>x.unknown.length));
        const unknown=structuredClone(shortfall);unknown.allocations=null;await importEngineering(engineering,unknown,'missing-allocation');chain=(await download(page,engineering,'Export chain result','allocation-unknown')).value;assert.equal(chain.result.deliveredBits,null);
        const zero=structuredClone(shortfall);zero.allocations.value[0].rateLimitBps=0;await importEngineering(engineering,zero,'explicit-zero-allocation');chain=(await download(page,engineering,'Export chain result','allocation-explicit-zero')).value;assert.equal(chain.result.deliveredBits,0);assert.equal(chain.result.status,'conditional-shortfall');await importEngineering(engineering,shortfall,'restore-shortfall');return {missingCoverage:'unknown',missingAllocation:'unknown',datedZeroAllocation:0};
       });
       await step('engineering-envelope-roundtrip-and-stale-binding',async()=>{
        await importEngineering(engineering,shortfall,'valid-roundtrip');let restored=(await download(page,engineering,'Export chain result','roundtrip-chain')).value;assert.deepEqual(restored.envelope,shortfall);const stale=structuredClone(shortfall);stale.scenarioKey+='-different-scenario';await importEngineering(engineering,stale,'stale-scenario-binding');await engineering.getByRole('status').filter({hasText:/Stale evidence/}).waitFor();restored=(await download(page,engineering,'Export chain result','stale-unavailable')).value;assert.equal(restored.result.deliveredBits,null);assert.equal(restored.result.status,'incomplete');await importEngineering(engineering,shortfall,'current-binding-restored');return {staleAdequacy:'incomplete',currentKey:shortfall.scenarioKey};
       });
      }
     }
     await step('engineering-bounds-real-invalid-run-export',async()=>{
      await engineering.getByLabel('Declared lower',{exact:true}).fill('20');await engineering.getByLabel('Declared upper',{exact:true}).fill('10');await button(engineering,'Add / replace bound with provenance').click();await engineering.getByRole('alert').filter({hasText:/reversed/}).waitFor();
      await engineering.getByRole('combobox',{name:/^Input \(nominal shown\)/}).selectOption('loadW');await engineering.getByLabel('Declared lower',{exact:true}).fill('0');await engineering.getByLabel('Declared upper',{exact:true}).fill(String(Math.max(seed.scenario.mission.loadW*2,1)));await button(engineering,'Add / replace bound with provenance').click();await button(engineering,'Run finite cases').click();await button(engineering,'Export cases & held requirements').waitFor({timeout:60000});const cases=(await download(page,engineering,'Export cases & held requirements','finite-three-cases')).value;assert.ok(cases.cases.length>=2&&cases.cases.length<=3);assert.equal(new Set(cases.cases.map(c=>c.id)).size,cases.cases.length);assert.deepEqual(cases.heldRequirements,seed.scenario.requirements);assert.deepEqual(cases.heldOperations,seed.scenario.operations);assert.equal(cases.baselineKey,seed.assessment.scenarioKey);assert.match(cases.interpretation,/no probability/);return cases;
     });
     await step('engineering-bounds-cancel-and-stale-input',async()=>{
      for(const [field,hi] of [['areaM2',Math.max(1,seed.scenario.mission.areaM2*2)],['batteryWh',Math.max(1,seed.scenario.mission.batteryWh*2)]]){await engineering.getByRole('combobox',{name:/^Input \(nominal shown\)/}).selectOption(field);await engineering.getByLabel('Declared lower',{exact:true}).fill('0');await engineering.getByLabel('Declared upper',{exact:true}).fill(String(hi));await button(engineering,'Add / replace bound with provenance').click();}
      const bounds=(await download(page,engineering,'Export bounds','bounds-before-cancel')).value;const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:8});try{await button(engineering,'Run finite cases').click();await button(engineering,'Cancel cases').click();await button(engineering,'Run finite cases').waitFor({state:'visible'});assert.equal(await button(engineering,'Export cases & held requirements').count(),0);}finally{await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});await cdp.detach();}
      const stale=structuredClone(bounds);stale.scenarioKey+='-stale';await importEngineering(engineering,stale,'stale-bounds');await button(engineering,'Run finite cases').click();await engineering.getByRole('alert').filter({hasText:/stale/}).waitFor();await importEngineering(engineering,bounds,'restore-bounds');return {cancelled:true,bounds:bounds.bounds.length,staleRejected:true};
     });
     await step('engineering-provider-labelled-failure-cancel-stale',async()=>{
      // Failure-only route: never return a fabricated successful provider payload.
      session.transportMock='deliberate aborted provider transport';await context.route('**/horizons.api*',route=>route.abort('failed'));await button(engineering,'Fetch selected stay from Horizons').click();await engineering.getByRole('alert').filter({hasText:/fetch|network|offline/i}).waitFor();await context.unroute('**/horizons.api*');
      session.transportMock='explicit provider request with actual browser disconnected; no response mock';await context.setOffline(true);await button(engineering,'Fetch selected stay from Horizons').click();await engineering.getByRole('alert').filter({hasText:/fetch|network|offline/i}).waitFor();await pause(200);if(mode==='http')await context.setOffline(false);
      session.transportMock='deliberately held provider transport for cancel/station change';let release;const gate=new Promise(r=>{release=r;});await context.route('**/horizons.api*',async route=>{await gate;await route.abort('aborted').catch(()=>{});});await button(engineering,'Fetch selected stay from Horizons').click();await button(engineering,'Cancel fetch').click();await engineering.getByRole('status').filter({hasText:/cancelled/}).waitFor();
      await button(engineering,'Fetch selected stay from Horizons').click();await engineering.getByRole('combobox',{name:/^Ground station/}).selectOption('madrid');release();await pause(500);assert.equal((await download(page,engineering,'Export evidence','station-changed-during-request')).value.geometry,null);assert.match(await engineering.innerText(),/No station geometry imported/);await context.unroute('**/horizons.api*');session.transportMock=null;return {failureMock:true,cancelled:true,stationChangeSuppressedLateReply:true,liveSuccessClaimed:false};
     });
     await closeEngineering(page);
     await step('resource-edit-same-scene-no-baseline-refetch-focus',async()=>{
      await button(page,'3D terrain').click();identity=await sceneIdentity(page);const count=session.requests.length;const ops=await details(page,'Deployment, load schedule & battery rate assumptions');const input=ops.getByRole('spinbutton',{name:/^Array deployment delay/});await input.fill('1');assert.equal(await input.getAttribute('type'),'number');assert.equal(await input.and(page.locator(':focus')).count(),1);
      await pause(800);assert.deepEqual(await sceneIdentity(page),identity);const newRequests=session.requests.slice(count);assert.equal(newRequests.filter(x=>/catalog|map\.png|terrain|\.glb|texture|lunar-surface/i.test(x.url)).length,0);const changed=await exportDecision(page,'resource-edit');assert.equal(changed.scenario.operations.deploymentDelayHours,1);await importDecision(page,seed,'restore-resource-edit');return {identity,newRequests};
     });
    }
   }
   await step('actual-console-page-errors-and-disconnected-network',async()=>{assert.deepEqual(session.pageErrors,[]);assert.deepEqual(session.httpErrors.filter(x=>!x.mock),[]);assert.deepEqual(session.consoleErrors.filter(x=>!x.mock),[]);const nonMock=session.requests.filter(x=>!x.mock);if(mode==='file')assert.deepEqual(nonMock,[]);return {pageErrors:session.pageErrors,consoleErrors:session.consoleErrors,requests:session.requests,failedRequests:session.failedRequests,offlineNonMockHttp:mode==='file'?nonMock.length:null};});
  } finally {await context.close();}
 }
} finally {
 await browser.close();
 const verifierAfter=await readFile(verifierPath);await writeFile(resolve(output,'verifier-after.mjs'),verifierAfter);
 report.finalVerifierSha256=sha(verifierAfter);report.verifierUnchanged=verifierBefore.equals(verifierAfter);
 const sourceBundleAfter=await readFile(options.sourceBundle);await writeFile(resolve(output,'source-bundle-after.bundle'),sourceBundleAfter);
 report.finalSourceBundleSha256=sha(sourceBundleAfter);report.sourceBundleUnchanged=sourceBundleBefore.equals(sourceBundleAfter);
 report.finalSourceIdentity={path:sourcePath,commit:sourceGit('rev-parse','HEAD'),status:sourceGit('status','--porcelain')};
 report.finishedUtc=new Date().toISOString();const finalArtifact=await readFile(marker.artifactPath);await writeFile(resolve(output,'candidate-artifact-after.html'),finalArtifact);report.finalArtifactBytes=finalArtifact.length;report.finalArtifactSha256=sha(finalArtifact);const finalMarker=await readFile(options.marker),finalInstructions=await readFile(options.instructions,'utf8');report.finalMarkerBytes=finalMarker.length;report.finalMarkerSha256=sha(finalMarker);report.finalInstructionsSha256=sha(finalInstructions);report.markerUnchanged=finalMarker.equals(markerBytes);report.instructionsUnchanged=finalInstructions===instructions;await writeFile(resolve(output,'candidate-marker-after.json'),finalMarker);await writeFile(resolve(output,'candidate-instructions-after.txt'),finalInstructions);
 const finalHttp=await fetch(marker.url);report.finalHttpStatus=finalHttp.status;const finalHttpBytes=Buffer.from(await finalHttp.arrayBuffer());report.finalHttpBytes=finalHttpBytes.length;report.finalHttpSha256=sha(finalHttpBytes);
 report.counts={passed:report.checks.filter(c=>c.status==='pass').length,failed:report.checks.filter(c=>c.status==='fail').length};
 report.expectedChecks=({all:41,public:6,replan:10,teaching:22,engineering:15}[options.section])*(options.mode==='both'?2:1);report.unexecutedChecks=report.expectedChecks-report.checks.length;
 await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({counts:report.counts,markerUnchanged:report.markerUnchanged,artifact:report.finalArtifactSha256,output},null,2));
}
assert.equal(report.verifierUnchanged,true,'Verifier changed during run');
assert.equal(report.sourceBundleUnchanged,true,'Published source bundle changed during run');
assert.deepEqual(report.finalSourceIdentity,sourceIdentity,'Candidate source changed during run');
assert.equal(report.finalArtifactBytes,artifact.length);assert.equal(report.finalHttpBytes,httpBytes.length);
assert.equal(report.finalArtifactSha256,marker.artifactSha256,'Artifact changed during verification');
assert.equal(report.finalHttpStatus,200);assert.equal(report.finalHttpSha256,marker.artifactSha256,'HTTP artifact changed during verification');
assert.equal(report.markerUnchanged,true,'Candidate changed; results apply only to recorded candidate');
assert.equal(report.instructionsUnchanged,true,'Instructions changed during verification; review updates');
if(!report.counts.failed)assert.equal(report.unexecutedChecks,0,'A green run must execute every scoped check');
if(report.counts.failed)process.exitCode=1;
