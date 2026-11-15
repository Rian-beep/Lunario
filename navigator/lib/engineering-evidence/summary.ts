import { DSN_STATIONS } from '../dsn';
import { evaluateCommunications, type CommunicationsResult } from './communications';
import { parseEnvelope } from './import';
import { horizonsSourceContext, type HorizonsSourceContext } from './horizons';
import type { Provenance, Span, Supplied } from './types';

export type EvidenceState = 'missing' | 'invalid' | 'stale' | 'partial' | 'unknown' | 'assumption' | 'supplied';
export type StationEvidenceRow = {
  id: string; title: string; state: EvidenceState; detail: string; nextAction: string;
  provenance: Provenance | null; coveredSeconds: number | null;
};
export type StationEvidenceSummary = {
  state: 'invalid' | 'stale' | 'current'; error: string | null;
  station: typeof DSN_STATIONS[number] | null;
  stay: Span; result: CommunicationsResult | null; rows: StationEvidenceRow[];
  geometry: (HorizonsSourceContext & {
    requestUrl: string; fetchedUtc: string; ageHours: number; coverage: Span;
    units: 'UTC, degrees, km'; apiVersion: null;
  }) | null;
  critical: Array<CommunicationsResult['critical'][number] & {
    startUtc: string; endUtc: string; minimumBits: number; minimumContactSeconds: number;
  }>;
  refresh: string;
};

/** A view of the existing conditional screen, never an additional mission verdict. */
export function summarizeStationEvidence(input: unknown, scenarioKey: string, stay: Span, nowUtc: string): StationEvidenceSummary {
  const base = { stay, refresh: 'Manual fetch or import only; no polling, persistent cache or automatic refresh. Retained evidence keeps its original issue/retrieval time.' };
  try {
    const e = parseEnvelope(input), result = evaluateCommunications(e, scenarioKey, stay, nowUtc);
    const stale = e.scenarioKey !== scenarioKey, now = Date.parse(nowUtc);
    const totalSeconds = (Date.parse(stay.endUtc) - Date.parse(stay.startUtc)) / 1000;
    const coverage = (rows: Span[]) => rows.reduce((sum, row) => sum + Math.max(0,
      Math.min(Date.parse(stay.endUtc), Date.parse(row.endUtc)) - Math.max(Date.parse(stay.startUtc), Date.parse(row.startUtc))) / 1000, 0);
    const rows: StationEvidenceRow[] = [];
    const add = (id: string, title: string, supplied: Supplied<unknown> | null, detail: string, nextAction: string,
      coveredSeconds: number | null = null, unknown = false, assumption = false) => {
      const state: EvidenceState = !supplied ? 'missing' : stale || Date.parse(supplied.provenance.issuedUtc) > now ? 'stale'
        : unknown ? 'unknown' : coveredSeconds !== null && coveredSeconds < totalSeconds ? 'partial'
        : assumption || supplied.provenance.kind === 'user-assumption' ? 'assumption' : 'supplied';
      rows.push({ id, title, state, detail, nextAction, provenance: supplied?.provenance ?? null, coveredSeconds });
    };
    rows.push({ id: 'binding', title: 'Site, time and scenario binding', state: stale ? 'stale' : 'supplied',
      detail: stale ? 'Evidence belongs to another scenario; modeled capacity is unknown.' : 'Envelope matches the supplied scenario key. This key is an input identity, not source authentication.',
      nextAction: 'After site, stay or hardware changes, regenerate applicable evidence against the current canonical scenario; do not merely relabel an old envelope.', provenance: null, coveredSeconds: null });
    const g = e.geometry, source = g ? horizonsSourceContext(g.rawResponse) : null;
    const geometry = g && source ? { ...source, requestUrl: g.requestUrl, fetchedUtc: g.fetchedUtc,
      ageHours: (now - Date.parse(g.fetchedUtc)) / 3600000,
      coverage: { startUtc: g.samples[0].utc, endUtc: g.samples.at(-1)!.utc }, units: 'UTC, degrees, km' as const, apiVersion: null } : null;
    const geometrySeconds = geometry ? coverage([geometry.coverage]) : 0;
    const unsupportedEop = result.slices.some(s => s.unknown.some(u => u.startsWith('Earth-orientation')));
    rows.push({ id: 'geometry', title: 'Station to Moon-centre geometry',
      state: !g ? 'missing' : Date.parse(g.fetchedUtc) > now ? 'stale' : unsupportedEop ? 'unknown' : geometrySeconds < totalSeconds ? 'partial' : 'supplied',
      detail: g ? `${g.frame}; hourly left-held UTC directions and km range, final epoch is endpoint only. ${source?.ephemeris ?? 'Ephemeris version unknown'}; EOP ${source?.eopFile ?? 'unknown'}. Fixed representative antenna coordinates use the 2003.0 reference epoch; no station velocity propagation. API signature version is not retained in schema 1.` : 'No archived station observer table is loaded.',
      nextAction: 'Fetch/import the selected antenna over the entire stay; inspect EOP data/prediction dates and refresh for a later release. Refine acquisition/loss times separately.', provenance: null, coveredSeconds: geometrySeconds });
    add('station-horizon', 'Earth-station local horizon', e.stationHorizon,
      e.stationHorizon ? `Supplied cutoff ${e.stationHorizon.value.minimumElevationDeg}°; ${e.stationHorizon.value.profile.length ? 'closed azimuth skyline' : 'constant cutoff'}. Whole-disk clearance also applies a 0° floor.` : 'Station skyline/cutoff is missing.',
      'Supply the actual antenna horizon and operating elevation limits with dated provenance. A globe pin does not provide a horizon.');
    const masks = e.lunarMask?.value ?? [], proxy = masks.some(m => m.target === 'Earth-center proxy');
    add('lunar-mask', 'Lunar antenna ray and terrain mask', e.lunarMask,
      masks.length ? `${proxy ? 'Earth-centre proxy included; this does not resolve the chosen station ray.' : 'Station-targeted mask declared by supplier; not independently verified.'} Heights ${[...new Set(masks.map(m => m.antennaHeightM))].join(', ')} m; absolute masks ${[...new Set(masks.map(m => m.minimumElevationDeg))].join(', ')}°.` : 'No dated lunar antenna mask is loaded.',
      'Supply station-specific lunar rays through local terrain at the actual antenna height, pointing limits and UTC coverage; retain Earth-centre comparison as context.',
      coverage(masks.filter(m => m.visible !== null)), proxy && e.lunarMask?.provenance.kind !== 'user-assumption', proxy);
    const h = e.hardware?.value;
    add('hardware', 'Radio and configured rate', e.hardware,
      h ? `${h.band} band, ${h.frequencyGHz} GHz, ${h.rateBps} bit/s; gains/noise/coding/pointing losses are supplied inputs. No station feed, polarization, duplex direction, coding or acquisition compatibility check is encoded.` : 'No radio/noise/coding/rate inputs are supplied.',
      'Confirm the selected antenna service and vehicle radio against JPL 810-005 interfaces; supply total receiver noise including sky and lunar contributions.');
    const weather = e.weather?.value ?? [];
    const weatherUnknown = result.slices.some(s => s.unknown.some(u => /weather.*(mismatch|future)|observed weather/.test(u)));
    add('weather', 'Dated band-specific weather loss', e.weather,
      weather.length ? `${e.weather!.provenance.kind}; supplied slant attenuation in dB for explicit band/frequency intervals. Cloud cover, precipitation totals and current X-rays are not RF attenuation evidence.` : 'No dated attenuation is supplied; mission weather loss is unknown.',
      'Supply applicable station/band/frequency slant attenuation or an explicit dated assumption. Outside a forecast/observation interval leave loss unknown; do not replace it with clear-sky zero.', coverage(weather), weatherUnknown);
    add('allocation', 'Allocated rate intervals', e.allocations,
      e.allocations ? 'Supplied rate limits in bit/s; an explicit zero is zero modeled capacity, an uncovered interval is unknown. This envelope cannot authenticate a booking.' : 'No allocated rate intervals are supplied.',
      'Obtain mission-specific station/service/time commitments and usable payload rate, including acquisition/overhead. Mark hypothetical allocations as user assumptions.', coverage(e.allocations?.value ?? []));
    rows.push({ id: 'service', title: 'Acquisition, compatibility and actual support', state: 'unknown',
      detail: 'Booking and compatible service remain unverified. No acquisition, tracking lock, overhead, outage or delivered telemetry model is connected.',
      nextAction: 'Confirm dated operational support with the service provider and bind the actual vehicle radio/configuration. An independent conditional RF result cannot confer overall mission approval.', provenance: null, coveredSeconds: null });
    return { ...base, state: stale ? 'stale' : 'current', error: null,
      station: DSN_STATIONS.find(s => s.id === e.stationId)!, result, rows, geometry,
      critical: result.critical.map((c, i) => ({ ...e.requirements.critical[i], ...c })) };
  } catch (error) {
    return { ...base, state: 'invalid', error: error instanceof Error ? error.message : String(error),
      station: null, result: null, rows: [], geometry: null, critical: [] };
  }
}
