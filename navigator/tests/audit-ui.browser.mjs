// Real chart components in an isolated, disconnected file fixture. No app build/server.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, mkdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import sharp from 'sharp';

const out = process.env.AUDIT_UI_OUT ?? '/tmp/audit-ui-browser';
const hash = (b) => createHash('sha256').update(b).digest('hex');
test('audit-ui: native clipboard, exact PNG geometry, metadata and offline charts', async (t) => {
  await mkdir(out, {recursive:true});
  const directory = await mkdtemp(join(tmpdir(), 'audit-ui-fixture-'));
  t.after(() => rm(directory, {recursive:true, force:true}));
  const browser = await chromium.launch({executablePath:process.env.CHROME_PATH ?? '/usr/bin/google-chrome', headless:true, args:['--no-sandbox']});
  t.after(() => browser.close());
  const context = await browser.newContext({offline:true, permissions:['clipboard-read','clipboard-write'], viewport:{width:900,height:1000}, acceptDownloads:true});
  const page = await context.newPage(), errors = [], http = [], records = [];
  page.setDefaultTimeout(15_000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => {if (/^https?:/.test(r.url())) http.push(r.url());});
  const bundled = await build({stdin:{resolveDir:process.cwd(), loader:'tsx', contents:`
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {HorizonGraph,ElevationGraph} from './components/workbench/science-charts';
    import {ResponsePlot} from './components/audience/response-plot';
    import {HorizonPanorama,ElevationChart,ObliqueSketch} from './components/sky-views';
    import * as images from './lib/chart-image';
    const a=v=>new Float64Array(v), mask=a([1,2,NaN,3]);
    // Explicitly synthetic rendering inputs, never physical validation.
    const series={index0:10,sunAz:a([5,15,25]),sunEl:a([2,NaN,4]),earthAz:a([60,70,80]),earthEl:a([3,4,5]),sunHorizon:a([1,NaN,2]),earthHorizon:a([2,3,4]),sunRadius:a([.27,.27,.27]),earthRadius:a([1,1,1])};
    const terrain={mask,stepDeg:90,heightM:2,distanceKm:null,cellLat:null,cellLon:null,exact:false};
    const catalog={t0ms:Date.parse('2026-11-15T00:00:00Z'),meta:{t0:'2026-11-15T00:00:00Z',stepHours:1}};
    window.auditImages=images; window.auditSvgBlobs=[];
    const original=URL.createObjectURL.bind(URL);
    URL.createObjectURL=b=>{if(b.type.startsWith('image/svg+xml'))window.auditSvgBlobs.push(b);return original(b);};
    createRoot(document.getElementById('app')).render(<>
      <div id="science"><HorizonGraph series={series} terrain={terrain} cursor={0}/></div>
      <div id="time"><ElevationGraph catalog={catalog} series={series} cursor={0} onCursor={v=>window.auditCursor=v}/></div>
      <div id="response"><ResponsePlot title="Synthetic response" points={[{x:0,label:'0',terrain:1,sphere:2},{x:1,label:'1',terrain:null,sphere:3},{x:2,label:'2',terrain:4,sphere:5}]} xLabel="Load (W)" yLabel="Battery (Wh)"/></div>
      <div id="panorama"><HorizonPanorama series={series} cursor={0} mask={mask} stepDeg={90}/></div>
      <div id="elevation"><ElevationChart series={series} cursor={0} onCursor={v=>window.auditSkyCursor=v}/></div>
      <div id="oblique"><ObliqueSketch series={series} cursor={0} mask={mask} stepDeg={90}/></div>
    </>);
  `}, bundle:true,write:false,outfile:join(directory,'fixture.js'),jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
  const js=bundled.outputFiles.find(f=>f.path.endsWith('.js')).text;
  const css=bundled.outputFiles.find(f=>f.path.endsWith('.css'))?.text ?? '';
  const global=(await readFile('app/globals.css','utf8')).replace(/^@(?:import|source).*$/gm,'');
  const theme=await readFile('app/mission-theme.css','utf8');
  const fixture=`<!doctype html><html data-ui-theme="dark" class="dark"><meta charset="utf-8"><style>${global}\n${theme}\n${css}\nbody{margin:24px}#app{max-width:760px}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}</style><div id="app"></div><script>${js.replace(/<\/script/gi,'<\\/script')}</script></html>`;
  await writeFile(join(directory,'fixture.html'),fixture);
  await page.goto(pathToFileURL(join(directory,'fixture.html')).href);
  await page.waitForFunction(()=>document.querySelectorAll('.chart-image-actions').length===6 && document.querySelector('#panorama canvas')?.width>0);
  const ids=['science','time','response','panorama','elevation','oblique'];
  await t.test('six actual components: native clipboard PNG pixels equal their downloaded PNGs', async()=>{
    for(const id of ids){
      const host=page.locator(`#${id}`);
      // No ClipboardItem, write/read or secure-context mocks in this test.
      await host.getByRole('button',{name:/Copy chart image/}).click();
      await host.locator('.chart-image-actions [role=status]').filter({hasText:'Chart image copied.'}).waitFor();
      const copied=Buffer.from(await page.evaluate(async()=>{
        const items=await navigator.clipboard.read();
        const item=items.find(i=>i.types.includes('image/png'));
        if(!item)throw new Error('Native clipboard contains no PNG');
        return [...new Uint8Array(await (await item.getType('image/png')).arrayBuffer())];
      }));
      const downloadEvent=page.waitForEvent('download');
      await host.getByRole('button',{name:/Download PNG/}).click();
      const download=await downloadEvent, file=join(out,`${id}.png`);
      await download.saveAs(file);
      const bytes=await readFile(file), actual=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
      const native=await sharp(copied).ensureAlpha().raw().toBuffer({resolveWithObject:true});
      assert.deepEqual(native.info,actual.info,id);
      assert.deepEqual(native.data,actual.data,`${id}: decoded clipboard pixels differ`);
      const serialized=await page.evaluate(async()=>await window.auditSvgBlobs.at(-1).text());
      await writeFile(join(out,`${id}.svg`),serialized);
      const geometry=await page.evaluate((id)=>{
        const el=document.querySelector('#'+id+' .plot-area > svg')??document.querySelector('#'+id+' svg[viewBox]')??document.querySelector('#'+id+' canvas');
        return el instanceof HTMLCanvasElement?{w:parseFloat(el.style.width),h:parseFloat(el.style.height),canvas:true}:{w:el.viewBox.baseVal.width,h:el.viewBox.baseVal.height,canvas:false};
      },id);
      const exported=serialized.match(/<svg[^>]*width="([\d.]+)" height="([\d.]+)"/);
      assert.ok(exported);
      assert.equal(actual.info.width,Math.ceil(Number(exported[1])*2));
      assert.equal(actual.info.height,Math.ceil(Number(exported[2])*2));
      if(geometry.canvas){
        assert.match(serialized,new RegExp(`width="${geometry.w}" height="${geometry.h}" href="data:image/png;base64,`));
      }else{
        assert.match(serialized,new RegExp(`width="${geometry.w}" height="${geometry.h}"`));
      }
      assert.match(serialized,/Vertical axis:/);assert.match(serialized,/Horizontal axis:/);
      assert.ok(!serialized.includes('Copy chart image'));
      for(const [x,y] of [[0,0],[actual.info.width-1,0],[0,actual.info.height-1],[actual.info.width-1,actual.info.height-1]]){
        const i=(y*actual.info.width+x)*4;assert.deepEqual([...actual.data.subarray(i,i+4)],[255,255,255,255]);
      }
      let dark=0,colored=0,transparent=0;
      for(let i=0;i<actual.data.length;i+=4){const [r,g,b,a]=actual.data.subarray(i,i+4);if(r<90&&g<90&&b<90)dark++;if(Math.max(r,g,b)-Math.min(r,g,b)>45)colored++;if(a!==255)transparent++;}
      assert.ok(dark>500&&colored>50,`${id}: blank or missing plot/labels`);assert.equal(transparent,0);
      records.push({id,pngSha256:hash(bytes),clipboardPixelSha256:hash(native.data),downloadPixelSha256:hash(actual.data),width:actual.info.width,height:actual.info.height,plot:geometry,darkPixels:dark,coloredPixels:colored,transparentPixels:transparent,metadata:serialized.replace(/<image[^>]*\/>/g,'[embedded plot PNG]').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()});
    }
  });
  await t.test('native denied permission gives fallback; download still succeeds',async()=>{
    await context.clearPermissions();
    // Chromium CDP denies permission without replacing the native Clipboard API.
    const cdp=await context.newCDPSession(page);
    const {targetInfo:{browserContextId}}=await cdp.send('Target.getTargetInfo');
    for(const allowWithoutSanitization of [false,true])
      await cdp.send('Browser.setPermission',{browserContextId,permission:{name:'clipboard-write',allowWithoutSanitization},setting:'denied'});
    const host=page.locator('#science');
    await host.getByRole('button',{name:/Copy chart image/}).click();
    await host.locator('.chart-image-actions [role=status]').filter({hasText:/Copy failed:.*denied.*Download PNG/}).waitFor();
    const event=page.waitForEvent('download');await host.getByRole('button',{name:/Download PNG/}).click();
    assert.equal((await event).suggestedFilename().endsWith('.png'),true);
  });
  await t.test('dark/light labels and white surfaces, responsive uniform transforms and keyboard sample control',async()=>{
    for(const theme of ['dark','light'])for(const width of [900,420]){
      await page.evaluate(theme=>{document.documentElement.dataset.uiTheme=theme;document.documentElement.classList.toggle('dark',theme==='dark');},theme);
      await page.setViewportSize({width,height:1000});
      await page.waitForFunction(()=>{const c=document.querySelector('#panorama canvas');return c.width===Math.floor(c.parentElement.clientWidth*2);});
      const paint=await page.evaluate(()=>[...document.querySelectorAll('.chart-image-surface svg[viewBox]')].map(svg=>{
        const m=svg.getScreenCTM();return{background:getComputedStyle(svg).backgroundColor,labels:[...svg.querySelectorAll('text')].map(t=>getComputedStyle(t).fill),sx:Math.hypot(m.a,m.b),sy:Math.hypot(m.c,m.d)};
      }));
      for(const p of paint){assert.equal(p.background,'rgb(255, 255, 255)');assert.ok(p.labels.every(v=>v==='rgb(28, 25, 21)'));assert.ok(Math.abs(p.sx-p.sy)<1e-6);}
      for(const id of ['panorama','elevation','oblique']){
        const size=await page.locator(`#${id} canvas`).evaluate(c=>({w:c.width,h:c.height,sw:parseFloat(c.style.width),sh:parseFloat(c.style.height)}));
        assert.equal(size.w,size.sw*2);assert.equal(size.h,size.sh*2);
      }
      await page.screenshot({path:join(out,`${theme}-${width}.png`),fullPage:true});
    }
    const graph=page.locator('#time .plot-area svg');await graph.focus();await page.keyboard.press('End');assert.equal(await page.evaluate(()=>window.auditCursor),2);await page.keyboard.press('Home');assert.equal(await page.evaluate(()=>window.auditCursor),0);
  });
  await t.test('UTC export extent and source caveats survive serialization',async()=>{
    const time=records.find(r=>r.id==='time').metadata;
    assert.match(time,/2026-11-15 10:00 UTC to 2026-11-15 12:00 UTC/);
    assert.match(time,/JPL Horizons/);assert.match(time,/LOLA/);assert.match(time,/Unknown values leave gaps/);
    assert.match(records.find(r=>r.id==='science').metadata,/observer height: 2 m/);
    assert.match(records.find(r=>r.id==='oblique').metadata,/schematic/);
  });
  await t.test('chart notes, gradient explanations and exact sample readouts stay legible on white in dark mode',async()=>{
    await page.evaluate(()=>{document.documentElement.dataset.uiTheme='dark';document.documentElement.classList.add('dark');document.querySelector('#science .chart-gradient-help').open=true;});
    const paint=await page.locator('#science').evaluate(host=>({
      notes:[...host.querySelectorAll('.chart-note,.chart-gradient-help p,.chart-gradient-help li,.chart-sample-readout li')].map(el=>({text:el.textContent.slice(0,80),color:getComputedStyle(el).color})),
      readout:getComputedStyle(host.querySelector('.chart-sample-readout')).backgroundColor,
    }));
    await writeFile(join(out,'supporting-text-paint.json'),JSON.stringify(paint,null,2)+'\n');
    assert.ok(paint.notes.every(n=>n.color==='rgb(28, 25, 21)'),JSON.stringify(paint));
    assert.equal(paint.readout,'rgb(255, 255, 255)');
    await page.locator('#science').screenshot({path:join(out,'supporting-text-after.png')});
  });
  await t.test('independent circle fiducial stays circular at 2× in non-square SVG and canvas exports',async()=>{
    for(const kind of ['svg','canvas']){
      const result=await page.evaluate(async kind=>{
        const svg=kind==='svg';
        const el=svg?document.createElementNS('http://www.w3.org/2000/svg','svg'):document.createElement('canvas');
        if(svg){el.setAttribute('viewBox','0 0 300 100');el.innerHTML='<circle cx="150" cy="50" r="20" fill="#000000"/>';}
        else{el.width=600;el.height=200;el.style.width='300px';el.style.height='100px';const c=el.getContext('2d');c.fillStyle='white';c.fillRect(0,0,600,200);c.fillStyle='black';c.beginPath();c.arc(300,100,40,0,2*Math.PI);c.fill();}
        document.body.append(el);
        try{
          const details={title:'Geometry fiducial',xAxis:'Rendering units',yAxis:'Rendering units',legend:[]};
          const serialized=window.auditImages.serializeChartImage(el,details);
          const doc=new DOMParser().parseFromString(serialized.svg,'image/svg+xml');
          const plot=svg?doc.querySelector('g[transform]'):doc.querySelector('image');
          const offset=svg?plot.getAttribute('transform').match(/translate\(([\d.]+) ([\d.]+)\)/).slice(1).map(Number):[Number(plot.getAttribute('x')),Number(plot.getAttribute('y'))];
          return{offset,bytes:[...new Uint8Array(await (await window.auditImages.renderChartPng(el,details)).arrayBuffer())]};
        }finally{el.remove();}
      },kind);
      const png=Buffer.from(result.bytes),{data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
      const cx=Math.round((result.offset[0]+150)*2),cy=Math.round((result.offset[1]+50)*2);
      const dark=(x,y)=>{const i=(y*info.width+x)*4;return data[i]<64&&data[i+1]<64&&data[i+2]<64;};
      const xs=[],ys=[];for(let d=-45;d<=45;d++){if(dark(cx+d,cy))xs.push(d);if(dark(cx,cy+d))ys.push(d);}
      const diameterX=xs.at(-1)-xs[0]+1,diameterY=ys.at(-1)-ys[0]+1;
      assert.ok(Math.abs(diameterX-80)<=2 && Math.abs(diameterY-80)<=2,`${kind}: ${diameterX}×${diameterY}, expected 80px circle`);
      assert.ok(Math.abs(diameterX-diameterY)<=1);
      await writeFile(join(out,`${kind}-fiducial.png`),png);
      records.push({id:`${kind}-fiducial`,diameterX,diameterY,expectedDiameter:80,tolerancePx:2});
    }
  });
  assert.deepEqual(http,[]);assert.deepEqual(errors,[]);
  await writeFile(join(out,'observations.json'),JSON.stringify({browser:browser.version(),fixtureSha256:hash(fixture),input:{kind:'synthetic rendering only',t0:'2026-11-15T00:00:00Z',index0:10,stepHours:1,terrainStepDeg:90,observerHeightM:2},http,errors,records},null,2)+'\n');
});
