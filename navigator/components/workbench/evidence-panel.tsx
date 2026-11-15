'use client';
import {parseExternalMetadata} from '@/lib/external-assessments';
import {useState} from 'react';
import type {ScenarioState} from '@/lib/scenario';
import {EXTERNAL_IDS,type AssessmentResult,type ExternalAssessment} from '@/lib/planning-types';
import {Button} from '@/components/ui/button';
import {Info} from './info';
export function EvidencePanel({state,result,onChange}:{state:ScenarioState;result:AssessmentResult;onChange:(s:ScenarioState)=>void}){
 const [id,setId]=useState<typeof EXTERNAL_IDS[number]>('terrain-footprint'),[status,setStatus]=useState<ExternalAssessment['status']>('unknown'),[source,setSource]=useState(''),[author,setAuthor]=useState(''),[notes,setNotes]=useState('');
 const [sourceUrl,setSourceUrl]=useState(''),[documentTitle,setDocumentTitle]=useState(''),[assessedUtc,setAssessedUtc]=useState(''),[scopeNote,setScopeNote]=useState('');
 const metadata=parseExternalMetadata({sourceUrl,documentTitle,assessedUtc,scopeNote});
 return <details className="planning-details"><summary>Evidence & unassessed landing considerations</summary>
 <p>Regional slope is a coarse screen, not a footprint, boulder or touchdown assessment. These considerations require qualified evidence. A user-reported pass remains conditional.</p>
 <div className="planning-table-scroll"><table><caption>Source coverage for this exact scenario</caption><thead><tr><th>Evidence</th><th>Coverage</th><th>Resolution / sampling</th></tr></thead><tbody>{result.evidence.map(e=><tr key={e.id}><th>{e.sourceUrl?<a href={e.sourceUrl} target="_blank" rel="noreferrer">{e.label}</a>:e.label}</th><td>{e.coverage}</td><td>{e.temporalStepHours!==null?`${e.temporalStepHours} h; `:''}{e.angularStepDeg!==null?`${e.angularStepDeg}° azimuth; `:''}{e.sourceSpacingM!==null?`${e.sourceSpacingM} m source; `:''}effective accuracy unquantified<Info label="Evidence coverage" extra={e.notes.join(' ')}/></td></tr>)}</tbody></table></div>
 <ul className="planning-evidence-list">{result.constraints.filter(c=>EXTERNAL_IDS.includes(c.id as typeof EXTERNAL_IDS[number])).map(c=><li key={c.id}><span>{c.label}{c.required?' · required':''}</span><strong>{c.state}</strong><Info label={c.label} extra={c.explanation}/></li>)}</ul>
 <div className="planning-table-scroll"><table><caption>Reported evidence provenance · supplied by the author, not internally verified</caption><thead><tr><th>Discipline</th><th>Source / author</th><th>Assessment UTC</th><th>Scope</th></tr></thead><tbody>{(state.externalAssessments??[]).map(report=><tr key={report.id}><th>{report.id.replaceAll('-',' ')}</th><td>{report.documentTitle||report.source}<br/>{report.author}{report.sourceUrl&&<p><a href={report.sourceUrl} target="_blank" rel="noreferrer">Source document</a></p>}</td><td>{report.assessedUtc??'Not supplied'}</td><td>{report.scopeNote||report.notes||'Not supplied'}{report.scenarioKey!==result.evidenceScopeKey?' · stale scenario':''}</td></tr>)}</tbody></table></div>
 <details><summary>Add an external assessment report</summary><p>Reports bind to the physical scenario and requirements shown now. Changing those inputs makes the report stale.</p>
 <label>Consideration<select value={id} onChange={e=>setId(e.target.value as typeof id)}>{EXTERNAL_IDS.map(v=><option key={v} value={v}>{v.replaceAll('-',' ')}</option>)}</select></label>
 <label>Reported conclusion<select value={status} onChange={e=>setStatus(e.target.value as typeof status)}><option value="unknown">Unknown / not assessed</option><option value="reported-pass">Externally reported pass</option><option value="reported-fail">Externally reported failure</option></select></label>
 <label>Source or report reference<input maxLength={4000} value={source} onChange={e=>setSource(e.target.value)}/></label><label>Author / organization<input maxLength={4000} value={author} onChange={e=>setAuthor(e.target.value)}/></label><label>Scope, assumptions and limitations<textarea maxLength={4000} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
 <label>Source URL (optional)<input type="url" aria-label="External assessment source URL" maxLength={4000} value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)}/></label>
 <label>Document title (optional)<input aria-label="External assessment document title" maxLength={4000} value={documentTitle} onChange={e=>setDocumentTitle(e.target.value)}/></label>
 <label>Author-stated assessment UTC (optional)<input aria-label="External assessment UTC" placeholder="2026-11-14T15:00:00Z" maxLength={40} value={assessedUtc} onChange={e=>setAssessedUtc(e.target.value)}/></label>
 <label>Evidence coverage / scope note (optional)<textarea aria-label="External assessment scope note" maxLength={4000} value={scopeNote} onChange={e=>setScopeNote(e.target.value)}/></label>
 {!metadata&&<p role="alert">Use an HTTP(S) source URL without embedded credentials and a real UTC timestamp ending in Z. Blank fields remain unspecified.</p>}
 <Button disabled={!metadata||status!=='unknown'&&(!source.trim()||!author.trim())} onClick={()=>onChange({...state,externalAssessments:[...(state.externalAssessments??[]).filter(r=>r.id!==id),{id,status,source,author,notes,scenarioKey:result.evidenceScopeKey,...(metadata??{})}]})}>Save reported evidence</Button>
 </details></details>;
}
