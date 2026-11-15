import type { Audience } from "./glossary";

export function chartLabels(
  kind: "horizon" | "elevation" | "flight" | "power" | "battery",
  audience: Audience,
) {
  const x =
    kind === "horizon"
      ? "Azimuth (° clockwise from north)"
      : kind === "flight"
        ? "Flight time (s since preview start)"
        : "Time (UTC)";
  const y =
    kind === "flight"
      ? "Radial altitude above site reference sphere (km)"
      : kind === "power"
        ? "Electrical power (W)"
        : kind === "battery"
          ? "Stored energy (Wh)"
          : "Elevation above local horizontal (°)";
  const basics = {
    horizon:
      "North 0°, east 90°, south 180°, west 270°. Elevation 0° is the local horizontal, perpendicular to the site's reference-sphere radius. Sun is filled amber; Earth is a blue ring. The smooth-sphere horizon is 0°.",
    elevation:
      "UTC dates and hours, not elapsed flight seconds. Elevation 0° is the local horizontal. Compare each body's centre direction with its terrain horizon and the smooth-sphere 0° line. Sun is filled amber; Earth is a blue ring.",
    flight:
      "Seconds elapsed from preview start at the selected mission epoch. Altitude is radial distance minus the site reference radius, not height above the actual terrain. Zero is the reference sphere, not a safe landing.",
    power:
      "Each hourly sample supplies power over the following interval; steps show that model assumption, not continuous measurements. Gaps mean unknown generation. Terrain and smooth-sphere results use the same vehicle assumptions.",
    battery:
      "Each point is stored energy at the END of its hourly interval, after generation and load. Gaps mean unknown storage; after unknown generation it cannot be recovered by this model. Reserve is a user requirement, not a universal safety limit.",
  };
  const teaching = {
    horizon:
      "A body is blocked when its direction falls below the terrain in that compass direction. Part of the Sun may still clear the rim when its centre does not. Tracks revisit directions at different times; they are not simultaneous.",
    elevation:
      "When the terrain line rises above a body's centre, the centre is hidden. The Sun's finite disk can remain partly visible; Earth communication uses its centre plus the antenna mask, not this chart alone.",
    flight:
      "Watch speed together with height: getting to the surface does not mean the vehicle has slowed enough to land. Total speed includes sideways motion; negative radial speed means descent.",
    power:
      "More lit panel area increases generation; a fixed panel facing away from the Sun can still make no power. Power integrated over hours gives Wh. The battery must bridge any deficit.",
    battery:
      "A falling line means the battery supplied a power deficit. A flat zero can hide unmet demand; inspect the unmet-load result. A large energy total does not ensure energy is available at the right time.",
  };
  const technical = {
    horizon:
      "Airless JPL Horizons-derived hourly centre directions. Horizon vertices are the native LOLA mask samples, with gaps retained; connecting segments add no angular resolution. Current direction markers may be interpolated for playback. Tracks are not visibility percentages.",
    elevation:
      "JPL Horizons-derived hourly centre directions; LOLA horizons sampled at each body's azimuth by the existing model. Unknown horizon samples remain gaps. Lines between samples add no temporal accuracy; rise/set timing is limited to one sample. The 0° sphere line is a geometric baseline, not an antenna mask.",
    flight:
      "3-DoF RK4 with central lunar gravity in a nonrotating local frame; lunar rotation neglected. Output samples are roughly 1 s apart, including the terminal state; solver steps are at most 0.25 s. Contact, fuel exhaustion or a time bound is not mission success. Display rounding is not an error bound.",
    power:
      "P = fixed flux × area × efficiency × (1 − losses) × centre-direction incidence × uniform visible-disk fraction. No Sun-distance scaling, thermal model or electrical transients. Null is not zero. Connecting the steps does not resolve sub-hour changes.",
    battery:
      "Bounded Wh state with charge/discharge efficiencies, deployment, scheduled loads and bus rate caps. Plot boundaries include model subsegments; these resolve configured operations, not sub-hour sunlight measurements. Check unmet demand and reserve time separately. Null is not zero.",
  };
  return {
    x,
    y,
    note: `${basics[kind]} ${audience === "plan" ? technical[kind] : teaching[kind]}`,
  };
}

export function numericDomain(values: number[]): [number, number] {
  let a = Infinity,
    b = -Infinity;
  for (const n of values)
    if (Number.isFinite(n)) {
      a = Math.min(a, n);
      b = Math.max(b, n);
    }
  if (!Number.isFinite(a)) return [-1, 1];
  const pad = a === b ? Math.max(1, Math.abs(a) * 0.1) : (b - a) * 0.08;
  return [a - pad, b + pad];
}

export type ChartPoint = {
  x: number;
  y: number;
  sampleIndex?: number;
  endX?: number;
};

/** Retain the nearest unknown sample rather than substituting a neighbouring known value. */
export function nearestSample(
  points: ChartPoint[],
  target: number,
): ChartPoint | null {
  if (!Number.isFinite(target)) return null;
  let best: ChartPoint | null = null,
    distance = Infinity;
  for (const point of points) {
    if (!Number.isFinite(point.x)) continue;
    if (point.endX != null && target >= point.x && target < point.endX)
      return point;
    const delta = Math.abs(point.x - target);
    if (delta < distance) {
      best = point;
      distance = delta;
    }
  }
  return best;
}

/** Keyboard traversal follows actual sample coordinates, including unknown samples. */
export function moveSample(
  samples: number[],
  current: number,
  key: string,
  stride = 1,
): number {
  if (!samples.length) return current;
  if (key === "Home") return samples[0];
  if (key === "End") return samples[samples.length - 1];
  if (key === "ArrowRight") {
    const i = samples.findIndex((n) => n > current);
    return i < 0
      ? samples[samples.length - 1]
      : samples[Math.min(samples.length - 1, i + stride - 1)];
  }
  if (key === "ArrowLeft") {
    const i = samples.findIndex((n) => n >= current);
    const previous = i < 0 ? samples.length - 1 : Math.max(0, i - 1);
    return samples[Math.max(0, previous - stride + 1)];
  }
  return current;
}

export function formatChartValue(
  value: number,
  unit: string,
  digits = 2,
): string {
  return Number.isFinite(value)
    ? `${value.toLocaleString("en-GB", { maximumFractionDigits: digits })}${unit ? ` ${unit}` : ""}`
    : "Unknown";
}

export function linePath(
  points: ChartPoint[],
  x: (n: number) => number,
  y: (n: number) => number,
  stepped = false,
): string {
  let path = "",
    start = true;
  const xy = (p: ChartPoint) =>
    `${Number(x(p.x).toFixed(2))},${Number(y(p.y).toFixed(2))}`;
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      start = true;
      continue;
    }
    path += (start || stepped ? "M" : "L") + xy(p);
    if (stepped && p.endX != null && Number.isFinite(p.endX))
      path += `H${Number(x(p.endX).toFixed(2))}`;
    start = false;
  }
  return path;
}

/** Power belongs to the following interval; battery is its post-integration state. */
export function resourcePoints(
  timeline: Array<{ powerW: number | null; batteryWh: number | null; startOffsetHours?:number;endOffsetHours?:number;startBatteryWh?:number|null }>,
  key: "powerW" | "batteryWh",
  startMs: number,
  stepMs: number,
  includeInitial = false,
): ChartPoint[] {
  const points=timeline.map((p,i)=>({
    x:startMs+(key==='batteryWh'?(p.endOffsetHours!==undefined?p.endOffsetHours*3600000:(i+1)*stepMs):(p.startOffsetHours!==undefined?p.startOffsetHours*3600000:i*stepMs)),
    y:p[key]??NaN,
    ...(key==='powerW'?{endX:startMs+(p.endOffsetHours!==undefined?p.endOffsetHours*3600000:(i+1)*stepMs)}:{}),
  }));
  const initial=timeline[0];
  if(includeInitial&&key==='batteryWh'&&initial?.startOffsetHours!==undefined)points.unshift({x:startMs+initial.startOffsetHours*3600000,y:initial.startBatteryWh??NaN});
  return points;
}
