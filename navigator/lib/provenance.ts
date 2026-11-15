import type {EvidenceManifest,EvidenceRef} from './planning-types';
const isRecord=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function parseEvidenceManifest(value:unknown):EvidenceManifest{
 if(!isRecord(value)||value.schemaVersion!==1||typeof value.datasetId!=='string'||!value.datasetId||typeof value.validFromUtc!=='string'||typeof value.validUntilUtcExclusive!=='string'||!Number.isFinite(Date.parse(value.validFromUtc))||!Number.isFinite(Date.parse(value.validUntilUtcExclusive))||Date.parse(value.validFromUtc)>=Date.parse(value.validUntilUtcExclusive)||!Array.isArray(value.entries))throw new Error('Invalid evidence manifest or coverage dates');
 const ids=new Set<string>();
 const entries=value.entries.map((v:unknown)=>{
  if(!isRecord(v)||typeof v.id!=='string'||!v.id||ids.has(v.id)||typeof v.label!=='string'||!['computed','user-assumption','external-report','unavailable'].includes(String(v.kind))||!['complete','partial','unavailable','borrowed'].includes(String(v.coverage))||!Array.isArray(v.notes)||!v.notes.every(n=>typeof n==='string'))throw new Error('Invalid or duplicate evidence entry');
  ids.add(v.id);
  for(const k of ['sourceUrl','productId','version','sha256','frame'])if(v[k]!==null&&typeof v[k]!=='string')throw new Error(`Invalid evidence ${k}`);
  for(const k of ['sourceSpacingM','effectiveResolutionM','outputSpacingM','temporalStepHours','angularStepDeg'])if(v[k]!==null&&(typeof v[k]!=='number'||!Number.isFinite(v[k])||(v[k] as number)<0))throw new Error(`Invalid evidence ${k}`);
  return {...v,notes:[...v.notes]} as EvidenceRef;
 });
 return {schemaVersion:1,datasetId:value.datasetId,validFromUtc:value.validFromUtc,validUntilUtcExclusive:value.validUntilUtcExclusive,entries};
}
export async function loadEvidenceManifest():Promise<EvidenceManifest>{
 const embedded=(globalThis as typeof globalThis&{__SOLARREACH_EVIDENCE__?:unknown}).__SOLARREACH_EVIDENCE__;
 if(embedded!==undefined)return parseEvidenceManifest(embedded);
 const response=await fetch('/data/evidence-manifest.json');
 if(!response.ok)throw new Error(`Evidence manifest unavailable (${response.status})`);
 return parseEvidenceManifest(await response.json());
}
export function evidenceById(manifest:EvidenceManifest,id:string):EvidenceRef{
 return manifest.entries.find(e=>e.id===id)??{id,kind:'unavailable',label:`Missing evidence: ${id}`,sourceUrl:null,productId:null,version:null,sha256:null,frame:null,sourceSpacingM:null,effectiveResolutionM:null,outputSpacingM:null,temporalStepHours:null,angularStepDeg:null,coverage:'unavailable',notes:['No prepared evidence entry is available.']};
}
