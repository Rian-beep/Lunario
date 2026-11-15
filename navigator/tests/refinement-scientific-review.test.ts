import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { decodeCatalog } from '../lib/catalog';
import { parseEvidenceManifest } from '../lib/provenance';
import { evaluateScenario, evidenceScopeKey } from '../lib/assessment';
import { engineeringScopeKey } from '../lib/engineering-context';
import { ENGINEERING_EXTERNAL_IDS, type EngineeringInputs, type EngineeringDomain } from '../lib/engineering-screens';
import { parseScenario, type ScenarioState } from '../lib/scenario';
import { DEFAULT_MISSION, linkBudget } from '../lib/mission';
import { DEFAULT_FLIGHT } from '../lib/flight';
import { DSN_STATIONS } from '../lib/dsn';
import { parseHorizonsResponse, horizonsUrl } from '../lib/engineering-evidence/horizons';
import { evaluateCommunications, diskStationCutoff } from '../lib/engineering-evidence/communications';
import { emptyEnvelope } from '../lib/engineering-evidence/workspace';
import { exportEnvelope, parseEnvelope } from '../lib/engineering-evidence/import';
import { evaluateDeclaredBounds } from '../lib/engineering-evidence/uncertainty';
import type { CommunicationsEnvelope, Provenance, Supplied } from '../lib/engineering-evidence/types';
import { selectedSolarResponse } from '../lib/audience/experiments';
import { controlledAlternative, cursorDomain, caseCursor, prepareCase } from '../lib/replanning/model';
import { paretoOptions, type TestedOption } from '../lib/replanning/scan';

const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const fixture = read('public/data/engineering-evidence/goldstone-horizons.json');
const fetched = '2026-11-14T20:00:00Z', now = '2026-11-16T00:00:00Z';
const stay = { startUtc: '2026-11-14T00:00:00Z', endUtc: '2026-11-14T01:00:00Z' };
const p: Provenance = { title: 'Adversarial test assumption', sourceUrl: 'https://example.invalid/test-only', author: 'Independent verifier', issuedUtc: '2026-11-13T00:00:00Z', kind: 'user-assumption', notes: 'Synthetic assumption; not operational evidence.' };
const supplied = <T>(value: T): Supplied<T> => ({ value, provenance: { ...p } });
function chain(): CommunicationsEnvelope {
  return { ...emptyEnvelope('review'), geometry: parseHorizonsResponse(fixture.response, fixture.request, fetched),
    stationHorizon: supplied({ minimumElevationDeg: 0, profile: [] }),
    lunarMask: supplied([{ ...stay, visible: true, antennaHeightM: 2, minimumElevationDeg: 0, target: 'Earth-center proxy' }]),
    hardware: supplied({ band: 'X', frequencyGHz: 8.4, txPowerW: 100, txGainDbi: 30, rxVacuumGainDbi: 74, systemNoiseK: 100, pointingLossDb: 1, otherLossDb: 2, implementationLossDb: 1, requiredEbN0Db: 5, rateBps: 1000 }),
    weather: supplied([{ ...stay, attenuationDb: 1, band: 'X', frequencyGHz: 8.4 }]),
    allocations: supplied([{ ...stay, rateLimitBps: 500 }]), requirements: { minimumBits: 1, critical: [] } };
}
const assess = (e: CommunicationsEnvelope) => evaluateCommunications(e, 'review', stay, now);
const c = decodeCatalog(read('public/data/catalog.json'));
const m = parseEvidenceManifest(read('public/data/evidence-manifest.json'));
const base = parseScenario({ siteId: c.sites[0].id, custom: null, startIndex: 0, endIndex: 3, heightM: 2, mission: DEFAULT_MISSION, flight: DEFAULT_FLIGHT }, { siteIds: c.sites.map(s => s.id), samples: c.meta.n, stepHours: c.meta.stepHours })!;

test('primary 301O Table 5 station coordinates and altitude units are retained in requests', () => {
  // Independently transcribed published DMS, rather than the application's conversion helper.
  const rows = [[35 + 25 / 60 + 33.24312 / 3600, 243 + 6 / 60 + 37.66244 / 3600, 1.001390], [40 + 25 / 60 + 52.35510 / 3600, 355 + 45 / 60 + 7.16924 / 3600, .864816], [-(35 + 24 / 60 + 8.72724 / 3600), 148 + 58 / 60 + 52.56231 / 3600, .688867]];
  DSN_STATIONS.forEach((station, i) => {
    assert.deepEqual([station.latitudeDeg, station.longitudeEastDeg, station.heightM / 1000], rows[i]);
    const u = new URL(horizonsUrl({ ...fixture.request, stationId: station.id }));
    assert.equal(u.searchParams.get('SITE_COORD'), `'${rows[i][1]},${rows[i][0]},${rows[i][2]}'`);
  });
});

for (const [from, to] of [['Date_________JDUT', 'Date_________JDTDB'], ['Azimuth_(a-app)', 'Azimuth_(geometric)'], ['Elevation_(a-app)', 'Elevation_(geometric)']]) {
  test(`raw geometry must reject conflicting source column ${to}`, () => {
    const result = fixture.response.result.replace(from, to);
    assert.notEqual(result, fixture.response.result);
    assert.throws(() => parseHorizonsResponse({ result }, fixture.request, fetched), /time|UTC|UT|column|apparent|header/i);
  });
}

test('imported geometry request identity cannot contradict its archived station source', () => {
  const e = chain();
  e.geometry!.requestUrl = horizonsUrl({ ...fixture.request, stationId: 'madrid' });
  assert.throws(() => assess(e), /request|identity|source|station/i);
});

test('export/import preserves exact archived bytes; changed numeric columns cannot acquire source authority', () => {
  const e = chain(), bytes = e.geometry!.rawResponse;
  const roundtrip = parseEnvelope(exportEnvelope(e));
  assert.equal(createHash('sha256').update(roundtrip.geometry!.rawResponse).digest('hex'), createHash('sha256').update(bytes).digest('hex'));
  roundtrip.geometry!.samples[0].rangeKm += 1;
  assert.throws(() => assess(roundtrip), /differs from archived/);
});

test('independent SI link arithmetic matches all reported link quantities', () => {
  const e = chain(), r = assess(e), h = e.hardware!.value;
  const rangeM = (e.geometry!.samples[0].rangeKm + 1737.4) * 1000;
  const pathLoss = 20 * Math.log10(4 * Math.PI * rangeM * h.frequencyGHz * 1e9 / 299792458);
  const received = 10 * Math.log10(h.txPowerW) + h.txGainDbi + h.rxVacuumGainDbi - pathLoss - 5;
  const ebn0 = received - 10 * Math.log10(1.380649e-23 * h.systemNoiseK) - 10 * Math.log10(h.rateBps);
  assert.ok(Math.abs(r.slices[0].pathLossDb! - pathLoss) < .001);
  assert.ok(Math.abs(r.slices[0].receivedDbw! - received) < .001);
  assert.ok(Math.abs(r.slices[0].ebN0Db! - ebn0) < .001);
  assert.equal(r.deliveredBits, 500 * 3600);
  assert.equal(r.operationalApproval, false);
});

test('disk cutoff covers azimuth seams, near-zenith span, and strict lower-limb equality', () => {
  const horizon = { minimumElevationDeg: 0, profile: [{ azimuthDeg: 0, elevationDeg: 60 }, { azimuthDeg: 1, elevationDeg: 0 }, { azimuthDeg: 359, elevationDeg: 0 }, { azimuthDeg: 360, elevationDeg: 60 }] };
  assert.equal(diskStationCutoff(horizon, 359.99, 0, .25), 60);
  assert.equal(diskStationCutoff(horizon, 180, 89.99, .25), 60);
  const e = chain(), g = e.geometry!.samples[0];
  e.stationHorizon!.value.minimumElevationDeg = g.elevationDeg - Math.asin(1737.4 / g.rangeKm) * 180 / Math.PI;
  assert.equal(assess(e).deliveredBits, 0);
});

test('critical contact uses intersection of lunar, allocation and weather intervals, not total-stay success', () => {
  const e = chain();
  e.allocations!.value = [{ ...stay, endUtc: '2026-11-14T00:20:00Z', rateLimitBps: 500 }, { startUtc: '2026-11-14T00:20:00Z', endUtc: stay.endUtc, rateLimitBps: 0 }];
  e.requirements.critical = [{ ...stay, id: 'critical', startUtc: '2026-11-14T00:10:00Z', endUtc: '2026-11-14T00:30:00Z', minimumBits: 300000, minimumContactSeconds: 601 }];
  const r = assess(e);
  assert.equal(r.deliveredBits, 600000);
  assert.equal(r.critical[0].bits, 300000);
  assert.equal(r.critical[0].seconds, 600);
  assert.equal(r.status, 'conditional-shortfall');
  e.allocations!.value.pop();
  assert.equal(assess(e).status, 'incomplete');
  assert.equal(assess(e).knownDeliveredBits, 600000);
});

test('observed weather crossing its issue instant leaves only the earlier intersection known', () => {
  const e = chain();
  e.weather!.provenance = { ...p, kind: 'observation', issuedUtc: '2026-11-14T00:30:00Z' };
  e.allocations!.value = [{ ...stay, endUtc: '2026-11-14T00:30:00Z', rateLimitBps: 500 }, { ...stay, startUtc: '2026-11-14T00:30:00Z', rateLimitBps: 500 }];
  const r = assess(e);
  assert.equal(r.deliveredBits, null);
  assert.equal(r.knownDeliveredBits, 900000);
  assert.match(r.slices[1].unknown.join(' '), /cannot forecast/);
});

test('lunar proxy remains an explicit assumption and stale scope cannot yield capacity', () => {
  const e = chain(); e.lunarMask!.provenance.kind = 'reference';
  assert.equal(assess(e).deliveredBits, null);
  e.lunarMask!.provenance.kind = 'user-assumption';
  const r = evaluateCommunications(e, 'changed-site-or-requirements', stay, now);
  assert.equal(r.deliveredBits, null); assert.equal(r.status, 'incomplete');
});

test('finite declared cases retain exact source identities and requirements without continuous bounds', async () => {
  const before = structuredClone(base), a = evaluateScenario(c, base, m);
  const r = await evaluateDeclaredBounds(c, m, base, { schema: 'solarreach-declared-bounds-1', scenarioKey: a.scenarioKey, bounds: [{ field: 'solarFlux', lower: 0, upper: 2000, provenance: p }] });
  assert.deepEqual(base, before); assert.equal(r.cases.length, 3);
  assert.deepEqual(r.heldRequirements, base.requirements); assert.deepEqual(r.heldOperations, base.operations);
  for (const point of r.cases) {
    const actual = evaluateScenario(c, { ...base, mission: { ...base.mission, ...point.values } }, m);
    assert.equal(point.scenarioKey, actual.scenarioKey); assert.equal(point.outcome, actual.outcome);
  }
  assert.match(r.interpretation, /Finite.*no probability, continuous enclosure/);
  assert.ok(r.unquantified.length > 0);
});

test('selected solar derivative at zero irradiance includes orientation, losses and fractional deployment', () => {
  // Explicit synthetic overhead Sun: independent analytic power, no claimed lunar measurement.
  const site = { ...c.sites[0], lat: 0, lon: 0, horizons: [{ heightM: 2, stepDeg: 1, mask: new Float64Array(360).fill(-90) }] };
  const catalog = { ...c, sites: [site], subsolarLat: new Float64Array(c.meta.n), subsolarLon: new Float64Array(c.meta.n) };
  const state = { ...structuredClone(base), mission: { ...base.mission, solarFlux: 0, areaM2: 7, efficiency: .2, lossFraction: .3, arrayMode: 'fixed' as const, tiltDeg: 37, azimuthDeg: 123 }, operations: { ...base.operations, deploymentDelayHours: .75 } };
  const r = selectedSolarResponse(catalog, m, state, 0);
  const perturb = evaluateScenario(catalog, { ...state, mission: { ...state.mission, solarFlux: .01 } }, m);
  assert.equal(r.unit, 'm²');
  assert.ok(Math.abs(r.derivative! - 7 * .2 * .7 * Math.cos(37 * Math.PI / 180) * .25) < 1e-10);
  assert.ok(Math.abs(r.derivative! - perturb.mission.timeline[0].powerW! / .01) < 1e-10);
  assert.ok(Math.abs(r.sphereDerivative! - perturb.sphereMission.timeline[0].powerW! / .01) < 1e-10);
  assert.equal(r.points.find(point => point.x === 0)!.terrain, 0);
  assert.deepEqual(r.assumptions, state.mission);
});

test('selected solar unknown terrain stays unknown, independent smooth sphere remains available', () => {
  const state = { ...structuredClone(base), custom: { lat: -85, lon: 0 }, arrayHeightM: 10 };
  const r = selectedSolarResponse(c, m, state, 0);
  assert.equal(r.derivative, null); assert.equal(r.activeFactor, null);
  assert.ok(r.points.every(point => point.terrain === null));
  assert.ok(r.sphereDerivative !== null);
});

test('replan preserves coordinates/hardware and actual UTCs across non-hourly elapsed alignment', () => {
  const catalog = { ...c, meta: { ...c.meta, stepHours: 2 } };
  const state: ScenarioState = { ...structuredClone(base), custom: { lat: -87.25, lon: -179.9 } };
  const shifted = controlledAlternative(catalog, state, null, 4);
  assert.deepEqual(shifted.custom, state.custom); assert.deepEqual(shifted.mission, state.mission);
  const d = cursorDomain(catalog, state, shifted, 'elapsed')!;
  const a = caseCursor(catalog, state, d, 2)!, b = caseCursor(catalog, shifted, d, 2)!;
  assert.equal(b.utcMs - a.utcMs, 4 * 3600000); assert.equal(b.elapsedHours, a.elapsedHours);
  const named = controlledAlternative(catalog, state, c.sites[1].id, 0);
  assert.equal(named.custom, null); assert.equal(named.siteId, c.sites[1].id);
});

test('missing and broadened-requirement replans cannot dominate a fully computed case', () => {
  const asRow = (id: string, state: ScenarioState): TestedOption => {
    const result = prepareCase(c, m, { id, name: id, state });
    return { id, name: id, state, assessment: result.value?.assessment ?? null, error: result.error, shiftHours: 0 };
  };
  const missing = { ...structuredClone(base), custom: { lat: -85, lon: 0 }, arrayHeightM: 10 };
  const broad = { ...structuredClone(base), requirements: { ...base.requirements, scope: 'landing-readiness' as const } };
  const rows = paretoOptions([asRow('base', base), asRow('missing', missing), asRow('broader', broad), asRow('outside', { ...base, startIndex: c.meta.n, endIndex: c.meta.n + 1 })]);
  assert.notEqual(rows[0].rank, 'dominated');
  for (const row of rows.slice(1)) assert.equal(row.rank, 'unranked');
});

test('changing a reserve requirement embedded in mission inputs separates ranking cohorts', () => {
  const rows: TestedOption[] = [0, .95].map((reserveSoc, i) => {
    const state = { ...structuredClone(base), mission: { ...base.mission, reserveSoc } };
    return { id: String(i), name: String(i), state, assessment: evaluateScenario(c, state, m), error: null, shiftHours: 0 };
  });
  const ranked = paretoOptions(rows);
  assert.notEqual(ranked[0].cohort, ranked[1].cohort);
  assert.equal(ranked[1].rank, 'non-dominated');
});

test('free-space teaching helper rejects incomplete radio rather than inventing a link', () => {
  assert.equal(linkBudget({ txPowerW: 100 }), null);
});

test('station link rates and SI range/frequency conversions preserve expected logarithmic changes', () => {
  const e = chain(), original = assess(e).slices[0];
  e.hardware!.value.rateBps *= 10;
  const faster = assess(e).slices[0];
  assert.ok(Math.abs(faster.ebN0Db! - original.ebN0Db! + 10) < 1e-10);
  e.hardware!.value.frequencyGHz *= 2; e.weather!.value[0].frequencyGHz *= 2;
  const higher = assess(e).slices[0];
  assert.ok(Math.abs(higher.pathLossDb! - faster.pathLossDb! - 20 * Math.log10(2)) < 1e-10);
  e.hardware!.value.systemNoiseK *= 2;
  assert.ok(Math.abs(assess(e).slices[0].ebN0Db! - higher.ebN0Db! + 10 * Math.log10(2)) < 1e-10);
});

test('raw CSV meaning is bound to the actual table, not valid labels elsewhere in the response', () => {
  const original = fixture.response.result as string;
  for (const [from, to] of [
    ['Date_________JDUT', 'Date_________JDTT'],
    ['Azimuth_(a-app)', 'Azimuth_(r-app)'],
    ['Azimuth_(a-app), Elevation_(a-app)', 'Elevation_(a-app), Azimuth_(a-app)'],
    ['Time format     : JD', 'Time format     : CAL'],
    ['RA format       : DEG', 'RA format       : HMS'],
    ['00:00:00.0000 UT', '00:00:00.0000 TDB'],
    ['Atmos refraction: NO (AIRLESS)', 'Atmos refraction: YES (REFRACTED)'],
  ]) {
    const changed = original.replace(from, to);
    assert.notEqual(changed, original, from);
    // A copied valid header in the explanatory footer cannot validate the data table.
    assert.throws(() => parseHorizonsResponse({ result: changed + '\n' + original.split('$$SOE')[0] }, fixture.request, fetched), /header|UTC|apparent|airless/i, from);
  }
  assert.throws(() => horizonsUrl({ ...fixture.request, startUtc: '1961-12-31T00:00:00Z', endUtc: '1962-01-01T00:00:00Z' }), /UTC/);
});

test('ambiguous table boundaries and missing numeric source fields are rejected', () => {
  const original = fixture.response.result as string;
  for (const result of [original + '\n$$SOE', original + '\n$$EOE', original.replace('191.256257377', ''), original.replace('243.1104618,35.4259009,1.00139', '--,35.4259009,1.00139')]) {
    assert.throws(() => parseHorizonsResponse({ result }, fixture.request, fetched));
  }
});

test('every declared Horizons request setting is mandatory and must agree with the source convention', () => {
  const original = new URL(chain().geometry!.requestUrl);
  for (const [key] of original.searchParams) {
    for (const mode of ['changed', 'missing', 'duplicate']) {
      const url = new URL(original), e = chain();
      if (mode === 'missing') url.searchParams.delete(key);
      else if (mode === 'duplicate') url.searchParams.append(key, url.searchParams.get(key)!);
      else url.searchParams.set(key, key === 'START_TIME' ? "'2026-11-14 01:00:00'" : key === 'STOP_TIME' ? "'2026-11-15 01:00:00'" : "'contradiction'");
      e.geometry!.requestUrl = url.href;
      // Exercise the same structural roundtrip available to offline imports/exports.
      assert.throws(() => assess(parseEnvelope(exportEnvelope(e))), Error, `${key}: ${mode}`);
    }
  }
});

test('request provider, extra controls and duplicate overrides cannot contradict archived geometry', () => {
  const original = chain().geometry!.requestUrl;
  for (const mutate of [
    (u: URL) => { u.hostname = 'example.invalid'; },
    (u: URL) => { u.protocol = 'http:'; },
    (u: URL) => { u.pathname = '/other'; },
    (u: URL) => { u.username = 'unexpected'; },
    (u: URL) => { u.hash = 'unexpected'; },
    (u: URL) => { u.searchParams.set('REF_SYSTEM', "'B1950'"); },
    (u: URL) => { u.searchParams.append('TIME_TYPE', "'TDB'"); },
  ]) {
    const e = chain(), url = new URL(original); mutate(url); e.geometry!.requestUrl = url.href;
    assert.throws(() => assess(e), /request|source|identity/i);
  }
});

test('equivalent request encoding, parameter order and UTC millisecond spelling preserve capacity', () => {
  const e = chain(), url = new URL(e.geometry!.requestUrl);
  const entries = [...url.searchParams].reverse().map(([key, value]) => {
    const unquoted = value.replace(/^'|'$/g, '');
    return [key, key === 'START_TIME' || key === 'STOP_TIME' ? unquoted + '.000' : unquoted];
  });
  url.search = new URLSearchParams(entries).toString(); e.geometry!.requestUrl = url.href;
  assert.equal(assess(parseEnvelope(exportEnvelope(e))).deliveredBits, 1800000);
});

const rankedState = (state: ScenarioState): TestedOption => ({ id: 'review', name: 'review', state, assessment: evaluateScenario(c, state, m), error: null, shiftHours: 0 });
test('ranking cohorts retain effective reserve Wh limits even at the same reserve fraction', () => {
  const ranked = paretoOptions([rankedState(base), rankedState({ ...structuredClone(base), mission: { ...base.mission, batteryWh: base.mission.batteryWh * 2 } })]);
  assert.notEqual(ranked[0].cohort, ranked[1].cohort);
  assert.ok(ranked.every(r => r.rank === 'non-dominated'));
});

test('disabled reserve requirement still keeps the reserve objective definition fixed', () => {
  const rows = [0, .95].map(reserveSoc => rankedState({ ...structuredClone(base), requirements: { ...base.requirements, requireReserve: false }, mission: { ...base.mission, reserveSoc } }));
  const ranked = paretoOptions(rows);
  assert.notEqual(ranked[0].cohort, ranked[1].cohort);
  assert.ok(ranked.every(r => r.rank === 'non-dominated'));
});

test('relaxing the embedded antenna elevation cutoff cannot improve ranking in the same cohort', () => {
  const rows = [0, 10].map(antennaMaskDeg => rankedState({ ...structuredClone(base), mission: { ...base.mission, antennaMaskDeg } }));
  const ranked = paretoOptions(rows);
  assert.notEqual(ranked[0].cohort, ranked[1].cohort);
  assert.ok(ranked.every(r => r.rank === 'non-dominated'));
});

test('required radio margin keeps its embedded demodulation threshold as well as the outer margin limit', () => {
  const hardware = { frequencyGHz: 8.4, rangeKm: 400000, txPowerW: 100, txGainDbi: 30, rxGainDbi: 74, lossDb: 4, noiseTempK: 100, dataRateBps: 1000 };
  const rows = [1, 10].map(requiredEbN0Db => rankedState({ ...structuredClone(base), requirements: { ...base.requirements, minAssumedRadioMarginDb: 0 }, radio: { ...hardware, requiredEbN0Db } }));
  const ranked = paretoOptions(rows);
  assert.ok(ranked.every(r => r.cohort !== null));
  assert.notEqual(ranked[0].cohort, ranked[1].cohort);
});

test('required constraint relation, units and effective limits participate independently of outcome', () => {
  const original = rankedState(base);
  for (const change of [{ relation: 'max' as const }, { unit: 'fraction' }, { limit: 500 }]) {
    const changed = structuredClone(original);
    Object.assign(changed.assessment!.constraints.find(c => c.id === 'reserve')!, change);
    assert.notEqual(paretoOptions([original, changed])[0].cohort, paretoOptions([original, changed])[1].cohort);
  }
});

// Explicit synthetic analytical inputs, independent of any measured site or vehicle qualification.
const analyticalInputs: EngineeringInputs = {
  footprint: { sourceSpacingM: .05, requiredSpacingM: .1, coveredFraction: 1, measuredSlopeDeg: 5, maxSlopeDeg: 10, roughnessM: .05, maxRoughnessM: .2, hazardFraction: .01, maxHazardFraction: .05 },
  touchdown: { massKg: 1000, verticalSpeedMps: 2, horizontalSpeedMps: .5, stoppingDistanceM: 1, maxDecelerationMps2: 4, halfSupportWidthM: 2, centerOfMassHeightM: 1, slopeDeg: 5, gravityMps2: 1.62 },
  trajectory: { wetMassKg: 5000, dryMassKg: 2500, ispSeconds: 300, requiredDeltaVMps: 1000, radiusM: 1737400, muM3s2: 4.9028e12, initialAltitudeM: 100000, targetAltitudeM: 200000 },
  'ground-support': { requiredContactHours: 1.5, availableOverlapHours: 4, requiredDataMbit: 1000, linkRateMbps: 1, sharedCapacityFraction: .5 },
  thermal: { projectedAreaM2: 1, radiatingAreaM2: 2, absorptivity: .2, emissivity: .8, solarFluxWm2: 0, solarIncidenceFactor: 1, albedoFluxWm2: 0, infraredFluxWm2: 0, planetViewFactor: 0, internalPowerW: 734.8805247512, environmentTempK: 0, minTempK: 290, maxTempK: 310, heaterCapacityW: 0 },
  plume: { halfAngleDeg: 30, empiricalRangeM: 100, assetAxialDistanceM: 50, assetLateralDistanceM: 100, radialClearanceM: 5 },
  traverse: { outboundDistanceKm: 2, returnDistanceKm: 2, speedKph: 2, driveWhPerKm: 100, auxLoadW: 50, usableEnergyWh: 1000, reserveFraction: .2, availableHours: 3 },
};
for (const [domain, field] of Object.entries({ footprint: 'maxSlopeDeg', touchdown: 'maxDecelerationMps2', trajectory: 'requiredDeltaVMps', 'ground-support': 'requiredContactHours', thermal: 'maxTempK', plume: 'radialClearanceM', traverse: 'reserveFraction' })) {
  test(`required ${domain} analytical screen retains its embedded ${field} limit in the cohort`, () => {
    const id = domain as EngineeringDomain;
    const rows = [1, 1.01].map(factor => {
      const state = structuredClone(base), externalId = ENGINEERING_EXTERNAL_IDS[id];
      state.requirements.requiredExternal = [externalId];
      state.engineeringInputs = { [id]: { ...analyticalInputs[id], [field]: analyticalInputs[id]![field] * factor } };
      state.engineeringEvidence = { [id]: { source: 'Synthetic review fixture', author: 'Test', scopeKey: engineeringScopeKey(state, m.datasetId) } };
      state.externalAssessments = [{ id: externalId as NonNullable<ScenarioState['externalAssessments']>[number]['id'], status: 'reported-pass', source: 'Synthetic review fixture', author: 'Test', notes: 'Not qualified evidence', scenarioKey: evidenceScopeKey(state, m.datasetId) }];
      return rankedState(state);
    });
    const ranked = paretoOptions(rows);
    assert.ok(ranked.every(r => r.cohort !== null));
    assert.ok(rows.every(r => r.assessment!.constraints.find(c => c.id === `engineering:${id}`)!.state === 'conditional'));
    assert.notEqual(ranked[0].cohort, ranked[1].cohort);
    assert.ok(ranked.every(r => r.rank === 'non-dominated'));
  });
}
