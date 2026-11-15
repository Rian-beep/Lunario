import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_FLIGHT, LUNAR_MU, MOON_RADIUS_M, simulateFlight, type FlightResult } from '../lib/flight';
import { createFlightExperiment, FLIGHT_EXPERIMENTS, flightDiagnostics, flightFuelReason } from '../lib/flight-experiments';
import { FlightExperiments } from '../components/workbench/flight-experiments';
import { FlightPanel } from '../components/workbench/panels';
import { AudienceContext } from '../components/workbench/info';
Object.assign(globalThis, { React });
const flatTerrain = () => 0;

test('reference factories are independent, preserve engine defaults and require explicit loading', () => {
  const before = structuredClone(DEFAULT_FLIGHT);
  assert.equal(FLIGHT_EXPERIMENTS.length, 6);
  for (const experiment of FLIGHT_EXPERIMENTS) {
    const a = createFlightExperiment(experiment.id), b = createFlightExperiment(experiment.id);
    assert.deepEqual(a, b);
    assert.notEqual(a, b);
    if (a.landing) { assert.notEqual(a.landing, b.landing); a.landing.friction = 0; assert.equal(b.landing!.friction, 0.8); }
  }
  assert.deepEqual(DEFAULT_FLIGHT, before);
  assert.deepEqual(createFlightExperiment('ascent'), DEFAULT_FLIGHT);
  const nominal = createFlightExperiment('assisted'), weak = createFlightExperiment('underpowered'), sideways = createFlightExperiment('sideways');
  assert.deepEqual(weak, { ...nominal, thrustN: 4000 });
  assert.deepEqual(sideways, { ...nominal, horizontalMps: 100 });
});

test('production solver distinguishes assisted nominal, insufficient thrust and sideways overshoot', () => {
  const nominal = simulateFlight(createFlightExperiment('assisted'), flatTerrain);
  const weak = simulateFlight(createFlightExperiment('underpowered'), flatTerrain);
  const sideways = simulateFlight(createFlightExperiment('sideways'), flatTerrain);
  assert.equal(nominal.landingOutcome!.state, 'within-assumed-limits');
  assert.equal(weak.landingOutcome!.state, 'outside-assumed-limits');
  assert.equal(sideways.landingOutcome!.state, 'outside-assumed-limits');
  assert.ok(weak.initialThrustToWeight < 1);
  assert.ok(Math.abs(weak.landingOutcome!.verticalMps!) > Math.abs(nominal.landingOutcome!.verticalMps!) + 10);
  assert.ok(sideways.landingOutcome!.horizontalMps! > nominal.landingOutcome!.horizontalMps! + 10);
  assert.ok(sideways.landingOutcome!.targetErrorM! > nominal.landingOutcome!.targetErrorM! + 100);
  assert.ok(!weak.fuelExhausted, 'underpowered failure must not be relabeled fuel exhaustion');
});

test('single-variable manual burn and ascent pitch changes have the predicted direction in production', () => {
  const manual = createFlightExperiment('manual');
  const short = simulateFlight({ ...manual, burnSeconds: 8 }, flatTerrain);
  const longer = simulateFlight(manual, flatTerrain);
  assert.equal(longer.landingOutcome!.state, 'outside-assumed-limits');
  assert.ok(longer.contact!.timeS > manual.burnSeconds);
  assert.ok(Math.abs(short.landingOutcome!.verticalMps!) > Math.abs(longer.landingOutcome!.verticalMps!));
  const ascent = createFlightExperiment('ascent');
  const original = simulateFlight(ascent, flatTerrain);
  const steeper = simulateFlight({ ...ascent, finalPitchDeg: 60 }, flatTerrain);
  assert.ok(original.maxAltitudeM > 1000);
  assert.ok(steeper.maxAltitudeM > original.maxAltitudeM);
});

test('contact reference keeps real incoming speed and sub-threshold energy; restitution does not change airborne motion', () => {
  const a = createFlightExperiment('contact'), r = simulateFlight(a, flatTerrain);
  const lowBounce = simulateFlight({ ...a, landing: { ...a.landing!, restitution: 0.1 } }, flatTerrain);
  assert.deepEqual(r.points, lowBounce.points);
  assert.deepEqual(r.contact, lowBounce.contact);
  const energy = 0.5 * r.contact!.massKg * Math.hypot(...r.contact!.velocityMps) ** 2;
  assert.ok(energy < a.landing!.breakupEnergyJ);
  assert.ok(Math.abs(r.landingOutcome!.verticalMps!) > a.landing!.maxVerticalMps);
  assert.equal(r.landingOutcome!.state, 'outside-assumed-limits');
  assert.match(flightFuelReason(a, r), /No thrust requested/);
});

test('unknown terrain never inherits the synthetic reference pass, including in a rotating local frame', () => {
  const a = createFlightExperiment('assisted');
  const known = simulateFlight(a, flatTerrain, MOON_RADIUS_M, { latitudeDeg: -89.5 });
  const unknown = simulateFlight(a, () => null, MOON_RADIUS_M, { latitudeDeg: -89.5 });
  assert.equal(known.landingOutcome!.state, 'within-assumed-limits');
  assert.equal(unknown.status, 'reference contact');
  assert.equal(unknown.landingOutcome!.state, 'unresolved');
  assert.match(unknown.landingOutcome!.reasons.join(' '), /terrain height.*unknown/);
});

test('diagnostics use actual initial radius, radial velocity and final airborne mass with explicit ideal assumptions', () => {
  const a = createFlightExperiment('assisted');
  const r = simulateFlight(a, flatTerrain, MOON_RADIUS_M + 1000);
  const d = flightDiagnostics(a, r);
  const g = LUNAR_MU / Math.hypot(...r.points[0].positionM) ** 2;
  assert.equal(d.gravityMps2, g);
  assert.equal(d.thrustToWeight, r.initialThrustToWeight);
  assert.equal(d.uprightNetMps2, a.thrustN / a.wetMassKg - g);
  assert.equal(d.stoppingDistanceM, r.points[0].verticalMps ** 2 / (2 * d.uprightNetMps2!));
  assert.equal(d.remainingPropellantKg, r.points.at(-1)!.massKg - a.dryMassKg);
  const fullBudget = a.ispSeconds * 9.80665 * Math.log(a.wetMassKg / a.dryMassKg);
  assert.ok(Math.abs(r.deltaVMps + d.idealRemainingDeltaVMps! - fullBudget) < 1e-8);
  assert.match(flightFuelReason(a, r), /Contact ended.*propellant remains/);
});

test('stopping estimates remain unavailable without descent, net braking, burn time or fuel', () => {
  for (const id of ['ascent', 'underpowered', 'contact'] as const) {
    const a = createFlightExperiment(id), r = simulateFlight(a, flatTerrain), d = flightDiagnostics(a, r);
    assert.equal(d.stoppingDistanceM, null, id);
    assert.ok(d.stoppingUnavailable, id);
  }
  for (const override of [{ burnSeconds: 0 }, { dryMassKg: DEFAULT_FLIGHT.wetMassKg }]) {
    const a = { ...createFlightExperiment('assisted'), ...override };
    assert.equal(flightDiagnostics(a, simulateFlight(a, flatTerrain)).stoppingDistanceM, null);
  }
  const a = createFlightExperiment('assisted'), r = simulateFlight(a, flatTerrain);
  const empty: FlightResult = { ...r, points: [], contact: undefined, landingOutcome: undefined };
  const absent = flightDiagnostics(a, empty);
  assert.equal(absent.gravityMps2, null);
  assert.equal(absent.idealRemainingDeltaVMps, null);
  assert.equal(absent.stoppingDistanceM, null);
  assert.match(flightFuelReason(a, empty), /unavailable/);
  const invalid = flightDiagnostics({ ...a, dryMassKg: a.wetMassKg + 1 }, r);
  assert.equal(invalid.idealRemainingDeltaVMps, null);
  assert.equal(invalid.stoppingDistanceM, null);
});

test('fuel explanations distinguish depletion from cutoff and preview end in the production solver', () => {
  const manual = createFlightExperiment('manual');
  assert.match(flightFuelReason(manual, simulateFlight(manual, flatTerrain)), /Powered-time limit reached/);
  const short = { ...manual, durationSeconds: 1 };
  assert.match(flightFuelReason(short, simulateFlight(short, flatTerrain)), /Preview ended/);
  const noBurn = { ...manual, burnSeconds: 0 };
  assert.match(flightFuelReason(noBurn, simulateFlight(noBurn, flatTerrain)), /Powered time is zero/);
  const depleted = { ...manual, dryMassKg: manual.wetMassKg - 1 };
  assert.match(flightFuelReason(depleted, simulateFlight(depleted, flatTerrain)), /Propellant exhausted/);
});

test('compact experiment controls preserve callbacks, controlled play state and audience-specific native mathematics', () => {
  const value = createFlightExperiment('assisted'), result = simulateFlight(value, flatTerrain);
  const callbacks = { onPlay: () => {}, onPause: () => {}, onReplay: () => {}, onFollow: () => {} };
  const html = (playing: boolean, connected: boolean, audience: 'public' | 'teach' | 'plan') => renderToStaticMarkup(createElement(AudienceContext.Provider, { value: audience }, createElement(FlightExperiments, { value, result, onChange: () => {}, playing, ...(connected ? callbacks : {}) })));
  for (const mode of ['public', 'teach', 'plan'] as const) {
    const markup = html(false, true, mode);
    for (const label of ['Load reference', 'Play experiment', 'Replay experiment', 'Follow vehicle', 'Predict:', 'Change one variable:', 'Observe · current inputs']) assert.ok(markup.includes(label), label);
    assert.match(markup, /does not prove closed-loop feasibility/);
    assert.match(markup, /tested synthetic/);
    assert.doesNotMatch(markup, /disabled=""/);
    assert.ok(markup.includes('<math') === (mode !== 'public'));
    assert.doesNotMatch(markup, /\\frac|\\Delta|\\mu/);
  }
  assert.match(html(true, true, 'public'), /Pause experiment/);
  assert.match(html(false, false, 'public'), /disabled=""/);
  assert.match(html(false, true, 'teach'), /every other input held fixed/);
  assert.match(html(false, true, 'plan'), /Review signed radial speed/);
  const panel = FlightPanel({ value, result, onChange: () => {}, ...callbacks, playing: true });
  const children = React.Children.toArray(panel.props.children) as React.ReactElement[];
  const experiments = children.find(child => child.type === FlightExperiments)! as React.ReactElement<typeof callbacks & { playing: boolean }>;
  for (const key of Object.keys(callbacks) as Array<keyof typeof callbacks>) assert.equal(experiments.props[key], callbacks[key]);
  assert.equal(experiments.props.playing, true);
});

test('visible current-site observation qualifies missing ground separately from reference evidence', () => {
  const value = createFlightExperiment('assisted');
  const html = renderToStaticMarkup(createElement(FlightExperiments, { value, result: simulateFlight(value), onChange: () => {} }));
  assert.match(html, /Reference-sphere contact; numerical ground unavailable/);
  assert.match(html, /Contact requirements unresolved/);
  assert.match(html, /Obtain numerical terrain at contact/);
  assert.doesNotMatch(html, /Within entered incoming-contact limits/);
});


test('current-result next actions follow actual failure rather than the browsed reference card', () => {
  for (const [id, expected] of [['underpowered', /Compare thrust or initial downward speed/], ['sideways', /Compare thrust or initial downward speed/], ['ascent', /Compare final burn pitch alone/]] as const) {
    const value = createFlightExperiment(id);
    const html = renderToStaticMarkup(createElement(FlightExperiments, { value, result: simulateFlight(value, flatTerrain), onChange: () => {} }));
    assert.match(html, expected);
  }
});
