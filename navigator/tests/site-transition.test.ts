import test from 'node:test';import assert from 'node:assert/strict';
import {createSiteTransition,shortestArcDirection,SITE_TRANSITION_MS,siteNavigationKey,reconcileSiteHandoff,canKeepOverviewMode,siteCameraOffset,retainCameraAfterSiteArrival,type SiteTransitionInput} from '../lib/site-transition';
const input:SiteTransitionInput={key:'B',now:0,fromCamera:[1740,0,0],fromTarget:[1737,0,0],toCamera:[0,1740,0],toTarget:[0,1737,0],overviewRadiusKm:6200,alreadyOverview:false,reducedMotion:false};
const total=SITE_TRANSITION_MS.zoomOut+SITE_TRANSITION_MS.rotate+SITE_TRANSITION_MS.zoomIn;
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('local flight lifts before rotating and then approaches the exact destination outside the body',()=>{
 const c=createSiteTransition();c.begin(input);assert.equal(c.sample(0)!.phase,'zoom-out');assert.deepEqual(c.sample(0)!.camera,input.fromCamera);
 const lifted=c.sample(SITE_TRANSITION_MS.zoomOut)!;assert.equal(lifted.phase,'rotate');near(Math.hypot(...lifted.camera),6200);assert.deepEqual(lifted.target,[0,0,0]);
 const rotated=c.sample(SITE_TRANSITION_MS.zoomOut+SITE_TRANSITION_MS.rotate)!;assert.equal(rotated.phase,'zoom-in');near(rotated.camera[0],0);near(rotated.camera[1],6200);
 for(let t=0;t<total;t+=17)assert.ok(Math.hypot(...c.sample(t)!.camera)>=1740-1e-8);
 assert.deepEqual(c.sample(total)!.camera,input.toCamera);assert.deepEqual(c.sample(total)!.target,input.toTarget);
});
test('overview selection skips the lift and rotation phases; reduced motion is instant',()=>{
 const c=createSiteTransition();c.begin({...input,alreadyOverview:true,fromCamera:[6200,0,0],fromTarget:[0,0,0]});assert.equal(c.sample(0)!.phase,'zoom-in');assert.equal(c.sample(SITE_TRANSITION_MS.zoomIn)!.phase,'complete');
 c.begin({...input,reducedMotion:true});assert.equal(c.sample(0)!.phase,'complete');assert.deepEqual(c.sample(0)!.camera,input.toCamera);
});
test('great-circle interpolation takes the short dateline arc and handles antipodes deterministically',()=>{
 const r=Math.PI/180;const a=[Math.cos(179*r),Math.sin(179*r),0] as const,b=[Math.cos(-179*r),Math.sin(-179*r),0] as const;
 const middle=shortestArcDirection(a,b,.5);near(middle[0],-1);near(middle[1],0);
 const antipode=shortestArcDirection([1,0,0],[-1,0,0],.5);near(Math.hypot(...antipode),1);near(antipode[0],0);assert.deepEqual(antipode,shortestArcDirection([1,0,0],[-1,0,0],.5));
});
test('retarget starts at the current physical pose, rejects stale completion, and cancel emits no sample',()=>{
 const c=createSiteTransition();const old=c.begin(input);const pose=c.sample(1300)!;const next=c.begin({...input,key:'C',now:1300,fromCamera:pose.camera,fromTarget:pose.target,alreadyOverview:true,toCamera:[0,0,1740],toTarget:[0,0,1737]});
 assert.equal(c.isCurrent(old),false);assert.ok(c.isCurrent(next));assert.deepEqual(c.sample(1300)!.camera,pose.camera);assert.equal(c.sample(10000)!.key,'C');c.cancel();assert.equal(c.sample(10000),null);assert.equal(c.isCurrent(next),false);
});
test('camera animation cannot mutate mission inputs or its caller snapshots',()=>{
 const a=structuredClone(input);const before=structuredClone(a),c=createSiteTransition();c.begin(a);c.sample(1000);assert.deepEqual(a,before);assert.throws(()=>c.begin({...input,fromCamera:[NaN,0,0]}),RangeError);
});

test('longitude aliases are one destination and pending plans snapshot caller inputs',()=>{
 assert.equal(siteNavigationKey(-85,180),siteNavigationKey(-85,-180));assert.equal(siteNavigationKey(0,10),siteNavigationKey(0,370));
 const mutable=structuredClone(input),c=createSiteTransition();c.begin(mutable);mutable.key='later';mutable.toCamera=[0,0,2000];
 assert.equal(c.sample(total)!.key,'B');assert.deepEqual(c.sample(total)!.camera,input.toCamera);
});

test('a completed B handoff consumed after selection C resumes toward C without changing the physical pose',()=>{
 const b={key:'B',resume:false,camera:input.toCamera,target:input.toTarget};const c=reconcileSiteHandoff(b,'C');
 assert.equal(c.key,'C');assert.equal(c.resume,true);assert.deepEqual(c.camera,b.camera);assert.equal(b.key,'B');
 const route=createSiteTransition();route.begin({...input,key:c.key,fromCamera:c.camera,fromTarget:c.target,toCamera:[0,0,1740],toTarget:[0,0,1737],alreadyOverview:false});
 assert.equal(route.sample(0)!.phase,'zoom-out');assert.deepEqual(route.sample(total)!.camera,[0,0,1740]);
});
test('canceling a lift below overview constraints cannot select a preset that pushes it outward',()=>{
 assert.equal(canKeepOverviewMode(3800,3000,4425),false);assert.equal(canKeepOverviewMode(4600,4000,4425),false);
 assert.equal(canKeepOverviewMode(6200,6200,4425),true);
});

test('coarse site framing shows sampled context and skyline without inventing terrain detail',()=>{
 assert.deepEqual(siteCameraOffset(40),[2.4,1.8,2.8]);assert.deepEqual(siteCameraOffset(240),[2.4,1.8,2.8]);
 const coarse=siteCameraOffset(4264.221153396021),horizontal=Math.hypot(coarse[0],coarse[2]);
 near(Math.atan2(coarse[1],horizontal)*180/Math.PI,15);assert.ok(Math.hypot(...coarse)>30&&Math.hypot(...coarse)<40);
 assert.ok(horizontal>=8*4264.221153396021/1000);assert.ok(Math.hypot(...siteCameraOffset(null))>30);
 assert.throws(()=>siteCameraOffset(NaN),RangeError);
});

test('phase boundaries preserve both camera and look target continuously',()=>{
 const c=createSiteTransition();c.begin(input);
 for(const boundary of [SITE_TRANSITION_MS.zoomOut,SITE_TRANSITION_MS.zoomOut+SITE_TRANSITION_MS.rotate,total]){
  const before=c.sample(boundary-.01)!,after=c.sample(boundary)!;
  for(const field of ['camera','target'] as const)assert.ok(Math.hypot(...before[field].map((v,i)=>v-after[field][i]))<1e-5);
 }
});
test('last ten kilometres have visible time and endpoint clearances remain exact',()=>{
 const c=createSiteTransition(),surface=1737.4,end=surface+1.8;
 c.begin({...input,alreadyOverview:true,fromCamera:[0,6200,0],fromTarget:[0,0,0],toCamera:[0,end,0],toTarget:[0,surface,0]});
 let firstWithin=Infinity,previous=Infinity;
 for(let ms=0;ms<=SITE_TRANSITION_MS.zoomIn;ms+=10){
  const sample=c.sample(ms)!,radius=Math.hypot(...sample.camera);
  assert.ok(Number.isFinite(radius)&&radius>=end-1e-8&&radius<=previous+1e-8);previous=radius;
  if(radius-surface<=10)firstWithin=Math.min(firstWithin,ms);
 }
 assert.ok(SITE_TRANSITION_MS.zoomIn-firstWithin>=1000);
 assert.deepEqual(c.sample(SITE_TRANSITION_MS.zoomIn)!.camera,[0,end,0]);
 assert.throws(()=>c.sample(NaN),/finite/);
});
test('overview turn is bounded, finite, and never dives below endpoint radius',()=>{
 const c=createSiteTransition();c.begin({...input,alreadyOverview:true,fromCamera:[-6200,0,0]});
 let previous=c.sample(0)!.camera;
 for(let ms=10;ms<=SITE_TRANSITION_MS.zoomIn;ms+=10){
  const current=c.sample(ms)!.camera,a=Math.hypot(...previous),b=Math.hypot(...current);
  const angle=Math.acos(Math.max(-1,Math.min(1,previous.reduce((sum,v,i)=>sum+v*current[i],0)/(a*b))));
  assert.ok(angle/.01<Math.PI*1.875/(SITE_TRANSITION_MS.zoomIn/1000)+1e-6);
  assert.ok(b>=1740-1e-8);previous=current;
 }
});
test('coarse elevations and center-target degeneracies preserve finite exact endpoints',()=>{
 for(const target of [[0,1747,0],[0,0,0]] as const){
  const c=createSiteTransition(),camera=[0,1756,34] as const;
  c.begin({...input,toTarget:target,toCamera:camera});
  for(let ms=0;ms<total;ms+=17)assert.ok(c.sample(ms)!.camera.every(Number.isFinite));
  assert.deepEqual(c.sample(total)!.camera,camera);assert.deepEqual(c.sample(total)!.target,target);
 }
});

test('site arrival retains lander and Follow even when requested before navigation begins',()=>{
 for(const mode of ['vehicle','follow','earth','sun'])assert.equal(retainCameraAfterSiteArrival({mode,reset:3},{mode,reset:3}),true,mode);
});
test('site arrival preserves newer explicit camera/reset requests and keeps ordinary site approach local',()=>{
 const start={mode:'globe',reset:3};
 assert.equal(retainCameraAfterSiteArrival(start,{mode:'vehicle',reset:3}),true);
 assert.equal(retainCameraAfterSiteArrival(start,{mode:'globe',reset:4}),true);
 assert.equal(retainCameraAfterSiteArrival(start,start),false);
 assert.equal(retainCameraAfterSiteArrival({mode:'orbit',reset:3},{mode:'orbit',reset:3}),false);
});
