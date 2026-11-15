/** Private intercepted fixture transport. No server, shared profile or cold-network claim. */
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import os from 'node:os';
import assert from 'node:assert/strict';
const output=resolve(process.argv[2]??'/tmp/lunario-gpu-baseline');await mkdir(output,{recursive:true});
const flags=process.env.SWIFTSHADER?['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']:['--no-sandbox','--enable-gpu','--use-gl=angle','--use-angle=vulkan'];
const prefix=execFileSync('git',['rev-parse','--show-prefix'],{encoding:'utf8'}).trim();
const baseline=process.env.BASELINE_REF?execFileSync('git',['show',`${process.env.BASELINE_REF}:${prefix}components/workbench/scene/visual-moon/assets.ts`],{encoding:'utf8'}):null;
const plugins=baseline?[{name:'exact-baseline-assets',setup(api){api.onLoad({filter:/[\\/]visual-moon[\\/]assets\.ts$/},()=>({contents:baseline,loader:'ts',resolveDir:resolve('components/workbench/scene/visual-moon')}));}}]:[];
const compiled=await build({plugins,entryPoints:['scripts/evaluation-performance-gpu/fixture.ts'],bundle:true,write:false,format:'iife',platform:'browser'});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:flags});
const report={utc:new Date().toISOString(),baselineRef:process.env.BASELINE_REF??null,commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),flags,browser:browser.version(),host:{hostname:os.hostname(),cpu:os.cpus()[0].model,loadAverage:os.loadavg()},requests:[],errors:[],runs:[],sourceHashes:{},mode:{bitmap:!!process.env.BITMAP,diagnostic:process.env.DECODE??null},scope:'Private intercepted transport; warm OS/disk; no GPU fence/scanout, cold network, full app or M1 claim'};
for(const path of ['components/workbench/scene/visual-moon/assets.ts','components/workbench/scene/visual-moon/bitmap-atlas.ts','components/workbench/scene/visual-moon/material.ts','scripts/evaluation-performance-gpu/fixture.ts','scripts/evaluation-performance-gpu/diagnostic-controls.mjs','scripts/evaluation-performance-gpu/measure.mjs','public/data/visual-moon/manifest.json'])report.sourceHashes[path]=createHash('sha256').update(await readFile(path)).digest('hex');
if(baseline)report.sourceHashes['components/workbench/scene/visual-moon/assets.ts']=createHash('sha256').update(baseline).digest('hex');
function summary(frames,start,end){const f=frames.filter(f=>f.t>=start&&f.t<=end);return {start,end,count:f.length,maxGapMs:Math.max(0,...f.map(f=>f.gap)),gapsOver50ms:f.filter(f=>f.gap>50),maxRenderMs:Math.max(0,...f.map(f=>f.renderMs))};}
try{
 for(let i=0;i<Number(process.env.RUNS??3);i++){
 const context=await browser.newContext({viewport:{width:800,height:800},deviceScaleFactor:1}),page=await context.newPage();
 page.on('pageerror',error=>report.errors.push(String(error)));
 await page.route('https://visual-moon.test/**',async route=>{
  const path=new URL(route.request().url()).pathname;report.requests.push({run:i,path});
  if(path==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><style>body{margin:0}</style><body><script src="/fixture.js"></script>'});
  if(path==='/fixture.js')return route.fulfill({contentType:'text/javascript',body:compiled.outputFiles[0].text});
  if(!/^\/data\/[a-zA-Z0-9/_.-]+$/.test(path)||path.includes('..'))return route.abort();
  try{return await route.fulfill({contentType:{'.json':'application/json','.webp':'image/webp','.jpg':'image/jpeg','.gz':'application/gzip','.bin':'application/octet-stream'}[extname(path)],body:await readFile(resolve('public',path.slice(1)))});}catch{return route.fulfill({status:404,body:'missing fixture asset'});}
 });
 await page.goto('https://visual-moon.test/'+('?'+new URLSearchParams({...(process.env.DECODE?{decode:process.env.DECODE}:{}),...(process.env.BITMAP?{productionBitmap:'1'}:{})})));await page.waitForFunction(()=>window.fixture);
 report.device=await page.evaluate(()=>window.fixture.device);
 report.hardware=/Radeon|AMD|NVIDIA|Apple|Intel/.test(report.device.renderer)&&!/SwiftShader|llvmpipe/i.test(report.device.renderer);
 console.log('renderer',report.device.renderer);
 if(!process.env.SWIFTSHADER)assert.ok(report.hardware,'Native GPU required; set SWIFTSHADER=1 for explicitly labelled fallback');
 const ready=await page.evaluate(()=>window.fixture.load(!!new URL(location.href).searchParams.get('productionBitmap')));
 await page.waitForFunction(()=>window.fixture.state()?.width===8192,null,{timeout:120000});
 await page.waitForTimeout(3100);
 const beforeDecode=await page.evaluate(()=>performance.now());
 for(const width of [1024,2048,4096,8192])for(const mode of ['main','worker'])await page.evaluate(([mode,width])=>window.fixture.decode(mode,width),[mode,width]);
 const data=await page.evaluate(()=>window.fixture.report());
 const landmarks=await page.evaluate(()=>window.fixture.landmarks());
 for(const sample of landmarks)for(let c=0;c<3;c++)assert.ok(Math.abs(sample.actual[c]-sample.expected[c])<=1,'Native GPU sRGB/UV landmark mismatch');
 const beforeViews=report.requests.length,views={};
 for(const [name,lat,lon,atlas] of [['near',0,0,true],['far',0,180,true],['south',-89.9,0,true],['seamMinus',0,179.9,true],['seamPlus',0,-179.9,true],['southLit',-89.9,0,false]]){
  views[name]=await page.evaluate(([lat,lon,atlas])=>window.fixture.view(lat,lon,atlas),[lat,lon,atlas]);
  assert.equal(views[name],await page.evaluate(([lat,lon,atlas])=>window.fixture.view(lat,lon,atlas),[lat,lon,atlas]),'No same-view colour flicker');
  if(i===0)await page.screenshot({path:resolve(output,name+'.png')});
 }
 assert.equal(report.requests.length,beforeViews,'Appearance/camera changes must not fetch');
 const lastUpload=Math.max(...data.uploads.map(u=>u.end));
 const run={ready,...data,landmarks,views,afterReady3s:summary(data.frames,ready.ready,ready.ready+3000),progressive:summary(data.frames,ready.ready,lastUpload+500),afterUploads3s:summary(data.frames,lastUpload,lastUpload+3000),decodeWindow:summary(data.frames,beforeDecode,data.frames.at(-1).t),disposal:await page.evaluate(()=>window.fixture.dispose())};
 report.runs.push(run);console.log(JSON.stringify({run:i,uploads:run.uploads,afterReady:run.afterReady3s,decodes:run.decodes}));
 if(process.env.MAX_GAP_MS)assert.ok(run.afterReady3s.maxGapMs<=Number(process.env.MAX_GAP_MS),'Post-ready frame gap exceeds explicit local regression threshold');
 assert.equal(run.ready.triangles,1015808);assert.equal(run.disposal.geometries,0);assert.ok(run.disposal.textures<=1);
 await context.close();
 }
 assert.deepEqual(report.errors,[]);
}finally{await browser.close();await writeFile(resolve(output,'results.json'),JSON.stringify(report,null,2)+'\n');}
