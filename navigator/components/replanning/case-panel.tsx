'use client';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { HorizonGraph } from '@/components/workbench/science-charts';
import { formatChartValue } from '@/lib/charts';
import { OUTCOME_LABELS, type CaseCursor, type PreparedCase } from '@/lib/replanning/model';
import { observedAbsence } from '@/lib/observed-duration';
import type { ScenarioState } from '@/lib/scenario';
import styles from './workspace.module.css';

export function CasePanel({ item, label, cursor, onFailure, onInspect }: { item: PreparedCase; label: string; cursor: CaseCursor | null; onFailure(): void; onInspect(state: ScenarioState, index: number): void }) {
  const [horizons, setHorizons] = useState(false);
  const { assessment: a, state, context } = item;
  const location = context.location;
  const metric = (v: number | null, unit: string) => formatChartValue(v ?? NaN, unit);
  const first = a.firstFailure;
  const outages = useMemo(() => [a.mission, a.sphereMission].map(result => observedAbsence(result.timeline.map(t => t.contact), result.timeline[0].endOffsetHours - result.timeline[0].startOffsetHours)), [a]);
  const rows: [string, number | null, number | null, string][] = [
    ['Minimum storage', a.mission.minBatteryWh, a.sphereMission.minBatteryWh, 'Wh'],
    ['Reserve margin', a.mission.minBatteryWh === null ? null : a.mission.minBatteryWh - state.mission.batteryWh * state.mission.reserveSoc, a.sphereMission.minBatteryWh === null ? null : a.sphereMission.minBatteryWh - state.mission.batteryWh * state.mission.reserveSoc, 'Wh'],
    ['Unserved demand', a.mission.unmetWh, a.sphereMission.unmetWh, 'Wh'],
    ['Generated energy', a.mission.generatedWh, a.sphereMission.generatedWh, 'Wh'],
    ['Antenna contact', a.mission.contactFraction === null ? null : a.mission.contactFraction * 100, a.sphereMission.contactFraction === null ? null : a.sphereMission.contactFraction * 100, '%'],
    ['Longest observed outage', a.mission.longestBlackoutHours, a.sphereMission.longestBlackoutHours, 'h'],
  ];
  return <article className={styles.case} aria-label={`${label}: ${item.name}`}>
    <p className={styles.eyebrow}>{label}</p><h3>{item.name}</h3>
    <p><b>{OUTCOME_LABELS[a.outcome]}</b> · {a.scope === 'landing-readiness' ? 'Landing readiness scope' : 'Resource screening'}</p>
    <p>{state.custom ? 'Custom point' : context.site.name} · {location.lat.toFixed(5)}° latitude · {location.lon.toFixed(5)}° east longitude</p>
    {!state.custom && <p>{context.site.source}{context.site.group === 'derived' ? ' · Derived site, not a published mission pin.' : ''}</p>}
    <p className={styles.utc}>{context.startUtc} → {context.endUtcExclusive} (exclusive)</p>
    <table><caption>Whole stay · paired model results</caption><thead><tr><th scope="col">Metric</th><th scope="col">Terrain</th><th scope="col">Smooth sphere</th></tr></thead><tbody>{rows.map(([name, t, s, unit]) => <tr key={name}><th scope="row">{name}</th><td>{name === 'Longest observed outage' && outages[0]?.lowerBound ? '≥ ' : ''}{metric(t, unit)}</td><td>{name === 'Longest observed outage' && outages[1]?.lowerBound ? '≥ ' : ''}{metric(s, unit)}</td></tr>)}</tbody></table>
    <p>Observed outage runs can extend beyond either stay boundary. These are bounded-window durations, not predictions of the true outage end.</p>
    <p>{a.constraints.filter(c => c.required && c.state === 'fail').length} required failures · {a.constraints.filter(c => c.required && c.state === 'not-assessed').length} required unknowns · {a.constraints.filter(c => !c.required && c.state === 'not-assessed').length} other unassessed disciplines/screens</p>
    <div className={styles.cursorReadout}>
      <b>{cursor ? `Mission +${cursor.elapsedHours} h · ${new Date(cursor.utcMs).toISOString()}` : 'No corresponding sample in this stay'}</b>
      {cursor && <><p>● Sun: azimuth {metric(context.arraySeries.sunAz[cursor.localIndex], '°')} · centre elevation {metric(context.arraySeries.sunEl[cursor.localIndex], '°')} · array terrain horizon {metric(context.arraySeries.sunHorizon[cursor.localIndex], '°')} at {state.arrayHeightM} m.</p><p>○ Earth: azimuth {metric(context.antennaSeries.earthAz[cursor.localIndex], '°')} · centre elevation {metric(context.antennaSeries.earthEl[cursor.localIndex], '°')} · antenna terrain horizon {metric(context.antennaSeries.earthHorizon[cursor.localIndex], '°')} at {state.antennaHeightM} m. Antenna minimum: {state.mission.antennaMaskDeg}° absolute.</p></>}
    </div>
    {first ? <div className={styles.failure}><b>First known violation: {first.kind.replaceAll('-', ' ')}</b><p>Source interval {first.earliestUtc} → {first.latestUtc}.</p>{first.modelOffsetHours !== null && <p>Model event estimate: +{first.modelOffsetHours.toFixed(3)} h since arrival; not an independently measured event time.</p>}<div className={styles.actions}><Button variant="outline" onClick={() => { setHorizons(true); onFailure(); }}>Inspect first violation</Button><Button variant="ghost" onClick={() => onInspect(state, state.startIndex + first.intervalIndex)}>Open failure in main view</Button></div></div> : <p>{a.constraints.some(c => c.required && c.state === 'fail') ? 'A required aggregate limit fails without a timed violation interval. Inspect its requirement row.' : a.outcome === 'incomplete' ? 'No first violation can be established from incomplete evidence.' : 'No timed required violation found in the assessed stay.'}</p>}
    <div className={styles.actions}><Button variant="ghost" disabled={!cursor} onClick={() => cursor && onInspect(state, cursor.index)}>Open this exact time</Button><Button variant="outline" aria-expanded={horizons} onClick={() => setHorizons(v => !v)}>{horizons ? 'Hide' : 'Show'} Sun / Earth horizons</Button></div>
    {horizons && (cursor ? <section aria-label={`${label} instrument horizons`}><h4>Array horizon · {state.arrayHeightM} m</h4><HorizonGraph series={context.arraySeries} terrain={context.arrayTerrain} cursor={cursor.localIndex} />{state.arrayHeightM !== state.antennaHeightM && <><h4>Antenna horizon · {state.antennaHeightM} m</h4><HorizonGraph series={context.antennaSeries} terrain={context.antennaTerrain} cursor={cursor.localIndex} /></>}<p>● Sun is filled amber; ○ Earth is a blue ring. Horizon azimuth is clockwise from north (°); elevation is above the local horizontal (°). Display observer height {state.heightM} m does not set array or antenna height. No ridge or occluder is identified from imagery.</p></section> : <p>Select a mission hour within this case to inspect its horizon.</p>)}
    <details><summary>Requirements, unknowns and evidence</summary><table><thead><tr><th scope="col">Requirement / discipline</th><th scope="col">Required?</th><th scope="col">Result</th></tr></thead><tbody>{a.constraints.map(row => <tr key={row.id}><th scope="row">{row.label}<small>{row.explanation}</small>{row.actual !== null && <small>Actual {metric(row.actual, row.unit ?? '')} · limit {metric(row.limit, row.unit ?? '')}</small>}</th><td>{row.required ? 'Yes' : 'No'}</td><td>{row.state}</td></tr>)}</tbody></table>{a.evidence.map(e => <p key={e.id}><b>{e.label}: {e.coverage}</b> · {e.temporalStepHours ?? 'Unknown'} h temporal / {e.angularStepDeg ?? 'Unknown'}° angular spacing · effective resolution {e.effectiveResolutionM === null ? 'unquantified' : `${e.effectiveResolutionM} m`}. {e.notes.join(' ')}</p>)}{a.warnings.map((warning, i) => <p key={i}>{warning}</p>)}<p className={styles.identity}>Case: {a.scenarioKey}<br />Dataset: {a.datasetId} · model: {a.modelVersion}</p></details>
  </article>;
}
