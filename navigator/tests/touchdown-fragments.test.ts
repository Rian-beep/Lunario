import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import * as T from 'three';
import {build} from 'esbuild';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {normalizeEquipment} from '../lib/equipment';
import {prepareTouchdownFragments} from '../lib/touchdown-fragments';
import {createTouchdownSimulation, DEFAULT_TOUCHDOWN, MAX_TOUCHDOWN_FRAGMENTS, touchdownReleaseHeight, type TouchdownFragment, type TouchdownFrame} from '../lib/touchdown-physics';

type Simulation = Awaited<ReturnType<typeof createTouchdownSimulation>>;
const box = (offset: [number, number, number], massShare = 0.5): TouchdownFragment => ({offset, rotation: [0, 0, 0, 1], halfExtents: [.5, .5, .5], massShare});
const pair = () => [box([-1, 0, 0]), box([1, 0, 0])];
const vector = (v: readonly number[]) => new T.Vector3(...v);
const quaternion = (q: readonly number[]) => new T.Quaternion(...q);
function untilBroken(simulation: Simulation) {
  for (let i = 0; i < 2400; i++) {
    const frame = simulation.step();
    if (frame.broken) return frame;
  }
  assert.fail('Expected contact-triggered breakup');
}
function assertNear(a: number, b: number, tolerance = 1e-5) { assert.ok(Math.abs(a - b) < tolerance, `${a} ≈ ${b}`); }
function assertMatrix(a: T.Matrix4, b: T.Matrix4, tolerance = 1e-5) { a.elements.forEach((v, i) => assertNear(v, b.elements[i], tolerance)); }
function displayPieces(prepared: Awaited<ReturnType<typeof prepareTouchdownFragments>>, frame: TouchdownFrame) {
  for (const [i, fragment] of frame.fragments.entries()) {
    prepared.objects[i].position.fromArray(fragment.position);
    prepared.objects[i].quaternion.fromArray(fragment.rotation);
    prepared.objects[i].visible = true;
    prepared.objects[i].updateWorldMatrix(true, true);
  }
}

test('decoded vertices and nested transforms determine boxes; clones preserve actual geometry/material and fixed scale', async () => {
  const model = new T.Group(), parent = new T.Group();
  parent.position.set(2, -1, 3); parent.rotation.set(.2, .3, -.1); parent.scale.set(2, .6, 1.2); model.add(parent);
  const a = new T.Mesh(new T.BoxGeometry(1, 2, 3), new T.MeshStandardMaterial({color: 'gold'}));
  a.position.set(-2, 4, 1); a.rotation.y = .7; parent.add(a);
  const thin = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshStandardMaterial());
  thin.position.set(4, 2, -1); model.add(thin);
  const fixed = normalizeEquipment(model); fixed.position.y = -3.5;
  const prepared = await prepareTouchdownFragments(fixed);
  const expected = new T.Box3().setFromObject(fixed, true);
  assertNear(prepared.bounds.max.y - prepared.bounds.min.y, 7);
  assert.ok(prepared.bounds.equals(expected));
  assert.equal(prepared.descriptors.length, 2);
  assert.equal(prepared.sourceMeshCount, 2);
  for (const [i, original] of [a, thin].entries()) {
    const object = prepared.objects[i], clone = object.children[0] as T.Mesh;
    assert.equal(clone.geometry, original.geometry); assert.equal(clone.material, original.material);
    assert.equal(object.visible, false);
    object.updateWorldMatrix(true, true);
    assertMatrix(clone.matrixWorld, original.matrixWorld);
    assert.ok(prepared.descriptors[i].halfExtents.every(v => v >= .015));
    const actual = new T.Box3(); const positions = original.geometry.getAttribute('position');
    for (let j = 0; j < positions.count; j++) actual.expandByPoint(new T.Vector3().fromBufferAttribute(positions, j).applyMatrix4(original.matrixWorld));
    assertNear(vector(prepared.descriptors[i].offset).distanceTo(actual.getCenter(new T.Vector3())), 0);
  }
  assert.equal(fixed.scale.x, fixed.scale.y);
  assertNear(prepared.descriptors.reduce((sum, part) => sum + part.massShare, 0), 1);
  assert.ok(prepared.descriptors.every(part => part.massShare > 0));
});

test('more than 256 primitives merge deterministically without dropping render geometry, and work yields', async () => {
  const model = new T.Group(), geometry = new T.BoxGeometry(.2, .2, .2), material = new T.MeshBasicMaterial();
  for (let i = 0; i < 280; i++) { const mesh = new T.Mesh(geometry, material); mesh.position.x = i / 100; model.add(mesh); }
  let ticks = 0; const timer = setInterval(() => ticks++, 0);
  try {
    const [a, b] = await Promise.all([prepareTouchdownFragments(model), prepareTouchdownFragments(model)]);
    assert.equal(a.descriptors.length, MAX_TOUCHDOWN_FRAGMENTS);
    assert.equal(a.objects.reduce((sum, group) => sum + group.children.length, 0), 280);
    assert.equal(a.sourceMeshCount, 280); assert.deepEqual(a.descriptors, b.descriptors);
    assertNear(a.descriptors.reduce((sum, part) => sum + part.massShare, 0), 1);
    assert.ok(ticks >= 10, 'cooperative preparation must allow timer/event-loop work');
  } finally { clearInterval(timer); geometry.dispose(); material.dispose(); }
});

test('bad, empty, animated, cancelled and unused decoded geometry is handled explicitly', async () => {
  await assert.rejects(prepareTouchdownFragments(new T.Group()), /no decoded mesh/);
  const model = new T.Mesh(new T.BufferGeometry());
  await assert.rejects(prepareTouchdownFragments(model), /decoded positions/);
  model.geometry.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, NaN, 1, 1, 0, 1, 0], 3));
  await assert.rejects(prepareTouchdownFragments(model), /nonfinite/);
  model.geometry.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 1e5, 1e5, 1e5], 3));
  model.geometry.setIndex([0, 1, 2]);
  const prepared = await prepareTouchdownFragments(model);
  assert.equal(prepared.bounds.max.x, 1, 'unreferenced buffer vertex is excluded');
  const invalidIndex = new T.Mesh(model.geometry.clone()); invalidIndex.geometry.setIndex([0, 1, 99]);
  await assert.rejects(prepareTouchdownFragments(invalidIndex), /vertex index/);
  await assert.rejects(prepareTouchdownFragments(new T.SkinnedMesh(model.geometry)), /static decoded/);
  const abort = new AbortController(); const pending = prepareTouchdownFragments(model, abort.signal); abort.abort();
  await assert.rejects(pending, {name: 'AbortError'});
});

test('optional fragments conserve all mass, obey release clearance and move as dynamic bodies', async () => {
  const parts = pair(); parts[0].rotation = [0, 0, Math.sin(.3), Math.cos(.3)];
  const inputs = {...DEFAULT_TOUCHDOWN, massKg: 12345.67, heightM: .2, verticalSpeedMps: 8, horizontalSpeedMps: 2, tiltDeg: 12, slopeDeg: -8, failureEnergyJ: 0};
  const startY = touchdownReleaseHeight(inputs, parts);
  const tilt = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), inputs.tiltDeg * Math.PI / 180);
  let clearance = Infinity;
  for (const part of parts) for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    const p = new T.Vector3(x * part.halfExtents[0], y * part.halfExtents[1], z * part.halfExtents[2])
      .applyQuaternion(quaternion(part.rotation)).add(vector(part.offset)).applyQuaternion(tilt).add(new T.Vector3(0, startY, 0));
    clearance = Math.min(clearance, p.y - p.x * Math.tan(inputs.slopeDeg * Math.PI / 180));
  }
  assertNear(clearance, inputs.heightM);
  const simulation = await createTouchdownSimulation(inputs, parts);
  try {
    const frame = untilBroken(simulation);
    assert.equal(frame.fragments.length, 2); assert.equal(frame.contact, true);
    assert.equal(frame.fragments.reduce((sum, part) => sum + part.massKg, 0), inputs.massKg);
    for (const fragment of frame.fragments) assert.ok([...fragment.position, ...fragment.rotation, ...fragment.velocity, ...fragment.angularVelocity].every(Number.isFinite));
    const next = simulation.step();
    assert.notDeepEqual(next.fragments.map(p => p.position), frame.fragments.map(p => p.position));
    assert.equal(next.fragments.reduce((sum, part) => sum + part.massKg, 0), inputs.massKg);
  } finally { simulation.dispose(); }
});

test('breakup poses match intact geometry and inherit solved point velocities/spin without an explosion', async () => {
  const parts = pair(), inputs = {...DEFAULT_TOUCHDOWN, heightM: .1, verticalSpeedMps: 5, horizontalSpeedMps: 3, tiltDeg: 25, failureEnergyJ: 0};
  const [breaking, intact] = await Promise.all([createTouchdownSimulation(inputs, parts), createTouchdownSimulation({...inputs, failureEnergyJ: 1e15}, parts)]);
  try {
    let a = breaking.step(), b = intact.step();
    while (!a.broken) { a = breaking.step(); b = intact.step(); }
    assert.equal(b.broken, false);
    const pose = new T.Matrix4().compose(vector(b.position), quaternion(b.rotation), new T.Vector3(1, 1, 1));
    const spin = vector(a.fragments[0].angularVelocity), com = new T.Vector3();
    parts.forEach(part => com.addScaledVector(vector(part.offset), part.massShare));
    com.applyMatrix4(pose);
    for (const [i, fragment] of a.fragments.entries()) {
      const expected = vector(parts[i].offset).applyMatrix4(pose);
      assertNear(vector(fragment.position).distanceTo(expected), 0);
      assertNear(quaternion(fragment.rotation).angleTo(quaternion(b.rotation).multiply(quaternion(parts[i].rotation))), 0, .001);
      const expectedVelocity = vector(b.velocity).add(spin.clone().cross(expected.clone().sub(com)));
      assertNear(vector(fragment.velocity).distanceTo(expectedVelocity), 0, 1e-4);
      assert.deepEqual(fragment.angularVelocity, a.fragments[0].angularVelocity);
    }
  } finally { breaking.dispose(); intact.dispose(); }
});

test('optional geometry snapshots cannot be mutated and fresh/reset runs repeat deterministically', async () => {
  const inputs = {...DEFAULT_TOUCHDOWN, heightM: .1, verticalSpeedMps: 5, failureEnergyJ: 0}, parts = pair();
  const pending = createTouchdownSimulation(inputs, parts);
  parts[0].offset = [999, 999, 999]; parts[0].massShare = .99;
  const a = await pending, b = await createTouchdownSimulation(inputs, pair());
  let first!: TouchdownFrame;
  try {
    for (let i = 0; i < 240; i++) {
      const frame = a.step(); assert.deepEqual(frame, b.step());
      if (i === 0) { first = structuredClone(frame); assert.equal(first.broken, false); }
      if (frame.broken) frame.fragments[0].position[0] = 1e20;
    }
  } finally { a.dispose(); b.dispose(); }
  const reset = await createTouchdownSimulation(inputs, pair());
  try { assert.deepEqual(reset.step(), first); } finally { reset.dispose(); }
});

test('optional descriptor bounds reject missing, nonfinite, zero-mass, degenerate and excessive pieces', async () => {
  const invalid: unknown[] = [[], null, [box([0, 0, 0])], [box([0, 0, 0], 1e-300), box([1, 0, 0], 1)], Array(2), Array.from({length: 257}, () => box([0, 0, 0], 1 / 257))];
  for (const change of [{offset: [0, Infinity, 0]}, {offset: [1001, 0, 0]}, {halfExtents: [.5, 0, .5]}, {halfExtents: [.5, .001, .5]}, {rotation: [0, 0, 0, 0]}, {rotation: [0, 0, 0]}, {offset: Array(3)}, {rotation: Array(4)}, {massShare: 0}, {massShare: NaN}, {massShare: -.5}, {offset: undefined}]) invalid.push([{...box([0, 0, 0], 1), ...change}]);
  for (const descriptors of invalid) await assert.rejects(createTouchdownSimulation(DEFAULT_TOUCHDOWN, descriptors as TouchdownFragment[]), /fragment|Fragment/);
});

test('overlapping decorative proxies do not generate artificial mutual separation impulses', async () => {
  const simulation = await createTouchdownSimulation({...DEFAULT_TOUCHDOWN, heightM: .05, restitution: 0, failureEnergyJ: 0}, [box([0, 0, 0]), box([0, 0, 0])]);
  try {
    let frame = untilBroken(simulation);
    for (let i = 0; i < 120; i++) frame = simulation.step();
    assert.deepEqual(frame.fragments[0].position, frame.fragments[1].position);
    assert.ok(Math.hypot(...frame.fragments[0].velocity) < .01);
    assert.ok(frame.contact);
  } finally { simulation.dispose(); }
});

// Decode the committed NASA bytes through the same local Draco decoder, without a
// browser/WebGL/server. This fixture intentionally keeps the decoded primitives.
async function nasaModel() {
  const bytes = await readFile(new URL('../public/data/equipment/apollo-lunar-module.glb', import.meta.url));
  const jsonSize = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonSize).toString());
  const context = vm.createContext({console, TextDecoder, setTimeout, clearTimeout});
  vm.runInContext(await readFile(new URL('../public/data/equipment/draco/draco_decoder.js', import.meta.url), 'utf8'), context);
  const draco = await context.DracoDecoderModule();
  const meshes: T.Group[] = [];
  for (const mesh of gltf.meshes) {
    const group = new T.Group();
    for (const primitive of mesh.primitives) {
      const compressed = primitive.extensions.KHR_draco_mesh_compression;
      const view = gltf.bufferViews[compressed.bufferView], offset = 20 + jsonSize + 8 + (view.byteOffset ?? 0);
      const decoder = new draco.Decoder(), buffer = new draco.DecoderBuffer(), geometry = new draco.Mesh();
      const array = new draco.DracoFloat32Array();
      try {
        buffer.Init(new Int8Array(bytes.subarray(offset, offset + view.byteLength)), view.byteLength);
        const status = decoder.DecodeBufferToMesh(buffer, geometry); assert.ok(status.ok(), status.error_msg());
        const position = decoder.GetAttributeByUniqueId(geometry, compressed.attributes.POSITION);
        assert.ok(decoder.GetAttributeFloatForAllPoints(geometry, position, array));
        const values = Float32Array.from({length: geometry.num_points() * 3}, (_, i) => array.GetValue(i));
        const decoded = new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(values, 3));
        group.add(new T.Mesh(decoded, new T.MeshStandardMaterial()));
      } finally { [array, geometry, buffer, decoder].forEach(value => draco.destroy(value)); }
    }
    meshes.push(group);
  }
  const nodes: T.Object3D[] = gltf.nodes.map((node: {mesh?: number}) => node.mesh === undefined ? new T.Group() : meshes[node.mesh]);
  gltf.nodes.forEach((node: {children?: number[]; matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[]}, i: number) => {
    if (node.matrix) { nodes[i].matrix.fromArray(node.matrix); nodes[i].matrix.decompose(nodes[i].position, nodes[i].quaternion, nodes[i].scale); }
    if (node.translation) nodes[i].position.fromArray(node.translation);
    if (node.rotation) nodes[i].quaternion.fromArray(node.rotation);
    if (node.scale) nodes[i].scale.fromArray(node.scale);
    node.children?.forEach(child => nodes[i].add(nodes[child]));
  });
  const scene = new T.Group(); gltf.scenes[gltf.scene ?? 0].nodes.forEach((i: number) => scene.add(nodes[i]));
  const normalized = normalizeEquipment(scene); normalized.position.y = -3.5;
  return normalized;
}

test('actual decoded NASA primitives keep their 7 m shape at breakup; all bounded engine pieces remain finite', async () => {
  const model = await nasaModel(), prepared = await prepareTouchdownFragments(model);
  assert.equal(prepared.sourceMeshCount, 157); assert.equal(prepared.descriptors.length, 157);
  assertNear(prepared.bounds.max.y - prepared.bounds.min.y, 7);
  const inputs = {...DEFAULT_TOUCHDOWN, massKg: 11000, heightM: .1, verticalSpeedMps: 8, horizontalSpeedMps: 2, tiltDeg: 8, failureEnergyJ: 0};
  const [breaking, intact] = await Promise.all([createTouchdownSimulation(inputs, prepared.descriptors), createTouchdownSimulation({...inputs, failureEnergyJ: 1e15}, prepared.descriptors)]);
  try {
    let a = breaking.step(), b = intact.step();
    while (!a.broken) { a = breaking.step(); b = intact.step(); }
    const pose = new T.Group(); pose.position.fromArray(b.position); pose.quaternion.fromArray(b.rotation); pose.add(model); pose.updateWorldMatrix(true, true);
    const originals: T.Mesh[] = []; model.traverse(object => { if (object instanceof T.Mesh) originals.push(object); });
    displayPieces(prepared, a);
    prepared.objects.forEach((group, i) => {
      const clone = group.children[0] as T.Mesh;
      assertMatrix(clone.matrixWorld, originals[i].matrixWorld);
      assert.equal(clone.geometry, originals[i].geometry); assert.equal(clone.material, originals[i].material);
    });
    assert.equal(a.fragments.reduce((sum, part) => sum + part.massKg, 0), inputs.massKg);
    for (let i = 0; i < 120; i++) a = breaking.step();
    assert.equal(a.fragments.length, 157);
    assert.ok(a.fragments.every(part => [...part.position, ...part.rotation, ...part.velocity].every(Number.isFinite)));
    assert.ok(a.fragments.every(part => part.massKg > 0));
  } finally { breaking.dispose(); intact.dispose(); }
});

test('maximum fragment body budget yields during startup and does not grow at repeated contact', async () => {
  const parts = Array.from({length: MAX_TOUCHDOWN_FRAGMENTS}, (_, i) => ({...box([i % 16, Math.floor(i / 16), 0], 1 / MAX_TOUCHDOWN_FRAGMENTS), halfExtents: [.1, .1, .1] as const}));
  let ticks = 0; const timer = setInterval(() => ticks++, 0);
  let simulation: Simulation | undefined;
  try {
    simulation = await createTouchdownSimulation({...DEFAULT_TOUCHDOWN, heightM: 0, failureEnergyJ: 0}, parts);
    assert.ok(ticks >= 20, 'large startup yields between body batches');
    let frame = untilBroken(simulation);
    for (let i = 0; i < 120; i++) frame = simulation.step();
    assert.equal(frame.fragments.length, MAX_TOUCHDOWN_FRAGMENTS);
    assert.equal(frame.fragments.reduce((sum, part) => sum + part.massKg, 0), DEFAULT_TOUCHDOWN.massKg);
  } finally { simulation?.dispose(); clearInterval(timer); }
});

test('lab SSR retains dismiss/reset controls, honest geometry assumptions and readable labels without Node CSS bypasses', async () => {
  const compiled = await build({entryPoints: ['components/workbench/touchdown-lab.tsx'], outfile: 'touchdown-lab-fixture.cjs', bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', jsx: 'automatic'});
  const output = {exports: {} as {TouchdownLab: (props: {onClose: () => void}) => React.ReactNode}};
  new Function('require', 'module', 'exports', compiled.outputFiles.find(file => file.path.endsWith('.cjs'))!.text)(createRequire(import.meta.url), output, output.exports);
  const html = renderToStaticMarkup(createElement(output.exports.TouchdownLab, {onClose: () => {}}));
  assert.match(html, /Rigid-body touchdown/); assert.match(html, /Close touchdown lab/); assert.match(html, />Reset</);
  assert.match(html, /Friction coefficient \(1\)/); assert.match(html, /Restitution \(1\)/);
  assert.match(html, /geometry-based mass shares/); assert.match(html, /mutual piece collisions are omitted/); assert.match(html, /not a vehicle-qualified simulation/);
  assert.doesNotMatch(html, /One metre stays one metre|five actual collision boxes/);
  const css = await readFile(new URL('../components/workbench/touchdown-lab.module.css', import.meta.url), 'utf8');
  assert.match(css, /\.fieldLabel label \{ font-size: 13px/); assert.match(css, /\.notes \{[^}]*font-size: 14px/);
});
