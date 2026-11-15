/** Integrator-only real-page checks. Import into an existing isolated Playwright run;
 * this module never starts a server/browser or rebuilds an artifact. */
import assert from 'node:assert/strict';

export async function verifyHeaderWorkspace(page, evidence = async () => {}) {
  const header = page.locator('.app-header');
  const intro = page.getByRole('button', {name: 'Dismiss introduction', exact: true});
  if (await intro.isVisible()) await intro.click();
  await header.getByRole('button', {name:'Public',exact:true}).click();
  await intro.click();
  const report = {pointerChecks: [], topics: [], limits: ['Viewport reflow is not a native 200% browser zoom check.']};
  const bodyFits = () => page.evaluate(() => ({
    viewport: innerWidth, body: document.body.scrollWidth, root: document.documentElement.scrollWidth,
  }));
  const pointerCheck = async locator => {
    await locator.scrollIntoViewIfNeeded();
    const hit = await locator.evaluate(element => {
      const r = element.getBoundingClientRect();
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return {unobstructed: top === element || element.contains(top), target: top?.className,
        rect: {x:r.x,y:r.y,width:r.width,height:r.height}};
    });
    assert.ok(hit.unobstructed, `Pointer target intercepted: ${JSON.stringify(hit)}`);
    await locator.click({timeout: 5000}); // Deliberately never force a click.
    return hit;
  };
  await header.getByRole('button', {name: '2D map', exact:true}).click();
  const sites = header.getByRole('button', {name: 'Show site drawer', exact:true});
  if (await sites.isVisible()) await sites.click();
  const inspector = header.getByRole('button', {name: 'Show inspector', exact:true});
  if (await inspector.isVisible()) await inspector.click();
  for (const width of [800,900,1280,1728]) {
    await page.setViewportSize({width,height:1000});
    const region = header.getByRole('combobox', {name:'Map region',exact:true});
    const hit = await pointerCheck(region);
    await page.keyboard.press('Escape');
    const overflow = await bodyFits();
    assert.ok(overflow.body <= overflow.viewport + 1 && overflow.root <= overflow.viewport + 1, JSON.stringify(overflow));
    report.pointerChecks.push({width,hit,overflow});
    await evidence(`header-${width}`);
  }
  await page.getByRole('button', {name:'Show full map',exact:true}).click();
  assert.equal(await page.getByRole('button').count(),1,'Full map action left controls visible');
  await page.getByRole('button', {name:'Show controls',exact:true}).click();
  const focus = header.getByRole('group', {name:'3D asset focus',exact:true});
  await focus.getByRole('button', {name:'Lander',exact:true}).click();
  const scene = page.locator('.scene-host');
  await page.waitForFunction(() => !!document.querySelector('.scene-host')?.dataset.sceneInstance);
  const instance = await scene.getAttribute('data-scene-instance');
  const serial = Number(await scene.getAttribute('data-focus-request-id'));
  await focus.getByRole('button', {name:'Lander',exact:true}).click();
  assert.ok(Number(await scene.getAttribute('data-focus-request-id')) > serial, 'Repeated Lander request must increment focus serial');
  assert.equal(await scene.getAttribute('data-scene-instance'),instance,'Focus request remounted WebGL');
  await header.getByRole('button', {name:'Hide inspector',exact:true}).click();
  assert.equal(await page.locator('.sq-flight').count(),1,'Closing Inspector hid the lander');
  await header.getByRole('button', {name:'Learn',exact:true}).click();
  const learn = page.getByRole('dialog', {name:'Learn the models',exact:true});
  const topics = learn.getByRole('navigation', {name:'Learning topics'}).getByRole('button');
  for (const topic of await topics.all()) {
    const title = await topic.innerText();
    await topic.click();
    assert.equal(await learn.getByRole('heading', {level:3}).innerText(),title);
    const relations = learn.locator('.learn-lesson>details');
    if (await relations.getAttribute('open') === null) await relations.locator(':scope>summary').click();
    const firstLesson = learn.getByText('Understand this relation: symbols, assumptions and behavior', {exact:true}).first();
    await firstLesson.click();
    assert.ok(await learn.locator('math').count()>0,'No native MathML');
    assert.equal(await scene.getAttribute('data-scene-instance'),instance,'Learn remounted WebGL');
    report.topics.push(title);
  }
  for (const width of [400,800,900,1280,1728]) {
    await page.setViewportSize({width,height:1000});
    const overflow = await bodyFits();
    const content = await learn.evaluate(element => ({client:element.clientWidth,scroll:element.scrollWidth}));
    assert.ok(overflow.root<=width+1 && overflow.body<=width+1, JSON.stringify(overflow));
    assert.ok(content.scroll<=content.client+1,JSON.stringify(content));
    await evidence(`learn-${width}`);
  }
  await page.keyboard.press('Escape');
  assert.equal(await learn.count(),0,'Escape did not dismiss Learn');
  await focus.getByRole('button', {name:'Earth',exact:true}).click();
  const stations = header.getByRole('group', {name:'DSN ground complexes',exact:true});
  for (const name of ['Goldstone','Madrid','Canberra']) {
    const station = stations.getByRole('button', {name,exact:true});
    await pointerCheck(station);
    assert.equal(await station.getAttribute('aria-pressed'),'true');
  }
  await header.locator('.header-station-details>summary').click();
  assert.ok(await header.getByRole('heading', {name:'Weather at Canberra',exact:true}).isVisible());
  const coordinates = header.getByText('Coordinates & source', {exact:true});
  assert.equal(await coordinates.locator('..').getAttribute('open'),null,'Public coordinates should start collapsed');
  await page.keyboard.press('Escape');
  assert.equal(await scene.getAttribute('data-scene-instance'),instance,'DSN control remounted WebGL');
  await header.getByRole('button', {name:'Hide panels for unobstructed view',exact:true}).click();
  assert.equal(await header.isVisible(),false);
  assert.equal(await page.getByRole('button').count(),1,'Hide panels left controls visible');
  assert.equal(await page.getByRole('button', {name:'Show controls',exact:true}).isVisible(),true);
  assert.equal(await scene.getAttribute('data-scene-instance'),instance,'Hide panels remounted WebGL');
  await page.getByRole('button', {name:'Show controls',exact:true}).click();
  report.sceneInstance=instance;
  return report;
}
