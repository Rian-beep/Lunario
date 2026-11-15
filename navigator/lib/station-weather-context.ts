import { fetchDsnWeather, type DsnStation, type DsnWeather } from "./dsn";

export type StationWeatherState = {
  status: "idle" | "loading" | "ready" | "cancelled" | "error" | "offline";
  forecast: DsnWeather | null;
};

export function stationWeatherIdentity(station: DsnStation): string {
  return JSON.stringify([station.id, station.antenna, station.latitudeDeg, station.longitudeEastDeg, station.heightM]);
}

export function stationWeatherOffline(offline = false): boolean {
  return offline || (typeof location !== "undefined" && location.protocol === "file:") ||
    (typeof navigator !== "undefined" && navigator.onLine === false);
}

/** One mounted station owns one bounded forecast; no shared cache or automatic requests. */
export function createStationWeatherRequest(
  station: DsnStation,
  fetchWeather: typeof fetchDsnWeather = fetchDsnWeather,
) {
  const target = { ...station };
  const initial: StationWeatherState = { status: "idle", forecast: null };
  let state = initial;
  let generation = 0;
  let controller: AbortController | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: StationWeatherState) => {
    state = next;
    for (const listener of listeners) listener();
  };
  const cancel = (notify = true) => {
    generation++;
    const pending = controller !== null;
    controller?.abort();
    controller = null;
    if (notify && pending) publish({ ...state, status: "cancelled" });
  };

  return {
    getSnapshot: () => state,
    getServerSnapshot: () => initial,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    cancel,
    async load(offline = false) {
      cancel(false);
      if (stationWeatherOffline(offline)) {
        publish({ ...state, status: "offline" });
        return;
      }
      const request = new AbortController();
      controller = request;
      const requestedGeneration = ++generation;
      publish({ ...state, status: "loading" });
      try {
        const forecast = await fetchWeather(target, request.signal);
        if (requestedGeneration !== generation || request.signal.aborted) return;
        if (forecast.stationId !== target.id) throw Error("Weather station differs from request");
        publish({ status: "ready", forecast });
      } catch {
        if (requestedGeneration !== generation || request.signal.aborted) return;
        publish({ ...state, status: "error" });
      } finally {
        if (requestedGeneration === generation) controller = null;
      }
    },
  };
}
