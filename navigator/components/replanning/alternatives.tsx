'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Catalog } from '@/lib/catalog';
import { formatChartValue } from '@/lib/charts';
import { observedAbsence } from '@/lib/observed-duration';
import type { EvidenceManifest } from '@/lib/planning-types';
import { OUTCOME_LABELS, controlledAlternative, errorMessage, prepareCase, type ReplanningCase, type PreparedCase } from '@/lib/replanning/model';
import { alternativePlan, paretoOptions, scanAlternatives, type TestedOption } from '@/lib/replanning/scan';
import styles from './workspace.module.css';

export function Alternatives({ catalog, manifest, base, onUse }: { catalog: Catalog; manifest: EvidenceManifest; base: PreparedCase; onUse(item: ReplanningCase): void }) {
  const [site, setSite] = useState(''), [shift, setShift] = useState('24'), [offsets, setOffsets] = useState('0,24,48');
  const [sites, setSites] = useState<string[]>([]), [rows, setRows] = useState<TestedOption[]>([]);
  const [progress, setProgress] = useState(0), [running, setRunning] = useState(false), [status, setStatus] = useState('No scan run.'), [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => { controller.current?.abort(); controller.current = null; }, []);
  const plan = useMemo(() => {
    try {
      if (!offsets.trim() || offsets.split(',').some(v => !v.trim())) throw new Error('Enter comma-separated date offsets in hours.');
      return { cases: alternativePlan(catalog, base.state, sites, offsets.split(',').map(Number)), error: '' };
    } catch (cause) { return { cases: [], error: errorMessage(cause) }; }
  }, [catalog, base.state, sites, offsets]);
  const ranked = useMemo(() => paretoOptions(rows).map(row => ({ ...row, outageLowerBound: row.assessment ? observedAbsence(row.assessment.mission.timeline.map(t => t.contact), catalog.meta.stepHours)?.lowerBound : false })), [rows, catalog.meta.stepHours]);
  async function scan() {
    if (running || !plan.cases.length) return;
    const active = new AbortController(); controller.current = active;
    setRunning(true); setRows([]); setProgress(0); setError(''); setStatus('Testing complete stays…');
    try {
      const result = await scanAlternatives(catalog, manifest, base.state, plan.cases, { signal: active.signal, onProgress: n => { if (controller.current === active) setProgress(n); } });
      if (controller.current !== active) return;
      setRows(result.rows); setStatus(`${result.cancelled ? 'Cancelled; retained' : 'Completed'} ${result.rows.length} of ${plan.cases.length} requested cases; ${result.rows.filter(r => r.assessment).length} assessed, ${result.rows.filter(r => r.error).length} unsupported.`);
    } catch (cause) { if (controller.current === active) { setError(errorMessage(cause)); setStatus('Scan could not complete.'); } }
    finally { if (controller.current === active) setRunning(false); }
  }
  function preview() {
    try {
      if (!shift.trim()) throw new Error('Enter a date shift in hours.');
      const state = controlledAlternative(catalog, base.state, site || null, Number(shift));
      const item = { id: 'controlled', name: `${site ? catalog.sites.find(s => s.id === site)!.name : base.name} · ${Number(shift) >= 0 ? '+' : ''}${Number(shift)} h`, state };
      const prepared = prepareCase(catalog, manifest, item);
      if (!prepared.value) throw new Error(prepared.error);
      setError(''); onUse(item);
    } catch (cause) { setError(errorMessage(cause)); }
  }
  return <section className={styles.section} aria-label="Controlled alternatives"><h3>Choose the next controlled change</h3><p>Base: <b>{base.name}</b>. Keep equipment, stay duration, operations, requirement scope and external reports fixed. Changed dates/sites invalidate evidence bindings under the shared assessment.</p>
    <div className={styles.controls}><label>Alternative site<select value={site} onChange={e => setSite(e.target.value)}><option value="">Keep this point</option>{catalog.sites.map(s => <option key={s.id} value={s.id}>{s.name}{s.group === 'derived' ? ' (derived)' : ''}</option>)}</select></label><label>Date shift (h)<Input type="number" step={catalog.meta.stepHours} value={shift} onChange={e => setShift(e.target.value)} /></label><Button variant="outline" onClick={preview}>Preview controlled change</Button></div>
    <details><summary>Test a bounded date/site grid</summary><p>At most 7 date offsets and 6 additional sites. The current point is always included. Limits: 48 cases and 150,000 forcing intervals per run. No automatic scan.</p><fieldset disabled={running}><div className={styles.controls}><label>Date offsets from this candidate (h)<Input value={offsets} onChange={e => setOffsets(e.target.value)} placeholder="0,24,48" /></label></div><div className={styles.siteChoices}>{catalog.sites.map(s => <label key={s.id}><Input type="checkbox" checked={sites.includes(s.id)} disabled={!sites.includes(s.id) && sites.length >= 6} onChange={e => setSites(previous => e.target.checked ? [...previous, s.id] : previous.filter(id => id !== s.id))} />{s.name}{!s.horizons.length ? ' · no prepared horizon' : ''}</label>)}</div></fieldset>
      <p>{plan.error || `${plan.cases.length} explicitly requested cases; ${(base.state.endIndex - base.state.startIndex + 1) * plan.cases.length} source intervals.`}</p><div className={styles.actions}><Button variant="outline" disabled={running || !plan.cases.length} onClick={scan}>Test these alternatives</Button><Button variant="ghost" disabled={!running} onClick={() => controller.current?.abort()}>Cancel scan</Button></div>
    </details>
    <p role="status">{running ? `Testing ${progress} / ${plan.cases.length} cases…` : status}</p>{error && <p role="alert">{error}</p>}
    {rows.length > 0 && <><p>Non-dominated means no tested option in the same requirement/evidence cohort has at least as much reserve margin, no longer observed blackout and no larger absolute schedule shift, with one strict improvement. It is not a recommended or approved mission. Conditional outcomes stay conditional. Unknowns remain unranked. This covers only the listed grid.</p><div className={styles.tableScroll}><table><caption>{ranked.filter(r => r.rank === 'non-dominated').length} non-dominated · {ranked.filter(r => r.rank === 'unranked').length} unranked · {rows.length} tested options</caption><thead><tr><th scope="col">Tested option</th><th scope="col">Assessment / evidence cohort</th><th scope="col">Reserve margin (Wh)</th><th scope="col">Observed blackout (h)</th><th scope="col">Shift (h)</th><th scope="col">Next step</th></tr></thead><tbody>{ranked.map(row => <tr key={row.id} data-rank={row.rank}><th scope="row">{row.name}<small>{row.rank}</small></th><td>{row.assessment ? OUTCOME_LABELS[row.assessment.outcome] : row.error}<small>{row.cohort ?? 'Unknown or unsupported · not comparable'}</small></td><td>{formatChartValue(row.assessment?.mission.minBatteryWh === null || !row.assessment ? NaN : row.assessment.mission.minBatteryWh - row.state.mission.batteryWh * row.state.mission.reserveSoc, 'Wh')}</td><td>{row.outageLowerBound ? '≥ ' : ''}{formatChartValue(row.assessment?.mission.longestBlackoutHours ?? NaN, 'h')}</td><td>{row.shiftHours}</td><td><Button variant="ghost" disabled={!row.assessment} onClick={() => onUse(row)}>Compare this option</Button></td></tr>)}</tbody></table></div><details><summary>Exact tested inputs and identities</summary>{ranked.map(row => <p key={row.id} className={styles.identity}>{row.name}: {row.assessment?.scenarioKey ?? row.id} · start sample {row.state.startIndex}, final forcing sample {row.state.endIndex}, site {row.state.siteId}{row.state.custom && ` (${row.state.custom.lat}°, ${row.state.custom.lon}°)`}.</p>)}</details></>}
  </section>;
}
