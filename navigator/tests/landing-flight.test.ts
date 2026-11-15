import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_FLIGHT, LUNAR_MU, MOON_RADIUS_M, simulateFlight, type FlightInputs } from '../lib/flight';
import { createLandingFlight } from '../lib/landing-presets';
import { landingTargetDistanceM, LUNAR_SIDEREAL_RATE_RAD_S } from '../lib/landing-flight';

const preset = () => createLandingFlight(DEFAULT_FLIGHT);
const flat = () => 0;
const close = (actual: number, expected: number, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} versus ${expected}`);

test('assisted 300 m terminal approach descends monotonically to the selected target within the entered limits', () => {
  const a = preset();
  const r = simulateFlight(a, flat);
  assert.equal(r.status, 'terrain contact');
  assert.equal(r.landingOutcome?.state, 'within-assumed-limits');
  assert.ok(r.points.length > 50);
  close(r.points[0].eastM, -300);
  close(r.points[0].velocityMps[0], 10);
  close(r.points[0].verticalMps, -8, 0.01);
  for (let i = 1; i < r.points.length; i++) {
    assert.ok(r.points[i].altitudeM <= r.points[i - 1].altitudeM, 'no outward hump');
    assert.ok(r.points[i].yM >= 0, 'no terrain penetration');
    assert.ok(r.points[i].massKg <= r.points[i - 1].massKg);
    assert.ok(r.points[i].massKg >= a.dryMassKg);
  }
  const c = r.contact!;
  assert.ok(c.timeS > 30 && c.timeS < 100);
  assert.ok(c.targetErrorM < a.landing.targetRadiusM);
  assert.ok(r.landingOutcome!.verticalMps! < 0);
  assert.ok(Math.abs(r.landingOutcome!.verticalMps!) < a.landing.maxVerticalMps);
  assert.ok(r.landingOutcome!.horizontalMps! < a.landing.maxHorizontalMps);
  close(r.previewEndTimeS!, c.timeS + 12);
  const last = r.points.at(-1)!;
  assert.deepEqual(c.velocityMps, last.velocityMps);
  close(c.massKg, last.massKg);
  close(c.timeS, last.t);
  close(c.eastM, last.eastM);
  close(c.yM, last.yM);
  close(c.northM, last.northM);
  assert.ok(last.speedMps > 0.5, 'incoming velocity is not zeroed');
  assert.equal(c.terrainKnown, true);
  assert.equal(c.terrainHeightM, 0);
  close(c.slopeDeg!, 0);
  assert.match(r.model, /instantaneous attitude/);
  assert.match(r.model, /No Apollo GNC/);
});

test('target error is a reference-sphere geodesic in metres, not a flat map distance or kilometres', () => {
  const radius = MOON_RADIUS_M + 2500;
  const angle = 0.04;
  close(landingTargetDistanceM(radius * Math.sin(angle), 0, radius * Math.cos(angle) - radius, radius), radius * angle);
  close(landingTargetDistanceM(0, radius * Math.sin(angle), radius * Math.cos(angle) - radius, radius), radius * angle);
  const r = simulateFlight(preset(), flat, radius);
  const c = r.contact!;
  close(c.targetErrorM, radius * Math.atan2(Math.hypot(c.eastM, c.northM), radius + c.yM), 1e-10);
  assert.ok(c.targetErrorM > 1 && c.targetErrorM < 20);
});

test('low thrust, fast sideways approach and empty propellant retain the incoming crash or miss', () => {
  const a = preset();
  for (const changed of [{ thrustN: 4000 }, { horizontalMps: 300 }, { wetMassKg: a.dryMassKg }]) {
    const r = simulateFlight({ ...a, ...changed }, flat);
    assert.equal(r.status, 'terrain contact');
    assert.equal(r.landingOutcome?.state, 'outside-assumed-limits');
    assert.ok(r.landingOutcome!.reasons.length > 0);
    assert.ok(r.contact!.velocityMps[1] < -10);
    assert.ok(r.contact!.targetErrorM > a.landing.targetRadiusM);
    assert.ok(r.points.every(p => p.yM >= 0 && p.massKg >= a.dryMassKg));
  }
  const empty = simulateFlight({ ...a, wetMassKg: a.dryMassKg }, flat);
  assert.ok(empty.fuelExhausted);
  assert.ok(empty.points.every(p => !p.powered && p.massKg === a.dryMassKg));
});

test('partial throttle uses actual impulse for propellant, and all mass use respects burn and dry limits', () => {
  const a = preset();
  const r = simulateFlight(a, flat);
  const consumed = a.wetMassKg - r.contact!.massKg;
  const fullThrottleMass = a.thrustN / (a.ispSeconds * 9.80665) * r.contact!.timeS;
  assert.ok(consumed > 100 && consumed < fullThrottleMass * 0.7);
  close(r.deltaVMps, a.ispSeconds * 9.80665 * Math.log(a.wetMassKg / r.contact!.massKg));
  const limited: FlightInputs = { ...a, wetMassKg: a.dryMassKg + 1, burnSeconds: 150 };
  const dry = simulateFlight(limited, flat);
  close(dry.contact!.massKg, limited.dryMassKg, 1e-9);
  assert.ok(dry.fuelExhausted);
  assert.ok(dry.points.every(p => p.massKg >= limited.dryMassKg));
  const short: FlightInputs = { ...a, landing: { ...a.landing, guidance: 'manual' }, burnSeconds: 0.37, durationSeconds: 2 };
  const stopped = simulateFlight(short, flat);
  close(stopped.points.at(-1)!.massKg, a.wetMassKg - a.thrustN / (a.ispSeconds * 9.80665) * 0.37, 1e-8);
  assert.equal(stopped.points.at(-1)!.powered, false);
  const veryShort = simulateFlight({ ...a, burnSeconds: 0.5 }, flat);
  assert.equal(veryShort.landingOutcome!.state, 'outside-assumed-limits');
});

test('terrain height unknown, nonfinite or missing stays unresolved even when incoming limits are met', () => {
  for (const terrain of [undefined, () => null, () => NaN, () => Infinity]) {
    const r = simulateFlight(preset(), terrain);
    assert.equal(r.status, 'reference contact');
    assert.equal(r.contact!.terrainKnown, false);
    assert.equal(r.contact!.terrainHeightM, null);
    assert.equal(r.contact!.slopeDeg, null);
    assert.equal(r.landingOutcome!.state, 'unresolved');
    assert.match(r.landingOutcome!.reasons.join(' '), /unknown/);
    assert.ok(Math.abs(r.points.at(-1)!.altitudeM) < 1e-6);
  }
  const targetGap = simulateFlight(preset(), (e, n) => e === 0 && n === 0 ? null : 0);
  assert.ok(targetGap.contact!.terrainKnown);
  assert.equal(targetGap.landingOutcome!.state, 'unresolved');
});

test('negative crater floors override radius zero, and sloped numerical ground stops at the same callback', () => {
  const crater = simulateFlight(preset(), () => -125);
  assert.equal(crater.contact!.terrainHeightM, -125);
  close(crater.contact!.yM, -125, 1e-6);
  assert.ok(crater.points.some(p => p.yM < 0));
  assert.ok(crater.points.every(p => p.yM >= -125));
  assert.equal(crater.landingOutcome!.state, 'within-assumed-limits');
  const terrain = (e: number, n: number) => -40 + 0.025 * e - 0.01 * n;
  const r = simulateFlight({ ...preset(), northOffsetM: 100 }, terrain);
  const c = r.contact!;
  close(c.yM, terrain(c.eastM, c.northM), 1e-6);
  close(c.terrainHeightM!, terrain(c.eastM, c.northM));
  close(c.slopeDeg!, Math.atan(Math.hypot(0.025, -0.01)) * 180 / Math.PI, 1e-6);
  assert.ok(r.points.every(p => p.yM >= terrain(p.eastM, p.northM) - 1e-8));
});

test('sub-millisecond fast impact refines time and exact incoming velocity without penetration', () => {
  const a = { ...preset(), altitudeM: 0.01, eastOffsetM: 0, horizontalMps: 2000, verticalMps: -5000, thrustN: 0 };
  const r = simulateFlight(a, () => -0.01);
  const c = r.contact!;
  close(c.timeS, 0.02 / 5000, 1e-10);
  close(c.yM, -0.01, 1e-7);
  assert.ok(c.yM >= -0.01);
  assert.ok(c.velocityMps[1] < -5000);
  assert.ok(c.velocityMps[0] > 1999.999);
  assert.ok(r.points.every(p => p.yM >= -0.01));
  assert.equal(r.points.length, 2);
  assert.equal(r.landingOutcome!.state, 'outside-assumed-limits');
  assert.throws(() => simulateFlight({ ...preset(), altitudeM: 1 }, () => 2), /starts below/);
});

test('all entered contact limits control the outcome; signed metrics remain measurable on failure', () => {
  const a = preset();
  const baseline = simulateFlight(a, flat);
  for (const limit of [{ targetRadiusM: 1 }, { maxVerticalMps: 0.1 }, { maxHorizontalMps: 0.1 }, { maxTiltDeg: 0 }, { breakupEnergyJ: 0 }]) {
    const r = simulateFlight({ ...a, landing: { ...a.landing, ...limit } }, flat);
    assert.equal(r.landingOutcome!.state, 'outside-assumed-limits', JSON.stringify(limit));
    assert.ok(r.landingOutcome!.reasons.some(reason => /exceeds|threshold/.test(reason)));
    assert.equal(r.landingOutcome!.verticalMps, baseline.landingOutcome!.verticalMps);
    assert.deepEqual(r.contact, baseline.contact, 'assessment limits do not fake a different trajectory');
  }
  const b = baseline.landingOutcome!;
  const atLimit = simulateFlight({ ...a, landing: { ...a.landing, targetRadiusM: b.targetErrorM!, maxVerticalMps: Math.abs(b.verticalMps!), maxHorizontalMps: b.horizontalMps!, maxTiltDeg: b.tiltDeg! } }, flat);
  assert.equal(atLimit.landingOutcome!.state, 'within-assumed-limits');
  const noContact = simulateFlight({ ...a, durationSeconds: 1 }, flat);
  assert.equal(noContact.contact, undefined);
  assert.equal(noContact.landingOutcome!.state, 'outside-assumed-limits');
  assert.equal(noContact.landingOutcome!.verticalMps, null);
  assert.match(noContact.landingOutcome!.reasons.join(' '), /No modeled landing/);
  close(noContact.previewEndTimeS!, 1);
});

test('configured hardware, heading, offsets and ground change the integrated result', () => {
  const a = preset();
  const base = simulateFlight(a, flat).contact!;
  for (const changed of [{ thrustN: 6000 }, { wetMassKg: 6000 }, { ispSeconds: 150 }, { headingDeg: 0 }, { eastOffsetM: 200 }, { northOffsetM: 300 }, { verticalMps: -15 }]) {
    const c = simulateFlight({ ...a, ...changed }, flat).contact!;
    assert.notDeepEqual(c, base, JSON.stringify(changed));
  }
  const north = simulateFlight({ ...a, eastOffsetM: 0, northOffsetM: -300, headingDeg: 0 }, flat);
  assert.equal(north.landingOutcome!.state, 'within-assumed-limits');
  close(north.contact!.targetErrorM, base.targetErrorM, 1e-5);
  assert.notEqual(simulateFlight(a, () => 30).contact!.timeS, base.timeS);
  const continuation = simulateFlight({ ...a, landing: { ...a.landing, contactPreviewSeconds: 30, friction: 0, restitution: 1 } }, flat);
  assert.deepEqual(continuation.contact, base, 'surface material affects downstream continuation, not airborne guidance');
  close(continuation.previewEndTimeS!, base.timeS + 30);
});

test('configured manual mode honors the pitch schedule rather than silently applying assisted control', () => {
  const a = preset();
  const manual = simulateFlight({ ...a, landing: { ...a.landing, guidance: 'manual' } }, flat);
  assert.equal(manual.contact, undefined);
  assert.ok(manual.points.at(-1)!.altitudeM > a.altitudeM);
  assert.equal(manual.landingOutcome!.state, 'outside-assumed-limits');
  assert.match(manual.model, /Manual full-thrust/);
});

test('rotation uses the E/up/N handedness, both apparent accelerations and the declared sidereal assumption', () => {
  const a = { ...preset(), altitudeM: 1000, eastOffsetM: 0, horizontalMps: 100, verticalMps: 0, thrustN: 0, burnSeconds: 0, durationSeconds: 1 };
  const fixed = simulateFlight(a, flat);
  const zero = simulateFlight(a, flat, MOON_RADIUS_M, { latitudeDeg: 0, rotationRateRadS: 0 });
  assert.deepEqual(zero.points, fixed.points);
  const spin = simulateFlight(a, flat, MOON_RADIUS_M, { latitudeDeg: 0 });
  const rate = LUNAR_SIDEREAL_RATE_RAD_S;
  const deltaExpected = (2 * rate * 100 + rate ** 2 * (MOON_RADIUS_M + 1000)) * a.durationSeconds;
  close(spin.points.at(-1)!.velocityMps[1] - fixed.points.at(-1)!.velocityMps[1], deltaExpected, 1e-7);
  assert.match(spin.model, /655.720 h/);
  const polarN = simulateFlight(a, flat, MOON_RADIUS_M, { latitudeDeg: 90 });
  const polarS = simulateFlight(a, flat, MOON_RADIUS_M, { latitudeDeg: -90 });
  assert.ok(polarN.points.at(-1)!.velocityMps[2] < 0, 'eastward motion deflects south in northern frame');
  assert.ok(polarS.points.at(-1)!.velocityMps[2] > 0);
  for (const env of [{ latitudeDeg: 91 }, { latitudeDeg: NaN }, { latitudeDeg: 0, rotationRateRadS: Infinity }, { latitudeDeg: 0, rotationRateRadS: 1 }])
    assert.throws(() => simulateFlight(a, flat, MOON_RADIUS_M, env), /latitude|rotation/);
});

test('unpowered rotating-frame flight conserves inertial two-body energy', () => {
  const a = { ...preset(), altitudeM: 100000, horizontalMps: 1500, verticalMps: 0, eastOffsetM: 0, thrustN: 0, burnSeconds: 0, durationSeconds: 120 };
  const r = simulateFlight(a, undefined, MOON_RADIUS_M, { latitudeDeg: 0 });
  const energy = (p: typeof r.points[number]) => {
    const [e, u] = p.positionM;
    const [ve, vu, vn] = p.velocityMps;
    // v_inertial = v_rot + Ω×r; E/up/N cross gives [ωu, −ωe, 0].
    return ((ve + LUNAR_SIDEREAL_RATE_RAD_S * u) ** 2 + (vu - LUNAR_SIDEREAL_RATE_RAD_S * e) ** 2 + vn ** 2) / 2 - LUNAR_MU / Math.hypot(...p.positionM);
  };
  close(energy(r.points.at(-1)!), energy(r.points[0]), 1e-5);
});

test('preset reset preserves hardware, repeated selection preserves edits and explicit reset restores the example', () => {
  const initial = createLandingFlight({ ...DEFAULT_FLIGHT, thrustN: 20000, wetMassKg: 6000 });
  assert.equal(initial.thrustN, 20000);
  assert.equal(initial.wetMassKg, 6000);
  const edited = { ...initial, eastOffsetM: -120, landing: { ...initial.landing, friction: 0.5 } };
  assert.deepEqual(createLandingFlight(edited), edited);
  assert.notEqual(createLandingFlight(edited).landing, edited.landing);
  const reset = createLandingFlight(edited, true);
  assert.equal(reset.eastOffsetM, -300);
  assert.equal(reset.landing.friction, 0.8);
  assert.equal(reset.thrustN, 20000);
});

test('extreme finite hardware cannot create an infinite integration loop or nonfinite contact evidence', () => {
  const a = preset();
  assert.throws(() => simulateFlight({ ...a, ispSeconds: Number.MIN_VALUE }, flat), /integration|precision/);
  assert.throws(() => simulateFlight({ ...a, dryMassKg: Number.MIN_VALUE, wetMassKg: Number.MIN_VALUE }, flat), /integration|precision/);
});
