/** Read-only checks against independently reconstructed primary-source values.
 * Run after reproduce.py. Only writes production-check.json in this directory.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { decodeCatalog } from '../../../lib/catalog.ts';
import { withLandingSites } from '../../../lib/landing-catalog.ts';
import { LANDING_SITES } from '../../../lib/landing-sites.ts';
import { buildSeries, earthAzEl, sunAzEl } from '../../../lib/astro.ts';
import { DEFAULT_FLIGHT, simulateFlight } from '../../../lib/flight.ts';
import { DEFAULT_LANDING_CONFIGURATION } from '../../../lib/landing-contract.ts';
import { DEFAULT_MISSION, evaluateMission, linkBudget } from '../../../lib/mission.ts';
import { evaluateScenario, PLANNING_MODEL_VERSION, evidenceScopeKey } from '../../../lib/assessment.ts';
import { auditResources, sourceIntegrity, forcing } from '../../../scripts/audit-resources-compare.ts';
import { epochs, sites, loadResponse } from '../../../scripts/audit-ephemeris-support.ts';
import type { ScenarioState } from '../../../lib/scenario.ts';
import type { EvidenceManifest } from '../../../lib/planning-types.ts';

const dir = 'docs/qa/final-science-review/';
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const ref = read(dir+'reference.json');
const catalog = withLandingSites(decodeCatalog(read('public/data/catalog.json')),LANDING_SITES);
const manifest = read('public/data/evidence-manifest.json') as EvidenceManifest;
const flat = { mask: new Float64Array(360), stepDeg: 1, heightM: 0, distanceKm: 0, cellLat: null, cellLon: null, exact: true };
const differences: number[] = [];
for (const s of ref.samples) {
  const site = sites.find(x=>x.id===s.site)!;
  const series = buildSeries(catalog,site.lat,site.lon,flat,s.index,s.index);
  const local = s.body==='399'
    ? earthAzEl(site.lat,site.lon,catalog.subearthLat[s.index],catalog.subearthLon[s.index],catalog.earthRangeKm[s.index])
    : sunAzEl(site.lat,site.lon,catalog.subsolarLat[s.index],catalog.subsolarLon[s.index]);
  const errors = [Math.abs(((local[0]-s.azimuthDeg+540)%360)-180),Math.abs(local[1]-s.elevationDeg),Math.abs((s.body==='399'?series.earthRadius[0]:series.sunRadius[0])-s.radiusDeg)];
  for (const e of errors) { assert.ok(e<1e-10); differences.push(e); }
}

const inputErrors=[];
for(const [id,target,center,quantities] of [['moon-from-earth','301','500@399','14,15,20'],['earth-from-moon','399','500@301','13,20'],['sun-from-moon','10','500@301','13,20']] as const) {
  const t=await loadResponse({id,target,center,quantities});
  for(let j=0;j<epochs.length;j++) {
    const i=(Date.parse(epochs[j])-catalog.t0ms)/3600000, row=t.rows[j];
    if(target==='399') inputErrors.push({kind:'centre-range-m',error:Math.abs(catalog.earthRangeKm[i]-row[2])*1000});
    if(target==='10') inputErrors.push({kind:'solar-full-diameter-arcsec',error:Math.abs(catalog.sunRadiusDeg[i]*7200-row[1])});
  }
}

const events=[];
for(const target of ['10','399'] as const) for(const meaning of ['centre','upper-limb'] as const) {
  const site=target==='10'?{lat:0,lon:0}:{lat:89.99,lon:0};
  const s=buildSeries(catalog,site.lat,site.lon,flat,0,catalog.meta.n-1);
  const clearance=(i:number)=>(target==='10'?s.sunEl[i]:s.earthEl[i])+(meaning==='upper-limb'?(target==='10'?s.sunRadius[i]:s.earthRadius[i]):0);
  const start=(Date.parse('2027-06-01T00:00:00Z')-catalog.t0ms)/3600000;
  let i=start+1;while(i<start+90*24 && !(clearance(i-1)>0 && clearance(i)<=0)) i++;
  assert.ok(i<start+90*24);
  const begin=catalog.t0ms+(i-1)*3600000;
  const times=Array.from({length:25},(_,k)=>new Date(begin-1800000+k*300000).toISOString());
  const table=await loadResponse({id:`event-${target}-${meaning}`,target,center:'coord@301',quantities:'4,13,20',site,times});
  const actual=table.rows.map(r=>r[2]+(meaning==='upper-limb'?r[3]/7200:0));
  const k=actual.findIndex((v,j)=>j>0 && actual[j-1]>0 && v<=0);
  assert.ok(k>0 && Date.parse(times[k-1])>=begin && Date.parse(times[k])<=begin+3600000);
  events.push({target,meaning,modelUtc:[new Date(begin).toISOString(),new Date(begin+3600000).toISOString()],referenceUtc:[times[k-1],times[k]]});
}

const radial=[];
for(const configured of [false,true]) for(const terrain of [undefined,()=>0]) {
  const input={...DEFAULT_FLIGHT,altitudeM:100,horizontalMps:0,verticalMps:0,thrustN:0,burnSeconds:0,durationSeconds:30,landing:configured?{...DEFAULT_LANDING_CONFIGURATION,guidance:'manual' as const}:undefined};
  const r=simulateFlight(input,terrain),p=r.points.at(-1)!;
  const error={timeS:p.t-ref.radial.timeS,speedMps:p.speedMps-ref.radial.speedMps,energyJ:.5*4700*(p.speedMps**2-ref.radial.speedMps**2)};
  assert.ok(Math.abs(error.timeS)<1e-6 && Math.abs(error.speedMps)<1e-7 && Math.abs(error.energyJ)<.01);
  radial.push({configured,terrain:terrain?'flat':'reference-sphere',error});
}

// Independently closed two-interval energy ledger: +100 Wh bus surplus ->
// 80 Wh stored; 100 Wh demand -> 40 Wh supplied plus 60 Wh unmet.
const solar=forcing(2,30);solar.sunEl[1]=-30;
const cycle=evaluateMission(solar,1,{...DEFAULT_MISSION,solarFlux:200,areaM2:1,efficiency:1,lossFraction:0,loadW:100,batteryWh:200,initialSoc:0,reserveSoc:0,chargeEfficiency:.8,dischargeEfficiency:.5});
assert.equal(cycle.generatedWh,200);assert.equal(cycle.finalBatteryWh,0);assert.equal(cycle.unmetWh,60);
assert.ok(Math.abs(cycle.events!.find(x=>x.kind==='unserved-load')!.modelOffsetHours!-1.4)<1e-12);
const seconds=evaluateMission(forcing(1,30),2/3600,{...DEFAULT_MISSION,solarFlux:360,areaM2:1,efficiency:1,lossFraction:0,loadW:0,batteryWh:1,initialSoc:0,chargeEfficiency:1,dischargeEfficiency:1});
assert.equal(seconds.generatedWh,.2);assert.equal(seconds.finalBatteryWh,.2);
const budgets=[];
for(const frequencyGHz of [2.3,8.4,32]) {
  const input={frequencyGHz,rangeKm:384400,txPowerW:20,txGainDbi:5,rxGainDbi:60,lossDb:3,noiseTempK:100,dataRateBps:10000,requiredEbN0Db:5};
  const lambda=299792458/(frequencyGHz*1e9);
  const flux=20*10**.5/(4*Math.PI*(384400000)**2);
  const aperture=1e6*lambda**2/(4*Math.PI);
  const power=flux*aperture/10**.3;
  const expectedMarginDb=10*Math.log10(power/(10000*1.380649e-23*100))-5;
  const actual=linkBudget(input)!;
  assert.ok(Math.abs(actual.marginDb-expectedMarginDb)<1e-10);
  budgets.push({frequencyGHz,errorDb:actual.marginDb-expectedMarginDb});
}
const resources=auditResources();assert.equal(resources.length,288);
assert.ok(resources.every(x=>x.error!==null && Number.isFinite(x.error) && x.error<=x.tolerance));
assert.ok(sourceIntegrity().every(x=>x.bytesMatch&&x.hashMatch));

assert.equal(PLANNING_MODEL_VERSION,'planning-5');
const register=read('docs/qa/scientific-audit/VERIFICATION.json');
assert.deepEqual(register,read('lib/generated/scientific-verification.json'));
assert.equal(register.modelVersion,PLANNING_MODEL_VERSION);assert.equal(register.datasetId,manifest.datasetId);
for(const [path,hash] of Object.entries(register.assetHashes))assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),hash);
const demo=read('public/data/planning-demo.json');
assert.equal(demo.modelVersion,'planning-5');assert.equal(demo.datasetId,manifest.datasetId);
const identities=[];
for(const c of demo.cases) {
  const result=evaluateScenario(catalog,c.state,manifest);
  assert.equal(result.scenarioKey,c.assessment.scenarioKey);assert.equal(result.evidenceScopeKey,c.assessment.evidenceScopeKey);
  assert.equal(result.outcome,c.assessment.outcome);
  const state={...c.state,externalAssessments:[]} as ScenarioState;
  const current=evidenceScopeKey(state,manifest.datasetId);
  assert.notEqual(evidenceScopeKey(state,manifest.datasetId+'-changed'),current);
  const oldKey=current.replace(/^planning-5-/,'planning-4-');
  state.externalAssessments=[{id:'thermal-survival',status:'reported-pass',source:'review synthetic binding',author:'review',notes:'not physical evidence',scenarioKey:oldKey}];
  const stale=evaluateScenario(catalog,state,manifest).constraints.find(x=>x.id==='thermal-survival')!;
  assert.equal(stale.reasonCode,'external-report-stale');
  identities.push({role:c.role,scenarioKey:current,outcome:result.outcome,oldModelReport:stale.state});
}
writeFileSync(dir+'production-check.json',JSON.stringify({maxIndependentAngleDifferenceDeg:Math.max(...differences),inputErrors,events,radial,energy:{generatedWh:cycle.generatedWh,unmetWh:cycle.unmetWh,onsetH:1.4,twoSecondWh:seconds.generatedWh},budgets,resourceComparisons:resources.length,identity:identities},null,2)+'\n');
console.log('PASS: independent production comparisons, four event brackets, contact roots, power/RF, 288 resource comparisons and planning-5 identity');
