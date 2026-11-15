import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {decodeCatalog} from '../lib/catalog';import {withLandingSites} from '../lib/landing-catalog';import {LANDING_SITES} from '../lib/landing-sites';import {parseEvidenceManifest} from '../lib/provenance';import {parseScenario,type ScenarioState} from '../lib/scenario';import {evaluateScenario,PLANNING_MODEL_VERSION} from '../lib/assessment';import type {AssessmentResult} from '../lib/planning-types';import {diffScenarios} from '../lib/scenario-diff';import {DEFAULT_MISSION} from '../lib/mission';
type Demo={schemaVersion:number;datasetId:string;modelVersion:string;stayHours:number;delayHours:number;sources:Record<string,{path:string;sha256:string}>;search:{evaluations:number;maxEvaluations:number};controlledDifferences:{baselineToDelay:unknown;delayToAlternative:unknown};cases:Array<{role:string;state:ScenarioState;startUtc:string;endUtcExclusive:string;assessment:AssessmentResult}>};
const demo=JSON.parse(readFileSync('public/data/planning-demo.json','utf8')) as Demo;
const c=withLandingSites(decodeCatalog(JSON.parse(readFileSync('public/data/catalog.json','utf8'))),LANDING_SITES),m=parseEvidenceManifest(JSON.parse(readFileSync('public/data/evidence-manifest.json','utf8')));
const byRole=(role:string)=>{const result=demo.cases.find(v=>v.role===role);assert.ok(result);return result;};
test('every stored source byte identity and authoritative scenario assessment reproduces',()=>{
 assert.equal(demo.schemaVersion,1);assert.equal(demo.datasetId,m.datasetId);assert.equal(demo.modelVersion,PLANNING_MODEL_VERSION);assert.equal(demo.cases.length,4);
 for(const source of Object.values(demo.sources))assert.equal(createHash('sha256').update(readFileSync(source.path)).digest('hex'),source.sha256);
 for(const item of demo.cases){assert.deepEqual(parseScenario(item.state,{siteIds:c.sites.map(s=>s.id),samples:c.meta.n,stepHours:c.meta.stepHours}),item.state);const fresh=evaluateScenario(c,item.state,m);assert.deepEqual(JSON.parse(JSON.stringify(fresh)),item.assessment);assert.equal(Date.parse(item.startUtc),c.t0ms+item.state.startIndex*c.meta.stepHours*3600000);assert.equal(Date.parse(item.endUtcExclusive),c.t0ms+(item.state.endIndex+1)*c.meta.stepHours*3600000);}
});
test('controlled actual delay fails energy and actual site-only alternative restores conditional resource result',()=>{
 const b=byRole('baseline'),d=byRole('delayed'),a=byRole('alternative');assert.equal(b.assessment.outcome,'conditional');assert.equal(d.assessment.outcome,'fails-assessed');assert.equal(a.assessment.outcome,'conditional');
 for(const item of [b,d,a]){assert.deepEqual(item.state.mission,DEFAULT_MISSION);assert.equal((item.state.endIndex-item.state.startIndex+1)*c.meta.stepHours,demo.stayHours);assert.equal(item.assessment.scope,'resource-screening');}
 assert.equal((d.state.startIndex-b.state.startIndex)*c.meta.stepHours,demo.delayHours);
 assert.deepEqual(diffScenarios(b.state,d.state).map(v=>v.path),['endIndex','startIndex']);assert.deepEqual(diffScenarios(d.state,a.state).map(v=>v.path),['siteId']);assert.deepEqual(diffScenarios(b.state,d.state),demo.controlledDifferences.baselineToDelay);assert.deepEqual(diffScenarios(d.state,a.state),demo.controlledDifferences.delayToAlternative);
 assert.equal(d.assessment.firstFailure!.kind,'reserve-crossing');assert.ok(d.assessment.mission.unmetWh!>0);assert.ok(d.assessment.firstFailure!.modelOffsetHours!>=0);assert.ok(Date.parse(d.assessment.firstFailure!.latestUtc)>Date.parse(d.assessment.firstFailure!.earliestUtc));
 for(const item of [b,a]){assert.equal(item.assessment.firstFailure,null);assert.equal(item.assessment.mission.unmetWh,0);assert.ok(!item.assessment.constraints.some(row=>row.required&&row.state==='fail'));assert.ok(item.assessment.constraints.some(row=>row.required&&row.state==='conditional'));assert.equal(item.state.requirements.maxGeometricOutageHours,null);}
});
test('historical missing mask is incomplete, never a zero terrain result or approved landing',()=>{
 const h=byRole('unknown-historical');assert.equal(h.assessment.outcome,'incomplete');assert.equal(h.assessment.mission.generatedWh,null);assert.equal(h.assessment.mission.unmetWh,null);assert.equal(h.assessment.evidence.find(e=>e.id==='array-horizon')!.coverage,'unavailable');assert.ok(h.assessment.sphereMission.generatedWh!==null);assert.equal(h.state.siteId,'apollo-11');
 for(const item of demo.cases)assert.ok(item.assessment.constraints.some(row=>row.relation==='evidence'&&row.state==='not-assessed'));
 assert.ok(demo.search.evaluations>0&&demo.search.evaluations<=demo.search.maxEvaluations);
});
