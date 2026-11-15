import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const out=process.env.LUNARIO_THEME_EVIDENCE||'/tmp/lunario-theme-evidence';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.SOLARREACH_VIEWPORT_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const report=[];
try {for(const transport of ['web','file']){
 const context=await browser.newContext({viewport:{width:1600,height:1000},reducedMotion:'no-preference'});
 if(transport==='file')await context.setOffline(true);
 const page=await context.newPage(),errors=[],network=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
 await context.addInitScript(()=>{sessionStorage.setItem('lunario-loader-seen','1');window.__loaderTimes=[];new MutationObserver(()=>{const visible=!!document.querySelector('.lunario-loader');const last=window.__loaderTimes.at(-1);if(!last||last.visible!==visible)window.__loaderTimes.push({visible,ms:performance.now()});}).observe(document,{childList:true,subtree:true});});
 const target=transport==='file'?pathToFileURL(process.env.LUNARIO_THEME_FILE||'/tmp/lunario-features.html').href:process.env.LUNARIO_THEME_URL||'http://127.0.0.1:4341';
 await page.goto(target,{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Dismiss introduction',exact:true}).waitFor({timeout:90000});
 await page.getByRole('button',{name:'Dismiss introduction',exact:true}).click();
 const first=await page.evaluate(()=>window.__loaderTimes);const seen=first.find(x=>x.visible),hidden=first.find(x=>!x.visible&&x.ms>seen?.ms);assert.ok(seen&&hidden&&hidden.ms-seen.ms>=3000,JSON.stringify(first));
 const toggle=()=>page.getByRole('button',{name:'Switch to dark mode',exact:true});await toggle().click();
 await page.waitForFunction(()=>document.documentElement.dataset.uiTheme==='dark');
 assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--background').trim()),'#111214');
 const logo=await page.getByRole('img',{name:'Lunario',exact:true}).getAttribute('src');assert.equal(Buffer.from(logo.split(',')[1],'base64').toString(),await readFile('public/branding/lunario/assets/logo-white.svg','utf8'));
 assert.equal(await page.locator('.lunario-loader').count(),0);
 await page.waitForTimeout(400);await page.screenshot({path:`${out}/${transport}-dark.png`});
 for(const hard of [false,true]){
  console.log(transport,hard?'hard-reload':'reload');
  if(hard){const cdp=await context.newCDPSession(page);await cdp.send('Page.reload',{ignoreCache:true});await cdp.detach();}else await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Switch to light mode',exact:true}).waitFor({timeout:90000});
  await page.locator('.lunario-loader').waitFor({state:'hidden',timeout:90000});
  if(await page.getByRole('button',{name:'Dismiss introduction',exact:true}).isVisible())await page.getByRole('button',{name:'Dismiss introduction',exact:true}).click();
  const times=await page.evaluate(()=>window.__loaderTimes);const s=times.find(x=>x.visible),h=times.find(x=>!x.visible&&x.ms>s?.ms);assert.ok(s&&h&&h.ms-s.ms>=3000,JSON.stringify(times));
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.uiTheme),'dark');
 }
 await page.getByRole('button',{name:'Switch to light mode',exact:true}).click();
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.uiTheme),'light');
 console.log(transport,'site-history');await page.getByRole('button',{name:'Show site drawer',exact:true}).click();await page.getByRole('textbox',{name:'Search landing sites',exact:true}).fill('Apollo 12');
 await page.locator('.site-item').filter({hasText:'Apollo 12'}).click();
 const history=page.getByRole('region',{name:'Selected location mission history',exact:true});await history.waitFor();await history.locator('summary').click();assert.match(await history.innerText(),/Surveyor 3/);
 await page.screenshot({path:`${out}/${transport}-site-history.png`});
 await page.locator('.app-header').getByRole('button',{name:'Earth',exact:true}).click();
 for(const station of ['Goldstone','Madrid','Canberra']){
  console.log(transport,station);
  await page.getByRole('group',{name:'DSN ground complexes',exact:true}).getByRole('button',{name:station,exact:true}).click();
  const story=page.getByRole('region',{name:`How ${station} could communicate with the lander`,exact:true});await story.waitFor();assert.match(await story.innerText(),/not establish their current Moon visibility/);
  await story.locator('summary').click();assert.match(await story.innerText(),/does not automatically|do not automatically/);
 }
 await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click();
 await page.waitForTimeout(400);const instance=await page.locator('.scene-host').getAttribute('data-scene-instance');
 await page.getByRole('button',{name:'Switch to light mode',exact:true}).click();await page.waitForTimeout(400);
 assert.equal(await page.locator('.scene-host').getAttribute('data-scene-instance'),instance,'Theme preserves mounted scene');assert.equal(await page.locator('.lunario-loader').count(),0);
 await page.locator('.header-station-details > summary').click();
 const fetchButton=page.getByRole('button',{name:'Fetch dated station forecast',exact:true});
 if(transport==='file')assert.equal(await fetchButton.isDisabled(),true);
 else {
  const start=Math.floor(Date.now()/3600000)*3600;
  await context.route('https://api.open-meteo.com/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({utc_offset_seconds:0,hourly_units:{temperature_2m:'°C',wind_speed_10m:'km/h',precipitation:'mm',cloud_cover:'%'},hourly:{time:Array.from({length:24},(_,i)=>start+i*3600),temperature_2m:Array(24).fill(12),wind_speed_10m:Array(24).fill(15),precipitation:Array(24).fill(2),cloud_cover:Array(24).fill(100)}})}));
  assert.equal(network.filter(x=>x.includes('api.open-meteo')).length,0);await fetchButton.click();
  await page.getByRole('region',{name:'Current dated forecast, separate from mission',exact:true}).waitFor();
  assert.match(await page.getByRole('region',{name:'Selected mission weather',exact:true}).innerText(),/unavailable/);
  assert.match(await page.getByRole('region',{name:'Current dated forecast, separate from mission',exact:true}).innerText(),/Rain|rain/);
 }
 await page.screenshot({path:`${out}/${transport}-earth-context.png`});
 assert.deepEqual(errors,[]);assert.equal(network.filter(x=>x.includes('api.open-meteo')).length,transport==='file'?0:1);if(transport==='file')assert.deepEqual(network,[]);
 report.push({transport,status:'pass',loaderDurationMs:hidden.ms-seen.ms,reload:true,hardReload:true,themePersistence:true,originalWhiteLogo:true,siteHistory:true,allThreeStations:true,noAutomaticWeather:true,httpRequests:network.length});
 await context.close();
}}finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report,null,2));
