import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fitPolarCamera, polarImageToScreen, polarScreenToImage, resizePolarCamera} from '../components/polar-map';
import {constrainMapCamera, latLonToMap, mapToScreen, mapWorldWidth, screenToLatLon, zoomMapCamera} from '../lib/global-map';

const sizes = [{width:1920,height:992},{width:1728,height:1000},{width:1280,height:1000},{width:800,height:1000},{width:960,height:496},{width:800,height:496},{width:390,height:220}];
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ≈ ${b}`);

test('expanded polar overview covers wide, narrow and zoomed canvases with one projection scale',()=>{
  for(const size of sizes) for(const map of [{width:1024,height:1024},{width:1400,height:900}]) {
    const c=fitPolarCamera(size.width,size.height,map.width,map.height,true);
    assert.ok(c.x<=1e-8&&c.y<=1e-8);
    assert.ok(c.x+map.width*c.scale>=size.width-1e-8);
    assert.ok(c.y+map.height*c.scale>=size.height-1e-8);
    near(c.x+map.width*c.scale/2,size.width/2);
    near(c.y+map.height*c.scale/2,size.height/2);
    const a=polarImageToScreen({x:100,y:100},c),b=polarImageToScreen({x:101,y:101},c);
    near(b.x-a.x,b.y-a.y);
  }
});

test('embedded polar overview retains all finite data',()=>{
  for(const size of sizes){const c=fitPolarCamera(size.width,size.height,1400,900);assert.ok(c.x>=0&&c.y>=0);assert.ok(c.x+1400*c.scale<=size.width);assert.ok(c.y+900*c.scale<=size.height);}
});

test('cropped polar image and pointer coordinates round trip after pan and zoom',()=>{
  for(const size of sizes){const fit=fitPolarCamera(size.width,size.height,1024,1024,true);const c={scale:fit.scale*3.7,x:fit.x-123,y:fit.y+81};for(const p of [{x:0,y:0},{x:500,y:600},{x:1024,y:1024}]){const q=polarScreenToImage(polarImageToScreen(p,c),c);near(q.x,p.x);near(q.y,p.y);}const a=polarScreenToImage({x:200,y:100},c),b=polarScreenToImage({x:280,y:100},c);near((b.x-a.x)*c.scale,80);}
});

test('resizing preserves manually panned image centre and metres per pixel',()=>{
  let before=sizes[0],c={scale:2.8,x:-240,y:74};const original=c;
  const point=polarScreenToImage({x:before.width/2,y:before.height/2},c);
  for(const after of [...sizes.slice(1),sizes[0]]){c=resizePolarCamera(c,before,after);near(c.scale,original.scale);const centre=polarScreenToImage({x:after.width/2,y:after.height/2},c);near(centre.x,point.x);near(centre.y,point.y);before=after;}
  near(c.x,original.x);near(c.y,original.y);
});

test('whole-Moon mapping keeps its 2:1 projection and pointer coordinates at resized dimensions',()=>{
  for(const size of sizes){let c=constrainMapCamera({x:.5,y:.25,zoom:3},size);c=zoomMapCamera(c,size,1.4,{x:size.width/2,y:size.height/2});const a=mapToScreen(latLonToMap(0,0),c,size),b=mapToScreen(latLonToMap(10,10),c,size);near(b.x-a.x,a.y-b.y);assert.ok(mapWorldWidth(size,c.zoom)>0);for(const p of [{x:size.width*.4,y:size.height*.4},{x:size.width*.6,y:size.height*.6}]){const ll=screenToLatLon(p,c,size);if(!ll)continue;const q=mapToScreen(latLonToMap(ll.lat,ll.lon),c,size);near(q.x,p.x);near(q.y,p.y);}}
});

// Opt into the real layout gate against an immutable standalone artifact. This
// uses a private browser, never the shared preview, and uses normal UI actions.
if (process.env.SOLARREACH_VIEWPORT_ARTIFACT) {
  test('native 200% at 800×496 frames the 1× lander through every HUD and location state over HTTP and disconnected file', {timeout:240000}, async()=>{
    const {readFile,writeFile,mkdtemp,mkdir,rm}=await import('node:fs/promises');
    const {createServer}=await import('node:http');
    const {tmpdir}=await import('node:os');
    const {join}=await import('node:path');
    const {pathToFileURL}=await import('node:url');
    const {createHash}=await import('node:crypto');
    const {chromium}=await import(process.env.SOLARREACH_VIEWPORT_PLAYWRIGHT??'playwright-core');
    const bytes=await readFile(process.env.SOLARREACH_VIEWPORT_ARTIFACT!);
    const server=createServer((request,response)=>{
      if(request.url!=='/'){response.writeHead(404);response.end();return;}
      response.writeHead(200,{'Content-Type':'text/html'});response.end(bytes);
    });
    await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
    const address=server.address();assert.ok(address&&typeof address!=='string');
    const rows:unknown[]=[],profiles:string[]=[];
    const report={artifact:process.env.SOLARREACH_VIEWPORT_ARTIFACT,sha256:createHash('sha256').update(bytes).digest('hex'),platform:process.platform,browser:'',rows};
    try {
      for(const mode of ['http','file']){
        const profile=await mkdtemp(join(tmpdir(),'lunar-native200-regression-'));profiles.push(profile);
        await mkdir(join(profile,'Default'));
        await writeFile(join(profile,'Default','Preferences'),JSON.stringify({partition:{default_zoom_level:{x:Math.log(2)/Math.log(1.2)}}}));
        const context=await chromium.launchPersistentContext(profile,{executablePath:process.env.SOLARREACH_VIEWPORT_CHROME??'/usr/bin/google-chrome',headless:true,viewport:null,reducedMotion:'reduce',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--window-size=1600,1080']});
        try {
          if(mode==='file')await context.setOffline(true);
          const page=context.pages()[0];page.setDefaultTimeout(15000);
          report.browser=context.browser()!.version();
          const errors:string[]=[],httpRequests:string[]=[];
          page.on('pageerror',(error:Error)=>errors.push(error.message));
          page.on('console',(message:{type():string;text():string})=>{if(message.type()==='error')errors.push(message.text());});
          page.on('request',(request:{url():string})=>{if(request.url().startsWith('http'))httpRequests.push(request.url());});
          await page.goto(mode==='file'?pathToFileURL(process.env.SOLARREACH_VIEWPORT_ARTIFACT!).href:`http://127.0.0.1:${address.port}/`,{waitUntil:'domcontentloaded',timeout:120000});
          const button=(name:string)=>page.getByRole('button',{name,exact:true});
          await page.getByRole('group',{name:'Audience mode',exact:true}).waitFor();
          const dismiss=async()=>{await page.locator(".lunario-loader").waitFor({state:"hidden",timeout:30000});await button("Dismiss introduction").waitFor({state:"visible",timeout:3000});
            if(await page.locator('dialog[aria-labelledby="audience-guide-title"]').isVisible())await page.keyboard.press('Escape');
            if(await button('Dismiss introduction').isVisible())await button('Dismiss introduction').click();
          };
          await dismiss();await button('Planner').click();await dismiss();
          await page.locator('.app-header').getByRole('button',{name:'Lander',exact:true}).click();
          if(await button('Show inspector').isVisible())await button('Show inspector').click();
          await page.waitForFunction(()=>{const d=(document.querySelector('.scene-host') as HTMLElement)?.dataset;return d?.assetFlight==='idle'&&d.cameraMode==='vehicle';},null,{timeout:90000});
          const native=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,outerWidth,visualScale:visualViewport!.scale}));
          assert.deepEqual([native.width,native.height,native.dpr,native.outerWidth,native.visualScale],[800,496,2,1600,1],'Real browser zoom, without viewport or page-scale emulation');
          const scene=page.locator('.scene-host');
          const canvas=await scene.locator('canvas').elementHandle();
          const instance=await scene.getAttribute('data-scene-instance');
          if(await button('Minimize flight telemetry').isVisible())await button('Minimize flight telemetry').click();
          for(const hud of ['compact','full']){
            if(hud==='full')await button('Expand flight telemetry').click();
            if(await button('Minimize location card').isVisible())await button('Minimize location card').click();
            for(const location of ['minimized','expanded','minimized-return']){
              if(location==='expanded')await button('Expand location card').click();
              if(location==='minimized-return')await button('Minimize location card').click();
              const before=Number(await scene.getAttribute('data-render-frame'));
              await page.waitForFunction((before:number)=>Number((document.querySelector('.scene-host') as HTMLElement)?.dataset.renderFrame)>=before+2,before);
              const measured=await page.evaluate(()=>{
                const host=document.querySelector('.scene-host') as HTMLElement;
                const selectors=['.workspace-heading','.flight-telemetry','.map-bottom-tools','.inspector'];
                const hud=document.querySelector('.flight-telemetry')!;
                return {native:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,scroll:scrollY,documentWidth:document.documentElement.scrollWidth},data:{...host.dataset},host:host.getBoundingClientRect().toJSON(),panels:selectors.map(selector=>({selector,...document.querySelector(selector)!.getBoundingClientRect().toJSON()})),hudActions:hud.querySelector('.flight-hud-actions')!.getBoundingClientRect().toJSON(),metrics:[...hud.children].slice(0,4).filter(el=>el.getClientRects().length).map(el=>el.getBoundingClientRect().toJSON())};
              });
              rows.push({mode,hud,location,zoom:native,...measured});
              assert.equal(measured.data.vehicleFraming,'framed',`${mode}/${hud}/${location}: actual physical vehicle must be framed`);
              assert.equal(measured.data.vehicleScale,'1');
              const bounds=JSON.parse(measured.data.vehicleScreenBounds!),safe=JSON.parse(measured.data.unoccludedCanvas!);
              assert.ok(safe.right>safe.left&&safe.bottom>safe.top,'Unoccluded canvas has actual area');
              assert.ok(bounds.right-bounds.left>2&&bounds.bottom-bounds.top>2,'Physical vehicle has visible area');
              assert.ok(bounds.left>=safe.left-.1&&bounds.right<=safe.right+.1&&bounds.top>=safe.top-.1&&bounds.bottom<=safe.bottom+.1,'All vehicle geometry lies in clear canvas');
              const vehicle={left:bounds.left+measured.host.x,right:bounds.right+measured.host.x,top:bounds.top+measured.host.y,bottom:bounds.bottom+measured.host.y};
              const overlap=(a:typeof vehicle,b:typeof vehicle)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>.5&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>.5;
              for(const rect of [vehicle,...measured.panels])assert.ok(rect.left>=-.1&&rect.right<=800.1&&rect.top>=-.1&&rect.bottom<=496.1,'Vehicle and instruments stay in actual browser bounds');
              for(const panel of measured.panels)assert.ok(!overlap(vehicle,panel),`Vehicle clears ${panel.selector}`);
              for(const [i,panel]of measured.panels.entries())for(const other of measured.panels.slice(i+1))assert.ok(!overlap(panel,other),`${panel.selector} clears ${other.selector}`);
              for(const metric of measured.metrics)assert.ok(!overlap(metric,measured.hudActions),'HUD actions have dedicated space beside every metric');
              const inspector=measured.panels.find((panel:{selector:string})=>panel.selector==='.inspector')!,tools=measured.panels.find((panel:{selector:string})=>panel.selector==='.map-bottom-tools')!;
              near(inspector.bottom,tools.bottom);
              assert.equal(measured.native.scroll,0);assert.ok(measured.native.documentWidth<=800);
              assert.equal(await scene.getAttribute('data-scene-instance'),instance);
              assert.ok(await scene.evaluate((host:HTMLElement,canvas:HTMLCanvasElement)=>host.querySelector('canvas')===canvas,canvas));
              if(process.env.SOLARREACH_VIEWPORT_EVIDENCE){
                const cdp=await context.newCDPSession(page);
                const capture=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});await cdp.detach();
                await writeFile(`${process.env.SOLARREACH_VIEWPORT_EVIDENCE}-${mode}-${hud}-${location}.png`,Buffer.from(capture.data,'base64'));
              }
            }
          }
          // Full telemetry's playback controls must remain reachable by ordinary
          // pointer interaction through the dock's internal scroll container.
          await button('Play flight').click();await button('Pause flight').click();
          assert.deepEqual(errors,[],'No actual browser errors');
          assert.equal(httpRequests.length,mode==='file'?0:1,'Disconnected file makes no HTTP requests');
        } finally {await context.close();}
      }
    } finally {
      await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
      for(const profile of profiles)await rm(profile,{recursive:true,force:true});
      if(process.env.SOLARREACH_VIEWPORT_EVIDENCE)await writeFile(`${process.env.SOLARREACH_VIEWPORT_EVIDENCE}.json`,JSON.stringify(report,null,2));
    }
  });
  test('focused science graphs keep every horizontal axis label below the visible keyboard ring', {timeout:120000}, async()=>{
    const {pathToFileURL}=await import('node:url');
    const {chromium}=await import(process.env.SOLARREACH_VIEWPORT_PLAYWRIGHT??'playwright-core');
    const browser=await chromium.launch({executablePath:process.env.SOLARREACH_VIEWPORT_CHROME??'/usr/bin/google-chrome',headless:true});
    try {
      const context=await browser.newContext({viewport:{width:800,height:1000},reducedMotion:'reduce'});await context.setOffline(true);
      const page=await context.newPage();await page.goto(pathToFileURL(process.env.SOLARREACH_VIEWPORT_ARTIFACT!).href);
      const button=(name:string)=>page.getByRole('button',{name,exact:true});
      await page.getByRole('group',{name:'Audience mode',exact:true}).waitFor();
      const dismiss=async()=>{await page.locator(".lunario-loader").waitFor({state:"hidden",timeout:30000});await button("Dismiss introduction").waitFor({state:"visible",timeout:3000});if(await button('Dismiss introduction').isVisible())await button('Dismiss introduction').click();};
      await dismiss();await button('Planner').click();await dismiss();
      if(await button('Show inspector').isVisible())await button('Show inspector').click();
      for(const panel of ['Horizon analysis','Flight preview','Planner']){
        if(panel==='Planner'){await button('Planner').click();await dismiss();const summary=page.locator('summary').filter({hasText:/^Power & storage plots$/});if(!await summary.evaluate((n:HTMLElement)=>n.parentElement!.hasAttribute('open')))await summary.click();}
        else await page.locator('.inspector-nav').getByRole('button',{name:panel,exact:true}).click();
        const figures=page.locator('.inspector .science-figure');assert.equal(await figures.count(),2);
        for(const figure of await figures.all()){
          const svg=figure.locator('svg[role="img"]');await svg.scrollIntoViewIfNeeded();await page.mouse.move(5,5);await svg.focus();
          const measured=await figure.evaluate((n:HTMLElement)=>{const svg=n.querySelector('svg')!,label=n.querySelector('.chart-x-label')!,style=getComputedStyle(svg),range=document.createRange();range.selectNodeContents(label.childNodes[0]);return{title:n.querySelector('figcaption')!.textContent,focused:document.activeElement===svg,svg:svg.getBoundingClientRect().toJSON(),text:range.getBoundingClientRect().toJSON(),style:style.outlineStyle,width:parseFloat(style.outlineWidth),offset:parseFloat(style.outlineOffset)};});
          assert.ok(measured.focused&&measured.style!=='none'&&measured.width>=2,'Keyboard focus remains visible');
          assert.ok(measured.text.top>=measured.svg.bottom+measured.offset+measured.width-.1,`${measured.title}: axis text clears the actual focus ring: ${JSON.stringify(measured)}`);
          if(measured.title==='Battery energy and reserve'){
            await svg.press('End');await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
            assert.ok(await figure.getByRole('button',{name:/^Next sample/}).isDisabled(),'End inspects the actual final battery boundary');
            const clock=page.getByRole('group',{name:'Mission time',exact:true}).getByRole('slider');
            assert.equal(Number(await clock.getAttribute('aria-valuenow')),Number(await clock.getAttribute('aria-valuemax')??await clock.getAttribute('max')),'Final energy inspection cannot advance the environmental clock outside its supported stay');
            assert.match(await figure.locator('.chart-sample-readout').innerText(),/Wh/);
            await page.locator('.inspector-nav').getByRole('button',{name:'Horizon analysis',exact:true}).focus();
            await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
            assert.ok(!await figure.getByRole('button',{name:/^Next sample/}).isDisabled(),'Leaving the chart returns inspection to the supported shared clock');
          }
        }
      }
    } finally {await browser.close();}
  });
  test('inspector scrolling keeps the actual map viewport visible at 800px', {timeout:120000}, async()=>{
    const {pathToFileURL}=await import('node:url');
    const modulePath=process.env.SOLARREACH_VIEWPORT_PLAYWRIGHT??'playwright-core';
    const {chromium}=await import(modulePath);
    const browser=await chromium.launch({executablePath:process.env.SOLARREACH_VIEWPORT_CHROME??'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    try {
      const page=await browser.newPage({viewport:{width:800,height:1000},reducedMotion:'reduce'});
      await page.goto(pathToFileURL(process.env.SOLARREACH_VIEWPORT_ARTIFACT!).href);
      await page.locator('.workspace').waitFor();
      await page.locator('.lunario-loader').waitFor({state:'hidden',timeout:30000});
      await page.getByRole('button',{name:'Dismiss introduction',exact:true}).waitFor({state:'visible'});
      if(await page.locator('dialog[aria-labelledby="audience-guide-title"]').isVisible())await page.keyboard.press('Escape');
      await page.getByRole('button',{name:'Show inspector',exact:true}).click();
      await page.locator('.inspector-footer').scrollIntoViewIfNeeded();
      await page.locator('.inspector-scroll').getByText('Try another arrival or place.',{exact:false}).first().scrollIntoViewIfNeeded();
      const measured=await page.evaluate(()=>{
        return {width:innerWidth,height:innerHeight,scroll:scrollY,documentWidth:document.documentElement.scrollWidth,map:document.querySelector('.viewport')!.getBoundingClientRect().toJSON(),inspector:document.querySelector('.inspector')!.getBoundingClientRect().toJSON(),panelScroll:document.querySelector('.inspector-scroll')!.scrollTop};
      });
      assert.equal(measured.scroll,0,'inspector use must not scroll the scene above the viewport');
      assert.ok(measured.map.top>=0&&measured.map.bottom<=measured.height,'actual map stays within browser viewport');
      assert.ok(measured.map.height>200&&measured.map.width>200,'scene retains usable screen area');
      assert.ok(measured.inspector.left>=measured.map.right-.5,'inspector does not cover the renderer');
      assert.ok(measured.documentWidth<=measured.width,'no right overflow');
      assert.ok(measured.panelScroll>0,'long content scrolls inside inspector');
      await page.getByRole('button',{name:'Close inspector',exact:true}).click();
      await page.setViewportSize({width:1920,height:992});
      await page.getByRole('combobox',{name:'Map region',exact:true}).selectOption('global');
      await page.locator('.map-pane canvas[data-lunar-atlas-ready="true"]').waitFor();
      const surface=await page.locator('.map-pane canvas').evaluate((canvas:HTMLCanvasElement)=>({rect:canvas.getBoundingClientRect().toJSON(),transform:JSON.parse(canvas.dataset.mapTransform!)}));
      near(surface.rect.width,surface.transform.width);
      near(surface.rect.height,surface.transform.height);
    } finally {await browser.close();}
  });
}
