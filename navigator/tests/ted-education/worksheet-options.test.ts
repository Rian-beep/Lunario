import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLessonMaterial, lessonMaterialHtml, MATERIAL_TOPICS, type MaterialTopic } from '../../lib/education-materials';
import { RESOURCE_LESSONS, RESOURCE_TOPICS } from '../../lib/education-materials/resource-evidence';
import { evaluateScenario } from '../../lib/assessment';
import { catalog, manifest, state } from './fixture';

test('topic choices determine both exports and deduplicate without reordering teacher questions', () => {
  const topics: MaterialTopic[] = ['extraction-power', 'reserve', 'extraction-power'];
  const sheet = createLessonMaterial(catalog, manifest, state, topics, 'Resource class');
  assert.deepEqual(sheet.questions.map(q => q.topic), ['extraction-power', 'reserve']);
  for (const teacher of [false, true]) {
    const html = lessonMaterialHtml(sheet, teacher);
    assert.match(html, /Can we power water production/); assert.match(html, /protected reserve/);
    assert.doesNotMatch(html, /Is there enough recoverable ice/);
    assert.match(html, /<math/); assert.match(html, /<msub>/);
  }
  assert.throws(() => createLessonMaterial(catalog, manifest, state, []), /Choose/);
  assert.throws(() => createLessonMaterial(catalog, manifest, state, ['unsupported' as MaterialTopic]), /Choose/);
});

for (const topic of RESOURCE_TOPICS) test(`${topic} includes solvable evidence questions, sources and separate marking guidance`, () => {
  const sheet = createLessonMaterial(catalog, manifest, state, [topic]);
  const q = sheet.questions[0];
  assert.ok(q.context?.some(v => /not confirmation of water ice/.test(v)));
  assert.match(q.answer, /Mark for/); assert.ok(q.sources!.length >= 2);
  const student = lessonMaterialHtml(sheet), teacher = lessonMaterialHtml(sheet, true);
  assert.match(student, /Research sources/); assert.doesNotMatch(student, /Mark for|Answer and interpretation/);
  assert.match(teacher, /Mark for/);
  if (topic === 'ice-evidence') {
    assert.equal(q.values.length, 0);
    assert.match(teacher, /5\.6 ± 2\.9%.*Cabeus/);
  } else {
    assert.ok(q.values.some(v => v.label.includes('Terrain model')));
    assert.ok(q.values.some(v => v.label.includes('Smooth sphere')));
  }
});

test('guided and advanced options change printable prompts and keys without changing scenario science', () => {
  const guided = createLessonMaterial(catalog, manifest, state, MATERIAL_TOPICS, 'Class', { audience: 'guided', includeHints: true });
  const advanced = createLessonMaterial(catalog, manifest, state, MATERIAL_TOPICS, 'Class', { audience: 'advanced', includeHints: true });
  assert.equal(guided.scenarioKey, advanced.scenarioKey);
  assert.deepEqual(guided.questions.map(q => q.values), advanced.questions.map(q => q.values));
  for (const teacher of [false, true]) {
    assert.match(lessonMaterialHtml(guided, teacher), /Guided investigation[\s\S]*Work in steps:/);
    assert.match(lessonMaterialHtml(advanced, teacher), /Advanced investigation[\s\S]*Extension: propose a controlled test/);
  }
});

test('hint option changes student print while teacher keys retain hints and answers', () => {
  const sheet = createLessonMaterial(catalog, manifest, state, ['extraction-power'], 'No hints', { audience: 'advanced', includeHints: false });
  const student = lessonMaterialHtml(sheet), teacher = lessonMaterialHtml(sheet, true);
  assert.doesNotMatch(student, /<p>Hint:/); assert.match(student, /Student hints: omitted/);
  assert.match(teacher, /<p>Hint:/); assert.match(teacher, /capture capacity as a possible bottleneck/);
  assert.doesNotMatch(student, /capture capacity as a possible bottleneck/);
  delete sheet.options;
  assert.match(lessonMaterialHtml(sheet), /<p>Hint:/);
});

test('capture freezes source links, options, scenario and givens against later caller edits', () => {
  const options = { audience: 'guided' as const, includeHints: true };
  const sheet = createLessonMaterial(catalog, manifest, state, ['ice-evidence'], 'Frozen', options);
  const old = RESOURCE_LESSONS['ice-evidence'].sources[0].title;
  try {
    RESOURCE_LESSONS['ice-evidence'].sources[0].title = 'changed source';
    options.includeHints = false;
    assert.equal(sheet.questions[0].sources![0].title, old);
    assert.equal(sheet.options!.includeHints, true);
    sheet.questions[0].sources![0].title = 'teacher edit';
    assert.equal(RESOURCE_LESSONS['ice-evidence'].sources[0].title, 'changed source');
  } finally { RESOURCE_LESSONS['ice-evidence'].sources[0].title = old; }
});

test('resource givens are canonical assessment values, not an ice or extraction calculator', () => {
  const a = evaluateScenario(catalog, state, manifest);
  const sheet = createLessonMaterial(catalog, manifest, state, ['resource-access', 'extraction-power']);
  assert.deepEqual(sheet.questions[0].values.map(v => v.value), [a.mission.contactFraction! * 100, a.sphereMission.contactFraction! * 100]);
  assert.deepEqual(sheet.questions[1].values.map(v => v.value), [a.mission.generatedWh! / 1000, a.mission.minBatteryWh! / 1000, a.sphereMission.generatedWh! / 1000, a.sphereMission.minBatteryWh! / 1000]);
  assert.match(sheet.questions[0].answer, /not contact along a route/);
  assert.match(sheet.questions[1].answer, /No conversion from kWh to local water yield/);
});

test('unknown resource values remain unavailable in student print and teacher marking', () => {
  const sheet = createLessonMaterial(catalog, manifest, { ...state, custom: { lat: 25, lon: 30 } }, RESOURCE_TOPICS);
  assert.ok(sheet.questions.flatMap(q => q.values).some(v => v.value === null));
  for (const teacher of [false, true]) assert.match(lessonMaterialHtml(sheet, teacher), /Unavailable \(do not substitute zero\)/);
});

test('edited title, question and hint flow into both files safely without answer leakage', () => {
  const sheet = createLessonMaterial(catalog, manifest, state, ['ice-evidence'], '<script>title</script>');
  sheet.questions[0].prompt = '<img src=x>Changed question';
  sheet.questions[0].hint = 'Edited hint'; sheet.questions[0].answer = 'TEACHER_ONLY';
  for (const teacher of [false, true]) {
    const html = lessonMaterialHtml(sheet, teacher);
    assert.match(html, /Changed question/); assert.match(html, /Edited hint/);
    assert.doesNotMatch(html, /<script>|<img/); assert.equal(html.includes('TEACHER_ONLY'), teacher);
  }
});

test('unsupported audience and nonboolean hint options are rejected before capturing a sheet', () => {
  assert.throws(() => createLessonMaterial(catalog, manifest, state, ['ice-evidence'], 'Class', { audience: 'other' as 'guided', includeHints: true }), /supported worksheet audience/);
  assert.throws(() => createLessonMaterial(catalog, manifest, state, ['ice-evidence'], 'Class', { audience: 'guided', includeHints: 'no' as unknown as boolean }), /supported worksheet audience/);
});
