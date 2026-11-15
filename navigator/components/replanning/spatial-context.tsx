'use client';
import { memo, useMemo } from 'react';
import { GlobalMap } from '@/components/global-map';
import type { Site } from '@/lib/catalog';
import type { PreparedCase, ReplanningCase } from '@/lib/replanning/model';
import styles from './workspace.module.css';

export const SpatialContext = memo(function SpatialContext({ reference, candidate, onUse }: { reference: PreparedCase; candidate: PreparedCase; onUse(item: ReplanningCase): void }) {
  const pins = useMemo<Site[]>(() => [reference, candidate].map((item, i) => ({ ...item.context.site, ...item.context.location, id: i === 0 ? 'replan-reference' : 'replan-candidate', name: `${i === 0 ? 'Reference' : 'Candidate'} · ${item.state.custom ? 'custom point' : item.context.site.name}` })), [reference, candidate]);
  return <section className={styles.section} aria-label="Reference and candidate spatial context"><h3>Where did the plan move?</h3><div className={styles.map}><GlobalMap sites={pins} selectedId="replan-candidate" compareIds={['replan-reference']} custom={null} onSelect={id => { if (id === 'replan-reference') onUse(reference); }} onPlace={(lat, lon) => onUse({ ...candidate, id: 'map-point', name: 'Custom point from comparison map', state: { ...candidate.state, custom: { lat, lon } } })} /></div><p>Reference: {reference.context.location.lat.toFixed(5)}°, {reference.context.location.lon.toFixed(5)}°E. Candidate: {candidate.context.location.lat.toFixed(5)}°, {candidate.context.location.lon.toFixed(5)}°E. {reference.context.location.lat === candidate.context.location.lat && reference.context.location.lon === candidate.context.location.lon ? 'Both cases occupy the same coordinate.' : 'Pins show actual selected coordinates.'} Select the reference pin to reuse its exact case; select bare map surface to preview a custom candidate with the current equipment and dates. The atlas is visual context; it does not identify a terrain occluder or certify landing hazards. Borrowed/coarse/missing horizon evidence stays visible in each case.</p></section>;
});
