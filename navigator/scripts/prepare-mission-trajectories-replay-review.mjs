/** Read-only isolated probes of parent-owned replay. No app server or shared profile. */
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root = fileURLToPath(new URL('../',import.meta.url));
const compiled = await build({stdin:{resolveDir:root,loader:'tsx',contents:`
import React from 'react';
import {createRoot} from 'react-dom/client';
import * as T from 'three';
import {PublishedTrajectoryReplay} from './components/mission-trajectories/replay';
import {MISSION_TRAJECTORIES} from './lib/mission-trajectories-catalog';
import {parseMissionTrajectory,trajectorySceneKm} from './lib/mission-trajectories';
const original=MISSION_TRAJECTORIES[0];
const data=parseMissionTrajectory({...original,samples:original.samples.filter(s=>s.t!==10)});
const points=data.samples.map(s=>new T.Vector3(...trajectorySceneKm(s.position)));
const target=new T.Box3().setFromPoints(points).getCenter(new T.Vector3());
window.captureRenderer=renderer=>{const prior=renderer.render;renderer.render=function(scene,camera){
 const line=scene.children.find(o=>o.type==='Line');
 const marker=scene.children.find(o=>o.type==='Mesh');
 window.probe={camera:camera.position.toArray(),cameraRadius:camera.position.length(),pathCenter:target.toArray(),lineVertexCount:line?.geometry.attributes.position.count,sourceTimes:data.samples.map(s=>s.t),markerVisible:marker?.visible};
 return prior.call(this,scene,camera);
};};
createRoot(document.getElementById('root')).render(<PublishedTrajectoryReplay data={data}/>);
`},bundle:true,write:false,platform:'browser',jsx:'automatic',minify:true,plugins:[{name:'read-only-renderer-probe',setup(build){build.onLoad({filter:/components\/mission-trajectories\/replay\.tsx$/},async args=>({contents:(await readFile(args.path,'utf8')).replace('element.append(renderer.domElement);','element.append(renderer.domElement);window.captureRenderer(renderer);'),loader:'tsx'}));}}]});
const executablePath=[process.env.CHROME_PATH,'/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>p&&existsSync(p));
assert.ok(executablePath);
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const replaySha256=createHash('sha256').update(await readFile(new URL('components/mission-trajectories/replay.tsx',new URL('../',import.meta.url)))).digest('hex');
const report={replaySha256,console:[],browser:browser.version(),scope:'Parent replay mounted read-only in private intercepted-network Chromium/SwiftShader; source-derived synthetic gap fixture. No integrated app/human/target GPU acceptance.',errors:[],blockedRequests:[]};
try{
 const page=await browser.newPage({viewport:{width:900,height:900},reducedMotion:'reduce'});
 page.on('console',entry=>report.console.push(entry.type()+': '+entry.text()));
 page.on('pageerror',error=>report.errors.push(error.message));
 await page.route('**/*',route=>{report.blockedRequests.push(route.request().url());return route.abort();});
 await page.setContent('<!doctype html><style>body{font:16px system-ui}button,input{font:inherit}</style><div id="root"></div>');
 await page.addScriptTag({content:compiled.outputFiles[0].text});
 await page.waitForFunction(()=>window.probe,undefined,{timeout:5000}).catch(async error=>{report.document=await page.locator('body').innerText();throw error;});
 report.reducedMotion=await page.evaluate(()=>window.probe);
 assert.ok(Math.abs(report.reducedMotion.cameraRadius-6200)<1e-6,'Reproduce camera stuck at initial overview rather than selected path');
 report.reducedMotion.observed='Camera stays at initial 6200 km radius: reduced mode sets p=1, so if(p<1) never applies destination.';
 const slider=page.getByRole('slider',{name:'Historical replay elapsed seconds'});
 await slider.focus();
 await page.keyboard.press('Home');
 for(let i=0;i<100;i++)await page.keyboard.press('ArrowRight');
 await page.waitForFunction(()=>document.querySelector('[data-replay-seconds]')?.dataset.replaySeconds==='10');
 report.gap=await page.evaluate(()=>({probe:window.probe,distance:document.querySelector('.published-replay').innerText,seconds:document.querySelector('[data-replay-seconds]').dataset.replaySeconds}));
 assert.equal(report.gap.probe.markerVisible,false);
 assert.equal(report.gap.probe.lineVertexCount,108);
 assert.deepEqual(report.gap.probe.sourceTimes.slice(0,2),[0,20]);
 report.gap.observed='At missing t=10 the beacon is hidden and distance unavailable, but a single continuous T.Line connects source t=0 to t=20 across the prohibited gap.';
 report.webgl=await page.locator('canvas').evaluate(canvas=>{const gl=canvas.getContext('webgl2');const debug=gl?.getExtension('WEBGL_debug_renderer_info');return gl?{version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(gl.RENDERER),unmaskedRenderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null}:null;});
 assert.deepEqual(report.errors,[]);
}finally{
 await browser.close();
 await writeFile(new URL('../docs/qa/evaluation/trajectories/parent-replay-probes.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify({cameraRadius:report.reducedMotion.cameraRadius,gapSeconds:report.gap.seconds,gapLineVertexCount:report.gap.probe.lineVertexCount,errors:report.errors},null,2));
