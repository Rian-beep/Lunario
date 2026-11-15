import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodeCatalog} from '../lib/catalog';
import {withLandingSites} from '../lib/landing-catalog';
import {LANDING_SITES} from '../lib/landing-sites';
import {parseEvidenceManifest} from '../lib/provenance';
import {
  DELAYED_LANDING_ROLES,
  borrowedHorizonTopWarning,
  firstSunlitPlayhead,
  firstSunlitPlayheadForScenario,
  formatTerrainSmoothContrast,
  isBorrowedHorizon,
  loadDelayedLandingDemo,
  longestDarkHours,
  sunlitFraction,
} from '../lib/delayed-landing-demo';
import {parseScenario} from '../lib/scenario';
import type {TerrainChoice} from '../lib/astro';

const demo=JSON.parse(readFileSync('public/data/planning-demo.json','utf8')) as {
  cases:Array<{role:string;state:unknown;assessment:{mission:{timeline:Array<{sun:boolean|null}>};sphereMission:{timeline:Array<{sun:boolean|null}>}}}>;
};
const catalog=withLandingSites(decodeCatalog(JSON.parse(readFileSync('public/data/catalog.json','utf8'))),LANDING_SITES);
const manifest=parseEvidenceManifest(JSON.parse(readFileSync('public/data/evidence-manifest.json','utf8')));

test('three delayed-landing cases load into Compare with verified sunlight fractions',async()=>{
  const raw=(globalThis as typeof globalThis&{__SOLARREACH_PLANNING_DEMO__?:unknown});
  raw.__SOLARREACH_PLANNING_DEMO__=demo;
  try{
    const loaded=await loadDelayedLandingDemo(catalog,manifest);
    assert.deepEqual(loaded.cases.map(c=>c.role),[...DELAYED_LANDING_ROLES]);
    assert.equal(loaded.cases.length,3);

    const [baseline,delayed,alternative]=loaded.cases;
    assert.equal(baseline.siteId,'connecting-ridge');
    assert.equal(delayed.siteId,'connecting-ridge');
    assert.equal(alternative.siteId,'degerlache-shackleton');
    assert.equal(baseline.startUtc,'2027-06-29T11:00:00.000Z');
    assert.equal(delayed.startUtc,'2027-07-13T11:00:00.000Z');
    assert.equal(alternative.startUtc,'2027-07-13T11:00:00.000Z');
    assert.equal(baseline.endIndex-baseline.startIndex,delayed.endIndex-delayed.startIndex);
    assert.equal(delayed.startIndex-baseline.startIndex,14*24);

    assert.equal(+(baseline.sunlitTerrainFraction*100).toFixed(1),97.6);
    assert.equal(+(baseline.sunlitSphereFraction*100).toFixed(1),0);
    assert.equal(+(delayed.sunlitTerrainFraction*100).toFixed(1),16.1);
    assert.equal(+(alternative.sunlitTerrainFraction*100).toFixed(1),95.5);
    assert.ok((delayed.longestDarkHours??0)/24>=8.5);
    assert.ok((delayed.longestDarkHours??0)/24<9.5);

    assert.equal(loaded.contrastLine,formatTerrainSmoothContrast(baseline.sunlitTerrainFraction,baseline.sunlitSphereFraction));
    assert.match(loaded.contrastLine,/97\.6% with real terrain against 0\.0% on a smooth Moon/);

    const fixtureBaseline=demo.cases.find(c=>c.role==='baseline')!;
    assert.equal(fixtureBaseline.assessment.mission.timeline[0]?.sun,false);
    assert.equal(loaded.baselinePlayheadIndex,firstSunlitPlayhead(baseline.startIndex,baseline.endIndex,fixtureBaseline.assessment.mission.timeline));
    assert.ok(loaded.baselinePlayheadIndex>baseline.startIndex);
    assert.equal(fixtureBaseline.assessment.mission.timeline[loaded.baselinePlayheadIndex-baseline.startIndex]?.sun,true);
  }finally{
    delete raw.__SOLARREACH_PLANNING_DEMO__;
  }
});

test('fixture sunlight helpers match catalog-backed fractions for the three cases',()=>{
  for(const role of DELAYED_LANDING_ROLES){
    const item=demo.cases.find(c=>c.role===role)!;
    const terrain=sunlitFraction(item.assessment.mission.timeline);
    const sphere=sunlitFraction(item.assessment.sphereMission.timeline);
    assert.ok(terrain!==null&&sphere!==null);
    const dark=longestDarkHours(item.assessment.mission.timeline,catalog.meta.stepHours);
    if(role==='baseline'){
      assert.equal(+(terrain*100).toFixed(1),97.6);
      assert.equal(+(sphere*100).toFixed(1),0);
    }
    if(role==='delayed'){
      assert.equal(+(terrain*100).toFixed(1),16.1);
      assert.equal(dark,211);
    }
    if(role==='alternative')assert.equal(+(terrain*100).toFixed(1),95.5);
  }
});

test('catalog demo baseline playhead advances into sunlight instead of the shadowed arrival hour',()=>{
  const baseline=demo.cases.find(c=>c.role==='baseline')!;
  const state=parseScenario(baseline.state,{siteIds:catalog.sites.map(s=>s.id),samples:catalog.meta.n,stepHours:catalog.meta.stepHours})!;
  assert.equal(baseline.assessment.mission.timeline[0]?.sun,false);
  const playhead=firstSunlitPlayheadForScenario(catalog,state);
  assert.equal(playhead,state.startIndex+8);
  assert.equal(baseline.assessment.mission.timeline[playhead-state.startIndex]?.sun,true);
});

test('borrowed nearest-cell horizons warn at the top; exact and global do not',()=>{
  const borrowed:TerrainChoice={mask:new Float64Array([1,2,3]),stepDeg:3,heightM:2,distanceKm:1.25,cellLat:-89.5,cellLon:210,exact:false};
  const exact:TerrainChoice={...borrowed,exact:true,distanceKm:0};
  const unavailable:TerrainChoice={mask:new Float64Array(3).fill(Number.NaN),stepDeg:3,heightM:2,distanceKm:null,cellLat:null,cellLon:null,exact:false};
  const global={...borrowed,kind:'global-coarse' as const,exact:false,distanceKm:0};
  assert.equal(isBorrowedHorizon(borrowed),true);
  assert.equal(isBorrowedHorizon(exact),false);
  assert.equal(isBorrowedHorizon(unavailable),false);
  assert.equal(isBorrowedHorizon(global),false);
  assert.match(borrowedHorizonTopWarning(borrowed)??'',/Borrowed horizon warning/);
  assert.equal(borrowedHorizonTopWarning(exact),null);
  assert.equal(borrowedHorizonTopWarning(global as TerrainChoice),null);
});
