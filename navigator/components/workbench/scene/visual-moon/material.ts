import * as T from 'three';
import {LUNAR_LINEAR_LUMINANCE_GLSL} from '@/lib/lunar-appearance';

export function createVisualMoonMaterial(texture:T.Texture|null, sourceColour:boolean) {
  const material=new T.MeshStandardMaterial({color:0xffffff,roughness:1,metalness:0,map:texture});
  const atlasAppearance={value:1},preserveColour={value:sourceColour?1:0};
  material.toneMapped=false;
  material.customProgramCacheKey=()=> 'visual-moon-spherical-gradients-v1';
  material.onBeforeCompile=shader=>{
    shader.uniforms.atlasAppearance=atlasAppearance;
    shader.uniforms.preserveColour=preserveColour;
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nattribute vec3 bodyDirection; varying vec3 vNasaDirection;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvNasaDirection=bodyDirection;');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nuniform float atlasAppearance; uniform float preserveColour; varying vec3 vNasaDirection;')
      .replace('#include <map_fragment>',`
#ifdef USE_MAP
vec3 d=normalize(vNasaDirection);
vec2 moonUv=vec2(atan(d.y,d.x)/(2.0*PI)+0.5,asin(clamp(d.z,-1.0,1.0))/PI+0.5);
// Analytic gradients do not jump by one UV turn across the longitude seam.
// The polar singularity selects coarse mip levels rather than sparkling pixels.
vec3 dx=dFdx(d),dy=dFdy(d);
float equatorialLength2=max(dot(d.xy,d.xy),1e-10);
float latitudeScale=PI*sqrt(max(1.0-d.z*d.z,1e-10));
vec2 uvDx=vec2((d.x*dx.y-d.y*dx.x)/(2.0*PI*equatorialLength2),dx.z/latitudeScale);
vec2 uvDy=vec2((d.x*dy.y-d.y*dy.x)/(2.0*PI*equatorialLength2),dy.z/latitudeScale);
// SRGBColorSpace makes WebGL decode the colour texture exactly once on sampling.
vec4 sourceTexel=textureGrad(map,moonUv,uvDx,uvDy);
vec3 sourceColour=mix(vec3(dot(sourceTexel.rgb, ${LUNAR_LINEAR_LUMINANCE_GLSL})),sourceTexel.rgb,preserveColour);
diffuseColor*=vec4(sourceColour,sourceTexel.a);
#endif`)
      .replace('#include <opaque_fragment>','if(atlasAppearance>0.5) outgoingLight=diffuseColor.rgb;\n#include <opaque_fragment>');
  };
  return {material,setAtlasAppearance(enabled:boolean){
    atlasAppearance.value=enabled?1:0;
    // The new display map retains its calibrated transfer in both lighting modes.
    const toneMapped=!sourceColour&&!enabled;
    if(material.toneMapped!==toneMapped){material.toneMapped=toneMapped;material.needsUpdate=true;}
  }};
}
