import { landingFields } from "./landing-inputs";
import {parseExternalMetadata} from './external-assessments';
import {parseEngineeringInputs,type EngineeringInputs} from "./engineering-screens";
import {parseEngineeringEvidence,type EngineeringEvidence} from "./engineering-context";
import { DEFAULT_MISSION, validateMission, type MissionAssumptions, type LinkInputs } from "./mission";
import { DEFAULT_FLIGHT, type FlightInputs } from "./flight";
import { DEFAULT_REQUIREMENTS, DEFAULT_OPERATIONS, EXTERNAL_IDS, type PlanningRequirements, type Operations, type ExternalAssessment } from "./planning-types";

export type LegacyScenarioInput = {
  siteId: string;
  custom: { lat: number; lon: number } | null;
  startIndex: number;
  endIndex: number;
  heightM: number;
  mission: MissionAssumptions;
  flight: FlightInputs;
  radio?: Partial<LinkInputs>;
};
export type ScenarioState = LegacyScenarioInput & {
  schemaVersion: 2;
  /** Absent in older records means prepared horizons only. */
  terrainMode?: "prepared" | "global-context" | "global-at-point";
  arrayHeightM: number;
  antennaHeightM: number;
  requirements: PlanningRequirements;
  operations: Operations;
  /** scenarioKey binds a report to the physical evidenceScopeKey, separately from requirement changes. */
  externalAssessments?: ExternalAssessment[];
  engineeringInputs?:EngineeringInputs;
  engineeringEvidence?:EngineeringEvidence;
};
export type ScenarioBounds = { siteIds: string[]; samples: number; stepHours?: number };
export const MAX_SCENARIO_ENCODED_LENGTH = 16000;
function parseBase(value: unknown, b: ScenarioBounds): LegacyScenarioInput | null {
  if (!value || typeof value !== "object") return null;
  const s = value as LegacyScenarioInput;
  if (!Number.isInteger(b.samples) || b.samples < 2 || !finite(b.stepHours ?? 1) || (b.stepHours ?? 1) <= 0) return null;
  if (
    !b.siteIds.includes(s.siteId) ||
    ![0, 2, 10].includes(s.heightM) ||
    !Number.isInteger(s.startIndex) ||
    !Number.isInteger(s.endIndex) ||
    s.startIndex < 0 ||
    s.endIndex < s.startIndex ||
    s.endIndex >= b.samples - 1
  )
    return null;
  if (
    s.custom !== null &&
    (!s.custom ||
      !Number.isFinite(s.custom.lat) ||
      !Number.isFinite(s.custom.lon) ||
      s.custom.lat < -90 ||
      s.custom.lat > 90 ||
      s.custom.lon < -180 ||
      s.custom.lon > 360)
  )
    return null;
  try {
    validateMission(s.mission);
  } catch {
    return null;
  }
  const radioKeys = ['frequencyGHz','rangeKm','txPowerW','txGainDbi','rxGainDbi','lossDb','noiseTempK','dataRateBps','requiredEbN0Db'] as const;
  let radio: Partial<LinkInputs> | undefined;
  if(s.radio!==undefined){
    if(!s.radio||typeof s.radio!=='object'||Array.isArray(s.radio))return null;
    radio={};
    for(const key of radioKeys){const v=s.radio[key];if(v===undefined)continue;if(typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1e12)return null;radio[key]=v;}
  }
  const f = s.flight;
  if (
    !f ||
    !["ascent", "descent"].includes(f.mode) ||
    Object.keys(DEFAULT_FLIGHT).some(
      (k) => k !== "mode" && !Number.isFinite(f[k as keyof FlightInputs]),
    )
  )
    return null;
  if (
    f.horizontalMps < 0 ||
    f.horizontalMps > 5000 ||
    Math.abs(f.verticalMps) > 5000 ||
    f.wetMassKg > 1e7 ||
    f.thrustN > 1e8 ||
    f.ispSeconds > 5000
  )
    return null;
  if (
    f.wetMassKg <= 0 ||
    f.dryMassKg <= 0 ||
    f.dryMassKg > f.wetMassKg ||
    f.durationSeconds <= 0 ||
    f.durationSeconds > 7200 ||
    f.burnSeconds < 0 ||
    f.burnSeconds > 7200 ||
    f.altitudeM < 0 ||
    f.altitudeM > 1e6 ||
    f.thrustN < 0 ||
    f.ispSeconds <= 0 ||
    Math.abs(f.pitchDeg) > 90 ||
    Math.abs(f.finalPitchDeg) > 90
  )
    return null;
  let configured: ReturnType<typeof landingFields>;
  try { configured = landingFields(f); } catch { return null; }
  // Reconstruct the schema so imported objects cannot carry unknown configuration.
  return {
    siteId: s.siteId,
    custom: s.custom ? { lat: s.custom.lat, lon: s.custom.lon } : null,
    startIndex: s.startIndex,
    endIndex: s.endIndex,
    heightM: s.heightM,
    mission: Object.fromEntries(Object.keys(DEFAULT_MISSION).map(key => [key, s.mission[key as keyof MissionAssumptions]])) as MissionAssumptions,
    flight: { ...Object.fromEntries(Object.keys(DEFAULT_FLIGHT).map(key => [key, f[key as keyof FlightInputs]])), ...configured } as FlightInputs,
    ...(radio ? {radio} : {}),
  };
}
type RecordValue = Record<string, unknown>;
function record(value: unknown): value is RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function nonnegative(value: unknown): value is number { return finite(value) && value >= 0; }
function id(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0 && value.length <= 120; }
function nullableNonnegative(value: unknown): value is number | null { return value === null || nonnegative(value); }
function windows(value: unknown, duration: number, load: boolean) {
  if (!Array.isArray(value) || value.length > 100) return null;
  const ids = new Set<string>();
  const result: Operations['loadSegments'] = [];
  for (const entry of value) {
    if (!record(entry) || !id(entry.id) || ids.has(entry.id) ||
      !nonnegative(entry.startOffsetHours) || !finite(entry.endOffsetHours) ||
      entry.endOffsetHours <= entry.startOffsetHours || entry.endOffsetHours > duration ||
      (load && !nonnegative(entry.additionalW))) return null;
    ids.add(entry.id);
    result.push({id: entry.id, startOffsetHours: entry.startOffsetHours,
      endOffsetHours: entry.endOffsetHours, ...(load ? {additionalW: entry.additionalW as number} : {})} as Operations['loadSegments'][number]);
  }
  return result;
}
function parseOperations(value: unknown, duration: number): Operations | null {
  if (!record(value) || !nonnegative(value.deploymentDelayHours) || value.deploymentDelayHours > duration ||
    !nullableNonnegative(value.maxChargeW) || !nullableNonnegative(value.maxDischargeW)) return null;
  const loadSegments = windows(value.loadSegments, duration, true);
  return loadSegments && {deploymentDelayHours:value.deploymentDelayHours,maxChargeW:value.maxChargeW,maxDischargeW:value.maxDischargeW,loadSegments};
}
function parseRequirements(value: unknown, duration: number): PlanningRequirements | null {
  if (!record(value) || !['resource-screening','landing-readiness'].includes(value.scope as string) ||
    typeof value.requireZeroUnmetWh !== 'boolean' || typeof value.requireReserve !== 'boolean' ||
    !nullableNonnegative(value.maxGeometricOutageHours) ||
    !(value.minAssumedRadioMarginDb === null || finite(value.minAssumedRadioMarginDb)) ||
    !Array.isArray(value.requiredExternal) || value.requiredExternal.length > EXTERNAL_IDS.length ||
    value.requiredExternal.some(v => !EXTERNAL_IDS.includes(v)) ||
    new Set(value.requiredExternal).size !== value.requiredExternal.length || !record(value.extraScreens)) return null;
  const criticalContacts = windows(value.criticalContacts, duration, false);
  if (!criticalContacts) return null;
  const extraScreens: PlanningRequirements['extraScreens'] = {};
  const limits = {minSunFraction:1,minContactFraction:1,maxDarkHours:Infinity,maxBlackoutHours:Infinity,maxSlopeDeg:90,minBatteryWh:Infinity,maxUnmetWh:Infinity};
  for (const [key, v] of Object.entries(value.extraScreens)) {
    if (!Object.hasOwn(limits,key) || !(v === null || (nonnegative(v) && v <= limits[key as keyof typeof limits]))) return null;
    Object.assign(extraScreens, {[key]:v});
  }
  return {scope:value.scope as PlanningRequirements['scope'],requireZeroUnmetWh:value.requireZeroUnmetWh,
    requireReserve:value.requireReserve,maxGeometricOutageHours:value.maxGeometricOutageHours,
    minAssumedRadioMarginDb:value.minAssumedRadioMarginDb,criticalContacts,
    requiredExternal:value.requiredExternal.slice(),extraScreens};
}
function parseReports(value: unknown): ExternalAssessment[] | null {
  if (!Array.isArray(value) || value.length > EXTERNAL_IDS.length) return null;
  const ids = new Set<string>(); const reports: ExternalAssessment[] = [];
  for (const v of value) {
    if (!record(v) || !EXTERNAL_IDS.includes(v.id as ExternalAssessment['id']) || ids.has(v.id as string) ||
      !['reported-pass','reported-fail','unknown'].includes(v.status as string) ||
      !['source','author','notes','scenarioKey'].every(key => typeof v[key] === 'string' && (v[key] as string).length <= 4000) ||
      !(v.scenarioKey as string).trim() || (v.status !== 'unknown' && (!(v.source as string).trim() || !(v.author as string).trim()))) return null;
    const metadata=parseExternalMetadata(v);if(!metadata)return null;
    ids.add(v.id as string);
    reports.push({id:v.id as ExternalAssessment['id'],status:v.status as ExternalAssessment['status'],source:v.source as string,author:v.author as string,notes:v.notes as string,scenarioKey:v.scenarioKey as string,...metadata});
  }
  return reports;
}
/** Inclusive forcing indices need an additional endpoint sample: n-1 is never a supported interval. */
export function migrateScenario(value: unknown, bounds: ScenarioBounds): ScenarioState | null {
  if (!record(value) || (value.schemaVersion !== undefined && value.schemaVersion !== 1 && value.schemaVersion !== 2)) return null;
  if(value.terrainMode!==undefined&&!["prepared","global-context","global-at-point"].includes(value.terrainMode as string))return null;
  const base = parseBase(value,bounds);
  if (!base) return null;
  const legacy = value.schemaVersion !== 2;
  const arrayHeightM = legacy ? base.heightM : value.arrayHeightM;
  const antennaHeightM = legacy ? base.heightM : value.antennaHeightM;
  if (![0,2,10].includes(arrayHeightM as number) || ![0,2,10].includes(antennaHeightM as number)) return null;
  const duration = (base.endIndex - base.startIndex + 1) * (bounds.stepHours ?? 1);
  if (!Number.isFinite(duration)) return null;
  const requirements = parseRequirements(legacy ? DEFAULT_REQUIREMENTS : value.requirements,duration);
  const operations = parseOperations(legacy ? DEFAULT_OPERATIONS : value.operations,duration);
  if (!requirements || !operations) return null;
  const externalAssessments = value.externalAssessments === undefined ? undefined : parseReports(value.externalAssessments);
  if (externalAssessments === null) return null;
  const engineeringInputs=value.engineeringInputs===undefined?undefined:parseEngineeringInputs(value.engineeringInputs);
  const engineeringEvidence=value.engineeringEvidence===undefined?undefined:parseEngineeringEvidence(value.engineeringEvidence);
  if(engineeringInputs===null||engineeringEvidence===null)return null;
  return {...base,schemaVersion:2,...(value.terrainMode!==undefined?{terrainMode:value.terrainMode as ScenarioState["terrainMode"]}:{}),arrayHeightM:arrayHeightM as number,antennaHeightM:antennaHeightM as number,
    requirements,operations,...(engineeringInputs?{engineeringInputs}:{}),...(engineeringEvidence?{engineeringEvidence}:{}),...(externalAssessments ? {externalAssessments} : {})};
}
export const parseScenario = migrateScenario;

/** UTF-8 encoding also retains provenance text in external reports. */
export function encodeScenario(s: ScenarioState | LegacyScenarioInput, bounds?: ScenarioBounds): string {
  if (new TextEncoder().encode(JSON.stringify(s)).length > MAX_SCENARIO_ENCODED_LENGTH * 3 / 4)
    throw new Error('Scenario exceeds the 16000-character sharing limit. Reduce schedules or report notes.');
  // Non-hourly scenarios must provide their actual catalogue step, as on import.
  const canonical = migrateScenario(s, bounds ?? {siteIds:[s.siteId],samples:s.endIndex + 2});
  if (!canonical) throw new Error('Scenario is invalid and cannot be shared.');
  const bytes = new TextEncoder().encode(JSON.stringify(canonical));
  if (bytes.length > MAX_SCENARIO_ENCODED_LENGTH * 3 / 4) throw new Error('Scenario exceeds the 16000-character sharing limit. Reduce schedules or report notes.');
  const encoded = btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))
    .replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  if (encoded.length > MAX_SCENARIO_ENCODED_LENGTH) throw new Error('Scenario exceeds the 16000-character sharing limit.');
  return encoded;
}
export function decodeScenario(encoded: string, bounds: ScenarioBounds): ScenarioState | null {
  if (encoded.length > MAX_SCENARIO_ENCODED_LENGTH || !/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
  try {
    const binary = atob(encoded.replaceAll('-','+').replaceAll('_','/'));
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return migrateScenario(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),bounds);
  } catch { return null; }
}
