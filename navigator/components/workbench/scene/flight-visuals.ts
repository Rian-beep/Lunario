import * as T from 'three';
import type { TerrainChoice } from '@/lib/astro';
import { siteNavigationKey } from '@/lib/site-transition';
import { flightVector, skyDirection } from './surface';

/** Flight ENU is relative to its simulation radius; the renderer keeps its mount radius. */
export function flightPointInFrame(point: { eastM: number; northM: number; yM: number }, referenceHeightM: number, mountedHeightM: number) {
  const vector = flightVector(point);
  vector.y += (referenceHeightM - mountedHeightM) / 1000;
  return vector;
}

/** Unknown samples break the line; never bridge a missing horizon sector. */
export function horizonSegments(horizon: Pick<TerrainChoice, 'mask' | 'stepDeg'>) {
  const points: T.Vector3[] = [];
  for (let i = 0; i < horizon.mask.length; i++) {
    const j = (i + 1) % horizon.mask.length;
    const a = horizon.mask[i], b = horizon.mask[j];
    if (Number.isFinite(a) && Number.isFinite(b)) points.push(
      skyDirection(i * horizon.stepDeg, a).multiplyScalar(200),
      skyDirection(j * horizon.stepDeg, b).multiplyScalar(200));
  }
  return points;
}

/** Only immutable scene resources or a site-frame transition require a remount. */
export function sceneResourcesChanged(before: { terrain: unknown; imagery?: unknown; map: unknown; lat: number; lon: number } | null,
  after: { terrain: unknown; imagery?: unknown; map: unknown; lat: number; lon: number }) {
  return !before || before.terrain !== after.terrain || before.imagery !== after.imagery || before.map !== after.map ||
    siteNavigationKey(before.lat, before.lon) !== siteNavigationKey(after.lat, after.lon);
}
