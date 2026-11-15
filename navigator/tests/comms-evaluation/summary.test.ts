import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StationEvidenceSummary } from '../../components/comms-evaluation/evidence-summary';
import { summarizeStationEvidence } from '../../lib/engineering-evidence/summary';
import { horizonsSourceContext } from '../../lib/engineering-evidence/horizons';
import { parseEnvelope } from '../../lib/engineering-evidence/import';
import { emptyEnvelope } from '../../lib/engineering-evidence/workspace';
import type { CommunicationsEnvelope } from '../../lib/engineering-evidence/types';
import { chain, fixture, now, stay } from './fixtures';

const summarize = (e: CommunicationsEnvelope) => summarizeStationEvidence(e, 'test-case', stay, now);
const row = (e: CommunicationsEnvelope, id: string) => summarize(e).rows.find(r => r.id === id)!;

test('source context retains ephemeris and data/prediction dates; malformed and absent dates are unknown', () => {
  const context = horizonsSourceContext(fixture.response.result);
  assert.equal(context.ephemeris, 'DE441');
  assert.equal(context.eopFile, 'eop.261113.p270209');
  assert.deepEqual(context.eopCoverage, { dataStartUtc: '1962-01-20T00:00:00Z', dataEndUtc: '2026-11-13T00:00:00Z', predictionEndUtc: '2027-02-08T00:00:00Z' });
  for (const raw of [fixture.response.result.replace('2027-FEB-08', '2027-FEB-30'), fixture.response.result.replace('2027-FEB-08', '2026-JAN-01'), fixture.response.result.replace('2027-FEB-08', '2027-BAD-08'), fixture.response.result.replace(/^EOP file.*\n/m, ''), 'no source']) {
    assert.equal(horizonsSourceContext(raw).eopCoverage, null);
  }
});
test('empty and invalid imports expose missing/error states with no capacity or false overall pass', () => {
  const empty = summarize(emptyEnvelope('test-case'));
  assert.equal(empty.result?.status, 'incomplete');
  for (const id of ['geometry', 'station-horizon', 'lunar-mask', 'hardware', 'weather', 'allocation'])
    assert.equal(empty.rows.find(r => r.id === id)?.state, 'missing', id);
  assert.equal(empty.rows.find(r => r.id === 'service')?.state, 'unknown');
  const invalid = summarizeStationEvidence('{bad JSON', 'test-case', stay, now);
  assert.equal(invalid.state, 'invalid');
  assert.equal(invalid.result, null);
  assert.ok(invalid.error);
});
test('station geometry summary exposes source time/location/units and explicit refresh semantics', () => {
  const s = summarize(chain());
  assert.equal(s.station?.antenna, 'DSS-14');
  assert.equal(s.station?.heightM, 1001.390);
  assert.equal(s.geometry?.units, 'UTC, degrees, km');
  assert.equal(s.geometry?.apiVersion, null);
  assert.equal(s.geometry?.ageHours, 0);
  assert.equal(s.geometry?.coverage.endUtc, '2026-11-15T00:00:00.000Z');
  assert.match(s.refresh, /Manual fetch or import/);
  assert.match(s.refresh, /no polling, persistent cache/);
  assert.match(s.result!.reasons.join(';'), /predicted EOP/);
});
test('proxy and station mask remain distinct; neither grants actual service or acquisition', () => {
  const e = chain();
  assert.equal(row(e, 'lunar-mask').state, 'assumption');
  assert.match(row(e, 'lunar-mask').detail, /does not resolve the chosen station ray/);
  e.lunarMask!.value[0].target = 'station'; e.lunarMask!.provenance.kind = 'reference';
  assert.equal(row(e, 'lunar-mask').state, 'supplied');
  assert.match(row(e, 'lunar-mask').detail, /not independently verified/);
  assert.equal(row(e, 'service').state, 'unknown');
  assert.match(row(e, 'hardware').detail, /No station feed, polarization/);
  assert.match(row(e, 'allocation').detail, /cannot authenticate a booking/);
});
test('partial weather, lunar mask and allocation coverage remain explicit and never become zero loss', () => {
  const e = chain();
  for (const key of ['lunarMask', 'weather', 'allocations'] as const) e[key]!.value[0].endUtc = '2026-11-14T00:30:00Z';
  for (const id of ['lunar-mask', 'weather', 'allocation']) {
    assert.equal(row(e, id).state, 'partial', id);
    assert.equal(row(e, id).coveredSeconds, 1800, id);
  }
  assert.equal(summarize(e).result?.deliveredBits, null);
  assert.equal(summarize(e).result?.knownDeliveredBits, 900000);
  e.weather = null;
  assert.equal(row(e, 'weather').state, 'missing');
  assert.match(row(e, 'weather').detail, /unknown/);
});
test('inapplicable observed weather and mismatched frequency remain unknown, future issues stale', () => {
  const e = chain(); e.weather!.provenance.kind = 'observation';
  assert.equal(row(e, 'weather').state, 'unknown');
  e.weather!.provenance.kind = 'forecast'; e.weather!.value[0].frequencyGHz = 32;
  assert.equal(row(e, 'weather').state, 'unknown');
  e.hardware!.provenance.issuedUtc = '2027-01-01T00:00:00Z';
  assert.equal(row(e, 'hardware').state, 'stale');
  e.geometry!.fetchedUtc = '2027-01-01T00:00:00Z';
  assert.equal(row(e, 'geometry').state, 'stale');
});
test('scenario binding changes cannot launder source provenance or retain capacity', () => {
  const e = chain(); e.scenarioKey = 'old-site';
  const s = summarize(e);
  assert.equal(s.state, 'stale');
  assert.equal(s.result?.deliveredBits, null);
  assert.equal(row(e, 'lunar-mask').state, 'stale');
  assert.equal(row(e, 'hardware').provenance?.title, 'Synthetic regression assumption');
  assert.match(row(e, 'binding').nextAction, /do not merely relabel/);
});
test('critical windows preserve exact requirements, known zero, gaps and windows outside the stay', () => {
  const e = chain(); e.allocations!.value[0].rateLimitBps = 0;
  e.requirements.critical = [{ ...stay, id: 'command', minimumBits: 1, minimumContactSeconds: 1 }];
  let c = summarize(e).critical[0];
  assert.equal(c.bits, 0); assert.equal(c.seconds, 0); assert.equal(c.minimumBits, 1);
  assert.equal(c.status, 'conditional-shortfall');
  e.allocations!.value[0].endUtc = '2026-11-14T00:30:00Z';
  c = summarize(e).critical[0];
  assert.equal(c.bits, null); assert.equal(c.status, 'incomplete');
  e.requirements.critical[0].endUtc = '2026-11-14T02:00:00Z';
  c = summarize(e).critical[0];
  assert.equal(c.bits, null); assert.equal(c.endUtc, '2026-11-14T02:00:00Z');
});
test('object imports use UTF-8 byte bounds just like file imports', () => {
  const e = chain(); e.geometry!.rawResponse = 'é'.repeat(1_000_000);
  assert.throws(() => parseEnvelope(e), /object exceeds limit/);
});
test('compact workspace component is collapsed, inert, honest about unknowns and safe with untrusted text', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'React');
  Object.defineProperty(globalThis, 'React', { value: React, configurable: true });
  try {
    const e = chain(); e.hardware!.provenance.title = '<img src=x onerror=alert(1)>';
    const html = renderToStaticMarkup(React.createElement(StationEvidenceSummary, { envelope: e, scenarioKey: 'test-case', stay, nowUtc: now }));
    assert.doesNotMatch(html, /<details[^>]* open|<img|<a |<iframe/);
    assert.match(html, /&lt;img/);
    for (const text of ['DSS-14', 'Modeled capacity:', 'evaluateScenario', 'actual support', '2003.0', 'only; no polling', 'not RF attenuation evidence', 'Critical windows · 0']) assert.ok(html.includes(text), text);
    const invalid = renderToStaticMarkup(React.createElement(StationEvidenceSummary, { envelope: {}, scenarioKey: 'test-case', stay, nowUtc: now }));
    assert.match(invalid, /role="alert"/); assert.match(invalid, /no capacity result is available/);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'React', previous);
    else Reflect.deleteProperty(globalThis, 'React');
  }
});
