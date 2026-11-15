import type { LandingConfiguration, LandingContact, LandingEnvironment, LandingOutcome } from "./landing-contract";
import { DEFAULT_LANDING_CONFIGURATION } from "./landing-contract";
import { landingFields } from "./landing-inputs";
import { landingTargetDistanceM, simulateConfiguredLanding } from "./landing-flight";
// Lunar GM: JPL DE440 astrodynamic parameters, km³/s² converted to m³/s².
export const LUNAR_MU = 4.902800118e12;
export const MOON_RADIUS_M = 1_737_400;
const G0 = 9.80665;
type Vec = [number, number, number];
export type FlightInputs = {
  mode: "ascent" | "descent";
  landing?: LandingConfiguration;
  eastOffsetM?: number;
  northOffsetM?: number;
  altitudeM: number;
  horizontalMps: number;
  verticalMps: number;
  headingDeg: number;
  pitchDeg: number;
  finalPitchDeg: number;
  wetMassKg: number;
  dryMassKg: number;
  thrustN: number;
  ispSeconds: number;
  burnSeconds: number;
  durationSeconds: number;
};
export const DEFAULT_FLIGHT: FlightInputs = {
  mode: "ascent",
  altitudeM: 1,
  horizontalMps: 0,
  verticalMps: 0,
  headingDeg: 90,
  pitchDeg: 90,
  finalPitchDeg: 35,
  wetMassKg: 4700,
  dryMassKg: 2200,
  thrustN: 16000,
  ispSeconds: 311,
  burnSeconds: 210,
  durationSeconds: 480,
};
export type FlightPoint = {
  t: number;
  eastM: number;
  northM: number;
  yM: number;
  altitudeM: number;
  speedMps: number;
  verticalMps: number;
  massKg: number;
  positionM: Vec;
  velocityMps: Vec;
  powered: boolean;
};
export type FlightResult = {
  contact?: LandingContact;
  landingConfiguration?: LandingConfiguration;
  landingOutcome?: LandingOutcome;
  previewEndTimeS?: number;
  points: FlightPoint[];
  status:
    "coasting" | "burn complete" | "reference contact" | "terrain contact";
  fuelExhausted: boolean;
  maxAltitudeM: number;
  initialThrustToWeight: number;
  deltaVMps: number;
  model: string;
};

export function simulateFlight(
  a: FlightInputs,
  terrainHeight?: (eastM: number, northM: number) => number | null,
  surfaceRadiusM = MOON_RADIUS_M,
  environment?: LandingEnvironment,
): FlightResult {
  for (const [k, v] of Object.entries(a))
    if (!["mode", "landing", "eastOffsetM", "northOffsetM"].includes(k) && (typeof v !== "number" || !Number.isFinite(v)))
      throw new Error(`${k} must be finite`);
  if (a.wetMassKg <= 0 || a.dryMassKg <= 0 || a.dryMassKg > a.wetMassKg)
    throw new Error("Dry mass must be positive and at most wet mass");
  if (a.durationSeconds <= 0 || a.durationSeconds > 7200)
    throw new Error("Flight duration must be above 0 and at most 7200 seconds");
  if (
    a.altitudeM < 0 ||
    a.altitudeM > 1e6 ||
    a.thrustN < 0 ||
    a.ispSeconds <= 0 ||
    a.burnSeconds < 0 ||
    a.burnSeconds > 7200
  )
    throw new Error(
      "Altitude, thrust, specific impulse or burn duration is outside model limits",
    );
  if (
    a.pitchDeg < -90 ||
    a.pitchDeg > 90 ||
    a.finalPitchDeg < -90 ||
    a.finalPitchDeg > 90
  )
    throw new Error("Pitch must be between −90° and 90°");
  if (
    !Number.isFinite(surfaceRadiusM) ||
    surfaceRadiusM < MOON_RADIUS_M - 20000 ||
    surfaceRadiusM > MOON_RADIUS_M + 20000
  )
    throw new Error("Site radius is outside lunar terrain bounds");
  if (
    a.horizontalMps < 0 ||
    a.horizontalMps > 5000 ||
    Math.abs(a.verticalMps) > 5000
  )
    throw new Error("Initial speed is outside the 0–5000 m/s preview range");
  if (a.wetMassKg > 1e7 || a.thrustN > 1e8 || a.ispSeconds > 5000)
    throw new Error("Vehicle parameters exceed the supported preview bounds");
  landingFields(a);
  if (a.landing) return simulateConfiguredLanding(a, terrainHeight, surfaceRadiusM, environment);
  const hd = (a.headingDeg * Math.PI) / 180;
  let r: Vec = [a.eastOffsetM ?? 0, surfaceRadiusM + a.altitudeM, a.northOffsetM ?? 0],
    v: Vec = [
      Math.sin(hd) * a.horizontalMps,
      a.verticalMps,
      Math.cos(hd) * a.horizontalMps,
    ];
  const flow = a.thrustN / (a.ispSeconds * G0);
  const fuelSeconds = flow > 0 ? (a.wetMassKg - a.dryMassKg) / flow : Infinity;
  const burnEnd = Math.min(a.burnSeconds, fuelSeconds);
  const mass = (t: number) =>
    Math.max(a.dryMassKg, a.wetMassKg - flow * Math.min(t, burnEnd));
  const accel = (p: Vec, t: number, powered: boolean): Vec => {
    const norm = Math.hypot(...p),
      up = p.map((x) => x / norm) as Vec;
    const tang: Vec = [Math.sin(hd), 0, Math.cos(hd)];
    const d = tang.reduce((sum, x, i) => sum + x * up[i], 0);
    for (let i = 0; i < 3; i++) tang[i] -= d * up[i];
    const tn = Math.hypot(...tang);
    const pitch =
      ((a.pitchDeg +
        (a.finalPitchDeg - a.pitchDeg) *
          Math.min(1, t / Math.max(1, a.burnSeconds))) *
        Math.PI) /
      180;
    return p.map(
      (x, i) =>
        (-LUNAR_MU * x) / norm ** 3 +
        (powered
          ? (a.thrustN / mass(t)) *
            (up[i] * Math.sin(pitch) + (tang[i] / tn) * Math.cos(pitch))
          : 0),
    ) as Vec;
  };
  const add = (x: Vec, y: Vec, f: number) =>
    x.map((n, i) => n + y[i] * f) as Vec;
  const points: FlightPoint[] = [];
  const point = (t: number): FlightPoint => ({
    t,
    eastM: r[0],
    northM: r[2],
    yM: r[1] - surfaceRadiusM,
    altitudeM: Math.hypot(...r) - surfaceRadiusM,
    speedMps: Math.hypot(...v),
    verticalMps: r.reduce((s, x, i) => s + x * v[i], 0) / Math.hypot(...r),
    massKg: mass(t),
    positionM: [...r],
    velocityMps: [...v],
    powered: t < burnEnd && a.thrustN > 0,
  });
  points.push(point(0));
  let t = 0,
    status: FlightResult["status"] = "coasting",
    maxAltitudeM = a.altitudeM;
  const clearance = (p: FlightPoint) => {
    const h = terrainHeight?.(p.eastM, p.northM);
    const known = typeof h === "number" && Number.isFinite(h);
    return { value: known ? p.yM - h : p.altitudeM, terrain: known };
  };
  if (clearance(points[0]).value < -1e-6)
    throw new RangeError("Flight starts below the numerical surface");
  while (t < a.durationSeconds - 1e-8) {
    let dt = Math.min(0.25, a.durationSeconds - t);
    if (t < burnEnd && t + dt > burnEnd) dt = burnEnd - t;
    const powered = t < burnEnd - 1e-9 && a.thrustN > 0;
    const k1r = v,
      k1v = accel(r, t, powered);
    const k2r = add(v, k1v, dt / 2),
      k2v = accel(add(r, k1r, dt / 2), t + dt / 2, powered);
    const k3r = add(v, k2v, dt / 2),
      k3v = accel(add(r, k2r, dt / 2), t + dt / 2, powered);
    const k4r = add(v, k3v, dt),
      k4v = accel(add(r, k3r, dt), t + dt, powered);
    const before = point(t);
    r = r.map(
      (x, i) => x + (dt / 6) * (k1r[i] + 2 * k2r[i] + 2 * k3r[i] + k4r[i]),
    ) as Vec;
    v = v.map(
      (x, i) => x + (dt / 6) * (k1v[i] + 2 * k2v[i] + 2 * k3v[i] + k4v[i]),
    ) as Vec;
    t += dt;
    let p = point(t);
    const c = clearance(p);
    if (c.value <= 0 && t > 0) {
      const old = clearance(before).value;
      const f = Math.max(0, Math.min(1, old / (old - c.value)));
      r = before.positionM.map((x, i) => x + (r[i] - x) * f) as Vec;
      v = before.velocityMps.map((x, i) => x + (v[i] - x) * f) as Vec;
      t = before.t + dt * f;
      p = point(t);
      points.push(p);
      status = c.terrain ? "terrain contact" : "reference contact";
      break;
    }
    maxAltitudeM = Math.max(maxAltitudeM, p.altitudeM);
    if (Math.floor(t) > Math.floor(t - dt) || t >= a.durationSeconds - 1e-8)
      points.push(p);
  }
  if (!status.includes("contact") && burnEnd > 0 && t >= burnEnd)
    status = "burn complete";
  const lastMass = points.at(-1)!.massKg;
  const result: FlightResult = {
    points,
    initialThrustToWeight:
      a.thrustN / ((a.wetMassKg * LUNAR_MU) / (surfaceRadiusM + a.altitudeM) ** 2),
    status,
    maxAltitudeM,
    fuelExhausted: flow > 0 && fuelSeconds <= Math.min(t, a.burnSeconds),
    deltaVMps: a.ispSeconds * G0 * Math.log(a.wetMassKg / lastMass),
    model:
      "3-DoF RK4, central lunar gravity; fixed local frame, lunar rotation neglected over this short flight. Generic vehicle; no closed-loop guidance.",
  };
  if (status.includes("contact")) {
    // Describe the existing interpolated impact; never rerun it through configured guidance.
    const last = points.at(-1)!;
    const sampleHeight = (east: number, north: number) => {
      const h = terrainHeight?.(east, north);
      return typeof h === "number" && Number.isFinite(h) ? h : null;
    };
    const terrainHeightM = sampleHeight(last.eastM, last.northM);
    const samples = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([e, n]) =>
      sampleHeight(last.eastM + e, last.northM + n));
    const [ep, em, np, nm] = samples;
    const slopeDeg = terrainHeightM !== null && ep !== null && em !== null && np !== null && nm !== null
      ? Math.atan(Math.hypot((ep - em) / 2, (np - nm) / 2)) * 180 / Math.PI : null;
    const up = last.positionM.map(x => x / Math.hypot(...last.positionM));
    const tangent = [Math.sin(hd), 0, Math.cos(hd)];
    const projection = tangent.reduce((sum, x, i) => sum + x * up[i], 0);
    for (let i = 0; i < 3; i++) tangent[i] -= projection * up[i];
    const tangentLength = Math.hypot(...tangent);
    const pitch = (a.pitchDeg + (a.finalPitchDeg - a.pitchDeg) *
      Math.min(1, last.t / Math.max(1, a.burnSeconds))) * Math.PI / 180;
    const attitude = up.map((x, i) => x * Math.sin(pitch) + tangent[i] / tangentLength * Math.cos(pitch));
    result.contact = {
      timeS: last.t, eastM: last.eastM, northM: last.northM, yM: last.yM,
      velocityMps: [...last.velocityMps], massKg: last.massKg,
      terrainHeightM, terrainKnown: terrainHeightM !== null, slopeDeg,
      tiltDeg: Math.acos(Math.max(-1, Math.min(1, attitude.reduce((sum, x, i) => sum + x * up[i], 0)))) * 180 / Math.PI,
      headingDeg: Math.hypot(attitude[0], attitude[2]) > 1e-9
        ? (Math.atan2(attitude[0], attitude[2]) * 180 / Math.PI + 360) % 360 : a.headingDeg,
      targetErrorM: landingTargetDistanceM(last.eastM, last.northM, last.yM, surfaceRadiusM),
    };
    result.landingConfiguration = { ...DEFAULT_LANDING_CONFIGURATION, guidance: "manual" };
    result.previewEndTimeS = last.t + result.landingConfiguration.contactPreviewSeconds;
    result.model += " Manual linear pitch schedule with ideal instantaneous attitude, including coast; tilt is from radial vertical. Contact preserves incoming east/up/north position and velocity; target error is a reference-sphere surface arc in metres. Slope is a 2 m centred numerical difference, not a footprint assessment. Unknown terrain remains reference-only. Default contact coefficients and continuation duration are preview assumptions, not an acceptance assessment or NASA vehicle qualification.";
  }
  return result;
}
