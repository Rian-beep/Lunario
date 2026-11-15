import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { criteriaForBaseline, evaluateAlternative as evaluateAlternativeAuthority, nearbyCandidates } from "../lib/alternatives";
import type { AlternativeCriteria, AlternativeMetrics } from "../lib/alternative-types";
import { buildSeries, MOON_RADIUS_KM, summarize, terrainForSite } from "../lib/astro";
import { decodeCatalog, type Catalog, type Site } from "../lib/catalog";
import bundledManifest from "../public/data/evidence-manifest.json";
import {parseEvidenceManifest} from "../lib/provenance";
import {DEFAULT_REQUIREMENTS,DEFAULT_OPERATIONS} from "../lib/planning-types";
import { DEFAULT_FLIGHT } from "../lib/flight";
import { DEFAULT_MISSION, evaluateMission } from "../lib/mission";
import { decodeScenario, encodeScenario, type ScenarioState } from "../lib/scenario";

const actual = decodeCatalog(JSON.parse(readFileSync("public/data/catalog.json", "utf8")));
function evaluateAlternative(...args: Parameters<typeof evaluateAlternativeAuthority>) {
  const c=args[0];
  const manifest=parseEvidenceManifest(bundledManifest);
  if(c!==actual&&Number.isFinite(c.meta.stepHours)&&c.meta.stepHours>0){manifest.datasetId='synthetic-alternatives';manifest.validFromUtc=new Date(c.t0ms).toISOString();manifest.validUntilUtcExclusive=new Date(c.t0ms+(c.meta.n-1)*c.meta.stepHours*3600000).toISOString();manifest.entries=manifest.entries.map(e=>({...e,coverage:e.coverage==='unavailable'?'unavailable':'complete'}));}
  return evaluateAlternativeAuthority(args[0],args[1],args[2],args[3],args[4],args[5],args[6]??manifest);
}
function site(id = "ridge", lat = -85, lon = 0): Site {
  return {
    id, name: id, lat, lon, group: "reference", summary: "Synthetic test location",
    source: "Synthetic", sourceUrl: "", demHeightM: null, slopeDeg: 5,
    horizons: [{ heightM: 2, stepDeg: 1, mask: new Float64Array(360) }],
  };
}
function fixture(stepHours = 6, n = 12): Catalog {
  const a = (v: number) => new Float64Array(n).fill(v);
  return {
    ...actual,
    meta: { ...actual.meta, n, stepHours, t0: "2026-11-14T00:00:00Z" },
    t0ms: Date.parse("2026-11-14T00:00:00Z"),
    subsolarLat: a(0), subsolarLon: a(0), subearthLat: a(0),
    subearthLon: a(0), earthRangeKm: a(384400), sunRadiusDeg: a(0.27),
    sites: [site()],
    grid: {
      heightM: 2, stepDeg: 1, nAz: 360,
      lat: new Float64Array([-85]), lon: new Float64Array([0]), mask: new Float64Array(360),
    },
  };
}
function baseline(): ScenarioState {
  return {
    schemaVersion:2,arrayHeightM:2,antennaHeightM:2,requirements:structuredClone(DEFAULT_REQUIREMENTS),operations:structuredClone(DEFAULT_OPERATIONS),
    siteId: "ridge", custom: null, startIndex: 0, endIndex: 1, heightM: 2,
    mission: {
      ...DEFAULT_MISSION, areaM2: 1, efficiency: 1, lossFraction: 0,
      solarFlux: 1000, loadW: 100, batteryWh: 10000, initialSoc: 1,
      reserveSoc: 0.2, chargeEfficiency: 1, dischargeEfficiency: 1,
    },
    flight: { ...DEFAULT_FLIGHT }, radio: { txPowerW: 17, frequencyGHz: 2.2 },
  };
}
function evaluate(catalog = fixture(), state = baseline(), criteria = criteriaForBaseline(state), offset = 0) {
  return evaluateAlternative(catalog, state, nearbyCandidates(catalog, state, 0)[0], offset, criteria);
}

test("defaults use only the current battery reserve and zero unmet demand", () => {
  const s = baseline();
  assert.deepEqual(criteriaForBaseline(s), {
    minSunFraction: null, minContactFraction: null, maxDarkHours: null,
    maxBlackoutHours: null, maxSlopeDeg: null, minBatteryWh: 2000, maxUnmetWh: 0,
  });
  s.mission.batteryWh = 1234;
  s.mission.reserveSoc = 0.37;
  assert.equal(criteriaForBaseline(s).minBatteryWh, 1234 * 0.37);
});

test("a one-day slip changes actual sunlight, energy and storage at the same site", () => {
  const c = fixture();
  c.subsolarLon.fill(180, 4);
  const s = baseline();
  const initial = evaluate(c, s);
  const slipped = evaluate(c, s, criteriaForBaseline(s), 1);
  assert.equal(initial.metrics.sunFraction, 1);
  assert.equal(initial.metrics.generatedWh, 12000);
  assert.equal(initial.metrics.minBatteryWh, 10000);
  assert.equal(slipped.metrics.sunFraction, 0);
  assert.equal(slipped.metrics.longestDarkHours, 12);
  assert.equal(slipped.metrics.generatedWh, 0);
  assert.equal(slipped.metrics.minBatteryWh, 8800);
  assert.equal(slipped.deltas.sunFraction, -1);
  assert.equal(slipped.deltas.generatedWh, -12000);
  assert.equal(slipped.deltas.minBatteryWh, -1200);
  assert.equal(slipped.state.startIndex, 4);
  assert.equal(slipped.state.endIndex, 5);
  assert.equal(slipped.state.endIndex - slipped.state.startIndex, s.endIndex - s.startIndex);
  assert.notEqual(initial.key, slipped.key);
});

test("state preserves vehicle, power, radio, observer height and roundtrips for reproduction", () => {
  const c = fixture(), s = baseline();
  s.heightM = 10;
  c.sites[0].horizons.push({...c.sites[0].horizons[0],heightM:10});
  s.flight.wetMassKg = 5432;
  s.mission.antennaMaskDeg = 6;
  const r = evaluate(c, s, criteriaForBaseline(s), 1);
  assert.deepEqual(r.state.mission, s.mission);
  assert.deepEqual(r.state.flight, s.flight);
  assert.deepEqual(r.state.radio, s.radio);
  assert.equal(r.state.heightM, 10);
  assert.equal(r.metrics.contactFraction, 0);
  assert.equal(r.metrics.longestBlackoutHours, 12);
  assert.deepEqual(decodeScenario(encodeScenario(r.state), { siteIds: ["ridge"], samples: c.meta.n }), r.state);
});

test("date shift converts by catalog step, supports earlier dates and rejects final endpoint as an unsupported interval", () => {
  const c = fixture(0.5, 100), s = baseline();
  s.startIndex = 48;
  s.endIndex = 51;
  const earlier = evaluate(c, s, criteriaForBaseline(s), -1);
  assert.equal(earlier.state.startIndex, 0);
  assert.equal(earlier.state.endIndex, 3);
  const last = evaluate(c, s, criteriaForBaseline(s), 1);
  assert.equal(last.state.startIndex, 96);
  assert.equal(last.state.endIndex, 99);
  assert.equal(last.status, "outside");
});

test("outside cells preserve the full shifted stay and do not compute science or baseline", () => {
  const c = fixture(), s = baseline();
  const candidate = nearbyCandidates(c, s, 0)[0];
  Object.defineProperty(c, "subsolarLat", { get() { throw new Error("science must not run"); } });
  for (const offset of [-1, 3]) {
    const r = evaluateAlternative(c, s, candidate, offset, criteriaForBaseline(s));
    assert.equal(r.status, "outside");
    assert.equal(r.state.startIndex, offset * 4);
    assert.equal(r.state.endIndex, offset * 4 + 1);
    assert.equal(r.metrics.generatedWh, null);
    assert.equal(r.metrics.minBatteryWh, null);
    assert.equal(r.metrics.knownFraction, 0);
    assert.ok(Object.values(r.deltas).every((value) => value === null));
    assert.equal(Object.keys(r.deltas).length, Object.keys(r.metrics).length);
    assert.deepEqual(r.violations, []);
    assert.match(r.unknowns.join(" "), /full shifted stay.*outside/i);
  }
});

test("a stay crossing the end of coverage is outside rather than shortened", () => {
  const s = baseline();
  s.startIndex = 3;
  s.endIndex = 4;
  const r = evaluate(fixture(), s, criteriaForBaseline(s), 2);
  assert.equal(r.status, "outside");
  assert.equal(r.state.startIndex, 11);
  assert.equal(r.state.endIndex, 12);
});

test("fractional days, unaligned shifts and invalid catalog intervals are rejected", () => {
  assert.throws(() => evaluate(fixture(), baseline(), criteriaForBaseline(baseline()), 0.5), /integer day/);
  assert.throws(() => evaluate(fixture(5), baseline(), criteriaForBaseline(baseline()), 1), /align/);
  assert.throws(() => evaluate(fixture(0)), /stepHours/);
  assert.throws(() => evaluate(fixture(NaN)), /stepHours/);
});

test("region selection uses lunar great-circle distance, nearest order, wrapping and deduplication", () => {
  const c = fixture();
  c.sites = [site("far", -82), site("west", -85, -1), site("ridge"), site("duplicate", -85, 360), site("near", -84.9)];
  const candidates = nearbyCandidates(c, baseline(), 4);
  assert.deepEqual(candidates.map((p) => p.id), ["ridge", "west", "near"]);
  assert.ok(Math.abs(candidates[2].distanceKm - MOON_RADIUS_KM * 0.1 * Math.PI / 180) < 1e-9);
  assert.ok(candidates[1].distanceKm < candidates[2].distanceKm);
  assert.ok(candidates.every((p) => p.distanceKm <= 4));
  assert.equal(nearbyCandidates(c, baseline(), 0).length, 1);
});

test("current custom is always first, deduplicated and retained even with a one-point cap", () => {
  const c = fixture(), s = baseline();
  s.custom = { lat: -85, lon: 360 };
  const [current] = nearbyCandidates(c, s, 0, 1);
  assert.deepEqual(current.custom, s.custom);
  assert.equal(current.siteId, s.siteId);
  assert.equal(current.distanceKm, 0);
  assert.equal(nearbyCandidates(c, s, 100).length, 1);
  const r = evaluateAlternative(c, s, current, 1, criteriaForBaseline(s));
  assert.deepEqual(r.state.custom, s.custom);
  assert.equal(r.metrics.slopeDeg, null);
  assert.equal(r.status, "conditional");
  s.custom = { lat: 0, lon: 0 };
  assert.equal(nearbyCandidates(c, s, 0)[0].lat, 0);
});

test("candidate caps stay at twelve, smaller caps work and invalid search values fail", () => {
  const c = fixture();
  c.sites.push(...Array.from({ length: 20 }, (_, i) => site(`n${i}`, -85 + (i + 1) / 100)));
  assert.equal(nearbyCandidates(c, baseline(), 100, 100).length, 12);
  assert.equal(nearbyCandidates(c, baseline(), 100, 3).length, 3);
  for (const radius of [-1, NaN, Infinity]) assert.throws(() => nearbyCandidates(c, baseline(), radius), /radius/);
  for (const cap of [0, -1, 1.5, NaN]) assert.throws(() => nearbyCandidates(c, baseline(), 100, cap), /max/);
});

test("switching candidates uses their terrain while retaining baseline assumptions", () => {
  const c = fixture(), s = baseline();
  const shaded = site("shaded", -84.9);
  shaded.horizons[0].mask.fill(20);
  c.sites.push(shaded);
  const candidate = nearbyCandidates(c, s, 4)[1];
  const r = evaluateAlternative(c, s, candidate, 0, criteriaForBaseline(s));
  assert.equal(r.state.siteId, "shaded");
  assert.equal(r.metrics.generatedWh, 0);
  assert.equal(r.deltas.generatedWh, -12000);
  assert.deepEqual(r.state.mission, s.mission);
  assert.deepEqual(r.state.flight, s.flight);
});

test("empty horizons and empty horizon masks are unavailable, never favorable zeros", () => {
  for (const emptyMask of [false, true]) {
    const c = fixture();
    if (emptyMask) c.sites[0].horizons[0].mask = new Float64Array();
    else c.sites[0].horizons = [];
    c.sites[0].slopeDeg = null;
    const r = evaluate(c);
    assert.equal(r.status, "unknown");
    assert.equal(r.metrics.knownFraction, 0);
    for (const [key, value] of Object.entries(r.metrics)) if (key !== "knownFraction") assert.equal(value, null, key);
    assert.ok(r.unknowns.length >= 2);
    assert.equal(r.deltas.generatedWh, null);
  }
});

test("custom terrain outside the polar grid and an empty custom grid stay unknown", () => {
  for (const lat of [0, -79.9, -90]) {
    const c = fixture(), s = baseline();
    s.custom = { lat, lon: 0 };
    if (lat === -90) c.grid.lat = new Float64Array();
    const r = evaluate(c, s);
    assert.equal(r.status, "unknown");
    assert.equal(r.metrics.generatedWh, null);
    assert.equal(r.metrics.sunFraction, null);
    assert.equal(r.metrics.slopeDeg, null);
  }
});

test("known slope failures survive unknown energy and unknown contact constraints", () => {
  const c = fixture(), s = baseline();
  c.sites[0].horizons = [];
  c.sites[0].slopeDeg = 20;
  const r = evaluate(c, s, { ...criteriaForBaseline(s), maxSlopeDeg: 10, minContactFraction: 0.5 });
  assert.equal(r.status, "fails");
  assert.match(r.violations.join(" "), /slope.*20.*10/i);
  assert.match(r.unknowns.join(" "), /battery/i);
  assert.match(r.unknowns.join(" "), /contact/i);
  assert.equal(r.metrics.minBatteryWh, null);
});

test("partial source coverage cannot pass as a higher known-only sunlight percentage", () => {
  const c = fixture(), s = baseline();
  c.subsolarLon[1] = 180;
  c.sites[0].horizons[0].mask.fill(NaN, 170, 191);
  const r = evaluate(c, s, { ...criteriaForBaseline(s), minSunFraction: 0.9 });
  assert.equal(r.status, "unknown");
  assert.equal(r.metrics.sunFraction, null);
  assert.equal(r.metrics.generatedWh, null);
  assert.equal(r.metrics.knownFraction, 0.5);
  assert.match(r.unknowns.join(" "), /minSunFraction/i);
});

test("independent known contact failure is retained with missing solar ephemeris", () => {
  const c = fixture(), s = baseline();
  c.subsolarLat[1] = NaN;
  s.mission.antennaMaskDeg = 10;
  const r = evaluate(c, s, { ...criteriaForBaseline(s), minContactFraction: 0.5 });
  assert.equal(r.status, "fails");
  assert.equal(r.metrics.contactFraction, 0);
  assert.equal(r.metrics.sunFraction, null);
  assert.equal(r.metrics.generatedWh, null);
  assert.match(r.violations.join(" "), /contact/i);
  assert.match(r.unknowns.join(" "), /battery/i);
});

test("missing contact does not discard a known solar failure or invent a blackout duration", () => {
  const c = fixture(), s = baseline();
  c.subearthLat[0] = NaN;
  c.subsolarLon.fill(180);
  const r = evaluate(c, s, { ...criteriaForBaseline(s), minSunFraction: 0.5, maxBlackoutHours: 10 });
  assert.equal(r.status, "fails");
  assert.equal(r.metrics.sunFraction, 0);
  assert.equal(r.metrics.contactFraction, null);
  assert.equal(r.metrics.longestBlackoutHours, null);
  assert.match(r.unknowns.join(" "), /blackout/i);
});

test("invalid disk radius and Earth range are unknown source data rather than useful measurements", () => {
  const c = fixture(), s = baseline();
  c.sunRadiusDeg[0] = 0;
  c.earthRangeKm[1] = 0;
  const r = evaluate(c, s, { ...criteriaForBaseline(s), minContactFraction: 0 });
  assert.equal(r.status, "unknown");
  assert.equal(r.metrics.sunFraction, null);
  assert.equal(r.metrics.generatedWh, null);
  assert.equal(r.metrics.contactFraction, null);
  assert.equal(r.metrics.longestBlackoutHours, null);
  assert.equal(r.metrics.knownFraction, 0);
});

test("all supplied criteria are inclusive at their bounds and report individual failures", () => {
  const c = fixture(), s = baseline();
  const criteria: AlternativeCriteria = {
    minSunFraction: 1, minContactFraction: 1, maxDarkHours: 0, maxBlackoutHours: 0,
    maxSlopeDeg: 5, minBatteryWh: 10000, maxUnmetWh: 0,
  };
  assert.equal(evaluate(c, s, criteria).status, "meets");
  c.subsolarLon.fill(180);
  c.subearthLon.fill(180);
  s.mission.batteryWh = 100;
  const r = evaluate(c, s, { ...criteria, maxSlopeDeg: 4 });
  assert.equal(r.status, "fails");
  assert.equal(r.violations.filter(v=>v.startsWith("Additional screen:")).length, 7);
  assert.deepEqual(r.unknowns, []);
  assert.equal(r.metrics.unmetWh, 1100);
});

test("missing requested slope is unknown even when power and visibility are fully known", () => {
  const c = fixture(), s = baseline();
  c.sites[0].slopeDeg = null;
  const r = evaluate(c, s, { ...criteriaForBaseline(s), maxSlopeDeg: 10 });
  assert.equal(r.status, "unknown");
  assert.equal(r.metrics.knownFraction, 1);
  assert.match(r.unknowns.join(" "), /slope/i);
});

test("invalid criteria are rejected and zero is a real threshold", () => {
  const c = fixture(), s = baseline(), criteria = criteriaForBaseline(s);
  for (const key of Object.keys(criteria) as (keyof AlternativeCriteria)[]) {
    for (const invalid of [NaN, Infinity, -1, Number.MAX_VALUE]) {
      assert.throws(() => evaluate(c, s, { ...criteria, [key]: invalid }), RangeError, key);
    }
  }
  for (const key of ["minSunFraction", "minContactFraction"] as const)
    assert.throws(() => evaluate(c, s, { ...criteria, [key]: 1.01 }), RangeError);
  assert.throws(() => evaluate(c, s, { ...criteria, maxSlopeDeg: 91 }), RangeError);
  // Runtime callers must not turn required energy limits into nullable criteria.
  assert.throws(() => evaluate(c, s, JSON.parse(JSON.stringify({ ...criteria, minBatteryWh: null }))), RangeError);
  const r = evaluate(c, s, { ...criteria, maxSlopeDeg: 0 });
  assert.equal(r.status, "fails");
});

test("cached baseline metrics produce the same deltas, preserving nulls", () => {
  const c = fixture(), s = baseline(), candidate = nearbyCandidates(c, s, 0)[0];
  c.subsolarLon.fill(180, 4);
  const metrics = evaluate(c, s).metrics;
  const expected = evaluateAlternative(c, s, candidate, 1, criteriaForBaseline(s));
  const cached = evaluateAlternative(c, s, candidate, 1, criteriaForBaseline(s), metrics);
  assert.deepEqual(cached, expected);
  const missing: AlternativeMetrics = { ...metrics, generatedWh: null, minBatteryWh: NaN };
  const r = evaluateAlternative(c, s, candidate, 1, criteriaForBaseline(s), missing);
  assert.equal(r.deltas.generatedWh, null);
  assert.equal(r.deltas.minBatteryWh, null);
});

test("evaluation never mutates catalog, baseline, candidate, criteria or cached metrics", () => {
  const c = fixture(), s = baseline(), criteria = criteriaForBaseline(s);
  const candidate = nearbyCandidates(c, s, 0)[0], metrics = evaluate(c, s).metrics;
  const before = structuredClone({ c, s, candidate, criteria, metrics });
  const r = evaluateAlternative(c, s, candidate, 1, criteria, metrics);
  assert.deepEqual({ c, s, candidate, criteria, metrics }, before);
  r.state.mission.loadW = 99;
  r.state.flight.wetMassKg = 999;
  r.state.radio!.txPowerW = 99;
  r.candidate.name = "Changed result";
  assert.deepEqual({ c, s, candidate, criteria, metrics }, before);
  s.custom = { lat: -85, lon: 0 };
  const custom = nearbyCandidates(c, s, 0)[0];
  const result = evaluateAlternative(c, s, custom, 0, criteria);
  result.state.custom!.lat = -84;
  result.candidate.custom!.lat = -83;
  assert.equal(s.custom.lat, -85);
  assert.equal(custom.custom!.lat, -85);
});

test("candidate coordinates must reproduce the same state, rather than evaluating a hidden location", () => {
  const c = fixture(), s = baseline(), candidate = nearbyCandidates(c, s, 0)[0];
  assert.throws(() => evaluateAlternative(c, s, { ...candidate, lat: -84 }, 0, criteriaForBaseline(s)), /coordinates/);
  assert.throws(() => evaluateAlternative(c, s, { ...candidate, custom: { lat: -85, lon: NaN } }, 0, criteriaForBaseline(s)), /coordinates/);
});

test("actual catalog cell agrees with existing summaries and mission integration", () => {
  const s = baseline();
  s.siteId = actual.sites.find((p) => p.horizons.length && p.lat < -80)!.id;
  s.startIndex = 100;
  s.endIndex = 123;
  const p = actual.sites.find((p) => p.id === s.siteId)!;
  const series = buildSeries(actual, p.lat, p.lon, terrainForSite(p, s.heightM), s.startIndex, s.endIndex);
  const summary = summarize(series, actual.meta.stepHours);
  const mission = evaluateMission(series, actual.meta.stepHours, s.mission);
  const r = evaluate(actual, s);
  assert.equal(r.metrics.sunFraction, summary.sunlitTerrain);
  assert.equal(r.metrics.longestDarkHours, summary.longestDarkTerrain);
  assert.equal(r.metrics.generatedWh, mission.generatedWh);
  assert.equal(r.metrics.minBatteryWh, mission.minBatteryWh);
  assert.equal(r.metrics.contactFraction, mission.contactFraction);
  assert.equal(r.metrics.knownFraction, 1);
  assert.equal(r.deltas.generatedWh, 0);
});

test('unsupported observer heights remain requested but cannot pass using another height mask',()=>{
  const c=fixture(),s=baseline();s.heightM=10;s.arrayHeightM=10;s.antennaHeightM=10;
  let r=evaluate(c,s,criteriaForBaseline(s));
  assert.equal(r.state.heightM,10);assert.equal(r.status,'unknown');assert.equal(r.metrics.minBatteryWh,null);assert.match(r.assessment!.warnings.join(' '),/10 m/);
  s.custom={lat:-85,lon:0};const candidate=nearbyCandidates(c,s,0)[0];
  r=evaluateAlternative(c,s,candidate,0,criteriaForBaseline(s));
  assert.equal(r.state.heightM,10);assert.equal(r.status,'unknown');assert.equal(r.metrics.knownFraction,0);
});

test('shared assessment is the sole constraint authority and variants deep-clone planning inputs',()=>{
 const c=fixture(),s=baseline();s.operations.loadSegments=[{id:'segment',startOffsetHours:0,endOffsetHours:1,additionalW:1}];
 s.externalAssessments=[{id:'thermal-survival',status:'unknown',source:'',author:'',notes:'No report',scenarioKey:'different-scope'}];
 const criteria={...criteriaForBaseline(s),maxUnmetWh:5,minBatteryWh:0};
 const r=evaluate(c,s,criteria);
 assert.ok(r.assessment);assert.equal(r.state.requirements.requireReserve,true);assert.equal(r.state.requirements.requireZeroUnmetWh,false);
 assert.deepEqual(r.state.requirements.extraScreens,criteria);
 r.state.operations.loadSegments[0].additionalW=99;r.state.externalAssessments![0].notes='changed';r.state.requirements.requiredExternal.push('thermal-survival');
 assert.equal(s.operations.loadSegments[0].additionalW,1);assert.equal(s.externalAssessments[0].notes,'No report');assert.deepEqual(s.requirements.requiredExternal,[]);
});
test('default bundled evidence retains conditional status instead of claiming a full pass',()=>{
 const s=baseline();s.siteId=actual.sites.find(p=>p.horizons.length&&p.lat< -80)!.id;s.startIndex=100;s.endIndex=123;
 s.mission.loadW=0;s.mission.batteryWh=10000;
 const r=evaluateAlternativeAuthority(actual,s,nearbyCandidates(actual,s,0)[0],0,criteriaForBaseline(s));
 assert.equal(r.status,'conditional');assert.equal(r.assessment?.outcome,'conditional');
});
