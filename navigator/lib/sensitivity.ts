import type {Catalog} from './catalog';
import {evaluateScenario,planningKey,PLANNING_MODEL_VERSION} from './assessment';
import type {AssessmentResult,EvidenceManifest} from './planning-types';
import {parseScenario,type ScenarioState} from './scenario';
import {diffScenarios} from './scenario-diff';
export type SweepField='arrivalOffsetHours'|'loadMultiplier'|'batteryWh'|'initialSoc'|'arrayHeightM'|'antennaHeightM';
export type SweepAxis={field:SweepField;values:number[]};
export type SensitivityCase={values:number[];state:ScenarioState|null;assessment:AssessmentResult|null;error:string|null;changedPaths:string[]};
export type SensitivityResult={baseKey:string;key:string;axes:SweepAxis[];cases:SensitivityCase[];counts:Record<AssessmentResult['outcome']|'invalid',number>};
export type SweepProgress={completed:number;total:number;key:string};
const fields:SweepField[]=['arrivalOffsetHours','loadMultiplier','batteryWh','initialSoc','arrayHeightM','antennaHeightM'];
const aborted=(signal?:AbortSignal)=>{if(signal?.aborted)throw new DOMException('Sensitivity sweep cancelled','AbortError');};
export function sensitivityKey(base:ScenarioState,manifest:EvidenceManifest,axes:SweepAxis[]):string {
 return planningKey({base,manifest,axes,modelVersion:PLANNING_MODEL_VERSION});
}
/** A finite experiment, never a probability distribution. No internal result cache. */
export async function runSensitivity(catalog:Catalog,manifest:EvidenceManifest,base:ScenarioState,axes:SweepAxis[],options:{signal?:AbortSignal;onProgress?:(progress:SweepProgress)=>void}={}):Promise<SensitivityResult>{
 aborted(options.signal);
 if(!Array.isArray(axes)||axes.length<1||axes.length>2)throw new Error('Supply one or two sweep axes');
 const seen=new Set<string>();
 for(const axis of axes){
  if(!fields.includes(axis.field)||seen.has(axis.field))throw new Error('Sweep fields must be supported and unique');
  seen.add(axis.field);
  if(!Array.isArray(axis.values)||axis.values.length<1||axis.values.length>9||axis.values.some(v=>typeof v!=='number'||!Number.isFinite(v)))throw new Error('Each axis requires 1–9 finite numeric values');
 }
 const bounds={siteIds:catalog.sites.map(s=>s.id),samples:catalog.meta.n,stepHours:catalog.meta.stepHours};
 if(!parseScenario(base,bounds))throw new Error('Baseline scenario is invalid');
 // Validate complete baseline evidence coverage before starting a derived experiment.
 const baseline=evaluateScenario(catalog,base,manifest);
 const frozenAxes=structuredClone(axes),frozenBase=structuredClone(base),frozenManifest=structuredClone(manifest);
 const key=sensitivityKey(frozenBase,frozenManifest,frozenAxes);
 const combinations=frozenAxes.reduce<number[][]>((rows,axis)=>rows.flatMap(row=>axis.values.map(v=>[...row,v])),[[]]);
 const result:SensitivityResult={baseKey:baseline.scenarioKey,key,axes:frozenAxes,cases:[],counts:{'passes-assessed':0,'conditional':0,'incomplete':0,'fails-assessed':0,'not-configured':0,invalid:0}};
 let sliceStart=performance.now();
 for(const values of combinations){
  aborted(options.signal);
  let state:ScenarioState|null=structuredClone(frozenBase),assessment:AssessmentResult|null=null,error:string|null=null,changedPaths:string[]=[];
  try{
   for(let i=0;i<frozenAxes.length;i++){
    const field=frozenAxes[i].field,value=values[i];
    if(field==='arrivalOffsetHours'){
     const offset=value/catalog.meta.stepHours;
     if(!Number.isInteger(offset))throw new Error('Arrival offset must align with the actual catalog time step');
     state.startIndex+=offset;state.endIndex+=offset;
    }else if(field==='loadMultiplier'){
     if(value<0)throw new Error('Load multiplier cannot be negative');
     state.mission.loadW=frozenBase.mission.loadW*value;
    }else if(field==='batteryWh'||field==='initialSoc')state.mission[field]=value;
    else state[field]=value;
   }
   if(!parseScenario(state,bounds))throw new Error('Variant exceeds supported scenario, date, capacity, state-of-charge or prepared-height bounds; stay was not trimmed');
   changedPaths=diffScenarios(frozenBase,state).map(d=>d.path);
   assessment=evaluateScenario(catalog,state,frozenManifest);
  }catch(cause){error=cause instanceof Error?cause.message:String(cause);state=null;assessment=null;}
  aborted(options.signal);
  result.cases.push({values:[...values],state,assessment,error,changedPaths});
  result.counts[assessment?.outcome??'invalid']++;
  options.onProgress?.({completed:result.cases.length,total:combinations.length,key});
  aborted(options.signal);
  if(performance.now()-sliceStart>=8){await new Promise<void>(resolve=>setTimeout(resolve,0));aborted(options.signal);sliceStart=performance.now();}
 }
 return result;
}
