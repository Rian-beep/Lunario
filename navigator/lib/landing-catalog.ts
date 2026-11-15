import type {Catalog,Site} from './catalog';
type LandingRecord={id:string;name:string;lat:number;lon:number;program:string;date:string;outcome:'landed'|'partial'|'attempt';approximate:boolean;sourceUrl:string;summary:string;demHeightM?:number;coordinateKind?:"observed"|"approximate-region"|"planned-target";frame?:string;accuracy?:string;sourceNotes?:string;supportingSourceUrls?:string[]};
/** Published historic coordinates add context, never fabricated polar horizon masks. */
export function withLandingSites(catalog:Catalog,records:readonly LandingRecord[]):Catalog{
  const sites=[...catalog.sites],index=new Map(sites.map((s,i)=>[s.id,i]));
  for(const r of records){
    const mission={program:r.program,date:r.date,outcome:r.outcome,approximate:r.approximate,coordinateKind:r.coordinateKind,frame:r.frame,accuracy:r.accuracy,sourceNotes:r.sourceNotes,supportingSourceUrls:r.supportingSourceUrls};
    const existing=index.get(r.id);
    if(existing!==undefined){sites[existing]={...sites[existing],mission};continue;}
    const site:Site={id:r.id,name:r.name,lat:r.lat,lon:r.lon,group:r.outcome==='attempt'?'attempt':r.program.toLowerCase().includes('apollo')?'apollo':'robotic',summary:r.summary,source:r.program+' location source',sourceUrl:r.sourceUrl,demHeightM:r.demHeightM??null,slopeDeg:null,horizons:[],mission};
    index.set(site.id,sites.length);sites.push(site);
  }
  return {...catalog,sites};
}
