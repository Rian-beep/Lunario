import {evaluateScenario} from '../assessment';
import type {Catalog} from '../catalog';
import {linkBudget} from '../mission';
import type {AssessmentResult,EvidenceManifest} from '../planning-types';
import {parseScenario,type ScenarioState} from '../scenario';
import {teachingCandidate,type ExperimentId} from '../teaching';
export type ResponsePoint={x:number;label:string;terrain:number|null;sphere:number|null};
export type ControlledResponse={candidate:ScenarioState;assessment:AssessmentResult;points:ResponsePoint[];xLabel:string;yLabel:string;unit:string;held:string};
export function experimentValue(state:ScenarioState,id:ExperimentId):number|string|null{
 if(id==='array-height')return state.arrayHeightM;if(id==='antenna-height')return state.antennaHeightM;
 if(id==='orientation')return state.mission.arrayMode;if(id==='load')return state.mission.loadW;
 if(id==='storage')return state.mission.batteryWh;return state.radio?.txPowerW??null;
}
export function controlledResponse(c:Catalog,m:EvidenceManifest,base:ScenarioState,id:ExperimentId,value:number|string):ControlledResponse{
 const candidate=teachingCandidate(base,id,value);
 const valid=(s:ScenarioState)=>{if(!parseScenario(s,{siteIds:c.sites.map(s=>s.id),samples:c.meta.n,stepHours:c.meta.stepHours}))throw Error('Candidate exceeds the supported scenario bounds.');return evaluateScenario(c,s,m);};
 const assessment=valid(candidate),v=Number(experimentValue(base,id)??value);
 const raw=id.includes('height')?[0,2,10]:id==='orientation'?['fixed','tracking']:[0,v*.5,v,v*1.5,Number(value)];
 const max=id==='load'?1e6:id==='storage'?1e9:1e12;
 const values=[...new Set(raw.map(x=>typeof x==='number'?Math.min(max,x):x))].sort((a,b)=>Number(a)-Number(b));
 const metrics=(s:ScenarioState,a:AssessmentResult,sphere:boolean)=>{
  const result=sphere?a.sphereMission:a.mission;
  if(id==='array-height'||id==='orientation')return result.generatedWh;
  if(id==='antenna-height')return result.contactFraction===null?null:100*result.contactFraction;
  if(id==='link')return linkBudget(s.radio??{})?.marginDb??null;
  return result.minBatteryWh;
 };
 const points=values.map((x,i)=>{const s=teachingCandidate(base,id,x),a=valid(s);return {x:typeof x==='string'?i:x,label:String(x),terrain:metrics(s,a,false),sphere:metrics(s,a,true)};});
 const labels={
  'array-height':['Array height (m)','Generated energy (Wh)','Wh'],
  'antenna-height':['Antenna height (m)','Geometric Earth contact (%)','%'],
  orientation:['Array mode (category)','Generated energy (Wh)','Wh'],
  load:['Constant demand (W)','Minimum stored energy (Wh)','Wh'],
  storage:['Battery capacity (Wh)','Minimum stored energy (Wh)','Wh'],
  link:['Transmit power (W)','Assumed free-space radio margin (dB)','dB'],
 }[id];
 return {candidate,assessment,points,xLabel:labels[0],yLabel:labels[1],unit:labels[2],held:'All captured inputs are held fixed except '+({ 'array-height':'array height','antenna-height':'antenna height',orientation:'array orientation mode',load:'constant electrical demand',storage:'battery capacity',link:'assumed transmit power'}[id])+'. Dates, requirements, scheduled operations and the other subsystem height stay fixed.'};
}
export type SolarConstants={area:number;efficiency:number;loss:number;visibleIncidence:number};
export const ILLUSTRATIVE_SOLAR:SolarConstants={area:4,efficiency:.3,loss:.15,visibleIncidence:1};
export function illustrativeDerivative(k:SolarConstants){
 if(![k.area,k.efficiency,k.loss,k.visibleIncidence].every(Number.isFinite)||k.area<0||[k.efficiency,k.loss,k.visibleIncidence].some(x=>x<0||x>1))throw Error('Invalid illustrative solar constants');
 return {value:k.area*k.efficiency*(1-k.loss)*k.visibleIncidence,unit:'m²',meaning:'W of generated power per additional W/m² of irradiance'};
}
/** Differentiate the existing authority at unit irradiance: geometry and operations stay fixed. */
export function selectedSolarResponse(c:Catalog,m:EvidenceManifest,state:ScenarioState,localIndex:number){
 if(!Number.isInteger(localIndex)||localIndex<0||localIndex>state.endIndex-state.startIndex)throw Error('Choose a sampled interval inside the captured stay.');
 const at=(solarFlux:number)=>evaluateScenario(c,{...structuredClone(state),mission:{...state.mission,solarFlux}},m);
 const unit=at(1),sample=unit.mission.timeline[localIndex],smooth=unit.sphereMission.timeline[localIndex];
 const derivative=sample.powerW,sphereDerivative=smooth.powerW;
 const fluxes=[...new Set([0,500,1000,1500,2000,state.mission.solarFlux])].sort((a,b)=>a-b);
 const points=fluxes.map(x=>{const a=at(x);return {x,label:String(x),terrain:a.mission.timeline[localIndex].powerW,sphere:a.sphereMission.timeline[localIndex].powerW};});
 return {derivative,sphereDerivative,unit:'m²',points,assumptions:{...state.mission},interval:sample,activeFactor:derivative===null?null:state.mission.areaM2*state.mission.efficiency*(1-state.mission.lossFraction)>0?derivative/(state.mission.areaM2*state.mission.efficiency*(1-state.mission.lossFraction)):null};
}
export function controlledFiniteRate(response:ControlledResponse,base:ScenarioState,id:ExperimentId,value:number|string){
 const unit={ 'array-height':'Wh/m','antenna-height':'percentage points/m',orientation:'not numeric',load:'Wh/W',storage:'Wh/Wh',link:'dB/W'}[id];
 const initial=experimentValue(base,id);
 if(id==='orientation'||initial===null||typeof value!=='number'||!Number.isFinite(value)||typeof initial!=='number'||value===initial)return {value:null,unit};
 const before=response.points.find(p=>p.x===initial),after=response.points.find(p=>p.x===value);
 const rate=before?.terrain==null||after?.terrain==null?null:(after.terrain-before.terrain)/(value-initial);
 return {value:rate,unit};
}
