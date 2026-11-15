import * as T from "three";
import {sampleGlobalHeight} from "@/lib/global-terrain";
import { latLonToProjected } from "@/lib/astro";
import { sampleGrid, type TerrainData, type TerrainGrid } from "@/lib/terrain";

export const MOON_RADIUS_M = 1_737_400;
export const METRES_PER_UNIT = 1000;
const RAD = Math.PI / 180;
const coarseToFinePatches = new WeakMap<TerrainData, TerrainGrid[]>();
export type SiteFrame = ReturnType<typeof siteFrame>;

// Render coordinates are kilometres: +X east, +Y local tangent up, −Z north.
// The body centre is below the selected site's reference radius, not below the DEM.
export function siteFrame(latDeg: number, lonDeg: number, referenceHeightM: number) {
  const lat = latDeg * RAD, lon = lonDeg * RAD;
  return {
    up: new T.Vector3(Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)),
    east: new T.Vector3(-Math.sin(lon), Math.cos(lon), 0),
    north: new T.Vector3(-Math.sin(lat) * Math.cos(lon), -Math.sin(lat) * Math.sin(lon), Math.cos(lat)),
    referenceRadiusM: MOON_RADIUS_M + referenceHeightM,
  };
}

export function bodyToScene(direction: T.Vector3, heightM: number, frame: SiteFrame) {
  const radiusKm = (MOON_RADIUS_M + heightM) / METRES_PER_UNIT;
  return new T.Vector3(
    direction.dot(frame.east) * radiusKm,
    direction.dot(frame.up) * radiusKm - frame.referenceRadiusM / METRES_PER_UNIT,
    -direction.dot(frame.north) * radiusKm,
  );
}

function edgeWeight(grid: TerrainGrid, xM: number, yM: number) {
  const col = (xM - grid.x0) / grid.stepM;
  const row = (grid.y0 - yM) / (grid.stepYM ?? grid.stepM);
  const edgeCells = Math.min(col, row, grid.width - 1 - col, grid.height - 1 - row);
  return T.MathUtils.smoothstep(edgeCells, 0, 4);
}

// A four-cell display seam blends numerical grids. Outside all DEMs the shape
// is explicitly the reference sphere; no texture brightness becomes elevation.
export function displayHeight(data: TerrainData | null, latDeg: number, lonDeg: number, referenceHeightM = 0) {
  if (!data) return { heightM: referenceHeightM, coverage: 0 };
  const { x, y } = latLonToProjected(latDeg, lonDeg);
  const overview = sampleGrid(data.overview, x, y);
  const coarse=data.globalTerrain?sampleGlobalHeight(data.globalTerrain,latDeg,lonDeg):null;
  let coverage = overview == null ? (coarse===null?0:0.25) : edgeWeight(data.overview, x, y);
  const overviewWeight=overview===null?0:edgeWeight(data.overview,x,y);
  let heightM = T.MathUtils.lerp(coarse??referenceHeightM,overview??coarse??referenceHeightM,overviewWeight);
  let patches = coarseToFinePatches.get(data);
  if (!patches) {
    // Reverse before stable sorting so the first equally resolved patch keeps
    // precedence, matching heightAt, while coarser cutouts remain underneath.
    patches = [...data.patches].reverse().sort((a, b) => (b.inputPixelM ?? b.stepM) - (a.inputPixelM ?? a.stepM));
    coarseToFinePatches.set(data, patches);
  }
  for (const patch of patches) {
    const height = sampleGrid(patch, x, y);
    if (height == null) continue;
    const weight = edgeWeight(patch, x, y);
    heightM = T.MathUtils.lerp(heightM, height, weight);
    coverage = Math.max(coverage, weight);
  }
  return { heightM, coverage };
}

function* normalSteps(geometry:T.BufferGeometry) {
  const positions = geometry.getAttribute('position').array;
  const indices = geometry.index!.array;

  const normalValues = new Float32Array(positions.length);
  const ab = new T.Vector3(), cb = new T.Vector3(), pa = new T.Vector3(), pb = new T.Vector3(), pc = new T.Vector3();
  for (let i = 0; i < indices.length; i += 3) {
    const a=indices[i], b=indices[i+1], c=indices[i+2];
    pa.fromArray(positions,a*3);pb.fromArray(positions,b*3);pc.fromArray(positions,c*3);
    cb.subVectors(pc,pb);ab.subVectors(pa,pb);cb.cross(ab);
    for(let j=0;j<3;j++) { const v=indices[i+j];normalValues[v*3]+=cb.x;normalValues[v*3+1]+=cb.y;normalValues[v*3+2]+=cb.z; }
    if(i % 12288 === 0) yield;
  }
  for(let i=0;i<normalValues.length;i+=3) {
    const n=Math.hypot(normalValues[i],normalValues[i+1],normalValues[i+2])||1;
    normalValues[i]/=n;normalValues[i+1]/=n;normalValues[i+2]/=n;
    if(i % 49152 === 0) yield;
  }
  geometry.setAttribute('normal',new T.BufferAttribute(normalValues,3));

}

export async function computeNormalsCooperatively(geometry:T.BufferGeometry, signal:AbortSignal) {
  let started=performance.now();
  for(const _step of normalSteps(geometry)) {
    void _step;signal.throwIfAborted();
    if(performance.now()-started>=5){await new Promise(resolve=>setTimeout(resolve,0));started=performance.now();}
  }
  signal.throwIfAborted();
}

function* surfaceSteps(data: TerrainData | null, frame: SiteFrame, renderFrame = frame, angularSegments = 384) {
  const geometry = new T.BufferGeometry();
  let complete = false;
  try {
  // One continuous closed surface: dense site detail, regional context, far side.
  // Rings are arc distances, in metres, from the selected site on the Moon.
  const distancesM = [0];
  const nearStepM = Math.max(8, Math.min(160, ...(data?.patches.map((patch) => Math.max(patch.stepM, patch.inputPixelM ?? data.sourcePixelM)) ?? [160])));
  for (const [endM, stepM] of [[500, nearStepM], [2000, Math.max(16, nearStepM)], [8000, Math.max(80, nearStepM)], [24_000, 160], [80_000, 800], [500_000, 2500], [Math.PI * MOON_RADIUS_M, 35_000]]) {
    const startM = distancesM.at(-1)!;
    const count = Math.ceil((endM - startM) / stepM);
    for (let i = 1; i <= count; i++) distancesM.push(T.MathUtils.lerp(startM, endM, i / count));
  }
  const count = distancesM.length * (angularSegments + 1);
  const positions = new Float32Array(count * 3), bodyDirections = new Float32Array(count * 3), coverage = new Float32Array(count);
  const indices = new Uint32Array((distancesM.length - 1) * angularSegments * 6);
  let vertex = 0, triangle = 0;
  const direction = new T.Vector3();
  for (let ring = 0; ring < distancesM.length; ring++) {
    const theta = distancesM[ring] / MOON_RADIUS_M;
    for (let col = 0; col <= angularSegments; col++) {
      const angle = col / angularSegments * Math.PI * 2;
      direction.copy(frame.up).multiplyScalar(Math.cos(theta))
        .addScaledVector(frame.east, Math.sin(theta) * Math.sin(angle))
        .addScaledVector(frame.north, Math.sin(theta) * Math.cos(angle));
      const latDeg = Math.asin(T.MathUtils.clamp(direction.z, -1, 1)) / RAD;
      const lonDeg = Math.atan2(direction.y, direction.x) / RAD;
      const sample = displayHeight(data, latDeg, lonDeg, frame.referenceRadiusM - MOON_RADIUS_M);
      const radiusKm=(MOON_RADIUS_M+sample.heightM)/METRES_PER_UNIT, offset=vertex*3;
      positions[offset]=direction.dot(renderFrame.east)*radiusKm;
      positions[offset+1]=direction.dot(renderFrame.up)*radiusKm-renderFrame.referenceRadiusM/METRES_PER_UNIT;
      positions[offset+2]=-direction.dot(renderFrame.north)*radiusKm;
      bodyDirections[offset]=direction.x;bodyDirections[offset+1]=direction.y;bodyDirections[offset+2]=direction.z;
      coverage[vertex++] = sample.coverage;
      if (ring > 0 && col > 0) {
        const a = (ring - 1) * (angularSegments + 1) + col - 1;
        const b = a + angularSegments + 1;
        indices[triangle++]=a;indices[triangle++]=a+1;indices[triangle++]=b;indices[triangle++]=a+1;indices[triangle++]=b+1;indices[triangle++]=b;
      }
    }
    yield;
  }
  geometry.setAttribute("position", new T.BufferAttribute(positions, 3));
  geometry.setAttribute("bodyDirection", new T.BufferAttribute(bodyDirections, 3));
  geometry.setAttribute("demCoverage", new T.BufferAttribute(coverage, 1));
  geometry.setIndex(new T.BufferAttribute(indices, 1));
  yield;
  yield* normalSteps(geometry);
  // Duplicate centre/pole vertices have degenerate adjacent triangles: assign
  // radial normals there so the site never becomes a black pinhole.
  const normals = geometry.getAttribute("normal");
  for (let ring = 1; ring < distancesM.length - 1; ring++) {
    const first = ring * (angularSegments + 1), last = first + angularSegments;
    const normal = new T.Vector3().fromBufferAttribute(normals, first)
      .add(new T.Vector3().fromBufferAttribute(normals, last)).normalize();
    normals.setXYZ(first, normal.x, normal.y, normal.z);
    normals.setXYZ(last, normal.x, normal.y, normal.z);
  }
  for (const ring of [0, distancesM.length - 1]) {
    const sign = ring === 0 ? 1 : -1;
    for (let col = 0; col <= angularSegments; col++) normals.setXYZ(ring * (angularSegments + 1) + col, sign * frame.up.dot(renderFrame.east), sign * frame.up.dot(renderFrame.up), -sign * frame.up.dot(renderFrame.north));
  }
  geometry.computeBoundingSphere();
  complete = true;
  return geometry;
  } finally { if (!complete) geometry.dispose(); }
}

/** Synchronous initial construction and deterministic numerical tests. */
export function buildSurface(data: TerrainData | null, frame: SiteFrame) {
  const steps = surfaceSteps(data, frame);
  let result = steps.next();
  while (!result.done) result = steps.next();
  return result.value;
}

/** Bounded chunks let the existing renderer animate while destination detail is sampled. */
export async function buildSurfaceCooperatively(data: TerrainData | null, frame: SiteFrame, renderFrame: SiteFrame, signal: AbortSignal,
  yieldControl: () => Promise<void> = () => new Promise(resolve => setTimeout(resolve, 0)), angularSegments = 384) {
  const steps = surfaceSteps(data, frame, renderFrame, angularSegments);
  let started = performance.now();
  while (true) {
    if (signal.aborted) { steps.return(undefined as never); throw new DOMException('Surface preparation canceled', 'AbortError'); }
    const result = steps.next();
    if (result.done) return result.value;
    if (performance.now() - started >= 5) { await yieldControl(); started = performance.now(); }
  }
}

export function flightVector(point: { eastM: number; northM: number; yM: number }) {
  return new T.Vector3(point.eastM, point.yM, -point.northM).divideScalar(METRES_PER_UNIT);
}

export function skyDirection(azDeg: number, elevationDeg: number) {
  const az = azDeg * RAD, elevation = elevationDeg * RAD;
  return new T.Vector3(Math.sin(az) * Math.cos(elevation), Math.sin(elevation), -Math.cos(az) * Math.cos(elevation));
}
