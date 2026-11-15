import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {ScienceFramework} from '../../components/science-framework';

Object.assign(globalThis,{React});
const theme=readFileSync('app/mission-theme.css','utf8');
const executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE??process.env.CHROME_PATH??(process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'/usr/bin/google-chrome');
test('framework text and controls remain readable in every audience and both themes', {timeout:60000}, async()=>{
 const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:490,height:900}});
  for(const mode of ['public','teach','plan'] as const)for(const selected of ['dark','light']){
   const markup=renderToStaticMarkup(React.createElement(ScienceFramework,{mode}));
   await page.setContent(`<html data-ui-theme="${selected}"><head><style>${theme}</style></head><body><main class="lunar-app"><aside class="inspector">${markup}</aside></main></body></html>`);
   await page.evaluate('window.__name = (value) => value');
   const results=await page.locator('.science-framework').evaluate(root=>{
    const rgb=(s:string)=>s.match(/[\d.]+/g)!.slice(0,3).map(Number);
    const l=(a:number[])=>a.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
    return [...root.querySelectorAll('h2,h3,h4,p,dt,dd,summary,button,a,math')].filter(el=>el.getClientRects().length&&el.textContent?.trim()).map(el=>{
     const color=getComputedStyle(el).color;let surface:Element|null=el,background='';
     while(surface){background=getComputedStyle(surface).backgroundColor;if(!['rgba(0, 0, 0, 0)','transparent'].includes(background))break;surface=surface.parentElement;}
     const levels=[l(rgb(color)),l(rgb(background||'rgb(255,255,255)'))].sort((a,b)=>a-b);
     return {text:el.textContent!.slice(0,75),color,background,ratio:(levels[1]+.05)/(levels[0]+.05)};
    });
   });
   assert.ok(results.length>10);
   for(const result of results)assert.ok(result.ratio>=4.5,`${mode}/${selected}: ${JSON.stringify(result)}`);
   // This negative control reproduces the reported ink-on-dark body defect.
   if(selected==='dark'){
    await page.addStyleTag({content:'.science-framework.science-framework {color:var(--mission-ink)}'});
    const colors=await page.locator('.sf-body > p').first().evaluate(el=>({text:getComputedStyle(el).color,background:getComputedStyle(el.closest('.science-framework')!).backgroundColor}));
    assert.equal(colors.text,'rgb(11, 13, 15)');assert.equal(colors.background,'rgb(27, 29, 32)');
   }
  }
 }finally{await browser.close();}
});
