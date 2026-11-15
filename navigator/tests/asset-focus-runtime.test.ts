import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {ASSET_RADII_KM, ASSET_FOCUS_MS, sampleAssetFlight} from '../lib/asset-focus';
import {shortestArcDirection} from '../lib/site-transition';
import {framingDistanceKm} from '../lib/solar-system';
import {allowFullPolarOrbit,globeMinimumRadiusKm} from '../components/workbench/scene/camera-limits';

// Execute the production focus and cancellation blocks with real Three cameras
// and OrbitControls, without mounting WebGL or starting an application server.
const source=readFileSync(new URL('../components/workbench/scene/runtime.ts',import.meta.url),'utf8');
const focus=source.slice(source.indexOf('    const missingRange='),source.indexOf('    if(pendingTileCloseup&&!geographicMotion'));
assert.ok(focus.includes('sampleAssetFlight'),'exercise the actual runtime focus path');
const rebuild=source.slice(source.indexOf('  function rebuildControls(){'),source.indexOf('\n  bindGestures();\n  if(handoff)'));
const gesture=source.slice(source.indexOf('  const userStart=()=>'),source.indexOf('  const userEnd=()=>'));
const total=Object.values(ASSET_FOCUS_MS).reduce((a,b)=>a+b,0);
const makeRuntime=new Function('T','OrbitControls','ASSET_RADII_KM','sampleAssetFlight','shortestArcDirection','framingDistanceKm','allowFullPolarOrbit','globeMinimumRadiusKm',ts.transpile(`
  const camera=new T.PerspectiveCamera(43,1.6,.0001,3e9);
  const moonCentre=new T.Vector3(0,-1737.4,0),earth={visible:true,position:new T.Vector3(384400,-1737.4,0)},sun={visible:false,position:new T.Vector3(0,1e8,0)};
  const domElement={addEventListener(){},removeEventListener(){},ownerDocument:{addEventListener(){},removeEventListener(){}},style:{}};
  let controls=new OrbitControls(camera,domElement);
  controls.maxDistance=3e9;
  const renderer={domElement},enableCameraGestures=()=>{},bindGestures=()=>{};
  ${rebuild}
  let lastMode,lastReset=-1,assetMotion=null,focusedAnchor=null,followPosition=null,geographicMotion=null,missingFocusRange=false;
  const host={dataset:{}},nasaGlobe=null,currentPoint=new T.Vector3(),followOffset=new T.Vector3(.015,.009,.020),surfaceProps={},visualFrame={},frame={referenceRadiusM:1737400};
  const tuple=v=>v.toArray(),navigating=false,sample=null,flightChanged=false,reducedMotion={matches:false};
  let settings={mode:'globe',reset:0},tileMotion=null,pendingTileCloseup=0,canceledGesture=false;
  const getSettings=()=>settings,status=()=>{},navigation={sample:()=>null,cancel:()=>{}};
  ${gesture}
  return {camera,earth,moonCentre,host,reducedMotion,cancel:userStart,
    step(now,mode,reset=0){settings={mode,reset};${focus}return {motion:assetMotion,target:controls.target.clone()};}
  };
`,{target:ts.ScriptTarget.ES2020}));
const runtime=()=>makeRuntime(T,OrbitControls,ASSET_RADII_KM,sampleAssetFlight,shortestArcDirection,framingDistanceKm,allowFullPolarOrbit,globeMinimumRadiusKm);

for(const [from,to] of [['globe','earth'],['earth','globe']] as const){
  test(`runtime ${from} -> ${to} reaches its exact preset by the flight deadline`,()=>{
    const r=runtime();r.step(0,from);
    const initial=r.camera.position.clone();r.step(100,to);
    assert.ok(r.camera.position.distanceTo(initial)<1e-9);
    for(let t=116;t<100+total;t+=16){r.step(t,to);assert.ok(r.camera.position.toArray().every(Number.isFinite));}
    const final=r.step(100+total,to);
    assert.equal(final.motion,null);
    const target=to==='earth'?r.earth.position:r.moonCentre;
    assert.ok(final.target.distanceTo(target)<1e-8);
    const expected=to==='earth'?target.clone().addScaledVector(new T.Vector3(.2,.35,1).normalize(),framingDistanceKm(6378.137,1.6,43)):target.clone().add(new T.Vector3(1200,4500,2800));
    assert.ok(r.camera.position.distanceTo(expected)<1e-8);
  });
}

test('retargeting during transfer stays continuous at the next clearance boundary in both directions',()=>{
  for(const [from,to] of [['globe','earth'],['earth','globe']] as const){
    const r=runtime();r.step(0,from);r.step(100,to);r.step(5700,to);
    const before=r.camera.position.clone();r.step(5800,from);
    assert.ok(r.camera.position.distanceTo(before)<1e-8);
    r.step(5800+ASSET_FOCUS_MS.clearance-.01,from);const left=r.camera.position.clone();
    r.step(5800+ASSET_FOCUS_MS.clearance+.01,from);
    assert.ok(r.camera.position.distanceTo(left)<.001,`retarget jumped ${r.camera.position.distanceTo(left)} km`);
    assert.equal(r.step(5800+total,from).motion,null);
  }
});

test('live-date Earth focus settles relative to the moving body before handing over to follow',()=>{
  const r=runtime();r.step(0,'globe');r.step(100,'earth');
  const at=(time:number)=>{
    r.earth.position.set(384400+2*(time-100),-1737.4,(time-100)*.5);
    const state=r.step(time,'earth');
    return {state,offset:r.camera.position.clone().sub(r.earth.position)};
  };
  const approaching=at(100+total-.01),arrived=at(100+total);
  assert.equal(arrived.state.motion,null);
  assert.ok(approaching.offset.distanceTo(arrived.offset)<.001,'no extra drift velocity at arrival');
  const following=at(100+total+16);
  assert.ok(following.offset.distanceTo(arrived.offset)<1e-8);
  assert.ok(following.state.target.distanceTo(r.earth.position)<1e-8);
});

for(const destination of ['earth','globe'] as const){
  test(`rapid alternating focus requests finish at the latest ${destination} request`,()=>{
    const r=runtime();r.step(0,'globe');
    let previousTime=0,previousMode='globe',previousReset=0;
    for(const [index,[time,mode]] of ([[100,'earth'],[5700,'globe'],[5900,'earth'],[6500,'globe'],[6700,destination]] as const).entries()){
      for(let frame=previousTime+16;frame<time;frame+=16)r.step(frame,previousMode,previousReset);
      r.step(time,previousMode,previousReset);
      const before=r.camera.position.clone();r.step(time,mode,index+1);
      assert.ok(r.camera.position.distanceTo(before)<1e-8);
      r.earth.position.z+=70;
      r.step(time+16,mode,index+1);
      previousTime=time+16;previousMode=mode;previousReset=index+1;
    }
    for(let time=6732;time<6700+total;time+=16)r.step(time,destination,5);
    const final=r.step(6700+total,destination,5);
    assert.equal(final.motion,null);
    assert.ok(final.target.distanceTo(destination==='earth'?r.earth.position:r.moonCentre)<1e-8);
    assert.equal(r.host.dataset.assetFlight,'idle');
  });
}

test('gesture cancellation retains the current pose and subsequent Earth body following',()=>{
  const r=runtime();r.step(0,'globe');r.step(100,'earth');r.step(4500,'earth');
  const interrupted=r.camera.position.clone();r.cancel();
  const state=r.step(4600,'earth');
  assert.equal(state.motion,null);assert.ok(r.camera.position.distanceTo(interrupted)<1e-8);
  r.earth.position.add(new T.Vector3(10,20,30));r.step(4700,'earth');
  assert.ok(r.camera.position.distanceTo(interrupted.add(new T.Vector3(10,20,30)))<1e-8);
});

test('reduced motion completes a retarget without waiting for the deadline',()=>{
  const r=runtime();r.step(0,'earth');r.step(100,'globe');r.step(200,'globe');
  r.reducedMotion.matches=true;
  const final=r.step(216,'earth');
  assert.equal(final.motion,null);assert.ok(final.target.distanceTo(r.earth.position)<1e-8);
});

test('Earth to Moon arrival keeps its deadline while the live date moves the departure body',()=>{
  const r=runtime();r.step(0,'earth');r.step(100,'globe');
  for(let time=116;time<100+total;time+=16){
    r.earth.position.z+=50;r.step(time,'globe');
    assert.ok(r.camera.position.toArray().every(Number.isFinite));
  }
  const final=r.step(100+total,'globe');
  assert.equal(final.motion,null);assert.ok(final.target.distanceTo(r.moonCentre)<1e-8);
  assert.ok(r.camera.position.distanceTo(r.moonCentre.clone().add(new T.Vector3(1200,4500,2800)))<1e-8);
});
