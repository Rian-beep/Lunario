import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import test from 'node:test';
import * as T from 'three';
import {LANDER_ASSET, normalizeEquipment, disposeEquipment} from '../lib/equipment';
import {prepareTouchdownFragments} from '../lib/touchdown-fragments';
import {decodeTerrain, heightAt} from '../lib/terrain';
import {DEFAULT_LANDING_CONFIGURATION, type LandingContact} from '../lib/landing-contract';
import {prepareContactReplay, minimumProxyTerrainClearance} from '../components/workbench/scene/contact-dynamics';
import {siteFrame} from '../components/workbench/scene/surface';

async function nasaModel() {
  const bytes=await readFile(new URL('../public/data/equipment/apollo-lunar-module.glb',import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),LANDER_ASSET.sha256);
  const size=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+size).toString());
  const context=vm.createContext({console,TextDecoder,setTimeout,clearTimeout});
  const decoderCode=await readFile(new URL('../public/data/equipment/draco/draco_decoder.js',import.meta.url));
  assert.equal(createHash('sha256').update(decoderCode).digest('hex'),'8625489da79a805f4f2a7d511c3e52d8b4085608a9d2a4d5f4f9de5db0aea04f');
  vm.runInContext(decoderCode.toString(),context);
  const draco=await context.DracoDecoderModule();
  const meshes:T.Group[]=gltf.meshes.map((mesh:{primitives: Array<{extensions:{KHR_draco_mesh_compression:{bufferView:number;attributes:{POSITION:number}}};attributes:{POSITION:number};indices:number}>} )=>{
    const group=new T.Group();
    for(const primitive of mesh.primitives){const compressed=primitive.extensions.KHR_draco_mesh_compression,view=gltf.bufferViews[compressed.bufferView];
      const start=20+size+8+(view.byteOffset??0),decoder=new draco.Decoder(),buffer=new draco.DecoderBuffer(),geometry=new draco.Mesh(),values=new draco.DracoFloat32Array();
      try {buffer.Init(new Int8Array(bytes.subarray(start,start+view.byteLength)),view.byteLength);assert.ok(decoder.DecodeBufferToMesh(buffer,geometry).ok());
        const attribute=decoder.GetAttributeByUniqueId(geometry,compressed.attributes.POSITION);assert.ok(decoder.GetAttributeFloatForAllPoints(geometry,attribute,values));
        const positions=Float32Array.from({length:geometry.num_points()*3},(_,i)=>values.GetValue(i));
        const decoded=new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(positions,3));
        const indices=new draco.DracoInt32Array();
        try {
          const faces:number[]=[];
          for(let i=0;i<geometry.num_faces();i++) {assert.ok(decoder.GetFaceFromMesh(geometry,i,indices));for(let j=0;j<3;j++)faces.push(indices.GetValue(j));}
          assert.equal(faces.length,gltf.accessors[primitive.indices].count);
          decoded.setIndex(faces);
        } finally {draco.destroy(indices);}
        // GLTFLoader normalizes from accessor bounds; proxy preparation uses decoded indexed vertices.
        const accessor=gltf.accessors[primitive.attributes.POSITION];
        decoded.boundingBox=new T.Box3(new T.Vector3(...accessor.min),new T.Vector3(...accessor.max));
        group.add(new T.Mesh(decoded,new T.MeshStandardMaterial()));
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

// Original C10 completed-render F8, not reconstructed flight inputs or surrogate boxes.
const impact: LandingContact = {timeS:15.136624609414739,eastM:-148.38206356441725,northM:0.006092578768924429,
  yM:-4.349747228669003,velocityMps:[10.019567559574236,-32.21334474154138,0.0008057009228747061],
  massKg:4699.503695770914,terrainHeightM:-4.349747228702088,terrainKnown:true,slopeDeg:6.187790215900865,
  tiltDeg:0.5978379405954839,headingDeg:269.96951869036235,targetErrorM:148.38243446592327};

type Replay = Awaited<ReturnType<typeof prepareContactReplay>>;

function inspectEveryState(replay: Replay, expectedMassKg: number) {
  assert.equal(replay.cache.length,1441,'full twelve seconds, including initial state');
  assert.equal(replay.cache.stoppedReason,'','no boundary truncation counted as a pass');
  const failures: {index:number;clearance:number}[]=[];
  let minimum=Infinity,minimumIndex=-1,brokenStates=0,maximumUpwardMps=-Infinity;
  const earlyClearances:number[]=[];
  for(let i=0;i<replay.cache.length;i++) {
    const f=replay.cache.sample(i/120);
    assert.equal(f.timeS,i*(1/120));
    assert.ok([...f.position,...f.rotation,...f.velocity].every(Number.isFinite));
    assert.ok(Math.abs(Math.hypot(...f.rotation)-1)<1e-5);
    maximumUpwardMps=Math.max(maximumUpwardMps,f.velocity[1]);
    if(f.broken) {
      brokenStates++;
      assert.equal(f.fragments.length,157);
      assert.equal(f.fragments.reduce((sum,p)=>sum+p.massKg,0),expectedMassKg);
      for(const p of f.fragments) {
        assert.ok(p.massKg>0);
        assert.ok([...p.position,...p.rotation,...p.velocity,...p.angularVelocity].every(Number.isFinite));
        assert.ok(Math.abs(Math.hypot(...p.rotation)-1)<1e-5);
      }
    }
    const clearance=minimumProxyTerrainClearance(replay.terrain!,replay.cache.parts,f);
    assert.notEqual(clearance,null,`unknown/outside collider at frame ${i}`);
    if(i<=30) earlyClearances.push(clearance!);
    if(clearance!<minimum) {minimum=clearance!;minimumIndex=i;}
    if(clearance!<-.05) failures.push({index:i,clearance:clearance!});
  }
  return {minimum,minimumIndex,brokenStates,maximumUpwardMps,earlyClearances,failures};
}

test('original 157 NASA proxies: finite actual terrain, every 120 Hz state and deterministic bounded replay', async t => {
  const model=await nasaModel();
  try {
    const geometry=await prepareTouchdownFragments(model);
    assert.equal(geometry.sourceMeshCount,157);assert.equal(geometry.descriptors.length,157);
    assert.ok(Math.abs(geometry.bounds.max.y-geometry.bounds.min.y-7)<1e-5);
    const terrainBytes=await readFile(new URL('../public/data/terrain.json',import.meta.url));
    assert.equal(createHash('sha256').update(terrainBytes).digest('hex'),'be7f59a95901f36cda1050538ea75fb1ce51e8b9cf5aebb532073086c0f70c32');
    const data=decodeTerrain(JSON.parse(terrainBytes.toString()));
    const local=siteFrame(-89.53432,-150.05233,heightAt(data,-89.53432,-150.05233)!.heightM);
    const prepare=(contact:LandingContact,breakupEnergyJ:number,restitution=.1)=>prepareContactReplay(contact,
      {...DEFAULT_LANDING_CONFIGURATION,breakupEnergyJ,restitution},data,local,geometry.descriptors,new AbortController().signal);

    await t.test('C10 F8 captured 100 N / zero-threshold impact retains the 5 cm gate through 12 s',async t=>{
      const replay=await prepare(impact,0);
      const stats=inspectEveryState(replay,impact.massKg);
      t.diagnostic(JSON.stringify(stats));
      assert.deepEqual(stats.failures,[],`retained 5 cm gate; minimum ${stats.minimum} m at frame ${stats.minimumIndex}`);
      assert.equal(stats.brokenStates,1440,'all original pieces persist after first contact');
      const fresh=await prepare(impact,0);
      assert.deepEqual(fresh.cache.packed,replay.cache.packed,'fresh worlds repeat every physical state');
      assert.deepEqual(fresh.cache.flags,replay.cache.flags);
      assert.deepEqual(fresh.cache.partMassesKg,replay.cache.partMassesKg);
      const end=replay.cache.sample(12),early=replay.cache.sample(.1);
      const outside=structuredClone(end);
      outside.fragments[156].position[0]=replay.terrain!.x0M-100;
      assert.equal(minimumProxyTerrainClearance(replay.terrain!,geometry.descriptors,outside),null,'even the last piece outside finite bounds is unknown');
      const missing=structuredClone(end);missing.fragments.pop();
      assert.equal(minimumProxyTerrainClearance(replay.terrain!,geometry.descriptors,missing),null,'missing NASA geometry cannot pass the clearance gate');
      for(const time of [12,.1,0,6,12,.1])assert.deepEqual(replay.cache.sample(time),fresh.cache.sample(time));
      assert.deepEqual(replay.cache.sample(100),end);
      replay.cache.sample(.1).fragments[0].position[1]=-1e10;
      assert.deepEqual(replay.cache.sample(.1),early,'returned samples cannot corrupt backwards replay');
    });

    // Captured nominal C10 contact from the same site and original hardware.
    const nominal:LandingContact={timeS:50.48139816962106,eastM:-8.425036257719135,northM:-0.000005182250200764983,
      yM:0.16407225420698524,velocityMps:[0.7107326256015903,-0.5593293012008084,1.688674808083655e-7],
      massKg:4562.229294846625,terrainHeightM:0.16407225403994793,terrainKnown:true,slopeDeg:1.4221188703828147,
      tiltDeg:1.9372902810000852,headingDeg:269.99617469401676,targetErrorM:8.425035462788589};
    await t.test('captured nominal soft landing retains intact mass, finite state and terrain support',async t=>{
      const replay=await prepare(nominal,100000);
      const stats=inspectEveryState(replay,nominal.massKg);
      t.diagnostic(JSON.stringify(stats));
      assert.deepEqual(stats.failures,[]);assert.equal(stats.brokenStates,0);
      assert.equal(replay.cache.sample(12).contact,true);
      assert.ok(Math.hypot(...replay.cache.sample(12).velocity)<.03);
      assert.equal(replay.cache.partMassesKg.reduce((sum,mass)=>sum+mass,0),nominal.massKg);
    });
    await t.test('controlled restitution bounce on actual terrain stays bounded without breakup or lost mass',async t=>{
      // Controlled experiment, not captured telemetry: change incoming vertical
      // speed and restitution, retaining all NASA proxies and the numerical DEM.
      const contact={...nominal,velocityMps:[0,-3,0] as [number,number,number]};
      const replay=await prepare(contact,1e12,.8);
      const stats=inspectEveryState(replay,contact.massKg);
      t.diagnostic(JSON.stringify(stats));
      assert.deepEqual(stats.failures,[]);assert.equal(stats.brokenStates,0);
      assert.ok(stats.maximumUpwardMps>1,'restitution produces upward motion');
      assert.ok(Array.from({length:1440},(_,i)=>replay.cache.sample((i+1)/120)).some(f=>!f.contact&&f.velocity[1]>0),'bounce separates from terrain');
      assert.equal(replay.cache.partMassesKg.reduce((sum,mass)=>sum+mass,0),contact.massKg);
    });
  } finally {disposeEquipment(model);}
});
