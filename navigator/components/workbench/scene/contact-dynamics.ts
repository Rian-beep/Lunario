import {createPreparationYield} from '@/lib/yield-main-thread';
import * as T from 'three';
import type {FlightResult} from '@/lib/flight';
import type {LandingConfiguration, LandingContact, LandingDynamicsReadout, LandingOutcome} from '@/lib/landing-contract';
import type {TerrainData} from '@/lib/terrain';
import {createTouchdownSimulation, type TouchdownFrame, type TouchdownFragment, type TouchdownTerrain, MAX_TOUCHDOWN_FRAGMENTS} from '@/lib/touchdown-physics';
import {displayHeight, MOON_RADIUS_M, type SiteFrame} from './surface';

export type ContactFlight = FlightResult & {contact?: LandingContact; landingOutcome?: LandingOutcome;
  landingConfiguration?: LandingConfiguration; previewEndTimeS?: number};
export const CONTACT_STEP_S = 1 / 120;
export const MAX_CONTACT_SECONDS = 12;
const HEADER = 10, PIECE = 13;
export const CONTACT_MODEL_NOTE = 'Illustrative point-mass → rigid-body contact; 120 Hz replay with up to 8 CCD substeps per sample; nominal 7 m NASA geometry, box proxies and geometry-based mass. No soil, structural or vehicle qualification. Pieces contact terrain only; mutual piece contact omitted.';

/** Tangent +X east, +Y up, +Z south. This is a numerical height, never image relief.
 * Solve the vertical intersection with displayHeight, retaining lunar curvature.
 */
export function contactSurfaceHeight(data: TerrainData | null, frame: SiteFrame, eastM: number, southM: number) {
  let heightM = frame.referenceRadiusM - MOON_RADIUS_M, coverage = 0;
  const direction = new T.Vector3();
  let yM = 0;
  for (let i = 0; i < 8; i++) {
    const radius = MOON_RADIUS_M + heightM;
    const squared = radius * radius - eastM * eastM - southM * southM;
    if (squared <= 0) return {yM: NaN, coverage: 0};
    yM = Math.sqrt(squared) - frame.referenceRadiusM;
    direction.copy(frame.up).multiplyScalar(yM + frame.referenceRadiusM)
      .addScaledVector(frame.east, eastM).addScaledVector(frame.north, -southM).normalize();
    const sample = displayHeight(data, Math.asin(T.MathUtils.clamp(direction.z, -1, 1)) * 180 / Math.PI,
      Math.atan2(direction.y, direction.x) * 180 / Math.PI, frame.referenceRadiusM - MOON_RADIUS_M);
    const change = Math.abs(sample.heightM - heightM);
    heightM = sample.heightM; coverage = sample.coverage;
    if (change < 1e-7) return {yM: Math.sqrt((MOON_RADIUS_M + heightM) ** 2 - eastM ** 2 - southM ** 2) - frame.referenceRadiusM, coverage};
  }
  return {yM, coverage};
}

/** Match the engine's two triangles per cell, including negative heights. */
export function contactTerrainHeight(field: TouchdownTerrain, x: number, z: number): number | null {
  const col = (x - field.x0M) / field.stepM, row = (z - field.z0M) / field.stepM;
  if (!Number.isFinite(col) || !Number.isFinite(row) || col < 0 || row < 0 || col > field.columns - 1 || row > field.rows - 1) return null;
  const c = Math.min(field.columns - 2, Math.floor(col)), r = Math.min(field.rows - 2, Math.floor(row));
  const u = col - c, v = row - r, a = r * field.columns + c;
  const h = field.heightsM;
  return u + v <= 1 ? h[a] * (1 - u - v) + h[a + 1] * u + h[a + field.columns] * v
    : h[a + 1] * (1 - v) + h[a + field.columns] * (1 - u) + h[a + field.columns + 1] * (u + v - 1);
}

export async function prepareContactTerrain(data: TerrainData | null, frame: SiteFrame, contact: LandingContact,
  seconds: number, signal: AbortSignal): Promise<{field: TouchdownTerrain; note: string}> {
  const yieldTask = createPreparationYield();
  // Fixed vertex budget. Fine sampling of coarse source cells never upgrades evidence.
  // Normal impact energy can redirect into sliding or fragment motion. Sizing
  // from horizontal speed alone prematurely truncated otherwise valid crashes.
  // This remains a bounded collider, not a guarantee that every piece stays in it.
  const half = Math.max(64, 2 * Math.hypot(...contact.velocityMps) * seconds + 32);
  const columns = 65, rows = 65, stepM = 2 * half / (columns - 1);
  const heightsM = new Float64Array(columns * rows);
  let coverage = 1;
  for (let row = 0; row < rows; row++) {
    signal.throwIfAborted();
    for (let col = 0; col < columns; col++) {
      const sample = contactSurfaceHeight(data, frame, contact.eastM - half + col * stepM, -contact.northM - half + row * stepM);
      if (!Number.isFinite(sample.yM) || sample.coverage <= 0) throw new Error('Numerical terrain is unknown within the finite contact patch; contact replay unavailable.');
      coverage = Math.min(coverage, sample.coverage);
      heightsM[row * columns + col] = sample.yM - contact.yM;
    }
    if (row % 4 === 0) await yieldTask();
  }
  signal.throwIfAborted();
  return {field: {columns, rows, stepM, x0M: -half, z0M: -half, heightsM,
    initialPositionM: [0, 0, 0], initialVelocityMps: [contact.velocityMps[0], contact.velocityMps[1], -contact.velocityMps[2]],
    initialRotation: [0, 0, 0, 1], signal},
  note: `${Math.round(2 * half)} m finite contact patch, ${stepM.toFixed(1)} m collider sampling of the displayed numerical surface (triangular approximation). ${coverage < .99 ? 'Includes coarse/blended numerical context; not fine footprint evidence.' : 'Numerical DEM context is not qualified footprint evidence.'}`};
}

/** The flight anchor is the model's surface point; rigid origin is the centred
 * NASA model used by the lab. Derive its lift from proxy support over the patch.
 */
export function contactInitialPose(contact: LandingContact, frame: SiteFrame, field: TouchdownTerrain, parts: readonly TouchdownFragment[]) {
  const radial = new T.Vector3(contact.eastM, frame.referenceRadiusM + contact.yM, -contact.northM).normalize();
  const rotation = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), radial)
    .multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), -contact.headingDeg * Math.PI / 180))
    .multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(-1, 0, 0), contact.tiltDeg * Math.PI / 180));
  let liftM = -Infinity;
  for (const part of parts) {
    const q = new T.Quaternion(...part.rotation), offset = new T.Vector3(...part.offset);
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
      const p = new T.Vector3(x * part.halfExtents[0], y * part.halfExtents[1], z * part.halfExtents[2]).applyQuaternion(q).add(offset).applyQuaternion(rotation);
      const ground = contactTerrainHeight(field, p.x, p.z);
      if (ground === null) throw new Error('Vehicle proxy exceeds contact patch.');
      liftM = Math.max(liftM, ground - p.y);
    }
  }
  if (!Number.isFinite(liftM)) throw new Error('No contact geometry.');
  field.initialPositionM = [0, liftM + .002, 0];
  field.initialRotation = rotation.toArray();
  return {liftM: liftM + .002, rotation};
}

function proxyInside(field: TouchdownTerrain, position: number[], rotation: number[], part: TouchdownFragment) {
  const q = new T.Quaternion(...rotation);
  const x = Math.abs(1 - 2 * (q.y*q.y + q.z*q.z))*part.halfExtents[0]
    + Math.abs(2*(q.x*q.y-q.z*q.w))*part.halfExtents[1] + Math.abs(2*(q.x*q.z+q.y*q.w))*part.halfExtents[2];
  const z = Math.abs(2*(q.x*q.z-q.y*q.w))*part.halfExtents[0]
    + Math.abs(2*(q.y*q.z+q.x*q.w))*part.halfExtents[1] + Math.abs(1-2*(q.x*q.x+q.y*q.y))*part.halfExtents[2];
  return position[0]-x >= field.x0M && position[0]+x <= field.x0M+(field.columns-1)*field.stepM
    && position[2]-z >= field.z0M && position[2]+z <= field.z0M+(field.rows-1)*field.stepM;
}

/** Minimum signed vertical gap between oriented box proxies and the actual
 * finite triangle collider. Clip lower box faces against terrain triangles: a
 * terrain peak under a face can be missed by checking only the eight corners.
 * Linear height differences attain their minima at the clipped vertices.
 */
export function minimumProxyTerrainClearance(field: TouchdownTerrain, parts: readonly TouchdownFragment[], frame: Pick<TouchdownFrame, 'position' | 'rotation' | 'broken' | 'fragments'>): number | null {
  const faces = [[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]];
  const rootQ = new T.Quaternion(...frame.rotation), rootP = new T.Vector3(...frame.position);
  let minimum = Infinity;
  type Point = {x: number; z: number};
  const cross = (a: Point,b: Point,p: Point) => (b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x);
  const vertex = (col: number,row: number) => new T.Vector3(Math.fround(field.x0M+col*field.stepM),
    Math.fround(field.heightsM[row*field.columns+col]),Math.fround(field.z0M+row*field.stepM));
  for (const [index,part] of parts.entries()) {
    const piece = frame.broken ? frame.fragments[index] : null;
    if (frame.broken && !piece) return null;
    const q = piece ? new T.Quaternion(...piece.rotation) : rootQ.clone().multiply(new T.Quaternion(...part.rotation));
    const position = piece ? new T.Vector3(...piece.position) : new T.Vector3(...part.offset).applyQuaternion(rootQ).add(rootP);
    const corners = [-1,1].flatMap(x=>[-1,1].flatMap(y=>[-1,1].map(z=>new T.Vector3(x*part.halfExtents[0],y*part.halfExtents[1],z*part.halfExtents[2]).applyQuaternion(q).add(position))));
    if (corners.some(p=>!Number.isFinite(p.x+p.y+p.z) || p.x<Math.fround(field.x0M) || p.z<Math.fround(field.z0M)
      || p.x>Math.fround(field.x0M+(field.columns-1)*field.stepM) || p.z>Math.fround(field.z0M+(field.rows-1)*field.stepM))) return null;
    for (const face of faces) {
      const [a,b,c] = face.map(i=>corners[i]);
      const determinant = cross(a,b,c);
      if (determinant <= 1e-14) continue; // Upper/vertical faces cannot be the lowest support.
      const dyDx = ((b.y-a.y)*(c.z-a.z)-(c.y-a.y)*(b.z-a.z))/determinant;
      const dyDz = ((b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y))/determinant;
      const polygon = face.map(i=>corners[i]);
      const cols = polygon.map(p=>(p.x-field.x0M)/field.stepM), rows = polygon.map(p=>(p.z-field.z0M)/field.stepM);
      // Include adjacent cells at f32-rounded boundaries, as in the Rapier mesh.
      const c0=Math.max(0,Math.floor(Math.min(...cols))-1),c1=Math.min(field.columns-2,Math.floor(Math.max(...cols))+1);
      const r0=Math.max(0,Math.floor(Math.min(...rows))-1),r1=Math.min(field.rows-2,Math.floor(Math.max(...rows))+1);
      for (let row=r0;row<=r1;row++) for (let col=c0;col<=c1;col++) {
        const v00=vertex(col,row),v10=vertex(col+1,row),v01=vertex(col,row+1),v11=vertex(col+1,row+1);
        for (const triangle of [[v00,v10,v01],[v10,v11,v01]]) {
          let clipped: Point[] = polygon;
          for (let edge=0;edge<3 && clipped.length;edge++) {
            const start=triangle[edge],end=triangle[(edge+1)%3],input=clipped;clipped=[];
            for (let i=0;i<input.length;i++) {
              const p=input[i],next=input[(i+1)%input.length],d=cross(start,end,p),nextD=cross(start,end,next);
              if (d>=0) clipped.push(p);
              if ((d>=0)!==(nextD>=0)) {const t=d/(d-nextD);clipped.push({x:p.x+t*(next.x-p.x),z:p.z+t*(next.z-p.z)});}
            }
          }
          const [u,v,w]=triangle,area=cross(u,v,w);
          for (const p of clipped) {
            const ground=(cross(v,w,p)*u.y+cross(w,u,p)*v.y+cross(u,v,p)*w.y)/area;
            minimum=Math.min(minimum,a.y+dyDx*(p.x-a.x)+dyDz*(p.z-a.z)-ground);
          }
        }
      }
    }
  }
  return Number.isFinite(minimum) ? minimum : null;
}

/** One bounded flight, fixed 120 Hz samples, no world retained during replay. */
export class ContactFrameCache {
  readonly packed: Float64Array;
  readonly flags: Uint8Array;
  readonly stride: number;
  readonly partMassesKg: Float64Array;
  length = 0;
  stoppedReason = '';
  constructor(readonly parts: readonly TouchdownFragment[], readonly seconds: number, readonly massKg = 1) {
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > MAX_CONTACT_SECONDS || !parts.length || parts.length > MAX_TOUCHDOWN_FRAGMENTS || !Number.isFinite(massKg) || massKg <= 0) throw new RangeError('Invalid contact cache bounds');
    this.parts = parts.map(part => ({...part, offset:[...part.offset], halfExtents:[...part.halfExtents], rotation:[...part.rotation]}));
    const totalShare = parts.reduce((sum,part)=>sum+part.massShare,0);
    this.partMassesKg = Float64Array.from(parts,part=>massKg*part.massShare/totalShare);
    this.partMassesKg[parts.length-1] = massKg-this.partMassesKg.slice(0,-1).reduce((sum,mass)=>sum+mass,0);
    this.stride = HEADER + parts.length * PIECE;
    const frames = Math.floor(seconds / CONTACT_STEP_S + 1e-9) + 1;
    this.packed = new Float64Array(frames * this.stride);
    this.flags = new Uint8Array(frames);
  }
  append(frame: TouchdownFrame) {
    if (this.length >= this.flags.length) throw new RangeError('Contact cache full');
    const offset = this.length * this.stride;
    this.packed.set([...frame.position, ...frame.rotation, ...frame.velocity], offset);
    this.flags[this.length] = (frame.contact ? 1 : 0) | (frame.broken ? 2 : 0);
    frame.fragments.forEach((part, i) => {
      this.partMassesKg[i] = part.massKg;
      this.packed.set([...part.position, ...part.rotation, ...part.velocity, ...part.angularVelocity], offset + HEADER + i * PIECE);
    });
    this.length++;
  }
  sample(seconds: number): TouchdownFrame {
    if (!this.length || !Number.isFinite(seconds)) throw new RangeError('Invalid contact sample');
    const index = Math.min(this.length - 1, Math.max(0, Math.floor((seconds + 1e-9) / CONTACT_STEP_S)));
    const offset = index * this.stride, broken = !!(this.flags[index] & 2);
    const tuple = (start: number, count: number) => Array.from(this.packed.subarray(start, start + count));
    return {timeS: index * CONTACT_STEP_S, position: tuple(offset, 3) as [number, number, number],
      rotation: tuple(offset + 3, 4) as [number, number, number, number], velocity: tuple(offset + 7, 3) as [number, number, number],
      contact: !!(this.flags[index] & 1), broken, fragments: broken ? this.parts.map((part, i) => {
        const p = offset + HEADER + i * PIECE;
        return {position: tuple(p, 3) as [number, number, number], rotation: tuple(p + 3, 4) as [number, number, number, number],
          velocity: tuple(p + 7, 3) as [number, number, number], angularVelocity: tuple(p + 10, 3) as [number, number, number], massKg: this.partMassesKg[i]};
      }) : []};
  }
}

export type PreparedContact = {cache: ContactFrameCache; liftM: number; rotation: T.Quaternion; note: string; massKg: number; terrain?: TouchdownTerrain};
export function contactUnsupported(contact: LandingContact, configuration?: LandingConfiguration): string | null {
  if (!configuration) return 'Contact coefficients were not supplied; rigid-body continuation unavailable.';
  if (![contact.timeS, contact.eastM, contact.northM, contact.yM, contact.massKg, contact.tiltDeg, contact.headingDeg, ...contact.velocityMps].every(Number.isFinite)
    || contact.massKg < .01 || contact.massKg > 1e8 || Math.abs(contact.tiltDeg) > 180) return 'Contact state is outside the rigid-body numerical bounds.';
  if (Math.abs(contact.velocityMps[1]) > 100 || Math.hypot(contact.velocityMps[0], contact.velocityMps[2]) > 100) return 'Impact exceeds the rigid-body 100 m/s vertical/horizontal operating bounds; stopped at impact without clamping.';
  if (!contact.terrainKnown || contact.terrainHeightM === null || !Number.isFinite(contact.terrainHeightM)) return 'Contact terrain is unknown; stopped at impact.';
  return null;
}

export async function prepareContactReplay(contact: LandingContact, configuration: LandingConfiguration, data: TerrainData | null,
  frame: SiteFrame, parts: readonly TouchdownFragment[], signal: AbortSignal): Promise<PreparedContact> {
  const yieldTask = createPreparationYield();
  const unsupported = contactUnsupported(contact, configuration);
  if (unsupported) throw new Error(unsupported);
  const seconds = Math.min(MAX_CONTACT_SECONDS, configuration.contactPreviewSeconds);
  const {field, note} = await prepareContactTerrain(data, frame, contact, seconds, signal);
  const pose = contactInitialPose(contact, frame, field, parts);
  const cache = new ContactFrameCache(parts, seconds, contact.massKg);
  const inputs = {massKg: contact.massKg, heightM: 0, verticalSpeedMps: Math.abs(contact.velocityMps[1]),
    horizontalSpeedMps: Math.hypot(contact.velocityMps[0], contact.velocityMps[2]), tiltDeg: 0, slopeDeg: 0,
    friction: configuration.friction, restitution: configuration.restitution, failureEnergyJ: configuration.breakupEnergyJ};
  const simulation = await createTouchdownSimulation(inputs, parts, field);
  try {
    signal.throwIfAborted();
    cache.append({timeS: 0, position: field.initialPositionM, rotation: field.initialRotation, velocity: field.initialVelocityMps, contact: false, broken: false, fragments: []});
    let started = performance.now();
    while (cache.length < cache.flags.length) {
      signal.throwIfAborted();
      const next = simulation.step();
      const inside = next.broken ? next.fragments.every((piece, i) => proxyInside(field, piece.position, piece.rotation, parts[i]))
        : parts.every(part => proxyInside(field, new T.Vector3(...part.offset).applyQuaternion(new T.Quaternion(...next.rotation)).add(new T.Vector3(...next.position)).toArray(),
          new T.Quaternion(...next.rotation).multiply(new T.Quaternion(...part.rotation)).toArray(), part));
      if (!inside) {cache.stoppedReason = 'A proxy reached the finite terrain boundary; continuation stopped before leaving the collider.'; break;}
      cache.append(next);
      if (performance.now() - started >= 4) {await yieldTask(); started = performance.now();}
    }
    return {...pose, cache, terrain: field, note: `${note} Bounded ${seconds} s rigid-body preview; the final state is held afterward.`, massKg: contact.massKg};
  } finally {simulation.dispose();}
}

/** Obsolete promises cannot publish their result; abort also frees their world. */
export class ContactReplayGeneration {
  private abort: AbortController | null = null;
  current: PreparedContact | null = null;
  status: 'idle' | 'preparing' | 'ready' | 'unsupported' = 'idle';
  reason = '';
  invalidate() {this.abort?.abort(); this.abort = null; this.current = null; this.status = 'idle'; this.reason = '';}
  async prepare(factory: (signal: AbortSignal) => Promise<PreparedContact>) {
    this.invalidate();
    const abort = new AbortController(); this.abort = abort; this.status = 'preparing';
    try {
      const result = await factory(abort.signal);
      if (!abort.signal.aborted && this.abort === abort) {this.current = result; this.status = 'ready';}
    } catch (error) {
      if (!abort.signal.aborted && this.abort === abort) {this.reason = error instanceof Error ? error.message : 'Contact replay unavailable.'; this.status = 'unsupported';}
    }
  }
}

/** Actual mass-weighted rigid-body centre and velocity, before and after breakup. */
export function contactReadout(contact: LandingContact, prepared: PreparedContact, frame: TouchdownFrame): LandingDynamicsReadout {
  const p = new T.Vector3(...frame.position), v = new T.Vector3(...frame.velocity);
  if (!frame.broken) {
    const centre = new T.Vector3();
    prepared.cache.parts.forEach((part,i) => centre.addScaledVector(new T.Vector3(...part.offset), prepared.cache.partMassesKg[i]/prepared.massKg));
    p.add(centre.applyQuaternion(new T.Quaternion(...frame.rotation)));
  } else {
    p.set(0, 0, 0); v.set(0, 0, 0);
    const massKg = frame.fragments.reduce((sum,piece)=>sum+piece.massKg,0);
    frame.fragments.forEach(piece => {p.addScaledVector(new T.Vector3(...piece.position), piece.massKg / massKg);
      v.addScaledVector(new T.Vector3(...piece.velocity), piece.massKg / massKg);});
  }
  const stopped = prepared.cache.stoppedReason && frame.timeS >= (prepared.cache.length - 1) * CONTACT_STEP_S;
  return {phase: stopped ? 'unsupported' : frame.broken ? 'broken' : frame.contact && v.length() < .03 ? 'settled' : 'contact',
    elapsedContactS: frame.timeS, speedMps: v.length(), verticalMps: v.y,
    eastM: contact.eastM + p.x, northM: contact.northM - p.z, yM: contact.yM + p.y,
    fragmentCount: frame.fragments.length, note: `${stopped ? prepared.cache.stoppedReason : prepared.note} ${CONTACT_MODEL_NOTE}`};
}
