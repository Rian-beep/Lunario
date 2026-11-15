#!/usr/bin/env node
import assert from 'node:assert/strict';
import {mkdir,writeFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright-core';
import sharp from 'sharp';
const opts={},args=process.argv.slice(2);
for(let i=0;i<args.length;i++){
 const flag=args[i];if(flag==='--offline'){opts.offline=true;continue;}
 if(!['--base-url','--file','--output'].includes(flag)||!args[i+1]||args[i+1].startsWith('--'))throw Error('Usage: (--base-url URL | --file PATH) --output DIR [--offline]');
 if(opts[flag])throw Error(`Duplicate ${flag}`);opts[flag]=args[++i];
}
if(!opts['--output']||Boolean(opts['--base-url'])===Boolean(opts['--file']))throw Error('Choose one target and an output directory.');
if(opts['--base-url']&&!['http:','https:'].includes(new URL(opts['--base-url']).protocol))throw Error('Base URL must use HTTP(S).');
const target=opts['--file']?pathToFileURL(resolve(opts['--file'])).href:opts['--base-url'];
if(opts['--file'])await access(resolve(opts['--file']));
const output=resolve(opts['--output']);await mkdir(output,{recursive:true});
const report={createdUtc:new Date().toISOString(),target,offline:!!opts.offline,viewport:{width:1600,height:1000},measurements:[],keyboard:[],failures:[],pageErrors:[],httpErrors:[],manualGates:['Actual screen-reader interaction and announcements were not performed.','Contrast results apply to measured text/surfaces/states, not all imagery, icons, focus indicators or all app states.','Real 200% Chrome layout zoom is covered by the separate existing T17 verifier; this script does not duplicate or substitute viewport scaling for it.']};
const rgb=text=>{const m=text.match(/^rgba?\(([^)]+)\)$/);if(!m)return null;const v=m[1].split(/[, /]+/).filter(Boolean).map(Number);return v.length>=3&&v.every(Number.isFinite)?[v[0],v[1],v[2],v[3]??1]:null;};
const composite=(front,back)=>front.slice(0,3).map((v,i)=>v*front[3]+back[i]*(1-front[3]));
const luminance=color=>color.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((v,c,i)=>v+c*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--force-color-profile=srgb']});
const context=await browser.newContext({viewport:report.viewport,deviceScaleFactor:1,reducedMotion:'reduce'});if(opts.offline)await context.setOffline(true);
const page=await context.newPage();page.setDefaultTimeout(15000);
page.on('pageerror',e=>report.pageErrors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.httpErrors.push({url:r.url(),status:r.status()});});
const button=(name,scope=page)=>scope.getByRole('button',{name,exact:true});
const guide=async()=>{await button('Dismiss introduction').waitFor({state:'visible',timeout:1500}).catch(()=>{});if(await button('Dismiss introduction').isVisible())await page.keyboard.press('Escape');};
const details=async(text,scope=page)=>{const s=scope.locator('summary').filter({hasText:text}).first();if(!(await s.evaluate(el=>el.parentElement.open)))await s.click();return s.locator('..');};
async function auditControls(scope,name){
 const controls=scope.locator('input:not([type=hidden]),select,textarea');const entries=[];
 for(let i=0;i<await controls.count();i++){
  const control=controls.nth(i);if(!(await control.isVisible()))continue;
  const tree=await control.ariaSnapshot();const first=tree.split('\n')[0];const named=/^[^\n]*\s"(?:[^"\\]|\\.)+"/.test(first);
  if(!named)report.failures.push(`${name}: unnamed visible control ${first}`);
  await control.focus();const focused=await control.evaluate(el=>document.activeElement===el);
  await control.press('Tab');await page.keyboard.press('Shift+Tab');
  const tabReturned=await control.evaluate(el=>document.activeElement===el);
  entries.push({tree:first,named,focused,tabReturned});if(!tabReturned)report.failures.push(`${name}: Tab/Shift+Tab did not return to ${first}`);if(!focused)report.failures.push(`${name}: control could not receive keyboard focus: ${first}`);
 }
 report.keyboard.push({surface:name,controls:entries});
}
async function measure(name,targetLocator,surfaceLocator,opaqueCell=false){
 const el=targetLocator.first();await el.waitFor({state:'visible'});await el.scrollIntoViewIfNeeded();
 const surface=surfaceLocator.first();
 const data=await el.evaluate((element,surfaceSelector)=>{
  const surface=element.closest(surfaceSelector);if(!surface)throw Error('Text has no matching audited surface');
  const style=getComputedStyle(element),r=element.getBoundingClientRect(),sr=surface.getBoundingClientRect();
  const ancestors=[];for(let p=element;p;p=p.parentElement){const c=getComputedStyle(p);ancestors.push({tag:p.tagName,color:c.backgroundColor,image:c.backgroundImage,opacity:c.opacity,filter:c.filter,backdropFilter:c.backdropFilter,blend:c.mixBlendMode});if(p===surface)break;}
  const allOpacity=[];for(let p=element;p;p=p.parentElement){const c=getComputedStyle(p);if(c.opacity!=='1'||c.filter!=='none'||c.mixBlendMode!=='normal')allOpacity.push({tag:p.tagName,opacity:c.opacity,filter:c.filter,blend:c.mixBlendMode});}
  return{tag:element.tagName,text:element.textContent.trim().slice(0,180),foreground:style.color,fontSize:parseFloat(style.fontSize),fontWeight:parseFloat(style.fontWeight),textShadow:style.textShadow,ancestors,unsupportedEffects:allOpacity,rect:{x:r.x,y:r.y,width:r.width,height:r.height},surfaceRect:{x:sr.x,y:sr.y,width:sr.width,height:sr.height},surfaceBackground:getComputedStyle(surface).backgroundColor};
 },await surface.evaluate(el=>el.matches('.planning-table-scroll td')?'.planning-table-scroll td':el.matches('.planning-table-scroll th')?'.planning-table-scroll th':el.matches('.comparison-sheet')?'.comparison-sheet':'.inspector'));
 const fg=rgb(data.foreground);const threshold=data.fontSize>=24||(data.fontSize>=18.6667&&data.fontWeight>=700)?3:4.5;
 const measurement={name,...data,threshold,method:opaqueCell?'opaque-cell-corner-pixels':'adjacent-blank-margin-pixels-and-alpha-backdrop-bounds',status:'unverified'};
 const png=await page.screenshot({path:resolve(output,`${name}.png`),animations:'disabled',scale:'css'});const decoded=await sharp(png).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const r=data.rect,s=data.surfaceRect;let points;
 if(opaqueCell||data.tag==='INPUT'||data.tag==='TEXTAREA'||data.tag==='SELECT')points=[[r.x+5,r.y+5],[r.x+r.width-5,r.y+5],[r.x+5,r.y+r.height-5],[r.x+r.width-5,r.y+r.height-5]];
 else{const x=r.x-6;points=[r.y+Math.min(7,r.height/2),r.y+r.height/2,r.y+Math.max(r.height-7,r.height/2)].map(y=>[x,y]);}
 const pixels=[];
 for(const [px,py]of points){const x=Math.round(px),y=Math.round(py);if(x<Math.ceil(s.x+2)||y<Math.ceil(s.y+2)||x>=Math.min(decoded.info.width,s.x+s.width-2)||y>=Math.min(decoded.info.height,s.y+s.height-2))continue;
  const unobscured=await surface.evaluate((surface,{x,y})=>{const hit=document.elementFromPoint(x,y);return !!hit&&(surface===hit||surface.contains(hit));},{x,y});if(!unobscured)continue;
  const at=(y*decoded.info.width+x)*decoded.info.channels,pixel=[decoded.data[at],decoded.data[at+1],decoded.data[at+2]];pixels.push({x,y,rgb:pixel,ratio:fg?contrast(composite(fg,pixel),pixel):null});
 }
 measurement.samples=pixels;
 const layers=data.ancestors.map(a=>rgb(a.color));const eligible=fg&&fg[3]===1&&layers.every(Boolean)&&data.unsupportedEffects.length===0&&data.ancestors.every(a=>a.image==='none');
 if(eligible&&pixels.length){
  let black=[0,0,0],white=[255,255,255];for(const layer of layers.toReversed()){black=composite(layer,black);white=composite(layer,white);}
  // A foreground can lie between the bounds. Include its luminance if so: endpoint ratios alone are insufficient.
  const fgLuminance=luminance(fg),low=luminance(black),high=luminance(white);
  const boundsMinimum=fgLuminance>=Math.min(low,high)&&fgLuminance<=Math.max(low,high)?1:Math.min(contrast(composite(fg,black),black),contrast(composite(fg,white),white));
  measurement.backdropBounds={black:white.map((_,i)=>black[i]),white,minimumContrast:boundsMinimum,note:'Known CSS solid-alpha layers over arbitrary bounded sRGB backdrop. Backdrop blur/saturation is not asserted to be measured; its output is conservatively allowed anywhere between black and white.'};
  measurement.minimumObserved=Math.min(...pixels.map(p=>p.ratio));measurement.conservativeMinimum=Math.min(measurement.minimumObserved,boundsMinimum);
  if(opaqueCell){const expected=rgb(data.surfaceBackground);measurement.expectedOpaqueBackground=expected;if(!expected||expected[3]!==1||expected.slice(0,3).some((v,i)=>v!==[250,249,244][i])||pixels.some(p=>p.rgb.some((v,i)=>Math.abs(v-expected[i])>2)))measurement.reason='Corner pixels did not match the computed opaque cell background; no solid-background claim is made.';else measurement.status=measurement.conservativeMinimum>=threshold?'pass':'fail';}
  else measurement.status=measurement.conservativeMinimum>=threshold?'pass':'fail';
 }else measurement.reason='No reliable unobscured blank samples or unsupported foreground/ancestor opacity, filter, blend, image, or color. Requires manual composited measurement.';
 report.measurements.push(measurement);if(measurement.status==='fail')report.failures.push(`${name}: contrast ${measurement.conservativeMinimum.toFixed(2)} below ${threshold}`);
 console.log(`${measurement.status.toUpperCase()} ${name} ${measurement.conservativeMinimum?.toFixed(2)??'unverified'} / ${threshold}`);
}
async function stage(name,run){try{await run();}catch(e){report.failures.push(`${name}: ${e.stack||e.message}`);await page.screenshot({path:resolve(output,`${name}-FAIL.png`)}).catch(()=>{});console.error(`FAIL ${name}: ${e.message}`);}}
try{
 await page.goto(target,{waitUntil:'load',timeout:60000});await page.getByLabel('Lunar workbench',{exact:true}).waitFor({timeout:60000});await guide();await button('Planner').click();await guide();
 await stage('planner',async()=>{
  const panel=page.locator('.planning-decision');await panel.locator('.planning-verdict').waitFor();
  await measure('planner-verdict',panel.locator('.planning-verdict'),page.locator('.inspector'));
  const req=await details('Requirements & independent instrument heights');
  const optionalRequirements=[req.getByRole('checkbox',{name:'Limit geometric Earth outage',exact:true}),req.getByRole('checkbox',{name:'Require additional assumed radio margin',exact:true})];
  const oldRequired=[];for(const checkbox of optionalRequirements){oldRequired.push(await checkbox.isChecked());await checkbox.check();}
  await auditControls(req,'requirements');for(let i=0;i<optionalRequirements.length;i++)await optionalRequirements[i].setChecked(oldRequired[i]);
  await measure('requirements-normal-copy',req.locator('p').first(),page.locator('.inspector'));
  const operations=await details('Deployment, load schedule & battery rate assumptions');
  const rateCaps=[operations.getByRole('checkbox',{name:/^Charging bus power cap/}),operations.getByRole('checkbox',{name:/^Discharging bus power cap/})];
  const oldCaps=[];for(const checkbox of rateCaps){oldCaps.push(await checkbox.isChecked());await checkbox.check();}
  await auditControls(operations,'operations');for(let i=0;i<rateCaps.length;i++)await rateCaps[i].setChecked(oldCaps[i]);
  await measure('deployment-input',operations.locator('input').first(),page.locator('.inspector'));
  const table=await details('Assessed requirements & margins');await measure('requirements-table-cell',table.locator('tbody td').first(),table.locator('tbody td').first(),true);
  const evidence=await details('Evidence & unassessed landing considerations');await measure('evidence-table-cell',evidence.locator('tbody td').first(),evidence.locator('tbody td').first(),true);
  const external=await details('Add an external assessment report',evidence);await auditControls(external,'external-report');
 });
 await stage('calendar',async()=>{
  await button('Find whole-mission arrival windows').click();const calendar=page.locator('.mission-calendar');await auditControls(calendar,'calendar');
  await measure('calendar-normal-copy',calendar.locator('p').first(),page.locator('.comparison-sheet'));
  await measure('calendar-large-heading',calendar.locator('h2'),page.locator('.comparison-sheet'));
  await button('Evaluate mission starts',calendar).click();await calendar.getByText(/31 full stays evaluated/).waitFor({timeout:90000});
  await details('Changed inputs and technical comparison',calendar);
  await measure('calendar-requirement-cell',calendar.locator('.planning-selected tbody td').first(),calendar.locator('.planning-selected tbody td').first(),true);
  await button('+1 day',calendar).click();await button('Compare baseline & candidate',calendar).click();
 });
 await stage('comparison',async()=>{
  const comparison=page.locator('.comparison-content');await comparison.getByRole('heading',{name:'Compare mission scenarios'}).waitFor();
  await measure('comparison-normal-copy',comparison.locator('.comparison-actions p'),page.locator('.comparison-sheet'));
  await measure('comparison-large-heading',comparison.locator('h2'),page.locator('.comparison-sheet'));
  await button('Choose columns',comparison).click();await auditControls(comparison,'comparison');
  await measure('comparison-body-value',comparison.locator('tbody tr').first().locator('td').nth(1),page.locator('.comparison-sheet'));
 });
 assert.ok(report.measurements.length>=8,'Expected measurements across the Planner, evidence, calendar and comparison surfaces');
}catch(e){report.failures.push(e.stack||e.message);}finally{
 const verified=report.measurements.filter(m=>m.status==='pass');report.summary={measured:report.measurements.length,passed:verified.length,failed:report.measurements.filter(m=>m.status==='fail').length,unverified:report.measurements.filter(m=>m.status==='unverified').length,minimumVerifiedContrast:verified.length?Math.min(...verified.map(m=>m.conservativeMinimum)):null};
 await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));await browser.close();
}
if(report.failures.length||report.pageErrors.length||report.httpErrors.length)process.exitCode=1;
