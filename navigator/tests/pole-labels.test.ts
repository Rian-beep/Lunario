import test from 'node:test';import assert from 'node:assert/strict';
import {poleFacesCamera,placePoleLabel} from '../components/workbench/scene/pole-labels';
test('pole visibility accounts for the horizon at equatorial, north and south views',()=>{
 assert.equal(poleFacesCamera('north',[6200,0,0]),false);
 assert.equal(poleFacesCamera('south',[6200,0,0]),false);
 assert.equal(poleFacesCamera('north',[0,0,6200]),true);
 assert.equal(poleFacesCamera('south',[0,0,6200]),false);
 assert.equal(poleFacesCamera('south',[0,0,-6200]),true);
 assert.equal(poleFacesCamera('north',[6200,0,1000]),false);
});
test('near pole retains the actual projected surface anchor',()=>{
 const p=placePoleLabel({pole:'north',cameraBody:[0,0,6200],projected:{x:400,y:240,z:.8},centre:{x:400,y:300},radiusPx:200,width:800,height:600});
 assert.deepEqual(p,{x:400,y:240,farSide:false,offscreen:false});
});
test('far side indicators lie outside the limb and remain legible from a distant view',()=>{
 const p=placePoleLabel({pole:'south',cameraBody:[0,0,6200],projected:{x:400,y:300,z:.8},centre:{x:400,y:300},radiusPx:200,width:800,height:600})!;
 assert.equal(p.farSide,true);assert.equal(p.y,530);
 assert.ok(Math.hypot(p.x-400,p.y-300)>200);
 const near=placePoleLabel({pole:'north',cameraBody:[0,0,6200],projected:{x:-100,y:240,z:.8},centre:{x:400,y:300},radiusPx:200,width:800,height:600})!;
 assert.equal(near.offscreen,true);assert.equal(near.x,92);
 assert.equal(placePoleLabel({pole:'south',cameraBody:[NaN,0,0],projected:{x:0,y:0,z:0},centre:{x:0,y:0},radiusPx:1,width:800,height:600}),null);
});
