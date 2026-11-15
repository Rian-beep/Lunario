import {createPreparationYield} from './yield-main-thread';
import type { Collider, ColliderDesc, EventQueue, RigidBody, Rotation, Vector } from "@dimforge/rapier3d-compat";

/**
 * Illustrative rigid-body experiment, NOT a NASA/LM dynamics or qualification model.
 * SI units: metres, kilograms, seconds; +Y is up, horizontal motion is +X.
 * Default terrain is the synthetic plane y = x tan(slopeDeg). An optional finite
 * numerical heightfield uses the same SI axes, with explicit initial state.
 * Positive slope rises toward +X; positive tilt rotates about +Z from upright.
 *
 * Default authored geometry: a 3 x 1.8 x 3 m body and four 0.7 x 0.3 x 0.7 m feet,
 * centred at (±3.15, -1.65, ±3.15) m: nominal total X/Z width is 7 m.
 * Connections are rigid and massless; there are no crushable legs or soil model.
 * Default body/feet mass shares are 80%/5% each, not spacecraft measurements.
 * Optional descriptors replace those shapes/shares with geometry-based proxies.
 * Rapier computes inertia from these shapes: collider dimensions affect tipping.
 * See https://rapier.rs/docs/user_guides/javascript/rigid_body_mass_properties/.
 */
export type TouchdownInputs = {
  massKg: number;
  /** Initial vertical clearance of the lowest collider above the synthetic plane. */
  heightM: number;
  /** Nonnegative initial downward speed. */
  verticalSpeedMps: number;
  /** Nonnegative initial speed along +X. */
  horizontalSpeedMps: number;
  tiltDeg: number;
  slopeDeg: number;
  /** Coulomb coefficient, applied to the vehicle and the plane. */
  friction: number;
  /** Coefficient of restitution in [0, 1], applied to both surfaces. */
  restitution: number;
  /**
   * Illustrative failure threshold: incoming translational kinetic energy,
   * ½ m |v|², at the onset of a collider/plane contact. This includes sideways
   * motion; it is NOT absorbed energy, stress, leg capacity or a safety limit.
   * Zero breaks on any contact. Rotational energy/fatigue are not assessed.
   */
  failureEnergyJ: number;
};

/** Authored demonstration assumptions, not measured vehicle limits. */
export const DEFAULT_TOUCHDOWN: Readonly<TouchdownInputs> = Object.freeze({
  massKg: 10000,
  heightM: 3,
  verticalSpeedMps: 1,
  horizontalSpeedMps: 0,
  tiltDeg: 0,
  slopeDeg: 0,
  friction: 0.8,
  restitution: 0.1,
  failureEnergyJ: 100000,
});

export type TouchdownFrame = {
  timeS: number;
  /** Intact model origin; fragment zero's centre after breakup. */
  position: [number, number, number];
  /** Quaternion [x, y, z, w]. */
  rotation: [number, number, number, number];
  /** Intact centre-of-mass velocity; fragment zero's velocity after breakup. */
  velocity: [number, number, number];
  /** Current solver contact with the plane, not a latched touchdown event. */
  contact: boolean;
  broken: boolean;
  /** Empty while intact; descriptor order after breakup (default: body + feet). */
  fragments: Array<{
    position: [number, number, number];
    rotation: [number, number, number, number];
    massKg: number;
    velocity: [number, number, number];
    angularVelocity: [number, number, number];
  }>;
};

export const MAX_TOUCHDOWN_FRAGMENTS = 256;
/** Approximate collision boxes in the intact model's metre frame, not CAD. */
export type TouchdownFragment = {
  offset: readonly [number, number, number];
  rotation: readonly [number, number, number, number];
  halfExtents: readonly [number, number, number];
  /** Positive geometry-based assumption; shares must sum to one. */
  massShare: number;
};

/** Finite static surface, row-major +Z rows/+X columns; no extrapolated plane.
 * Heights may be negative. Unknown samples must be rejected by the caller.
 * The caller must stop replay before any proxy leaves these finite bounds.
 */
export type TouchdownTerrain = {
  columns: number; rows: number; stepM: number; x0M: number; z0M: number;
  heightsM: Float64Array;
  initialPositionM: [number, number, number];
  initialVelocityMps: [number, number, number];
  initialRotation: [number, number, number, number];
  signal?: AbortSignal;
};

function snapshotTerrain(terrain: TouchdownTerrain): TouchdownTerrain {
  const tuple = (v: number[], n: number) => Array.isArray(v) && v.length === n && Array.from(v).every(Number.isFinite);
  if (!Number.isInteger(terrain.columns) || !Number.isInteger(terrain.rows)
    || terrain.columns < 2 || terrain.rows < 2 || terrain.columns > 129 || terrain.rows > 129
    || !Number.isFinite(terrain.stepM) || terrain.stepM <= 0 || terrain.stepM > 1000
    || !Number.isFinite(terrain.x0M) || !Number.isFinite(terrain.z0M)
    || !(terrain.heightsM instanceof Float64Array) || terrain.heightsM.length !== terrain.columns * terrain.rows
    || !terrain.heightsM.every(Number.isFinite)
    || !tuple(terrain.initialPositionM, 3) || !tuple(terrain.initialVelocityMps, 3)
    || Math.hypot(terrain.initialVelocityMps[0], terrain.initialVelocityMps[2]) > 100
    || Math.abs(terrain.initialVelocityMps[1]) > 100
    || !tuple(terrain.initialRotation, 4) || Math.abs(Math.hypot(...terrain.initialRotation) - 1) > 1e-5) {
    throw new RangeError('Invalid terrain heightfield or initial state (100 m/s component bounds)');
  }
  return {...terrain, heightsM: terrain.heightsM.slice(), initialPositionM: [...terrain.initialPositionM],
    initialVelocityMps: [...terrain.initialVelocityMps], initialRotation: [...terrain.initialRotation]};
}

const STEP_S = 1 / 120;
const LUNAR_GRAVITY_MPS2 = 1.62;
const PARTS = [
  { centre: [0, 0, 0], half: [1.5, 0.9, 1.5] },
  { centre: [-3.15, -1.65, -3.15], half: [0.35, 0.15, 0.35] },
  { centre: [-3.15, -1.65, 3.15], half: [0.35, 0.15, 0.35] },
  { centre: [3.15, -1.65, -3.15], half: [0.35, 0.15, 0.35] },
  { centre: [3.15, -1.65, 3.15], half: [0.35, 0.15, 0.35] },
] as const;
const DEFAULT_FRAGMENTS: readonly TouchdownFragment[] = PARTS.map(({ centre, half }, index) => ({
  offset: centre, halfExtents: half, rotation: [0, 0, 0, 1], massShare: index === 0 ? 0.8 : 0.05,
}));

function snapshotFragments(fragments: readonly TouchdownFragment[]): TouchdownFragment[] {
  if (!Array.isArray(fragments) || fragments.length < 1 || fragments.length > MAX_TOUCHDOWN_FRAGMENTS) {
    throw new RangeError(`fragments must contain 1–${MAX_TOUCHDOWN_FRAGMENTS} boxes`);
  }
  const validTuple = (value: readonly number[], length: number) => Array.isArray(value)
    && value.length === length && Array.from(value).every(Number.isFinite);
  const snapshot = Array.from(fragments, (part: TouchdownFragment) => {
    if (!part || !validTuple(part.offset, 3) || part.offset.some(v => Math.abs(v) > 1000)
      || !validTuple(part.halfExtents, 3) || part.halfExtents.some(v => v < 0.005 || v > 1000)
      || !validTuple(part.rotation, 4) || Math.abs(Math.hypot(...part.rotation) - 1) > 1e-5
      || !Number.isFinite(part.massShare) || part.massShare <= 0 || part.massShare > 1) {
      throw new RangeError('Invalid fragment offset, rotation, halfExtents or massShare');
    }
    const norm = Math.hypot(...part.rotation);
    return {
      offset: [...part.offset] as [number, number, number],
      halfExtents: [...part.halfExtents] as [number, number, number],
      rotation: part.rotation.map(v => v / norm) as [number, number, number, number],
      massShare: part.massShare,
    };
  });
  const total = snapshot.reduce((sum, part) => sum + part.massShare, 0);
  if (Math.abs(total - 1) > 1e-6) throw new RangeError('Fragment massShare values must sum to one');
  snapshot.forEach(part => { part.massShare /= total; });
  return snapshot;
}

function rotate(v: readonly number[], q: readonly number[]): [number, number, number] {
  const [x, y, z, w] = q;
  const tx = 2 * (y * v[2] - z * v[1]);
  const ty = 2 * (z * v[0] - x * v[2]);
  const tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + y * tz - z * ty,
    v[1] + w * ty + z * tx - x * tz, v[2] + w * tz + x * ty - y * tx];
}

/** Lowest proxy point has the supplied vertical clearance over the plane. */
export function touchdownReleaseHeight(inputs: TouchdownInputs, fragments: readonly TouchdownFragment[] = DEFAULT_FRAGMENTS) {
  const slope = inputs.slopeDeg * Math.PI / 180, tilt = inputs.tiltDeg * Math.PI / 180;
  const normal = [Math.sin(tilt - slope), Math.cos(tilt - slope), 0];
  const minSupport = Math.min(...fragments.map(({ offset, halfExtents, rotation }) => {
    const local = rotate(normal, [-rotation[0], -rotation[1], -rotation[2], rotation[3]]);
    return normal.reduce((sum, n, i) => sum + n * offset[i], 0)
      - local.reduce((sum, n, i) => sum + Math.abs(n) * halfExtents[i], 0);
  }));
  return inputs.heightM - minSupport / Math.cos(slope);
}

let initialization: Promise<typeof import("@dimforge/rapier3d-compat")> | undefined;

function initializeRapier() {
  initialization ??= import("@dimforge/rapier3d-compat").then(async (rapier) => {
    await rapier.init();
    return rapier;
  }).catch((error: unknown) => {
    initialization = undefined;
    throw error;
  });
  return initialization;
}

function validateInputs(inputs: TouchdownInputs): TouchdownInputs {
  // Numerical operating bounds, not engineering limits or qualification evidence.
  const bounds: Record<keyof TouchdownInputs, readonly [number, number]> = {
    massKg: [0.01, 1e8],
    heightM: [0, 10000],
    verticalSpeedMps: [0, 100],
    horizontalSpeedMps: [0, 100],
    tiltDeg: [-180, 180],
    slopeDeg: [-80, 80],
    friction: [0, 5],
    restitution: [0, 1],
    failureEnergyJ: [0, 1e15],
  };
  if (!inputs || typeof inputs !== "object") throw new RangeError("Touchdown inputs are required");
  const snapshot = { ...inputs };
  for (const key of Object.keys(bounds) as Array<keyof TouchdownInputs>) {
    const [min, max] = bounds[key];
    if (!Number.isFinite(snapshot[key]) || snapshot[key] < min || snapshot[key] > max) {
      throw new RangeError(`${key} must be finite and within [${min}, ${max}]`);
    }
  }
  return snapshot;
}

function xyz(v: Vector): [number, number, number] {
  return [v.x, v.y, v.z];
}

function xyzw(q: Rotation): [number, number, number, number] {
  return [q.x, q.y, q.z, q.w];
}

/**
 * Uses @dimforge/rapier3d-compat 0.21.0, fixed 1/120 s output and 1.62 m/s² gravity.
 * Each output step permits up to eight internal CCD substeps for successive hits.
 * Each call advances exactly one step; no wall clock or random source is used.
 * Friction/restitution are Rapier contact coefficients, not lunar soil evidence:
 * https://rapier.rs/docs/user_guides/javascript/colliders/.
 *
 * Failure detaches the supplied boxes (default: the original five shapes),
 * at their solved poses and point velocities. There is no added explosion impulse
 * or duplicated parent body. This is illustrative breakage, not structural analysis.
 * Repeatability is for the same inputs and pinned engine/runtime, not a promise
 * of bitwise equivalence across future engine versions or platforms.
 */
export async function createTouchdownSimulation(inputs: TouchdownInputs, fragments?: readonly TouchdownFragment[], terrain?: TouchdownTerrain): Promise<{
  step(): TouchdownFrame;
  dispose(): void;
}> {
  const yieldTask = createPreparationYield();
  const values = validateInputs(inputs);
  const parts = snapshotFragments(fragments === undefined ? DEFAULT_FRAGMENTS : fragments);
  const field = terrain === undefined ? undefined : snapshotTerrain(terrain);
  const check = () => field?.signal?.throwIfAborted();
  // Yield before WASM initialization; larger model preparation yields every 8 boxes.
  await yieldTask();
  check();
  const rapier = await initializeRapier();
  check();
  const world = new rapier.World({ x: 0, y: -LUNAR_GRAVITY_MPS2, z: 0 });
  let events: EventQueue | undefined;
  try {
    if (field) events = new rapier.EventQueue(true);
    world.timestep = STEP_S;
    world.numSolverIterations = 8;
    // The default single CCD substep lets rotating NASA proxies penetrate terrain
    // after breakup. Resolve successive impacts inside the same 1/120 s step.
    world.maxCcdSubsteps = 8;

    const slope = values.slopeDeg * Math.PI / 180;
    const tilt = values.tiltDeg * Math.PI / 180;
    const normal = { x: -Math.sin(slope), y: Math.cos(slope), z: 0 };
    const material = (desc: ColliderDesc) => desc
      .setFriction(values.friction)
      .setRestitution(values.restitution);
    let groundShape: ColliderDesc;
    if (field) {
      // Static triangles outside the vehicle footprint are essential: fragments
      // land on the same patch after separating, not on an unrelated sphere.
      const vertices = new Float32Array(field.columns * field.rows * 3);
      const indices = new Uint32Array((field.columns - 1) * (field.rows - 1) * 6);
      let triangle = 0;
      for (let row = 0; row < field.rows; row++) {
        check();
        for (let col = 0; col < field.columns; col++) {
          const i = row * field.columns + col;
          vertices.set([field.x0M + col * field.stepM, field.heightsM[i], field.z0M + row * field.stepM], i * 3);
          if (row && col) {
            const a = i - field.columns - 1, b = i - 1;
            indices.set([a, b, a + 1, a + 1, b, i], triangle); triangle += 6;
          }
        }
        if (row % 8 === 0) await yieldTask();
      }
      check();
      groundShape = rapier.ColliderDesc.trimesh(vertices, indices, rapier.TriMeshFlags.FIX_INTERNAL_EDGES);
    } else groundShape = new rapier.ColliderDesc(new rapier.HalfSpace(normal));
    const ground = world.createCollider(material(groundShape).setCollisionGroups(0x00010002));

    const startY = touchdownReleaseHeight(values, parts);
    // Hard CCD alone misses fast box/half-space entry in this engine version.
    // Soft CCD covers one step's travel at the accepted entry speeds and heights.
    const ccdPredictionM = Math.max(0.02, STEP_S * (
      Math.hypot(values.verticalSpeedMps, values.horizontalSpeedMps)
        + Math.sqrt(2 * LUNAR_GRAVITY_MPS2 * values.heightM)
    ));
    const position = field?.initialPositionM ?? [0, startY, 0];
    const velocity = field?.initialVelocityMps ?? [values.horizontalSpeedMps, -values.verticalSpeedMps, 0];
    const rotation = field?.initialRotation ?? [0, 0, Math.sin(tilt / 2), Math.cos(tilt / 2)];
    const body = world.createRigidBody(rapier.RigidBodyDesc.dynamic()
      .setTranslation(position[0], position[1], position[2])
      .setRotation({ x: rotation[0], y: rotation[1], z: rotation[2], w: rotation[3] })
      .setLinvel(velocity[0], velocity[1], velocity[2])
      .setSoftCcdPrediction(ccdPredictionM)
      .setCcdEnabled(true));

    const masses = parts.slice(0, -1).map(part => values.massKg * part.massShare);
    masses.push(values.massKg - masses.reduce((sum, mass) => sum + mass, 0));
    if (masses.some(mass => !Number.isFinite(mass) || Math.fround(mass) <= 0)) throw new RangeError('Fragment mass is not representable');
    const colliders: Collider[] = [];
    const prepared: Array<{ body: RigidBody; collider: Collider; massKg: number }> = [];
    for (const [index, part] of parts.entries()) {
      check();
      const box = () => {
        const desc = material(rapier.ColliderDesc.cuboid(...part.halfExtents)).setMass(masses[index]);
        if (field) desc.setActiveEvents(rapier.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(0);
        return desc;
      };
      const [x, y, z, w] = part.rotation;
      colliders.push(world.createCollider(box().setTranslation(...part.offset).setRotation({ x, y, z, w })
        .setCollisionGroups(0x00020001), body));
      // Allocate bodies/colliders before Run, never on the contact frame. Detailed
      // display bounds overlap: omit mutual piece contact rather than inject a
      // separation impulse between overlapping approximate boxes.
      const fragment = world.createRigidBody(rapier.RigidBodyDesc.dynamic().setEnabled(false)
        .setSoftCcdPrediction(ccdPredictionM).setCcdEnabled(true));
      const collider = world.createCollider(box().setCollisionGroups(fragments ? 0x00020001 : 0xffffffff), fragment);
      prepared.push({ body: fragment, collider, massKg: masses[index] });
      if ((index + 1) % 8 === 0) await yieldTask();
    }
    check();
    let broken = false;
    let previousContacts = new Set<number>();
    let steps = 0;
    let disposed = false;

    const fracture = () => {
      // Sample before removing the parent: Rapier invalidates its collider handles.
      const pieces = colliders.map((collider) => ({
        position: collider.translation(),
        rotation: collider.rotation(),
        velocity: body.velocityAtPoint(collider.translation()),
      }));
      const spin = body.angvel();
      world.removeRigidBody(body);
      pieces.forEach((piece, index) => {
        const fragment = prepared[index].body;
        fragment.setTranslation(piece.position, false);
        fragment.setRotation(piece.rotation, false);
        fragment.setLinvel(piece.velocity, false);
        fragment.setAngvel(spin, false);
        fragment.setEnabled(true);
      });
      broken = true;
    };

    return {
      step() {
        if (disposed) throw new Error("Touchdown simulation is disposed");
        const intact = !broken;
        const velocity = intact ? body.linvel() : undefined;
        // Incoming energy is sampled before contact impulses remove/reverse velocity.
        const incomingEnergyJ = velocity ? 0.5 * values.massKg * (
          velocity.x ** 2 + (velocity.y - LUNAR_GRAVITY_MPS2 * STEP_S) ** 2 + velocity.z ** 2
        ) : 0;
        world.step(events);
        steps += 1;
        const contacts = new Set<number>();
        const activeColliders = intact ? colliders : prepared.map((part) => part.collider);
        activeColliders.forEach((collider, index) => {
          world.contactPair(ground, collider, (manifold) => {
            for (let i = 0; i < manifold.numContacts(); i += 1) {
              if (manifold.contactDist(i) <= 0 || manifold.contactImpulse(i) > 0) {
                contacts.add(index);
                break;
              }
            }
          });
        });
        // Soft CCD may apply an impulse then separate the pair in the same step.
        // Its post-step geometric manifold can be empty; retain that real solver
        // contact so high-speed terrain entries cannot skip the failure threshold.
        events?.drainContactForceEvents(event => {
          if (event.totalForceMagnitude() <= 0) return;
          const other = event.collider1() === ground.handle ? event.collider2()
            : event.collider2() === ground.handle ? event.collider1() : undefined;
          const index = activeColliders.findIndex(collider => collider.handle === other);
          if (index >= 0) contacts.add(index);
        });
        const newContact = [...contacts].some((index) => !previousContacts.has(index));
        if (intact && newContact && incomingEnergyJ >= values.failureEnergyJ) fracture();
        previousContacts = contacts;

        const trackedBody = broken ? prepared[0].body : body;
        return {
          timeS: steps * STEP_S,
          position: xyz(trackedBody.translation()),
          rotation: xyzw(trackedBody.rotation()),
          velocity: xyz(trackedBody.linvel()),
          contact: contacts.size > 0,
          broken,
          fragments: broken ? prepared.map((part) => ({
            position: xyz(part.body.translation()),
            rotation: xyzw(part.body.rotation()),
            massKg: part.massKg,
            velocity: xyz(part.body.linvel()),
            angularVelocity: xyz(part.body.angvel()),
          })) : [],
        };
      },
      dispose() {
        if (!disposed) {
          disposed = true;
          events?.free();
          world.free();
        }
      },
    };
  } catch (error) {
    events?.free();
    world.free();
    throw error;
  }
}
