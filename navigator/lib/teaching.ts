import {evaluateScenario,planningKey,PLANNING_MODEL_VERSION} from './assessment';
import type {Catalog} from './catalog';
import type {AssessmentResult,EvidenceManifest} from './planning-types';
import {parseScenario,type ScenarioState} from './scenario';
import {diffScenarios} from './scenario-diff';
import {DEFAULT_MISSION,evaluateMission,linkBudget,type MissionResult} from './mission';
import type {SampleSeries} from './astro';
export const TEACHING_STORAGE_KEY='solarreach-teaching-v1';
export const TEACHING_LIMIT=20;
export const EXPERIMENTS=[
 {id:'array-height',question:'Does raising only the array change modeled generation?',path:'arrayHeightM',expected:'Compare generation while antenna height stays fixed.',sourceIds:['ephemeris','horizon-catalog']},
 {id:'antenna-height',question:'Does raising only the antenna change geometric contact?',path:'antennaHeightM',expected:'Compare contact while array height stays fixed.',sourceIds:['ephemeris','horizon-catalog']},
 {id:'orientation',question:'What changes when a tracking array becomes fixed?',path:'mission.arrayMode',expected:'Compare the selected fixed orientation with tracking; the result depends on the selected geometry.',sourceIds:['user-assumptions','ephemeris']},
 {id:'load',question:'How does a different constant demand affect stored energy?',path:'mission.loadW',expected:'Compare demand and stored energy without changing the terrain.',sourceIds:['user-assumptions']},
 {id:'storage',question:'Can the tested storage supply this modeled stay?',path:'mission.batteryWh',expected:'Capacity also changes initial stored Wh when initial state of charge is fixed.',sourceIds:['user-assumptions']},
 {id:'link',question:'Does geometric Earth visibility guarantee a usable radio link?',path:'radio.txPowerW',expected:'Transmit power changes an assumed free-space budget, not terrain obstruction or Earth geometry.',sourceIds:['ephemeris','user-assumptions']},
] as const;
export type ExperimentId=typeof EXPERIMENTS[number]['id'];
export type TeachingBaseline={state:ScenarioState;assessment:AssessmentResult;evidenceKey:string};
export type TeachingMetrics={generatedWh:number|null;minBatteryWh:number|null;unmetWh:number|null;contactFraction:number|null;assumedMarginDb:number|null;outcome:AssessmentResult['outcome']};
export type TeachingRecord={version:1;id:string;experimentId:ExperimentId;question:string;prediction:string;explanation:string;createdUtc:string;baseline:ScenarioState;candidate:ScenarioState;baselineKey:string;candidateKey:string;datasetId:string;modelVersion:string;changedPaths:string[];lockedFields:string;expectedRelationship:string;sourceIds:string[];before:TeachingMetrics;after:TeachingMetrics;observedExplanation:string};
export function captureTeachingBaseline(c:Catalog,m:EvidenceManifest,state:ScenarioState):TeachingBaseline{return {state:structuredClone(state),assessment:evaluateScenario(c,state,m),evidenceKey:planningKey(m)};}
export function teachingCandidate(base:ScenarioState,id:ExperimentId,value:number|string):ScenarioState{
 const next=structuredClone(base),experiment=EXPERIMENTS.find(e=>e.id===id)!;
 if(id==='array-height'||id==='antenna-height'){if(![0,2,10].includes(Number(value)))throw Error('Choose a prepared height');next[id==='array-height'?'arrayHeightM':'antennaHeightM']=Number(value);}
 else if(id==='orientation'){if(value!=='tracking'&&value!=='fixed')throw Error('Choose tracking or fixed');next.mission.arrayMode=value;}
 else {if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw Error('Choose a finite nonnegative value');if(id==='load')next.mission.loadW=value;else if(id==='storage')next.mission.batteryWh=value;else next.radio={...next.radio,txPowerW:value};}
 const changes=diffScenarios(base,next);if(changes.some(d=>d.path!==experiment.path))throw Error('Only the allowed variable may change');return next;
}
function metrics(state:ScenarioState,a:AssessmentResult):TeachingMetrics{return {generatedWh:a.mission.generatedWh,minBatteryWh:a.mission.minBatteryWh,unmetWh:a.mission.unmetWh,contactFraction:a.mission.contactFraction,assumedMarginDb:linkBudget(state.radio??{})?.marginDb??null,outcome:a.outcome};}
export function teachingExplanation(before:TeachingMetrics,after:TeachingMetrics):string{
 const pairs=['generatedWh','minBatteryWh','unmetWh','contactFraction','assumedMarginDb'] as const;
 if(pairs.some(k=>before[k]===null||after[k]===null))return 'Some evidence is unavailable. Compare known values; unknown does not mean zero or no effect.';
 if(pairs.every(k=>before[k]===after[k]))return 'No change in these modeled metrics for this tested stay. That does not establish a universal relationship.';
 return 'These are computed differences for this exact controlled experiment. Terrain geometry, energy and assumed radio performance answer different questions; explain the observed values without claiming causality beyond the model.';
}
export function recordTeachingExperiment(c:Catalog,m:EvidenceManifest,baseline:TeachingBaseline,id:ExperimentId,candidate:ScenarioState,prediction:string,explanation:string):TeachingRecord{
 if(!prediction.trim())throw Error('Record a prediction before revealing evidence');
 const experiment=EXPERIMENTS.find(e=>e.id===id)!;
 if(baseline.evidenceKey!==planningKey(m)||baseline.assessment.modelVersion!==PLANNING_MODEL_VERSION||baseline.assessment.datasetId!==m.datasetId||baseline.assessment.scenarioKey!==planningKey({state:baseline.state,datasetId:m.datasetId,modelVersion:baseline.assessment.modelVersion}))throw Error('Captured baseline identity is stale');
 const differences=diffScenarios(baseline.state,candidate);if(differences.length!==1||differences[0].path!==experiment.path)throw Error('Change exactly the allowed variable before revealing');
 if(!parseScenario(candidate,{siteIds:c.sites.map(s=>s.id),samples:c.meta.n,stepHours:c.meta.stepHours}))throw Error('Candidate exceeds supported scenario bounds');
 const after=evaluateScenario(c,candidate,m),beforeMetrics=metrics(baseline.state,baseline.assessment),afterMetrics=metrics(candidate,after);
 return {version:1,id:globalThis.crypto.randomUUID(),experimentId:id,question:experiment.question,prediction:prediction.slice(0,2000),explanation:explanation.slice(0,4000),createdUtc:new Date().toISOString(),baseline:structuredClone(baseline.state),candidate:structuredClone(candidate),baselineKey:baseline.assessment.scenarioKey,candidateKey:after.scenarioKey,datasetId:m.datasetId,modelVersion:after.modelVersion,changedPaths:differences.map(d=>d.path),lockedFields:'All scenario fields except '+experiment.path,expectedRelationship:experiment.expected,sourceIds:experiment.sourceIds.map(source=>source==='horizon-catalog'&&baseline.state.custom?'horizon-custom':source),before:beforeMetrics,after:afterMetrics,observedExplanation:teachingExplanation(beforeMetrics,afterMetrics)};
}
export function appendTeachingRecord(records:TeachingRecord[],record:TeachingRecord){if(records.length>=TEACHING_LIMIT)throw Error('Notebook holds 20 records. Print and explicitly delete a record before adding another.');return [...records,record];}
export function parseTeachingRecords(text:string|null):TeachingRecord[]{
 if(!text||text.length>2_000_000)return [];
 try{const data=JSON.parse(text);if(data.version!==1||!Array.isArray(data.records))return [];return data.records.filter((r:TeachingRecord)=>r&&r.version===1&&typeof r.id==='string'&&typeof r.createdUtc==='string'&&typeof r.datasetId==='string'&&typeof r.modelVersion==='string'&&typeof r.question==='string'&&typeof r.prediction==='string'&&typeof r.explanation==='string'&&r.baseline&&r.candidate&&r.before&&r.after&&typeof r.before.outcome==='string'&&typeof r.after.outcome==='string'&&typeof r.observedExplanation==='string'&&Array.isArray(r.changedPaths)&&r.changedPaths.every(p=>typeof p==='string')&&['generatedWh','minBatteryWh','unmetWh','contactFraction','assumedMarginDb'].every(k=>[r.before,r.after].every(x=>x[k as keyof TeachingMetrics]===null||(typeof x[k as keyof TeachingMetrics]==='number'&&Number.isFinite(x[k as keyof TeachingMetrics]))))).slice(-TEACHING_LIMIT);}catch{return [];}
}
export function serializeTeachingRecords(records:TeachingRecord[]):string{const text=JSON.stringify({version:1,records:records.slice(-TEACHING_LIMIT)});if(text.length>2_000_000)throw Error('Teaching records exceed local storage bound; delete or print older records');return text;}
const escape=(v:unknown)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function teachingWorksheetHtml(records:TeachingRecord[]):string{return '<!doctype html><html><head><meta charset="utf-8"><title>Lunario experiment worksheet</title><style>body{font:16px system-ui;max-width:70ch;margin:2rem auto}article{break-inside:avoid;border-top:1px solid;padding:1rem 0}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body><h1>Lunario experiment worksheet</h1>'+records.map(r=>'<article><h2>'+escape(r.question)+'</h2><p>Prediction: '+escape(r.prediction)+'</p><p>Changed: '+escape(r.changedPaths.join(', '))+'</p><pre>'+escape(JSON.stringify({before:r.before,after:r.after},null,2))+'</pre><p>'+escape(r.observedExplanation)+'</p><p>Learner explanation: '+escape(r.explanation)+'</p><p>Dataset '+escape(r.datasetId)+'; model '+escape(r.modelVersion)+'</p><details><summary>Captured states and identities</summary><pre>'+escape(JSON.stringify({baseline:r.baseline,candidate:r.candidate,baselineKey:r.baselineKey,candidateKey:r.candidateKey},null,2))+'</pre></details></article>').join('')+'</body></html>';}
/** Synthetic teaching input only: same 24 dark hours, different ordering, no NASA measurement. */
export function syntheticOutageLesson():{label:string;assumptions:typeof DEFAULT_MISSION;cases:Array<{label:string;series:SampleSeries;result:MissionResult}>}{
 const assumptions={...DEFAULT_MISSION,areaM2:1,efficiency:1,lossFraction:0,solarFlux:200,loadW:100,batteryWh:1000,initialSoc:1,reserveSoc:0,chargeEfficiency:1,dischargeEfficiency:1};
 const series=(dark:(hour:number)=>boolean):SampleSeries=>{const fill=(n:number)=>new Float64Array(48).fill(n);return {index0:0,sunAz:fill(0),sunEl:Float64Array.from({length:48},(_,i)=>dark(i)?-90:90),earthAz:fill(0),earthEl:fill(90),sunHorizon:fill(0),earthHorizon:fill(0),sunRadius:fill(.25),earthRadius:fill(1)};};
 const a=series(i=>i<24),b=series(i=>i%12<6);
 return {label:'Synthetic teaching fixture — not NASA measurements. 48 h, 24 h total darkness, 200 W generation when lit, 100 W load, 1000 Wh battery (10 h ideal autonomy).',assumptions,cases:[{label:'A: one 24 h outage',series:a,result:evaluateMission(a,1,assumptions)},{label:'B: four separated 6 h outages',series:b,result:evaluateMission(b,1,assumptions)}]};
}
