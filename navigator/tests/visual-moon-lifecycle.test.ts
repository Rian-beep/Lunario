import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import * as T from 'three';
import {loadVisualMoonTexture,type VisualMoonStatus} from '../components/workbench/scene/visual-moon/assets';
import {createVisualMoonMaterial} from '../components/workbench/scene/visual-moon/material';
import {VISUAL_MOON} from '../lib/visual-moon';

const status=():VisualMoonStatus=>({colour:'legacy',width:8192,relief:'authored',warnings:[]});
const options={device:{maxTextureSize:4096,textureBudgetMiB:128,maxAnisotropy:4}};
type ImageRequest={url:string;texture:T.Texture;finish:()=>void;fail:()=>void;disposals:number};

function imageFixture(t:TestContext) {
  const requests:ImageRequest[]=[];
  t.mock.method(T.TextureLoader.prototype,'load',function(url:string,onLoad?:(t:T.Texture)=>void,_progress?:unknown,onError?:(error:unknown)=>void){
    const texture=new T.Texture(),tier=VISUAL_MOON.colour.assets.find(asset=>asset.url===url)!;
    const request={url,texture,disposals:0,finish(){texture.image={width:tier.width,height:tier.height};onLoad?.(texture);},fail(){onError?.(new Error('fixture transport failure'));}};
    texture.addEventListener('dispose',()=>request.disposals++);requests.push(request);return texture;
  });
  return requests;
}
async function until(predicate:()=>boolean){const deadline=Date.now()+2000;while(!predicate()&&Date.now()<deadline)await delay(1);assert.ok(predicate(),'progressive request did not arrive');}

test('progressive maps respect dimensions/colour space, release old tiers, and never reload on appearance updates',async t=>{
  const requests=imageFixture(t),state=status(),controller=new AbortController();
  const loading=loadVisualMoonTexture(options,controller.signal,state);requests[0].finish();const asset=await loading;
  t.after(()=>asset.dispose());
  assert.equal(state.width,1024);assert.equal(requests[0].texture.colorSpace,T.SRGBColorSpace);
  assert.equal(requests[0].texture.flipY,true);assert.equal(requests[0].texture.minFilter,T.LinearMipmapLinearFilter);
  const appearance=createVisualMoonMaterial(asset.texture,true),published:T.Texture[]=[];
  const upgrade=asset.upgrade(texture=>{published.push(texture);appearance.material.map=texture;});
  await until(()=>requests.length===2);requests[1].finish();
  await until(()=>requests.length===3);requests[2].finish();await upgrade;
  assert.deepEqual(requests.map(r=>(r.texture.image as {width:number}|null)?.width??0),[0,0,4096]);
  assert.equal(state.width,4096);assert.equal(published.length,2);
  for(let update=0;update<100;update++)appearance.setAtlasAppearance(update%2===0);
  await asset.upgrade(()=>assert.fail('upgrade must run once'));
  controller.abort(); // Old runtime abort does not invalidate a transferred, ready asset.
  assert.equal(requests.length,3);assert.equal(requests[2].disposals,0);
  assert.equal(appearance.material.toneMapped,false);
  asset.dispose();asset.dispose();appearance.material.dispose();
  assert.deepEqual(requests.map(r=>r.disposals),[1,1,1]);assert.equal(requests[2].texture.image,null);
});

test('failed upgrade retains the last successful map without a larger or legacy request',async t=>{
  const requests=imageFixture(t),state=status();
  const loading=loadVisualMoonTexture(options,new AbortController().signal,state);requests[0].finish();const asset=await loading;
  t.after(()=>asset.dispose());
  const upgrade=asset.upgrade(()=>assert.fail('failed tier cannot publish'));
  await until(()=>requests.length===2);requests[1].fail();await upgrade;
  assert.equal(requests.length,2);assert.equal(state.width,1024);assert.equal(state.warnings.length,1);
  assert.equal(requests[0].disposals,0);assert.equal(requests[1].disposals,1);asset.dispose();
});

test('dispose aborts a stalled upgrade, late image completion cannot resurrect GPU ownership',async t=>{
  const requests=imageFixture(t),state=status();
  const loading=loadVisualMoonTexture(options,new AbortController().signal,state);requests[0].finish();const asset=await loading;
  t.after(()=>asset.dispose());
  const upgrade=asset.upgrade(()=>assert.fail('disposed map cannot publish'));
  await until(()=>requests.length===2);asset.dispose();await upgrade;requests[1].finish();
  assert.deepEqual(requests.map(r=>r.disposals),[1,1]);assert.equal(requests[1].texture.image,null);
  assert.equal(state.warnings.length,0);
});

test('startup abort and primary dimension mismatch release their only texture immediately',async t=>{
  const requests=imageFixture(t),controller=new AbortController();
  const loading=loadVisualMoonTexture(options,controller.signal,status());controller.abort();
  await assert.rejects(loading,{name:'AbortError'});assert.equal(requests[0].disposals,1);
  requests[0].finish();assert.equal(requests[0].texture.image,null);
  const malformed=loadVisualMoonTexture({...options,prepareTexture(){assert.fail('invalid primary must never upload');}},new AbortController().signal,status());
  // Invoke the actual completion with a false primary width.
  const request=requests[1];
  Object.defineProperty(request.texture,'image',{configurable:true,get(){return {width:8192,height:4096};},set(){}});
  request.finish();await assert.rejects(malformed,/dimensions/);assert.equal(request.disposals,1);
});

test('a device that cannot hold the smallest tier causes zero texture requests',async t=>{
  const requests=imageFixture(t);
  await assert.rejects(loadVisualMoonTexture({device:{maxTextureSize:512,textureBudgetMiB:128,maxAnisotropy:1}},new AbortController().signal,status()),/budget/);
  assert.equal(requests.length,0);
});

test('actual material uses stable seam-safe gradients, smooth diffuse normals and calibrated RGB without fabricated regolith',()=>{
  const appearance=createVisualMoonMaterial(new T.Texture(),true);
  const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};
  appearance.material.onBeforeCompile(shader as unknown as Parameters<T.MeshStandardMaterial['onBeforeCompile']>[0],{} as T.WebGLRenderer);
  assert.ok(shader.fragmentShader.includes('textureGrad(map,moonUv,uvDx,uvDy)'));
  assert.ok(shader.fragmentShader.includes('sourceTexel.rgb,preserveColour'));
  assert.ok(shader.vertexShader.includes('vNasaDirection=bodyDirection'));
  assert.equal(appearance.material.flatShading,false);assert.equal(appearance.material.roughness,1);assert.equal(appearance.material.metalness,0);
  assert.equal(appearance.material.normalMap,null);assert.equal(appearance.material.bumpMap,null);assert.equal(appearance.material.displacementMap,null);
  const uniforms=shader.uniforms as Record<string,{value:number}>;assert.equal(uniforms.preserveColour.value,1);
  const cache=appearance.material.customProgramCacheKey();
  appearance.setAtlasAppearance(false);assert.equal(appearance.material.toneMapped,false);assert.equal(uniforms.atlasAppearance.value,0);
  appearance.setAtlasAppearance(true);assert.equal(uniforms.atlasAppearance.value,1);assert.equal(appearance.material.customProgramCacheKey(),cache);
  appearance.material.dispose();
});
