import {test} from 'node:test';import assert from 'node:assert/strict';import {createPlaybackClock,environmentPlaybackRate} from '../lib/playback';
const clock=(ratePerSecond:number,reducedMotion=false)=>createPlaybackClock({startPosition:10,endPosition:100000,startWallMs:1000,ratePerSecond,reducedMotion});
test('6h/s and24h/s advance precisely4x over the same physical wall interval',()=>{
 const slow=clock(6),fast=clock(24);for(const now of [1000,1250,2000,2400,9500])assert.equal(fast.positionAt(now)-10,4*(slow.positionAt(now)-10));assert.equal(slow.sample(2400).position,18.4);assert.equal(fast.sample(2000).position,34);
});
test('half-hour catalog sampling converts6h/s and24h/s to12 and48 positions/s',()=>{
 assert.equal(environmentPlaybackRate(6,.5),12);assert.equal(environmentPlaybackRate(24,.5),48);
 const a=clock(environmentPlaybackRate(6,.5)),b=clock(environmentPlaybackRate(24,.5));assert.equal(a.sample(2000).position-10,12);assert.equal(b.sample(2000).position-10,48);
});
test('60Hz,1Hz and a1.4s stalled frame reach the same anchored position',()=>{
 const fastFrames=clock(6),slowFrames=clock(6),stalled=clock(6);for(let i=0;i<=600;i++)fastFrames.sample(1000+i*1000/60);for(let i=0;i<=10;i++)slowFrames.sample(1000+i*1000);
 assert.deepEqual(fastFrames.sample(11000),slowFrames.sample(11000));assert.equal(fastFrames.sample(11000).position,70);assert.equal(stalled.sample(2400).position,18.4);assert.equal(stalled.sample(11000).position,70);
});
test('rate-change reanchor preserves the continuous position and applies only the new future rate',()=>{
 const before=clock(6),position=before.positionAt(2400),after=createPlaybackClock({startPosition:position,endPosition:100000,startWallMs:2400,ratePerSecond:24});assert.equal(after.sample(2400).position,position);assert.equal(after.sample(3400).position,position+24);assert.equal(before.positionAt(3400),24.4);
});
test('reduced motion publishes1s steps without losing subsecond elapsed time or reanchor fractions',()=>{
 const stepped=clock(6,true);assert.equal(stepped.sample(1999).position,10);assert.equal(stepped.sample(2400).position,16);assert.equal(stepped.positionAt(2400),18.4);assert.equal(stepped.sample(3000).position,22);assert.equal(stepped.sample(3999).position,22);assert.equal(stepped.sample(4000).position,28);
 const after=createPlaybackClock({startPosition:stepped.positionAt(2400),endPosition:100000,startWallMs:2400,ratePerSecond:24,reducedMotion:true});assert.equal(after.positionAt(2400),18.4);assert.equal(after.sample(3400).position,42.4);
});
test('endpoints stop exactly, including a fractional reduced-motion final interval',()=>{
 const a=createPlaybackClock({startPosition:0,endPosition:9,startWallMs:0,ratePerSecond:6,reducedMotion:true});assert.deepEqual(a.sample(1400),{position:6,complete:false});assert.deepEqual(a.sample(1500),{position:9,complete:true});assert.deepEqual(a.sample(100000),{position:9,complete:true});assert.deepEqual(createPlaybackClock({startPosition:3,endPosition:3,startWallMs:0,ratePerSecond:1}).sample(0),{position:3,complete:true});
});
test('before-anchor wall times clamp to start; malformed inputs fail with readable errors',()=>{
 const a=clock(6);assert.deepEqual(a.sample(-10),{position:10,complete:false});assert.deepEqual(a.sample(1000),{position:10,complete:false});assert.throws(()=>a.sample(NaN),/Current wall time.*finite/);assert.throws(()=>a.positionAt(Infinity),/Current wall time.*finite/);
 const valid={startPosition:0,endPosition:10,startWallMs:0,ratePerSecond:1};for(const field of ['startPosition','endPosition','startWallMs','ratePerSecond'] as const)assert.throws(()=>createPlaybackClock({...valid,[field]:NaN}),/finite/);
 assert.throws(()=>createPlaybackClock({...valid,endPosition:-1}),/at or after/);assert.throws(()=>createPlaybackClock({...valid,ratePerSecond:0}),/above zero/);assert.throws(()=>createPlaybackClock({...valid,ratePerSecond:-1}),/above zero/);assert.throws(()=>environmentPlaybackRate(6,0),/above zero/);assert.throws(()=>environmentPlaybackRate(Infinity,.5),/finite/);assert.throws(()=>environmentPlaybackRate(Number.MIN_VALUE,Number.MAX_VALUE),/numeric range/);
 assert.throws(()=>createPlaybackClock({...valid,reducedMotion:'yes' as unknown as boolean}),/boolean/);
});
test('clock captures immutable anchors rather than reading mutated caller options',()=>{
 const options={startPosition:0,endPosition:100,startWallMs:0,ratePerSecond:6},a=createPlaybackClock(options);options.ratePerSecond=24;options.startPosition=50;assert.equal(a.sample(1000).position,6);
});
