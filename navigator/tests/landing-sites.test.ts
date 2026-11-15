import { test } from "node:test";
import assert from "node:assert/strict";
import { LANDING_SITES } from "../lib/landing-sites";

function site(id: string) {
  const result = LANDING_SITES.find((entry) => entry.id === id);
  assert.ok(result, `Missing mission: ${id}`);
  return result;
}

test("mission IDs are unique and do not collide with unrelated planner pins", () => {
  const ids = LANDING_SITES.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);
  const plannerIds = [
    "malapert-massif", "connecting-ridge", "peak-near-shackleton",
    "degerlache-shackleton", "lcross-cabeus", "south-pole", "shackleton-crest",
  ];
  for (const id of ids) {
    assert.match(id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(!plannerIds.includes(id), id);
  }
  assert.equal(site("odysseus").program, "CLPS");
  assert.equal(site("athena").program, "CLPS");
});

test("coordinates and surface-event dates are valid within the reviewed cutoff", () => {
  for (const entry of LANDING_SITES) {
    assert.ok(Number.isFinite(entry.lat) && Math.abs(entry.lat) <= 90, entry.id);
    assert.ok(Number.isFinite(entry.lon) && Math.abs(entry.lon) <= 180, entry.id);
    assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(new Date(`${entry.date}T00:00:00Z`).toISOString().slice(0, 10), entry.date);
    assert.ok(entry.date <= "2026-11-14", entry.id);
    assert.ok(["landed", "partial", "attempt"].includes(entry.outcome), entry.id);
  }
});

test("Apollo coverage is exactly the six crewed landings, with no Apollo 13 landing", () => {
  const apollo = LANDING_SITES.filter((entry) => entry.program === "Apollo");
  assert.deepEqual(apollo.map((entry) => entry.id).sort(), [
    "apollo-11", "apollo-12", "apollo-14", "apollo-15", "apollo-16", "apollo-17",
  ]);
  for (const entry of apollo) {
    assert.equal(entry.outcome, "landed");
    assert.equal(entry.approximate, false);
    assert.equal(entry.coordinateKind, "observed");
    assert.match(entry.frame ?? "", /Mean Earth/);
  }
  assert.ok(!LANDING_SITES.some((entry) => /apollo[ -]?13/i.test(`${entry.id} ${entry.name}`)));
  assert.equal(site("apollo-16").date, "1972-04-20");
});

test("each requested program includes its landed missions and relevant surface attempts", () => {
  const expected: Record<string, string[]> = {
    Surveyor: [1, 2, 3, 4, 5, 6, 7].map((n) => `surveyor-${n}`),
    Luna: [5, 7, 8, 9, 13, 15, 16, 17, 18, 20, 21, 23, 24, 25].map((n) => `luna-${n}`),
    "Chang’e": [3, 4, 5, 6].map((n) => `change-${n}`),
    Chandrayaan: ["chandrayaan-2", "chandrayaan-3"],
    SLIM: ["slim"],
    CLPS: ["athena", "blue-ghost-1", "odysseus"],
    SpaceIL: ["beresheet"],
    "HAKUTO-R": ["hakuto-r-1", "hakuto-r-2"],
  };
  for (const [program, ids] of Object.entries(expected)) {
    assert.deepEqual(
      LANDING_SITES.filter((entry) => entry.program === program).map((entry) => entry.id).sort(),
      [...ids].sort(),
      program,
    );
  }
});

test("every record carries primary source provenance and coordinate caveats", () => {
  const primaryHosts = new Set([
    "nssdc.gsfc.nasa.gov", "science.nasa.gov", "www.nasa.gov",
    "lroc.im-ldi.com", "global.jaxa.jp",
  ]);
  for (const entry of LANDING_SITES) {
    for (const link of [entry.sourceUrl, ...(entry.supportingSourceUrls ?? [])]) {
      const url = new URL(link);
      assert.equal(url.protocol, "https:", entry.id);
      assert.ok(primaryHosts.has(url.hostname), `${entry.id}: ${link}`);
      assert.notEqual(url.pathname, "/", entry.id);
    }
    assert.ok(entry.summary.length > 20, entry.id);
    assert.ok(entry.sourceNotes && entry.sourceNotes.length > 20, entry.id);
    assert.ok(entry.frame, entry.id);
    assert.ok(entry.coordinateKind, entry.id);
    if (entry.approximate) {
      assert.match(`${entry.summary} ${entry.sourceNotes}`, /approximate|unknown|unconfirmed|likely/i, entry.id);
      assert.equal(entry.demHeightM, undefined, entry.id);
    }
    if (entry.coordinateKind !== "observed") assert.equal(entry.approximate, true, entry.id);
  }
});

test("unlocated early landers cannot be mistaken for precise published spacecraft positions", () => {
  for (const id of ["luna-9", "luna-13"]) {
    assert.equal(site(id).coordinateKind, "approximate-region");
    assert.equal(site(id).approximate, true);
    assert.match(site(id).name, /approximate/i);
  }
  assert.match(site("luna-9").sourceNotes ?? "", /10 km/);
  const surveyor4 = site("surveyor-4");
  assert.equal(surveyor4.coordinateKind, "planned-target");
  assert.equal(surveyor4.outcome, "attempt");
  assert.match(surveyor4.summary, /actual.*unknown/i);
  for (const entry of LANDING_SITES.filter((s) => s.coordinateKind === "planned-target")) {
    assert.equal(entry.outcome, "attempt");
    assert.match(entry.name, /planned/i);
  }
  assert.equal(site("luna-25").approximate, true);
  assert.match(site("luna-25").sourceNotes ?? "", /likely/);
});

test("failed attempts and off-nominal touchdowns do not become nominal landings", () => {
  for (const id of [
    "surveyor-2", "surveyor-4", "luna-5", "luna-7", "luna-8", "luna-15",
    "luna-18", "luna-25", "beresheet", "chandrayaan-2", "hakuto-r-1", "hakuto-r-2",
  ]) assert.equal(site(id).outcome, "attempt", id);
  for (const id of ["luna-23", "slim", "odysseus", "athena"]) {
    assert.equal(site(id).outcome, "partial", id);
  }
  assert.match(site("slim").sourceNotes ?? "", /successful pinpoint/);
  assert.equal(site("blue-ghost-1").outcome, "landed");
});

test("pins use lander locations rather than rover, experiment or intended target positions", () => {
  assert.deepEqual([site("apollo-15").lat, site("apollo-15").lon], [26.13239, 3.6333]);
  assert.deepEqual([site("luna-17").lat, site("luna-17").lon], [38.23764, -35.00163]);
  assert.deepEqual([site("luna-21").lat, site("luna-21").lon], [25.9994, 30.4076]);
  assert.deepEqual([site("change-3").lat, site("change-3").lon], [44.1214, -19.5117]);
  assert.deepEqual([site("change-4").lat, site("change-4").lon], [-45.4562, 177.5885]);
  assert.deepEqual([site("change-6").lat, site("change-6").lon], [-41.6385, -153.9852]);
  assert.deepEqual([site("athena").lat, site("athena").lon], [-84.7906, 29.1957]);
  assert.deepEqual([site("blue-ghost-1").lat, site("blue-ghost-1").lon], [18.5623, 61.8103]);
  assert.ok(!LANDING_SITES.some((entry) => /lunokhod|yutu|pragyan|lev-[12]|s-ivb|alsep/i.test(entry.id)));
  assert.equal(site("change-6").date, "2024-06-01");
  assert.equal(site("slim").date, "2024-01-19");
});

test("historical mission metadata does not fabricate terrain horizons or elevations", () => {
  for (const entry of LANDING_SITES) {
    assert.equal(entry.demHeightM, undefined, entry.id);
    assert.ok(!Object.keys(entry).some((key) => /horizon|illumination|sunlit/i.test(key)), entry.id);
  }
});
