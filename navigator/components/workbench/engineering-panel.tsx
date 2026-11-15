'use client';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Info} from './info';
import type {ScenarioState} from '@/lib/scenario';
import type {AssessmentResult} from '@/lib/planning-types';
import {ENGINEERING_SCREEN_FIELDS,parseEngineeringInputs,type EngineeringDomain,type EngineeringScreen} from '@/lib/engineering-screens';
import {engineeringScopeKey,resolveEngineeringScreens} from '@/lib/engineering-context';
const titles:Record<EngineeringDomain,string>={footprint:'Landing-footprint hazards',touchdown:'Touchdown loads & stability',trajectory:'Trajectory & propellant budget','ground-support':'Ground-station capacity',thermal:'Thermal balance & heaters',plume:'Plume keep-out geometry',traverse:'Traverse & return reserves'};
export function EngineeringPanel({state,result,onChange}:{state:ScenarioState;result:AssessmentResult;onChange:(state:ScenarioState)=>void}){
 const [domain,setDomain]=useState<EngineeringDomain>('footprint');
 const screens=result.engineeringScreens??resolveEngineeringScreens(state,result.datasetId),screen=screens.find(s=>s.id===domain)!;
 return <details className="planning-details engineering-workbench"><summary>Engineering screens & evidence closure</summary>
  <p>Calculate a bounded screen for each subsystem using measured or vehicle-specific inputs. Empty inputs remain unknown. These optional calculations accompany the qualified assessment reports below. A supplied screen joins the required checks when its discipline is required; a qualified report is still assessed independently.</p>
  <label>Engineering subsystem<select aria-label="Engineering subsystem" value={domain} onChange={e=>setDomain(e.target.value as EngineeringDomain)}>{Object.keys(titles).map(id=><option key={id} value={id}>{titles[id as EngineeringDomain]}</option>)}</select></label>
  <EngineeringEditor key={`${domain}:${engineeringScopeKey(state,result.datasetId)}:${JSON.stringify(state.engineeringInputs?.[domain])}:${JSON.stringify(state.engineeringEvidence?.[domain])}`} domain={domain} state={state} result={result} screen={screen} onChange={onChange}/>
 </details>;
}
function EngineeringEditor({domain,state,result,screen,onChange}:{domain:EngineeringDomain;state:ScenarioState;result:AssessmentResult;screen:EngineeringScreen;onChange:(state:ScenarioState)=>void}){
 const fields=ENGINEERING_SCREEN_FIELDS[domain],existing=state.engineeringEvidence?.[domain];
 const [draft,setDraft]=useState<Record<string,string>>(()=>Object.fromEntries(fields.map(f=>[f.id,state.engineeringInputs?.[domain]?.[f.id]?.toString()??''])));
 const [source,setSource]=useState(existing?.source??''),[author,setAuthor]=useState(existing?.author??''),[error,setError]=useState('');
 const [dirty,setDirty]=useState(false);
 function apply(){
  const values=Object.fromEntries(Object.entries(draft).filter(([,v])=>v.trim()!=='').map(([key,value])=>[key,Number(value)]));
  const parsed=parseEngineeringInputs({[domain]:values});
  if(!parsed){setError('Enter finite values within each stated range, or clear a field to leave it unknown.');return;}
  setError('');setDirty(false);
  onChange({...state,engineeringInputs:{...state.engineeringInputs,[domain]:parsed[domain]??{}},engineeringEvidence:{...state.engineeringEvidence,[domain]:{scopeKey:engineeringScopeKey(state,result.datasetId),source:source.trim(),author:author.trim()}}});
 }
 return <section aria-label={titles[domain]}>
  <h4>{titles[domain]}</h4><p>Model result: <strong>{dirty?'Unapplied inputs':screen.state==='fail'?'Fails supplied screen':screen.state==='conditional'?'Conditional analytical result':'Not assessed'}</strong></p>
  <div className="planning-input-grid">{fields.map(field=><label key={field.id}><span>{field.label} <Info label={field.label} extra={`${field.intuition} Units: ${field.unit}. ${field.min!==undefined?`Minimum ${field.min}. `:''}${field.max!==undefined?`Maximum ${field.max}. `:''}Limits are supplied mission assumptions; no universal safe value is inferred.`}/></span><span className="engineering-value"><input aria-label={`${field.label} (${field.unit})`} type="number" step="any" min={field.min} max={field.max} value={draft[field.id]??''} onChange={e=>{setDraft({...draft,[field.id]:e.target.value});setDirty(true);}}/><small>{field.unit}</small></span></label>)}</div>
  <label>Input source / report reference<input aria-label="Engineering input source" maxLength={2000} value={source} onChange={e=>{setSource(e.target.value);setDirty(true);}}/></label>
  <label>Responsible author / organization<input aria-label="Engineering input author" maxLength={2000} value={author} onChange={e=>{setAuthor(e.target.value);setDirty(true);}}/></label>
  {error&&<p role="alert">{error}</p>}<Button variant="outline" onClick={apply}>Apply & bind inputs to this site and stay</Button>
  {dirty?<p role="status">Apply these inputs to calculate and include them in scenario comparisons and exports.</p>:<>
   {!!screen.metrics.length&&<div className="planning-table-scroll"><table><caption>{titles[domain]} · modeled values under supplied assumptions</caption><thead><tr><th>Variable</th><th>Value</th><th>Unit</th></tr></thead><tbody>{screen.metrics.map(metric=><tr key={metric.label}><th>{metric.label}</th><td>{metric.value===null?'Unknown':metric.value.toLocaleString('en-US',{maximumSignificantDigits:6})}</td><td>{metric.unit}</td></tr>)}</tbody></table></div>}
   <details><summary>Model assumptions</summary><ul>{screen.assumptions.map(text=><li key={text}>{text}</li>)}</ul></details>
   <details open={screen.state==='not-assessed'}><summary>Remaining evidence needed</summary><ul>{screen.gaps.map(text=><li key={text}>{text}</li>)}</ul></details>
   <p>{screen.sources.map((ref,i)=><span key={ref.url}>{i>0?' · ':''}<a href={ref.url} target="_blank" rel="noreferrer">{ref.label}</a></span>)}</p>
  </>}
 </section>;
}
