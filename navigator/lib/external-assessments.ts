import type {ExternalAssessment} from './planning-types';
export type ExternalMetadata=Pick<ExternalAssessment,'sourceUrl'|'documentTitle'|'assessedUtc'|'scopeNote'>;
/** Optional structured metadata preserves legacy reports without inventing a report date. */
export function parseExternalMetadata(value:unknown):ExternalMetadata|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const v=value as Record<string,unknown>,out:ExternalMetadata={};
 for(const key of ['sourceUrl','documentTitle','assessedUtc','scopeNote'] as const){
  if(v[key]===undefined)continue;
  if(typeof v[key]!=='string'||v[key].length>4000)return null;
  const text=v[key].trim();if(!text)continue;
  if(key==='sourceUrl'){try{const url=new URL(text);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return null;out.sourceUrl=url.href;}catch{return null;}}
  else if(key==='assessedUtc'){
   if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(text)||!Number.isFinite(Date.parse(text)))return null;
   const normalized=new Date(text).toISOString();if(normalized.slice(0,19)!==text.slice(0,19))return null;out.assessedUtc=normalized;
  }else out[key]=text;
 }
 return out;
}
