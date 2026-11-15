'use client';

import { Button } from '../ui/button';
import { exportEvidenceConfidence, type EvidenceConfidenceSummary } from '../../lib/evidence-confidence';
import type { EvidenceBasis } from '../../lib/evidence-confidence/types';
import styles from './summary.module.css';

export type EvidenceConfidenceProps = {
  summary: EvidenceConfidenceSummary;
  audience: 'public' | 'educator' | 'planner';
  onClose?: () => void;
  /** Optional host download handler; default downloads a local JSON file without network access. */
  onExport?: (json: string) => void;
};
const basisLabel: Record<EvidenceBasis, string> = {
  'reference-comparison': 'Reference comparison',
  'reported-measurement': 'Reported measurement · unverified',
  'quantization-only': 'Stored precision',
  assumed: 'Scenario assumption',
  'declared-bound': 'Declared bound',
  'finite-sensitivity': 'Finite cases only',
  unquantified: 'Unquantified',
};
const outcomes: Record<EvidenceConfidenceSummary['outcome'], string> = {
  'fails-assessed': 'A required model limit is exceeded',
  incomplete: 'Required evidence is missing',
  conditional: 'The modeled result remains conditional',
  'passes-assessed': 'Configured model requirements are met',
  'not-configured': 'No model requirements configured',
};
function download(json: string) {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'solarreach-evidence-confidence.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function EvidenceConfidence({ summary, audience, onClose, onExport = download }: EvidenceConfidenceProps) {
  const s = summary.selection;
  const core = summary.items.filter(item => audience !== 'public' || ['calibration', 'array-terrain', 'antenna-terrain', 'power', 'contact', 'finite'].includes(item.id));
  return <section className={styles.summary} aria-label="Evidence for this scenario" onKeyDown={event => {
    if ([' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) event.stopPropagation();
  }}>
    <header className={styles.header}><div><p className={styles.eyebrow}>Evidence for this selection</p><h3>{outcomes[summary.outcome]}</h3></div>{onClose && <Button variant="outline" size="sm" onClick={onClose}>Close evidence</Button>}</header>
    <p className={styles.location}><strong>{s.name}</strong> · {s.lat}°, {s.lon}° east</p>
    <p>{s.startUtc} → {s.endUtcExclusive} exclusive</p>
    <p>Solar array {s.heightsM.array} m · antenna {s.heightsM.antenna} m · display observer {s.heightsM.display} m</p>
    <p className={styles.boundary}>Physical uncertainty is unquantified. A model margin is not a probability of mission success.</p>
    {['stale', 'invalid'].includes(summary.finite.status) && <p><strong>Finite evidence {summary.finite.status}.</strong> {summary.finite.explanation}</p>}
    {audience === 'educator' && <p>Compare what the model calculates with what the inputs establish. Changing an assumed load tests a “what if”; it does not measure the Moon or qualify the hardware.</p>}
    <div className={styles.tableWrap}><table><caption>Same scenario · terrain and smooth sphere</caption><thead><tr><th scope="col">Modeled result</th><th scope="col">Terrain</th><th scope="col">Smooth sphere</th></tr></thead><tbody>{summary.metrics.map(metric => {
      const display = (value: number | null) => value === null ? 'Unknown' : metric.unit === 'fraction' ? `${(value * 100).toFixed(1)}%` : `${value.toFixed(1)} ${metric.unit}`;
      return <tr key={metric.id}><th scope="row">{metric.label}</th><td>{display(metric.terrain)}</td><td>{display(metric.sphere)}</td></tr>;
    })}</tbody></table></div>
    <details className={styles.card} open={summary.decisionLimits.some(c => c.state === 'fail' || c.state === 'not-assessed')}><summary>What limits this decision · {summary.decisionLimits.length} required rows</summary>
      {summary.decisionLimits.length ? <ul>{summary.decisionLimits.map(c => <li key={c.id}><strong>{c.label} · {c.state}</strong><p>{c.explanation}</p>{audience === 'planner' && c.margin !== null && <p>Model margin {c.margin} {c.unit}; tolerance is not an engineering safety margin.</p>}</li>)}</ul> : <p>No required row is currently failing, missing or conditional. The physical evidence limits below still apply.</p>}
    </details>
    <div className={styles.cards}>{core.map(item => <details key={item.id} className={styles.card}><summary><span className={styles.basis}>{basisLabel[item.basis]}</span><span>{item.title}</span></summary><p>{item.detail}</p><p><strong>Decision limit:</strong> {item.decisionLimit}</p><p><strong>Evidence to add:</strong> {item.nextEvidence}</p></details>)}</div>
    {summary.finite.result && <p>{summary.finite.result.cases.length} recomputed cases: outcome {summary.finite.result.outcomeStable ? 'unchanged in tested cases' : 'changes in tested cases'}. Sampled minimum stored energy: {summary.finite.result.sampledBatteryRangeWh?.map(v => `${v.toFixed(1)} Wh`).join(' to ') ?? 'unknown'}{summary.finite.result.allCasesHaveBattery ? '.' : '; some cases unknown.'} No continuous enclosure.</p>}
    {audience === 'public' && <details className={styles.card}><summary>Sampling and source details</summary>{summary.items.filter(item => !core.includes(item)).map(item => <div key={item.id}><h4>{item.title}</h4><p>{item.detail}</p><p>{item.decisionLimit}</p><p><strong>Evidence to add:</strong> {item.nextEvidence}</p></div>)}</details>}
    <details className={styles.card}><summary>Inspect sources and held assumptions</summary><p>{s.locationBasis}</p><p>Location source: {s.locationSource}</p><p>{summary.interpretation}</p><p>Source identities below are manifest declarations; this view does not rehash files or authenticate reports. The audit register concerns bounded comparisons, not this scenario’s physical confidence.</p><p className={styles.identity}>{summary.modelVersion} · {summary.datasetId}<br />{summary.scenarioKey}</p>
      <ul>{summary.evidence.map(e => <li key={e.id}><strong>{e.label} · {e.coverage}</strong><p>{e.frame ?? 'Frame not supplied'}</p>{e.notes.map(note => <p key={note}>{note}</p>)}<p className={styles.identity}>{e.sha256 ? `Declared SHA256: ${e.sha256}` : 'SHA256 not supplied'}</p></li>)}</ul>
      {summary.warnings.map(warning => <p key={warning}>{warning}</p>)}
      <details><summary>Exact nominal inputs retained in export</summary><pre className={styles.inputs}>{JSON.stringify(summary.heldScenario, null, 2)}</pre></details>
    </details>
    <footer><Button variant="outline" onClick={() => onExport(exportEvidenceConfidence(summary, new Date().toISOString()))}>Export evidence summary</Button><p>Includes all held inputs, source declarations and validated finite cases. Recompute with the identified catalog and model before reuse.</p></footer>
  </section>;
}
