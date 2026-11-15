#!/usr/bin/env node
import assert from 'node:assert/strict';
import {access,mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
const options={};
for(let i=2;i<process.argv.length;i++){
 const key=process.argv[i];
 if(key==='--offline'){options.offline=true;continue;}
 if(!['--base-url','--file','--output'].includes(key)||!process.argv[i+1]||process.argv[i+1].startsWith('--')||options[key])throw Error('Usage: (--base-url URL | --file PATH) --output DIR [--offline]');
 options[key]=process.argv[++i];
}
if(!options['--output']||Boolean(options['--file'])===Boolean(options['--base-url']))throw Error('Exactly one target and --output required');
if(options['--base-url']&&!['http:','https:'].includes(new URL(options['--base-url']).protocol))throw Error('Expected HTTP(S) URL');
const output=resolve(options['--output']);await mkdir(output,{recursive:true});
let artifact=null;
if(options['--file']){await access(resolve(options['--file']));const bytes=await readFile(resolve(options['--file']));artifact={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};}
const target=options['--file']?pathToFileURL(resolve(options['--file'])).href:options['--base-url'];
const report={checkedUtc:new Date().toISOString(),target,artifact,offline:!!options.offline,checks:[],pageErrors:[],httpRequests:[],limits:['Dedicated headless Chrome; no screen-reader or complete accessibility claim.']};
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1600,height:1000},reducedMotion:'reduce'});
if(options.offline)await context.setOffline(true);
const page=await context.newPage();page.setDefaultTimeout(15000);
page.on('pageerror',e=>report.pageErrors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))report.httpRequests.push(r.url());});
const button=(name,scope=page)=>scope.getByRole('button',{name,exact:true});
const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('solarreach-workbench-v1')));
async function step(name,fn){try{const detail=await fn();report.checks.push({name,status:'pass',detail});console.log(`PASS ${name}`);}catch(error){report.checks.push({name,status:'fail',error:error.stack});console.error(`FAIL ${name}: ${error.message}`);throw error;}}
try{
 await step('bootstrap-and-31-real-candidates',async()=>{
  await page.goto(target,{waitUntil:'load',timeout:90000});await page.getByLabel('Lunar workbench',{exact:true}).waitFor({timeout:90000});
  if(await button('Dismiss introduction').isVisible())await page.keyboard.press('Escape');
  await button('Planner').click();if(await button('Dismiss introduction').isVisible())await page.keyboard.press('Escape');
  await button('Find whole-mission arrival windows').click();const calendar=page.locator('.mission-calendar');
  await button('Evaluate mission starts',calendar).click();await calendar.getByText(/31 full stays evaluated/).waitFor({timeout:90000});
  assert.equal(await calendar.locator('.planning-calendar-grid button').count(),31);
  assert.equal(await calendar.getByText(/Retained-result policy:/).count(),1);return{count:31};
 });
 const calendar=page.locator('.mission-calendar'),grid=calendar.locator('.planning-calendar-grid button');
 const before=await state();
 await step('roving-focus-all-directions-bounds-home-end',async()=>{
  await grid.first().focus();const sequence=[['ArrowRight',1],['ArrowDown',8],['ArrowLeft',7],['ArrowUp',0],['ArrowUp',0],['End',30],['ArrowRight',30],['ArrowDown',30],['Home',0]];
  const selectedBefore=await grid.evaluateAll(nodes=>nodes.filter(n=>n.getAttribute('aria-pressed')==='true').map(n=>n.dataset.scenarioKey));
  for(const [key,index] of sequence){await page.keyboard.press(key);assert.equal(await grid.nth(index).evaluate(n=>n===document.activeElement),true,`${key} expected ${index}`);assert.equal(await grid.evaluateAll(nodes=>nodes.filter(n=>n.tabIndex===0).length),1);}
  assert.deepEqual(await grid.evaluateAll(nodes=>nodes.filter(n=>n.getAttribute('aria-pressed')==='true').map(n=>n.dataset.scenarioKey)),selectedBefore);
  assert.deepEqual(await state(),before);return{sequence};
 });
 await step('native-enter-space-select-without-opening',async()=>{
  await grid.nth(4).focus();await page.keyboard.press('Enter');assert.equal(await grid.nth(4).getAttribute('aria-pressed'),'true');
  await grid.nth(9).focus();await page.keyboard.press('Space');assert.equal(await grid.nth(9).getAttribute('aria-pressed'),'true');
  assert.deepEqual(await state(),before);return{enterIndex:4,spaceIndex:9};
 });
 await step('collapsed-table-exact-31-identities-and-values',async()=>{
  const summary=calendar.locator('summary').filter({hasText:'Table of all mission-start results'});assert.equal(await summary.evaluate(n=>n.parentElement.open),false);await summary.click();
  const table=summary.locator('..').locator('table'),rows=table.locator('tbody tr');assert.equal(await rows.count(),31);
  const keys=await grid.evaluateAll(nodes=>nodes.map(n=>n.dataset.scenarioKey));assert.ok(keys.every(Boolean));assert.deepEqual(await rows.evaluateAll(nodes=>nodes.map(n=>n.dataset.scenarioKey)),keys);
  for(let i=0;i<31;i++){const gridText=await grid.nth(i).innerText(),cells=await rows.nth(i).locator('td').allTextContents();assert.ok(gridText.includes(cells[2]));assert.ok(gridText.includes(cells[3]));assert.ok(cells[0].includes('UTC'));assert.ok(cells[1].includes('UTC'));}
  await rows.nth(6).getByRole('button',{name:'Inspect candidate',exact:true}).click();assert.equal(await grid.nth(6).getAttribute('aria-pressed'),'true');assert.deepEqual(await state(),before);
  await page.screenshot({path:resolve(output,'calendar-table.png'),fullPage:false});return{keys,rows:31};
 });
 await step('no-page-errors-and-offline-network',async()=>{assert.deepEqual(report.pageErrors,[]);if(options.offline)assert.deepEqual(report.httpRequests,[]);return{httpRequests:report.httpRequests.length};});
}catch{await page.screenshot({path:resolve(output,'failure.png')}).catch(()=>{});}
finally{await browser.close();report.failed=report.checks.filter(c=>c.status==='fail').length;await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));}
if(report.failed)process.exitCode=1;
