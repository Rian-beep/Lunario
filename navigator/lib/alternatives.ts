import { MOON_RADIUS_KM } from "./astro";
import { evaluateScenario, planningKey } from "./assessment";
import { parseEvidenceManifest } from "./provenance";
import bundledManifest from "../public/data/evidence-manifest.json";
import type { AssessmentResult, EvidenceManifest } from "./planning-types";
import type {
  AlternativeCandidate,
  AlternativeCriteria,
  AlternativeMetrics,
  AlternativeResult,
} from "./alternative-types";
import type { Catalog } from "./catalog";
import { validateMission } from "./mission";
import type { ScenarioState } from "./scenario";

function bounded(value: number, name: string, max = Number.MAX_SAFE_INTEGER): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max)
    throw new RangeError(`${name} must be finite and between 0 and ${max}`);
}

function validateCriteria(criteria: AlternativeCriteria): void {
  for (const key of ["minSunFraction", "minContactFraction"] as const)
    if (criteria[key] !== null) bounded(criteria[key], key, 1);
  for (const key of ["maxDarkHours", "maxBlackoutHours"] as const)
    if (criteria[key] !== null) bounded(criteria[key], key);
  if (criteria.maxSlopeDeg !== null) bounded(criteria.maxSlopeDeg, "maxSlopeDeg", 90);
  bounded(criteria.minBatteryWh, "minBatteryWh");
  bounded(criteria.maxUnmetWh, "maxUnmetWh");
}

export function criteriaForBaseline(baseline: ScenarioState): AlternativeCriteria {
  validateMission(baseline.mission);
  return {
    minSunFraction: null,
    minContactFraction: null,
    maxDarkHours: null,
    maxBlackoutHours: null,
    maxSlopeDeg: null,
    minBatteryWh: baseline.mission.batteryWh * baseline.mission.reserveSoc,
    maxUnmetWh: 0,
  };
}

function validateLocation(lat: number, lon: number): void {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 360)
    throw new RangeError("Candidate coordinates are outside the lunar latitude/longitude range");
}

function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2
    + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lon - a.lon) * rad / 2) ** 2;
  return 2 * MOON_RADIUS_KM * Math.asin(Math.sqrt(Math.max(0, Math.min(1, h))));
}

function currentCandidate(catalog: Catalog, baseline: ScenarioState): AlternativeCandidate {
  const site = catalog.sites.find((s) => s.id === baseline.siteId);
  const point = baseline.custom ?? site;
  if (!point) throw new Error(`Unknown baseline site: ${baseline.siteId}`);
  validateLocation(point.lat, point.lon);
  return {
    id: baseline.custom ? `custom:${point.lat}:${point.lon}` : baseline.siteId,
    name: baseline.custom ? "Current custom landing point" : site!.name,
    lat: point.lat,
    lon: point.lon,
    siteId: baseline.siteId,
    custom: baseline.custom ? { ...baseline.custom } : null,
    distanceKm: 0,
  };
}

/** Lunar great-circle region; the current point wins coordinate and ID duplicates. */
export function nearbyCandidates(
  catalog: Catalog,
  baseline: ScenarioState,
  radiusKm: number,
  max = 12,
): AlternativeCandidate[] {
  bounded(radiusKm, "radiusKm");
  if (!Number.isSafeInteger(max) || max < 1) throw new RangeError("max must be a positive integer");
  const current = currentCandidate(catalog, baseline);
  const candidates = catalog.sites.map((site): AlternativeCandidate => {
    validateLocation(site.lat, site.lon);
    return {
      id: site.id, name: site.name, lat: site.lat, lon: site.lon,
      siteId: site.id, custom: null, distanceKm: distanceKm(current, site),
    };
  }).filter((candidate) => candidate.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm || a.id.localeCompare(b.id));
  const result = [current];
  for (const candidate of candidates) {
    if (result.length >= Math.min(12, max)) break;
    if (result.some((previous) => previous.id === candidate.id || distanceKm(previous, candidate) < 1e-9)) continue;
    result.push(candidate);
  }
  return result;
}

function unavailableMetrics(): AlternativeMetrics {
  return {
    sunFraction: null, contactFraction: null, longestDarkHours: null,
    longestBlackoutHours: null, generatedWh: null, minBatteryWh: null,
    unmetWh: null, slopeDeg: null, knownFraction: 0,
  };
}

const defaultManifest = parseEvidenceManifest(bundledManifest);
function inCatalog(catalog: Catalog, state: ScenarioState, manifest: EvidenceManifest): boolean {
  return state.startIndex >= 0 && state.endIndex < catalog.meta.n - 1 &&
    catalog.t0ms + state.startIndex * catalog.meta.stepHours * 3600000 >= Date.parse(manifest.validFromUtc) &&
    catalog.t0ms + (state.endIndex + 1) * catalog.meta.stepHours * 3600000 <= Date.parse(manifest.validUntilUtcExclusive);
}
function metricsFor(catalog: Catalog, state: ScenarioState, assessment: AssessmentResult): AlternativeMetrics {
  const mission = assessment.mission, timeline = mission.timeline, n = timeline.length;
  const allSolar = timeline.every(t => t.sun !== null);
  const allContact = timeline.every(t => t.contact !== null);
  let dark = 0, longestDark = 0;
  for (const t of timeline) { dark = t.sun === false ? dark + catalog.meta.stepHours : 0; longestDark = Math.max(longestDark,dark); }
  const slope = state.custom ? null : catalog.sites.find(s => s.id === state.siteId)?.slopeDeg;
  return {
    sunFraction:allSolar ? timeline.filter(t => t.sun === true).length / n : null,
    contactFraction:allContact ? mission.contactFraction : null,
    longestDarkHours:allSolar ? longestDark : null,
    longestBlackoutHours:allContact ? mission.longestBlackoutHours : null,
    generatedWh:mission.generatedWh,minBatteryWh:mission.minBatteryWh,unmetWh:mission.unmetWh,
    slopeDeg:typeof slope === 'number' && Number.isFinite(slope) && slope >= 0 && slope <= 90 ? slope : null,
    knownFraction:timeline.filter(t => t.sun !== null && t.contact !== null).length / n,
  };
}

/** One synchronous cell. Callers can chunk/cancel a matrix without hidden async work. */
export function evaluateAlternative(
  catalog: Catalog,
  baseline: ScenarioState,
  candidate: AlternativeCandidate,
  offsetDays: number,
  criteria: AlternativeCriteria,
  baselineMetrics?: AlternativeMetrics,
  manifest: EvidenceManifest = defaultManifest,
): AlternativeResult {
  validateCriteria(criteria);
  validateMission(baseline.mission);
  validateLocation(candidate.lat, candidate.lon);
  if (!Number.isSafeInteger(offsetDays)) throw new RangeError("offsetDays must be an integer day count");
  if (!Number.isFinite(catalog.meta.stepHours) || catalog.meta.stepHours <= 0)
    throw new RangeError("Catalog stepHours must be positive and finite");
  if (!Number.isSafeInteger(baseline.startIndex) || !Number.isSafeInteger(baseline.endIndex) || baseline.endIndex < baseline.startIndex)
    throw new RangeError("Baseline sample indices must be ordered integers");
  const shift = offsetDays * 24 / catalog.meta.stepHours;
  if (!Number.isSafeInteger(Math.round(shift)) || Math.abs(shift - Math.round(shift)) > 1e-9)
    throw new RangeError("Date slip does not align with the catalog sample interval");
  const point = candidate.custom ?? catalog.sites.find((s) => s.id === candidate.siteId);
  if (!point) throw new Error(`Unknown candidate site: ${candidate.siteId}`);
  validateLocation(point.lat, point.lon);
  if (point.lat !== candidate.lat || distanceKm(point, candidate) > 1e-9)
    throw new Error("Candidate coordinates do not match its reproducible scenario location");
  const state = structuredClone(baseline);
  state.siteId = candidate.siteId;
  state.custom = candidate.custom ? {...candidate.custom} : null;
  state.startIndex += Math.round(shift); state.endIndex += Math.round(shift);
  // Legacy matrix screens become additional requirements. A permitted unmet-energy
  // allowance explicitly disables the zero-unmet rule; reserve remains independent.
  state.requirements.extraScreens = {...state.requirements.extraScreens,...criteria};
  if (criteria.maxUnmetWh > 0) state.requirements.requireZeroUnmetWh = false;
  const result: AlternativeResult = {
    key: planningKey({state,candidateId:candidate.id,offsetDays,manifest}),
    candidate: { ...candidate, custom: candidate.custom ? { ...candidate.custom } : null },
    offsetDays, state, status: "unknown", violations: [], unknowns: [],
    metrics: unavailableMetrics(), deltas: {},
  };
  // Never clamp or shorten a slipped stay, or evaluate the baseline for an outside cell.
  if (!inCatalog(catalog, state, manifest)) {
    result.status = "outside";
    result.unknowns.push("The full shifted stay is outside the catalog date range.");
    for (const key of Object.keys(result.metrics) as (keyof AlternativeMetrics)[]) result.deltas[key] = null;
    return result;
  }
  const assessment = evaluateScenario(catalog,state,manifest);
  result.assessment = assessment;
  result.metrics = metricsFor(catalog,state,assessment);
  const reference = baselineMetrics ?? (inCatalog(catalog,baseline,manifest)
    ? metricsFor(catalog,baseline,evaluateScenario(catalog,baseline,manifest)) : unavailableMetrics());
  for (const key of Object.keys(result.metrics) as (keyof AlternativeMetrics)[]) {
    const value=result.metrics[key], base=reference[key];
    result.deltas[key]=value !== null && base !== null && Number.isFinite(value) && Number.isFinite(base) ? value-base : null;
  }
  for (const constraint of assessment.constraints.filter(c => c.required)) {
    const message = `${constraint.label}: ${constraint.actual ?? 'unavailable'} ${constraint.unit ?? ''}; limit ${constraint.limit ?? 'unconfigured'}. ${constraint.explanation}`;
    if (constraint.state === 'fail') result.violations.push(message);
    if (constraint.state === 'not-assessed') result.unknowns.push(message);
  }
  result.status = ({'passes-assessed':'meets','fails-assessed':'fails',incomplete:'unknown',conditional:'conditional','not-configured':'unknown'} as const)[assessment.outcome];
  return result;
}
