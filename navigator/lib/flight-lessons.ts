import type { FlightInputs, FlightResult } from './flight';

/** Explanations of controls, not new physics or spacecraft acceptance criteria. */
export const FLIGHT_CONTROL_LESSONS: Record<string, string> = {
  'Start altitude': 'More starting height gives the engine more time to slow down. This is height above the site reference, not clearance above every nearby hill. Replay to check contact speed.',
  'Horizontal speed': 'Sideways motion also needs braking. A fast sideways approach can miss the target or hit the ground while sliding, even if downward speed is small.',
  'Vertical speed': 'Negative means falling; positive means climbing. A faster fall needs more braking distance. With other inputs fixed, compare downward speed at contact.',
  'Heading, from north': '0° is north, 90° east, 180° south and 270° west. It sets the starting sideways direction; manual guidance also points thrust this way. Assisted guidance steers toward the target itself.',
  'Initial pitch': '90° pushes straight up, 0° pushes sideways. In manual mode, upward thrust slows a fall; sideways thrust changes where you land. Assisted guidance chooses its own pitch.',
  'Final burn pitch': 'The manual engine tilts gradually from initial to final pitch during the requested burn. A higher angle gives more upward support and less sideways push. Assisted guidance ignores this setting.',
  'Wet mass': 'Total starting mass, including fuel. Raising it while keeping dry mass fixed adds fuel but makes the same engine accelerate a heavier vehicle. More fuel is not automatically an easier landing.',
  'Dry mass': 'Vehicle mass when usable fuel is gone. Raising it at fixed wet mass leaves less fuel, so thrust can stop earlier. It does not increase starting mass.',
  'Thrust': 'The maximum engine push. Too little push cannot slow the fall in time. Assisted guidance can throttle down; manual guidance uses full thrust, so too much push or a long burn can make the vehicle climb again.',
  'Specific impulse': 'Engine fuel efficiency, measured in seconds. Raising it uses less fuel for the same push; it does not make that initial push stronger.',
  'Burn duration': 'The longest time thrust is allowed. A short limit can stop the engine before landing even with fuel left. Assisted guidance chooses the throttle within this time; manual guidance fires at full thrust.',
  'Preview duration': 'How much flight time to calculate, not how long to fire the engine. If it ends before contact, a landing has not been demonstrated. Extend it to inspect what happens next.',
  'Start east offset': 'Where you start relative to the target: positive is east, negative west. A larger offset needs more sideways travel and braking. It does not move the target.',
  'Start north offset': 'Where you start relative to the target: positive is north, negative south. Changing it changes the approach distance and terrain crossed, not the target.',
  'Target radius': 'How far from the target a touchdown is allowed. Widening this only loosens the pass/fail rule; it does not steer the vehicle or fix a miss.',
  'Maximum vertical contact speed': 'The allowed up/down speed when ground contact first occurs. Raising this only loosens the verdict; the impact speed and crash motion stay the same.',
  'Maximum horizontal contact speed': 'The allowed sideways speed at first ground contact. Raising the limit does not remove sliding or change the flight.',
  'Maximum contact tilt': 'The allowed angle away from upright at contact. Raising it changes the verdict, not the vehicle attitude or stability.',
  'Breakup energy threshold': 'The demonstration energy at which the display vehicle breaks apart. Raising it changes the breakup rule, not incoming speed. This is not a measured strength of a real lander.',
  'Contact friction': 'How much the ground resists sliding after contact. More friction can reduce sliding or cause tipping. It does not brake the airborne vehicle.',
  'Contact restitution': 'How bouncy the contact is: 0 loses rebound, 1 is ideally elastic. It changes motion after contact, not incoming landing speed. Breakup can interrupt a bounce.',
  'Contact continuation': 'How many extra seconds to show after first contact. Increase it to watch settling, sliding or fragments; it does not change the approach.',
};

export type FlightExplanation = { title: string; reasons: string[] };
export function explainPublicFlight(input: FlightInputs, result: FlightResult): FlightExplanation {
  if (!result.points.length) return { title: 'Flight unavailable', reasons: ['Check the highlighted inputs before playing.'] };
  if (input.mode === 'ascent') return { title: 'Takeoff preview', reasons: [result.maxAltitudeM > input.altitudeM + 1 ? 'The vehicle gains height in this preview. Watch how pitch trades height for sideways motion; climbing does not prove it reaches orbit.' : 'The vehicle does not gain meaningful height. Check upward thrust against weight, fuel and burn time.'] };
  if (!result.contact) return { title: 'No touchdown in this preview', reasons: ['The calculated time ends without reaching the ground. The vehicle may still be flying or climbing; extend preview duration and inspect the path. This is not a successful landing.'] };
  const o = result.landingOutcome, l = input.landing;
  if (!o || !l) return { title: 'Touchdown checks unavailable', reasons: ['No configured contact limits are available. Ground contact alone is not a successful landing.'] };
  const reasons: string[] = [];
  const n = (v: number) => v.toLocaleString('en-GB', {maximumFractionDigits: 2});
  if (o.verticalMps !== null && Math.abs(o.verticalMps) > l.maxVerticalMps + 1e-9) reasons.push(`Too fast up/down: ${n(Math.abs(o.verticalMps))} m/s at contact, above your ${n(l.maxVerticalMps)} m/s limit. The engine did not remove enough vertical speed before contact.`);
  if (o.horizontalMps !== null && o.horizontalMps > l.maxHorizontalMps + 1e-9) reasons.push(`Too much sideways speed: ${n(o.horizontalMps)} m/s, above your ${n(l.maxHorizontalMps)} m/s limit. There is still sliding motion to remove.`);
  if (o.targetErrorM !== null && o.targetErrorM > l.targetRadiusM + 1e-9) reasons.push(`Missed the target: ${n(o.targetErrorM)} m away, outside your ${n(l.targetRadiusM)} m target radius. More sideways braking or a different start position may help.`);
  if (o.tiltDeg !== null && o.tiltDeg > l.maxTiltDeg + 1e-9) reasons.push(`Too tilted at contact: ${n(o.tiltDeg)}°, above your ${n(l.maxTiltDeg)}° limit. The vehicle is not upright enough for this example.`);
  const energy = .5 * result.contact.massKg * Math.hypot(...result.contact.velocityMps) ** 2;
  if (energy >= l.breakupEnergyJ) reasons.push(`Impact energy ${n(energy)} J reaches the example's ${n(l.breakupEnergyJ)} J breakup threshold. Expect illustrative fragments, not a reconstruction of real structural damage.`);
  // Failure and missing evidence can coexist. Neither must hide the other.
  if (!result.contact.terrainKnown || o.state === 'unresolved' || o.reasons.some(r => /unknown/i.test(r))) reasons.push('Ground data is missing at the contact or target. The reference sphere cannot confirm a real terrain landing.');
  if (result.fuelExhausted) reasons.push('The fuel ran out. The engine cannot brake after fuel depletion.');
  if (!reasons.length && o.state === 'within-assumed-limits') reasons.push('Contact speed, distance from target, tilt and impact energy meet the limits entered for this example. Watch the continuation for sliding or tipping; this does not certify a real landing.');
  if (!reasons.length) reasons.push(...o.reasons);
  return {title: o.state === 'within-assumed-limits' ? 'Within this example’s touchdown limits' : o.state === 'unresolved' ? 'Landing cannot be confirmed' : 'Landing misses this example’s limits', reasons};
}

export type FlightEdit = {label: string; before: string | number; after: string | number; explanation: string};
export function flightEdits(before: FlightInputs, after: FlightInputs): FlightEdit[] {
  const labels: Partial<Record<keyof FlightInputs, string>> = {mode:'Flight mode', altitudeM:'Start altitude', horizontalMps:'Horizontal speed', verticalMps:'Vertical speed', headingDeg:'Heading, from north', pitchDeg:'Initial pitch', finalPitchDeg:'Final burn pitch', wetMassKg:'Wet mass', dryMassKg:'Dry mass', thrustN:'Thrust', ispSeconds:'Specific impulse', burnSeconds:'Burn duration', durationSeconds:'Preview duration', eastOffsetM:'Start east offset', northOffsetM:'Start north offset'};
  const edits: FlightEdit[] = [];
  for (const [key, label] of Object.entries(labels)) {
    const k = key as keyof FlightInputs, a = before[k], b = after[k];
    if (a === b || a === undefined || b === undefined || typeof a === 'object' || typeof b === 'object') continue;
    edits.push({label, before:a, after:b, explanation: FLIGHT_CONTROL_LESSONS[label!] ?? 'The flight mode changed. Compare a launch with a landing as separate tasks.'});
  }
  const landingLabels = {guidance:'Guidance',targetRadiusM:'Target radius',maxVerticalMps:'Maximum vertical contact speed',maxHorizontalMps:'Maximum horizontal contact speed',maxTiltDeg:'Maximum contact tilt',breakupEnergyJ:'Breakup energy threshold',friction:'Contact friction',restitution:'Contact restitution',contactPreviewSeconds:'Contact continuation'} as const;
  if (before.landing && after.landing) for (const [key,label] of Object.entries(landingLabels)) {
    const k = key as keyof typeof landingLabels, a = before.landing[k], b = after.landing[k];
    if (a !== b) edits.push({label,before:a,after:b,explanation:FLIGHT_CONTROL_LESSONS[label] ?? 'Assisted guidance chooses steering and throttle. Manual mode uses your pitch schedule at full thrust.'});
  }
  return edits;
}
