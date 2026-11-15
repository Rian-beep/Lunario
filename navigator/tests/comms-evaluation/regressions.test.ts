import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEnvelope } from '../../lib/engineering-evidence/import';
import { parseHorizonsResponse } from '../../lib/engineering-evidence/horizons';
import { fixture, now, chain, assess } from './fixtures';

test('a quarter-second shifted provider epoch is rejected rather than rounded into hourly coverage', () => {
  const shifted = fixture.response.result.replace('2461358.500000000', (2461358.5 + .25 / 86400).toFixed(9));
  assert.throws(() => parseHorizonsResponse({ result: shifted }, fixture.request, now), /epoch|hourly/i);
});
test('provider numeric fields reject JavaScript hexadecimal notation', () => {
  const forged = fixture.response.result.replace('191.256257377', '0x10');
  assert.throws(() => parseHorizonsResponse({ result: forged }, fixture.request, now), /CSV/);
});
test('strict import rejects geometry columns that do not reproduce archived source bytes', () => {
  const e = chain(); e.geometry!.samples[0].elevationDeg = 80;
  assert.throws(() => parseEnvelope(e), /differs from archived/);
});
for (const key of ['stationHorizon', 'lunarMask', 'hardware', 'allocations'] as const) {
  test(`future-issued ${key} cannot grant modeled capacity`, () => {
    const e = chain(); e[key]!.provenance.issuedUtc = '2027-01-01T00:00:00Z';
    assert.equal(assess(e).status, 'incomplete');
    assert.equal(assess(e).deliveredBits, null);
  });
}
test('missing Earth-orientation coverage stays unknown', () => {
  const e = chain(); e.geometry!.rawResponse = e.geometry!.rawResponse.replace(/^EOP coverage.*\n/m, '');
  assert.equal(assess(e).status, 'incomplete');
  assert.equal(assess(e).deliveredBits, null);
});
test('epochs after the advertised EOP prediction boundary cannot grant modeled capacity', () => {
  const e = chain(); e.geometry!.rawResponse = e.geometry!.rawResponse.replace('PREDICTS-> 2027-FEB-08', 'PREDICTS-> 2026-NOV-14');
  assert.equal(assess(e).status, 'incomplete');
  assert.equal(assess(e).deliveredBits, null);
});
test('a fully covered conditional chain retains existing capacity and has no overall authority', () => {
  const result = assess(chain());
  assert.equal(result.status, 'conditional-meets');
  assert.equal(result.deliveredBits, 1800000);
  assert.equal(result.operationalApproval, false);
});
