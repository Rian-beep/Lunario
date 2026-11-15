import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { missionReplayFitDistance } from '../../lib/mission-replay';
import { MISSION_TRAJECTORIES } from '../../lib/mission-trajectories-catalog';
import { trajectorySceneKm } from '../../lib/mission-trajectories';

for (const aspect of [390/480, 1600/480, .5]) {
 test(`every source path fits the ${aspect.toFixed(2)} aspect camera frustum`, () => {
  for (const data of MISSION_TRAJECTORIES) {
   const points=data.samples.map(s=>new T.Vector3(...trajectorySceneKm(s.position)));
   const box=new T.Box3().setFromPoints(points), target=box.getCenter(new T.Vector3());
   const radius=Math.max(box.getSize(new T.Vector3()).length(),2)/2;
   const camera=new T.PerspectiveCamera(45,aspect,.001,1e7);
   camera.position.copy(target).addScaledVector(target.clone().normalize(),missionReplayFitDistance(radius,aspect));
   camera.lookAt(target);camera.updateMatrixWorld();
   for(const point of points){const p=point.clone().project(camera);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z<1,`${data.id}: ${p.toArray()}`);}
  }
 });
}
test('framing rejects invalid inputs instead of producing a broken camera',()=>{
 for(const input of [[NaN,1],[1,0],[-1,1],[1,Infinity]])assert.throws(()=>missionReplayFitDistance(...input as [number,number]));
});
