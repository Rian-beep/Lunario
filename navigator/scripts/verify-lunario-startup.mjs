import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
const url=process.argv[2]||'http://127.0.0.1:4341';const out=process.argv[3]||'/tmp/lunario-startup-edges';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||(existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'/usr/bin/google-chrome')});const report={url,checks:[]};
try{for(const mode of ['reduced','storage-denied','catalog-error']){
 const context=await browser.newContext({reducedMotion:mode==='reduced'?'reduce':'no-preference'});const page=await context.newPage();
 if(mode==='storage-denied')await context.addInitScript(()=>Object.defineProperty(window,'sessionStorage',{get(){throw new DOMException('Storage disabled for privacy fixture','SecurityError');}}));
 if(mode==='catalog-error')await context.route('**/data/catalog.json',route=>route.fulfill({status:503,contentType:'text/plain',body:'Expected unavailable catalog fixture'}));
 try{await page.goto(url,{waitUntil:'domcontentloaded'});await page.locator('.lunario-loader').waitFor({state:'visible'});assert.equal(await page.locator('dialog[open]').count(),0);
  if(mode==='reduced'){assert.equal(await page.locator('.lunario-loader__chars').innerText(),'PREPARE FOR LANDING');assert.equal(await page.locator('.lunario-loader__ring').getAttribute('transform'),null);}
  await page.locator('.lunario-loader').waitFor({state:'hidden',timeout:30000});
  if(mode==='catalog-error'){await page.getByRole('heading',{name:'Unable to load the lunar catalog',exact:true}).waitFor();await context.unroute('**/data/catalog.json');await page.getByRole('button',{name:'Retry',exact:true}).click();}
  await page.getByRole('button',{name:'Dismiss introduction',exact:true}).waitFor();await page.getByRole('button',{name:'Dismiss introduction',exact:true}).click();await page.getByRole('img',{name:'Lunario',exact:true}).waitFor();assert.equal(await page.locator('.lunario-loader').count(),0);await page.screenshot({path:`${out}/${mode}.png`});report.checks.push({name:mode,status:'pass'});console.log('PASS '+mode);
 }catch(e){report.checks.push({name:mode,status:'fail',error:e.stack});await page.screenshot({path:`${out}/${mode}-FAIL.png`});throw e;}finally{await context.close();}
}}finally{report.status=report.checks.length===3&&report.checks.every(c=>c.status==='pass')?'pass':'fail';await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
