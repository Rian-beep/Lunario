'use client';
import {useMemo,useState} from 'react';
import type {ScenarioState} from '@/lib/scenario';
import type {AssessmentResult} from '@/lib/planning-types';
import {ENGINEERING_SCREEN_FIELDS,type EngineeringDomain} from '@/lib/engineering-screens';
import {engineeringDifference,engineeringScopeKey} from '@/lib/engineering-context';
import {Button} from '@/components/ui/button';
import {csvCell} from '@/lib/export';
type Row={id:string;name:string;state:ScenarioState;assessment:AssessmentResult|null};
type Column={id:string;domain:EngineeringDomain;key:string;label:string;unit:string;kind:'input'|'result'};
export function EngineeringComparison({rows,referenceId}:{rows:Row[];referenceId?:string}){
 const columns=useMemo(()=>{
  const all:Column[]=[];
  for(const domain of Object.keys(ENGINEERING_SCREEN_FIELDS) as EngineeringDomain[])for(const f of ENGINEERING_SCREEN_FIELDS[domain])all.push({id:`input:${domain}:${f.id}`,domain,key:f.id,label:f.label,unit:f.unit,kind:'input'});
  for(const row of rows)for(const screen of row.assessment?.engineeringScreens??[])for(const m of screen.metrics){const id=`result:${screen.id}:${m.label}`;if(!all.some(c=>c.id===id))all.push({id,domain:screen.id,key:m.label,label:m.label,unit:m.unit,kind:'result'});}
  return all;
 },[rows]);
 const [selected,setSelected]=useState<string[]>([]),[candidate,setCandidate]=useState(''),[sort,setSort]=useState<{id:string;ascending:boolean}|null>(null);
 const active=columns.filter(c=>selected.includes(c.id)),reference=rows.find(r=>r.id===referenceId);
 function read(row:Row,c:Column):number|null{
  if(!row.assessment||row.state.engineeringEvidence?.[c.domain]?.scopeKey!==engineeringScopeKey(row.state,row.assessment.datasetId))return null;
  const value=c.kind==='input'?row.state.engineeringInputs?.[c.domain]?.[c.key]:row.assessment.engineeringScreens?.find(s=>s.id===c.domain)?.metrics.find(m=>m.label===c.key)?.value;
  return typeof value==='number'&&Number.isFinite(value)?value:null;
 }
 const ordered=[...rows].sort((a,b)=>{const c=active.find(c=>c.id===sort?.id);if(!c||!sort)return 0;const av=read(a,c),bv=read(b,c);return av===null?(bv===null?0:1):bv===null?-1:(av-bv)*(sort.ascending?1:-1);});
 function exportCsv(){const text=[['Scenario ID','Scenario','Site ID','Custom latitude deg','Custom longitude degE','Start forcing index inclusive','End forcing index inclusive','Dataset ID','Model version','Engineering input provenance JSON',...active.map(c=>`${c.label} (${c.unit}; ${c.kind})`)],...ordered.map(r=>[r.id,r.name,r.state.siteId,r.state.custom?.lat??'',r.state.custom?.lon??'',r.state.startIndex,r.state.endIndex,r.assessment?.datasetId??'',r.assessment?.modelVersion??'',JSON.stringify(r.state.engineeringEvidence??{}),...active.map(c=>read(r,c))])].map(row=>row.map(csvCell).join(',')).join('\n');const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='lunar-engineering-comparison.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <details className="planning-details"><summary>Compare engineering variables</summary><p>Choose supplied inputs and calculated values across saved site–date scenarios. Unknown or stale values stay blank; margins retain their model assumptions. Δ uses the reference scenario above.</p>
  <label>Engineering comparison variable<select aria-label="Engineering comparison variable" value={candidate} onChange={e=>setCandidate(e.target.value)}><option value="">Choose a variable</option>{columns.filter(c=>!selected.includes(c.id)).map(c=><option key={c.id} value={c.id}>{c.domain} · {c.label} ({c.unit}; {c.kind})</option>)}</select></label>
  <Button variant="outline" disabled={!candidate} onClick={()=>{setSelected(v=>[...v,candidate]);setCandidate('');}}>Add engineering variable</Button>
  {active.length>0&&<><div>{active.map(c=><Button key={c.id} variant="ghost" onClick={()=>setSelected(v=>v.filter(id=>id!==c.id))} aria-label={`Remove engineering column ${c.label}`}>{c.label} ×</Button>)}</div><Button variant="outline" onClick={exportCsv}>Export engineering comparison CSV</Button><div className="planning-table-scroll"><table><caption>Scoped engineering inputs and analytical results · no qualified landing approval</caption><thead><tr><th>Scenario</th>{active.map(c=><th key={c.id}><button onClick={()=>setSort({id:c.id,ascending:sort?.id===c.id?!sort.ascending:true})}>{c.label} ({c.unit})</button></th>)}</tr></thead><tbody>{ordered.map(row=><tr key={row.id}><th>{row.name}</th>{active.map(c=>{const value=read(row,c),base=reference?read(reference,c):null,delta=engineeringDifference(value,base);return <td key={c.id}>{value===null?'Unknown':value.toLocaleString('en-US',{maximumSignificantDigits:6})}{value!==null&&base!==null&&row.id!==referenceId&&<small> Δ {delta===null?'Unknown':`${delta>=0?'+':''}${delta.toLocaleString('en-US',{maximumSignificantDigits:4})}`}</small>}</td>;})}</tr>)}</tbody></table></div></>}
 </details>;
}
