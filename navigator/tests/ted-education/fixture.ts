import { readFileSync } from 'node:fs';
import { decodeCatalog } from '../../lib/catalog';
import { parseEvidenceManifest } from '../../lib/provenance';
import { parseScenario } from '../../lib/scenario';
import { DEFAULT_MISSION } from '../../lib/mission';
import { DEFAULT_FLIGHT } from '../../lib/flight';

export const catalog = decodeCatalog(JSON.parse(readFileSync('public/data/catalog.json', 'utf8')));
export const manifest = parseEvidenceManifest(JSON.parse(readFileSync('public/data/evidence-manifest.json', 'utf8')));
export const state = parseScenario({ siteId: catalog.sites[0].id, custom: null, startIndex: 100, endIndex: 110,
  heightM: 2, mission: DEFAULT_MISSION, flight: DEFAULT_FLIGHT },
{ siteIds: catalog.sites.map(site => site.id), samples: catalog.meta.n })!;
