import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodeCatalog,type Catalog} from '../lib/catalog';
import {DEFAULT_FLIGHT} from '../lib/flight';
import {DEFAULT_MISSION} from '../lib/mission';
import {DEFAULT_OPERATIONS,DEFAULT_REQUIREMENTS} from '../lib/planning-types';
import {parseEvidenceManifest} from '../lib/provenance';
import {evaluateScenario} from '../lib/assessment';
import type {ScenarioState} from '../lib/scenario';
import {searchMissionWindows,planningSearchKey,compareMissionSearchRows,type SearchRequest} from '../lib/planning-search';
const actual=decodeCatalog(JSON.parse(readFileSync('public/data/catalog.json','utf8')));
function fixture(n=80) {
 const a=(v:number)=>new Float64Array(n).fill(v);
 const c:Catalog={...actual,meta:{...actual.meta,n,stepHours:1},t0ms:Date.parse('2026-01-01T00:00:00Z'),
  subsolarLat:a(0),subsolarLon:a(0),subearthLat:a(0),subearthLon:a(0),earthRangeKm:a(384400),sunRadiusDeg:a(.27),
  sites:[{...actual.sites[0],id:'ridge',lat:-85,lon:0,horizons:[{heightM:2,stepDeg:1,mask:new Float64Array(360)}]}]};
 const manifest=parseEvidenceManifest(JSON.parse(readFileSync('public/data/evidence-manifest.json','utf8')));
 manifest.datasetId='synthetic-search';manifest.validFromUtc=new Date(c.t0ms).toISOString();manifest.validUntilUtcExclusive=new Date(c.t0ms+(n-1)*3600000).toISOString();
 manifest.entries=manifest.entries.map(e=>({...e,coverage:e.coverage==='unavailable'?'unavailable':'complete'}));
 const base:ScenarioState={schemaVersion:2,siteId:'ridge',custom:null,startIndex:0,endIndex:1,heightM:2,arrayHeightM:2,antennaHeightM:2,
  mission:{...DEFAULT_MISSION,areaM2:1,efficiency:1,lossFraction:0,solarFlux:1000,loadW:100,batteryWh:300,initialSoc:1,reserveSoc:.2,chargeEfficiency:1,dischargeEfficiency:1},
  flight:{...DEFAULT_FLIGHT},requirements:structuredClone(DEFAULT_REQUIREMENTS),operations:structuredClone(DEFAULT_OPERATIONS)};
 const request:SearchRequest={base,siteIds:['ridge'],firstStartIndex:0,lastStartIndex:30,durationSamples:2,startStepSamples:1,maxResults:100};
 return {c,manifest,request};
}
test('every retained row exactly reproduces full assessment, original SOC resets, 31 starts retained',async()=>{
 const {c,manifest,request}=fixture();const result=await searchMissionWindows(c,manifest,request);
 assert.equal(result.rows.length,31);assert.equal(result.counts.passed,31);assert.equal(result.truncated,false);
 for(const row of result.rows){assert.deepEqual(row.assessment,evaluateScenario(c,row.state,manifest));assert.equal(row.state.mission.initialSoc,1);}
 result.rows[0].state.operations.loadSegments.push({id:'later',startOffsetHours:0,endOffsetHours:1,additionalW:1});
 assert.equal(request.base.operations.loadSegments.length,0);assert.equal(result.rows[1].state.operations.loadSegments.length,0);
});
test('a high sunlight fraction can fail storage while lower sunlight with timely recharge passes',async()=>{
 const {c,manifest,request}=fixture(20);
 request.durationSamples=4;request.lastStartIndex=4;request.startStepSamples=4;request.base.mission.batteryWh=150;request.base.mission.initialSoc=.8;
 // First stay has 3 bright intervals but starts dark and crosses reserve; second
 // stay has only two bright intervals alternating with darkness and stays above it.
 c.subsolarLon.set([180,0,0,0,0,180,0,180]);
 const result=await searchMissionWindows(c,manifest,request);
 assert.equal(result.rows[0].state.startIndex,4);assert.equal(result.rows[0].assessment.outcome,'passes-assessed');
 assert.equal(result.rows[1].state.startIndex,0);assert.equal(result.rows[1].assessment.outcome,'fails-assessed');
});
test('missing horizon stays incomplete, partial evidence conditional, outcomes counted without false passes',async()=>{
 const {c,manifest,request}=fixture();request.lastStartIndex=0;c.sites[0].horizons=[];
 let r=await searchMissionWindows(c,manifest,request);assert.equal(r.counts.incomplete,1);assert.equal(r.rows[0].assessment.outcome,'incomplete');
 c.sites[0].horizons=[{heightM:2,stepDeg:1,mask:new Float64Array(360)}];
 manifest.entries.find(e=>e.id==='horizon-catalog')!.coverage='partial';
 r=await searchMissionWindows(c,manifest,request);assert.equal(r.counts.conditional,1);assert.equal(r.counts.passed,0);
});
test('full duration outside final endpoint or evidence coverage is counted and never shortened',async()=>{
 const {c,manifest,request}=fixture(10);request.firstStartIndex=7;request.lastStartIndex=9;
 const r=await searchMissionWindows(c,manifest,request);assert.equal(r.counts.evaluated,1);assert.equal(r.counts.outside,2);assert.equal(r.rows[0].state.endIndex,8);
 manifest.validUntilUtcExclusive=new Date(c.t0ms+8*3600000).toISOString();
 assert.equal((await searchMissionWindows(c,manifest,request)).counts.outside,3);
});
test('request identity includes every search field, complete base and evidence version',()=>{
 const {c,manifest,request}=fixture();const key=planningSearchKey(c,manifest,request);
 for(const field of ['firstStartIndex','lastStartIndex','durationSamples','startStepSamples','maxResults'] as const) assert.notEqual(key,planningSearchKey(c,manifest,{...request,[field]:request[field]+1}));
 assert.notEqual(key,planningSearchKey(c,manifest,{...request,siteIds:['other']}));
 for(const field of ['loadW','batteryWh','antennaMaskDeg'] as const){const r=structuredClone(request);r.base.mission[field]++;assert.notEqual(key,planningSearchKey(c,manifest,r));}
 assert.notEqual(key,planningSearchKey(c,{...manifest,datasetId:'different'},request));
 const a={...request,siteIds:['b','a']},b={...request,siteIds:['a','b']};assert.equal(planningSearchKey(c,manifest,a),planningSearchKey(c,manifest,b));
});
test('cancellation and stale input keys reject without publishing final rows',async()=>{
 const {c,manifest,request}=fixture(1100);request.lastStartIndex=999;request.durationSamples=1;
 const controller=new AbortController();controller.abort();await assert.rejects(searchMissionWindows(c,manifest,request,{signal:controller.signal}),{name:'AbortError'});
 let current=true;await assert.rejects(searchMissionWindows(c,manifest,request,{isCurrent:()=>current,onProgress:p=>{if(p.completed>0)current=false;}}),{name:'AbortError'});
 const midway=new AbortController();setTimeout(()=>midway.abort(),0);
 await assert.rejects(searchMissionWindows(c,manifest,request,{signal:midway.signal}),{name:'AbortError'});
});
test('1000-start fixture yields to timers, caps results and counts every outcome',async()=>{
 const {c,manifest,request}=fixture(1100);request.lastStartIndex=999;request.durationSamples=1;request.maxResults=10;
 let timerRan=false;setTimeout(()=>{timerRan=true;},0);const progress:number[]=[];
 const r=await searchMissionWindows(c,manifest,request,{onProgress:p=>progress.push(p.completed)});
 assert.ok(timerRan);assert.equal(r.counts.evaluated,1000);assert.equal(r.rows.length,10);assert.ok(r.truncated);assert.equal(progress.at(-1),1000);assert.ok(progress.length>2);
 assert.deepEqual(r.rows.map(row=>row.state.startIndex),[0,1,2,3,4,5,6,7,8,9]);
});
test('oversized searches, malformed requests, duplicate/unknown sites and impossible schedules reject clearly',async()=>{
 const {c,manifest,request}=fixture(12000);
 for(const patch of [{lastStartIndex:10000},{siteIds:[]},{siteIds:['ridge','ridge']},{siteIds:['unknown']},{maxResults:101},{durationSamples:0},{startStepSamples:0},{firstStartIndex:-1}]) await assert.rejects(searchMissionWindows(c,manifest,{...request,...patch}),RangeError);
 request.base.operations.loadSegments=[{id:'too-long',startOffsetHours:0,endOffsetHours:10,additionalW:0}];
 await assert.rejects(searchMissionWindows(c,manifest,request),/duration/);
});
test('antenna mask changes contact requirement outcome without changing solar power',async()=>{
 const {c,manifest,request}=fixture();request.lastStartIndex=0;request.base.requirements.maxGeometricOutageHours=0;
 const a=await searchMissionWindows(c,manifest,request);request.base.mission.antennaMaskDeg=10;
 const b=await searchMissionWindows(c,manifest,request);assert.equal(a.rows[0].assessment.outcome,'passes-assessed');assert.equal(b.rows[0].assessment.outcome,'fails-assessed');
 assert.equal(a.rows[0].assessment.mission.generatedWh,b.rows[0].assessment.mission.generatedWh);
});
test('sort policy has deterministic outcome, reserve, outage, date and site ties',async()=>{
 const {c,manifest,request}=fixture();request.lastStartIndex=0;const row=(await searchMissionWindows(c,manifest,request)).rows[0];
 const states=['not-configured','fails-assessed','incomplete','conditional','passes-assessed'] as const;
 const rows=states.map(outcome=>({...structuredClone(row),assessment:{...structuredClone(row.assessment),outcome}}));
 assert.deepEqual(rows.sort(compareMissionSearchRows).map(r=>r.assessment.outcome),[...states].reverse());
});
