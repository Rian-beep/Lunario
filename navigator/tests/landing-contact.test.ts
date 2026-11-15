import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import * as T from 'three';
import {normalizeEquipment, disposeEquipment} from '../lib/equipment';
import {prepareTouchdownFragments} from '../lib/touchdown-fragments';
import type {TouchdownFragment, TouchdownFrame, TouchdownTerrain} from '../lib/touchdown-physics';
import {DEFAULT_LANDING_CONFIGURATION, type LandingContact} from '../lib/landing-contract';
import {ContactFrameCache, ContactReplayGeneration, prepareContactReplay, contactUnsupported, contactInitialPose,
  contactReadout, prepareContactTerrain, contactTerrainHeight, contactSurfaceHeight, MAX_CONTACT_SECONDS, type PreparedContact} from '../components/workbench/scene/contact-dynamics';
import {siteFrame} from '../components/workbench/scene/surface';
import {latLonToProjected} from '../lib/astro';
import type {TerrainData} from '../lib/terrain';
const config={...DEFAULT_LANDING_CONFIGURATION};
const parts: TouchdownFragment[]=[{offset:[-1,0,0],rotation:[0,0,0,1],halfExtents:[.5,.5,.5],massShare:.4},
  {offset:[1,0,0],rotation:[0,0,0,1],halfExtents:[.5,.5,.5],massShare:.6}];
function contact():LandingContact {return {timeS:25,eastM:15,northM:-20,yM:0,velocityMps:[3,-5,4],massKg:9876.5,
  terrainHeightM:0,terrainKnown:true,slopeDeg:0,tiltDeg:5,headingDeg:90,targetErrorM:25};}
function data(elevationM=0):TerrainData {const {x,y}=latLonToProjected(-89,40);return {version:1,source:'fixture',sourcePage:'fixture',retrievedUtc:'fixture',frame:'fixture',sourcePixelM:100,sampling:'fixture',patches:[],
  overview:{id:'fixture',width:81,height:81,x0:x-4000,y0:y+4000,stepM:100,heights:Array(81*81).fill(elevationM)}};}
const prepare=(c=contact(),configuration=config,p=parts,signal=new AbortController().signal)=>prepareContactReplay(c,configuration,data(),siteFrame(-89,40,0),p,signal);
function near(a:number,b:number,tol=1e-5){assert.ok(Math.abs(a-b)<tol,`${a} ≈ ${b}`);}
function rigidFrame(timeS=0):TouchdownFrame{return {timeS,position:[1,2,3],rotation:[0,0,0,1],velocity:[-4,5,-6],contact:false,broken:false,fragments:[]};}

test('exact SI handoff and model-origin lift are continuous at first contact, including heading/tilt',async()=>{
  const c=contact(),prepared=await prepare(c,{...config,contactPreviewSeconds:.1});
  const zero=prepared.cache.sample(0);assert.deepEqual(zero.velocity,[3,-5,-4]);
  near(zero.position[0],0);near(zero.position[1],prepared.liftM);near(zero.position[2],0);
  const before=new T.Vector3(c.eastM,c.yM,-c.northM).add(new T.Vector3(0,prepared.liftM,0));
  const after=new T.Vector3(c.eastM,c.yM,-c.northM).add(new T.Vector3(...zero.position));
  near(before.distanceTo(after),0,1e-12);near(prepared.rotation.angleTo(new T.Quaternion(...zero.rotation)),0,1e-7);
  const modelUp=new T.Vector3(0,1,0).applyQuaternion(prepared.rotation);assert.ok(modelUp.x>0,'positive tilt follows eastward heading');
});

test('scrubbing, pause, replay and fresh reset are deterministic without advancing or retaining a world',async()=>{
  const a=await prepare(contact(),{...config,contactPreviewSeconds:2,breakupEnergyJ:0});
  const b=await prepare(contact(),{...config,contactPreviewSeconds:2,breakupEnergyJ:0});
  const times=[0,.1,.3,1.5,2,.1,0,2];
  for(const time of times){assert.deepEqual(a.cache.sample(time),b.cache.sample(time));assert.deepEqual(a.cache.sample(time),a.cache.sample(time));}
  assert.equal(a.cache.length,241);const impact=a.cache.sample(1);assert.equal(impact.broken,true);assert.equal(impact.fragments.length,2);
  near(impact.fragments.reduce((sum,p)=>sum+p.massKg,0),contact().massKg,1e-10);
  const original=a.cache.sample(.1);a.cache.sample(.1).position[1]=-1e10;assert.deepEqual(a.cache.sample(.1),original);
  assert.equal('step' in a,false);assert.equal('world' in a,false);
});

test('replay memory is bounded to a single finite twelve-second flight, even at the body budget',()=>{
  const p=Array.from({length:256},()=>({...parts[0],massShare:1/256}));
  const cache=new ContactFrameCache(p,MAX_CONTACT_SECONDS);
  assert.equal(cache.flags.length,1441);assert.ok(cache.packed.byteLength+cache.flags.byteLength<40_000_000);
  assert.throws(()=>new ContactFrameCache(p,12.001),/bounds/);assert.throws(()=>new ContactFrameCache(p,Infinity),/bounds/);
  assert.throws(()=>new ContactFrameCache([...p,p[0]],12),/bounds/);
  const tiny=new ContactFrameCache(parts,0);tiny.append(rigidFrame());assert.throws(()=>tiny.append(rigidFrame()),/full/);
  assert.deepEqual(tiny.sample(-5),tiny.sample(0));assert.deepEqual(tiny.sample(100),tiny.sample(0));
  assert.throws(()=>tiny.sample(NaN),/sample/);
});

test('unknown, missing configuration and unsupported hypervelocity cannot silently clamp into contact physics',async()=>{
  assert.match(contactUnsupported({...contact(),velocityMps:[2000,-2000,0]},config)!,/without clamping/);
  assert.match(contactUnsupported(contact())!,/not supplied/);
  assert.match(contactUnsupported({...contact(),terrainKnown:false},config)!,/unknown/);
  assert.equal(contactUnsupported({...contact(),velocityMps:[0,-100,0]},config),null);
  await assert.rejects(prepare({...contact(),velocityMps:[101,-2,0]}),/100 m\/s/);
  await assert.rejects(prepare({...contact(),massKg:NaN}),/bounds/);
  await assert.rejects(prepare(contact(),{...config,friction:NaN}),/friction/);
});

test('actual rigid positions/velocities drive the readout; breakup reports mass-weighted motion in flight axes',()=>{
  const cache=new ContactFrameCache(parts,1,100),p:PreparedContact={cache,liftM:.5,rotation:new T.Quaternion(),note:'finite patch',massKg:100};
  const intact=contactReadout(contact(),p,rigidFrame(.5));near(intact.speedMps,Math.hypot(4,5,6));near(intact.eastM,16.2);near(intact.northM,-23);near(intact.yM,2);
  const f=rigidFrame(.7);f.broken=true;f.fragments=[{position:[10,20,30],rotation:[0,0,0,1],velocity:[1,-2,3],angularVelocity:[0,0,0],massKg:40},
    {position:[20,30,40],rotation:[0,0,0,1],velocity:[6,8,-2],angularVelocity:[0,0,0],massKg:60}];
  const r=contactReadout(contact(),p,f);near(r.eastM,31);near(r.northM,-56);near(r.yM,26);near(r.verticalMps,4);near(r.speedMps,Math.hypot(4,4,0));assert.equal(r.phase,'broken');
});

test('obsolete asynchronous generations, errors and teardown never publish old flights or retain prior caches',async()=>{
  const p=await prepare(contact(),{...config,contactPreviewSeconds:0});
  const lane=new ContactReplayGeneration();let complete!:(p:PreparedContact)=>void;let oldSignal!:AbortSignal;
  const old=lane.prepare(signal=>{oldSignal=signal;return new Promise(resolve=>{complete=resolve;});});
  assert.equal(lane.status,'preparing');await lane.prepare(async()=>p);assert.ok(oldSignal.aborted);assert.equal(lane.current,p);
  complete({...p,note:'obsolete'});await old;assert.equal(lane.current,p);
  await lane.prepare(async()=>{throw new Error('unknown terrain');});assert.equal(lane.current,null);assert.equal(lane.status,'unsupported');assert.equal(lane.reason,'unknown terrain');
  await lane.prepare(async()=>p);lane.invalidate();assert.equal(lane.current,null);assert.equal(lane.status,'idle');
});

test('cancellation during engine/cache preparation releases work and cannot finish an invalid generation',async()=>{
  const controller=new AbortController();
  const pending=prepare(contact(),{...config,contactPreviewSeconds:12},parts,controller.signal);
  setTimeout(()=>controller.abort(),25);await assert.rejects(pending,/abort/i);
  const lane=new ContactReplayGeneration();const first=lane.prepare(signal=>prepare(contact(),{...config,contactPreviewSeconds:12},parts,signal));
  await lane.prepare(signal=>prepare(contact(),{...config,contactPreviewSeconds:0},parts,signal));await first;
  assert.equal(lane.current?.cache.length,1);assert.equal(lane.status,'ready');
});

test('redirected vertical impact on sloped terrain retains the full bounded contact preview',async()=>{
  const terrain=data();terrain.overview.heights=terrain.overview.heights.map((_,i)=>(i%81-40)*20);
  const c={...contact(),velocityMps:[0,-100,0] as [number,number,number],tiltDeg:0};
  const local=siteFrame(-89,40,0);c.yM=contactSurfaceHeight(terrain,local,c.eastM,-c.northM).yM;
  const prepared=await prepareContactReplay(c,{...config,restitution:1,friction:0,breakupEnergyJ:1e12,contactPreviewSeconds:12},terrain,local,parts,new AbortController().signal);
  assert.equal(prepared.cache.stoppedReason,'');assert.equal(prepared.cache.length,1441);
  const last=prepared.cache.sample(12);assert.deepEqual(prepared.cache.sample(120),last);
  const readout=contactReadout(c,prepared,last);assert.notEqual(readout.phase,'unsupported');assert.match(readout.note,/Bounded 12 s/);
});

test('surface support lift accounts for negative terrain, tilted geometry and model origin',()=>{
  const field:TouchdownTerrain={columns:3,rows:3,stepM:10,x0M:-10,z0M:-10,heightsM:new Float64Array(9).fill(-30),
    initialPositionM:[0,0,0],initialVelocityMps:[0,-1,0],initialRotation:[0,0,0,1]};
  const c={...contact(),eastM:0,northM:0,tiltDeg:0};
  const pose=contactInitialPose(c,siteFrame(-89,40,0),field,parts);near(pose.liftM,-29.498);
  assert.equal(field.initialPositionM[1],pose.liftM);
});

// Decode the committed asset offline; this new terrain path must retain the same
// 157 primitives, physical normalization and display transforms as the lab.
async function nasaModel() {
  const bytes=await readFile(new URL('../public/data/equipment/apollo-lunar-module.glb',import.meta.url));
  const size=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+size).toString());
  const context=vm.createContext({console,TextDecoder,setTimeout,clearTimeout});
  vm.runInContext(await readFile(new URL('../public/data/equipment/draco/draco_decoder.js',import.meta.url),'utf8'),context);
  const draco=await context.DracoDecoderModule();
  const meshes:T.Group[]=gltf.meshes.map((mesh:{primitives: Array<{extensions:{KHR_draco_mesh_compression:{bufferView:number;attributes:{POSITION:number}}}}>} )=>{
    const group=new T.Group();
    for(const primitive of mesh.primitives){const compressed=primitive.extensions.KHR_draco_mesh_compression,view=gltf.bufferViews[compressed.bufferView];
      const start=20+size+8+(view.byteOffset??0),decoder=new draco.Decoder(),buffer=new draco.DecoderBuffer(),geometry=new draco.Mesh(),values=new draco.DracoFloat32Array();
      try {buffer.Init(new Int8Array(bytes.subarray(start,start+view.byteLength)),view.byteLength);assert.ok(decoder.DecodeBufferToMesh(buffer,geometry).ok());
        const attribute=decoder.GetAttributeByUniqueId(geometry,compressed.attributes.POSITION);assert.ok(decoder.GetAttributeFloatForAllPoints(geometry,attribute,values));
        const positions=Float32Array.from({length:geometry.num_points()*3},(_,i)=>values.GetValue(i));
        group.add(new T.Mesh(new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(positions,3)),new T.MeshStandardMaterial()));
      } finally {[values,geometry,buffer,decoder].forEach(value=>draco.destroy(value));}
    }return group;
  });
  const nodes:T.Object3D[]=gltf.nodes.map((node:{mesh?:number})=>node.mesh===undefined?new T.Group():meshes[node.mesh]);
  gltf.nodes.forEach((node:{matrix?:number[];translation?:number[];rotation?:number[];scale?:number[];children?:number[]},i:number)=>{
    if(node.matrix){nodes[i].matrix.fromArray(node.matrix);nodes[i].matrix.decompose(nodes[i].position,nodes[i].quaternion,nodes[i].scale);}
    if(node.translation)nodes[i].position.fromArray(node.translation);if(node.rotation)nodes[i].quaternion.fromArray(node.rotation);if(node.scale)nodes[i].scale.fromArray(node.scale);
    node.children?.forEach(child=>nodes[i].add(nodes[child]));
  });
  const scene=new T.Group();gltf.scenes[gltf.scene??0].nodes.forEach((i:number)=>scene.add(nodes[i]));
  const normalized=normalizeEquipment(scene);normalized.position.y=-3.5;return normalized;
}

test('all 157 actual NASA primitives replay against curved Moon terrain without refetch/remount, preserve mass and breakup poses',async()=>{
  const model=await nasaModel(),geometry=await prepareTouchdownFragments(model);
  try {assert.equal(geometry.sourceMeshCount,157);near(geometry.bounds.max.y-geometry.bounds.min.y,7);
    const c={...contact(),velocityMps:[1,-8,2] as [number,number,number],tiltDeg:0};
    const terrain=data(-1700),local=siteFrame(-89,40,0);c.yM=contactSurfaceHeight(terrain,local,c.eastM,-c.northM).yM;c.terrainHeightM=-1700;
    let ticks=0;const timer=setInterval(()=>ticks++,0);
    let replay:PreparedContact;try{replay=await prepareContactReplay(c,{...config,contactPreviewSeconds:1,breakupEnergyJ:0},terrain,local,geometry.descriptors,new AbortController().signal);}finally{clearInterval(timer);}
    assert.ok(ticks>30,'geometry/world/replay preparation cooperates with other work');
    const frame=replay.cache.sample(1);assert.ok(frame.broken);assert.equal(frame.fragments.length,157);
    near(frame.fragments.reduce((sum,p)=>sum+p.massKg,0),c.massKg,1e-9);
    const matrix=new T.Matrix4().compose(new T.Vector3(...replay.cache.sample(0).position),replay.rotation,new T.Vector3(1,1,1));
    const originals:T.Mesh[]=[];model.traverse(o=>{if(o instanceof T.Mesh)originals.push(o);});model.updateWorldMatrix(true,true);
    geometry.objects.forEach((object,i)=>{object.visible=true;object.position.fromArray(geometry.descriptors[i].offset).applyMatrix4(matrix);object.quaternion.copy(replay.rotation);object.updateWorldMatrix(true,true);
      const clone=object.children[0] as T.Mesh;assert.equal(clone.geometry,originals[i].geometry);assert.equal(clone.material,originals[i].material);
      const expected=matrix.clone().multiply(originals[i].matrixWorld);clone.matrixWorld.elements.forEach((v,j)=>near(v,expected.elements[j],1e-5));
    });
    assert.ok(frame.fragments.every(p=>[...p.position,...p.velocity].every(Number.isFinite)));
    const {field}=await prepareContactTerrain(terrain,local,c,1,new AbortController().signal);
    for(const time of [.1,.3,.6,1]) {
      const sample=replay.cache.sample(time);
      for(const [i,piece] of sample.fragments.entries()) {
        const half=geometry.descriptors[i].halfExtents,q=new T.Quaternion(...piece.rotation);
        for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]) {
          const corner=new T.Vector3(x*half[0],y*half[1],z*half[2]).applyQuaternion(q).add(new T.Vector3(...piece.position));
          const ground=contactTerrainHeight(field,corner.x,corner.z);assert.notEqual(ground,null);
          assert.ok(corner.y-ground!>-.05,`NASA proxy ${i} penetrates Moon by ${ground!-corner.y} m`);
        }
      }
    }
    assert.ok(replay.cache.packed.byteLength<24_000_000);
  } finally {disposeEquipment(model);}
});
