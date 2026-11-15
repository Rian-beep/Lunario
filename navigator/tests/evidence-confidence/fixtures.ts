import { readFileSync } from 'node:fs';
import { decodeCatalog } from '../../lib/catalog';
import { DEFAULT_MISSION } from '../../lib/mission';
import { DEFAULT_FLIGHT } from '../../lib/flight';
import { DEFAULT_OPERATIONS, DEFAULT_REQUIREMENTS, type EvidenceManifest } from '../../lib/planning-types';
import type { ScenarioState } from '../../lib/scenario';
import type { Provenance } from '../../lib/engineering-evidence/types';
export const catalog = decodeCatalog(JSON.parse(readFileSync('public/data/catalog.json', 'utf8')));
export const manifest = JSON.parse(readFileSync('public/data/evidence-manifest.json', 'utf8')) as EvidenceManifest;
export const provenance: Provenance = { title: 'Synthetic load exploration', sourceUrl: 'user:test', author: 'Regression fixture', issuedUtc: '2026-11-15T00:00:00Z', kind: 'user-assumption', notes: 'Test inputs only, no hardware measurement or qualification' };
export function scenario(): ScenarioState {
  return { schemaVersion: 2, siteId: 'connecting-ridge', custom: null, startIndex: 0, endIndex: 3, heightM: 2, arrayHeightM: 2, antennaHeightM: 10, mission: { ...DEFAULT_MISSION }, flight: { ...DEFAULT_FLIGHT }, requirements: structuredClone(DEFAULT_REQUIREMENTS), operations: structuredClone(DEFAULT_OPERATIONS) };
}
