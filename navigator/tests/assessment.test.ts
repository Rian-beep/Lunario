import {test} from 'node:test';import assert from 'node:assert/strict';
import {assessmentOutcome,planningKey} from '../lib/assessment';
import type {ConstraintResult} from '../lib/planning-types';
const row=(state:ConstraintResult['state'],required=true):ConstraintResult=>({id:'test',label:'test',required,state,actual:null,limit:null,margin:null,unit:null,relation:'evidence',reasonCode:'fixture',explanation:'Synthetic fixture',evidenceIds:[],firstViolation:null});
test('required failure wins over unknown; unknown prevents pass',()=>{assert.equal(assessmentOutcome([row('fail'),row('not-assessed')]),'fails-assessed');assert.equal(assessmentOutcome([row('pass'),row('not-assessed')]),'incomplete');assert.equal(assessmentOutcome([row('conditional')]),'conditional');assert.equal(assessmentOutcome([row('pass')]),'passes-assessed');assert.equal(assessmentOutcome([row('not-assessed',false)]),'not-configured');});
test('planning input identity is deterministic and preserves zero versus missing',()=>{assert.equal(planningKey({a:1,b:2}),planningKey({b:2,a:1}));assert.notEqual(planningKey({a:0}),planningKey({a:null}));assert.notEqual(planningKey({antennaHeightM:2}),planningKey({antennaHeightM:10}));});
import {readFileSync} from 'node:fs';
import {decodeCatalog} from '../lib/catalog';
import {evaluateScenario,evidenceScopeKey} from '../lib/assessment';
import {DEFAULT_MISSION} from '../lib/mission';
import {DEFAULT_FLIGHT} from '../lib/flight';
import {DEFAULT_OPERATIONS,DEFAULT_REQUIREMENTS,type EvidenceManifest} from '../lib/planning-types';
import type {ScenarioState} from '../lib/scenario';
const catalog=decodeCatalog(JSON.parse(readFileSync('public/data/catalog.json','utf8')));
const manifest=JSON.parse(readFileSync('public/data/evidence-manifest.json','utf8')) as EvidenceManifest;
function fixture(){
 const site={...catalog.sites[0],id:'fixture',horizons:[{heightM:2,stepDeg:1,mask:new Float64Array(360).fill(90)}]};
 const c={...catalog,sites:[site]};
 const m={...manifest,datasetId:'synthetic-constraint-fixture',entries:manifest.entries.map(e=>({...e,coverage:'complete' as const}))};
 const s:ScenarioState={schemaVersion:2,siteId:site.id,custom:null,startIndex:0,endIndex:3,heightM:2,arrayHeightM:2,antennaHeightM:2,mission:{...DEFAULT_MISSION,loadW:100,batteryWh:300,initialSoc:1,reserveSoc:.2,chargeEfficiency:1,dischargeEfficiency:1},flight:{...DEFAULT_FLIGHT},requirements:structuredClone(DEFAULT_REQUIREMENTS),operations:structuredClone(DEFAULT_OPERATIONS)};
 return {c,m,s};
}
test('complete known shortfall fails; no requirements is not configured',()=>{const {c,m,s}=fixture();const a=evaluateScenario(c,s,m);assert.equal(a.outcome,'fails-assessed');assert.equal(a.constraints.find(r=>r.id==='reserve')?.margin,-60);assert.equal(a.mission.unmetWh,100);assert.ok(a.firstFailure);const b=evaluateScenario(c,{...s,requirements:{...s.requirements,requireReserve:false,requireZeroUnmetWh:false}},m);assert.equal(b.outcome,'not-configured');});
test('reserve equality passes; missing required antenna evidence cannot pass',()=>{const {c,m,s}=fixture();s.mission.loadW=0;s.mission.initialSoc=.2;const a=evaluateScenario(c,s,m);assert.equal(a.outcome,'passes-assessed');const b=evaluateScenario(c,{...s,antennaHeightM:10,requirements:{...s.requirements,maxGeometricOutageHours:1}},m);assert.equal(b.outcome,'incomplete');});
test('partial or borrowed evidence makes otherwise passing terrain constraints conditional',()=>{const {c,m,s}=fixture();s.mission.loadW=0;const p={...m,entries:m.entries.map(e=>e.id==='horizon-catalog'?{...e,coverage:'partial' as const}:e)};assert.equal(evaluateScenario(c,s,p).outcome,'conditional');const b=evaluateScenario(c,{...s,custom:{lat:-85,lon:0}},m);assert.equal(b.outcome,'conditional');});
test('manual external pass is conditional and changed inputs invalidate it without self-invalidation',()=>{const {c,m,s}=fixture();s.mission.loadW=0;s.requirements.requiredExternal=['thermal-survival'];s.externalAssessments=[{id:'thermal-survival',status:'reported-pass',source:'Synthetic report',author:'test',notes:'Unverified external fixture',scenarioKey:evidenceScopeKey(s,m.datasetId)}];const a=evaluateScenario(c,s,m);assert.equal(a.constraints.find(r=>r.id==='thermal-survival')?.state,'conditional');assert.equal(a.outcome,'conditional');const b=evaluateScenario(c,{...s,mission:{...s.mission,loadW:1}},m);assert.equal(b.constraints.find(r=>r.id==='thermal-survival')?.reasonCode,'external-report-stale');assert.equal(a.scenarioKey,evaluateScenario(c,s,m).scenarioKey);});
