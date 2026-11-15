import assert from "node:assert/strict";
import test from "node:test";
import {
  createTouchdownSimulation,
  DEFAULT_TOUCHDOWN,
  type TouchdownFrame,
  type TouchdownInputs,
} from "../lib/touchdown-physics";

type Simulation = Awaited<ReturnType<typeof createTouchdownSimulation>>;
const DT = 1 / 120;

function advance(simulation: Simulation, count: number): TouchdownFrame {
  let frame = simulation.step();
  for (let i = 1; i < count; i += 1) frame = simulation.step();
  return frame;
}

function untilContact(simulation: Simulation): TouchdownFrame {
  for (let i = 0; i < 2400; i += 1) {
    const frame = simulation.step();
    if (frame.contact) return frame;
  }
  assert.fail("No terrain contact within 20 model seconds");
}

test("fixed-step lunar free fall matches independent SI acceleration and displacement", async () => {
  const simulation = await createTouchdownSimulation({
    ...DEFAULT_TOUCHDOWN, heightM: 100, verticalSpeedMps: 2, horizontalSpeedMps: 3,
  });
  try {
    const first = simulation.step();
    assert.equal(first.timeS, DT);
    const frame = advance(simulation, 119);
    assert.equal(frame.timeS, 1);
    assert.ok(Math.abs(frame.velocity[1] - (-2 - 1.62)) < 0.0001);
    // Upright lowest foot is 1.8 m below the body-box origin. Integration is discrete.
    assert.ok(Math.abs(frame.position[1] - (101.8 - 2 - 0.5 * 1.62)) < 0.02);
    assert.ok(Math.abs(frame.position[0] - 3) < 0.0001);
    assert.ok(Math.abs(Math.hypot(...frame.rotation) - 1) < 0.00001);
    assert.equal(frame.contact, false);
    assert.equal(frame.broken, false);
    assert.deepEqual(frame.fragments, []);
  } finally {
    simulation.dispose();
  }
});

test("gentle flat touchdown settles on four feet without breaking", async () => {
  const simulation = await createTouchdownSimulation({
    ...DEFAULT_TOUCHDOWN, heightM: 1, verticalSpeedMps: 0.5, restitution: 0,
  });
  try {
    const contact = untilContact(simulation);
    assert.equal(contact.broken, false);
    const settled = advance(simulation, 1200);
    assert.equal(settled.contact, true);
    assert.equal(settled.broken, false);
    assert.ok(Math.abs(settled.position[1] - 1.8) < 0.02);
    assert.ok(Math.hypot(...settled.velocity) < 0.01);
    assert.ok(Math.abs(settled.rotation[2]) < 0.01);
  } finally {
    simulation.dispose();
  }
});

test("high-speed contact breaks into the original five mass-conserving dynamic pieces", async () => {
  const massKg = 12345.67;
  const simulation = await createTouchdownSimulation({
    ...DEFAULT_TOUCHDOWN, massKg, heightM: 0.2, verticalSpeedMps: 20,
    horizontalSpeedMps: 4, tiltDeg: 15, failureEnergyJ: 10000,
  });
  try {
    const impact = untilContact(simulation);
    assert.equal(impact.broken, true);
    assert.equal(impact.fragments.length, 5);
    assert.equal(impact.fragments.reduce((sum, part) => sum + part.massKg, 0), massKg);
    assert.ok(impact.fragments.every((part) => part.massKg > 0));
    assert.deepEqual(impact.position, impact.fragments[0].position);
    const later = advance(simulation, 120);
    assert.equal(later.broken, true);
    assert.equal(later.fragments.length, 5);
    assert.equal(later.fragments.reduce((sum, part) => sum + part.massKg, 0), massKg);
    assert.notDeepEqual(later.fragments.map((part) => part.position), impact.fragments.map((part) => part.position));
    for (const part of later.fragments) {
      assert.ok([...part.position, ...part.rotation].every(Number.isFinite));
      assert.ok(Math.abs(Math.hypot(...part.rotation) - 1) < 0.00001);
      assert.ok(part.position[1] > -1, "CCD should keep fragments above the flat plane");
    }
  } finally {
    simulation.dispose();
  }
});

test("failure threshold uses incoming energy and is configurable", async () => {
  const inputs = { ...DEFAULT_TOUCHDOWN, heightM: 0, verticalSpeedMps: 4, restitution: 0 };
  const lower = await createTouchdownSimulation({ ...inputs, failureEnergyJ: 70000 });
  const upper = await createTouchdownSimulation({ ...inputs, failureEnergyJ: 100000 });
  try {
    // ½ × 10000 kg × (4 m/s)² = 80000 J, before the solver arrests descent.
    assert.equal(untilContact(lower).broken, true);
    assert.equal(untilContact(upper).broken, false);
    assert.equal(advance(upper, 600).broken, false);
  } finally {
    lower.dispose();
    upper.dispose();
  }
});

test("soft CCD prevents a fast entry from skipping the synthetic plane", async () => {
  const simulation = await createTouchdownSimulation({
    ...DEFAULT_TOUCHDOWN, heightM: 0.2, verticalSpeedMps: 100, failureEnergyJ: 10000,
  });
  try {
    // Entry travels 0.833 m/step, exceeding both clearance and foot thickness.
    const impact = untilContact(simulation);
    assert.equal(impact.broken, true);
    assert.ok(impact.timeS <= 2 * DT);
    for (let i = 0; i < 120; i += 1) {
      const frame = i === 0 ? impact : simulation.step();
      frame.fragments.forEach((part, index) => {
        const [x, y, z, w] = part.rotation;
        const half = index === 0 ? [1.5, 0.9, 1.5] : [0.35, 0.15, 0.35];
        const supportY = Math.abs(2 * (x * y + z * w)) * half[0]
          + Math.abs(1 - 2 * (x * x + z * z)) * half[1]
          + Math.abs(2 * (y * z - x * w)) * half[2];
        assert.ok(part.position[1] - supportY > -0.02, "no fragment tunnels through the plane");
      });
    }
  } finally {
    simulation.dispose();
  }
});

test("failure requires contact even when free-flight kinetic energy exceeds the threshold", async () => {
  const simulation = await createTouchdownSimulation({
    ...DEFAULT_TOUCHDOWN, heightM: 100, verticalSpeedMps: 20, failureEnergyJ: 0,
  });
  try {
    const airborne = advance(simulation, 120);
    assert.equal(airborne.contact, false);
    assert.equal(airborne.broken, false);
    assert.equal(untilContact(simulation).broken, true);
  } finally {
    simulation.dispose();
  }
});

test("restitution produces a physical bounce and contact is not latched", async () => {
  const simulation = await createTouchdownSimulation({
    ...DEFAULT_TOUCHDOWN, heightM: 0.1, verticalSpeedMps: 3, restitution: 0.9, failureEnergyJ: 1e9,
  });
  try {
    untilContact(simulation);
    let upwardSpeed = 0;
    let airborneAgain = false;
    for (let i = 0; i < 120; i += 1) {
      const frame = simulation.step();
      upwardSpeed = Math.max(upwardSpeed, frame.velocity[1]);
      airborneAgain ||= !frame.contact && frame.velocity[1] > 0;
      assert.equal(frame.broken, false);
    }
    assert.ok(upwardSpeed > 1.5, `bounce speed ${upwardSpeed} m/s`);
    assert.equal(airborneAgain, true);
  } finally {
    simulation.dispose();
  }
});

test("friction resists sliding on the explicitly synthetic inclined plane", async () => {
  const inputs = { ...DEFAULT_TOUCHDOWN, slopeDeg: 20, heightM: 0.05, restitution: 0, failureEnergyJ: 1e9 };
  const slippery = await createTouchdownSimulation({ ...inputs, friction: 0 });
  const rough = await createTouchdownSimulation({ ...inputs, friction: 1 });
  try {
    const a = advance(slippery, 1200);
    const b = advance(rough, 1200);
    assert.ok(a.position[0] < -5, `downhill X displacement ${a.position[0]} m`);
    assert.ok(Math.abs(b.position[0]) < Math.abs(a.position[0]) / 2);
    assert.equal(a.broken, false);
    assert.equal(b.broken, false);
  } finally {
    slippery.dispose();
    rough.dispose();
  }
});

test("height denotes lowest-collider clearance for tilted bodies on either slope sign", async () => {
  for (const slopeDeg of [-25, 25]) {
    const tiltDeg = 12;
    const heightM = 2;
    const simulation = await createTouchdownSimulation({
      ...DEFAULT_TOUCHDOWN, slopeDeg, tiltDeg, heightM, verticalSpeedMps: 0,
    });
    try {
      const frame = simulation.step();
      const tilt = tiltDeg * Math.PI / 180;
      const slope = slopeDeg * Math.PI / 180;
      // Independent corner enumeration checks the module's analytic box support.
      let minClearance = Infinity;
      const parts = [
        { centre: [0, 0, 0], half: [1.5, 0.9, 1.5] },
        ...[-3.15, 3.15].flatMap((x) => [-3.15, 3.15].map((z) => ({
          centre: [x, -1.65, z], half: [0.35, 0.15, 0.35],
        }))),
      ];
      for (const { centre, half } of parts) {
        for (const xSign of [-1, 1]) for (const ySign of [-1, 1]) {
          const x = centre[0] + xSign * half[0];
          const y = centre[1] + ySign * half[1];
          const worldX = frame.position[0] + x * Math.cos(tilt) - y * Math.sin(tilt);
          const worldY = frame.position[1] + x * Math.sin(tilt) + y * Math.cos(tilt);
          minClearance = Math.min(minClearance, worldY - worldX * Math.tan(slope));
        }
      }
      assert.ok(Math.abs(minClearance - heightM) < 0.001);
      assert.equal(frame.contact, false);
      assert.equal(untilContact(simulation).broken, false);
    } finally {
      simulation.dispose();
    }
  }
});

test("an overbalanced tilted vehicle tips through rigid-body contacts", async () => {
  const simulation = await createTouchdownSimulation({
    ...DEFAULT_TOUCHDOWN, heightM: 0.05, verticalSpeedMps: 0, tiltDeg: 70,
    restitution: 0, failureEnergyJ: 1e9,
  });
  try {
    const frame = advance(simulation, 1200);
    assert.equal(frame.broken, false);
    assert.equal(frame.contact, true);
    assert.ok(Math.abs(frame.rotation[2]) > Math.sin(80 * Math.PI / 360));
  } finally {
    simulation.dispose();
  }
});

test("independent concurrent worlds repeat every intact and fractured frame deterministically", async () => {
  const inputs = {
    ...DEFAULT_TOUCHDOWN, massKg: 9876.54, heightM: 1.2, verticalSpeedMps: 8,
    horizontalSpeedMps: 3, tiltDeg: -13, slopeDeg: 8, failureEnergyJ: 20000,
  };
  const [a, b] = await Promise.all([createTouchdownSimulation(inputs), createTouchdownSimulation(inputs)]);
  try {
    let broken = false;
    for (let i = 0; i < 600; i += 1) {
      const frame = a.step();
      assert.deepEqual(frame, b.step());
      broken ||= frame.broken;
    }
    assert.equal(broken, true);
  } finally {
    a.dispose();
    b.dispose();
  }
});

test("finite numerical bounds reject invalid, missing, and extreme inputs", async () => {
  const invalid: Partial<Record<keyof TouchdownInputs, number[]>> = {
    massKg: [0, -1, 1e100],
    heightM: [-1, 10001],
    verticalSpeedMps: [-1, 101],
    horizontalSpeedMps: [-1, 101],
    tiltDeg: [-181, 181],
    slopeDeg: [-81, 81],
    friction: [-0.01, 5.01],
    restitution: [-0.01, 1.01],
    failureEnergyJ: [-1, 1e100],
  };
  for (const key of Object.keys(DEFAULT_TOUCHDOWN) as Array<keyof TouchdownInputs>) {
    for (const value of [NaN, Infinity, -Infinity, ...(invalid[key] ?? [])]) {
      await assert.rejects(createTouchdownSimulation({ ...DEFAULT_TOUCHDOWN, [key]: value }), new RegExp(key));
    }
  }
  const missing: Partial<TouchdownInputs> = { ...DEFAULT_TOUCHDOWN };
  delete missing.massKg;
  await assert.rejects(createTouchdownSimulation(missing as TouchdownInputs), /massKg/);
  await assert.rejects(createTouchdownSimulation(null as unknown as TouchdownInputs), /required/);
});

test("inputs and returned frames cannot mutate a running world; dispose is idempotent", async () => {
  const inputs = { ...DEFAULT_TOUCHDOWN, heightM: 100 };
  const pending = createTouchdownSimulation(inputs);
  inputs.verticalSpeedMps = 999;
  const simulation = await pending;
  const first = simulation.step();
  first.position[1] = -1e9;
  first.velocity[1] = -1e9;
  first.rotation[3] = 100;
  const second = simulation.step();
  assert.ok(second.position[1] > 100);
  assert.ok(Math.abs(second.velocity[1] - (-1 - 1.62 * 2 * DT)) < 0.00001);
  assert.ok(Math.abs(Math.hypot(...second.rotation) - 1) < 0.00001);
  simulation.dispose();
  simulation.dispose();
  assert.throws(() => simulation.step(), /disposed/);
});
