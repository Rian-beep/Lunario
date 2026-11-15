'use client';

import { useMemo } from 'react';
import { EvidenceConfidence } from '../evidence-confidence/summary';
import { ScienceFramework } from '../science-framework';
import { DataConnections } from './data-connections';
import { ResourcesPanel } from './panels';
import { evaluateEvidenceConfidence } from '../../lib/evidence-confidence';
import type { Catalog } from '../../lib/catalog';
import type { EvidenceManifest } from '../../lib/planning-types';
import type { ScenarioState } from '../../lib/scenario';
import type { ScienceFinding, ScienceFrameworkContext, ScienceFrameworkMode } from '../../lib/science-framework';
import scientificVerification from '../../lib/generated/scientific-verification.json';

export type DataMathPanelProps = {
  catalog: Catalog;
  state: ScenarioState;
  manifest: EvidenceManifest | null;
  mode: ScienceFrameworkMode;
  context: ScienceFrameworkContext;
  missionStartUtc: string;
  missionEndUtcExclusive: string;
  offline: boolean;
};

export function DataMathPanel({ catalog, state, manifest, mode, context, missionStartUtc, missionEndUtcExclusive, offline }: DataMathPanelProps) {
  const confidence = useMemo(() => {
    if (!manifest) return { summary: null, error: 'Evidence manifest unavailable. The selected scenario cannot be summarized yet.' };
    try { return { summary: evaluateEvidenceConfidence({ catalog, state, manifest }), error: null }; }
    catch (error) { return { summary: null, error: error instanceof Error ? error.message : 'Evidence summary unavailable.' }; }
  }, [catalog, state, manifest]);
  const audience = mode === 'teach' ? 'educator' : mode === 'plan' ? 'planner' : 'public';
  return <>
    {confidence.summary ? <EvidenceConfidence summary={confidence.summary} audience={audience}/> : <p role="status">{confidence.error}</p>}
    <DataConnections missionStartUtc={missionStartUtc} missionEndUtcExclusive={missionEndUtcExclusive} mode={mode} offline={offline}/>
    <ScienceFramework mode={mode} context={context} findings={scientificVerification.findings as readonly ScienceFinding[]}/>
    <ResourcesPanel catalog={catalog}/>
  </>;
}
