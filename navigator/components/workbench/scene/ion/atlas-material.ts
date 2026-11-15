import {Material,Mesh,MeshBasicMaterial,Object3D,Texture,Color} from 'three';
/** Streamed imagery already contains acquisition lighting; keep it stable like the bundled atlas. */
export function useStreamedAtlasMaterials(scene:Object3D):void{
 const replacements=new Map<Material,Material>(),retired=new Set<Material>(),allTextures=new Set<Texture>(),retained=new Set<Texture>();
 const textures=(material:Material,into:Set<Texture>)=>{for(const value of Object.values(material))if(value instanceof Texture)into.add(value);};
 scene.traverse(object=>{
  if(!(object instanceof Mesh))return;
  const convert=(material:Material):Material=>{
   if(replacements.has(material))return replacements.get(material)!;
   textures(material,allTextures);
   if(material instanceof MeshBasicMaterial){material.toneMapped=false;textures(material,retained);replacements.set(material,material);return material;}
   const source=material as Material&{map?:Texture|null;alphaMap?:Texture|null;color?:Color;vertexColors?:boolean};
   const atlas=new MeshBasicMaterial({map:source.map??null,alphaMap:source.alphaMap??null,color:source.color?.clone()??0xffffff,
    vertexColors:source.vertexColors??false,side:material.side,transparent:material.transparent,opacity:material.opacity,
    alphaTest:material.alphaTest,depthWrite:material.depthWrite,toneMapped:false});
   textures(atlas,retained);replacements.set(material,atlas);retired.add(material);return atlas;
  };
  object.material=Array.isArray(object.material)?object.material.map(convert):convert(object.material);
 });
 for(const material of retired)material.dispose();
 for(const texture of allTextures)if(!retained.has(texture)){if(typeof ImageBitmap!=='undefined'&&texture.image instanceof ImageBitmap)texture.image.close();texture.dispose();}
}
