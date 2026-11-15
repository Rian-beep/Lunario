import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import sharp from 'sharp';
import {VISUAL_MOON,decodeVisualMoonRadii,visualMoonTiers,visualMoonTextureBytes} from '../lib/visual-moon';
import {decodeNasaMesh,nasaLatLonToXyz} from '../lib/nasa-model';

const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const asset=(url:string)=>readFileSync(new URL(`../public${url}`,import.meta.url));
const radial=gunzipSync(asset(VISUAL_MOON.relief.url));
const arrayBuffer=(bytes:Uint8Array)=>Uint8Array.from(bytes).buffer;

test('visual sources are bounded 2025 RGB16 sRGB and signed float kilometre LOLA, with unchanged authored triangles',()=>{
  assert.equal(VISUAL_MOON.colour.source.url,'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_16bit_srgb_8k.tif');
  assert.equal(VISUAL_MOON.colour.sourceBits,16);
  assert.equal(VISUAL_MOON.colour.source.bytes,243289792);
  assert.equal(VISUAL_MOON.colour.colourSpace,'srgb');
  assert.match(VISUAL_MOON.relief.source.url,/\/ldem_64\.tif$/);
  assert.equal(VISUAL_MOON.relief.sourceWidth,23040);
  assert.equal(VISUAL_MOON.relief.sourceHeight,11520);
  assert.equal(VISUAL_MOON.relief.sourceUnit,'signed float32 kilometres relative to radius 1737.4 km');
  assert.equal(VISUAL_MOON.relief.reliefMultiplier,1);
  assert.ok(VISUAL_MOON.relief.sourceMinKm<0&&VISUAL_MOON.relief.sourceMinKm>-20);
  assert.ok(VISUAL_MOON.relief.sourceMaxKm>0&&VISUAL_MOON.relief.sourceMaxKm<20);
  const authored=asset('/data/nasa-moon-mesh.bin.gz'),binary=gunzipSync(authored);
  assert.equal(hash(authored),VISUAL_MOON.relief.authoredMeshSha256);
  assert.equal(hash(binary.subarray(48+VISUAL_MOON.relief.vertexCount*12)),VISUAL_MOON.relief.authoredIndicesSha256);
  const model=decodeNasaMesh(arrayBuffer(binary));
  assert.equal(model.indices.length/3,1015808);
  for(const sample of VISUAL_MOON.relief.calibration){
    const i=sample.vertex*3,r=Math.hypot(...model.positions.subarray(i,i+3));
    assert.ok(Math.abs(Math.asin(model.positions[i+1]/r)*180/Math.PI-sample.lat)<1e-10);
    assert.ok(Math.abs(Math.atan2(-model.positions[i+2],model.positions[i])*180/Math.PI-sample.lon)<1e-10);
  }
});

test('committed primary textures match hashes, actual dimensions, RGB8 pixels and native colour calibration',async()=>{
  let total=0;
  for(const tier of VISUAL_MOON.colour.assets){
    const bytes=asset(tier.url);total+=bytes.length;
    assert.equal(bytes.length,tier.bytes);assert.equal(hash(bytes),tier.sha256);
    const {data,info}=await sharp(bytes).raw().toBuffer({resolveWithObject:true});
    assert.equal(info.width,tier.width);assert.equal(info.height,tier.height);assert.equal(info.channels,3);
    assert.equal(hash(data),tier.decodedRgb8Sha256);
    if(tier.width===8192)for(const sample of VISUAL_MOON.colour.calibration){
      const [x,y]=sample.pixel;
      const offset:number=(y*tier.width+x)*3;
      assert.deepEqual(Array.from(data.subarray(offset,offset+3)),sample.runtimeRgb8);
      sample.sourceRgb16.forEach((value,c)=>assert.ok(Math.abs(Math.round(value/257)-sample.runtimeRgb8[c])<=1));
      // North-up image rows match spherical body coordinates and TextureLoader flipY.
      const lon=((x+.5)/tier.width-.5)*360,lat=(.5-(y+.5)/tier.height)*180;
      const [nx,ny,nz]=nasaLatLonToXyz(lat,lon),body=[nx,-nz,ny];
      const u=Math.atan2(body[1],body[0])/(2*Math.PI)+.5,v=Math.asin(body[2])/Math.PI+.5;
      assert.ok(Math.abs(u*tier.width-.5-x)<1e-8);
      assert.ok(Math.abs((1-v)*tier.height-.5-y)<1e-8);
    }
  }
  assert.ok(total<50*1024**2,'compact runtime colour ladder, not raw TIFF/EXR');
});

test('1x radial decoder rejects wrong topology, headers, nonfinite samples and source-bound violations',()=>{
  assert.equal(hash(asset(VISUAL_MOON.relief.url)),VISUAL_MOON.relief.sha256);
  assert.equal(hash(radial),VISUAL_MOON.relief.decodedSha256);
  const radii=decodeVisualMoonRadii(arrayBuffer(radial),VISUAL_MOON.relief.vertexCount);
  for(const sample of VISUAL_MOON.relief.calibration){
    assert.equal(radii[sample.vertex],sample.radiusKmFloat32);
    assert.ok(Math.abs(radii[sample.vertex]-(1737.4+sample.elevationKm))<.0000611,'float32 radial rounding below 6.11 cm');
  }
  assert.ok(VISUAL_MOON.relief.minRadiusKm>1720&&VISUAL_MOON.relief.maxRadiusKm<1755);
  assert.throws(()=>decodeVisualMoonRadii(arrayBuffer(radial),3),/count/);
  assert.throws(()=>decodeVisualMoonRadii(arrayBuffer(radial.subarray(0,-1)),radii.length),/count/);
  for(const [offset,value] of [[0,0],[8,1727.4],[16,NaN],[16,1800]] as const){
    const invalid=arrayBuffer(radial),view=new DataView(invalid);
    if(offset===0)view.setUint32(0,value,true);else if(offset===8)view.setFloat64(8,value,true);else view.setFloat32(offset,value,true);
    assert.throws(()=>decodeVisualMoonRadii(invalid,radii.length),/calibration|bounds/);
  }
});

test('device selection accounts for old/new mip chains and both decoded images during replacement',()=>{
  const select=(maxTextureSize:number,textureBudgetMiB:number)=>visualMoonTiers({maxTextureSize,textureBudgetMiB,maxAnisotropy:8}).map(t=>t.width);
  assert.deepEqual(select(8192,512),[1024,2048,4096,8192]);
  assert.deepEqual(select(16384,128),[1024,2048,4096]);
  assert.deepEqual(select(2048,128),[1024,2048]);
  assert.deepEqual(select(8192,20),[1024]);
  assert.deepEqual(select(512,512),[]);
  assert.deepEqual(select(8192,0),[]);assert.deepEqual(select(Infinity,512),[]);
  assert.equal(visualMoonTextureBytes(8192,4096),Math.ceil(8192*4096*4*4/3));
});
