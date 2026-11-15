import type {Catalog} from './catalog';
import type {EvidenceManifest} from './planning-types';
import {parseScenario,type ScenarioState} from './scenario';
import {evaluateScenario} from './assessment';
export async function loadPlanningDemo(catalog:Catalog,manifest:EvidenceManifest):Promise<Array<{role:string;state:ScenarioState}>>{
 let raw=(globalThis as typeof globalThis&{__SOLARREACH_PLANNING_DEMO__?:unknown}).__SOLARREACH_PLANNING_DEMO__;
 if(raw===undefined){const response=await fetch('/data/planning-demo.json');if(!response.ok)throw new Error('The computed demonstration could not load.');raw=await response.json();}
 const data=raw as {schemaVersion?:number;cases?:Array<{role?:unknown;state?:unknown}>};
 if(data?.schemaVersion!==1||!Array.isArray(data.cases)||data.cases.length!==4)throw new Error('Invalid demonstration record.');
 const roles=['baseline','delayed','alternative','unknown-historical'],seen=new Set<string>();
 return data.cases.map(c=>{if(typeof c.role!=='string'||!roles.includes(c.role)||seen.has(c.role))throw new Error('Invalid demonstration roles.');seen.add(c.role);const state=parseScenario(c.state,{siteIds:catalog.sites.map(s=>s.id),samples:catalog.meta.n,stepHours:catalog.meta.stepHours});if(!state)throw new Error('Demonstration inputs are outside current prepared coverage.');evaluateScenario(catalog,state,manifest);return {role:c.role,state};});
}
