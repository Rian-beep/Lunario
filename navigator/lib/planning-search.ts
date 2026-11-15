import { evaluateScenario, planningKey } from './assessment';
import type { Catalog } from './catalog';
import type { AssessmentOutcome, AssessmentResult, EvidenceManifest } from './planning-types';
import { migrateScenario, type ScenarioState } from './scenario';

export type SearchRequest = {
  base: ScenarioState; siteIds: string[]; firstStartIndex: number; lastStartIndex: number;
  durationSamples: number; startStepSamples: number; maxResults: number;
};
export type MissionSearchRow = { state: ScenarioState; assessment: AssessmentResult };
export type MissionSearchCounts = {
  total: number; evaluated: number; passed: number; conditional: number;
  incomplete: number; failed: number; notConfigured: number; outside: number;
};
export type MissionSearchResult = {
  requestKey: string; rows: MissionSearchRow[]; counts: MissionSearchCounts;
  truncated: boolean; retained: number;
};
export type MissionSearchOptions = {
  signal?: AbortSignal;
  onProgress?: (progress: { requestKey: string; completed: number; total: number; counts: MissionSearchCounts }) => void;
  /** Compare against the UI's current full request key, including after yields. */
  isCurrent?: (requestKey: string) => boolean;
};
export function planningSearchKey(catalog: Catalog, manifest: EvidenceManifest, request: SearchRequest): string {
  const base = structuredClone(request.base);
  if (base.custom) base.custom.lon = ((base.custom.lon % 360) + 540) % 360 - 180;
  return planningKey({ base, siteIds: [...request.siteIds].sort(), firstStartIndex: request.firstStartIndex,
    lastStartIndex: request.lastStartIndex, durationSamples: request.durationSamples,
    startStepSamples: request.startStepSamples, maxResults: request.maxResults,
    catalog: catalog.meta, manifest });
}
const order: Record<AssessmentOutcome, number> = {
  'passes-assessed': 0, conditional: 1, incomplete: 2, 'fails-assessed': 3, 'not-configured': 4,
};
export const MISSION_SEARCH_SORT_POLICY = 'Assessed passes, conditional, incomplete, assessed failures, not configured; then reserve margin descending, geometric outage ascending, arrival UTC ascending, site ID ascending.';
export function compareMissionSearchRows(a: MissionSearchRow, b: MissionSearchRow): number {
  const reserve = (row: MissionSearchRow) => row.assessment.constraints.find(c => c.id === 'reserve')?.margin ?? -Infinity;
  const outage = (row: MissionSearchRow) => row.assessment.mission.longestBlackoutHours ?? Infinity;
  return order[a.assessment.outcome] - order[b.assessment.outcome] ||
    (reserve(b) > reserve(a) ? 1 : reserve(b) < reserve(a) ? -1 : 0) ||
    (outage(a) > outage(b) ? 1 : outage(a) < outage(b) ? -1 : 0) ||
    a.state.startIndex - b.state.startIndex || a.state.siteId.localeCompare(b.state.siteId);
}
function abort(): never { throw new DOMException('Mission search canceled or superseded.', 'AbortError'); }
/** Whole missions only. The 8 ms budget yields between indivisible synchronous assessments. */
export async function searchMissionWindows(catalog: Catalog, manifest: EvidenceManifest, input: SearchRequest,
  options: MissionSearchOptions = {}): Promise<MissionSearchResult> {
  const request = structuredClone(input);
  if (!Array.isArray(request.siteIds) || request.siteIds.length < 1 || request.siteIds.length > 20 ||
    new Set(request.siteIds).size !== request.siteIds.length || request.siteIds.some(id => !catalog.sites.some(s => s.id === id)))
    throw new RangeError('Choose 1–20 distinct prepared catalog sites.');
  for (const [name, value] of Object.entries({durationSamples:request.durationSamples,startStepSamples:request.startStepSamples,maxResults:request.maxResults}))
    if (!Number.isSafeInteger(value) || value < 1) throw new RangeError(`${name} must be a positive integer.`);
  if (request.maxResults > 100) throw new RangeError('Choose at most 100 retained results.');
  if (!Number.isSafeInteger(request.firstStartIndex) || !Number.isSafeInteger(request.lastStartIndex) ||
    request.firstStartIndex < 0 || request.lastStartIndex < request.firstStartIndex)
    throw new RangeError('Search start bounds must be ordered nonnegative sample indices.');
  const total = (Math.floor((request.lastStartIndex - request.firstStartIndex) / request.startStepSamples) + 1) * request.siteIds.length;
  if (!Number.isSafeInteger(total) || total > 10000) throw new RangeError('Search exceeds 10,000 candidate starts. Narrow the date range, choose fewer sites or increase start cadence.');
  const bounds = {siteIds:catalog.sites.map(s => s.id),samples:catalog.meta.n,stepHours:catalog.meta.stepHours};
  // Validate schedules against the searched duration before starting numerical work.
  if (!migrateScenario({...request.base,startIndex:0,endIndex:request.durationSamples-1},bounds))
    throw new RangeError('Mission inputs or schedules are invalid for the requested duration or prepared coverage.');
  const requestKey = planningSearchKey(catalog,manifest,request);
  const check = () => { if (options.signal?.aborted || options.isCurrent?.(requestKey) === false) abort(); };
  const counts: MissionSearchCounts = {total,evaluated:0,passed:0,conditional:0,incomplete:0,failed:0,notConfigured:0,outside:0};
  const rows: MissionSearchRow[] = [];
  const outcomeCount = {'passes-assessed':'passed',conditional:'conditional',incomplete:'incomplete','fails-assessed':'failed','not-configured':'notConfigured'} as const;
  let completed = 0, chunkStart = performance.now();
  const progress = () => options.onProgress?.({requestKey,completed,total,counts:{...counts}});
  check(); progress(); check();
  for (let start = request.firstStartIndex; start <= request.lastStartIndex; start += request.startStepSamples) {
    for (const siteId of [...request.siteIds].sort()) {
      check();
      const state = structuredClone(request.base);
      state.siteId = siteId;
      // Preserve the current custom point only for its own selected site; other IDs mean catalog locations.
      if (siteId !== request.base.siteId) state.custom = null;
      state.startIndex = start; state.endIndex = start + request.durationSamples - 1;
      const startUtc = catalog.t0ms + start * catalog.meta.stepHours * 3600000;
      const endUtc = catalog.t0ms + (state.endIndex + 1) * catalog.meta.stepHours * 3600000;
      if (!Number.isSafeInteger(state.endIndex) || state.endIndex >= catalog.meta.n - 1 ||
        startUtc < Date.parse(manifest.validFromUtc) || endUtc > Date.parse(manifest.validUntilUtcExclusive)) counts.outside++;
      else {
        const assessment = evaluateScenario(catalog,state,manifest);
        check();
        counts.evaluated++; counts[outcomeCount[assessment.outcome]]++;
        rows.push({state,assessment}); rows.sort(compareMissionSearchRows);
        if (rows.length > request.maxResults) rows.pop();
      }
      completed++;
      if (performance.now() - chunkStart >= 8 && completed < total) {
        progress(); check();
        await new Promise<void>(resolve => setTimeout(resolve,0));
        check(); chunkStart = performance.now();
      }
    }
  }
  check(); progress(); check();
  return {requestKey,rows,counts,truncated:counts.evaluated > rows.length,retained:rows.length};
}
