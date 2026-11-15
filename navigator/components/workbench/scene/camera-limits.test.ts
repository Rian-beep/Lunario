import assert from 'node:assert/strict';
import test from 'node:test';
import {globeMinimumRadiusKm, outsideSphere} from './camera-limits';

test('globe approach limit is mesh radius plus clearance, not 2.5 lunar radii', () => {
  assert.equal(globeMinimumRadiusKm(1750),1750.05);
  assert.ok(globeMinimumRadiusKm(1750)<1800);
  assert.throws(()=>globeMinimumRadiusKm(NaN),RangeError);
});
test('physical sphere clamp allows an off-centre pan target without imposing orbit-target distance', () => {
  const centre=[0,-1737.4,0], camera=[0,25,0], target=[30,25,0];
  assert.deepEqual(outsideSphere(camera,centre,1750.05),camera);
  assert.ok(Math.hypot(...camera.map((v,i)=>v-target[i]))<1750.05);
  const clamped=outsideSphere([0,-10,0],centre,1750.05);
  assert.ok(Math.abs(Math.hypot(...clamped.map((v,i)=>v-centre[i]))-1750.05)<1e-9);
  assert.deepEqual(target,[30,25,0]);
  assert.ok(outsideSphere(centre,centre,1750).every(Number.isFinite));
});

test('real OrbitControls vertical rotation reaches both geographic poles with unchanged safe radius', async () => {
  const T=await import('three');
  const {OrbitControls}=await import('three/examples/jsm/controls/OrbitControls.js');
  const {allowFullPolarOrbit}=await import('./camera-limits');
  const {cameraBodyGeography}=await import('./geographic-navigation');
  const camera=new T.PerspectiveCamera();camera.up.set(0,0,1);camera.position.set(5000,0,0);
  const controls=new OrbitControls(camera);allowFullPolarOrbit(controls);controls.target.set(0,0,0);controls.update();
  controls.rotateUp(Math.PI/2-.0001);controls.update();
  assert.ok(cameraBodyGeography(camera.position.toArray())!.latDeg>89.99);
  controls.rotateUp(-Math.PI+.0002);controls.update();
  assert.ok(cameraBodyGeography(camera.position.toArray())!.latDeg< -89.99);
  assert.ok(Math.abs(camera.position.length()-5000)<1e-6);
  // A changed up axis needs a new controls instance, not just a changed camera.
  camera.up.set(0,1,0);const rebuilt=new OrbitControls(camera);allowFullPolarOrbit(rebuilt);rebuilt.update();
  assert.ok(cameraBodyGeography(camera.position.toArray())!.latDeg< -89.99);
  // No DOM element is attached in this numerical controls test.
});
