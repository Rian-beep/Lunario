#!/usr/bin/env node
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright-core';
const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i++){if(args[i]==='--offline'){options.offline=true;continue;}if(!['--base-url','--file','--output'].includes(args[i])||!args[i+1])throw Error(`Invalid option ${args[i]}`);options[args[i]]=args[++i];}
if(!options['--output']||Boolean(options['--file'])===Boolean(options['--base-url']))throw Error('Use (--base-url URL | --file PATH) [--offline] --output DIR');
const output=resolve(options['--output']);await mkdir(output,{recursive:true});const target=options['--file']?pathToFileURL(resolve(options['--file'])).href:options['--base-url'];
const report={target,checks:[],errors:[],assetRequests:[],offlineRequests:[]};
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1600,height:1000},reducedMotion:'reduce'});
if(options.offline){await context.route(/^https?:\/\//,route=>{report.offlineRequests.push(route.request().url());return route.abort();});await context.setOffline(true);}
const page=await context.newPage();page.setDefaultTimeout(20000);
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('request',r=>{if(/\.(glb|gltf)(\?|$)/.test(r.url()))report.assetRequests.push(r.url());});
const dismiss=async()=>{const guide=page.locator('dialog[aria-labelledby="audience-guide-title"]');if(await guide.isVisible()){await page.keyboard.press('Escape');await guide.waitFor({state:'hidden'});}};
const button=name=>page.getByRole('button',{name,exact:true});
const field=name=>page.locator('label.number-field').filter({hasText:new RegExp(`^${name}`)}).locator('input');
const host=page.locator('.scene-host');
const snapshot=()=>host.evaluate(node=>({instance:node.dataset.sceneInstance,flight:Number(node.dataset.flightRevision),horizon:Number(node.dataset.horizonRevision),endpoint:node.dataset.flightEndpoint,camera:node.dataset.cameraPosition,target:node.dataset.cameraTarget,sun:node.dataset.sunModel,earth:node.dataset.earthModel,sunDraws:Number(node.dataset.sunDraws),earthDraws:Number(node.dataset.earthDraws),sameCanvas:node.querySelector('canvas')===window.__persistenceCanvas,resets:window.__persistenceResets}));
try{
 await page.goto(target,{waitUntil:'domcontentloaded',timeout:60000});await page.getByRole('group',{name:'Audience mode'}).waitFor();await dismiss();await button('Planner').click();await dismiss();await button('3D terrain').click();
 await page.waitForFunction(()=>{const d=document.querySelector('.scene-host')?.dataset;return d?.sunModel==='ready'&&d?.earthModel==='ready';},null,{timeout:90000});
 const view=page.locator('.sq-camera');await view.locator('summary[aria-label="Camera and lighting controls"]').click();await view.getByRole('button',{name:'Sun',exact:true}).click();await page.waitForFunction(()=>Number(document.querySelector('.scene-host')?.dataset.sunDraws)>0);await view.getByRole('button',{name:'Earth',exact:true}).click();await page.waitForFunction(()=>Number(document.querySelector('.scene-host')?.dataset.earthDraws)>0);
 await button('Flight preview').click();if(!await view.evaluate(node=>node.open))await view.locator('summary[aria-label="Camera and lighting controls"]').click();await view.getByRole('button',{name:'Flight',exact:true}).click();await page.waitForTimeout(600);await view.locator('summary[aria-label="Camera and lighting controls"]').click();
 await host.evaluate(node=>{window.__persistenceCanvas=node.querySelector('canvas');window.__persistenceResets=[];new MutationObserver(records=>{for(const r of records){if((r.attributeName==='data-sun-model'||r.attributeName==='data-earth-model')&&node.getAttribute(r.attributeName)!=='ready')window.__persistenceResets.push({attribute:r.attributeName,value:node.getAttribute(r.attributeName)});}}).observe(node,{attributes:true,attributeFilter:['data-sun-model','data-earth-model']});});
 const initial=await snapshot(),requestCount=report.assetRequests.length;assert.ok(initial.instance);assert.ok(initial.sunDraws>0&&initial.earthDraws>0);
 async function check(name,action,kind){const before=await snapshot();await action();await page.waitForTimeout(600);const after=await snapshot();assert.equal(after.instance,initial.instance);assert.equal(after.sameCanvas,true);assert.equal(after.sun,'ready');assert.equal(after.earth,'ready');assert.deepEqual(after.resets,[]);assert.equal(report.assetRequests.length,requestCount);const a=after.camera.split(',').map(Number),b=before.camera.split(',').map(Number);assert.ok(Math.hypot(...a.map((v,i)=>v-b[i]))<1e-6,`camera changed: ${before.camera} -> ${after.camera}`);if(kind==='flight'){assert.ok(after.flight>before.flight);assert.notEqual(after.endpoint,before.endpoint);}if(kind==='horizon')assert.ok(after.horizon>before.horizon);report.checks.push({name,status:'pass',before,after});}
 for(const [name,delta] of [['Wet mass',100],['Thrust',1000],['Heading, from north',5]])await check(name,async()=>{const input=field(name);await input.fill(String(Number(await input.inputValue())+delta));await input.blur();},'flight');
 if(await button('Expand timeline').isVisible())await button('Expand timeline').click();
 await check('landing date',async()=>{const input=page.getByLabel('Landing date and time UTC',{exact:true});const date=new Date((await input.inputValue())+'Z');date.setUTCHours(date.getUTCHours()+1);await input.fill(date.toISOString().slice(0,16));await input.blur();});
 await button('Planner').click();await dismiss();await check('continuous load',async()=>{const input=field('Continuous load');await input.fill(String(Number(await input.inputValue())+10));await input.blur();});
 await button('Horizon analysis').click();await check('observer height',async()=>{await page.locator('.observer-bar').getByRole('button',{name:'10 m',exact:true}).click();},'horizon');
 await page.screenshot({path:resolve(output,'persistent-scene.png')});
}catch(error){report.checks.push({name:'workflow',status:'fail',error:error.stack});await page.screenshot({path:resolve(output,'failure.png')}).catch(()=>{});}finally{await context.close();await browser.close();}
await writeFile(resolve(output,'scene-persistence.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(report.errors.length||report.offlineRequests.length||report.checks.some(c=>c.status!=='pass'))process.exitCode=1;
