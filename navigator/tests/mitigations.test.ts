import type {EvidenceManifest} from '../lib/planning-types';
import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {decodeCatalog} from '../lib/catalog';import {parseEvidenceManifest} from '../lib/provenance';import {parseScenario} from '../lib/scenario';import {DEFAULT_MISSION} from '../lib/mission';import {DEFAULT_FLIGHT} from '../lib/flight';import {evaluateScenario} from '../lib/assessment';import {findTestedAlternatives} from '../lib/mitigations';
const c=decodeCatalog(JSON.parse(readFileSync('public/data/catalog.json','utf8'))),source=parseEvidenceManifest(JSON.parse(readFileSync('public/data/evidence-manifest.json','utf8')));
const m:EvidenceManifest={...source,datasetId:'synthetic-complete-coverage-fixture',entries:source.entries.map(e=>({...e,coverage:'complete' as const}))};
const base=parseScenario({siteId:c.sites[0].id,custom:null,startIndex:100,endIndex:110,heightM:2,mission:{...DEFAULT_MISSION,areaM2:0,loadW:10,batteryWh:1},flight:DEFAULT_FLIGHT},{siteIds:c.sites.map(s=>s.id),samples:c.meta.n})!;
const candidate=(state:typeof base,manifest=m)=>({state,assessment:evaluateScenario(c,state,manifest)});
test('sparse tested capacity wording, exact apply reproduction and smallest among tested only',()=>{
 const a=candidate(base),b=candidate({...base,mission:{...base.mission,batteryWh:1000}}),d=candidate({...base,mission:{...base.mission,batteryWh:10000}});
 const rows=findTestedAlternatives(a.assessment,[d,b],{baseState:base});assert.equal(rows.find(r=>r.state.mission.batteryWh===1000)!.label,'Smallest passing capacity among tested values');assert.ok(rows.every(r=>r.passing));
 for(const row of rows)assert.deepEqual(evaluateScenario(c,row.state,m),row.assessment);
});
test('conditional source evidence never becomes passing fix; missing/unknown never passes',()=>{
 const b={...base,mission:{...base.mission,batteryWh:10000}};const partial=candidate(base,source),next=candidate(b,source);const row=findTestedAlternatives(partial.assessment,[next],{baseState:base})[0];assert.equal(row.passing,false);assert.equal(row.conditional,true);
 const unknown={...m,entries:[]};const x=candidate(base,unknown),y=candidate(b,unknown);assert.equal(findTestedAlternatives(x.assessment,[y],{baseState:base})[0].passing,false);
});
test('whole assessment failure cannot be presented as a passing reserve cure',()=>{
 let state:typeof base|undefined;
 for(const site of c.sites){for(let start=0;start<c.meta.n-25;start+=720){const trial={...base,siteId:site.id,startIndex:start,endIndex:start+23,requirements:{...base.requirements,maxGeometricOutageHours:0}};if((candidate(trial).assessment.mission.longestBlackoutHours??0)>0){state=trial;break;}}if(state)break;}
 assert.ok(state,'Actual prepared series must provide an outage fixture');
 const a=candidate(state),b=candidate({...state,mission:{...state.mission,batteryWh:10000}});const row=findTestedAlternatives(a.assessment,[b],{baseState:state})[0];assert.equal(row.passing,false);assert.ok(row.assessment.constraints.some(c=>c.required&&c.state==='fail'));assert.equal(row.assessment.constraints.find(c=>c.id==='reserve')!.state,'pass');
});
test('identity rejects wrong dataset/model/state; multivariable opt-in explicit',()=>{
 const a=candidate(base),b=candidate({...base,mission:{...base.mission,batteryWh:10000,loadW:1}});
 assert.equal(findTestedAlternatives(a.assessment,[b],{baseState:base}).length,0);assert.equal(findTestedAlternatives(a.assessment,[b],{baseState:base,includeMultivariable:true})[0].multivariable,true);
 assert.throws(()=>findTestedAlternatives(a.assessment,[{...b,assessment:{...b.assessment,datasetId:'wrong'}}],{baseState:base}),/identity/);
 assert.throws(()=>findTestedAlternatives(a.assessment,[{...b,state:base}],{baseState:base}),/identity/);
});
test('relaxing requirements is not offered as a tested hardware mitigation',()=>{
 const a=candidate(base),b=candidate({...base,requirements:{...base.requirements,requireReserve:false}});
 assert.deepEqual(findTestedAlternatives(a.assessment,[b],{baseState:base,includeMultivariable:true}),[]);
});
