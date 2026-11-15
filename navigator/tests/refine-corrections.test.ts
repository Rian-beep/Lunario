import assert from 'node:assert/strict';
import test from 'node:test';
import React, {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {FlightGraphs} from '../components/workbench/science-charts';
import {AudienceContext} from '../components/workbench/info';
import {DEFAULT_FLIGHT, simulateFlight} from '../lib/flight';
import {DEFAULT_LANDING_CONFIGURATION} from '../lib/landing-contract';

Object.defineProperty(globalThis,'React',{value:React,configurable:true});
for (const guidance of ['target-landing','manual'] as const) test(`${guidance} charts describe the configured rotating solver, not the legacy integrator`,()=>{
  const flight=simulateFlight({...DEFAULT_FLIGHT,mode:'descent',altitudeM:300,durationSeconds:2,
    landing:{...DEFAULT_LANDING_CONFIGURATION,guidance}},()=>0,1737400,{latitudeDeg:-89.5});
  for(const audience of ['public','teach','plan'] as const){
    const html=renderToStaticMarkup(createElement(AudienceContext.Provider,{value:audience},createElement(FlightGraphs,{flight,cursor:1,onCursor:()=>{}})));
    assert.doesNotMatch(html,/lunar rotation neglected|nonrotating local frame|0\.25 s/);
    assert.match(html,/Moon-fixed east\/up\/north frame/);
    assert.match(html,/Coriolis and centrifugal/);
    assert.match(html,/≤0\.1 s force commands/);
  }
});

test('legacy manual charts retain the real nonrotating 0.25 s description in all audiences',()=>{
  const flight=simulateFlight({...DEFAULT_FLIGHT,durationSeconds:2});
  for(const audience of ['public','teach','plan'] as const){
    const html=renderToStaticMarkup(createElement(AudienceContext.Provider,{value:audience},createElement(FlightGraphs,{flight,cursor:1,onCursor:()=>{}})));
    assert.match(html,/lunar rotation neglected/);
    assert.match(html,/0\.25 s/);
    assert.doesNotMatch(html,/Moon-fixed|Coriolis|≤0\.1 s force commands/);
  }
});

test('configured flight without a rotation environment never claims rotating forces',()=>{
  const flight=simulateFlight({...DEFAULT_FLIGHT,mode:'descent',altitudeM:300,durationSeconds:2,landing:{...DEFAULT_LANDING_CONFIGURATION}},()=>0);
  const html=renderToStaticMarkup(createElement(FlightGraphs,{flight,cursor:1,onCursor:()=>{}}));
  assert.match(html,/Fixed nonrotating east\/up\/north/);
  assert.match(html,/≤0\.1 s force commands/);
  assert.doesNotMatch(html,/Moon-fixed acceleration|<mi>Ω<\/mi>|0\.25 s/);
});

test('selected parameter equations include rotating terms only in the rotating computation and retain native units',()=>{
  for(const guidance of ['target-landing','manual'] as const){
    const flight=simulateFlight({...DEFAULT_FLIGHT,mode:'descent',altitudeM:300,durationSeconds:2.13,
      landing:{...DEFAULT_LANDING_CONFIGURATION,guidance}},()=>0,1737400,{latitudeDeg:34,rotationRateRadS:0});
    const html=renderToStaticMarkup(createElement(FlightGraphs,{flight,cursor:1,onCursor:()=>{}}));
    assert.match(html,/<mi>Ω<\/mi>/);assert.match(html,/constant spin 0 rad\/s/);
    assert.match(html,/left-handed east\/up\/north/);assert.match(html,/kg\/s|specific impulse \(s\)/);
    assert.match(html,/0\.5 s apart plus terminal states/);assert.match(html,/Sample spacing is not an error tolerance/);
    assert.equal(flight.points.at(-1)?.t,2.13);
    assert.ok(flight.points.some((p,i)=>i>0&&Math.abs(p.t-flight.points[i-1].t-.5)<1e-8));
    assert.ok(html.includes(guidance==='target-landing'?'saved manual pitch schedule is inactive':'Manual guidance uses the configured heading'));
  }
});
