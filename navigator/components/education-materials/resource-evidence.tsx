import type { Catalog } from '@/lib/catalog';
import type { AssessmentResult } from '@/lib/planning-types';
import type { ScenarioState } from '@/lib/scenario';
import type { PhysicsReferenceMode } from '@/lib/physics-reference';
import {
  RESOURCE_LESSONS, RESOURCE_METRICS, RESOURCE_TOPICS, resourceEvidence, resourceMetric,
  type ResearchSource,
} from '@/lib/education-materials/resource-evidence';
import styles from './resource-evidence.module.css';

type ResourceCase = { state: ScenarioState; assessment: AssessmentResult | null };

export function ResearchLinks({ sources }: { sources: readonly ResearchSource[] }) {
  return <ul className={styles.sources}>
    {sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}
  </ul>;
}

function ResourceMetrics({ evidence }: { evidence: ReturnType<typeof resourceEvidence> }) {
  return <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Scenario results">
    <table>
      <caption>Modelled over the selected stay</caption>
      <thead><tr><th scope="col">Measure</th><th scope="col">Terrain model</th><th scope="col">Smooth sphere</th></tr></thead>
      <tbody>{RESOURCE_METRICS.map(({ key, label, unit }) => <tr key={key}>
        <th scope="row">{label}</th>
        {evidence.metrics[key].map((value, index) => <td key={index}>{resourceMetric(value, unit)}</td>)}
      </tr>)}</tbody>
    </table>
  </div>;
}

export function ResourceEvidencePanel({ catalog, state, assessment, mode }: ResourceCase & {
  catalog: Catalog;
  mode: PhysicsReferenceMode;
}) {
  const evidence = resourceEvidence(catalog, state, assessment);
  return <section className={styles.panel} aria-label="Lunar ice evidence and next steps">
    <p className={styles.context}>{evidence.siteName} · {evidence.arrival} · {evidence.hours} h stay</p>
    <p>{evidence.focus}</p>
    {evidence.siteSource && <ResearchLinks sources={[evidence.siteSource]} />}
    <div className={styles.cards}>
      {RESOURCE_TOPICS.map(topic => {
        const lesson = RESOURCE_LESSONS[topic];
        return <section className={styles.card} key={topic}>
          <h4>{lesson.title}</h4>
          <p>{lesson.explanation}</p>
          <p className={styles.context}>{evidence.observations[topic]}</p>
          <p><strong>Next investigation</strong> · {lesson.next}</p>
          {mode === 'teach' && <p><strong>Discuss</strong> · {lesson.prompt}</p>}
          <details open={mode === 'plan'}>
            <summary>Technical detail and research</summary>
            <p>{lesson.detail}</p>
            <ResearchLinks sources={lesson.sources} />
          </details>
        </section>;
      })}
    </div>
    <details open={mode === 'plan'}>
      <summary>Power and contact for this scenario</summary>
      <ResourceMetrics evidence={evidence} />
      {mode === 'plan' && assessment && <p className={styles.context}>
        {assessment.datasetId} · {assessment.modelVersion} · {catalog.meta.stepHours} h source intervals.
        Array {state.arrayHeightM ?? state.heightM} m · antenna {state.antennaHeightM ?? state.heightM} m above the local surface.
      </p>}
    </details>
    <p><strong>Start here</strong> · {evidence.next}</p>
  </section>;
}

export function ResourceEvidenceComparison({ catalog, cases }: {
  catalog: Catalog;
  cases: (ResourceCase & { id: string; name: string })[];
}) {
  return <details className={styles.panel}>
    <summary>Lunar ice evidence and next steps</summary>
    <p>Local ice concentration, the route to a shadowed target and extraction yield are unassessed. Compare the available power and contact estimates for each stay.</p>
    <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Lunar ice evidence by saved scenario">
      <table>
        <caption>Terrain model / smooth sphere</caption>
        <thead><tr>
          <th scope="col">Scenario</th>
          {RESOURCE_METRICS.map(({ key, label }) => <th scope="col" key={key}>{label}</th>)}
          <th scope="col">Next investigation</th>
        </tr></thead>
        <tbody>{cases.map(item => {
          const evidence = resourceEvidence(catalog, item.state, item.assessment);
          return <tr key={item.id}>
            <th scope="row">{item.name}<small>{evidence.siteName} · {evidence.arrival} · {evidence.hours} h</small></th>
            {RESOURCE_METRICS.map(({ key, unit }) => <td key={key}>
              {evidence.metrics[key].map(value => resourceMetric(value, unit)).join(' / ')}
            </td>)}
            <td>{evidence.next}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  </details>;
}
