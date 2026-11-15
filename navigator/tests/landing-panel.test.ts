import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { createElement, isValidElement, type ReactNode } from 'react';
// Match the repository's standalone tsx SSR harness (Next supplies React in app builds).
Object.assign(globalThis, { React });
import { renderToStaticMarkup } from 'react-dom/server';
import { FlightPanel } from '../components/workbench/panels';
import { AudienceContext } from '../components/workbench/info';
import { DEFAULT_FLIGHT, simulateFlight, type FlightInputs } from '../lib/flight';
import { createLandingFlight } from '../lib/landing-presets';

test('landing controls and text outcomes render units and field-specific help in every audience', () => {
  const value = createLandingFlight(DEFAULT_FLIGHT);
  const result = simulateFlight(value, () => 0);
  for (const audience of ['public', 'teach', 'plan'] as const) {
    const html = renderToStaticMarkup(createElement(AudienceContext.Provider, { value: audience }, createElement(FlightPanel, { value, result, onChange: () => {} })));
    for (const label of ['Start east offset (m)', 'Start north offset (m)', 'Target radius (m)', 'Maximum vertical contact speed (m/s)', 'Maximum horizontal contact speed (m/s)', 'Maximum contact tilt (°)', 'Breakup energy threshold (J)', 'Contact friction (1)', 'Contact restitution (1)', 'Contact continuation (s)']) {
      assert.ok(html.includes(`aria-label="${label}"`), label);
      assert.ok(html.includes(`<summary>ⓘ ${label}</summary>`), label);
    }
    assert.match(html, /Assisted target approach/);
    assert.match(html, /Manual pitch &amp; burn/);
    assert.match(html, /Reset 300 m approach/);
    assert.match(html, /✓ Within entered contact limits/);
    assert.match(html, /Incoming vertical −?-/);
    assert.match(html, /radial vertical/);
    assert.match(html, /not NASA acceptance criteria/);
    assert.match(html, /great-circle arc/);
    assert.match(html, /Coulomb friction/);
    assert.match(html, /continuously variable throttle/);
  }
  const failed = renderToStaticMarkup(createElement(FlightPanel, { value, result: simulateFlight({ ...value, thrustN: 4000 }, () => 0), onChange: () => {} }));
  assert.match(failed, /× Outside entered contact limits/);
  assert.match(failed, /exceeds the entered/);
  const unknown = renderToStaticMarkup(createElement(FlightPanel, { value, result: simulateFlight(value), onChange: () => {} }));
  assert.match(unknown, /\? Contact unresolved/);
  assert.match(unknown, /Numerical terrain height at contact is unknown/);
});

type ElementProps = { children?: ReactNode; label?: string; onClick?: () => void; onChange?: (n: number) => void };
function elements(node: ReactNode): Array<ElementProps> {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<ElementProps>(node)) return [];
  return [node.props, ...elements(node.props.children)];
}
test('controlled guidance, offset, limit and reset edits preserve unrelated configured hardware and fields', () => {
  const original = createLandingFlight({ ...DEFAULT_FLIGHT, wetMassKg: 6000, thrustN: 20000 });
  const value = { ...original, eastOffsetM: -123, landing: { ...original.landing, friction: 0.4 } };
  let changed: FlightInputs | undefined;
  const props = elements(FlightPanel({ value, result: simulateFlight(value, () => 0), onChange: next => { changed = next; } }));
  const manual = props.find(p => p.children === 'Manual pitch & burn')!;
  manual.onClick!();
  assert.deepEqual(changed, { ...value, landing: { ...value.landing, guidance: 'manual' } });
  const east = props.find(p => p.label === 'Start east offset')!;
  east.onChange!(50);
  assert.deepEqual(changed, { ...value, eastOffsetM: 50 });
  const friction = props.find(p => p.label === 'Contact friction')!;
  friction.onChange!(0.2);
  assert.deepEqual(changed, { ...value, landing: { ...value.landing, friction: 0.2 } });
  const reset = props.find(p => p.children === 'Reset 300 m approach')!;
  reset.onClick!();
  assert.deepEqual(changed, createLandingFlight(value, true));
  assert.equal(changed!.wetMassKg, 6000);
  assert.equal(changed!.thrustN, 20000);
  const ascentTree = elements(FlightPanel({ value: DEFAULT_FLIGHT, result: simulateFlight(DEFAULT_FLIGHT), onChange: next => { changed = next; } }));
  ascentTree.find(p => p.children === 'Descent')!.onClick!();
  assert.deepEqual(changed, createLandingFlight(DEFAULT_FLIGHT));
});

test('expanded contact verdicts use opaque theme states without overriding their foreground with legacy ink',()=>{
 const value=createLandingFlight(DEFAULT_FLIGHT);
 for(const [input,terrain,state] of [[value,()=>0,'within-assumed-limits'],[{...value,thrustN:4000},()=>0,'outside-assumed-limits'],[value,undefined,'unknown']] as const){
  const result=simulateFlight(input,terrain);const html=renderToStaticMarkup(createElement(FlightPanel,{value:input,result,onChange:()=>{}}));
  assert.match(html,/data-landing-contact-result/);assert.ok(html.includes(`constraint landing-outcome ${result.landingOutcome?.state}`));assert.doesNotMatch(html,/#4b6039|#e4e7d978|#8a403210/);assert.ok(state==='unknown'||result.landingOutcome?.state===state);
 }
});
