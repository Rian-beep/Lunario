/** Reproduce bounded numerical evidence, including an isolated baseline and step refinements.
 * Run: npx tsx scripts/audit-dynamics.ts [output.json]
 * Only temporary copies change step size. Repository code/constants are never mutated.
 */
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve, join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import type * as Flight from '../lib/flight';
import {DEFAULT_LANDING_CONFIGURATION} from '../lib/landing-contract';
import {createTouchdownSimulation, DEFAULT_TOUCHDOWN} from '../lib/touchdown-physics';
import {landingTargetDistanceM, LUNAR_SIDEREAL_RATE_RAD_S} from '../lib/landing-flight';
import {evaluateEngineeringScreens} from '../lib/engineering-screens';

const baseline='96079ae',root=process.cwd(),MU=4902.800118e9,R=1737400,G0=9.80665;
async function isolated(stepLegacy:number,stepConfigured:number,revision?:string):Promise<{flight:typeof Flight;dispose:()=>Promise<void>}> {
  const dir=await mkdtemp(join(tmpdir(),'audit-dynamics-'));
  for (const file of ['flight','landing-flight','landing-contract','landing-inputs']) {
    let text=revision?execFileSync('git',['show',`${revision}:navigator/lib/${file}.ts`],{encoding:'utf8'}):await readFile(resolve(root,`lib/${file}.ts`),'utf8');
    const anchor=file==='flight'?'Math.min(0.25, a.durationSeconds - t)':'Math.min(0.1, a.durationSeconds - t)';
    if (file==='flight'||file==='landing-flight') {
      if(!text.includes(anchor))throw new Error(`Step anchor missing in ${file}`);
      text=text.replace(anchor,`Math.min(${file==='flight'?stepLegacy:stepConfigured}, a.durationSeconds - t)`);
    }
    await writeFile(join(dir,`${file}.ts`),text);
  }
  await build({entryPoints:[join(dir,'flight.ts')],bundle:true,platform:'node',format:'esm',outfile:join(dir,'flight.mjs'),logLevel:'silent'});
  const flight=await import(pathToFileURL(join(dir,'flight.mjs')).href) as typeof Flight;
  return {flight,dispose:()=>rm(dir,{recursive:true,force:true})};
}
const norm=(a:readonly number[])=>Math.hypot(...a);
const difference=(a:readonly number[],b:readonly number[])=>norm(a.map((v,i)=>v-b[i]));
function radial(flight:typeof Flight,configured:boolean) {
  const r0=R+100,x=R/r0;
  const expectedTimeS=Math.sqrt(r0**3/(2*MU))*(Math.acos(Math.sqrt(x))+Math.sqrt(x*(1-x)));
  const expectedSpeedMps=Math.sqrt(2*MU*(1/R-1/r0));
  const a={...flight.DEFAULT_FLIGHT,mode:'descent' as const,altitudeM:100,verticalMps:0,thrustN:0,burnSeconds:0,durationSeconds:30,pitchDeg:90,finalPitchDeg:90,
    landing:configured?{...DEFAULT_LANDING_CONFIGURATION,guidance:'manual' as const}:undefined};
  const c=flight.simulateFlight(a,()=>0).contact!;
  return {input:a,expectedTimeS,expectedSpeedMps,contact:c,timeErrorS:c.timeS-expectedTimeS,speedErrorMps:norm(c.velocityMps)-expectedSpeedMps,
    heightResidualM:c.yM,energyErrorJ:.5*c.massKg*norm(c.velocityMps)**2-c.massKg*MU*(1/R-1/r0)};
}
function nonfinite(flight:typeof Flight) {
  return [NaN,Infinity,-Infinity].map(value=>{
    const result=flight.simulateFlight({...flight.DEFAULT_FLIGHT,altitudeM:1,verticalMps:-1,thrustN:0,burnSeconds:0,durationSeconds:5},()=>value);
    const c=result.contact;
    return {height:String(value),status:result.status,hasContact:!!c,finiteContact:!!c&&[c.timeS,c.eastM,c.northM,c.yM,c.massKg,...c.velocityMps,c.targetErrorM,c.tiltDeg,c.headingDeg].every(Number.isFinite),
      timeS:c?.timeS??null};
  });
}
function penetratingStart(flight:typeof Flight) {
  const input={...flight.DEFAULT_FLIGHT,altitudeM:10,verticalMps:-1,thrustN:0,burnSeconds:0,durationSeconds:5};
  try {return {input,rejected:false,contact:flight.simulateFlight(input,()=>20).contact};}
  catch(error) {return {input,rejected:true,error:error instanceof Error?error.message:String(error)};}
}
async function main() {
  const coarse=await isolated(.25,.1),base=await isolated(.25,.1,baseline);
  try {
    const f=coarse.flight,manual={...DEFAULT_LANDING_CONFIGURATION,guidance:'manual' as const};
    const out:Record<string,unknown>={baseline,measuredUtc:new Date().toISOString(),runtime:{node:process.version,platform:process.platform,arch:process.arch},
      frame:'Moon-centred site east/up/north (left handed), synthetic elapsed SI seconds t=0; no UTC/TDB epoch or ephemeris targeting',
      constants:{muM3s2:MU,referenceRadiusM:R,g0Mps2:G0,centralSurfaceGravityMps2:MU/R**2,rigidProxyGravityMps2:1.62},
      nonfinite:{before:nonfinite(base.flight),after:nonfinite(f)},
      penetratingStart:{before:penetratingStart(base.flight),after:penetratingStart(f)},
      radial:{beforeLegacy:radial(base.flight,false),afterLegacy:radial(f,false),configured:radial(f,true)}};
    const a={...f.DEFAULT_FLIGHT,altitudeM:100000,verticalMps:0,pitchDeg:90,finalPitchDeg:90,wetMassKg:1000,dryMassKg:500,thrustN:3000,ispSeconds:300,burnSeconds:1,durationSeconds:.001};
    out.propulsion=[false,true].map(configured=>{
      const input={...a,landing:configured?manual:undefined},p=f.simulateFlight(input).points.at(-1)!,ballistic=f.simulateFlight({...input,thrustN:0}).points.at(-1)!;
      const massExpected=a.wetMassKg-a.thrustN*a.durationSeconds/(a.ispSeconds*G0);
      const hover=f.simulateFlight({...input,thrustN:a.wetMassKg*MU/(R+a.altitudeM)**2}).points.at(-1)!;
      return {configured,input,forceMassAccelerationErrorMps2:(p.verticalMps-ballistic.verticalMps)/a.durationSeconds-a.thrustN/a.wetMassKg,massErrorKg:p.massKg-massExpected,hoverVerticalMps:hover.verticalMps};
    });
    const circleInput={...f.DEFAULT_FLIGHT,altitudeM:100000,horizontalMps:Math.sqrt(MU/(R+100000)),thrustN:0,burnSeconds:0,durationSeconds:600};
    out.circular=[false,true].map(configured=>{
      const r=f.simulateFlight({...circleInput,landing:configured?manual:undefined}),p=r.points.at(-1)!,r0=R+100000,n=Math.sqrt(MU/r0**3),theta=n*p.t;
      return {configured,input:circleInput,positionErrorM:difference(p.positionM,[r0*Math.sin(theta),r0*Math.cos(theta),0]),
        energyErrorJPerKg:p.speedMps**2/2-MU/norm(p.positionM)+MU/(2*r0),angularMomentumErrorM2PerS:p.positionM[1]*p.velocityMps[0]-p.positionM[0]*p.velocityMps[1]-r0*Math.sqrt(MU/r0)};
    });
    const w=LUNAR_SIDEREAL_RATE_RAD_S,r0=R+100000,n=Math.sqrt(MU/r0**3),duration=120;
    const spinInput={...circleInput,landing:manual,horizontalMps:(n-w)*r0,durationSeconds:duration};
    const spin=f.simulateFlight(spinInput,undefined,R,{latitudeDeg:0}).points.at(-1)!;
    out.rotating={input:spinInput,environment:{latitudeDeg:0,rotationRateRadS:w},
      positionErrorM:difference(spin.positionM,[r0*Math.sin((n-w)*duration),r0*Math.cos((n-w)*duration),0])};
    const theta=.04,radius=R+3000,height=-125;
    out.targetArc={input:{eastM:(radius+height)*Math.sin(theta),northM:0,yM:(radius+height)*Math.cos(theta)-radius,radiusM:radius},
      arcErrorM:landingTargetDistanceM((radius+height)*Math.sin(theta),0,(radius+height)*Math.cos(theta)-radius,radius)-radius*theta};
    const screenInput={trajectory:{wetMassKg:5000,dryMassKg:2500,ispSeconds:300,requiredDeltaVMps:0,radiusM:R,muM3s2:MU,initialAltitudeM:100000,targetAltitudeM:200000},
      touchdown:{massKg:1000,verticalSpeedMps:4,horizontalSpeedMps:3,stoppingDistanceM:2,maxDecelerationMps2:4,halfSupportWidthM:1,centerOfMassHeightM:1,slopeDeg:0,gravityMps2:1.62}};
    const screens=evaluateEngineeringScreens(screenInput),trajectory=screens.find(s=>s.id==='trajectory')!,r1=R+100000,r2=R+200000,l=Math.sqrt(2*MU*r1*r2/(r1+r2));
    out.screens={input:screenInput,results:screens.filter(s=>['trajectory','touchdown'].includes(s.id)),
      hohmannErrorMps:trajectory.metrics.find(m=>m.label==='Ideal Hohmann total delta-v')!.value!-(Math.abs(l/r1-Math.sqrt(MU/r1))+Math.abs(Math.sqrt(MU/r2)-l/r2)),
      rocketBudgetErrorMps:trajectory.metrics.find(m=>m.label==='Ideal rocket delta-v')!.value!-300*G0*Math.log(2)};
    const assisted={...f.DEFAULT_FLIGHT,mode:'descent' as const,altitudeM:300,eastOffsetM:-300,northOffsetM:0,horizontalMps:10,verticalMps:-8,headingDeg:90,pitchDeg:90,finalPitchDeg:90,burnSeconds:240,durationSeconds:300,landing:{...DEFAULT_LANDING_CONFIGURATION}};
    const convergence=[];
    for(const step of [.1,.05,.025,.0125]) {
      const isolatedRun=await isolated(step*2.5,step);
      try {const c=isolatedRun.flight.simulateFlight(assisted,()=>0).contact!;
        convergence.push({stepS:step,timeS:c.timeS,positionM:[c.eastM,c.yM,c.northM],velocityMps:c.velocityMps,massKg:c.massKg});
      } finally {await isolatedRun.dispose();}
    }
    const fine=convergence.at(-1)!;
    out.assistedConvergence={input:assisted,terrain:'synthetic local y=0 m',referenceStepS:fine.stepS,rows:convergence.map(row=>({...row,
      timeDifferenceS:row.timeS-fine.timeS,positionDifferenceM:difference(row.positionM,fine.positionM),velocityDifferenceMps:difference(row.velocityMps,fine.velocityMps),massDifferenceKg:row.massKg-fine.massKg}))};
    const radialConvergence=[];
    for(const step of [.25,.125,.0625]) {const run=await isolated(step,.1);try {radialConvergence.push({stepS:step,...radial(run.flight,false)});}finally{await run.dispose();}}
    out.legacyContactConvergence=radialConvergence;
    const sim=await createTouchdownSimulation({...DEFAULT_TOUCHDOWN,heightM:100,verticalSpeedMps:2,horizontalSpeedMps:3});
    try {let frame=sim.step();for(let i=1;i<120;i++)frame=sim.step();out.rigidBallistic={input:{...DEFAULT_TOUCHDOWN,heightM:100,verticalSpeedMps:2,horizontalSpeedMps:3},frame,
      verticalVelocityErrorMps:frame.velocity[1]+3.62,heightErrorM:frame.position[1]-(101.8-2-.81),horizontalPositionErrorM:frame.position[0]-3};}finally{sim.dispose();}
    const target=process.argv[2];const text=JSON.stringify(out,null,2)+'\n';if(target)await writeFile(resolve(target),text);else process.stdout.write(text);
  } finally {await coarse.dispose();await base.dispose();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
