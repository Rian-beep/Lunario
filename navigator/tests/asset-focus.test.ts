import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {ASSET_RADII_KM, ASSET_FOCUS_MS, physicalAsset, sampleAssetFlight, assetClipPlanes, type AssetFlight} from '../lib/asset-focus';
import {siteFrame, skyDirection} from '../components/workbench/scene/surface';
import {moonFixedStarDirection, starDirectionJ2000, BRIGHT_STARS} from '../lib/stars';
import {stationEcefKm, dsnEarthUv, DSN_STATIONS} from '../lib/dsn';
import {framingDistanceKm} from '../lib/solar-system';
import type {Point3} from '../lib/site-transition';

const total=Object.values(ASSET_FOCUS_MS).reduce((a,b)=>a+b,0);
const near=(a:number,b:number,epsilon=1e-7)=>assert.ok(Math.abs(a-b)<epsilon,`${a} differs from ${b}`);
const distance=(a:Point3,b:Point3)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const earth:Point3=[384400,0,0],moon:Point3=[0,0,0];
const plan:AssetFlight={startMs:100,fromCamera:[1737.41,0,.025],fromTarget:[1737.4,0,0],fromCentre:moon,toCamera:[384400,0,25000],toTarget:earth,toCentre:earth,clearanceKm:30000};

test('physical sizes match the committed catalogue; centre ranges are never compressed',()=>{
  const catalog=JSON.parse(readFileSync(new URL('../public/data/catalog.json',import.meta.url),'utf8'));
  assert.equal(ASSET_RADII_KM.earth,catalog.meta.earthRadiusKm);assert.equal(ASSET_RADII_KM.sun,catalog.meta.sunRadiusKm);assert.equal(ASSET_RADII_KM.moon,catalog.meta.moonRadiusM/1000);
  for(const [kind,range] of [['earth',384400],['sun',149597870.7]] as const){const body=physicalAsset(kind,range)!;assert.equal(body.rangeKm,range);assert.equal(body.radiusKm,ASSET_RADII_KM[kind]);}
});
test('absent, nonfinite, intersecting or nonpositive ranges have no invented replacement',()=>{
  for(const kind of ['earth','sun'] as const)for(const range of [undefined,NaN,Infinity,-1,0,ASSET_RADII_KM[kind],ASSET_RADII_KM[kind]+ASSET_RADII_KM.moon])assert.equal(physicalAsset(kind,range),null);
});
test('the first sample preserves the exact pose; the final sample preserves the exact destination',()=>{
  const first=sampleAssetFlight(plan,plan.startMs);assert.deepEqual(first.camera,plan.fromCamera);assert.deepEqual(first.target,plan.fromTarget);assert.equal(first.complete,false);
  const last=sampleAssetFlight(plan,plan.startMs+total);assert.deepEqual(last.camera,plan.toCamera);assert.deepEqual(last.target,plan.toTarget);assert.equal(last.complete,true);
  assert.deepEqual(sampleAssetFlight(plan,plan.startMs-100).camera,plan.fromCamera);
});
test('Earth approach starts with at least three seconds of monotonic logarithmic clearance',()=>{
  assert.ok(ASSET_FOCUS_MS.clearance>=3000);
  let previous=distance(plan.fromCamera,moon);
  for(let elapsed=0;elapsed<=ASSET_FOCUS_MS.clearance;elapsed+=20){const sample=sampleAssetFlight(plan,plan.startMs+elapsed),radius=distance(sample.camera,moon);assert.ok(radius>=previous-1e-8);previous=radius;}
  const halfway=sampleAssetFlight(plan,plan.startMs+ASSET_FOCUS_MS.clearance/2);
  near(distance(halfway.camera,moon),Math.sqrt(distance(plan.fromCamera,moon)*768800),1e-6);
});
test('Moon/Earth transfers and reverse approaches never pass through either physical body',()=>{
  const reverse:AssetFlight={...plan,fromCamera:plan.toCamera,fromTarget:plan.toTarget,fromCentre:earth,toCamera:plan.fromCamera,toTarget:plan.fromTarget,toCentre:moon};
  for(const flight of [plan,reverse])for(let elapsed=0;elapsed<=total;elapsed+=10){const sample=sampleAssetFlight(flight,flight.startMs+elapsed);assert.ok(distance(sample.camera,moon)>=ASSET_RADII_KM.moon);assert.ok(distance(sample.camera,earth)>ASSET_RADII_KM.earth);assert.ok(sample.camera.every(Number.isFinite));}
});
test('phase boundaries are position-continuous and decelerate at arrival',()=>{
  for(const boundary of [ASSET_FOCUS_MS.clearance,ASSET_FOCUS_MS.clearance+ASSET_FOCUS_MS.transfer,total]){
    const a=sampleAssetFlight(plan,plan.startMs+boundary-.01),b=sampleAssetFlight(plan,plan.startMs+boundary+.01);assert.ok(distance(a.camera,b.camera)<.001);assert.ok(distance(a.target,b.target)<.001);
  }
  const early=distance(sampleAssetFlight(plan,plan.startMs+total-1000).camera,sampleAssetFlight(plan,plan.startMs+total-900).camera);
  const late=distance(sampleAssetFlight(plan,plan.startMs+total-100).camera,sampleAssetFlight(plan,plan.startMs+total).camera);assert.ok(late<early*.1);
});
test('rapid retargets replace the plan from the current sampled camera without a jump',()=>{
  let flight=plan;
  for(const elapsed of [200,900,3200,150,5900,100]){
    const current=sampleAssetFlight(flight,flight.startMs+elapsed);
    flight={...plan,startMs:flight.startMs+elapsed,fromCamera:current.camera,fromTarget:current.target,fromCentre:moon};
    const next=sampleAssetFlight(flight,flight.startMs);assert.deepEqual(next.camera,current.camera);assert.deepEqual(next.target,current.target);
  }
});
test('reduced motion goes directly to the requested destination',()=>{
  const result=sampleAssetFlight(plan,plan.startMs,true);assert.deepEqual(result.camera,plan.toCamera);assert.deepEqual(result.target,plan.toTarget);assert.equal(result.complete,true);
});
test('invalid camera flight inputs fail explicitly',()=>{
  for(const bad of [{clearanceKm:NaN},{fromCamera:moon},{toCamera:earth},{startMs:NaN}])assert.throws(()=>sampleAssetFlight({...plan,...bad},100),RangeError);
});
test('dynamic planes retain millimetre lunar detail while including physical Earth and Sun',()=>{
  const bodies=[{centreKm:moon,radiusKm:1737.4},{centreKm:earth,radiusKm:6378.137},{centreKm:[0,149597870.7,0] as Point3,radiusKm:695700}];
  for(const camera of [[1737.403,0,0],plan.toCamera,[0,150397870.7,0]] as Point3[]){
    const clip=assetClipPlanes(camera,bodies,camera===plan.toCamera?25000:.03);
    assert.ok(clip.near>0);for(const body of bodies){assert.ok(clip.far>distance(camera,body.centreKm)+body.radiusKm);assert.ok(clip.near<Math.max(.001,distance(camera,body.centreKm)-body.radiusKm));}
  }
  assert.ok(assetClipPlanes([1737.403,0,0],bodies,.03).near<=.0001);
  assert.throws(()=>assetClipPlanes(moon,[],1),RangeError);
});
test('range placement keeps the supplied local azimuth/elevation in the fixed mounted frame after site changes',()=>{
  const mounted=siteFrame(-89,32,2000);
  for(const [lat,lon] of [[-89,32],[90,0],[0,90],[30,-180]]){
    const local=siteFrame(lat,lon,0),direction=skyDirection(57,18);
    const body=local.east.clone().multiplyScalar(direction.x).addScaledVector(local.up,direction.y).addScaledVector(local.north,-direction.z);
    const scene=new T.Vector3(body.dot(mounted.east),body.dot(mounted.up),-body.dot(mounted.north));
    const recovered=mounted.east.clone().multiplyScalar(scene.x).addScaledVector(mounted.up,scene.y).addScaledVector(mounted.north,-scene.z);
    near(recovered.dot(local.up),Math.sin(18*Math.PI/180));near(Math.atan2(recovered.dot(local.east),recovered.dot(local.north))*180/Math.PI,57);
    near(scene.multiplyScalar(384400).length(),384400);
  }
});
test('one star rotation matrix agrees with per-star Moon-frame conversion at poles and arbitrary sites',()=>{
  for(const [lat,lon] of [[-90,0],[90,73],[0,0],[-47,162]]){
    const frame=siteFrame(lat,lon,0),basis=new T.Matrix3().set(...[frame.east.x,frame.east.y,frame.east.z,frame.up.x,frame.up.y,frame.up.z,-frame.north.x,-frame.north.y,-frame.north.z] as [number,number,number,number,number,number,number,number,number]);
    const epoch=Date.parse('2026-11-14T12:00:00Z');
    const axes=[[0,0],[90,0],[0,90]].map(([raDeg,decDeg])=>moonFixedStarDirection({id:'axis',name:'axis',raDeg,decDeg,magnitude:0},epoch));
    const [a,b,c]=axes,rotation=new T.Matrix3().set(a[0],b[0],c[0],a[1],b[1],c[1],a[2],b[2],c[2]);rotation.premultiply(basis);
    for(const star of BRIGHT_STARS){const actual=new T.Vector3(...starDirectionJ2000(star)).applyMatrix3(rotation),body=new T.Vector3(...moonFixedStarDirection(star,epoch));const expected=new T.Vector3(body.dot(frame.east),body.dot(frame.up),-body.dot(frame.north));assert.ok(actual.distanceTo(expected)<1e-12);}
  }
});
test('Earth inspection pins and Blue Marble UVs use the same Earth-fixed display axes',()=>{
  for(const station of DSN_STATIONS){const [x,y,z]=stationEcefKm(station),display=new T.Vector3(x,z,-y);near(display.length(),Math.hypot(x,y,z));near(Math.atan2(-display.z,display.x)*180/Math.PI,((station.longitudeEastDeg+540)%360)-180);const uv=dsnEarthUv(station.latitudeDeg,station.longitudeEastDeg);assert.ok(uv.u>=0&&uv.u<=1&&uv.v>=0&&uv.v<=1);}
  for(const aspect of [.4,1,2])assert.ok(framingDistanceKm(6378.137,aspect)>6378.137*2);
});

test('geocentric NASA direction conversion preserves centre ranges and right-handed Moon axes',async()=>{
 const {nasaDirectionToBodyPoint}=await import('../lib/asset-focus');
 assert.deepEqual(nasaDirectionToBodyPoint([1,0,0],384400),[384400,-0,0]);
 assert.deepEqual(nasaDirectionToBodyPoint([0,1,0],384400),[0,-0,384400]);
 assert.deepEqual(nasaDirectionToBodyPoint([0,0,-1],384400),[0,384400,0]);
 near(Math.hypot(...nasaDirectionToBodyPoint([.6,.8,0],384400)),384400);
 assert.throws(()=>nasaDirectionToBodyPoint([1,1,0],384400),RangeError);
});
