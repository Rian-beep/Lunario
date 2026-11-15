/** Generated-app contrast and dismissal regression for the reported Data & math panel. */
import {chromium} from 'playwright-core';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {contrastRatio} from '../evaluation-audience/checks.mjs';
const [url,out]=process.argv.slice(2);if(!url||!out)throw Error('Usage: source-panel.mjs URL OUTPUT_DIRECTORY');await mkdir(out,{recursive:true});
const report={url,scope:'Computed opaque colors and real panel interactions in generated app; not a global accessibility or screen-reader pass.',cases:[],errors:[]};
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:1360,height:1000}});if(url.startsWith('file:'))await context.setOffline(true);const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(url,{waitUntil:'domcontentloaded'});const dismiss=async()=>{const b=page.getByRole('button',{name:'Dismiss introduction',exact:true});if(await b.isVisible())await b.click();};await page.getByRole('button',{name:'Dismiss introduction',exact:true}).waitFor({timeout:120000});await page.locator('.lunario-loader').waitFor({state:'hidden',timeout:120000});await dismiss();
 for(const theme of ['dark','light'])for(const mode of ['Public','Educator','Planner']){
  const entry={theme,mode,status:'fail'};report.cases.push(entry);
  try{
   if(await page.evaluate(()=>document.documentElement.dataset.uiTheme)!==theme)await page.getByRole('button',{name:`Switch to ${theme} mode`,exact:true}).click();
   await page.getByRole('group',{name:'Audience mode',exact:true}).getByRole('button',{name:mode,exact:true}).click();await dismiss();
   await page.getByRole('button',{name:'Open data pipelines and mathematical framework',exact:true}).click();await page.locator('.science-framework').waitFor();
   const show=page.getByRole('button',{name:'Show science framework',exact:true});if(await show.isVisible())await show.click();
   entry.colors=await page.locator('.science-framework').evaluate(root=>[...root.querySelectorAll('h2,h3,p,summary,button,dt,dd,a,math')].filter(el=>el.getClientRects().length&&el.textContent?.trim()).map(el=>{let surface=el,background='';while(surface){background=getComputedStyle(surface).backgroundColor;if(!['rgba(0, 0, 0, 0)','transparent'].includes(background))break;surface=surface.parentElement;}return{text:el.textContent.slice(0,80),foreground:getComputedStyle(el).color,background};}));
   for(const color of entry.colors){const rgb=s=>s.match(/[\d.]+/g).slice(0,3).map(Number);color.ratio=contrastRatio(rgb(color.foreground),rgb(color.background));assert.ok(color.ratio>=4.5,JSON.stringify(color));}
   const hide=page.getByRole('button',{name:'Hide framework',exact:true});await hide.scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/${theme}-${mode}.png`});await hide.click();await show.waitFor();await show.click();await page.getByRole('button',{name:'Close inspector',exact:true}).click();
   entry.status='pass';
  }catch(error){entry.error=error.stack;await page.screenshot({path:`${out}/failed-${theme}-${mode}.png`});}
 }
 assert.deepEqual(report.errors,[]);assert.ok(report.cases.every(c=>c.status==='pass'));
}finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify(report.cases.map(({theme,mode,status})=>({theme,mode,status}))));
