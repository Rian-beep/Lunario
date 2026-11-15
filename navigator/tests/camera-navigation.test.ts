import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as T from 'three';
import {retainCameraAfterSiteArrival} from '../lib/site-transition';

// Run the actual runtime event listeners and handoff callbacks. The browser
// companion also drives real OrbitControls, WebGL, React and original assets.
const source=readFileSync(new URL('../components/workbench/scene/runtime.ts',import.meta.url),'utf8');
const gestures=source.slice(source.indexOf('  const userStart=()=>'),source.indexOf('  function rebuildControls(){'));
const makeRuntime=new Function('T','retainCameraAfterSiteArrival',ts.transpile(`
  const camera=new T.PerspectiveCamera(),earth={visible:true,position:new T.Vector3(384400,0,0)},sun={visible:false,position:new T.Vector3(1e8,0,0)},moonCentre=new T.Vector3();
  camera.position.set(4000,3000,2000);
  const canvas=new EventTarget(),renderer={domElement:canvas};
  const controls=new T.EventDispatcher();controls.target=new T.Vector3();
  const currentPoint=new T.Vector3(0,1737.4,0),tuple=v=>v.toArray();
  let settings={mode:'vehicle',reset:2},navigationCamera={mode:'globe',reset:1};
  let tileMotion=null,pendingTileCloseup=0,geographicMotion=null,canceledGesture=false;
  let focusedAnchor=null,followPosition=null,assetMotion=null,pointerDown=null,navigationActive=false;
  const navigation={sample:()=>navigationActive?{}:null,cancel:()=>navigationActive=false};
  let siteModeCalls=0,rebuilds=0;
  const getSettings=()=>settings,status=()=>{},onSiteMode=()=>{siteModeCalls++;settings={...settings,mode:'orbit'};};
  let lastMode='vehicle',lastReset=2;
  function rebuildControls(){rebuilds++;}
  ${gestures}
  bindGestures();
  const motion=()=>({mode:settings.mode,fromUp:new T.Vector3(0,1,0),toUp:new T.Vector3(0,1,0),anchor:currentPoint.clone(),plan:{startMs:0,fromCamera:tuple(camera.position),fromTarget:[0,0,0],fromCentre:[0,0,0],toCamera:[.015,1737.409,.02],toTarget:tuple(currentPoint),toCentre:[0,0,0],clearanceKm:6200}});
  return {
    begin(){assetMotion=motion();},
    site(start={mode:'globe',reset:1}){navigationActive=true;navigationCamera=start;},
    request(mode,reset=2){settings={mode,reset};},
    pointer(type,x=40,y=40){const e=new Event(type);Object.assign(e,{pointerId:1,clientX:x,clientY:y});canvas.dispatchEvent(e);},
    end(){controls.dispatchEvent({type:'end'});},
    moveCamera(){camera.position.x+=10;controls.target.x+=10;},
    state(){return {motion:assetMotion,mode:settings.mode,reset:settings.reset,siteModeCalls,rebuilds,lastMode,lastReset,navigationActive,camera:tuple(camera.position),target:tuple(controls.target)};}
  };
`,{target:ts.ScriptTarget.ES2020}));
const runtime=()=>makeRuntime(T,retainCameraAfterSiteArrival);

test('plain clicks and sub-threshold pointer motion preserve the pending Lander destination',()=>{
  const r=runtime();r.begin();const before=r.state();
  r.pointer('pointerdown');r.pointer('pointermove',42,41);r.end();r.pointer('pointerup',42,41);
  assert.equal(r.state().motion,before.motion,'click must not cancel asset travel');
  assert.deepEqual(r.state().camera,before.camera);assert.equal(r.state().siteModeCalls,0);
});

test('a real drag resumes the same asset destination from the adjusted pose without selecting a preset',()=>{
  const r=runtime();r.begin();const destination=r.state().motion.plan.toCamera;
  r.pointer('pointerdown');r.pointer('pointermove',60,50);
  assert.equal(r.state().motion,null,'manual drag owns the camera');
  const during=r.state();r.moveCamera();const adjusted=r.state();r.end();r.pointer('pointerup',60,50);
  const after=r.state();assert.equal(after.motion.mode,'vehicle');
  assert.deepEqual(after.motion.plan.fromCamera,adjusted.camera);assert.deepEqual(after.motion.plan.fromTarget,adjusted.target);
  assert.deepEqual(after.camera,adjusted.camera);assert.deepEqual(after.motion.plan.toCamera,destination);
  assert.equal(after.siteModeCalls,0);assert.equal(after.mode,'vehicle');
  assert.equal(adjusted.rebuilds,during.rebuilds,'controls must not be disposed during a captured drag');
});

test('a newer mode or reset during an interrupted drag supersedes its old destination',()=>{
  for(const [mode,reset] of [['earth',2],['vehicle',3]] as const){
    const r=runtime();r.begin();r.pointer('pointerdown');r.pointer('pointermove',60,50);
    r.request(mode,reset);r.end();
    assert.equal(r.state().motion,null);assert.equal(r.state().mode,mode);assert.equal(r.state().reset,reset);
  }
});

test('site drag cancellation retains an already selected or newer Lander/Follow request',()=>{
  for(const mode of ['vehicle','follow'])for(const start of [{mode:'globe',reset:1},{mode,reset:2}]){
    const r=runtime();r.request(mode);r.site(start);
    r.pointer('pointerdown');r.pointer('pointermove',60,50);r.end();
    assert.equal(r.state().navigationActive,false);assert.equal(r.state().siteModeCalls,0);
    assert.equal(r.state().mode,mode);assert.equal(r.state().lastReset,-1,'selected focus is still owed');
  }
});

test('an ordinary site drag releases into a local manual camera without a preset reset',()=>{
  const r=runtime();r.request('globe',1);r.site();
  r.pointer('pointerdown');r.pointer('pointermove',60,50);const before=r.state();r.end();
  assert.equal(r.state().mode,'orbit');assert.equal(r.state().siteModeCalls,1);
  assert.equal(r.state().lastMode,'orbit');assert.equal(r.state().lastReset,1);assert.deepEqual(r.state().camera,before.camera);
});

test('picking an already inspected or followed spacecraft does not request a new asset flight',()=>{
  const pick=source.slice(source.indexOf('  const poiUp='),source.indexOf('  const poiLeave='));
  const createPick=new Function('T',ts.transpile(`
    let mode='vehicle',requests=0,pointerDown={x:50,y:50,button:0};
    const camera=new T.PerspectiveCamera(),pickingCamera=camera,raycaster={setFromCamera(){},params:{},intersectObjects:()=>[{}]},pointer=new T.Vector2();
    const renderer={domElement:{getBoundingClientRect:()=>({left:0,top:0,width:100,height:100})}};
    const pickPoi=()=>undefined,pickStation=()=>undefined,pickOrbital=()=>undefined;
    const getLive=()=>({showFlight:true}),getSettings=()=>({mode}),onVehicleFocus=()=>requests++;
    const currentPoint=new T.Vector3(),path={visible:true},currentRing={visible:true},lander={visible:true},contactPieces={visible:false};
    ${pick}
    return next=>{mode=next;pointerDown={x:50,y:50,button:0};requests=0;poiUp({clientX:50,clientY:50});return requests;};
  `,{target:ts.ScriptTarget.ES2020}))(T);
  for(const mode of ['vehicle','follow'])assert.equal(createPick(mode),0,mode);
  assert.equal(createPick('flight'),1,'the whole-path view can still select the spacecraft');
});
