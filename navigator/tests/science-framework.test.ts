import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import React from 'react';
Object.assign(globalThis,{React});
import {renderToStaticMarkup} from 'react-dom/server';
import {ScienceFramework} from '../components/science-framework';
import {ScienceEquation} from '../components/science-framework/equations';
import {SCIENCE_NODES,SCIENCE_PIPELINES,SCIENCE_SOURCES,scienceSourceUrl,type ScienceFrameworkContext,type ScienceFinding} from '../lib/science-framework';
const render=(mode:'public'|'teach'|'plan'='public',context?:ScienceFrameworkContext,findings?:readonly ScienceFinding[])=>renderToStaticMarkup(React.createElement(ScienceFramework,{mode,context,findings}));
test('dependency graph covers every pipeline node, has no dangling dependencies or cycles, and reaches source inputs',()=>{
 const ids=new Set(SCIENCE_NODES.map(n=>n.id));assert.equal(ids.size,23);
 assert.deepEqual(new Set(SCIENCE_PIPELINES.flatMap(p=>[...p.nodes])),ids);
 const visit=(id:string,path:string[]=[])=>{
  assert.ok(!path.includes(id),`Cycle: ${[...path,id]}`);
  const node=SCIENCE_NODES.find(n=>n.id===id);assert.ok(node,`Missing ${id}`);
  node.dependsOn.forEach(parent=>visit(parent,[...path,id]));
 };
 for(const node of SCIENCE_NODES){visit(node.id);assert.ok(node.sources.length);for(const source of node.sources)assert.ok(SCIENCE_SOURCES[source]);for(const field of ['symbols','units','implementation','output','intuition','verification','limits'] as const)assert.ok(node[field].length>0,`${node.id}.${field}`);}
 assert.deepEqual(SCIENCE_NODES.find(n=>n.id==='energy')!.dependsOn,['power','epoch']);
 assert.ok(SCIENCE_NODES.find(n=>n.id==='contact')!.dependsOn.includes('height'));
});
test('all equations render real readable native MathML with authored fractions and subscripts',()=>{
 for(const node of SCIENCE_NODES){const html=renderToStaticMarkup(React.createElement(ScienceEquation,{id:node.id}));assert.match(html,/<math[^>]+xmlns="http:\/\/www.w3.org\/1998\/Math\/MathML"/);assert.match(html,/aria-label="[^"]{20,}"/);assert.match(html,/<m(?:row|table)>/);assert.doesNotMatch(html,/\\frac|\\phi|_[{a-z]|undefined|NaN/);}
 const html=render('teach');assert.equal((html.match(/<math [^>]*display="block"/g)??[]).length,23);assert.match(html,/<mfrac>/);assert.match(html,/<msub>/);assert.match(html,/<mi>φ<\/mi>/);assert.match(html,/<mi>λ<\/mi>/);
});
test('SSR public, educator and planner guidance differ without changing engine authority',()=>{
 const publicHtml=render(),teachHtml=render('teach'),planHtml=render('plan');
 assert.match(publicHtml,/Why the same site can give different answers/);assert.match(teachHtml,/Predict the direction of change/);assert.match(planHtml,/Bind every result/);
 assert.match(teachHtml,/Experiment: hold date/);assert.match(planHtml,/independent frame\/terrain validation/);
 for(const html of [publicHtml,teachHtml,planHtml]){assert.match(html,/evaluateScenario/);assert.match(html,/terrain and smooth-sphere/i);assert.match(html,/No operational qualification is asserted/);assert.match(html,/Hide framework/);}
 assert.ok((teachHtml.match(/sf-variable[^>]+open=""/g)??[]).length===23);
 assert.ok(!(publicHtml.match(/sf-variable[^>]+open=""/g)??[]).length);
});
test('context displays all actual caller values and distinct subsystem heights',()=>{
 const context={lat:-82.12345,lon:278.98765,observerHeightM:0,arrayHeightM:2,antennaHeightM:10,terrainMode:'caller-coarse',terrainLabel:'Actual terrain label',epochUtc:'2027-02-18T13:00:00Z',datasetId:'caller-dataset-identity',modelVersion:'caller-model-version'};
 const html=render('plan',context);
 for(const value of Object.values(context))assert.ok(html.includes(String(value)),String(value));
 assert.match(html,/Display observer<\/dt><dd>0 m/);assert.match(html,/Solar array<\/dt><dd>2 m/);assert.match(html,/Antenna<\/dt><dd>10 m/);
 const unavailable=render('public',{...context,lat:NaN,arrayHeightM:Infinity});assert.doesNotMatch(unavailable,/NaN|Infinity/);assert.match(unavailable,/Unavailable/);
});
test('missing or empty audit input stays pending; supplied findings retain exact status, scope, limits and sources',()=>{
 for(const findings of [undefined,[]]){const html=render('plan',undefined,findings);assert.match(html,/Audit pending/);assert.match(html,/no scientific check is marked passing/);assert.doesNotMatch(html,/Verified within stated scope/);assert.match(html,/Current context unavailable/);}
 const findings:ScienceFinding[]=[{id:'range-recheck',claim:'Updated range audit',status:'uncertain',scope:'Only declared epochs',limitations:'No source-to-input alignment proof',sourceUrls:['https://ssd.jpl.nasa.gov/horizons/manual.html']},{id:'separate-check',claim:'Scoped arithmetic check',status:'verified',scope:'Synthetic units only',limitations:'No lunar observation',sourceUrls:[]},{id:'broken-case',claim:'Declared failing case',status:'failing',scope:'Bounded case',limitations:'Repair pending',sourceUrls:['javascript:alert(1)']}];
 const html=render('plan',undefined,findings);for(const f of findings)for(const value of [f.id,f.claim,f.scope,f.limitations])assert.ok(html.includes(value));assert.match(html,/Uncertain/);assert.match(html,/Failing/);assert.match(html,/Verified within stated scope/);assert.doesNotMatch(html,/href="javascript:/);assert.match(html,/No overall scientific pass is calculated here/);
});
test('pipeline anchors resolve within each instance and sources reject executable or credential URLs',()=>{
 const html=render('teach');const targets=new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(x=>x[1]));for(const match of html.matchAll(/href="#([^"]+)"/g))assert.ok(targets.has(match[1]),match[1]);
 assert.equal(scienceSourceUrl('data:text/html,hello'),null);assert.equal(scienceSourceUrl('https://user:secret@example.com'),null);assert.equal(scienceSourceUrl('https://ssd.jpl.nasa.gov/horizons/'),'https://ssd.jpl.nasa.gov/horizons/');
});
test('framework remains explanatory and self-contained with native disclosure, scoped styles and no data engine imports',()=>{
 const source=readFileSync(new URL('../components/science-framework/index.tsx',import.meta.url),'utf8');
 assert.match(source,/useState\(false\)/);assert.match(source,/setDismissed\(true\)/);assert.match(source,/Show science framework/);assert.match(source,/<details/);
 assert.doesNotMatch(source,/fetch\(|localStorage|sessionStorage|from ['"].*(?:astro|mission|assessment|catalog)['"]/);
 for(const node of SCIENCE_NODES)for(const match of node.implementation.matchAll(/(?:lib|pipeline|scripts|components)\/[\w/.-]+\.(?:ts|tsx|py)/g))assert.ok(existsSync(match[0]),match[0]);
 const policy=render('plan');for(const term of ['384','640','4264','1895.21','AIRLESS','TDB','DE421','24 tiles','2 px','sourcePixelM','collision','historical'])assert.ok(policy.toLowerCase().includes(term.toLowerCase()),term);
});
