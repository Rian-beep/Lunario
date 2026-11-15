import {Mesh, MeshBasicMaterial, type Object3D, type Texture} from 'three';

export type IonAppearanceEvidence = Readonly<{
  meshes: number;
  withBaseColorMap: number;
  withUsableMapUv: number;
  withVertexColors: number;
  withNormals: number;
  unlit: number;
  sampledColorVariation: boolean;
  colorSamples: number;
  textureSizes: readonly Readonly<{width: number; height: number; colorSpace: string}>[];
}>;

/** Payload observations only: neither texture presence nor colour variation establishes source resolution/accuracy. */
export function inspectIonAppearance(models: readonly Object3D[]): IonAppearanceEvidence {
  let meshes=0,withBaseColorMap=0,withUsableMapUv=0,withVertexColors=0,withNormals=0,unlit=0,colorSamples=0,sampledColorVariation=false;
  const textures=new Set<Texture>();
  for(const model of models)model.traverse(object=>{
    if(!(object instanceof Mesh))return;
    meshes++;
    const materials=Array.isArray(object.material)?object.material:[object.material];
    const maps=materials.flatMap(material=>{
      const map=(material as typeof material&{map?:Texture|null}).map;
      return map?[map]:[];
    });
    if(maps.length)withBaseColorMap++;
    if(maps.some(map=>object.geometry.hasAttribute(map.channel?`uv${map.channel}`:'uv')))withUsableMapUv++;
    maps.forEach(map=>textures.add(map));
    if(object.geometry.hasAttribute('normal'))withNormals++;
    if(materials.every(material=>material instanceof MeshBasicMaterial))unlit++;
    const colors=object.geometry.getAttribute('color');
    if(colors&&materials.some(material=>material.vertexColors)){
      withVertexColors++;
      const first=[colors.getX(0),colors.getY(0),colors.getZ(0)];
      // Bounded diagnostic sampling, never a complete per-vertex colour audit.
      const samples=Math.min(256,colors.count);
      for(let i=0;i<samples;i++){
        const index=Math.floor(i*colors.count/samples);
        colorSamples++;
        if([colors.getX(index),colors.getY(index),colors.getZ(index)].some((value,c)=>value!==first[c]))sampledColorVariation=true;
      }
    }
  });
  const textureSizes=[...textures].flatMap(texture=>{
    const image=texture.image as {width?:unknown;height?:unknown}|null;
    return typeof image?.width==='number'&&typeof image?.height==='number'
      ?[Object.freeze({width:image.width,height:image.height,colorSpace:texture.colorSpace})]:[];
  });
  return Object.freeze({meshes,withBaseColorMap,withUsableMapUv,withVertexColors,withNormals,unlit,sampledColorVariation,colorSamples,textureSizes:Object.freeze(textureSizes)});
}
