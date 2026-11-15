import { test } from "node:test";
import assert from "node:assert/strict";
import { parseScenario, encodeScenario, decodeScenario } from "../lib/scenario";
import { DEFAULT_MISSION } from "../lib/mission";
import { DEFAULT_FLIGHT } from "../lib/flight";
const state = {
  siteId: "ridge",
  custom: null,
  startIndex: 10,
  endIndex: 100,
  heightM: 2,
  mission: DEFAULT_MISSION,
  flight: DEFAULT_FLIGHT,
};
const bounds = { siteIds: ["ridge"], samples: 200 };
test("scenario share roundtrips coordinates, date bounds and vehicle/power inputs", () => {
  const p = decodeScenario(encodeScenario(state), bounds);
  assert.deepEqual(p, parseScenario(state, bounds));
});
test("invalid date range or unknown site is rejected without clamping", () => {
  assert.equal(parseScenario({ ...state, startIndex: 300 }, bounds), null);
  assert.equal(parseScenario({ ...state, siteId: "fake" }, bounds), null);
});
test("invalid custom coordinates or vehicle assumptions are rejected", () => {
  assert.equal(
    parseScenario({ ...state, custom: { lat: 91, lon: 0 } }, bounds),
    null,
  );
  assert.equal(
    parseScenario(
      { ...state, mission: { ...DEFAULT_MISSION, efficiency: 2 } },
      bounds,
    ),
    null,
  );
});
test("malformed shared state is an explicit parse failure", () => {
  assert.equal(decodeScenario("not-json", bounds), null);
});
test("truncated mission assumptions cannot be imported or shared", () => {
  assert.equal(parseScenario({...state,mission:{arrayMode:'tracking'}},bounds),null);
  for(const key of Object.keys(DEFAULT_MISSION)){
    const mission={...DEFAULT_MISSION} as Record<string,unknown>; delete mission[key];
    assert.equal(parseScenario({...state,mission},bounds),null,key);
  }
});
test("optional radio assumptions survive scenario save/share and reject invalid numbers",()=>{
  const radio={frequencyGHz:8.4,rangeKm:384400,txPowerW:20,txGainDbi:15,rxGainDbi:50,lossDb:3,noiseTempK:100,dataRateBps:1e6,requiredEbN0Db:5};
  assert.deepEqual(decodeScenario(encodeScenario({...state,radio}),bounds)?.radio,radio);
  assert.equal(parseScenario({...state,radio:{frequencyGHz:Infinity}},bounds),null);
});

test("final epoch is rejected for legacy and V2 without clamping",()=>{
  const canonical=parseScenario(state,bounds)!;
  for(const s of [state,canonical]) {
    assert.equal(parseScenario({...s,endIndex:199},bounds),null);
    assert.equal(parseScenario({...s,endIndex:198},bounds)?.endIndex,198);
  }
});
test("UTF-8 external provenance, custom coordinates and independent heights roundtrip",()=>{
  const s=parseScenario({...state,custom:{lat:-84.25,lon:359.5},mission:{...DEFAULT_MISSION,batteryWh:0,loadW:0}},bounds)!;
  s.arrayHeightM=0;s.antennaHeightM=10;
  s.externalAssessments=[{id:'thermal-survival',status:'reported-pass',source:'Équipe 月',author:'Zoë 🚀',notes:'Unverified external report',scenarioKey:'physical-scope-1'}];
  assert.deepEqual(decodeScenario(encodeScenario(s),bounds),s);
  const decoded=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encodeScenario(state).replaceAll('-','+').replaceAll('_','/')),v=>v.charCodeAt(0))));
  assert.equal(decoded.schemaVersion,2);
});
test("unknown nested configuration cannot enter canonical state",()=>{
 const s=parseScenario(state,bounds)!;
 const parsed=parseScenario({...s,ignored:1,mission:{...s.mission,ignored:1},flight:{...s.flight,ignored:1},requirements:{...s.requirements,ignored:1},operations:{...s.operations,ignored:1}},bounds)!;
 assert.deepEqual(parsed,s);
});
test("sharing is bounded and malformed UTF-8 rejects",()=>{
 const s=parseScenario(state,bounds)!;
 s.externalAssessments=[{id:'thermal-survival',status:'unknown',source:'',author:'',notes:'月'.repeat(10000),scenarioKey:'scope'}];
 assert.throws(()=>encodeScenario(s),/sharing limit/);
 assert.equal(decodeScenario('a'.repeat(16001),bounds),null);
 assert.equal(decodeScenario('_w',bounds),null);
});

test("export migrates explicit V1 and validates canonical schedules against supplied bounds",()=>{
 const v1={...state,schemaVersion:1};
 assert.equal(JSON.parse(Buffer.from(encodeScenario(v1),'base64url').toString('utf8')).schemaVersion,2);
 const s=parseScenario(state,{...bounds,stepHours:2})!;
 s.operations.deploymentDelayHours=150;
 assert.deepEqual(decodeScenario(encodeScenario(s,{...bounds,stepHours:2}),{...bounds,stepHours:2}),s);
 assert.throws(()=>encodeScenario(s,bounds),/invalid/);
 s.operations.deploymentDelayHours=1000;
 assert.throws(()=>encodeScenario(s,{...bounds,stepHours:2}),/invalid/);
});
