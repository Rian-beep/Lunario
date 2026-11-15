import {test} from 'node:test';
import assert from 'node:assert/strict';
import {glossaryFor} from '../lib/glossary';
import {resolveVariableNotation} from '../lib/variable-notation';
import {nativeMathMarkup} from '../lib/math-typesetting';
import {DEFAULT_FLIGHT, simulateFlight} from '../lib/flight';
import {createLandingFlight} from '../lib/landing-presets';

test('configured start height is distinguished from actual radial altitude at an offset',()=>{
  const radius=1737400;
  const input=createLandingFlight(DEFAULT_FLIGHT);
  const result=simulateFlight(input,()=>0,radius,{latitudeDeg:-89.5});
  const first=result.points[0];
  assert.ok(Math.abs(first.positionM[1]-radius-input.altitudeM)<1e-8);
  assert.ok(Math.abs(first.altitudeM-input.altitudeM)>.01);
  const start=resolveVariableNotation('Start altitude')!;
  const radial=resolveVariableNotation('Height above surface (km)')!;
  assert.notEqual(start.id,radial.id);
  assert.match(start.meaning,/tangent-up.*configured.*radial.*legacy/i);
  assert.match(nativeMathMarkup(start.equation),/mtable/);
  assert.match(radial.meaning,/Radial distance/);
});

test('generic flight help preserves both solver contracts instead of applying legacy metadata to all flights',()=>{
  const time=glossaryFor('Flight time (s)')!;
  assert.match(time.technical,/legacy.*0\.25.*configured.*0\.1/i);
  assert.match(time.range,/contact.*replay/i);
  for(const label of ['Radial speed','Speed (m/s)'])assert.match(glossaryFor(label)!.technical,/selected.*frame/i);
  for(const label of ['Initial pitch','Final burn pitch'])assert.match(JSON.stringify(glossaryFor(label)),/Assisted target guidance.*(commands|ignores)/);
  assert.match(glossaryFor('Thrust')!.technical,/maximum assisted thrust/);
  assert.match(resolveVariableNotation('Thrust')!.limits,/inertial.*rotation terms/i);
  assert.equal(resolveVariableNotation('Flight time (s)')!.unit,'s since preview start');
});
