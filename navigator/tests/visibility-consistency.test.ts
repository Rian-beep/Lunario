import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodeCatalog} from '../lib/catalog';
import {buildSeries,earthCenterVisible,indexToMs,msToIndex,summarize} from '../lib/astro';
import type {SampleSeries} from '../lib/astro';
import {resolveAnalysisContext} from '../lib/analysis-context';
import {parseEvidenceManifest} from '../lib/provenance';
import {DEFAULT_MISSION,evaluateMission} from '../lib/mission';
import type {ScenarioState} from '../lib/scenario';

const catalog=decodeCatalog(JSON.parse(readFileSync('public/data/catalog.json','utf8')));
const manifest=parseEvidenceManifest(JSON.parse(readFileSync('public/data/evidence-manifest.json','utf8')));
const demo=JSON.parse(readFileSync('public/data/planning-demo.json','utf8')) as {cases:Array<{role:string;state:ScenarioState}>};
const alternative=demo.cases.find(item=>item.role==='alternative')!.state;

function assertContactAgreement(series:SampleSeries,mask:number){
 const step=catalog.meta.stepHours;
 const overview=summarize(series,step,{antennaMaskDeg:mask});
 const mission=evaluateMission(series,step,{...DEFAULT_MISSION,antennaMaskDeg:mask});
 const sphere=evaluateMission(series,step,{...DEFAULT_MISSION,antennaMaskDeg:mask},true);
 if(mission.contactFraction===null)assert.ok(Number.isNaN(overview.earthTerrain));
 else assert.equal(overview.earthTerrain,mission.contactFraction);
 if(sphere.contactFraction===null)assert.ok(Number.isNaN(overview.earthSphere));
 else assert.equal(overview.earthSphere,sphere.contactFraction);
 const visible=new Set(overview.earthWindows.flatMap(span=>{
  assert.equal(span.hours,(span.endIndex-span.startIndex+1)*step);
  return Array.from({length:span.endIndex-span.startIndex+1},(_,k)=>span.startIndex+k);
 }));
 assert.deepEqual(Array.from(series.earthEl,(_,k)=>visible.has(series.index0+k)),mission.timeline.map(sample=>sample.contact===true));
 return {overview,mission};
}

test('demo overview and horizon windows agree with mission contact at the same height and mask',()=>{
 const context=resolveAnalysisContext(catalog,{...alternative,displayHeightM:alternative.heightM},manifest);
 const display=buildSeries(catalog,context.location.lat,context.location.lon,context.antennaTerrain,alternative.startIndex,alternative.endIndex);
 assert.deepEqual(display,context.antennaSeries);
 const overview=summarize(display,catalog.meta.stepHours,{antennaMaskDeg:alternative.mission.antennaMaskDeg});
 const mission=evaluateMission(context.arraySeries,catalog.meta.stepHours,alternative.mission,false,{contactSeries:context.antennaSeries});
 assert.equal(overview.earthTerrain,mission.contactFraction);
 const windowSamples=new Set(overview.earthWindows.flatMap(span=>Array.from({length:span.endIndex-span.startIndex+1},(_,k)=>span.startIndex+k)));
 assert.deepEqual(Array.from(display.earthEl,(_,k)=>windowSamples.has(display.index0+k)),mission.timeline.map(sample=>sample.contact));
 const raw=summarize(display,catalog.meta.stepHours);
 assert.ok(raw.earthTerrain>overview.earthTerrain);
 const rawUp=Array.from(display.earthEl,(el,k)=>el>display.earthHorizon[k]);
 const extra=rawUp.flatMap((up,k)=>up&&!mission.timeline[k].contact?[k]:[]);
 assert.ok(extra.length>0);
 assert.ok(extra.every(k=>display.earthEl[k]<0&&display.earthHorizon[k]<display.earthEl[k]));
 const first=mission.timeline.findIndex(sample=>sample.contact);
 assert.equal(mission.longestBlackoutHours,first*catalog.meta.stepHours);
 assert.equal(overview.earthWindows[0].startIndex,display.index0+first);
 assert.ok(indexToMs(catalog,raw.earthWindows[0].startIndex)<indexToMs(catalog,overview.earthWindows[0].startIndex));
});

test('prepared sites and dates agree at controlled observer heights and antenna masks',()=>{
 let checked=0,heightChanges=0,maskChanges=0;
 for(const site of catalog.sites.filter(site=>site.horizons.length)){
  for(const startIndex of [alternative.startIndex,msToIndex(catalog,Date.parse('2027-05-01T00:00:00Z'))]){
   const endIndex=startIndex+335;
   const context=(height:number)=>resolveAnalysisContext(catalog,{siteId:site.id,custom:null,startIndex,endIndex,arrayHeightM:height,antennaHeightM:height,displayHeightM:height},manifest);
   const baseline=context(2);
   for(const height of [0,2,10]){
    const current=context(height);
    const display=buildSeries(catalog,site.lat,site.lon,current.antennaTerrain,startIndex,endIndex);
    assert.deepEqual(display,current.antennaSeries);
    assert.deepEqual(display.earthEl,baseline.antennaSeries.earthEl);
    if(display.earthHorizon.some((h,k)=>h!==baseline.antennaSeries.earthHorizon[k]))heightChanges++;
    const zero=assertContactAgreement(display,0);
    for(const mask of [1,5]){
     const raised=assertContactAgreement(display,mask);
     assert.ok(raised.overview.earthTerrain<=zero.overview.earthTerrain);
     assert.equal(raised.mission.generatedWh,zero.mission.generatedWh);
     assert.deepEqual(raised.mission.timeline.map(sample=>sample.sun),zero.mission.timeline.map(sample=>sample.sun));
     if(raised.overview.earthTerrain!==zero.overview.earthTerrain)maskChanges++;
    }
    checked++;
   }
  }
 }
 assert.ok(checked>=12,'exercise multiple prepared sites, dates and heights');
 assert.ok(heightChanges>0,'height changes must exercise real prepared mask differences');
 assert.ok(maskChanges>0,'mask changes must affect real contact intervals');
});

test('changing only antenna height selects its own horizon without changing array generation',()=>{
 const base=resolveAnalysisContext(catalog,{...alternative,displayHeightM:alternative.heightM},manifest);
 const raised=resolveAnalysisContext(catalog,{...alternative,antennaHeightM:10,displayHeightM:alternative.heightM},manifest);
 assert.deepEqual(raised.arraySeries,base.arraySeries);
 assert.deepEqual(raised.antennaSeries.earthEl,base.antennaSeries.earthEl);
 assert.notDeepEqual(raised.antennaSeries.earthHorizon,base.antennaSeries.earthHorizon);
 const a=evaluateMission(base.arraySeries,catalog.meta.stepHours,alternative.mission,false,{contactSeries:base.antennaSeries});
 const b=evaluateMission(raised.arraySeries,catalog.meta.stepHours,alternative.mission,false,{contactSeries:raised.antennaSeries});
 assert.equal(a.generatedWh,b.generatedWh);
 assert.equal(summarize(raised.antennaSeries,catalog.meta.stepHours,{antennaMaskDeg:alternative.mission.antennaMaskDeg}).earthTerrain,b.contactFraction);
});

test('unknown horizon and body samples stay unknown; known zero stays zero',()=>{
 const context=resolveAnalysisContext(catalog,{...alternative,displayHeightM:alternative.heightM},manifest);
 for(const field of ['earthHorizon','earthEl'] as const){
  const partial=structuredClone(context.antennaSeries);
  partial[field][partial.earthEl.length-1]=NaN;
  assertContactAgreement(partial,0);
 }
 const unknown=structuredClone(context.antennaSeries);
 unknown.earthHorizon.fill(NaN);
 const missing=assertContactAgreement(unknown,0);
 assert.ok(Number.isNaN(missing.overview.earthTerrain));
 assert.deepEqual(missing.overview.earthWindows,[]);
 assert.equal(missing.mission.longestBlackoutHours,null);
 assert.ok(Number.isFinite(missing.overview.earthSphere));
 const blocked=assertContactAgreement(context.antennaSeries,90);
 assert.equal(blocked.overview.earthTerrain,0);
 assert.equal(blocked.mission.longestBlackoutHours,context.antennaSeries.earthEl.length*catalog.meta.stepHours);
 const solarGap=structuredClone(context.antennaSeries);
 solarGap.sunHorizon.fill(NaN);
 assert.equal(assertContactAgreement(solarGap,0).overview.earthTerrain,assertContactAgreement(context.antennaSeries,0).overview.earthTerrain);
 const absent=resolveAnalysisContext(catalog,{...alternative,displayHeightM:alternative.heightM},{...manifest,entries:[]});
 assertContactAgreement(absent.antennaSeries,0);
});

test('the shared Earth-centre rule distinguishes an omitted mask, zero, equality and unknown',()=>{
 assert.equal(earthCenterVisible(-0.5,-1),true);
 assert.equal(earthCenterVisible(-0.5,-1,0),false);
 assert.equal(earthCenterVisible(0,-1,0),false);
 assert.equal(earthCenterVisible(1,1,0),false);
 assert.equal(earthCenterVisible(1,0,1),false);
 assert.equal(earthCenterVisible(1.01,0,1),true);
 assert.equal(earthCenterVisible(10,NaN,0),null);
 assert.equal(earthCenterVisible(NaN,0,0),null);
 assert.equal(earthCenterVisible(10,0,NaN),null);
});
