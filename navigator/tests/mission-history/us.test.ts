import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { LANDING_SITES } from "../../lib/landing-sites";
import { US_MISSION_HISTORY } from "../../lib/mission-history/us";
import type { MissionHistoryRecord, Sourced } from "../../lib/mission-history/types";

function mission(id: string): MissionHistoryRecord {
  const record = US_MISSION_HISTORY.find((r) => r.id === id);
  assert.ok(record, `Missing US history: ${id}`);
  return record;
}

const sourcedKeys = [
  "operator", "sponsors", "representing", "model", "missionDates", "objectives",
  "outcome", "discoveries", "innovations", "publicSummary", "educatorNotes", "plannerNotes",
] as const;

function sourcedFields(record: MissionHistoryRecord): Sourced<unknown>[] {
  return [...sourcedKeys.map((key) => record[key]), record.exploration.summary,
    record.exploration.distanceKm, record.exploration.areaKm2];
}

const landingIds = [
  "apollo-11", "apollo-12", "apollo-14", "apollo-15", "apollo-16", "apollo-17",
  "surveyor-1", "surveyor-2", "surveyor-3", "surveyor-4", "surveyor-5", "surveyor-6", "surveyor-7",
  "odysseus", "blue-ghost-1", "athena",
];

const catalog = JSON.parse(readFileSync(new URL("../../public/data/catalog.json", import.meta.url), "utf8")) as {
  sites: { id: string; name: string }[];
};

test("US history covers every existing Apollo, Surveyor and US CLPS landing/attempt exactly once", () => {
  const existingUS = LANDING_SITES.filter((s) => ["Apollo", "Surveyor", "CLPS"].includes(s.program));
  assert.deepEqual(existingUS.map((s) => s.id).sort(), [...landingIds].sort());
  for (const pin of existingUS) {
    const matches = US_MISSION_HISTORY.filter((r) => r.siteIds.includes(pin.id));
    assert.equal(matches.length, 1, `${pin.id}: exactly one actual mission`);
    assert.equal(matches[0].id, pin.id);
  }
  assert.equal(US_MISSION_HISTORY.length, 26);
  assert.equal(new Set(US_MISSION_HISTORY.map((r) => r.id)).size, US_MISSION_HISTORY.length);
});

test("actual precomputed US catalog IDs resolve including the legacy LCROSS name", () => {
  const known = ["odysseus", "athena", "lcross-cabeus"];
  const catalogMissions = catalog.sites.filter((s) => known.includes(s.id));
  assert.deepEqual(catalogMissions.map((s) => s.id).sort(), [...known].sort());
  for (const pin of catalogMissions) {
    assert.equal(US_MISSION_HISTORY.filter((r) => r.siteIds.includes(pin.id)).length, 1, pin.id);
  }
  assert.deepEqual(mission("lcross-cabeus").siteIds, ["lcross-cabeus"]);
  assert.ok(!LANDING_SITES.some((s) => s.id === "lcross-cabeus"));
});

test("history never binds unrelated missions or geographic/candidate pins to a single record", () => {
  const permitted = new Set([...landingIds, "lcross-cabeus"]);
  const bindings = US_MISSION_HISTORY.flatMap((r) => r.siteIds);
  assert.deepEqual([...bindings].sort(), [...permitted].sort());
  assert.equal(new Set(bindings).size, bindings.length);
  for (const record of US_MISSION_HISTORY) {
    assert.ok(record.siteIds.every((id) => permitted.has(id)), record.id);
    assert.ok(record.siteIds.length <= 1, "No unverified aliases across different missions");
  }
  assert.notEqual(mission("apollo-12"), mission("surveyor-3"));
  assert.deepEqual(mission("surveyor-3").siteIds, ["surveyor-3"]);
  assert.equal(US_MISSION_HISTORY.some((r) => r.id === "apollo-13"), false);
});

test("every non-null sourced field resolves to a primary reference on its own record", () => {
  const allowedHosts = new Set([
    "www.nasa.gov", "science.nasa.gov", "nssdc.gsfc.nasa.gov", "ntrs.nasa.gov", "pds.nasa.gov",
    "pubs.usgs.gov", "astrogeology.usgs.gov", "fireflyspace.com", "investors.fireflyspace.com",
  ]);
  const globalSources = new Map<string, string>();
  for (const record of US_MISSION_HISTORY) {
    const ids = new Set(record.sources.map((s) => s.id));
    assert.equal(ids.size, record.sources.length, record.id);
    for (const ref of record.sources) {
      const url = new URL(ref.url);
      assert.equal(url.protocol, "https:");
      assert.ok(allowedHosts.has(url.hostname), `${record.id}: ${url.hostname}`);
      assert.ok(ref.title.trim() && ref.publisher.trim() && ref.country.trim());
      assert.equal(ref.language, "English", "Original English sources must not be mislabeled translations");
      assert.equal(ref.translationNote, undefined);
      if (globalSources.has(ref.id)) assert.equal(globalSources.get(ref.id), ref.url, ref.id);
      globalSources.set(ref.id, ref.url);
    }
    for (const field of sourcedFields(record)) {
      if (field.value === null) {
        assert.ok(field.note?.trim(), `${record.id}: unknown needs an explanation`);
      } else {
        assert.ok(field.sourceIds.length > 0, `${record.id}: uncited value`);
        if (typeof field.value === "string") assert.ok(field.value.trim());
        if (Array.isArray(field.value)) assert.ok(field.value.length && field.value.every((s) => typeof s === "string" && s.trim()));
      }
      assert.equal(new Set(field.sourceIds).size, field.sourceIds.length, `${record.id}: duplicate citations`);
      for (const ref of field.sourceIds) assert.ok(ids.has(ref), `${record.id}: dangling ${ref}`);
    }
  }
});

test("Apollo hardware designations are NASA-attested LM identifiers rather than mission numbers", () => {
  const expected = [
    ["apollo-11", "LM-5", "Eagle"], ["apollo-12", "LM-6", "Intrepid"],
    ["apollo-14", "LM-8", "Antares"], ["apollo-15", "LM-10", "Falcon"],
    ["apollo-16", "LM-11", "Orion"], ["apollo-17", "LM-12", "Challenger"],
  ];
  for (const [id, lm, callSign] of expected) {
    assert.ok(mission(id).model.value?.includes(`${lm} “${callSign}”`));
    assert.ok(mission(id).model.sourceIds.includes(`${id}-sp4029`));
  }
  assert.match(mission("apollo-16").missionDates.value ?? "", /1972-04-20 lunar landing/);
});

test("walking and rover distances retain source precision, disagreements and map context", () => {
  const expected = new Map([
    ["apollo-11", 0.25], ["apollo-12", 1.35], ["apollo-14", 3.45],
    ["apollo-15", 27.9], ["apollo-16", 26.9], ["apollo-17", 35.7],
  ]);
  for (const [id, km] of expected) {
    const record = mission(id);
    assert.equal(record.exploration.distanceKm.value, km);
    assert.match(record.exploration.distanceKm.note ?? "", /differ|SP-4029/);
    assert.match(record.exploration.summary.value ?? "", /walk|rover|cart/i);
    const citations = record.exploration.summary.sourceIds;
    assert.ok(record.sources.some((s) => citations.includes(s.id) && /traverse map/i.test(s.title)), id);
  }
  assert.match(mission("apollo-14").sources.find((s) => s.id === "apollo-14-map")?.url ?? "", /ofr71297$/);
  assert.deepEqual(mission("apollo-15").exploration.distanceKm.sourceIds, ["apollo-15-sp4029", "nasa-lrv"]);
});

test("no distance is converted into area, inferred route or stationary zero", () => {
  for (const record of US_MISSION_HISTORY) {
    assert.equal(record.exploration.areaKm2.value, null, record.id);
    assert.match(record.exploration.areaKm2.note ?? "", /distance is not area/);
    assert.equal(record.exploration.route, undefined, record.id);
    assert.equal(record.exploration.routeSourceIds, undefined, record.id);
    if (!record.id.startsWith("apollo-")) {
      assert.equal(record.exploration.distanceKm.value, null, `${record.id}: no invented zero/route length`);
    }
  }
  assert.match(mission("surveyor-6").exploration.summary.value ?? "", /2\.5 m.*displacement/);
  assert.match(mission("surveyor-6").exploration.distanceKm.note ?? "", /not a measured traverse/);
  assert.match(mission("athena").exploration.summary.value ?? "", /planned hopper travel is not an achieved/i);
});

test("Surveyor failures, bounced landing and sampler recovery stay distinct", () => {
  assert.match(mission("surveyor-2").outcome.value?.landing ?? "", /Failed.*thruster.*spin/);
  assert.equal(mission("surveyor-2").discoveries.value, null);
  assert.match(mission("surveyor-2").missionDates.note ?? "", /dates conflict/);
  assert.match(mission("surveyor-3").outcome.value?.landing ?? "", /Bounced twice.*operating/);
  assert.match(mission("surveyor-3").outcome.value?.science ?? "", /bearing-test.*Apollo 12/);
  assert.match(mission("surveyor-4").outcome.value?.landing ?? "", /not confirmed/);
  assert.equal(mission("surveyor-4").discoveries.value, null);
  assert.match(mission("surveyor-4").exploration.summary.value ?? "", /intended target.*unknown/);
  assert.match(mission("surveyor-7").outcome.value?.science ?? "", /initially stuck/);
});

test("Ranger program includes tests and misses without inventing landing pins or treating impact as soft landing", () => {
  for (let n = 1; n <= 9; n++) assert.deepEqual(mission(`ranger-${n}`).siteIds, []);
  for (const n of [1, 2]) assert.match(mission(`ranger-${n}`).outcome.value?.landing ?? "", /No lunar landing attempt/);
  for (const n of [3, 5]) {
    assert.match(mission(`ranger-${n}`).outcome.value?.landing ?? "", /[Mm]issed the Moon/);
    assert.match(mission(`ranger-${n}`).outcome.value?.science ?? "", /gamma-ray/);
  }
  assert.equal(mission("ranger-4").discoveries.value, null);
  assert.match(mission("ranger-4").outcome.value?.landing ?? "", /Uncontrolled.*impact/);
  assert.match(mission("ranger-6").outcome.value?.landing ?? "", /intentional impact/);
  assert.match(mission("ranger-6").outcome.value?.science ?? "", /prevented all planned lunar photographs/);
  for (const [n, count] of [[7, "4,316"], [8, "7,137"], [9, "5,814"]]) {
    assert.ok(mission(`ranger-${n}`).outcome.value?.science.includes(String(count)));
  }
});

test("commercial operators, government customers and payload partners have explicit different roles", () => {
  assert.match(mission("odysseus").operator.value ?? "", /Intuitive Machines.*commercial/i);
  assert.match(mission("athena").operator.value ?? "", /Intuitive Machines.*commercial/i);
  assert.match(mission("blue-ghost-1").operator.value ?? "", /Firefly Aerospace.*commercial/i);
  for (const id of ["odysseus", "athena", "blue-ghost-1"]) {
    assert.match(mission(id).sponsors.value?.join(" ") ?? "", /NASA.*government.*CLPS/);
  }
  assert.match(mission("blue-ghost-1").representing.value?.join(" ") ?? "", /Italian Space Agency.*LuGRE/);
  assert.match(mission("lcross-cabeus").operator.value ?? "", /Ames.*Northrop Grumman.*partner/);
  for (const record of US_MISSION_HISTORY) {
    assert.doesNotMatch(JSON.stringify(record), /\$\s*\d|\b\d+(?:\.\d+)?\s*(?:million|billion)\s*(?:dollars|USD)/i);
  }
});

test("CLPS touchdown and instrument-level results preserve partial failures and attribution", () => {
  assert.match(mission("odysseus").outcome.value?.landing ?? "", /side.*off-nominal/);
  assert.match(mission("odysseus").outcome.value?.science ?? "", /SCALPSS did not collect/);
  assert.match(mission("athena").outcome.value?.landing ?? "", /side.*batteries/i);
  assert.match(mission("athena").outcome.value?.science ?? "", /drilling.*not achieved/);
  assert.match(mission("athena").discoveries.value?.join(" ") ?? "", /propulsion gases.*not a confirmed lunar ice detection/);
  assert.match(mission("blue-ghost-1").outcome.value?.science ?? "", /Firefly reported all ten/);
  assert.match(mission("blue-ghost-1").discoveries.value?.join(" ") ?? "", /LuGRE.*GPS and Galileo.*LEXI.*X-ray/);
});

test("Apollo discoveries teach evidence and retain failures within successful landings", () => {
  assert.match(mission("apollo-12").outcome.value?.science ?? "", /camera failed/);
  assert.match(mission("apollo-14").outcome.value?.science ?? "", /navigation difficulties/i);
  assert.match(mission("apollo-16").outcome.value?.science ?? "", /severed cable.*heat-flow/);
  assert.match(mission("apollo-16").discoveries.value?.join(" ") ?? "", /impact-produced.*overturned.*volcanic/);
  assert.match(mission("apollo-17").outcome.value?.science ?? "", /fender.*repair/);
  assert.match(mission("lcross-cabeus").outcome.value?.landing ?? "", /Intentional destructive impacts, not soft landings/);
  assert.match(mission("lcross-cabeus").discoveries.value?.join(" ") ?? "", /local evidence.*not a map/);
});

test("all audiences get distinct depth and explicit historical-evidence limits", () => {
  for (const record of US_MISSION_HISTORY) {
    const values = [record.publicSummary.value, record.educatorNotes.value, record.plannerNotes.value];
    assert.ok(values.every((value) => typeof value === "string" && value.length > 45), record.id);
    assert.equal(new Set(values).size, 3, record.id);
    assert.match(record.educatorNotes.note ?? "", /Teaching interpretation/);
    assert.match(record.plannerNotes.note ?? "", /Historical evidence limits/);
    assert.match(record.plannerNotes.note ?? "", /no operational approval|not operational approval/i);
    assert.doesNotMatch(record.plannerNotes.value ?? "", /\b(?:NASA.approved|safe to land here|operationally approved)\b/i);
  }
});
