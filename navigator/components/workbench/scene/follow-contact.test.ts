import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import * as T from 'three';
import {normalizeEquipment, disposeEquipment} from '../../../lib/equipment';
import {prepareTouchdownFragments} from '../../../lib/touchdown-fragments';
import {ContactFrameCache, contactReadout, type PreparedContact} from './contact-dynamics';
import type {LandingContact} from '../../../lib/landing-contract';
import type {TouchdownFrame} from '../../../lib/touchdown-physics';

const source = readFileSync(new URL('./runtime.ts', import.meta.url), 'utf8');
// Execute the actual render-loop block: this regression needs flightChanged at
// the call site, rather than a helper that could leave a reset outside its seam.
const block = source.match(/    if \(!navigating && !assetMotion && \(settings.mode === "follow"[\s\S]*?\n    if\(sample\)/)?.[0].replace(/\n    if\(sample\)$/, '');
assert.ok(block, 'follow render block exists');
const follow = new Function('currentPoint','followPosition','camera','controls','flightChanged','settings','navigating','assetMotion', block);
const near = (actual:number, expected:number, tolerance=1e-10) => assert.ok(Math.abs(actual-expected)<tolerance, `${actual} ≈ ${expected}`);

for (const mode of ['follow', 'vehicle']) test(`${mode} translates edited trajectories and preserves the user's orbit and pan offset`,()=>{
  const previous=new T.Vector3(1,2,3), current=new T.Vector3(12,22,-7);
  const camera={position:previous.clone().add(new T.Vector3(3,4,5))}, controls={target:previous.clone().add(new T.Vector3(.1,.2,.3))};
  follow(current,previous,camera,controls,true,{mode},false,null);
  near(camera.position.distanceTo(current.clone().add(new T.Vector3(3,4,5))),0);
  near(controls.target.distanceTo(current.clone().add(new T.Vector3(.1,.2,.3))),0);
  assert.deepEqual(previous.toArray(),current.toArray());
  const pausedCamera=camera.position.clone(), pausedTarget=controls.target.clone();
  for(let i=0;i<100;i++) follow(current.clone(),previous,camera,controls,true,{mode},false,null);
  assert.deepEqual(camera.position,pausedCamera); assert.deepEqual(controls.target,pausedTarget);
  const rewind=new T.Vector3(1,2,3);
  follow(rewind,previous,camera,controls,false,{mode},false,null);
  near(camera.position.distanceTo(rewind.clone().add(new T.Vector3(3,4,5))),0);
  near(controls.target.distanceTo(rewind.clone().add(new T.Vector3(.1,.2,.3))),0);
});

test('breakup follows the physical mass centre independently of first-fragment position and descriptor shares',()=>{
  const parts=[{offset:[0,0,0] as const,rotation:[0,0,0,1] as const,halfExtents:[1,1,1] as const,massShare:.5},
    {offset:[1,0,0] as const,rotation:[0,0,0,1] as const,halfExtents:[1,1,1] as const,massShare:.5}];
  const prepared:PreparedContact={cache:new ContactFrameCache(parts,0,100),massKg:100,liftM:1,rotation:new T.Quaternion(),note:'fixture'};
  const contact:LandingContact={timeS:10,eastM:100,northM:50,yM:-20,velocityMps:[1,-2,3],massKg:100,
    terrainHeightM:-20,terrainKnown:true,slopeDeg:0,tiltDeg:0,headingDeg:0,targetErrorM:0};
  const frame:TouchdownFrame={timeS:0,position:[999,999,999],rotation:[0,0,0,1],velocity:[999,999,999],contact:true,broken:true,
    fragments:[{position:[0,0,0],rotation:[0,0,0,1],velocity:[1,2,3],angularVelocity:[0,0,0],massKg:25},
      {position:[20,40,60],rotation:[0,0,0,1],velocity:[5,6,7],angularVelocity:[0,0,0],massKg:75}]};
  const result=contactReadout(contact,prepared,frame);
  near(result.eastM,115); near(result.northM,5); near(result.yM,10); near(result.verticalMps,5);
  near(result.speedMps,Math.hypot(4,5,6));
  assert.deepEqual(result,contactReadout(contact,prepared,frame));
});

test('runtime descriptor preparation detaches NASA metre normalization from animated kilometre parents',async()=>{
  const mesh=new T.Mesh(new T.BoxGeometry(2,14,4),new T.MeshBasicMaterial());
  const model=normalizeEquipment(mesh), parent=new T.Group(); parent.scale.setScalar(.001);
  parent.position.set(900,500,-800); parent.rotation.set(.3,.5,.7); parent.add(model); parent.updateMatrixWorld(true);
  const preparation=source.match(/const source = model.clone\(true\); source.position.y = -3.5;[\s\S]*?const prepared = await prepareTouchdownFragments\(source, fragmentAbort.signal\);/)?.[0];
  assert.ok(preparation,'detached descriptor preparation exists');
  const prepare=new Function('model','prepareTouchdownFragments','fragmentAbort',`return (async()=>{${preparation};return prepared;})()`);
  try {
    const result=await prepare(model,prepareTouchdownFragments,new AbortController());
    near(result.bounds.max.y-result.bounds.min.y,7,1e-6);
    near(result.bounds.min.y,-3.5,1e-6); near(result.bounds.max.y,3.5,1e-6);
    near(result.descriptors[0].halfExtents[1],3.5,1e-6);
    assert.equal(model.parent,parent); near(parent.scale.x,.001);
  } finally {disposeEquipment(model);}
});

test('clearance finds terrain under proxy faces, including peaks missed by corner-only sampling', async()=>{
  const {minimumProxyTerrainClearance}=await import('./contact-dynamics');
  const terrain={columns:3,rows:3,stepM:2,x0M:-2,z0M:-2,heightsM:Float64Array.from([0,0,0,0,10,0,0,0,0]),
    initialPositionM:[0,8,0] as [number,number,number],initialRotation:[0,0,0,1] as [number,number,number,number],initialVelocityMps:[0,0,0] as [number,number,number]};
  const part={offset:[0,0,0] as const,rotation:[0,0,0,1] as const,halfExtents:[2,1,2] as const,massShare:1};
  const frame:TouchdownFrame={timeS:0,position:[0,8,0],rotation:[0,0,0,1],velocity:[0,0,0],contact:false,broken:false,fragments:[]};
  near(minimumProxyTerrainClearance(terrain,[part],frame)!,-3);
  assert.equal(minimumProxyTerrainClearance(terrain,[part],{...frame,position:[1,8,0]}),null,'outside finite collider is unavailable');
  assert.equal(minimumProxyTerrainClearance(terrain,[part],{...frame,broken:true}),null,'missing pieces cannot produce clearance');
});

test('minimum clearance agrees with analytic support of rotated boxes over a sloped negative-height plane', async()=>{
  const {minimumProxyTerrainClearance}=await import('./contact-dynamics');
  const terrain={columns:9,rows:9,stepM:5,x0M:-20,z0M:-20,heightsM:Float64Array.from({length:81},(_,i)=>-30+.25*(-20+i%9*5)-.5*(-20+Math.floor(i/9)*5)),
    initialPositionM:[0,0,0] as [number,number,number],initialRotation:[0,0,0,1] as [number,number,number,number],initialVelocityMps:[0,0,0] as [number,number,number]};
  const part={offset:[1,2,3] as const,rotation:new T.Quaternion().setFromEuler(new T.Euler(.3,.2,-.1)).toArray(),halfExtents:[2,1,3] as const,massShare:1};
  const rotation=new T.Quaternion().setFromEuler(new T.Euler(-.4,.1,.2));
  const frame:TouchdownFrame={timeS:0,position:[2,-27,1],rotation:rotation.toArray(),velocity:[0,0,0],contact:false,broken:false,fragments:[]};
  const position=new T.Vector3(...part.offset).applyQuaternion(rotation).add(new T.Vector3(...frame.position));
  const q=rotation.clone().multiply(new T.Quaternion(...part.rotation));
  const normal=new T.Vector3(-.25,1,.5),local=normal.clone().applyQuaternion(q.clone().invert());
  const expected=normal.dot(position)+30-local.toArray().reduce((sum,v,i)=>sum+Math.abs(v)*part.halfExtents[i],0);
  near(minimumProxyTerrainClearance(terrain,[part],frame)!,expected);
  const piece={position:position.toArray(),rotation:q.toArray(),velocity:[0,0,0] as [number,number,number],angularVelocity:[0,0,0] as [number,number,number],massKg:100};
  near(minimumProxyTerrainClearance(terrain,[part],{...frame,broken:true,position:[999,999,999],fragments:[piece]})!,expected);
});

test('cached playback retains the solver fragment masses instead of reconstructing them from descriptor shares',()=>{
  const parts=[{offset:[-1,0,0] as const,rotation:[0,0,0,1] as const,halfExtents:[1,1,1] as const,massShare:.5},
    {offset:[1,0,0] as const,rotation:[0,0,0,1] as const,halfExtents:[1,1,1] as const,massShare:.5}];
  const cache=new ContactFrameCache(parts,0,100);
  cache.append({timeS:0,position:[0,0,0],rotation:[0,0,0,1],velocity:[0,0,0],contact:true,broken:true,
    fragments:[25,75].map(massKg=>({position:[massKg,0,0],rotation:[0,0,0,1],velocity:[0,0,0],angularVelocity:[0,0,0],massKg}))});
  assert.deepEqual(cache.sample(0).fragments.map(p=>p.massKg),[25,75]);
  assert.equal(cache.sample(0).fragments.reduce((sum,p)=>sum+p.massKg,0),100);
});

test('local numerical terrain is clickable with the NASA globe hidden; missed paths and Earth cannot become Moon picks',async()=>{
  const {siteFrame}=await import('./surface');
  const body=source.match(/  const poiUp=\(event:PointerEvent\)=>\{[\s\S]*?\n  \};/)?.[0].replace('(event:PointerEvent)','(event)').replace(':T.Object3D[]','').replace('pickOrbital(event)!.id','pickOrbital(event).id');
  assert.ok(body,'surface picking handler exists');
  const camera=new T.PerspectiveCamera(45,1,.0001,100); camera.position.set(0,.02,0); camera.up.set(0,0,-1); camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
  const ground=new T.Mesh(new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),new T.MeshBasicMaterial()); ground.updateMatrixWorld(true);
  const globe=new T.Mesh(ground.geometry,ground.material); globe.visible=false;
  const earth=new T.Mesh(new T.SphereGeometry(.001),ground.material);earth.position.set(0,.01,0);earth.updateMatrixWorld(true);
  const path=new T.Mesh(new T.BoxGeometry(.001,.001,.001),ground.material); path.position.x=100;path.updateMatrixWorld(true);
  const lander=new T.Group(),contactPieces=new T.Group(),currentRing=new T.Group();lander.visible=contactPieces.visible=currentRing.visible=false;
  const realRaycaster=new T.Raycaster(),calls:T.Object3D[][]=[],placed:number[][]=[];
  const raycaster={params:realRaycaster.params,setFromCamera:(p:T.Vector2,c:T.Camera)=>realRaycaster.setFromCamera(p,c),
    intersectObjects:(objects:T.Object3D[],recursive:boolean)=>{calls.push(objects);return realRaycaster.intersectObjects(objects,recursive);}};
  const frame=siteFrame(-89,40,0);
  const sceneToBody=(p:T.Vector3)=>frame.east.clone().multiplyScalar(p.x).addScaledVector(frame.up,p.y+frame.referenceRadiusM/1000).addScaledVector(frame.north,-p.z);
  const {cameraBodyGeography}=await import('./geographic-navigation');
  const context={T,pointerDown:{x:50,y:50,button:0},pickPoi:()=>undefined,pickOrbital:()=>undefined,pickStation:()=>undefined,
    getLive:()=>({showFlight:true,onPlace:(lat:number,lon:number)=>placed.push([lat,lon])}),inspectStation:()=>assert.fail('unexpected Earth station'),
    renderer:{domElement:{getBoundingClientRect:()=>({left:0,top:0,width:100,height:100})}},pointer:new T.Vector2(),raycaster,camera,
    currentPoint:new T.Vector3(),path,currentRing,lander,contactPieces,onVehicleFocus:()=>assert.fail('missed path should fall through'),
    getSettings:()=>({mode:'orbit'}),nasaGlobe:{mesh:globe},ground,host:{dataset:{}},tuple:(p:T.Vector3)=>p.toArray(),sceneToBody,cameraBodyGeography};
  try {
    const handler=new Function(...Object.keys(context),`${body};return poiUp;`)(...Object.values(context));
    handler({clientX:50,clientY:50});
    assert.equal(placed.length,1);near(placed[0][0],-89,1e-9);near(placed[0][1],40,1e-9);
    assert.deepEqual(calls.at(-1),[ground]);assert.ok(calls.every(objects=>!objects.includes(earth)&&!objects.includes(globe)));
  } finally {ground.geometry.dispose();ground.material.dispose();path.geometry.dispose();earth.geometry.dispose();}
});

test('render telemetry uses current COM/sample state, leaves collective breakup attitude blank, and does not modify physics',()=>{
  const telemetry=source.match(/    \/\/ Observations of this completed render only\.[\s\S]*?host.dataset.renderFrame = String\(\+\+renderFrame\);/)?.[0];
  assert.ok(telemetry,'completed-render telemetry exists');
  assert.ok(source.indexOf('renderer.render(scene,camera)')<source.indexOf(telemetry),'observations follow rendering');
  const frame:TouchdownFrame={timeS:.25,position:[999,999,999],rotation:[0,0,0,1],velocity:[0,0,0],contact:true,broken:true,
    fragments:[{position:[1,2,3],rotation:[0,0,0,1],velocity:[0,0,0],angularVelocity:[0,0,0],massKg:123}]};
  const snapshot=JSON.stringify(frame), host={dataset:{} as Record<string,string>};
  const values={contactParts:{objects:[{visible:true}]},currentPoint:new T.Vector3(1,2,3),contactModel:{visible:false},dynamicsFrame:frame,
    lander:{visible:true,quaternion:new T.Quaternion()},contactPieces:{visible:true},host,touchdown:{timeS:10,massKg:123},
    dynamics:{phase:'broken',elapsedContactS:.25},vehicleMassKg:123,terrainClearanceM:-.001,live:{flightTime:10.257},CONTACT_STEP_S:1/120,renderFrame:4};
  const publish=new Function(...Object.keys(values),telemetry);
  publish(...Object.values(values));
  assert.equal(host.dataset.vehicleWorldPosition,'1,2,3'); assert.equal(host.dataset.vehicleQuaternion,'');
  assert.equal(host.dataset.vehicleVisible,'true');assert.equal(host.dataset.landingFragmentCount,'1');assert.equal(host.dataset.landingMassKg,'123');
  assert.equal(host.dataset.terrainClearanceM,'-0.001');assert.equal(host.dataset.landingContactFrameIndex,'30');
  assert.equal(host.dataset.landingContactFrameTimeS,'10.25');assert.equal(host.dataset.flightTimeS,'10.257');assert.equal(host.dataset.renderFrame,'5');
  assert.deepEqual(JSON.parse(host.dataset.landingContact),values.touchdown);assert.deepEqual(JSON.parse(host.dataset.landingDynamics),values.dynamics);
  assert.equal(JSON.stringify(frame),snapshot);
  publish(...Object.values({...values,contactParts:null,contactModel:null,dynamicsFrame:null,touchdown:undefined,dynamics:null,vehicleMassKg:null,terrainClearanceM:null,lander:{...values.lander,visible:false},contactPieces:{visible:false}}));
  for(const key of ['vehicleWorldPosition','vehicleQuaternion','landingContact','landingDynamics','landingMassKg','terrainClearanceM','landingContactTimeS','landingContactFrameIndex','landingContactFrameTimeS']) assert.equal(host.dataset[key],'',key);
  assert.equal(host.dataset.vehicleVisible,'false');assert.equal(host.dataset.landingFragmentCount,'0');
});

// Retargeting before focus finishes must complete the approach, not retain a distant offset.
test('Follow preserves only settled local camera offsets',()=>{
  const expression=source.match(/const trackingTransfer = ([\s\S]*?);/)?.[1];
  assert.ok(expression);
  const transfer=new Function('lastMode','settings','focusWasMoving',`return ${expression}`);
  assert.equal(transfer('vehicle',{mode:'follow'},false),true);
  assert.equal(transfer('vehicle',{mode:'follow'},true),false);
  assert.equal(transfer('globe',{mode:'follow'},false),false);
  assert.equal(transfer('follow',{mode:'vehicle'},false),true);
});
