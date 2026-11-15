import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const root=process.env.LUNARIO_TRANSFER_OUT||'/tmp/lunario-asset-transfer-final';await mkdir(root,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});const results=[];
try{for(const transport of ['web','file']){
 const context=await browser.newContext({viewport:{width:1600,height:1000},reducedMotion:'no-preference'});if(transport==='file')await context.setOffline(true);
 const page=await context.newPage(),errors=[],http=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))http.push(r.url());});
 await page.goto(transport==='web'?'http://127.0.0.1:4356/web/index.html':pathToFileURL(process.cwd()+'/public/solarreach-navigator.html').href);
 await page.getByRole('button',{name:'Dismiss introduction',exact:true}).click({timeout:60000});const h=page.locator('.app-header'),scene=()=>page.locator('.scene-host').evaluate(e=>({...e.dataset}));
 await h.getByRole('button',{name:'Moon',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.scene-host')?.dataset.moonModel==='ready',null,{timeout:90000});const instance=(await scene()).sceneInstance;
 const move=async(name,mode)=>{await h.getByRole('button',{name,exact:true}).click();await page.waitForFunction(mode=>{const d=document.querySelector('.scene-host')?.dataset;return d?.cameraMode===mode&&d.assetFlight==='traveling';},mode,{timeout:10000});await page.waitForFunction(mode=>{const d=document.querySelector('.scene-host')?.dataset;return d?.cameraMode===mode&&d.assetFlight==='idle';},mode,{timeout:18000});const d=await scene();assert.equal(d.sceneInstance,instance);assert.ok(d.cameraPosition.split(',').map(Number).every(Number.isFinite));assert.ok(Number(d.cameraBodyRadiusKm)>(mode==='earth'?300000:1737));assert.ok(Number(d.cameraBodyRadiusKm)<(mode==='earth'?500000:10000));return d;};
 const earth=await move('Earth','earth'),moon=await move('Moon','globe');
 await h.getByRole('button',{name:'Earth',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.scene-host')?.dataset.assetFlight==='traveling');await page.waitForTimeout(1700);const retarget=await move('Moon','globe');
 assert.deepEqual(errors,[]);if(transport==='file')assert.deepEqual(http,[]);await page.screenshot({path:root+'/'+transport+'-arrival.png'});results.push({transport,status:'pass',earth,moon,retarget,errors,offlineHTTP:transport==='file'?http:undefined});console.log('PASS '+transport+' Earth ↔ Moon, retarget and single-renderer arrival');await context.close();
}}catch(error){results.push({status:'fail',error:error.stack});process.exitCode=1;}finally{await browser.close();await writeFile(root+'/report.json',JSON.stringify(results,null,2));}
