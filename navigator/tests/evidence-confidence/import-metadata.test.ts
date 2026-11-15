import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { importObserverGeometry } from '../../lib/engineering-evidence/import-metadata';
import { emptyEnvelope } from '../../lib/engineering-evidence/workspace';
import { parseEnvelope, exportEnvelope } from '../../lib/engineering-evidence/import';

const fixture = JSON.parse(readFileSync('public/data/engineering-evidence/goldstone-horizons.json', 'utf8'));
const retrieved = '2026-11-14T12:30:00Z';

test('archived retrieval metadata wins over an explicitly entered import-time value; API JSON survives a separate archive round trip', () => {
  const input = { ...fixture, fetchedUtc: retrieved }, before = structuredClone(input);
  const imported = importObserverGeometry(input, fixture.request, '2026-11-15T00:00:00Z');
  assert.equal(imported.geometry.fetchedUtc, retrieved);
  assert.deepEqual(imported.archive.response, fixture.response);
  assert.deepEqual(imported.archive.response.signature, { source: 'NASA/JPL Horizons API', version: '1.2' });
  assert.deepEqual(importObserverGeometry(JSON.parse(JSON.stringify(imported.archive)), fixture.request), imported);
  assert.deepEqual(input, before);
  const envelope = parseEnvelope(exportEnvelope({ ...emptyEnvelope('scenario'), geometry: imported.geometry }));
  assert.equal(envelope.geometry!.fetchedUtc, retrieved);
  assert.deepEqual(Object.keys(envelope.geometry!), ['stationId', 'target', 'frame', 'requestUrl', 'fetchedUtc', 'rawResponse', 'samples']);
});

test('top-level, nested and response retrieval fields retain valid original UTC; equivalent spellings do not conflict', () => {
  for (const input of [
    { ...fixture, retrievedUtc: retrieved },
    { ...fixture, metadata: { retrievedUtc: retrieved } },
    { ...fixture, metadata: { fetchedUtc: retrieved } },
    { ...fixture.response, fetchedUtc: retrieved },
    { ...fixture, fetchedUtc: retrieved, retrievedUtc: retrieved.replace('Z', '.000Z') },
  ]) assert.equal(importObserverGeometry(input, fixture.request).geometry.fetchedUtc, retrieved);
});

test('absent or invalid metadata requires original UTC explicitly, never the generation banner or sample dates', () => {
  for (const invalid of [undefined, null, '', 'tomorrow', '2026-02-31T00:00:00Z', 0]) {
    const input = { ...fixture, fetchedUtc: invalid, exportedUtc: retrieved };
    assert.throws(() => importObserverGeometry(input, fixture.request), /Enter the original retrieval UTC.*select the file again/);
    assert.equal(importObserverGeometry(input, fixture.request, retrieved).geometry.fetchedUtc, retrieved);
  }
  for (const invalid of ['2026-02-31T00:00:00Z', '2026-11-14', '2026-11-14T12:30:00+01:00'])
    assert.throws(() => importObserverGeometry(fixture, fixture.request, invalid), /Original retrieval timestamp/);
});

test('raw response without API signature remains unknown, with full original table retained', () => {
  const response = { result: fixture.response.result };
  const imported = importObserverGeometry(response, fixture.request, retrieved);
  assert.equal(imported.archive.response.signature, undefined);
  assert.equal(imported.geometry.rawResponse, response.result);
  assert.deepEqual(imported.archive.response, response);
});

test('conflicting timestamps, mismatched station/request and corrupted table reject rather than relabeling', () => {
  assert.throws(() => importObserverGeometry({ ...fixture, fetchedUtc: retrieved, metadata: { fetchedUtc: '2026-11-13T00:00:00Z' } }, fixture.request, retrieved), /Conflicting original/);
  assert.throws(() => importObserverGeometry({ ...fixture, fetchedUtc: retrieved }, { ...fixture.request, stationId: 'madrid' }), /Select the archived station/);
  assert.throws(() => importObserverGeometry({ ...fixture, fetchedUtc: retrieved, requestUrl: fixture.requestUrl.replace('AIRLESS', 'REFRACTED') }, fixture.request), /differs/);
  assert.throws(() => importObserverGeometry({ ...fixture, fetchedUtc: retrieved, response: { result: fixture.response.result.replace('$$EOE', '') } }, fixture.request), /incomplete/);
});
