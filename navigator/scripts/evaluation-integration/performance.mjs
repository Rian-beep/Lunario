/** Actual-app timing probe. Run sequentially against matched artifacts; no server control. */
import {chromium} from 'playwright-core';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const [url,output]=process.argv.slice(2);
if(!url||!output)throw Error('Usage: node performance.mjs URL OUTPUT_JSON');
const flags=process.env.LUNARIO_SOFTWARE?['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']:['--no-sandbox','--enable-gpu','--use-gl=angle','--use-angle=vulkan'];
const report={checkedUtc:new Date().toISOString(),url,scriptSha256:createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex'),flags,runs:[],limits:['Isolated browser contexts, local static transport and warm OS files; not cold internet or mobile hardware.','The intentional original three-second intro is reported in initial time, not represented as a rendering stall.','Frame gaps measure the actual app after its first usable Moon image, including progressive refinement. No universal latency target is inferred.']};
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:flags});
try{
 for(let run=0;run<3;run++){
  const context=await browser.newContext({viewport:{width:1600,height:1000},reducedMotion:'reduce'});if(url.startsWith('file:'))await context.setOffline(true);
  const page=await context.newPage(),errors=[],failed=[];page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText}));
  const begin=performance.now();await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
  await page.getByRole('button',{name:'Dismiss introduction',exact:true}).waitFor({timeout:120000});await page.locator('.lunario-loader').waitFor({state:'hidden',timeout:120000});
  const initialMs=performance.now()-begin;await page.getByRole('button',{name:'Dismiss introduction',exact:true}).click();
  const open=performance.now();await page.getByRole('button',{name:'Preview a lunar flight',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.scene-host')?.dataset.moonModel==='ready',null,{timeout:120000});const firstMoonMs=performance.now()-open;
  const frames=await page.evaluate(async()=>{
   const host=document.querySelector('.scene-host'),canvas=host.querySelector('canvas'),gl=canvas.getContext('webgl2'),debug=gl.getExtension('WEBGL_debug_renderer_info');
   const renderer=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
   const start=performance.now(),gaps=[];let previous=start;await new Promise(resolve=>{const tick=now=>{gaps.push(now-previous);previous=now;if(now-start>=4000)resolve();else requestAnimationFrame(tick);};requestAnimationFrame(tick);});
   const sorted=[...gaps].sort((a,b)=>a-b);return{renderer,frames:gaps.length,maxGapMs:Math.max(...gaps),p95GapMs:sorted[Math.floor(sorted.length*.95)],medianGapMs:sorted[Math.floor(sorted.length/2)],contextLost:gl.isContextLost(),scene:{...host.dataset},resources:performance.getEntriesByType('resource').filter(r=>/visual-moon|south-pole-detail/.test(r.name)).map(r=>({name:new URL(r.name).pathname,durationMs:r.duration,transferBytes:r.transferSize}))};
  });
  const edits=[];
  for(const [name,delta]of [['Thrust',10]]){
   const input=page.locator('label.number-field').filter({has:page.getByRole('button',{name:'About '+name,exact:true})}).getByRole('spinbutton');assert.equal(await input.count(),1,`${name} editable control must be present`);
   const before=await page.locator('[data-flight-edit-feedback]').textContent(),value=Number(await input.inputValue());const start=performance.now();
   await input.fill(String(value+delta));await input.press('Tab');
   await page.waitForFunction(({before,name})=>{const text=document.querySelector('[data-flight-edit-feedback]')?.textContent;return text!==before&&text?.includes('Changed '+name);},{before,name},{timeout:15000});
   edits.push({name,feedbackMs:performance.now()-start});
  }
  report.runs.push({run,initialMs,firstMoonMs,frames,edits,errors,failed});await writeFile(output,JSON.stringify(report,null,2)+'\n');
  assert.equal(frames.contextLost,false);assert.deepEqual(errors,[]);await context.close();
 }
}finally{await browser.close();await writeFile(output,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report.runs.map(r=>({run:r.run,initialMs:r.initialMs,firstMoonMs:r.firstMoonMs,maxGapMs:r.frames.maxGapMs,p95GapMs:r.frames.p95GapMs,edits:r.edits,failed:r.failed})),null,2));
