import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { ICE_DATA_URL, ICE_SOURCES, loadIceCatalog, parseIceCatalog } from "../../lib/ice";

const raw = readFileSync(new URL("../../public/data/ice/catalog.json", import.meta.url), "utf8");
const catalogue = () => JSON.parse(raw);
const parseOne = (changes: Record<string, unknown>) => {
  const data = catalogue();
  data.features = [{ ...data.features[0], ...changes }];
  return parseIceCatalog(data);
};

test("published M3 PSR totals and named counts agree with independent paper sections 4.1 and 4.6.1", () => {
  const parsed = parseIceCatalog(raw);
  const psrs = parsed.features.filter((feature) => feature.evidence === "ice-bearing-psr");
  assert.equal(parsed.features.length, 170);
  assert.equal(psrs.length, 169);
  assert.equal(psrs.reduce((sum, feature) => sum + (feature.value ?? 0), 0), 820);
  for (const [name, count] of [["Shoemaker", 134], ["Faustini", 34], ["Cabeus 1", 9]] as const) {
    const feature = psrs.find((item) => item.name === name);
    assert.ok(feature, name);
    assert.equal(feature.value, count, name);
    assert.equal(feature.unit, "M3 detections");
  }
  assert.equal(new Set(parsed.features.map((feature) => feature.id)).size, parsed.features.length);
  assert.ok(psrs.every((feature) => feature.geometry.type === "Point" && feature.observationUtc === null));
  assert.ok(parsed.features.every((feature) => feature.evidence !== "surface-ice-detection"));
});

test("LCROSS longitude/latitude and UTC match independent NASA NSSDCA / Marshall coordinates", () => {
  // NASA lists 84.6796 S, 48.7093 W, equivalently 311.2907 east. Do not substitute the SSC impact.
  const impact = parseIceCatalog(raw).features.find((feature) => feature.id === "lcross-centaur-2009");
  assert.ok(impact);
  assert.equal(impact.evidence, "impact-water-detection");
  assert.equal(impact.geometry.type, "Point");
  if (impact.geometry.type !== "Point") throw new Error("Missing LCROSS point");
  const [lon, lat] = impact.geometry.coordinates;
  assert.equal(lat, -84.6796);
  assert.ok(Math.abs((360 + lon) - 311.2907) < 1e-10);
  assert.equal(impact.observationUtc, "2009-10-09T11:31:19.506Z");
  assert.equal(impact.value, null);
  assert.equal(impact.unit, null);
  assert.equal(impact.resolutionM, null);
  assert.match(impact.description, /115 m along latitude, 44 m along longitude/);
});

test("every feature binds to licensed, versioned and hashed source evidence without a proxy relabel", () => {
  for (const feature of parseIceCatalog(raw).features) {
    const source = ICE_SOURCES.find((entry) => entry.id === feature.sourceId);
    assert.ok(source);
    assert.equal(source.evidence, feature.evidence);
    for (const field of [source.frame, source.projection, source.version, source.credit, source.license]) assert.ok(field.length > 5);
    for (const original of source.originals) {
      assert.match(original.sha256, /^[a-f0-9]{64}$/);
      assert.ok(original.bytes > 0);
      assert.equal(new URL(original.url).protocol, "https:");
    }
    assert.ok(source.processingNotes.length >= 3);
  }
  assert.equal(ICE_SOURCES.find((source) => source.id === "lemelin-2021-m3-psrs")?.license, "CC-BY-4.0");
  assert.ok(Object.isFrozen(ICE_SOURCES));
  assert.ok(ICE_SOURCES.every((source) => Object.isFrozen(source) && Object.isFrozen(source.originals)));
});

test("parsing clones inputs, reports source values unchanged, and preserves nulls", () => {
  const data = catalogue();
  const before = JSON.stringify(data);
  const parsed = parseIceCatalog(data);
  assert.equal(JSON.stringify(data), before);
  assert.deepEqual(parsed, data);
  const first = parsed.features[0];
  assert.deepEqual(first.geometry.coordinates, [34.5085694116, -87.0182365584]);
  if (first.geometry.type === "Point") first.geometry.coordinates[0] = 0;
  assert.equal(JSON.stringify(data), before);
});

test("invalid schema, duplicate IDs and missing or mismatched sources fail explicitly", () => {
  for (const input of [null, [], {}, "not json", { schemaVersion: 2, features: [] }]) assert.throws(() => parseIceCatalog(input));
  const duplicate = catalogue();
  duplicate.features.push(duplicate.features[0]);
  assert.throws(() => parseIceCatalog(duplicate), /Duplicate/);
  assert.throws(() => parseOne({ sourceId: "unknown" }), /source/);
  assert.throws(() => parseOne({ sourceId: "lcross-2009-centaur" }), /source/);
  assert.throws(() => parseOne({ evidence: "hydrogen-proxy" }), /evidence/);
  assert.throws(() => parseOne({ evidence: "surface-ice-detection" }), /source/);
});

test("geographic ranges, coordinate order, no-data sentinels and malformed shapes cannot become ice locations", () => {
  for (const coordinates of [[181, -80], [-181, -80], [0, -91], [0, 91], [NaN, -80], [0, Infinity], [34, -87, 0], [34], [34, null], [34, "-87"], [-87, 34]]) {
    assert.throws(() => parseOne({ geometry: { type: "Point", coordinates } }), `${coordinates}`);
  }
  for (const geometry of [null, { type: "MultiPolygon", coordinates: [] }, { type: "Polygon", coordinates: [] },
    { type: "Polygon", coordinates: [[[1, -80], [2, -81], [3, -82]]] },
    { type: "Polygon", coordinates: [[[1, -80], [1, -80], [1, -80], [1, -80]]] },
    { type: "Polygon", coordinates: [[[1, -80], [2, -81], [3, -82], [4, -83]]] }]) {
    assert.throws(() => parseOne({ geometry }));
  }
  // A structurally valid polygon must still fail the source binding: these sources publish markers here.
  assert.throws(() => parseOne({ geometry: { type: "Polygon", coordinates: [[[1, -80], [2, -81], [3, -82], [1, -80]]] } }), /published M3 PSR/);
});

test("M3 missing values, nodata, counts, units, dates and resolution are never coerced or inferred", () => {
  for (const value of [undefined, null, 0, -1, 1.5, 135, 9999, NaN, Infinity, "1"]) assert.throws(() => parseOne({ value }));
  for (const unit of [undefined, null, "", "wt%", "ppm hydrogen"]) assert.throws(() => parseOne({ unit }));
  for (const resolutionM of [undefined, null, 0, -1, NaN, 240, 1]) assert.throws(() => parseOne({ resolutionM }));
  assert.throws(() => parseOne({ observationUtc: "2009-01-01T00:00:00Z" }));
  assert.throws(() => parseOne({ description: "" }));
  assert.throws(() => parseOne({ name: "" }));
});

test("LCROSS unknown quantity/extent cannot be replaced by a concentration or footprint; UTC is strict", () => {
  const impact = catalogue().features.at(-1);
  const parseImpact = (changes: Record<string, unknown>) => parseIceCatalog({ schemaVersion: 1, features: [{ ...impact, ...changes }] });
  for (const changes of [{ resolutionM: 115 }, { value: 5.6, unit: "wt%" }, { value: null, unit: "%" }]) assert.throws(() => parseImpact(changes));
  for (const time of [undefined, "2009-02-30T11:31:19Z", "2009-10-09", "2009-10-09T11:31:19+01:00", "2009-10-09T25:31:19Z"]) {
    assert.throws(() => parseImpact({ observationUtc: time }), `${time}`);
  }
  assert.equal(parseImpact({ observationUtc: null }).features[0].observationUtc, null);
});

test("offline decoded/string inputs require no HTTP; loader forwards abort and propagates HTTP/parse failures", async () => {
  const controller = new AbortController();
  let calls = 0;
  const fetcher: typeof fetch = async (url, options) => {
    calls++;
    assert.equal(url, ICE_DATA_URL);
    assert.equal(options?.signal, controller.signal);
    return new Response(raw, { status: 200 });
  };
  const offline = parseIceCatalog(catalogue());
  assert.equal(calls, 0);
  assert.deepEqual(await loadIceCatalog({ fetcher, signal: controller.signal }), offline);
  assert.equal(calls, 1);
  await assert.rejects(loadIceCatalog({ fetcher: async () => new Response("missing", { status: 404 }) }), /HTTP 404/);
  await assert.rejects(loadIceCatalog({ fetcher: async () => new Response('{"schemaVersion":2,"features":[]}') }), /schema/);
  await assert.rejects(loadIceCatalog({ fetcher: async () => { throw new Error("network unavailable"); } }), /network unavailable/);
  controller.abort();
  await assert.rejects(loadIceCatalog({ signal: controller.signal, fetcher: async (_url, options) => {
    options?.signal?.throwIfAborted();
    throw new Error("Expected aborted signal");
  } }), /abort/i);
});

test("stdlib source parser rejects corrupt DBF and missing/no-data fields", () => {
  const result = spawnSync("python3", ["-B", "-m", "unittest", "discover", "-s", "tests/ice", "-p", "test_pipeline.py", "-v"], {
    cwd: new URL("../../", import.meta.url), encoding: "utf8",
  });
  assert.equal(result.status, 0, `${result.error ?? ""}\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, /Ran 7 tests/);
});
