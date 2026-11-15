import assert from 'node:assert/strict';
import test from 'node:test';
import { PHYSICS_TOPICS } from '../lib/physics-reference';

test('every reference topic declares dimensions, frame, assumptions and three evidence states', () => {
  assert.equal(new Set(PHYSICS_TOPICS.map(topic => topic.id)).size, 7);
  for (const topic of PHYSICS_TOPICS) {
    for (const field of ['symbols', 'frame', 'assumptions', 'calculated', 'inputs', 'evidence', 'correction'] as const) assert.ok(topic[field].length > 30, `${topic.id}: ${field}`);
    assert.ok(topic.equations.length);
    for (const equation of topic.equations) assert.doesNotMatch(equation, /\\|\$/);
    for (const item of topic.sources) {
      const url = new URL(item.url);
      assert.equal(url.protocol, 'https:');
      assert.ok(url.hostname === 'nasa.gov' || url.hostname.endsWith('.nasa.gov'), item.url);
    }
  }
});

test('unverified universal claims are explicitly corrected rather than encoded as requirements', () => {
  const topic = (id: string) => PHYSICS_TOPICS.find(item => item.id === id)!;
  assert.match(topic('descent').correction, /146–194/);
  assert.match(topic('descent').correction, /not 30–60/);
  assert.match(topic('light').correction, /0.5°\/hour is not/);
  assert.match(topic('surface').correction, /12°.*not a universal/);
  assert.match(topic('surface').correction, /uncertified toy/);
  assert.match(topic('operations').correction, /No universal.*weights/);
  assert.match(topic('communications').evidence, /allocation and capacity/);
});

test('reference covers the missing engineering evidence without implying implemented solvers', () => {
  const text = PHYSICS_TOPICS.map(topic => Object.values(topic).join(' ')).join(' ');
  for (const term of ['TRN', 'ISRU', 'habitat', 'robotic', 'fission', 'walkback', 'rendezvous', 'bearing', 'heat flux', 'covariance', 'free return']) assert.ok(text.toLowerCase().includes(term.toLowerCase()), term);
  assert.ok(PHYSICS_TOPICS.every(topic => /not|does|separate|limits/i.test(topic.calculated)));
});
