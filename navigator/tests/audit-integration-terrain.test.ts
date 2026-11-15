import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {resampleRegisteredTerrain} from '../scripts/terrain-resample.mjs';
test('registered upsample nodes follow a linear source plane through the cutout boundary, without edge replication',()=>{
 const a=new Float32Array([0,10,20,30,40,50,60,70,80]);
 const r=resampleRegisteredTerrain(a,3,3,4,4,.5,.5);
 for(let y=0;y<4;y++)for(let x=0;x<4;x++)assert.equal(r[y*4+x],x*5+y*15);
 assert.equal(r[15],60); // Unpadded 2×2 cutout edge replication incorrectly gives 40.
});
test('unknown, no-data and unsupported terrain stencil samples cannot become plausible finite elevations',()=>{
 for(const bad of [NaN,-32768,-3.4028234663852886e38]){
  const r=resampleRegisteredTerrain([0,10,30,bad],2,2,3,3,.5,.5,-32768);
  assert.equal(r[0],0);assert.ok(Number.isNaN(r[4]));assert.ok(Number.isNaN(r[8]));
 }
 const r=resampleRegisteredTerrain([0,10,30,40],2,2,4,4,.5,.5);assert.ok(Number.isNaN(r[15]));
 assert.throws(()=>resampleRegisteredTerrain([0],2,2,1,1,1,1));
});
test('both production terrain builders use registered native sampling with source-pixel halos',()=>{
 for(const name of ['prepare-terrain.mjs','prepare-fine-terrain.mjs']){const text=readFileSync('scripts/'+name,'utf8');assert.match(text,/resampleRegisteredTerrain\(raw/);assert.match(text,/window\[2\]\+1,window\[3\]\+1/);assert.ok(!text.includes('resampleMethod: "bilinear"'));}
});
