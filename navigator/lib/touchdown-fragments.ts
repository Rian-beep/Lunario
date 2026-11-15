import * as T from 'three';
import {MAX_TOUCHDOWN_FRAGMENTS, type TouchdownFragment} from './touchdown-physics';

// Numerical proxy floor, not a thickness inferred from NASA geometry/materials.
const MIN_HALF_M = 0.015;
const SLICE_MS = 4;
const VERTEX_BATCH = 2048;

export type PreparedTouchdownFragments = {
  descriptors: TouchdownFragment[];
  /** Clones share the source's geometry/materials. Dispose only the source asset. */
  objects: T.Group[];
  bounds: T.Box3;
  sourceMeshCount: number;
};

/**
 * Read decoded, already metre-normalized static Mesh vertices and world matrices.
 * Keep every original primitive and material; only the collision proxy is a box.
 * Mass shares use padded world AABB volumes, not closed-mesh/CAD mass properties.
 * Thin decorations get a 3 cm proxy floor. Assets exceeding the body budget merge
 * remaining primitives into the nearest retained box, deterministically.
 * Work yields between bounded vertex batches and batches of eight meshes.
 */
export async function prepareTouchdownFragments(model: T.Object3D, signal?: AbortSignal): Promise<PreparedTouchdownFragments> {
  const check = () => { signal?.throwIfAborted(); };
  const yieldTask = async () => { await new Promise<void>(resolve => setTimeout(resolve, 0)); check(); };
  check();
  await yieldTask();
  model.updateWorldMatrix(true, true);
  const meshes: T.Mesh[] = [];
  model.traverseVisible(object => {
    if (object instanceof T.Mesh) {
      if (object instanceof T.SkinnedMesh || object instanceof T.InstancedMesh || Object.keys(object.geometry.morphAttributes).length) {
        throw new Error('Touchdown fragments require static decoded mesh geometry');
      }
      meshes.push(object);
    }
  });
  if (!meshes.length) throw new Error('NASA model has no decoded mesh pieces');
  const point = new T.Vector3(), bounds = new T.Box3();
  const sources: {mesh: T.Mesh; matrix: T.Matrix4; bounds: T.Box3; centre: T.Vector3; volume: number; order: number}[] = [];
  let sliceStart = performance.now();
  for (const [order, mesh] of meshes.entries()) {
    const positions = mesh.geometry.getAttribute('position');
    if (!positions || positions.itemSize < 3 || positions.count < 3) throw new Error('Mesh piece has no valid decoded positions');
    const box = new T.Box3(), matrix = mesh.matrixWorld.clone();
    // Follow indexed/draw-range vertices: unused buffer positions are not a piece.
    const index = mesh.geometry.index;
    const available = index?.count ?? positions.count;
    const start = Math.max(0, mesh.geometry.drawRange.start);
    const end = Math.min(available, start + mesh.geometry.drawRange.count);
    for (let first = start; first < end; first += VERTEX_BATCH) {
      check();
      for (let i = first; i < Math.min(end, first + VERTEX_BATCH); i++) {
        const vertex = index ? index.getX(i) : i;
        if (!Number.isInteger(vertex) || vertex < 0 || vertex >= positions.count) throw new Error('Mesh piece has an invalid vertex index');
        point.fromBufferAttribute(positions, vertex).applyMatrix4(matrix);
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)) throw new Error('Mesh piece has nonfinite world bounds');
        box.expandByPoint(point);
      }
      if (performance.now() - sliceStart >= SLICE_MS) { await yieldTask(); sliceStart = performance.now(); }
    }
    if (box.isEmpty()) throw new Error('Mesh piece has empty world bounds');
    const size = box.getSize(new T.Vector3());
    const volume = Math.max(2 * MIN_HALF_M, size.x) * Math.max(2 * MIN_HALF_M, size.y) * Math.max(2 * MIN_HALF_M, size.z);
    sources.push({mesh, matrix, bounds: box, centre: box.getCenter(new T.Vector3()), volume, order});
    bounds.union(box);
    if ((order + 1) % 8 === 0) { await yieldTask(); sliceStart = performance.now(); }
  }
  // Stable source order for normal assets; preserve the largest boxes if merging.
  const ranked = sources.length <= MAX_TOUCHDOWN_FRAGMENTS ? sources : [...sources].sort((a, b) => b.volume - a.volume || a.order - b.order);
  const groups = ranked.slice(0, MAX_TOUCHDOWN_FRAGMENTS).map(source => ({
    bounds: source.bounds.clone(), centre: source.centre.clone(), sources: [source],
  }));
  for (let i = groups.length; i < ranked.length; i++) {
    const source = ranked[i];
    let nearest = groups[0], distance = Infinity;
    for (const group of groups) {
      const candidate = group.centre.distanceToSquared(source.centre);
      if (candidate < distance) { nearest = group; distance = candidate; }
    }
    nearest.bounds.union(source.bounds); nearest.sources.push(source);
    if (i % 8 === 0) await yieldTask();
  }
  const descriptors: TouchdownFragment[] = [], objects: T.Group[] = [];
  const volumes: number[] = [];
  for (const [index, group] of groups.entries()) {
    check();
    const centre = group.bounds.getCenter(new T.Vector3());
    const half = group.bounds.getSize(new T.Vector3()).multiplyScalar(0.5).max(new T.Vector3(MIN_HALF_M, MIN_HALF_M, MIN_HALF_M));
    const object = new T.Group(); object.position.copy(centre); object.visible = false;
    const inverse = new T.Matrix4().makeTranslation(-centre.x, -centre.y, -centre.z);
    for (const source of group.sources) {
      const clone = source.mesh.clone(false);
      clone.matrixAutoUpdate = false;
      clone.matrix.copy(inverse).multiply(source.matrix);
      object.add(clone);
    }
    volumes.push(8 * half.x * half.y * half.z);
    descriptors.push({offset: centre.toArray(), rotation: [0, 0, 0, 1], halfExtents: half.toArray(), massShare: 0});
    objects.push(object);
    if ((index + 1) % 8 === 0) await yieldTask();
  }
  const total = volumes.reduce((sum, volume) => sum + volume, 0);
  if (!Number.isFinite(total) || total <= 0) throw new Error('Mesh proxy volume is invalid');
  descriptors.forEach((part, index) => { part.massShare = volumes[index] / total; });
  return {descriptors, objects, bounds, sourceMeshCount: sources.length};
}
