'use client';
import { useId, useMemo, useReducer, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import type { Catalog } from '@/lib/catalog';
import type { EvidenceManifest } from '@/lib/planning-types';
import type { ScenarioState } from '@/lib/scenario';
import { formatChartValue } from '@/lib/charts';
import { initialSelection, selectCase } from '@/lib/replanning/selection';
import { comparisonCurves } from '@/lib/replanning/curves';
import { caseCursor, clampCursor, compareInputs, cursorDomain, cursorFromIndex, prepareCase, resultDeltas, type Alignment, type ReplanningCase } from '@/lib/replanning/model';
import { Alternatives } from './alternatives';
import { CasePanel } from './case-panel';
import { ComparisonPlot } from './curves';
import {CandidateControls} from './candidate-controls';
import {formatUtc} from '@/lib/astro';
import {OUTCOME_LABELS} from '@/lib/replanning/model';
import { InputComparison } from './inputs';
import { SpatialContext } from './spatial-context';
import styles from './workspace.module.css';

export type ReplanningWorkspaceProps = {
  catalog: Catalog; manifest: EvidenceManifest; current: ScenarioState;
  scenarios: readonly { id: string; name: string; state: ScenarioState }[]; referenceId?: string;
  onOpen(state: ScenarioState): void;
  onInspect(state: ScenarioState, index: number): void;
  onSave(state: ScenarioState, name: string): void;
  onCalendar?(): void; onClose?(): void;
};

export function ReplanningWorkspace({ catalog, manifest, current, scenarios, referenceId, onOpen, onInspect, onSave, onCalendar, onClose }: ReplanningWorkspaceProps) {
  const cursorMeaningId = useId();
  const [selection, dispatch] = useReducer(selectCase, undefined, () => initialSelection(scenarios.find(s => s.id === referenceId) ?? { id: 'current', name: 'Current scenario', state: current }, { id: 'current', name: 'Current scenario', state: current }));
  const [curveView,setCurveView]=useState('Stored energy and reserve');
  const [alignment, setAlignment] = useState<Alignment>('elapsed'), [position, setPosition] = useState(0), [saveName, setSaveName] = useState('Replanned candidate'), [saved, setSaved] = useState('');
  const choices = useMemo(() => [{ key: 'current', item: { id: 'current', name: 'Current scenario', state: current } }, ...scenarios.map(item => ({ key: `saved:${item.id}`, item })), { key: 'reference', item: selection.reference }, { key: 'candidate', item: selection.candidate }], [current, scenarios, selection]);
  const refResult = useMemo(() => prepareCase(catalog, manifest, selection.reference), [catalog, manifest, selection.reference]);
  const candResult = useMemo(() => prepareCase(catalog, manifest, selection.candidate), [catalog, manifest, selection.candidate]);
  const r = refResult.value, c = candResult.value;
  const overlap = useMemo(() => r && c ? cursorDomain(catalog, r.state, c.state, 'utc') : null, [catalog, r, c]);
  const effectiveAlignment = alignment === 'utc' && !overlap ? 'elapsed' : alignment;
  const domain = useMemo(() => r && c ? cursorDomain(catalog, r.state, c.state, effectiveAlignment) : null, [catalog, r, c, effectiveAlignment]);
  const cursor = domain ? clampCursor(position, domain) : 0;
  const referenceCursor = r && domain ? caseCursor(catalog, r.state, domain, cursor) : null;
  const candidateCursor = c && domain ? caseCursor(catalog, c.state, domain, cursor) : null;
  const inputs = useMemo(() => r && c ? compareInputs(r.state, c.state) : [], [r, c]);
  const curves = useMemo(() => r && c && domain ? comparisonCurves([r, c], domain, catalog.meta.stepHours) : [], [r, c, domain, catalog.meta.stepHours]);
  function selectCandidate(item: ReplanningCase) { dispatch({ target: 'candidate', item }); setPosition(0); setSaved(''); }
  function inspectFailure(item: typeof r) {
    if (!item?.assessment.firstFailure || !c || !r) return;
    // A failure outside UTC overlap is inspected in elapsed mode, with both exact epochs retained.
    const elapsed = cursorDomain(catalog, r.state, c.state, 'elapsed')!;
    setAlignment('elapsed');
    setPosition(cursorFromIndex(catalog, item.state, elapsed, item.state.startIndex + item.assessment.firstFailure.intervalIndex));
  }
  return <div className={styles.workspace} data-replanning-workspace>
    <header className={styles.header}><div><p className={styles.eyebrow}>Replan the whole stay</p><h2>Compare two mission histories</h2><p>Compare real assessed cases, inspect the first known violation, then open or save a candidate.</p></div>{onClose && <Button variant="ghost" onClick={onClose}>Close replanning</Button>}</header>
    <details className={styles.comparisonHelp}><summary>Choose current or saved reference and candidate</summary><div className={styles.controls}>{(['reference', 'candidate'] as const).map(target => <label key={target}>{target === 'reference' ? 'Reference case' : 'Candidate case'}<select value={target} onChange={event => { const choice = choices.find(c => c.key === event.target.value); if (choice) { dispatch({ target, item: choice.item }); setPosition(0); setSaved(''); } }}>{choices.map(({ key, item }) => <option key={key} value={key}>{key === 'reference' ? 'Captured reference: ' : key === 'candidate' ? 'Captured candidate: ' : ''}{item.name}{key.startsWith('saved:') ? ' (saved)' : ''}</option>)}</select></label>)}</div></details>
    <details className={styles.comparisonHelp}><summary>What is held fixed, and how are dates aligned?</summary><p>Selections capture exact inputs. Candidate edits preserve the reference; opening a time in the main view does not rewrite it. Select Current scenario again to capture new main-view inputs.</p><p>Elapsed time compares hours since each arrival; absolute UTC compares only overlapping stays. Source cadence is {catalog.meta.stepHours} h. Operation boundaries add no celestial resolution; unknowns remain gaps.</p></details>
    {!r && <p role="alert">Reference unavailable: {refResult.error}</p>}{!c && <p role="alert">Candidate unavailable: {candResult.error}</p>}
    {r && c && domain && <>
      <CandidateControls catalog={catalog} candidate={selection.candidate} onChange={selectCandidate} onReset={()=>selectCandidate(selection.reference)}/>
      <section className={`${styles.section} ${styles.cursorSection}`} aria-label="Synchronized mission cursor"><div className={styles.controls}><label>Time alignment<select value={effectiveAlignment} onChange={e => { setAlignment(e.target.value as Alignment); setPosition(0); }}><option value="elapsed">Elapsed mission time</option><option value="utc" disabled={!overlap}>Absolute UTC overlap{!overlap ? ' (no overlapping stay)' : ''}</option></select></label><Button variant="ghost" disabled={cursor <= domain.min} onClick={() => setPosition(clampCursor(cursor - domain.step, domain))}>Previous sample</Button><Button variant="ghost" disabled={cursor >= domain.max} onClick={() => setPosition(clampCursor(cursor + domain.step, domain))}>Next sample</Button></div>
        <p id={cursorMeaningId} className={styles.cursorMeaning}>{effectiveAlignment === 'elapsed' ? 'Shared elapsed time; each exact UTC is shown below.' : 'Shared absolute UTC within the overlapping stays.'} · {catalog.meta.stepHours} h source samples; gaps are unknown.</p>
        <Slider aria-label={effectiveAlignment === 'elapsed' ? 'Shared elapsed mission time in hours' : 'Hours into shared UTC overlap'} aria-describedby={cursorMeaningId} min={domain.min} max={domain.max || domain.step} disabled={domain.max === 0} step={domain.step} value={[cursor]} onValueChange={value => setPosition(clampCursor(Array.isArray(value) ? value[0] : value, domain))} />
        <div className={styles.utcPair} aria-live="polite" aria-atomic="true"><p><b>Reference {referenceCursor ? `+${referenceCursor.elapsedHours} h` : ''}</b><time dateTime={referenceCursor?new Date(referenceCursor.utcMs).toISOString():undefined}>{referenceCursor ? formatUtc(referenceCursor.utcMs) : 'Outside reference stay'}</time></p><p><b>Candidate {candidateCursor ? `+${candidateCursor.elapsedHours} h` : ''}</b><time dateTime={candidateCursor?new Date(candidateCursor.utcMs).toISOString():undefined}>{candidateCursor ? formatUtc(candidateCursor.utcMs) : 'Outside candidate stay'}</time></p></div>
      </section>
      <div className={styles.summaryPair}>{[r,c].map((value,index)=>{const label=index?'Candidate':'Reference';const margin=value.assessment.constraints.find(row=>row.id==='reserve')?.margin;return <article key={String(label)}><strong>{String(label)} · {OUTCOME_LABELS[value.assessment.outcome]}</strong><p>Reserve margin {formatChartValue(margin??NaN,'Wh')} · unserved demand {formatChartValue(value.assessment.mission.unmetWh??NaN,'Wh')}</p>{value.assessment.firstFailure&&<Button variant="ghost" onClick={()=>inspectFailure(value)}>Inspect first failure · {formatUtc(Date.parse(value.assessment.firstFailure.earliestUtc))}</Button>}</article>;})}</div>
      <section className={`${styles.section} ${styles.primaryCurves}`} aria-label="Synchronized resource and contact curves"><div className={styles.curvePicker} role="group" aria-label="Comparison curve">{curves.map(group=><Button key={group.title} variant="ghost" aria-pressed={curveView===group.title} onClick={()=>setCurveView(group.title)}>{group.title}</Button>)}<Button variant="ghost" aria-pressed={curveView==='all'} onClick={()=>setCurveView('all')}>Show all curves</Button></div><p>Olive reference / blue candidate; solid and dashed traces distinguish terrain, smooth Moon and entered limits. The cursor is shared.</p>{(curveView==='all'?curves:[curves.find(group=>group.title===curveView)??curves[0]]).filter(Boolean).map(group=><ComparisonPlot key={group.title} group={group} domain={domain} cursor={cursor} onCursor={setPosition}/>)}</section>
      <div className={styles.pair}><CasePanel key={`r:${r.assessment.scenarioKey}`} item={r} label="Reference" cursor={referenceCursor} onFailure={() => inspectFailure(r)} onInspect={onInspect} /><CasePanel key={`c:${c.assessment.scenarioKey}`} item={c} label="Candidate" cursor={candidateCursor} onFailure={() => inspectFailure(c)} onInspect={onInspect} /></div>
      <section className={styles.section} aria-label="Candidate minus reference results"><h3>Candidate minus reference</h3><p>{inputs.filter(row => row.changed && row.path.startsWith('requirements.')).length ? 'Requirement scope or limits changed; these raw response differences do not establish improvement under the same criteria.' : 'Requirement inputs are held constant.'} Reserve margin increases mean more stored energy above the entered reserve; increases in unserved demand or outage mean more modeled exposure. Contact change is percentage points, not percent relative improvement.</p><table><thead><tr><th scope="col">Result change</th><th scope="col">Terrain</th><th scope="col">Smooth sphere</th></tr></thead><tbody>{resultDeltas(r, c).map(delta => <tr key={delta.label}><th scope="row">{delta.label}</th>{[delta.terrain, delta.sphere].map((value, i) => <td key={i}>{value !== null && value > 0 ? '+' : ''}{formatChartValue(value ?? NaN, delta.unit)}</td>)}</tr>)}</tbody></table></section>
      <InputComparison rows={inputs} />
      <SpatialContext reference={r} candidate={c} onUse={selectCandidate} />
      <Alternatives key={c.assessment.scenarioKey} catalog={catalog} manifest={manifest} base={c} onUse={selectCandidate} />
      <section className={styles.section} aria-label="Next action"><h3>Carry this candidate forward</h3><p>Opening preserves this exact state, including requirements and separate subsystem heights. Saving records inputs for reassessment; it does not approve a mission.</p><div className={styles.controls}><Button onClick={() => onOpen(c.state)}>Open candidate</Button><label>Saved case name<Input value={saveName} maxLength={120} onChange={e => setSaveName(e.target.value)} /></label><Button variant="outline" disabled={!saveName.trim()} onClick={() => { onSave(c.state, saveName.trim()); setSaved(`Saved “${saveName.trim()}”.`); }}>Save candidate</Button>{onCalendar && <Button variant="ghost" onClick={onCalendar}>Explore mission calendar</Button>}</div><p role="status">{saved}</p></section>
      <footer className={styles.identity}>Dataset {manifest.datasetId} · model {r.assessment.modelVersion}. Source uncertainty is unquantified unless explicitly evidenced. Geometric contact and resource screening do not establish landing readiness.</footer>
    </>}
  </div>;
}
