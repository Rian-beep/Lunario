import test from 'node:test';import assert from 'node:assert/strict';
import {DSN_STATIONS,stationEcefKm,dsnEarthUv,earthMoonContext,DSN_GEOMETRY_STATUS,parseDsnWeather,dsnWeatherAt} from '../lib/dsn';
import type {Catalog}from'../lib/catalog';
test('three complexes identify ground antennas with WGS84 geodetic data, not satellites',()=>{
 assert.deepEqual(DSN_STATIONS.map(s=>s.antenna),['DSS-14','DSS-63','DSS-43']);assert.equal(DSN_STATIONS.length,3);
 const radii={goldstone:6371.993267,madrid:6370.051198,canberra:6371.688998};
 for(const s of DSN_STATIONS)assert.ok(Math.abs(Math.hypot(...stationEcefKm(s))-radii[s.id])<.002,'WGS84 conversion differs from JPL geocentric table by over 2 m');
 assert.ok(stationEcefKm(DSN_STATIONS[2])[2]<0);assert.equal(DSN_GEOMETRY_STATUS.state,'not-assessed');
});
test('Earth coordinate texture adapter registers prime meridian, equator, poles and dateline',()=>{
 assert.deepEqual(dsnEarthUv(0,0),{u:.5,v:.5});assert.deepEqual(dsnEarthUv(90,0),{u:.5,v:1});assert.deepEqual(dsnEarthUv(-90,0),{u:.5,v:0});
 assert.deepEqual(dsnEarthUv(0,-180),{u:0,v:.5});assert.deepEqual(dsnEarthUv(0,180),{u:0,v:.5});assert.deepEqual(dsnEarthUv(0,90),{u:.75,v:.5});
 assert.deepEqual(dsnEarthUv(40,355),dsnEarthUv(40,-5));
});
const catalog={meta:{n:2,stepHours:1,moonRadiusM:1737400,earthRadiusKm:6378.137,sunRadiusKm:695700},t0ms:Date.parse('2027-01-01Z'),earthRangeKm:new Float64Array([380000,400000])} as Catalog;
test('physical body sizes and range retain kilometres; centre light time is not a station path',()=>{
 const c=earthMoonContext(catalog,.5)!;assert.equal(c.rangeKm,390000);assert.equal(c.moonRadiusKm,1737.4);assert.equal(c.earthRadiusKm,6378.137);assert.equal(c.sunRadiusKm,695700);assert.equal(c.oneWayCentreLightSeconds,390000/299792.458);assert.equal(earthMoonContext(catalog,2),null);
 assert.equal(earthMoonContext({...catalog,earthRangeKm:new Float64Array([NaN,400000])},0),null);
});
function weather(){return{utc_offset_seconds:0,hourly_units:{temperature_2m:'°C',wind_speed_10m:'km/h',precipitation:'mm',cloud_cover:'%'},hourly:{time:[Date.parse('2026-11-14T12:00Z')/1000,Date.parse('2026-11-14T13:00Z')/1000],temperature_2m:[20,null],wind_speed_10m:[8,9],precipitation:[0,0],cloud_cover:[10,20]}};}
test('current model weather never becomes selected future mission weather; interval end exclusive',()=>{
 const w=parseDsnWeather(weather(),DSN_STATIONS[0],'2026-11-14T12:05:00Z','https://api.open-meteo.com/v1/forecast');
 assert.equal(dsnWeatherAt(w,Date.parse('2027-10-25Z')),null);assert.equal(dsnWeatherAt(w,Date.parse('2026-11-14T12:30Z'))?.temperatureC,20);
 assert.equal(dsnWeatherAt(w,Date.parse('2026-11-14T13:00Z'))?.temperatureC,null);assert.equal(dsnWeatherAt(w,Date.parse('2026-11-14T14:00Z')),null);assert.equal(dsnWeatherAt(null,0),null);
});
test('weather rejects bad units, gaps, nonfinite values and oversized arrays',()=>{
 for(const mutate of [(w:ReturnType<typeof weather>)=>{w.utc_offset_seconds=3600;},(w:ReturnType<typeof weather>)=>{w.hourly_units.wind_speed_10m='m/s';},(w:ReturnType<typeof weather>)=>{w.hourly.time[1]+=3600;},(w:ReturnType<typeof weather>)=>{w.hourly.temperature_2m[0]=NaN;},(w:ReturnType<typeof weather>)=>{w.hourly.time=Array(193).fill(0);}]){const w=weather();mutate(w);assert.throws(()=>parseDsnWeather(w,DSN_STATIONS[0],'2026-11-14T12:05Z','url'));}
});

test('lunar body axes preserve source directions and angular semidiameter infers solar range',()=>{
 const c={...catalog,subearthLat:new Float64Array([0,0]),subearthLon:new Float64Array([90,90]),subsolarLat:new Float64Array([90,90]),subsolarLon:new Float64Array([0,0]),sunRadiusDeg:new Float64Array([.2666,.2666])};
 const context=earthMoonContext(c,.5)!;assert.ok(Math.abs(context.earthDirection![0])<1e-12);assert.equal(context.earthDirection![2],-1);assert.equal(context.sunDirection![1],1);
 assert.ok(Math.abs(context.sunRangeKm!-catalog.meta.sunRadiusKm/Math.sin(.2666*Math.PI/180))<1e-6);
 assert.equal(earthMoonContext({...c,sunRadiusDeg:new Float64Array([0,0])},0)!.sunRangeKm,null);
});
