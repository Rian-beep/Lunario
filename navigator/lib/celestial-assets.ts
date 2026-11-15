import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type CelestialAssetKind = "sun" | "earth";
const scope = "NASA display geometry and textures only. Nominal diameter 2 display units; authored orientation retained without a verified celestial frame/epoch transform. Sun/Earth directions, ranges and science times remain JPL-derived.";
export const CELESTIAL_ASSETS = {
  sun: { kind: "sun", name: "Sun", path: "/data/celestial-models/assets/sun.glb", bytes: 4343656, sha256: "a178f5c43c2c9a6ee6c011c315149a7ab5a2594fd5aa9119ee219625a18da1dd", page: "https://science.nasa.gov/learn/heat/resource/sun-3d-model/", source: "https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/s/Sun_1_1391000.glb", credit: "NASA (NASA Science HEAT / Eyes resource)", displayDiameter: 2, scope },
  earth: { kind: "earth", name: "Earth", path: "/data/celestial-models/assets/earth.glb", bytes: 12916400, sha256: "05a5aea99db8ab472487a06debc3b5d0b2cae7636a1a6b9ecfa40b7d1722ba23", page: "https://science.nasa.gov/learn/heat/resource/earth-3d-model/", source: "https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/e/Earth_1_12756.glb", credit: "NASA/JPL-Caltech", displayDiameter: 2, scope },
} as const;
export type CelestialAssetMetadata = typeof CELESTIAL_ASSETS[CelestialAssetKind];
declare global { var __SOLARREACH_CELESTIAL_MODELS__: Record<string, string> | undefined; }
export function celestialAssetUrl(kind: CelestialAssetKind): string {
  const metadata = CELESTIAL_ASSETS[kind];
  if (!metadata) throw new RangeError("Unknown celestial asset");
  const embedded = globalThis.__SOLARREACH_CELESTIAL_MODELS__?.[metadata.path];
  if (embedded) return embedded;
  if (typeof location !== "undefined" && location.protocol === "file:") throw new Error(`Offline NASA ${metadata.name} model is missing`);
  return metadata.path;
}
export function disposeCelestialObject(object: T.Object3D) {
  const geometry = new Set<T.BufferGeometry>(), materials = new Set<T.Material>(), textures = new Set<T.Texture>();
  object.traverse((child) => {
    const mesh = child as T.Mesh;
    if (!mesh.isMesh) return;
    geometry.add(mesh.geometry);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if ((value as T.Texture | null)?.isTexture) textures.add(value as T.Texture);
    }
  });
  geometry.forEach((item) => item.dispose());
  const images = new Set<ImageBitmap>();
  textures.forEach((item) => { const image = item.image as Partial<ImageBitmap> | undefined; if (typeof image?.close === "function") images.add(image as ImageBitmap); item.dispose(); });
  images.forEach((image) => image.close());
  materials.forEach((item) => item.dispose());
}
/** Original authored geometry is centred and uniformly normalized; no procedural fallback. */
export function normalizeCelestialModel(scene: T.Object3D, metadata: CelestialAssetMetadata): T.Group {
  const bounds = new T.Box3().setFromObject(scene), dimensions = bounds.getSize(new T.Vector3());
  const diameter = Math.max(dimensions.x, dimensions.y, dimensions.z);
  if (!Number.isFinite(diameter) || diameter <= 0) throw new Error(`NASA ${metadata.name} model has invalid bounds`);
  scene.position.sub(bounds.getCenter(new T.Vector3()));
  const group = new T.Group(); group.name = `NASA ${metadata.name} display model`;
  group.userData.celestialAsset = metadata;
  group.add(scene); group.scale.setScalar(metadata.displayDiameter / diameter);
  return group;
}
const aborted = (signal?: AbortSignal) => { if (signal?.aborted) throw new DOMException("Celestial model loading aborted", "AbortError"); };
// Share immutable source bytes across renderer handoffs. A departing view must not
// abort the next view's download or race Chrome's disk-cache write for a large GLB.
const sourceByteCaches=new WeakMap<typeof fetch,Map<string,Promise<ArrayBuffer>>>();
function sourceBytes(kind:CelestialAssetKind,url:string):Promise<ArrayBuffer>{
 const transport=globalThis.fetch;let cache=sourceByteCaches.get(transport);
 if(!cache){cache=new Map();sourceByteCaches.set(transport,cache);}
 const hit=cache.get(url);if(hit)return hit;
 const metadata=CELESTIAL_ASSETS[kind],owner=cache;
 const pending=(async()=>{
  const ownerAbort=new AbortController(),deadline=setTimeout(()=>ownerAbort.abort(new DOMException('NASA asset download timed out','TimeoutError')),30000);
  try{
  const response=await transport.call(globalThis,url,{cache:'no-store',signal:ownerAbort.signal});
  if(!response.ok)throw new Error(`NASA ${metadata.name} model unavailable (${response.status})`);
  const declared=Number(response.headers.get('content-length'));if(declared>metadata.bytes)throw new Error(`NASA ${metadata.name} model exceeds declared byte bound`);
  const reader=response.body?.getReader();if(!reader)throw new Error(`NASA ${metadata.name} response has no body`);
  const chunks:Uint8Array[]=[];let total=0;
  try{for(;;){const part=await reader.read();if(part.done)break;total+=part.value.byteLength;if(total>metadata.bytes){await reader.cancel();throw new Error(`NASA ${metadata.name} model exceeds declared byte bound`);}chunks.push(part.value);}}finally{reader.releaseLock();}
  const buffer=new Uint8Array(total);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.byteLength;}const bytes=buffer.buffer;
  if(bytes.byteLength!==metadata.bytes)throw new Error(`NASA ${metadata.name} model byte length differs from provenance`);
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  if(digest!==metadata.sha256)throw new Error(`NASA ${metadata.name} model hash differs from provenance`);
  return bytes;
  }finally{clearTimeout(deadline);}
 })().catch(error=>{owner.delete(url);throw error;});
 owner.set(url,pending);return pending;
}
function waitForSource<T>(pending:Promise<T>,signal?:AbortSignal):Promise<T>{
 if(!signal)return pending;
 return new Promise<T>((resolve,reject)=>{
  const cancel=()=>{signal.removeEventListener('abort',cancel);reject(new DOMException('Celestial model loading aborted','AbortError'));};
  if(signal.aborted){cancel();return;}
  signal.addEventListener('abort',cancel,{once:true});
  pending.then(value=>{signal.removeEventListener('abort',cancel);resolve(value);},error=>{signal.removeEventListener('abort',cancel);reject(error);});
 });
}
export async function loadCelestialAsset(kind: CelestialAssetKind, signal?: AbortSignal) {
  aborted(signal);
  const metadata = CELESTIAL_ASSETS[kind], url = celestialAssetUrl(kind);
  const bytes = await waitForSource(sourceBytes(kind,url),signal); aborted(signal);
  const gltf = await new GLTFLoader().parseAsync(bytes, "");
  let group: T.Group;
  try { aborted(signal); group = normalizeCelestialModel(gltf.scene, metadata); }
  catch (error) { disposeCelestialObject(gltf.scene); throw error; }
  let disposed = false;
  return { group, metadata, dispose() { if (disposed) return; disposed = true; disposeCelestialObject(group); } };
}
