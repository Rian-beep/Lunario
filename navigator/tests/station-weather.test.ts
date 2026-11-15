import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StationWeather, StationWeatherReport } from "../components/workbench/station-weather";
import { DSN_STATIONS, parseDsnWeather, type DsnStation, type DsnWeather } from "../lib/dsn";
import { createStationWeatherRequest, stationWeatherIdentity } from "../lib/station-weather-context";

const HOUR = 3_600_000;
const NOW = Date.parse("2026-11-14T12:15:00Z");
const START = Date.parse("2026-11-14T12:00:00Z");
const station = DSN_STATIONS[0];
const source = "https://api.open-meteo.com/v1/forecast";

function fixture(count = 24) {
  return {
    utc_offset_seconds: 0,
    hourly_units: { temperature_2m: "°C", wind_speed_10m: "km/h", precipitation: "mm", cloud_cover: "%" },
    hourly: {
      time: Array.from({ length: count }, (_, i) => (START + i * HOUR) / 1000),
      temperature_2m: Array.from({ length: count }, (_, i) => 20 + i),
      wind_speed_10m: Array.from({ length: count }, (_, i) => 8 + i),
      precipitation: Array.from({ length: count }, (_, i) => i / 10),
      cloud_cover: Array.from({ length: count }, (_, i) => i),
    },
  };
}
function forecast(target = station, count = 24) {
  return parseDsnWeather(fixture(count), target, "2026-11-14T12:05:00Z", source);
}
function render(element: React.ReactElement) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "React");
  Object.defineProperty(globalThis, "React", { value: React, configurable: true });
  try { return renderToStaticMarkup(element); }
  finally {
    if (previous) Object.defineProperty(globalThis, "React", previous);
    else Reflect.deleteProperty(globalThis, "React");
  }
}
function report(epochMs: number | undefined, data: DsnWeather | null = forecast(), nowMs = NOW, target = station) {
  return render(React.createElement(StationWeatherReport, { station: target, epochMs, forecast: data, nowMs }));
}
function selectedSection(html: string) {
  return html.match(/<section aria-label="Selected mission weather">([\s\S]*?)<\/section>/)![1];
}
function deferred() {
  let resolve!: (value: DsnWeather) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<DsnWeather>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
function replaceGlobal(key: string, replacement: unknown) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, { value: replacement, configurable: true });
  return () => {
    if (previous) Object.defineProperty(globalThis, key, previous);
    else Reflect.deleteProperty(globalThis, key);
  };
}

test("SSR selects a returned future mission hour, with explicit units and hourly sampling", () => {
  const html = report(START + 5.5 * HOUR);
  const selected = selectedSection(html);
  assert.match(selected, /2026-11-14 17:30:00 UTC/);
  for (const text of ["25 °C", "13 km/h", "0.5 mm", "5 %", "Temperature at 2 m", "Wind speed at 10 m", "preceding hour", "not measured at the exact selected instant"]) assert.ok(selected.includes(text), text);
  assert.match(html, /Current dated forecast/);
  assert.match(html, /20 °C/);
  assert.match(html, /Separate from the selected mission time/);
  assert.match(html, /24 of 24 hourly rows returned/);
});

test("SSR never substitutes current weather outside mission coverage or at the exclusive end", () => {
  for (const epoch of [START - 1, START + 24 * HOUR, Date.parse("2027-10-25T00:00:00Z"), NaN, Infinity, undefined]) {
    const html = report(epoch);
    assert.match(selectedSection(html), /Mission-time weather unavailable/);
    assert.doesNotMatch(selectedSection(html), /20 °C|station-weather-values/);
    assert.match(html, /Current dated forecast/);
    assert.match(html, /20 °C/);
  }
  assert.match(selectedSection(report(START + HOUR)), /21 °C/);
});

test("SSR shows actual fetch timestamp, age, coverage and expiry; retained past forecasts stay dated", () => {
  const html = report(NOW);
  for (const text of ["2026-11-14 12:05:00 UTC", "Fetch age: 10 min", "2026-11-15 12:00:00 UTC", "end excluded", "not a station observation", "updates when this card renders"]) assert.ok(html.includes(text), text);
  const expired = report(NOW, forecast(), START + 24 * HOUR);
  assert.match(expired, /Coverage expired/);
  assert.match(expired, /not verified historical weather/);
  assert.match(expired, /Current-hour weather unavailable/);
  assert.match(expired, /0 of 24 hourly rows returned/);
  assert.match(selectedSection(expired), /20 °C/);
  const before = report(NOW, forecast(), START - HOUR);
  assert.match(before, /Coverage has not started/);
  assert.match(before, /ahead of this device clock/);
  assert.match(before, /23 of 24 hourly rows returned/);
});

test("SSR missing measurements stay unavailable and partial 24-hour coverage is explicit", () => {
  const input = fixture(2);
  const withNulls = { ...input, hourly: { ...input.hourly, temperature_2m: [null, 4], precipitation: [null, 0] } };
  const data = parseDsnWeather(withNulls, station, "2026-11-14T12:05:00Z", source);
  const html = report(NOW, data);
  assert.match(selectedSection(html), /<dd>Unavailable<\/dd>/);
  assert.doesNotMatch(selectedSection(html), /null|undefined|NaN/);
  assert.match(html, /2 of 24 hourly rows returned/);
  assert.match(html, /Missing hours are unavailable/);
  assert.match(html, /8 km\/h/);
});

test("station identity includes pin coordinates and SSR refuses another station's forecast", () => {
  assert.notEqual(stationWeatherIdentity(station), stationWeatherIdentity(DSN_STATIONS[1]));
  assert.notEqual(stationWeatherIdentity(station), stationWeatherIdentity({ ...station, latitudeDeg: station.latitudeDeg + 1 }));
  assert.notEqual(stationWeatherIdentity(station), stationWeatherIdentity({ ...station, antenna: "changed" }));
  const first = StationWeather({ station, epochMs: NOW });
  assert.equal(first.key, stationWeatherIdentity(station));
  assert.notEqual(first.key, StationWeather({ station: DSN_STATIONS[1], epochMs: NOW }).key);
  assert.equal(first.key, StationWeather({ station: { ...station }, epochMs: NOW + HOUR }).key);
  const html = report(NOW, forecast(), NOW, DSN_STATIONS[1]);
  assert.match(html, /No dated station forecast is loaded/);
  assert.doesNotMatch(html, /20 °C|Current dated forecast|Fetched:/);
});

test("public SSR is offline-safe, collapsed, sourced and makes no request on render", () => {
  const restore = replaceGlobal("fetch", () => { throw Error("SSR must not fetch"); });
  try {
    for (const offline of [false, true]) {
      const html = render(React.createElement(StationWeather, { station, epochMs: NOW, offline }));
      assert.match(html, /Weather at Goldstone/);
      assert.match(html, /Mission-time weather unavailable/);
      assert.match(html, /<details><summary>What this weather means/);
      assert.doesNotMatch(html, /<details[^>]* open/);
      assert.match(html, /105\/105E.pdf/);
      assert.match(html, /Cloud percentage alone gives no link margin, contact availability or antenna booking/);
      assert.match(html, /Open-Meteo forecast source, units and sampling/);
      if (offline) {
        assert.match(html, /<button[^>]*disabled=""/);
        assert.match(html, /Offline: fetching is disabled/);
      } else assert.match(html, /Nothing is fetched automatically/);
    }
  } finally { restore(); }
});

test("a request session is inert until clicked; unknown navigator connectivity permits the bounded provider fetch", async () => {
  const restoreNavigator = replaceGlobal("navigator", {onLine: undefined});
  const calls: Array<{ url: URL; signal: AbortSignal | null | undefined }> = [];
  const restore = replaceGlobal("fetch", async (url: URL, options: RequestInit) => {
    calls.push({ url, signal: options.signal });
    return new Response(JSON.stringify(fixture()));
  });
  try {
    const session = createStationWeatherRequest(station);
    let updates = 0;
    const unsubscribe = session.subscribe(() => { updates++; });
    assert.equal(session.getSnapshot().status, "idle");
    assert.equal(calls.length, 0);
    const promise = session.load();
    assert.equal(session.getSnapshot().status, "loading");
    await promise;
    assert.equal(session.getSnapshot().status, "ready");
    assert.equal(session.getSnapshot().forecast?.hours.length, 24);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url.origin, "https://api.open-meteo.com");
    assert.equal(calls[0].url.searchParams.get("latitude"), String(station.latitudeDeg));
    assert.equal(calls[0].url.searchParams.get("timeformat"), "unixtime");
    assert.equal(calls[0].signal?.aborted, false);
    assert.equal(updates, 2);
    unsubscribe();
    session.cancel();
    assert.equal(session.getSnapshot().status, "ready");
  } finally { restore(); restoreNavigator(); }
});

test("cancel aborts caller signal and late success cannot replace cancelled state", async () => {
  const pending = deferred();
  let signal!: AbortSignal;
  const session = createStationWeatherRequest(station, async (_target, suppliedSignal) => {
    signal = suppliedSignal;
    return pending.promise;
  });
  const promise = session.load();
  session.cancel();
  assert.equal(signal.aborted, true);
  assert.equal(session.getSnapshot().status, "cancelled");
  pending.resolve(forecast());
  await promise;
  assert.equal(session.getSnapshot().forecast, null);
  assert.equal(session.getSnapshot().status, "cancelled");
});

test("generation guard prevents old success/failure overwriting a newer request", async () => {
  for (const oldFailure of [false, true]) {
    const first = deferred(), second = deferred();
    const signals: AbortSignal[] = [];
    const session = createStationWeatherRequest(station, async (_target, signal) => {
      signals.push(signal);
      return signals.length === 1 ? first.promise : second.promise;
    });
    const old = session.load(), fresh = session.load();
    assert.equal(signals[0].aborted, true);
    const expected = forecast();
    second.resolve(expected);
    await fresh;
    if (oldFailure) first.reject(Error("late provider failure"));
    else first.resolve({ ...expected, fetchedUtc: "2026-11-14T11:00:00Z" });
    await old;
    assert.equal(session.getSnapshot().forecast, expected);
    assert.equal(session.getSnapshot().status, "ready");
  }
});

test("station teardown aborts silently and independent pin sessions never exchange forecasts", async () => {
  const pending = deferred();
  let signal!: AbortSignal;
  const first = createStationWeatherRequest(station, async (_target, suppliedSignal) => { signal = suppliedSignal; return pending.promise; });
  const promise = first.load();
  let notifications = 0;
  first.subscribe(() => { notifications++; });
  first.cancel(false);
  assert.equal(signal.aborted, true);
  const second = createStationWeatherRequest(DSN_STATIONS[1], async target => forecast(target));
  assert.equal(second.getSnapshot().forecast, null);
  await second.load();
  pending.resolve(forecast());
  await promise;
  assert.equal(notifications, 0);
  assert.equal(first.getSnapshot().forecast, null);
  assert.equal(second.getSnapshot().forecast?.stationId, "madrid");
  // A Strict Mode effect replay may cancel an idle session; later clicks still work.
  second.cancel(false);
  await second.load();
  assert.equal(second.getSnapshot().status, "ready");
});

test("offline prop, file protocol and navigator offline all prevent HTTP even before effects", async () => {
  let calls = 0;
  const fetcher = async (target: DsnStation) => { calls++; return forecast(target); };
  const session = createStationWeatherRequest(station, fetcher);
  await session.load(true);
  assert.equal(session.getSnapshot().status, "offline");
  for (const [key, replacement] of [["location", { protocol: "file:" }], ["navigator", { onLine: false }]] as const) {
    const restore = replaceGlobal(key, replacement);
    try {
      await session.load();
      assert.equal(session.getSnapshot().status, "offline");
    } finally { restore(); }
  }
  assert.equal(calls, 0);
  await session.load();
  assert.equal(calls, 1);
  assert.equal(session.getSnapshot().status, "ready");
});

test("offline transition cancels an in-flight request and can recover explicitly", async () => {
  const pending = deferred();
  const session = createStationWeatherRequest(station, async () => pending.promise);
  const old = session.load();
  await session.load(true);
  pending.resolve(forecast());
  await old;
  assert.equal(session.getSnapshot().status, "offline");
  assert.equal(session.getSnapshot().forecast, null);
  await session.load();
  assert.equal(session.getSnapshot().status, "ready");
});

test("provider failure and cancelled refresh retain earlier dated data; wrong-station results are rejected", async () => {
  let fail = false;
  const expected = forecast();
  const session = createStationWeatherRequest(station, async () => {
    if (fail) throw Error("provider failed");
    return expected;
  });
  await session.load();
  fail = true;
  await session.load();
  assert.equal(session.getSnapshot().status, "error");
  assert.equal(session.getSnapshot().forecast, expected);
  const cancelled = session.load();
  session.cancel();
  await cancelled;
  assert.equal(session.getSnapshot().status, "cancelled");
  assert.equal(session.getSnapshot().forecast, expected);
  const wrong = createStationWeatherRequest(station, async () => forecast(DSN_STATIONS[2]));
  await wrong.load();
  assert.equal(wrong.getSnapshot().status, "error");
  assert.equal(wrong.getSnapshot().forecast, null);
});

test("the reused provider path rejects oversized, malformed and HTTP failure fixtures", async () => {
  for (const response of [new Response("x".repeat(200001)), new Response("not-json"), new Response("failure", { status: 503 }), new Response(JSON.stringify({ ...fixture(), utc_offset_seconds: 3600 }))]) {
    const restore = replaceGlobal("fetch", async () => response);
    try {
      const session = createStationWeatherRequest(station);
      await session.load();
      assert.equal(session.getSnapshot().status, "error");
      assert.equal(session.getSnapshot().forecast, null);
    } finally { restore(); }
  }
});
