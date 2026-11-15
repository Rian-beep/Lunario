import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_FLIGHT } from "../lib/flight";
import { DEFAULT_MISSION } from "../lib/mission";
import { DEFAULT_OPERATIONS, DEFAULT_REQUIREMENTS } from "../lib/planning-types";
import { classifyScenarioDiff, diffScenarios } from "../lib/scenario-diff";
import type { ScenarioState } from "../lib/scenario";
function scenario(): ScenarioState {
  return structuredClone({ schemaVersion: 2, siteId: "a", custom: null, startIndex: 0, endIndex: 10, heightM: 2, arrayHeightM: 2, antennaHeightM: 10, mission: DEFAULT_MISSION, flight: DEFAULT_FLIGHT, operations: DEFAULT_OPERATIONS, requirements: DEFAULT_REQUIREMENTS, externalAssessments: [] });
}
test("comparison is deterministic, schema-whitelisted and does not mutate inputs", () => {
  const a = scenario(), b = { ...scenario(), mission: { ...DEFAULT_MISSION, loadW: 300 }, heightM: 10, userMetric: 77, arbitrary: { status: "pass" } };
  const snapshot = structuredClone([a, b]);
  const differences = diffScenarios(a, b);
  assert.deepEqual(differences.map((d) => d.path), ["heightM", "mission.loadW"]);
  assert.equal(classifyScenarioDiff(differences), "assumptions");
  assert.deepEqual([a, b], snapshot);
  assert.deepEqual(diffScenarios(a, b), differences);
});
test("classifies controlled site/date changes and mixed changes", () => {
  const a = scenario();
  assert.equal(classifyScenarioDiff(diffScenarios(a, a)), "identical");
  assert.equal(classifyScenarioDiff(diffScenarios(a, { ...a, siteId: "b" })), "site-only");
  assert.equal(classifyScenarioDiff(diffScenarios(a, { ...a, startIndex: 1, endIndex: 11 })), "date-only");
  assert.equal(classifyScenarioDiff(diffScenarios(a, { ...a, siteId: "b", heightM: 10 })), "mixed");
});
test("longitude aliases do not create false coordinate changes", () => {
  const a = { ...scenario(), custom: { lat: -88, lon: -10 } };
  const b = { ...a, custom: { lat: -88, lon: 350 } };
  assert.deepEqual(diffScenarios(a, b), []);
  assert.equal(classifyScenarioDiff(diffScenarios(a, { ...b, custom: { lat: -87, lon: 350 } })), "site-only");
});
test("null, zero and missing radio remain distinct", () => {
  const a = scenario(), b = scenario();
  b.operations.maxChargeW = 0;
  assert.deepEqual(diffScenarios(a, b), [{ path: "operations.maxChargeW", before: null, after: 0 }]);
  assert.deepEqual(diffScenarios(a, { ...a, radio: { lossDb: 0 } }), [{ path: "radio.lossDb", before: undefined, after: 0 }]);
});
test("independent heights and all nested schema-2 settings are visible", () => {
  const a = scenario(), b = scenario();
  b.arrayHeightM = 10; b.antennaHeightM = 2;
  b.requirements.extraScreens.maxSlopeDeg = 8;
  b.requirements.criticalContacts = [{ id: "window/a", startOffsetHours: 2, endOffsetHours: 3 }];
  b.operations.loadSegments = [{ id: "drill", startOffsetHours: 1, endOffsetHours: 2, additionalW: 70 }];
  b.externalAssessments = [{ id: "thermal-survival", status: "reported-pass", source: "report", author: "person", notes: "assumed", scenarioKey: "x" }];
  const paths = diffScenarios(a, b).map((d) => d.path);
  for (const path of ["arrayHeightM", "antennaHeightM", "requirements.extraScreens.maxSlopeDeg", "requirements.criticalContacts[window%2Fa].startOffsetHours", "operations.loadSegments[drill].additionalW", "externalAssessments[thermal-survival].scenarioKey"]) assert.ok(paths.includes(path), path);
});
test("ID paths and required-external sets are stable across array reordering", () => {
  const a = scenario();
  a.operations.loadSegments = [{ id: "b", startOffsetHours: 1, endOffsetHours: 2, additionalW: 1 }, { id: "a", startOffsetHours: 3, endOffsetHours: 4, additionalW: 2 }];
  a.requirements.requiredExternal = ["thermal-survival", "ground-support"];
  const b = structuredClone(a);
  b.operations.loadSegments.reverse(); b.requirements.requiredExternal.reverse();
  assert.deepEqual(diffScenarios(a, b), []);
  b.operations.loadSegments[0].additionalW = 4;
  assert.deepEqual(diffScenarios(a, b), [{ path: "operations.loadSegments[a].additionalW", before: 2, after: 4 }]);
  b.operations.loadSegments.push({ ...b.operations.loadSegments[0] });
  assert.throws(() => diffScenarios(a, b), /unique nonempty IDs/);
});
test("deletions retain previous values and unknown nested imported metrics do not count", () => {
  const a = scenario();
  a.externalAssessments = [{ id: "thermal-survival", status: "unknown", source: "", author: "", notes: "", scenarioKey: "x" }];
  const b = scenario();
  assert.deepEqual(diffScenarios(a, b).find((d) => d.path.endsWith(".scenarioKey")), { path: "externalAssessments[thermal-survival].scenarioKey", before: "x", after: undefined });
  const withMetrics = { ...b, mission: { ...b.mission, invented: 200 }, requirements: { ...b.requirements, extraScreens: { customMetric: 1 } } } as ScenarioState;
  assert.deepEqual(diffScenarios(b, withMetrics), []);
});
