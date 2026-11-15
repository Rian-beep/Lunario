/** Disconnected file fixture, not the parent-owned generated application. */
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const output=resolve(process.argv[2]??'/tmp/lunario-gpu-offline');await mkdir(output,{recursive:true});
const manifest=JSON.parse(await readFile('public/data/visual-moon/manifest.json'));
const metadata=JSON.parse(await readFile('public/data/nasa-model.json'));
const base64=async path=>(await readFile('public'+path)).toString('base64');
const nasa={metadata,meshGzipBase64:await base64(metadata.mesh.url),textureDataUrl:'data:image/jpeg;base64,'+await base64(metadata.texture.url)};
const visual={radiiGzipBase64:await base64(manifest.relief.url),textures:Object.fromEntries(await Promise.all(manifest.colour.assets.filter(t=>t.width<=4096).map(async t=>[t.url,'data:image/webp;base64,'+await base64(t.url)])))};
const original=await readFile('scripts/evaluation-performance-gpu/fixture.ts','utf8');
// Match the existing deterministic offline device budget, without changing the measured web fixture.
const contents=original.replace('maxTextureSize:8192,textureBudgetMiB:512','maxTextureSize:4096,textureBudgetMiB:128');assert.notEqual(contents,original);
const compiled=await build({stdin:{contents,resolveDir:resolve('scripts/evaluation-performance-gpu'),loader:'ts'},bundle:true,write:false,format:'iife',platform:'browser'});
const safe=value=>JSON.stringify(value).replace(/</g,'\\u003c');
const html='<!doctype html><body><script>window.__SOLARREACH_NASA_MODEL__='+safe(nasa)+';window.__LUNARIO_VISUAL_MOON__='+safe(visual)+';</script><script>'+compiled.outputFiles[0].text+'</script>';
const path=resolve(output,'fixture.html');await writeFile(path,html);
const flags=['--no-sandbox','--enable-gpu','--use-gl=angle','--use-angle=vulkan'];
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:flags});
const report={commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),utc:new Date().toISOString(),browser:browser.version(),flags,fixtureSha256:createHash('sha256').update(html).digest('hex'),scope:'Real disconnected file fixture with authentic embedded assets and 4K offline budget; not generated-app acceptance',runs:[]};
try{for(const bitmapDecode of [false,true]){
 const context=await browser.newContext({viewport:{width:800,height:800},offline:true}),page=await context.newPage(),http=[],errors=[];
 page.on('request',r=>{if(/^https?:/.test(r.url()))http.push(r.url());});page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{window.bitmapCalls=0;const original=window.createImageBitmap;window.createImageBitmap=(...args)=>{window.bitmapCalls++;return original(...args);};});
 await page.goto(pathToFileURL(path).href);await page.waitForFunction(()=>window.fixture);
 const device=await page.evaluate(()=>window.fixture.device);
 assert.match(device.renderer,/Radeon/);assert.doesNotMatch(device.renderer,/SwiftShader/);
 await page.evaluate(value=>window.fixture.load(value),bitmapDecode);
 await page.waitForFunction(()=>window.fixture.state().width===4096);
 await page.waitForTimeout(100);
 const data=await page.evaluate(()=>({state:window.fixture.state(),data:window.fixture.report(),bitmapCalls:window.bitmapCalls}));
 const views={};for(const [name,lat,lon,atlas] of [['near',0,0,true],['south',-89.9,0,false]])views[name]=await page.evaluate(([lat,lon,atlas])=>window.fixture.view(lat,lon,atlas),[lat,lon,atlas]);
 const disposal=await page.evaluate(()=>window.fixture.dispose());
 report.runs.push({bitmapDecode,device,...data,views,http,errors,disposal});
 assert.deepEqual(http,[]);assert.deepEqual(errors,[]);assert.equal(data.bitmapCalls,0);
 assert.deepEqual(data.data.uploads.map(t=>t.width),[1024,2048,4096]);assert.equal(data.state.warnings.length,0);
 assert.equal(disposal.geometries,0);assert.equal(disposal.textures,1);
 await context.close();
}assert.deepEqual(report.runs[0].views,report.runs[1].views);
 console.log('PASS disconnected 4K fixture: both options, identical renders, zero HTTP, zero bitmap decode, complete disposal');
}finally{await browser.close();await writeFile(resolve(output,'results.json'),JSON.stringify(report,null,2)+'\n');}
