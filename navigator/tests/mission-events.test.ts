import { test } from "node:test";
import assert from "node:assert/strict";
import { toMissionEvent, type MissionModelEvent } from "../lib/mission-events";
import type { MissionEvent } from "../lib/planning-types";

const crossing: MissionModelEvent = {
  kind: "reserve-crossing", intervalIndex: 2,
  earliestOffsetHours: 2, latestOffsetHours: 3, modelOffsetHours: 2.4,
};

test("conversion preserves forcing bounds, exact model offset and evidence", () => {
  const ids = ["array-terrain", "assumed-load"];
  const result: MissionEvent = toMissionEvent(crossing, "2026-11-14T00:00:00Z", ids);
  assert.deepEqual(result, {
    kind: "reserve-crossing", intervalIndex: 2,
    earliestUtc: "2026-11-14T02:00:00.000Z", latestUtc: "2026-11-14T03:00:00.000Z",
    modelOffsetHours: 2.4, evidenceIds: ids,
  });
  ids.push("later");
  assert.equal(result.evidenceIds.length, 2);
});

test("unknown events keep a null model offset and mission-relative bounds", () => {
  const result = toMissionEvent({...crossing, kind: "unknown-data", modelOffsetHours: null}, "2026-11-14T23:00:00Z");
  assert.equal(result.earliestUtc, "2026-11-15T01:00:00.000Z");
  assert.equal(result.latestUtc, "2026-11-15T02:00:00.000Z");
  assert.equal(result.modelOffsetHours, null);
  assert.deepEqual(result.evidenceIds, []);
});

test("conversion rejects invalid times and inconsistent model offsets", () => {
  assert.throws(() => toMissionEvent(crossing, "invalid"), /start|date|time/i);
  for (const change of [
    {earliestOffsetHours: NaN}, {latestOffsetHours: 1}, {modelOffsetHours: Infinity},
    {modelOffsetHours: 4}, {intervalIndex: -1}, {earliestOffsetHours: -1},
  ]) assert.throws(() => toMissionEvent({...crossing, ...change}, "2026-11-14T00:00:00Z"));
  assert.throws(() => toMissionEvent({...crossing, latestOffsetHours: 1e308}, "2026-11-14T00:00:00Z"));
});
