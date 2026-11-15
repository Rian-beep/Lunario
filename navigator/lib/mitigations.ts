import {planningKey,PLANNING_MODEL_VERSION} from './assessment';
import type {AssessmentResult} from './planning-types';
import type {ScenarioState} from './scenario';
import {classifyScenarioDiff,diffScenarios,type ScenarioDifference} from './scenario-diff';
export type TestedCandidate={state:ScenarioState;assessment:AssessmentResult};
export type Alternative={state:ScenarioState;assessment:AssessmentResult;differences:ScenarioDifference[];changedPaths:string[];multivariable:boolean;passing:boolean;conditional:boolean;label:string;newlyFailingConstraints:string[];metrics:Array<{id:string;before:number|null;after:number|null;unit:string|null}>};
/** Inputs must be actual evaluated outputs; identity checks detect stale/cross-model results, not forgery. */
export function findTestedAlternatives(baseAssessment:AssessmentResult,candidates:TestedCandidate[],options:{baseState:ScenarioState;includeMultivariable?:boolean}):Alternative[]{
 const identity=(state:ScenarioState)=>planningKey({state,datasetId:baseAssessment.datasetId,modelVersion:PLANNING_MODEL_VERSION});
 if(baseAssessment.modelVersion!==PLANNING_MODEL_VERSION||baseAssessment.scenarioKey!==identity(options.baseState))throw new Error('Baseline assessment identity does not match scenario/model');
 const alternatives:Alternative[]=[];const seen=new Set<string>();
 for(const candidate of candidates){
  const {state,assessment}=candidate;
  if(assessment.datasetId!==baseAssessment.datasetId||assessment.modelVersion!==baseAssessment.modelVersion||assessment.scenarioKey!==identity(state))throw new Error('Candidate assessment identity does not match scenario/dataset/model');
  if(seen.has(assessment.scenarioKey))continue;seen.add(assessment.scenarioKey);
  const differences=diffScenarios(options.baseState,state),category=classifyScenarioDiff(differences);
  if(!differences.length)continue;
  const allowed=new Set(['siteId','custom','custom.lat','custom.lon','startIndex','endIndex','mission.batteryWh','mission.loadW','mission.initialSoc','arrayHeightM','antennaHeightM']);
  if(differences.some(d=>!allowed.has(d.path)))continue; // Relaxing requirements is not a hardware/date mitigation.
  // Two inclusive date endpoints move together as a single arrival change only if stay length is preserved.
  const dateOnly=category==='date-only'&&state.endIndex-state.startIndex===options.baseState.endIndex-options.baseState.startIndex;
  const siteOnly=category==='site-only';
  const multivariable=!(differences.length===1||dateOnly||siteOnly);
  if(multivariable&&!options.includeMultivariable)continue;
  const passing=assessment.outcome==='passes-assessed',conditional=assessment.outcome==='conditional';
  alternatives.push({state:structuredClone(state),assessment:structuredClone(assessment),differences,changedPaths:differences.map(d=>d.path),multivariable,passing,conditional,label:passing?'Passing tested alternative':conditional?'Conditional tested alternative':'Tested alternative does not pass the whole assessment',newlyFailingConstraints:assessment.constraints.filter(c=>c.required&&c.state==='fail'&&!baseAssessment.constraints.some(b=>b.id===c.id&&b.state==='fail')).map(c=>c.id),metrics:assessment.constraints.map(c=>({id:c.id,before:baseAssessment.constraints.find(b=>b.id===c.id)?.actual??null,after:c.actual,unit:c.unit}))});
 }
 const capacities=alternatives.filter(a=>a.passing&&a.differences.length===1&&a.differences[0].path==='mission.batteryWh');
 const smallest=Math.min(...capacities.map(a=>a.state.mission.batteryWh));
 for(const a of capacities)if(a.state.mission.batteryWh===smallest)a.label='Smallest passing capacity among tested values';
 return alternatives;
}
