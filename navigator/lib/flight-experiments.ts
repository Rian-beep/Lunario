import { DEFAULT_FLIGHT, LUNAR_MU, type FlightInputs, type FlightResult } from './flight';
import { createLandingFlight } from './landing-presets';

export const FLIGHT_EXPERIMENTS = [
  { id: 'assisted', title: 'Assisted 300 m approach', predict: 'Can the vehicle remove its downward and sideways speed before reaching the target?', change: 'Load this reference, then reduce only thrust. Watch contact speed and target error.', reference: 'On synthetic flat terrain, the reference meets its entered incoming-contact limits.' },
  { id: 'manual', title: 'Manual powered descent', predict: 'Will a short upward burn stop the descent, or only delay contact?', change: 'Change only burn duration from 12 s to 8 s. Compare incoming vertical speed.', reference: 'On synthetic flat terrain, this short full-thrust burn ends before contact; it is not a soft landing.' },
  { id: 'ascent', title: 'Ascent reference', predict: 'How does pitching toward the horizon trade height for sideways speed?', change: 'Change only final burn pitch from 35° to 60°. Compare maximum altitude.', reference: 'On synthetic flat terrain, this reference climbs; it does not model an Earth–Moon transfer or orbit insertion.' },
  { id: 'underpowered', title: 'Underpowered descent', predict: 'Can assisted guidance land when maximum thrust is below initial lunar weight?', change: 'Change only thrust from 4,000 N to 16,000 N. Compare incoming contact and fuel state.', reference: 'On synthetic flat terrain, this reference exceeds its entered incoming-contact limits.' },
  { id: 'sideways', title: 'Sideways / overshoot', predict: 'Can the same engine remove a much larger sideways speed within 300 m of height?', change: 'Change only horizontal speed from 100 m/s to 10 m/s. Compare sideways contact speed and target error.', reference: 'On synthetic flat terrain, the high-speed reference misses its entered incoming-contact limits.' },
  { id: 'contact', title: 'Bounce / contact experiment', predict: 'After an unpowered drop, how does restitution change the rebound?', change: 'Change only contact restitution from 0.65 to 0.1. Replay and observe the contact continuation.', reference: 'On synthetic flat terrain, incoming energy is below the entered breakup threshold. Rebound is a separate contact continuation, not an airborne result.' },
] as const;
export type FlightExperimentId = typeof FLIGHT_EXPERIMENTS[number]['id'];

/** Explicit reference loading only: fresh example hardware, never a site/camera effect. */
export function createFlightExperiment(id: FlightExperimentId): FlightInputs {
  const base = createLandingFlight({ ...DEFAULT_FLIGHT }, true);
  switch (id) {
    case 'ascent': return { ...DEFAULT_FLIGHT };
    case 'assisted': return base;
    case 'underpowered': return { ...base, thrustN: 4000 };
    case 'sideways': return { ...base, horizontalMps: 100 };
    case 'manual': return { ...base, altitudeM: 100, eastOffsetM: 0, horizontalMps: 0, verticalMps: -8, thrustN: 10000, burnSeconds: 12, durationSeconds: 90, landing: { ...base.landing, guidance: 'manual' } };
    case 'contact': return { ...base, altitudeM: 3, eastOffsetM: 0, horizontalMps: 0, verticalMps: -1, thrustN: 0, burnSeconds: 0, durationSeconds: 30, landing: { ...base.landing, guidance: 'manual', restitution: 0.65 } };
  }
}

export type FlightDiagnostics = {
  gravityMps2: number | null;
  thrustToWeight: number | null;
  uprightNetMps2: number | null;
  stoppingDistanceM: number | null;
  stoppingUnavailable: string | null;
  idealRemainingDeltaVMps: number | null;
  remainingPropellantKg: number | null;
};
const finite = (n: number | undefined): n is number => n !== undefined && Number.isFinite(n);

/** Algebraic intuition only; never replaces the integrated guidance/contact verdict. */
export function flightDiagnostics(input: FlightInputs, result: FlightResult): FlightDiagnostics {
  const first = result.points[0], last = result.points.at(-1);
  const radius = first && Math.hypot(...first.positionM);
  const g = finite(radius) && radius > 0 ? LUNAR_MU / radius ** 2 : null;
  const validVehicle = finite(input.wetMassKg) && input.wetMassKg > 0 && finite(input.dryMassKg) && input.dryMassKg > 0 && input.dryMassKg <= input.wetMassKg && finite(input.thrustN) && input.thrustN >= 0;
  const net = validVehicle && g !== null ? input.thrustN / input.wetMassKg - g : null;
  let stoppingUnavailable: string | null = null;
  if (!first || !finite(first.verticalMps) || first.verticalMps >= 0) stoppingUnavailable = 'Requires an incoming downward radial speed.';
  else if (!validVehicle || !finite(input.burnSeconds) || input.burnSeconds <= 0 || input.wetMassKg <= input.dryMassKg || input.thrustN <= 0) stoppingUnavailable = 'No initial powered braking: check thrust, propellant and burn time.';
  else if (net === null || net <= 0) stoppingUnavailable = 'Maximum upright thrust does not exceed initial lunar weight; no positive net stopping deceleration.';
  const distance = stoppingUnavailable === null && net !== null ? first.verticalMps ** 2 / (2 * net) : null;
  const validRemaining = validVehicle && last && finite(last.massKg) && last.massKg >= input.dryMassKg && last.massKg <= input.wetMassKg && finite(input.ispSeconds) && input.ispSeconds > 0;
  const dv = validRemaining ? input.ispSeconds * 9.80665 * Math.log(last.massKg / input.dryMassKg) : null;
  return {
    gravityMps2: g, thrustToWeight: validVehicle && g !== null ? input.thrustN / (input.wetMassKg * g) : null,
    uprightNetMps2: net, stoppingDistanceM: distance !== null && Number.isFinite(distance) ? distance : null,
    stoppingUnavailable: distance !== null && !Number.isFinite(distance) ? 'Outside finite calculation precision.' : stoppingUnavailable,
    idealRemainingDeltaVMps: dv !== null && Number.isFinite(dv) ? dv : null,
    remainingPropellantKg: validRemaining ? last.massKg - input.dryMassKg : null,
  };
}

export function flightFuelReason(input: FlightInputs, result: FlightResult): string {
  if (result.fuelExhausted) return 'Propellant exhausted in the actual integration.';
  if (input.thrustN === 0) return 'No thrust requested; remaining propellant cannot brake this attempt.';
  if (input.burnSeconds === 0) return 'Powered time is zero; this attempt is unpowered.';
  const end = result.points.at(-1)?.t;
  if (end === undefined) return 'Fuel history unavailable.';
  if (result.contact && end < input.burnSeconds) return 'Contact ended the airborne integration before the powered-time limit; propellant remains.';
  if (end >= input.burnSeconds) return 'Powered-time limit reached; remaining propellant is not automatically used.';
  return 'Preview ended before the powered-time limit; remaining propellant is not a landing guarantee.';
}
