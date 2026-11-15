import {test} from 'node:test';import assert from 'node:assert/strict';import snapshot from '../public/data/orbits/catalog.json';
import {parseOrbitCatalog,orbitState,orbitTrack,orbitEpoch,catalogEpoch,stationSatelliteAngles,ORBIT_MAX_AGE_MS,orbitTime} from '../lib/orbits';
import {json2satrec,propagate,gstime} from 'satellite.js';
const c=parseOrbitCatalog(snapshot),time=catalogEpoch(c);
test('curated GP snapshot binds six real identities including Starcloud-1, never the rejected debris identity',()=>{assert.equal(c.elements.length,6);assert.deepEqual(c.elements.map(e=>e.NORAD_CAT_ID).sort((a,b)=>a-b),[20580,25544,42915,43013,60133,66303]);for(const e of c.elements)assert.ok(Number.isFinite(orbitEpoch(e)));});
test('parser rejects duplicates, debris/name mismatch, wrong frames and malformed numeric/epoch records atomically',()=>{
 for(const patch of [{MEAN_MOTION:NaN},{MEAN_MOTION:19},{EPOCH:'bad'},{EPOCH:'2026-02-31T00:00:00'},{ECCENTRICITY:1},{REF_FRAME:'J2000'},{TIME_SYSTEM:'TAI'},{CENTER_NAME:'MOON'},{MEAN_ELEMENT_THEORY:'KEPLER'},{OBJECT_NAME:'CZ-2D DEB'}]){const v=structuredClone(snapshot);Object.assign(v.elements[0],patch);assert.throws(()=>parseOrbitCatalog(v));}
 assert.throws(()=>parseOrbitCatalog({...snapshot,elements:[snapshot.elements[0],snapshot.elements[0]]}));assert.throws(()=>parseOrbitCatalog({...snapshot,elements:[]}));assert.throws(()=>parseOrbitCatalog({...snapshot,elements:Array(129).fill(snapshot.elements[0])}));
});
test('SGP4 TEME positions rotate into the registered Earth ECEF scene exactly once',()=>{
 for(const e of c.elements){const a=orbitState(e,time)!;assert.ok(a.altitudeKm>100&&a.altitudeKm<40000);const state=propagate(json2satrec(e),new Date(time))!;const p=state.position;if(!p||typeof p==='boolean')throw Error('No ECI');const g=gstime(new Date(time));const expected=[p.x*Math.cos(g)+p.y*Math.sin(g),-p.x*Math.sin(g)+p.y*Math.cos(g),p.z];a.ecefKm.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<1e-6));assert.deepEqual(a.sceneKm,[a.ecefKm[0],a.ecefKm[2],-a.ecefKm[1]]);}
});
test('satellite and orbit line share one Earth-fixed frame at the displayed clock',()=>{for(const e of c.elements){const track=orbitTrack(e,time),point=orbitState(e,time)!;assert.equal(track.length,97);track[48].forEach((v,i)=>assert.ok(Math.abs(v-point.sceneKm[i])<1e-6));}});
test('stale and future mission epochs do not produce fictional current satellite positions',()=>{for(const e of c.elements){assert.equal(orbitState(e,orbitEpoch(e)+ORBIT_MAX_AGE_MS+1),null);assert.equal(orbitState(e,orbitEpoch(e)-ORBIT_MAX_AGE_MS-1),null);assert.equal(orbitState(e,Date.UTC(2027,5,29)),null);assert.deepEqual(orbitTrack(e,NaN),[]);}});
test('station angles are finite, dimensioned Earth-satellite geometry; no contact verdict is inferred',()=>{const rows=stationSatelliteAngles(c.elements[0],time);assert.equal(rows.length,3);for(const r of rows){assert.ok(r.rangeKm>0);assert.ok(r.elevationDeg>=-90&&r.elevationDeg<=90);assert.ok(r.azimuthDeg>=0&&r.azimuthDeg<=360);assert.equal('available' in r,false);}});
test('orbit clock playback uses elapsed wall time and never changes the separate mission time',()=>{const v={catalog:c,atMs:time,rate:60,startedPerf:100,enabled:true,selectedId:66303};assert.equal(orbitTime(v,1100),time+60000);assert.equal(orbitTime({...v,rate:0},2000),time);});
test('CelesTrak GP propagation agrees with independent Python/Vallado reference vectors',async()=>{
 const reference=(await import('./fixtures/orbit-reference.json')).default;let maxKm=0;
 for(const row of reference.samples){assert.equal(row.error,0);const e=c.elements.find(e=>e.NORAD_CAT_ID===row.id)!;const state=propagate(json2satrec(e),new Date(row.utc));const p=state?.position;if(!p||typeof p==='boolean')throw Error('No ECI');const error=Math.hypot(p.x-row.temeKm[0],p.y-row.temeKm[1],p.z-row.temeKm[2]);maxKm=Math.max(maxKm,error);assert.ok(error<.001,`NORAD${row.id}: ${error}km`);}
 console.log('Independent SGP4 maximum position difference (km):',maxKm);
});
