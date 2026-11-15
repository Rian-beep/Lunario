import {ENGINEERING_SCREEN_FIELDS,type EngineeringDomain} from './engineering-screens';
import type { ScenarioState } from "./scenario";

export type ScenarioDifference = { path: string; before: unknown; after: unknown };
export type ScenarioComparison = "identical" | "site-only" | "date-only" | "assumptions" | "mixed";
const fields: Record<string, string> = {
  "": "schemaVersion terrainMode siteId startIndex endIndex heightM arrayHeightM antennaHeightM",
  custom: "lat lon",
  mission: "areaM2 efficiency lossFraction solarFlux arrayMode tiltDeg azimuthDeg loadW batteryWh initialSoc reserveSoc chargeEfficiency dischargeEfficiency antennaMaskDeg",
  flight: "mode altitudeM horizontalMps verticalMps headingDeg pitchDeg finalPitchDeg wetMassKg dryMassKg thrustN ispSeconds burnSeconds durationSeconds",
  radio: "frequencyGHz rangeKm txPowerW txGainDbi rxGainDbi lossDb noiseTempK dataRateBps requiredEbN0Db",
  operations: "deploymentDelayHours maxChargeW maxDischargeW",
  requirements: "scope requireZeroUnmetWh requireReserve maxGeometricOutageHours minAssumedRadioMarginDb",
  "requirements.extraScreens": "minSunFraction minContactFraction maxDarkHours maxBlackoutHours maxSlopeDeg minBatteryWh maxUnmetWh",
};
const arrays: Record<string, string> = {
  "operations.loadSegments": "startOffsetHours endOffsetHours additionalW",
  "requirements.criticalContacts": "startOffsetHours endOffsetHours",
  externalAssessments: "status source author notes scenarioKey sourceUrl documentTitle assessedUtc scopeNote",
};
const read = (value: unknown, path: string): unknown => path.split(".").filter(Boolean).reduce<unknown>((part, key) => part && typeof part === "object" ? (part as Record<string, unknown>)[key] : undefined, value);
function project(scenario: ScenarioState) {
  const values = new Map<string, unknown>();
  for (const [prefix, keys] of Object.entries(fields)) for (const key of keys.split(" ")) {
    const path = prefix ? `${prefix}.${key}` : key;
    const value = read(scenario, path);
    values.set(path, path === "custom.lon" && typeof value === "number" ? ((value % 360) + 360) % 360 : value);
  }
  // Preserve a null custom site explicitly, even when its scalar coordinates are absent.
  values.set("custom", scenario.custom === null ? null : undefined);
  for (const [path, keys] of Object.entries(arrays)) {
    const records = read(scenario, path);
    if (!Array.isArray(records)) continue;
    const ids = new Set<string>();
    for (const record of records) {
      const id = read(record, "id");
      if (typeof id !== "string" || !id || ids.has(id)) throw new Error(`${path} requires unique nonempty IDs`);
      ids.add(id);
      values.set(`${path}[${encodeURIComponent(id)}].id`, id);
      for (const key of keys.split(" ")) values.set(`${path}[${encodeURIComponent(id)}].${key}`, read(record, key));
    }
  }
  for(const domain of Object.keys(ENGINEERING_SCREEN_FIELDS) as EngineeringDomain[]){
    for(const field of ENGINEERING_SCREEN_FIELDS[domain])values.set(`engineeringInputs.${domain}.${field.id}`,scenario.engineeringInputs?.[domain]?.[field.id]);
    for(const key of ['scopeKey','source','author'] as const)values.set(`engineeringEvidence.${domain}.${key}`,scenario.engineeringEvidence?.[domain]?.[key]);
  }
  const required = read(scenario, "requirements.requiredExternal");
  values.set("requirements.requiredExternal", Array.isArray(required) ? [...required].sort() : required);
  return values;
}
/** Compare already validated inputs; imported metrics and unknown keys are excluded. */
export function diffScenarios(before: ScenarioState, after: ScenarioState): ScenarioDifference[] {
  const a = project(before), b = project(after);
  return [...new Set([...a.keys(), ...b.keys()])].sort().flatMap((path) =>
    JSON.stringify(a.get(path)) === JSON.stringify(b.get(path)) ? [] : [{ path, before: a.get(path), after: b.get(path) }]);
}
export function classifyScenarioDiff(differences: readonly ScenarioDifference[]): ScenarioComparison {
  const categories = new Set(differences.map(({ path }) => path === "siteId" || path === "custom" || path.startsWith("custom.") ? "site-only" : path === "startIndex" || path === "endIndex" ? "date-only" : "assumptions"));
  return categories.size === 0 ? "identical" : categories.size > 1 ? "mixed" : [...categories][0] as ScenarioComparison;
}
