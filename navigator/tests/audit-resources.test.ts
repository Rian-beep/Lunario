import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditResources, forcing, sourceIntegrity } from '../scripts/audit-resources-compare';
import { DEFAULT_MISSION, evaluateMission, linkBudget } from '../lib/mission';
import { slantAttenuationDb, atmosphericNoiseK } from '../lib/engineering-evidence/atmosphere';
import { commsInferenceSummary } from '../lib/providers/comms';

for (const c of auditResources()) test(`audit resources: ${c.id}`, () => {
  assert.ok(c.error !== null && Number.isFinite(c.error) && c.error <= c.tolerance,
    `${c.id}: |${c.actual} - ${c.expected}| = ${c.error} > ${c.tolerance} ${c.unit}`);
});
test('audit resources: archived primary responses reproduce byte identities', () => {
  for (const source of sourceIntegrity()) assert.ok(source.bytesMatch && source.hashMatch, source.file);
});
test('audit resources: two seconds at 360 W is 0.2 Wh, not 720 Wh', () => {
  const result = evaluateMission(forcing(1, 30), 2 / 3600, { ...DEFAULT_MISSION, areaM2: 1, solarFlux: 360,
    efficiency: 1, lossFraction: 0, loadW: 0 });
  assert.equal(result.generatedWh, .2);
});
test('audit resources: half visible disk is half irradiance during the whole hour', () => {
  const s = forcing(1, 0);
  const result = evaluateMission(s, 1, { ...DEFAULT_MISSION, areaM2: 1, solarFlux: 400, efficiency: 1,
    lossFraction: 0, loadW: 0 });
  assert.equal(result.generatedWh, 200);
  assert.equal(result.overlapHours, 1);
  assert.equal(result.timeline[0].sun, true);
});
test('audit resources: one charge/discharge cycle loses 20 Wh charging and 40 Wh discharging', () => {
  const s = forcing(2, 30); s.sunEl[1] = -30;
  const r = evaluateMission(s, 1, { ...DEFAULT_MISSION, areaM2: 1, solarFlux: 200,
    efficiency: 1, lossFraction: 0, loadW: 100, batteryWh: 1000, initialSoc: 0,
    chargeEfficiency: .8, dischargeEfficiency: .5 });
  assert.deepEqual(r.timeline.map(t => t.batteryWh), [80, 0]);
  assert.equal(r.generatedWh, 200); assert.equal(r.unmetWh, 60);
  assert.equal(r.subsegments[0].chargeInputWh, 100);
  assert.equal(r.subsegments[1].deliveredWh, 40);
});
test('audit resources: unknown solar gap censors storage while an independent contact gap censors contacts', () => {
  const s = forcing(3, 30); s.sunEl[1] = NaN; s.earthEl[2] = NaN;
  const r = evaluateMission(s, 1, DEFAULT_MISSION);
  assert.equal(r.generatedWh, null); assert.equal(r.finalBatteryWh, null);
  assert.equal(r.timeline[2].batteryWh, null); assert.equal(r.contactFraction, null);
  assert.equal(r.longestBlackoutHours, null); assert.equal(r.overlapHours, null);
});
test('audit resources: RF power ratios use 10 log, distance/frequency doubling costs 6.0206 dB', () => {
  const a = { frequencyGHz: 8.4, rangeKm: 384400, txPowerW: 20, txGainDbi: 10, rxGainDbi: 60,
    lossDb: 3, noiseTempK: 100, dataRateBps: 1000, requiredEbN0Db: 5 };
  const base = linkBudget(a)!;
  for (const change of [{rangeKm: a.rangeKm*2}, {frequencyGHz: a.frequencyGHz*2}])
    assert.ok(Math.abs(linkBudget({...a,...change})!.marginDb-base.marginDb+20*Math.log10(2))<1e-10);
  for (const change of [{noiseTempK: 200}, {dataRateBps: 2000}])
    assert.ok(Math.abs(linkBudget({...a,...change})!.marginDb-base.marginDb+10*Math.log10(2))<1e-10);
  assert.ok(Math.abs(linkBudget({...a,txPowerW:40})!.marginDb-base.marginDb-10*Math.log10(2))<1e-10);
  for (const change of [{rangeKm:0},{frequencyGHz:-1},{noiseTempK:0},{txPowerW:NaN}]) assert.equal(linkBudget({...a,...change}),null);
});
test('audit resources: atmospheric limits and context cannot infer a booked band-specific contact', () => {
  assert.equal(slantAttenuationDb(.4,90),.4); assert.equal(atmosphericNoiseK(0,280),0);
  assert.ok(atmosphericNoiseK(200,280)<=280);
  for (const el of [0,9.99,90.01,NaN]) assert.throws(()=>slantAttenuationDb(.4,el));
  const rows=commsInferenceSummary();
  assert.equal(rows.find(r=>r.id==='weather-context')?.state,'context-only');
  assert.equal(rows.find(r=>r.id==='allocation')?.state,'not-assessed');
});
