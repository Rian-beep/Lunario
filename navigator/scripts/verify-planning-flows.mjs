#!/usr/bin/env node
import assert from 'node:assert/strict';
import {access,mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright-core';
const args=process.argv.slice(2),opts={};
for(let i=0;i<args.length;i++){
 const arg=args[i];if(arg==='--offline'){opts.offline=true;continue;}
 if(!['--base-url','--file','--output'].includes(arg)||!args[i+1]||args[i+1].startsWith('--'))throw Error('Usage: (--base-url URL | --file PATH) --output DIR [--offline]');
 if(opts[arg])throw Error(`Duplicate ${arg}`);opts[arg]=args[++i];
}
if(!opts['--output']||Boolean(opts['--base-url'])===Boolean(opts['--file']))throw Error('Choose one target and an output directory.');
if(opts['--base-url']&&!['http:','https:'].includes(new URL(opts['--base-url']).protocol))throw Error('Base URL must be HTTP(S).');
const target=opts['--file']?pathToFileURL(resolve(opts['--file'])).href:opts['--base-url'];
if(opts['--file'])await access(resolve(opts['--file']));
const output=resolve(opts['--output']);await mkdir(output,{recursive:true});
const report={createdUtc:new Date().toISOString(),target,offline:!!opts.offline,viewport:{width:1600,height:1000},checks:[],limitations:['Dedicated headless browser; no user profile. Screenshots do not establish contrast, screen-reader or real-device conformance.']};
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext({viewport:report.viewport,reducedMotion:'reduce',acceptDownloads:true});
if(opts.offline)await context.setOffline(true);
const page=await context.newPage();page.setDefaultTimeout(12000);
const errors=[],httpErrors=[],requests=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('response',response=>{if(response.status()>=400)httpErrors.push({url:response.url(),status:response.status()});});
page.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url());});
const button=(name,scope=page)=>scope.getByRole('button',{name,exact:true});
const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('solarreach-workbench-v1')||'null'));
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('solarreach-comparisons-v1')||'[]'));
const openDetails=async(name,scope=page)=>{const summary=scope.locator('summary').filter({hasText:name}).first();if(!(await summary.evaluate(el=>el.parentElement.open))){await summary.focus();await summary.press('Enter');}return summary.locator('..');};
const guide=async()=>{await page.locator(".lunario-loader").waitFor({state:"hidden",timeout:30000});await button('Dismiss introduction').waitFor({state:'visible',timeout:2000}).catch(()=>{});if(await button('Dismiss introduction').isVisible()){await page.keyboard.press('Escape');await button('Dismiss introduction').waitFor({state:'hidden'});}};
const shot=async name=>page.screenshot({path:resolve(output,`${name}.png`),fullPage:false});
async function step(name,fn){try{const detail=await fn();await shot(name);report.checks.push({name,status:'pass',detail:detail??null});console.log(`PASS ${name}`);return true;}catch(e){await shot(`${name}-FAIL`).catch(()=>{});const detail=e.stack||String(e);report.checks.push({name,status:'fail',detail});console.error(`FAIL ${name}: ${e.message}`);return false;}}
let baseline,candidate,packagePath;
try{
 const loaded=await step('application-bootstrap',async()=>{await page.goto(target,{waitUntil:'load',timeout:90000});await page.getByLabel('Lunar workbench',{exact:true}).waitFor({timeout:90000});await guide();});if(!loaded)throw Error('Application did not initialize; inspect report.json and bootstrap screenshot.');
 await step('planner-decision-controls',async()=>{
  await button('Planner').click();await guide();const decision=page.getByRole('region',{name:'Mission decision assessment'});
  await decision.getByRole('heading',{name:'Mission assessment',exact:true}).waitFor();await decision.locator('.planning-verdict').filter({hasNotText:'Loading'}).waitFor();
  baseline=await state();assert.equal(baseline.schemaVersion,2);assert.ok(baseline.requirements&&baseline.operations);
  await button('Minimize mission assessment').click();await button('Expand mission assessment').click();await button('Dismiss mission assessment').click();await button('Show mission assessment').click();
  const req=await openDetails('Requirements & independent instrument heights');const array=req.getByRole('combobox',{name:/^Solar-array height/});await array.selectOption('10');
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('solarreach-workbench-v1')).arrayHeightM===10);assert.equal((await state()).antennaHeightM,baseline.antennaHeightM);await array.selectOption(String(baseline.arrayHeightM));
  const ops=await openDetails('Deployment, load schedule & battery rate assumptions');await ops.getByRole('spinbutton',{name:/^Array deployment delay/}).fill('1');
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('solarreach-workbench-v1')).operations.deploymentDelayHours===1);await ops.getByRole('spinbutton',{name:/^Array deployment delay/}).fill(String(baseline.operations.deploymentDelayHours));
  const summary=ops.locator('summary').first();await summary.focus();await page.keyboard.press('Space');assert.ok(await button('Play environmental playback').isVisible());await page.keyboard.press('Escape');assert.ok(await button('Play environmental playback').isVisible());
  await button('Hide panels for unobstructed view').click();await button('Show controls').click();baseline=await state();return{siteId:baseline.siteId,startIndex:baseline.startIndex,endIndex:baseline.endIndex};
 });
 await step('calendar-31-and-controlled-slip',async()=>{
  assert.ok(baseline,'Planner setup failed');await button('Find whole-mission arrival windows').click();const calendar=page.locator('.mission-calendar');await button('Evaluate mission starts',calendar).click();
  await calendar.getByText(/31 full stays evaluated/).waitFor({timeout:90000});assert.equal(await calendar.locator('.planning-calendar-grid button').count(),31);await shot('calendar31-full-missions');
  await button('+1 day',calendar).click();await calendar.getByText(/Controlled arrival shift: \+24 h/).waitFor();await openDetails('Changed inputs and technical comparison',calendar);await calendar.getByText(/startIndex:/).waitFor();
  await shot('calendar-controlled-candidate');await button('Compare baseline & candidate',calendar).click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('solarreach-comparisons-v1')||'[]').length>=2);
  const pair=await saved();const recent=pair.slice(-2);assert.equal(recent[0].state.startIndex,baseline.startIndex);candidate=recent[1].state;assert.equal(candidate.startIndex,baseline.startIndex+24);assert.equal(candidate.endIndex,baseline.endIndex+24);
  const withoutDates=s=>{const copy=structuredClone(s);delete copy.startIndex;delete copy.endIndex;return copy;};assert.deepEqual(withoutDates(candidate),withoutDates(baseline));
  return{saved:recent.map(s=>({name:s.name,startIndex:s.state.startIndex,endIndex:s.state.endIndex}))};
 });
 await step('comparison-and-open-exact',async()=>{
  assert.ok(candidate,'No candidate saved');await button('Minimize comparisons').click();await button('Restore comparisons').click();const comparison=page.locator('.comparison-content');await comparison.getByRole('heading',{name:'Compare mission scenarios'}).waitFor();await button('Choose columns',comparison).click();
  for(const name of ['Assessment outcome','Model version','Dataset version','First known failure UTC']){const checkbox=comparison.getByRole('checkbox',{name,exact:true});if(!(await checkbox.isChecked()))await checkbox.check();}
  await comparison.getByText('Date-only comparison',{exact:true}).first().waitFor();assert.ok(await comparison.getByRole('columnheader',{name:/Model version/}).isVisible());
  const last=(await saved()).at(-1);await comparison.getByRole('button',{name:last.name,exact:true}).click();await page.waitForFunction(expected=>JSON.parse(localStorage.getItem('solarreach-workbench-v1')).startIndex===expected,candidate.startIndex);assert.deepEqual(await state(),candidate);
 });
 await step('export-import-exact-state',async()=>{
  await button('Close comparisons').click().catch(()=>{});await button('Planner').click();await guide();const controls=await openDetails('Export, import & print evidence');
  const pending=page.waitForEvent('download');await button('Export decision JSON',controls).click();const download=await pending;packagePath=resolve(output,'solarreach-decision.json');await download.saveAs(packagePath);const pkg=JSON.parse(await readFile(packagePath,'utf8'));
  assert.deepEqual(pkg.scenario,await state());assert.equal(pkg.assessment.scenarioKey.length>0,true);assert.ok(Array.isArray(pkg.events));assert.ok(pkg.modelVersion&&pkg.datasetId&&pkg.manifest);assert.equal(pkg.interval.endUtcExclusive.length>0,true);
  await controls.locator('input[type=file]').setInputFiles(packagePath);await controls.getByRole('status').filter({hasText:/recomputed|imported/i}).waitFor();assert.deepEqual(await state(),pkg.scenario);
  return{scenarioKey:pkg.assessment.scenarioKey,events:pkg.events.length,model:pkg.modelVersion,dataset:pkg.datasetId};
 });
 await step('sensitivity-explicit-invalid-cancel',async()=>{
  const panel=await openDetails('Sensitivity & tested alternatives');const inputs=panel.locator('input');await inputs.first().fill('0, 24, 48');await button('Evaluate tested cases',panel).click();await panel.getByText(/3 explicitly tested cases/).waitFor({timeout:90000});
  assert.equal(await panel.locator('table tbody tr').count(),3);await shot('sensitivity-three-explicit-cases');await inputs.first().fill('invalid');assert.equal(await button('Evaluate tested cases',panel).isDisabled(),true);
  await inputs.first().fill('0,24,48,72,96,120,144,168,192');await panel.locator('select').nth(1).selectOption('loadMultiplier');await inputs.nth(1).fill('0.5,0.6,0.7,0.8,0.9,1,1.1,1.2,1.3');
  const session=await context.newCDPSession(page);await session.send('Emulation.setCPUThrottlingRate',{rate:8});try{await button('Evaluate tested cases',panel).click();await button('Cancel sensitivity',panel).click();await panel.getByRole('status').filter({hasText:'Cancelled.'}).waitFor();}finally{await session.send('Emulation.setCPUThrottlingRate',{rate:1});await session.detach();}return{explicitCases:3,cancelled:true,cancellationCpuThrottle:8};
 });
 await step('educator-record-preserved-and-public-state',async()=>{
  const before=await state();await button('Educator').click();await guide();const notebook=await openDetails('Experiment notebook');await notebook.getByLabel('My prediction',{exact:true}).fill('Raising only the array may change generation, with antenna contact unchanged.');await button('Capture current scenario as baseline',notebook).click();await notebook.getByRole('combobox',{name:/^Change only arrayHeightM/}).selectOption('10');await notebook.getByLabel('My explanation',{exact:true}).fill('Compare the same stay with an independent array horizon.');await button('Reveal and save evidence',notebook).click();
  const records=await page.evaluate(()=>JSON.parse(localStorage.getItem('solarreach-teaching-v1')||'null'));assert.equal(records.version,1);assert.equal(records.records.length,1);assert.deepEqual(records.records[0].changedPaths,['arrayHeightM']);assert.deepEqual(records.records[0].baseline,before);assert.equal(records.records[0].candidate.arrayHeightM,10);assert.ok(records.records[0].baselineKey&&records.records[0].candidateKey);await writeFile(resolve(output,'teaching-records.json'),JSON.stringify(records,null,2));
  await shot('educator-saved-controlled-record');await button('Reset experiment controls',notebook).click();assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('solarreach-teaching-v1'))),records);assert.deepEqual(await state(),before);
  await button('Public').click();await guide();assert.deepEqual(await state(),before);return{recordsPersisted:true,physicalInputsUnchanged:true};
 });
 await step('nasa-equipment-and-runtime',async()=>{
  const sceneButton=page.getByRole('button',{name:/3D terrain|Terrain 3D|Surface scene/i}).first();if(await sceneButton.isVisible())await sceneButton.click();else throw Error('No accessible 3D terrain entry found; inspect available navigation.');
  await openDetails('Camera & lighting');await openDetails('Surface & scale');await page.getByText(/Equipment status: ready/).waitFor({timeout:90000});assert.deepEqual(errors,[]);assert.deepEqual(httpErrors,[]);if(opts.offline)assert.deepEqual(requests,[]);return{pageErrors:errors,httpErrors,httpRequests:requests.length};
 });
 await step('historical-apollo-remains-unassessed',async()=>{
  await button('2D map').click();if(await button('Show site drawer').isVisible())await button('Show site drawer').click();
  await page.getByLabel('Filter landing sites',{exact:true}).selectOption('apollo');await page.locator('.site-list button').filter({hasText:'Apollo 11'}).first().click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('solarreach-workbench-v1')).siteId.toLowerCase().includes('apollo'));
  await button('Planner').click();await guide();const decision=page.getByRole('region',{name:'Mission decision assessment'});
  await openDetails('Requirements & independent instrument heights',decision);await decision.getByRole('combobox',{name:'Planning terrain evidence mode',exact:true}).selectOption('prepared');
  await decision.locator('.planning-verdict').filter({hasText:/Incomplete/}).waitFor();assert.match(await decision.innerText(),/unavailable|unknown|missing/i);
  return{siteId:(await state()).siteId,verdict:await decision.locator('.planning-verdict').innerText()};
 });

}finally{
 report.pageErrors=errors;report.httpErrors=httpErrors;report.httpRequests=requests;await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));await browser.close();
}
if(report.checks.some(c=>c.status==='fail'))process.exitCode=1;
