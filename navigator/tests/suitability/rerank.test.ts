import {test} from 'node:test';import assert from 'node:assert/strict';
import {reweightScreeningPoints,screeningLocations,type ScreeningPoint} from '../../lib/suitability';
import {catalog,request} from './fixtures';
const point:ScreeningPoint={lat:0,lon:0,sunFraction:.8,longestDarkHours:1,darkLowerBound:true,commsFraction:.6,slopeDeg:2,score:null,source:'Synthetic rerank fixture',spacingM:10,notes:[]};
test('weight edits recolour unchanged physical quantities using the shared score',()=>{
 const input=Object.freeze({...point}),before=JSON.stringify(input),r=request(catalog());
 const result=reweightScreeningPoints(r,[input])[0];assert.ok(Math.abs(result.score!-(.8+2/3+.8+.6)/4*100)<1e-10);assert.equal(JSON.stringify(input),before);assert.equal(result.longestDarkHours,1);assert.equal(result.darkLowerBound,true);
 const sun=reweightScreeningPoints({...r,weights:{sun:1,dark:0,slope:0,comms:0}},[{...point,slopeDeg:null,commsFraction:null}])[0];assert.equal(sun.score,80);
 assert.equal(reweightScreeningPoints(r,[{...point,slopeDeg:null}])[0].score,null);assert.throws(()=>reweightScreeningPoints({...r,weights:{sun:0,dark:0,slope:0,comms:0}},[point]),/positive total/);
});
test('viewport refinement is bounded, cancellable and preserves exact sampled coordinates',async()=>{
 const r=request(catalog());await assert.rejects(screeningLocations(r,Array.from({length:257},()=>({lat:0,lon:0}))),/limited/);
 const c=new AbortController();c.abort();await assert.rejects(screeningLocations(r,[{lat:0,lon:0}],{signal:c.signal}),{name:'AbortError'});
 const progress:number[]=[];const samples=await screeningLocations(r,[{lat:0,lon:0},{lat:10,lon:540}],{onProgress:n=>progress.push(n)});assert.equal(samples[1].lon,180);assert.equal(samples[1].score,null);assert.deepEqual(progress,[0,1,2]);assert.equal(samples[0].lat,0);
});
