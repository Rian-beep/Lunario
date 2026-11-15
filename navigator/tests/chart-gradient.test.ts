import { test } from "node:test";
import assert from "node:assert/strict";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { gradientUnits, indexGradient, sampleGradient, type GradientAxis } from "../lib/chart-gradient";
import type { ChartPoint } from "../lib/charts";
import { GradientHelp } from "../components/workbench/gradient-help";
import { AudienceContext } from "../components/workbench/info";
import type { Audience } from "../lib/glossary";
import { readFileSync } from "node:fs";
import { decodeCatalog } from "../lib/catalog";
import { buildSeries, terrainForSite } from "../lib/astro";
import { DEFAULT_FLIGHT, simulateFlight } from "../lib/flight";
import { DEFAULT_MISSION, evaluateMission } from "../lib/mission";
import { ElevationGraph, FlightGraphs, HorizonGraph, ResourceGraphs } from "../components/workbench/science-charts";

function slope(points: readonly ChartPoint[], target = points[0]?.x, axis: GradientAxis = "seconds", stepped = false) {
  return sampleGradient(indexGradient(points), target, axis, stepped);
}
function known(points: readonly ChartPoint[], target = points[0]?.x, axis: GradientAxis = "seconds", stepped = false) {
  const result = slope(points, target, axis, stepped);
  assert.ok(result.available, JSON.stringify(result));
  return result;
}

test("positive, negative and flat finite slopes use actual adjacent coordinates", () => {
  for (const [end, expected] of [[8, 3], [-4, -3], [2, 0]]) {
    const result = known([{ x: 0, y: 2 }, { x: 2, y: end }]);
    assert.equal(result.slope, expected);
    assert.equal(result.distance, 2);
  }
  const result = known([{ x: 0, y: 0 }, { x: 1, y: 2 }, { x: 1.25, y: 3 }], 1.2);
  assert.equal(result.slope, 4);
  assert.equal(result.distance, 0.25);
});

test("UTC milliseconds become hours, Wh/h equals mean storage W, flight km/s and m/s² retain native units", () => {
  const start = Date.UTC(2026, 10, 14);
  const storage = known([{ x: start, y: 100 }, { x: start + 1800000, y: 75 }], start, "time-ms");
  assert.equal(storage.slope, -50);
  assert.equal(storage.deltaY, -25);
  assert.equal(storage.distance, 0.5);
  assert.equal(gradientUnits("time-ms", "Wh").slopeUnit, "Wh/h");
  assert.equal(gradientUnits("time-ms", "W").slopeUnit, "W/h");
  assert.equal(gradientUnits("time-ms", "°").slopeUnit, "°/h");
  assert.equal(known([{ x: 0, y: 1 }, { x: 2, y: 0 }]).slope, -0.5);
  assert.equal(gradientUnits("seconds", "km").slopeUnit, "km/s");
  assert.equal(gradientUnits("seconds", "m/s").slopeUnit, "m/s²");
  assert.equal(known([{ x: 0, y: 4 }, { x: 2, y: 10 }]).slope, 3);
  assert.equal(gradientUnits("azimuth", "°").slopeUnit, "°/°");
});

test("source endpoints use one-sided pairs and never extrapolate", () => {
  const points = [{ x: 0, y: 0 }, { x: 1, y: 2 }, { x: 2, y: 5 }];
  assert.equal(known(points, 0).slope, 2);
  assert.equal(known(points, 1).slope, 3);
  assert.equal(known(points, 2).slope, 3);
  for (const target of [-1, 3, NaN, Infinity]) assert.equal(slope(points, target).available, false);
  assert.equal(slope([]).available, false);
  assert.equal(slope([{ x: 0, y: 0 }]).available, false);
});

test("unknown, infinite, duplicate and missing-x samples cannot be bridged", () => {
  for (const middle of [{ x: 1, y: NaN }, { x: NaN, y: NaN }, { x: 1, y: Infinity }]) {
    const points = [{ x: 0, y: 0 }, middle, { x: 2, y: 4 }];
    assert.equal(slope(points, 0).available, false);
    assert.equal(slope(points, 2).available, false);
  }
  const duplicates = [{ x: 0, y: 1 }, { x: 0, y: 9 }, { x: 2, y: 2 }];
  assert.equal(slope(duplicates, 0).available, false);
  assert.equal(slope(duplicates, 2).available, false);
  assert.equal(slope([{ x: -1e308, y: 0 }, { x: 1e308, y: 1 }], 0).available, false);
  assert.equal(slope([{ x: 0, y: NaN }, { x: 1, y: 3 }], 0).available, false);
});

test("azimuth source order survives indexed lookup, descending tracks, unknowns and seam boundaries", () => {
  const points = Object.freeze([
    Object.freeze({ x: 350, y: 1 }), Object.freeze({ x: 355, y: 2 }),
    Object.freeze({ x: NaN, y: NaN }),
    Object.freeze({ x: 10, y: 4 }), Object.freeze({ x: 5, y: 3 }),
  ]);
  const result = known(points, 5, "azimuth");
  assert.equal(result.slope, 0.2);
  assert.equal(result.deltaX, -5);
  assert.equal(result.distance, 5);
  assert.equal(result.from, points[3]);
  assert.equal(result.to, points[4]);
  assert.equal(slope(points, 355, "azimuth").available, false);
  assert.equal(slope([{ x: 359, y: 1 }, { x: 1, y: 2 }], 359, "azimuth").available, false);
  assert.equal(slope([{ x: 0, y: 0 }, { x: 360, y: 0 }], 0, "azimuth").available, false);
  assert.deepEqual(points.map((p) => p.x), [350, 355, NaN, 10, 5]);
});

test("held intervals report finite intersample changes and mark jump derivatives undefined", () => {
  const points = [{ x: 0, endX: 3600000, y: 10 }, { x: 3600000, endX: 7200000, y: 30 }];
  const inside = known(points, 900000, "time-ms", true);
  assert.equal(inside.slope, 20);
  assert.equal(inside.stepped, true);
  assert.equal(inside.atJump, false);
  assert.equal(known(points, 3600000, "time-ms", true).atJump, true);
  assert.equal(known(points, 7100000, "time-ms", true).atJump, false);
  const flat = known([{ x: 0, endX: 1, y: 3 }, { x: 1, endX: 2, y: 3 }], 1, "seconds", true);
  assert.equal(flat.slope, 0);
  assert.equal(flat.atJump, false);
  for (const endX of [0.5, 1.5, NaN]) {
    assert.equal(slope([{ x: 0, endX, y: 3 }, { x: 1, endX: 2, y: 5 }], 0, "seconds", true).available, false);
  }
  assert.equal(slope([{ x: 0, endX: 1, y: 3 }, { x: 1, endX: 2, y: NaN }], 0, "seconds", true).available, false);
});

test("cursor lookup reads logarithmically many coordinates after building its reusable index", () => {
  let reads = 0;
  const points = Array.from({ length: 100000 }, (_, i) => ({ get x() { reads++; return i; }, y: i * 2 }));
  const index = indexGradient(points);
  reads = 0;
  const result = sampleGradient(index, 55000.25, "seconds");
  assert.ok(result.available);
  assert.equal(result.slope, 2);
  assert.ok(reads < 100, `coordinate reads: ${reads}`);
});

function renderWithReact(element: React.ReactElement) {
  const previousReact = Object.getOwnPropertyDescriptor(globalThis, "React");
  Object.defineProperty(globalThis, "React", { value: React, configurable: true });
  try {
    return renderToStaticMarkup(element);
  } finally {
    if (previousReact) Object.defineProperty(globalThis, "React", previousReact);
    else Reflect.deleteProperty(globalThis, "React");
  }
}

function renderHelp(audience: Audience, overrides: Partial<Parameters<typeof GradientHelp>[0]> = {}) {
  return renderWithReact(createElement(AudienceContext.Provider, { value: audience }, createElement(GradientHelp, {
    lines: [{ name: "Stored energy", points: [{ x: 0, y: 100 }, { x: 3600000, y: 50 }] }],
    target: 0, xLabel: "Time (UTC)", yLabel: "Stored energy (Wh)", yUnit: "Wh", axis: "time-ms", source: "mission model interval boundaries", ...overrides,
  })));
}

test("help is collapsed by default, keyboard-native, sourced and uses native MathML with named axes and units", () => {
  for (const audience of ["public", "teach", "plan"] as const) {
    const html = renderHelp(audience);
    assert.match(html, /<details[^>]*>/);
    assert.doesNotMatch(html, /<details[^>]*\sopen/);
    assert.match(html, /<summary/);
    assert.match(html, /<math xmlns="http:\/\/www.w3.org\/1998\/Math\/MathML"/);
    assert.match(html, /<mfrac>/);
    assert.match(html, /y is Stored energy \(Wh\)/);
    assert.match(html, /x is Time \(UTC\)/);
    assert.match(html, /-50 Wh\/h/);
    assert.match(html, /sample distance: 1 h/);
    assert.match(html, /Wh\/h equals W/);
    assert.match(html, /Source: mission model interval boundaries/);
    assert.match(html, /Previous\/Next sample/);
    assert.match(html, /positive slope.*negative slope.*zero slope/);
    if (audience !== "public") {
      assert.match(html, /instantaneous derivative/);
      assert.match(html, /discrete approximation/);
      assert.match(html, /<munder>/);
    }
  }
});

test("rendered horizon, flight and power help retain their distinct meanings and limits", () => {
  const horizon = renderHelp("teach", { axis: "azimuth", yUnit: "°", lines: [{ name: "LOLA", points: [{ x: 1, y: 2 }, { x: 2, y: 4 }] }], target: 1 });
  assert.match(horizon, /2 °\/°/);
  assert.match(horizon, /not the ground’s physical slope/);
  assert.match(horizon, /<mi>∇<\/mi><mi>z<\/mi>/);
  assert.match(horizon, /<mi>θ<\/mi>/);
  assert.match(horizon, /cannot establish landing safety/);
  const speed = renderHelp("public", { axis: "seconds", yUnit: "m/s" });
  assert.match(speed, /m\/s²/);
  assert.match(speed, /not the full acceleration vector/);
  const power = renderHelp("plan", { lines: [{ name: "Power", stepped: true, points: [{ x: 0, endX: 1, y: 2 }, { x: 1, endX: 2, y: 3 }] }], axis: "seconds", yUnit: "W", target: 1 });
  assert.match(power, /Finite intersample change/);
  assert.match(power, /Cursor is at a jump: derivative undefined/);
  assert.match(power, /slope is zero inside a known held interval/);
});

test("every shared Plot includes collapsed gradient help through the actual chart panels in every audience", () => {
  const catalog = decodeCatalog(JSON.parse(readFileSync(new URL("../public/data/catalog.json", import.meta.url), "utf8")));
  const site = catalog.sites[0], terrain = terrainForSite(site, 2);
  const series = buildSeries(catalog, site.lat, site.lon, terrain, 0, 2);
  const result = evaluateMission(series, catalog.meta.stepHours, DEFAULT_MISSION);
  const flight = simulateFlight({ ...DEFAULT_FLIGHT, durationSeconds: 2 });
  for (const audience of ["public", "teach", "plan"] as const) {
    const html = renderWithReact(createElement(AudienceContext.Provider, { value: audience },
      createElement(React.Fragment, null,
        createElement(HorizonGraph, { series, terrain, cursor: 0 }),
        createElement(ElevationGraph, { catalog, series, cursor: 0, onCursor: () => {} }),
        createElement(FlightGraphs, { flight, cursor: 0, onCursor: () => {} }),
        createElement(ResourceGraphs, { catalog, series, result, reserveWh: 200 }),
      ),
    ));
    assert.equal((html.match(/class="chart-gradient-help"/g) ?? []).length, 6);
    assert.equal((html.match(/How fast does this graph change/g) ?? []).length, 6);
    assert.equal((html.match(/<details[^>]*\sopen/g) ?? []).length, 0);
    assert.equal((html.match(/<mfrac>/g) ?? []).length >= 6, true);
    assert.match(html, /km\/s/);
    assert.match(html, /m\/s²/);
    assert.match(html, /Wh\/h/);
    assert.match(html, /°\/°/);
    assert.match(html, /Source: native LOLA/);
  }
});
