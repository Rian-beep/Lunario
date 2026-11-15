import {test} from 'node:test';import assert from 'node:assert/strict';import snapshot from '../public/data/orbits/catalog.json';
import {GET} from '../app/api/orbits/route';
test('fixed-source refresh coalesces, caches two hours and retains dated data on provider failure',async()=>{
 const savedFetch=globalThis.fetch,savedNow=Date.now;let now=Date.parse(snapshot.fetchedUtc)+2*3600000+1,calls=0,fail=false;
 Date.now=()=>now;globalThis.fetch=async(input)=>{calls++;const url=new URL(String(input));assert.equal(url.origin,'https://celestrak.org');assert.equal(url.pathname,'/NORAD/elements/gp.php');const row=snapshot.elements.find(e=>e.NORAD_CAT_ID===Number(url.searchParams.get('CATNR')));assert.ok(row);return new Response(JSON.stringify(fail?[]:[row]),{status:200});};
 try{const rows=await Promise.all([GET(),GET(),GET()]);assert.equal(calls,6);assert.equal((await rows[0].json()).elements.length,6);await GET();assert.equal(calls,6);now+=2*3600000+1;fail=true;const prior=await(await GET()).json();assert.match(prior.refreshStatus,/unavailable/);assert.equal(prior.elements.length,6);assert.equal(calls,12);await GET();assert.equal(calls,12);}
 finally{globalThis.fetch=savedFetch;Date.now=savedNow;}
});
