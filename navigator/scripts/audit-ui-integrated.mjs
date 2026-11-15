// Read-only candidate journeys; uses an isolated profile, never starts a server/build.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright-core';
import sharp from 'sharp';
const out=process.env.AUDIT_UI_INTEGRATED_OUT??'/tmp/audit-ui-integrated';
const web=process.env.AUDIT_UI_URL??'http://127.0.0.1:4356/web/index.html';
const file=resolve(process.env.AUDIT_UI_FILE??'public/solarreach-navigator.html');
const sha=b=>createHash('sha256').update(b).digest('hex');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report={runUtc:new Date().toISOString(),browser:browser.version(),web,file,fileSha256:sha(await readFile(file)),runs:[]};
try{
  for(const transport of ['web','file']){
    const context=await browser.newContext({viewport:{width:1600,height:1000},reducedMotion:'reduce',offline:transport==='file',acceptDownloads:true});
    const page=await context.newPage();page.setDefaultTimeout(20000);
    const run={transport,url:transport==='web'?web:pathToFileURL(file).href,http:[],pageErrors:[],consoleErrors:[],assets:[],charts:[],checks:[],discrepancies:[]};report.runs.push(run);
    page.on('pageerror',e=>run.pageErrors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')run.consoleErrors.push(m.text());});
    page.on('request',r=>{if(/^https?:/.test(r.url()))run.http.push(r.url());});
    const pending=[];
    page.on('response',r=>{if(/(?:index\.html|main-[^/]+\.(?:js|css)|tailwind-[^/]+\.css)$/.test(r.url()))pending.push((async()=>{const b=await r.body();run.assets.push({url:r.url(),status:r.status(),bytes:b.length,sha256:sha(b)});})().catch(e=>run.assets.push({url:r.url(),error:e.message})));});
    await page.goto(run.url);
    await page.getByRole('button',{name:'Dismiss introduction',exact:true}).click();
    const audience=page.getByRole('group',{name:'Audience mode'});
    for(const name of ['Educator','Planner','Public','Planner']){
      await audience.getByRole('button',{name,exact:true}).click();
      const dismiss=page.getByRole('button',{name:'Dismiss introduction',exact:true});if(await dismiss.isVisible())await dismiss.click();
      assert.equal(await audience.getByRole('button',{name,exact:true}).getAttribute('aria-pressed'),'true');
    }
    run.checks.push('All audience controls select and dismiss their introduction.');
    await page.getByRole('button',{name:'Replan mission',exact:true}).first().click();
    const comparison=page.locator('figure').filter({has:page.locator('svg[role=slider]')}).first();
    await comparison.waitFor();
    run.comparisonChart=await comparison.evaluate(el=>({title:el.querySelector('figcaption')?.textContent,hasImageActions:!!el.querySelector('.chart-image-actions'),background:getComputedStyle(el).backgroundColor,svgBackground:getComputedStyle(el.querySelector('svg[role=slider]')).backgroundColor}));
    if(!run.comparisonChart.hasImageActions)run.discrepancies.push('Replanning ComparisonPlot has no chart image actions or white chart surface (outside lane ownership).');
    await page.getByRole('button',{name:'Show Sun / Earth horizons',exact:true}).first().click();
    const horizon=page.locator('.science-figure:visible').first();await horizon.waitFor();
    for(const width of [1600,800]){
      await page.setViewportSize({width,height:1000});
      await page.waitForTimeout(200);
      const paint=await horizon.evaluate((el,width)=>{
        const svg=el.querySelector('.plot-area > svg'),m=svg.getScreenCTM();
        return{width,title:el.querySelector('figcaption').textContent,background:getComputedStyle(el).backgroundColor,svgBackground:getComputedStyle(svg).backgroundColor,labels:[...svg.querySelectorAll('text')].map(t=>getComputedStyle(t).fill),sx:Math.hypot(m.a,m.b),sy:Math.hypot(m.c,m.d),actions:el.querySelectorAll('.chart-image-actions button').length};
      },width);
      run.charts.push(paint);
      await horizon.screenshot({path:join(out,`${transport}-horizon-${width}.png`)});
      if(paint.background!=='rgb(255, 255, 255)'||paint.svgBackground!=='rgb(255, 255, 255)'||paint.labels.some(c=>c!=='rgb(28, 25, 21)')||paint.actions!==2)
        run.discrepancies.push(`HorizonGraph at ${width}px lacks expected white/dark paint or image actions.`);
      assert.ok(Math.abs(paint.sx-paint.sy)<1e-6);
    }
    if(await horizon.getByRole('button',{name:/Download PNG/}).count()){
      const event=page.waitForEvent('download');await horizon.getByRole('button',{name:/Download PNG/}).click();const png=await event;const pngPath=join(out,`${transport}-horizon-export.png`);await png.saveAs(pngPath);const meta=await sharp(pngPath).metadata();assert.equal(meta.format,'png');run.download={sha256:sha(await readFile(pngPath)),width:meta.width,height:meta.height};
    }else run.download={unexecuted:'Candidate has no Download PNG action; do not count as passed.'};
    await page.getByRole('button',{name:'Close comparisons',exact:true}).click();
    await page.setViewportSize({width:1600,height:1000});
    await audience.getByRole('button',{name:'Educator',exact:true}).click();
    // Mode guides are session-scoped; the first Educator visit already dismissed it.
    const dismiss=page.getByRole('button',{name:'Dismiss introduction',exact:true});if(await dismiss.isVisible())await dismiss.click();
    await page.getByRole('button',{name:'Teaching studio',exact:true}).click();
    const studio=page.getByRole('dialog',{name:'Teaching studio',exact:true});
    await studio.getByLabel('Your prediction',{exact:true}).fill('Agent rendering audit: changing array height may change terrain obstruction.');
    await studio.getByRole('button',{name:'Capture current scenario as baseline',exact:true}).click();
    await studio.getByRole('button',{name:'Reveal computed response',exact:true}).click();
    const response=studio.locator('figure').filter({hasText:'Controlled response across tested inputs'});await response.waitFor();
    run.teaching=await response.evaluate(el=>({title:el.querySelector('figcaption').textContent,background:getComputedStyle(el).backgroundColor,svgBackground:getComputedStyle(el.querySelector('svg')).backgroundColor,labels:[...el.querySelectorAll('svg text')].map(t=>({text:t.textContent,fill:getComputedStyle(t).fill})),actions:el.querySelectorAll('.chart-image-actions button').length}));
    if(run.teaching.background!=='rgb(255, 255, 255)'||run.teaching.labels.some(t=>t.fill!=='rgb(28, 25, 21)')||run.teaching.actions!==2)
      run.discrepancies.push('Teaching ResponsePlot lacks expected white/dark paint or image actions.');
    await response.screenshot({path:join(out,`${transport}-teaching-response.png`)});
    await response.getByText('Exact plotted values',{exact:true}).click();assert.ok(await response.locator('table tbody tr').count()>0);
    await studio.getByRole('button',{name:'Close teaching studio',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'Teaching studio',exact:true}).evaluate(el=>el===document.activeElement),true);
    run.checks.push('Actual integrated HorizonGraph and ResponsePlot rendered, exact values table opens and teaching modal returns focus. Image-action/paint failures are recorded separately.');
    if(transport==='file')assert.deepEqual(run.http,[]);
    assert.deepEqual(run.pageErrors,[]);assert.deepEqual(run.consoleErrors,[]);
    await Promise.all(pending);await context.close();
  }
  assert.equal(sha(await readFile(file)),report.fileSha256,'Offline candidate changed during audit');
}finally{await writeFile(join(out,'observations.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
const discrepancies=report.runs.flatMap(r=>r.discrepancies.map(message=>({transport:r.transport,message})));
console.log(JSON.stringify({completedJourneys:report.runs.length,discrepancies},null,2));
if(discrepancies.length)process.exitCode=1;
