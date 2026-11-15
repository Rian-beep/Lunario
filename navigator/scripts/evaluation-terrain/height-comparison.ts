import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {Group,Vector3} from 'three';
import {decodeTerrain,heightAt,type SerializedTerrainData} from '../../lib/terrain';
import {displayHeight,siteFrame,bodyToScene} from '../../components/workbench/scene/surface';
import {southPoleTerrainMatrix} from '../../components/workbench/scene/south-pole-detail';
import {latLonToProjected} from '../../lib/astro';
import {LunarTerrain} from '../../components/workbench/scene/lunar-terrain.js';
const manifest=JSON.parse(fs.readFileSync('public/data/south-pole-detail/manifest.json','utf8')) as {datasets:Array<{id:string;file:string;blendMaskFile?:string;spacing:number}>};
const canonical=decodeTerrain(JSON.parse(fs.readFileSync('public/data/terrain.json','utf8')) as SerializedTerrainData);
const catalog=JSON.parse(fs.readFileSync('public/data/catalog.json','utf8')) as {sites:Array<{id:string;lat:number;lon:number}>};
const terrain=new LunarTerrain(new Group());
terrain._loaded=manifest.datasets.map(d=>{
 const raw=gunzipSync(fs.readFileSync('public/data/south-pole-detail/'+d.file));
 return {...d,values:new Int16Array(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength)),
  blendWeights:d.blendMaskFile?new Uint8Array(gunzipSync(fs.readFileSync('public/data/south-pole-detail/'+d.blendMaskFile))):undefined};
}).sort((a,b)=>a.spacing-b.spacing);
const rows=catalog.sites.filter(site=>site.lat<=-85).map(site=>{
 const {x,y}=latLonToProjected(site.lat,site.lon),incoming=terrain.getElevation(x,y),flight=displayHeight(canonical,site.lat,site.lon),measured=heightAt(canonical,site.lat,site.lon);
 if(!incoming)return{id:site.id,covered:false};
 const frame=siteFrame(site.lat,site.lon,flight.heightM),p=terrain.toWorld(x,y,incoming.elevation).applyMatrix4(southPoleTerrainMatrix(frame));
 const lat=site.lat*Math.PI/180,lon=site.lon*Math.PI/180;
 const expected=bodyToScene(new Vector3(Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)),incoming.elevation,frame);
 return{id:site.id,lat:site.lat,lon:site.lon,x,y,incomingM:incoming.elevation,dataset:incoming.dataset,flightDisplayM:flight.heightM,canonicalMeasured:measured,detailMinusFlightM:incoming.elevation-flight.heightM,rigidRegistrationErrorM:p.distanceTo(expected)*1000};
});
terrain.dispose();
console.log(JSON.stringify({sourceCommit:'3c82b5aa02c4da52053fd3c12c180cca18fd6d4e',scope:'Display-source discrepancy only; no collision/mission authority changed',rows},null,2));
