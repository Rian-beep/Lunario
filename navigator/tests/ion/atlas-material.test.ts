import test from 'node:test';import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial,MeshBasicMaterial,Texture,Float32BufferAttribute} from 'three';
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
test('untextured terrain retains normal-based lighting and its original resources',()=>{
 const normal=new Texture(),source=new MeshStandardMaterial({normalMap:normal,color:0xcccccc});
 const mesh=new Mesh(new BoxGeometry(),source);
 let disposed=0;source.addEventListener('dispose',()=>disposed++);normal.addEventListener('dispose',()=>disposed++);
 useStreamedAtlasMaterials(mesh);
 assert.equal(mesh.material,source,'without source imagery, atlas conversion erases relief shading');
 assert.equal(source.normalMap,normal);assert.equal(disposed,0);
});
test('vertex colour flag without an actual colour attribute does not erase terrain lighting',()=>{
 const source=new MeshStandardMaterial({vertexColors:true}),mesh=new Mesh(new BoxGeometry(),source);
 useStreamedAtlasMaterials(mesh);assert.equal(mesh.material,source);
});
test('shared provider material is classified per mesh when only one mesh has vertex colours',()=>{
 const source=new MeshStandardMaterial({vertexColors:true}),group=new Group();
 const coloured=new BoxGeometry();coloured.setAttribute('color',new Float32BufferAttribute(new Float32Array(24*3).fill(.5),3));
 const a=new Mesh(coloured,source),b=new Mesh(new BoxGeometry(),source);group.add(a,b);
 let disposed=0;source.addEventListener('dispose',()=>disposed++);
 useStreamedAtlasMaterials(group);
 assert.ok(a.material instanceof MeshBasicMaterial);assert.equal(a.material.vertexColors,true);
 assert.equal(b.material,source);assert.equal(disposed,0,'source still belongs to the untextured mesh');
});
