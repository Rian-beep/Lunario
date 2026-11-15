import assert from 'node:assert/strict';
import test from 'node:test';
import {Box3,PerspectiveCamera,Vector3} from 'three';
import {boxCorners,frameVehicle,intersectRects,observeSceneOcclusion,projectedBounds,pullBackForDebris,type ScreenRect} from '../lib/camera-framing';

const safe={left:20,top:80,right:500,bottom:700};
const makeCamera=()=>{
  const camera=new PerspectiveCamera(43,1.28,.0001,18000);
  camera.position.set(.015,.009,.020);camera.lookAt(0,0,0);return camera;
};
const cloud=(radius:number)=>boxCorners(new Box3(new Vector3(-radius,-radius,-radius),new Vector3(radius,radius,radius)));
const inside=(bounds:ScreenRect,rect:ScreenRect)=>assert.ok(bounds.left>=rect.left-1e-7&&bounds.top>=rect.top-1e-7&&bounds.right<=rect.right+1e-7&&bounds.bottom<=rect.bottom+1e-7);

test('behind-camera vertices are all retained, pulled forward and framed without changing direction or target',()=>{
  const camera=makeCamera(),points=cloud(.12),target=new Vector3(),base=camera.position.clone(),rotation=camera.quaternion.clone();
  const original=points.map(p=>p.toArray());
  assert.equal(projectedBounds(camera,points,1280,1000),null,'original F4 failure');
  assert.equal(frameVehicle(camera,points,1280,1000,safe).status,'unavailable');
  assert.ok(pullBackForDebris(camera,points,target));
  assert.ok(camera.position.length()>=1.2*Math.max(...points.map(p=>p.length()))+camera.near-1e-14);
  assert.ok(camera.position.clone().normalize().distanceTo(base.normalize())<1e-14);
  assert.deepEqual(target,new Vector3());assert.deepEqual(camera.quaternion.toArray(),rotation.toArray());
  const fit=frameVehicle(camera,points,1280,1000,safe);assert.equal(fit.status,'framed');inside(fit.bounds!,safe);
  assert.deepEqual(points.map(p=>p.toArray()),original,'no vertex or world-geometry edits');
});

test('variable radius replay, backwards scrubs, base orbit/zoom and reset have no history',()=>{
  const camera=makeCamera(),target=new Vector3(20,-1,30),offset=camera.position.clone();
  const sample=(radius:number,base:Vector3)=>{
    camera.position.copy(target).add(base);camera.lookAt(target);
    const points=cloud(radius).map(p=>p.add(target));
    assert.ok(pullBackForDebris(camera,points,target));
    const fit=frameVehicle(camera,points,1280,1000,safe);assert.equal(fit.status,'framed');inside(fit.bounds!,safe);
    return {position:camera.position.toArray(),projection:camera.projectionMatrix.toArray()};
  };
  const first=[.002,.01,.03,.08,.2].map(r=>sample(r,offset));
  for(let i=0;i<20;i++)for(const index of [4,2,3,1,0])assert.deepEqual(sample([.002,.01,.03,.08,.2][index],offset),first[index]);
  const orbit=new Vector3(-.03,.018,.01);
  const changed=sample(.08,orbit);assert.notDeepEqual(changed,first[3]);
  assert.ok(new Vector3().fromArray(changed.position).sub(target).normalize().distanceTo(orbit.clone().normalize())<1e-12);
  assert.deepEqual(sample(.08,offset),first[3],'reset restores the same framing');
  const zoomed=sample(.08,offset.clone().multiplyScalar(20));
  assert.ok(new Vector3().fromArray(zoomed.position).distanceTo(target)>new Vector3().fromArray(first[3].position).distanceTo(target));
});

test('distance envelope joins the exact compact offset and debris radius with continuous first derivative',()=>{
  const camera=makeCamera(),base=camera.position.clone(),target=new Vector3(),distance=base.length(),band=distance*.1;
  const sample=(required:number)=>{
    camera.position.copy(base);pullBackForDebris(camera,[new Vector3((required-camera.near)/1.2,0,0)],target);return camera.position.length();
  };
  camera.position.copy(base);pullBackForDebris(camera,cloud(.002),target);assert.deepEqual(camera.position,base);
  const epsilon=1e-7;
  for(const boundary of [distance-band,distance+band]){
    const left=(sample(boundary)-sample(boundary-epsilon))/epsilon,right=(sample(boundary+epsilon)-sample(boundary))/epsilon;
    assert.ok(Math.abs(left-right)<1e-4,'C1 join');
    assert.ok(sample(boundary)>=distance-1e-15&&sample(boundary)>=boundary-1e-15);
  }
});

test('pullback remains on the viewing ray above sampled terrain even for an inward orbit',()=>{
  const camera=makeCamera(),centre=new Vector3(),target=new Vector3(0,1.1,0);
  camera.position.set(0,1.05,0);camera.lookAt(target);
  const direction=camera.position.clone().sub(target).normalize(),points=cloud(.3).map(p=>p.add(target));
  let samples=0;
  assert.ok(pullBackForDebris(camera,points,target,{centre,radiusAt:()=>{samples++;return 1;}}));
  assert.ok(samples>=2,'terrain is resampled after moving to sphere exit');
  assert.ok(camera.position.length()>=1.002);
  assert.ok(camera.position.clone().sub(target).normalize().distanceTo(direction)<1e-14);
  assert.ok(projectedBounds(camera,points,1280,1000));
});

test('empty, nonfinite and degenerate geometry cannot fabricate framed bounds or a valid pullback',()=>{
  const camera=makeCamera(),base=camera.position.clone(),target=new Vector3();
  for(const points of [[],[new Vector3()],[new Vector3(NaN,0,0)],[new Vector3(Infinity,0,0)]]){
    assert.equal(pullBackForDebris(camera,points,target),false);assert.deepEqual(camera.position,base);
    const fit=frameVehicle(camera,points,1280,1000,safe);assert.equal(fit.status,'unavailable');assert.equal(fit.bounds,null);
  }
  assert.equal(pullBackForDebris(camera,cloud(.1),camera.position.clone()),false);
  assert.equal(pullBackForDebris(camera,cloud(.1),target,{centre:new Vector3(),radiusAt:()=>NaN}),false);
  assert.deepEqual(camera.position,base);
  assert.equal(frameVehicle(camera,cloud(.002),0,1000,safe).status,'unavailable');
  assert.equal(frameVehicle(camera,cloud(.002),1280,1000,{left:0,right:0,top:0,bottom:1}).status,'occluded');
});

test('CSS rectangle intersection covers partial overlap, containment, shifted viewport, touching and invalid rectangles',()=>{
  const canvas={left:80,top:-395,right:880,bottom:605},viewport={left:0,top:0,right:800,bottom:1000};
  assert.deepEqual(intersectRects(canvas,viewport),{left:80,top:0,right:800,bottom:605});
  assert.deepEqual(intersectRects(viewport,canvas),intersectRects(canvas,viewport));
  assert.deepEqual(intersectRects(viewport,{left:20,top:30,right:400,bottom:500}),{left:20,top:30,right:400,bottom:500});
  assert.deepEqual(intersectRects(canvas,{left:120,top:50,right:520,bottom:450}),{left:120,top:50,right:520,bottom:450});
  for(const rect of [{left:800,top:0,right:900,bottom:1000},{left:0,top:-500,right:800,bottom:0},{left:10,top:0,right:0,bottom:10},{left:NaN,top:0,right:800,bottom:1000}])assert.equal(intersectRects(viewport,rect),null);
});

test('DOM occlusion clips actual canvas against changing visualViewport, scroll and fully offscreen positions',()=>{
  const hostRect={left:80,top:-395,right:880,bottom:605};
  let canvasRect={...hostRect};
  const events=new Set<string>();
  const visualViewport={offsetLeft:0,offsetTop:0,width:800,height:1000,
    addEventListener:(name:string)=>events.add('visual:'+name),removeEventListener:(name:string)=>events.delete('visual:'+name)};
  class Observer {observe(){}unobserve(){}disconnect(){}}
  const globals={ResizeObserver:Observer,MutationObserver:Observer,window:{visualViewport,
    addEventListener:(name:string)=>events.add(name),removeEventListener:(name:string)=>events.delete(name)}};
  const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{value,configurable:true});
  const host={getBoundingClientRect:()=>hostRect,querySelector:()=>({getBoundingClientRect:()=>canvasRect})};
  const root={querySelectorAll:()=>[],addEventListener:(name:string)=>events.add('root:'+name),removeEventListener:(name:string)=>events.delete('root:'+name)};
  try{
    const observer=observeSceneOcclusion(host as unknown as HTMLElement,root as unknown as HTMLElement);
    const safe=observer.measure()!;assert.deepEqual(safe,{left:12,top:407,right:708,bottom:988});
    const fit=frameVehicle(makeCamera(),cloud(.003),800,1000,safe);assert.equal(fit.status,'framed');inside(fit.bounds!,safe);
    inside({left:fit.bounds!.left+hostRect.left,top:fit.bounds!.top+hostRect.top,right:fit.bounds!.right+hostRect.left,bottom:fit.bounds!.bottom+hostRect.top},{left:0,top:0,right:800,bottom:1000});
    visualViewport.offsetLeft=120;visualViewport.offsetTop=50;visualViewport.width=400;visualViewport.height=400;
    assert.deepEqual(observer.measure(),{left:52,top:457,right:428,bottom:833});
    canvasRect={left:150,top:100,right:450,bottom:300};
    assert.deepEqual(observer.measure(),{left:82,top:507,right:358,bottom:683},'uses the actual canvas rather than only host');
    canvasRect={left:80,top:-1000,right:880,bottom:-1};
    assert.equal(observer.measure(),null);assert.equal(frameVehicle(makeCamera(),cloud(.003),800,1000,observer.measure()).status,'occluded');
    observer.dispose();assert.equal(events.size,0,'viewport listeners removed');
  }finally{
    for(const [key,descriptor] of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}
  }
});
