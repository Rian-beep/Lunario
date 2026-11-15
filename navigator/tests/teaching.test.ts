import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {decodeCatalog} from '../lib/catalog';import {parseEvidenceManifest} from '../lib/provenance';import {parseScenario} from '../lib/scenario';import {DEFAULT_MISSION,evaluateMission} from '../lib/mission';import {DEFAULT_FLIGHT} from '../lib/flight';import {evaluateScenario} from '../lib/assessment';import {diffScenarios} from '../lib/scenario-diff';
import {EXPERIMENTS,captureTeachingBaseline,teachingCandidate,recordTeachingExperiment,syntheticOutageLesson,teachingExplanation,appendTeachingRecord,serializeTeachingRecords,parseTeachingRecords,teachingWorksheetHtml} from '../lib/teaching';
const c=decodeCatalog(JSON.parse(readFileSync('public/data/catalog.json','utf8'))),m=parseEvidenceManifest(JSON.parse(readFileSync('public/data/evidence-manifest.json','utf8')));
const base=parseScenario({siteId:c.sites[0].id,custom:null,startIndex:100,endIndex:110,heightM:2,mission:DEFAULT_MISSION,flight:DEFAULT_FLIGHT},{siteIds:c.sites.map(s=>s.id),samples:c.meta.n})!;
test('only named controlled variables change; baseline immutable and height channels independent',()=>{
 const before=structuredClone(base);for(const e of EXPERIMENTS){const value=e.id==='orientation'?'fixed':e.id==='link'?25:e.id.includes('height')?10:500;const next=teachingCandidate(base,e.id,value);assert.deepEqual(diffScenarios(base,next).map(d=>d.path),[e.path]);}
 const a=teachingCandidate(base,'array-height',10),b=teachingCandidate(base,'antenna-height',10);assert.equal(a.antennaHeightM,2);assert.equal(b.arrayHeightM,2);assert.deepEqual(base,before);
});
test('record matches authority metrics, captures prediction/diff/source and rejects stale or uncontrolled candidate',()=>{
 const captured=captureTeachingBaseline(c,m,base),next=teachingCandidate(base,'storage',20000),record=recordTeachingExperiment(c,m,captured,'storage',next,'More reserve','Check recharge');
 assert.equal(record.candidateKey,evaluateScenario(c,next,m).scenarioKey);assert.equal(record.after.unmetWh,evaluateScenario(c,next,m).mission.unmetWh);assert.deepEqual(record.changedPaths,['mission.batteryWh']);assert.equal(record.prediction,'More reserve');
 assert.throws(()=>recordTeachingExperiment(c,m,captured,'storage',{...next,antennaHeightM:10},'x',''),/allowed/);assert.throws(()=>recordTeachingExperiment(c,{...m,entries:[]},captured,'storage',next,'x',''),/stale/);assert.throws(()=>recordTeachingExperiment(c,m,captured,'storage',next,'',''),/prediction/);
});
test('synthetic ordering lesson is actual energy evaluation, not lunar measurement',()=>{
 const s=syntheticOutageLesson();assert.match(s.label,/Synthetic.*not NASA/);assert.equal(s.assumptions.batteryWh/s.assumptions.loadW,10);
 for(const item of s.cases){assert.deepEqual(item.result,evaluateMission(item.series,1,s.assumptions));assert.equal([...item.series.sunEl].filter(v=>v<0).length,24);assert.equal(item.result.generatedWh,4800);}
 assert.equal(s.cases[0].result.unmetWh,1400);assert.equal(s.cases[1].result.unmetWh,0);assert.equal(s.cases[1].result.minBatteryWh,400);
});
test('saved evidence survives control reset outside engine and bounded persistence; worksheet escapes prose',()=>{
 const captured=captureTeachingBaseline(c,m,base),record=recordTeachingExperiment(c,m,captured,'storage',teachingCandidate(base,'storage',20000),'<script>alert(1)</script>','explain');
 const records=appendTeachingRecord([],record);let controls:typeof captured|null=captured;controls=null;assert.equal(controls,null);assert.equal(records.length,1);assert.deepEqual(parseTeachingRecords(serializeTeachingRecords(records)),records);
 assert.throws(()=>appendTeachingRecord(Array(20).fill(record),record),/explicitly delete/);assert.deepEqual(parseTeachingRecords('{'),[]);assert.deepEqual(parseTeachingRecords(JSON.stringify({version:1,records:[{version:1,id:'bad'}]})),[]);
 const html=teachingWorksheetHtml(records);assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes(record.baselineKey));
});
test('unknown and no-change explanations avoid universal outcomes',()=>{
 const captured=captureTeachingBaseline(c,m,base),r=recordTeachingExperiment(c,m,captured,'storage',teachingCandidate(base,'storage',20000),'x','');assert.match(teachingExplanation({...r.before,assumedMarginDb:0},{...r.before,assumedMarginDb:0}),/No change/);assert.match(teachingExplanation({...r.before,generatedWh:null},r.after),/unavailable/);
});
