import * as T from 'three';
type Entry={texture:T.Texture;ready:Promise<T.Texture>;references:number;retired:boolean;cancel:()=>void};
const atlas=new Map<string,Entry>();
/** One GPU texture shared by globe and local terrain, retired with its last owner. */
export function acquireMoonAtlas(url:string,maxAnisotropy:number){
 let entry=atlas.get(url);
 if(!entry){
  let resolve!:(texture:T.Texture)=>void,reject!:(error:unknown)=>void;
  const ready=new Promise<T.Texture>((done,fail)=>{resolve=done;reject=fail;});
  const created:Entry={texture:null as unknown as T.Texture,ready,references:0,retired:false,cancel:()=>reject(new DOMException("Atlas released", "AbortError"))};
  // Store before starting so synchronous test loaders follow the same ownership path.
  atlas.set(url,created);entry=created;
  try{
   created.texture=new T.TextureLoader().load(url,loaded=>{if(created.retired){(loaded as T.Texture).image=null;return;}resolve(loaded);},undefined,error=>{if(atlas.get(url)===created)atlas.delete(url);reject(error);});
   created.texture.colorSpace=T.SRGBColorSpace;created.texture.wrapS=T.RepeatWrapping;
  }catch(error){created.texture??=new T.Texture();atlas.delete(url);reject(error);}
 }
 entry.references++;entry.texture.anisotropy=Math.max(entry.texture.anisotropy,Math.min(8,maxAnisotropy));
 const held=entry;let released=false;
 return {texture:held.texture,ready:held.ready,release(){if(released)return;released=true;if(--held.references===0){held.retired=true;if(atlas.get(url)===held)atlas.delete(url);held.cancel();held.texture.dispose();held.texture.image=null;}}};
}

/** Abort one consumer immediately; another owner can continue using the atlas. */
export function waitForMoonAtlas(lease:ReturnType<typeof acquireMoonAtlas>,signal:AbortSignal):Promise<T.Texture>{
 return new Promise((resolve,reject)=>{
  const abort=()=>{signal.removeEventListener('abort',abort);lease.release();reject(signal.reason??new DOMException('Atlas loading aborted','AbortError'));};
  // Attach both settlement handlers before releasing an already-aborted last lease.
  lease.ready.then(texture=>{signal.removeEventListener('abort',abort);if(signal.aborted)abort();else resolve(texture);},error=>{signal.removeEventListener('abort',abort);reject(error);});
  if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});
 });
}
