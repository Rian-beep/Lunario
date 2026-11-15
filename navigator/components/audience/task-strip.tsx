'use client';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {publicAssessmentGuidance} from '@/components/workbench/audience-context';
import type {Catalog} from '@/lib/catalog';
import type {AssessmentResult,EvidenceManifest} from '@/lib/planning-types';
import type {ScenarioState} from '@/lib/scenario';
import {audienceGuidance} from '@/lib/audience/guidance';
import {formatUtc,indexToMs} from '@/lib/astro';
import {formatVisibilityUtcWindow} from '@/lib/windows';
import styles from './audience.module.css';
export type AudienceTaskStripProps={mode:'public'|'teach'|'plan';catalog:Catalog;manifest:EvidenceManifest;state:ScenarioState;assessment:AssessmentResult;playhead:number;siteName:string;onInspect():void;onReplan():void;onTeach():void};
export function AudienceTaskStrip({mode,catalog,manifest,state,assessment,playhead,siteName,onInspect,onReplan,onTeach}:AudienceTaskStripProps){
 const [dismissed,setDismissed]=useState(false);
 if(dismissed)return <Button variant="ghost" onClick={()=>setDismissed(false)}>Show {mode==='teach'?'experiment context':'stay guidance'}</Button>;
 const g=audienceGuidance(catalog,state,assessment,playhead);
 const publicGuidance=publicAssessmentGuidance(assessment);
 const publicStayWhy=publicGuidance.why
  .replace(/The assessed requirements are met only within the supplied model and evidence limits\./,'The checked sunlight and Earth-view conditions look workable only under the stated assumptions.')
  .replace(/This modeled stay meets the requirements assessed here\./,'This modeled stay looks workable for the sunlight and Earth-view checks used here.')
  .replace(/assessed requirements/gi,'checked conditions')
  .replace(/A checked site or vehicle requirement is not met in this case\./,'A checked sunlight, power, or Earth-view condition is not met in this case.');
 const percent=(v:number|null)=>v===null?'unknown':`${v.toFixed(1)}%`;
 const matches=manifest.datasetId===assessment.datasetId;
 const eventWindow=g.event?formatVisibilityUtcWindow(g.event.earliestMs,g.event.latestMs):null;
 const publicAction=!matches?'Inspect assessment':g.next==='replan'?'Compare another site or date':'Compare sunlight and Earth view';
 return <section className={styles.strip} aria-label={`${mode==='public'?'Stay guidance':mode==='teach'?'Experiment context':'Requirement summary'} for ${siteName}`}>
 <div className={styles.stripMain}><strong>{siteName} · {mode==='teach'?'What prediction are we testing?':mode==='public'?'Pick a site · Move the date · Compare':'What can happen here?'}</strong>
 {!matches?<p>Assessment belongs to a different dataset. Reopen the current assessment.</p>:<>
 {mode==='public'?<><p><b>At this moment:</b> {g.currentPublic}. <span>Without local hills: {g.currentSpherePublic}.</span></p><p><b>Whole stay:</b> {publicStayWhy} Sunlight in {percent(g.stay.sun)} of sampled intervals (smooth Moon {percent(g.stay.sphereSun)}); Earth in view {percent(g.stay.contact)} (smooth Moon {percent(g.stay.sphereContact)}).</p><details><summary>Why sunlight and Earth view matter</summary><p>Sunlight can charge solar panels. When the Sun is hidden behind the hills, stored energy must keep equipment running. Earth above the hills is a first step toward radio contact; a usable ground station, enough signal strength and operating time are also needed. The smooth-Moon comparison removes local hills so you can see what terrain changes. Percentages describe this whole selected stay, not the single displayed moment.</p></details></>:mode==='teach'?<><p>Predict → capture this scenario → change one input → compare the computed response → save your conclusion.</p><p>{formatUtc(indexToMs(catalog,state.startIndex))} to {formatUtc(indexToMs(catalog,state.endIndex+1))} (end exclusive). Audience changes preserve all physics inputs. {assessment.scope==='resource-screening'?'Resource screening':'Landing-readiness scope'}: {g.counts.fail} required failures, {g.counts['not-assessed']} missing required assessments, {g.counts.conditional} conditional, {g.counts.pass} pass. {g.missing.length} unassessed disciplines including optional.</p></>:<><p><b>{assessment.scope==='resource-screening'?'Resource screening':'Landing-readiness scope'}</b> · Required: {g.counts.pass} pass, {g.counts.fail} fail, {g.counts.conditional} conditional, {g.counts['not-assessed']} not assessed. {g.whole}</p><details><summary>{g.missing.length} unassessed disciplines (including optional)</summary><p>{g.missing.map(r=>`${r.label}${r.required?' (required)':''}`).join('; ')||'No missing evidence rows. Reported passes remain conditional.'}</p></details></>}
 {g.event?<p><b>Nearest relevant event:</b> {g.event.label} · {eventWindow?`${eventWindow.date}, ${eventWindow.time}`:'Time window unavailable'}. Sampled window, not an exact event time.</p>:<p>{g.current.includes('unknown')?'Current evidence is unknown; no reliable next transition can be given.':'No later sampled transition or timed required failure found inside this stay.'}</p>}
 </>}
 </div><div className={styles.stripActions}><Button onClick={mode==='teach'?onTeach:!matches?onInspect:g.next==='replan'?onReplan:onInspect}>{mode==='teach'?'Open teaching studio':mode==='public'?publicAction:g.nextLabel}</Button><Button variant="ghost" aria-label="Dismiss audience guidance" onClick={()=>setDismissed(true)}>Dismiss</Button></div>
 </section>;
}
