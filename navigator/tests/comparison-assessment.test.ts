import {PLANNING_MODEL_VERSION} from "../lib/assessment";
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React, {createElement} from 'react';
// tsx preserves this project's classic JSX transform outside the Next runtime.
Object.assign(globalThis, {React});
import {renderToStaticMarkup} from 'react-dom/server';
import {Comparison} from '../components/workbench/panels';
import {AudienceContext} from '../components/workbench/info';
import {decodeCatalog} from '../lib/catalog';
import {parseEvidenceManifest} from '../lib/provenance';
import {migrateScenario} from '../lib/scenario';
import {DEFAULT_MISSION} from '../lib/mission';
import {DEFAULT_FLIGHT} from '../lib/flight';
const catalog=decodeCatalog(JSON.parse(readFileSync('public/data/catalog.json','utf8')));
const manifest=parseEvidenceManifest(JSON.parse(readFileSync('public/data/evidence-manifest.json','utf8')));
const base=migrateScenario({siteId:catalog.sites.find(s=>s.horizons.length)!.id,custom:null,startIndex:100,endIndex:123,heightM:2,mission:{...DEFAULT_MISSION,loadW:0},flight:DEFAULT_FLIGHT},{siteIds:catalog.sites.map(s=>s.id),samples:catalog.meta.n,stepHours:catalog.meta.stepHours})!;
const noop=()=>{};
test('comparison renders shared assessment, evidence and changed inputs without certifying annotations',()=>{
 const changed=structuredClone(base);changed.mission.loadW=123;changed.arrayHeightM=10;
 const html=renderToStaticMarkup(createElement(AudienceContext.Provider,{value:'plan'},createElement(Comparison,{catalog,manifest,items:[{id:'a',name:'Reference',state:base},{id:'b',name:'Changed',state:changed}],onAdd:noop,onRemove:noop,onOpen:noop})));
 assert.match(html,/Assessment outcome/);assert.match(html,/Required unknowns/);assert.match(html,/Free-input comparison/);assert.match(html,/mission.loadW/);assert.match(html,/arrayHeightM/);assert.match(html,/thermal-survival|thermal survival/);assert.match(html,new RegExp(PLANNING_MODEL_VERSION));assert.match(html,/annotations never change the assessment/);
});
test('explicitly missing evidence preserves rows and reports unassessed values',()=>{
 const html=renderToStaticMarkup(createElement(Comparison,{catalog,manifest:null,items:[{id:'a',name:'Preserved scenario',state:base}],onAdd:noop,onRemove:noop,onOpen:noop}));
 assert.match(html,/Preserved scenario/);assert.match(html,/Prepared evidence is unavailable/);assert.doesNotMatch(html,/passes-assessed/);
});

test('public candidate failures explain consequences and next actions without machine reason codes',()=>{
 const failed=structuredClone(base);failed.mission.loadW=10000;
 const html=renderToStaticMarkup(createElement(Comparison,{catalog,manifest,items:[{id:'bad',name:'Power-limited plan',state:failed}],onAdd:noop,onRemove:noop,onOpen:noop}));
 assert.match(html,/What stops this plan/);assert.match(html,/not enough power/);assert.match(html,/Why it matters/);assert.match(html,/Try next/);assert.match(html,/another date can change/);
 assert.doesNotMatch(html,/modeled-requirement-violation|external-evidence-missing|Source frame equivalence/);
});
