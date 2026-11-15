import { evaluateScenario, planningKey } from '../assessment';
import { parseScenario, type ScenarioState } from '../scenario';
import type { Catalog } from '../catalog';
import type { AssessmentResult, EvidenceManifest } from '../planning-types';
import { list, number, object, provenance, text } from './import';
import type { Provenance } from './types';
export const UNCERTAINTY_FIELDS = ['areaM2', 'efficiency', 'lossFraction', 'loadW', 'batteryWh', 'initialSoc', 'chargeEfficiency', 'dischargeEfficiency', 'solarFlux'] as const;
export type BoundField = typeof UNCERTAINTY_FIELDS[number];
export type DeclaredBound = {
    field: BoundField;
    lower: number;
    upper: number;
    provenance: Provenance;
};
export type UncertaintyEnvelope = {
    schema: 'solarreach-declared-bounds-1';
    scenarioKey: string;
    bounds: DeclaredBound[];
};
export type BoundedCase = {
    id: string;
    values: Partial<Record<BoundField, number>>;
    scenarioKey: string;
    outcome: AssessmentResult['outcome'];
    minimumBatteryWh: number | null;
    unmetWh: number | null;
    minimumConstraintMargin: Array<{
        id: string;
        margin: number | null;
        unit: string | null;
    }>;
};
export type StabilityResult = {
    schema: 'solarreach-finite-stability-1';
    baselineKey: string;
    heldRequirements: ScenarioState['requirements'];
    heldOperations: ScenarioState['operations'];
    declaredBounds: DeclaredBound[];
    cases: BoundedCase[];
    sampledBatteryRangeWh: [
        number,
        number
    ] | null;
    allCasesHaveBattery: boolean;
    outcomeStable: boolean;
    interpretation: 'Finite declared cases only; no probability, continuous enclosure or qualified uncertainty';
    unquantified: string[];
};
export function parseUncertainty(v: unknown): UncertaintyEnvelope {
    const e = object(v);
    if (e.schema !== 'solarreach-declared-bounds-1')
        throw Error('Unsupported uncertainty schema');
    const bounds = list(e.bounds, 3, x => { const b = object(x); if (!UNCERTAINTY_FIELDS.includes(b.field as BoundField))
        throw Error('Unsupported bound field'); const lower = number(b.lower, 0, 1e9), upper = number(b.upper, 0, 1e9); if (lower > upper)
        throw Error('Bound endpoints are reversed'); return { field: b.field as BoundField, lower, upper, provenance: provenance(b.provenance) }; });
    if (new Set(bounds.map(b => b.field)).size !== bounds.length)
        throw Error('Duplicate bound field');
    return { schema: 'solarreach-declared-bounds-1', scenarioKey: text(e.scenarioKey, 300), bounds };
}
export async function evaluateDeclaredBounds(catalog: Catalog, manifest: EvidenceManifest, state: ScenarioState, input: UncertaintyEnvelope, options: {
    signal?: AbortSignal;
    onProgress?: (done: number, total: number) => void;
} = {}): Promise<StabilityResult> {
    const e = parseUncertainty(input), baseline = evaluateScenario(catalog, state, manifest);
    if (e.scenarioKey !== baseline.scenarioKey)
        throw Error('Declared bounds are stale for this scenario');
    if (!e.bounds.length)
        throw Error('Uncertainty is unquantified: declare at least one bound');
    let combinations: Array<Partial<Record<BoundField, number>>> = [{}];
    for (const b of e.bounds) {
        if (state.mission[b.field] < b.lower || state.mission[b.field] > b.upper)
            throw Error('Each bound must contain its nominal scenario value');
        const levels = [...new Set([b.lower, state.mission[b.field], b.upper])];
        combinations = combinations.flatMap(c => levels.map(value => ({ ...c, [b.field]: value })));
    }
    const cases: BoundedCase[] = [];
    const prepared = combinations.map(values => { const candidate = { ...structuredClone(state), mission: { ...state.mission, ...values } }; const valid = parseScenario(candidate, { siteIds: catalog.sites.map(s => s.id), samples: catalog.meta.n, stepHours: catalog.meta.stepHours }); if (!valid)
        throw Error('A declared case violates canonical scenario limits'); return { candidate: valid, values }; });
    for (const { candidate, values } of prepared) {
        options.signal?.throwIfAborted();
        const a = evaluateScenario(catalog, candidate, manifest);
        cases.push({ id: planningKey({ baseline: baseline.scenarioKey, values, requirements: state.requirements }), values, scenarioKey: a.scenarioKey, outcome: a.outcome, minimumBatteryWh: a.mission.minBatteryWh, unmetWh: a.mission.unmetWh, minimumConstraintMargin: a.constraints.filter(c => c.required).map(c => ({ id: c.id, margin: c.margin, unit: c.unit })) });
        options.onProgress?.(cases.length, prepared.length);
        await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
    options.signal?.throwIfAborted();
    const battery = cases.flatMap(c => c.minimumBatteryWh === null ? [] : [c.minimumBatteryWh]);
    return { schema: 'solarreach-finite-stability-1', baselineKey: baseline.scenarioKey, heldRequirements: structuredClone(state.requirements), heldOperations: structuredClone(state.operations), declaredBounds: e.bounds, cases, sampledBatteryRangeWh: battery.length ? [Math.min(...battery), Math.max(...battery)] : null, allCasesHaveBattery: battery.length === cases.length, outcomeStable: cases.every(c => c.outcome === baseline.outcome), interpretation: 'Finite declared cases only; no probability, continuous enclosure or qualified uncertainty', unquantified: ['Terrain effective error and event-time uncertainty', 'Residual source/frame equivalence and spatial borrowing', ...UNCERTAINTY_FIELDS.filter(f => !e.bounds.some(b => b.field === f)).map(f => `${f}: no declared bound`)] };
}
