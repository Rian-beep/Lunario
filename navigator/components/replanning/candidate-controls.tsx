'use client';
import {useEffect, useId, useState} from 'react';
import type {Catalog} from '@/lib/catalog';
import {indexToMs} from '@/lib/astro';
import {editCapturedCandidate, type ReplanningCase} from '@/lib/replanning/model';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Info} from '@/components/workbench/info';
import styles from './workspace.module.css';

export function CandidateControls({catalog, candidate, onChange, onReset}: {
  catalog: Catalog; candidate: ReplanningCase; onChange(value: ReplanningCase): void; onReset(): void;
}) {
  const arrival = new Date(indexToMs(catalog, candidate.state.startIndex)).toISOString().slice(0,16);
  const [draft, setDraft] = useState(arrival), [error, setError] = useState('');
  const help = useId();
  useEffect(() => { setDraft(arrival); setError(''); }, [arrival]);
  function edit(site: string | null, hours: number) {
    try { onChange(editCapturedCandidate(catalog, candidate, site, hours)); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  }
  function applyArrival() {
    const epoch = Date.parse(`${draft}Z`), hours = (epoch-indexToMs(catalog,candidate.state.startIndex))/3600000;
    if (!draft || !Number.isFinite(epoch) || !Number.isInteger(hours/catalog.meta.stepHours)) {
      setError(`Enter a UTC arrival aligned to the ${catalog.meta.stepHours} h source cadence. The candidate is unchanged.`); return;
    }
    edit(null, hours);
  }
  return <section className={styles.candidateControls} aria-label="Change candidate only">
    <label><span>Candidate arrival (UTC) <Info label="Landing UTC"/></span>
      <Input type="datetime-local" aria-label="Candidate arrival (UTC)" step={catalog.meta.stepHours*3600}
        value={draft} aria-invalid={!!error} aria-describedby={help}
        onChange={event=>setDraft(event.target.value)} onBlur={applyArrival}/>
    </label>
    <label><span>Candidate site <Info label="Candidate site" extra="Only the candidate location changes. Its hardware, requirements and stay length are held. A location without supported terrain remains incomplete or conditional."/></span>
      <select aria-label="Candidate site" value={candidate.state.custom?'custom':candidate.state.siteId}
        onChange={event=>{if(event.target.value!=='custom')edit(event.target.value,0);}}>
        {candidate.state.custom&&<option value="custom">Current custom point</option>}
        {catalog.sites.map(site=><option key={site.id} value={site.id}>{site.name}</option>)}
      </select>
    </label>
    <div className={styles.actions}>
      <Button variant="outline" aria-label="Delay candidate by 1 day" onClick={()=>edit(null,24)}>+1 day</Button>
      <Button variant="outline" aria-label="Delay candidate by 7 days" onClick={()=>edit(null,168)}>+7 days</Button>
      <Button variant="ghost" onClick={onReset}>Reset to reference</Button>
    </div>
    <p id={help} role={error?'alert':undefined} className={styles.editNote}>{error||'Preview changes here; the active mission and captured reference stay unchanged.'}</p>
  </section>;
}
