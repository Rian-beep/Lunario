import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,Float32BufferAttribute,Mesh,MeshBasicMaterial,MeshStandardMaterial,Texture,SRGBColorSpace} from 'three';
import {inspectIonAppearance} from '../../lib/ion/appearance';

test('appearance evidence distinguishes bare relief, usable imagery and sampled vertex colour without leaking source URLs',()=>{
 const map=new Texture({width:32,height:16});map.colorSpace=SRGBColorSpace;map.name='private provider URL';
 const bare=new Mesh(new BoxGeometry(),new MeshStandardMaterial());
 const image=new Mesh(new BoxGeometry(),new MeshBasicMaterial({map}));
 const geometry=new BoxGeometry();geometry.setAttribute('color',new Float32BufferAttribute(new Float32Array(24*3).fill(.5),3));
 geometry.getAttribute('color').setXYZ(23,.8,.5,.5);
 const colored=new Mesh(geometry,new MeshBasicMaterial({vertexColors:true}));
 const evidence=inspectIonAppearance([bare,image,colored]);
 assert.deepEqual(evidence,{meshes:3,withBaseColorMap:1,withUsableMapUv:1,withVertexColors:1,withNormals:3,unlit:2,sampledColorVariation:true,colorSamples:24,textureSizes:[{width:32,height:16,colorSpace:SRGBColorSpace}]});
 assert.equal(JSON.stringify(evidence).includes('private'),false);
});
test('map existence alone is not usable imagery and a constant colour field reports no variation',()=>{
 const geometry=new BoxGeometry();geometry.deleteAttribute('uv');
 geometry.setAttribute('color',new Float32BufferAttribute(new Float32Array(24*3).fill(.5),3));
 const mesh=new Mesh(geometry,new MeshBasicMaterial({map:new Texture(),vertexColors:true}));
 const evidence=inspectIonAppearance([mesh]);
 assert.equal(evidence.withBaseColorMap,1);assert.equal(evidence.withUsableMapUv,0);assert.equal(evidence.sampledColorVariation,false);
 assert.deepEqual(inspectIonAppearance([]),{meshes:0,withBaseColorMap:0,withUsableMapUv:0,withVertexColors:0,withNormals:0,unlit:0,sampledColorVariation:false,colorSamples:0,textureSizes:[]});
});
