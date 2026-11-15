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
const report={target,cycles:[],console:[],pageErrors:[],offlineRequests:[]};
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1600,height:1000},reducedMotion:'reduce'});
if(options.offline){await context.route(/^https?:\/\//,r=>{report.offlineRequests.push(r.request().url());return r.abort();});await context.setOffline(true);}
await context.addInitScript(()=>{window.__contextLifecycle={created:0,lost:[]};const seen=new WeakSet(),original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){const result=original.call(this,type,...args);if(result&&['webgl','webgl2'].includes(type)&&!seen.has(result)){seen.add(result);const id=++window.__contextLifecycle.created;this.addEventListener('webglcontextlost',()=>window.__contextLifecycle.lost.push({id,connected:this.isConnected,time:performance.now()}));}return result;};});
const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.pageErrors.push(e.message));page.on('console',m=>{if(['warning','error'].includes(m.type()))report.console.push({type:m.type(),text:m.text()});});
const button=name=>page.getByRole('button',{name,exact:true});
const checkCanvas=async selector=>{const canvas=page.locator(selector);await canvas.waitFor({state:'visible'});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert.equal(await canvas.evaluate(node=>node.getContext('webgl2')?.isContextLost()),false);};
try{
 await page.goto(target,{waitUntil:'domcontentloaded',timeout:60000});await page.getByRole('group',{name:'Audience mode'}).waitFor();const guide=page.locator('dialog[aria-labelledby="audience-guide-title"]');if(await guide.isVisible()){await page.keyboard.press('Escape');await guide.waitFor({state:'hidden'});}
 for(let cycle=0;cycle<12;cycle++){
  await button('3D terrain').click();await checkCanvas('.scene-host canvas');
  await button('2D map').click();await page.locator('.map-pane canvas').first().waitFor({state:'visible'});
  await button('Earth & Moon').click();await checkCanvas('.dsn-canvas canvas');
  await button('2D map').click();const map=page.locator('.map-pane canvas').first();await map.waitFor({state:'visible'});assert.ok(await map.evaluate(node=>node.width>0&&node.height>0));await page.waitForTimeout(100);
  report.cycles.push({cycle:cycle+1,status:'pass'});
 }
 await button('3D terrain').click();await checkCanvas('.scene-host canvas');
 await page.waitForFunction(()=>{const d=document.querySelector('.scene-host')?.dataset;return d?.moonModel==='ready'&&d?.sunModel==='ready'&&d?.earthModel==='ready';},null,{timeout:90000});
 report.lifecycle=await page.evaluate(()=>window.__contextLifecycle);assert.equal(report.lifecycle.created,25);assert.equal(report.lifecycle.lost.length,24,'Unmounted WebGL contexts were not explicitly released');assert.equal(report.lifecycle.lost.filter(event=>event.connected).length,0,'A currently mounted canvas lost its WebGL context');
 assert.equal(report.console.filter(item=>/Too many active WebGL contexts|PCFSoftShadowMap/.test(item.text)).length,0);
 assert.equal(report.pageErrors.length,0);assert.equal(report.console.filter(item=>item.type==='error').length,0);assert.equal(report.offlineRequests.length,0);
 await page.screenshot({path:resolve(output,'current-scene-after-12-cycles.png')});report.status='pass';
}catch(error){report.status='fail';report.error=error.stack;report.lifecycle=await page.evaluate(()=>window.__contextLifecycle).catch(()=>null);await page.screenshot({path:resolve(output,'failure.png')}).catch(()=>{});}finally{await context.close();await browser.close();}
await writeFile(resolve(output,'webgl-lifecycle.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(report.status!=='pass')process.exitCode=1;
