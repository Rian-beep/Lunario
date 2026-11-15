import { summarizeStationEvidence } from '../../lib/engineering-evidence/summary';
import type { Span } from '../../lib/engineering-evidence/types';

export type StationEvidenceSummaryProps = {
  envelope: unknown;
  scenarioKey: string;
  stay: Span;
  /** Wall-clock UTC for source chronology; stay holds the independent mission dates. */
  nowUtc: string;
};
/** Mount within the existing engineering evidence workspace; no requests or persistent UI. */
export function StationEvidenceSummary({ envelope, scenarioKey, stay, nowUtc }: StationEvidenceSummaryProps) {
  const summary = summarizeStationEvidence(envelope, scenarioKey, stay, nowUtc), result = summary.result;
  return <details className="rounded-xl border bg-card p-3 text-foreground">
    <summary className="cursor-pointer text-sm font-medium">Station evidence · {summary.station?.antenna ?? 'import needed'} · {summary.state === 'current' ? 'current binding' : summary.state}</summary>
    {summary.error ? <p role="alert" className="mt-3 break-words text-sm">Invalid evidence: {summary.error}. Correct the import and retain its source bytes; no capacity result is available.</p> : <>
      <p className="mt-3 text-sm">{summary.station!.name} / {summary.station!.antenna} · conditional screen: {result!.status}. Modeled capacity: {result!.deliveredBits ?? 'unknown'} bit; modeled contact: {result!.contactSeconds ?? 'unknown'} s.</p>
      <p className="mt-2 break-words text-xs">Antenna location: {summary.station!.latitudeDeg}° latitude, {summary.station!.longitudeEastDeg}° east longitude; {summary.station!.heightM} m WGS84 ellipsoid height.</p>
      <p className="mt-2 break-words text-xs">Stay [start, end): {stay.startUtc} to {stay.endUtc}. Only evaluateScenario supplies the overall mission assessment.</p>
      {summary.geometry && <p className="mt-2 break-words text-xs">Source retrieved {summary.geometry.fetchedUtc}; age {summary.geometry.ageHours.toFixed(1)} h. Samples {summary.geometry.coverage.startUtc} to {summary.geometry.coverage.endUtc}; {summary.geometry.units}.
        {summary.geometry.eopCoverage ? ` EOP data ${summary.geometry.eopCoverage.dataStartUtc} to ${summary.geometry.eopCoverage.dataEndUtc}; predictions to ${summary.geometry.eopCoverage.predictionEndUtc}. Coverage uses conservative midnight boundaries.` : ' EOP coverage unknown.'}</p>}
      <dl className="mt-3 grid gap-3">
        {summary.rows.map(row => <div key={row.id} className="border-t pt-2">
          <dt className="text-xs font-medium">{row.title} · {row.state}{row.coveredSeconds !== null && ` · ${row.coveredSeconds} s covered`}</dt>
          <dd className="mt-1 break-words text-xs">{row.detail}</dd>
          {row.provenance && <dd className="mt-1 break-words text-xs">{row.provenance.title} · {row.provenance.kind} · {row.provenance.author} · issued {row.provenance.issuedUtc} · source {row.provenance.sourceUrl}. Source version: not encoded separately; retain the original document/version in provenance.</dd>}
          <dd className="mt-1 text-xs">Next: {row.nextAction}</dd>
        </div>)}
      </dl>
      <details className="mt-3 border-t pt-2">
        <summary className="cursor-pointer text-xs font-medium">Critical windows · {summary.critical.length}</summary>
        {!summary.critical.length && <p className="mt-2 text-xs">No critical windows configured. Add required contact/data windows before judging their adequacy.</p>}
        {summary.critical.map(c => <p key={c.id} className="mt-2 break-words text-xs">{c.id} · {c.startUtc} to {c.endUtc} · {c.status}. Modeled {c.bits ?? 'unknown'} bit / {c.seconds ?? 'unknown'} s; requires {c.minimumBits} bit / {c.minimumContactSeconds} s. Hourly geometry does not guarantee acquisition or continuous contact within this window.</p>)}
      </details>
    </>}
    <p className="mt-3 text-xs">{summary.refresh}</p>
  </details>;
}
