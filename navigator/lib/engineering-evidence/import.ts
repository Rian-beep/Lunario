import { DSN_STATIONS } from '../dsn';
import { EVIDENCE_LIMITS, type CommunicationsEnvelope, type Provenance, type Span, type Supplied } from './types';
export function object(v: unknown): Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v))
    throw Error('Expected an evidence object'); return v as Record<string, unknown>; }
export function text(v: unknown, max = 4000): string { if (typeof v !== 'string' || !v.trim() || v.length > max)
    throw Error('Missing or oversized evidence text'); return v; }
export function number(v: unknown, min: number, max: number): number { if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max)
    throw Error(`Expected finite value in [${min}, ${max}]`); return v; }
export function utc(v: unknown): string { const s = text(v, 40); if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(s) || !Number.isFinite(Date.parse(s)) || new Date(s).toISOString().replace('.000Z', 'Z') !== s.replace('.000Z', 'Z'))
    throw Error('Expected exact UTC timestamp'); return s; }
export function list<T>(v: unknown, max: number, parse: (x: unknown) => T): T[] { if (!Array.isArray(v) || v.length > max)
    throw Error('Evidence list exceeds bounded size'); return v.map(parse); }
function choice<T extends string>(v: unknown, options: readonly T[]): T { if (!options.includes(v as T))
    throw Error('Unsupported evidence choice'); return v as T; }
export function span(v: unknown): Span { const x = object(v), startUtc = utc(x.startUtc), endUtc = utc(x.endUtc); if (Date.parse(endUtc) <= Date.parse(startUtc) || Date.parse(endUtc) - Date.parse(startUtc) > 31 * 86400000)
    throw Error('Invalid or oversized UTC interval'); return { startUtc, endUtc }; }
export function ordered<T extends Span>(v: T[]): T[] { for (let i = 1; i < v.length; i++)
    if (Date.parse(v[i].startUtc) < Date.parse(v[i - 1].endUtc))
        throw Error('Evidence intervals must be sorted and non-overlapping'); return v; }
export function provenance(v: unknown): Provenance { const p = object(v); return { title: text(p.title, 300), sourceUrl: text(p.sourceUrl, 2000), author: text(p.author, 300), issuedUtc: utc(p.issuedUtc), kind: choice(p.kind, ['reference', 'user-assumption', 'observation', 'forecast']), notes: text(p.notes) }; }
function supplied<T>(v: unknown, parse: (x: unknown) => T): Supplied<T> | null { if (v === null)
    return null; const s = object(v); return { provenance: provenance(s.provenance), value: parse(s.value) }; }
const band = (v: unknown) => choice(v, ['S', 'X', 'Ka', 'other']);
export function parseEnvelope(input: string | unknown): CommunicationsEnvelope {
    if (typeof input === 'string' && new TextEncoder().encode(input).length > EVIDENCE_LIMITS.bytes)
        throw Error('Evidence file exceeds 2 MB');
    const v = object(typeof input === 'string' ? JSON.parse(input) : input);
    if (JSON.stringify(v).length > EVIDENCE_LIMITS.bytes)
        throw Error('Evidence object exceeds limit');
    if (v.schema !== 'solarreach-station-evidence-1')
        throw Error('Unsupported station evidence schema');
    const stationId = choice(v.stationId, DSN_STATIONS.map(s => s.id));
    const geometry = v.geometry === null ? null : (() => { const g = object(v.geometry); if (g.stationId !== stationId || g.target !== 'Moon center' || g.frame !== 'ITRF93 / airless apparent AZ-EL')
        throw Error('Geometry station, target or frame mismatch'); const samples = list(g.samples, 745, x => { const s = object(x); return { utc: utc(s.utc), azimuthDeg: number(s.azimuthDeg, 0, 360), elevationDeg: number(s.elevationDeg, -90, 90), rangeKm: number(s.rangeKm, 300000, 500000) }; }); if (samples.length < 2)
        throw Error('Geometry needs two endpoints'); for (let i = 1; i < samples.length; i++)
        if (Date.parse(samples[i].utc) - Date.parse(samples[i - 1].utc) !== 3600000)
            throw Error('Geometry must be continuous hourly samples'); return { stationId, target: 'Moon center' as const, frame: 'ITRF93 / airless apparent AZ-EL' as const, requestUrl: text(g.requestUrl, 8000), fetchedUtc: utc(g.fetchedUtc), rawResponse: text(g.rawResponse, 1500000), samples }; })();
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
