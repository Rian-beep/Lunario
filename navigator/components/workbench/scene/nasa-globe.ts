import * as T from 'three';
import {acquireMoonAtlas,waitForMoonAtlas} from '@/lib/moon-atlas-texture';
import {LUNAR_LINEAR_LUMINANCE_GLSL} from '@/lib/lunar-appearance';
import {computeNormalsCooperatively} from './surface';
import {loadNasaModel,nasaSiteFrame} from '@/lib/nasa-model';

/** Original NASA triangles, rotated into the same right-handed local scene frame. */
export async function createNasaGlobe(lat:number,lon:number,referenceRadiusKm:number,signal:AbortSignal){
  const data=await loadNasaModel({signal});
  const frame=nasaSiteFrame(lat,lon),scale=data.positionToKm;
  const positions=new Float32Array(data.positions.length),directions=new Float32Array(data.positions.length);
  let started=performance.now();
  for(let i=0;i<positions.length;i+=3){
    if(i%6144===0&&performance.now()-started>=5){await new Promise(resolve=>setTimeout(resolve,0));signal.throwIfAborted();started=performance.now();}
    const x=data.positions[i],y=data.positions[i+1],z=data.positions[i+2],r=Math.hypot(x,y,z);
    positions[i]=(x*frame.east[0]+y*frame.east[1]+z*frame.east[2])*scale;
    positions[i+1]=(x*frame.up[0]+y*frame.up[1]+z*frame.up[2])*scale-referenceRadiusKm;
    positions[i+2]=-(x*frame.north[0]+y*frame.north[1]+z*frame.north[2])*scale;
    // NASA +Y north / −Z east becomes Moon body +Z north / +Y east.
    directions[i]=x/r;directions[i+1]=-z/r;directions[i+2]=y/r;
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.BufferAttribute(positions,3));
  geometry.setAttribute('uv',new T.BufferAttribute(new Float32Array(positions.length/3*2),2));
  geometry.setAttribute('bodyDirection',new T.BufferAttribute(directions,3));
  geometry.setIndex(new T.BufferAttribute(data.indices,1));await computeNormalsCooperatively(geometry,signal).catch(error=>{geometry.dispose();throw error;});geometry.computeBoundingSphere();
  const atlas=acquireMoonAtlas(data.textureUrl,4);
  let texture:T.Texture;
  try { texture=await waitForMoonAtlas(atlas,signal);signal.throwIfAborted(); }
  catch(error){geometry.dispose();atlas.release();throw error;}
  const material=new T.MeshStandardMaterial({color:0xffffff,roughness:1,metalness:0,map:texture});
  const atlasAppearance={value:1};material.toneMapped=false;
  // Per-fragment spherical coordinates avoid a UV interpolation seam at ±180°.
  material.onBeforeCompile=shader=>{
    shader.uniforms.atlasAppearance=atlasAppearance;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 bodyDirection; varying vec3 vNasaDirection;').replace('#include <begin_vertex>','#include <begin_vertex>\nvNasaDirection=bodyDirection;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float atlasAppearance; varying vec3 vNasaDirection;').replace('#include <map_fragment>',`vec3 d=normalize(vNasaDirection); vec2 moonUv=vec2(atan(d.y,d.x)/(2.0*PI)+0.5,asin(clamp(d.z,-1.0,1.0))/PI+0.5); vec4 sourceTexel=texture2D(map,moonUv); diffuseColor*=vec4(vec3(dot(sourceTexel.rgb, ${LUNAR_LINEAR_LUMINANCE_GLSL})),sourceTexel.a);`).replace('#include <opaque_fragment>','if(atlasAppearance>0.5) outgoingLight=diffuseColor.rgb;\n#include <opaque_fragment>');
  };
  const mesh=new T.Mesh(geometry,material);mesh.name='NASA original topographic Moon';mesh.visible=false;
  return {mesh,setAtlasAppearance(enabled:boolean){atlasAppearance.value=enabled?1:0;if(material.toneMapped===enabled){material.toneMapped=!enabled;material.needsUpdate=true;}},maxRadiusKm:data.metadata.scale.sourceRadiusMax*scale,dispose(){geometry.dispose();material.dispose();atlas.release();}};
}
