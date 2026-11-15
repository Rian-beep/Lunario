import { evaluateScenario } from '../assessment';
import { resolveAnalysisContext } from '../analysis-context';
import { indexToMs } from '../astro';
import type { Catalog } from '../catalog';
import type { AssessmentContext, AssessmentResult, EvidenceManifest } from '../planning-types';
import { parseScenario, type ScenarioState } from '../scenario';

export type ReplanningCase = { id: string; name: string; state: ScenarioState };
export type PreparedCase = ReplanningCase & { assessment: AssessmentResult; context: AssessmentContext };
export type CaseResult = { value: PreparedCase; error: null } | { value: null; error: string };
export type Alignment = 'elapsed' | 'utc';
export type CursorDomain = { min: number; max: number; step: number; originMs: number; alignment: Alignment };
export type CaseCursor = { index: number; localIndex: number; utcMs: number; elapsedHours: number };
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

export function prepareCase(catalog: Catalog, manifest: EvidenceManifest, item: ReplanningCase): CaseResult {
  try {
    const state = parseScenario(item.state, { siteIds: catalog.sites.map(s => s.id), samples: catalog.meta.n, stepHours: catalog.meta.stepHours });
    if (!state) throw new Error('Invalid scenario inputs or unsupported dates; this case was not shortened.');
    const assessment = evaluateScenario(catalog, state, manifest);
    const context = resolveAnalysisContext(catalog, { ...state, displayHeightM: state.heightM }, manifest);
    return { value: { ...item, state, assessment, context }, error: null };
  } catch (error) {
    return { value: null, error: errorMessage(error) };
  }
}

export function cursorDomain(catalog: Catalog, reference: ScenarioState, candidate: ScenarioState, alignment: Alignment): CursorDomain | null {
  const step = catalog.meta.stepHours;
  if (alignment === 'elapsed') return { min: 0, max: Math.max(reference.endIndex - reference.startIndex, candidate.endIndex - candidate.startIndex) * step, step, originMs: 0, alignment };
  const first = Math.max(reference.startIndex, candidate.startIndex), last = Math.min(reference.endIndex, candidate.endIndex);
  return first > last ? null : { min: 0, max: (last - first) * step, step, originMs: indexToMs(catalog, first), alignment };
}

export function clampCursor(value: number, domain: CursorDomain): number {
  return Math.max(domain.min, Math.min(domain.max, Math.round((Number.isFinite(value) ? value : 0) / domain.step) * domain.step));
}

/** A shorter case has no corresponding sample: never pin it to its final hour. */
export function caseCursor(catalog: Catalog, state: ScenarioState, domain: CursorDomain, value: number): CaseCursor | null {
  const hours = clampCursor(value, domain);
  const index = domain.alignment === 'elapsed' ? state.startIndex + Math.round(hours / domain.step) : Math.round((domain.originMs - catalog.t0ms) / (domain.step * 3600000)) + Math.round(hours / domain.step);
  if (index < state.startIndex || index > state.endIndex) return null;
  return { index, localIndex: index - state.startIndex, utcMs: indexToMs(catalog, index), elapsedHours: (index - state.startIndex) * domain.step };
}

export function cursorFromIndex(catalog: Catalog, state: ScenarioState, domain: CursorDomain, index: number): number {
  return clampCursor(domain.alignment === 'elapsed' ? (index - state.startIndex) * domain.step : (indexToMs(catalog, index) - domain.originMs) / 3600000, domain);
}

export type InputRow = { path: string; before: unknown; after: unknown; changed: boolean };
function leaves(value: unknown, path: string, output: Map<string, unknown>) {
  if (value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length) {
    for (const [key, entry] of Object.entries(value)) leaves(entry, path ? `${path}.${key}` : key, output);
  } else output.set(path, value);
}
/** Includes configured flight fields and evidence bindings, even outside the resource screen. */
export function compareInputs(reference: ScenarioState, candidate: ScenarioState): InputRow[] {
  const a = new Map<string, unknown>(), b = new Map<string, unknown>();
  leaves(reference, '', a); leaves(candidate, '', b);
  return [...new Set([...a.keys(), ...b.keys()])].sort().map(path => ({ path, before: a.get(path), after: b.get(path), changed: JSON.stringify(a.get(path)) !== JSON.stringify(b.get(path)) }));
}

export function controlledAlternative(catalog: Catalog, base: ScenarioState, siteId: string | null, shiftHours: number): ScenarioState {
  if (!Number.isFinite(shiftHours) || !Number.isInteger(shiftHours / catalog.meta.stepHours)) throw new Error(`Date shift must be a multiple of ${catalog.meta.stepHours} h.`);
  if (siteId !== null && !catalog.sites.some(s => s.id === siteId)) throw new Error('Unknown alternative site.');
  const shift = shiftHours / catalog.meta.stepHours;
  return { ...structuredClone(base), ...(siteId === null ? {} : { siteId, custom: null }), startIndex: base.startIndex + shift, endIndex: base.endIndex + shift };
}

/** A temporary edit never mutates the captured reference or the active mission. */
export function editCapturedCandidate(catalog: Catalog, candidate: ReplanningCase, siteId: string | null, shiftHours: number): ReplanningCase {
  const next = controlledAlternative(catalog, candidate.state, siteId, shiftHours);
  const state = parseScenario(next, {siteIds: catalog.sites.map(site => site.id), samples: catalog.meta.n, stepHours: catalog.meta.stepHours});
  if (!state) throw new Error('Candidate arrival is outside the available data. The stay was not shortened.');
  return {id: 'edited-candidate', name: 'Edited candidate', state};
}

export const OUTCOME_LABELS: Record<AssessmentResult['outcome'], string> = {
  'fails-assessed': 'Fails an assessed requirement', incomplete: 'Incomplete evidence', conditional: 'Conditional on model evidence', 'passes-assessed': 'Meets assessed requirements', 'not-configured': 'No requirements configured',
};

export type ResultDelta = { label: string; unit: string; terrain: number | null; sphere: number | null };
export function resultDeltas(reference: PreparedCase, candidate: PreparedCase): ResultDelta[] {
  const difference = (a: number | null, b: number | null) => a === null || b === null ? null : b - a;
  const reserve = (item: PreparedCase, sphere: boolean) => {
    const minimum = (sphere ? item.assessment.sphereMission : item.assessment.mission).minBatteryWh;
    return minimum === null ? null : minimum - item.state.mission.batteryWh * item.state.mission.reserveSoc;
  };
  const metric = (label: string, unit: string, key: 'unmetWh' | 'contactFraction' | 'longestBlackoutHours', scale = 1): ResultDelta => {
    const t = difference(reference.assessment.mission[key], candidate.assessment.mission[key]);
    const s = difference(reference.assessment.sphereMission[key], candidate.assessment.sphereMission[key]);
    return { label, unit, terrain: t === null ? null : t * scale, sphere: s === null ? null : s * scale };
  };
  return [
    { label: 'Reserve margin', unit: 'Wh', terrain: difference(reserve(reference, false), reserve(candidate, false)), sphere: difference(reserve(reference, true), reserve(candidate, true)) },
    metric('Unserved demand', 'Wh', 'unmetWh'),
    metric('Geometric antenna contact', 'percentage points', 'contactFraction', 100),
    metric('Longest observed outage', 'h', 'longestBlackoutHours'),
  ];
}
