import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DSN_STATIONS } from '../lib/dsn';
import { parseEnvelope, exportEnvelope } from '../lib/engineering-evidence/import';
import { parseHorizonsResponse, horizonsUrl, fetchStationGeometry, StationGeometryLoader, type GeometryRequest, type ProviderState } from '../lib/engineering-evidence/horizons';
import { evaluateCommunications, stationCutoff, diskStationCutoff } from '../lib/engineering-evidence/communications';
import { slantAttenuationDb, atmosphericNoiseK } from '../lib/engineering-evidence/atmosphere';
import { emptyEnvelope, lunarProxy, scenarioStay } from '../lib/engineering-evidence/workspace';
import { evaluateDeclaredBounds, parseUncertainty, type UncertaintyEnvelope } from '../lib/engineering-evidence/uncertainty';
import type { CommunicationsEnvelope, Provenance, Supplied } from '../lib/engineering-evidence/types';
import { decodeCatalog } from '../lib/catalog';
import { evaluateScenario } from '../lib/assessment';
import { DEFAULT_MISSION } from '../lib/mission';
import { DEFAULT_FLIGHT } from '../lib/flight';
import { DEFAULT_OPERATIONS, DEFAULT_REQUIREMENTS, type EvidenceManifest } from '../lib/planning-types';
import type { ScenarioState } from '../lib/scenario';
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const fixture = read('public/data/engineering-evidence/goldstone-horizons.json') as {
    request: GeometryRequest;
    response: {
        result: string;
    };
};
const fetched = '2026-11-14T20:00:00Z';
const p: Provenance = { title: 'Synthetic test assumption', sourceUrl: 'user:test', author: 'regression', issuedUtc: '2026-11-13T00:00:00Z', kind: 'user-assumption', notes: 'Explicit synthetic assumptions, no actual station allocation or hardware qualification' };
const supplied = <T>(value: T): Supplied<T> => ({ value, provenance: { ...p } });
const stay = { startUtc: '2026-11-14T00:00:00Z', endUtc: '2026-11-14T01:00:00Z' };
function chain(): CommunicationsEnvelope { return { ...emptyEnvelope('test-case'), geometry: parseHorizonsResponse(fixture.response, fixture.request, fetched), stationHorizon: supplied({ minimumElevationDeg: 10, profile: [] }), lunarMask: supplied([{ ...stay, visible: true, antennaHeightM: 2, minimumElevationDeg: 0, target: 'Earth-center proxy' }]), hardware: supplied({ band: 'X', frequencyGHz: 8.4, txPowerW: 100, txGainDbi: 30, rxVacuumGainDbi: 74, systemNoiseK: 100, pointingLossDb: 1, otherLossDb: 2, implementationLossDb: 1, requiredEbN0Db: 5, rateBps: 1000 }), weather: supplied([{ ...stay, attenuationDb: 1, band: 'X', frequencyGHz: 8.4 }]), allocations: supplied([{ ...stay, rateLimitBps: 500 }]), requirements: { minimumBits: 1800000, critical: [{ ...stay, id: 'command', minimumBits: 1800000, minimumContactSeconds: 3600 }] } }; }
const assess = (e: CommunicationsEnvelope, span = stay) => evaluateCommunications(e, 'test-case', span, '2026-11-16T00:00:00Z');
test('all three fresh Horizons observer fixtures agree with independently generated CSPICE reference', () => {
    const independent = read('public/data/engineering-evidence/spice-reference.json') as {
        samples: Array<{
            stationId: string;
            utc: string;
            azimuthDeg: number;
            elevationDeg: number;
            rangeKm: number;
        }>;
    };
    let count = 0;
    for (const station of DSN_STATIONS) {
        const f = read(`public/data/engineering-evidence/${station.id}-horizons.json`);
        const g = parseHorizonsResponse(f.response, f.request, fetched);
        for (const sample of g.samples) {
            const r = independent.samples.find(r => r.stationId === station.id && Date.parse(r.utc) === Date.parse(sample.utc));
            assert.ok(r);
            assert.ok(Math.abs((sample.azimuthDeg - r.azimuthDeg + 540) % 360 - 180) < .002);
            assert.ok(Math.abs(sample.elevationDeg - r.elevationDeg) < .002);
            assert.ok(Math.abs(sample.rangeKm - r.rangeKm) < .1);
            count++;
        }
    }
    assert.equal(count, 75);
});
test('JPL 105E independent published attenuation and atmospheric-noise example', () => { const f = read('public/data/engineering-evidence/jpl-105-example.json'); const slant = slantAttenuationDb(f.inputs.zenithAttenuationDb, f.inputs.elevationDeg); assert.ok(Math.abs(slant - f.printedResults.slantAttenuationDb) < .0005); assert.ok(Math.abs(atmosphericNoiseK(slant, f.inputs.meanRadiatingK) - f.printedResults.atmosphereNoiseK) < .06); assert.throws(() => slantAttenuationDb(.384, 0)); assert.throws(() => slantAttenuationDb(-1, 20)); });
test('request pins actual station, UTC, airless, km and bounded observer settings', () => { const url = new URL(horizonsUrl(fixture.request)); assert.equal(url.searchParams.get('CENTER'), "'coord@399'"); assert.equal(url.searchParams.get('TIME_TYPE'), "'UT'"); assert.equal(url.searchParams.get('APPARENT'), "'AIRLESS'"); assert.equal(url.searchParams.get('RANGE_UNITS'), "'KM'"); assert.ok(url.searchParams.get('SITE_COORD')?.includes(String(DSN_STATIONS[0].latitudeDeg))); assert.throws(() => horizonsUrl({ ...fixture.request, endUtc: '2027-01-01T00:00:00Z' })); assert.throws(() => horizonsUrl({ ...fixture.request, startUtc: '2026-11-14T00:30:00Z' })); });
test('parser rejects wrong station, missing epochs, wrong frame, units and target, provider errors', () => { for (const [from, to] of [['ITRF93', 'J2000'], ['Moon (301)', 'Mars (499)'], ['Units: KM and KM/S', 'Units: AU and AU/D'], ['243.1104618,35.4259009,1.00139', '244.1104618,35.4259009,1.00139'], ['$$EOE', 'no endpoint']])
    assert.throws(() => parseHorizonsResponse({ result: fixture.response.result.replace(from, to) }, fixture.request, fetched)); assert.throws(() => parseHorizonsResponse({ error: 'invalid epoch' }, fixture.request, fetched), /invalid epoch/); assert.throws(() => parseHorizonsResponse({ result: fixture.response.result.replace(/^2461358\.541666667.*\n/m, '') }, fixture.request, fetched), /every requested/); });
test('bounded strict offline envelope round trip preserves sources and nulls; strips unrecognized authority', () => { const e = chain(); assert.deepEqual(parseEnvelope(exportEnvelope(e)), parseEnvelope(e)); const malicious = { ...e, approved: true }; assert.equal('approved' in parseEnvelope(malicious), false); assert.equal(parseEnvelope(emptyEnvelope('x')).weather, null); assert.throws(() => parseEnvelope(' '.repeat(2000001))); assert.throws(() => parseEnvelope({ ...e, requirements: { minimumBits: Infinity, critical: [] } })); assert.throws(() => parseEnvelope({ ...e, exportedUtc: '2026-02-31T00:00:00Z' })); assert.throws(() => parseEnvelope({ ...e, stationHorizon: supplied({ minimumElevationDeg: 0, profile: [{ azimuthDeg: 0, elevationDeg: 1 }, { azimuthDeg: 360, elevationDeg: 2 }] }) })); });
test('non-overlapping dated inputs are mandatory; horizon interpolation closes azimuth seam', () => { const e = chain(); e.allocations!.value.push({ ...stay, rateLimitBps: 20 }); assert.throws(() => parseEnvelope(e), /non-overlapping/); assert.equal(stationCutoff({ minimumElevationDeg: 5, profile: [{ azimuthDeg: 0, elevationDeg: 0 }, { azimuthDeg: 180, elevationDeg: 20 }, { azimuthDeg: 360, elevationDeg: 0 }] }, 90), 10); assert.equal(stationCutoff({ minimumElevationDeg: 5, profile: [] }, 190), 5); });
test('full chain computes rate-limited delivered data and critical contact equality conditionally', () => { const r = assess(chain()); assert.equal(r.status, 'conditional-meets'); assert.equal(r.deliveredBits, 1800000); assert.equal(r.contactSeconds, 3600); assert.equal(r.critical[0].status, 'conditional-meets'); assert.ok(r.slices[0].marginDb! > 0); assert.equal(r.operationalApproval, false); });
for (const key of ['geometry', 'stationHorizon', 'lunarMask', 'hardware', 'weather', 'allocations'] as const)
    test(`missing ${key} prevents full adequacy even for zero requested bits`, () => { const e = chain(); e[key] = null; e.requirements.minimumBits = 0; const r = assess(e); assert.equal(r.status, 'incomplete'); assert.equal(r.deliveredBits, null); assert.equal(r.critical[0].status, 'incomplete'); });
test('missing delivered-data requirement stays unconfigured rather than a zero-bit success', () => { const e = chain(); e.requirements.minimumBits = null; assert.equal(assess(e).status, 'incomplete'); assert.ok(assess(e).reasons.some(r => r.includes('not configured'))); });
test('a missing geometry hour is unknown and never extrapolated from final endpoint', () => { const e = chain(); const span = { startUtc: '2026-11-15T00:00:00Z', endUtc: '2026-11-15T01:00:00Z' }; assert.equal(assess(e, span).deliveredBits, null); });
test('source bytes must reproduce imported computed geometry; wrong station is rejected', () => { const e = chain(); e.geometry!.samples[0].elevationDeg = 80; assert.throws(() => assess(e), /differs from archived/); const b = chain(); b.stationId = 'madrid'; assert.throws(() => parseEnvelope(b), /mismatch/); });
test('high cutoff, lunar obstruction, negative RF margin and zero allocation each yield known zero', () => { for (const mutate of [(e: CommunicationsEnvelope) => { e.stationHorizon!.value.minimumElevationDeg = 30; }, (e: CommunicationsEnvelope) => { e.lunarMask!.value[0].visible = false; }, (e: CommunicationsEnvelope) => { e.hardware!.value.otherLossDb = 200; }, (e: CommunicationsEnvelope) => { e.allocations!.value[0].rateLimitBps = 0; }]) {
    const e = chain();
    mutate(e);
    const r = assess(e);
    assert.equal(r.deliveredBits, 0);
    assert.equal(r.status, 'conditional-shortfall');
} });
test('station full-disk clearance avoids promoting center just above a cutoff to useful contact', () => { const e = chain(); e.stationHorizon!.value.minimumElevationDeg = e.geometry!.samples[0].elevationDeg - .01; assert.equal(assess(e).deliveredBits, 0); });
test('partial allocation clips time precisely while absent remainder stays unknown', () => { const e = chain(); e.allocations!.value[0].endUtc = '2026-11-14T00:30:00Z'; const r = assess(e); assert.equal(r.deliveredBits, null); assert.equal(r.knownDeliveredBits, 900000); assert.equal(r.slices.length, 2); });
test('different dated allocation rates and critical subwindows integrate exact seconds', () => { const e = chain(); e.allocations!.value = [{ ...stay, endUtc: '2026-11-14T00:30:00Z', rateLimitBps: 100 }, { startUtc: '2026-11-14T00:30:00Z', endUtc: stay.endUtc, rateLimitBps: 200 }]; e.requirements = { minimumBits: 540000, critical: [{ ...stay, startUtc: '2026-11-14T00:45:00Z', id: 'late', minimumBits: 180000, minimumContactSeconds: 900 }] }; const r = assess(e); assert.equal(r.deliveredBits, 540000); assert.equal(r.critical[0].bits, 180000); assert.equal(r.critical[0].seconds, 900); assert.equal(r.status, 'conditional-meets'); });
test('critical contact outside run, or unknown lunar sample, prevents adequacy', () => { const e = chain(); e.requirements.critical[0].endUtc = '2026-11-14T02:00:00Z'; assert.equal(assess(e).status, 'incomplete'); const b = chain(); b.lunarMask!.value[0].visible = null; assert.equal(assess(b).status, 'incomplete'); });
test('stale evidence never grants capacity; dated future ephemeris is identified without inventing forecast', () => { const e = chain(); const r = evaluateCommunications(e, 'changed', stay, '2026-11-13T00:00:00Z'); assert.equal(r.status, 'incomplete'); assert.equal(r.futureGeometry, true); assert.ok(r.reasons.some(s => s.includes('stale'))); });
test('observed weather cannot become a later forecast; wrong band/frequency and future issue date stay unknown', () => { const e = chain(); e.weather!.provenance.kind = 'observation'; assert.equal(assess(e).status, 'incomplete'); const b = chain(); b.weather!.value[0].frequencyGHz = 32; assert.equal(assess(b).status, 'incomplete'); const c = chain(); c.weather!.provenance.issuedUtc = '2027-01-01T00:00:00Z'; assert.equal(assess(c).status, 'incomplete'); const d = chain(); d.weather!.provenance.kind = 'forecast'; assert.equal(assess(d).status, 'conditional-meets'); });
test('Earth-center lunar proxy must be an explicit assumption even if imported as reference', () => { const e = chain(); e.lunarMask!.provenance.kind = 'reference'; assert.equal(assess(e).status, 'incomplete'); });
test('provider handles real response contract, HTTP errors, offline errors and aborted requests', async () => { const controller = new AbortController(); const success = (async () => new Response(JSON.stringify(fixture.response))) as typeof fetch; assert.equal((await fetchStationGeometry(fixture.request, controller.signal, success)).samples.length, 25); await assert.rejects(fetchStationGeometry(fixture.request, controller.signal, (async () => new Response('', { status: 503 })) as typeof fetch), /HTTP 503/); await assert.rejects(fetchStationGeometry(fixture.request, controller.signal, (async () => { throw new TypeError('offline'); }) as typeof fetch), /offline/); controller.abort(); await assert.rejects(fetchStationGeometry(fixture.request, controller.signal, success), { name: 'AbortError' }); });
test('loader suppresses obsolete success/error after replacement and cancellation', async () => { const loader = new StationGeometryLoader(); const states: ProviderState[] = []; let resolve: (r: Response) => void = () => { throw Error('resolver unset'); }; const delayed = (async () => new Promise<Response>(r => { resolve = r; })) as typeof fetch; const old = loader.load(fixture.request, s => states.push(s), delayed); await loader.load(fixture.request, s => states.push(s), (async () => new Response(JSON.stringify(fixture.response))) as typeof fetch); resolve(new Response(JSON.stringify(fixture.response))); await old; assert.deepEqual(states.map(s => s.status), ['loading', 'loading', 'success']); const cancelled: ProviderState[] = []; const pending = loader.load(fixture.request, s => cancelled.push(s), delayed); loader.cancel(); resolve(new Response(JSON.stringify(fixture.response))); await pending; assert.deepEqual(cancelled.map(s => s.status), ['loading']); });
const catalog = decodeCatalog(read('public/data/catalog.json'));
const manifest = read('public/data/evidence-manifest.json') as EvidenceManifest;
function scenario(): ScenarioState { return { schemaVersion: 2, siteId: catalog.sites[0].id, custom: null, startIndex: 0, endIndex: 3, heightM: 2, arrayHeightM: 2, antennaHeightM: 2, mission: { ...DEFAULT_MISSION, loadW: 100, batteryWh: 1000 }, flight: { ...DEFAULT_FLIGHT }, requirements: structuredClone(DEFAULT_REQUIREMENTS), operations: structuredClone(DEFAULT_OPERATIONS) }; }
function declared(s: ScenarioState): UncertaintyEnvelope { return { schema: 'solarreach-declared-bounds-1', scenarioKey: evaluateScenario(catalog, s, manifest).scenarioKey, bounds: [{ field: 'loadW', lower: 0, upper: 200, provenance: p }] }; }
test('finite bounds use actual shared assessments and preserve requirements, operations, baseline and provenance', async () => { const s = scenario(), before = structuredClone(s), e = declared(s); const result = await evaluateDeclaredBounds(catalog, manifest, s, e); assert.equal(result.cases.length, 3); assert.deepEqual(s, before); assert.deepEqual(result.heldRequirements, s.requirements); assert.deepEqual(result.heldOperations, s.operations); assert.deepEqual(result.declaredBounds, e.bounds); assert.equal(new Set(result.cases.map(c => c.id)).size, 3); for (const c of result.cases) {
    const a = evaluateScenario(catalog, { ...s, mission: { ...s.mission, ...c.values } }, manifest);
    assert.equal(c.scenarioKey, a.scenarioKey);
    assert.equal(c.minimumBatteryWh, a.mission.minBatteryWh);
    assert.equal(c.outcome, a.outcome);
} assert.match(result.interpretation, /no probability/); assert.ok(result.unquantified.some(s => s.includes('Terrain'))); });
test('finite bounds reject stale binding, invalid physical corners, duplicate/more than three fields and absent provenance', async () => { const s = scenario(), e = declared(s); await assert.rejects(evaluateDeclaredBounds(catalog, manifest, s, { ...e, scenarioKey: 'stale' }), /stale/); await assert.rejects(evaluateDeclaredBounds(catalog, manifest, s, { ...e, bounds: [{ field: 'efficiency', lower: 0, upper: 2, provenance: p }] }), /canonical/); assert.throws(() => parseUncertainty({ ...e, bounds: [...e.bounds, ...e.bounds] }), /Duplicate/); assert.throws(() => parseUncertainty({ ...e, bounds: Array(4).fill(e.bounds[0]) }), /bounded/); assert.throws(() => parseUncertainty({ ...e, bounds: [{ field: 'loadW', lower: 0, upper: 2 }] })); await assert.rejects(evaluateDeclaredBounds(catalog, manifest, s, { ...e, bounds: [] }), /unquantified/); });
test('finite cases are cancellable with progress and no partial result published', async () => { const s = scenario(), controller = new AbortController(); let count = 0; await assert.rejects(evaluateDeclaredBounds(catalog, manifest, s, declared(s), { signal: controller.signal, onProgress: done => { count = done; controller.abort(); } }), { name: 'AbortError' }); assert.equal(count, 1); });
test('27-case bound product has distinct identities and degeneracy does not duplicate cases', async () => { const s = scenario(), e = declared(s); e.bounds.push({ field: 'areaM2', lower: 3, upper: 5, provenance: p }, { field: 'batteryWh', lower: 500, upper: 1500, provenance: p }); const r = await evaluateDeclaredBounds(catalog, manifest, s, e); assert.equal(r.cases.length, 27); assert.equal(new Set(r.cases.map(c => c.id)).size, 27); e.bounds = [{ field: 'loadW', lower: 100, upper: 100, provenance: p }]; assert.equal((await evaluateDeclaredBounds(catalog, manifest, s, e)).cases.length, 1); });
test('lunar proxy reuses antenna timeline, mask and unknowns at exact interval times', () => { const s = scenario(), a = evaluateScenario(catalog, s, manifest), mask = lunarProxy(catalog, s, a, p); assert.equal(mask.value[0].visible, a.mission.timeline[0].contact); assert.equal(mask.value[0].antennaHeightM, s.antennaHeightM); assert.equal(mask.value[0].minimumElevationDeg, s.mission.antennaMaskDeg); assert.equal(mask.value[0].target, 'Earth-center proxy'); assert.equal(mask.value[0].startUtc, scenarioStay(catalog, s).startUtc); assert.equal(mask.value.at(-1)!.endUtc, scenarioStay(catalog, s).endUtc); });
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EngineeringEvidenceWorkspace } from '../components/engineering/evidence-workspace';
Object.assign(globalThis, { React });
test('workspace renders exact integration props, native equations and an honest empty offline state without fetching', () => { const s = scenario(), assessment = evaluateScenario(catalog, s, manifest); const html = renderToStaticMarkup(createElement(EngineeringEvidenceWorkspace, { catalog, manifest, state: s, assessment, onInspect() { }, onClose() { } })); assert.match(html, /Engineering evidence workspace/); assert.match(html, /Incomplete evidence/); assert.match(html, /Delivered data: unknown/); assert.match(html, /No station geometry imported/); assert.match(html, /Unquantified/); assert.match(html, /<math/); assert.match(html, /Close engineering/); assert.match(html, /Ground station/); assert.doesNotMatch(html, /operationally approved|qualified uncertainty interval/); });
test('streamed provider size limit and in-flight abort terminate with explicit errors', async () => { const c = new AbortController(); await assert.rejects(fetchStationGeometry(fixture.request, c.signal, (async () => new Response('x'.repeat(2000001))) as typeof fetch), /exceeds 2 MB/); const controller = new AbortController(); const waits = (async (_url: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => { init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason), { once: true }); })) as typeof fetch; const pending = fetchStationGeometry(fixture.request, controller.signal, waits); controller.abort(); await assert.rejects(pending, { name: 'AbortError' }); });
test('provider timeout aborts the actual HTTP signal and exposes its reason', async (context) => { context.mock.timers.enable({ apis: ['setTimeout'] }); const waits = (async (_url: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => { init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason), { once: true }); })) as typeof fetch; const pending = fetchStationGeometry(fixture.request, new AbortController().signal, waits); context.mock.timers.tick(45000); await assert.rejects(pending, /timed out after 45 seconds/); });

test('full-disk station skyline includes a narrow adjacent ridge and wraps through north', () => {
    const e=chain();
    e.stationHorizon!.value={minimumElevationDeg:0,profile:[{azimuthDeg:0,elevationDeg:0},{azimuthDeg:191.4,elevationDeg:0},{azimuthDeg:191.45,elevationDeg:50},{azimuthDeg:191.5,elevationDeg:0},{azimuthDeg:360,elevationDeg:0}]};
    assert.equal(stationCutoff(e.stationHorizon!.value,e.geometry!.samples[0].azimuthDeg),0);
    assert.equal(assess(e).deliveredBits,0);
    const h={minimumElevationDeg:0,profile:[{azimuthDeg:0,elevationDeg:30},{azimuthDeg:1,elevationDeg:0},{azimuthDeg:359,elevationDeg:0},{azimuthDeg:360,elevationDeg:30}]};
    assert.equal(diskStationCutoff(h,359.9,0,.25),30);
    assert.equal(diskStationCutoff(h,180,89.9,.25),30);
});
test('negative supplied station cutoffs cannot make the Earth transparent',()=>{assert.equal(stationCutoff({minimumElevationDeg:-90,profile:[]},180),0);const e=chain();e.stationHorizon!.value.minimumElevationDeg=-90;const night={startUtc:'2026-11-14T12:00:00Z',endUtc:'2026-11-14T13:00:00Z'};e.lunarMask!.value[0]={...e.lunarMask!.value[0],...night};e.weather!.value[0]={...e.weather!.value[0],...night};e.allocations!.value[0]={...e.allocations!.value[0],...night};e.requirements.critical=[];assert.equal(assess(e,night).deliveredBits,0);});
