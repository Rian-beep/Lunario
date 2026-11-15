import { LUNAR_MU, type FlightInputs, type FlightPoint, type FlightResult } from './flight';
import type { LandingContact, LandingEnvironment, LandingOutcome } from './landing-contract';

type Vec = [number, number, number];
type State = { r: Vec; v: Vec; mass: number };
type Terrain = ((eastM: number, northM: number) => number | null) | undefined;
const G0 = 9.80665;
// NASA Moon Fact Sheet, sidereal rotation period 655.720 h (not the solar day).
// https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html
export const LUNAR_SIDEREAL_RATE_RAD_S = 2 * Math.PI / (655.720 * 3600);
const add = (a: Vec, b: Vec, scale = 1): Vec => a.map((n, i) => n + scale * b[i]) as Vec;
const dot = (a: Vec, b: Vec) => a.reduce((s, n, i) => s + n * b[i], 0);
const norm = (a: Vec) => Math.hypot(...a);
const unit = (a: Vec): Vec => a.map(n => n / norm(a)) as Vec;
// E/up/N is LEFT handed: negate the ordinary coordinate cross product.
// All state vectors are Moon-centred, expressed in the selected site's axes.
const crossEUN = (a: Vec, b: Vec): Vec => [
  a[2] * b[1] - a[1] * b[2],
  a[0] * b[2] - a[2] * b[0],
  a[1] * b[0] - a[0] * b[1],
];

/** Great-circle surface arc on the supplied reference sphere; not flat downrange. */
export function landingTargetDistanceM(eastM: number, northM: number, yM: number, radiusM: number): number {
  return radiusM * Math.atan2(Math.hypot(eastM, northM), radiusM + yM);
}
function height(terrain: Terrain, r: Vec): number | null {
  const h = terrain?.(r[0], r[2]);
  return typeof h === 'number' && Number.isFinite(h) ? h : null;
}
function clearance(terrain: Terrain, r: Vec, radius: number): number {
  const h = height(terrain, r);
  // A finite negative crater floor overrides the reference sphere too.
  return h === null ? norm(r) - radius : r[1] - radius - h;
}
function slope(terrain: Terrain, r: Vec): number | null {
  const samples = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([e, n]) => height(terrain, [r[0] + e, r[1], r[2] + n]));
  if (samples.some(h => h === null)) return null;
  const [ep, em, np, nm] = samples as number[];
  return Math.atan(Math.hypot((ep - em) / 2, (np - nm) / 2)) * 180 / Math.PI;
}
function outcome(contact: LandingContact | undefined, a: FlightInputs, targetKnown: boolean, radius: number): LandingOutcome {
  const limits = a.landing!;
  if (!contact) return {
    state: 'outside-assumed-limits', reasons: ['No modeled landing within the requested flight duration.'],
    verticalMps: null, horizontalMps: null, tiltDeg: null, targetErrorM: null,
  };
  const radial = unit([contact.eastM, contact.yM + radius, contact.northM]);
  const verticalMps = dot(contact.velocityMps, radial);
  const horizontalMps = norm(add(contact.velocityMps, radial, -verticalMps));
  const reasons: string[] = [];
  if (Math.abs(verticalMps) > limits.maxVerticalMps + 1e-9)
    reasons.push(`Incoming radial vertical speed ${verticalMps.toFixed(3)} m/s exceeds the entered magnitude limit ${limits.maxVerticalMps} m/s.`);
  if (horizontalMps > limits.maxHorizontalMps + 1e-9)
    reasons.push(`Incoming horizontal speed ${horizontalMps.toFixed(3)} m/s exceeds the entered limit ${limits.maxHorizontalMps} m/s.`);
  if (contact.tiltDeg > limits.maxTiltDeg + 1e-9)
    reasons.push(`Ideal attitude tilt ${contact.tiltDeg.toFixed(3)}° from radial vertical exceeds the entered limit ${limits.maxTiltDeg}°.`);
  if (contact.targetErrorM > limits.targetRadiusM + 1e-9)
    reasons.push(`Reference-sphere surface target error ${contact.targetErrorM.toFixed(3)} m exceeds the entered radius ${limits.targetRadiusM} m.`);
  const incomingEnergyJ = 0.5 * contact.massKg * norm(contact.velocityMps) ** 2;
  if (incomingEnergyJ >= limits.breakupEnergyJ)
    reasons.push(`Incoming translational kinetic energy ${incomingEnergyJ.toFixed(3)} J reaches the entered breakup threshold ${limits.breakupEnergyJ} J.`);
  const failed = reasons.length > 0;
  if (!contact.terrainKnown) reasons.push('Numerical terrain height at contact is unknown; this is only reference-sphere contact.');
  if (!targetKnown) reasons.push(`Numerical terrain height at the selected target is unknown.${limits.guidance === 'target-landing' ? ' Guidance uses reference height zero.' : ''}`);
  if (!failed && contact.terrainKnown && targetKnown)
    reasons.push('Within the entered speed, ideal tilt, target-radius and breakup-energy limits on known numerical terrain. This is a preview requirement result, not landing certification.');
  return {
    state: failed ? 'outside-assumed-limits' : contact.terrainKnown && targetKnown ? 'within-assumed-limits' : 'unresolved',
    reasons, verticalMps, horizontalMps, tiltDeg: contact.tiltDeg, targetErrorM: contact.targetErrorM,
  };
}

/** Configured contact path; the absent-configuration legacy solver stays untouched. */
export function simulateConfiguredLanding(
  a: FlightInputs, terrain: Terrain, radius: number, environment?: LandingEnvironment,
): FlightResult {
  const configuration = a.landing!;
  let omega: Vec = [0, 0, 0];
  if (environment !== undefined) {
    const rate = environment.rotationRateRadS ?? LUNAR_SIDEREAL_RATE_RAD_S;
    if (!Number.isFinite(environment.latitudeDeg) || Math.abs(environment.latitudeDeg) > 90 ||
        !Number.isFinite(rate) || Math.abs(rate) > 1e-4)
      throw new RangeError('Landing latitude must be within ±90° and rotation rate within ±0.0001 rad/s');
    const lat = environment.latitudeDeg * Math.PI / 180;
    omega = [0, rate * Math.sin(lat), rate * Math.cos(lat)];
  }
  const heading = a.headingDeg * Math.PI / 180;
  let state: State = {
    r: [a.eastOffsetM ?? 0, radius + a.altitudeM, a.northOffsetM ?? 0],
    v: [Math.sin(heading) * a.horizontalMps, a.verticalMps, Math.cos(heading) * a.horizontalMps],
    mass: a.wetMassKg,
  };
  const targetHeight = height(terrain, [0, radius, 0]);
  const naturalAcceleration = (r: Vec, v: Vec): Vec => {
    const gravity = r.map(n => -LUNAR_MU * n / norm(r) ** 3) as Vec;
    // a_rot = a_inertial − 2 Ω×v_rot − Ω×(Ω×r), constant spin, Moon-centred origin.
    return add(add(gravity, crossEUN(omega, v), -2), crossEUN(omega, crossEUN(omega, r)), -1);
  };
  let attitude: Vec = unit(state.r);
  const command = (s: State, t: number): Vec => {
    const up = unit(s.r);
    let acceleration: Vec;
    if (configuration.guidance === 'target-landing') {
      const localHeight = height(terrain, s.r);
      const aboveGround = Math.min(s.r[1] - radius - (targetHeight ?? 0),
        localHeight === null ? Infinity : s.r[1] - radius - localHeight);
      // Descend at ≤8 m/s, slow over the last 128 m, then meet ground at 0.5 m/s.
      // Horizontal critically damped feedback targets the selected point, not the start.
      const desiredDown = Math.max(0.5, Math.min(8, Math.sqrt(Math.max(0, 0.5 * aboveGround))));
      const desired: Vec = [-0.01 * s.r[0] - 0.2 * s.v[0], 1.5 * (-desiredDown - s.v[1]), -0.01 * s.r[2] - 0.2 * s.v[2]];
      acceleration = add(desired, naturalAcceleration(s.r, s.v), -1);
    } else {
      const tang = add([Math.sin(heading), 0, Math.cos(heading)], up, -dot([Math.sin(heading), 0, Math.cos(heading)], up));
      const pitch = (a.pitchDeg + (a.finalPitchDeg - a.pitchDeg) * Math.min(1, t / Math.max(1, a.burnSeconds))) * Math.PI / 180;
      acceleration = add(up.map(n => n * Math.sin(pitch)) as Vec, unit(tang), Math.cos(pitch));
    }
    if (norm(acceleration) > 1e-12) attitude = unit(acceleration);
    if (t >= a.burnSeconds - 1e-10 || s.mass <= a.dryMassKg || a.thrustN === 0) return [0, 0, 0];
    const requestedForce = configuration.guidance === 'manual' ? a.thrustN : norm(acceleration) * s.mass;
    return attitude.map(n => n * Math.min(a.thrustN, requestedForce)) as Vec;
  };
  // Hold a commanded force for ≤0.1 s; RK4 integrates gravity, rotating terms and mass.
  const advance = (s: State, force: Vec, dt: number): State => {
    const flow = norm(force) / (a.ispSeconds * G0);
    const acceleration = (r: Vec, v: Vec, elapsed: number) => add(naturalAcceleration(r, v), force, 1 / Math.max(a.dryMassKg, s.mass - flow * elapsed));
    const k1r = s.v, k1v = acceleration(s.r, s.v, 0);
    const k2r = add(s.v, k1v, dt / 2), k2v = acceleration(add(s.r, k1r, dt / 2), k2r, dt / 2);
    const k3r = add(s.v, k2v, dt / 2), k3v = acceleration(add(s.r, k2r, dt / 2), k3r, dt / 2);
    const k4r = add(s.v, k3v, dt), k4v = acceleration(add(s.r, k3r, dt), k4r, dt);
    return {
      r: s.r.map((n, i) => n + dt / 6 * (k1r[i] + 2 * k2r[i] + 2 * k3r[i] + k4r[i])) as Vec,
      v: s.v.map((n, i) => n + dt / 6 * (k1v[i] + 2 * k2v[i] + 2 * k3v[i] + k4v[i])) as Vec,
      mass: Math.max(a.dryMassKg, s.mass - flow * dt),
    };
  };
  let t = 0;
  const point = (force: Vec): FlightPoint => ({
    t, eastM: state.r[0], northM: state.r[2], yM: state.r[1] - radius,
    altitudeM: norm(state.r) - radius, speedMps: norm(state.v), verticalMps: dot(state.v, unit(state.r)),
    massKg: state.mass, positionM: [...state.r], velocityMps: [...state.v], powered: norm(force) > 0,
  });
  const initialForce = command(state, 0);
  const points = [point(initialForce)];
  let maxAltitudeM = points[0].altitudeM;
  let status: FlightResult['status'] = 'coasting';
  let contact: LandingContact | undefined;
  const recordContact = () => {
    const terrainHeightM = height(terrain, state.r);
    maxAltitudeM = Math.max(maxAltitudeM, norm(state.r) - radius);
    const up = unit(state.r);
    contact = {
      timeS: t, eastM: state.r[0], northM: state.r[2], yM: state.r[1] - radius,
      velocityMps: [...state.v], massKg: state.mass, terrainHeightM, terrainKnown: terrainHeightM !== null,
      slopeDeg: slope(terrain, state.r), tiltDeg: Math.acos(Math.max(-1, Math.min(1, dot(attitude, up)))) * 180 / Math.PI,
      headingDeg: Math.hypot(attitude[0], attitude[2]) > 1e-9 ? (Math.atan2(attitude[0], attitude[2]) * 180 / Math.PI + 360) % 360 : a.headingDeg,
      targetErrorM: landingTargetDistanceM(state.r[0], state.r[2], state.r[1] - radius, radius),
    };
    status = contact.terrainKnown ? 'terrain contact' : 'reference contact';
  };
  const initialClearance = clearance(terrain, state.r, radius);
  if (initialClearance < -1e-6) throw new RangeError('Flight starts below the numerical surface');
  if (initialClearance <= 0) recordContact();
  while (!contact && t < a.durationSeconds - 1e-9) {
    const force = command(state, t);
    const flow = norm(force) / (a.ispSeconds * G0);
    let dt = Math.min(0.1, a.durationSeconds - t);
    if (t < a.burnSeconds && t + dt > a.burnSeconds) dt = a.burnSeconds - t;
    if (flow > 0) dt = Math.min(dt, (state.mass - a.dryMassKg) / flow);
    if (!Number.isFinite(dt) || dt <= 0 || t + dt === t)
      throw new RangeError('Vehicle parameters produce an unrepresentable integration step');
    const before = state;
    // Sample inside the integration step too; refine the first bracket with the
    // same RK4 state, never linear-interpolate a zeroed or penetrated impact.
    let lo = 0;
    let hit = false;
    for (let sample = 1; sample <= 4; sample++) {
      const hi = dt * sample / 4;
      const candidate = advance(before, force, hi);
      if (![...candidate.r, ...candidate.v, candidate.mass].every(Number.isFinite))
        throw new RangeError('Vehicle parameters exceed finite integration precision');
      if (clearance(terrain, candidate.r, radius) <= 0) {
        let upper = hi;
        for (let iteration = 0; iteration < 40; iteration++) {
          const mid = (lo + upper) / 2;
          if (clearance(terrain, advance(before, force, mid).r, radius) > 0) lo = mid;
          else upper = mid;
        }
        // Safe side of the root preserves nonpenetration to floating precision.
        state = advance(before, force, lo);
        t += lo;
        recordContact();
        points.push(point(force));
        hit = true;
        break;
      }
      lo = hi;
    }
    if (hit) break;
    state = advance(before, force, dt);
    t += dt;
    maxAltitudeM = Math.max(maxAltitudeM, norm(state.r) - radius);
    if (t - points.at(-1)!.t >= 0.5 - 1e-9 || t >= a.durationSeconds - 1e-9) points.push(point(force));
  }
  if (!contact && t >= a.burnSeconds && a.burnSeconds > 0) status = 'burn complete';
  const frame = environment
    ? `Moon-fixed east/up/north frame; Coriolis and centrifugal acceleration at latitude ${environment.latitudeDeg}°, constant spin ${environment.rotationRateRadS ?? LUNAR_SIDEREAL_RATE_RAD_S} rad/s (default NASA sidereal period 655.720 h).`
    : 'Fixed nonrotating east/up/north frame; lunar rotation omitted.';
  return {
    points, status, maxAltitudeM, contact, landingOutcome: outcome(contact, a, targetHeight !== null, radius),
    previewEndTimeS: contact ? contact.timeS + configuration.contactPreviewSeconds : t,
    initialThrustToWeight: a.thrustN / (a.wetMassKg * LUNAR_MU / norm(points[0].positionM) ** 2),
    fuelExhausted: a.thrustN > 0 && state.mass <= a.dryMassKg + 1e-9,
    deltaVMps: a.ispSeconds * G0 * Math.log(a.wetMassKg / state.mass),
    model: `3-DoF RK4 central lunar gravity; ≤0.1 s force commands. ${frame} ${configuration.guidance === 'target-landing' ? 'Ideal instantaneous attitude and continuously variable throttle, bounded by configured thrust, burn time and propellant; target feedback with descending speed schedule.' : 'Manual full-thrust linear pitch schedule with ideal instantaneous attitude.'} Target error is a reference-sphere great-circle surface arc in metres; terrain heights and E/up/N contact velocity use the same local numerical frame. Tilt is from radial vertical; slope uses a 2 m centred numerical difference, not a footprint assessment. Collision probes are at most 0.025 s apart with refined crossings; unresolved terrain features between probes are not certified. No Apollo GNC, attitude dynamics, tides, soil or qualified 6-DoF model. Friction, restitution and breakup energy apply to the downstream contact continuation, not airborne guidance.`,
  };
}
