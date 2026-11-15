import {test} from 'node:test';
import assert from 'node:assert/strict';
import {summarize,rankWindows,unavailableTerrain,horizonAt,terrainForCustom,terrainForSite,type SampleSeries} from '../lib/astro';
import type {Catalog,Site} from '../lib/catalog';
function samples(h:number[]):SampleSeries{const a=(n:number)=>new Float64Array(h.length).fill(n);return {index0:0,sunAz:a(0),sunEl:a(-3),earthAz:a(0),earthEl:a(5),sunHorizon:new Float64Array(h),earthHorizon:a(0),sunRadius:a(.27),earthRadius:a(1)};}
test('unknown terrain cannot be reported as zero darkness',()=>{
  assert.ok(Number.isNaN(summarize(samples([NaN,NaN,NaN]),1).longestDarkTerrain));
  assert.ok(Number.isNaN(summarize(samples([0,NaN,0]),1).longestDarkTerrain));
  assert.equal(summarize(samples([0,0,0]),1).longestDarkTerrain,3);
});
test('global coordinates without local masks never borrow polar horizons',()=>{
  const unknown=terrainForCustom({grid:{}} as Catalog,0.674,23.473);
  assert.ok(unknown);assert.ok(unknown.mask.every(Number.isNaN));assert.equal(unknown.distanceKm,null);
  const historical=terrainForSite({horizons:[]} as unknown as Site,10);
  assert.ok(historical.mask.every(Number.isNaN));assert.equal(historical.heightM,10);
});
test('horizon interpolation cannot fill an unknown angular interval',()=>{
  const mask=new Float64Array([0,NaN]);
  assert.equal(horizonAt(mask,180,0),0);
  assert.ok(Number.isNaN(horizonAt(mask,180,90)));
  assert.ok(Number.isNaN(horizonAt(mask,180,180)));
  assert.ok(Number.isNaN(horizonAt(mask,180,270)));
});

test('date ranking excludes unknown terrain instead of scoring it as darkness',()=>{
  const a=(n:number)=>new Float64Array(6).fill(n);
  const c={meta:{stepHours:1,n:6},subsolarLat:a(0),subsolarLon:a(0),subearthLat:a(0),subearthLon:a(0),earthRangeKm:a(384400),sunRadiusDeg:a(.27)} as unknown as Catalog;
  const result=rankWindows(c,0,0,unavailableTerrain(),0,5,2,0);
  assert.deepEqual(result,{withEarth:[],brightest:[],unknownWindows:5});
});
