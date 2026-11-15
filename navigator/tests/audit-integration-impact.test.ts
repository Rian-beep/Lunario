import test from 'node:test';import assert from 'node:assert/strict';
import {simulateFlight,DEFAULT_FLIGHT,LUNAR_MU,MOON_RADIUS_M} from '../lib/flight';
test('legacy contact meets the exact central-force radial fall benchmark without linear event interpolation',()=>{
 const R=MOON_RADIUS_M,h=100,r0=R+h,x=R/r0,m=4700;
 const expectedT=Math.sqrt(r0**3/(2*LUNAR_MU))*(Math.acos(Math.sqrt(x))+Math.sqrt(x*(1-x)));
 const speed=Math.sqrt(2*LUNAR_MU*(1/R-1/r0));
 const input={...DEFAULT_FLIGHT,mode:'descent' as const,landing:undefined,altitudeM:h,horizontalMps:0,verticalMps:0,wetMassKg:m,thrustN:0,burnSeconds:0,durationSeconds:30};
 for(const terrain of [undefined,()=>0]){const result=simulateFlight(input,terrain);const p=result.points.at(-1)!;
  assert.ok(result.status.includes('contact'));assert.ok(Math.abs(p.t-expectedT)<1e-6,`event time ${p.t} vs ${expectedT}`);
  assert.ok(Math.abs(p.speedMps-speed)<1e-7,`speed ${p.speedMps} vs ${speed}`);
  assert.ok(Math.abs(.5*m*p.speedMps**2-m*LUNAR_MU*(1/R-1/r0))<.01);
  assert.ok(Math.abs(p.yM)<1e-7);assert.equal(p.massKg,m);
 }
});
