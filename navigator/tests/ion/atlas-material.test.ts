import test from 'node:test';import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial,MeshBasicMaterial,Texture} from 'three';
import {useStreamedAtlasMaterials} from '../../components/workbench/scene/ion/atlas-material';
test('provider geometry and source map survive stable atlas conversion without an unlit black surface or duplicate disposal',()=>{
 const map=new Texture(),normal=new Texture(),old=new MeshStandardMaterial({map,normalMap:normal,color:0xcccccc});
 const group=new Group(),geometry=new BoxGeometry(),a=new Mesh(geometry,old),b=new Mesh(geometry,old);group.add(a,b);
 let oldDisposed=0,mapDisposed=0,normalDisposed=0;
 old.addEventListener('dispose',()=>oldDisposed++);map.addEventListener('dispose',()=>mapDisposed++);normal.addEventListener('dispose',()=>normalDisposed++);
 useStreamedAtlasMaterials(group);
 assert.equal(a.geometry,geometry);assert.equal(a.material,b.material);assert.ok(a.material instanceof MeshBasicMaterial);
 assert.equal((a.material as unknown as MeshBasicMaterial).map,map);assert.equal(a.material.toneMapped,false);
 assert.equal(oldDisposed,1);assert.equal(normalDisposed,1);assert.equal(mapDisposed,0);
 useStreamedAtlasMaterials(group);assert.equal(oldDisposed,1);assert.equal(mapDisposed,0);
});
