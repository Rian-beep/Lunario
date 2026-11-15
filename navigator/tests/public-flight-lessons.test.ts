import {test} from 'node:test';
import assert from 'node:assert/strict';
import React,{createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createFlightExperiment} from '../lib/flight-experiments';
import {FLIGHT_CONTROL_LESSONS, explainPublicFlight, flightEdits} from '../lib/flight-lessons';
import {simulateFlight} from '../lib/flight';
import {FlightPanel} from '../components/workbench/panels';
Object.assign(globalThis,{React});

test('public explanation names each failed production contact check and retains missing evidence',()=>{
 for(const id of ['assisted','underpowered','sideways','contact'] as const){
  const a=createFlightExperiment(id),r=simulateFlight(a,()=>0),p=explainPublicFlight(a,r);
  if(id==='assisted'){assert.match(p.title,/Within/);assert.match(p.reasons.join(' '),/does not certify/);}
  else {assert.match(p.title,/misses/);assert.match(p.reasons.join(' '),/Too fast up\/down/);}
  if(id==='sideways')assert.match(p.reasons.join(' '),/sideways speed[\s\S]*Missed the target/);
  if(id==='underpowered')assert.match(p.reasons.join(' '),/breakup threshold/);
 }
 const a=createFlightExperiment('assisted'),r=simulateFlight(a,()=>null);
 assert.match(explainPublicFlight(a,r).title,/cannot be confirmed/);
 assert.match(explainPublicFlight(a,r).reasons.join(' '),/Ground data is missing/);
 const weak=createFlightExperiment('underpowered');
 const unknown=explainPublicFlight(weak,simulateFlight(weak,()=>null));
 assert.match(unknown.reasons.join(' '),/Too fast[\s\S]*Ground data is missing/);
});
test('no contact and takeoff are separate from a successful landing',()=>{
 const a={...createFlightExperiment('assisted'),durationSeconds:1};
 assert.match(explainPublicFlight(a,simulateFlight(a,()=>0)).title,/No touchdown/);
 const launch=createFlightExperiment('ascent');
 assert.match(explainPublicFlight(launch,simulateFlight(launch,()=>0)).reasons.join(' '),/does not prove.*orbit/);
});
test('control explanations distinguish trajectory, acceptance-only and post-contact effects',()=>{
 const a=createFlightExperiment('assisted');
 for(const [key,label] of [['thrustN','Thrust'],['dryMassKg','Dry mass'],['ispSeconds','Specific impulse'],['durationSeconds','Preview duration']] as const){
  const edits=flightEdits(a,{...a,[key]:a[key]+1});assert.equal(edits.length,1);assert.equal(edits[0].label,label);assert.equal(edits[0].explanation,FLIGHT_CONTROL_LESSONS[label]);
 }
 const r=simulateFlight(a,()=>0);
 for(const [key,label] of [['targetRadiusM','Target radius'],['maxVerticalMps','Maximum vertical contact speed'],['friction','Contact friction'],['restitution','Contact restitution']] as const){
  const b={...a,landing:{...a.landing!,[key]:key==='targetRadiusM'?.01:key==='maxVerticalMps'?.01:.5}};
  assert.deepEqual(simulateFlight(b,()=>0).points,r.points,'These controls must not change the airborne path');
  const e=flightEdits(a,b);assert.equal(e.length,1);assert.equal(e[0].label,label);assert.ok(e[0].explanation.length>60);
 }
 assert.deepEqual(flightEdits(a,structuredClone(a)),[]);
});
test('every displayed flight numeric variable has adjacent substantive i help, including contact controls',()=>{
 for(const id of ['assisted','manual','ascent'] as const){
  const a=createFlightExperiment(id),html=renderToStaticMarkup(createElement(FlightPanel,{value:a,result:simulateFlight(a,()=>0),onChange:()=>{}}));
  for(const label of ['Start altitude','Horizontal speed','Vertical speed','Heading, from north','Wet mass','Dry mass','Thrust','Specific impulse','Burn duration','Preview duration'])assert.ok(html.includes(`About ${label}`),label);
  if(a.landing)for(const label of ['Start east offset','Start north offset','Target radius','Maximum vertical contact speed','Maximum horizontal contact speed','Maximum contact tilt','Breakup energy threshold','Contact friction','Contact restitution','Contact continuation'])assert.ok(html.includes(`About ${label}`),label);
  if(id!=='assisted')for(const label of ['Initial pitch','Final burn pitch'])assert.ok(html.includes(`About ${label}`),label);
  assert.match(html,/flight runs automatically/);
  assert.match(html,/Prediction/);
 }
});
