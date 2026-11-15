import { evaluateScenario, planningKey } from '../assessment';
import type { Catalog } from '../catalog';
import type { AssessmentResult, EvidenceManifest } from '../planning-types';
import type { ScenarioState } from '../scenario';
import { controlledAlternative, errorMessage, type ReplanningCase } from './model';

export const MAX_SCAN_CASES = 48;
export const MAX_SCAN_INTERVALS = 150000;
export type TestedOption = ReplanningCase & { assessment: AssessmentResult | null; error: string | null; shiftHours: number };
export type RankedOption = TestedOption & { rank: 'non-dominated' | 'dominated' | 'unranked'; cohort: string | null };

export function alternativePlan(catalog: Catalog, base: ScenarioState, siteIds: readonly string[], shifts: readonly number[]): ReplanningCase[] {
  if (!shifts.length || shifts.length > 7 || siteIds.length > 6) throw new Error('Choose 1–7 date shifts and at most 6 alternative sites.');
  const locations: (string | null)[] = [null, ...new Set(siteIds.filter(id => base.custom !== null || id !== base.siteId))];
  const result: ReplanningCase[] = [];
  const seen = new Set<string>();
  for (const siteId of locations) for (const shift of shifts) {
    const state = controlledAlternative(catalog, base, siteId, shift), id = planningKey(state);
    if (seen.has(id)) continue;
    seen.add(id);
    const name = siteId === null ? (base.custom ? 'Current custom point' : catalog.sites.find(s => s.id === base.siteId)?.name ?? base.siteId) : catalog.sites.find(s => s.id === siteId)!.name;
    result.push({ id, name: `${name} · ${shift >= 0 ? '+' : ''}${shift} h`, state });
  }
  validateBudget(result);
  return result;
}

function validateBudget(cases: readonly ReplanningCase[]) {
  if (!cases.length || cases.length > MAX_SCAN_CASES || cases.reduce((sum, c) => sum + c.state.endIndex - c.state.startIndex + 1, 0) > MAX_SCAN_INTERVALS) {
    throw new Error(`Scan exceeds the ${MAX_SCAN_CASES}-case / ${MAX_SCAN_INTERVALS.toLocaleString('en-GB')}-forcing-interval budget. Reduce dates, sites or stay length.`);
  }
}

export async function scanAlternatives(catalog: Catalog, manifest: EvidenceManifest, base: ScenarioState, cases: readonly ReplanningCase[], options: { signal: AbortSignal; onProgress?: (completed: number) => void; yieldTask?: () => Promise<void> }): Promise<{ rows: TestedOption[]; cancelled: boolean }> {
  validateBudget(cases);
  const rows: TestedOption[] = [];
  const yieldTask = options.yieldTask ?? (() => new Promise<void>(resolve => setTimeout(resolve, 0)));
  for (const item of cases) {
    await yieldTask();
    if (options.signal.aborted) return { rows, cancelled: true };
    let assessment: AssessmentResult | null = null, error: string | null = null;
    try { assessment = evaluateScenario(catalog, item.state, manifest); }
    catch (cause) { error = errorMessage(cause); }
    rows.push({ ...item, assessment, error, shiftHours: (item.state.startIndex - base.startIndex) * catalog.meta.stepHours });
    options.onProgress?.(rows.length);
  }
  return { rows, cancelled: options.signal.aborted };
}

function objectives(row: TestedOption): [number, number, number] | null {
  const a = row.assessment;
  if (!a || a.mission.knownFraction < 1 || a.constraints.some(c => c.required && c.state === 'not-assessed') || a.mission.minBatteryWh === null || a.mission.longestBlackoutHours === null) return null;
  const values: [number, number, number] = [a.mission.minBatteryWh - row.state.mission.batteryWh * row.state.mission.reserveSoc, -a.mission.longestBlackoutHours, -Math.abs(row.shiftHours)];
  return values.every(Number.isFinite) ? values : null;
}
function cohort(row: TestedOption): string | null {
  if (!objectives(row) || !row.assessment) return null;
  const required = row.assessment.constraints.filter(c => c.required);
  // Limits come from the authority: some requirements live inside hardware/analytical inputs.
  const effectiveConstraints = required.map(c => [c.id, c.relation, c.unit, c.limit, c.evidenceIds]);
  const engineering = row.assessment.engineeringScreens?.filter(s => required.some(c => c.id === `engineering:${s.id}`)).map(s => [s.id, row.state.engineeringInputs?.[s.id]]);
  return planningKey({ requirements: row.state.requirements, effectiveConstraints,
    reserveObjective: { fraction: row.state.mission.reserveSoc, limitWh: row.state.mission.batteryWh * row.state.mission.reserveSoc },
    contactCutoffDeg: row.state.mission.antennaMaskDeg,
    requiredRadioEbN0Db: required.some(c => c.id === 'assumed-radio') ? row.state.radio?.requiredEbN0Db : null,
    engineering, evidence: row.assessment.evidence.map(e => [e.id, e.coverage]), external: required.filter(c => c.relation === 'evidence').map(c => [c.id, c.state]), dataset: row.assessment.datasetId, model: row.assessment.modelVersion });
}
/** No ranking across different requirement/evidence scopes, and no substitution of zero for unknown. */
export function paretoOptions(rows: readonly TestedOption[]): RankedOption[] {
  const values = rows.map(objectives), cohorts = rows.map(cohort);
  return rows.map((row, i) => {
    const target = values[i];
    if (!target) return { ...row, rank: 'unranked', cohort: null };
    const dominated = values.some((other, j) => j !== i && other !== null && cohorts[i] === cohorts[j] && other.every((v, k) => v >= target[k]) && other.some((v, k) => v > target[k]));
    return { ...row, rank: dominated ? 'dominated' : 'non-dominated', cohort: cohorts[i] };
  });
}
