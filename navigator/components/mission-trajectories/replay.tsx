'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {Button} from '../ui/button';
import {visualMoonDevice} from '../../lib/visual-moon-device';
import {createNasaGlobe} from '../workbench/scene/nasa-globe';
import {missionReplayClock,missionTrajectoryState,trajectorySceneKm,type MissionTrajectory} from '../../lib/mission-trajectories';
import {missionReplayCameraEase,missionReplayFrameError,missionReplayPath,missionReplayTimeLabels} from '../../lib/mission-replay';

/** A separate, explicitly labelled IAU_MOON display; never feeds map terrain/contact or planning time. */
export function PublishedTrajectoryReplay({data}:{data:MissionTrajectory}){
 const error=missionReplayFrameError(data);
 if(error)return <section aria-label="Published trajectory replay" className="published-replay"><h3>{data.vehicle} · {data.kind} {data.phase}</h3><p role="alert">{error}</p><p>{data.uncertainty}</p></section>;
 return <MoonFixedTrajectoryReplay key={data.id} data={data}/>;
}
function MoonFixedTrajectoryReplay({data}:{data:MissionTrajectory}){
 const host=useRef<HTMLDivElement>(null),live=useRef({seconds:0,following:false});
 const path=useMemo(()=>missionReplayPath(data),[data]),timeLabels=missionReplayTimeLabels(data);
 const [seconds,setSeconds]=useState(0),[playing,setPlaying]=useState(false),[following,setFollowing]=useState(false),[status,setStatus]=useState('Loading NASA visual globe…');
 live.current={seconds,following};
 useEffect(()=>{setSeconds(0);setPlaying(false);setFollowing(false);},[data]);
 useEffect(()=>{
  if(!playing)return;
  const anchor=performance.now(),start=live.current.seconds;let frame=0;
  const tick=()=>{const next=missionReplayClock(data,start,anchor,performance.now());if(!next){setPlaying(false);return;}setSeconds(next.seconds);if(next.ended)setPlaying(false);else frame=requestAnimationFrame(tick);};
  frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
 },[data,playing]);
 useEffect(()=>{
  const element=host.current;if(!element)return;
  const abort=new AbortController();let frame=0,disposed=false,globe:Awaited<ReturnType<typeof createNasaGlobe>>|null=null;
  let renderer:T.WebGLRenderer;
  try{renderer=new T.WebGLRenderer({antialias:true,logarithmicDepthBuffer:true});}catch(error){setStatus(`3D replay unavailable: ${error instanceof Error?error.message:'WebGL could not start'}`);return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.setClearColor(0x030404);element.append(renderer.domElement);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(45,1,.001,1e7),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.minDistance=.01;controls.maxDistance=100000;controls.maxPolarAngle=Math.PI;
  const points=data.samples.map(s=>new T.Vector3(...trajectorySceneKm(s.position)));
  const geometries:T.BufferGeometry[]=[],material=new T.LineBasicMaterial({color:0xffa34b}),pointMaterial=new T.PointsMaterial({color:0xffa34b,size:4,sizeAttenuation:false});
  for(const segment of path.lines){const geometry=new T.BufferGeometry().setFromPoints(segment.map(p=>new T.Vector3(...trajectorySceneKm(p))));geometries.push(geometry);scene.add(new T.Line(geometry,material));}
  if(path.points.length){const geometry=new T.BufferGeometry().setFromPoints(path.points.map(p=>new T.Vector3(...trajectorySceneKm(p))));geometries.push(geometry);scene.add(new T.Points(geometry,pointMaterial));}
  const markerGeometry=new T.SphereGeometry(1,16,12),markerMaterial=new T.MeshBasicMaterial({color:0x7cd9e8}),marker=new T.Mesh(markerGeometry,markerMaterial);scene.add(marker);
  const bounds=new T.Box3().setFromPoints(points),target=bounds.getCenter(new T.Vector3()),span=Math.max(bounds.getSize(new T.Vector3()).length(),2),normal=target.clone().normalize();
  camera.position.copy(normal).multiplyScalar(6200);controls.target.set(0,0,0);controls.update();
  const from=camera.position.clone(),destination=target.clone().addScaledVector(normal,span*1.4).add(new T.Vector3(0,span*.3,0)),started=performance.now();
  const motion=matchMedia('(prefers-reduced-motion: reduce)');let arriving=true;
  const resize=new ResizeObserver(()=>{const {width,height}=element.getBoundingClientRect();if(width&&height){renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();}});resize.observe(element);
  scene.add(new T.AmbientLight(0xffffff,2));
  createNasaGlobe(0,0,1737.4,abort.signal,{device:visualMoonDevice(renderer.capabilities.maxTextureSize,renderer.capabilities.getMaxAnisotropy(),undefined,location.protocol==='file:'),prepareTexture:texture=>renderer.initTexture(texture)}).then(asset=>{
   if(disposed){asset.dispose();return;}globe=asset;
   // Site-zero E/up/-N coordinates -> conventional source-body y-up display.
   const group=new T.Group();group.matrixAutoUpdate=false;group.matrix.set(0,1,0,1737.4,0,0,-1,0,-1,0,0,0,0,0,0,1);group.add(asset.mesh);asset.mesh.visible=true;scene.add(group);
   setStatus('NASA visual globe · source path in IAU_MOON · terrain registration unqualified');
  }).catch(error=>{if(!abort.signal.aborted)setStatus(`NASA globe unavailable; source path retained: ${error instanceof Error?error.message:'asset error'}`);});
  const render=(now:number)=>{
   if(disposed)return;const state=missionTrajectoryState(data,live.current.seconds);
   marker.visible=!!state;
   if(state){marker.position.set(...trajectorySceneKm(state.positionKm));marker.scale.setScalar(Math.max(.001,camera.position.distanceTo(marker.position)*.007));}
   if(arriving){
    const ease=missionReplayCameraEase(now-started,motion.matches);
    if(ease===1){camera.position.copy(destination);controls.target.copy(target);arriving=false;controls.enableDamping=true;}
    else{camera.position.lerpVectors(from,destination,ease);controls.target.copy(target).multiplyScalar(ease);}
   }else if(live.current.following&&state){const offset=camera.position.clone().sub(controls.target);controls.target.copy(marker.position);camera.position.copy(marker.position).add(offset);}
   controls.update();renderer.render(scene,camera);element.dataset.replaySeconds=String(live.current.seconds);element.dataset.positionKm=state?.positionKm.join(',')??'';element.dataset.frame=data.frame.name;
   frame=requestAnimationFrame(render);
  };frame=requestAnimationFrame(render);
  return()=>{disposed=true;abort.abort();cancelAnimationFrame(frame);resize.disconnect();controls.dispose();globe?.dispose();geometries.forEach(geometry=>geometry.dispose());material.dispose();pointMaterial.dispose();markerGeometry.dispose();markerMaterial.dispose();renderer.dispose();renderer.domElement.remove();};
 },[data,path]);
 const current=missionTrajectoryState(data,seconds);
 return <section aria-label="Published trajectory replay" className="published-replay"><h3>{data.vehicle} · {data.kind} {data.phase}</h3>
  <p>{timeLabels.start}</p><div ref={host} aria-label="Three dimensional source trajectory" style={{height:'min(52vh,480px)',minHeight:240,background:'#030404',touchAction:'none'}}/>
  <p role="status">{status}</p><div className="button-row"><Button onClick={()=>{if(seconds>=data.coverage.end)setSeconds(0);setPlaying(v=>!v);}}>{playing?'Pause replay':'Play replay at 1×'}</Button><Button variant="outline" onClick={()=>{setPlaying(false);setSeconds(0);}}>Restart</Button><Button variant="outline" aria-pressed={following} onClick={()=>setFollowing(v=>!v)}>{following?'Release camera':'Follow position'}</Button></div>
  <label>{timeLabels.elapsed}<input aria-label="Historical replay elapsed seconds" type="range" min={0} max={data.coverage.end} step={.1} value={seconds} onChange={e=>{setPlaying(false);setSeconds(Number(e.target.value));}}/></label><p>{seconds.toFixed(1)} / {data.coverage.end} source seconds since epoch ({data.epoch.scale}) · lunar-centre distance {current?Math.hypot(...current.positionKm).toFixed(3):'unavailable'} km</p>
  <p>{data.coverage.interpolation==='none'?'Exact source samples only; points are not connected.':`Linear display interpolation only across intervals up to ${data.coverage.maxGapSeconds} source seconds.`}{path.gapCount>0?` ${path.gapCount} source gap${path.gapCount===1?' is':'s are'} left unconnected.`:''}</p>
  {!current&&<p role="status">No source position at this elapsed time: missing coverage or exact samples only. The beacon is hidden.</p>}
  <details><summary>Source limitations</summary><p>{data.uncertainty}</p><ul>{data.missing.map(item=><li key={item}>{item}</li>)}</ul></details>
  <p>The blue beacon marks position, not spacecraft size or attitude. The source frame is not qualified against the planning map’s mean-Earth terrain. No collision, burn state or touchdown outcome is inferred. Planning dates and physics controls remain independent.</p>
 </section>;
}
