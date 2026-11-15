import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nextVisibilityChange, visibilityBreakdown} from '../lib/windows';
test('next event is a sampled boundary after the current interval',()=>{
  assert.deepEqual(nextVisibilityChange([false,false,true,true,false],1),{kind:'change',index:2,visible:true});
  assert.deepEqual(nextVisibilityChange([true,true],0),{kind:'outside'});
});
test('unknown samples interrupt event claims',()=>{
  assert.deepEqual(nextVisibilityChange([false,null,true],0),{kind:'unknown'});
  assert.deepEqual(nextVisibilityChange([null,true],0),{kind:'unknown'});
});
test('joint visibility keeps unknown coverage separate from all four states',()=>{
  assert.deepEqual(visibilityBreakdown([{sun:true,contact:true},{sun:true,contact:false},{sun:false,contact:true},{sun:false,contact:false},{sun:null,contact:false}]),{both:1,sun:1,earth:1,neither:1,unknown:1,total:5});
});
import {visibilityCountdown} from '../lib/windows';
test('countdown reports a sample bracket, never sub-sample physical precision',()=>{
 assert.deepEqual(visibilityCountdown([true,true,false],.5,1),{kind:'change',index:2,visible:false,earliestHours:.5,latestHours:1.5});
 assert.deepEqual(visibilityCountdown([true,null,false],0,1),{kind:'unknown'});
 assert.deepEqual(visibilityCountdown([true,true],0,1),{kind:'outside'});
});

import {formatVisibilityCountdown,formatVisibilityUtcWindow} from '../lib/windows';
const change=(a:number,b:number)=>({kind:'change' as const,index:440,visible:false,earliestHours:a,latestHours:b});
test('long model brackets read as days and hours, while Public uses approximate days',()=>{
 assert.equal(formatVisibilityCountdown(change(439,440),'public'),'~18 days');
 assert.equal(formatVisibilityCountdown(change(439,440),'teach'),'18d7–8h');
 assert.equal(formatVisibilityCountdown(change(439,440),'plan'),'18d7–8h');
 assert.equal(formatVisibilityCountdown(change(65,66),'public'),'~3 days');
 assert.equal(formatVisibilityCountdown(change(65,66),'plan'),'2d17–18h');
});
test('subday and crossday countdowns retain ordered bounds without decimal hour walls',()=>{
 assert.equal(formatVisibilityCountdown(change(5,6),'plan'),'5–6h');
 assert.equal(formatVisibilityCountdown(change(23,24),'teach'),'23h–1d0h');
 assert.equal(formatVisibilityCountdown(change(.5,1.5),'plan'),'30m–1h30m');
 assert.equal(formatVisibilityCountdown(change(.25,.5),'public'),'~23 min');
});
test('unknown and beyond-stay forecasts never become zero countdowns',()=>{
 assert.equal(formatVisibilityCountdown({kind:'unknown'},'public'),'Not enough terrain data');
 assert.equal(formatVisibilityCountdown({kind:'outside'},'plan'),'Beyond selected stay');
 assert.equal(formatVisibilityCountdown(change(NaN,1),'plan'),'Not enough terrain data');
});
test('UTC event windows share one date when possible and disclose midnight/month/year crossings',()=>{
 const stamp=(s:string)=>Date.parse(s);
 assert.deepEqual(formatVisibilityUtcWindow(stamp('2027-10-25T08:00Z'),stamp('2027-10-25T09:00Z')),{date:'25 Oct 2027',time:'08:00–09:00 UTC'});
 assert.deepEqual(formatVisibilityUtcWindow(stamp('2027-10-25T23:00Z'),stamp('2027-10-26T00:00Z')),{date:'25–26 Oct 2027',time:'23:00–00:00 UTC'});
 assert.deepEqual(formatVisibilityUtcWindow(stamp('2027-10-31T23:00Z'),stamp('2027-11-01T00:00Z')),{date:'31 Oct–1 Nov 2027',time:'23:00–00:00 UTC'});
 assert.deepEqual(formatVisibilityUtcWindow(stamp('2027-12-31T23:00Z'),stamp('2028-01-01T00:00Z')),{date:'31 Dec 2027–1 Jan 2028',time:'23:00–00:00 UTC'});
 assert.equal(formatVisibilityUtcWindow(NaN,1),null);
});
