import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { chromium, type Page } from 'playwright-core';
import ts from 'typescript';
import { catalog, manifest, scenario } from './fixtures';
import { evaluateScenario } from '../../lib/assessment';
import { scenarioStay } from '../../lib/engineering-evidence/workspace';

test('navigator mounts the lazy Data & math wrapper only in sources with the selected state and manifest', () => {
  const source = readFileSync('components/navigator.tsx', 'utf8');
  const ast = ts.createSourceFile('navigator.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports = ast.statements.filter(ts.isImportDeclaration).map(node => (node.moduleSpecifier as ts.StringLiteral).text);
  for (const eager of ['data-math-panel', 'data-connections', 'science-framework', 'scientific-verification'])
    assert.ok(!imports.some(path => path.includes(eager)), `eager import of ${eager}`);
  const variable = (name: string) => ast.statements.filter(ts.isVariableStatement).flatMap(s => [...s.declarationList.declarations]).find(v => v.name.getText(ast) === name)!;
  for (const name of ['DataMathPanel', 'DataConnections']) {
    const initializer = variable(name).initializer!;
    assert.ok(ts.isCallExpression(initializer));
    assert.equal(initializer.expression.getText(ast), 'dynamic');
    assert.match(initializer.arguments[0].getText(ast), /import\(/);
  }
  const panels: ts.JsxSelfClosingElement[] = [];
  const visit = (node: ts.Node) => { if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === 'DataMathPanel') panels.push(node); ts.forEachChild(node, visit); };
  visit(ast);
  assert.equal(panels.length, 1);
  const panel = panels[0];
  assert.match(panel.parent.parent.getText(ast), /panel === "sources"/);
  const attrs = panel.attributes.properties.filter(ts.isJsxAttribute);
  for (const [name, value] of Object.entries({ catalog: 'catalog', state: 'state', manifest: 'evidenceManifest', mode: 'mode' }))
    assert.equal(attrs.find(a => a.name.getText(ast) === name)!.initializer!.getText(ast), `{${value}}`);
  assert.match(attrs.find(a => a.name.getText(ast) === 'missionEndUtcExclusive')!.getText(ast), /state.endIndex\+1/);
});

async function downloadedJson(page: Page, name: string) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name, exact: true }).click();
  const download = await pending;
  return JSON.parse(readFileSync((await download.path())!, 'utf8'));
}

test('real Data & math and planner controls bind audiences, archive chronology, finite exports and changed scenarios offline', { timeout: 90000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lunario-evidence-wiring-'));
  const selected = scenario();
  selected.operations.loadSegments = [{ id: 'Held Δ schedule', startOffsetHours: 0.5, endOffsetHours: 2, additionalW: 75 }];
  selected.operations.maxChargeW = 0;
  selected.radio = { frequencyGHz: 8.4, txPowerW: 100 };
  const assessment = evaluateScenario(catalog, selected, manifest), stay = scenarioStay(catalog, selected);
  const fixture = JSON.parse(readFileSync('public/data/engineering-evidence/goldstone-horizons.json', 'utf8'));
  const entry = `import React from 'react';import {createRoot} from 'react-dom/client';
import {DataMathPanel} from './components/workbench/data-math-panel';
import {EngineeringEvidenceWorkspace} from './components/engineering/evidence-workspace';
import {decodeCatalog} from './lib/catalog';import {evaluateScenario} from './lib/assessment';import {scenarioStay} from './lib/engineering-evidence/workspace';
const c=decodeCatalog(window.input.catalog),m=window.input.manifest;let s=window.input.state,kind='data',mode='public';
const root=createRoot(document.getElementById('root'));
window.show=(nextKind,nextMode)=>{kind=nextKind;mode=nextMode;render();};window.change=(next)=>{s=next;render();};
function render(){const stay=scenarioStay(c,s);root.render(kind==='data'?<DataMathPanel catalog={c} state={s} manifest={m} mode={mode} offline={true} missionStartUtc={stay.startUtc} missionEndUtcExclusive={stay.endUtc} context={{lat:-89,lon:0,observerHeightM:s.heightM,arrayHeightM:s.arrayHeightM,antennaHeightM:s.antennaHeightM,terrainMode:s.terrainMode??'prepared',terrainLabel:'Prepared horizon',epochUtc:stay.startUtc,datasetId:m.datasetId,modelVersion:evaluateScenario(c,s,m).modelVersion}}/>:<EngineeringEvidenceWorkspace catalog={c} manifest={m} state={s} assessment={evaluateScenario(c,s,m)} onInspect={()=>{}} onClose={()=>window.show('data','public')}/>);}render();`;
  const output = await build({ stdin: { contents: entry, loader: 'tsx', resolveDir: process.cwd() }, outfile: join(dir, 'fixture.js'), bundle: true, write: false, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' } });
  for (const file of output.outputFiles!) writeFileSync(file.path, file.contents);
  const input = { catalog: JSON.parse(readFileSync('public/data/catalog.json', 'utf8')), manifest, state: selected };
  writeFileSync(join(dir, 'fixture.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="stylesheet" href="fixture.css"><style>${readFileSync('app/mission-theme.css', 'utf8')}body{margin:0;padding:16px;font-family:Arial,sans-serif}#root{max-width:900px;margin:auto}*{box-sizing:border-box}button,input,select{font:inherit;max-width:100%}button{padding:8px}p{overflow-wrap:anywhere}section{min-width:0}</style></head><body><main id="root"></main><script>window.input=${JSON.stringify(input).replace(/</g, '\\u003c')};</script><script src="fixture.js"></script></body></html>`);
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? process.env.CHROME_PATH ?? (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome'), headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage({ viewport: { width: 720, height: 1000 } });
    await page.clock.setFixedTime(new Date('2026-11-16T00:00:00Z'));
    const errors: string[] = [], requests: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/^https?:/, route => { requests.push(route.request().url()); return route.abort(); });
    await page.goto(pathToFileURL(join(dir, 'fixture.html')).href);
    const evidence = page.getByRole('region', { name: 'Evidence for this scenario' });
    await evidence.waitFor();
    await evidence.getByText('Sampling and source details', { exact: true }).waitFor();
    await page.getByRole('heading', { name: 'How Lunario reaches an answer' }).waitFor();
    for (const mode of ['teach', 'plan', 'public']) {
      await page.evaluate(mode => (window as unknown as { show: (kind: string, mode: string) => void }).show('data', mode), mode);
      if (mode === 'teach') await evidence.getByText('Compare what the model calculates', { exact: false }).waitFor();
      if (mode === 'public') await evidence.getByText('Sampling and source details', { exact: true }).waitFor();
      else assert.equal(await evidence.getByText('Sampling and source details', { exact: true }).count(), 0);
      const exported = await downloadedJson(page, 'Export evidence summary');
      assert.equal(exported.scenarioKey, assessment.scenarioKey);
      assert.deepEqual(exported.heldScenario, selected);
      assert.equal(exported.selection.endUtcExclusive, stay.endUtc);
    }
    await page.evaluate(() => (window as unknown as { show: (kind: string, mode: string) => void }).show('engineering', 'plan'));
    await page.getByRole('heading', { name: 'Station contact & finite stability' }).waitFor();
    const station = page.locator('details').filter({ has: page.locator('summary', { hasText: /^Station evidence ·/ }) }).first();
    assert.equal(await station.getAttribute('open'), null);
    const upload = page.getByLabel('Import evidence, observer JSON or bounds');
    const selectFile = async (value: unknown) => upload.setInputFiles({ name: 'observer.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
    await selectFile(fixture);
    await page.getByRole('alert').filter({ hasText: 'Enter the original retrieval UTC' }).waitFor();
    await page.getByLabel('Original observer retrieval UTC', { exact: false }).fill('2026-11-14T00:00:00Z');
    await selectFile(fixture);
    await page.getByText('Original observer JSON metadata', { exact: true }).click();
    await page.getByText('API signature:', { exact: false }).filter({ hasText: 'NASA/JPL Horizons API' }).waitFor();
    const archived = await downloadedJson(page, 'Export original observer JSON');
    assert.deepEqual(archived.response, fixture.response);
    assert.equal(archived.fetchedUtc, '2026-11-14T00:00:00Z');
    await station.locator('summary').first().click();
    await station.getByText(/age 48\.0 h/).waitFor();
    await station.getByText(`Stay [start, end): ${stay.startUtc} to ${stay.endUtc}. Only evaluateScenario supplies the overall mission assessment.`, { exact: true }).waitFor();
    await page.getByLabel('Original observer retrieval UTC', { exact: false }).fill('2026-11-16T00:00:00Z');
    await selectFile({ ...fixture, fetchedUtc: '2026-11-13T00:00:00Z' });
    await station.getByText(/age 72\.0 h/).waitFor();
    assert.equal((await downloadedJson(page, 'Export evidence')).geometry.fetchedUtc, '2026-11-13T00:00:00Z');
    await selectFile({ result: fixture.response.result, fetchedUtc: '2026-11-14T00:00:00Z', request: fixture.request });
    await page.getByText('Unknown — not supplied in raw response', { exact: false }).waitFor();
    assert.equal((await downloadedJson(page, 'Export original observer JSON')).response.signature, undefined);
    await page.getByLabel('Evidence title', { exact: true }).fill('Synthetic load bounds');
    await page.getByLabel('Author', { exact: true }).fill('Regression fixture');
    await page.getByLabel('Scope and assumption rationale', { exact: true }).fill('Finite test only; no physical uncertainty calibration');
    await page.getByLabel('Declared lower', { exact: true }).fill(String(selected.mission.loadW / 2));
    await page.getByLabel('Declared upper', { exact: true }).fill(String(selected.mission.loadW * 2));
    await page.getByRole('button', { name: 'Add / replace bound with provenance' }).click();
    assert.equal((await downloadedJson(page, 'Export evidence summary')).finite.status, 'declared');
    await page.getByRole('button', { name: 'Run finite cases', exact: true }).click();
    await evidence.getByText(/3 recomputed cases:/).waitFor();
    const finite = await downloadedJson(page, 'Export evidence summary');
    assert.equal(finite.finite.status, 'current');
    assert.equal(finite.finite.result.cases.length, 3);
    const caseExport = await downloadedJson(page, 'Export cases & held scenario');
    assert.deepEqual(caseExport.heldScenario, selected);
    assert.deepEqual(caseExport.finite.result, finite.finite.result);
    assert.equal(caseExport.datasetId, manifest.datasetId);
    assert.deepEqual(finite.heldScenario, selected);
    assert.equal(evaluateScenario(catalog, finite.heldScenario, manifest).scenarioKey, finite.scenarioKey);
    const changed = { ...selected, arrayHeightM: 10 };
    await page.evaluate(value => (window as unknown as { change: (s: unknown) => void }).change(value), changed);
    await page.getByText('Stale evidence:', { exact: false }).waitFor();
    await evidence.getByText('Finite evidence stale.', { exact: false }).waitFor();
    const stale = await downloadedJson(page, 'Export evidence summary');
    assert.deepEqual(stale.heldScenario, changed);
    assert.equal(stale.scenarioKey, evaluateScenario(catalog, changed, manifest).scenarioKey);
    assert.equal(stale.finite.status, 'stale');
    assert.equal(stale.finite.result, null);
    assert.equal(await page.getByRole('button', { name: 'Export cases & held scenario' }).isDisabled(), true);
    await page.screenshot({ path: join(dir, 'planner-wiring.png'), fullPage: true });
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, []);
    console.log(`Isolated planner wiring screenshot: ${join(dir, 'planner-wiring.png')}`);
  } finally {
    await browser.close();
    // Keep only the review screenshot in /tmp; never write app artifacts or audit receipts.
    for (const name of ['fixture.js', 'fixture.css', 'fixture.html']) rmSync(join(dir, name), { force: true });
  }
});
