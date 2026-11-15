import { readFileSync } from 'node:fs';
import { parseHorizonsResponse, type GeometryRequest } from '../../lib/engineering-evidence/horizons';
import { evaluateCommunications } from '../../lib/engineering-evidence/communications';
import { emptyEnvelope } from '../../lib/engineering-evidence/workspace';
import type { CommunicationsEnvelope, Supplied } from '../../lib/engineering-evidence/types';

export const fixture = JSON.parse(readFileSync('public/data/engineering-evidence/goldstone-horizons.json', 'utf8')) as {
  request: GeometryRequest; response: { result: string };
};
export const stay = { startUtc: '2026-11-14T00:00:00Z', endUtc: '2026-11-14T01:00:00Z' };
export const now = '2026-11-16T00:00:00Z';
const supplied = <T>(value: T): Supplied<T> => ({ value, provenance: {
  title: 'Synthetic regression assumption', sourceUrl: 'user:test', author: 'regression',
  issuedUtc: '2026-11-13T00:00:00Z', kind: 'user-assumption', notes: 'No actual support or hardware qualification',
} });
export function chain(): CommunicationsEnvelope {
  return { ...emptyEnvelope('test-case'), exportedUtc: now,
    geometry: parseHorizonsResponse(fixture.response, fixture.request, now),
    stationHorizon: supplied({ minimumElevationDeg: 10, profile: [] }),
    lunarMask: supplied([{ ...stay, visible: true, antennaHeightM: 2, minimumElevationDeg: 0, target: 'Earth-center proxy' }]),
    hardware: supplied({ band: 'X', frequencyGHz: 8.4, txPowerW: 100, txGainDbi: 30, rxVacuumGainDbi: 74,
      systemNoiseK: 100, pointingLossDb: 1, otherLossDb: 2, implementationLossDb: 1, requiredEbN0Db: 5, rateBps: 1000 }),
    weather: supplied([{ ...stay, attenuationDb: 1, band: 'X', frequencyGHz: 8.4 }]),
    allocations: supplied([{ ...stay, rateLimitBps: 500 }]), requirements: { minimumBits: 1800000, critical: [] },
  };
}
export const assess = (e: CommunicationsEnvelope) => evaluateCommunications(e, 'test-case', stay, now);
