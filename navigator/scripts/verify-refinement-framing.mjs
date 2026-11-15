#!/usr/bin/env node
/** Black-box refinement verifier: reads production DOM/render observations only.
 * No engines, application bridges, injected state, forced clicks, server or build. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile, appendFile, mkdir, mkdtemp, rm} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const sharp=createRequire(pathToFileURL(resolve('package.json')))('sharp');

const opts = {marker:'/tmp/solarreach-refinement-c15-ready.json', instructions:'/tmp/refinement-c15-qa-instructions.txt', output:'/tmp/refinement-framing-c15',
  sourceBundle:'/tmp/lunar-window-c15-source.bundle', findings:'/tmp/refine-c15-visual-findings.txt',
  modes:'http,file', scenarios:'nominal,breakup,bounce', widths:'1280,1728,800', sections:'framing,poles,import-return,model,surfaces,zoom,contrast,expanded-contrast,maps,graphs',
  zoomChecks:'1,2', executable:'/usr/bin/google-chrome', playwright:'/home/luke/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs'};
for(let i=2;i<process.argv.length;i++) {
  const key=process.argv[i].replace(/^--/,'');
  assert.ok(Object.hasOwn(opts,key)&&process.argv[i+1],`Unknown/missing ${process.argv[i]}`);
  opts[key]=process.argv[++i];
}
const output=resolve(opts.output), findings=opts.findings;
await mkdir(output,{recursive:true});
const sha=data=>createHash('sha256').update(data).digest('hex');
const report={startedUtc:new Date().toISOString(),opts,checks:[],sessions:[],
  machine:{host:os.hostname(),cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,memoryBytes:os.totalmem()},
  limitations:['Agent verification is not human acceptance. No actual screen-reader testing.',
    'Forced ANGLE SwiftShader software rendering; timing is not hardware GPU performance.',
    'Fresh browser contexts; OS, server and disk caches are not flushed.',
    'Only production-owned DOM/model/render readouts; no independent terrain/vehicle qualification.']};
const flags=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--force-color-profile=srgb'];
let marker, browser, chromium;
async function save(){await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');}
async function check(name,run,page){
  const start=performance.now();
  try {const detail=await run();report.checks.push({name,status:'pass',elapsedMs:performance.now()-start,detail});console.log(`PASS ${name}`);return detail;}
  catch(error){
    const screenshot=join(output,`${name.replace(/[^a-z0-9-]/gi,'_')}-FAIL.png`);
    if(page&&!page.isClosed()){
      await shot(page,name.replace(/[^a-z0-9-]/gi,'_')+'-FAIL').catch(()=>{});
      await writeFile(screenshot+'.txt',await page.locator('body').innerText().catch(()=>''));
    }
    const dataset=page&&!page.isClosed()&&await host(page).count()===1?await data(page):null;report.checks.push({name,status:'fail',elapsedMs:performance.now()-start,error:error.stack,screenshot,dataset});
    await appendFile(findings,`${new Date().toISOString()} FAIL ${name}\nCandidate ${JSON.stringify(marker)}\n${error.stack}\nScreenshot ${screenshot}\nReport ${output}/report.json\n\n`);
    console.log(`FAIL ${name}: ${error.message}`);throw error;
  } finally {await save();}
}
async function attempt(name,run,page){return check(name,run,page);}
const button=(p,name)=>p.getByRole('button',{name,exact:true});
const host=p=>p.locator('.scene-host');
const field=(p,name)=>p.locator('label.number-field').filter({hasText:new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}`)}).locator('input');
const data=p=>host(p).evaluate(n=>({...n.dataset}));
async function frame(p,count=2){const before=Number((await data(p)).renderFrame);assert.ok(Number.isFinite(before),'renderFrame required');await p.waitForFunction(({before,count})=>Number(document.querySelector('.scene-host')?.dataset.renderFrame)>=before+count,{before,count},{timeout:30000});return data(p);}
async function dismiss(p){const intro=p.locator('dialog[aria-labelledby="audience-guide-title"]');if(await intro.isVisible()){await p.keyboard.press('Escape');await intro.waitFor({state:'hidden'});}}
async function inspector(p){if(await button(p,'Show inspector').isVisible())await button(p,'Show inspector').click();}
async function disclosure(p,text,open=true){const s=p.locator('summary').filter({hasText:text});assert.equal(await s.count(),1,`Unique summary ${text}`);if(await s.evaluate(n=>n.parentElement.open)!==open)await s.click();}
async function camera(p,name){await disclosure(p,/^Camera & lighting$/);await p.getByRole('group',{name:'3D camera',exact:true}).getByRole('button',{name,exact:true}).click();await p.keyboard.press('Escape');await p.waitForFunction(mode=>{const d=document.querySelector('.scene-host')?.dataset;return d?.cameraMode===mode&&d.assetFlight==='idle';},name.toLowerCase(),{timeout:90000});await frame(p);}
async function edit(p,name,value){await inspector(p);const n=field(p,name);await n.fill(String(value));await n.blur();await frame(p);assert.equal(Number(await n.inputValue()),Number(value));}
const vec=text=>text.split(',').map(Number);
function distance(a,b){assert.equal(a.length,b.length);assert.ok([...a,...b].every(Number.isFinite));return Math.hypot(...a.map((n,i)=>n-b[i]));}
async function ready(p){await p.waitForFunction(()=>{const n=document.querySelector('.scene-host');return n?.dataset.moonModel==='ready'&&n.dataset.earthModel==='ready'&&n.dataset.sunModel==='ready'&&n.dataset.surfaceStatus!=='preparing'&&n.dataset.surfaceStatus!=='error'&&Number(n.dataset.renderFrame)>1&&document.body.textContent.includes('Equipment status: ready');},null,{timeout:180000});await p.waitForLoadState('networkidle');await frame(p);assert.ok(!/Some bundled imagery could not load|NASA model unavailable/.test(await p.locator('body').innerText()),'No production texture/model failure');}
async function shot(p,name){const path=join(output,`${name}.png`),cdp=await p.context().newCDPSession(p);try{const capture=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});await writeFile(path,Buffer.from(capture.data,'base64'));return path;}finally{await cdp.detach();}}
function captureEvents(p,session){
  const short=url=>url.startsWith('data:')?`${url.slice(0,url.indexOf(','))};bytes=${url.length};sha=${sha(url)}`:url;
  p.on('request',r=>session.requests.push({url:short(r.url()),type:r.resourceType()}));
  p.on('requestfailed',r=>session.failedRequests.push({url:short(r.url()),error:r.failure()?.errorText}));
  p.on('response',r=>{if(r.status()>=400)session.httpErrors.push({url:short(r.url()),status:r.status()});});
  p.on('pageerror',e=>session.pageErrors.push(e.stack));
  p.on('console',m=>{if(m.type()==='error')session.consoleErrors.push({text:m.text(),location:m.location()});});
}
const newSession=id=>({id,requests:[],failedRequests:[],httpErrors:[],pageErrors:[],consoleErrors:[]});
async function network(session,mode){assert.deepEqual(session.pageErrors,[]);assert.deepEqual(session.consoleErrors,[]);assert.deepEqual(session.httpErrors,[]);assert.deepEqual(session.failedRequests,[]);const http=session.requests.filter(r=>/^https?:/.test(r.url));if(mode==='file')assert.equal(http.length,0,'Zero offline HTTP attempts');return {requestCount:session.requests.length,httpAttempts:http.length};}
async function originalAssets(bytes){
  const html=bytes.toString('utf8'),groups={};
  for(const name of ['EQUIPMENT','CELESTIAL_MODELS']){const match=html.match(new RegExp(`window\\.__SOLARREACH_${name}__=(.*?);(?:window\\.|</script>)`));assert.ok(match,`Embedded ${name}`);groups[name]=JSON.parse(match[1]);}
  const modelMatch=html.match(/window\.__SOLARREACH_NASA_MODEL__=(.*?);window\./);assert.ok(modelMatch,'Original extracted NASA Moon assets embedded');
  const model=JSON.parse(modelMatch[1]),moonMesh=Buffer.from(model.meshGzipBase64,'base64'),atlas=Buffer.from(model.textureDataUrl.split(',')[1],'base64');
  assert.equal(sha(moonMesh),'b5b8e312a88be26013fb8fd167586ade5ea695a6389e3a7a7d0fdab72158cb8e','Original extracted NASA mesh bytes unchanged');
  assert.equal(sha(atlas),'cc32b024491668b8a2d4e1a6c911ce9a130e9eb8e6704f65027697877f6aa77f','Original8K NASA atlas bytes unchanged');
  assert.equal(html.split(model.textureDataUrl).length-1,1,'Original8K atlas embedded exactly once');
  const sourceAssets=[{path:'original-nasa-moon-mesh.bin.gz',bytes:moonMesh.length,sha256:sha(moonMesh)},{path:'original-nasa-moon-8k.jpg',bytes:atlas.length,sha256:sha(atlas)}];
  const imageryMatch=html.match(/window\.__SOLARREACH_IMAGERY__=(.*?);window\./);assert.ok(imageryMatch);
  const imagery=JSON.parse(imageryMatch[1]),sourceImagery=JSON.parse(await readFile(join(marker.sourceCheckPath,'public/data/imagery.json'),'utf8'));
  const fine=imagery.patches.filter(p=>p.id.endsWith('-nac-surface'));assert.equal(fine.length,6,'Six actual bundled fine NASA site patches');
  for(const patch of fine){
    const source=sourceImagery.patches.find(p=>p.id===patch.id);assert.ok(source);assert.equal(patch.stepM,2.090320587158203);assert.equal(patch.sourceEndpoint,'https://trek.nasa.gov/tiles/Moon/SP/LRO_NAC_Mosaic_1mpp_SP');
    const bytes=Buffer.from(patch.url.split(',')[1],'base64'),original=await readFile(join(marker.sourceCheckPath,'public',source.url));assert.equal(sha(bytes),sha(original),'Bundled NASA surface patch matches final source bytes');
    sourceAssets.push({path:source.url,bytes:bytes.length,sha256:sha(bytes),outputSamplingM:patch.stepM,sourcePixelM:patch.sourcePixelM});
  }
  return sourceAssets.concat([
    ['EQUIPMENT','/data/equipment/apollo-lunar-module.glb','379101dfcee399267addf771709107c35e826b0b9e5233272f123e4c8a585c4e'],
    ['CELESTIAL_MODELS','/data/celestial-models/assets/earth.glb','05a5aea99db8ab472487a06debc3b5d0b2cae7636a1a6b9ecfa40b7d1722ba23'],
    ['CELESTIAL_MODELS','/data/celestial-models/assets/sun.glb','a178f5c43c2c9a6ee6c011c315149a7ab5a2594fd5aa9119ee219625a18da1dd'],
  ].map(([group,path,expected])=>{const uri=groups[group][path];assert.ok(uri?.startsWith('data:model/gltf-binary;base64,'));const asset=Buffer.from(uri.split(',')[1],'base64');assert.equal(sha(asset),expected,`Original NASA asset ${path}`);return {path,bytes:asset.length,sha256:sha(asset)};}));
}
async function identity(){const response=await fetch(marker.url,{cache:'no-store',signal:AbortSignal.timeout(120000)});assert.ok(response.ok);const hash=createHash('sha256');let bytes=0;for await(const chunk of response.body){hash.update(chunk);bytes+=chunk.length;}const digest=hash.digest('hex');assert.equal(digest,marker.artifactSha256,'HTTP must equal immutable offline artifact');return {bytes,sha256:digest,status:response.status};}
function assertFraming(d,measurement){
  assert.equal(d.vehicleFraming,'framed',`Physical lander must be framed: ${d.vehicleFraming}`);
  assert.equal(d.vehicleVisible,'true');
  const bounds=JSON.parse(d.vehicleScreenBounds),safe=JSON.parse(d.unoccludedCanvas);
  for(const r of [bounds,safe])assert.ok(Object.values(r).every(Number.isFinite));
  assert.ok(bounds.left>=safe.left-.1&&bounds.right<=safe.right+.1&&bounds.top>=safe.top-.1&&bounds.bottom<=safe.bottom+.1,'Vehicle inside declared unoccluded CSS rectangle');
  assert.ok(bounds.left>=-.1&&bounds.top>=-.1&&bounds.right<=measurement.host.width+.1&&bounds.bottom<=measurement.host.height+.1,'Vehicle inside actual host');
  assert.ok(bounds.right-bounds.left>2&&bounds.bottom-bounds.top>2,'Visible physical geometry must not collapse to a point');
  const globalRect=rect=>({left:rect.left+measurement.host.x,right:rect.right+measurement.host.x,top:rect.top+measurement.host.y,bottom:rect.bottom+measurement.host.y});
  for(const [label,rect]of [['vehicle',globalRect(bounds)],['declared safe canvas',globalRect(safe)]]){const v=measurement.viewport;assert.ok(rect.left>=v.left-.1&&rect.right<=v.right+.1&&rect.top>=v.top-.1&&rect.bottom<=v.bottom+.1,`${label} must lie inside the actual visual viewport: ${JSON.stringify(rect)} versus ${JSON.stringify(v)}`);}

  const intersect=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>.5&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>.5;
  for(const panel of measurement.panels)assert.ok(!intersect(bounds,panel),`Vehicle overlaps ${panel.selector}`);
  assert.equal(Number(d.vehicleScale),1,'Physical geometry stays at nominal1×');
  return {bounds,safe};
}
async function observeCompleted(p){
  return host(p).evaluateHandle(n=>{
    const samples=[];
    const observer=new MutationObserver(()=>{
      const d={...n.dataset};if(samples.at(-1)?.renderFrame===d.renderFrame)return;
      const r=n.getBoundingClientRect(),v=visualViewport;
      const selectors=['.inspector','.site-drawer','.workspace-heading','.timeline','.flight-telemetry','.header-dropdown-content','.sq-position','.sq-legend','.scene-inline-controls','.scene-contact-status','.sq-readout','.drawer-toggles','.location-restore','.timeline-restore','.flight-hud-restore'];
      const panels=selectors.flatMap(selector=>[...document.querySelectorAll(selector)].filter(el=>!el.closest('[hidden]')&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden'&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).opacity!=='0').map(el=>{const b=el.getBoundingClientRect();return{selector,left:b.left-r.left,right:b.right-r.left,top:b.top-r.top,bottom:b.bottom-r.top};}));
      samples.push({...d,observedMs:performance.now(),measurement:{host:{x:r.x,y:r.y,width:r.width,height:r.height},viewport:{left:v?.offsetLeft??0,top:v?.offsetTop??0,right:(v?.offsetLeft??0)+(v?.width??innerWidth),bottom:(v?.offsetTop??0)+(v?.height??innerHeight)},panels}});
    });
    observer.observe(n,{attributes:true,attributeFilter:['data-render-frame']});
    return {stop(){observer.disconnect();return samples;}};
  });
}
async function framing(p,name){
  const d=await frame(p), measurement=await host(p).evaluate(n=>{
    const r=n.getBoundingClientRect(),rect=el=>{const b=el.getBoundingClientRect();return{left:b.left-r.left,right:b.right-r.left,top:b.top-r.top,bottom:b.bottom-r.top};};
    // Independently inspect visible screen surfaces, not the app's computed safe rectangle.
    const selectors=['.inspector','.site-drawer','.workspace-heading','.timeline','.flight-telemetry','.header-dropdown-content','.sq-position','.sq-legend','.scene-inline-controls','.scene-contact-status','.sq-readout','.drawer-toggles','.location-restore','.timeline-restore','.flight-hud-restore'];
    const v=visualViewport;return {viewport:{left:v?.offsetLeft??0,top:v?.offsetTop??0,right:(v?.offsetLeft??0)+(v?.width??innerWidth),bottom:(v?.offsetTop??0)+(v?.height??innerHeight)},host:{x:r.x,y:r.y,width:r.width,height:r.height},panels:selectors.flatMap(selector=>[...document.querySelectorAll(selector)].filter(el=>!el.closest('[hidden]')&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden'&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).opacity!=='0').map(el=>({selector,...rect(el)})))};
  });
  const {bounds,safe}=assertFraming(d,measurement);
  const screenshot=await shot(p,name);
  return {renderFrame:Number(d.renderFrame),framing:d.vehicleFraming,bounds,safe,measurement,screenshot,physical:{target:d.cameraTarget,camera:d.cameraPosition,com:d.vehicleWorldPosition,zoom:d.framingProjectionZoom,vehicleScale:d.vehicleScale}};
}
async function preserve(p,canvas,instance){assert.equal((await data(p)).sceneInstance,instance);assert.ok(await host(p).evaluate((n,c)=>n.querySelector('canvas')===c,canvas),'Same actual canvas');}
async function openSurface(p,label,name){const trigger=button(p,label);await trigger.focus();await trigger.press('Enter');const dialog=p.getByRole('dialog',{name,exact:true});await dialog.waitFor();return {trigger,dialog};}
async function reflow(p,surface){const m=await surface.evaluate(n=>{const r=n.getBoundingClientRect();return {innerWidth,documentWidth:document.documentElement.scrollWidth,clientWidth:n.clientWidth,scrollWidth:n.scrollWidth,left:r.left,right:r.right,top:r.top,bottom:r.bottom};});assert.ok(m.documentWidth<=m.innerWidth+1,'Document reflow');assert.ok(m.left>=-1&&m.right<=m.innerWidth+1,'Surface within viewport');assert.ok(m.scrollWidth<=m.clientWidth+1,'Surface contains horizontal overflow in dedicated scroll regions');return m;}
async function modalKeys(p,dialog,trigger){
  await p.keyboard.press('Tab');assert.ok(await dialog.evaluate(n=>n.contains(document.activeElement)),'Tab focus inside modal');
  await p.keyboard.press('Shift+Tab');const reverse=await dialog.evaluate(n=>({inside:n.contains(document.activeElement),documentFocused:document.hasFocus()}));if(!reverse.inside&&!reverse.documentFocused)await p.keyboard.press('Shift+Tab');assert.ok(await dialog.evaluate(n=>n.contains(document.activeElement)),'Reverse Tab returns inside modal, allowing browser chrome');
  await p.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.ok(await trigger.evaluate(n=>document.activeElement===n),'Focus returns to opener');
}
async function contrast(p,locator,name){
  await p.mouse.move(5,5);if(await p.locator('.variable-tooltip:visible').count()){await p.keyboard.press('Tab');await p.waitForFunction(()=>!document.querySelector('.variable-tooltip'),null,{timeout:5000});}
  await locator.scrollIntoViewIfNeeded();
  const info=await locator.evaluate(n=>{const s=getComputedStyle(n),r=n.getBoundingClientRect();const layers=[];for(let el=n;el;el=el.parentElement){const c=getComputedStyle(el);layers.push({background:c.backgroundColor,image:c.backgroundImage,opacity:c.opacity,filter:c.filter,blend:c.mixBlendMode});}return{viewport:{width:innerWidth,height:innerHeight},text:n.textContent.slice(0,120),color:s.color,fontSize:s.fontSize,fontWeight:s.fontWeight,layers,rect:{x:r.x,y:r.y,width:r.width,height:r.height}};});
  const lum=a=>a.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
  // Only the unmodified screenshot supplies foreground/background colours. CSS is diagnostic.
  const screenshot=await shot(p,name),decoded=await sharp(await readFile(screenshot)).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const scaleX=decoded.info.width/info.viewport.width,scaleY=decoded.info.height/info.viewport.height;
  const pixel=(x,y)=>{const at=(y*decoded.info.width+x)*decoded.info.channels;return [...decoded.data.subarray(at,at+3)];};
  const background=[];
  for(const side of [-5,-3])for(const fraction of [.25,.5,.75]){
    const x=Math.floor((info.rect.x+side)*scaleX),y=Math.floor((info.rect.y+info.rect.height*fraction)*scaleY);
    if(x>=0&&y>=0&&x<decoded.info.width&&y<decoded.info.height)background.push({x,y,color:pixel(x,y)});
  }
  assert.ok(background.length>=3,'Actual adjacent blank-margin background pixels required');
  const sortedBackground=[...background].sort((a,b)=>lum(a.color)-lum(b.color)),bg=sortedBackground[Math.floor(sortedBackground.length/2)].color;
  const glyphs=[];
  for(let y=Math.max(0,Math.ceil(info.rect.y*scaleY));y<Math.min(decoded.info.height,(info.rect.y+info.rect.height)*scaleY);y++)for(let x=Math.max(0,Math.ceil(info.rect.x*scaleX));x<Math.min(decoded.info.width,(info.rect.x+info.rect.width)*scaleX);x++){
    const color=pixel(x,y);if(lum(color)>lum(bg)+.08)glyphs.push({x,y,color});
  }
  assert.ok(glyphs.length>=9,`${name}: actual pale glyph pixels must exist above charcoal background`);
  glyphs.sort((a,b)=>lum(b.color)-lum(a.color));
  // Median of the brightest 10% rejects an isolated bright pixel and anti-alias edges.
  const cores=glyphs.slice(0,Math.max(9,Math.ceil(glyphs.length*.1))),glyph=cores[Math.floor(cores.length/2)].color;
  const glyphContrast=ratio(glyph,bg),samples=background.map(sample=>({...sample,contrast:ratio(glyph,sample.color)}));
  assert.ok(glyphContrast>=4.5,`${name}: actual pale raster glyph/background contrast ${glyphContrast}`);
  assert.ok(samples.every(sample=>sample.contrast>=4.5),`${name}: glyph contrast against every adjacent rendered background`);
  return {name,...info,method:'Unmodified screenshot only: actual pale glyph cores against adjacent rendered background; CSS diagnostic only',physicalPixelsPerCssPixel:{x:scaleX,y:scaleY},background:samples,glyphPixels:glyphs.length,corePixels:cores.length,actualGlyph: glyph,glyphExamples:cores.filter((_,i)=>i%Math.max(1,Math.floor(cores.length/12))===0).slice(0,12),glyphContrast,screenshot};
}
async function contactContrast(p,id){
  const card=p.locator('.inspector [data-landing-contact-result]');assert.equal(await card.count(),1,'Unique actual expanded contact card');
  const state=await card.getAttribute('class');assert.ok(await card.locator('strong').isVisible());
  const verdict=await contrast(p,card.locator('strong'),`${id}-expanded-contact-verdict`),paragraphs=[];
  for(const [i,paragraph]of (await card.locator(':scope > p').all()).entries())paragraphs.push(await contrast(p,paragraph,`${id}-expanded-contact-body-${i}`));
  assert.ok(paragraphs.length>=2,'Actual contact paragraphs sampled after normal inspector scrolling');return{state,verdict,paragraphs};
}
async function materials(p,dialog,id,expected){
  const summary=dialog.locator('summary').filter({hasText:/^Create a problem set and teaching materials$/});await summary.click();const builder=summary.locator('..');
  const title='QA Moon <b>& mission</b>',prompt='Explain <em>terrain & sphere</em> using captured values.',hint='Keep <script>example</script> as literal text.';
  await builder.getByLabel('Worksheet title',{exact:true}).fill(title);await builder.getByLabel('Earth contact and link evidence',{exact:true}).uncheck();
  await builder.getByRole('button',{name:'Capture current scenario for worksheet',exact:true}).click();await builder.getByText('Teaching material captured. Navigator changes will not alter this worksheet.',{exact:true}).waitFor();
  await builder.locator('summary').filter({hasText:/^1\. /}).click();await builder.locator('label').filter({hasText:/^Question/}).locator('textarea').first().fill(prompt);await builder.locator('label').filter({hasText:/^Hint/}).locator('textarea').first().fill(hint);
  async function download(name,suffix){const pending=p.waitForEvent('download');await builder.getByRole('button',{name,exact:true}).click();const path=join(output,`${id}-${suffix}`);await(await pending).saveAs(path);return {path,bytes:await readFile(path,'utf8')};}
  const student=await download('Export student worksheet','student.html'),teacher=await download('Export teacher answer key','teacher.html'),json=await download('Export teacher JSON','teacher.json'),sheet=JSON.parse(json.bytes);
  assert.equal(sheet.version,1);assert.equal(sheet.title,title);assert.equal(sheet.questions.length,4);assert.deepEqual(sheet.scenario,expected.scenario,'Exact captured production-export scenario');
  assert.equal(sheet.questions[0].prompt,prompt);assert.equal(sheet.questions[0].hint,hint);assert.ok(sheet.questions.every(q=>q.topic!=='contact'));
  for(const html of [student.bytes,teacher.bytes]){assert.match(html,/<math/);assert.ok(html.includes('&lt;b&gt;'));assert.ok(html.includes('&lt;script&gt;example&lt;/script&gt;'));assert.ok(!html.includes('<script>example'));
    assert.ok(html.includes('&lt;em&gt;terrain &amp; sphere&lt;/em&gt;'));
  }
  assert.ok(!student.bytes.includes('Answer and interpretation:')&&!student.bytes.includes('"scenario"'),'Student has no hidden teacher answers/full scenario');
  for(const q of sheet.questions)assert.ok(!student.bytes.includes(q.answer),'No teacher answer copied into student HTML');assert.ok(teacher.bytes.includes('Answer and interpretation:'));
  const screenshot=await shot(p,`${id}-material-builder`);
  await dialog.getByRole('button',{name:'Apply candidate to navigator',exact:true}).click();
  const stable=JSON.parse((await download('Export teacher JSON','teacher-after-navigator-edit.json')).bytes);assert.deepEqual(stable,sheet,'Capture remains frozen after actual navigator input change');
  await builder.getByRole('button',{name:'Replace capture with current scenario',exact:true}).click();
  const recaptured=JSON.parse((await download('Export teacher JSON','teacher-recaptured.json')).bytes);assert.notDeepEqual(recaptured.scenario,sheet.scenario,'Explicit recapture reads actual changed navigator');
  await summary.click();
  return {screenshot,student:{path:student.path,sha256:sha(student.bytes)},teacher:{path:teacher.path,sha256:sha(teacher.bytes)},json:{path:json.path,sha256:sha(json.bytes)},scenarioKey:sheet.scenarioKey,recapturedScenarioKey:recaptured.scenarioKey,questionCount:sheet.questions.length};
}
async function teachingPlots(p,dialog,id){
  const result=[];const plots=dialog.locator('figure svg[role="img"]');assert.equal(await plots.count(),4,'Controlled response, paired terrain/sphere storage and illustrative irradiance plots');
  assert.deepEqual(await dialog.locator('figure figcaption').allTextContents(),['Controlled response across tested inputs','Terrain: baseline and candidate storage','Smooth sphere: baseline and candidate storage','Illustrative irradiance response'],'Every actual teaching plot is in scope');
  for(const [i,plot]of (await plots.all()).entries()){
    await plot.scrollIntoViewIfNeeded();const axes=await plot.evaluate(n=>({box:n.getBoundingClientRect().toJSON(),viewBox:n.getAttribute('viewBox'),paths:n.querySelectorAll('path').length,texts:[...n.querySelectorAll('text')].map(t=>({text:t.textContent,rect:t.getBoundingClientRect().toJSON(),rotated:!!t.getAttribute('transform')?.includes('rotate')}))}));
    assert.ok(axes.paths>0&&axes.texts.length>=4,'Actual plotted curves and named/ticked axes');
    const intersects=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>.5&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>.5;
    for(const title of axes.texts.filter(t=>t.rotated))for(const tick of axes.texts.filter(t=>!t.rotated))assert.ok(!intersects(title.rect,tick.rect),'Rotated y-axis title does not overlap tick text');
    for(const text of axes.texts)assert.ok(text.rect.left>=axes.box.left-.5&&text.rect.right<=axes.box.right+.5,'Teaching tick/title text stays inside actual graph bounds');assert.match(axes.texts.at(-2).text,/\([^)]*(?:m|h|W|°|s|%)|UTC/,'Horizontal teaching axis names units');assert.match(axes.texts.at(-1).text,/\([^)]*(?:Wh|W|%|dB|h|m)/,'Vertical teaching axis names units');const values=plot.locator('..').getByText('Exact plotted values',{exact:true});await values.focus();await values.press('Enter');assert.ok(await plot.locator('..').locator('table').isVisible(),'Normal keyboard opens exact plotted values');await values.press('Enter');assert.ok(await values.evaluate(n=>document.activeElement===n),'Actual teaching data control retains keyboard focus');result.push({axes,keyboardValues:true,screenshot:await shot(p,`${id}-teaching-plot-${i}`)});
  }
  return result;
}
async function surfaces(p,id){
  await check(`${id}-replan-visual`,async()=>{await button(p,'Replan mission').first().click();const surface=p.locator('.comparison-sheet');await surface.waitFor();await p.getByRole('region',{name:'Synchronized mission cursor',exact:true}).waitFor();const screenshot=await shot(p,`${id}-replan`),layout=await reflow(p,surface);const measurements=await contrast(p,surface.locator('h2,h3').first(),`${id}-replan-contrast`);await button(p,'Close comparisons').click();return {screenshot,layout,measurements};},p);
  const expected=await exportDecision(p,join(output,`${id}-before-teaching.json`));await button(p,'Educator').click();await dismiss(p);
  await check(`${id}-teaching-native-keyboard-visual`,async()=>{const {trigger,dialog}=await openSurface(p,'Teaching studio','Teaching studio');await shot(p,`${id}-teaching-initial`);await dialog.getByRole('button',{name:'Capture current scenario as baseline',exact:true}).click();await dialog.getByLabel('Your prediction',{exact:true}).fill('Agent visual verification: changing array height can alter modeled horizon exposure.');await dialog.getByRole('button',{name:'Reveal computed response',exact:true}).click();await dialog.locator('math').first().waitFor();const nativeMath=await dialog.locator('math').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).map(n=>({namespace:n.namespaceURI,text:n.textContent,width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height})));assert.ok(nativeMath.length>=2&&nativeMath.every(n=>n.namespace==='http://www.w3.org/1998/Math/MathML'&&n.text.trim()&&n.width>0&&n.height>0),'Actual visible native mathematics is laid out');const box=await dialog.boundingBox(),layout=await reflow(p,dialog);const screenshot=await shot(p,`${id}-teaching`);const measurement=await contrast(p,dialog.getByRole('heading',{name:'Predict. Change one thing. Explain the evidence.',exact:true}),`${id}-teaching-contrast`);const plots=await teachingPlots(p,dialog,id);const material=await materials(p,dialog,id,expected);await modalKeys(p,dialog,trigger);return {box,layout,screenshot,measurement,nativeMath,plots,material};},p);
  await button(p,'Planner').click();await dismiss(p);
  await check(`${id}-engineering-keyboard-visual`,async()=>{const {trigger,dialog}=await openSurface(p,'Engineering evidence','Engineering evidence workspace');await dialog.getByRole('heading',{name:'Station contact & finite stability',exact:true}).waitFor();const box=await dialog.boundingBox(),layout=await reflow(p,dialog);const screenshot=await shot(p,`${id}-engineering`);const measurement=await contrast(p,dialog.getByRole('heading',{name:'Station contact & finite stability',exact:true}),`${id}-engineering-contrast`);await modalKeys(p,dialog,trigger);return {box,layout,screenshot,measurement};},p);
}
async function selectedSolver(p){
  const summaries=p.locator('summary').filter({hasText:/^Selected flight solver, frame and equations$/});assert.ok(await summaries.count()>0);
  for(const summary of await summaries.all())if(!await summary.evaluate(n=>n.parentElement.open))await summary.click();
  const all=p.locator('.flight-solver-details'),texts=await all.allTextContents();assert.equal(new Set(texts).size,1,'Every selected-solver explanation agrees');return all.first();
}
async function modelCopy(p,id){
  await inspector(p);await button(p,'Reset 300 m approach').click();await frame(p);
  assert.equal(await field(p,'Initial pitch').count(),0,'Assisted manual pitch hidden');
  const results=[];
  for(const [name,pattern] of [['assisted',/target feedback/],['configured-manual',/pitch|manual/i]]){
    if(name==='configured-manual'){await button(p,'Manual pitch & burn').click();assert.ok(await field(p,'Initial pitch').isEnabled());}
    const details=await selectedSolver(p),text=await details.innerText();
    assert.match(text,pattern);assert.match(text,/0\.1 s/);assert.match(text,/0\.025 s/);assert.match(text,/0\.5 s/);
    assert.match(text,/Moon-fixed east\/up\/north frame/);assert.match(text,/Coriolis/);assert.match(text,/centrifugal/);assert.match(text,/m³\/s²/);
    const maths=await details.locator('math').allTextContents();await details.locator('math').first().scrollIntoViewIfNeeded();await shot(p,`${id}-${name}-native-equations`);assert.equal(maths.length,2);assert.ok(maths.join('').includes('Ω'),'Rotating native equation contains Omega');
    const help=button(p,'About Wet mass');await help.hover();const popup=p.getByRole('dialog',{name:'About Wet mass',exact:true});await popup.waitFor();const helpText=await popup.innerText();assert.match(helpText,/kg/);assert.match(helpText,/What to check/);await p.keyboard.press('Escape');await p.mouse.move(5,5);const clockHelp=p.locator('[aria-label="Flight telemetry"]').getByRole('button',{name:'About Flight time (s)',exact:true});await clockHelp.hover();const clockPopup=p.getByRole('dialog',{name:'About Flight time (s)',exact:true});await clockPopup.waitFor();const selectedHelp=await clockPopup.innerText();assert.match(selectedHelp,/Selected flight solver/);assert.match(selectedHelp,/Moon-fixed/);await p.keyboard.press('Escape');await p.mouse.move(5,5);
    results.push({name,text,maths,helpText,selectedHelp,screenshot:await shot(p,`${id}-${name}-solver`)});
  }
  await button(p,'Reset 300 m approach').click();await frame(p);return results;
}
async function productionImport(p,path){await button(p,'Planner').click();await dismiss(p);await disclosure(p,/^Export, import & print evidence$/);const choosing=p.waitForEvent('filechooser');await button(p,'Import decision package').click();await(await choosing).setFiles(path);await p.getByText(/Recomputed using current evidence\/model; historical results are not trusted/).waitFor();await button(p,'Flight preview').click();await frame(p);}
async function exportDecision(p,path){const pending=p.waitForEvent('download');await button(p,'Export current scenario').click();await(await pending).saveAs(path);return JSON.parse(await readFile(path,'utf8'));}
async function poles(p,id,session){
  await button(p,'Moon').click();await p.waitForFunction(()=>{const d=document.querySelector('.scene-host')?.dataset;return d?.assetFlight==='idle'&&d.cameraMode==='globe';},null,{timeout:45000});await frame(p);
  const canvas=await host(p).locator('canvas').elementHandle(),instance=(await data(p)).sceneInstance,requests=session.requests.length;
  await disclosure(p,/^Camera & lighting$/);await disclosure(p,/^Globe directions$/);const results=[];
  for(const [name,latitude]of [['North pole',90],['South pole',-90]]){await p.getByRole('button',{name:new RegExp(name+'$')}).click();await p.waitForFunction(expected=>Math.abs(Number(document.querySelector('.scene-host')?.dataset.viewLatitude)-expected)<.05,latitude,{timeout:45000});results.push(await frame(p));}
  await p.keyboard.press('Escape');await preserve(p,canvas,instance);assert.equal(session.requests.length,requests,'Direct pole controls preserve assets');const screenshot=await shot(p,`${id}-direct-south-pole`);await button(p,'Lander').click();await p.waitForFunction(()=>{const d=document.querySelector('.scene-host')?.dataset;return d?.assetFlight==='idle'&&d.cameraMode==='vehicle'&&d.vehicleFraming==='framed';},null,{timeout:45000});await preserve(p,canvas,instance);return {results,screenshot,returned:await framing(p,`${id}-direct-from-poles`)};
}
async function polesImportReturn(p,id,session){
  const originalPath=join(output,`${id}-pre-navigation-decision.json`),fixture=await exportDecision(p,originalPath);fixture.scenario.custom={lat:0,lon:0};const path=join(output,`${id}-explicit-global-navigation.json`);await writeFile(path,JSON.stringify(fixture,null,2));
  // At a polar mission site Moon intentionally opens local Orbit. A real imported
  // custom equatorial input exposes global navigation; it is not mission evidence.
  await productionImport(p,path);const customContact=await contactContrast(p,`${id}-F1-custom-unresolved`);await shot(p,`${id}-F1-custom-import-before-poles`);await button(p,'Moon').click();await ready(p);await p.waitForFunction(()=>{const d=document.querySelector('.scene-host')?.dataset;return d?.assetFlight==='idle'&&d.cameraMode==='globe';},null,{timeout:45000});
  const canvas=await host(p).locator('canvas').elementHandle(),instance=(await data(p)).sceneInstance,requests=session.requests.length;
  await disclosure(p,/^Camera & lighting$/);await disclosure(p,/^Globe directions$/);const results=[];
  for(const [name,latitude]of [['North pole',90],['South pole',-90]]){await p.getByRole('button',{name:new RegExp(name+'$')}).click();await p.waitForFunction(expected=>Math.abs(Number(document.querySelector('.scene-host')?.dataset.viewLatitude)-expected)<.05,latitude,{timeout:45000});results.push(await frame(p));}
  await p.keyboard.press('Escape');await preserve(p,canvas,instance);assert.equal(session.requests.length,requests,'Pole camera movement preserves loaded assets');await writeFile(join(output,`${id}-pole-samples.json`),JSON.stringify(results,null,2));const screenshot=await shot(p,`${id}-south-pole`);await productionImport(p,originalPath);await shot(p,`${id}-F1-restored-polar-before-immediate-lander`);await button(p,'Lander').click();await ready(p);await p.waitForFunction(()=>{const d=document.querySelector('.scene-host')?.dataset;return d?.assetFlight==='idle'&&d.cameraMode==='vehicle'&&d.vehicleFraming==='framed';},null,{timeout:45000});if(await button(p,'Expand location card').isVisible())await button(p,'Expand location card').click();return {fixture:'Explicit equatorial custom input for navigation only, imported through production file UI',fixtureSha256:sha(await readFile(path)),customContact,results,screenshot,returned:await framing(p,`${id}-from-poles`)};
}
async function legacyImport(p,id){
  const download=p.waitForEvent('download');await button(p,'Export current scenario').click();const exported=await download,originalPath=join(output,`${id}-original-decision.json`);await exported.saveAs(originalPath);
  const original=await readFile(originalPath,'utf8'),fixture=JSON.parse(original);
  // Explicit input fixture derived from the production export. Historical verdict
  // is retained as historical; the production importer recomputes it on import.
  delete fixture.scenario.flight.landing;
  Object.assign(fixture.scenario.flight,{altitudeM:300,horizontalMps:0,verticalMps:-1,thrustN:0,burnSeconds:0,durationSeconds:60});
  const fixturePath=join(output,`${id}-explicit-legacy-input.json`);await writeFile(fixturePath,JSON.stringify(fixture,null,2));

  await productionImport(p,fixturePath);assert.ok(await field(p,'Initial pitch').isEnabled());const details=await selectedSolver(p),text=await details.innerText();assert.match(text,/fixed local frame, lunar rotation neglected/);assert.match(text,/Legacy manual.*0\.25 s/);assert.match(text,/about 1 s/);const maths=await details.locator('math').allTextContents();assert.ok(!maths.join('').includes('Ω'),'Legacy native equation omits rotating terms');const screenshot=await shot(p,`${id}-legacy-solver`);
  await productionImport(p,originalPath);return {fixture:'Explicit exported-input derivative with landing omitted and unpowered 300 m descent; not a live external source',fixturePath,fixtureSha256:sha(await readFile(fixturePath)),originalPath,text,maths,screenshot};
}
const slider=p=>p.getByRole('slider',{name:'Flight time in seconds',exact:true});
async function seek(p,end){
  const s=slider(p),endpoint=Number(await s.getAttribute(end?'aria-valuemax':'aria-valuemin')??await s.getAttribute(end?'max':'min'));assert.ok(Number.isFinite(endpoint),'Actual requested slider endpoint');
  await s.focus();await s.press(end?'End':'Home');
  try{await p.waitForFunction(({element,endpoint})=>Math.abs(Number(element.getAttribute('aria-valuenow')??element.value)-endpoint)<1e-6&&Math.abs(Number(document.querySelector('.scene-host')?.dataset.flightTimeS)-endpoint)<1e-6,{element:await s.elementHandle(),endpoint},{timeout:30000});}
  catch(error){await writeFile(join(output,`seek-${end?'end':'home'}-failure.json`),JSON.stringify({requested:endpoint,selected:await s.getAttribute('aria-valuenow'),dataset:await data(p),screenshot:await shot(p,`seek-${end?'end':'home'}-failure`)},null,2));throw error;}
  await frame(p);return data(p);
}
async function physical(p,id){
  const result=[],clearanceFailures=[];assert.ok(opts.scenarios.split(',').every(s=>['nominal','breakup','bounce'].includes(s)),'Known physical scenarios only');
  await inspector(p);const baseline=Object.fromEntries(await Promise.all(['Wet mass','Dry mass','Thrust','Burn duration'].map(async name=>[name,await field(p,name).inputValue()])));
  await disclosure(p,/^Edit contact limits & continuation$/);
  const limits=Object.fromEntries(await Promise.all(['Breakup energy threshold','Contact restitution','Contact friction'].map(async name=>[name,await field(p,name).inputValue()])));
  for(const scenario of opts.scenarios.split(',')){
    await seek(p,false);await button(p,'Reset 300 m approach').click();
    for(const [name,value]of Object.entries(baseline))await edit(p,name,value);
    await disclosure(p,/^Edit contact limits & continuation$/);
    for(const [name,value]of Object.entries(limits))await edit(p,name,value);
    if(scenario==='breakup'){await edit(p,'Thrust',100);await edit(p,'Breakup energy threshold',0);}
    if(scenario==='bounce'){await button(p,'Manual pitch & burn').click();for(const [name,value]of Object.entries({'Thrust':0,'Burn duration':0,'Initial pitch':45,'Final burn pitch':45,'Breakup energy threshold':1e12,'Contact restitution':.8,'Contact friction':.8}))await edit(p,name,value);}
    const contactCard=await contactContrast(p,`${id}-${scenario}`);
    await camera(p,'Follow');await p.waitForFunction(()=>{const d=document.querySelector('.scene-host')?.dataset;return d?.cameraMode==='follow'&&d.assetFlight==='idle';},null,{timeout:90000});
    const before=await framing(p,`${id}-${scenario}-offaxis`);assert.ok(distance(vec(before.physical.target),vec(before.physical.com))<1e-9,'Projection preserves physical COM target');
    await p.getByLabel('Flight playback speed',{exact:true}).selectOption('1');
    const observed=await observeCompleted(p),start=Date.now();let observedPlaying=false,samples;
    try{
      await button(p,'Play flight').click();
      while(Date.now()-start<240000){if(await button(p,'Pause flight').isVisible())observedPlaying=true;if(observedPlaying&&await button(p,'Play flight').isVisible())break;await p.waitForTimeout(180);}
      assert.ok(observedPlaying&&await button(p,'Play flight').isVisible(),'Full original production1× playback ends');await frame(p);
    }finally{samples=await observed.evaluate(n=>n.stop());await observed.dispose();await writeFile(join(output,`${id}-${scenario}-samples.json`),JSON.stringify(samples,null,2));}
    const end=await data(p),max=Number(await slider(p).getAttribute('aria-valuemax')??await slider(p).getAttribute('max'));assert.ok(Number(end.flightTimeS)>=max-.05);
    assert.ok(samples.length>5,'More than5 actual completed rendered frames');
    const baseOffset=vec(before.physical.camera).map((v,i)=>v-vec(before.physical.com)[i]),baseLength=Math.hypot(...baseOffset),baseDirection=baseOffset.map(v=>v/baseLength),radii=[];
    for(const [i,d] of samples.entries()){
      if(i)assert.equal(Number(d.renderFrame),Number(samples[i-1].renderFrame)+1,'Every actual completed rendered frame sampled without gaps');
      assert.equal(d.cameraMode,'follow');assert.equal(d.vehicleVisible,'true');
      assert.ok(distance(vec(d.cameraTarget),vec(d.vehicleWorldPosition))<1e-9,'Follow actual physical mass-weighted COM');
      assertFraming(d,d.measurement);
      const offset=vec(d.cameraPosition).map((v,j)=>v-vec(d.vehicleWorldPosition)[j]),length=Math.hypot(...offset),broken=d.landingDynamics&&JSON.parse(d.landingDynamics).phase==='broken';
      assert.ok(distance(offset.map(v=>v/length),baseDirection)<1e-5,'Viewing direction preserved including radial breakup pullback');
      if(!broken)assert.ok(distance(offset,baseOffset)<1e-9,'Intact nominal/bounce Follow preserves fixed physical viewing offset');
      else {assert.equal(Number(d.landingFragmentCount),157,'Every broken frame retains all actual NASA fragments');assert.ok(length>=baseLength-1e-6,'Breakup camera may only pull radially back from the user offset');}
      radii.push({timeS:Number(d.flightTimeS),radiusKm:length,broken:!!broken});
      assert.ok(Number(d.landingMassKg)>0,'Actual physical mass');
      if(Number(d.flightTimeS)>=Number(d.landingContactTimeS)){assert.ok(d.terrainClearanceM!==undefined&&d.terrainClearanceM!==''&&Number.isFinite(Number(d.terrainClearanceM)),'Every completed contact frame has finite actual full-geometry clearance');assert.equal(Number(d.landingMassKg),JSON.parse(d.landingContact).massKg,'Actual mass remains intact or distributed over all pieces');}
      if(d.terrainClearanceM&&Number(d.terrainClearanceM)<-.05){
        const failure={scenario,renderFrame:d.renderFrame,flightTimeS:d.flightTimeS,landingContactFrameTimeS:d.landingContactFrameTimeS,terrainClearanceM:d.terrainClearanceM};clearanceFailures.push(failure);
        await writeFile(join(output,`${id}-physical-clearance-failures.json`),JSON.stringify(clearanceFailures,null,2));await appendFile(findings,`${new Date().toISOString()} FAIL retained -0.05m clearance gate ${id} ${JSON.stringify(failure)}; collecting remaining independent replay cases, final physical check remains RED\n`);
      }
    }
    const dynamics=samples.map(s=>s.landingDynamics&&JSON.parse(s.landingDynamics)).filter(Boolean);assert.ok(dynamics.some(d=>d.phase!=='unsupported'),'Physical contact continuation observed');assert.ok(new Set(samples.filter(s=>s.landingContactFrameIndex!==''&&s.landingContactFrameIndex!==undefined).map(s=>s.landingContactFrameIndex)).size>5,'More than5 distinct completed contact-continuation times');
    if(scenario==='breakup')assert.ok(dynamics.some(d=>d.phase==='broken'&&d.fragmentCount===157),'Actual NASA 157-piece breakup');
    if(scenario==='bounce')assert.ok(dynamics.some(d=>d.verticalMps>.1),'Actual rebound');
    await framing(p,`${id}-${scenario}-end`);
    await seek(p,false);const replay=await seek(p,true);for(const key of ['vehicleWorldPosition','landingDynamics'])assert.equal(replay[key],end[key],`Deterministic ${key}`);for(const key of ['cameraPosition','cameraTarget'])assert.ok(distance(vec(replay[key]),vec(end[key]))<=1e-9,`Deterministic ${key} within1 micrometre`);
    const replayFraming=await framing(p,`${id}-${scenario}-backwards-replay`);
    if(scenario==='breakup'){
      const focusId=(await data(p)).focusRequestId;await button(p,'Lander').click();
      await p.waitForFunction(old=>{const d=document.querySelector('.scene-host')?.dataset;return d?.focusRequestId!==old&&d?.cameraMode==='vehicle'&&d?.assetFlight==='idle';},focusId,{timeout:90000});
      await framing(p,`${id}-breakup-refocused`);await camera(p,'Follow');await framing(p,`${id}-breakup-refollowed`);
      await seek(p,false);await framing(p,`${id}-breakup-rewound`);await seek(p,true);const reentered=await framing(p,`${id}-breakup-reentered`);
      const x=reentered.measurement.host.x+(reentered.safe.left+reentered.safe.right)/2,y=reentered.measurement.host.y+(reentered.safe.top+reentered.safe.bottom)/2;
      assert.ok(await host(p).evaluate((n,{x,y})=>document.elementFromPoint(x,y)===n.querySelector('canvas'),{x,y}),'Broken gesture starts on actual visible canvas');
      await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+12,y+8,{steps:6});await p.mouse.up();await frame(p);
      await p.mouse.move(x,y);await p.mouse.wheel(0,80);await frame(p);
      const adjusted=await framing(p,`${id}-breakup-user-orbit-zoom`);assert.ok(distance(vec(adjusted.physical.camera),vec(reentered.physical.camera))>1e-7,'User can orbit/zoom actual broken assembly');
      await frame(p,4);const stable=await framing(p,`${id}-breakup-user-view-stable`);
      for(const key of ['camera','target'])assert.ok(distance(vec(stable.physical[key]),vec(adjusted.physical[key]))<1e-6,`Paused broken user ${key} remains stable across completed renders`);
    }
    result.push({scenario,contactCard,productionPlaybackSpeed:1,samples:samples.length,allCompletedFrames:true,elapsedMs:Date.now()-start,renderedFps:(samples.length-1)*1000/(samples.at(-1).observedMs-samples[0].observedMs),radii,max,end,replayFraming,clearanceFailures:clearanceFailures.filter(f=>f.scenario===scenario)});await writeFile(join(output,`${id}-physical-progress.json`),JSON.stringify(result,null,2));
  }
  await seek(p,false);await button(p,'Reset 300 m approach').click();await frame(p);assert.equal(Number((await data(p)).flightTimeS),0);await framing(p,`${id}-physical-reset`);assert.equal(clearanceFailures.length,0,'Every sampled known terrain clearance must stay >= -0.05m; failures collected without skipping other independent cases');return result;
}
async function mapModes(p,id){
  const result=[],failedBefore=report.checks.filter(c=>c.status==='fail').length;
  async function snapshot(name){
    await p.waitForFunction(()=>[...document.querySelectorAll('.map-pane canvas')].every(n=>n.dataset.lunarAtlasReady===undefined||n.dataset.lunarAtlasReady==='true')&&(!document.querySelector('[aria-label="Whole-Moon map"]')||document.querySelector('[aria-label="Whole-Moon map"]').textContent.includes('NASA Moon · original texture')),null,{timeout:90000});
    const measurement=await p.evaluate(()=>{
      const box=n=>n?.getBoundingClientRect().toJSON(),viewport=box(document.querySelector('.viewport'));
      return{innerWidth,innerHeight,scrollX,scrollY,documentWidth:document.documentElement.scrollWidth,viewport,inspector:box(document.querySelector('.inspector')),inspectorScroll:document.querySelector('.inspector-scroll')?.scrollTop,maps:[...document.querySelectorAll('[data-map-transform]')].map(n=>({box:box(n),transform:JSON.parse(n.dataset.mapTransform)})),canvases:[...document.querySelectorAll('.map-pane canvas')].map(n=>({box:box(n),dataset:{...n.dataset}})),images:[...document.querySelectorAll('.map-pane img,.map-pane image')].map(n=>({tag:n.tagName,complete:n.complete,naturalWidth:n.naturalWidth,url:(n.src??n.getAttribute('href')??'').slice(0,100)}))};
    });
    assert.ok(measurement.documentWidth<=measurement.innerWidth+1,'Map mode no document horizontal overflow');assert.equal(measurement.scrollY,0,'Inspector scroll stays inside fixed app');
    const v=measurement.viewport;assert.ok(v.top>=-.1&&v.left>=-.1&&v.bottom<=measurement.innerHeight+.1&&v.right<=measurement.innerWidth+.1&&v.height>60,'Actual map viewport bounded globally');
    result.push({name,measurement,screenshot:await shot(p,`${id}-${name}`)});return measurement;
  }
  await button(p,'2D map').click();await p.getByLabel('Map region',{exact:true}).selectOption('polar');await snapshot('polar-map');
  await inspector(p);await p.locator('.inspector-scroll input:visible').last().scrollIntoViewIfNeeded();await snapshot('polar-inspector-scrolled');
  await p.getByLabel('Map region',{exact:true}).selectOption('global');await snapshot('global-map');
  await p.locator('.inspector-scroll input:visible').last().scrollIntoViewIfNeeded();await snapshot('global-inspector-scrolled');
  await button(p,'3D terrain').click();await button(p,'Lander').click();await ready(p);
  await p.waitForFunction(()=>{const d=document.querySelector('.scene-host')?.dataset;return d?.assetFlight==='idle'&&d.cameraMode==='vehicle';},null,{timeout:90000});
  const lander=await attempt(`${id}-3d-framing`,()=>framing(p,`${id}-3d-map`),p);await snapshot('3d-viewport');
  await button(p,'Split map and 3D').click();await ready(p);const split=await attempt(`${id}-split-framing`,()=>framing(p,`${id}-split-map`),p);await snapshot('split-viewport');
  await button(p,'3D terrain').click();await frame(p);
  assert.equal(report.checks.filter(c=>c.status==='fail').length,failedBefore,'All four map mode bounds must pass');return {result,lander,split};
}
async function hudLocation(p,id){
  await p.waitForFunction(()=>{const d=document.querySelector('.scene-host')?.dataset;return d?.assetFlight==='idle'&&d.cameraMode==='vehicle';},null,{timeout:90000});
  const rows=[],failedBefore=report.checks.filter(c=>c.status==='fail').length;
  if(await button(p,'Minimize flight telemetry').isVisible())await button(p,'Minimize flight telemetry').click();
  for(const hud of ['compact','full']){
    await p.mouse.move(5,5);await p.keyboard.press('Escape');
    if(hud==='full')await button(p,'Expand flight telemetry').click();
    await p.mouse.move(5,5);await p.keyboard.press('Escape');
    if(await button(p,'Minimize location card').isVisible())await button(p,'Minimize location card').click();
    for(const location of ['minimized','expanded','minimized-return']){
      await p.mouse.move(5,5);await p.keyboard.press('Escape');
      if(location==='expanded')await button(p,'Expand location card').click();
      if(location==='minimized-return')await button(p,'Minimize location card').click();
      await p.mouse.move(5,5);await p.keyboard.press('Escape');
      await attempt(`${id}-${hud}-${location}-pointer-and-framing`,async()=>{
      const geometry=await p.evaluate(()=>{
        const rect=n=>{const b=n.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom};};
        const selectors=['.workspace-heading','.location-restore','.flight-telemetry'];
        return selectors.flatMap(selector=>[...document.querySelectorAll(selector)].filter(n=>n.getClientRects().length&&getComputedStyle(n).display!=='none').map(n=>({selector,...rect(n)})));
      });
      await writeFile(join(output,`${id}-${hud}-${location}-geometry.json`),JSON.stringify({geometry,dataset:await data(p)},null,2));
      const hudRect=geometry.find(r=>r.selector==='.flight-telemetry');assert.ok(hudRect,'HUD stays visible');
      for(const r of geometry.filter(r=>r!==hudRect))assert.ok(!(Math.min(r.right,hudRect.right)-Math.max(r.left,hudRect.left)>.5&&Math.min(r.bottom,hudRect.bottom)-Math.max(r.top,hudRect.top)>.5),`Visible ${hud}/${location} controls and location do not overlap`);
      await p.waitForFunction(()=>document.querySelector('.scene-host')?.dataset.assetFlight==='idle',null,{timeout:90000});
      const row={hud,location,geometry,framing:await framing(p,`${id}-${hud}-${location}`)};rows.push(row);return row;},p);
    }
  }
  await p.mouse.move(5,5);await p.keyboard.press('Escape');await button(p,'Minimize flight telemetry').click();await p.mouse.move(5,5);await p.keyboard.press('Escape');await button(p,'Expand location card').click();await p.mouse.move(5,5);await p.keyboard.press('Escape');assert.equal(report.checks.filter(c=>c.status==='fail').length,failedBefore,'All normal HUD/location pointer and framing states must pass');return rows;
}
async function graphs(p,id){
  await button(p,'Planner').click();await dismiss(p);await inspector(p);const results=[],failedBefore=report.checks.filter(c=>c.status==='fail').length;
  for(const [panel,expected]of [['Horizon analysis',2],['Flight preview',2],['Planner',2]]){
    if(panel==='Planner'){await button(p,'Planner').click();await dismiss(p);}else await p.locator('.inspector-nav').getByRole('button',{name:panel,exact:true}).click();
    if(panel==='Planner')await disclosure(p,/^Power & storage plots$/);
    const figures=p.locator('.inspector .science-figure');assert.equal(await figures.count(),expected,`${panel} has its two actual plots`);
    for(const [i,figure]of (await figures.all()).entries()){
      await attempt(`${id}-${panel.replaceAll(' ','-')}-graph-${i}-axes-and-keyboard`,async()=>{
      const title=await figure.locator('figcaption').innerText(),svg=figure.locator('svg[role="img"]');await svg.scrollIntoViewIfNeeded();await p.mouse.move(5,5);
      const before=await figure.locator('.chart-sample-readout').innerText();await svg.focus();await svg.press('Home');
      const home=await figure.locator('.chart-sample-readout').innerText();await svg.press('ArrowRight');
      const after=await figure.locator('.chart-sample-readout').innerText();assert.match(after,/Sample values/);assert.ok(!await figure.getByRole('button',{name:`Previous sample in ${title}`,exact:true}).isDisabled(),'Normal ArrowRight leaves first-sample boundary; rounded nearest-line text may remain equal');
      await svg.press('End');await p.waitForFunction(n=>n.disabled,await figure.getByRole('button',{name:`Next sample in ${title}`,exact:true}).elementHandle(),{timeout:6000});const end=await figure.locator('.chart-sample-readout').innerText();const clock=await p.getByRole('slider',{name:'Mission time',exact:true}).evaluate(n=>({min:Number(n.getAttribute('aria-valuemin')??n.getAttribute('min')),max:Number(n.getAttribute('aria-valuemax')??n.getAttribute('max')),now:Number(n.getAttribute('aria-valuenow')??n.value)}));assert.ok(Object.values(clock).every(Number.isFinite)&&clock.now>=clock.min&&clock.now<=clock.max,'Canonical environmental clock remains within supported bounds');if(title==='Battery energy and reserve')assert.equal(clock.now,clock.max,'Final battery inspection clamps canonical clock to its maximum');assert.ok(await figure.getByRole('button',{name:`Next sample in ${title}`,exact:true}).isDisabled(),'Normal End selects last actual sample');await svg.press('Shift+ArrowLeft');const shiftLeft=await figure.locator('.chart-sample-readout').innerText();assert.ok(!await figure.getByRole('button',{name:`Next sample in ${title}`,exact:true}).isDisabled(),'Shift+ArrowLeft leaves last-sample boundary');
      const axes=await figure.evaluate(n=>{const svg=n.querySelector('svg'),s=getComputedStyle(svg),r=svg.getBoundingClientRect(),label=n.querySelector('.chart-x-label'),range=document.createRange();range.selectNodeContents(label.childNodes[0]);const text=range.getBoundingClientRect();return{focused:document.activeElement===svg,vertical:n.querySelector('.chart-axis-heading').textContent,horizontal:label.textContent,svg:r.toJSON(),horizontalText:text.toJSON(),outline:{style:s.outlineStyle,width:parseFloat(s.outlineWidth),offset:parseFloat(s.outlineOffset),color:s.outlineColor},ticks:[...svg.querySelectorAll('text')].map(t=>({text:t.textContent,rect:t.getBoundingClientRect().toJSON()}))};});
      assert.ok(axes.focused&&axes.vertical.includes('Vertical axis:')&&axes.horizontal.trim(),'Named axes and actual keyboard focus');
      const bandTop=axes.svg.bottom+axes.outline.offset,bandBottom=bandTop+axes.outline.width;
      await writeFile(join(output,`${id}-${panel.replaceAll(' ','-')}-graph-${i}-axes.json`),JSON.stringify({axes,focusBand:{top:bandTop,bottom:bandBottom}},null,2));
      for(const tick of axes.ticks)assert.ok(tick.rect.left>=axes.svg.left-.5&&tick.rect.right<=axes.svg.right+.5,'Actual tick labels stay inside graph bounds');
      const chart=await svg.evaluate(n=>{const r=n.getBoundingClientRect();return {rect:r.toJSON(),viewBox:n.getAttribute('viewBox'),paths:n.querySelectorAll('path').length,texts:[...n.querySelectorAll('text')].map(n=>({text:n.textContent,rect:n.getBoundingClientRect().toJSON()}))};});
      assert.ok(chart.rect.width>80&&chart.rect.height>60&&chart.paths>0,'Actual rendered graph contains source curves');
      const screenshot=await shot(p,`${id}-${panel.replaceAll(' ','-')}-graph-${i}`);await figure.locator('.chart-axis-heading').scrollIntoViewIfNeeded();const verticalScreenshot=await shot(p,`${id}-${panel.replaceAll(' ','-')}-vertical-axis-${i}`);await figure.locator('.chart-x-label').scrollIntoViewIfNeeded();const horizontalScreenshot=await shot(p,`${id}-${panel.replaceAll(' ','-')}-horizontal-axis-focused-${i}`);
      const help=figure.locator('.chart-gradient-help');await help.locator('summary').click();await help.locator('math').first().scrollIntoViewIfNeeded();assert.ok(await help.locator('math').count()>=2);assert.match(await help.innerText(),/Source:/);assert.match(await help.innerText(),/sample|Unavailable/i);
      const helpScreenshot=await shot(p,`${id}-${panel.replaceAll(' ','-')}-gradient-${i}`);await help.locator('summary').click();const cursor=figure.locator('[aria-label="Mission time cursor"]'),cursorBefore=await cursor.count()?await cursor.getAttribute('x1'):null;await svg.focus();await svg.press('End');const inspectedEnd=await figure.locator('.chart-sample-readout').innerText(),cursorAtEnd=await cursor.count()?await cursor.getAttribute('x1'):null;await button(p,'Planner').focus();const restored=await figure.locator('.chart-sample-readout').innerText(),cursorAfterBlur=await cursor.count()?await cursor.getAttribute('x1'):null;let clockAfterBlur=null;if(title==='Battery energy and reserve'){clockAfterBlur=await p.getByRole('slider',{name:'Mission time',exact:true}).evaluate(n=>n.getAttribute('aria-valuenow')??n.value);assert.equal(Number(clockAfterBlur),clock.max,'Leaving figure preserves canonical max clock');assert.notEqual(restored,inspectedEnd,'Leaving figure restores readout from exclusive energy boundary to shared clock');assert.ok(!await figure.getByRole('button',{name:`Next sample in ${title}`,exact:true}).isDisabled(),'Blur restores supported sample before exclusive final boundary');assert.equal(cursorAfterBlur,cursorAtEnd,'Cursor stays on actual simulation time while inspection resets');}results.push({panel,title,chart,axes,before,home,after,end,shiftLeft,clock,inspectedEnd,restored,cursorBefore,cursorAtEnd,cursorAfterBlur,clockAfterBlur,screenshot,verticalScreenshot,horizontalScreenshot,helpScreenshot});assert.ok(axes.outline.style==='none'||axes.horizontalText.top>=bandBottom||axes.horizontalText.bottom<=bandTop,'Keyboard focus outline does not cross horizontal axis text');return results.at(-1);},p);
    }
  }
  assert.equal(report.checks.filter(c=>c.status==='fail').length,failedBefore,'All six actual science graphs retain axis readability and keyboard behavior');return results;
}
async function runContext(mode,width){
  const id=`${mode}-${width}`,context=await browser.newContext({viewport:{width,height:1000},deviceScaleFactor:1,acceptDownloads:true,reducedMotion:'no-preference'});
  if(mode==='file')await context.setOffline(true);const page=await context.newPage();page.setDefaultTimeout(15000);
  const session=newSession(id);report.sessions.push(session);captureEvents(page,session);
  try{
    await check(`${id}-fresh-public`,async()=>{await page.goto(mode==='file'?pathToFileURL(marker.artifactPath).href:marker.url,{waitUntil:'domcontentloaded',timeout:180000});await page.getByRole('group',{name:'Audience mode',exact:true}).waitFor({timeout:120000});await dismiss(page);assert.equal(await button(page,'Public').getAttribute('aria-pressed'),'true');await page.getByRole('region',{name:'Audience task context',exact:true}).waitFor();return {screenshot:await shot(page,`${id}-public`)};},page);
    if(opts.sections.split(',').some(section=>['framing','poles','import-return','model','physical','contrast','expanded-contrast'].includes(section))){
      await button(page,'Planner').click();await dismiss(page);await button(page,'Lander').click();await ready(page);await inspector(page);await page.waitForFunction(()=>{const d=document.querySelector('.scene-host')?.dataset;return d?.assetFlight==='idle'&&d.cameraMode==='vehicle';},null,{timeout:90000});
      if(await button(page,'Expand location card').isVisible())await button(page,'Expand location card').click();await frame(page);
      session.webgl=await host(page).locator('canvas').evaluate(n=>{const gl=n.getContext('webgl2')||n.getContext('webgl'),ext=gl?.getExtension('WEBGL_debug_renderer_info');return{vendor:ext&&gl.getParameter(ext.UNMASKED_VENDOR_WEBGL),renderer:ext&&gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)};});
      const canvas=await host(page).locator('canvas').elementHandle(),instance=(await data(page)).sceneInstance;
      if(opts.sections.split(',').includes('contrast'))await check(`${id}-inspector-actual-glyph-contrast`,()=>contrast(page,page.locator('.landing-preview-context > .landing-outcome strong'),`${id}-inspector-glyph-contrast`),page);
      if(opts.sections.split(',').includes('expanded-contrast'))await check(`${id}-expanded-contact-card-raster-contrast`,()=>contactContrast(page,`${id}-initial`),page);
      if(opts.sections.split(',').includes('framing')){
      await check(`${id}-open-inspector-location-compact-hud`,()=>framing(page,`${id}-compact`),page);
      await check(`${id}-full-hud-resize-toggle`,async()=>{await button(page,'Expand flight telemetry').click();const full=await framing(page,`${id}-full`);const initial=await data(page),handle=page.getByRole('separator',{name:'Resize scenario inspector',exact:true});if(await handle.isVisible()){await handle.focus();await handle.press('End');}else await button(page,'Widen inspector').click();const wide=await framing(page,`${id}-wide`);if(await handle.isVisible())await handle.press('Home');else await button(page,'Compact inspector').click();const compact=await framing(page,`${id}-resize-compact`);await button(page,'Hide inspector').click();const hidden=await framing(page,`${id}-inspector-hidden`);await button(page,'Show inspector').click();await button(page,'Minimize location card').click();await framing(page,`${id}-location-minimized`);await button(page,'Expand location card').click();const final=await data(page);for(const key of ['cameraPosition','cameraTarget','vehicleWorldPosition'])assert.equal(final[key],initial[key],`Panel layout preserves physical ${key}`);await preserve(page,canvas,instance);return {full,wide,compact,hidden};},page);
      await check(`${id}-user-orbit-pan-wheel-pinch`,async()=>{const base=await framing(page,`${id}-input-base`);const safe=base.safe,h=base.measurement.host,x=h.x+(safe.left+safe.right)/2,y=h.y+(safe.top+safe.bottom)/2;assert.ok(await host(page).evaluate((n,{x,y})=>{const hit=document.elementFromPoint(x,y);return hit===n.querySelector('canvas');},{x,y}),'Gesture starts on visible unoccluded canvas in viewport');await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+18,y+12,{steps:8});await page.mouse.up();const orbit=await frame(page);assert.ok(distance(vec(orbit.cameraPosition),vec(base.physical.camera))>1e-7);await page.mouse.move(x,y);await page.mouse.down({button:'right'});await page.mouse.move(x+14,y+8,{steps:5});await page.mouse.up({button:'right'});const pan=await frame(page);assert.ok(distance(vec(pan.cameraTarget),vec(orbit.cameraTarget))>1e-8);await page.mouse.move(x,y);await page.mouse.wheel(0,100);const wheel=await frame(page);assert.notEqual(wheel.cameraPosition,pan.cameraPosition);const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchMouseEvent',{type:'mouseWheel',x,y,deltaX:0,deltaY:-70,modifiers:2});await cdp.detach();const pinch=await frame(page);assert.notEqual(pinch.cameraPosition,wheel.cameraPosition,'Ctrl-wheel trackpad pinch changes camera');await preserve(page,canvas,instance);const final=await framing(page,`${id}-after-gestures`);return {orbit,pan,wheel,pinch,final};},page);
      await check(`${id}-edit-rapid-focus-no-reload`,async()=>{const before=await data(page),requests=session.requests.length,old=await field(page,'Wet mass').inputValue();await shot(page,`${id}-before-field-edit`);await edit(page,'Wet mass',Number(old)+100);const revised=await data(page);assert.ok(Number(revised.flightRevision)>Number(before.flightRevision));for(const key of ['lightingMode','lunarAppearance'])assert.equal(revised[key],before[key],`Field edit preserves ${key}`);const beforeOffset=vec(before.cameraPosition).map((v,i)=>v-vec(before.cameraTarget)[i]),afterOffset=vec(revised.cameraPosition).map((v,i)=>v-vec(revised.cameraTarget)[i]);assert.ok(distance(beforeOffset,afterOffset)<1e-6,'Field edit preserves physical viewing angle');await shot(page,`${id}-after-field-edit`);for(const name of ['Moon','Earth','Lander','Moon','Earth','Lander','Lander'])await button(page,name).click();await page.waitForFunction(()=>{const d=document.querySelector('.scene-host')?.dataset;return d?.assetFlight==='idle'&&d.cameraMode==='vehicle';},null,{timeout:90000});await preserve(page,canvas,instance);assert.equal(session.requests.length,requests,'No resource fetch on edits/focus');await edit(page,'Wet mass',old);return {before,revised,after:await framing(page,`${id}-repeated-focus`),requests};},page);
      }
      if(opts.sections.split(',').includes('poles'))await check(`${id}-pole-navigation-persistent-assets`,()=>poles(page,id,session),page);
      if(opts.sections.split(',').includes('import-return'))await check(`${id}-import-pole-restore-lander`,()=>polesImportReturn(page,id,session),page);
      if(width===1280){if(opts.sections.split(',').includes('model')){await check(`${id}-selected-model-copy-and-hover`,()=>modelCopy(page,id),page);await check(`${id}-legacy-file-import-selected-equations`,()=>legacyImport(page,id),page);}if(opts.sections.split(',').includes('physical'))await check(`${id}-physical-follow-contact-bounce-breakup-replay`,()=>physical(page,id),page);}
      const a=await data(page),start=performance.now();await button(page,'Play flight').click();await frame(page,6);const b=await data(page),elapsed=performance.now()-start;if(await button(page,'Pause flight').isVisible())await button(page,'Pause flight').click();await button(page,'Play flight').waitFor({state:'visible'});await frame(page);await seek(page,false);session.renderPerformance={intent:'normal production flight playback, at least6 completed renders; software only',before:Number(a.renderFrame),after:Number(b.renderFrame),elapsedMs:elapsed,renderedFps:(Number(b.renderFrame)-Number(a.renderFrame))*1000/elapsed};assert.ok(Number(b.renderFrame)-Number(a.renderFrame)>=6);
    }
    if(opts.sections.split(',').includes('maps'))await check(`${id}-all-four-map-modes-global-bounds`,()=>mapModes(page,id),page);
    if(opts.sections.split(',').includes('graphs'))await attempt(`${id}-science-graphs-native-and-keyboard`,()=>graphs(page,id),page);
    if(opts.sections.split(',').includes('surfaces'))await surfaces(page,id);
    await check(`${id}-actual-errors-and-offline-requests`,()=>network(session,mode),page);
  }finally{await context.close();await save();}
}
async function zoom(){
  for(const mode of opts.modes.split(',')){
    const measurements=[];
    for(const factor of [1,2]){
      const profile=await mkdtemp(join(os.tmpdir(),'refinement-native-zoom-'));let context;
      try{await mkdir(join(profile,'Default'));await writeFile(join(profile,'Default','Preferences'),JSON.stringify({partition:{default_zoom_level:{x:Math.log(factor)/Math.log(1.2)}}}));
        context=await chromium.launchPersistentContext(profile,{executablePath:opts.executable,headless:true,viewport:null,reducedMotion:'reduce',args:[...flags,'--window-size=1600,1080']});if(mode==='file')await context.setOffline(true);const p=context.pages()[0];p.setDefaultTimeout(15000);const session=newSession(`${mode}-zoom-${factor}`);report.sessions.push(session);captureEvents(p,session);
        await p.goto(mode==='file'?pathToFileURL(marker.artifactPath).href:marker.url,{waitUntil:'domcontentloaded',timeout:180000});await p.getByRole('group',{name:'Audience mode',exact:true}).waitFor({timeout:120000});await dismiss(p);
        const m=await p.evaluate(()=>({dpr:devicePixelRatio,innerWidth,outerWidth,innerHeight,visualScale:visualViewport.scale,documentWidth:document.documentElement.scrollWidth}));
        const cdp=await context.newCDPSession(p),capture=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});await cdp.detach();const png=Buffer.from(capture.data,'base64');await writeFile(join(output,`${mode}-native-zoom-${factor}.png`),png);measurements.push({factor,...m,screenshotWidthPx:png.readUInt32BE(16)});
        if(!opts.zoomChecks.split(',').includes(String(factor))){await network(session,mode);continue;}
        assert.ok(m.documentWidth<=m.innerWidth+1,'No body horizontal overflow at native zoom');await button(p,'Planner').click();await dismiss(p);await button(p,'Lander').click();await ready(p);await inspector(p);await p.waitForFunction(()=>{const d=document.querySelector('.scene-host')?.dataset;return d?.assetFlight==='idle'&&d.cameraMode==='vehicle';},null,{timeout:90000});
        await attempt(`${mode}-native${factor*100}-normal-pointer-hud-location`,()=>hudLocation(p,`${mode}-native${factor*100}`),p);
        await attempt(`${mode}-native${factor*100}-critical-contact-frame`,async()=>{await seek(p,true);const final=await framing(p,`${mode}-native${factor*100}-contact-end`);const d=await data(p);assert.ok(Number.isFinite(Number(d.terrainClearanceM))&&Number(d.terrainClearanceM)>=-.05);const contactRaster=await contactContrast(p,`${mode}-native${factor*100}-critical-contact`);await seek(p,false);return {final,clearanceM:Number(d.terrainClearanceM),contactRaster};},p);
        await attempt(`${mode}-native${factor*100}-inspector-raster-contrast`,()=>contrast(p,p.locator('.landing-preview-context > .landing-outcome strong'),`${mode}-native${factor*100}-inspector`),p);
        await attempt(`${mode}-native${factor*100}-expanded-contact-raster-contrast`,()=>contactContrast(p,`${mode}-native${factor*100}`),p);
        await attempt(`${mode}-native${factor*100}-all-four-map-modes`,()=>mapModes(p,`${mode}-native${factor*100}`),p);
        await attempt(`${mode}-native${factor*100}-science-graphs`,()=>graphs(p,`${mode}-native${factor*100}`),p);
        await attempt(`${mode}-native${factor*100}-workspaces`,()=>surfaces(p,`${mode}-native${factor*100}`),p);
        await check(`${mode}-native${factor*100}-actual-errors-and-offline-requests`,()=>network(session,mode),p);
      }finally{await context?.close();await rm(profile,{recursive:true,force:true});}
    }
    const [normal,enlarged]=measurements,near=(a,b)=>Math.abs(a-b)<.04*Math.max(1,Math.abs(b));assert.ok(near(enlarged.dpr/normal.dpr,2)&&near(normal.innerWidth/enlarged.innerWidth,2)&&near(normal.outerWidth,enlarged.outerWidth)&&near(normal.screenshotWidthPx,enlarged.screenshotWidthPx)&&near(enlarged.visualScale,1),'Real native browser zoom established');report.zoom??=[];report.zoom.push({mode,measurements});
  }
  return report.zoom;
}
function requiredChecks(){
  const names=['original-nasa-asset-identity','exact-http-file-identity-before','immutable-candidate-after'],sections=new Set(opts.sections.split(','));
  const add=(id,suffixes)=>names.push(...suffixes.map(s=>`${id}-${s}`));
  const graph=id=>{for(const panel of ['Horizon-analysis','Flight-preview','Planner'])for(const i of [0,1])add(id,[`${panel}-graph-${i}-axes-and-keyboard`]);};
  const surfaces=id=>add(id,['replan-visual','teaching-native-keyboard-visual','engineering-keyboard-visual']);
  const maps=id=>add(id,['3d-framing','split-framing']);
  for(const mode of opts.modes.split(','))for(const width of opts.widths==='none'?[]:opts.widths.split(',').map(Number)){
    const id=`${mode}-${width}`;add(id,['fresh-public','actual-errors-and-offline-requests']);
    if(sections.has('contrast'))add(id,['inspector-actual-glyph-contrast']);
    if(sections.has('expanded-contrast'))add(id,['expanded-contact-card-raster-contrast']);
    if(sections.has('framing'))add(id,['open-inspector-location-compact-hud','full-hud-resize-toggle','user-orbit-pan-wheel-pinch','edit-rapid-focus-no-reload']);
    if(sections.has('poles'))add(id,['pole-navigation-persistent-assets']);
    if(sections.has('import-return'))add(id,['import-pole-restore-lander']);
    if(width===1280&&sections.has('model'))add(id,['selected-model-copy-and-hover','legacy-file-import-selected-equations']);
    if(width===1280&&sections.has('physical'))add(id,['physical-follow-contact-bounce-breakup-replay']);
    if(sections.has('maps')){add(id,['all-four-map-modes-global-bounds']);maps(id);}
    if(sections.has('graphs')){add(id,['science-graphs-native-and-keyboard']);graph(id);}
    if(sections.has('surfaces'))surfaces(id);
  }
  if(sections.has('zoom')){
    names.push('real-native-200-percent-layout-zoom');
    for(const mode of opts.modes.split(','))for(const factor of opts.zoomChecks.split(',').map(Number)){
      const id=`${mode}-native${factor*100}`;
      add(id,['normal-pointer-hud-location','critical-contact-frame','inspector-raster-contrast','expanded-contact-raster-contrast','all-four-map-modes','science-graphs','workspaces','actual-errors-and-offline-requests']);
      for(const hud of ['compact','full'])for(const location of ['minimized','expanded','minimized-return'])add(id,[`${hud}-${location}-pointer-and-framing`]);
      maps(id);graph(id);surfaces(id);
    }
  }
  assert.equal(new Set(names).size,names.length,'No duplicate required check scopes');return names;
}
report.requiredChecks=requiredChecks();
try{
  report.instructions=await readFile(opts.instructions,'utf8');report.instructionsSha256=sha(report.instructions);console.log(report.instructions);
  const raw=await readFile(opts.marker,'utf8');marker=JSON.parse(raw);assert.ok(marker.artifactPath&&marker.artifactSha256&&marker.sourceCommit&&marker.url,'Full final identity required');report.marker={...marker,sha256:sha(raw)};
  report.source={commit:execFileSync('git',['rev-parse','HEAD'],{cwd:marker.sourceCheckPath,encoding:'utf8'}).trim(),status:execFileSync('git',['status','--porcelain'],{cwd:marker.sourceCheckPath,encoding:'utf8'}),bundleSha256:sha(await readFile(opts.sourceBundle))};assert.equal(report.source.commit,marker.sourceCommit);assert.equal(report.source.status,'');
  const bytes=await readFile(marker.artifactPath);assert.equal(sha(bytes),marker.artifactSha256);report.artifact={bytes:bytes.length,sha256:sha(bytes)};report.scriptSha256=sha(await readFile(fileURLToPath(import.meta.url)));await writeFile(join(output,'verifier.mjs'),await readFile(fileURLToPath(import.meta.url)));
  await appendFile(findings,`${new Date().toISOString()} START ${JSON.stringify(marker)} Evidence ${output}\n`);
  await check('original-nasa-asset-identity',()=>originalAssets(bytes));await check('exact-http-file-identity-before',identity);
  const packageBytes=await readFile(new URL('./package.json',pathToFileURL(opts.playwright)));report.playwright={version:JSON.parse(packageBytes).version,packageSha256:sha(packageBytes),path:opts.playwright};({chromium}=await import(pathToFileURL(opts.playwright).href));browser=await chromium.launch({headless:true,executablePath:opts.executable,args:flags});report.browser=browser.version();report.launchFlags=flags;
  for(const mode of opts.modes.split(','))for(const width of (opts.widths==='none'?[]:opts.widths.split(',').map(Number)))await runContext(mode,width);
  if(opts.sections.split(',').includes('zoom')){await browser.close();browser=null;}
  if(opts.sections.split(',').includes('zoom'))await check('real-native-200-percent-layout-zoom',zoom);

}catch(error){report.error=error.stack;process.exitCode=1;await appendFile(findings,`${new Date().toISOString()} ERROR ${output}\n${error.stack}\n`);console.error(error.stack);}
finally{await browser?.close();if(marker){try{  await check('immutable-candidate-after',async()=>{assert.equal(sha(await readFile(marker.artifactPath)),marker.artifactSha256);assert.equal(sha(await readFile(opts.marker)),report.marker.sha256);assert.equal(sha(await readFile(opts.instructions)),report.instructionsSha256);assert.equal(sha(await readFile(fileURLToPath(import.meta.url))),report.scriptSha256);assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:marker.sourceCheckPath,encoding:'utf8'}).trim(),report.source.commit);assert.equal(execFileSync('git',['status','--porcelain'],{cwd:marker.sourceCheckPath,encoding:'utf8'}),report.source.status);assert.equal(sha(await readFile(opts.sourceBundle)),report.source.bundleSha256);return identity();});}catch(error){report.error??=error.stack;process.exitCode=1;}}report.coverage={required:report.requiredChecks.length,executed:report.requiredChecks.filter(name=>report.checks.some(c=>c.name===name)).length,unexecuted:report.requiredChecks.filter(name=>!report.checks.some(c=>c.name===name)),failed:report.checks.filter(c=>c.status==='fail').map(c=>c.name)};if(report.coverage.unexecuted.length||report.coverage.failed.length){report.error??=`Required coverage incomplete: ${report.coverage.unexecuted.length} unexecuted, ${report.coverage.failed.length} failed`;process.exitCode=1;}report.finishedUtc=new Date().toISOString();report.overall=report.error?'fail':'pass';await save();console.log(`${report.overall.toUpperCase()} ${output}/report.json`);}
