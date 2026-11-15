import test from 'node:test';import assert from 'node:assert/strict';
import {geographicBodyVector,geographicNorthVector,cameraBodyGeography,stepViewLongitude,GEOGRAPHIC_POLES,formatGeographicView} from '../components/workbench/scene/geographic-navigation';
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
test('body cardinal axes match numerical latitude and east-positive longitude',()=>{
 assert.deepEqual(geographicBodyVector(0,0),[1,0,0]);
 const east=geographicBodyVector(0,90);near(east[0],0);near(east[1],1);near(east[2],0);
 for(const [name,sign] of [['north',1],['south',-1]] as const){const p=GEOGRAPHIC_POLES[name],v=geographicBodyVector(p.latDeg,p.lonDeg,1737.4);near(v[2],sign*1737.4);near(Math.hypot(v[0],v[1]),0);}
});
test('camera geography roundtrips equator, both hemispheres and dateline',()=>{
 for(const [lat,lon] of [[0,0],[30,150],[-85,-170],[0,180],[89,359]]){const v=cameraBodyGeography(geographicBodyVector(lat,lon,6200))!;near(v.latDeg,lat);near(v.lonDeg,((lon%360)+540)%360-180);}
 assert.equal(cameraBodyGeography([0,0,0]),null);assert.equal(cameraBodyGeography([NaN,0,1]),null);
 assert.equal(cameraBodyGeography([0,0,6200],73)!.lonDeg,73);
});
test('east/west steps preserve latitude, wrap the dateline and do not mutate input',()=>{
 const initial={latDeg:45,lonDeg:170},before={...initial};assert.deepEqual(stepViewLongitude(initial.latDeg,initial.lonDeg,30),{latDeg:45,lonDeg:-160});
 assert.deepEqual(stepViewLongitude(-90,-170,-30),{latDeg:-90,lonDeg:160});assert.deepEqual(initial,before);
});
test('north tangent is unit and orthogonal including pole meridian orientations',()=>{
 for(const lat of [-90,-35,0,80,90])for(const lon of [0,90,-170]){const up=geographicNorthVector(lat,lon),radial=geographicBodyVector(lat,lon);near(Math.hypot(...up),1);near(up.reduce((sum,v,i)=>sum+v*radial[i],0),0);}
 assert.notDeepEqual(geographicNorthVector(90,0),geographicNorthVector(90,90));
});
test('format and validation distinguish geographic coordinates from camera bearings',()=>{
 assert.equal(formatGeographicView(-15,-30),'15.00°S, 30.00°W');assert.equal(formatGeographicView(15,30),'15.00°N, 30.00°E');
 assert.throws(()=>geographicBodyVector(91,0),RangeError);assert.throws(()=>geographicBodyVector(0,0,0),RangeError);assert.throws(()=>stepViewLongitude(0,0,NaN),RangeError);
});
