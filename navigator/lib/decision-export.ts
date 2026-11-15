import { evaluateScenario, planningKey } from "./assessment";
import { resolveAnalysisContext } from "./analysis-context";
import type { Catalog } from "./catalog";
import { csvCell } from "./export";
import type { AssessmentResult, EvidenceManifest } from "./planning-types";
import { parseEvidenceManifest } from "./provenance";
import { migrateScenario, type ScenarioState } from "./scenario";
import { diffScenarios, type ScenarioDifference } from "./scenario-diff";

export const MAX_DECISION_PACKAGE_BYTES = 1_000_000;
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type DecisionPackage = {
  packageVersion: 1; exportedUtc: string; scenario: ScenarioState;
  datasetId: string; modelVersion: string; assessment: AssessmentResult;
  manifest: EvidenceManifest;
  sources: Array<{ id: string; productId: string | null; version: string | null; sha256: string | null }>;
  interval: { startUtc: string; endUtcExclusive: string; stepHours: number; semantics: string };
  frame: string; units: Record<string, string>; resolved: Json; rawTimeSeries: Json;
  events: Json[]; missingAssessments: string[]; differences?: ScenarioDifference[];
};
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
/** JSON has no NaN/Infinity and typed arrays must be portable arrays. */
export function stringifyDecisionPackage(value: unknown): string {
  const text = JSON.stringify(value, (_key, item) => typeof item === "number" && !Number.isFinite(item) ? null : ArrayBuffer.isView(item) && !(item instanceof DataView) ? Array.from(item as unknown as ArrayLike<number>) : item, 2);
  if (typeof text !== "string") throw new Error("Decision package must be a JSON object");
  if (new TextEncoder().encode(text).length > MAX_DECISION_PACKAGE_BYTES) throw new Error("Decision package exceeds the 1 MB UTF-8 limit");
  return text;
}
const portable = <T>(value: T): T => JSON.parse(stringifyDecisionPackage(value)) as T;
function canonicalScenario(value: unknown, catalog: Catalog): ScenarioState {
  const state = migrateScenario(value, { siteIds: catalog.sites.map((site) => site.id), samples: catalog.meta.n, stepHours: catalog.meta.stepHours });
  if (!state) throw new Error("Decision package contains an invalid scenario or unsupported dates");
  return state;
}
export function createDecisionPackage(catalog: Catalog, input: ScenarioState, manifest: EvidenceManifest, baseline?: ScenarioState): DecisionPackage {
  const scenario = canonicalScenario(input, catalog);
  const context = resolveAnalysisContext(catalog, { terrainMode:scenario.terrainMode,siteId: scenario.siteId, custom: scenario.custom, startIndex: scenario.startIndex, endIndex: scenario.endIndex, arrayHeightM: scenario.arrayHeightM, antennaHeightM: scenario.antennaHeightM, displayHeightM: scenario.heightM }, manifest);
  const assessment = evaluateScenario(catalog, scenario, manifest);
  const events = assessment.constraints.flatMap((row) => row.firstViolation ? [row.firstViolation] : []);
  const missionEvents = (assessment.mission as unknown as Record<string, unknown>).events;
  const allEvents = [...events, ...(Array.isArray(missionEvents) ? missionEvents : [])];
  return portable({ packageVersion: 1, exportedUtc: new Date().toISOString(), scenario,
    datasetId: assessment.datasetId, modelVersion: assessment.modelVersion, assessment, manifest,
    sources: manifest.entries.map(({ id, productId, version, sha256 }) => ({ id, productId, version, sha256 })),
    interval: { startUtc: context.startUtc, endUtcExclusive: context.endUtcExclusive, stepHours: catalog.meta.stepHours, semantics: "Forcing indices inclusive; stay [startUtc,endUtcExclusive). Each record represents one stepHours interval. Event bounds are sampling bounds, not exact physical crossing times." },
    frame: catalog.meta.frame,
    units: { time: "UTC ISO 8601", duration: "h", angles: "deg", horizon: "deg elevation above local horizontal", heights: "m", cellDistance: "km", power: "W", energy: "Wh", stateOfCharge: "fraction", radioMargin: "dB", rawTimeSeries: "angles in deg; index0 is the first catalog forcing index" },
    resolved: { location: context.location, siteId: context.site.id, array: context.arrayTerrain, antenna: context.antennaTerrain },
    rawTimeSeries: { array: context.arraySeries, antenna: context.antennaSeries },
    events: allEvents,
    missingAssessments: assessment.constraints.filter((constraint) => constraint.state === "not-assessed").map((constraint) => constraint.id),
    ...(baseline ? { differences: diffScenarios(canonicalScenario(baseline, catalog), scenario) } : {}),
  } as unknown as DecisionPackage);
}
function validateHistorical(value: Record<string, unknown>): void {
  const assessment = value.assessment;
  if (!record(assessment) || !["resource-screening", "landing-readiness"].includes(String(assessment.scope)) || !["fails-assessed", "incomplete", "conditional", "passes-assessed", "not-configured"].includes(String(assessment.outcome)) ||
    typeof assessment.modelVersion !== "string" || typeof assessment.datasetId !== "string" || !Array.isArray(assessment.constraints) || assessment.constraints.length > 2000 || !Array.isArray(assessment.evidence) || !Array.isArray(assessment.warnings) || !assessment.warnings.every((warning) => typeof warning === "string")) throw new Error("Malformed historical assessment");
  for (const constraint of assessment.constraints) if (!record(constraint) || typeof constraint.id !== "string" || typeof constraint.label !== "string" || !["pass", "fail", "conditional", "not-assessed"].includes(String(constraint.state))) throw new Error("Malformed historical constraint");
  for (const key of ["mission", "sphereMission"]) {
    const mission = assessment[key];
    if (!record(mission) || !Array.isArray(mission.timeline) || mission.timeline.length > 100000 || !mission.timeline.every(record)) throw new Error("Malformed historical time series");
  }
  if (!record(value.rawTimeSeries) || !record(value.resolved) || !record(value.units) || !Array.isArray(value.sources) || !Array.isArray(value.events) || !value.events.every(record) || !Array.isArray(value.missingAssessments) || !value.missingAssessments.every((id) => typeof id === "string") || (value.differences !== undefined && (!Array.isArray(value.differences) || !value.differences.every((diff) => record(diff) && typeof diff.path === "string")))) throw new Error("Malformed decision package records");
  const sourceIds = new Set<string>();
  for (const source of value.sources) {
    if (!record(source) || typeof source.id !== "string" || !source.id || sourceIds.has(source.id) || !["productId", "version", "sha256"].every((key) => source[key] === null || typeof source[key] === "string")) throw new Error("Malformed or duplicate source record");
    sourceIds.add(source.id);
  }
  parseEvidenceManifest({ ...(value.manifest as Record<string, unknown>), entries: assessment.evidence });
  for (const channel of ["array", "antenna"]) {
    const series = value.rawTimeSeries[channel];
    if (!record(series) || !Number.isInteger(series.index0)) throw new Error("Malformed raw forcing series");
    let length: number | undefined;
    for (const key of ["sunAz", "sunEl", "earthAz", "earthEl", "sunHorizon", "earthHorizon", "sunRadius", "earthRadius"]) {
      const samples = series[key];
      if (!Array.isArray(samples) || samples.length === 0 || samples.length > 100000 || !samples.every((sample) => sample === null || typeof sample === "number" && Number.isFinite(sample)) || length !== undefined && samples.length !== length) throw new Error("Malformed raw forcing samples");
      length = samples.length;
    }
  }
}
export function importDecisionPackage(input: unknown, catalog: Catalog, manifest: EvidenceManifest) {
  // Clone and enforce byte bounds before reading fields, including for object callers.
  const json = typeof input === "string" ? input : stringifyDecisionPackage(input);
  if (new TextEncoder().encode(json).length > MAX_DECISION_PACKAGE_BYTES) throw new Error("Decision package exceeds the 1 MB UTF-8 limit");
  const value: unknown = JSON.parse(json);
  const keys = ["packageVersion", "exportedUtc", "scenario", "datasetId", "modelVersion", "assessment", "manifest", "sources", "interval", "frame", "units", "resolved", "rawTimeSeries", "events", "missingAssessments", "differences"];
  if (!record(value) || Object.keys(value).some((key) => !keys.includes(key)) || value.packageVersion !== 1 || typeof value.exportedUtc !== "string" || !value.exportedUtc.endsWith("Z") || !Number.isFinite(Date.parse(value.exportedUtc)) || typeof value.datasetId !== "string" || typeof value.modelVersion !== "string" || typeof value.frame !== "string" || !record(value.interval) || typeof value.interval.startUtc !== "string" || typeof value.interval.endUtcExclusive !== "string" || !value.interval.startUtc.endsWith("Z") || !value.interval.endUtcExclusive.endsWith("Z") || !(Date.parse(value.interval.endUtcExclusive) > Date.parse(value.interval.startUtc)) || typeof value.interval.stepHours !== "number" || !Number.isFinite(value.interval.stepHours) || value.interval.stepHours <= 0) throw new Error("Unsupported or malformed decision package");
  const historicalManifest = parseEvidenceManifest(value.manifest);
  validateHistorical(value);
  const state = canonicalScenario(value.scenario, catalog);
  const currentPackage = createDecisionPackage(catalog, state, manifest);
  const changes: ScenarioDifference[] = [];
  for (const [path, before, after] of [["datasetId", value.datasetId, currentPackage.datasetId], ["modelVersion", value.modelVersion, currentPackage.modelVersion], ["frame", value.frame, currentPackage.frame]] as const) if (before !== after) changes.push({ path, before, after });
  for (const key of ["startUtc", "endUtcExclusive", "stepHours"] as const) if (value.interval[key] !== currentPackage.interval[key]) changes.push({ path: `interval.${key}`, before: value.interval[key], after: currentPackage.interval[key] });
  const oldSources = new Map(historicalManifest.entries.map((entry) => [entry.id, entry]));
  const newSources = new Map(manifest.entries.map((entry) => [entry.id, entry]));
  for (const id of [...new Set([...oldSources.keys(), ...newSources.keys()])].sort()) for (const key of ["productId", "version", "sha256", "coverage"] as const) {
    const before = oldSources.get(id)?.[key], after = newSources.get(id)?.[key];
    if (before !== after) changes.push({ path: `sources[${encodeURIComponent(id)}].${key}`, before, after });
  }
  if (planningKey(historicalManifest) !== planningKey(manifest) && !changes.some((change) => change.path.startsWith("sources["))) changes.push({ path: "manifest", before: historicalManifest, after: portable(manifest) });
  return { state, assessment: currentPackage.assessment, currentPackage, historicalAssessment: value.assessment as AssessmentResult, historicalManifest, historicalTrusted: false as const, changes,
    message: changes.length ? "Recomputed using different evidence/model" : "Recomputed using current evidence/model; historical results are not trusted" };
}
function cell(value: unknown): string {
  // Existing csvCell handles formula sigils; also guard leading tab/CR explicitly.
  return csvCell(value == null ? "" : typeof value === "string" && /^[\t\r]/.test(value) ? `'${value}` : value);
}
export function decisionPackageCsv(pkg: DecisionPackage): string {
  const rows: unknown[][] = [["record", "id", "status", "actual", "limit", "margin", "unit", "reason", "startUtc", "endUtcExclusive"],
    ["provenance", pkg.datasetId, pkg.modelVersion, null, null, null, null, pkg.frame, pkg.interval.startUtc, pkg.interval.endUtcExclusive],
    ...pkg.assessment.constraints.map((row) => ["constraint", row.id, row.state, row.actual, row.limit, row.margin, row.unit, row.reasonCode, row.firstViolation?.earliestUtc, row.firstViolation?.latestUtc]),
    ...pkg.assessment.mission.timeline.map((row, index) => ["time-series", index, row.contact === null ? "unknown" : row.contact ? "contact" : "outage", row.powerW, null, row.batteryWh, "power W; stored Wh", "", new Date(Date.parse(pkg.interval.startUtc) + index * pkg.interval.stepHours * 3600000).toISOString(), new Date(Date.parse(pkg.interval.startUtc) + (index + 1) * pkg.interval.stepHours * 3600000).toISOString()])];
  return rows.map((row) => row.map(cell).join(",")).join("\r\n");
}
const escapeHtml = (value: unknown) => String(value ?? "Unknown").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
export function printableDecisionHtml(pkg: DecisionPackage): string {
  const e = escapeHtml;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Lunario decision record</title><style>body{font:16px/1.5 system-ui;max-width:72rem;margin:2rem auto;padding:1rem;color:#171717;background:white}table{border-collapse:collapse;width:100%}th,td{padding:.5rem;border:1px solid #777;text-align:left;vertical-align:top}pre{white-space:pre-wrap;overflow-wrap:anywhere}@media print{body{margin:0}tr{break-inside:avoid}}</style><body><h1>Lunario decision record</h1><h2>Provenance and assumptions</h2><p>Dataset ${e(pkg.datasetId)}; model ${e(pkg.modelVersion)}; frame ${e(pkg.frame)}. Exported ${e(pkg.exportedUtc)}.</p><p>Stay ${e(pkg.interval.startUtc)} to ${e(pkg.interval.endUtcExclusive)} (exclusive end). ${e(pkg.interval.semantics)}</p><pre>${e(stringifyDecisionPackage(pkg.scenario))}</pre><h2>Assessed result</h2><p>${e(pkg.assessment.outcome)}; scope ${e(pkg.assessment.scope)}. Results apply only to these assumptions and evidence. External reports remain externally reported.</p><table><caption>Requirements, margins and evidence states</caption><thead><tr><th scope="col">Requirement</th><th scope="col">State</th><th scope="col">Actual / limit / margin</th><th scope="col">Reason</th></tr></thead><tbody>${pkg.assessment.constraints.map((row) => `<tr><th scope="row">${e(row.label)}</th><td>${e(row.state)}</td><td>${e(row.actual)} / ${e(row.limit)} / ${e(row.margin)} ${e(row.unit)}</td><td>${e(row.explanation)}</td></tr>`).join("")}</tbody></table><h2>Event bounds</h2><pre>${e(stringifyDecisionPackage(pkg.events))}</pre><h2>Warnings and missing assessments</h2><ul>${[...pkg.assessment.warnings, ...pkg.missingAssessments].map((warning) => `<li>${e(warning)}</li>`).join("")}</ul><h2>Sources</h2><ul>${pkg.assessment.evidence.map((source) => `<li>${e(source.id)}: ${e(source.label)}; ${e(source.sourceUrl)}; product ${e(source.productId)}; version ${e(source.version)}; SHA-256 ${e(source.sha256)}; coverage ${e(source.coverage)}. ${e(source.notes.join(" "))}</li>`).join("")}</ul></body></html>`;
}
