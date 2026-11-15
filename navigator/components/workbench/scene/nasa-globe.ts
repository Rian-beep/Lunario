import * as T from 'three';
import {acquireMoonAtlas,waitForMoonAtlas} from '@/lib/moon-atlas-texture';
import {VISUAL_MOON} from '@/lib/visual-moon';
import {loadVisualMoonRadii,loadVisualMoonTexture,type VisualMoonOptions,type VisualMoonStatus} from './visual-moon/assets';
import {createVisualMoonMaterial} from './visual-moon/material';
import {computeNormalsCooperatively} from './surface';
import {loadNasaModel,nasaSiteFrame} from '@/lib/nasa-model';

/** Original NASA triangles, rotated into the same right-handed local scene frame. */
export async function createNasaGlobe(lat:number,lon:number,referenceRadiusKm:number,signal:AbortSignal,visual?:VisualMoonOptions){
  const data=await loadNasaModel({signal});
  const frame=nasaSiteFrame(lat,lon),scale=data.positionToKm;
  const visualStatus:VisualMoonStatus={colour:'legacy',width:8192,relief:'authored',warnings:[]};
  let radii:Float32Array|undefined;
  if(visual){
    try {
      if(data.metadata.mesh.sha256!==VISUAL_MOON.relief.authoredMeshSha256)throw new Error('Visual Moon authored mesh identity mismatch');
      radii=await loadVisualMoonRadii(data.positions.length/3,signal);visualStatus.relief='LOLA 1x';
    }catch(error){signal.throwIfAborted();visualStatus.warnings.push(`Retained authored relief: ${error instanceof Error?error.message:String(error)}`);}
  }
  const positions=new Float32Array(data.positions.length),directions=new Float32Array(data.positions.length);
  let started=performance.now();
  for(let i=0;i<positions.length;i+=3){
    if(i%6144===0&&performance.now()-started>=5){await new Promise(resolve=>setTimeout(resolve,0));signal.throwIfAborted();started=performance.now();}
    const x=data.positions[i],y=data.positions[i+1],z=data.positions[i+2],r=Math.hypot(x,y,z);
    const metricScale=radii?radii[i/3]/r:scale;
    positions[i]=(x*frame.east[0]+y*frame.east[1]+z*frame.east[2])*metricScale;
    positions[i+1]=(x*frame.up[0]+y*frame.up[1]+z*frame.up[2])*metricScale-referenceRadiusKm;
    positions[i+2]=-(x*frame.north[0]+y*frame.north[1]+z*frame.north[2])*metricScale;
    // NASA +Y north / −Z east becomes Moon body +Z north / +Y east.
    directions[i]=x/r;directions[i+1]=-z/r;directions[i+2]=y/r;
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.BufferAttribute(positions,3));
  geometry.setAttribute('uv',new T.BufferAttribute(new Float32Array(positions.length/3*2),2));
  geometry.setAttribute('bodyDirection',new T.BufferAttribute(directions,3));
  geometry.setIndex(new T.BufferAttribute(data.indices,1));await computeNormalsCooperatively(geometry,signal).catch(error=>{geometry.dispose();throw error;});geometry.computeBoundingSphere();
  let atlas:ReturnType<typeof acquireMoonAtlas>|undefined;
  let progressive:Awaited<ReturnType<typeof loadVisualMoonTexture>>|undefined;
  let texture:T.Texture|null=null;
  if(visual){
    try {progressive=await loadVisualMoonTexture(visual,signal,visualStatus);texture=progressive.texture;}
    catch(error){
      if(signal.aborted){geometry.dispose();throw error;}
      // A failed small tier must not trigger an unbounded legacy 8K upload.
      visualStatus.colour='unavailable';visualStatus.width=0;
      visualStatus.warnings.push(`Colour unavailable: ${error instanceof Error?error.message:String(error)}`);
    }
  }else{
    atlas=acquireMoonAtlas(data.textureUrl,4);
    try {texture=await waitForMoonAtlas(atlas,signal);signal.throwIfAborted();}
    catch(error){geometry.dispose();atlas.release();throw error;}
  }
  const appearance=createVisualMoonMaterial(texture,visualStatus.colour==='NASA 2025');
  const material=appearance.material;
  if(!texture)material.color.setHex(0x888888);
  const mesh=new T.Mesh(geometry,material);mesh.name='NASA original topographic Moon';mesh.visible=false;
  mesh.userData.visualMoon=visualStatus;
  // Texture ownership belongs to this asset, not the old runtime's abort signal:
  // a site-frame handoff can transfer the live globe to a replacement runtime.
  let disposed=false;
  if(progressive)void progressive.upgrade(texture=>{if(!disposed){material.map=texture;material.needsUpdate=true;}});
  return {mesh,visualStatus,setAtlasAppearance:appearance.setAtlasAppearance,
    // Cover Float32 radial storage and the subsequent site-frame rotation.
    maxRadiusKm:radii?VISUAL_MOON.relief.maxRadiusKm+.001:data.metadata.scale.sourceRadiusMax*scale,
    dispose(){if(disposed)return;disposed=true;progressive?.dispose();geometry.dispose();material.dispose();atlas?.release();}};
}
