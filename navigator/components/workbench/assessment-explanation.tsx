'use client';
import {useContext} from 'react';
import {AudienceContext} from './info';
import type {AssessmentResult,ConstraintResult} from '@/lib/planning-types';
import {explainAssessment,explainConstraint} from '@/lib/assessment-explanation';
import {formatUtc} from '@/lib/astro';
const styles={explanation:'assessment-explanation',reason:'assessment-reason',metrics:'assessment-metrics',source:'assessment-source',timing:'assessment-timing'};

export function AssessmentExplanation({assessment}:{assessment:AssessmentResult}) {
  const mode=useContext(AudienceContext),view=explainAssessment(assessment),technical=mode!=='public';
  const row=(c:ConstraintResult)=>{
    const explanation=explainConstraint(c);
    return <article className={styles.reason} key={c.id} data-check-id={c.id}>
      <h4>{c.state==='fail'?explanation.title:c.label}</h4>
      <p>{c.state==='fail'||c.state==='not-assessed'?explanation.meaning:c.explanation}</p>
      {(c.state==='fail'||c.state==='not-assessed')&&<><p><strong>Why it matters:</strong> {explanation.consequence}</p><p><strong>Try next:</strong> {explanation.nextStep}</p></>}
      {c.actual!==null&&<dl className={styles.metrics}><div><dt>{mode==='public'?'Modeled amount':'Actual'}</dt><dd>{explanation.actual}</dd></div><div><dt>{mode==='public'?'Your chosen limit':'Requirement'}</dt><dd>{explanation.threshold}</dd></div>{technical&&<div><dt>Signed margin</dt><dd>{explanation.margin}</dd></div>}</dl>}
      {technical&&<p className={styles.source}>{c.required?'Required':'Not required'} · {c.state} · {c.reasonCode}<br/>Evidence: {c.evidenceIds.join(', ')||'Unavailable'}</p>}
    </article>;
  };
  return <section className={styles.explanation} aria-label="Why this scenario has this result">
    <h3>{view.heading}</h3><p>{view.summary}</p>
    {view.failures.length>0&&<section aria-label="Reasons this plan fails"><h4>What stops this plan?</h4>{view.failures.map(row)}</section>}
    {assessment.firstFailure&&<p className={styles.timing}><strong>First known problem</strong><br/>{formatUtc(Date.parse(assessment.firstFailure.earliestUtc))}<br/><small>Located within the following {((Date.parse(assessment.firstFailure.latestUtc)-Date.parse(assessment.firstFailure.earliestUtc))/3600000).toLocaleString('en-GB')} hours of source data; the exact time is uncertain.</small></p>}
    {view.unknown.length>0&&<details open={view.failures.length===0}><summary>What we still need to know ({view.unknown.length})</summary>{view.unknown.map(row)}</details>}
    {view.conditional.length>0&&<details><summary>Checks that depend on assumptions ({view.conditional.length})</summary>{view.conditional.map(row)}</details>}
    <details><summary>Why a nearby site or another date can change the answer</summary><p>Near the lunar poles, the Sun travels close to the horizon. A small ridge can hide it for hours or days. Moving a short distance can change that ridge; changing the date changes where the Sun passes it. Earth follows a different path, so more sunlight does not automatically mean better communication.</p><p>Compare the whole stay with the same equipment and requirements. The smooth-sphere result shows what changes when terrain is left out; the terrain result adds the available horizon evidence.</p></details>
    {technical&&<details><summary>Model identity and limitations</summary><p>Dataset: {assessment.datasetId}<br/>Model: {assessment.modelVersion}<br/>Scenario: {assessment.scenarioKey}</p><ul>{assessment.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul></details>}
    {view.notRequested.length>0&&<details><summary>Checks not required for this comparison ({view.notRequested.length})</summary><p>These checks do not determine this verdict. They can still matter for a real landing.</p>{technical?view.notRequested.map(row):<ul>{view.notRequested.map(c=><li key={c.id}>{c.label}</li>)}</ul>}</details>}
  </section>;
}
