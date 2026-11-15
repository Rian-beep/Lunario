import catalogue from "../public/data/stars.json";

export type Star = {
  id: string;
  name: string;
  raDeg: number;
  decDeg: number;
  magnitude: number;
};

/** Real HYG v4.1 stars, V <= 4.0, embedded for offline use. See docs/STARS.md. */
export const BRIGHT_STARS: readonly Star[] = Object.freeze(
  catalogue.stars.map((star) => Object.freeze(star)),
);

const RAD = Math.PI / 180;
const J2000_MS = Date.UTC(2000, 0, 1, 12);

/** Unit direction: +X J2000 equinox, +Y RA 90 degrees, +Z north pole. */
export function starDirectionJ2000(star: Star): [number, number, number] {
  if (!Number.isFinite(star.raDeg) || star.raDeg < 0 || star.raDeg >= 360 ||
      !Number.isFinite(star.decDeg) || Math.abs(star.decDeg) > 90) {
    throw new RangeError("Star coordinates require finite RA in [0, 360) and declination in [-90, 90] degrees.");
  }
  const ra = star.raDeg * RAD, dec = star.decDeg * RAD;
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}

// naif0012.tls DELTET/DELTA_AT: effective UTC dates; offsets are 10 + index seconds.
const LEAP_DATES = [
  "1972-01-01", "1972-07-01", "1973-01-01", "1974-01-01", "1975-01-01", "1976-01-01",
  "1977-01-01", "1978-01-01", "1979-01-01", "1980-01-01", "1981-07-01", "1982-07-01",
  "1983-07-01", "1985-07-01", "1988-01-01", "1990-01-01", "1991-01-01", "1992-07-01",
  "1993-07-01", "1994-07-01", "1996-01-01", "1997-07-01", "1999-01-01", "2006-01-01",
  "2009-01-01", "2012-07-01", "2015-07-01", "2017-01-01",
].map((date) => Date.parse(`${date}T00:00:00Z`));

function tdbDaysSinceJ2000(epochMs: number): number {
  if (!Number.isFinite(epochMs) || epochMs < LEAP_DATES[0] || epochMs > 8.64e15) {
    throw new RangeError("Star display epoch must be UTC Unix milliseconds on or after 1972-01-01 within the JavaScript Date range.");
  }
  let leapIndex = LEAP_DATES.length - 1;
  while (epochMs < LEAP_DATES[leapIndex]) leapIndex--;
  const ttSeconds = (epochMs - J2000_MS) / 1000 + 10 + leapIndex + 32.184;
  let tdbSeconds = ttSeconds;
  // naif0012.tls DELTET model: solve the small periodic term in TDB, radians.
  for (let i = 0; i < 3; i++) {
    const m = 6.239996 + 1.99096871e-7 * tdbSeconds;
    tdbSeconds = ttSeconds + 0.001657 * Math.sin(m + 0.01671 * Math.sin(m));
  }
  return tdbSeconds / 86400;
}

// pck00011.tpc: BODY3_NUT_PREC_ANGLES, degrees and degrees / Julian century.
const PHASES = [
  [125.045, -1935.5364525], [250.089, -3871.072905], [260.008, 475263.3328725],
  [176.625, 487269.629985], [357.529, 35999.0509575], [311.589, 964468.49931],
  [134.963, 477198.869325], [276.617, 12006.300765], [34.226, 63863.5132425],
  [15.134, -5806.6093575], [119.743, 131.84064], [239.961, 6003.1503825],
  [25.053, 473327.79642],
] as const;
const POLE_RA = [-3.8787, -0.1204, 0.0700, -0.0172, 0, 0.0072, 0, 0, 0, -0.0052, 0, 0, 0.0043];
const POLE_DEC = [1.5419, 0.0239, -0.0278, 0.0068, 0, -0.0029, 0.0009, 0, 0, 0.0008, 0, 0, -0.0009];
const PRIME_MERIDIAN = [3.5610, 0.1208, -0.0642, 0.0158, 0.0252, -0.0066, -0.0047, -0.0046, 0.0028, 0.0052, 0.0040, 0.0019, -0.0044];

/**
 * Approximate IAU_MOON direction for display, not navigation or assessment.
 * +X prime meridian, +Y 90 degrees east, +Z north; distinct from DE421 MOON_ME.
 * UTC Unix milliseconds use naif0012 time conversion (last leap: 2017-01-01).
 * IAU 2009 lunar model retained in pck00011; no stellar proper motion,
 * parallax, aberration or light deflection. Scope and sources: docs/STARS.md.
 */
export function moonFixedStarDirection(star: Star, epochMs: number): [number, number, number] {
  const [x, y, z] = starDirectionJ2000(star);
  const d = tdbDaysSinceJ2000(epochMs), t = d / 36525;
  let ra = 269.9949 + 0.0031 * t;
  let dec = 66.5392 + 0.0130 * t;
  let w = 38.3213 + 13.17635815 * d - 1.4e-12 * d * d;
  for (let i = 0; i < PHASES.length; i++) {
    const phase = ((PHASES[i][0] + PHASES[i][1] * t) % 360) * RAD;
    ra += POLE_RA[i] * Math.sin(phase);
    dec += POLE_DEC[i] * Math.cos(phase);
    w += PRIME_MERIDIAN[i] * Math.sin(phase);
  }
  // Passive rotations R3(W) R1(90 - dec) R3(90 + ra), per NAIF PCK.
  const a = (90 + ra) * RAD, b = (90 - dec) * RAD, c = (w % 360) * RAD;
  const x1 = Math.cos(a) * x + Math.sin(a) * y;
  const y1 = -Math.sin(a) * x + Math.cos(a) * y;
  const y2 = Math.cos(b) * y1 + Math.sin(b) * z;
  const z2 = -Math.sin(b) * y1 + Math.cos(b) * z;
  return [Math.cos(c) * x1 + Math.sin(c) * y2, -Math.sin(c) * x1 + Math.cos(c) * y2, z2];
}
