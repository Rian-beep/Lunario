/** Actual LunarScene/runtime in a private browser; no server or generated app changes. */
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createHash} from 'node:crypto';
const output=resolve(process.argv[2]??'/tmp/lunario-camera-navigation');
await mkdir(output,{recursive:true});
const compiled=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React,{useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {LunarScene} from './components/workbench/scene';
import {loadCatalog} from './lib/catalog';
import {loadTerrain,heightAt} from './lib/terrain';
import {simulateFlight,DEFAULT_FLIGHT} from './lib/flight';
Promise.all([loadCatalog(),loadTerrain()]).then(([catalog,terrain])=>{
 const site=catalog.sites.find(s=>s.id==='shackleton-rim')??catalog.sites[0];
 const trackingReady=ready=>window.trackingReady=ready;
 function Fixture(){
  const [focus,setFocus]=useState('moon'),[serial,setSerial]=useState(0),[follow,setFollow]=useState(undefined);
  const [where,setWhere]=useState({lat:site.lat,lon:site.lon}),[time,setTime]=useState(0),[override,setPath]=useState(null);
  const reference=heightAt(terrain,where.lat,where.lon)?.heightM??0;
  const flight=useMemo(()=>simulateFlight(DEFAULT_FLIGHT,()=>null,1737400+reference),[reference]);
  const path=override??flight;
  window.fixture={setTime,setPath,setWhere,flight,focus,time,select(next){setFocus(next);setSerial(v=>v+1);},follow(){setFollow({id:Date.now(),focusRequestId:serial});}};
  return <><nav>{['moon','lander','earth'].map(next=><button key={next} aria-pressed={focus===next} onClick={()=>window.fixture.select(next)}>{next}</button>)}</nav>
   <LunarScene {...where} assetFocus={focus} focusRequestId={serial} followRequest={follow} onAssetFocusChange={next=>window.fixture.select(next)}
    onTrackingReady={trackingReady} controlsTarget={document.getElementById('controls')} map={catalog.map} terrain={terrain} sites={catalog.sites} selectedSiteId={site.id}
    pose={{sunAz:30,sunEl:10,earthAz:80,earthEl:5}} earthRangeKm={384400} sunRangeKm={149600000}
    horizon={site.horizons[0]} flight={path} flightTime={time} showFlight={true} referenceHeightM={reference}/></>;
 }
 createRoot(document.getElementById('root')).render(<Fixture/>);
});
`},bundle:true,write:false,format:'esm',platform:'browser',jsx:'automatic',plugins:[{name:'fixture-probes',setup(api){
 api.onLoad({filter:/\.css$/},()=>({contents:'export default {}',loader:'js'}));
 api.onLoad({filter:/workbench\/scene\.tsx$/},async args=>({contents:(await readFile(args.path,'utf8')).replace('<style jsx>','<style>'),loader:'tsx'}));
 api.onLoad({filter:/scene\/runtime\.ts$/},async args=>({contents:(await readFile(args.path,'utf8')).replace('host.appendChild(renderer.domElement);','host.appendChild(renderer.domElement);window.cameraRenderer=renderer;'),loader:'ts'}));
}}]});
const report={scope:'Production LunarScene and runtime with committed terrain/NASA assets, private intercepted transport, Chromium/SwiftShader. No shared browser/server, full build, hardware performance or acceptance claim.',sources:{},checks:[],errors:[],requests:[]};
for(const path of ['components/workbench/scene.tsx','components/workbench/scene/runtime.ts'])report.sources[path]=createHash('sha256').update(await readFile(path)).digest('hex');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
report.browser=browser.version();
const page=await browser.newPage({viewport:{width:1100,height:900},reducedMotion:'reduce'});
page.on('console',m=>{if(m.type()==='error')console.error(m.text());});
page.on('pageerror',e=>{report.errors.push(String(e));console.error(e.stack);});
await page.context().route('**/*',async route=>{
 const url=new URL(route.request().url()),path=url.pathname;report.requests.push(path);
 if(url.origin!=='https://camera.test')return route.abort();
 if(path==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><style>body{margin:0;font:14px system-ui}nav,#controls{position:relative;z-index:10;background:white}#controls{height:110px;overflow:auto}.scene-host{width:1100px;height:650px}.sq-scene{position:relative}button{margin:3px}.sq-legend{display:none}</style><div id="controls"></div><main id="root"></main><script type="module" src="/fixture.js"></script>'});
 if(path==='/fixture.js')return route.fulfill({contentType:'text/javascript',body:compiled.outputFiles[0].text});
 if(!/^\/data\/[a-zA-Z0-9/_.-]+$/.test(path)||path.includes('..'))return route.abort();
 try{return await route.fulfill({contentType:{'.js':'application/javascript','.wasm':'application/wasm','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.glb':'model/gltf-binary','.gz':'application/gzip','.bin':'application/octet-stream'}[extname(path)],body:await readFile(resolve('public',path.slice(1)))});}catch{return route.fulfill({status:404,body:'missing fixture asset'});}
});
const host=page.locator('.scene-host');
const snapshot=()=>host.evaluate(node=>({...node.dataset,selected:window.fixture.focus,sourceTime:window.fixture.time,trackingReady:window.trackingReady,memory:{...window.cameraRenderer.info.memory}}));
const waitIdle=mode=>page.waitForFunction(mode=>{const d=document.querySelector('.scene-host')?.dataset;return d?.cameraMode===mode&&d?.assetFlight==='idle';},mode,{timeout:25000});
const select=async name=>{await page.getByRole('button',{name,exact:true}).click();};
const frame=async()=>{const before=Number((await snapshot()).renderFrame);await page.waitForFunction(before=>Number(document.querySelector('.scene-host').dataset.renderFrame)>before,before);};
const drag=async inspect=>{const box=await page.locator('.scene-host canvas').boundingBox();await page.mouse.move(box.x+90,box.y+90);await page.mouse.down();await page.mouse.move(box.x+150,box.y+115,{steps:8});if(inspect){await frame();await frame();await inspect(await snapshot());}await page.mouse.up();await frame();};
const closeVector=(a,b,tolerance=1e-7)=>assert.ok(Math.hypot(...a.split(',').map((v,i)=>Number(v)-Number(b.split(',')[i])))<tolerance,`${a} != ${b}`);
const arrived=async mode=>{await waitIdle(mode);const state=await snapshot();assert.ok(Number(state.vehicleCameraDistanceKm)<.1,'selected vehicle camera must be local');assert.equal(state.vehicleVisible,'true');assert.equal(state.vehicleFraming,'framed');return state;};

async function check(name,action){try{await action();report.checks.push({name,status:'pass'});}catch(error){report.checks.push({name,status:'fail',error:String(error),state:await snapshot()});await page.screenshot({path:resolve(output,`${report.checks.length}-failure.png`)});}}
try{
 await page.goto('https://camera.test/');
 await page.waitForFunction(()=>{const d=document.querySelector('.scene-host')?.dataset;return d?.moonModel==='ready'&&document.body.textContent.includes('Equipment status: ready');},null,{timeout:90000});
 const initial=await snapshot();report.initial=initial;
 await select('moon');await waitIdle('globe');
 await page.emulateMedia({reducedMotion:'no-preference'});
 await select('lander');
 await page.waitForFunction(()=>document.querySelector('.scene-host')?.dataset.assetFlight==='traveling');
 await page.waitForTimeout(700);
 report.beforeClick=await snapshot();
 await check('plain canvas click retains pending Lander destination',async()=>{
  const canvas=page.locator('.scene-host canvas');await canvas.click({position:{x:60,y:60}});
  await page.waitForTimeout(700);const after=await snapshot();report.afterClick=after;
  assert.equal(after.assetFlight,'traveling','a click must not cancel focus travel');
  report.arrived=await arrived('vehicle');
 });
 await check('clicking the framed spacecraft does not restart asset travel',async()=>{
  const before=await snapshot(),bounds=JSON.parse(before.vehicleScreenBounds);
  await page.locator('.scene-host canvas').click({position:{x:(bounds.left+bounds.right)/2,y:(bounds.top+bounds.bottom)/2}});await frame();await frame();
  const after=await snapshot();assert.equal(after.assetFlight,'idle');assert.equal(after.focusRequestId,before.focusRequestId);
  closeVector(after.cameraPosition,before.cameraPosition);assert.equal(after.sourceTime,before.sourceTime);
 });
 await check('drag during asset travel resumes Lander without a preset jump',async()=>{
  await page.emulateMedia({reducedMotion:'reduce'});await select('moon');await waitIdle('globe');
  await page.emulateMedia({reducedMotion:'no-preference'});await select('lander');await frame();await page.waitForTimeout(700);
  await drag();const afterDrag=await snapshot();assert.equal(afterDrag.cameraMode,'vehicle');assert.equal(afterDrag.assetFlight,'traveling');
  assert.equal(afterDrag.selected,'lander');report.dragArrival=await arrived('vehicle');
 });
 await check('portal controls do not bubble into camera navigation',async()=>{
  const before=await snapshot();await page.locator('.header-camera summary').first().click();
  await page.getByRole('button',{name:'Coordinate guides',exact:true}).click();await page.locator('.header-camera summary').first().click();await frame();
  const after=await snapshot();closeVector(after.cameraPosition,before.cameraPosition);closeVector(after.cameraTarget,before.cameraTarget);
  assert.equal(after.cameraMode,'vehicle');assert.equal(after.assetFlight,'idle');
 });
 await check('settled drag and wheel retain the manual Lander view',async()=>{
  await drag();const manual=await snapshot();assert.equal(manual.cameraMode,'vehicle');assert.equal(manual.assetFlight,'idle');
  await frame();const held=await snapshot();closeVector(held.cameraPosition,manual.cameraPosition);closeVector(held.cameraTarget,manual.cameraTarget);
  await page.locator('.scene-host canvas').dispatchEvent('wheel',{deltaY:60});await frame();
  const zoomed=await snapshot();assert.equal(zoomed.assetFlight,'idle');assert.equal(zoomed.cameraMode,'vehicle');
  assert.notEqual(zoomed.cameraPosition,held.cameraPosition);assert.equal(zoomed.sourceTime,held.sourceTime);
 });
 await check('rapid destination replacements settle only at the latest Lander request',async()=>{
  await select('earth');await frame();await select('moon');await frame();await select('lander');await frame();
  const current=await snapshot();assert.equal(current.cameraMode,'vehicle');assert.equal(current.selected,'lander');
  await arrived('vehicle');
 });
 await check('an interrupted Follow approach cannot report ready or change source time',async()=>{
  await page.emulateMedia({reducedMotion:'reduce'});await select('moon');await waitIdle('globe');
  await page.emulateMedia({reducedMotion:'no-preference'});await select('lander');await frame();await page.evaluate(()=>window.fixture.follow());await frame();
  await drag(async during=>{assert.equal(during.cameraMode,'follow');assert.equal(during.assetFlight,'interrupted');assert.equal(during.trackingReady,false);assert.equal(during.sourceTime,0);report.duringFollowDrag=during;});
  await arrived('follow');await frame();assert.equal((await snapshot()).trackingReady,true);
 });
 await check('interrupted site navigation retains a newer Lander request',async()=>{
  await page.emulateMedia({reducedMotion:'reduce'});await select('moon');await waitIdle('globe');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>window.fixture.setWhere({lat:-85,lon:30}));await frame();
  await select('lander');await frame();await drag();
  assert.equal((await snapshot()).cameraMode,'vehicle');report.siteArrival=await arrived('vehicle');
 });
 await check('Follow preserves the source clock, target translation, rewind and variable edits',async()=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>window.fixture.follow());await arrived('follow');
  const before=await snapshot();await page.evaluate(()=>window.fixture.setTime(4));await frame();await frame();const forward=await snapshot();
  assert.equal(forward.sourceTime,4);assert.equal(forward.flightTimeS,'4');assert.notEqual(forward.vehicleWorldPosition,before.vehicleWorldPosition);
  const delta=(a,b)=>a.split(',').map((v,i)=>Number(v)-Number(b.split(',')[i]));
  const dc=delta(forward.cameraPosition,before.cameraPosition),dt=delta(forward.cameraTarget,before.cameraTarget);
  assert.ok(Math.hypot(...dc.map((v,i)=>v-dt[i]))<1e-6);
  await page.evaluate(()=>window.fixture.setTime(0));await frame();await frame();const rewind=await snapshot();closeVector(rewind.cameraPosition,before.cameraPosition);
  await page.evaluate(()=>window.fixture.setPath({...window.fixture.flight,points:window.fixture.flight.points.map(p=>({...p,eastM:p.eastM+5}))}));await frame();await frame();
  const edited=await snapshot();assert.equal(edited.sourceTime,0);assert.equal(edited.flightTimeS,'0');assert.equal(edited.cameraMode,'follow');
  assert.ok(Number(edited.flightRevision)>Number(rewind.flightRevision));assert.notEqual(edited.vehicleWorldPosition,rewind.vehicleWorldPosition);
 });
 await check('renderer, canvas and GPU resources stay bounded across navigation',async()=>{
  for(const name of ['earth','moon','lander']){await select(name);await waitIdle(name==='earth'?'earth':name==='moon'?'globe':'vehicle');}
  const before=await snapshot();const assets=report.requests.filter(p=>/\.(glb|jpg|webp|png)$/.test(p)).length;
  await host.evaluate(node=>{window.savedCameraCanvas=node.querySelector('canvas');});
  for(const name of ['earth','moon','lander']){await select(name);await waitIdle(name==='earth'?'earth':name==='moon'?'globe':'vehicle');}
  const after=await snapshot();assert.equal(after.sceneInstance,initial.sceneInstance);
  assert.ok(await host.evaluate(node=>node.querySelector('canvas')===window.savedCameraCanvas));
  assert.equal(report.requests.filter(p=>/\.(glb|jpg|webp|png)$/.test(p)).length,assets);
  assert.ok(after.memory.geometries<=before.memory.geometries+2);assert.ok(after.memory.textures<=before.memory.textures+2);
  report.final=after;await page.screenshot({path:resolve(output,'lander-final.png')});
 });
 assert.equal((await snapshot()).sceneInstance,initial.sceneInstance);
}finally{
 await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
 await browser.close();
}
console.log(JSON.stringify({checks:report.checks,errors:report.errors,output},null,2));
if(report.errors.length||report.checks.some(c=>c.status!=='pass'))process.exitCode=1;
