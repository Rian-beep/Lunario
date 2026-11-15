import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const options={url:'http://127.0.0.1:4340',file:'/tmp/lunario-reference.html',out:'/tmp/lunario-browser',mode:'both',executable:process.env.SOLARREACH_VIEWPORT_CHROME||(existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'/usr/bin/google-chrome')};
for(let i=2;i<process.argv.length;i+=2){const key=process.argv[i].replace(/^--/,'');assert.ok(Object.hasOwn(options,key)&&process.argv[i+1]);options[key]=process.argv[i+1];}
await mkdir(options.out,{recursive:true});
const report={startedUtc:new Date().toISOString(),options,cases:[]};
const hash=x=>createHash('sha256').update(x).digest('hex');
report.scriptSha256=hash(await readFile(new URL(import.meta.url)));report.artifactSha256=existsSync(options.file)?hash(await readFile(options.file)):null;await writeFile(resolve(options.out,'verifier.mjs'),await readFile(new URL(import.meta.url)));
const browser=await chromium.launch({headless:true,executablePath:options.executable});report.browser=browser.version();
async function save(){await writeFile(resolve(options.out,'report.json'),JSON.stringify(report,null,2));}
try{for(const transport of options.mode==='both'?['web','file']:[options.mode]){
 const c={transport,checks:[],errors:[],consoleErrors:[],failedRequests:[],httpRequests:[]};report.cases.push(c);
 const context=await browser.newContext({viewport:{width:1600,height:1000},reducedMotion:'no-preference'});
 if(transport==='file')await context.setOffline(true);
 await context.addInitScript(()=>{window.__publicLoaderProbe={seen:false,overlap:false};const observer=new MutationObserver(()=>{const loader=document.querySelector('.lunario-loader');if(loader&&loader.getClientRects().length){window.__publicLoaderProbe.seen=true;if(document.querySelector('dialog[open]'))window.__publicLoaderProbe.overlap=true;}});observer.observe(document,{childList:true,subtree:true,attributes:true});});
 const page=await context.newPage();page.on('pageerror',e=>c.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')c.consoleErrors.push(m.text());});page.on('requestfailed',r=>c.failedRequests.push(r.url()));page.on('request',r=>{if(/^https?:/.test(r.url()))c.httpRequests.push(r.url());});
 const b=n=>page.getByRole('button',{name:n,exact:true}),scene=()=>page.locator('.scene-host').evaluate(h=>({...h.dataset}));
 const check=async(name,fn)=>{try{const detail=await fn();c.checks.push({name,status:'pass',detail});console.log(`${transport} PASS ${name}`);}catch(e){c.failureScene=await page.locator('.scene-host').evaluate(h=>({...h.dataset})).catch(()=>null);c.checks.push({name,status:'fail',error:e.stack});await page.screenshot({path:resolve(options.out,`${transport}-FAIL.png`)});throw e;}finally{await save();}};
 const dismiss=async()=>{await b('Dismiss introduction').waitFor({state:'visible',timeout:4000});await b('Dismiss introduction').click();};
 const pause=async()=>{await page.getByLabel('Flight playback speed',{exact:true}).selectOption('1');if(await b('Pause experiment').isVisible())await b('Pause experiment').click();};
 const select=async id=>{await page.getByLabel('Reference to load',{exact:true}).selectOption(id);await b('Load reference').click();await page.waitForFunction(()=>Number(document.querySelector('.scene-host')?.dataset.flightTimeS)<.1);};
 try{
  await check('original-loader-wordmark-and-reference-surfaces',async()=>{
   await page.goto(transport==='file'?pathToFileURL(resolve(options.file)).href:options.url,{waitUntil:'domcontentloaded'});
   await page.getByRole('button',{name:'Dismiss introduction',exact:true}).waitFor({state:'visible',timeout:90000});
   const startup=await page.evaluate(()=>window.__publicLoaderProbe);assert.equal(startup.seen,true,'Original loader appeared during fresh document startup');assert.equal(startup.overlap,false,'Onboarding never covers the loader');
   await page.screenshot({path:resolve(options.out,`${transport}-first-introduction.png`)});await dismiss();
   assert.match(await page.title(),/^Lunario/);const img=page.getByRole('img',{name:'Lunario',exact:true});const src=await img.getAttribute('src');assert.ok(src.startsWith('data:image/svg+xml;base64,'));const svg=Buffer.from(src.split(',')[1],'base64');const expectedBrand=(await readFile('components/branding/lunario-vendor.generated.ts','utf8')).match(/export const LUNARIO_WORDMARK_ON_DARK = ("[^"]+");/);assert.ok(expectedBrand);assert.equal(src,JSON.parse(expectedBrand[1]));
   const layout=await page.evaluate(()=>({app:document.querySelector('.lunar-app').getBoundingClientRect().toJSON(),width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scheme:getComputedStyle(document.documentElement).colorScheme,card:getComputedStyle(document.documentElement).getPropertyValue('--card').trim(),font:getComputedStyle(document.body).fontFamily,loaderScripts:document.querySelectorAll('script[data-lunario-vendor="loader"]').length}));
   assert.equal(layout.app.width,layout.width);assert.equal(layout.app.height,layout.height);assert.equal(layout.scrollWidth,layout.width);assert.equal(layout.scheme,'dark');assert.equal(layout.loaderScripts,1);
   await page.screenshot({path:resolve(options.out,`${transport}-public-map.png`)});return{logoSha256:hash(svg),layout};
  });
  await check('local-follow-transfer-no-celestial-excursion',async()=>{
   if(await b('Show inspector').isVisible())await b('Show inspector').click();await b('Flight preview').click();await select('assisted');await b('Follow vehicle').click();await page.waitForFunction(()=>{const d=document.querySelector('.scene-host')?.dataset;return d?.vehicleFraming==='framed'&&d.assetFlight==='idle'&&d.contactReplay==='ready';},null,{timeout:90000});
   c.sceneInstance=(await scene()).sceneInstance;const startControls=await page.getByRole('button',{name:'Play experiment',exact:true}).boundingBox();const pane=await page.locator('.inspector-scroll').boundingBox();assert.ok(startControls&&pane&&startControls.y>=pane.y&&startControls.y+startControls.height<=pane.y+pane.height,'First public Play is visible without scrolling');assert.equal(await page.getByRole('region',{name:'Audience task context',exact:true}).count(),0,'Stay banner does not compete with the flight task');
   await b('Follow vehicle').click();await page.waitForFunction(()=>document.querySelector('.scene-host')?.dataset.cameraMode==='follow');
   const samples=[];for(let i=0;i<12;i++){await page.waitForTimeout(60);const d=await scene();samples.push({distanceKm:Number(d.vehicleCameraDistanceKm),flight:d.assetFlight,visible:d.vehicleVisible,framing:d.vehicleFraming});}
   assert.ok(samples.every(s=>s.distanceKm<.2&&s.flight==='idle'&&s.visible==='true'&&s.framing==='framed'),'Local tracking never takes the celestial zoom-out path');return samples;
  });
  await check('play-pause-replay-and-nominal-contact',async()=>{
   await select('assisted');await page.getByLabel('Flight playback speed',{exact:true}).selectOption('10');await b('Play experiment').click();await b('Pause experiment').waitFor({state:'visible',timeout:90000});await page.waitForFunction(()=>Number(document.querySelector('.scene-host')?.dataset.flightTimeS)>8);await b('Pause experiment').click();const paused=await scene();await page.waitForTimeout(200);assert.equal((await scene()).flightTimeS,paused.flightTimeS);
   await page.getByLabel('Flight playback speed',{exact:true}).selectOption('1');await b('Play experiment').click();await b('Pause experiment').waitFor({state:'visible'});await b('Replay experiment').click();await page.waitForFunction(()=>Number(document.querySelector('.scene-host')?.dataset.flightTimeS)<3);await b('Pause experiment').waitFor({state:'visible'});await page.waitForFunction(()=>Number(document.querySelector('.scene-host')?.dataset.flightTimeS)>.5);await pause();
   await page.getByLabel('Flight playback speed',{exact:true}).selectOption('50');await b('Replay experiment').click();await page.waitForFunction(()=>{const d=document.querySelector('.scene-host')?.dataset;return d&&d.landingContactTimeS?.trim()&&Number(d.flightTimeS)>Number(d.landingContactTimeS)+2;},null,{timeout:90000});await pause();const landed=await scene();assert.equal(landed.vehicleScale,'1');assert.equal(landed.vehicleVisible,'true');assert.equal(landed.vehicleFraming,'framed');assert.ok(JSON.parse(landed.landingDynamics).phase!=='unsupported');assert.match(await page.locator('[data-landing-contact-result] strong').innerText(),/Within entered contact limits/);await page.screenshot({path:resolve(options.out,`${transport}-nominal.png`)});return{pausedTimeS:Number(paused.flightTimeS),landed};
  });
  await check('weak-engine-contact-and-illustrative-breakup',async()=>{
   await select('underpowered');await page.getByLabel('Flight playback speed',{exact:true}).selectOption('50');c.weakBefore=await scene();assert.match(await page.locator('[data-landing-contact-result] strong').innerText(),/Outside entered contact limits/);await b('Play experiment').click();await page.waitForFunction(()=>{const d=document.querySelector('.scene-host')?.dataset;return d&&d.landingContactTimeS?.trim()&&Number(d.flightTimeS)>Number(d.landingContactTimeS)+3;},null,{timeout:90000});await pause();const failed=await scene();assert.equal(failed.cameraMode,'follow');assert.equal(failed.vehicleVisible,'true');assert.equal(failed.vehicleFraming,'framed');assert.ok(Number(failed.landingFragmentCount)>1,'Actual contact continuation breaks the original geometry into parts');assert.ok(Number(failed.terrainClearanceM)>=-.05,'Measured contact remains within the existing signed clearance gate');await page.screenshot({path:resolve(options.out,`${transport}-underpowered.png`)});return failed;
  });
  await check('every-variable-has-usable-help-and-explains-the-edit',async()=>{
   const fields=[['Start altitude','350'],['Horizontal speed','20'],['Vertical speed','-12'],['Heading, from north','180'],['Wet mass','5000'],['Dry mass','2300'],['Thrust','4000'],['Specific impulse','250'],['Burn duration','5'],['Preview duration','1'],['Start east offset','-450'],['Start north offset','100'],['Target radius','1'],['Maximum vertical contact speed','.1'],['Maximum horizontal contact speed','.1'],['Maximum contact tilt','.1'],['Breakup energy threshold','1'],['Contact friction','.5'],['Contact restitution','.7'],['Contact continuation','20'],['Initial pitch','75'],['Final burn pitch','65']];
   const evidence=[];
   for(const [label,newValue] of fields){
    await select(label.includes('pitch')?'manual':'assisted');
    if(['Target radius','Maximum vertical contact speed','Maximum horizontal contact speed','Maximum contact tilt','Breakup energy threshold','Contact friction','Contact restitution','Contact continuation'].includes(label)){
     const details=page.locator('details').filter({has:page.locator('summary').filter({hasText:/^Edit contact limits & continuation$/})});if(!await details.evaluate(d=>d.open))await details.locator('summary').first().click();
    }
    const field=page.locator('label.number-field').filter({has:page.getByRole('button',{name:`About ${label}`,exact:true})});
    const info=field.getByRole('button',{name:`About ${label}`,exact:true});await info.hover();const dialog=page.getByRole('dialog',{name:`About ${label}`,exact:true});await dialog.waitFor();const explanation=await dialog.innerText();assert.ok(explanation.length>120);const bounds=await dialog.boundingBox();assert.ok(bounds&&bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=1601&&bounds.y+bounds.height<=1001);await page.keyboard.press('Escape');
    await field.getByRole('spinbutton').fill(newValue);await page.waitForFunction(label=>document.querySelector('[data-flight-edit-feedback]')?.textContent.includes(`Changed ${label}`),label);
    const feedback=await page.locator('[data-flight-edit-feedback]').innerText();assert.match(feedback,/Playback reset and paused/);assert.ok(Number((await scene()).flightTimeS)<.1);assert.equal(await b('Pause experiment').count(),0);
    const verdict=await page.locator('[data-public-flight-verdict]').innerText();
    if(label==='Thrust')assert.match(verdict,/Too fast up\/down/);
    if(label==='Target radius')assert.match(verdict,/Missed the target/);
    if(label==='Preview duration')assert.match(verdict,/No touchdown/);
    evidence.push({label,newValue,explanation,feedback,verdict});
   }
   return evidence;
  });
  await check('follow-stays-visible-through-launch-and-landing',async()=>{
   const results=[];
   for(const id of ['assisted','underpowered','ascent']){
    await select(id);await page.getByLabel('Flight playback speed',{exact:true}).selectOption('1');
    await page.evaluate(()=>{window.__flightSamples=[];window.__collectFlight=true;let lastTime=-1;const frame=()=>{if(!window.__collectFlight)return;const d=document.querySelector('.scene-host')?.dataset;if(d&&Number(d.flightTimeS)>lastTime&&window.__flightSamples.length<3000){lastTime=Number(d.flightTimeS);window.__flightSamples.push({time:lastTime,visible:d.vehicleVisible,framing:d.vehicleFraming,scale:d.vehicleScale});}requestAnimationFrame(frame);};requestAnimationFrame(frame);});
    await b('Play experiment').click();await b('Pause experiment').waitFor({state:'visible',timeout:90000});await page.waitForFunction(()=>Number(document.querySelector('.scene-host')?.dataset.flightTimeS)>1);
    await page.getByLabel('Flight playback speed',{exact:true}).selectOption('50');
    await page.waitForFunction(id=>{const d=document.querySelector('.scene-host')?.dataset;return d&&(id==='ascent'?Number(d.flightTimeS)>=480:Number(d.flightTimeS)>=Number(d.landingContactTimeS)+12);},id,{timeout:90000});
    await b('Play experiment').waitFor({state:'visible'});const samples=await page.evaluate(()=>{window.__collectFlight=false;return window.__flightSamples;});
    assert.ok(samples.length>2);assert.ok(samples.every(d=>d.visible==='true'&&d.framing==='framed'&&d.scale==='1'),'Vehicle stays physically 1x and framed throughout playback');results.push({id,samples});
   }
   await page.screenshot({path:resolve(options.out,`${transport}-public-follow.png`)});return results;
  });
  await check('ascent-edits-camera-persistence-and-variable-help',async()=>{
   await select('ascent');await page.getByLabel('Flight playback speed',{exact:true}).selectOption('50');await b('Play experiment').click();await b('Pause experiment').waitFor({state:'visible',timeout:90000});await page.waitForFunction(()=>Number(document.querySelector('.scene-host')?.dataset.flightTimeS)>45);await pause();const launched=await scene();assert.equal(launched.landingContactTimeS,'');
   const massField=page.locator('label.number-field').filter({has:page.getByRole('button',{name:'About Wet mass',exact:true})});const mass=massField.getByRole('spinbutton');await mass.fill('4800');await page.waitForFunction(()=>Number(document.querySelector('.scene-host')?.dataset.flightTimeS)<.1);assert.equal(await mass.inputValue(),'4800');assert.equal((await scene()).sceneInstance,c.sceneInstance);
   await page.getByLabel('Reference to load',{exact:true}).selectOption('sideways');assert.equal(await mass.inputValue(),'4800','Browsing presets preserves edited inputs');await page.locator('.app-header').getByRole('button',{name:'Moon',exact:true}).click();await b('Follow vehicle').click();assert.equal(await mass.inputValue(),'4800');assert.equal(await b('Ascent').getAttribute('aria-pressed'),'true');
   const info=massField.getByRole('button',{name:'About Wet mass',exact:true});await info.focus();await info.click();await page.getByRole('dialog',{name:'About Wet mass',exact:true}).waitFor({state:'visible'});assert.match(await page.getByRole('dialog',{name:'About Wet mass',exact:true}).innerText(),/mass|propellant|kg/i);await page.keyboard.press('Escape');await page.screenshot({path:resolve(options.out,`${transport}-ascent.png`)});return{launched,editedMassKg:4800};
  });
  await check('reload-replays-original-animation-and-no-browser-errors',async()=>{
   await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('img',{name:'Lunario',exact:true}).waitFor();await page.locator('.lunario-loader').waitFor({state:'visible',timeout:30000});assert.equal(await page.evaluate(()=>window.Lunario?.loader?.skipped===true),false);await page.locator('.lunario-loader').waitFor({state:'hidden',timeout:30000});assert.equal(await page.locator('.lunario-loader').count(),0);assert.deepEqual(c.errors,[]);assert.deepEqual(c.consoleErrors,[]);assert.deepEqual(c.failedRequests,[]);if(transport==='file')assert.deepEqual(c.httpRequests,[]);return{httpRequests:c.httpRequests.length,replayed:true};
  });
 }finally{await context.close();}
}}
finally{report.scriptSha256After=hash(await readFile(new URL(import.meta.url)));assert.equal(report.scriptSha256After,report.scriptSha256,'Executing verifier remains frozen');report.finishedUtc=new Date().toISOString();report.status=report.cases.every(c=>c.checks.length===8&&c.checks.every(x=>x.status==='pass'))?'pass':'fail';await save();await browser.close();}
