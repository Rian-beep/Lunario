import type { ScenarioState } from '../scenario';
import type { AssessmentResult, ConstraintResult, EvidenceRef } from '../planning-types';
import type { StabilityResult, UncertaintyEnvelope } from '../engineering-evidence/uncertainty';

export type EvidenceBasis = 'reference-comparison' | 'reported-measurement' | 'quantization-only' | 'assumed' | 'declared-bound' | 'finite-sensitivity' | 'unquantified';
export type ConfidenceItem = {
  id: string;
  title: string;
  basis: EvidenceBasis;
  detail: string;
  decisionLimit: string;
  nextEvidence: string;
  evidenceIds: string[];
};
export type FiniteEvidence = {
  status: 'missing' | 'declared' | 'current' | 'stale' | 'invalid';
  explanation: string;
  bounds: UncertaintyEnvelope | null;
  result: StabilityResult | null;
};
export type ConfidenceMetric = {
  id: 'minimum-battery' | 'unserved-demand' | 'earth-visibility';
  label: string;
  unit: 'Wh' | 'fraction';
  terrain: number | null;
  sphere: number | null;
};
export type EvidenceConfidenceSummary = {
  schema: 'solarreach-evidence-confidence-1';
  scenarioKey: string;
  datasetId: string;
  modelVersion: string;
  scope: AssessmentResult['scope'];
  outcome: AssessmentResult['outcome'];
  selection: {
    name: string;
    lat: number;
    lon: number;
    locationBasis: string;
    locationSource: string;
    startUtc: string;
    endUtcExclusive: string;
    stepHours: number;
    heightsM: { display: number; array: number; antenna: number };
  };
  calibratedPhysicalUncertainty: 'not-supplied';
  physicalOutcomeInterval: null;
  interpretation: string;
  metrics: ConfidenceMetric[];
  decisionLimits: ConstraintResult[];
  items: ConfidenceItem[];
  evidence: EvidenceRef[];
  warnings: string[];
  finite: FiniteEvidence;
  // Full accepted inputs, rather than only the fields changed by a finite case.
  heldScenario: ScenarioState;
};
