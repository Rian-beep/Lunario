import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {decodeCatalog} from '../lib/catalog';import {parseEvidenceManifest} from '../lib/provenance';import {parseScenario} from '../lib/scenario';import {DEFAULT_MISSION} from '../lib/mission';import {DEFAULT_FLIGHT} from '../lib/flight';import {evaluateScenario} from '../lib/assessment';import {runSensitivity,sensitivityKey} from '../lib/sensitivity';
const c=decodeCatalog(JSON.parse(readFileSync('public/data/catalog.json','utf8'))),m=parseEvidenceManifest(JSON.parse(readFileSync('public/data/evidence-manifest.json','utf8')));
const complete={...m,datasetId:'synthetic-complete-coverage-fixture',entries:m.entries.map(e=>({...e,coverage:'complete' as const}))};
const base=parseScenario({siteId:c.sites[0].id,custom:null,startIndex:100,endIndex:110,heightM:2,mission:DEFAULT_MISSION,flight:DEFAULT_FLIGHT},{siteIds:c.sites.map(s=>s.id),samples:c.meta.n,stepHours:c.meta.stepHours})!;
test('deterministic 3x3 order, exact evaluator equivalence, baseline immutability, counts',async()=>{
 const before=structuredClone(base),axes=[{field:'arrivalOffsetHours' as const,values:[0,1,2]},{field:'batteryWh' as const,values:[1000,5000,10000]}];const r=await runSensitivity(c,complete,base,axes);
 assert.deepEqual(r.cases.map(v=>v.values),[[0,1000],[0,5000],[0,10000],[1,1000],[1,5000],[1,10000],[2,1000],[2,5000],[2,10000]]);
 for(const v of r.cases){assert.equal(v.error,null);assert.deepEqual(v.assessment,evaluateScenario(c,v.state!,complete));}
 assert.deepEqual(base,before);assert.equal(Object.values(r.counts).reduce((a,b)=>a+b,0),9);assert.equal(r.key,(await runSensitivity(c,complete,base,axes)).key);
 assert.notEqual(sensitivityKey(base,complete,axes),sensitivityKey(base,m,axes));
});
test('initial charge recomputed from state of charge, including valid zero',async()=>{
 const r=await runSensitivity(c,complete,base,[{field:'initialSoc',values:[0,0.5,1]}]);
 for(const v of r.cases){assert.equal(v.state!.mission.initialSoc,v.values[0]);assert.deepEqual(v.assessment,evaluateScenario(c,v.state!,complete));}
});
test('axis structure rejected; invalid values produce reasons, no trim or height substitution',async()=>{
 await assert.rejects(runSensitivity(c,m,base,[]),/one or two/);await assert.rejects(runSensitivity(c,m,base,[{field:'batteryWh',values:[NaN]}]),/finite/);
 await assert.rejects(runSensitivity(c,m,base,[{field:'batteryWh',values:[1]},{field:'batteryWh',values:[2]}]),/unique/);
 const r=await runSensitivity(c,m,base,[{field:'batteryWh',values:[-1,1e10]}]);assert.ok(r.cases.every(v=>v.error&&v.assessment===null));
 const date=await runSensitivity(c,m,base,[{field:'arrivalOffsetHours',values:[-1000,0.5,c.meta.n]}]);assert.ok(date.cases.every(v=>v.error));
 const h=await runSensitivity(c,m,{...base,custom:{lat:-85,lon:20}},[{field:'arrayHeightM',values:[2,5,10]}]);assert.ok(h.cases[1].error);assert.equal(h.cases[2].assessment!.evidence.find(e=>e.id==='array-horizon')!.coverage,'unavailable');assert.equal(h.cases[2].state!.arrayHeightM,10);
});
test('actual step alignment and negative arrival offsets preserve inclusive stay',async()=>{
 const c2={...c,meta:{...c.meta,stepHours:2}};const r=await runSensitivity(c2,complete,base,[{field:'arrivalOffsetHours',values:[-2,1,2]}]);assert.equal(r.cases[0].state!.startIndex,99);assert.equal(r.cases[0].state!.endIndex,109);assert.ok(r.cases[1].error);assert.equal(r.cases[2].state!.startIndex,101);
});
test('cancellation suppresses later progress and result; finite key accompanies progress',async()=>{
 const controller=new AbortController(),progress:number[]=[];
 await assert.rejects(runSensitivity(c,m,base,[{field:'batteryWh',values:[1,2,3]}],{signal:controller.signal,onProgress:p=>{assert.ok(p.key);progress.push(p.completed);controller.abort();}}),{name:'AbortError'});assert.deepEqual(progress,[1]);
 await assert.rejects(runSensitivity(c,m,base,[{field:'batteryWh',values:[1]}],{signal:controller.signal}),{name:'AbortError'});
});
