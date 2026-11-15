import test from 'node:test';
import assert from 'node:assert/strict';
import { geometricSearchKey, geometricSearchGuard, type GeometricSearchInputs } from '../lib/search-key';
const input: GeometricSearchInputs = { lat: -86, lon: 20, heightM: 2,
  terrainMaskId: 'v1:cell-86,20:height2:mask', startIndex: 0, endIndex: 17520,
  days: 14, minEarth: 40 };
test('identical fields and equivalent longitudes share a key', () => {
  assert.equal(geometricSearchKey(input), geometricSearchKey({...input}));
  for (const lon of [380, -340, 740]) assert.equal(geometricSearchKey(input), geometricSearchKey({...input, lon}));
  assert.equal(geometricSearchKey({...input,lon:180}), geometricSearchKey({...input,lon:-180}));
});
for (const field of Object.keys(input) as (keyof GeometricSearchInputs)[]) {
  test(`changing ${field} invalidates key`, () => {
    const changed = {...input, [field]: typeof input[field] === 'number' ? Number(input[field]) + 1 : input[field] + ':changed'};
    assert.notEqual(geometricSearchKey(input), geometricSearchKey(changed));
  });
}
test('site changes, newer requests and cancellation reject stale completions', () => {
  const guard = geometricSearchGuard();
  guard.update('A'); const a = guard.begin(); assert.ok(guard.accepts(a));
  guard.update('B'); assert.equal(guard.accepts(a), false);
  guard.update('A'); assert.equal(guard.accepts(a), false);
  const newer = guard.begin(); const newest = guard.begin();
  assert.equal(guard.accepts(newer), false); assert.ok(guard.accepts(newest));
  guard.cancel(); assert.equal(guard.accepts(newest), false);
});
test('unchanged render inputs preserve the active request', () => {
  const guard = geometricSearchGuard(); guard.update('A'); const token = guard.begin();
  guard.update('A'); assert.ok(guard.accepts(token));
});
