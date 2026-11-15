import {createHash} from 'node:crypto';
import test from 'node:test';import assert from 'node:assert/strict';
import {providerFreshness,providerMissionOverlap,providerRequestKey,validateMissionPeriod} from '../lib/providers/contract';
import {parseNoaaXray,fetchNoaaXray,xrayClass,MAX_XRAY_BYTES} from '../lib/providers/noaa-xray';
import {commsInferenceSummary} from '../lib/providers/comms';
import {DATA_SOURCE_REGISTRY} from '../lib/providers/registry';
const period={startUtc:'2027-06-29T11:00:00Z',endUtcExclusive:'2027-07-13T11:00:00Z'},now=Date.parse('2026-11-14T12:00:00Z');
const row=(time='2026-11-14T11:59:00Z',flux=2.4e-6)=>({time_tag:time,flux,energy:'0.1-0.8nm'});
test('NOAA thresholds use stated W/m² channel and retain actual observation timestamps',()=>{
 for(const [flux,expected] of [[1e-8,'A1.0'],[1e-7,'B1.0'],[1e-6,'C1.0'],[1e-5,'M1.0'],[1e-4,'X1.0']] as const)assert.equal(xrayClass(flux),expected);
 const payload=[row('2026-11-14T11:58:00Z'),row(),{...row(),energy:'0.05-0.4nm',flux:1e-4}],before=structuredClone(payload),data=parseNoaaXray(payload,period,now);
 assert.equal(data.value!.latest.flareClass,'C2.4');assert.equal(data.value!.sampleCount,2);assert.equal(data.kind,'observation');assert.equal(data.observedEndUtcExclusive,'2026-11-14T11:59:00.000Z');assert.deepEqual(payload,before);
 assert.equal(providerFreshness(data,now),'fresh');assert.equal(providerMissionOverlap(data,period),'none');
 assert.equal(providerFreshness(data,Date.parse('2026-11-14T12:09:00Z')),'stale');
});
test('missing, stale, negative, nonfinite, future and conflicting rows never create quiet or future coverage',()=>{
 const data=parseNoaaXray([row('2026-11-15T00:00:00Z'),row('bad',1),row(undefined,-1),row(undefined,0),row(undefined,Infinity)],period,now);
 assert.equal(data.value,null);assert.equal(data.coverage,'unavailable');assert.equal(providerFreshness(data,now),'unavailable');assert.equal(providerMissionOverlap(data,period),'none');
 const old=parseNoaaXray([row('2020-01-01T00:00:00Z')],period,now);assert.equal(providerFreshness(old,now),'stale');
 assert.throws(()=>parseNoaaXray([row(undefined,1e-6),row(undefined,2e-6)],period,now),/Conflicting/);
 assert.throws(()=>xrayClass(1e308),/overflow/);assert.throws(()=>parseNoaaXray(Array(5001).fill(row()),period,now),/bounded/);
});
test('request identity, half-open coverage and strict UTC validation preserve selected dates',()=>{
 assert.notEqual(providerRequestKey('a','1',period),providerRequestKey('a','2',period));
 assert.notEqual(providerRequestKey('a','1',period),providerRequestKey('a','1',{...period,startUtc:'2027-06-30T11:00:00Z'}));
 assert.throws(()=>validateMissionPeriod({...period,startUtc:'2027-02-30T11:00:00Z'}),/valid UTC/);
 assert.throws(()=>validateMissionPeriod({...period,endUtcExclusive:period.startUtc}),/ordered/);
 const data=parseNoaaXray([row('2026-11-14T11:58:00Z'),row()],period,now);
 assert.equal(providerMissionOverlap(data,{startUtc:'2026-11-14T11:58:00Z',endUtcExclusive:'2026-11-14T11:59:00Z'}),'partial');
 assert.equal(providerMissionOverlap(data,{startUtc:'2026-11-14T11:59:00Z',endUtcExclusive:'2026-11-14T12:00:00Z'}),'none');
});
test('bounded adapter validates real response bytes, hashes source and propagates HTTP/JSON failures',async()=>{
 let requestOptions:RequestInit|undefined;
 const data=await fetchNoaaXray(period,{nowMs:()=>now,fetchFn:async(_url,opts)=>{requestOptions=opts;return new Response(JSON.stringify([row()]));}});
 assert.equal(data.value!.latest.fluxWm2,2.4e-6);assert.match(data.sourceSha256!,/^[a-f0-9]{64}$/);assert.equal(requestOptions!.credentials,'omit');assert.equal(requestOptions!.cache,'no-store');
 await assert.rejects(fetchNoaaXray(period,{fetchFn:async()=>new Response('bad',{status:502})}),/HTTP 502/);
 await assert.rejects(fetchNoaaXray(period,{fetchFn:async()=>new Response('not JSON')}),SyntaxError);
 await assert.rejects(fetchNoaaXray(period,{fetchFn:async()=>new Response('[]',{headers:{'content-length':String(MAX_XRAY_BYTES+1)}})}),/1 MB/);
 await assert.rejects(fetchNoaaXray(period,{fetchFn:async()=>new Response(new Uint8Array(MAX_XRAY_BYTES+1))}),/1 MB/);
});
test('abort and timeout bound both fetch and a stalled streaming body without stale completion',async()=>{
 const controller=new AbortController();controller.abort();let called=false;
 await assert.rejects(fetchNoaaXray(period,{signal:controller.signal,fetchFn:async()=>{called=true;return new Response('[]');}}),{name:'AbortError'});assert.equal(called,false);
 await assert.rejects(fetchNoaaXray(period,{timeoutMs:5,fetchFn:()=>new Promise(()=>{})}),{name:'TimeoutError'});
 await assert.rejects(fetchNoaaXray(period,{timeoutMs:5,fetchFn:async()=>new Response(new ReadableStream({start(){}}))}),{name:'TimeoutError'});
});
test('communications separation and registry do not convert observations into allocated support',()=>{
 const cards=commsInferenceSummary();assert.equal(cards.length,4);assert.equal(cards.find(c=>c.id==='allocation')!.state,'not-assessed');assert.equal(cards.find(c=>c.id==='weather-context')!.state,'context-only');
 assert.ok(cards.every(c=>c.explanation.length>0));assert.equal(new Set(DATA_SOURCE_REGISTRY.map(r=>r.id)).size,DATA_SOURCE_REGISTRY.length);
 for(const source of DATA_SOURCE_REGISTRY)assert.equal(new URL(source.url).protocol,'https:');
});

test('source identity hashes actual UTF-8 response bytes including BOM and rejects malformed encoding',async()=>{
 const text=JSON.stringify([row()]),body=new Uint8Array([239,187,191,...new TextEncoder().encode(text)]);
 const data=await fetchNoaaXray(period,{nowMs:()=>now,fetchFn:async()=>new Response(body)});
 assert.equal(data.sourceSha256,createHash('sha256').update(body).digest('hex'));
 await assert.rejects(fetchNoaaXray(period,{fetchFn:async()=>new Response(new Uint8Array([255,254,0]))}),TypeError);
});
