import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateMission, DEFAULT_MISSION, linkBudget } from "../lib/mission";
import type { SampleSeries } from "../lib/astro";
import {validateMission, validateOperations} from '../lib/mission';
import { DEFAULT_OPERATIONS } from "../lib/planning-types";
import type { Operations } from "../lib/planning-types";
test('every required mission assumption must be present and finite',()=>{
  for(const key of Object.keys(DEFAULT_MISSION)){
    const invalid={...DEFAULT_MISSION} as Record<string,unknown>;
    delete invalid[key];
    assert.throws(()=>validateMission(invalid as typeof DEFAULT_MISSION),key);
  }
  assert.throws(()=>validateMission(null as unknown as typeof DEFAULT_MISSION));
  for(const key of ['areaM2','loadW','batteryWh','solarFlux','azimuthDeg'])
    assert.throws(()=>validateMission({...DEFAULT_MISSION,[key]:1e308}),key);
});
function series(n = 4, elevation = 30): SampleSeries {
  const a = (v: number) => new Float64Array(n).fill(v);
  return {
    index0: 0,
    sunAz: a(0),
    sunEl: a(elevation),
    earthAz: a(0),
    earthEl: a(10),
    sunHorizon: a(0),
    earthHorizon: a(0),
    sunRadius: a(0.27),
    earthRadius: a(1),
  };
}
test("four dark hours expose exact reserve and unserved-load onset", () => {
  const r = evaluateMission(series(4, -20), 1, {
    ...DEFAULT_MISSION,
    loadW: 100,
    batteryWh: 300,
    initialSoc: 1,
    reserveSoc: 0.2,
    dischargeEfficiency: 1,
  });
  assert.deepEqual([r.timeline[0].startBatteryWh, ...r.timeline.map(t => t.batteryWh)], [300, 200, 100, 0, 0]);
  assert.equal(r.timeline.length, 4);
  assert.equal(r.unmetWh, 100);
  assert.ok(Math.abs(r.reserveHours! - 1.6) < 1e-12);
  assert.equal(r.events?.find(e => e.kind === "reserve-crossing")?.modelOffsetHours, 2.4);
  assert.equal(r.events?.find(e => e.kind === "unserved-load")?.modelOffsetHours, 3);
});
test("charge power is limited on the bus before storage efficiency", () => {
  const r = evaluateMission(series(2), 1, {
    ...DEFAULT_MISSION, areaM2: 1, solarFlux: 200, efficiency: 1, lossFraction: 0,
    loadW: 0, batteryWh: 100, initialSoc: 0, chargeEfficiency: 1,
  }, false, { operations: { ...DEFAULT_OPERATIONS, maxChargeW: 50 } });
  assert.deepEqual(r.timeline.map(t => t.batteryWh), [50, 100]);
  assert.equal(r.finalBatteryWh, 100);
  assert.equal(r.curtailedWh, 300);
});
test("deployment and overlapping loads split forcing without adding timeline rows", () => {
  const r = evaluateMission(series(1), 4, {
    ...DEFAULT_MISSION, areaM2: 1, solarFlux: 200, efficiency: 1, lossFraction: 0,
    loadW: 10, batteryWh: 1000, initialSoc: 0.5, chargeEfficiency: 1, dischargeEfficiency: 1,
  }, false, { operations: { ...DEFAULT_OPERATIONS, deploymentDelayHours: 1.5, loadSegments: [
    {id: "a", startOffsetHours: 1, endOffsetHours: 3, additionalW: 20},
    {id: "b", startOffsetHours: 2, endOffsetHours: 4, additionalW: 30},
  ] } });
  assert.equal(r.timeline.length, 1);
  assert.equal(r.generatedWh, 500);
  assert.equal(r.finalBatteryWh, 860);
  assert.equal(r.timeline[0].loadW, 35);
  assert.deepEqual(r.subsegments.map(t => [t.startOffsetHours, t.endOffsetHours, t.powerW, t.loadW]), [
    [0, 1, 0, 10], [1, 1.5, 0, 30], [1.5, 2, 200, 30], [2, 3, 200, 60], [3, 4, 200, 40],
  ]);
});
test("antenna contact series is independent of array generation and deployment", () => {
  const array = series(2), antenna = series(2, -20);
  antenna.earthHorizon.fill(20);
  const assumptions = {...DEFAULT_MISSION, loadW: 0};
  const baseline = evaluateMission(array, 1, assumptions);
  const r = evaluateMission(array, 1, assumptions, false, {contactSeries: antenna});
  assert.equal(r.generatedWh, baseline.generatedWh);
  assert.equal(r.finalBatteryWh, baseline.finalBatteryWh);
  assert.equal(r.contactFraction, 0);
  assert.equal(r.longestBlackoutHours, 2);
  assert.equal(r.overlapHours, 0);
  const delayed = evaluateMission(array, 1, assumptions, false, {contactSeries: antenna,
    operations: {...DEFAULT_OPERATIONS, deploymentDelayHours: 2}});
  assert.equal(delayed.generatedWh, 0);
  assert.equal(delayed.contactFraction, 0);
  const sphere = evaluateMission(array, 1, assumptions, true, {contactSeries: antenna});
  assert.equal(sphere.contactFraction, 1);
});
test("tracking array produces incident flux times area and efficiency", () => {
  const r = evaluateMission(series(), 1, {
    ...DEFAULT_MISSION,
    areaM2: 2,
    efficiency: 0.3,
    lossFraction: 0,
    solarFlux: 1000,
    loadW: 0,
  });
  assert.equal(r.generatedWh, 2400);
  assert.equal(r.contactFraction, 1);
  assert.equal(r.overlapHours, 4);
});
test("horizontal array follows sine of solar elevation", () => {
  const r = evaluateMission(series(), 1, {
    ...DEFAULT_MISSION,
    arrayMode: "fixed",
    tiltDeg: 0,
    areaM2: 2,
    efficiency: 0.3,
    lossFraction: 0,
    solarFlux: 1000,
    loadW: 0,
  });
  assert.notEqual(r.generatedWh, null);
  assert.ok(Math.abs(r.generatedWh! - 1200) < 1e-8);
});
test("battery never goes negative and exposes unmet demand", () => {
  const r = evaluateMission(series(4, -20), 1, {
    ...DEFAULT_MISSION,
    loadW: 100,
    batteryWh: 100,
    initialSoc: 0.5,
    reserveSoc: 0.2,
    dischargeEfficiency: 1,
  });
  assert.equal(r.generatedWh, 0);
  assert.equal(r.minBatteryWh, 0);
  assert.equal(r.unmetWh, 350);
  assert.equal(r.longestBlackoutHours, 0);
});
test("battery charging respects capacity and efficiency", () => {
  const r = evaluateMission(series(), 1, {
    ...DEFAULT_MISSION,
    loadW: 0,
    batteryWh: 100,
    initialSoc: 0,
    chargeEfficiency: 0.5,
  });
  assert.equal(r.finalBatteryWh, 100);
  assert.ok(r.curtailedWh !== null);
  assert.ok(r.curtailedWh > 0);
});
test("unknown terrain remains unknown instead of being classified as shadow", () => {
  const s = series();
  s.sunHorizon[1] = NaN;
  const r = evaluateMission(s, 1, DEFAULT_MISSION);
  assert.equal(r.knownFraction, 0.75);
  assert.equal(r.generatedWh, null);
  assert.equal(r.minBatteryWh, null);
});
test("unknown solar data poisons later storage but preserves earlier known failures", () => {
  const s = series(4, -20);
  s.sunHorizon[2] = NaN;
  const r = evaluateMission(s, 1, {...DEFAULT_MISSION, batteryWh: 100, loadW: 100, dischargeEfficiency: 1});
  assert.deepEqual(r.timeline.map(t => t.batteryWh), [0, 0, null, null]);
  assert.deepEqual(r.timeline.map(t => t.startBatteryWh), [100, 0, 0, null]);
  assert.equal(r.finalBatteryWh, null);
  assert.equal(r.unmetWh, null);
  assert.equal(r.reserveHours, null);
  assert.equal(r.curtailedWh, null);
  assert.equal(r.partialCurtailedWh, 0);
  assert.equal(r.events?.find(e => e.kind === "reserve-crossing")?.modelOffsetHours, 0.8);
  assert.equal(r.events?.find(e => e.kind === "unserved-load")?.modelOffsetHours, 1);
  assert.deepEqual(r.events?.find(e => e.kind === "unknown-data"), {
    kind: "unknown-data", intervalIndex: 2, earliestOffsetHours: 2, latestOffsetHours: 3, modelOffsetHours: null,
  });
  assert.equal(r.subsegments[2].startBatteryWh, 0);
  assert.equal(r.subsegments[3].curtailedWh, null);
});
test("antenna mask blocks geometrically visible Earth and reports a blackout", () => {
  const r = evaluateMission(series(), 1, {
    ...DEFAULT_MISSION,
    antennaMaskDeg: 15,
  });
  assert.equal(r.contactFraction, 0);
  assert.equal(r.longestBlackoutHours, 4);
});
test("invalid numeric assumptions are rejected", () => {
  assert.throws(
    () => evaluateMission(series(), 1, { ...DEFAULT_MISSION, efficiency: NaN }),
    /efficiency/i,
  );
  assert.throws(
    () => evaluateMission(series(), 1, { ...DEFAULT_MISSION, batteryWh: -1 }),
    /battery/i,
  );
});
test("required forcing and aligned contact sources are validated before evaluation", () => {
  for (const key of ["sunAz", "sunHorizon", "sunRadius"] as const) {
    const s = series();
    s[key] = new Float64Array(3);
    assert.throws(() => evaluateMission(s, 1, DEFAULT_MISSION), /series|source|length/i);
  }
  assert.throws(() => evaluateMission(series(), 1, DEFAULT_MISSION, false, {contactSeries: series(3)}), /contact|align/i);
  const shifted = series();
  shifted.index0 = 1;
  assert.throws(() => evaluateMission(series(), 1, DEFAULT_MISSION, false, {contactSeries: shifted}), /contact|align/i);
  assert.throws(() => evaluateMission(series(), 1e308, DEFAULT_MISSION), /finite|range/i);
});
test("invalid operations are rejected rather than producing NaN", () => {
  for (const key of Object.keys(DEFAULT_OPERATIONS)) {
    const invalid = {...DEFAULT_OPERATIONS} as Record<string, unknown>;
    delete invalid[key];
    assert.throws(() => validateOperations(invalid as Operations), key);
  }
  for (const invalid of [
    {...DEFAULT_OPERATIONS, deploymentDelayHours: NaN},
    {...DEFAULT_OPERATIONS, maxChargeW: -1},
    {...DEFAULT_OPERATIONS, maxDischargeW: Infinity},
    {...DEFAULT_OPERATIONS, loadSegments: [{id: "x", startOffsetHours: 2, endOffsetHours: 1, additionalW: 5}]},
    {...DEFAULT_OPERATIONS, loadSegments: [{id: "x", startOffsetHours: 0, endOffsetHours: 1, additionalW: -5}]},
    {...DEFAULT_OPERATIONS, loadSegments: [{id: "x", startOffsetHours: 0, endOffsetHours: Infinity, additionalW: 5}]},
    null,
  ]) assert.throws(() => evaluateMission(series(), 1, DEFAULT_MISSION, false, {operations: invalid as Operations}));
  const unknown = series(1);
  unknown.sunEl[0] = NaN;
  assert.throws(() => evaluateMission(unknown, 2, {...DEFAULT_MISSION, loadW: 0}, false, {
    operations: {...DEFAULT_OPERATIONS, deploymentDelayHours: 1,
      loadSegments: [{id: "overflow", startOffsetHours: 0, endOffsetHours: 2, additionalW: 1e308}]},
  }), /finite|range/i);
});
test("partial curtailment reports only the known prefix before a solar gap", () => {
  const s = series(3);
  s.sunHorizon[1] = NaN;
  const r = evaluateMission(s, 1, {...DEFAULT_MISSION, areaM2: 1, solarFlux: 200, efficiency: 1,
    lossFraction: 0, loadW: 0, batteryWh: 100, initialSoc: 1});
  assert.equal(r.curtailedWh, null);
  assert.equal(r.partialCurtailedWh, 200);
  assert.equal(r.subsegments[0].curtailedWh, 200);
  assert.equal(r.subsegments[2].curtailedWh, null);
});
test("discharge cap limits bus delivery before applying discharge efficiency", () => {
  const r = evaluateMission(series(2, -20), 1, {
    ...DEFAULT_MISSION, batteryWh: 300, loadW: 100, dischargeEfficiency: 0.5,
  }, false, {operations: {...DEFAULT_OPERATIONS, maxDischargeW: 40}});
  assert.deepEqual(r.timeline.map(t => t.batteryWh), [220, 140]);
  assert.equal(r.unmetWh, 120);
  assert.equal(r.events?.find(e => e.kind === "unserved-load")?.modelOffsetHours, 0);
  assert.deepEqual(r.subsegments.map(t => t.deliveredWh), [40, 40]);
});
test("nonunit charge efficiency applies after the charge power cap", () => {
  const r = evaluateMission(series(2), 1, {
    ...DEFAULT_MISSION, areaM2: 1, solarFlux: 200, efficiency: 1, lossFraction: 0,
    loadW: 0, batteryWh: 100, initialSoc: 0, chargeEfficiency: 0.5,
  }, false, {operations: {...DEFAULT_OPERATIONS, maxChargeW: 50}});
  assert.deepEqual(r.timeline.map(t => t.batteryWh), [25, 50]);
  assert.equal(r.curtailedWh, 300);
  assert.deepEqual(r.subsegments.map(t => t.chargeInputWh), [50, 50]);
});
test("charging an uncapped battery never reports negative curtailment from rounding", () => {
  const r = evaluateMission(series(1), 1, {
    ...DEFAULT_MISSION, areaM2: 1, solarFlux: 0.05, efficiency: 1, lossFraction: 0,
    loadW: 0, batteryWh: 100, initialSoc: 0, chargeEfficiency: 0.1,
  });
  assert.equal(r.curtailedWh, 0);
  assert.equal(r.subsegments[0].chargeInputWh, 0.05);
});
test("zero capacity and zero bus limits remain finite with equality passing reserve", () => {
  const dark = evaluateMission(series(1, -20), 1, {...DEFAULT_MISSION, loadW: 100, batteryWh: 0});
  assert.equal(dark.finalBatteryWh, 0);
  assert.equal(dark.unmetWh, 100);
  assert.equal(dark.reserveHours, 0);
  assert.equal(dark.events?.find(e => e.kind === "unserved-load")?.modelOffsetHours, 0);
  assert.equal(dark.events?.find(e => e.kind === "reserve-crossing"), undefined);
  const bright = evaluateMission(series(1), 1, {
    ...DEFAULT_MISSION, areaM2: 1, solarFlux: 200, efficiency: 1, lossFraction: 0, loadW: 0, batteryWh: 0,
  });
  assert.equal(bright.curtailedWh, 200);
  const capped = evaluateMission(series(1, -20), 1, {...DEFAULT_MISSION, batteryWh: 100, loadW: 100}, false,
    {operations: {...DEFAULT_OPERATIONS, maxChargeW: 0, maxDischargeW: 0}});
  assert.equal(capped.finalBatteryWh, 100);
  assert.equal(capped.unmetWh, 100);
  const noCharge = evaluateMission(series(1), 1, {...DEFAULT_MISSION, loadW: 0, batteryWh: 100, initialSoc: 0}, false,
    {operations: {...DEFAULT_OPERATIONS, maxChargeW: 0}});
  assert.equal(noCharge.finalBatteryWh, 0);
  assert.equal(noCharge.curtailedWh, noCharge.generatedWh);
});
test("reserve equality passes and initially below reserve has model offset zero", () => {
  const equal = evaluateMission(series(1, -20), 1, {
    ...DEFAULT_MISSION, batteryWh: 100, loadW: 80, initialSoc: 1, reserveSoc: 0.2, dischargeEfficiency: 1,
  });
  assert.equal(equal.minBatteryWh, 20);
  assert.equal(equal.reserveHours, 0);
  assert.equal(equal.events?.find(e => e.kind === "reserve-crossing"), undefined);
  const rising = evaluateMission(series(1), 1, {
    ...DEFAULT_MISSION, areaM2: 1, solarFlux: 100, efficiency: 1, lossFraction: 0,
    loadW: 0, batteryWh: 100, initialSoc: 0, reserveSoc: 0.2, chargeEfficiency: 0.5,
  });
  assert.equal(rising.reserveHours, 0.4);
  assert.equal(rising.events?.find(e => e.kind === "reserve-crossing")?.modelOffsetHours, 0);
});
test("split intervals retain exact model offsets for reserve and first unserved load", () => {
  const r = evaluateMission(series(1, -20), 4, {
    ...DEFAULT_MISSION, batteryWh: 300, loadW: 0, initialSoc: 1, reserveSoc: 0.2, dischargeEfficiency: 1,
  }, false, {operations: {...DEFAULT_OPERATIONS, loadSegments: [
    {id: "run", startOffsetHours: 0.5, endOffsetHours: 4, additionalW: 100},
  ]}});
  assert.equal(r.timeline.length, 1);
  assert.equal(r.events?.find(e => e.kind === "reserve-crossing")?.modelOffsetHours, 2.9);
  assert.equal(r.events?.find(e => e.kind === "unserved-load")?.modelOffsetHours, 3.5);
  assert.ok(Math.abs(r.reserveHours! - 1.1) < 1e-12);
  assert.equal(r.unmetWh, 50);
});
test("mission ending exactly at battery exhaustion has no unserved load", () => {
  const r = evaluateMission(series(1, -20), 3, {
    ...DEFAULT_MISSION, batteryWh: 300, loadW: 100, dischargeEfficiency: 1,
  });
  assert.equal(r.finalBatteryWh, 0);
  assert.equal(r.unmetWh, 0);
  assert.equal(r.events?.find(e => e.kind === "unserved-load"), undefined);
});
test("known contact gaps do not poison energy and solar gaps never recover storage", () => {
  const s = series(3), antenna = series(3);
  antenna.earthHorizon[1] = NaN;
  const r = evaluateMission(s, 1, DEFAULT_MISSION, false, {contactSeries: antenna});
  assert.equal(r.knownFraction, 1);
  assert.notEqual(r.finalBatteryWh, null);
  assert.equal(r.contactFraction, null);
  assert.equal(r.longestBlackoutHours, null);
  assert.equal(r.overlapHours, null);
  s.sunEl[0] = NaN;
  const gap = evaluateMission(s, 1, DEFAULT_MISSION);
  assert.deepEqual(gap.timeline.map(t => t.batteryWh), [null, null, null]);
  assert.notEqual(gap.timeline[1].powerW, null);
  assert.equal(gap.timeline[1].unmetWh, null);
  assert.equal(gap.contactFraction, 1);
});
test("subsegments conserve bus and storage energy across load and deployment changes", () => {
  const s = series(3);
  s.sunEl[1] = -20;
  const assumptions = {...DEFAULT_MISSION, areaM2: 1, solarFlux: 200, efficiency: 1, lossFraction: 0,
    loadW: 30, batteryWh: 100, initialSoc: 0.5, chargeEfficiency: 0.8, dischargeEfficiency: 0.5};
  const r = evaluateMission(s, 1, assumptions, false, {operations: {...DEFAULT_OPERATIONS,
    deploymentDelayHours: 0.25, maxChargeW: 60, maxDischargeW: 50,
    loadSegments: [{id: "extra", startOffsetHours: 0.5, endOffsetHours: 2.5, additionalW: 40}]}});
  for (const segment of r.subsegments) {
    const busResidual = segment.generatedWh! + segment.deliveredWh! + segment.unmetWh! -
      segment.loadWh - segment.chargeInputWh! - segment.curtailedWh!;
    const storageResidual = segment.startBatteryWh! + segment.chargeInputWh! * 0.8 -
      segment.deliveredWh! / 0.5 - segment.batteryWh!;
    assert.ok(Math.abs(busResidual) < 1e-10);
    assert.ok(Math.abs(storageResidual) < 1e-10);
    assert.ok(segment.batteryWh! >= 0 && segment.batteryWh! <= 100);
  }
  assert.equal(r.timeline.length, 3);
  assert.ok(Math.abs(r.generatedWh! - 350) < 1e-10);
  assert.ok(Math.abs(r.finalBatteryWh! - 48) < 1e-10);
  assert.ok(Math.abs(r.unmetWh! - 34.5) < 1e-10);
  assert.ok(Math.abs(r.curtailedWh! - 152.5) < 1e-10);
});
test("free-space link budget requires all inputs and uses distance in metres", () => {
  assert.equal(linkBudget({}), null);
  const r = linkBudget({
    frequencyGHz: 2.2,
    rangeKm: 384400,
    txPowerW: 20,
    txGainDbi: 20,
    rxGainDbi: 60,
    lossDb: 3,
    noiseTempK: 100,
    dataRateBps: 1000,
    requiredEbN0Db: 5,
  });
  assert.ok(r);
  assert.ok(Math.abs(r.pathLossDb - 210.99) < 0.1);
  assert.ok(Number.isFinite(r.marginDb));
});
