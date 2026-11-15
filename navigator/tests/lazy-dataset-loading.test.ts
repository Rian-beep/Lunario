import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadTerrain,type SerializedTerrainData} from '../lib/terrain';
import {loadImagery} from '../lib/imagery';
const fixture:SerializedTerrainData={version:1,source:'Synthetic loader fixture',sourcePage:'https://example.invalid',retrievedUtc:'2026-01-01',frame:'test',sourcePixelM:10,sampling:'synthetic',overview:{id:'test',width:1,height:1,x0:0,y0:0,stepM:10,heights:[7]},patches:[]};
test('terrain coalesces concurrent loads, retries a failed request and reuses the decoded result',async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,0));return calls===1?new Response('',{status:503}):Response.json(fixture);};
 try{const a=loadTerrain(),b=loadTerrain();assert.equal(a,b);const results=await Promise.allSettled([a,b]);assert.ok(results.every(r=>r.status==='rejected'));assert.equal(calls,1);const value=await loadTerrain();assert.deepEqual(value.overview.heights,[7]);assert.equal(await loadTerrain(),value);assert.equal(calls,2);}finally{globalThis.fetch=original;}
});
test('embedded terrain decodes once per input and retries invalid input without requesting HTTP',async()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'window'),original=globalThis.fetch;let calls=0;const raw=structuredClone(fixture);delete raw.overview.heights;raw.overview.encodedHeights='BwA=';raw.overview.heightOffsetM=0;raw.overview.heightScaleM=1;
 Object.defineProperty(globalThis,'window',{configurable:true,value:{__SOLARREACH_TERRAIN__:raw}});globalThis.fetch=async()=>{calls++;throw Error('unexpected HTTP');};
 try{const a=loadTerrain(),b=loadTerrain();assert.equal(a,b);assert.deepEqual((await a).overview.heights,[7]);const invalid=structuredClone(raw);invalid.overview.width=2;(window as unknown as {__SOLARREACH_TERRAIN__:SerializedTerrainData}).__SOLARREACH_TERRAIN__=invalid;await assert.rejects(loadTerrain(),/sample count/);invalid.overview.width=1;assert.deepEqual((await loadTerrain()).overview.heights,[7]);assert.equal(calls,0);}finally{globalThis.fetch=original;if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window');}
});
test('imagery metadata uses a shared retriable load across map and 3D consumers',async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,0));return calls===1?new Response('',{status:503}):Response.json({source:'synthetic metadata'});};
 try{const a=loadImagery(),b=loadImagery();assert.equal(a,b);assert.ok((await Promise.allSettled([a,b])).every(r=>r.status==='rejected'));const value=await loadImagery();assert.equal(await loadImagery(),value);assert.equal(calls,2);}finally{globalThis.fetch=original;}
});
