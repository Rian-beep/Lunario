import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import * as T from 'three';
import ts from 'typescript';
import {boxCorners,frameVehicle,projectedBounds,unoccludedRect,observeSceneOcclusion,pullBackForDebris,type ScreenRect} from '../../../lib/camera-framing';
import {normalizeEquipment,LANDER_ASSET,disposeEquipment} from '../../../lib/equipment';
import {allowFullPolarOrbit} from './camera-limits';

const source=readFileSync(new URL('./runtime.ts',import.meta.url),'utf8');
const code=source.match(/    \/\/ Frame the real decoded vehicle[\s\S]*?    camera.updateProjectionMatrix\(\);\n    (?=if \(now - lastReadout)/)?.[0];
assert.ok(code,'runtime applies framing at the actual rendering call site');
const renderCode=source.match(/    pickingCamera.copy\(camera\);[\s\S]*?    const renderOrigin=camera.position.clone\(\);[\s\S]*?finally\{[^\n]+\}/)?.[0];
assert.ok(renderCode,'render restores unexpanded camera in finally');
const js=ts.transpile(code,{target:ts.ScriptTarget.ES2020});
const vehiclePickCode=source.match(/        const viewCamera=[^\n]*;\n        const started=performance.now\(\),rect=renderer.domElement.getBoundingClientRect\(\);[^\n]*?raycaster.setFromCamera\(pointer,viewCamera\);/)?.[0];
assert.ok(vehiclePickCode,'vehicle picking uses the actual fitted view');
const projectFrame=(context:Record<string,unknown>)=>new Function(...Object.keys(context),js)(...Object.values(context));
const geographicSamples:number[][]=[];
const framingContext={T,boxCorners,frameVehicle,projectedBounds,pullBackForDebris,observeSceneOcclusion,
  controls:{target:new T.Vector3()},moonCentre:new T.Vector3(0,-1737.4,0),toGround:()=>({point:new T.Vector3(0,-10,0)}),
  sceneToBody:(v:T.Vector3)=>v.clone(),cameraBodyGeography:(p:number[])=>{geographicSamples.push(p);return null;},poleMeridian:0,
  assetClipPlanes:()=>({near:.0001,far:18000}),clipBodies:[],tuple:(v:T.Vector3)=>v.toArray(),currentPoint:new T.Vector3()};
const overlap=(a:ScreenRect,b:ScreenRect)=>a.left<b.right-1e-6&&a.right>b.left+1e-6&&a.top<b.bottom-1e-6&&a.bottom>b.top+1e-6;
const inside=(a:ScreenRect,b:ScreenRect)=>assert.ok(a.left>=b.left-1e-6&&a.right<=b.right+1e-6&&a.top>=b.top-1e-6&&a.bottom<=b.bottom+1e-6,`${JSON.stringify(a)} inside ${JSON.stringify(b)}`);
const cameraAt=(width:number,height:number,target=new T.Vector3())=>{
  const camera=new T.PerspectiveCamera(43,width/height,.0001,18000);
  camera.position.copy(target).add(new T.Vector3(.015,.009,.020));camera.lookAt(target);camera.updateMatrixWorld(true);return camera;
};

// Decode the pinned NASA geometry, including glTF node transforms, without fetching images or running a renderer.
async function nasaMesh(){
  const bytes=readFileSync(new URL('../../../public/data/equipment/apollo-lunar-module.glb',import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),LANDER_ASSET.sha256);
  const size=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+size).toString()),bin=20+size+8;
  const context=vm.createContext({console,TextDecoder,setTimeout,clearTimeout});
  vm.runInContext(readFileSync(new URL('../../../public/data/equipment/draco/draco_decoder.js',import.meta.url),'utf8'),context);
  const draco=await context.DracoDecoderModule(),material=new T.MeshBasicMaterial();
  const meshes:T.Group[]=gltf.meshes.map(()=>new T.Group());
  for(const [i,mesh] of gltf.meshes.entries())for(const primitive of mesh.primitives){
    const extension=primitive.extensions.KHR_draco_mesh_compression,view=gltf.bufferViews[extension.bufferView];
    const chunk=bytes.subarray(bin+(view.byteOffset??0),bin+(view.byteOffset??0)+view.byteLength);
    const decoder=new draco.Decoder(),buffer=new draco.DecoderBuffer(),geometry=new draco.Mesh(),values=new draco.DracoFloat32Array();
    try{
      buffer.Init(new Int8Array(chunk),chunk.length);
      const result=decoder.DecodeBufferToMesh(buffer,geometry);assert.ok(result.ok(),result.error_msg());
      const attribute=decoder.GetAttributeByUniqueId(geometry,extension.attributes.POSITION);
      assert.ok(decoder.GetAttributeFloatForAllPoints(geometry,attribute,values));
      const array=new Float32Array(values.size());for(let j=0;j<array.length;j++)array[j]=values.GetValue(j);
      meshes[i].add(new T.Mesh(new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(array,3)),material));
    }finally{draco.destroy(values);draco.destroy(geometry);draco.destroy(buffer);draco.destroy(decoder);}
  }
  const nodes:T.Group[]=gltf.nodes.map((node:{mesh?:number;matrix?:number[];translation?:number[];rotation?:number[];scale?:number[]})=>{
    const object=new T.Group();if(node.mesh!==undefined)object.add(meshes[node.mesh]);
    if(node.matrix)new T.Matrix4().fromArray(node.matrix).decompose(object.position,object.quaternion,object.scale);
    else{if(node.translation)object.position.fromArray(node.translation);if(node.rotation)object.quaternion.fromArray(node.rotation);if(node.scale)object.scale.fromArray(node.scale);}
    return object;
  });
  gltf.nodes.forEach((node:{children?:number[]},i:number)=>node.children?.forEach(child=>nodes[i].add(nodes[child])));
  const root=new T.Group();for(const i of gltf.scenes[gltf.scene??0].nodes)root.add(nodes[i]);
  return normalizeEquipment(root);
}
const modelPromise=nasaMesh();

for(const width of [1280,1728,800])test(`runtime frames the actual 7 m NASA lander with inspector, site card and expanded HUD at ${width}px`,async()=>{
  const model=(await modelPromise).clone(true);model.position.y=-3.5;
  const bounds=new T.Box3().setFromObject(model,true);assert.ok(Math.abs(bounds.max.y-bounds.min.y-7)<1e-5);
  const height=1000, viewport={left:0,top:0,right:width,bottom:height};
  const inspector=width===800?{left:40,top:470,right:776,bottom:970}:{left:width-703,top:100,right:width-23,bottom:900};
  const panels=[inspector,{left:24,top:150,right:width===800?360:300,bottom:width===800?450:850},
    {left:width===800?16:320,top:width===800?760:740,right:width-24,bottom:965}];
  const camera=cameraAt(width,height),controls={target:new T.Vector3()},position=camera.position.clone(),rotation=camera.quaternion.clone();
  const lander=new T.Group();lander.add(model);lander.scale.setScalar(.001);
  const host={clientWidth:width,clientHeight:height,dataset:{} as Record<string,string>};
  const root={},occlusion={measure:(ratio=1)=>unoccludedRect(viewport,panels,12,ratio)};
  // The legacy full-canvas centring actually intersects the panel at the audited width.
  lander.updateWorldMatrix(true,true);
  if(width===1280)assert.ok(overlap(projectedBounds(camera,boxCorners(bounds,lander.matrixWorld),width,height)!,inspector));
  const inputs={...framingContext,live:{framingRoot:root},host,occlusion,occlusionRoot:root,occlusionSelector:undefined,
    settings:{mode:'vehicle'},navigating:false,lander,contactPieces:new T.Group(),dynamicsFrame:null,contactParts:null,fragmentBoundsM:[],vehicleBoundsM:bounds,contactModel:model,camera};
  projectFrame(inputs);
  const safe=JSON.parse(host.dataset.unoccludedCanvas),projected=JSON.parse(host.dataset.vehicleScreenBounds);
  assert.equal(host.dataset.vehicleFraming,'framed');inside(projected,safe);
  assert.ok(projected.bottom-projected.top>40,'vehicle stays visibly inspectable rather than a point');
  for(const panel of panels)assert.equal(overlap(projected,panel),false);
  assert.deepEqual(camera.position,position);assert.deepEqual(camera.quaternion.toArray(),rotation.toArray());assert.deepEqual(controls.target,new T.Vector3());
  assert.equal(lander.scale.x,.001,'framing never enlarges the 7 m mesh');
  // Resize/close the actual panels and reapply at the same physical camera pose.
  const before=host.dataset.vehicleScreenBounds;panels.splice(0,panels.length);projectFrame(inputs);
  assert.notEqual(host.dataset.vehicleScreenBounds,before);assert.equal(camera.zoom,1);assert.deepEqual(camera.position,position);
  const polar={minPolarAngle:1,maxPolarAngle:1};allowFullPolarOrbit(polar);assert.deepEqual(polar,{minPolarAngle:0,maxPolarAngle:Math.PI});
});

test('projection preserves user orbit/pan through moving COM, rewinds, contact and separated fragments',()=>{
  const width=1280,height=1000,safe={left:32,top:100,right:520,bottom:720};
  const originalCamera=cameraAt(width,height),pan=new T.Vector3(.003,.001,0);
  const target=pan.clone(),camera=originalCamera.clone();camera.position.add(pan);camera.lookAt(target);
  const initialOffset=camera.position.clone(),targetOffset=target.clone(),orientation=camera.quaternion.clone();
  const bounds=new T.Box3(new T.Vector3(-.004,-.0035,-.004),new T.Vector3(.004,.0035,.004));
  for(const com of [new T.Vector3(),new T.Vector3(30,-1,20),new T.Vector3(30,-1.3,20),new T.Vector3()]){
    camera.position.copy(com).add(initialOffset);target.copy(com).add(targetOffset);camera.lookAt(target);
    const points=boxCorners(bounds,new T.Matrix4().makeTranslation(...com.toArray()));
    const pose=camera.position.clone(),aim=target.clone();
    const framed=frameVehicle(camera,points,width,height,safe);assert.equal(framed.status,'framed');inside(framed.bounds!,safe);
    assert.deepEqual(camera.position,pose);assert.deepEqual(target,aim);assert.ok(camera.quaternion.angleTo(orientation)<1e-7);
    const screenCom=com.clone().project(camera),screenTarget=target.clone().project(camera);
    assert.ok(Math.abs(screenCom.x-screenTarget.x)>1e-5,'user pan has not been silently centred away');
  }
  const fragments=[...boxCorners(bounds,new T.Matrix4().makeTranslation(-.010,0,0)),...boxCorners(bounds,new T.Matrix4().makeTranslation(.010,0,0))];
  const pose=camera.position.clone();const result=frameVehicle(camera,fragments,width,height,safe);inside(result.bounds!,safe);assert.deepEqual(camera.position,pose);
  // Repeated unchanged frames do not accumulate projection drift.
  const projection=camera.projectionMatrix.clone();for(let i=0;i<100;i++)frameVehicle(camera,fragments,width,height,safe);
  assert.deepEqual(camera.projectionMatrix,projection);
});

test('empty-space selection clips offscreen panels, handles full obstruction and follows vehicle aspect',()=>{
  const viewport={left:100,top:80,right:900,bottom:680};
  const obstacles=[{left:500,top:80,right:1000,bottom:380}];
  const square=unoccludedRect(viewport,obstacles,10,1)!,wide=unoccludedRect(viewport,obstacles,10,4)!;
  assert.ok(!overlap(square,obstacles[0])&&!overlap(wide,obstacles[0]));inside(square,viewport);inside(wide,viewport);
  assert.notDeepEqual(square,wide,'projected aspect chooses a useful region, not a fixed left shove');
  assert.equal(unoccludedRect(viewport,[viewport]),null);
  const camera=cameraAt(800,600),pose=camera.position.clone();
  assert.equal(frameVehicle(camera,[],800,600,null).status,'occluded');assert.deepEqual(camera.position,pose);
  assert.equal(frameVehicle(camera,[camera.position.clone()],800,600,viewport).status,'unavailable');
});

test.after(async()=>disposeEquipment(await modelPromise));

test('DOM measurements follow panel open, hidden, CSS movement, resize and canvas offsets without hiding panels',()=>{
  const viewport={left:80,top:120,right:1360,bottom:1120};
  class ElementStub {
    hidden=false;connected=true;style={display:'block',visibility:'visible',opacity:'1'};
    constructor(public rect:ScreenRect){}
    getBoundingClientRect(){return this.rect;}
    querySelector(){return null;}
    getClientRects(){return this.connected?[this.rect]:[];}
    closest(){return this.hidden?this:null;}
  }
  const host=new ElementStub(viewport),inspector=new ElementStub({left:657,top:180,right:1337,bottom:1000});
  let panels:ElementStub[]=[inspector],mutationCallback:MutationCallback|undefined;
  const observed=new Set<Element>(),events=new Set<string>();let disconnected=0;
  class ResizeStub {
    observe(el:Element){observed.add(el);}
    unobserve(el:Element){observed.delete(el);}
    disconnect(){disconnected++;}
  }
  class MutationStub {
    constructor(callback:MutationCallback){mutationCallback=callback;}
    observe(){}
    disconnect(){disconnected++;}
  }
  const root={querySelectorAll:()=>panels,addEventListener:(name:string)=>events.add(name),removeEventListener:(name:string)=>events.delete(name)};
  const globals={ResizeObserver:ResizeStub,MutationObserver:MutationStub,
    getComputedStyle:(el:ElementStub)=>el.style,window:{innerWidth:1600,innerHeight:1200,addEventListener:(name:string)=>events.add(name),removeEventListener:(name:string)=>events.delete(name)}};
  const previous=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{value,configurable:true});
  const start=JSON.stringify(panels);
  try{
    const observer=observeSceneOcclusion(host as unknown as HTMLElement,root as unknown as HTMLElement);
    const first=observer.measure()!;assert.ok(first.right<inspector.rect.left-viewport.left);
    inspector.rect={left:900,top:180,right:1337,bottom:1000};const resized=observer.measure()!;assert.ok(resized.right>first.right);
    // Pure translated geometry is detected even without a ResizeObserver callback.
    inspector.rect={left:120,top:700,right:1337,bottom:1100};assert.notDeepEqual(observer.measure(),resized);
    inspector.hidden=true;const hidden=observer.measure()!;assert.deepEqual(hidden,{left:12,top:12,right:1268,bottom:988});
    inspector.hidden=false;inspector.style.display='none';assert.deepEqual(observer.measure(),hidden);
    inspector.style.display='block';inspector.style.visibility='hidden';assert.deepEqual(observer.measure(),hidden);
    inspector.style.visibility='visible';inspector.style.opacity='0';assert.deepEqual(observer.measure(),hidden);
    inspector.style.opacity='1';
    const hud=new ElementStub({left:100,top:600,right:1300,bottom:1000});panels=[inspector,hud];
    mutationCallback!([{type:'childList',addedNodes:[{nodeType:1}],removedNodes:[]}] as unknown as MutationRecord[],{} as MutationObserver);
    assert.equal(observed.has(hud as unknown as Element),true);assert.ok(observer.measure()!.bottom<600-viewport.top);
    panels=[];mutationCallback!([{type:'childList',addedNodes:[],removedNodes:[{nodeType:1}]}] as unknown as MutationRecord[],{} as MutationObserver);
    assert.equal(observed.has(hud as unknown as Element),false);assert.deepEqual(observer.measure(),hidden);
    observer.dispose();assert.equal(disconnected,2);assert.equal(events.size,0);
    assert.notEqual(JSON.stringify([inspector]),start,'test exercised changed panel geometry');assert.equal(inspector.hidden,false,'observer never dismisses a user panel');
  }finally{
    for(const [key,descriptor] of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}
  }
});

test('asset flight camera/target samples stay continuous and unmodified by panel framing',async()=>{
  const {sampleAssetFlight}=await import('../../../lib/asset-focus');
  const plan={startMs:0,fromCamera:[1200,4500,2800] as const,fromTarget:[0,0,0] as const,fromCentre:[0,-1737.4,0] as const,
    toCamera:[.015,.009,.020] as const,toTarget:[0,0,0] as const,toCentre:[0,-1737.4,0] as const,clearanceKm:7000};
  const camera=cameraAt(1280,1000),points=boxCorners(new T.Box3(new T.Vector3(-.004,0,-.004),new T.Vector3(.004,.007,.004)));
  for(const now of [0,100,500,1500,3000,6000,10000,20000]){
    const sample=sampleAssetFlight(plan,now,false);camera.position.fromArray(sample.camera);camera.lookAt(new T.Vector3(...sample.target));
    const pose=camera.position.clone(),rotation=camera.quaternion.toArray();
    frameVehicle(camera,points,1280,1000,{left:32,top:100,right:520,bottom:720});
    assert.deepEqual(camera.position,pose);assert.deepEqual(camera.quaternion.toArray(),rotation);
    assert.deepEqual(sampleAssetFlight(plan,now,false),sample,'projection never rewrites or restarts smooth asset travel');
  }
});

for(const spreadM of [2,100])test(`runtime Follow frames all actual NASA parts at ${spreadM} m spread with COM and original scale`,async()=>{
  const {prepareTouchdownFragments}=await import('../../../lib/touchdown-fragments');
  const model=(await modelPromise).clone(true);model.position.y=-3.5;
  const prepared=await prepareTouchdownFragments(model);
  const fragmentBoundsM=prepared.objects.map(object=>{
    const detached=object.clone(true);detached.position.set(0,0,0);detached.quaternion.identity();return new T.Box3().setFromObject(detached,true);
  });
  const com=new T.Vector3(20,-1,30),camera=cameraAt(1280,1000,com),target=com.clone();
  const contactPieces=new T.Group();contactPieces.scale.setScalar(.001);contactPieces.position.copy(com);contactPieces.add(...prepared.objects);
  prepared.objects.forEach((object,i)=>{object.visible=true;object.position.x+=i%2===0?-spreadM:spreadM;object.quaternion.setFromEuler(new T.Euler(.1,.2,-.1));});
  assert.equal(prepared.objects.length,157);
  contactPieces.updateWorldMatrix(true,true);
  const originalScales=prepared.objects.map(o=>o.scale.toArray()),worldScale=contactPieces.scale.clone();
  const originalWorldMatrices=prepared.objects.map(o=>o.matrixWorld.toArray());
  const position=camera.position.clone(),rotation=camera.quaternion.toArray(),host={clientWidth:1280,clientHeight:1000,dataset:{} as Record<string,string>};
  const root={},safe={left:30,top:100,right:540,bottom:730},occlusion={measure:()=>safe};
  projectFrame({...framingContext,live:{framingRoot:root},host,occlusion,occlusionRoot:root,occlusionSelector:undefined,
    settings:{mode:'follow'},controls:{target},currentPoint:com,navigating:false,lander:new T.Group(),contactPieces,dynamicsFrame:{broken:true},contactParts:prepared,fragmentBoundsM,
    vehicleBoundsM:prepared.bounds,contactModel:model,camera});
  assert.equal(host.dataset.vehicleFraming,'framed');inside(JSON.parse(host.dataset.vehicleScreenBounds),safe);
  if(spreadM===100)assert.ok(camera.position.distanceTo(target)>position.distanceTo(target),'expanded cloud pulls camera back');
  else assert.deepEqual(camera.position,position,'compact breakup retains original physical offset');
  assert.deepEqual(prepared.objects.map(o=>o.scale.toArray()),originalScales);assert.deepEqual(contactPieces.scale,worldScale);
  assert.equal(host.dataset.cameraPosition,camera.position.toArray().join(','),'telemetry is fitted camera');
  assert.deepEqual(geographicSamples.at(-1),camera.position.toArray(),'geographic camera telemetry samples the fitted pose');
  assert.ok(camera.position.clone().sub(target).normalize().distanceTo(position.clone().sub(target).normalize())<1e-9);
  assert.deepEqual(camera.quaternion.toArray(),rotation);assert.deepEqual(target,com);
  for(const object of prepared.objects){
    const actual=new T.Box3().setFromObject(object,true);inside(projectedBounds(camera,boxCorners(actual),1280,1000)!,safe);
  }
  const context={...framingContext,live:{framingRoot:root},host,occlusion,occlusionRoot:root,occlusionSelector:undefined,
    settings:{mode:'follow'},controls:{target},currentPoint:com,navigating:false,lander:new T.Group(),contactPieces,dynamicsFrame:{broken:true},
    contactParts:prepared,fragmentBoundsM,vehicleBoundsM:prepared.bounds,contactModel:model,camera,scene:new T.Scene(),
    pickingCamera:camera.clone(),renderer:{render:()=>{},domElement:{getBoundingClientRect:()=>({left:0,top:0,width:1280,height:1000})}},onContextLost:()=>assert.fail('render error'),dispose:()=>assert.fail('render error')};
  const run=ts.transpile(code+'\n'+renderCode,{target:ts.ScriptTarget.ES2020});
  const expected=host.dataset.cameraPosition;
  camera.position.copy(position);
  for(let i=0;i<50;i++){
    new Function(...Object.keys(context),run)(...Object.values(context));
    assert.equal(host.dataset.cameraPosition,expected,'repeated actual framing/render block does not compound pullback');
    assert.deepEqual(camera.position,position,'control offset restored after each render');
  }
  assert.equal(context.pickingCamera.position.toArray().join(','),expected,'pick camera retains fitted world position');
  const corner=boxCorners(fragmentBoundsM[0],prepared.objects[0].matrixWorld)[0],ndc=corner.clone().project(context.pickingCamera);
  const raycaster=new T.Raycaster(),pointer=new T.Vector2();
  const pickContext={performance,getSettings:()=>({mode:'follow'}),camera,renderer:context.renderer,event:{clientX:(ndc.x+1)*640,clientY:(1-ndc.y)*500},pointer,raycaster,pickingCamera:context.pickingCamera};
  new Function(...Object.keys(pickContext),ts.transpile(vehiclePickCode,{target:ts.ScriptTarget.ES2020}))(...Object.values(pickContext));
  assert.ok(raycaster.ray.distanceToPoint(corner)<1e-8,'actual pointer ray passes through the rendered original NASA part');
  assert.deepEqual(prepared.objects.map(o=>o.matrixWorld.toArray()),originalWorldMatrices,'original fragment world transforms unchanged');
  context.dynamicsFrame.broken=false;
  context.lander.position.copy(com);context.lander.scale.setScalar(.001);
  new Function(...Object.keys(context),run)(...Object.values(context));
  assert.deepEqual(camera.position,position,'rewind to intact contact restores exact base offset');
  context.settings.mode='orbit';
  new Function(...Object.keys(context),run)(...Object.values(context));
  assert.equal(host.dataset.vehicleFraming,'inactive');assert.deepEqual(camera.position,position);
  context.settings.mode='follow';context.dynamicsFrame.broken=true;
  new Function(...Object.keys(context),run)(...Object.values(context));
  assert.equal(host.dataset.cameraPosition,expected,'return to broken Follow has no stale zoom');
});
