import type { Catalog } from '../catalog';
import type { AssessmentResult } from '../planning-types';
import type { ScenarioState } from '../scenario';
import type { CommunicationsEnvelope, LinkHardware, Provenance, Span } from './types';
export function scenarioStay(catalog: Catalog, state: ScenarioState): Span { return { startUtc: new Date(catalog.t0ms + state.startIndex * catalog.meta.stepHours * 3600000).toISOString(), endUtc: new Date(catalog.t0ms + (state.endIndex + 1) * catalog.meta.stepHours * 3600000).toISOString() }; }
export function emptyEnvelope(scenarioKey: string, stationId: CommunicationsEnvelope['stationId'] = 'goldstone'): CommunicationsEnvelope { return { schema: 'solarreach-station-evidence-1', scenarioKey, stationId, exportedUtc: new Date().toISOString(), geometry: null, stationHorizon: null, lunarMask: null, hardware: null, weather: null, allocations: null, requirements: { minimumBits: null, critical: [] } }; }
export const HARDWARE_FIELDS: Array<{
    key: Exclude<keyof LinkHardware, 'band'>;
    label: string;
    unit: string;
}> = [
    { key: 'frequencyGHz', label: 'Carrier frequency', unit: 'GHz' }, { key: 'txPowerW', label: 'Lunar transmitter power', unit: 'W' }, { key: 'txGainDbi', label: 'Lunar antenna gain', unit: 'dBi' }, { key: 'rxVacuumGainDbi', label: 'Station vacuum antenna gain', unit: 'dBi' }, { key: 'systemNoiseK', label: 'Total station system noise (including sky/Moon)', unit: 'K' }, { key: 'pointingLossDb', label: 'Combined pointing loss', unit: 'dB' }, { key: 'otherLossDb', label: 'Other RF losses', unit: 'dB' }, { key: 'implementationLossDb', label: 'Implementation loss', unit: 'dB' }, { key: 'requiredEbN0Db', label: 'Required coding Eb/N₀', unit: 'dB' }, { key: 'rateBps', label: 'Configured information rate', unit: 'bit/s' },
];
export function lunarProxy(catalog: Catalog, state: ScenarioState, assessment: AssessmentResult, provenance: Provenance): NonNullable<CommunicationsEnvelope['lunarMask']> {
    const start = catalog.t0ms + state.startIndex * catalog.meta.stepHours * 3600000;
    return { provenance, value: assessment.mission.timeline.map(t => ({ startUtc: new Date(start + t.startOffsetHours * 3600000).toISOString(), endUtc: new Date(start + t.endOffsetHours * 3600000).toISOString(), visible: t.contact, antennaHeightM: state.antennaHeightM, minimumElevationDeg: state.mission.antennaMaskDeg, target: 'Earth-center proxy' })) };
}
