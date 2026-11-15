#!/usr/bin/env node
import assert from 'node:assert/strict';
import {mkdir,writeFile,access,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright-core';
import sharp from 'sharp';
const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i++){const key=args[i];if(key==='--offline'){options.offline=true;continue;}if(!['--base-url','--file','--output'].includes(key)||!args[i+1])throw Error('Usage: (--base-url URL | --file PATH) --output DIR [--offline]');options[key]=args[++i];}
if(!options['--output']||Boolean(options['--base-url'])===Boolean(options['--file']))throw Error('Choose exactly one target');
const target=options['--file']?pathToFileURL(resolve(options['--file'])).href:options['--base-url'];
if(options['--file'])await access(resolve(options['--file']));else assert.ok(['http:','https:'].includes(new URL(target).protocol));
const output=resolve(options['--output']);await mkdir(output,{recursive:true});
const report={target,offline:!!options.offline,createdUtc:new Date().toISOString(),checks:[],httpRequests:[],httpErrors:[],pageErrors:[],limitations:['Dedicated headless Chrome; no user profile or operating-system settings.','Mock forecast checks validate coverage and presentation, not provider accuracy or station contact availability.','Screenshots and actual mesh draw counters verify rendering; this is not a terrain or equipment engineering certification.']};
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const button=(page,name)=>page.getByRole('button',{name,exact:true});
async function context({weather=false}={}){
 const c=await browser.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:1});if(options.offline&&!weather)await c.setOffline(true);
 const page=await c.newPage();page.setDefaultTimeout(15000);
 page.on('pageerror',e=>report.pageErrors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.httpErrors.push({url:r.url(),status:r.status()});});page.on('request',r=>{if(/^https?:/.test(r.url()))report.httpRequests.push({url:r.url(),fixture:weather});});
 await page.goto(target,{waitUntil:'load',timeout:90000});await page.getByLabel('Lunar workbench',{exact:true}).waitFor({timeout:90000});
 if(await button(page,'Dismiss introduction').isVisible())await page.keyboard.press('Escape');
 return{c,page};
}
async function check(page,name,fn){try{const detail=await fn();await page.screenshot({path:resolve(output,`${name}.png`)});report.checks.push({name,status:'pass',detail});console.log(`PASS ${name}`);return detail;}catch(e){report.checks.push({name,status:'fail',detail:e.stack||String(e)});await page.screenshot({path:resolve(output,`${name}-FAIL.png`)}).catch(()=>{});console.error(`FAIL ${name}: ${e.message}`);return null;}}
const dsn=page=>page.locator('.dsn-canvas');
async function dsnData(page){return dsn(page).evaluate(el=>({...el.dataset}));}
async function openDsn(page){await button(page,'Earth & Moon').click();await dsn(page).waitFor();}
async function ready(page){await page.waitForFunction(()=>{const d=document.querySelector('.dsn-canvas')?.dataset;return d?.earthModel==='ready'&&d?.moonModel==='ready'&&Number(d?.earthDraws)>0&&Number(d?.moonDraws)>0;},null,{timeout:90000});}
async function camera(page,name){const summary=page.getByLabel('Camera and lighting controls',{exact:true});if(!await summary.evaluate(el=>el.parentElement.open))await summary.click();await button(page,name).click();await page.keyboard.press('Escape');}
async function vehicleData(page){return page.locator('.scene-host').evaluate(el=>({...el.dataset}));}
let main,fixture;
try{
 main=await context();const {page}=main;
 await check(page,'moon-remains-default',async()=>{assert.equal(await button(page,'Earth & Moon').getAttribute('aria-pressed'),'false');assert.equal(await page.locator('.earth-moon-view').count(),0);return{defaultEarthMoon:false};});
 await check(page,'physical-earth-moon-original-models',async()=>{
  await openDsn(page);await ready(page);const data=await dsnData(page);assert.equal(data.dsnView,'system');
  const raw=options['--file']?await page.evaluate(()=>window.__SOLARREACH_CATALOG__):JSON.parse(await readFile(new URL('../public/data/catalog.json',import.meta.url),'utf8'));
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('solarreach-workbench-v1'))),index=stored.startIndex;
  const ranges=Buffer.from(raw.earthRangeKm,'base64'),expected=ranges.readFloatLE(index*4);assert.ok(Math.abs(Number(data.rangeKm)-expected)<.05,`Rendered range ${data.rangeKm} differs from independent catalog sample ${expected}`);
  assert.match(await page.locator('.dsn-panel').innerText(),/real scale/);return{data,expectedRangeKm:expected,earthRadiusKm:raw.meta.earthRadiusKm,moonRadiusKm:raw.meta.moonRadiusM/1000};
 });
 await check(page,'three-station-focus-and-textured-earth',async()=>{
  const results=[];for(const [id,name,lat,lon]of [['goldstone','Goldstone',35.4259,243.1105],['madrid','Madrid',40.4312,355.7520],['canberra','Canberra',-35.4024,148.9813]]){
   await page.getByRole('button',{name:new RegExp(`^${name}`)}).click();await page.waitForFunction(id=>document.querySelector('.dsn-canvas')?.dataset.focusedStation===id,id);
   await page.waitForFunction(()=>document.querySelector('.dsn-canvas')?.dataset.stationTexture==='ready',null,{timeout:30000});
   const data=await dsnData(page),v=data.cameraPosition.split(',').map(Number),r=Math.hypot(...v),p=lat*Math.PI/180,l=lon*Math.PI/180,expected=[Math.cos(p)*Math.cos(l),Math.sin(p),-Math.cos(p)*Math.sin(l)],cos=v.reduce((s,x,i)=>s+x/r*expected[i],0);assert.ok(cos>.9999,`${name} camera points at incorrect geographic region`);assert.equal(data.dsnView,'stations');results.push({name,data,cos});
   await page.screenshot({path:resolve(output,`station-${id}.png`)});
  }
  const image=await page.screenshot(),stats=await sharp(image).extract({left:650,top:350,width:300,height:280}).stats();assert.ok(stats.channels.slice(0,3).some(c=>c.stdev>15),'Station globe centre lacks rendered texture variation');return{stations:results,renderedCentreStddev:stats.channels.map(c=>c.stdev)};
 });
 await check(page,'three-original-models-same-size-scale',async()=>{await button(page,'Compare body sizes').click();await page.waitForFunction(()=>{const d=document.querySelector('.dsn-canvas')?.dataset;return d?.dsnView==='sizes'&&d?.sunModel==='ready'&&Number(d.sunDraws)>0;},null,{timeout:90000});const text=await page.locator('.dsn-panel').innerText();assert.match(text,/Spacing is a comparison layout, not orbital distance/);assert.match(text,/1,391,400 km diameter/);return await dsnData(page);});
 await check(page,'card-minimize-close-restore-and-global-hide',async()=>{
  await button(page,'Minimize communications details').click();assert.equal(await page.locator('.dsn-panel details:visible').count(),0);await button(page,'Expand communications details').click();await button(page,'Close communications details').click();assert.equal(await page.locator('.dsn-panel:visible').count(),0);await button(page,'Show communications details').click();assert.equal(await page.locator('.dsn-panel:visible').count(),1);
  await button(page,'Hide panels for unobstructed view').click();assert.equal(await page.locator('[data-dsn-controls]:visible').count(),0);await button(page,'Show controls').click();assert.ok(await page.locator('.dsn-panel').isVisible());return{minimizeCloseRestore:true,globalHide:true};
 });
 await check(page,'future-weather-unknown-without-automatic-fetch',async()=>{await page.locator('.dsn-panel summary').filter({hasText:/Weather at/}).click();const text=await page.locator('.dsn-panel').innerText();assert.match(text,/No sourced forecast covers this selected mission epoch/);assert.equal(report.httpRequests.filter(r=>r.url.includes('api.open-meteo.com')).length,0);return{text:text.match(/Mission epoch:[^\n]*/),automaticWeatherRequests:0};});
 await check(page,'fixed-physical-lander-near-far-and-flight',async()=>{
  await button(page,'3D terrain').click();if(await button(page,'Show inspector').isVisible())await button(page,'Show inspector').click();await button(page,'Flight preview').click();await page.locator('.scene-host canvas').waitFor({timeout:90000});await camera(page,'Inspect lander');
  await page.waitForFunction(()=>document.querySelector('.scene-host')?.dataset.cameraMode==='vehicle',null,{timeout:30000});
  await page.waitForFunction(()=>[...document.querySelectorAll('.sq-notes-body p')].some(p=>/Equipment status: ready/.test(p.textContent)),null,{timeout:90000});
  const near=await vehicleData(page);assert.equal(Number(near.vehicleScale),1);assert.ok(Number(near.vehicleCameraDistanceKm)<.1,'Inspect lander did not frame nominal metres');await page.screenshot({path:resolve(output,'lander-near.png')});
  const box=await page.locator('.scene-host canvas').boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.55);await page.mouse.wheel(0,700);await page.waitForTimeout(700);const far=await vehicleData(page);assert.equal(Number(far.vehicleScale),1);assert.ok(Number(far.vehicleCameraDistanceKm)>Number(near.vehicleCameraDistanceKm)*1.2,'Wheel zoom did not change actual vehicle camera distance');
  await button(page,'Play flight').click();await page.waitForTimeout(600);const playing=await vehicleData(page);assert.equal(Number(playing.vehicleScale),1);await button(page,'Pause flight').click();
  const canvas=await page.locator('.scene-host canvas').elementHandle(),beforeEdit=await vehicleData(page),wetMass=page.getByRole('spinbutton',{name:/^Wet mass/});
  const value=await wetMass.inputValue();await wetMass.fill(String(Number(value)+1));await page.waitForFunction(old=>Number(document.querySelector('.scene-host')?.dataset.flightRevision)>Number(old),beforeEdit.flightRevision);const afterEdit=await vehicleData(page);assert.equal(afterEdit.sceneInstance,beforeEdit.sceneInstance,'Mass edit recreated renderer');assert.equal(await page.locator('.scene-host canvas').evaluate((node,old)=>node===old,canvas),true,'Mass edit replaced actual canvas node');assert.equal(Number(afterEdit.vehicleScale),1);await wetMass.fill(value);
  await camera(page,'Moon');await page.waitForFunction(()=>document.querySelector('.scene-host')?.dataset.cameraMode==='globe');const globe=await vehicleData(page);assert.equal(Number(globe.vehicleScale),1);assert.ok(Number(globe.vehicleCameraDistanceKm)>1000);return{near,far,playing,beforeEdit,afterEdit,canvasPreserved:true,globe};
 });
 const unmocked=report.httpRequests.filter(r=>!r.fixture);if(options.offline)await check(page,'offline-zero-network',async()=>{assert.equal(unmocked.length,0);return{httpRequests:0};});
 await main.c.close();main=null;
 // Explicit provider fixtures are isolated from the offline startup context. All external requests are intercepted.
 fixture=await context({weather:true});const fp=fixture.page;await openDsn(fp);await ready(fp);await fp.locator('.dsn-panel summary').filter({hasText:/Weather at/}).click();
 await check(fp,'dated-mocked-weather-coverage-and-explicit-failure',async()=>{
  const selected=await fp.evaluate(()=>{const raw=window.__SOLARREACH_CATALOG__,state=JSON.parse(localStorage.getItem('solarreach-workbench-v1'));return raw?Date.parse(raw.meta.t0)+state.startIndex*raw.meta.stepHours*3600000:null;});
  const raw=selected===null?JSON.parse(await readFile(new URL('../public/data/catalog.json',import.meta.url),'utf8')):null;
  const start=selected??await fp.evaluate(raw=>Date.parse(raw.meta.t0)+JSON.parse(localStorage.getItem('solarreach-workbench-v1')).startIndex*raw.meta.stepHours*3600000,raw);
  const payload=epoch=>({utc_offset_seconds:0,hourly_units:{temperature_2m:'°C',wind_speed_10m:'km/h',precipitation:'mm',cloud_cover:'%'},hourly:{time:[epoch/1000],temperature_2m:[12],wind_speed_10m:[8],precipitation:[0],cloud_cover:[20]}});
  let mode='covered';await fp.route('https://api.open-meteo.com/**',route=>mode==='fail'?route.abort('failed'):route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload(mode==='covered'?start:Date.parse('2026-11-14T12:00Z')))}));
  await button(fp,'Fetch latest dated station forecast').click();await fp.getByText(/12 °C · wind 8 km\/h/).waitFor();assert.match(await fp.locator('.dsn-panel').innerText(),/Open-Meteo model forecast/);
  mode='old';await button(fp,'Fetch latest dated station forecast').click();await fp.getByText('No sourced forecast covers this selected mission epoch. Present-day conditions are never substituted for a future stay.',{exact:true}).waitFor();
  mode='fail';await button(fp,'Fetch latest dated station forecast').click();await fp.getByText(/Failed to fetch|Weather provider unavailable|Load failed/).waitFor();return{selectedUtc:new Date(start).toISOString(),coveredModelForecast:true,presentDayNotSubstituted:true,explicitFailureReadable:true};
 });
}catch(e){report.checks.push({name:'bootstrap',status:'fail',detail:e.stack||String(e)});}finally{
 await main?.c.close();await fixture?.c.close();await browser.close();report.summary={passed:report.checks.filter(x=>x.status==='pass').length,failed:report.checks.filter(x=>x.status==='fail').length};await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));
}
if(report.summary.failed||report.pageErrors.length||report.httpErrors.length)process.exitCode=1;
