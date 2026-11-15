import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateScenario, parseScenario } from '../lib/scenario';
import { DEFAULT_MISSION } from '../lib/mission';
import { DEFAULT_FLIGHT } from '../lib/flight';
const bounds = {siteIds:['ridge'], samples:200, stepHours:2};
const legacy = {siteId:'ridge',custom:null,startIndex:10,endIndex:19,heightM:2,mission:DEFAULT_MISSION,flight:DEFAULT_FLIGHT};
function canonical() { return migrateScenario(legacy,bounds)!; }
test('legacy migration provides independent canonical subsystem heights and defaults',()=>{
  const s=canonical(); assert.equal(s.schemaVersion,2); assert.equal(s.arrayHeightM,2); assert.equal(s.antennaHeightM,2);
  assert.deepEqual(s.operations,{deploymentDelayHours:0,maxChargeW:null,maxDischargeW:null,loadSegments:[]});
  s.requirements.requiredExternal.push('thermal-survival'); assert.deepEqual(canonical().requirements.requiredExternal,[]);
});
test('operations use actual duration, finite nonnegative rates, independent overlapping added loads',()=>{
 const s=canonical(); s.operations={deploymentDelayHours:20,maxChargeW:0,maxDischargeW:null,loadSegments:[{id:'a',startOffsetHours:0,endOffsetHours:20,additionalW:0},{id:'b',startOffsetHours:1,endOffsetHours:3,additionalW:5}]};
 assert.deepEqual(parseScenario(s,bounds),s);
 for(const operations of [{...s.operations,deploymentDelayHours:21},{...s.operations,maxChargeW:-1},{...s.operations,maxDischargeW:Infinity},{...s.operations,loadSegments:[{id:'a',startOffsetHours:3,endOffsetHours:3,additionalW:0}]},{...s.operations,loadSegments:[{id:'a',startOffsetHours:0,endOffsetHours:21,additionalW:0}]},{...s.operations,loadSegments:Array(101).fill(s.operations.loadSegments[0])},{...s.operations,loadSegments:[s.operations.loadSegments[0],s.operations.loadSegments[0]]}]) assert.equal(parseScenario({...s,operations},bounds),null);
});
test('requirements preserve explicit zero and null, validate bounds and known IDs',()=>{
 const s=canonical(); s.requirements={...s.requirements,maxGeometricOutageHours:0,minAssumedRadioMarginDb:-3,extraScreens:{minSunFraction:0,maxDarkHours:null,maxSlopeDeg:90},criticalContacts:[{id:'c',startOffsetHours:0,endOffsetHours:20}],requiredExternal:['thermal-survival']};
 assert.deepEqual(parseScenario(s,bounds),s);
 for(const requirements of [{...s.requirements,maxGeometricOutageHours:-1},{...s.requirements,minAssumedRadioMarginDb:NaN},{...s.requirements,requiredExternal:['fake']},{...s.requirements,requiredExternal:['thermal-survival','thermal-survival']},{...s.requirements,extraScreens:{minSunFraction:1.01}},{...s.requirements,extraScreens:{fake:0}},{...s.requirements,criticalContacts:Array(101).fill(s.requirements.criticalContacts[0])},{...s.requirements,criticalContacts:[{id:'x',startOffsetHours:4,endOffsetHours:2}]}]) assert.equal(parseScenario({...s,requirements},bounds),null);
});
test('full V2 rejects missing fields or unknown versions instead of silently migrating',()=>{
 const s=canonical(); assert.equal(parseScenario({...s,schemaVersion:3},bounds),null);
 for(const key of ['arrayHeightM','antennaHeightM','requirements','operations']) {const bad={...s} as Record<string,unknown>;delete bad[key];assert.equal(parseScenario(bad,bounds),null);}
});
test('100 unique schedules are accepted; malformed schedule fields reject',()=>{
 const s=canonical();
 const segments=Array.from({length:100},(_,i)=>({id:`s${i}`,startOffsetHours:0,endOffsetHours:1,additionalW:0}));
 assert.ok(parseScenario({...s,operations:{...s.operations,loadSegments:segments}},bounds));
 for(const patch of [{startOffsetHours:-1},{endOffsetHours:Infinity},{additionalW:-1},{additionalW:null},{id:''}]) {
  assert.equal(parseScenario({...s,operations:{...s.operations,loadSegments:[{...segments[0],...patch}]}},bounds),null);
 }
 for(const stepHours of [0,-1,NaN,Infinity]) assert.equal(parseScenario(s,{...bounds,stepHours}),null);
});
test('external reports retain provenance and explicit binding; unknown evidence IDs never import',()=>{
 const s=canonical();
 const report={id:'thermal-survival',status:'reported-pass',source:'report-42',author:'analyst',notes:'Scope-limited external claim',scenarioKey:'physical-evidence-scope'};
 for(const patch of [{id:'unknown'},{status:'pass'},{scenarioKey:''},{source:''},{author:''}]) assert.equal(parseScenario({...s,externalAssessments:[{...report,...patch}]},bounds),null);
 assert.equal(parseScenario({...s,externalAssessments:[report,report]},bounds),null);
 assert.ok(parseScenario({...s,externalAssessments:[{...report,status:'unknown',source:'',author:''}]},bounds));
});
test('global terrain context is explicit and older records retain prepared-only semantics',()=>{
 const s=canonical();assert.equal(s.terrainMode,undefined);
 assert.equal(parseScenario({...s,terrainMode:'global-context'},bounds)?.terrainMode,'global-context');
 assert.equal(parseScenario({...s,terrainMode:'prepared'},bounds)?.terrainMode,'prepared');
 assert.equal(parseScenario({...s,terrainMode:'invented-fine-measurement'},bounds),null);
});
