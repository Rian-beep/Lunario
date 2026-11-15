// Actual DOM event/pixel checks on disconnected incoming HTML; not screen-reader use.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const out=process.env.AUDIENCE_KEYBOARD_OUT??'/tmp/lunario-audience-keyboard';await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const file=resolve('public/solarreach-navigator.html');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/opt/google/chrome/chrome',headless:true,args:['--no-sandbox']});
const report={scriptSha256:sha(await readFile(new URL(import.meta.url))),browser:browser.version(),utc:new Date().toISOString(),file,fileSha256:sha(await readFile(file)),checks:[],errors:[],http:[],limits:['Agent key events and rendered canvas pixel changes; not real assistive technology or human use.','Reduced-motion preference is emulated; motion discomfort and screen-reader announcement quality were not measured.']};
const context=await browser.newContext({viewport:{width:1600,height:1000},offline:true,reducedMotion:'reduce'});const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))report.http.push(r.url());});
const button=n=>page.getByRole('button',{name:n,exact:true});
const tick=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function check(name,actions,fn){try{report.checks.push({name,actions,status:'pass',evidence:await fn()});}catch(e){report.checks.push({name,actions,status:'fail',error:e.stack});}await writeFile(`${out}/observations.json`,JSON.stringify(report,null,2)+'\n');}
try{
 await page.goto(pathToFileURL(file).href,{waitUntil:'domcontentloaded'});await button('Dismiss introduction').click();
 const time=()=>page.getByRole('slider',{name:'Mission time',exact:true}).getAttribute('aria-valuenow').then(Number);
 await check('map-keyboard-pan-zoom','Focus map; ArrowRight pans and + zooms; compare actual raster hashes; mission time must stay fixed.',async()=>{
  const map=page.locator('[data-map-root]');await map.focus();await tick();const before=await map.locator('canvas').evaluate(c=>c.toDataURL());const t=await time();await page.keyboard.press('ArrowRight');await tick();const panned=await map.locator('canvas').evaluate(c=>c.toDataURL());await page.keyboard.press('+');await tick();const zoomed=await map.locator('canvas').evaluate(c=>c.toDataURL());assert.notEqual(sha(before),sha(panned));assert.notEqual(sha(panned),sha(zoomed));assert.equal(await time(),t);return {before:sha(before),panned:sha(panned),zoomed:sha(zoomed),fixedMissionTime:t};
 });
 await check('timeline-arrow-and-shift-arrow','Focus workspace body; ArrowRight, then Shift+ArrowRight; assert +1 and +6 hourly source samples.',async()=>{
  await page.locator('body').evaluate(e=>{e.tabIndex=-1;e.focus();});const before=await time();await page.keyboard.press('ArrowRight');await tick();const one=await time();await page.keyboard.press('Shift+ArrowRight');await tick();const seven=await time();assert.equal(one-before,1);assert.equal(seven-one,6);return {before,one,seven};
 });
 await check('reduced-motion-playback-announcement','Space starts environmental playback; await a stepped sample and polite DOM status; Space pauses.',async()=>{
  const before=await time();await page.keyboard.press('Space');await button('Pause environmental playback').waitFor();let during=before;for(let i=0;i<40&&during<=before;i++){await page.waitForTimeout(100);during=await time();}assert.ok(during>before);await page.keyboard.press('Space');await button('Play environmental playback').waitFor();const statuses=await page.locator('[aria-live]').evaluateAll(es=>es.map(e=>({live:e.getAttribute('aria-live'),text:e.textContent})));assert.ok(Number.isInteger(during));return {before,during,statuses};
 });
 await check('info-keyboard-focus-escape','Open inspector; focus About Time in sunlight; Enter pins explanation; ArrowDown focuses it as instructed; Escape closes and returns focus.',async()=>{
  await button('Show inspector').click();const help=button('About Time in sunlight').first();await help.focus();await page.keyboard.press('Enter');const dialog=page.getByRole('dialog',{name:'About Time in sunlight',exact:true});await dialog.waitFor();await page.keyboard.press('ArrowDown');await tick();const focusInside=await dialog.evaluate(e=>e.contains(document.activeElement));await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});const restored=await help.evaluate(e=>e===document.activeElement);assert.ok(focusInside);assert.ok(restored);return {focusInside,restored};
 });
 await check('errors-and-network','Check uncaught errors and HTTP requests.',async()=>{assert.deepEqual(report.errors,[]);assert.deepEqual(report.http,[]);return {errors:report.errors,http:report.http};});
 await page.screenshot({path:`${out}/keyboard.png`});
}finally{report.summary={total:report.checks.length,passed:report.checks.filter(c=>c.status==='pass').length,failed:report.checks.filter(c=>c.status==='fail').length};await writeFile(`${out}/observations.json`,JSON.stringify(report,null,2)+'\n');await browser.close();console.log(JSON.stringify(report.summary));if(report.summary.failed)process.exitCode=1;}
