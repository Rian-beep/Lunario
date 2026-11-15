import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_FLIGHT, simulateFlight } from '../lib/flight';
import { DEFAULT_MISSION } from '../lib/mission';
import { createLandingFlight } from '../lib/landing-presets';
import { decodeScenario, encodeScenario, parseScenario } from '../lib/scenario';
import { LANDING_RANGES, MAX_LANDING_OFFSET_M } from '../lib/landing-inputs';
const bounds = { siteIds: ['a'], samples: 200 };
const state = { siteId: 'a', custom: null, startIndex: 0, endIndex: 100, heightM: 2, mission: DEFAULT_MISSION, flight: DEFAULT_FLIGHT };

test('legacy, schema 1 and schema 2 imports retain all landing configuration and export/reimport exactly', () => {
  const flight = createLandingFlight({ ...DEFAULT_FLIGHT, thrustN: 12000 });
  const expected = { ...flight, northOffsetM: 123.4, landing: { ...flight.landing, guidance: 'manual' as const, targetRadiusM: 7.5, maxTiltDeg: 9, maxVerticalMps: 1.25, maxHorizontalMps: 0.5, breakupEnergyJ: 1000, friction: 0.3, restitution: 0.5, contactPreviewSeconds: 24 } };
  const canonical = parseScenario({ ...state, flight: expected }, bounds)!;
  assert.deepEqual(canonical.flight, expected);
  for (const source of [{ ...state, flight: expected }, { ...state, schemaVersion: 1, flight: expected }, canonical]) {
    assert.deepEqual(parseScenario(source, bounds)!.flight, expected);
    const imported = decodeScenario(encodeScenario(source, bounds), bounds)!;
    assert.deepEqual(imported, canonical);
    const json = JSON.parse(JSON.stringify(imported));
    assert.deepEqual(parseScenario(json, bounds), canonical);
    assert.deepEqual(simulateFlight(imported.flight, () => -20), simulateFlight(expected, () => -20));
  }
});

test('absence roundtrips without synthesizing landing configuration or either offset', () => {
  const flight = decodeScenario(encodeScenario(state, bounds), bounds)!.flight;
  for (const key of ['landing', 'eastOffsetM', 'northOffsetM']) assert.equal(Object.hasOwn(flight, key), false, key);
  assert.deepEqual(flight, DEFAULT_FLIGHT);
  const offsetOnly = { ...state, flight: { ...DEFAULT_FLIGHT, eastOffsetM: -10 } };
  const parsed = decodeScenario(encodeScenario(offsetOnly, bounds), bounds)!.flight;
  assert.equal(parsed.eastOffsetM, -10);
  assert.equal(Object.hasOwn(parsed, 'northOffsetM'), false);
  assert.equal(Object.hasOwn(parsed, 'landing'), false);
});

test('malformed or truncated landing config is rejected rather than silently dropped', () => {
  const a = createLandingFlight(DEFAULT_FLIGHT);
  for (const landing of [null, [], 'target-landing', {}, { ...a.landing, guidance: 'apollo' }]) {
    assert.equal(parseScenario({ ...state, flight: { ...a, landing } }, bounds), null);
    assert.throws(() => simulateFlight({ ...a, landing } as never), /Landing|guidance|targetRadius/);
  }
  for (const key of Object.keys(a.landing)) {
    const landing: Record<string, unknown> = { ...a.landing };
    delete landing[key];
    assert.equal(parseScenario({ ...state, flight: { ...a, landing } }, bounds), null, key);
  }
  const unknown = parseScenario({ ...state, flight: { ...a, unknown: 1, landing: { ...a.landing, magicThrust: 9 } } }, bounds)!;
  assert.deepEqual(unknown.flight, a);
});

test('every landing numeric range is finite, complete and validated identically by import and simulation', () => {
  const a = createLandingFlight(DEFAULT_FLIGHT);
  for (const [key, [min, max]] of Object.entries(LANDING_RANGES)) {
    for (const invalid of [NaN, Infinity, -Infinity, null, '1', min - 0.001, max + Math.max(1, max * 0.01)]) {
      const flight = { ...a, landing: { ...a.landing, [key]: invalid } };
      assert.equal(parseScenario({ ...state, flight }, bounds), null, `${key}=${invalid}`);
      assert.throws(() => simulateFlight(flight as never), new RegExp(key));
    }
    for (const valid of [min, max]) {
      const flight = { ...a, landing: { ...a.landing, [key]: valid } };
      assert.notEqual(parseScenario({ ...state, flight }, bounds), null, `${key}=${valid}`);
    }
  }
  for (const key of ['eastOffsetM', 'northOffsetM']) {
    for (const invalid of [NaN, Infinity, null, '10', MAX_LANDING_OFFSET_M + 1, -MAX_LANDING_OFFSET_M - 1]) {
      const flight = { ...a, [key]: invalid };
      assert.equal(parseScenario({ ...state, flight }, bounds), null, `${key}=${invalid}`);
      assert.throws(() => simulateFlight(flight as never), new RegExp(key));
    }
    assert.notEqual(parseScenario({ ...state, flight: { ...a, [key]: -MAX_LANDING_OFFSET_M } }, bounds), null);
    assert.notEqual(parseScenario({ ...state, flight: { ...a, [key]: MAX_LANDING_OFFSET_M } }, bounds), null);
  }
});
