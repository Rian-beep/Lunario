import { test } from 'node:test';
import assert from 'node:assert/strict';
import reference from './fixtures/legacy-flight-reference.json';
import { DEFAULT_FLIGHT, LUNAR_MU, MOON_RADIUS_M, simulateFlight, type FlightInputs } from '../lib/flight';
import { DEFAULT_LANDING_CONFIGURATION } from '../lib/landing-contract';

const close = (actual: number, expected: number, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} versus ${expected}`);
const falling: FlightInputs = {
  ...DEFAULT_FLIGHT, mode: 'descent', altitudeM: 100, verticalMps: -10,
  thrustN: 0, burnSeconds: 0, durationSeconds: 100,
};
const flat = () => 0;
const cases: Array<{
  name: string; inputs: FlightInputs; terrain?: (east: number, north: number) => number | null; radius?: number;
}> = [
  { name: 'default launch', inputs: DEFAULT_FLIGHT },
  { name: 'short launch', inputs: { ...DEFAULT_FLIGHT, durationSeconds: 60 } },
  { name: 'launch returning to terrain', inputs: { ...DEFAULT_FLIGHT, durationSeconds: 900 }, terrain: flat },
  { name: 'launch returning to sphere', inputs: { ...DEFAULT_FLIGHT, durationSeconds: 900 } },
  { name: 'reference fall', inputs: falling },
  { name: 'raised terrain', inputs: falling, terrain: () => 20 },
  { name: 'negative terrain', inputs: falling, terrain: () => -125 },
  { name: 'sloped terrain', inputs: { ...falling, headingDeg: 225, horizontalMps: 30 }, terrain: (e, n) => -40 + 0.025 * e - 0.01 * n },
  { name: 'fuel exhaustion', inputs: { ...DEFAULT_FLIGHT, wetMassKg: 1000, dryMassKg: 990, thrustN: 10000, ispSeconds: 300, burnSeconds: 100, durationSeconds: 30 } },
  { name: 'fractional burn cutoff', inputs: { ...DEFAULT_FLIGHT, burnSeconds: 0.37, durationSeconds: 30 } },
  { name: 'site radius and offsets', inputs: { ...falling, eastOffsetM: 20000, northOffsetM: -10000, horizontalMps: 25, headingDeg: -30, pitchDeg: -20, finalPitchDeg: 35 }, terrain: () => -125, radius: MOON_RADIUS_M + 3000 },
  { name: 'circular coast', inputs: { ...DEFAULT_FLIGHT, altitudeM: 100000, horizontalMps: Math.sqrt(LUNAR_MU / (MOON_RADIUS_M + 100000)), thrustN: 0, burnSeconds: 0, durationSeconds: 600 } },
];
// Pre-contact samples retain the original frozen values. Contact endpoints were
// regenerated for the audited RK4 surface root; audit-integration-impact independently
// checks exact central-force event time, speed and energy. No tolerance was relaxed.
for (const [index, fixture] of cases.entries()) {
  test(`legacy point numerics remain stable: ${fixture.name}`, () => {
    const result = simulateFlight(fixture.inputs, fixture.terrain, fixture.radius);
    const expected = reference.cases[index];
    assert.equal(expected.name, fixture.name);
    assert.equal(result.points.length, expected.pointCount);
    assert.equal(result.status, expected.status);
    assert.equal(result.fuelExhausted, expected.fuelExhausted);
    const numeric = (a: number, b: number) => close(a, b, 1e-8 + Math.abs(b) * 1e-11);
    for (const key of ['maxAltitudeM','initialThrustToWeight','deltaVMps'] as const) numeric(result[key], expected[key]);
    for (const {index,point} of expected.points) {
      const actual = result.points[index];
      assert.equal(actual.powered, point.powered);
      for (const key of ['t','eastM','northM','yM','altitudeM','speedMps','verticalMps','massKg'] as const) numeric(actual[key],point[key]);
      actual.positionM.forEach((value,i)=>numeric(value,point.positionM[i]));
      actual.velocityMps.forEach((value,i)=>numeric(value,point.velocityMps[i]));
    }
  });
}

test('legacy ascent returning to terrain exposes the exact final impact and manual continuation metadata', () => {
  const inputs = { ...DEFAULT_FLIGHT, durationSeconds: 900 };
  const before = structuredClone(inputs);
  const result = simulateFlight(inputs, flat);
  assert.equal(result.status, 'terrain contact');
  assert.ok(result.points.some(p => p.verticalMps > 0));
  const last = result.points.at(-1)!;
  assert.ok(last.verticalMps < 0);
  assert.ok(last.speedMps > 500, 'incoming impact speed is retained');
  assert.ok(last.t % 0.25 !== 0, 'impact resolves inside the integration step');
  assert.ok(result.contact, 'Follow needs impact metadata even without explicit landing inputs');
  const contact = result.contact;
  assert.equal(contact.timeS, last.t);
  assert.deepEqual([contact.eastM, contact.yM + MOON_RADIUS_M, contact.northM], last.positionM);
  assert.deepEqual(contact.velocityMps, last.velocityMps);
  assert.notEqual(contact.velocityMps, last.velocityMps);
  assert.equal(contact.massKg, last.massKg);
  assert.equal(contact.terrainKnown, true);
  assert.equal(contact.terrainHeightM, 0);
  assert.equal(contact.slopeDeg, 0);
  assert.deepEqual(result.landingConfiguration, { ...DEFAULT_LANDING_CONFIGURATION, guidance: 'manual' });
  close(result.previewEndTimeS!, last.t + 12);
  assert.equal(result.landingOutcome, undefined, 'legacy guidance has no computed acceptance assessment');
  assert.match(result.model, /manual/i);
  assert.match(result.model, /NASA.*qualification/i);
  assert.match(result.model, /not.*assessment/i);
  assert.deepEqual(inputs, before, 'metadata does not configure or mutate legacy inputs');
});

test('legacy reference contact keeps terrain and slope explicitly unknown', () => {
  for (const terrain of [undefined, () => null]) {
    const result = simulateFlight(falling, terrain);
    assert.equal(result.status, 'reference contact');
    assert.ok(result.contact);
    assert.equal(result.contact.terrainKnown, false);
    assert.equal(result.contact.terrainHeightM, null);
    assert.equal(result.contact.slopeDeg, null);
    assert.deepEqual(result.contact.velocityMps, result.points.at(-1)!.velocityMps);
    close(result.previewEndTimeS!, result.contact.timeS + 12);
    assert.equal(result.landingOutcome, undefined);
    assert.match(result.model, /unknown/i);
  }
});

test('legacy contact preserves E/up/N axes, selected radius, pitch tilt and reference-arc target error', () => {
  const radius = MOON_RADIUS_M + 3000;
  for (const headingDeg of [-30, 0, 90, 225]) {
    for (const pitchDeg of [-20, 35, 90]) {
      const inputs = {
        ...falling, eastOffsetM: 20000, northOffsetM: -10000, headingDeg,
        pitchDeg, finalPitchDeg: 60, burnSeconds: 20, horizontalMps: 25,
      };
      const terrain = (e: number, n: number) => -125 + 0.025 * (e - 20000) - 0.01 * (n + 10000);
      const result = simulateFlight(inputs, terrain, radius);
      assert.ok(result.contact);
      const c = result.contact, last = result.points.at(-1)!;
      assert.equal(c.eastM, last.positionM[0]);
      assert.equal(c.northM, last.positionM[2]);
      assert.equal(c.yM, last.positionM[1] - radius);
      assert.deepEqual(c.velocityMps, last.velocityMps);
      close(c.terrainHeightM!, terrain(c.eastM, c.northM));
      close(c.slopeDeg!, Math.atan(Math.hypot(0.025, -0.01)) * 180 / Math.PI);
      const expectedArc = radius * Math.atan2(Math.hypot(c.eastM, c.northM), radius + c.yM);
      close(c.targetErrorM, expectedArc);
      assert.ok(Math.abs(c.targetErrorM - Math.hypot(c.eastM, c.northM)) > 0.1);
      const scheduledPitch = pitchDeg + (60 - pitchDeg) * Math.min(1, c.timeS / 20);
      close(c.tiltDeg, 90 - scheduledPitch, 1e-6);
      // Scheduled thrust is radial-up*sin(pitch) plus the projected heading tangent*cos(pitch).
      const up = last.positionM.map(n => n / Math.hypot(...last.positionM));
      const h = headingDeg * Math.PI / 180;
      const dot = Math.sin(h) * up[0] + Math.cos(h) * up[2];
      const tangent = [Math.sin(h) - dot * up[0], -dot * up[1], Math.cos(h) - dot * up[2]];
      const length = Math.hypot(...tangent), p = scheduledPitch * Math.PI / 180;
      const attitude = up.map((n, i) => n * Math.sin(p) + tangent[i] / length * Math.cos(p));
      close(c.headingDeg, (Math.atan2(attitude[0], attitude[2]) * 180 / Math.PI + 360) % 360);
    }
  }
});

test('legacy contact slope stays unknown when any centred terrain sample is missing or nonfinite', () => {
  for (const missing of [null, NaN, Infinity]) {
    const result = simulateFlight(falling, (e) => e === 0 ? 20 : missing);
    assert.ok(result.contact);
    assert.equal(result.contact.terrainHeightM, 20);
    assert.equal(result.contact.terrainKnown, true);
    assert.equal(result.contact.slopeDeg, null);
  }
});

test('legacy nonimpact flights add no contact, continuation, configuration or outcome metadata', () => {
  for (const inputs of [DEFAULT_FLIGHT, { ...DEFAULT_FLIGHT, durationSeconds: 1 }, { ...falling, altitudeM: 100000, durationSeconds: 1 }]) {
    const result = simulateFlight(inputs, flat);
    for (const key of ['contact', 'previewEndTimeS', 'landingConfiguration', 'landingOutcome']) {
      assert.equal(Object.hasOwn(result, key), false, key);
    }
  }
});
