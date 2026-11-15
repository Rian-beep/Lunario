import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { evaluateScenario } from '../../lib/assessment';
import { RESOURCE_BOUNDARY, RESOURCE_LESSONS, resourceEvidence, resourceMetric } from '../../lib/education-materials/resource-evidence';
import { ResourceEvidencePanel, ResourceEvidenceComparison } from '../../components/education-materials/resource-evidence';
import { PhysicsReference } from '../../components/workbench/physics-reference';
import { catalog, manifest, state } from './fixture';
Object.assign(globalThis, { React });
const assessment = evaluateScenario(catalog, state, manifest);

test('resource cards use canonical terrain/sphere results and exact inclusive-interval stay without altering the scenario', () => {
  const before = structuredClone(state), evidence = resourceEvidence(catalog, state, assessment);
  assert.deepEqual(state, before);
  assert.equal(evidence.hours, (state.endIndex - state.startIndex + 1) * catalog.meta.stepHours);
  assert.deepEqual(evidence.metrics.energy, [assessment.mission.generatedWh! / 1000, assessment.sphereMission.generatedWh! / 1000]);
  assert.deepEqual(evidence.metrics.battery, [assessment.mission.minBatteryWh! / 1000, assessment.sphereMission.minBatteryWh! / 1000]);
  assert.deepEqual(evidence.metrics.contact, [assessment.mission.contactFraction! * 100, assessment.sphereMission.contactFraction! * 100]);
  assert.equal(evidence.metrics.sun[0], assessment.mission.timeline.filter(p => p.sun === true).length / assessment.mission.timeline.length * 100);
});

test('unassessed cases and unsupported terrain retain unavailable values rather than false zeroes', () => {
  const absent = resourceEvidence(catalog, state, null);
  assert.ok(Object.values(absent.metrics).flat().every(v => v === null));
  const custom = { ...structuredClone(state), custom: { lat: 25, lon: 30 } };
  const unknown = resourceEvidence(catalog, custom, evaluateScenario(catalog, custom, manifest));
  assert.equal(unknown.metrics.energy[0], null);
  assert.equal(unknown.metrics.sun[0], null);
  assert.match(unknown.siteName, /Custom point \(25\.0000°, 30\.0000°\)/);
  for (const v of [null, NaN, Infinity, -Infinity]) assert.equal(resourceMetric(v, '%'), 'Unavailable');
  assert.equal(resourceMetric(0, '%'), '0%');
});

test('sunlight stays unknown with one missing source interval and does not become a full-stay percentage', () => {
  const partial = structuredClone(assessment);
  partial.mission.timeline[0].sun = null;
  assert.equal(resourceEvidence(catalog, state, partial).metrics.sun[0], null);
  partial.mission.timeline = [];
  assert.equal(resourceEvidence(catalog, state, partial).metrics.sun[0], null);
});

test('next investigations prioritize configured power and contact failures without claiming resource suitability', () => {
  const result = structuredClone(assessment);
  result.constraints = [];
  assert.match(resourceEvidence(catalog, state, result).next, /ice presence and recoverability still need measurements/);
  const template = assessment.constraints[0];
  result.constraints = [{ ...template, id: 'critical-contact:drill', state: 'fail' }];
  assert.match(resourceEvidence(catalog, state, result).next, /failed contact requirement/);
  result.constraints.push({ ...template, id: 'unmet-demand', state: 'fail' });
  assert.match(resourceEvidence(catalog, state, result).next, /power shortfall/);
});

test('LCROSS remains an observed Cabeus estimate; simulant and proxy limitations remain explicit', () => {
  assert.match(RESOURCE_LESSONS['ice-evidence'].detail, /5\.6 ± 2\.9%.*Cabeus/);
  assert.match(RESOURCE_LESSONS['ice-evidence'].detail, /not to every shadowed region or the selected site/);
  assert.match(RESOURCE_LESSONS['extraction-power'].detail, /simulants/);
  assert.match(RESOURCE_BOUNDARY, /hydrogen signals are clues, not confirmation/);
  for (const lesson of Object.values(RESOURCE_LESSONS)) for (const source of lesson.sources) assert.match(source.url, /^https:\/\//);
});

test('Athena is a cited historical discussion, never inferred as a completed local drill measurement', () => {
  const c = { ...catalog, sites: catalog.sites.map(site => site.id === state.siteId ? { ...site, name: 'Mons Mouton' } : site) };
  const example = resourceEvidence(c, state, null);
  assert.match(example.focus, /Historical example.*drill from reaching the ground/);
  assert.match(example.siteSource!.url, /pds\.nasa\.gov/);
  assert.equal(resourceEvidence(c, { ...state, custom: { lat: -84.8, lon: 29.2 } }, null).siteSource, null);
});

for (const mode of ['public', 'teach', 'plan'] as const) test(`${mode} cards retain boundaries, comparison and audience-appropriate disclosure`, () => {
  const html = renderToStaticMarkup(createElement(ResourceEvidencePanel, { catalog, state, assessment, mode }));
  assert.match(html, /not confirmation of water ice/);
  assert.match(html, /does not approve a landing or mining operation/);
  assert.match(html, /Local ice concentration, depth and form are unknown/);
  assert.match(html, /Terrain model/); assert.match(html, /Smooth sphere/);
  assert.match(html, /tabindex="0" role="region"/);
  assert.equal(html.includes('<strong>Discuss</strong>'), mode === 'teach');
  assert.equal(html.includes('<details open="">'), mode === 'plan');
  assert.doesNotMatch(html, /<canvas|<iframe|position:\s*(?:fixed|absolute)|<dialog/);
});

test('comparison cards preserve each saved scenario, unavailable cases and terrain/sphere column order', () => {
  const html = renderToStaticMarkup(createElement(ResourceEvidenceComparison, { catalog, cases: [
    { id: 'known', name: 'Known <case>', state, assessment },
    { id: 'unknown', name: 'Unknown case', state, assessment: null },
  ] }));
  assert.match(html, /Known &lt;case&gt;/); assert.match(html, /Unknown case/);
  assert.match(html, /Terrain model \/ smooth sphere/);
  assert.match(html, /Unavailable \/ Unavailable/);
  assert.match(html, /not confirmation of water ice/);
  assert.doesNotMatch(html, /<details[^>]*open=/);
});

test('Learn keeps native MathML and exposes contextual ice only when a scenario is supplied', () => {
  for (const scenario of [undefined, { catalog, state, assessment }]) {
    const html = renderToStaticMarkup(createElement(PhysicsReference, { mode: 'public', scenario }));
    assert.match(html, /<math/);
    assert.equal(html.includes('>Lunar ice evidence</button>'), !!scenario);
  }
});
