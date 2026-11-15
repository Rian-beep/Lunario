import { DSN_STATIONS } from '../dsn';
import { EVIDENCE_LIMITS, type StationGeometry } from './types';
import { utc } from './import';
export type GeometryRequest = {
    stationId: StationGeometry['stationId'];
    startUtc: string;
    endUtc: string;
};
export function horizonsUrl(request: GeometryRequest): string {
    const s = DSN_STATIONS.find(s => s.id === request.stationId);
    if (!s)
        throw Error('Unknown DSN ground station');
    const start = Date.parse(utc(request.startUtc)), end = Date.parse(utc(request.endUtc));
    // Horizons labels pre-1962 UT as UT1, which cannot be relabelled UTC.
    if (start < Date.UTC(1962, 0, 1))
        throw Error('Station geometry requires UTC epochs from 1962 onward');
    if (start % 3600000 || end % 3600000 || end <= start || end - start > EVIDENCE_LIMITS.maxDays * 86400000)
        throw Error('Choose whole UTC hours spanning at most 31 days');
    const params = new URLSearchParams({ format: 'json' });
    const args = { COMMAND: '301', OBJ_DATA: 'NO', MAKE_EPHEM: 'YES', EPHEM_TYPE: 'OBSERVER', CENTER: 'coord@399', COORD_TYPE: 'GEODETIC', SITE_COORD: `${s.longitudeEastDeg},${s.latitudeDeg},${s.heightM / 1000}`, START_TIME: request.startUtc.replace('T', ' ').replace('Z', ''), STOP_TIME: request.endUtc.replace('T', ' ').replace('Z', ''), STEP_SIZE: '1 h', QUANTITIES: '4,20', CSV_FORMAT: 'YES', TIME_TYPE: 'UT', TIME_DIGITS: 'SECONDS', CAL_FORMAT: 'JD', ANG_FORMAT: 'DEG', APPARENT: 'AIRLESS', RANGE_UNITS: 'KM', EXTRA_PREC: 'YES' };
    for (const [k, v] of Object.entries(args))
        params.set(k, `'${v}'`);
    return `https://ssd.jpl.nasa.gov/api/horizons.api?${params}`;
}
/** Check the declared request, independently of the archived response semantics. */
export function validateHorizonsRequestUrl(requestUrl: string, request: GeometryRequest): void {
    const expected = new URL(horizonsUrl(request));
    let actual: URL;
    try { actual = new URL(requestUrl); }
    catch { throw Error('Invalid Horizons request source URL'); }
    if (actual.origin !== expected.origin || actual.pathname !== expected.pathname || actual.username || actual.password || actual.hash)
        throw Error('Horizons request source identity does not match the provider');
    const entries = [...actual.searchParams];
    if (entries.length !== [...expected.searchParams].length || new Set(entries.map(([k]) => k)).size !== entries.length)
        throw Error('Horizons request settings are missing, duplicated or unsupported');
    const unquote = (s: string) => s.startsWith("'") && s.endsWith("'") ? s.slice(1, -1) : s;
    for (const [key, encoded] of expected.searchParams) {
        const supplied = actual.searchParams.get(key);
        if (supplied === null) throw Error(`Horizons request setting ${key} is missing`);
        const value = unquote(supplied), required = unquote(encoded);
        if (key === 'START_TIME' || key === 'STOP_TIME') {
            if (Date.parse(utc(value.replace(' ', 'T') + 'Z')) !== Date.parse(utc(required.replace(' ', 'T') + 'Z')))
                throw Error(`Horizons request epoch ${key} differs from the archived source`);
        }
        else if (key === 'SITE_COORD') {
            const fields = value.split(','), coordinates = fields.map(Number), station = required.split(',').map(Number);
            if (coordinates.length !== 3 || fields.some(v => !v.trim()) || coordinates.some((v, i) => !Number.isFinite(v) || Math.abs(v - station[i]) > 1e-10))
                throw Error('Horizons request station coordinates do not match the archived source');
        }
        else if (value !== required)
            throw Error(`Horizons request setting ${key} differs from the supported source convention`);
    }
}
export function parseHorizonsResponse(payload: unknown, request: GeometryRequest, fetchedUtc: string): StationGeometry {
    const url = horizonsUrl(request);
    utc(fetchedUtc);
    if (!payload || typeof payload !== 'object')
        throw Error('Horizons returned no JSON object');
    const p = payload as {
        error?: unknown;
        result?: unknown;
    };
    if (p.error)
        throw Error(`Horizons: ${String(p.error).slice(0, 500)}`);
    if (typeof p.result !== 'string' || p.result.length > 1500000)
        throw Error('Missing or oversized Horizons observer table');
    const raw = p.result;
    const sections = raw.split('$$SOE'), endSections = sections[1]?.split('$$EOE');
    if (sections.length !== 2 || endSections?.length !== 2 || sections[0].includes('$$EOE'))
        throw Error('Horizons response is incomplete or contains multiple tables');
    const header = sections[0];
    const columns = header.trim().split(/\r?\n/).filter(line => !/^\*+$/.test(line.trim())).at(-1)?.split(',').map(s => s.trim());
    const expectedColumns = ['Date_________JDUT', '', '', 'Azimuth_(a-app)', 'Elevation_(a-app)', 'delta', 'deldot', ''];
    if (JSON.stringify(columns) !== JSON.stringify(expectedColumns) || !/^Time format\s*:\s*JD\s*$/m.test(header) || !/^RA format\s*:\s*DEG\s*$/m.test(header) || !/^Start time\s*:\s*A\.D\..*\sUT\s*$/m.test(header) || !/^Stop\s+time\s*:\s*A\.D\..*\sUT\s*$/m.test(header))
        throw Error('Horizons UTC Julian-date and airless apparent AZ/EL column headers were not recognized');
    if (!/^Target body name:\s*Moon\s*\(301\)/m.test(header) || !/^Center body name:\s*Earth\s*\(399\)/m.test(header) || !/^Atmos refraction\s*:\s*NO \(AIRLESS\)\s*$/m.test(header) || !/^Center pole\/equ\s*:\s*ITRF93\s+/m.test(header))
        throw Error('Horizons target, Earth frame, airless or kilometre table headers were not recognized');
    const s = DSN_STATIONS.find(s => s.id === request.stationId)!;
    const coord = header.match(/^Center geodetic\s*:\s*([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)/m);
    if (!coord || !coord.slice(1).every(v => Number.isFinite(Number(v))) || Math.abs((Number(coord[1]) - s.longitudeEastDeg + 540) % 360 - 180) > 1e-5 || Math.abs(Number(coord[2]) - s.latitudeDeg) > 1e-5 || Math.abs(Number(coord[3]) - s.heightM / 1000) > 1e-5)
        throw Error('Horizons station coordinates do not match the requested antenna');
    if (!/Units: KM and KM\/S/.test(raw))
        throw Error('Horizons range units not recognized');
    const body = endSections[0];
    const samples = body.trim().split('\n').map(line => {
        const f = line.split(',').map(s => s.trim());
        // CSV: JDUT, solar-presence, lunar-presence, AZ, EL, delta, delta-dot.
        const [jd, az, el, range] = [Number(f[0]), Number(f[3]), Number(f[4]), Number(f[5])];
        if (f.length !== 8 || [0, 3, 4, 5, 6].some(i => !f[i] || !Number.isFinite(Number(f[i]))) || f[7] !== '' || ![jd, az, el, range].every(Number.isFinite) || az < 0 || az > 360 || el < -90 || el > 90 || range < 300000 || range > 500000)
            throw Error('Unexpected Horizons CSV fields or units');
        return { utc: new Date(Math.round(((jd - 2440587.5) * 86400000) / 1000) * 1000).toISOString(), azimuthDeg: az, elevationDeg: el, rangeKm: range };
    });
    const expected = (Date.parse(request.endUtc) - Date.parse(request.startUtc)) / 3600000 + 1;
    if (samples.length !== expected || samples.length > EVIDENCE_LIMITS.samples || samples.some((s, i) => Date.parse(s.utc) !== Date.parse(request.startUtc) + i * 3600000))
        throw Error('Horizons response does not cover every requested hourly epoch');
    return { stationId: request.stationId, target: 'Moon center', frame: 'ITRF93 / airless apparent AZ-EL', requestUrl: url, fetchedUtc, rawResponse: raw, samples };
}
export async function fetchStationGeometry(request: GeometryRequest, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<StationGeometry> {
    signal.throwIfAborted();
    const controller = new AbortController(), abort = () => controller.abort(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(() => controller.abort(new Error('Horizons request timed out after 45 seconds')), 45000);
    try {
        const response = await fetcher(horizonsUrl(request), { signal: controller.signal, credentials: 'omit' });
        if (!response.ok)
            throw Error(`Horizons HTTP ${response.status}`);
        if (!response.body)
            throw Error('Horizons returned an empty response');
        const reader = response.body.getReader(), chunks: Uint8Array[] = [];
        let size = 0;
        try {
            while (true) {
                controller.signal.throwIfAborted();
                const { done, value } = await reader.read();
                if (done)
                    break;
                size += value.byteLength;
                if (size > EVIDENCE_LIMITS.bytes) {
                    await reader.cancel('Evidence size limit');
                    throw Error('Horizons response exceeds 2 MB');
                }
                chunks.push(value);
            }
        }
        finally {
            reader.releaseLock();
        }
        controller.signal.throwIfAborted();
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.length;
        }
        return parseHorizonsResponse(JSON.parse(new TextDecoder().decode(bytes)), request, new Date().toISOString());
    }
    finally {
        clearTimeout(timeout);
        signal.removeEventListener('abort', abort);
    }
}
export type ProviderState = {
    status: 'idle' | 'loading' | 'success' | 'error' | 'cancelled';
    geometry: StationGeometry | null;
    error: string | null;
};
/** One request at a time; late results cannot replace a newer selection. No polling. */
export class StationGeometryLoader {
    private sequence = 0;
    private controller: AbortController | null = null;
    cancel() { this.sequence++; this.controller?.abort(); this.controller = null; }
    async load(request: GeometryRequest, publish: (s: ProviderState) => void, fetcher: typeof fetch = fetch) {
        this.cancel();
        const id = this.sequence, controller = new AbortController();
        this.controller = controller;
        publish({ status: 'loading', geometry: null, error: null });
        try {
            const geometry = await fetchStationGeometry(request, controller.signal, fetcher);
            if (id === this.sequence)
                publish({ status: 'success', geometry, error: null });
        }
        catch (error) {
            if (id === this.sequence)
                publish({ status: controller.signal.aborted ? 'cancelled' : 'error', geometry: null, error: error instanceof Error ? error.message : String(error) });
        }
        finally {
            if (id === this.sequence)
                this.controller = null;
        }
    }
}
