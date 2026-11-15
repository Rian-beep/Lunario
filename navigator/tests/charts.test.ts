import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chartLabels,
  formatChartValue,
  linePath,
  moveSample,
  nearestSample,
  numericDomain,
  resourcePoints,
} from "../lib/charts";
import { DEFAULT_MISSION, evaluateMission } from "../lib/mission";
import { buildSeries, terrainForSite, type SampleSeries } from "../lib/astro";
import { readFileSync } from "node:fs";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { decodeCatalog } from "../lib/catalog";
import { simulateFlight, DEFAULT_FLIGHT } from "../lib/flight";
import { AudienceContext } from "../components/workbench/info";
import {
  HorizonGraph,
  ElevationGraph,
  FlightGraphs,
  ResourceGraphs,
} from "../components/workbench/science-charts";

test("all five chart families name axes, units and clock/frame for every audience", () => {
  for (const audience of ["public", "teach", "plan"] as const) {
    for (const kind of [
      "horizon",
      "elevation",
      "flight",
      "power",
      "battery",
    ] as const) {
      const labels = chartLabels(kind, audience);
      assert.match(
        labels.x,
        kind === "horizon"
          ? /° clockwise from north/
          : kind === "flight"
            ? /s since preview start/
            : /UTC/,
      );
      assert.match(
        labels.y,
        kind === "flight"
          ? /reference sphere \(km\)/
          : kind === "power"
            ? /\(W\)/
            : kind === "battery"
              ? /\(Wh\)/
              : /local horizontal \(°\)/,
      );
      if (kind === "horizon" || kind === "elevation")
        assert.match(labels.note, /0°.*local horizontal|local horizontal.*0°/);
      if (kind === "flight") assert.match(labels.note, /not.*terrain/);
    }
  }
});

test("planner notes state model limits and distinguish centre tracks from visibility", () => {
  assert.match(chartLabels("horizon", "plan").note, /airless/i);
  assert.match(chartLabels("horizon", "plan").note, /hourly centre/);
  assert.match(chartLabels("elevation", "plan").note, /one sample/);
  assert.match(
    chartLabels("power", "plan").note,
    /fixed flux.*centre-direction incidence/,
  );
  assert.match(chartLabels("battery", "plan").note, /END.*interval/);
  assert.match(chartLabels("flight", "plan").note, /rotation neglected/);
});

test("constant and wholly missing values produce finite, nonzero domains", () => {
  assert.deepEqual(numericDomain([NaN, Infinity, -Infinity]), [-1, 1]);
  for (const value of [0, 2, -100]) {
    const [a, b] = numericDomain([value, value, NaN]);
    assert.ok(
      Number.isFinite(a) && a < value && Number.isFinite(b) && b > value,
    );
  }
});

test("missing ordinate or abscissa breaks paths instead of crossing unknown data", () => {
  const points = [
    { x: 0, y: 1 },
    { x: 1, y: NaN },
    { x: 2, y: 3 },
    { x: NaN, y: 4 },
    { x: 3, y: 5 },
  ];
  assert.equal(
    linePath(
      points,
      (x) => x,
      (y) => y,
    ),
    "M0,1M2,3M3,5",
  );
});

test("readout keeps an unknown nearest sample and its real coordinate", () => {
  const points = [
    { x: 0, y: 2 },
    { x: 1, y: NaN },
    { x: 3, y: 7 },
  ];
  const p = nearestSample(points, 1.2);
  assert.equal(p?.x, 1);
  assert.ok(Number.isNaN(p?.y));
  assert.equal(formatChartValue(p!.y, "W"), "Unknown");
  assert.equal(nearestSample([], 1), null);
  assert.equal(nearestSample(points, NaN), null);
  assert.equal(nearestSample(points, 2.9)?.x, 3);
});

test("keyboard traversal follows irregular real samples, including final contact time", () => {
  const samples = [0, 1, 2, 2.13];
  assert.equal(moveSample(samples, 2, "ArrowRight"), 2.13);
  assert.equal(moveSample(samples, 1.5, "ArrowRight"), 2);
  assert.equal(moveSample(samples, 1.5, "ArrowLeft"), 1);
  assert.equal(moveSample(samples, 2.13, "ArrowLeft"), 2);
  assert.equal(moveSample(samples, 2.13, "ArrowRight"), 2.13);
  assert.equal(moveSample(samples, 0, "ArrowLeft"), 0);
  assert.equal(moveSample(samples, 0, "ArrowRight", 10), 2.13);
  assert.equal(moveSample(samples, 2.13, "Home"), 0);
  assert.equal(moveSample(samples, 0, "End"), 2.13);
  assert.equal(moveSample([], 12, "End"), 12);
});

test("display rounds without manufacturing trailing precision and always includes units", () => {
  assert.equal(formatChartValue(2, "km", 3), "2 km");
  assert.equal(formatChartValue(0.0014, "km", 3), "0.001 km");
  assert.equal(formatChartValue(-12.345, "m/s", 2), "-12.35 m/s");
  assert.equal(formatChartValue(Infinity, "Wh"), "Unknown");
});

function series(): SampleSeries {
  const a = (v: number) => new Float64Array(3).fill(v);
  return {
    index0: 0,
    sunAz: a(0),
    sunEl: a(-20),
    earthAz: a(0),
    earthEl: a(10),
    sunHorizon: a(0),
    earthHorizon: a(0),
    sunRadius: a(0.27),
    earthRadius: a(1),
  };
}

test("real battery state is plotted after its integration interval, never as initial charge", () => {
  const start = Date.UTC(2026, 10, 14),
    hour = 3600000;
  const result = evaluateMission(series(), 1, {
    ...DEFAULT_MISSION,
    batteryWh: 100,
    initialSoc: 1,
    loadW: 25,
    dischargeEfficiency: 1,
  });
  const battery = resourcePoints(result.timeline, "batteryWh", start, hour);
  assert.deepEqual(
    battery.map((p) => [p.x, p.y]),
    [
      [start + hour, 75],
      [start + 2 * hour, 50],
      [start + 3 * hour, 25],
    ],
  );
  const power = resourcePoints(result.timeline, "powerW", start, hour);
  assert.equal(power[0].x, start);
  assert.equal(power[0].endX, start + hour);
  assert.equal(power.at(-1)?.endX, start + 3 * hour);
});

test("interval readouts use the containing power sample and do not join unknowns", () => {
  const timeline = [
    { powerW: 10, batteryWh: 20 },
    { powerW: null, batteryWh: null },
    { powerW: 30, batteryWh: null },
  ];
  const points = resourcePoints(timeline, "powerW", 0, 10);
  assert.equal(nearestSample(points, 9)?.y, 10);
  assert.ok(Number.isNaN(nearestSample(points, 19)?.y));
  assert.equal(
    linePath(
      points,
      (x) => x,
      (y) => y,
      true,
    ),
    "M0,10H10M20,30H30",
  );
});

test("unknown generation cannot produce a later recovered battery curve", () => {
  const s = series();
  s.sunHorizon[1] = NaN;
  const result = evaluateMission(s, 1, DEFAULT_MISSION);
  const battery = resourcePoints(result.timeline, "batteryWh", 0, 1);
  assert.ok(Number.isFinite(battery[0].y));
  assert.ok(Number.isNaN(battery[1].y) && Number.isNaN(battery[2].y));
  assert.equal(result.minBatteryWh, null);
});

test("rendered chart exports retain visible axes, adjacent help and keyboard/text equivalents in every mode", () => {
  // tsx uses classic JSX for the Next.js `jsx: preserve` source in this Node test.
  const previousReact = Object.getOwnPropertyDescriptor(globalThis, "React");
  Object.defineProperty(globalThis, "React", {
    value: React,
    configurable: true,
  });
  try {
    const catalog = decodeCatalog(
      JSON.parse(
        readFileSync(
          new URL("../public/data/catalog.json", import.meta.url),
          "utf8",
        ),
      ),
    );
    const site = catalog.sites[0],
      terrain = terrainForSite(site, 2);
    const samples = buildSeries(catalog, site.lat, site.lon, terrain, 0, 2);
    const flight = simulateFlight({ ...DEFAULT_FLIGHT, durationSeconds: 2 });
    const result = evaluateMission(
      samples,
      catalog.meta.stepHours,
      DEFAULT_MISSION,
    );
    const sphereResult = evaluateMission(
      samples,
      catalog.meta.stepHours,
      DEFAULT_MISSION,
      true,
    );
    for (const audience of ["public", "teach", "plan"] as const) {
      const charts = [
        [
          createElement(HorizonGraph, { series: samples, terrain, cursor: 0 }),
          [chartLabels("horizon", audience)],
        ],
        [
          createElement(ElevationGraph, {
            catalog,
            series: samples,
            cursor: 0,
            onCursor: () => {},
          }),
          [chartLabels("elevation", audience)],
        ],
        [
          createElement(FlightGraphs, {
            flight,
            cursor: 0,
            onCursor: () => {},
          }),
          [
            chartLabels("flight", audience),
            { x: chartLabels("flight", audience).x, y: "Speed (m/s)" },
          ],
        ],
        [
          createElement(ResourceGraphs, {
            catalog,
            series: samples,
            result,
            sphereResult,
            reserveWh: 2000,
          }),
          [chartLabels("power", audience), chartLabels("battery", audience)],
        ],
      ] as const;
      for (const [chart, axes] of charts) {
        const html = renderToStaticMarkup(
          createElement(AudienceContext.Provider, { value: audience }, chart),
        );
        for (const { x, y } of axes) {
          assert.ok(
            html.includes(`Horizontal axis: ${x}`),
            `${audience}: ${x} must be visible`,
          );
          assert.ok(
            html.includes(`Vertical axis: ${y}`),
            `${audience}: ${y} must be visible`,
          );
          assert.ok(
            html.includes(`About ${x}`) && html.includes(`About ${y}`),
            "axis help buttons remain adjacent",
          );
        }
        assert.match(html, /tabindex="0"/);
        assert.match(html, /Previous sample/);
        assert.match(html, /Next sample/);
        assert.match(html, /Sample values/);
        assert.match(html, /Home\/End/);
      }
    }
  } finally {
    if (previousReact)
      Object.defineProperty(globalThis, "React", previousReact);
    else Reflect.deleteProperty(globalThis, "React");
  }
});

test('resource plots preserve operation split boundaries and the initial storage state',()=>{
 const segments=[{startOffsetHours:0,endOffsetHours:.5,startBatteryWh:100,powerW:0,batteryWh:50},{startOffsetHours:.5,endOffsetHours:1,startBatteryWh:50,powerW:200,batteryWh:100}];
 assert.deepEqual(resourcePoints(segments,'batteryWh',0,3600000,true),[{x:0,y:100},{x:1800000,y:50},{x:3600000,y:100}]);
 assert.deepEqual(resourcePoints(segments,'powerW',0,3600000),[{x:0,y:0,endX:1800000},{x:1800000,y:200,endX:3600000}]);
});
