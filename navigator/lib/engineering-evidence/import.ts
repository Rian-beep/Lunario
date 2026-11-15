import { DSN_STATIONS } from '../dsn';
import { EVIDENCE_LIMITS, type CommunicationsEnvelope, type Supplied } from './types';
import { object, text, number, utc, list, choice, span, ordered, provenance } from './validation';
export { object, text, number, utc, list, span, ordered, provenance } from './validation';
import { parseHorizonsResponse, validateHorizonsRequestUrl } from './horizons';
function supplied<T>(v: unknown, parse: (x: unknown) => T): Supplied<T> | null { if (v === null)
    return null; const s = object(v); return { provenance: provenance(s.provenance), value: parse(s.value) }; }
const band = (v: unknown) => choice(v, ['S', 'X', 'Ka', 'other']);
export function parseEnvelope(input: string | unknown): CommunicationsEnvelope {
    if (typeof input === 'string' && new TextEncoder().encode(input).length > EVIDENCE_LIMITS.bytes)
        throw Error('Evidence file exceeds 2 MB');
    const v = object(typeof input === 'string' ? JSON.parse(input) : input);
    if (new TextEncoder().encode(JSON.stringify(v)).length > EVIDENCE_LIMITS.bytes)
        throw Error('Evidence object exceeds limit');
    if (v.schema !== 'solarreach-station-evidence-1')
        throw Error('Unsupported station evidence schema');
    const stationId = choice(v.stationId, DSN_STATIONS.map(s => s.id));
    const geometry = v.geometry === null ? null : (() => { const g = object(v.geometry); if (g.stationId !== stationId || g.target !== 'Moon center' || g.frame !== 'ITRF93 / airless apparent AZ-EL')
        throw Error('Geometry station, target or frame mismatch'); const samples = list(g.samples, 745, x => { const s = object(x); return { utc: utc(s.utc), azimuthDeg: number(s.azimuthDeg, 0, 360), elevationDeg: number(s.elevationDeg, -90, 90), rangeKm: number(s.rangeKm, 300000, 500000) }; }); if (samples.length < 2)
        throw Error('Geometry needs two endpoints'); for (let i = 1; i < samples.length; i++)
        if (Date.parse(samples[i].utc) - Date.parse(samples[i - 1].utc) !== 3600000)
            throw Error('Geometry must be continuous hourly samples'); return { stationId, target: 'Moon center' as const, frame: 'ITRF93 / airless apparent AZ-EL' as const, requestUrl: text(g.requestUrl, 8000), fetchedUtc: utc(g.fetchedUtc), rawResponse: text(g.rawResponse, 1500000), samples }; })();
    if (geometry) {
        const request = { stationId, startUtc: geometry.samples[0].utc, endUtc: geometry.samples.at(-1)!.utc };
        validateHorizonsRequestUrl(geometry.requestUrl, request);
        const parsed = parseHorizonsResponse({ result: geometry.rawResponse }, request, geometry.fetchedUtc);
        if (JSON.stringify(parsed.samples) !== JSON.stringify(geometry.samples))
            throw Error('Imported geometry differs from archived Horizons response');
    }
    const stationHorizon = supplied(v.stationHorizon, x => { const h = object(x); const profile = list(h.profile, 361, x => { const p = object(x); return { azimuthDeg: number(p.azimuthDeg, 0, 360), elevationDeg: number(p.elevationDeg, -90, 90) }; }); if (profile.length === 1)
        throw Error('Profile requires at least two points or explicit constant cutoff'); if (profile.length && (profile[0].azimuthDeg !== 0 || profile.at(-1)!.azimuthDeg !== 360 || profile[0].elevationDeg !== profile.at(-1)!.elevationDeg))
        throw Error('Horizon must close at 0 and 360 degrees'); for (let i = 1; i < profile.length; i++)
        if (profile[i].azimuthDeg <= profile[i - 1].azimuthDeg)
            throw Error('Horizon azimuths must increase'); return { minimumElevationDeg: number(h.minimumElevationDeg, -90, 90), profile }; });
    const lunarMask = supplied(v.lunarMask, x => ordered(list(x, 1000, x => { const m = object(x); if (m.visible !== null && typeof m.visible !== 'boolean')
        throw Error('Invalid lunar visibility'); return { ...span(m), visible: m.visible as boolean | null, antennaHeightM: number(m.antennaHeightM, 0, 10000), minimumElevationDeg: number(m.minimumElevationDeg, -90, 90), target: choice(m.target, ['station', 'Earth-center proxy']) }; })));
    const hardware = supplied(v.hardware, x => { const h = object(x); return { band: band(h.band), frequencyGHz: number(h.frequencyGHz, .1, 100), txPowerW: number(h.txPowerW, 1e-9, 1e9), txGainDbi: number(h.txGainDbi, -100, 100), rxVacuumGainDbi: number(h.rxVacuumGainDbi, -100, 100), systemNoiseK: number(h.systemNoiseK, .01, 1e9), pointingLossDb: number(h.pointingLossDb, 0, 200), otherLossDb: number(h.otherLossDb, 0, 200), requiredEbN0Db: number(h.requiredEbN0Db, -50, 100), implementationLossDb: number(h.implementationLossDb, 0, 100), rateBps: number(h.rateBps, 1e-9, 1e12) }; });
    const weather = supplied(v.weather, x => ordered(list(x, 1000, x => { const w = object(x); return { ...span(w), band: band(w.band), frequencyGHz: number(w.frequencyGHz, .1, 100), attenuationDb: number(w.attenuationDb, 0, 200) }; })));
    const allocations = supplied(v.allocations, x => ordered(list(x, 1000, x => { const a = object(x); return { ...span(a), rateLimitBps: number(a.rateLimitBps, 0, 1e12) }; })));
    const r = object(v.requirements), critical = list(r.critical, 100, x => { const c = object(x); return { ...span(c), id: text(c.id, 120), minimumBits: number(c.minimumBits, 0, 1e18), minimumContactSeconds: number(c.minimumContactSeconds, 0, 31 * 86400) }; });
    if (new Set(critical.map(c => c.id)).size !== critical.length)
        throw Error('Critical contact IDs must be unique');
    return { schema: 'solarreach-station-evidence-1', scenarioKey: text(v.scenarioKey, 300), stationId, exportedUtc: utc(v.exportedUtc), geometry, stationHorizon, lunarMask, hardware, weather, allocations, requirements: { minimumBits: r.minimumBits === null ? null : number(r.minimumBits, 0, 1e18), critical } };
}
export function exportEnvelope(value: CommunicationsEnvelope): string { return JSON.stringify(parseEnvelope(value), null, 2); }
