import test from 'node:test';
import assert from 'node:assert/strict';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EquationLesson, equationTeachingExample } from '../components/workbench/equation-lesson';
import { AudienceContextPanel } from '../components/workbench/audience-context';
import { MODEL_RELATIONS, VARIABLE_NOTATION } from '../lib/variable-notation';
import { PHYSICS_TOPICS } from '../lib/physics-reference';
import { migrateScenario } from '../lib/scenario';
import { DEFAULT_MISSION } from '../lib/mission';
import { DEFAULT_FLIGHT } from '../lib/flight';
Object.assign(globalThis, { React });
const textOnly = (html: string) => html.replace(/<[^>]*>/g, '').replaceAll('&gt;', '>').replaceAll('&lt;', '<').replaceAll('&amp;', '&');
const required = [...new Set([...Object.values(MODEL_RELATIONS), ...VARIABLE_NOTATION.map(item => item.equation), ...PHYSICS_TOPICS.flatMap(topic => topic.equations)])];

test('every notation has an expandable complete lesson and every relation renders with native standard form', () => {
  for (const notation of VARIABLE_NOTATION) {
    const html = renderToStaticMarkup(createElement(EquationLesson, { expression: notation.equation, notation }));
    assert.match(html, /^<details[^>]*><summary/);
    assert.doesNotMatch(html.match(/^<details[^>]*>/)![0], / open/);
    for (const label of ['Standard form', 'Meaning and units', 'What it measures', 'Intuition', 'Symbol key', 'Assumptions and model scope', 'Collapse this explanation']) assert.ok(html.includes(label), `${notation.id}: ${label}`);
    assert.match(html, /<math/);
    assert.doesNotMatch(textOnly(html), /_|\\frac|\\eta/);
  }
  for (const expression of required) {
    const html = renderToStaticMarkup(createElement(EquationLesson, { expression }));
    assert.match(html, /Behavior and graph shape/);
    assert.match(html, /scope="col"/);
    assert.match(html, /scope="row"/);
  }
});

test('solar teaching example gives 1020 W at 1000 W/m² for the stated factors, independently of current mission', () => {
  const example = equationTeachingExample(MODEL_RELATIONS.solar)!;
  assert.equal(example.calculate(0), 0);
  assert.equal(example.calculate(1000), 1020);
  assert.equal(example.calculate(1250), 1275);
  const html = renderToStaticMarkup(createElement(EquationLesson, { expression: MODEL_RELATIONS.solar }));
  assert.match(html, /A = 4 m², η = 0.30, ℓ = 0.15, F☉ = 1 and g = 1/);
  assert.match(html, /illustrative, not mission assessment/);
  assert.match(html, /1020 W/);
  assert.match(html, /Solar irradiance S \(W\/m²\)/);
  assert.match(html, /Ideal solar generation \(W\)/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /Previous value/);
  assert.match(html, /Next value/);
  assert.match(html, /Enter or Space/);
  assert.match(html, /<table/);
  assert.doesNotMatch(html, /1530/);
});

test('illustrative algebra charts retain finite values, explicit units, references and declared held factors', () => {
  let charts = 0;
  for (const expression of required) {
    const example = equationTeachingExample(expression);
    if (!example) continue;
    charts++;
    assert.ok(example.xUnit && example.yUnit && example.fixed.length > 50 && example.derivation.length > 50, expression);
    assert.ok(example.values.includes(example.reference), expression);
    assert.ok(example.values.every((value, index) => Number.isFinite(example.calculate(value)) && (!index || value > example.values[index - 1])), expression);
    const html = renderToStaticMarkup(createElement(EquationLesson, { expression }));
    assert.match(html, /Normalized|reference|Reference/);
    assert.match(html, /Horizontal axis/);
    assert.match(html, /Vertical axis/);
    assert.match(html, /Illustrative values/);
    assert.doesNotMatch(html, /NaN|Infinity/);
  }
  assert.ok(charts >= 20);
  const rocket = equationTeachingExample('Δv_ideal = Isp g₀ ln(m₀ / mf)')!;
  assert.equal(rocket.calculate(1), 0);
  assert.equal(rocket.calculate(2), Math.log(2));
  const radiation = equationTeachingExample('P_rad = ε σ A_rad T⁴')!;
  assert.equal(radiation.calculate(300), 1);
  assert.equal(radiation.calculate(600), 16);
  const loss = equationTeachingExample('L_fs = 20 log₁₀(4π R f / c)')!;
  assert.ok(Math.abs(loss.calculate(2) - 6.020599913) < 1e-8);
  const stopping = equationTeachingExample('a_stop = v_vertical² / (2 s_stop); E_k = ½ m v²')!;
  assert.equal(stopping.calculate(2), 4);
});

test('stateful battery, terrain visibility and integrated flight do not invent a response curve or mission values', () => {
  for (const expression of [MODEL_RELATIONS.battery, MODEL_RELATIONS.reserve, MODEL_RELATIONS.direction, 'F☉ = diskFraction(h☉, horizon_array, ρ☉)', 'a⃗ = (T / m) û_thrust − μ r⃗ / |r⃗|³', 'r̈ = −μr/|r|³ + (T/m)uₜ; ṁ = −T/(Iₛₚ g₀)']) {
    assert.equal(equationTeachingExample(expression), null);
    const html = renderToStaticMarkup(createElement(EquationLesson, { expression, mode: 'plan' }));
    assert.doesNotMatch(html, /<svg|<figure/);
    assert.match(html, /Current mission response: unknown/);
    assert.match(html, /Open tested sensitivity in Planner/);
    assert.match(html, /same requirements/);
  }
});

test('physics topic lessons carry actual scope, frame, inputs and evidence without supplying a new solver', () => {
  for (const topic of PHYSICS_TOPICS) for (const expression of topic.equations) {
    const html = renderToStaticMarkup(createElement(EquationLesson, { expression, topic, mode: 'plan' }));
    for (const value of [topic.frame, topic.assumptions, topic.calculated, topic.inputs, topic.evidence]) assert.ok(textOnly(html).includes(value), `${topic.id}: scope metadata`);
  }
});

test('audience relations and explorer use native math while retaining Public, Educator and Planner guidance', () => {
  const state = migrateScenario({ siteId: 'test', custom: null, startIndex: 0, endIndex: 23, heightM: 2, mission: DEFAULT_MISSION, flight: DEFAULT_FLIGHT }, { siteIds: ['test'], samples: 100, stepHours: 1 })!;
  assert.ok(state);
  for (const mode of ['public', 'teach', 'plan'] as const) {
    const html = renderToStaticMarkup(createElement(AudienceContextPanel, { mode, state, assessment: null }));
    assert.match(html, /<math/);
    assert.doesNotMatch(html, /<p role="math"/);
    assert.match(html, /Explore a symbol, unit and physical meaning/);
    assert.match(html, /full explanation/);
    assert.doesNotMatch(textOnly(html), /E_B|η_c|P_charge|M_reserve/);
  }
});
