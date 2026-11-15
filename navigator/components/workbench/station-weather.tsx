"use client";

import React, { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "../ui/button";
import { DSN_SOURCES, dsnWeatherAt, type DsnStation, type DsnWeather } from "../../lib/dsn";
import {
  createStationWeatherRequest,
  stationWeatherIdentity,
  stationWeatherOffline,
} from "../../lib/station-weather-context";

const HOUR_MS = 3_600_000;
const utc = (epochMs: number) => Number.isFinite(epochMs) && Math.abs(epochMs) <= 8.64e15
  ? new Date(epochMs).toISOString().replace("T", " ").replace(".000Z", " UTC").replace("Z", " UTC")
  : "Unknown UTC time";
const value = (n: number | null, unit: string) => n === null ? "Unavailable" : `${n} ${unit}`;
type WeatherHour = DsnWeather["hours"][number];

function WeatherValues({ hour }: { hour: WeatherHour }) {
  return <>
    <dl className="station-weather-values">
      <div><dt>Temperature at 2 m</dt><dd>{value(hour.temperatureC, "°C")}</dd></div>
      <div><dt>Wind speed at 10 m</dt><dd>{value(hour.windKmh, "km/h")}</dd></div>
      <div><dt>Precipitation, preceding hour</dt><dd>{value(hour.precipitationMm, "mm")}</dd></div>
      <div><dt>Cloud cover</dt><dd>{value(hour.cloudPercent, "%")}</dd></div>
    </dl>
    <p>Forecast sample: <time>{utc(hour.epochMs)}</time>. Hourly values are held within this hour, not measured at the exact selected instant. Precipitation totals the hour ending at this sample time.</p>
  </>;
}

/** Pure report also allows synthetic dated forecasts to be checked without a network request. */
export function StationWeatherReport({ station, epochMs, forecast, nowMs }: {
  station: DsnStation;
  epochMs: number | undefined;
  forecast: DsnWeather | null;
  nowMs: number;
}) {
  const data = forecast?.stationId === station.id ? forecast : null;
  const selected = epochMs === undefined ? null : dsnWeatherAt(data, epochMs);
  const current = dsnWeatherAt(data, nowMs);
  const start = data?.hours[0]?.epochMs;
  const end = data?.hours.at(-1)?.epochMs;
  const coverageEnd = end === undefined ? undefined : end + HOUR_MS;
  const ageMs = data ? nowMs - Date.parse(data.fetchedUtc) : null;
  const currentHour = Math.floor(nowMs / HOUR_MS) * HOUR_MS;
  const nextDay = data?.hours.filter(hour => hour.epochMs >= currentHour && hour.epochMs < currentHour + 24 * HOUR_MS) ?? [];

  return <>
    <section aria-label="Selected mission weather">
      <h4>Selected mission time</h4>
      <p>{epochMs === undefined ? "Mission time unavailable." : <time>{utc(epochMs)}</time>}</p>
      {selected ? <WeatherValues hour={selected} /> : <p>Mission-time weather unavailable. {data ? "No returned forecast hour covers this instant." : "No dated station forecast is loaded."}</p>}
    </section>
    {data && <>
      <div className="station-weather-provenance">
        <p>{data.provider}. Model forecast, not a station observation.</p>
        <p>Fetched: <time>{utc(Date.parse(data.fetchedUtc))}</time>.</p>
        <p>Returned UTC coverage: {start === undefined ? "unavailable" : utc(start)} to {coverageEnd === undefined ? "unavailable" : utc(coverageEnd)} (end excluded).</p>
        <p>Fetch age: {ageMs === null || !Number.isFinite(ageMs) ? "unknown" : ageMs < 0 ? "fetch timestamp is ahead of this device clock" : `${Math.floor(ageMs / 60_000)} min`}. Checked at {utc(nowMs)}; updates when this card renders.</p>
        <p>{coverageEnd === undefined ? "Coverage unavailable." : nowMs >= coverageEnd
          ? "Coverage expired relative to the device clock. Retained values are an older forecast, not verified historical weather. Fetch again for a new dated forecast."
          : start !== undefined && nowMs < start ? "Coverage has not started relative to the device clock." : "Returned coverage includes the current UTC hour. Fetch age does not establish model issue time or accuracy."}</p>
      </div>
      <section aria-label="Current dated forecast, separate from mission">
        <h4>Current dated forecast</h4>
        <p>Separate from the selected mission time. Today’s forecast cannot predict a distant future mission.</p>
        {current ? <WeatherValues hour={current} /> : <p>Current-hour weather unavailable in this returned forecast.</p>}
        <details>
          <summary>24-hour forecast from the current UTC hour</summary>
          <p>{nextDay.length} of 24 hourly rows returned for {utc(currentHour)} to {utc(currentHour + 24 * HOUR_MS)} (end excluded). Missing hours are unavailable.</p>
          {nextDay.length > 0 && <div className="station-weather-table" role="region" aria-label="24-hour station forecast table" tabIndex={0}>
            <table>
              <caption>Open-Meteo hourly model values; UTC sample times. Precipitation is the preceding hour total.</caption>
              <thead><tr><th scope="col">UTC sample</th><th scope="col">Temperature (°C)</th><th scope="col">Wind (km/h)</th><th scope="col">Precipitation (mm)</th><th scope="col">Cloud (%)</th></tr></thead>
              <tbody>{nextDay.map(hour => <tr key={hour.epochMs}>
                <th scope="row">{utc(hour.epochMs)}</th>
                <td>{value(hour.temperatureC, "°C")}</td><td>{value(hour.windKmh, "km/h")}</td>
                <td>{value(hour.precipitationMm, "mm")}</td><td>{value(hour.cloudPercent, "%")}</td>
              </tr>)}</tbody>
            </table>
          </div>}
        </details>
      </section>
    </>}
  </>;
}

export function StationWeather({ station, epochMs, offline = false }: {
  station: DsnStation; epochMs: number | undefined; offline?: boolean;
}) {
  // Remount before rendering a different pin, rather than clearing its forecast in an effect.
  return <StationWeatherSession key={stationWeatherIdentity(station)} station={station} epochMs={epochMs} offline={offline} />;
}

function StationWeatherSession({ station, epochMs, offline }: {
  station: DsnStation; epochMs: number | undefined; offline: boolean;
}) {
  const [request] = useState(() => createStationWeatherRequest(station));
  const state = useSyncExternalStore(request.subscribe, request.getSnapshot, request.getServerSnapshot);
  const [environmentOffline, setEnvironmentOffline] = useState(false);
  const blocked = offline || environmentOffline;

  useEffect(() => {
    const update = () => {
      const unavailable = stationWeatherOffline(offline);
      setEnvironmentOffline(unavailable);
      if (unavailable) request.cancel();
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [offline, request]);
  useEffect(() => () => request.cancel(false), [request]);

  const message = blocked ? "Offline: fetching is disabled. No weather request is sent."
    : state.status === "offline" ? "The last request was blocked while offline. Click fetch to try again."
    : state.status === "loading" ? `Fetching a dated forecast for ${station.name}…`
    : state.status === "cancelled" ? "Weather request cancelled. Earlier fetched values, if shown, are retained."
    : state.status === "error" ? "Station forecast unavailable. Check the connection and try again. Earlier fetched values, if shown, are retained."
    : state.status === "ready" ? "Dated forecast loaded. Check its UTC coverage and fetch age below."
    : "Fetch a dated model forecast to check the selected mission time. Nothing is fetched automatically.";

  return <section className="station-weather" aria-label={`Weather at ${station.name}`}>
    <style>{`
      .station-weather{font-size:14px;line-height:1.5;color:var(--foreground,#302f2c);overflow-wrap:anywhere}
      .station-weather h3,.station-weather h4{font-size:14px;font-weight:650;margin:12px 0 4px}
      .station-weather p{font-size:14px;margin:6px 0}
      .station-weather section+section,.station-weather-provenance{border-top:1px solid var(--border,#dcd7cb);margin-top:12px;padding-top:8px}
      .station-weather-values{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr));gap:8px;margin:8px 0}
      .station-weather-values div{padding:8px;background:var(--muted,#efebe2);border-radius:6px}
      .station-weather dt{font-size:13px}.station-weather dd{font-size:16px;font-weight:600;margin:2px 0 0;font-variant-numeric:tabular-nums}
      .station-weather-actions{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
      .station-weather summary{cursor:pointer;font-size:14px;font-weight:600;padding:8px 0}
      .station-weather :is(summary,a,[tabindex]):focus-visible{outline:2px solid var(--ring,#75694d);outline-offset:3px}
      .station-weather a{text-decoration:underline;text-underline-offset:3px}
      .station-weather-table{max-width:100%;overflow:auto;max-height:360px}
      .station-weather table{border-collapse:collapse;font-size:14px;width:100%}
      .station-weather caption{font-size:13px;text-align:left;padding-bottom:8px}
      .station-weather th,.station-weather td{font-size:14px;text-align:left;padding:8px;border-bottom:1px solid var(--border,#dcd7cb);white-space:nowrap}
    `}</style>
    <h3>Weather at {station.name}</h3>
    <p>{station.antenna} · {station.country}</p>
    <div className="station-weather-actions">
      <Button type="button" variant="outline" style={{ fontSize: 14, whiteSpace: "normal", height: "auto", minHeight: 36 }}
        disabled={blocked || state.status === "loading"} onClick={() => { void request.load(offline); }}>
        {state.status === "loading" ? "Fetching dated forecast…" : state.forecast ? "Refresh dated station forecast" : "Fetch dated station forecast"}
      </Button>
      {state.status === "loading" && <Button type="button" variant="outline" style={{ fontSize: 14, minHeight: 36 }} onClick={() => request.cancel()}>Cancel weather request</Button>}
    </div>
    <p role="status">{message}</p>
    <StationWeatherReport station={station} epochMs={epochMs} forecast={state.forecast} nowMs={Date.now()} />
    <details>
      <summary>What this weather means for a radio link</summary>
      <p>Rain and atmospheric water can weaken microwave signals and add noise. The effect depends on frequency band and path elevation; Ka-band is generally more affected than X-band.</p>
      <p>Wind loads an antenna and can limit pointing or operation. Limits depend on antenna design; a 10 m forecast wind speed is not a gust measurement or an operating limit.</p>
      <p>Cloud percentage alone gives no link margin, contact availability or antenna booking. Temperature is air temperature, not receiver noise temperature. A qualified link budget, station limits and service schedule are still needed.</p>
      <p>See <a href="https://deepspace.jpl.nasa.gov/dsndocs/810-005/105/105E.pdf" target="_blank" rel="noreferrer">JPL 810-005/105 Rev. E, atmospheric and environmental effects</a>, sections 2.1 and 2.3.</p>
      <p>Forecast values describe a weather-model grid near the representative antenna, not antenna telemetry. Null values stay unavailable. Values outside returned coverage are never extrapolated.</p>
      <p><a href={DSN_SOURCES.weather} target="_blank" rel="noreferrer">Open-Meteo forecast source, units and sampling</a>. Data by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>.</p>
    </details>
  </section>;
}
