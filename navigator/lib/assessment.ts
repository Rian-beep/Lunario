import {resolveEngineeringScreens} from './engineering-context';
import {ENGINEERING_EXTERNAL_IDS} from './engineering-screens';
import {toMissionEvent} from './mission-events';
import {parseScenario} from './scenario';
import {summarize} from './astro';
import {resolveAnalysisContext} from './analysis-context';
import type {Catalog} from './catalog';
import {evaluateMission,linkBudget,type MissionResult} from './mission';
import type {ScenarioState} from './scenario';
import {DEFAULT_OPERATIONS,DEFAULT_REQUIREMENTS,EXTERNAL_IDS,type AssessmentContext,type AssessmentResult,type ConstraintResult,type EvidenceManifest,type MissionEvent,type PlanningRequirements} from './planning-types';
export const PLANNING_MODEL_VERSION='planning-5';
/** Stable input identity, not a cryptographic signature or asset integrity hash. */
function canonical(value:unknown):string{
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
 return JSON.stringify(value)??'null';
}
export function planningKey(value:unknown):string{
 const text=canonical(value);let a=2166136261,b=5381;
 for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b,33)^text.charCodeAt(i);}
 return `${PLANNING_MODEL_VERSION}-${(a>>>0).toString(16)}-${(b>>>0).toString(16)}-${text.length}`;
}
export function evidenceScopeKey(state:ScenarioState,datasetId:string):string{
 const value={...state} as Record<string,unknown>;delete value.externalAssessments;
 if(state.custom)value.custom={...state.custom,lon:((state.custom.lon%360)+360)%360};
 return planningKey({state:value,datasetId,modelVersion:PLANNING_MODEL_VERSION});
}
const finite=(v:number|null|undefined):number|null=>typeof v==='number'&&Number.isFinite(v)?v:null;
const tolerance=1e-9;
export function assessConstraints(state:ScenarioState,context:AssessmentContext,mission:MissionResult,sphereMission:MissionResult):ConstraintResult[]{
 void sphereMission;
 const requirements=(state as ScenarioState&{requirements?:PlanningRequirements}).requirements??DEFAULT_REQUIREMENTS;
 const rows:ConstraintResult[]=[];
 const step=(Date.parse(context.endUtcExclusive)-Date.parse(context.startUtc))/3600000/mission.timeline.length;
 const event=(kind:MissionEvent['kind'],index:number,offset:number|null=null):MissionEvent=>({kind,intervalIndex:index,earliestUtc:new Date(Date.parse(context.startUtc)+index*step*3600000).toISOString(),latestUtc:new Date(Date.parse(context.startUtc)+(index+1)*step*3600000).toISOString(),modelOffsetHours:offset,evidenceIds:kind==='critical-contact'||kind==='outage-limit'?['ephemeris','antenna-horizon']:['ephemeris','array-horizon']});
 const coverage=(ids:string[])=>context.evidence.filter(e=>ids.includes(e.id));
 const numeric=(id:string,label:string,required:boolean,actual:number|null,limit:number|null,unit:string,relation:'min'|'max'|'zero',ids:string[],first:MissionEvent|null=null)=>{
  ids=ids.some(id=>id==='array-horizon'||id==='antenna-horizon')?[...new Set(['ephemeris',...ids])]:ids;
  const refs=coverage(ids),borrowed=refs.some(e=>e.coverage==='borrowed'),partial=refs.some(e=>e.coverage==='partial');
  actual=finite(actual);limit=finite(limit);
  const margin=actual===null||limit===null?null:relation==='min'?actual-limit:limit-actual;
  const state=margin===null?'not-assessed':margin< -tolerance?'fail':borrowed||partial?'conditional':'pass';
  rows.push({id,label,required,state,actual,limit,margin,unit,relation,reasonCode:state==='fail'?(borrowed?'model-failure-borrowed-horizon':'modeled-requirement-violation'):state==='conditional'?'approximate-or-partial-evidence':margin===null?(limit===null?'not-configured':'metric-unavailable'):'modeled-requirement-met',explanation:state==='conditional'?'Requirement met in the prepared model; incomplete or borrowed evidence prevents an unconditional assessment.':state==='fail'?'The model violates this configured requirement. This does not establish physical failure beyond the model assumptions.':margin===null?'A limit or required metric is unavailable.':'Requirement met under the stated model assumptions.',evidenceIds:ids,firstViolation:state==='fail'?first:null});
 };
 const reserve=state.mission.batteryWh*state.mission.reserveSoc;
 const reserveIndex=mission.timeline.findIndex(t=>t.batteryWh!==null&&t.batteryWh<reserve-tolerance);
 const reserveEvent=mission.events?.find(e=>e.kind==='reserve-crossing');
 const unmetEvent=mission.events?.find(e=>e.kind==='unserved-load');
 const knownUnmet=mission.subsegments.reduce((sum,t)=>sum+(t.unmetWh??0),0);
 const knownBattery=mission.subsegments.flatMap(t=>[t.startBatteryWh,t.batteryWh].filter((v):v is number=>v!==null));
 const knownMin=Math.min(state.mission.batteryWh*state.mission.initialSoc,...knownBattery);
 numeric('reserve','Stored energy reserve',requirements.requireReserve,mission.minBatteryWh??(knownMin<reserve-tolerance?knownMin:null),reserve,'Wh','min',['array-horizon'],reserveEvent?toMissionEvent(reserveEvent,context.startUtc,['array-horizon','ephemeris']):reserveIndex>=0?event('reserve-crossing',reserveIndex):null);
 numeric('unmet-demand','Unserved electrical demand',requirements.requireZeroUnmetWh,mission.unmetWh??(knownUnmet>0?knownUnmet:null),0,'Wh','zero',['array-horizon'],unmetEvent?toMissionEvent(unmetEvent,context.startUtc,['array-horizon','ephemeris']):null);
 let outage=0,outageIndex=-1,longestKnownOutage=0;
 mission.timeline.forEach((t,i)=>{outage=t.contact===false?outage+step:0;longestKnownOutage=Math.max(longestKnownOutage,outage);if(outageIndex<0&&requirements.maxGeometricOutageHours!==null&&outage>requirements.maxGeometricOutageHours+tolerance)outageIndex=i;});
 numeric('geometric-outage','Maximum geometric Earth outage',requirements.maxGeometricOutageHours!==null,mission.longestBlackoutHours??(outageIndex>=0?longestKnownOutage:null),requirements.maxGeometricOutageHours,'h','max',['antenna-horizon'],outageIndex>=0?event('outage-limit',outageIndex):null);
 const radio=linkBudget(state.radio??{});
 numeric('assumed-radio','Assumed free-space radio margin',requirements.minAssumedRadioMarginDb!==null,radio?.marginDb??null,requirements.minAssumedRadioMarginDb,'dB','min',['user-assumptions']);
 for(const window of requirements.criticalContacts){
  const indices=mission.timeline.flatMap((_,i)=>i*step<window.endOffsetHours&&(i+1)*step>window.startOffsetHours?[i]:[]);
  const failed=indices.find(i=>mission.timeline[i].contact===false),unknown=indices.some(i=>mission.timeline[i].contact===null);
  numeric(`critical-contact:${window.id}`,`Critical Earth visibility: ${window.id}`,true,failed!==undefined?0:unknown?null:1,1,'fraction','min',['antenna-horizon'],failed!==undefined?event('critical-contact',failed):null);
 }
 const summary=summarize(context.arraySeries,step);
 const solarKnown=mission.timeline.every(t=>t.sun!==null);
 const sunFraction=solarKnown?mission.timeline.filter(t=>t.sun).length/mission.timeline.length:null;
 const screens=requirements.extraScreens;
 const metrics={minSunFraction:sunFraction,minContactFraction:mission.contactFraction,maxDarkHours:finite(summary.longestDarkTerrain),maxBlackoutHours:mission.longestBlackoutHours,maxSlopeDeg:state.custom?null:context.site.slopeDeg,minBatteryWh:mission.minBatteryWh,maxUnmetWh:mission.unmetWh};
 for(const key of Object.keys(metrics) as (keyof typeof metrics)[]){const limit=screens[key];if(limit===undefined||limit===null)continue;numeric(`screen:${key}`,`Additional screen: ${key}`,true,metrics[key],limit,key.includes('Fraction')?'fraction':key.includes('Wh')?'Wh':key.includes('Slope')?'°':'h',key.startsWith('min')?'min':'max',[key.includes('Contact')||key.includes('Blackout')?'antenna-horizon':'array-horizon']);}
 const required=new Set([...requirements.requiredExternal,...(requirements.scope==='landing-readiness'?[...EXTERNAL_IDS.slice(0,7),'navigation-guidance']:[])]);
 const reports=(state as ScenarioState&{externalAssessments?:Array<{id:string;status:string;source:string;author:string;scenarioKey:string}>}).externalAssessments??[];
 const scopeKey=evidenceScopeKey(state,context.datasetId);
 for(const id of EXTERNAL_IDS){
  const report=reports.find(r=>r.id===id),current=report?.scenarioKey===scopeKey;
  const status=!report||!current||report.status==='unknown'?'not-assessed':report.status==='reported-fail'?'fail':'conditional';
  rows.push({id,label:id.replaceAll('-',' '),required:required.has(id),state:status,actual:null,limit:null,margin:null,unit:null,relation:'evidence',reasonCode:!report?'external-evidence-missing':!current?'external-report-stale':`external-${report.status}`,explanation:!report?'No assessment supplied. Regional terrain, preview trajectories and imagery do not certify this consideration.':!current?'Report belongs to different scenario inputs; reassessment is required.':`User-provided report by ${report.author}, source ${report.source}. A reported pass remains externally reported, not internally verified.`,evidenceIds:['landing-readiness'],firstViolation:null});
 }
 for(const screen of resolveEngineeringScreens(state,context.datasetId)){
  if(!Object.keys(state.engineeringInputs?.[screen.id]??{}).length)continue;
  rows.push({id:`engineering:${screen.id}`,label:screen.title,required:required.has(ENGINEERING_EXTERNAL_IDS[screen.id]),state:screen.state,actual:null,limit:null,margin:null,unit:null,relation:'evidence',reasonCode:`analytical-screen-${screen.state}`,explanation:[...screen.assumptions,...screen.gaps].join(' '),evidenceIds:['user-assumptions'],firstViolation:null});
 }
 return rows;
}
export function assessmentOutcome(rows:ConstraintResult[]):AssessmentResult['outcome']{
 const required=rows.filter(r=>r.required);
 if(required.some(r=>r.state==='fail'))return 'fails-assessed';
 if(required.some(r=>r.state==='not-assessed'))return 'incomplete';
 if(required.some(r=>r.state==='conditional'))return 'conditional';
 return required.length?'passes-assessed':'not-configured';
}
export function evaluateScenario(catalog:Catalog,state:ScenarioState,manifest:EvidenceManifest):AssessmentResult{
 const parsed=parseScenario(state,{siteIds:catalog.sites.map(s=>s.id),samples:catalog.meta.n,stepHours:catalog.meta.stepHours});
 if(!parsed)throw new Error('Scenario requirements, operations or dates are invalid; inputs were not trimmed.');
 state=parsed;
 const extended=state as ScenarioState&{arrayHeightM?:number;antennaHeightM?:number;operations?:typeof DEFAULT_OPERATIONS;requirements?:PlanningRequirements};
 const context=resolveAnalysisContext(catalog,{terrainMode:state.terrainMode,siteId:state.siteId,custom:state.custom,startIndex:state.startIndex,endIndex:state.endIndex,arrayHeightM:extended.arrayHeightM??state.heightM,antennaHeightM:extended.antennaHeightM??state.heightM,displayHeightM:state.heightM},manifest);
 const options={contactSeries:context.antennaSeries,operations:extended.operations??DEFAULT_OPERATIONS};
 const mission=evaluateMission(context.arraySeries,catalog.meta.stepHours,state.mission,false,options),sphereMission=evaluateMission(context.arraySeries,catalog.meta.stepHours,state.mission,true,options);
 const constraints=assessConstraints(state,context,mission,sphereMission);
 const events=constraints.filter(c=>c.required&&c.state==='fail'&&c.firstViolation).map(c=>c.firstViolation!).sort((a,b)=>Date.parse(a.earliestUtc)-Date.parse(b.earliestUtc));
 const evidence=[...context.evidence,...manifest.entries.filter(e=>['user-assumptions','landing-readiness'].includes(e.id))];
 const warnings=[...context.warnings];
 const firstFailure=events[0]??null;
 const earlierUnknown=mission.events?.some(e=>e.kind==='unknown-data'&&(!firstFailure||Date.parse(context.startUtc)+e.earliestOffsetHours*3600000<=Date.parse(firstFailure.earliestUtc)));
 if(earlierUnknown)warnings.push('First known violation only: an earlier unknown interval may hide a prior failure.');
 else if(mission.knownFraction<1)warnings.push('Unknown generation prevents a complete full-stay assessment.');
 if(context.evidence.some(e=>e.coverage==='partial'))warnings.push('Source frame equivalence or propagated uncertainty remains unquantified; otherwise passing terrain constraints are conditional.');
 return {...(state.engineeringInputs?{engineeringScreens:resolveEngineeringScreens(state,manifest.datasetId)}:{}),datasetId:manifest.datasetId,scenarioKey:planningKey({state,datasetId:manifest.datasetId,modelVersion:PLANNING_MODEL_VERSION}),evidenceScopeKey:evidenceScopeKey(state,manifest.datasetId),modelVersion:PLANNING_MODEL_VERSION,scope:extended.requirements?.scope??'resource-screening',outcome:assessmentOutcome(constraints),constraints,firstFailure,evidence,warnings,mission,sphereMission};
}
