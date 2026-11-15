import type { LandingConfiguration } from './landing-contract';

/** Preview operating ranges, never spacecraft acceptance criteria. */
export const LANDING_RANGES = {
  targetRadiusM: [0, 100000],
  maxVerticalMps: [0, 5000],
  maxHorizontalMps: [0, 5000],
  maxTiltDeg: [0, 90],
  breakupEnergyJ: [0, 1e15],
  friction: [0, 5],
  restitution: [0, 1],
  contactPreviewSeconds: [0, 120],
} as const;
export const MAX_LANDING_OFFSET_M = 100000;

/** Whitelist all configured fields; absence remains absence on legacy imports. */
export function landingFields(value: Record<string, unknown>): {
  landing?: LandingConfiguration; eastOffsetM?: number; northOffsetM?: number;
} {
  const result: ReturnType<typeof landingFields> = {};
  for (const key of ['eastOffsetM', 'northOffsetM'] as const) {
    if (value[key] === undefined) continue;
    if (typeof value[key] !== 'number' || !Number.isFinite(value[key]) || Math.abs(value[key]) > MAX_LANDING_OFFSET_M)
      throw new RangeError(`${key} must be finite and within ±${MAX_LANDING_OFFSET_M} m`);
    result[key] = value[key];
  }
  if (value.landing === undefined) return result;
  if (!value.landing || typeof value.landing !== 'object' || Array.isArray(value.landing))
    throw new RangeError('Landing configuration must be an object');
  const supplied = value.landing as Record<string, unknown>;
  if (supplied.guidance !== 'manual' && supplied.guidance !== 'target-landing')
    throw new RangeError('Landing guidance must be manual or target-landing');
  const landing = { guidance: supplied.guidance } as LandingConfiguration;
  for (const key of Object.keys(LANDING_RANGES) as Array<keyof typeof LANDING_RANGES>) {
    const [min, max] = LANDING_RANGES[key];
    const n = supplied[key];
    if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max)
      throw new RangeError(`${key} must be finite and within [${min}, ${max}]`);
    landing[key] = n;
  }
  result.landing = landing;
  return result;
}
