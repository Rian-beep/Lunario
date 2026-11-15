import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { sunAzEl, earthAzEl, diskFraction, horizonAt, poseAt, type SampleSeries } from "../lib/astro.js";
import { decodeCatalog, type Catalog } from "../lib/catalog.js";
import { DEFAULT_MISSION, evaluateMission, linkBudget, type MissionResult } from "../lib/mission.js";
import { DEFAULT_FLIGHT } from "../lib/flight.js";
import { DEFAULT_OPERATIONS, DEFAULT_REQUIREMENTS, EXTERNAL_IDS, type EvidenceManifest } from "../lib/planning-types.js";
import { parseScenario, type ScenarioState } from "../lib/scenario.js";
import { resolveAnalysisContext } from "../lib/analysis-context.js";
import { assessConstraints, evaluateScenario, evidenceScopeKey, PLANNING_MODEL_VERSION } from "../lib/assessment.js";
import { parseEvidenceManifest } from "../lib/provenance.js";
import { searchMissionWindows } from "../lib/planning-search.js";
import { runSensitivity } from "../lib/sensitivity.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const close = (actual: number | null | undefined, expected: number, tolerance = 1e-9) => assert.ok(typeof actual === "number" && Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${actual} != reference ${expected} ± ${tolerance}`);
export function syntheticSeries(n = 4, sun = -30): SampleSeries {
  const values = (v: number) => new Float64Array(n).fill(v);
  return { index0: 0, sunAz: values(0), sunEl: values(sun), earthAz: values(0), earthEl: values(30), sunHorizon: values(0), earthHorizon: values(0), sunRadius: values(0.25), earthRadius: values(1) };
}
export function analyticMission() {
  return { ...DEFAULT_MISSION, areaM2: 1, solarFlux: 1000, efficiency: 1, lossFraction: 0, loadW: 100, batteryWh: 300, initialSoc: 1, reserveSoc: 0.2, chargeEfficiency: 1, dischargeEfficiency: 1 };
}
function syntheticInputs(catalog: Catalog, manifest: EvidenceManifest) {
  const n = 6, fill = (value: number) => new Float64Array(n).fill(value);
  const site = { ...catalog.sites[0], id: "analytic-equator", name: "Synthetic equator fixture (not a lunar site)", lat: 0, lon: 0, slopeDeg: 0, horizons: [0, 2, 10].map((heightM) => ({ heightM, stepDeg: 1, mask: new Float64Array(360).fill(heightM === 10 ? 90 : 0) })) };
  const c: Catalog = { ...catalog, meta: { ...catalog.meta, n, stepHours: 1 }, sites: [site], subsolarLat: fill(0), subsolarLon: fill(180), subearthLat: fill(0), subearthLon: fill(0), earthRangeKm: fill(384400), sunRadiusDeg: fill(0.25) };
  const m: EvidenceManifest = { ...manifest, datasetId: "synthetic-analytic-only", validFromUtc: new Date(c.t0ms).toISOString(), validUntilUtcExclusive: new Date(c.t0ms + (n - 1) * 3600000).toISOString(), entries: manifest.entries.map((entry) => ({ ...entry, coverage: ["ephemeris", "horizon-catalog", "horizon-custom"].includes(entry.id) ? "complete" : entry.coverage })) };
  const state: ScenarioState = { schemaVersion: 2, siteId: site.id, custom: null, startIndex: 0, endIndex: 3, heightM: 2, arrayHeightM: 2, antennaHeightM: 2, mission: analyticMission(), flight: { ...DEFAULT_FLIGHT }, operations: structuredClone(DEFAULT_OPERATIONS), requirements: structuredClone(DEFAULT_REQUIREMENTS) };
  return { catalog: c, manifest: m, state };
}
type Check = { id: string; status: "pass" | "fail"; reference: string; actual: unknown; error: string | null; durationMs: number };
export async function runPlanningVerification() {
  const catalogBytes = await readFile(path.join(root, "public/data/catalog.json"));
  const manifestBytes = await readFile(path.join(root, "public/data/evidence-manifest.json"));
  const catalog = decodeCatalog(JSON.parse(catalogBytes.toString()));
  const manifest = parseEvidenceManifest(JSON.parse(manifestBytes.toString()));
  const fixture = syntheticInputs(catalog, manifest), c = fixture.catalog, m = fixture.manifest, state = fixture.state;
  const checks: Check[] = [];
  async function check(id: string, reference: string, run: (capture: (actual: unknown) => void) => unknown | Promise<unknown>) {
    const started = performance.now(); let actual: unknown = null;
    try { const returned = await run((value) => { actual = value; }); if (returned !== undefined) actual = returned; checks.push({ id, reference, status: "pass", actual, error: null, durationMs: performance.now() - started }); }
    catch (error) { checks.push({ id, reference, status: "fail", actual, error: error instanceof Error ? error.message : String(error), durationMs: performance.now() - started }); }
  }
  await check("celestial-analytic", "Equator: subsolar point zenith; ±90° longitude horizon east/west. Exact pole finite; Earth subpoint overhead.", (capture) => {
    const actual = { zenith: sunAzEl(0, 0, 0, 0), east: sunAzEl(0, 0, 0, 90), west: sunAzEl(0, 0, 0, 270), pole: sunAzEl(90, 0, 0, 0), earth: earthAzEl(0, 0, 0, 0, 384400) }; capture(actual);
    close(actual.zenith[1], 90); close(actual.east[0], 90); close(actual.east[1], 0); close(actual.west[0], 270); close(actual.pole[1], 0); assert.ok(actual.pole.every(Number.isFinite)); close(actual.earth[1], 90);
  });
  await check("disk-and-ray-edges", "Uniform disk at equality is half-visible, ±radius gives 0/1. Cyclic sampled horizon interpolation; missing ray stays unknown.", (capture) => {
    const mask = new Float64Array([0, 10, Number.NaN, 20]);
    const actual = { fractions: [-0.25, 0, 0.25].map((e) => diskFraction(e, 0, 0.25)), wrap: horizonAt(mask, 90, 315), missing: horizonAt(mask, 90, 135), high: diskFraction(2, 80, 0.25), low: diskFraction(2, -80, 0.25) }; capture(actual);
    assert.deepEqual(actual.fractions, [0, 0.5, 1]); close(actual.wrap, 10); assert.ok(Number.isNaN(actual.missing)); close(actual.high, 0); close(actual.low, 1);
  });
  await check("interpolation-is-not-evidence", "359°→1° crosses 0°; interpolated display samples are not independent measurements.", () => {
    const series = syntheticSeries(2); series.sunAz.set([359, 1]); const pose = poseAt(series, 0.5); close(((pose.sunAz % 360) + 360) % 360, 0); return { sourceSamples: 2, displayPosition: 0.5, pose, evidenceTemporalStepHours: 1, physicalResolutionImproved: false };
  });
  await check("darkness-energy", "4×1h dark; 100W; 300Wh; η=1: boundaries [300,200,100,0,0], unmet100Wh, reserve threshold60Wh crossed2.4h, duration1.6h.", (capture) => {
    const result = evaluateMission(syntheticSeries(), 1, analyticMission()); capture(result);
    assert.deepEqual([300, ...result.timeline.map((point) => point.batteryWh)], [300, 200, 100, 0, 0]); close(result.unmetWh, 100); close(result.reserveHours, 1.6); close(result.generatedWh, 0);
  });
  await check("charge-rate-limit", "2h×200W source, initial0/cap100Wh/charge cap50W/η1: stored100Wh, curtailed300Wh.", (capture) => {
    const evaluate = evaluateMission as typeof evaluateMission & ((...args: unknown[]) => MissionResult);
    const result = evaluate(syntheticSeries(2, 30), 1, { ...analyticMission(), solarFlux: 200, loadW: 0, initialSoc: 0, batteryWh: 100 }, false, { operations: { ...DEFAULT_OPERATIONS, maxChargeW: 50 } }); capture(result);
    close(result.finalBatteryWh, 100); close(result.curtailedWh, 300); assert.deepEqual(result.timeline.map((point) => point.batteryWh), [50, 100]);
  });
  await check("operations-energy-conservation", "2h source200W, deployment0.5h→300Wh generation. Baseline20W +10W over[0.5,1.5)+30W over[1,2)→80Wh load. Initial100Wh,η1→final320Wh.", (capture) => {
    const evaluate = evaluateMission as typeof evaluateMission & ((...args: unknown[]) => MissionResult);
    const operations = { ...DEFAULT_OPERATIONS, deploymentDelayHours: 0.5, loadSegments: [{ id: "a", startOffsetHours: 0.5, endOffsetHours: 1.5, additionalW: 10 }, { id: "b", startOffsetHours: 1, endOffsetHours: 2, additionalW: 30 }] };
    const result = evaluate(syntheticSeries(2, 30), 1, { ...analyticMission(), solarFlux: 200, loadW: 20, batteryWh: 1000, initialSoc: 0.1 }, false, { operations }); capture(result);
    close(result.generatedWh, 300); close(result.finalBatteryWh, 320); close(result.unmetWh, 0); close(result.curtailedWh, 0);
  });
  await check("initial-reserve-and-zero-capacity", "Initial30Wh below60Wh reserve: model violation at0h and all4h below reserve. Zero capacity/load in darkness has finite zero unmet/storage.", (capture) => {
    const low = evaluateMission(syntheticSeries(), 1, { ...analyticMission(), initialSoc: 0.1 });
    const zero = evaluateMission(syntheticSeries(), 1, { ...analyticMission(), loadW: 0, batteryWh: 0 }); capture({ low, zero });
    close(low.reserveHours, 4); close(low.unmetWh, 370); const events = (low as unknown as { events?: Array<{ kind: string; modelOffsetHours: number | null }> }).events; assert.ok(events); close(events.find((event) => event.kind === "reserve-crossing")?.modelOffsetHours, 0); close(zero.unmetWh, 0); close(zero.finalBatteryWh, 0); close(zero.reserveHours, 0);
  });
  await check("event-model-version", "Interval/event accounting changes the pre-T05 planning-1 model contract; old exported results must be distinguishable by version.", () => {
    assert.notEqual(PLANNING_MODEL_VERSION, "planning-1", "Bump modelVersion after changing interval/event physics"); return { historicalModelVersion: "planning-1", currentModelVersion: PLANNING_MODEL_VERSION };
  });
  await check("radio-friis", "1GHz;1km;1W;0dBi gains/loss;290K;1000bit/s;required0dB. λ=0.299792458m; FSPL92.44778322188337dB; N0−203.97518719422808dBW/Hz.", (capture) => {
    const result = linkBudget({ frequencyGHz: 1, rangeKm: 1, txPowerW: 1, txGainDbi: 0, rxGainDbi: 0, lossDb: 0, noiseTempK: 290, dataRateBps: 1000, requiredEbN0Db: 0 }); capture(result);
    assert.ok(result); close(result.pathLossDb, 92.44778322188337); close(result.receivedDbw, -92.44778322188337); close(result.ebN0Db, 81.52740397234471); assert.equal(linkBudget({ frequencyGHz: 1 }), null);
  });
  const request = (s: ScenarioState) => ({ siteId: s.siteId, custom: s.custom, startIndex: s.startIndex, endIndex: s.endIndex, arrayHeightM: s.arrayHeightM, antennaHeightM: s.antennaHeightM, displayHeightM: s.heightM });
  await check("utc-endpoint", "n epochs support n−1 intervals even if a manifest incorrectly allows later coverage. Inclusive forcing indices; exclusive next epoch endpoint.", (capture) => {
    const last = { ...state, startIndex: c.meta.n - 2, endIndex: c.meta.n - 2 };
    const context = resolveAnalysisContext(c, request(last), m); capture({ startUtc: context.startUtc, endUtcExclusive: context.endUtcExclusive });
    assert.equal(Date.parse(context.endUtcExclusive), c.t0ms + (c.meta.n - 1) * 3600000);
    assert.equal(parseScenario({ ...state, startIndex: c.meta.n - 1, endIndex: c.meta.n - 1 }, { siteIds: [state.siteId], samples: c.meta.n, stepHours: 1 }), null);
    const tooBroad = { ...m, validUntilUtcExclusive: new Date(c.t0ms + 100 * 3600000).toISOString() };
    assert.throws(() => resolveAnalysisContext(c, request({ ...state, startIndex: c.meta.n - 1, endIndex: c.meta.n - 1 }), tooBroad), /outside|endpoint|coverage/i);
  });
  await check("independent-instrument-heights", "Synthetic 10m horizon90° masks an overhead Earth at equality; 2m horizon0° sees it. Array forcing must not change with antenna height.", (capture) => {
    const low = resolveAnalysisContext(c, request(state), m), high = resolveAnalysisContext(c, request({ ...state, antennaHeightM: 10 }), m);
    assert.deepEqual(low.arraySeries, high.arraySeries);
    const a = evaluateScenario(c, state, m), b = evaluateScenario(c, { ...state, antennaHeightM: 10 }, m); capture({ low: a.mission.contactFraction, high: b.mission.contactFraction, arrayHeightM: high.arrayTerrain.heightM, antennaHeightM: high.antennaTerrain.heightM });
    close(a.mission.contactFraction, 1); close(b.mission.contactFraction, 0);
  });
  await check("missing-horizon-no-pass", "Missing solar masks cannot yield known generation/storage or a required resource pass.", (capture) => {
    const s = { ...state, custom: { lat: -85, lon: 20 }, arrayHeightM: 10 };
    const result = evaluateScenario(c, s, m); capture(result);
    assert.equal(result.mission.generatedWh, null); assert.equal(result.mission.finalBatteryWh, null); assert.notEqual(result.outcome, "passes-assessed");
  });
  await check("missing-ephemeris-no-pass", "Removing celestial provenance makes celestial-driven resource assessment unavailable, even if residual catalog bytes are finite.", (capture) => {
    const empty = { ...m, entries: m.entries.filter((entry) => entry.id !== "ephemeris") };
    const result = evaluateScenario(c, { ...state, mission: { ...state.mission, loadW: 0 } }, empty); capture(result);
    assert.equal(result.mission.generatedWh, null); assert.notEqual(result.outcome, "passes-assessed");
  });
  await check("invalid-ephemeris-no-pass", "Invalid solar angular radius or Earth range cannot become a finite valid disk/contact result.", (capture) => {
    const bad = { ...c, sunRadiusDeg: new Float64Array(c.meta.n), earthRangeKm: new Float64Array(c.meta.n).fill(1) };
    const result = evaluateScenario(bad, { ...state, mission: { ...state.mission, loadW: 0 } }, m); capture(result);
    assert.equal(result.mission.generatedWh, null); assert.equal(result.mission.contactFraction, null); assert.notEqual(result.outcome, "passes-assessed");
  });
  await check("nan-no-pass", "Unknown metrics are not zero or a passing numeric requirement.", (capture) => {
    const context = resolveAnalysisContext(c, request(state), m), mission = evaluateMission(syntheticSeries(), 1, analyticMission());
    const poisoned = { ...mission, minBatteryWh: Number.NaN, unmetWh: Number.NaN };
    const rows = assessConstraints(state, context, poisoned, poisoned); capture(rows);
    for (const id of ["reserve", "unmet-demand"]) { const row = rows.find((entry) => entry.id === id)!; assert.equal(row.state, "not-assessed"); assert.equal(row.actual, null); }
  });
  await check("unknown-gap-preserves-known-failure", "A gap poisons later storage; an analytic reserve crossing0.3h before the gap remains a first known violation, not a claim of complete evidence.", (capture) => {
    const longitudes = c.subsolarLon.slice(); longitudes[1] = Number.NaN;
    const result = evaluateScenario({ ...c, subsolarLon: longitudes }, { ...state, mission: { ...state.mission, reserveSoc: 0.9 } }, m); capture(result);
    assert.deepEqual(result.mission.timeline.map((point) => point.batteryWh), [200, null, null, null]); assert.equal(result.mission.finalBatteryWh, null); assert.equal(result.mission.unmetWh, null);
    const reserve = result.constraints.find((row) => row.id === "reserve"); assert.equal(reserve?.state, "fail"); close(reserve?.firstViolation?.modelOffsetHours, 0.3); assert.ok(result.warnings.some((warning) => /unknown/i.test(warning))); close(result.firstFailure?.modelOffsetHours, 0.3);
  });
  await check("custom-slope-not-inherited", "A custom point cannot inherit the selected catalog site's coarse slope as a measured slope at its own coordinates.", (capture) => {
    const s = structuredClone(state); s.custom = { lat: -85, lon: 20 }; s.requirements.extraScreens.maxSlopeDeg = 10;
    const row = evaluateScenario(c, s, m).constraints.find((entry) => entry.id === "screen:maxSlopeDeg"); capture(row); assert.equal(row?.state, "not-assessed"); assert.equal(row.actual, null);
  });
  await check("no-default-external-certification", "All external engineering assessments absent by default; landing readiness cannot be certified by resource model.", (capture) => {
    const s = structuredClone(state); s.requirements.scope = "landing-readiness";
    const result = evaluateScenario(c, s, m); capture(result.constraints.filter((row) => EXTERNAL_IDS.includes(row.id as typeof EXTERNAL_IDS[number])));
    for (const id of EXTERNAL_IDS) assert.equal(result.constraints.find((row) => row.id === id)?.state, "not-assessed"); assert.notEqual(result.outcome, "passes-assessed");
  });
  await check("report-identity-and-staleness", "Reports bind to physical input identity excluding report text, and any relevant scenario edit makes them stale; reported pass remains conditional.", (capture) => {
    const s = structuredClone(state); s.requirements.requiredExternal = ["thermal-survival"];
    const key = evidenceScopeKey(s, m.datasetId); s.externalAssessments = [{ id: "thermal-survival", status: "reported-pass", source: "Synthetic report", author: "Verifier", notes: "Not real evidence", scenarioKey: key }];
    assert.equal(evidenceScopeKey(s, m.datasetId), key);
    const current = evaluateScenario(c, s, m), changed = evaluateScenario(c, { ...s, antennaHeightM: 10 }, m); capture({ current: current.constraints.find((row) => row.id === "thermal-survival"), changed: changed.constraints.find((row) => row.id === "thermal-survival") });
    assert.equal(current.constraints.find((row) => row.id === "thermal-survival")?.state, "conditional"); assert.equal(changed.constraints.find((row) => row.id === "thermal-survival")?.reasonCode, "external-report-stale"); assert.notEqual(current.scenarioKey, changed.scenarioKey);
  });
  await check("bounded-first-failure", "Analytic reserve crossing2.4h belongs to [2h,3h] sampling bracket; unserved demand starts3h. Offset is model-estimated, never finer physical evidence.", (capture) => {
    const result = evaluateScenario(c, state, m), event = result.constraints.find((row) => row.id === "reserve")?.firstViolation; capture({ firstFailure: result.firstFailure, event, mission: result.mission });
    assert.ok(event); close(event.modelOffsetHours, 2.4); assert.equal(Date.parse(event.earliestUtc), c.t0ms + 2 * 3600000); assert.equal(Date.parse(event.latestUtc), c.t0ms + 3 * 3600000);
    const unmet = result.constraints.find((row) => row.id === "unmet-demand")?.firstViolation; assert.ok(unmet); close(unmet.modelOffsetHours, 3);
  });
  await check("search-open-reproduction", "Every retained whole-mission search row reopens to exactly the same authority result; endpoint starts are outside, never shortened.", async (capture) => {
    const result = await searchMissionWindows(c, m, { base: state, siteIds: [state.siteId], firstStartIndex: 0, lastStartIndex: 5, durationSamples: 2, startStepSamples: 1, maxResults: 6 }); capture(result);
    assert.equal(result.counts.outside, 2); assert.equal(result.counts.evaluated, 4); for (const row of result.rows) assert.deepEqual(row.assessment, evaluateScenario(c, row.state, m));
  });
  await check("sensitivity-determinism", "Finite2×2 tested cases; last axis varies fastest; no mutation; complete authority equivalence, not probabilities.", async (capture) => {
    const snapshot = structuredClone(state), axes = [{ field: "batteryWh" as const, values: [300, 500] }, { field: "initialSoc" as const, values: [0.5, 1] }];
    const a = await runSensitivity(c, m, state, axes), b = await runSensitivity(c, m, state, axes); capture(a);
    assert.deepEqual(a, b); assert.deepEqual(a.cases.map((entry) => entry.values), [[300, 0.5], [300, 1], [500, 0.5], [500, 1]]); assert.deepEqual(state, snapshot); for (const entry of a.cases) { assert.ok(entry.state); assert.deepEqual(entry.assessment, evaluateScenario(c, entry.state, m)); }
  });
  await check("actual-frame-evidence-not-promoted", "Prepared physical evidence with unresolved frame/occlusion limitations cannot be promoted to an unconditional resource pass.", (capture) => {
    const actualState = { ...state, siteId: catalog.sites[0].id, startIndex: 100, endIndex: 102, mission: { ...state.mission, loadW: 0 } };
    const result = evaluateScenario(catalog, actualState, manifest); capture({ outcome: result.outcome, evidence: result.evidence, warnings: result.warnings });
    assert.ok(result.evidence.some((entry) => entry.coverage === "partial" || entry.coverage === "borrowed" || entry.coverage === "unavailable")); assert.notEqual(result.outcome, "passes-assessed");
  });
  await check("actual-product-mask-sanity", "Actual catalog masks are inspected separately from synthetic invariants; finite/missing samples are not independent terrain truth.", () => {
    const site = catalog.sites[0], masks = site.horizons.map((mask) => ({ heightM: mask.heightM, stepDeg: mask.stepDeg, samples: mask.mask.length, finite: Array.from(mask.mask).filter(Number.isFinite).length, selectedAzimuths: [0, 90, 180, 270].map((azimuth) => ({ azimuth, elevation: horizonAt(mask.mask, mask.stepDeg, azimuth) })) }));
    assert.ok(masks.length > 0); assert.ok(masks.every((mask) => mask.samples > 0 && mask.stepDeg > 0)); return { siteId: site.id, lat: site.lat, lon: site.lon, masks, terrainTruthValidated: false };
  });
  const sourceFiles = ["lib/engineering-screens.ts","lib/engineering-context.ts","lib/global-terrain.ts","lib/global-horizon.ts","lib/dsn.ts","lib/celestial-scale.ts","lib/playback.ts","lib/observed-duration.ts","components/workbench/scene/flight-visuals.ts","scripts/verify-planning.mts", "tests/planning-invariants.test.ts", "lib/astro.ts", "lib/mission.ts", "lib/mission-events.ts", "lib/assessment.ts", "lib/analysis-context.ts", "lib/planning-search.ts", "lib/sensitivity.ts", "lib/equipment.ts", "components/workbench/scene/vehicle.ts", "components/workbench/scene/runtime.ts", "scripts/build-standalone.mjs", "public/data/equipment/apollo-lunar-module.glb", "public/data/equipment/draco/draco_decoder.js", "public/data/catalog.json", "public/data/evidence-manifest.json", "docs/qa/horizons-decoded-validation.json"];
  const fileHashes = await Promise.all(sourceFiles.map(async (file) => {
    try { return { file, sha256: createHash("sha256").update(await readFile(path.join(root, file))).digest("hex"), error: null }; }
    catch (error) { return { file, sha256: null, error: error instanceof Error ? error.message : String(error) }; }
  }));
  let commit: string | null = null, sourceTreeDirty: boolean | null = null;
  try {
    commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
    sourceTreeDirty = execFileSync("git", ["status", "--porcelain", "--", ...sourceFiles], { cwd: root, encoding: "utf8" }).trim().length > 0;
  } catch { /* Exported source trees can lack git metadata; null flags and actual file hashes retain this limit. */ }
  const historicalHorizons = JSON.parse(await readFile(path.join(root, "docs/qa/horizons-decoded-validation.json"), "utf8"));
  const failed = checks.filter((entry) => entry.status === "fail");
  return { schemaVersion: 1, checkedUtc: new Date().toISOString(), scientificValidation: "INCOMPLETE", analyticStatus: failed.length ? "FAIL" : "PASS", counts: { pass: checks.length - failed.length, fail: failed.length, incomplete: 1, skipped: 1 }, software: { node: process.version, commit, sourceTreeDirty, modelVersion: PLANNING_MODEL_VERSION, fileHashes }, dataset: { id: manifest.datasetId, frame: catalog.meta.frame, temporalStepHours: catalog.meta.stepHours, sourceManifest: manifest }, checks,
    gates: [{ id: "independent-terrain-truth", status: "INCOMPLETE", reason: "No independently calculated or second-source horizon with matched observer height, source resolution and confirmed frame is available. PGDA MOON_ME(DE421) versus catalog Horizons MEAN_ME/DE441 orientation equivalence is unresolved. Full source DEMs are not bundled. No rotation or physical tolerance is guessed." }],
    skipped: [{ id: "fresh-horizons", reason: "No ephemeris/geometry algorithm changed in this verifier workstream. Historical decoded comparison is retained as context; this run made no network requests.", historicalRecord: historicalHorizons }],
    limitations: ["Analytic tolerances check arithmetic only; they are not source accuracy/confidence bounds.", "Hourly forcing and sampled horizons do not resolve subhour physical transitions; model-estimated segment offsets remain bounded by source evidence.", "Terrain occlusion, frame transformation, station qualification, landing dynamics, thermal survival and NASA model engineering dimensions are not independently validated here.", "The cooperative 8 ms search/sweep budget yields between complete synchronous assessments; a single assessment can exceed that budget."] };
}
async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--output" || !args[1]) throw new Error("Usage: node --import tsx scripts/verify-planning.mts --output DIR");
  const report = await runPlanningVerification(); const output = path.resolve(args[1]); await mkdir(output, { recursive: true });
  await writeFile(path.join(output, "science.json"), JSON.stringify(report, (_key, value) => typeof value === "number" && !Number.isFinite(value) ? null : ArrayBuffer.isView(value) ? Array.from(value as unknown as ArrayLike<number>) : value, 2) + "\n");
  console.log(JSON.stringify({ scientificValidation: report.scientificValidation, analyticStatus: report.analyticStatus, counts: report.counts, failed: report.checks.filter((check) => check.status === "fail").map((check) => check.id), output: path.join(output, "science.json") }));
  process.exitCode = report.counts.fail ? 1 : 2; // 2 = analytic checks passed, scientific gate still incomplete.
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch((error) => { console.error(error); process.exitCode = 1; });
