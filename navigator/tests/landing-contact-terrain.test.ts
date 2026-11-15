import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import type {GlobalTerrainData} from '../lib/global-terrain';
import test from 'node:test';
import * as T from 'three';
import {createTouchdownSimulation, DEFAULT_TOUCHDOWN, type TouchdownTerrain, type TouchdownFragment, type TouchdownFrame} from '../lib/touchdown-physics';
import {contactSurfaceHeight, contactTerrainHeight, prepareContactTerrain, contactInitialPose} from '../components/workbench/scene/contact-dynamics';
import {siteFrame, MOON_RADIUS_M, displayHeight} from '../components/workbench/scene/surface';
import {latLonToProjected} from '../lib/astro';
import type {TerrainData} from '../lib/terrain';
import type {LandingContact} from '../lib/landing-contract';

const box: TouchdownFragment = {offset:[0,0,0], rotation:[0,0,0,1], halfExtents:[.5,.5,.5], massShare:1};
function field(height = -25, slope = 0): TouchdownTerrain {
  const columns=17, rows=17, stepM=4, x0M=-32, z0M=-32;
  return {columns,rows,stepM,x0M,z0M,heightsM:Float64Array.from({length:columns*rows},(_,i)=>height+(x0M+i%columns*stepM)*slope),
    initialPositionM:[0,height+.502,0], initialVelocityMps:[0,-5,0], initialRotation:[0,0,0,1]};
}
function near(a:number,b:number,tol=1e-5) {assert.ok(Math.abs(a-b)<tol, `${a} ≈ ${b}`);}
function terrainFixture(lat = -89, lon = 40, height = -1700): TerrainData {
  const {x,y}=latLonToProjected(lat,lon), width=81, stepM=100;
  return {version:1,source:'Numerical test fixture',sourcePage:'fixture',retrievedUtc:'2026-11-14',frame:'fixture',sourcePixelM:100,sampling:'fixture',patches:[],
    overview:{id:'fixture',width,height:width,stepM,x0:x-4000,y0:y+4000,heights:Array(width*width).fill(height)}};
}
const contact = ():LandingContact => ({timeS:20,eastM:120,northM:-90,yM:-1700,velocityMps:[3,-4,2],massKg:4321,
  terrainHeightM:-1700,terrainKnown:true,slopeDeg:0,tiltDeg:0,headingDeg:90,targetErrorM:150});
test('contact patch includes motion redirected from vertical impact, with a fixed vertex budget',async()=>{
  const impact={...contact(),eastM:0,northM:0,velocityMps:[0,-32,0] as [number,number,number]};
  const {field}=await prepareContactTerrain(terrainFixture(),siteFrame(-89,40,0),impact,12,new AbortController().signal);
  assert.ok(-field.x0M > Math.abs(impact.velocityMps[1])*12);
  assert.equal(field.columns*field.rows,65*65);
});
function corners(frame: TouchdownFrame) {
  const q=new T.Quaternion(...frame.rotation), p=new T.Vector3(...frame.position);
  return [-1,1].flatMap(x=>[-1,1].flatMap(y=>[-1,1].map(z=>new T.Vector3(x*.5,y*.5,z*.5).applyQuaternion(q).add(p))));
}

test('negative-height terrain catches the rigid body on the numerical surface, not reference y=0', async()=>{
  const terrain=field();
  const simulation=await createTouchdownSimulation({...DEFAULT_TOUCHDOWN,heightM:0,verticalSpeedMps:5,failureEnergyJ:1e12,restitution:0},[box],terrain);
  try {
    let hit=false, frame!:TouchdownFrame;
    for(let i=0;i<600;i++) {frame=simulation.step(); hit ||= frame.contact; for(const p of corners(frame)) assert.ok(p.y>-25.025,`${p.y} penetrates terrain`);}
    assert.ok(hit); near(frame.position[1],-24.5,.02); near(Math.hypot(...frame.velocity),0,.02);
  } finally {simulation.dispose();}
});

test('signed X/Z velocity and SI position are handed to Rapier without heading loss or release-height replacement',async()=>{
  const terrain=field(-50); terrain.initialPositionM=[-12,-20,8]; terrain.initialVelocityMps=[-3,4,-7];
  const simulation=await createTouchdownSimulation({...DEFAULT_TOUCHDOWN,heightM:0,verticalSpeedMps:4,horizontalSpeedMps:Math.hypot(3,7)},[box],terrain);
  try {const frame=simulation.step(); near(frame.velocity[0],-3);near(frame.velocity[1],4-1.62/120);near(frame.velocity[2],-7);
    near(frame.position[0],-12-3/120);near(frame.position[2],8-7/120);assert.ok(frame.position[1]>-20);assert.equal(frame.contact,false);
  } finally {simulation.dispose();}
});

test('both signs of slope collide and friction resists motion on the heightfield',async()=>{
  for(const slope of [-.2,.2]) {
    const terrain=field(-12,slope); terrain.initialPositionM[1]= -12+.5+Math.abs(slope)*.5+.01; terrain.initialVelocityMps=[0,-.1,0];
    const simulation=await createTouchdownSimulation({...DEFAULT_TOUCHDOWN,heightM:0,verticalSpeedMps:1,friction:1,restitution:0,failureEnergyJ:1e12},[box],terrain);
    try {let contact=false,frame!:TouchdownFrame;
      for(let i=0;i<600;i++) {frame=simulation.step();contact ||= frame.contact;for(const p of corners(frame)) assert.ok(p.y-(-12+p.x*slope)>-.025);}
      assert.ok(contact);assert.ok(Math.abs(frame.position[0])<2);assert.ok(Math.hypot(...frame.velocity)<.05);
    } finally {simulation.dispose();}
  }
});

test('fast breakup retains mass and no proxy tunnels through a negative terrain patch',async()=>{
  const terrain=field(-37);terrain.initialVelocityMps=[0,-100,0];
  const parts=[{...box,offset:[-1,0,0] as const,massShare:.4},{...box,offset:[1,0,0] as const,massShare:.6}];
  const simulation=await createTouchdownSimulation({...DEFAULT_TOUCHDOWN,massKg:1234,heightM:0,verticalSpeedMps:100,failureEnergyJ:0},parts,terrain);
  try {let broken=false;for(let i=0;i<240;i++) {const f=simulation.step();broken ||= f.broken;
    if(f.broken) {near(f.fragments.reduce((s,p)=>s+p.massKg,0),1234);for(const p of f.fragments)for(const c of corners({...f,...p}))assert.ok(c.y>-37.03,`${c.y} tunnels`);}}
    assert.ok(broken);
  } finally {simulation.dispose();}
});

test('curved Moon surface heights match the radial display sampler at displaced sites and negative DEM elevations',()=>{
  const data=terrainFixture(),frame=siteFrame(-89,40,0);
  for(const [east,south] of [[0,0],[500,-600],[-900,400]]) {
    const h=contactSurfaceHeight(data,frame,east,south);near(h.yM,Math.sqrt((MOON_RADIUS_M-1700)**2-east**2-south**2)-MOON_RADIUS_M,1e-6);
    const direction=frame.up.clone().multiplyScalar(frame.referenceRadiusM+h.yM).addScaledVector(frame.east,east).addScaledVector(frame.north,-south).normalize();
    const sample=displayHeight(data,Math.asin(direction.z)*180/Math.PI,Math.atan2(direction.y,direction.x)*180/Math.PI,0);
    near(sample.heightM,-1700);assert.ok(h.coverage>.99);
    near(Math.hypot(east,frame.referenceRadiusM+h.yM,south),MOON_RADIUS_M+sample.heightM);
  }
});

test('terrain preparation is finite, cooperative, curved and preserves the contact frame signs',async()=>{
  const frame=siteFrame(-89,40,0),c=contact(),abort=new AbortController();
  let ticks=0;const timer=setInterval(()=>ticks++,0);
  try {const {field:terrain,note}=await prepareContactTerrain(terrainFixture(),frame,c,12,abort.signal);
    assert.ok(ticks>=10);assert.deepEqual(terrain.initialVelocityMps,[3,-4,-2]);assert.equal(terrain.heightsM.length,65*65);
    near(contactTerrainHeight(terrain,0,0)!,contactSurfaceHeight(terrainFixture(),frame,c.eastM,-c.northM).yM-c.yM,1e-7);
    assert.equal(contactTerrainHeight(terrain,1e6,0),null);assert.match(note,/finite.*not qualified/);
    const pose=contactInitialPose(c,frame,terrain,[box]);assert.ok(pose.liftM>.4);near(Math.hypot(...terrain.initialRotation),1);
  } finally {clearInterval(timer);}
});

test('unknown terrain is explicit and cannot become a qualified reference-plane collider',async()=>{
  const abort=new AbortController(),c=contact();
  assert.equal(contactSurfaceHeight(null,siteFrame(-89,40,-1000),0,0).coverage,0);
  await assert.rejects(prepareContactTerrain(null,siteFrame(-89,40,0),c,12,abort.signal),/unknown/);
  abort.abort();await assert.rejects(prepareContactTerrain(terrainFixture(),siteFrame(-89,40,0),c,12,abort.signal),/abort/i);
});

test('coarse global coverage stays explicitly coarse when sampled more densely for contact',async()=>{
  const metadata=JSON.parse(await readFile(new URL('../public/data/global-terrain.json',import.meta.url),'utf8'));
  const globalTerrain:GlobalTerrainData={...metadata,width:8,height:4,angularStepDeg:45,samples:new Int16Array(32).fill(-4000),northPoleM:-2000,southPoleM:-2000};
  const data=terrainFixture();data.overview.x0=1e9;data.globalTerrain=globalTerrain;
  const c={...contact(),eastM:0,northM:0,yM:-2000,terrainHeightM:-2000};
  const {field,note}=await prepareContactTerrain(data,siteFrame(-89,40,0),c,1,new AbortController().signal);
  near(contactTerrainHeight(field,0,0)!,0);assert.match(note,/coarse.*not fine footprint evidence/);
});

test('heightfield validation rejects holes, bad bounds and unsupported velocities, and snapshots caller data',async()=>{
  const bad=[{columns:1},{rows:130},{stepM:0},{heightsM:new Float64Array([1])},{initialVelocityMps:[0,-101,0]},{initialRotation:[0,0,0,0]}];
  for(const change of bad)await assert.rejects(createTouchdownSimulation(DEFAULT_TOUCHDOWN,[box],{...field(),...change} as TouchdownTerrain),/heightfield/);
  const hole=field();hole.heightsM[5]=NaN;await assert.rejects(createTouchdownSimulation(DEFAULT_TOUCHDOWN,[box],hole),/heightfield/);
  const terrain=field(); const pending=createTouchdownSimulation({...DEFAULT_TOUCHDOWN,failureEnergyJ:1e12},[box],terrain);
  terrain.heightsM.fill(100);terrain.initialPositionM[1]=900;terrain.initialVelocityMps[1]=-999;
  const sim=await pending;try {const next=sim.step();assert.ok(next.position[1]<0);assert.ok(Math.abs(next.velocity[1])<6);}finally{sim.dispose();}
});


test('aborting after terrain/world allocation cancels body preparation without leaving a stale simulation',async()=>{
  const abort=new AbortController(),terrain=field();terrain.signal=abort.signal;
  const many=Array.from({length:256},()=>({...box,massShare:1/256}));
  const pending=createTouchdownSimulation(DEFAULT_TOUCHDOWN,many,terrain);
  setTimeout(()=>abort.abort(),15);await assert.rejects(pending,/abort/i);
  const fresh=await createTouchdownSimulation(DEFAULT_TOUCHDOWN,[box],field());
  try {assert.ok(fresh.step().position.every(Number.isFinite));} finally {fresh.dispose();}
});
