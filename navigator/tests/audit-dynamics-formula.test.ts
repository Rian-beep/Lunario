import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_FLIGHT, simulateFlight, type FlightInputs} from '../lib/flight';
import {DEFAULT_LANDING_CONFIGURATION} from '../lib/landing-contract';
import {landingTargetDistanceM, LUNAR_SIDEREAL_RATE_RAD_S} from '../lib/landing-flight';
import {evaluateEngineeringScreens, type EngineeringInputs} from '../lib/engineering-screens';
import {createTouchdownSimulation, DEFAULT_TOUCHDOWN} from '../lib/touchdown-physics';
import {prepareTouchdownFragments} from '../lib/touchdown-fragments';
import * as T from 'three';

// Frozen external constants: JPL DE440 GM (km^3/s^2 -> SI), NASA mean sphere,
// NIST standard terrestrial gravity. Synthetic t=0; no ephemeris date is implied.
const MU=4902.800118*1e9, R=1737400, G0=9.80665;
const close=(x:number,y:number,tol:number)=>assert.ok(Math.abs(x-y)<=tol,`${x} vs ${y}, abs error ${Math.abs(x-y)} > ${tol}`);
const manual={...DEFAULT_LANDING_CONFIGURATION,guidance:'manual' as const};
const coast:FlightInputs={...DEFAULT_FLIGHT,altitudeM:100000,thrustN:0,burnSeconds:0,pitchDeg:90,finalPitchDeg:90};
const screen=(id:keyof EngineeringInputs,input:Record<string,number>)=>evaluateEngineeringScreens({[id]:input}).find(x=>x.id===id)!;
const metric=(r:ReturnType<typeof screen>,label:string)=>{const m=r.metrics.find(x=>x.label===label);assert.ok(m&&m.value!==null,label);return m.value;};

for (const configured of [false,true]) {
  const landing=configured?manual:undefined;
  test(`${configured?'configured':'legacy'} force/mass and short hover limits use lunar gravity but terrestrial Isp conversion`,()=>{
    const dt=.001, h=100000, g=MU/(R+h)**2, mass=1000, thrust=3000;
    const inputs={...coast,landing,durationSeconds:dt,wetMassKg:mass,dryMassKg:500,ispSeconds:300,burnSeconds:1,thrustN:thrust};
    const powered=simulateFlight(inputs).points.at(-1)!;
    const unpowered=simulateFlight({...inputs,thrustN:0}).points.at(-1)!;
    close((powered.verticalMps-unpowered.verticalMps)/dt,thrust/mass,2e-6);
    const hover=simulateFlight({...inputs,thrustN:mass*g}).points.at(-1)!;
    close(hover.verticalMps,0,1e-8);
    close(powered.massKg,mass-thrust*dt/(300*G0),1e-9);
  });
  test(`${configured?'configured':'legacy'} fractional burn, propellant depletion and ideal delta-v`,()=>{
    const inputs={...coast,landing,durationSeconds:5,wetMassKg:1000,dryMassKg:500,ispSeconds:300,burnSeconds:.37,thrustN:10000};
    const r=simulateFlight(inputs), finalMass=1000-10000*.37/(300*G0);
    close(r.points.at(-1)!.massKg,finalMass,1e-9);
    close(r.deltaVMps,300*G0*Math.log(1000/finalMass),1e-8);
    const depleted=simulateFlight({...inputs,dryMassKg:999.9,burnSeconds:5});
    close(depleted.points.at(-1)!.massKg,999.9,1e-9);
    assert.equal(depleted.fuelExhausted,true);
    close(depleted.deltaVMps,300*G0*Math.log(1000/999.9),1e-8);
  });
  test(`${configured?'configured':'legacy'} circular two-body closed form, energy and angular momentum`,()=>{
    const r0=R+100000,speed=Math.sqrt(MU/r0),n=Math.sqrt(MU/r0**3),t=600;
    const r=simulateFlight({...coast,landing,horizontalMps:speed,durationSeconds:t});
    const p=r.points.at(-1)!;
    close(p.positionM[0],r0*Math.sin(n*t),1e-5);close(p.positionM[1],r0*Math.cos(n*t),1e-5);
    close(p.speedMps**2/2-MU/Math.hypot(...p.positionM),-MU/(2*r0),1e-5);
    close(p.positionM[1]*p.velocityMps[0]-p.positionM[0]*p.velocityMps[1],r0*speed,.01);
  });
}

test('configured radial fall reaches the same surface with independent energy and exact time-of-fall',()=>{
  const h=100,r0=R+h,x=R/r0;
  const expectedTime=Math.sqrt(r0**3/(2*MU))*(Math.acos(Math.sqrt(x))+Math.sqrt(x*(1-x)));
  const expectedSpeed=Math.sqrt(2*MU*(1/R-1/r0));
  const r=simulateFlight({...coast,altitudeM:h,verticalMps:0,landing:manual,durationSeconds:30},()=>0),c=r.contact!;
  close(c.timeS,expectedTime,1e-6);close(-c.velocityMps[1],expectedSpeed,1e-7);
  close(c.yM,0,1e-7);close(.5*c.massKg*c.velocityMps[1]**2,c.massKg*MU*(1/R-1/r0),.01);
});

test('constant-spin equatorial frame agrees with circular inertial solution transformed analytically',()=>{
  const r0=R+100000,n=Math.sqrt(MU/r0**3),w=LUNAR_SIDEREAL_RATE_RAD_S,t=120;
  const r=simulateFlight({...coast,landing:manual,horizontalMps:(n-w)*r0,durationSeconds:t},undefined,R,{latitudeDeg:0});
  const p=r.points.at(-1)!;
  close(p.positionM[0],r0*Math.sin((n-w)*t),1e-5);close(p.positionM[1],r0*Math.cos((n-w)*t),1e-5);
});

test('target distance is a sphere arc in metres, separate from chord and tangent-plane distance',()=>{
  const angle=.04,r=R+3000,h=-125;
  close(landingTargetDistanceM((r+h)*Math.sin(angle),0,(r+h)*Math.cos(angle)-r,r),r*angle,1e-8);
  assert.ok(Math.abs(r*angle-r*Math.sin(angle))>10);
});

test('negative numerical surfaces, contact mass and known failure precedence remain explicit',()=>{
  const a={...coast,landing:{...manual,maxVerticalMps:5000,maxHorizontalMps:5000,maxTiltDeg:90,targetRadiusM:100000,breakupEnergyJ:1e15},altitudeM:10,verticalMps:-2,durationSeconds:30};
  const r=simulateFlight(a,()=>-25),c=r.contact!;
  close(c.yM,-25,1e-7);close(c.massKg,a.wetMassKg,1e-12);
  assert.equal(r.landingOutcome!.state,'within-assumed-limits');
  assert.equal(simulateFlight(a).landingOutcome!.state,'unresolved');
  const fail=simulateFlight({...a,landing:{...a.landing,maxVerticalMps:0}});
  assert.equal(fail.landingOutcome!.state,'outside-assumed-limits');
  const energy=.5*c.massKg*Math.hypot(...c.velocityMps)**2;
  assert.equal(simulateFlight({...a,landing:{...a.landing,breakupEnergyJ:energy}},()=>-25).landingOutcome!.state,'outside-assumed-limits');
});

test('trajectory screen agrees with independent angular-momentum/apsis equations and reverse transfer',()=>{
  const input={wetMassKg:5000,dryMassKg:2500,ispSeconds:300,requiredDeltaVMps:0,radiusM:R,muM3s2:MU,initialAltitudeM:100000,targetAltitudeM:200000};
  const r1=R+100000,r2=R+200000,l=Math.sqrt(2*MU*r1*r2/(r1+r2));
  const expected=Math.abs(l/r1-Math.sqrt(MU/r1))+Math.abs(Math.sqrt(MU/r2)-l/r2);
  const result=screen('trajectory',input);
  close(metric(result,'Ideal Hohmann total delta-v'),expected,1e-10);
  close(metric(result,'Half-ellipse transfer time'),2*Math.PI*Math.sqrt(((r1+r2)/2)**3/MU)/2,1e-9);
  close(metric(result,'Ideal rocket delta-v'),300*G0*Math.log(2),1e-10);
  assert.equal(result.state,'conditional');
  close(metric(screen('trajectory',{...input,initialAltitudeM:200000,targetAltitudeM:100000}),'Ideal Hohmann total delta-v'),expected,1e-10);
});

test('touchdown screen work/energy and static support boundary; missing inputs cannot become pass',()=>{
  const input={massKg:1000,verticalSpeedMps:4,horizontalSpeedMps:3,stoppingDistanceM:2,maxDecelerationMps2:4,halfSupportWidthM:1,centerOfMassHeightM:1,slopeDeg:0,gravityMps2:1.62};
  const r=screen('touchdown',input);
  close(metric(r,'Total contact kinetic energy'),12500,1e-10);
  close(metric(r,'Constant net vertical deceleration'),4,1e-10);
  close(metric(r,'Ideal normal support load factor'),(1000*4+1000*1.62)/(1000*1.62),1e-12);
  assert.equal(r.state,'conditional');
  assert.equal(screen('touchdown',{...input,slopeDeg:45}).state,'fail');
  assert.equal(screen('touchdown',{verticalSpeedMps:4,maxDecelerationMps2:0}).state,'fail');
  assert.ok(evaluateEngineeringScreens().every(r=>r.state==='not-assessed'));
  assert.ok(evaluateEngineeringScreens({trajectory:{wetMassKg:2,dryMassKg:1,ispSeconds:300}}).every(r=>r.state==='not-assessed'));
});

test('radiative blackbody limiting case uses independent total power and no instantaneous survival pass',()=>{
  const r=screen('thermal',{projectedAreaM2:1,radiatingAreaM2:1,absorptivity:0,emissivity:1,solarFluxWm2:0,solarIncidenceFactor:0,albedoFluxWm2:0,infraredFluxWm2:0,planetViewFactor:0,internalPowerW:459.300327939,environmentTempK:0,minTempK:299,maxTempK:301,heaterCapacityW:0});
  close(metric(r,'Unheated equilibrium temperature'),300,1e-9);assert.equal(r.state,'conditional');
});

test('rigid proxy follows disclosed constant-gravity ballistic limit before any contact',async()=>{
  const simulation=await createTouchdownSimulation({...DEFAULT_TOUCHDOWN,heightM:100,verticalSpeedMps:2,horizontalSpeedMps:3});
  try {
    let frame=simulation.step();for(let i=1;i<120;i++)frame=simulation.step();
    close(frame.velocity[1],-3.62,1e-4);close(frame.position[1],101.8-2-.81,.02);close(frame.position[0],3,1e-4);
    assert.equal(frame.contact,false);assert.equal(frame.broken,false);
  } finally {simulation.dispose();}
});

test('fragment mass shares follow padded bounding boxes, independent of nominal mesh naming',async()=>{
  const model=new T.Group();
  const a=new T.Mesh(new T.BoxGeometry(1,1,1)),b=new T.Mesh(new T.BoxGeometry(2,2,2));b.position.x=4;model.add(a,b);
  try {
    const pieces=await prepareTouchdownFragments(model);
    close(pieces.descriptors[0].massShare,1/9,1e-12);close(pieces.descriptors[1].massShare,8/9,1e-12);
    assert.deepEqual(pieces.descriptors[1].offset,[4,0,0]);
  } finally {a.geometry.dispose();b.geometry.dispose();}
});
