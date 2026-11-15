import { evaluateScenario, planningKey } from '../assessment';
import type { Catalog } from '../catalog';
import type { EvidenceManifest, AssessmentResult } from '../planning-types';
import type { ScenarioState } from '../scenario';
import { parseScenario } from '../scenario';
import { parseUncertainty, type BoundField, type StabilityResult, type UncertaintyEnvelope } from '../engineering-evidence/uncertainty';
import type { FiniteEvidence } from './types';

/** Recompute supplied finite cases: a matching key alone does not verify an imported result. */
export function resolveFiniteEvidence(catalog: Catalog, manifest: EvidenceManifest, state: ScenarioState, baseline: AssessmentResult, bounds?: UncertaintyEnvelope | null, result?: StabilityResult | null): FiniteEvidence {
  const empty = (status: FiniteEvidence['status'], explanation: string): FiniteEvidence => ({ status, explanation, bounds: null, result: null });
  if (!bounds && !result) return empty('missing', 'No declared input bounds or finite cases supplied. Physical uncertainty remains unquantified.');
  if ((bounds && bounds.scenarioKey !== baseline.scenarioKey) || (result && result.baselineKey !== baseline.scenarioKey)) {
    return empty('stale', 'Bounds or finite cases belong to different scenario inputs, dataset or model. Rerun for this selection.');
  }
  try {
    const parsed = parseUncertainty(bounds ?? { schema: 'solarreach-declared-bounds-1', scenarioKey: baseline.scenarioKey, bounds: result!.declaredBounds });
    if (!parsed.bounds.length) throw Error('At least one declared bound is needed.');
    let combinations: Array<Partial<Record<BoundField, number>>> = [{}];
    for (const bound of parsed.bounds) {
      const nominal = state.mission[bound.field];
      if (bound.lower > nominal || bound.upper < nominal) throw Error('A bound excludes the nominal input.');
      combinations = combinations.flatMap(values => [...new Set([bound.lower, nominal, bound.upper])].map(value => ({ ...values, [bound.field]: value })));
    }
    const candidates = combinations.map(values => {
      const candidate = parseScenario({ ...structuredClone(state), mission: { ...state.mission, ...values } }, { siteIds: catalog.sites.map(s => s.id), samples: catalog.meta.n, stepHours: catalog.meta.stepHours });
      if (!candidate) throw Error('A bound violates canonical scenario limits.');
      return { candidate, values };
    });
    if (!result) return { status: 'declared', explanation: 'Valid declared input bounds; finite cases have not been supplied. Provenance is author-stated, not calibration.', bounds: parsed, result: null };
    if (result.schema !== 'solarreach-finite-stability-1' || planningKey(result.declaredBounds) !== planningKey(parsed.bounds) || planningKey(result.heldRequirements) !== planningKey(state.requirements) || planningKey(result.heldOperations) !== planningKey(state.operations)) throw Error('Bounds or held assumptions differ.');
    const cases = candidates.map(({ candidate, values }) => {
      const a = evaluateScenario(catalog, candidate, manifest);
      return { id: planningKey({ baseline: baseline.scenarioKey, values, requirements: state.requirements }), values, scenarioKey: a.scenarioKey, outcome: a.outcome, minimumBatteryWh: a.mission.minBatteryWh, unmetWh: a.mission.unmetWh, minimumConstraintMargin: a.constraints.filter(c => c.required).map(c => ({ id: c.id, margin: c.margin, unit: c.unit })) };
    });
    if (planningKey(result.cases) !== planningKey(cases)) throw Error('Supplied cases differ from canonical recomputation.');
    const battery = cases.flatMap(c => c.minimumBatteryWh === null ? [] : [c.minimumBatteryWh]);
    // Derive aggregate claims from recomputation, never from imported flags or extrema.
    const verified: StabilityResult = { ...structuredClone(result), cases, declaredBounds: parsed.bounds, allCasesHaveBattery: battery.length === cases.length, outcomeStable: cases.every(c => c.outcome === baseline.outcome), sampledBatteryRangeWh: battery.length ? [Math.min(...battery), Math.max(...battery)] : null, interpretation: 'Finite declared cases only; no probability, continuous enclosure or qualified uncertainty', unquantified: ['Physical terrain/frame/height error and continuous event timing', 'Hardware/environment performance outside the supplied finite cases'] };
    return { status: 'current', explanation: `${cases.length} finite cases recomputed for this selection. Sample extrema enclose tested cases only; no continuous enclosure or probability.`, bounds: parsed, result: verified };
  } catch (error) {
    return empty('invalid', `Finite evidence cannot support this selection: ${error instanceof Error ? error.message : 'invalid input'}`);
  }
}
