import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_FLIGHT, simulateFlight} from '../lib/flight';
import {DEFAULT_LANDING_CONFIGURATION} from '../lib/landing-contract';

for (const sample of [NaN, Infinity, -Infinity]) {
  test(`nonfinite terrain ${sample} stays unknown and cannot poison legacy contact`, () => {
    const inputs = {...DEFAULT_FLIGHT, mode:'descent' as const, altitudeM:1, verticalMps:-1,
      thrustN:0, burnSeconds:0, durationSeconds:5, pitchDeg:90, finalPitchDeg:90};
    const legacy = simulateFlight(inputs, () => sample);
    const unknown = simulateFlight(inputs, () => null);
    assert.equal(legacy.status, 'reference contact');
    assert.deepEqual(legacy.points, unknown.points);
    assert.deepEqual(legacy.contact, unknown.contact);
    assert.ok(Object.values(legacy.contact!).filter(v => typeof v === 'number').every(Number.isFinite));
    assert.equal(legacy.contact!.terrainKnown, false);
    const configured = simulateFlight({...inputs, landing:{...DEFAULT_LANDING_CONFIGURATION,
      guidance:'manual', maxVerticalMps:10}}, () => sample);
    assert.equal(configured.status, 'reference contact');
    assert.equal(configured.landingOutcome!.state, 'unresolved');
  });
}

test('both solvers reject an initial point below known numerical terrain', () => {
  const input={...DEFAULT_FLIGHT,altitudeM:10,verticalMps:-1,thrustN:0,burnSeconds:0,durationSeconds:5};
  assert.throws(()=>simulateFlight(input,()=>20),/starts below the numerical surface/);
  assert.throws(()=>simulateFlight({...input,landing:{...DEFAULT_LANDING_CONFIGURATION,guidance:'manual'}},()=>20),/starts below the numerical surface/);
});
