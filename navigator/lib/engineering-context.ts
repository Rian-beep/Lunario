import type {ScenarioState} from './scenario';
import {ENGINEERING_SCREEN_FIELDS,evaluateEngineeringScreens,type EngineeringDomain,type EngineeringScreen} from './engineering-screens';
export type EngineeringEvidence=Partial<Record<EngineeringDomain,{scopeKey:string;source:string;author:string}>>;
/** Measurements bind to location, stay and installed numerical evidence, not camera state. */
export function engineeringScopeKey(state:Pick<ScenarioState,'siteId'|'custom'|'startIndex'|'endIndex'>,datasetId:string):string{
 return JSON.stringify([datasetId,state.siteId,state.custom?[state.custom.lat,((state.custom.lon%360)+360)%360]:null,state.startIndex,state.endIndex]);
}
export function parseEngineeringEvidence(value:unknown):EngineeringEvidence|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const result:EngineeringEvidence={};
 for(const [domain,entry] of Object.entries(value)){
  if(!Object.hasOwn(ENGINEERING_SCREEN_FIELDS,domain)||!entry||typeof entry!=='object'||Array.isArray(entry))return null;
  const record=entry as Record<string,unknown>;
  if(Object.keys(record).some(k=>!['scopeKey','source','author'].includes(k))||!['scopeKey','source','author'].every(k=>typeof record[k]==='string'&&(record[k] as string).length<=2000)||!(record.scopeKey as string))return null;
  result[domain as EngineeringDomain]={scopeKey:record.scopeKey as string,source:record.source as string,author:record.author as string};
 }
 return result;
}
export function resolveEngineeringScreens(state:ScenarioState,datasetId:string):EngineeringScreen[]{
 const key=engineeringScopeKey(state,datasetId);
 return evaluateEngineeringScreens(state.engineeringInputs??{}).map(screen=>{
  if(!Object.keys(state.engineeringInputs?.[screen.id]??{}).length)return screen;
  const evidence=state.engineeringEvidence?.[screen.id];
  if(!evidence||evidence.scopeKey!==key)return {...screen,state:'not-assessed',metrics:screen.metrics.map(m=>({...m,value:null})),gaps:['Inputs belong to another site, stay or dataset, or have no scope record. Re-enter or explicitly reconfirm the supporting inputs for this scenario.',...screen.gaps]};
  return {...screen,gaps:[...(!evidence.source.trim()||!evidence.author.trim()?['Input source and responsible author have not been supplied. These are unverified user assumptions.']:[]),...screen.gaps]};
 });
}
/** A difference can overflow even when both separately stored values are finite. */
export function engineeringDifference(value:number|null,reference:number|null):number|null{
 if(value===null||reference===null||!Number.isFinite(value)||!Number.isFinite(reference))return null;
 const delta=value-reference;return Number.isFinite(delta)?delta:null;
}
