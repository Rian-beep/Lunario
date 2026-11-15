import ch3 from '../public/data/trajectories/chandrayaan-3-descent-reference.json';
import a15 from '../public/data/trajectories/apollo-15-csm-orbit-reconstructed.json';
import { LANDING_SITES } from './landing-sites';
import { parseMissionTrajectory, trajectorySourceUrl, type MissionTrajectory, type TrajectoryIdentity } from './mission-trajectories';

export const MISSION_TRAJECTORY_IDENTITIES: TrajectoryIdentity[] = [
  { vehicle: 'Vikram lander (-158)', id: 'chandrayaan-3-descent-reference', missionId: 'chandrayaan-3', siteId: 'chandrayaan-3', kind: 'reference', phase: 'descent', primarySha256: '6e99902c1d1610391b81671fb7f90d58316c31d4b3b44a8502b28f96693b8426', primaryUrl: ch3.sources[0].url, primaryVersion: 'ch3-descent-horizons.txt', frameName: 'IAU_MOON', epochCalendar: '2023-08-23T12:16:00', epochScale: 'TDB' },
  { vehicle: 'Command and service module (-915)', id: 'apollo-15-csm-orbit-reconstructed', missionId: 'apollo-15', siteId: 'apollo-15', kind: 'reconstructed', phase: 'orbit', primarySha256: '0b3b35ecdeeba2ec9884ce95ed68f6ef95cfca689dc0c9ae6549936a4b8d7da5', primaryUrl: 'https://naif.jpl.nasa.gov/pub/naif/APOLLO/kernels/spk/apollo15-1.bsp', primaryVersion: 'apollo15-1.bsp', frameName: 'IAU_MOON', epochCalendar: '1971-07-30T18:00:00', epochScale: 'TDB' },
];
export const MISSION_TRAJECTORIES: readonly MissionTrajectory[] = [parseMissionTrajectory(ch3, MISSION_TRAJECTORY_IDENTITIES[0]), parseMissionTrajectory(a15, MISSION_TRAJECTORY_IDENTITIES[1])];
export interface TrajectoryReason {
  id: string; missionIds: string[]; phase: string;
  basis: 'source-derived' | 'model-design' | 'unresolved';
  goal: string; explanation: string; variables: string[];
  citations: { url: string; locator: string }[];
}
const report = 'https://www.nasa.gov/wp-content/uploads/static/apollo50th/pdf/A11_MissionReport.pdf';
const experience = 'https://ntrs.nasa.gov/citations/19720018205';
export const MISSION_TRAJECTORY_REASONS: readonly TrajectoryReason[] = [
  { id: 'apollo-lighting', missionIds: ['apollo-11', 'apollo-12', 'apollo-14', 'apollo-15', 'apollo-16', 'apollo-17'], phase: 'arrival timing', basis: 'source-derived', goal: 'See relief at the landing site', explanation: 'Apollo arrivals favored early morning sunlight: shadows aided navigation and surface temperatures were less extreme. Site longitude and arrival date therefore changed the illumination geometry.', variables: ['Site longitude', 'Arrival date and Sun elevation'], citations: [{ url: 'https://svs.gsfc.nasa.gov/5535/', locator: 'Opening discussion of early morning landing illumination' }] },
  { id: 'apollo11-free-return', missionIds: ['apollo-11'], phase: 'translunar coast', basis: 'source-derived', goal: 'Retain a return option before lunar orbit insertion', explanation: 'The free-return transfer provided an Earth-return abort option without another engine firing before lunar orbit insertion. The coast follows the transfer geometry; it is not a straight line aimed at the landing pin.', variables: ['Launch timing', 'Injection state', 'Midcourse corrections'], citations: [{ url: 'https://www.nasa.gov/missions/apollo/apollo-11-mission-overview/', locator: 'Free-return transfer and descent orbit insertion paragraphs' }] },
  { id: 'apollo11-descent', missionIds: ['apollo-11'], phase: 'descent orbit / braking / approach', basis: 'source-derived', goal: 'Remove orbital speed while preserving a visible final approach', explanation: 'A retrograde descent-orbit burn lowered the next perilune uprange of the site. Initial braking prioritized propellant economy; the later approach allowed visual assessment and retargeting. Radar, navigation error, terrain uncertainty and remaining propellant constrained this sequence.', variables: ['Initial orbit and perilune location', 'Mass and propellant', 'Navigation uncertainty', 'Crew visibility', 'Landing radar limits'], citations: [{ url: report, locator: 'Section 5.1, printed pp. 5-1–5-2' }, { url: 'https://www.nasa.gov/missions/apollo/apollo-11-mission-overview/', locator: 'Retrograde descent orbit insertion burn' }] },
  { id: 'apollo11-avoidance', missionIds: ['apollo-11'], phase: 'terminal approach', basis: 'source-derived', goal: 'Avoid the crater and boulder field', explanation: 'The commander shifted the terminal landing location after seeing the predicted approach lead toward a large crater. The resulting longer maneuver consumed additional descent propellant; this was a mission-specific deviation.', variables: ['Observed hazards', 'Retargeting distance', 'Remaining propellant', 'Descent rate'], citations: [{ url: report, locator: 'Section 5.3, high-gate / manual landing discussion; section 9.8 descent propulsion' }] },
  { id: 'apollo11-ascent', missionIds: ['apollo-11'], phase: 'surface ascent and rendezvous', basis: 'source-derived', goal: 'Reach the orbiting command module', explanation: 'An initial vertical rise provided surface clearance, followed by pitchover toward the launch azimuth. The ascent and subsequent rendezvous maneuvers targeted the command module orbit rather than returning along the descent path.', variables: ['Launch azimuth', 'Command module orbital plane and phase', 'Insertion state', 'Rendezvous timing'], citations: [{ url: report, locator: 'Section 5.6 ascent and section 5.7 rendezvous' }, { url: experience, locator: 'Mission planning for lunar module descent and ascent' }] },
  { id: 'apollo12-correction', missionIds: ['apollo-12'], phase: 'descent targeting', basis: 'source-derived', goal: 'Improve pinpoint landing', explanation: 'A navigation correction capability developed from Apollo 11 postflight analysis was successfully used for Apollo 12. This supports a mission-specific targeting explanation, but does not supply Apollo 12 trajectory samples.', variables: ['Navigation correction', 'Target coordinates'], citations: [{ url: experience, locator: 'Abstract; comparison of Apollo 11 and Apollo 12' }] },
  { id: 'ch3-landing', missionIds: ['chandrayaan-3'], phase: 'descent', basis: 'source-derived', goal: 'Reduce speed, verify navigation and avoid local hazards', explanation: 'ISRO documents successive braking and terminal descent phases, throttleable engines, velocity sensing and hazard detection. These capabilities support a soft landing; the published phase diagram does not specify every flown burn or establish the accuracy of the Horizons descent samples.', variables: ['Initial orbit', 'Throttle', 'Velocity estimates', 'Hazard selection', 'Touchdown speed limits'], citations: [{ url: 'https://www.unoosa.org/documents/pdf/copuos/stsc/2024/ListTechnicalPresentations/2024_STSC_technical_presentations_slides/9_26_--_4_INDIA_Chandrayaan3.pdf', locator: 'India STSC 2024 presentation, slide 10: landing sequence' }, { url: 'https://www.isro.gov.in/Chandrayaan3_Details.html', locator: 'Lander technologies and touchdown specifications' }] },
  { id: 'ch3-pedigree', missionIds: ['chandrayaan-3'], phase: 'available descent ephemeris', basis: 'unresolved', goal: 'Keep prediction separate from as-flown evidence', explanation: 'The Horizons header names post-launch ISRO/JPLNAV solutions and reports the landing separately. It does not identify a final descent tracking fit or provide covariance. Treat this extract as a reference, not confirmed flown reconstruction.', variables: ['Source solution revision', 'Fit versus prediction status'], citations: [{ url: ch3.sources[0].url, locator: 'Spacecraft data sheet TRAJECTORY and output source chandrayaan-3_lander_mer' }, { url: 'https://ssd.jpl.nasa.gov/horizons/manual.html#spacecraft-trajectories-in-horizons', locator: 'Spacecraft trajectories may mix tracking fits and predictions' }] },
  { id: 'display-interpolation', missionIds: ['apollo-15', 'chandrayaan-3'], phase: 'display playback', basis: 'model-design', goal: 'Display bounded samples smoothly at 1×', explanation: 'Linear Cartesian interpolation joins adjacent samples only inside their time bounds. It supplies display positions, never spacecraft attitude, thrust direction or a new trajectory solution. Camera easing changes the viewpoint only.', variables: ['Sample cadence', 'Wall-clock elapsed time', 'Camera easing'], citations: [] },
];

export function validateTrajectoryReasons(reasons: readonly TrajectoryReason[]): void {
  const seen = new Set<string>();
  for (const reason of reasons) {
    if (seen.has(reason.id) || !reason.id || !reason.goal || !reason.explanation || !reason.missionIds.length || !reason.phase || !reason.variables.length || !['source-derived', 'model-design', 'unresolved'].includes(reason.basis)) throw Error('Invalid trajectory rationale');
    seen.add(reason.id);
    if (reason.basis === 'source-derived' && !reason.citations.length) throw Error('Source-derived rationale requires citations');
    for (const citation of reason.citations) { trajectorySourceUrl(citation.url); if (!citation.locator.trim()) throw Error('Citation requires a locator'); }
  }
}
validateTrajectoryReasons(MISSION_TRAJECTORY_REASONS);
export interface MissionTrajectoryCoverage {
  siteId: string; missionId: string; status: 'reference-descent' | 'orbital-context-only' | 'no-validated-path' | 'not-reviewed';
  availableIds: string[]; missing: string; simulationAvailable: true;
}
/** Every existing landing/attempt pin retains an explicitly separate simulation option. No source search is implied for not-reviewed entries. */
export const MISSION_TRAJECTORY_COVERAGE: readonly MissionTrajectoryCoverage[] = LANDING_SITES.map(site => ({
  siteId: site.id, missionId: site.id,
  status: site.id === 'chandrayaan-3' ? 'reference-descent' : site.id === 'apollo-15' ? 'orbital-context-only' : site.program === 'Apollo' || site.id === 'slim' ? 'no-validated-path' : 'not-reviewed',
  availableIds: MISSION_TRAJECTORIES.filter(data => data.siteId === site.id).map(data => data.id),
  missing: site.id === 'chandrayaan-3' ? 'Confirmed as-flown final descent pedigree, launch and ascent replay are unavailable in this delivery.' : site.id === 'apollo-15' ? 'CSM orbit only; no lunar module launch, ascent or descent samples validated.' : 'No validated launch, ascent or descent time-series is bundled for this site.',
  simulationAvailable: true,
}));
export const missionTrajectoriesForSite = (siteId: string): readonly MissionTrajectory[] => MISSION_TRAJECTORIES.filter(data => data.siteId === siteId);
export const missionReasonsForSite = (siteId: string): readonly TrajectoryReason[] => MISSION_TRAJECTORY_REASONS.filter(reason => reason.missionIds.includes(siteId));
