/** Explicit offline preparation; raw NASA downloads must remain under /tmp. */
import {readFile,writeFile,mkdir,realpath,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {resolve,basename} from 'node:path';
import sharp from 'sharp';
import {fromFile} from 'geotiff';

const [colourArg,demArg]=process.argv.slice(2);
if(!colourArg||!demArg)throw new Error('Usage: node scripts/prepare-visual-moon.mjs /tmp/.../lroc_color_16bit_srgb_8k.tif /tmp/.../ldem_64.tif');
const colourPath=await realpath(colourArg),demPath=await realpath(demArg);
if(![colourPath,demPath].every(path=>path.startsWith('/tmp/')))throw new Error('Keep raw sources under /tmp');
const hash=data=>createHash('sha256').update(data).digest('hex');
const root=resolve('public/data/visual-moon');await mkdir(root,{recursive:true});
const sourceURL=name=>`https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/${name}`;
const describe=async path=>({url:sourceURL(basename(path)),bytes:(await stat(path)).size,sha256:hash(await readFile(path))});
const colourMetadata=await sharp(colourPath).metadata();
if(colourMetadata.width!==8192||colourMetadata.height!==4096||colourMetadata.depth!=='ushort'||colourMetadata.channels!==3||
   !colourMetadata.xmpAsString?.includes('sRGB IEC61966-2.1'))throw new Error('Expected official 2025 8K 16-bit sRGB TIFF with sRGB profile');
const colour={source:await describe(colourPath),sourceWidth:8192,sourceHeight:4096,sourceBits:16,colourSpace:'srgb',
  iccSha256:hash(colourMetadata.icc),
  transform:'Decode original RGB16 sRGB code values with GeoTIFF; exact IEC 61966-2-1 transfer to float32 linear RGB; repeated 2x2 area filtering for lower tiers; exact sRGB encode and round to RGB8; lossless WebP. Native 8K rounds original code values directly. No sharpening, tint, contrast or synthesized detail. RGB8 quantization is not lossless versus RGB16.',
  assets:[],calibration:[]};
const tiff=await fromFile(colourPath),image=await tiff.getImage();
const rgb16=await image.readRasters({interleave:true});
const toLinear=Float32Array.from({length:65536},(_,i)=>{const c=i/65535;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});
const encode=c=>Math.round(255*(c<=.0031308?12.92*c:1.055*c**(1/2.4)-.055));
let linear=Float32Array.from(rgb16,value=>toLinear[value]);
for(const width of [8192,4096,2048,1024]){
  const filename=`colour-2025-${width}.webp`,path=resolve(root,filename),height=width/2;
  const rgb8=Buffer.alloc(width*height*3);
  for(let i=0;i<rgb8.length;i++)rgb8[i]=width===8192?Math.round(rgb16[i]/257):encode(linear[i]);
  await sharp(rgb8,{raw:{width,height,channels:3}}).webp({lossless:true,effort:6}).toFile(path);
  const data=await readFile(path),decoded=await sharp(data).raw().toBuffer();
  if(!decoded.equals(rgb8))throw new Error('WebP did not preserve RGB8 samples');
  colour.assets.push({url:`/data/visual-moon/${filename}`,width,height,bytes:data.length,sha256:hash(data),decodedRgb8Sha256:hash(decoded)});
  console.log(filename,data.length);
  if(width>1024){
    const reduced=new Float32Array(width*height*3/4),nextWidth=width/2;
    for(let y=0;y<height/2;y++)for(let x=0;x<nextWidth;x++)for(let c=0;c<3;c++){
      const i=((y*2)*width+x*2)*3+c;
      reduced[(y*nextWidth+x)*3+c]=(linear[i]+linear[i+3]+linear[i+width*3]+linear[i+width*3+3])/4;
    }
    linear=reduced;
  }
}
colour.assets.reverse();
// Independently decode native TIFF pixels: source code values must survive the
// colour-managed float path to within one RGB8 rounding code, without double gamma.
const native=await sharp(resolve(root,'colour-2025-8192.webp')).raw().toBuffer();
for(const [x,y] of [[0,0],[4096,2048],[2048,2048],[6144,2048],[4096,100],[4096,3995],[8191,2048],[1907,1572],[5410,2771]]){
  const source=await image.readRasters({window:[x,y,x+1,y+1],interleave:true});
  const rgb=Array.from(native.subarray((y*8192+x)*3,(y*8192+x)*3+3));
  const expected=Array.from(source,value=>Math.round(value/65535*255));
  if(rgb.some((value,c)=>Math.abs(value-expected[c])>1))throw new Error(`Colour transfer mismatch at ${x},${y}: ${rgb} vs ${expected}`);
  colour.calibration.push({pixel:[x,y],sourceRgb16:Array.from(source),expectedRgb8:expected,runtimeRgb8:rgb});
}
await tiff.close();

const dem=await fromFile(demPath),demImage=await dem.getImage(),demDirectory=await demImage.getFileDirectory();
const width=demImage.getWidth(),height=demImage.getHeight();
if(!['ldem_64.tif','ldem_16.tif'].includes(basename(demPath))||![[23040,11520],[5760,2880]].some(([w,h])=>w===width&&h===height)||
   demDirectory.getValue(258)[0]!==32||demDirectory.getValue(339)[0]!==3)throw new Error('Expected signed floating-point kilometre DEM, never the unsigned half-metre TIFF');
const heights=await demImage.readRasters({interleave:true});
let sourceMin=Infinity,sourceMax=-Infinity;
for(const value of heights){if(!Number.isFinite(value)||Math.abs(value)>20)throw new Error('DEM outside expected kilometre bounds');sourceMin=Math.min(sourceMin,value);sourceMax=Math.max(sourceMax,value);}
const wrap=x=>(x%width+width)%width,clamp=y=>Math.max(0,Math.min(height-1,y));
function sample(lat,lon){
  const x=(lon/360+.5)*width-.5,y=(.5-lat/180)*height-.5,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  const row=y=>heights[clamp(y)*width+wrap(ix)]*(1-fx)+heights[clamp(y)*width+wrap(ix+1)]*fx;
  return row(iy)*(1-fy)+row(iy+1)*fy;
}
const metadata=JSON.parse(await readFile('public/data/nasa-model.json','utf8'));
const meshGzip=await readFile('public/data/nasa-moon-mesh.bin.gz');
if(hash(meshGzip)!==metadata.mesh.sha256)throw new Error('Authored NASA mesh identity mismatch');
const mesh=gunzipSync(meshGzip),count=metadata.mesh.vertexCount;
const radial=Buffer.alloc(16+count*4);radial.writeUInt32LE(0x314d5652);radial.writeUInt32LE(count,4);radial.writeDoubleLE(1737.4,8);
let minRadius=Infinity,maxRadius=-Infinity;
const calibration=[];
for(let i=0;i<count;i++){
  const x=mesh.readFloatLE(48+i*12),y=mesh.readFloatLE(52+i*12),z=mesh.readFloatLE(56+i*12),r=Math.hypot(x,y,z);
  const lat=Math.asin(Math.max(-1,Math.min(1,y/r)))*180/Math.PI,lon=Math.atan2(-z,x)*180/Math.PI;
  const elevationKm=sample(lat,lon),radius=1737.4+elevationKm;
  radial.writeFloatLE(radius,16+i*4);minRadius=Math.min(minRadius,radius);maxRadius=Math.max(maxRadius,radius);
  if(i%50000===0)calibration.push({vertex:i,lat,lon,elevationKm,radiusKmFloat32:radial.readFloatLE(16+i*4)});
}
const compressed=gzipSync(radial,{level:9});await writeFile(resolve(root,'radii-1x.bin.gz'),compressed);
const relief={source:await describe(demPath),sourceWidth:width,sourceHeight:height,sourceUnit:'signed float32 kilometres relative to radius 1737.4 km',sourceMinKm:sourceMin,sourceMaxKm:sourceMax,
  url:'/data/visual-moon/radii-1x.bin.gz',bytes:compressed.length,sha256:hash(compressed),decodedSha256:hash(radial),vertexCount:count,
  authoredMeshSha256:metadata.mesh.sha256,authoredIndicesSha256:hash(mesh.subarray(48+count*12)),
  minRadiusKm:minRadius,maxRadiusKm:maxRadius,reliefMultiplier:1,
  transform:'Pixel-centred equirectangular bilinear interpolation, periodic longitude and clamped polar edge rows. Radius=1737.4km+signed elevation km. Radially reproject the existing authored vertex directions; preserve all triangles and body-frame directions. No added vertices, noise, displacement exaggeration or height inferred from colour.',
  calibration};
await dem.close();
const manifest={version:1,credit:"NASA’s Scientific Visualization Studio / NASA Goddard Space Flight Center; LRO LROC and LOLA instrument teams",
  pages:['https://svs.gsfc.nasa.gov/14959/','https://svs.gsfc.nasa.gov/4720/'],colour,relief,
  limitations:[
    '2025 colour is optimized for aesthetics, not science. It is not a power, visibility, ice, reflectance or composition measurement.',
    'Colour outside 70°N–70°S uses lower-resolution monochrome LDAM fill; small high-latitude gaps are inpainted. More texture pixels do not create polar geology.',
    'Global raster sampling and the retained authored topology cannot resolve near-surface geology. Existing NASA polar angular pinching remains; use qualified local numerical terrain near the surface.',
    'The radial reprojection is a separate 1x visual derivative. Original authored mesh, texture, metadata and scientific DEM/loaders remain unchanged.',
    'The unsigned *_uint TIFFs use half-metres relative to 1727400m; they are not inputs to this preparation.'
  ]};
await writeFile(resolve(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Prepared visual-only NASA Moon assets',relief.source.url,compressed.length);
