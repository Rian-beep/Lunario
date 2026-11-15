import test from 'node:test';
import assert from 'node:assert/strict';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PhysicsReference, LearningDialog } from '../components/workbench/physics-reference';
import { HeaderLandingStatus, currentLandingDynamics } from '../components/workbench/header-landing-status';
import { PHYSICS_TOPICS } from '../lib/physics-reference';
import { createLandingFlight } from '../lib/landing-presets';
import { DEFAULT_FLIGHT } from '../lib/flight';
import type { LandingContact, LandingDynamicsReadout, LandingOutcome } from '../lib/landing-contract';
Object.assign(globalThis, { React });
const contact: LandingContact = { timeS: 50, eastM: 0, northM: 0, yM: 0,
  velocityMps: [1, -2, 0], massKg: 1000, terrainHeightM: 0, terrainKnown: true,
  slopeDeg: 0, tiltDeg: 0, headingDeg: 90, targetErrorM: 0 };
const settled: LandingDynamicsReadout = { phase: 'settled', elapsedContactS: 5, speedMps: 0,
  verticalMps: 0, eastM: 0, northM: 0, yM: 3.5, fragmentCount: 0, note: 'Rigid contact preview.' };

test('Learn exposes topic buttons and semantic MathML in every audience, without a topic select', () => {
  for (const mode of ['public', 'teach', 'plan'] as const) {
    const html = renderToStaticMarkup(createElement(PhysicsReference, { mode }));
    assert.match(html, /aria-label="Learning topics"/);
    for (const topic of PHYSICS_TOPICS) assert.ok(html.includes(topic.title.replaceAll('&', '&amp;')));
    assert.match(html, /<math[^>]+xmlns="http:\/\/www.w3.org\/1998\/Math\/MathML"/);
    assert.match(html, /Current model boundary/);
    assert.match(html, /Requires external evidence/);
    assert.match(html, /Every symbol and unit/);
    assert.doesNotMatch(html, /<select|Show physics reference/);
  }
});

test('Learn is a named dismissible dialog with an explicit close button', () => {
  const html = renderToStaticMarkup(createElement(LearningDialog, { mode: 'plan', onClose() {} }));
  assert.match(html, /<dialog[^>]+aria-labelledby=/);
  assert.match(html, /aria-label="Close learning dialog"/);

});

test('Lander preset preserves entered hardware and edits on revisit; explicit reset restores the approach', () => {
  const initial = createLandingFlight({ ...DEFAULT_FLIGHT, dryMassKg: 1234, thrustN: 9876 });
  assert.equal(initial.altitudeM, 300); assert.equal(initial.eastOffsetM, -300);
  assert.equal(initial.verticalMps, -8); assert.equal(initial.dryMassKg, 1234); assert.equal(initial.thrustN, 9876);
  const edited = { ...initial, altitudeM: 450, eastOffsetM: -500, landing: { ...initial.landing, maxVerticalMps: .8 } };
  assert.deepEqual(createLandingFlight(edited), edited);
  const reset = createLandingFlight(edited, true);
  assert.equal(reset.altitudeM, 300); assert.equal(reset.eastOffsetM, -300);
  assert.equal(reset.dryMassKg, 1234); assert.equal(reset.thrustN, 9876);
  assert.equal(edited.altitudeM, 450);
});

test('HUD rejects prior scenarios, future/stale scrub readouts and missing/invalid contact telemetry', () => {
  const key = {}, prior = {};
  const readout = { key, value: settled };
  assert.equal(currentLandingDynamics(readout, key, contact, 55), settled);
  assert.equal(currentLandingDynamics(readout, prior, contact, 55), null);
  assert.equal(currentLandingDynamics(readout, key, contact, 49), null);
  assert.equal(currentLandingDynamics(readout, key, contact, 52), null);
  assert.equal(currentLandingDynamics(readout, key, contact, 60), null);
  assert.equal(currentLandingDynamics(readout, key, contact, 56, 10), settled);
  assert.equal(currentLandingDynamics(readout, key, contact, 56, 0), null);
  assert.equal(currentLandingDynamics(readout, key, contact, 62, 50), null);
  assert.equal(currentLandingDynamics(null, key, contact, 55), null);
  assert.equal(currentLandingDynamics(readout, key, undefined, 55), null);
  for (const invalid of [{speedMps: NaN}, {speedMps: -1}, {elapsedContactS: Infinity}, {yM: NaN}]) {
    assert.equal(currentLandingDynamics({key,value:{...settled,...invalid}},key,contact,55),null);
  }
});

test('Flight outcomes pair symbols and words with entered limits, including unresolved evidence', () => {
  for (const [state, text] of [['within-assumed-limits', '✓ Within entered contact limits'], ['outside-assumed-limits', '× Outside entered contact limits'], ['unresolved', '? Contact evidence unresolved']] as const) {
    const outcome: LandingOutcome = { state, reasons: ['Terrain evidence fixture.'], verticalMps: null, horizontalMps: null, tiltDeg: null, targetErrorM: null };
    const html = renderToStaticMarkup(createElement(HeaderLandingStatus, { outcome, assisted: true, contactActive: true, dynamics: null, onReset() {} }));
    assert.ok(html.includes(text)); assert.match(html, /Terrain evidence fixture/);
    assert.match(html, /incoming impact speed is not current vehicle speed/);
    assert.match(html, /do not qualify a landing site or mission/);
  }
  const manual = renderToStaticMarkup(createElement(HeaderLandingStatus, {assisted:false,contactActive:false,dynamics:null,onReset(){}}));
  assert.match(manual,/Manual flight inputs are active/); assert.doesNotMatch(manual,/role="status"/);
});
