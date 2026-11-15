import { diskFraction, earthCenterVisible, type SampleSeries } from "./astro";
import type { MissionModelEvent } from "./mission-events";
import type { Operations } from "./planning-types";

export type MissionAssumptions = {
  areaM2: number;
  efficiency: number;
  lossFraction: number;
  solarFlux: number;
  arrayMode: "tracking" | "fixed";
  tiltDeg: number;
  azimuthDeg: number;
  loadW: number;
  batteryWh: number;
  initialSoc: number;
  reserveSoc: number;
  chargeEfficiency: number;
  dischargeEfficiency: number;
  antennaMaskDeg: number;
};
export const DEFAULT_MISSION: MissionAssumptions = {
  areaM2: 4,
  efficiency: 0.3,
  lossFraction: 0.15,
  solarFlux: 1361,
  arrayMode: "tracking",
  tiltDeg: 90,
  azimuthDeg: 0,
  loadW: 250,
  batteryWh: 10000,
  initialSoc: 1,
  reserveSoc: 0.2,
  chargeEfficiency: 0.95,
  dischargeEfficiency: 0.95,
  antennaMaskDeg: 0,
};
export type MissionInterval = {
  startOffsetHours: number;
  endOffsetHours: number;
  startBatteryWh: number | null;
  loadW: number;
  unmetWh: number | null;
  powerW: number | null;
  batteryWh: number | null;
  contact: boolean | null;
  sun: boolean | null;
};
export type MissionSubsegment = MissionInterval & {
  intervalIndex: number;
  generatedWh: number | null;
  loadWh: number;
  curtailedWh: number | null;
  chargeInputWh: number | null;
  deliveredWh: number | null;
};
export type MissionResult = {
  generatedWh: number | null;
  minBatteryWh: number | null;
  finalBatteryWh: number | null;
  unmetWh: number | null;
  curtailedWh: number | null;
  partialCurtailedWh: number;
  reserveHours: number | null;
  contactFraction: number | null;
  longestBlackoutHours: number | null;
  overlapHours: number | null;
  knownFraction: number;
  peakPowerW: number | null;
  events?: MissionModelEvent[];
  timeline: MissionInterval[];
  subsegments: MissionSubsegment[];
};

export function validateMission(a: MissionAssumptions) {
  if (!a || typeof a !== "object") throw new Error("Mission assumptions must be an object");
  for (const key of Object.keys(DEFAULT_MISSION) as (keyof MissionAssumptions)[]) {
    if (key === "arrayMode") continue;
    const value = a[key];
    if (typeof value !== "number" || !Number.isFinite(value))
      throw new Error(`${key} must be a finite number`);
  }
  for (const key of ["areaM2", "loadW", "batteryWh", "solarFlux"] as const)
    if (a[key] < 0) throw new Error(`${key} cannot be negative`);
  if(a.areaM2>100000||a.loadW>1e6||a.batteryWh>1e9||a.solarFlux>2000||a.azimuthDeg<0||a.azimuthDeg>360)
    throw new Error("Mission assumption exceeds the supported input range");
  for (const key of [
    "efficiency",
    "lossFraction",
    "initialSoc",
    "reserveSoc",
  ] as const)
    if (a[key] < 0 || a[key] > 1)
      throw new Error(`${key} must be between 0 and 1`);
  for (const key of ["chargeEfficiency", "dischargeEfficiency"] as const)
    if (a[key] <= 0 || a[key] > 1)
      throw new Error(`${key} must be above 0 and at most 1`);
  if (
    a.tiltDeg < 0 ||
    a.tiltDeg > 180 ||
    a.antennaMaskDeg < 0 ||
    a.antennaMaskDeg > 90
  )
    throw new Error("Array tilt or antenna mask is outside its angular range");
  if (!["fixed", "tracking"].includes(a.arrayMode))
    throw new Error("Unknown array mode");
}

export function validateOperations(o: Operations) {
  if (!o || typeof o !== "object") throw new Error("Operations must be an object");
  if (!Number.isFinite(o.deploymentDelayHours) || o.deploymentDelayHours < 0)
    throw new Error("Deployment delay must be finite and nonnegative");
  for (const key of ["maxChargeW", "maxDischargeW"] as const)
    if (o[key] !== null && (typeof o[key] !== "number" || !Number.isFinite(o[key]) || o[key] < 0))
      throw new Error(`${key} must be null or finite and nonnegative`);
  if (!Array.isArray(o.loadSegments)) throw new Error("Load segments must be an array");
  const ids = new Set<string>();
  for (const segment of o.loadSegments) {
    if (!segment || typeof segment.id !== "string" || !segment.id.trim() || ids.has(segment.id))
      throw new Error("Load segment IDs must be nonempty and unique");
    ids.add(segment.id);
    if (![segment.startOffsetHours, segment.endOffsetHours, segment.additionalW].every(v => typeof v === "number" && Number.isFinite(v)) ||
      segment.startOffsetHours < 0 || segment.endOffsetHours <= segment.startOffsetHours || segment.additionalW < 0)
      throw new Error("Load segment bounds and additional power must be finite, nonnegative and ordered");
  }
}

/** Each catalog sample represents one stepHours interval, matching the original visibility scores. */
export function evaluateMission(
  s: SampleSeries,
  stepHours: number,
  a: MissionAssumptions,
  sphere = false,
  options: { contactSeries?: SampleSeries; operations?: Operations } = {},
): MissionResult {
  validateMission(a);
  const operations: Operations = options.operations === undefined
    ? {deploymentDelayHours: 0, maxChargeW: null, maxDischargeW: null, loadSegments: []}
    : options.operations;
  const antenna = options.contactSeries === undefined ? s : options.contactSeries;
  validateOperations(operations);
  if (!Number.isFinite(stepHours) || stepHours <= 0 || !s?.sunEl?.length)
    throw new Error(
      "A nonempty series and positive sample interval are required",
    );
  const n = s.sunEl.length;
  if (!Number.isInteger(s.index0) || s.index0 < 0 ||
    ![s.sunAz, s.sunHorizon, s.sunRadius].every(v => v?.length === n))
    throw new Error("Solar source series lengths and start index must align");
  if (!antenna || antenna.index0 !== s.index0 || antenna.sunEl?.length !== n ||
    ![antenna.earthEl, antenna.earthHorizon].every(v => v?.length === n))
    throw new Error("Contact source series must align with solar forcing");
  const durationHours = stepHours * n;
  if (!Number.isFinite(durationHours) ||
    !Number.isFinite(durationHours * a.solarFlux * a.areaM2 * a.efficiency * (1 - a.lossFraction)))
    throw new Error("Mission duration or generation exceeds the finite model range");
  const rad = Math.PI / 180;
  let battery = a.batteryWh * a.initialSoc,
    min = battery,
    energy = 0,
    unmet = 0,
    curtailed = 0,
    reserve = 0;
  let contact = 0,
    blackout = 0,
    longestBlackout = 0,
    overlap = 0,
    peak = 0,
    known = 0,
    contactKnown = 0;
  let batteryKnown = true;
  const timeline: MissionResult["timeline"] = [];
  const subsegments: MissionSubsegment[] = [];
  const events: MissionModelEvent[] = [];
  const event = (kind: MissionModelEvent["kind"], k: number, offset: number | null) => {
    if (!events.some(e => e.kind === kind)) events.push({
      kind,
      intervalIndex: k,
      earliestOffsetHours: k * stepHours,
      latestOffsetHours: (k + 1) * stepHours,
      modelOffsetHours: offset,
    });
  };
  const reserveWh = a.batteryWh * a.reserveSoc;
  const operationBounds = [operations.deploymentDelayHours,
    ...operations.loadSegments.flatMap(l => [l.startOffsetHours, l.endOffsetHours])];
  if (battery < reserveWh) event("reserve-crossing", 0, 0);
  for (let k = 0; k < s.sunEl.length; k++) {
    const startBattery = batteryKnown ? battery : null;
    const previousUnmet = unmet;
    const horizon = sphere ? 0 : s.sunHorizon[k];
    const eh = sphere ? 0 : antenna.earthHorizon[k];
    const solarKnown = [horizon, s.sunEl[k], s.sunAz[k], s.sunRadius[k]].every(
      Number.isFinite,
    );
    const up = earthCenterVisible(antenna.earthEl[k], eh, a.antennaMaskDeg);
    const earthKnown = up !== null;
    if (!solarKnown || !earthKnown) event("unknown-data", k, null);
    if (earthKnown) {
      contactKnown++;
      if (up) {
        contact++;
        blackout = 0;
      } else {
        blackout += stepHours;
        longestBlackout = Math.max(longestBlackout, blackout);
      }
    } else blackout = 0;
    let power: number | null = null,
      sun: boolean | null = null;
    if (solarKnown) {
      known++;
      const fraction = diskFraction(s.sunEl[k], horizon, s.sunRadius[k]);
      const incidence =
        a.arrayMode === "tracking"
          ? 1
          : Math.max(
              0,
              Math.sin(s.sunEl[k] * rad) * Math.cos(a.tiltDeg * rad) +
                Math.cos(s.sunEl[k] * rad) *
                  Math.sin(a.tiltDeg * rad) *
                  Math.cos((s.sunAz[k] - a.azimuthDeg) * rad),
            );
      power =
        a.solarFlux *
        a.areaM2 *
        a.efficiency *
        (1 - a.lossFraction) *
        incidence *
        fraction;
      sun = fraction > 0;
      if (sun && up) overlap += stepHours;
    } else batteryKnown = false;
    const startOffsetHours = k * stepHours;
    const endOffsetHours = (k + 1) * stepHours;
    const bounds = new Set([startOffsetHours, endOffsetHours]);
    for (const bound of operationBounds)
      if (bound > startOffsetHours && bound < endOffsetHours) bounds.add(bound);
    const sorted = [...bounds].sort((x, y) => x - y);
    let intervalEnergy = 0;
    let intervalLoad = 0;
    for (let j = 0; j < sorted.length - 1; j++) {
      const start = sorted[j];
      const end = sorted[j + 1];
      const hours = end - start;
      const segmentStartBattery = j === 0 ? startBattery : batteryKnown ? battery : null;
      const load = a.loadW + operations.loadSegments.reduce((sum, l) =>
        sum + (start >= l.startOffsetHours && start < l.endOffsetHours ? l.additionalW : 0), 0);
      if (!Number.isFinite(load) || !Number.isFinite(load * hours))
        throw new Error("Load energy exceeds the finite model range");
      const segmentPower = power === null ? null : start < operations.deploymentDelayHours ? 0 : power;
      const segmentEnergy = segmentPower === null ? null : segmentPower * hours;
      if (segmentEnergy !== null) {
        energy += segmentEnergy;
        intervalEnergy += segmentEnergy;
        peak = Math.max(peak, segmentPower!);
      }
      intervalLoad += load * hours;
      let segmentUnmet: number | null = null;
      let segmentCurtailed: number | null = null;
      let chargeInputWh: number | null = null;
      let deliveredWh: number | null = null;
      if (batteryKnown && segmentPower !== null) {
        const net = (segmentPower - load) * hours;
        segmentUnmet = 0;
        segmentCurtailed = 0;
        chargeInputWh = 0;
        deliveredWh = 0;
        if (net >= 0) {
          chargeInputWh = Math.min(
            net,
            (operations.maxChargeW ?? Infinity) * hours,
            (a.batteryWh - battery) / a.chargeEfficiency,
          );
          battery = Math.min(a.batteryWh, battery + chargeInputWh * a.chargeEfficiency);
          segmentCurtailed = net - chargeInputWh;
          curtailed += segmentCurtailed;
        } else {
          deliveredWh = Math.min(
            -net,
            (operations.maxDischargeW ?? Infinity) * hours,
            battery * a.dischargeEfficiency,
          );
          battery = Math.max(0, battery - deliveredWh / a.dischargeEfficiency);
          segmentUnmet = -net - deliveredWh;
          unmet += segmentUnmet;
        }
        min = Math.min(min, battery);
        const rate = segmentPower >= load
          ? Math.min(segmentPower - load, operations.maxChargeW ?? Infinity) * a.chargeEfficiency
          : -Math.min(load - segmentPower, operations.maxDischargeW ?? Infinity) / a.dischargeEfficiency;
        if (battery < reserveWh && segmentStartBattery! >= reserveWh) {
          const crossing = (segmentStartBattery! - reserveWh) / -rate;
          reserve += hours - crossing;
          event("reserve-crossing", k, start + crossing);
        } else if (segmentStartBattery! < reserveWh) {
          reserve += rate > 0 ? Math.min(hours, (reserveWh - segmentStartBattery!) / rate) : hours;
        }
        if (segmentUnmet > 0) {
          const onset = (operations.maxDischargeW ?? Infinity) < load - segmentPower
            ? 0
            : segmentStartBattery! * a.dischargeEfficiency / (load - segmentPower);
          event("unserved-load", k, start + onset);
        }
      }
      subsegments.push({
        intervalIndex: k,
        startOffsetHours: start,
        endOffsetHours: end,
        startBatteryWh: segmentStartBattery,
        batteryWh: batteryKnown ? battery : null,
        powerW: segmentPower,
        loadW: load,
        unmetWh: segmentUnmet,
        curtailedWh: segmentCurtailed,
        generatedWh: segmentEnergy,
        loadWh: load * hours,
        chargeInputWh,
        deliveredWh,
        contact: up,
        sun,
      });
    }
    if (!Number.isFinite(intervalLoad)) throw new Error("Interval load energy exceeds the finite model range");
    timeline.push({
      startOffsetHours,
      endOffsetHours,
      startBatteryWh: startBattery,
      loadW: intervalLoad / stepHours,
      unmetWh: batteryKnown ? unmet - previousUnmet : null,
      powerW: power === null ? null : intervalEnergy / stepHours,
      batteryWh: batteryKnown ? battery : null,
      contact: up,
      sun,
    });
  }
  const all = known === s.sunEl.length;
  const allContact = contactKnown === s.sunEl.length;
  if (![energy, unmet, curtailed, reserve].every(Number.isFinite))
    throw new Error("Accumulated mission energy exceeds the finite model range");
  return {
    generatedWh: all ? energy : null,
    minBatteryWh: all ? min : null,
    finalBatteryWh: all ? battery : null,
    unmetWh: all ? unmet : null,
    curtailedWh: all ? curtailed : null,
    partialCurtailedWh: curtailed,
    reserveHours: all ? reserve : null,
    contactFraction: allContact ? contact / s.sunEl.length : null,
    longestBlackoutHours: allContact ? longestBlackout : null,
    overlapHours: all && allContact ? overlap : null,
    knownFraction: known / s.sunEl.length,
    peakPowerW: all ? peak : null,
    timeline,
    subsegments,
    events: events.sort((x, y) => (x.modelOffsetHours ?? x.earliestOffsetHours) - (y.modelOffsetHours ?? y.earliestOffsetHours)),
  };
}

export type LinkInputs = {
  frequencyGHz: number;
  rangeKm: number;
  txPowerW: number;
  txGainDbi: number;
  rxGainDbi: number;
  lossDb: number;
  noiseTempK: number;
  dataRateBps: number;
  requiredEbN0Db: number;
};
export function linkBudget(
  a: Partial<LinkInputs>,
): {
  pathLossDb: number;
  receivedDbw: number;
  ebN0Db: number;
  marginDb: number;
} | null {
  const keys: Array<keyof LinkInputs> = [
    "frequencyGHz",
    "rangeKm",
    "txPowerW",
    "txGainDbi",
    "rxGainDbi",
    "lossDb",
    "noiseTempK",
    "dataRateBps",
    "requiredEbN0Db",
  ];
  if (!keys.every((k) => typeof a[k] === "number" && Number.isFinite(a[k])))
    return null;
  const p = a as LinkInputs;
  if (
    [p.frequencyGHz, p.rangeKm, p.txPowerW, p.noiseTempK, p.dataRateBps].some(
      (v) => v <= 0,
    ) ||
    p.lossDb < 0
  )
    return null;
  const pathLossDb =
    20 *
    Math.log10(
      (4 * Math.PI * p.rangeKm * 1000 * p.frequencyGHz * 1e9) / 299792458,
    );
  const receivedDbw =
    10 * Math.log10(p.txPowerW) +
    p.txGainDbi +
    p.rxGainDbi -
    p.lossDb -
    pathLossDb;
  const ebN0Db =
    receivedDbw -
    10 * Math.log10(1.380649e-23 * p.noiseTempK) -
    10 * Math.log10(p.dataRateBps);
  return {
    pathLossDb,
    receivedDbw,
    ebN0Db,
    marginDb: ebN0Db - p.requiredEbN0Db,
  };
}
