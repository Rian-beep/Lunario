import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {build} from 'esbuild';
import {renderToStaticMarkup} from 'react-dom/server';
import {decodeCatalog} from '../lib/catalog';
import {parseEvidenceManifest} from '../lib/provenance';
import {parseScenario} from '../lib/scenario';
import {DEFAULT_MISSION} from '../lib/mission';
import {DEFAULT_FLIGHT} from '../lib/flight';
import {evaluateScenario} from '../lib/assessment';
import {indexToMs} from '../lib/astro';
import {diffScenarios} from '../lib/scenario-diff';
import {EXPERIMENTS,captureTeachingBaseline,recordTeachingExperiment,serializeTeachingRecords,teachingCandidate} from '../lib/teaching';
import {audienceGuidance} from '../lib/audience/guidance';
import type {MissionInterval} from '../lib/mission';
import {controlledResponse,controlledFiniteRate,experimentValue,ILLUSTRATIVE_SOLAR,illustrativeDerivative,selectedSolarResponse} from '../lib/audience/experiments';
import {restoreNotebook,writeNotebook,TEACHING_STORAGE_KEY} from '../lib/audience/notebook';
import {appendStudyRecord,captureStudyRecord,parseStudyRecords,serializeStudyRecords,studyTasks,type ParticipantType} from '../lib/audience/study';
const c=decodeCatalog(JSON.parse(readFileSync('public/data/catalog.json','utf8')));
const m=parseEvidenceManifest(JSON.parse(readFileSync('public/data/evidence-manifest.json','utf8')));
const base=parseScenario({siteId:c.meta.demo.siteId,custom:null,startIndex:100,endIndex:123,heightM:2,mission:DEFAULT_MISSION,flight:DEFAULT_FLIGHT},{siteIds:c.sites.map(s=>s.id),samples:c.meta.n,stepHours:c.meta.stepHours})!;
const a=evaluateScenario(c,base,m);
function solarFixture(){
 const site={...c.sites[0],id:'solar-fixture',horizons:[{heightM:2,stepDeg:1,mask:new Float64Array(360).fill(-90)}]};
 const catalog={...c,sites:[site]};
 const s={...structuredClone(base),siteId:site.id,startIndex:0,endIndex:3,mission:{...base.mission,arrayMode:'tracking' as const,areaM2:4,efficiency:.3,lossFraction:.15,solarFlux:1000},operations:{...base.operations,deploymentDelayHours:.5}};
 return {catalog,s};
}
test('task guidance separates sampled instant from whole-stay failures and counts actual required rows',()=>{
 const rows=a.mission.timeline.map((r,i)=>({...r,sun:i===0,contact:i>1}));
 const testAssessment={...a,mission:{...a.mission,timeline:rows},outcome:'fails-assessed' as const,constraints:a.constraints.map((r,i)=>i===0?{...r,state:'fail' as const,required:true}:r)};
 const g=audienceGuidance(c,base,testAssessment,base.startIndex+.25);
 assert.match(g.current,/Some sunlight/);assert.match(g.whole,/breaks a required limit/);assert.equal(g.next,'replan');
 assert.equal(Object.values(g.counts).reduce((x,y)=>x+y,0),testAssessment.constraints.filter(r=>r.required).length);
 assert.deepEqual(g.missing.map(r=>r.id),testAssessment.constraints.filter(r=>r.relation==='evidence'&&r.state==='not-assessed').map(r=>r.id));
});
test('nearest transition keeps absolute adjacent-sample UTC bounds at fractional playhead; unknown blocks prediction',()=>{
 const timeline:MissionInterval[]=a.mission.timeline.map((r,i)=>({...r,sun:i<2,contact:true}));
 const result={...a,constraints:[],mission:{...a.mission,timeline}};
 const g=audienceGuidance(c,base,result,base.startIndex+.5);
 assert.equal(g.event?.label,'Sunlight is lost');assert.equal(g.event.earliestMs,indexToMs(c,base.startIndex+1));assert.equal(g.event.latestMs,indexToMs(c,base.startIndex+2));
 timeline[1].sun=null;
 const unknown=audienceGuidance(c,base,result,base.startIndex);assert.equal(unknown.event?.kind,'unknown');assert.equal(unknown.event?.latestMs,indexToMs(c,base.startIndex+1));
 assert.equal(audienceGuidance(c,base,result,base.startIndex-1).event,null);
 assert.match(audienceGuidance(c,base,result,base.endIndex+1).current,/outside/);
});
test('timed required failures compete with visibility events without narrowing bounds or inventing untimed failures',()=>{
 const event={kind:'reserve-crossing' as const,intervalIndex:0,earliestUtc:new Date(indexToMs(c,base.startIndex)).toISOString(),latestUtc:new Date(indexToMs(c,base.startIndex+1)).toISOString(),modelOffsetHours:.3,evidenceIds:['array-horizon']};
 const result={...a,mission:{...a.mission,timeline:a.mission.timeline.map(r=>({...r,sun:true,contact:true}))},constraints:[{...a.constraints[0],required:true,state:'fail' as const,firstViolation:event}]};
 assert.equal(audienceGuidance(c,base,result,base.startIndex).event?.kind,'failure');
 assert.equal(audienceGuidance(c,base,{...result,constraints:result.constraints.map(r=>({...r,firstViolation:null}))},base.startIndex).event,null);
});
test('all six controlled experiments preserve current inputs except the named variable and use full assessment authority',()=>{
 const original=structuredClone(base);
 for(const e of EXPERIMENTS){const value=e.id==='orientation'?'fixed':e.id.includes('height')?10:e.id==='link'?25:e.id==='load'?125:20000;
  const r=controlledResponse(c,m,base,e.id,value);
  assert.deepEqual(diffScenarios(base,r.candidate).map(d=>d.path),[e.path]);assert.deepEqual(r.assessment,evaluateScenario(c,r.candidate,m));assert.ok(r.points.length<=5);
  const currentPoint=r.points.find(p=>p.label===String(experimentValue(base,e.id)));
  if(e.id!=='link')assert.ok(currentPoint,'baseline input included in tested curve');
 }
 assert.deepEqual(base,original);
 assert.throws(()=>controlledResponse(c,m,base,'load',-1),/nonnegative/);
 assert.throws(()=>controlledResponse(c,m,base,'storage',1e10),/bounds/);
});
test('controlled curve retains separate smooth sphere metrics and endpoint range is bounded',()=>{
 const r=controlledResponse(c,m,base,'storage',5000);
 for(const p of r.points){const authority=evaluateScenario(c,teachingCandidate(base,'storage',p.x),m);assert.equal(p.terrain,authority.mission.minBatteryWh);assert.equal(p.sphere,authority.sphereMission.minBatteryWh);}
 const large={...base,mission:{...base.mission,loadW:1e6}};
 assert.ok(controlledResponse(c,m,large,'load',5e5).points.every(p=>p.x<=1e6));
});
test('controlled finite response has named units and missing radio assumptions never acquire invented baseline power',()=>{
 const r=controlledResponse(c,m,base,'storage',5000),rate=controlledFiniteRate(r,base,'storage',5000);
 const p=r.points.find(p=>p.x===base.mission.batteryWh)!,q=r.points.find(p=>p.x===5000)!;
 assert.equal(rate.unit,'Wh/Wh');assert.equal(rate.value,p.terrain===null||q.terrain===null?null:(q.terrain-p.terrain)/(5000-base.mission.batteryWh));
 assert.equal(controlledFiniteRate(controlledResponse(c,m,base,'orientation','fixed'),base,'orientation','fixed').value,null);
 assert.equal(experimentValue(base,'link'),null);
 const link=controlledResponse(c,m,base,'link',25);assert.ok(link.points.every(p=>p.terrain===null));assert.equal(controlledFiniteRate(link,base,'link',25).value,null);
});
test('illustrative derivative has correct values and units; selected derivative includes deployment and current constants',()=>{
 assert.deepEqual(illustrativeDerivative(ILLUSTRATIVE_SOLAR),{value:1.02,unit:'m²',meaning:'W of generated power per additional W/m² of irradiance'});
 assert.throws(()=>illustrativeDerivative({...ILLUSTRATIVE_SOLAR,efficiency:2}),/Invalid/);
 const {catalog,s}=solarFixture();
 const r=selectedSolarResponse(catalog,m,s,0);
 assert.equal(r.unit,'m²');assert.ok(Math.abs(r.derivative!-.51)<1e-12);assert.ok(Math.abs(r.activeFactor!-.5)<1e-12);
 assert.equal(r.points.find(p=>p.x===1000)?.terrain,510);
 assert.ok(Math.abs(selectedSolarResponse(catalog,m,s,1).derivative!-1.02)<1e-12);
 const zero={...s,mission:{...s.mission,solarFlux:0,areaM2:8}};
 assert.ok(Math.abs(selectedSolarResponse(catalog,m,zero,1).derivative!-2.04)<1e-12,'zero current irradiance must not divide by zero');
});
test('selected partial derivative agrees with numerical perturbation of authority for fixed orientation and losses',()=>{
 const s={...base,mission:{...base.mission,arrayMode:'fixed' as const,areaM2:7.3,efficiency:.23,lossFraction:.17,tiltDeg:47,azimuthDeg:113}};
 const r=selectedSolarResponse(c,m,s,5),step=2;
 const x=evaluateScenario(c,s,m).mission.timeline[5].powerW;
 const y=evaluateScenario(c,{...s,mission:{...s.mission,solarFlux:s.mission.solarFlux+step}},m).mission.timeline[5].powerW;
 if(x===null||y===null)assert.equal(r.derivative,null);else assert.ok(Math.abs((y-x)/step-r.derivative!)<1e-8);
 assert.throws(()=>selectedSolarResponse(c,m,s,-1),/inside/);assert.throws(()=>selectedSolarResponse(c,m,s,.5),/inside/);
});
test('unavailable terrain stays unknown in derivative and plotted values while sphere remains independent',()=>{
 const s={...base,arrayHeightM:10,custom:{lat:-85,lon:0}};
 const r=selectedSolarResponse(c,m,s,0);assert.equal(r.derivative,null);assert.ok(r.points.every(p=>p.terrain===null));assert.ok(r.points.every(p=>p.sphere!==null));
});
test('legacy notebook and draft restore with exact baseline inputs and shared storage key; mode/control resets keep records',()=>{
 const captured=captureTeachingBaseline(c,m,base),candidate=teachingCandidate(base,'storage',20000);
 const record=recordTeachingExperiment(c,m,captured,'storage',candidate,'More storage','Observed result');
 const values=new Map<string,string>(),storage={setItem:(k:string,v:string)=>values.set(k,v)};
 const draft={version:1 as const,id:'storage' as const,prediction:'More storage',explanation:'Observed result',value:'20000',baseline:base,datasetId:m.datasetId};
 writeNotebook(storage,[record],draft);
 const restored=restoreNotebook(values.get(TEACHING_STORAGE_KEY)!,values.get(TEACHING_STORAGE_KEY+'-draft')!,c,m);
 assert.deepEqual(restored.records,[record]);assert.deepEqual(restored.draft?.baseline,base);
 writeNotebook(storage,restored.records,{...draft,baseline:null,prediction:'',explanation:''});
 assert.deepEqual(restoreNotebook(values.get(TEACHING_STORAGE_KEY)!,values.get(TEACHING_STORAGE_KEY+'-draft')!,c,m).records,[record]);
 assert.equal(serializeTeachingRecords(restored.records),values.get(TEACHING_STORAGE_KEY));
});
test('storage corruption, stale baseline and quota failures are explicit and do not silently discard records',()=>{
 assert.throws(()=>restoreNotebook('{',null,c,m));
 assert.throws(()=>restoreNotebook(JSON.stringify({version:1,records:[{id:'invalid'}]}),null,c,m),/not be fully restored/);
 assert.throws(()=>restoreNotebook(null,JSON.stringify({version:1,id:'load',baseline:base,datasetId:'old'}),c,m),/different dataset/);
 assert.throws(()=>writeNotebook({setItem(){throw Error('Quota exceeded');}},[],{version:1,id:'load',prediction:'',explanation:'',value:'1',baseline:null,datasetId:m.datasetId}),/Quota/);
});
function studyInput(participantType:ParticipantType='agent'){
 return {participantType,participantCode:'anonymous',mode:'teach' as const,assessment:a,answers:studyTasks('teach',a).map(t=>({taskId:t.id,choice:t.correct,completed:false,observation:''})),confidenceBefore:2,confidenceAfter:3,durationSeconds:null};
}
test('study starts empty; human, agent and self-reported evidence remain distinct on local export/restore',()=>{
 assert.deepEqual(parseStudyRecords(null),[]);
 const records=(['human','agent','self-reported'] as const).map(type=>captureStudyRecord(studyInput(type)));
 assert.deepEqual(parseStudyRecords(serializeStudyRecords(records)),records);
 assert.deepEqual(records.map(r=>r.participantType),['human','agent','self-reported']);
 for(const r of records){assert.equal(r.correctCount,3);assert.equal(r.results.filter(t=>t.completed).length,0);assert.match(r.limitations,/not human audience validation/);assert.equal(r.scenarioKey,a.scenarioKey);}
});
test('objective comprehension scores track actual outcome and incorrect choices; completion requires observed evidence',()=>{
 for(const outcome of ['fails-assessed','incomplete','conditional','passes-assessed','not-configured'] as const){const tasks=studyTasks('public',{...a,outcome});assert.equal(tasks[0].options[tasks[0].correct],{'fails-assessed':'A required limit fails',incomplete:'Required evidence is missing',conditional:'Only a conditional result','passes-assessed':'All configured requirements pass under this model','not-configured':'No requirements configured'}[outcome]);}
 const input=studyInput();input.answers[0].choice=(input.answers[0].choice+1)%5;
 assert.equal(captureStudyRecord(input).correctCount,2);
 input.answers[0].completed=true;assert.throws(()=>captureStudyRecord(input),/observed action/);
 input.answers[0].observation='Opened the exact baseline comparison; participant confused current sunlight with whole stay.';
 assert.equal(captureStudyRecord(input).results[0].completed,true);
 assert.throws(()=>captureStudyRecord({...input,confidenceBefore:0}),/Confidence/);
 assert.throws(()=>captureStudyRecord({...input,durationSeconds:-1}),/Duration/);
 assert.throws(()=>captureStudyRecord({...input,answers:[]}),/Answer every/);
});
test('malformed or forged study scores/evidence types do not become accepted audience evidence; bounded capture',()=>{
 const r=captureStudyRecord(studyInput());
 assert.throws(()=>parseStudyRecords(serializeStudyRecords([{...r,participantType:'invented' as ParticipantType}])) ,/malformed/);
 assert.throws(()=>parseStudyRecords(serializeStudyRecords([{...r,correctCount:0}])),/inconsistent/);
 assert.throws(()=>appendStudyRecord(Array(50).fill(r),r),/explicitly delete/);
 assert.equal(appendStudyRecord([],r).length,1);
});

// Isolated in-memory SSR compilation of real components; no app build/server/browser.
import {createRequire} from 'node:module';

test('frozen audience exports render task scope, explicit controls, local study and native semantic equation without changing state',async()=>{
 const compiled=await build({stdin:{contents:"export {AudienceTaskStrip} from './components/audience/task-strip';export {TeachingStudio} from './components/audience/teaching-studio';export {SolarLesson} from './components/audience/solar-lesson';export {ExperimentRelation} from './components/audience/experiment-relation';",resolveDir:process.cwd(),loader:'tsx'},outfile:'/tmp/audience-ssr-fixture.cjs',bundle:true,write:false,format:'cjs',platform:'node',packages:'external',jsx:'automatic'});
 const output={exports:{} as {AudienceTaskStrip:typeof import('../components/audience/task-strip').AudienceTaskStrip;TeachingStudio:typeof import('../components/audience/teaching-studio').TeachingStudio;SolarLesson:typeof import('../components/audience/solar-lesson').SolarLesson;ExperimentRelation:typeof import('../components/audience/experiment-relation').ExperimentRelation}};
 new Function('require','module','exports',compiled.outputFiles.find(f=>f.path.endsWith('.cjs'))!.text)(createRequire(import.meta.url),output,output.exports);
 const {AudienceTaskStrip,TeachingStudio,SolarLesson,ExperimentRelation}=output.exports;
 const before=structuredClone(base);const noop=()=>{};
 for(const mode of ['public','teach','plan'] as const){const html=renderToStaticMarkup(createElement(AudienceTaskStrip,{mode,catalog:c,manifest:m,state:base,assessment:a,playhead:base.startIndex,siteName:'Selected site',onInspect:noop,onReplan:noop,onTeach:noop}));assert.match(html,/Dismiss/);if(mode==='public'){assert.match(html,/At this moment/);assert.match(html,/Whole stay/);assert.match(html,/Without local hills|smooth Moon/);assert.match(html,/Pick a site · Move the date · Compare/);assert.doesNotMatch(html,/antenna viewing limit|assessed requirements/i);}if(mode==='plan'){assert.match(html,/Required:/);assert.match(html,/unassessed disciplines/);}}
 const studio=renderToStaticMarkup(createElement(TeachingStudio,{catalog:c,manifest:m,state:base,onChange:noop,onCompare:noop,onClose:noop}));
 assert.match(studio,/Capture current scenario as baseline/);assert.match(studio,/Audience validation evidence/);assert.match(studio,/0 locally recorded sessions/);assert.doesNotMatch(studio,/Observed complete: [1-9]/);
 const lesson=renderToStaticMarkup(createElement(SolarLesson,{catalog:c,manifest:m,state:base,localIndex:0}));assert.match(lesson,/<math/);assert.match(lesson,/<mfrac>/);assert.match(lesson,/Illustrative algebra example/);assert.match(lesson,/Populate from captured scenario/);assert.match(lesson,/W per \(W\/m²\)/);assert.match(lesson,/Solar irradiance S \(W\/m²\)/);
 for(const e of EXPERIMENTS){const v=e.id==='orientation'?'fixed':e.id.includes('height')?10:500;const response=controlledResponse(c,m,base,e.id,v);const html=renderToStaticMarkup(createElement(ExperimentRelation,{id:e.id,response,baseline:base,value:v}));assert.match(html,/<math/);assert.match(html,/Baseline-to-candidate finite response/);assert.match(html,/Symbol meanings and units/);}
 assert.deepEqual(base,before);
});

test('Public instant labels use plain hill language without antenna or cutoff jargon',()=>{
 const g=audienceGuidance(c,base,a,base.startIndex);
 assert.match(g.currentPublic,/Earth is above the hills|Earth is hidden behind the hills|Earth view is unknown/);
 assert.doesNotMatch(g.currentPublic,/cutoff|antenna viewing limit/i);
 assert.match(g.currentSpherePublic,/sunlight|hills|Earth/);
 assert.doesNotMatch(g.currentPublic,/\bin shadow\b/i);
 assert.match(audienceGuidance(c,base,a,base.endIndex+2).currentPublic,/outside this stay/);
});
