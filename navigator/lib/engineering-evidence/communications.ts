import { linkBudget } from '../mission';
import { parseEnvelope, utc, span as parseSpan } from './import';
import { horizonsSourceContext } from './horizons';
import type { CommunicationsEnvelope, Span } from './types';
export type ContactSlice = {
    startUtc: string;
    endUtc: string;
    stationElevationDeg: number | null;
    horizonDeg: number | null;
    lunarVisible: boolean | null;
    pathLossDb: number | null;
    receivedDbw: number | null;
    ebN0Db: number | null;
    weatherLossDb: number | null;
    allocatedRateBps: number | null;
    marginDb: number | null;
    rateBps: number | null;
    bits: number | null;
    contactSeconds: number | null;
    unknown: string[];
};
export type CommunicationsResult = {
    status: 'incomplete' | 'conditional-meets' | 'conditional-shortfall';
    reasons: string[];
    deliveredBits: number | null;
    knownDeliveredBits: number;
    contactSeconds: number | null;
    critical: Array<{
        id: string;
        status: 'incomplete' | 'conditional-meets' | 'conditional-shortfall';
        bits: number | null;
        seconds: number | null;
    }>;
    slices: ContactSlice[];
    scenarioKey: string;
    geometryAgeHours: number | null;
    futureGeometry: boolean;
    operationalApproval: false;
};
const ms = (s: string) => Date.parse(s);
function within<T extends Span>(rows: T[] | undefined, start: number, end: number) { return rows?.find(w => ms(w.startUtc) <= start && ms(w.endUtc) >= end); }
export function stationCutoff(h: NonNullable<CommunicationsEnvelope['stationHorizon']>['value'], az: number): number {
    let elevation = -90;
    for (let i = 1; i < h.profile.length; i++) {
        const a = h.profile[i - 1], b = h.profile[i];
        if (az >= a.azimuthDeg && az <= b.azimuthDeg) {
            elevation = a.elevationDeg + (b.elevationDeg - a.elevationDeg) * (az - a.azimuthDeg) / (b.azimuthDeg - a.azimuthDeg);
            break;
        }
    }
    return Math.max(0, h.minimumElevationDeg, elevation);
}
/** Maximum piecewise-linear station skyline over the lunar disk's azimuth footprint. */
export function diskStationCutoff(h: NonNullable<CommunicationsEnvelope['stationHorizon']>['value'], az: number, el: number, radiusDeg: number): number {
    const rad = Math.PI / 180;
    const halfWidth = Math.abs(el) + radiusDeg >= 90 ? 180 : Math.asin(Math.min(1, Math.sin(radiusDeg * rad) / Math.cos(el * rad))) / rad;
    const wrap = (a: number) => ((a % 360) + 360) % 360;
    const candidates = [stationCutoff(h, wrap(az - halfWidth)), stationCutoff(h, wrap(az + halfWidth)), h.minimumElevationDeg];
    for (const point of h.profile) {
        const delta = Math.abs((point.azimuthDeg - az + 540) % 360 - 180);
        if (delta <= halfWidth) candidates.push(point.elevationDeg);
    }
    return Math.max(0, ...candidates);
}
export function evaluateCommunications(input: CommunicationsEnvelope, scenarioKey: string, stay: Span, nowUtc = new Date().toISOString()): CommunicationsResult {
    parseSpan(stay);
    utc(nowUtc);
    const e = parseEnvelope(input), start = ms(stay.startUtc), end = ms(stay.endUtc);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 31 * 86400000)
        throw Error('Communications run must span at most 31 days');
    const reasons: string[] = [];
    if (e.requirements.minimumBits === null)
        reasons.push('Delivered-data requirement is not configured');
    if (e.scenarioKey !== scenarioKey)
        reasons.push('Evidence binding is stale for this scenario');
    const geometry = e.geometry;
    const source = geometry ? horizonsSourceContext(geometry.rawResponse) : null;
    const boundaries = new Set<number>([start, end]);
    for (const t of geometry?.samples ?? [])
        if (ms(t.utc) > start && ms(t.utc) < end)
            boundaries.add(ms(t.utc));
    for (const rows of [e.lunarMask?.value, e.weather?.value, e.allocations?.value, e.requirements.critical])
        for (const w of rows ?? [])
            for (const t of [ms(w.startUtc), ms(w.endUtc)])
                if (t > start && t < end)
                    boundaries.add(t);
    const times = [...boundaries].sort((a, b) => a - b), slices: ContactSlice[] = [];
    for (let i = 1; i < times.length; i++) {
        const a = times[i - 1], b = times[i], unknown: string[] = [];
        const index = geometry?.samples.findIndex((s, i, all) => i < all.length - 1 && ms(s.utc) <= a && ms(all[i + 1].utc) >= b) ?? -1;
        const g = index >= 0 ? geometry!.samples[index] : null;
        const lunar = within(e.lunarMask?.value, a, b), weather = within(e.weather?.value, a, b), allocation = within(e.allocations?.value, a, b), h = e.hardware?.value;
        if (e.scenarioKey !== scenarioKey)
            unknown.push('stale scenario binding');
        if (!g)
            unknown.push('station geometry coverage');
        if (geometry && ms(geometry.fetchedUtc) > ms(nowUtc))
            unknown.push('geometry retrieval date is in the future');
        const eop = source?.eopCoverage;
        if (geometry && !eop)
            unknown.push('Earth-orientation source coverage is unknown');
        if (eop && (a < ms(eop.dataStartUtc) || b > ms(eop.predictionEndUtc)))
            unknown.push('Earth-orientation source coverage does not span contact');
        for (const key of ['stationHorizon', 'lunarMask', 'hardware', 'allocations'] as const)
            if (e[key] && ms(e[key]!.provenance.issuedUtc) > ms(nowUtc))
                unknown.push(`${key} issue date is in the future`);
        if (!e.stationHorizon)
            unknown.push('station horizon/cutoff');
        if (!lunar || lunar.visible === null)
            unknown.push('lunar antenna mask coverage');
        if (lunar?.target === 'Earth-center proxy' && e.lunarMask?.provenance.kind !== 'user-assumption')
            unknown.push('Earth-center proxy requires explicit user assumption');
        if (!h)
            unknown.push('antenna/band/noise/pointing/rate');
        if (!weather)
            unknown.push('dated weather attenuation');
        if (weather && h && (weather.band !== h.band || weather.frequencyGHz !== h.frequencyGHz))
            unknown.push('weather band/frequency mismatch');
        if (weather && e.weather?.provenance.kind === 'observation' && b > ms(e.weather.provenance.issuedUtc))
            unknown.push('observed weather cannot forecast later contact');
        if (e.weather && ms(e.weather.provenance.issuedUtc) > ms(nowUtc))
            unknown.push('weather issue date is in the future');
        if (!allocation)
            unknown.push('dated allocation/rate coverage');
        const diskRadius = g ? Math.asin(1737.4 / g.rangeKm) * 180 / Math.PI : 0;
        const horizon = g && e.stationHorizon ? diskStationCutoff(e.stationHorizon.value, g.azimuthDeg, g.elevationDeg, diskRadius) : null;
        const budget = g && h && weather ? linkBudget({ frequencyGHz: h.frequencyGHz, rangeKm: g.rangeKm + 1737.4, txPowerW: h.txPowerW, txGainDbi: h.txGainDbi, rxGainDbi: h.rxVacuumGainDbi, lossDb: h.pointingLossDb + h.otherLossDb + h.implementationLossDb + weather.attenuationDb, noiseTempK: h.systemNoiseK, dataRateBps: h.rateBps, requiredEbN0Db: h.requiredEbN0Db }) : null;
        // Whole lunar disk above station cutoff; conservative centre range + lunar radius for downlink loss.
        const available = g && horizon !== null && lunar?.visible && budget && budget.marginDb >= 0 && g.elevationDeg - diskRadius > horizon;
        const rate = unknown.length ? null : available ? Math.min(h!.rateBps, allocation!.rateLimitBps) : 0;
        slices.push({ startUtc: new Date(a).toISOString(), endUtc: new Date(b).toISOString(), stationElevationDeg: g?.elevationDeg ?? null, horizonDeg: horizon, lunarVisible: lunar?.visible ?? null, pathLossDb: budget?.pathLossDb ?? null, receivedDbw: budget?.receivedDbw ?? null, ebN0Db: budget?.ebN0Db ?? null, weatherLossDb: weather?.attenuationDb ?? null, allocatedRateBps: allocation?.rateLimitBps ?? null, marginDb: budget?.marginDb ?? null, rateBps: rate, bits: rate === null ? null : rate * (b - a) / 1000, contactSeconds: rate === null ? null : rate > 0 ? (b - a) / 1000 : 0, unknown });
    }
    const summarize = (rows: ContactSlice[]) => ({ bits: rows.some(s => s.bits === null) ? null : rows.reduce((sum, s) => sum + s.bits!, 0), seconds: rows.some(s => s.contactSeconds === null) ? null : rows.reduce((sum, s) => sum + s.contactSeconds!, 0) });
    const total = summarize(slices);
    const critical = e.requirements.critical.map(c => {
        const a = ms(c.startUtc), b = ms(c.endUtc), covered = a >= start && b <= end;
        const sum = summarize(slices.filter(s => ms(s.startUtc) >= a && ms(s.endUtc) <= b));
        const bits = covered ? sum.bits : null, seconds = covered ? sum.seconds : null;
        return { id: c.id, status: bits === null || seconds === null ? 'incomplete' as const : bits < c.minimumBits || seconds < c.minimumContactSeconds ? 'conditional-shortfall' as const : 'conditional-meets' as const, bits, seconds };
    });
    for (const s of slices)
        reasons.push(...s.unknown);
    reasons.push('Hourly left-held apparent geometry; no intra-hour acquisition/event guarantee', 'Station clearance includes a conservative 0° local-horizontal floor in addition to supplied horizon/cutoff', 'Moon-centre station direction uses full-disk clearance and conservative range; lunar mask evidence remains separately scoped', 'Total receiver noise must include atmospheric and lunar hot-body noise; vacuum gain excludes weather attenuation', 'Finite modeled capacity assumes configured rate/coding and allocation; no operational approval');
    if (source?.eopCoverage && end > ms(source.eopCoverage.dataEndUtc))
        reasons.push('Station orientation uses predicted EOP after the advertised data boundary; no measured pointing accuracy is inferred');
    const status = e.requirements.minimumBits === null || total.bits === null || critical.some(c => c.status === 'incomplete') ? 'incomplete' : total.bits < e.requirements.minimumBits! || critical.some(c => c.status === 'conditional-shortfall') ? 'conditional-shortfall' : 'conditional-meets';
    return { status, reasons: [...new Set(reasons)], deliveredBits: total.bits, knownDeliveredBits: slices.reduce((sum, s) => sum + (s.bits ?? 0), 0), contactSeconds: total.seconds, critical, slices, scenarioKey, geometryAgeHours: geometry ? (ms(nowUtc) - ms(geometry.fetchedUtc)) / 3600000 : null, futureGeometry: !!geometry && ms(geometry.samples[0].utc) > ms(nowUtc), operationalApproval: false };
}
