import type {Catalog} from '../catalog';
import type {EvidenceManifest} from '../planning-types';
import {parseScenario,type ScenarioState} from '../scenario';
import {EXPERIMENTS,parseTeachingRecords,serializeTeachingRecords,TEACHING_STORAGE_KEY,type ExperimentId,type TeachingRecord} from '../teaching';
export {TEACHING_STORAGE_KEY};
export type StudioDraft={version:1;id:ExperimentId;prediction:string;explanation:string;value:string;baseline:ScenarioState|null;datasetId:string};
export function restoreNotebook(recordsText:string|null,draftText:string|null,c:Catalog,m:EvidenceManifest):{records:TeachingRecord[];draft:StudioDraft|null}{
 const records=parseTeachingRecords(recordsText);
 if(recordsText){const data=JSON.parse(recordsText);if(data.version!==1||!Array.isArray(data.records)||data.records.length!==records.length)throw Error('Notebook format could not be fully restored. Original storage was preserved; export it before replacing.');}
 if(!draftText)return {records,draft:null};
 if(draftText.length>100000)throw Error('Saved notebook draft exceeds its supported bound.');
 const d=JSON.parse(draftText);
 if(d.version!==1||!EXPERIMENTS.some(e=>e.id===d.id))throw Error('Saved notebook draft has an unsupported format.');
 let baseline:ScenarioState|null=null;
 if(d.baseline){if(d.datasetId!==m.datasetId)throw Error('Saved baseline uses a different dataset. Original draft was preserved.');baseline=parseScenario(d.baseline,{siteIds:c.sites.map(s=>s.id),samples:c.meta.n,stepHours:c.meta.stepHours});if(!baseline)throw Error('Saved baseline is invalid for this catalog.');}
 return {records,draft:{version:1,id:d.id,prediction:typeof d.prediction==='string'?d.prediction.slice(0,2000):'',explanation:typeof d.explanation==='string'?d.explanation.slice(0,4000):'',value:typeof d.value==='string'?d.value.slice(0,40):'10',baseline,datasetId:m.datasetId}};
}
export function writeNotebook(storage:Pick<Storage,'setItem'>,records:TeachingRecord[],draft:StudioDraft){
 // Draft first: a quota failure must never silently overwrite the existing records.
 storage.setItem(TEACHING_STORAGE_KEY+'-draft',JSON.stringify(draft));
 storage.setItem(TEACHING_STORAGE_KEY,serializeTeachingRecords(records));
}
