import { formatUtc, indexToMs } from '../astro';
import type { Catalog } from '../catalog';
import type { MissionResult } from '../mission';
import type { AssessmentResult } from '../planning-types';
import type { ScenarioState } from '../scenario';

export type ResearchSource = { title: string; url: string };

export const RESOURCE_BOUNDARY = 'Shadow, cold ground and hydrogen signals are clues, not confirmation of water ice. This assessment does not measure local ice or water yield and does not approve a landing or mining operation.';

const lola = { title: 'NASA LOLA · Polar terrain and shadow products', url: 'https://pgda.gsfc.nasa.gov/products/90' };
const horizons = { title: 'JPL Horizons · Sun and Earth positions', url: 'https://ssd.jpl.nasa.gov/horizons/' };
const prime = { title: 'NASA Planetary Data System · Athena and PRIME-1', url: 'https://pds.nasa.gov/ds-view/pds/viewContext.jsp?identifier=urn:nasa:pds:context:instrument_host:spacecraft.clps_to_prime1_athena&version=1.0' };

export const RESOURCE_LESSONS = {
  'ice-evidence': {
    title: 'Is there enough recoverable ice?',
    explanation: 'Cold lunar ground can preserve ice, but cold or shadow alone does not confirm ice. How much water you can recover depends on how much ice the ground contains, how deep it sits and whether it is spread through the soil or concentrated in layers.',
    next: 'Measure ice concentration and form at several depths and locations before comparing deposits.',
    prompt: 'What measurements would you collect to tell whether a cold patch contains enough recoverable ice?',
    detail: 'LCROSS estimated 5.6 ± 2.9% water ice by mass at its impact site in Cabeus. That estimate applies to the excavated material observed there, not to every shadowed region or the selected site. At a new target, sample across depths and locations. With recovery held constant, a tenfold decrease in ice concentration requires processing ten times as much material per kilogram of water.',
    sources: [
      { title: 'Colaprete et al. (2010) · LCROSS water detection in Cabeus', url: 'https://doi.org/10.1126/science.1186986' },
      { title: 'NASA · VIPER prospecting objectives', url: 'https://science.nasa.gov/mission/viper/' },
      { title: 'NASA SMD-LUN-102 (2025) · Volatile observations and limits', url: 'https://ntrs.nasa.gov/api/citations/20250006445/downloads/SMD-LUN-102_RevA_authors.pdf' },
    ],
  },
  'resource-access': {
    title: 'Can we reach and support the deposit?',
    explanation: 'A landing area, a power source and a permanently shadowed region (PSR) can be close on a map. A rover still needs a route it can drive and a way to get power and communicate along it.',
    next: 'Choose a candidate shadowed target and check a route for slopes, obstacles, thermal exposure and communications.',
    prompt: 'Sketch a landing point, a power source and a shadowed target. What would you measure before choosing the shortest route?',
    detail: 'Screen slope and roughness at rover scale, check traction and return energy, and verify communication along the route. Geometric contact is the share of sampled intervals when Earth clears the lunar antenna cutoff. Check station availability and radio performance separately.',
    sources: [lola, { title: 'NASA · Lunar south pole terrain and operations', url: 'https://www.nasa.gov/reference/moonbase-environment/' }],
  },
  'extraction-power': {
    title: 'Can we power water production?',
    explanation: 'Solar panels generate power where they receive sunlight. Equipment working in permanent shadow needs energy from elsewhere to stay warm, excavate, and extract and capture water.',
    next: 'Compare measured extraction and capture loads with delivered power over time, including losses and battery reserve.',
    prompt: 'If more heating releases more vapour but water output stays flat, which part of the system would you test?',
    detail: 'Compare delivered power (W) and storage (Wh) with the load schedule. Include heating, excavation, transport and capture. LUWEX thermal-vacuum tests with icy soil simulants found that the cold trap limited vapour capture in their setup. Measure recovered water per unit energy and per hour in an integrated test.',
    sources: [
      horizons, lola,
      { title: 'Kiewiet et al. (2026) · LUWEX extraction and capture experiments', url: 'https://elib.dlr.de/215814/' },
    ],
  },
} satisfies Record<string, { title: string; explanation: string; next: string; prompt: string; detail: string; sources: ResearchSource[] }>;

export type ResourceTopic = keyof typeof RESOURCE_LESSONS;
export const RESOURCE_TOPICS = Object.keys(RESOURCE_LESSONS) as ResourceTopic[];

const siteQuestions: Record<string, string> = {
  'shackleton-crest': 'Which part of the rim could support a route into shadow while maintaining power and contact?',
  'connecting-ridge': 'Can a power station on the ridge support a rover at a selected shadowed target, given the actual route?',
  'degerlache-shackleton': 'Which section of the ridge could connect a landing area, solar array and shadowed target?',
  'peak-near-shackleton': 'Would better sky clearance at the peak justify the energy and slope constraints of a return traverse?',
  'malapert-massif': 'Can a high site support communications and power for a separate shadowed target along a practical route?',
};

const metricFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 });
export function resourceMetric(value: number | null, unit: string) {
  return value === null || !Number.isFinite(value) ? 'Unavailable' : `${metricFormat.format(value)}${unit === '%' ? '%' : ` ${unit}`}`;
}

function sunlight(mission: MissionResult | undefined) {
  if (!mission?.timeline.length || mission.timeline.some(interval => interval.sun === null)) return null;
  return 100 * mission.timeline.filter(interval => interval.sun).length / mission.timeline.length;
}

export function resourceEvidence(catalog: Catalog, state: ScenarioState, assessment: AssessmentResult | null) {
  const site = catalog.sites.find(item => item.id === state.siteId);
  const siteName = state.custom
    ? `Custom point (${state.custom.lat.toFixed(4)}°, ${state.custom.lon.toFixed(4)}°)`
    : site?.name ?? state.siteId;
  const athena = !state.custom && /mons mouton|athena/i.test(siteName);
  const focus = athena
    ? 'Historical example at Mons Mouton: Athena’s final orientation kept the PRIME-1 drill from reaching the ground. How could a new landing and sampling plan reduce that risk?'
    : (!state.custom && siteQuestions[state.siteId]) || 'Where would you locate the landing area, power source and resource target?';
  const mission = assessment?.mission;
  const sphere = assessment?.sphereMission;
  const metrics = {
    sun: [sunlight(mission), sunlight(sphere)],
    contact: [mission?.contactFraction == null ? null : 100 * mission.contactFraction,
      sphere?.contactFraction == null ? null : 100 * sphere.contactFraction],
    energy: [mission?.generatedWh == null ? null : mission.generatedWh / 1000,
      sphere?.generatedWh == null ? null : sphere.generatedWh / 1000],
    battery: [mission?.minBatteryWh == null ? null : mission.minBatteryWh / 1000,
      sphere?.minBatteryWh == null ? null : sphere.minBatteryWh / 1000],
  };
  const powerShortfall = assessment?.constraints.some(item =>
    (item.id === 'reserve' || item.id === 'unmet-demand') && item.state === 'fail');
  const contactShortfall = assessment?.constraints.some(item =>
    (item.id === 'geometric-outage' || item.id.startsWith('critical-contact:')) && item.state === 'fail');
  const next = powerShortfall
    ? 'Test more storage or a revised operating schedule against the modelled power shortfall before adding extraction load.'
    : contactShortfall
      ? 'Check a different arrival or antenna location for the failed contact requirement, then verify the route and link.'
      : metrics.energy[0] === null
        ? 'Check terrain, illumination and assessment coverage for this point and stay before sizing power delivery.'
        : 'Identify a candidate shadowed target and investigate a traverse; ice presence and recoverability still need measurements.';
  const observations: Record<ResourceTopic, string> = {
    'ice-evidence': 'Local ice concentration, depth and form are unknown in this assessment.',
    'resource-access': 'Landing-to-target traverse and power delivery are unassessed.',
    'extraction-power': 'Extraction load, capture throughput and water yield are unassessed.',
  };
  return {
    siteName, focus, metrics, next, observations,
    arrival: formatUtc(indexToMs(catalog, state.startIndex)),
    hours: (state.endIndex - state.startIndex + 1) * catalog.meta.stepHours,
    siteSource: athena ? prime : null,
  };
}

export const RESOURCE_METRICS = [
  { key: 'sun', label: 'Intervals with sunlight', unit: '%' },
  { key: 'contact', label: 'Geometric Earth contact', unit: '%' },
  { key: 'energy', label: 'Generated energy', unit: 'kWh' },
  { key: 'battery', label: 'Minimum stored energy', unit: 'kWh' },
] as const;
