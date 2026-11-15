import test from 'node:test';
import assert from 'node:assert/strict';
import { INTERNATIONAL_MISSION_HISTORY as history } from '../../lib/mission-history/international';
import { LANDING_SITES } from '../../lib/landing-sites';
import type { MissionHistoryRecord, Sourced } from '../../lib/mission-history/types';

const byId = (id: string) => {
  const record = history.find(item => item.id === id);
  assert.ok(record, `Missing ${id}`);
  return record;
};
function sourcedValues(record: MissionHistoryRecord): [string, Sourced<unknown>][] {
  const values: [string, Sourced<unknown>][] = [];
  function visit(value: unknown, path: string) {
    if (value === null || typeof value !== 'object') return;
    if ('value' in value && 'sourceIds' in value) values.push([path, value as Sourced<unknown>]);
    else for (const [key, child] of Object.entries(value)) visit(child, `${path}.${key}`);
  }
  visit(record, record.id);
  return values;
}

test('covers every existing international landing/attempt exactly once without adding missions or sharing distinct missions', () => {
  const usPrograms = new Set(['Apollo', 'Surveyor', 'CLPS']);
  const expected = LANDING_SITES.filter(site => !usPrograms.has(site.program)).map(site => site.id).sort();
  assert.equal(history.length, 24);
  assert.equal(new Set(history.map(record => record.id)).size, history.length);
  assert.deepEqual(history.flatMap(record => record.siteIds).sort(), expected);
  for (const record of history) assert.deepEqual(record.siteIds, [record.id]);
  assert.equal(history.filter(record => record.id.startsWith('luna-')).length, 14);
  for (const site of LANDING_SITES.filter(site => !usPrograms.has(site.program))) {
    assert.ok(byId(site.id).missionDates.value?.includes(site.date), `${site.id}: preserve the existing UTC surface-event date`);
  }
});

test('every known fact resolves to valid primary references; every unknown has a reason', () => {
  const primaryDomains = /(^|\.)(laspace\.ru|cosmos\.ru|nasa\.gov|cnsa\.gov\.cn|isro\.gov\.in|jaxa\.jp|ispace-inc\.com|spaceil\.com|space\.gov\.il|im-ldi\.com)$/;
  for (const record of history) {
    const ids = record.sources.map(s => s.id);
    assert.equal(new Set(ids).size, ids.length, `${record.id}: duplicate sources`);
    for (const source of record.sources) {
      const url = new URL(source.url);
      assert.equal(url.protocol, 'https:');
      assert.match(url.hostname, primaryDomains, `${record.id}: primary publisher required`);
      for (const text of [source.title, source.publisher, source.country, source.language]) assert.ok(text.trim());
    }
    assert.equal(sourcedValues(record).length, 15);
    for (const [path, fact] of sourcedValues(record)) {
      if (fact.value === null) assert.ok(fact.note?.trim(), `${path}: explain the evidence gap`);
      else {
        assert.ok(fact.sourceIds.length > 0, `${path}: missing citation`);
        if (Array.isArray(fact.value)) assert.ok(fact.value.length > 0, `${path}: do not encode unknown as an empty list`);
      }
      for (const id of fact.sourceIds) assert.ok(ids.includes(id), `${path}: unknown source ${id}`);
    }
  }
});

test('home-country originals retain real language labels and English paraphrase provenance', () => {
  for (const record of history) {
    const language = record.id.startsWith('luna-') ? 'Russian' : record.id.startsWith('change-') ? 'Chinese'
      : record.id.startsWith('chandrayaan-') ? 'English' : record.id === 'beresheet' ? 'Hebrew' : 'Japanese';
    const source = record.sources.find(s => s.language === language && s.country !== 'United States');
    assert.ok(source, `${record.id}: missing home-country ${language} original`);
    if (language !== 'English') assert.match(source.translationNote ?? '', /English paraphrase/);
    for (const source of record.sources.filter(s => s.language === 'English')) {
      assert.match(source.translationNote ?? '', /no translation claimed/);
    }
  }
  assert.equal(byId('luna-9').sources.find(s => s.id === 'iki-panoramas')?.language, 'Russian');
});

test('partial touchdown, platform science and subsystem failures are not flattened into success', () => {
  const luna23 = byId('luna-23').outcome.value!;
  assert.match(luna23.landing, /tipped/);
  assert.match(luna23.science, /Communicated.*no sample/);
  assert.match(byId('luna-13').outcome.value!.science, /failure of one camera/);
  assert.match(byId('luna-21').outcome.value!.landing, /navigation system failed/);
  assert.match(byId('change-3').outcome.value!.science, /fault remained unresolved/);
  assert.match(byId('chandrayaan-2').outcome.value!.landing, /failed/);
  assert.match(byId('chandrayaan-2').outcome.value!.science, /Orbiter.*continued/);
  assert.match(byId('slim').outcome.value!.landing, /Pinpoint.*succeeded.*off-nominal/);
  for (const id of ['luna-5', 'luna-7', 'luna-8', 'luna-15', 'luna-18', 'luna-25', 'hakuto-r-1', 'hakuto-r-2', 'beresheet']) {
    assert.match(byId(id).outcome.value!.landing, /[Cc]rash|impact|failed|Hard landing/);
  }
  assert.match(byId('hakuto-r-1').outcome.value!.landing, /altitude estimation/);
  assert.match(byId('hakuto-r-2').outcome.value!.landing, /laser range finder/);
});

test('surface exploration never fabricates routes, surveyed areas, water deposits or numerical vehicle limits', () => {
  for (const record of history) {
    assert.ok(record.exploration.summary.value);
    assert.ok(record.exploration.summary.sourceIds.length);
    assert.equal(record.exploration.route, undefined);
    assert.equal(record.exploration.routeSourceIds, undefined);
    assert.equal(record.exploration.areaKm2.value, null);
    assert.equal('lat' in record || 'lon' in record, false);
    assert.notEqual(record.publicSummary.value, record.educatorNotes.value);
    assert.notEqual(record.educatorNotes.value, record.plannerNotes.value);
  }
  assert.equal(byId('luna-17').exploration.distanceKm.value, 10.54);
  assert.deepEqual(byId('luna-17').exploration.distanceKm.sourceIds, ['lav-17']);
  assert.equal(byId('luna-21').exploration.distanceKm.value, null);
  assert.match(byId('luna-21').exploration.distanceKm.note!, /36.2.*37.*reconciliation/);
  assert.match(byId('luna-25').exploration.summary.value!, /likely.*not the planned/);
  assert.match(byId('chandrayaan-3').plannerNotes.value!, /not a water-deposit/);
});

test('sponsor evidence is scoped to dated support, never invented money or a comprehensive list', () => {
  for (const id of ['hakuto-r-1', 'hakuto-r-2', 'beresheet', 'luna-25']) {
    const sponsors = byId(id).sponsors;
    assert.ok(sponsors.value?.length);
    assert.match(sponsors.note!, /amount/);
    assert.doesNotMatch(sponsors.value!.join(' '), /[$€£₹]|\d+\s*(million|billion)/i);
  }
  assert.match(byId('hakuto-r-1').sponsors.value!.join(' '), /NGK/);
  assert.match(byId('hakuto-r-2').sponsors.value!.join(' '), /SMBC/);
  assert.equal(byId('luna-5').sponsors.value, null);
  assert.equal(byId('luna-5').operator.value, null);
});
