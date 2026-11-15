import { test } from "node:test";
import assert from "node:assert/strict";
import {
  simulateFlight,
  DEFAULT_FLIGHT,
  LUNAR_MU,
  MOON_RADIUS_M,
} from "../lib/flight";
test("unpowered circular orbit conserves specific energy", () => {
  const radius = MOON_RADIUS_M + 100000;
  const r = simulateFlight({
    ...DEFAULT_FLIGHT,
    altitudeM: 100000,
    horizontalMps: Math.sqrt(LUNAR_MU / radius),
    verticalMps: 0,
    thrustN: 0,
    burnSeconds: 0,
    durationSeconds: 600,
  });
  const energy = (p: (typeof r.points)[number]) =>
    p.speedMps ** 2 / 2 - LUNAR_MU / Math.hypot(...p.positionM);
  assert.ok(Math.abs(energy(r.points.at(-1)!) - energy(r.points[0])) < 0.01);
  assert.ok(Math.abs(r.points.at(-1)!.altitudeM - 100000) < 0.1);
});
test("burn consumes propellant at thrust over Isp g0 and stops at dry mass", () => {
  const r = simulateFlight({
    ...DEFAULT_FLIGHT,
    wetMassKg: 1000,
    dryMassKg: 990,
    thrustN: 10000,
    ispSeconds: 300,
    burnSeconds: 100,
    durationSeconds: 30,
  });
  assert.ok(r.points.every((p) => p.massKg >= 990));
  assert.equal(r.points.at(-1)!.massKg, 990);
  assert.ok(r.fuelExhausted);
  assert.ok(r.points.at(-1)!.altitudeM > 0);
});
test("falling trajectory terminates at reference-surface contact", () => {
  const r = simulateFlight({
    ...DEFAULT_FLIGHT,
    mode: "descent",
    altitudeM: 100,
    verticalMps: -10,
    thrustN: 0,
    burnSeconds: 0,
    durationSeconds: 100,
  });
  assert.equal(r.status, "reference contact");
  assert.ok(r.points.at(-1)!.t < 100);
  assert.ok(Math.abs(r.points.at(-1)!.altitudeM) < 0.1);
});
test("coordinates are represented by heading-dependent motion", () => {
  const a = simulateFlight({
    ...DEFAULT_FLIGHT,
    headingDeg: 90,
    durationSeconds: 60,
  });
  assert.ok(a.points.at(-1)!.eastM > 0);
  assert.ok(Math.abs(a.points.at(-1)!.northM) < 0.001);
});
test("invalid vehicle and unbounded run are rejected", () => {
  assert.throws(
    () => simulateFlight({ ...DEFAULT_FLIGHT, dryMassKg: 30000 }),
    /mass/i,
  );
  assert.throws(
    () => simulateFlight({ ...DEFAULT_FLIGHT, durationSeconds: Infinity }),
    /duration/i,
  );
});
test("surface-relative altitude includes the site elevation in gravity radius", () => {
  const r = simulateFlight(
    {
      ...DEFAULT_FLIGHT,
      altitudeM: 1000,
      thrustN: 0,
      burnSeconds: 0,
      durationSeconds: 1,
    },
    undefined,
    MOON_RADIUS_M + 3000,
  );
  assert.equal(r.points[0].altitudeM, 1000);
  assert.equal(Math.hypot(...r.points[0].positionM), MOON_RADIUS_M + 4000);
});
test("absurd finite velocities are rejected before numerical overflow", () => {
  assert.throws(
    () => simulateFlight({ ...DEFAULT_FLIGHT, horizontalMps: 1e100 }),
    /speed/i,
  );
});
test("sampled terrain contact is distinguished from a reference sphere", () => {
  const r = simulateFlight(
    {
      ...DEFAULT_FLIGHT,
      mode: "descent",
      altitudeM: 100,
      verticalMps: -10,
      thrustN: 0,
      burnSeconds: 0,
      durationSeconds: 100,
    },
    () => 20,
  );
  assert.equal(r.status, "terrain contact");
  assert.ok(Math.abs(r.points.at(-1)!.yM - 20) < 0.05);
});
test("reported thrust-to-weight uses the selected site radius", () => {
  const radius = MOON_RADIUS_M + 3000;
  const r = simulateFlight(
    { ...DEFAULT_FLIGHT, altitudeM: 1000, durationSeconds: 1 },
    undefined,
    radius,
  );
  assert.ok(
    Math.abs(
      r.initialThrustToWeight -
        DEFAULT_FLIGHT.thrustN /
          ((DEFAULT_FLIGHT.wetMassKg * LUNAR_MU) / (radius + 1000) ** 2),
    ) < 1e-12,
  );
});

test("legacy absent-landing default trajectory retains the recorded base solver numerics", () => {
  const r = simulateFlight({ ...DEFAULT_FLIGHT, durationSeconds: 60 });
  const p = r.points.at(-1)!;
  // Recorded directly from the unchanged base revision, independent of the assisted branch.
  assert.deepEqual(p.positionM, [577.6604355075964, 1740708.5051453465, 3.5371500166922216e-14]);
  assert.deepEqual(p.velocityMps, [29.15138926832628, 111.39589104618916, 1.7850077779077143e-15]);
  assert.equal(p.massKg, 4385.232294386235);
  assert.equal(r.deltaVMps, 211.41658420735885);
  assert.equal(r.contact, undefined);
  assert.equal(r.landingOutcome, undefined);
  assert.equal(r.previewEndTimeS, undefined);
  assert.deepEqual(simulateFlight({ ...DEFAULT_FLIGHT, durationSeconds: 60 }, undefined, MOON_RADIUS_M, { latitudeDeg: -90 }), r);
});
