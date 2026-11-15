import {terrainDetailPolicy} from '@/lib/terrain-lod';
import {orbitState,orbitTrack,orbitTime} from '@/lib/orbits';
import {boxCorners, frameVehicle, observeSceneOcclusion, projectedBounds, pullBackForDebris, type ScreenRect} from "@/lib/camera-framing";
import {ASSET_RADII_KM, assetClipPlanes, physicalAsset, sampleAssetFlight, type AssetFlight} from "@/lib/asset-focus";
import {framingDistanceKm} from "@/lib/solar-system";
import {DSN_STATIONS, stationEcefKm, dsnEarthUv, dsnEarthTextureUrl} from "@/lib/dsn";
import {BRIGHT_STARS, starDirectionJ2000, moonFixedStarDirection} from "@/lib/stars";
import {loadCelestialAsset,type CelestialAssetKind} from "@/lib/celestial-assets";
import * as T from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { heightAt } from "@/lib/terrain";
import { buildSurface, buildSurfaceCooperatively, siteFrame, bodyToScene, displayHeight, skyDirection } from "./surface";
import {geographicBodyVector,geographicNorthVector,cameraBodyGeography,stepViewLongitude} from "./geographic-navigation";
import {releaseRenderer} from "./renderer-lifecycle";
import {allowFullPolarOrbit,globeMinimumRadiusKm,outsideSphere} from "./camera-limits";
import { horizonSegments } from "./flight-visuals";
import { createSurfaceMaterial } from "./material";
import { createLander } from "./vehicle";
import {prepareTouchdownFragments, type PreparedTouchdownFragments} from "@/lib/touchdown-fragments";
import type {LandingConfiguration, LandingDynamicsReadout} from "@/lib/landing-contract";
import {ContactReplayGeneration, prepareContactReplay, contactUnsupported, contactReadout, minimumProxyTerrainClearance, CONTACT_STEP_S, CONTACT_MODEL_NOTE, type ContactFlight} from "./contact-dynamics";
import type { SceneProps } from "../scene";
import {createSiteTransition,shortestArcDirection,siteNavigationKey,siteCameraOffset,retainCameraAfterSiteArrival,type Point3} from "@/lib/site-transition";
import {createNasaGlobe} from "./nasa-globe";

type GlobeAsset=Awaited<ReturnType<typeof createNasaGlobe>>;
export type SceneCameraHandoff = {key:string;camera:Point3;target:Point3;up:Point3;resume:boolean;mode?:CameraMode;
  globe?:{asset:GlobeAsset;lat:number;lon:number;referenceHeightM:number}};
export type CameraMode = "flight" | "follow" | "orbit" | "surface" | "globe" | "sun" | "earth" | "vehicle";
export type CameraSettings = { mode: CameraMode; reset: number; horizon: boolean; inspection: boolean; guides:boolean };
export type Readout = { vehicleScale: number; currentCoverage: "fine" | "regional" | "global-coarse" | "reference"; timeSeconds: number; eastKm: number; northKm: number; tangentUpKm: number };

function label(text: string, color = "#f3eee1") {
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 80;
  const context = canvas.getContext("2d")!;
  context.clearRect(0,0,512,80);
  context.font = "500 29px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = color;
  context.lineWidth=5;context.strokeStyle="rgba(0,0,0,.7)";context.strokeText(text,256,40);
  context.fillText(text, 256, 40);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  const sprite = new T.Sprite(new T.SpriteMaterial({ map: texture, sizeAttenuation: false, depthTest: true }));
  sprite.scale.set(0.19, 0.03, 1);
  return sprite;
}

export function mountScene(
  host: HTMLDivElement,
  initial: SceneProps,
  getLive: () => SceneProps,
  getSettings: () => CameraSettings,
  onReadout: (value: Readout) => void,
  onTextureFailure: () => void,
  onContextLost: () => void,
  onModelStatus: (status:string)=>void,
  onEquipmentStatus: (status:string)=>void,
  handoff: SceneCameraHandoff | null = null,
  onNavigationHandoff: (value:SceneCameraHandoff)=>boolean = () => false,
  onNavigationStatus: (value:string)=>void = () => {},
  onCelestialStatus:(kind:CelestialAssetKind,status:string)=>void=()=>{},
  onSiteMode:()=>void=()=>{},
  onSurfaceStatus:(status:string)=>void=()=>{},
  onGeography:(value:{latDeg:number;lonDeg:number;screenNorthAngleDeg?:number;hoveredId?:string;labels?:Array<{id:string;name:string;x:number;y:number;lat:number;lon:number;pole?:boolean}>})=>void=()=>{},
  onStation:(id:string|null)=>void=()=>{},
  onVehicleFocus:()=>void=()=>{},
) {
  host.dataset.sceneInstance = crypto.randomUUID();
  host.dataset.flightRevision = "0";
  host.dataset.horizonRevision = "0";
  Object.assign(host.dataset,{renderFrame:'0',vehicleWorldPosition:'',vehicleQuaternion:'',vehicleVisible:'false',
    landingContact:'',landingDynamics:'',landingFragmentCount:'',landingMassKg:'',terrainClearanceM:'',flightTimeS:'',
    landingContactTimeS:'',landingContactFrameIndex:'',landingContactFrameTimeS:''});
  void onNavigationHandoff; // Legacy retry handoff API; site changes now stay in this runtime.
  const renderer = new T.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x030404);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  const scene = new T.Scene();
  const globeAbort=new AbortController();
  const celestialAbort=new AbortController();
  const celestialAssets:Partial<Record<CelestialAssetKind,Awaited<ReturnType<typeof loadCelestialAsset>>>>={};
  let nasaGlobe:Awaited<ReturnType<typeof createNasaGlobe>>|null=null;
  let nasaRequested=false;
  let transferredGlobe:GlobeAsset|null=null;
  let animationFrame = 0, disposed = false;
  let cancelNavigation=()=>{};
  let surfaceAbort: AbortController | null = null;
  let disposeLander: (() => void) | undefined;
  let disposeContact: (() => void) | undefined;
  let disposeControls: (() => void) | undefined;
  let disposeSurfaceMaterial: (() => void) | undefined;
  let disposeObserver: (() => void) | undefined;
  let disposeListeners: (() => void) | undefined;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    globeAbort.abort();celestialAbort.abort();surfaceAbort?.abort();cancelNavigation();
    for(const asset of Object.values(celestialAssets)){asset.group.removeFromParent();asset.dispose();}

    disposeContact?.();
    disposeLander?.();
    if(nasaGlobe){scene.remove(nasaGlobe.mesh);if(nasaGlobe!==transferredGlobe)nasaGlobe.dispose();}
    transferredGlobe=null;
    cancelAnimationFrame(animationFrame);
    disposeObserver?.(); disposeControls?.();
    const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>(), textures = new Set<T.Texture>();
    scene.traverse((object) => {
      if (object instanceof T.Mesh || object instanceof T.Line || object instanceof T.Sprite || object instanceof T.Points) {
        if ("geometry" in object) geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          materials.add(material);
          if ("map" in material && material.map instanceof T.Texture) textures.add(material.map);
        }
      }
      if (object instanceof T.DirectionalLight) object.shadow.dispose();
    });
    geometries.forEach((geometry) => geometry.dispose());
    textures.forEach((texture) => texture.dispose());
    materials.forEach((material) => material.dispose());
    disposeSurfaceMaterial?.();
    releaseRenderer(renderer,disposeListeners);
    renderer.domElement.remove();
  };
  try {
  host.appendChild(renderer.domElement);
  renderer.domElement.setAttribute("role", "img");
  renderer.domElement.setAttribute("aria-label", "Lunar surface and propagated flight in local east, north and tangent-up kilometres. Drag to orbit, scroll to zoom. Camera presets and a text description follow the canvas.");
  renderer.domElement.tabIndex = 0;
  const camera = new T.PerspectiveCamera(43, 1, 0.0005, 18000);
  let controls = new OrbitControls(camera, renderer.domElement);
  disposeControls = () => controls.dispose();
  controls.enableDamping = false;
  controls.minDistance = 0.006;
  controls.maxDistance = 3e9;
  allowFullPolarOrbit(controls);
  controls.screenSpacePanning = true;
  const enableCameraGestures = () => {
    controls.enableZoom = controls.enableRotate = controls.enablePan = true;
    controls.mouseButtons = { LEFT:T.MOUSE.ROTATE, MIDDLE:T.MOUSE.DOLLY, RIGHT:T.MOUSE.PAN };
    controls.touches = { ONE:T.TOUCH.ROTATE, TWO:T.TOUCH.DOLLY_PAN };
  };
  enableCameraGestures();
  let surfaceProps = initial;
  const baseM = initial.referenceHeightM ?? (initial.terrain ? heightAt(initial.terrain, initial.lat, initial.lon)?.heightM : null) ?? 0;
  const frame = siteFrame(initial.lat, initial.lon, baseM);
  const surface = buildSurface(initial.terrain, frame);
  let surfaceMaterial = createSurfaceMaterial(initial.imagery, initial.map, initial.lat, initial.lon,
    renderer.capabilities.getMaxAnisotropy(), onTextureFailure);
  disposeSurfaceMaterial = () => surfaceMaterial.dispose();
  const ground = new T.Mesh(surface, surfaceMaterial.material);
  ground.castShadow = ground.receiveShadow = true;
  scene.add(ground);
  // The small fill makes the educational view usable on the night side.
  // It is disclosed as display fill and never changes computed visibility.
  const fill = new T.AmbientLight(0xe2e7ee, 0.18);
  const inspectionLight = new T.DirectionalLight(0xf2f0e8, 2.6);
  scene.add(fill, inspectionLight, inspectionLight.target);
  const sunlight = new T.DirectionalLight(0xfff4df, 3.5);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(2048, 2048);
  sunlight.shadow.bias = -0.000015;
  sunlight.shadow.normalBias = 0.002;
  sunlight.shadow.camera.near = 0.1;
  sunlight.shadow.camera.far = 1800;
  scene.add(sunlight, sunlight.target);

  const sun=new T.Group(),earth=new T.Group();
  sun.name='NASA Sun direction model';earth.name='NASA Earth direction model';
  scene.add(sun,earth);
  for(const kind of ['sun','earth'] as const){
    host.dataset[kind+'Model']='loading';host.dataset[kind+'Draws']='0';
    onCelestialStatus(kind,'loading');
    loadCelestialAsset(kind,celestialAbort.signal).then(asset=>{
      if(disposed){asset.dispose();return;}
      celestialAssets[kind]=asset;(kind==='sun'?sun:earth).add(asset.group);
      asset.group.traverse(object=>{if(object instanceof T.Mesh){object.onAfterRender=()=>{host.dataset[kind+'Draws']=String(Number(host.dataset[kind+'Draws']??0)+1);};}});
      host.dataset[kind+'Model']='ready';onCelestialStatus(kind,'ready');
    }).catch(error=>{if(!celestialAbort.signal.aborted){host.dataset[kind+'Model']='error';console.error(`NASA ${kind} asset failed`,error);onCelestialStatus(kind,'unavailable');}});
  }
  const sunLabel = label("Sun direction", "#ffd28a"), earthLabel = label("Earth direction", "#b8dcec");
  scene.add(sunLabel, earthLabel);
  // Separate registered geography; never rewrite the authored NASA GLB UVs.
  const stationRoot=new T.Group();scene.add(stationRoot);stationRoot.visible=false;
  const registeredGeometry=new T.SphereGeometry(1,128,64);
  const registeredPositions=registeredGeometry.getAttribute('position'),registeredUv=registeredGeometry.getAttribute('uv');
  const registrationPoint=new T.Vector3();
  for(let i=0;i<registeredPositions.count;i++){
    registrationPoint.fromBufferAttribute(registeredPositions,i);
    const lat=Math.asin(T.MathUtils.clamp(registrationPoint.y,-1,1))*180/Math.PI,lon=Math.atan2(-registrationPoint.z,registrationPoint.x)*180/Math.PI;
    const [x,y,z]=stationEcefKm({latitudeDeg:lat,longitudeEastDeg:lon,heightM:0}),uv=dsnEarthUv(lat,lon);
    registeredPositions.setXYZ(i,x,z,-y);registeredUv.setXY(i,registeredUv.getX(i)>.999&&uv.u<.001?1:uv.u,uv.v);
  }
  registeredGeometry.computeVertexNormals();registeredGeometry.computeBoundingSphere();
  const registeredMaterial=new T.MeshBasicMaterial({color:0xffffff});
  const registeredEarth=new T.Mesh(registeredGeometry,registeredMaterial);stationRoot.add(registeredEarth);
  let registeredReady=false;
  try{new T.TextureLoader().load(dsnEarthTextureUrl(),texture=>{
    if(disposed){texture.dispose();return;}texture.colorSpace=T.SRGBColorSpace;registeredMaterial.map=texture;registeredMaterial.needsUpdate=true;registeredReady=true;host.dataset.stationTexture='ready';
  },undefined,()=>{if(!disposed){host.dataset.stationTexture='error';onCelestialStatus('earth','station imagery unavailable');}});}catch{host.dataset.stationTexture='error';}
  const stationGeometry=new T.SphereGeometry(1,12,8);
  const stationPins=DSN_STATIONS.map(station=>{
    const [x,y,z]=stationEcefKm(station),direction=new T.Vector3(x,z,-y).normalize();
    const mesh=new T.Mesh(stationGeometry,new T.MeshBasicMaterial({color:0xa9def6,depthTest:true}));
    mesh.position.set(x,z,-y);stationRoot.add(mesh);
    return{station,mesh,direction};
  });
  const orbitRoot=new T.Group();scene.add(orbitRoot);
  const orbitalGeometry=new T.OctahedronGeometry(1);
  let orbitCatalog:unknown=null;
  let orbitalPins:{id:number;mesh:T.Mesh}[]=[];
  const track=new T.Line(new T.BufferGeometry(),new T.LineBasicMaterial({color:0xf4b86c,transparent:true,opacity:.65,depthTest:true}));orbitRoot.add(track);
  let lastOrbitAtMs=NaN;const orbitalStateCache=new Map<number,ReturnType<typeof orbitState>>();
  let trackKey='',orbitTelemetryAt=0,orbitalLabelId:number|null=null,orbitalLabel:T.Sprite|null=null;
  const inspectSatellite=(id:number)=>{
    const o=getLive().orbits;if(!o)return;const element=o.catalog.elements.find(e=>e.NORAD_CAT_ID===id),state=element&&orbitState(element,orbitTime(o,performance.now()));if(!state)return;
    const target=earth.position.clone(),direction=new T.Vector3(...state.sceneKm).normalize(),radius=Math.max(ASSET_RADII_KM.earth,Math.hypot(...state.sceneKm));
    const toCamera=target.clone().addScaledVector(direction,framingDistanceKm(radius*1.15,camera.aspect,camera.fov));
    assetMotion={plan:{startMs:performance.now(),fromCamera:tuple(camera.position),fromTarget:tuple(controls.target),fromCentre:tuple(target),toCamera:tuple(toCamera),toTarget:tuple(target),toCentre:tuple(target),clearanceKm:radius*2},fromUp:camera.up.clone(),toUp:new T.Vector3(0,1,0),anchor:target,mode:'earth'};
  };
  let selectedStation:string|null=null,hoveredStation:string|null=null;
  const inspectStation=(id:string)=>{
    const pin=stationPins.find(item=>item.station.id===id);if(!pin)return;
    if(!earth.visible)return;
    selectedStation=id;onStation(id);
    const target=earth.position.clone(),toCamera=target.clone().addScaledVector(pin.direction,framingDistanceKm(ASSET_RADII_KM.earth,camera.aspect,camera.fov));
    const sourceCentre=camera.position.distanceTo(earth.position)<camera.position.distanceTo(moonCentre)?earth.position:moonCentre;
    assetMotion={plan:{startMs:performance.now(),fromCamera:tuple(camera.position),fromTarget:tuple(controls.target),fromCentre:tuple(sourceCentre),toCamera:tuple(toCamera),toTarget:tuple(target),toCentre:tuple(target),clearanceKm:ASSET_RADII_KM.earth*4},fromUp:camera.up.clone(),toUp:new T.Vector3(0,1,0),anchor:target,mode:'earth'};
  };

  // Immutable J2000 vertices; epoch changes only a rotation uniform, never geometry.
  const starGeometry=new T.BufferGeometry(),starPositions=new Float32Array(BRIGHT_STARS.length*3),starSizes=new Float32Array(BRIGHT_STARS.length);
  BRIGHT_STARS.forEach((star,i)=>{starPositions.set(starDirectionJ2000(star),i*3);starSizes[i]=Math.max(1,3.5-star.magnitude*.5);});
  starGeometry.setAttribute('position',new T.BufferAttribute(starPositions,3));starGeometry.setAttribute('starSize',new T.BufferAttribute(starSizes,1));
  const starRotation=new T.Matrix3(),starMaterial=new T.ShaderMaterial({
    uniforms:{starRotation:{value:starRotation},pixelRatio:{value:renderer.getPixelRatio()}},depthWrite:false,depthTest:true,
    vertexShader:`attribute float starSize;uniform mat3 starRotation;uniform float pixelRatio;void main(){vec3 d=mat3(viewMatrix)*starRotation*position;gl_Position=projectionMatrix*vec4(d*10000.0,1.0);gl_Position.z=gl_Position.w*0.999999;gl_PointSize=starSize*pixelRatio;}`,
    fragmentShader:`void main(){if(length(gl_PointCoord-vec2(0.5))>0.5)discard;gl_FragColor=vec4(0.76,0.80,0.88,1.0);}`,
  });
  const stars=new T.Points(starGeometry,starMaterial);stars.frustumCulled=false;stars.renderOrder=-100;scene.add(stars);
  const starAxes=[{id:'x',name:'axis',raDeg:0,decDeg:0,magnitude:0},{id:'y',name:'axis',raDeg:90,decDeg:0,magnitude:0},{id:'z',name:'axis',raDeg:0,decDeg:90,magnitude:0}];
  const starBasis=new T.Matrix3().set(frame.east.x,frame.east.y,frame.east.z,frame.up.x,frame.up.y,frame.up.z,-frame.north.x,-frame.north.y,-frame.north.z);
  const starBodyRotation=new T.Matrix3();let starEpoch:number|undefined;

  const horizon = new T.LineSegments(new T.BufferGeometry().setFromPoints(horizonSegments(initial.horizon)),
    new T.LineBasicMaterial({ color: 0xc2d1d5, transparent: true, opacity: 0.55 }));
  scene.add(horizon);

  const siteRing = new T.Mesh(new T.RingGeometry(0.8, 1, 64), new T.MeshBasicMaterial({ color: 0xe7cc8b, side: T.DoubleSide, depthTest: true }));
  siteRing.rotation.x = -Math.PI / 2;
  siteRing.position.y = (displayHeight(initial.terrain, initial.lat, initial.lon, baseM).heightM - baseM) / 1000 + 0.004;
  scene.add(siteRing);
  const siteLabel = label("Selected site · ENU origin");
  siteLabel.position.set(0, siteRing.position.y + 0.3, 0);
  scene.add(siteLabel);

  let visualReferenceM = baseM;
  let visualFrame = siteFrame(initial.lat, initial.lon, visualReferenceM);
  const flightVector = (point: {eastM:number;northM:number;yM:number}) => {
    const p = visualFrame.up.clone().multiplyScalar((visualFrame.referenceRadiusM + point.yM) / 1000)
      .addScaledVector(visualFrame.east, point.eastM / 1000).addScaledVector(visualFrame.north, point.northM / 1000);
    return new T.Vector3(p.dot(frame.east), p.dot(frame.up) - frame.referenceRadiusM / 1000, -p.dot(frame.north));
  };
  let flightPoints = initial.showFlight ? initial.flight?.points ?? [] : [];
  let pathVectors = flightPoints.map(flightVector);
  const flightBounds = new T.Box3().setFromPoints(pathVectors.length ? pathVectors : [new T.Vector3()]);
  let flightExtentKm = Math.max(4, flightBounds.getSize(new T.Vector3()).length());
  const lineMaterials: LineMaterial[] = [];
  const fatLine = (vectors: T.Vector3[], color: number, width: number, opacity: number) => {
    const geometry = new LineGeometry();
    const usable = vectors.length > 1 ? vectors : [new T.Vector3(), new T.Vector3()];
    geometry.setPositions(usable.flatMap((v) => [v.x, v.y, v.z]));
    const material = new LineMaterial({ color, linewidth: width, transparent: opacity < 1, opacity, depthTest: true });
    lineMaterials.push(material);
    const line = new Line2(geometry, material);
    line.computeLineDistances();
    scene.add(line);
    return line;
  };
  const path = fatLine(pathVectors, 0xd9b96e, 2.5, 0.72);
  const travelled = fatLine([], 0xffe5a4, 4, 1);
  path.visible = travelled.visible = pathVectors.length > 1;
  const toGround = (point: T.Vector3) => {
    const direction = frame.up.clone().multiplyScalar(point.y + frame.referenceRadiusM / 1000)
      .addScaledVector(frame.east, point.x).addScaledVector(frame.north, -point.z).normalize();
    const latDeg = Math.asin(direction.z) * 180 / Math.PI;
    const lonDeg = Math.atan2(direction.y, direction.x) * 180 / Math.PI;
    const sample = displayHeight(surfaceProps.terrain, latDeg, lonDeg, surfaceProps.referenceHeightM ?? baseM);
    const fine = surfaceProps.terrain ? heightAt(surfaceProps.terrain, latDeg, lonDeg, true) : null;
    const coverage: Readout["currentCoverage"] = sample.coverage > 0.99 ? fine ? "fine" : "regional" : sample.coverage>0&&surfaceProps.terrain?.globalTerrain ? "global-coarse" : "reference";
    return { point: bodyToScene(direction, sample.heightM, frame), coverage };
  };
  const groundTrack = new T.Line(new T.BufferGeometry().setFromPoints(pathVectors.map((v) => {
    const p = toGround(v).point; p.addScaledVector(p.clone().add(new T.Vector3(0,frame.referenceRadiusM/1000,0)).normalize(),0.025); return p;
  })), new T.LineDashedMaterial({ color: 0xdac89c, dashSize: 1, gapSize: 0.8, transparent: true, opacity: 0.6 }));
  groundTrack.computeLineDistances();
  groundTrack.visible = pathVectors.length > 1;
  scene.add(groundTrack);
  const tickLabels: T.Sprite[] = [];
  const refreshTicks = () => {
    for (const tick of tickLabels) { scene.remove(tick); tick.material.map?.dispose(); tick.material.dispose(); }
    tickLabels.length = 0;
  if (flightPoints.length > 1) {
    const lastTime = flightPoints.at(-1)!.t;
    for (let i = 0; i <= 4; i++) {
      const index = Math.round((flightPoints.length - 1) * i / 4);
      const p = flightPoints[index];
      if (i > 0 && p.t < lastTime * (i - 0.5) / 4) continue;
      const tick = label(`${Math.round(p.t)} s from ignition`, "#e8d4a0");
      tick.position.copy(pathVectors[index]);
      tick.position.addScaledVector(new T.Vector3(visualFrame.up.dot(frame.east),visualFrame.up.dot(frame.up),-visualFrame.up.dot(frame.north)), flightExtentKm * 0.018);
      scene.add(tick); tickLabels.push(tick);
    }
  }
  };
  refreshTicks();
  const vehicle = createLander({onStatus:status=>{if(!disposed)onEquipmentStatus(status);}});
  const { group: lander, plume } = vehicle;
  disposeLander = vehicle.dispose;
  scene.add(lander);
  type ContactSceneProps = SceneProps & {landingConfiguration?: LandingConfiguration;
    flightPlaying?: boolean; onLandingDynamics?: (value: LandingDynamicsReadout | null) => void};
  const contactReplay = new ContactReplayGeneration(), fragmentAbort = new AbortController();
  const contactPieces = new T.Group(); scene.add(contactPieces); contactPieces.scale.setScalar(.001);
  let contactParts: PreparedTouchdownFragments | null = null, contactModel: T.Object3D | null = null;
  let vehicleBoundsM = new T.Box3();
  let fragmentBoundsM: T.Box3[] = [];
  let contactFlight: ContactFlight | null | undefined, contactTerrain = initial.terrain;
  let contactKey = '', contactConfiguration = '', contactSerial = 0, lastDynamics = -Infinity;
  let contactPreparationError = '', previousContactText = '', hadDynamics = false, dynamicsSignature = '';
  const contactText = document.createElement('div');
  contactText.className = 'scene-contact-status';
  contactText.setAttribute('role', 'status'); contactText.setAttribute('aria-live', 'polite');
  Object.assign(contactText.style, {position:'absolute', right:'.75rem', bottom:'3.5rem', maxWidth:'min(34rem, calc(100% - 1.5rem))',
    padding:'.4rem .6rem', background:'rgba(12,16,16,.9)', color:'#f3eee1', fontSize:'13px', lineHeight:'1.4', pointerEvents:'none'});
  contactText.hidden = true; host.appendChild(contactText);
  void vehicle.ready.then(async () => {
    if (disposed) return;
    const model = lander.children.find(child => child !== plume);
    if (!model) throw new Error('NASA mesh unavailable for contact replay.');
    contactModel = model;
    // Prepare in a detached metre frame: never bake the scene's km scale or camera
    // transforms into the lab's geometry-based descriptors. Clones share GPU assets.
    const source = model.clone(true); source.position.y = -3.5;
    const prepared = await prepareTouchdownFragments(source, fragmentAbort.signal);
    if (disposed) return;
    vehicleBoundsM = prepared.bounds.clone();
    contactParts = prepared;
    // Bounds in each fragment’s own metre frame, using decoded visible geometry.
    fragmentBoundsM = prepared.objects.map(object => {
      const detached = object.clone(true); detached.position.set(0,0,0); detached.quaternion.identity();
      return new T.Box3().setFromObject(detached, true);
    });
    contactPieces.add(...prepared.objects); contactSerial++;
  }).catch(error => {if (!disposed && !fragmentAbort.signal.aborted) contactPreparationError = error instanceof Error ? error.message : 'NASA contact geometry unavailable.';});
  disposeContact = () => {fragmentAbort.abort(); contactReplay.invalidate(); contactPieces.clear(); contactPieces.removeFromParent(); contactText.remove();};
  let preparedSerial = -1;
  const refreshContact = (live: ContactSceneProps) => {
    const flight = live.showFlight ? live.flight as ContactFlight | null : null;
    const configuration = live.landingConfiguration ?? flight?.landingConfiguration;
    const key = `${siteNavigationKey(live.lat,live.lon)}:${live.referenceHeightM}`;
    const configKey = JSON.stringify(configuration);
    if (flight !== contactFlight || live.terrain !== contactTerrain || key !== contactKey || configKey !== contactConfiguration || preparedSerial !== contactSerial) {
      contactFlight = flight; contactTerrain = live.terrain; contactKey = key; contactConfiguration = configKey; preparedSerial = contactSerial;
      contactReplay.invalidate();
      contactPieces.visible = false;
      if (flight?.contact && contactParts) {
        const contact = flight.contact, parts = contactParts.descriptors;
        const error = contactUnsupported(contact, configuration);
        void contactReplay.prepare(async signal => {
          if (error) throw new Error(error);
          return prepareContactReplay(contact, configuration!, live.terrain, siteFrame(live.lat, live.lon, visualReferenceM), parts, signal);
        });
      }
    }
    return {flight, configuration};
  };
  const currentRing = new T.Mesh(new T.TorusGeometry(1, 0.025, 8, 64), new T.MeshBasicMaterial({ color: 0xffe5a4, depthTest: false, transparent: true, opacity: 0.9 }));
  currentRing.renderOrder = 5;
  scene.add(currentRing);
  const currentLabel = label("Vehicle position (marker)", "#ffe5a4");
  scene.add(currentLabel);
  const dropLine = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]),
    new T.LineDashedMaterial({ color: 0xeee6d3, dashSize: 0.8, gapSize: 0.6, transparent: true, opacity: 0.6 }));
  scene.add(dropLine);

  const axisLengthKm = initial.showFlight ? Math.max(1, 10 ** Math.floor(Math.log10(flightExtentKm / 10))) : 2;
  const axes = new T.Group();
  for (const [name, direction, color] of [
    [`East +${axisLengthKm} km`, new T.Vector3(1, 0, 0), 0xe4bf7d],
    [`North +${axisLengthKm} km`, new T.Vector3(0, 0, -1), 0xd2d8d2],
    [`Tangent up +${axisLengthKm} km`, new T.Vector3(0, 1, 0), 0xa4b8c0],
  ] as const) {
    const arrow = new T.ArrowHelper(direction, new T.Vector3(0, 0.04, 0), axisLengthKm, color, axisLengthKm * 0.08, axisLengthKm * 0.04);
    axes.add(arrow);
    const text = label(name);
    text.position.copy(direction).multiplyScalar(axisLengthKm * 1.08);
    text.position.y += 0.12;
    axes.add(text);
  }
  scene.add(axes);
  let lastMode: CameraMode | undefined, lastReset = -1;
  let followPosition: T.Vector3 | null = null;
  let currentIndex = 0, lastTime = NaN, lastReadout = -Infinity;
  let readoutSignature = "";
  const currentPoint = new T.Vector3();
  const cameraOffset = new T.Vector3();
  const followOffset = new T.Vector3(0.015,0.009,0.020);
  const fit = (bounds: T.Box3) => {
    const centre = bounds.getCenter(new T.Vector3());
    const radius = Math.max(4, bounds.getSize(new T.Vector3()).length() * 0.5);
    const halfVerticalFov = T.MathUtils.degToRad(camera.fov / 2);
    const halfHorizontalFov = Math.atan(Math.tan(halfVerticalFov) * camera.aspect);
    const distance = radius / Math.sin(Math.min(halfVerticalFov, halfHorizontalFov)) * 1.28;
    controls.target.copy(centre);
    camera.position.copy(centre).addScaledVector(new T.Vector3(0.65, 0.58, 1).normalize(), distance);
  };
  const resize = () => {
    const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    lineMaterials.forEach((material) => material.resolution.set(width, height));
    if (lastMode === "flight" && !assetMotion) fit(flightBounds);
  };
  const observer = new ResizeObserver(resize);
  let occlusion: ReturnType<typeof observeSceneOcclusion> | null = null;
  let occlusionRoot: HTMLElement | null = null, occlusionSelector: string | undefined;
  disposeObserver = () => {observer.disconnect(); occlusion?.dispose();};
  observer.observe(host); resize();
  const navigation = createSiteTransition();
  cancelNavigation=()=>navigation.cancel();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let requestedKey=siteNavigationKey(initial.lat,initial.lon), awaitingHandoff=false, canceledGesture=false, navigationPhase="";
  let fromDirection=new T.Vector3(), fromUp=new T.Vector3(), tangentUp=new T.Vector3(), destinationUp=frame.up.clone();
  const sceneToBody=(v:T.Vector3,direction=false)=>frame.east.clone().multiplyScalar(v.x)
    .addScaledVector(frame.up,v.y+(direction?0:frame.referenceRadiusM/1000)).addScaledVector(frame.north,-v.z);
  const bodyToLocal=(v:T.Vector3,direction=false)=>new T.Vector3(v.dot(frame.east),v.dot(frame.up)-(direction?0:frame.referenceRadiusM/1000),-v.dot(frame.north));
  const tuple=(v:T.Vector3):Point3=>[v.x,v.y,v.z];
  const snapshot=(key:string,resume:boolean,mode?:CameraMode):SceneCameraHandoff=>({key,resume,mode,camera:tuple(sceneToBody(camera.position)),target:tuple(sceneToBody(controls.target)),up:tuple(sceneToBody(camera.up,true))});
  const capture=(resume=false,mode:CameraMode=getSettings().mode)=>{
    const value=snapshot(requestedKey,resume,mode);
    if(nasaGlobe){value.globe={asset:nasaGlobe,lat:initial.lat,lon:initial.lon,referenceHeightM:baseM};transferredGlobe=nasaGlobe;}
    return value;
  };
  const status=(value:string)=>{if(value!==navigationPhase){navigationPhase=value;onNavigationStatus(value);}};
  const contextCameraOffset=(live:SceneProps)=>{
    const prepared=live.terrain?heightAt(live.terrain,live.lat,live.lon):null;
    const spacing=prepared?Math.max(prepared.stepM,prepared.inputPixelM):live.terrain?.globalTerrain?.outputSpacingM??null;
    return siteCameraOffset(spacing);
  };
  const localDirection = (v:T.Vector3, source:ReturnType<typeof siteFrame>) => bodyToLocal(source.east.clone().multiplyScalar(v.x).addScaledVector(source.up,v.y).addScaledVector(source.north,-v.z),true);
  let preparingProps = initial;
  let surfaceGeneration = 0, surfaceSegments=384, requestedSurfaceSegments=384, lodChangedAt=0;
  const prepareSurface = (live:SceneProps, detailSegments=surfaceSegments) => {
    const detailOnly=siteNavigationKey(surfaceProps.lat,surfaceProps.lon)===siteNavigationKey(live.lat,live.lon)&&surfaceProps.terrain===live.terrain;requestedSurfaceSegments=detailSegments;
    preparingProps = live; surfaceAbort?.abort();
    const abort = surfaceAbort = new AbortController(), generation = ++surfaceGeneration;
    host.dataset.surfacePreparationStarted=String(performance.now());
    host.dataset.surfaceStatus='preparing';onSurfaceStatus('Preparing destination terrain… camera control remains available.');
    const reference=live.referenceHeightM??(live.terrain?heightAt(live.terrain,live.lat,live.lon)?.heightM:null)??0;
    const destination=siteFrame(live.lat,live.lon,reference);
    const replaceMaterial=surfaceProps.imagery!==live.imagery||surfaceProps.map!==live.map;
    const nextMaterial=replaceMaterial?createSurfaceMaterial(live.imagery,live.map,live.lat,live.lon,renderer.capabilities.getMaxAnisotropy(),onTextureFailure):surfaceMaterial;
    Promise.all([buildSurfaceCooperatively(live.terrain,destination,frame,abort.signal,undefined,detailSegments),nextMaterial.prepareSite(live.lat,live.lon).catch(()=>{if(!abort.signal.aborted)onTextureFailure();return ()=>{};})]).then(([geometry,applyImages])=>{
      if(disposed||abort.signal.aborted||generation!==surfaceGeneration){geometry.dispose();if(replaceMaterial)nextMaterial.dispose();return;}
      const previous=ground.geometry;ground.geometry=geometry;previous.dispose();
      if(replaceMaterial){surfaceMaterial.dispose();surfaceMaterial=nextMaterial;ground.material=nextMaterial.material;}
      applyImages();surfaceProps=live;if(!detailOnly)visualFlight=null;surfaceSegments=detailSegments;host.dataset.surfaceAngularSegments=String(detailSegments);
      const siteHeight=displayHeight(live.terrain,live.lat,live.lon,reference).heightM;
      siteRing.position.copy(bodyToScene(destination.up,siteHeight,frame));
      const up=localDirection(new T.Vector3(0,1,0),destination);
      siteRing.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),up);
      siteLabel.position.copy(siteRing.position).addScaledVector(up,.3);
      axes.position.copy(siteRing.position);axes.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(localDirection(new T.Vector3(1,0,0),destination),up,localDirection(new T.Vector3(0,0,1),destination)));
      host.dataset.surfacePreparationMs=String(performance.now()-Number(host.dataset.surfacePreparationStarted));
      host.dataset.surfaceStatus='ready';onSurfaceStatus('');host.dataset.surfaceSite=siteNavigationKey(live.lat,live.lon);
      host.dataset.surfaceRevision=String(Number(host.dataset.surfaceRevision??0)+1);
    }).catch(error=>{if(replaceMaterial)nextMaterial.dispose();if(!abort.signal.aborted&&!disposed){console.error('Destination surface preparation failed',error);host.dataset.surfaceStatus='error';onSurfaceStatus('Destination terrain could not load; previous surface context remains visible.');onTextureFailure();}});
  };
  let assetMotion:{plan:AssetFlight;fromUp:T.Vector3;toUp:T.Vector3;anchor:T.Vector3;mode:CameraMode}|null=null;
  let focusedAnchor:T.Vector3|null=null;
  let missingFocusRange=false;
  const moonCentre=new T.Vector3(0,-frame.referenceRadiusM/1000,0);
  const liveSky=(live:SceneProps,az:number,el:number)=>{
    const source=siteFrame(live.lat,live.lon,0),v=skyDirection(az,el);
    return bodyToLocal(source.east.clone().multiplyScalar(v.x).addScaledVector(source.up,v.y).addScaledVector(source.north,-v.z),true);
  };
  const placeBodies=(live:SceneProps)=>{
    const earthState=physicalAsset('earth',live.earthRangeKm),sunState=physicalAsset('sun',live.sunRangeKm);
    for(const [kind,object,state,az,el] of [['earth',earth,earthState,live.pose.earthAz,live.pose.earthEl],['sun',sun,sunState,live.pose.sunAz,live.pose.sunEl]] as const){
      object.visible=state!==null;
      if(state){const body=kind==='earth'?live.earthBodyKm:live.sunBodyKm;if(body)object.position.copy(bodyToLocal(new T.Vector3(...body)));else object.position.copy(moonCentre).addScaledVector(liveSky(live,az,el),state.rangeKm);object.scale.setScalar(state.radiusKm);}
      host.dataset[kind+'RangeKm']=state?String(state.rangeKm):'unavailable';
    }
    stationRoot.position.copy(earth.position);
  };
  let poleMeridian=0;
  let geographicMotion:{start:number;from:T.Vector3;to:T.Vector3;fromUp:T.Vector3;toUp:T.Vector3;fromTarget:T.Vector3}|null=null;
  const navigateGeography=(latDeg:number,lonDeg:number,overview=false)=>{
    const physical=sceneToBody(camera.position),radius=Math.max(globeMinimumRadiusKm(nasaGlobe?.maxRadiusKm??1770),overview?framingDistanceKm(1770,camera.aspect,camera.fov):physical.length());
    assetMotion=null;focusedAnchor=null;poleMeridian=lonDeg;hoveredId=undefined;navigation.cancel();awaitingHandoff=false;
    geographicMotion={start:performance.now(),from:physical,to:new T.Vector3(...geographicBodyVector(latDeg,lonDeg,radius)),fromUp:sceneToBody(camera.up,true).normalize(),toUp:new T.Vector3(...geographicNorthVector(latDeg,lonDeg)),fromTarget:sceneToBody(controls.target)};
    lastMode='globe';lastReset=getSettings().reset;controls.minDistance=.006;controls.maxDistance=Math.max(3e9,radius*1.01);controls.maxPolarAngle=Math.PI;
  };
  const stepLongitude=(delta:number)=>{const current=cameraBodyGeography(tuple(sceneToBody(camera.position)),poleMeridian);if(current){const next=stepViewLongitude(current.latDeg,current.lonDeg,delta);navigateGeography(next.latDeg,next.lonDeg);}};
  const poiGroup=new T.Group();scene.add(poiGroup);
  const poiGeometry=new T.SphereGeometry(1,10,8);
  let poiSites=initial.sites;
  const poiRecords:{site:NonNullable<SceneProps['sites']>[number];mesh:T.Mesh<T.SphereGeometry,T.MeshBasicMaterial>;direction:T.Vector3}[]=[];
  let hoveredId:string|undefined,poiLabel:T.Sprite|null=null;
  const clearPois=()=>{for(const item of poiRecords){poiGroup.remove(item.mesh);item.mesh.material.dispose();}poiRecords.length=0;};
  const updatePois=(live:SceneProps)=>{
    clearPois();poiSites=live.sites;
    for(const site of live.sites??[]){
      const direction=new T.Vector3(...geographicBodyVector(site.lat,site.lon));
      const height=displayHeight(live.terrain,site.lat,site.lon,0).heightM;
      const mesh=new T.Mesh(poiGeometry,new T.MeshBasicMaterial({color:0xffefbe,depthTest:false,depthWrite:false,toneMapped:false}));
      mesh.position.copy(bodyToLocal(direction.clone().multiplyScalar((1737400+height)/1000+.6)));mesh.renderOrder=20;poiGroup.add(mesh);poiRecords.push({site,mesh,direction});
    }
  };
  updatePois(initial);
  const raycaster=new T.Raycaster(),pointer=new T.Vector2(),pickingCamera=camera.clone();
  const pickPoi=(event:PointerEvent)=>{
    if(!['globe','orbit'].includes(getSettings().mode))return undefined;
    const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(pointer,camera);
    const hit=raycaster.intersectObjects(poiRecords.filter(item=>item.mesh.visible).map(item=>item.mesh),false)[0];
    return poiRecords.find(item=>item.mesh===hit?.object)?.site;
  };
  let pointerDown:{x:number;y:number;button:number}|null=null;
  const poiDown=(event:PointerEvent)=>{pointerDown={x:event.clientX,y:event.clientY,button:event.button};};
  const pickStation=(event:PointerEvent)=>{
    if(getSettings().mode!=='earth'||!stationRoot.visible)return undefined;
    const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
    const hit=raycaster.intersectObjects(stationPins.filter(pin=>pin.mesh.visible).map(pin=>pin.mesh),false)[0];return stationPins.find(pin=>pin.mesh===hit?.object);
  };
  const pickOrbital=(event:PointerEvent)=>{
    if(!orbitRoot.visible)return undefined;const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
    const hit=raycaster.intersectObjects(orbitalPins.filter(p=>p.mesh.visible).map(p=>p.mesh),false)[0];if(!hit)return undefined;const body=raycaster.intersectObject(registeredEarth,false)[0];if(body&&body.distance<hit.distance)return undefined;return orbitalPins.find(p=>p.mesh===hit.object);
  };
  const poiMove=(event:PointerEvent)=>{const site=pickPoi(event),station=pickStation(event);hoveredId=site?.id;const next=station?.station.id??null;if(next!==hoveredStation){hoveredStation=next;onStation(next??selectedStation);}renderer.domElement.style.cursor=site||station||pickOrbital(event)?'pointer':'';};
  const poiUp=(event:PointerEvent)=>{
    if(pointerDown?.button===0&&Math.hypot(event.clientX-pointerDown.x,event.clientY-pointerDown.y)<5){
      const site=pickPoi(event),station=pickStation(event);
      if(site)getLive().onSelectSite?.(site.id);
      else if(pickOrbital(event))getLive().onSelectOrbital?.(pickOrbital(event)!.id);
      else if(station)inspectStation(station.station.id);
      else {
        const viewCamera=['follow','vehicle'].includes(getSettings().mode)?pickingCamera:camera;
        const started=performance.now(),rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,viewCamera);
        raycaster.params.Line2={threshold:6};raycaster.params.Line={threshold:Math.max(.01,viewCamera.position.distanceTo(currentPoint)*.008)};
        const vehicleHit=getLive().showFlight && raycaster.intersectObjects([path,currentRing,lander,contactPieces].filter(object=>object.visible),true).length>0;
        if(vehicleHit) onVehicleFocus();
        else if(!['earth','sun','vehicle','follow'].includes(getSettings().mode)&&getLive().onPlace){
          const surfaces:T.Object3D[]=[];
          if(nasaGlobe?.mesh.visible) surfaces.push(nasaGlobe.mesh);
          if(ground.visible) surfaces.push(ground);
          const hit=raycaster.intersectObjects(surfaces,false)[0];host.dataset.surfacePickMs=String(performance.now()-started);
          if(hit){const point=cameraBodyGeography(tuple(sceneToBody(hit.point)));if(point)getLive().onPlace?.(point.latDeg,point.lonDeg);}
        }
      }
    }pointerDown=null;
  };
  const poiLeave=()=>{hoveredId=undefined;hoveredStation=null;onStation(selectedStation);renderer.domElement.style.cursor='';};
  renderer.domElement.addEventListener('pointerleave',poiLeave);
  renderer.domElement.addEventListener('pointerdown',poiDown);renderer.domElement.addEventListener('pointermove',poiMove);renderer.domElement.addEventListener('pointerup',poiUp);
  let lastGeographicReadout=0,lastPoiLabel='';
  let navigationCamera = {mode:getSettings().mode, reset:getSettings().reset};
  const configureNavigation=(live:SceneProps,now:number,overview:boolean)=>{
    navigationCamera = {mode:getSettings().mode, reset:getSettings().reset};
    assetMotion=null;focusedAnchor=null;geographicMotion=null;hoveredId=undefined;
    const reference=live.referenceHeightM??(live.terrain?heightAt(live.terrain,live.lat,live.lon)?.heightM:null)??0;
    const destination=siteFrame(live.lat,live.lon,reference);
    const height=displayHeight(live.terrain,live.lat,live.lon,reference).heightM;
    const target=destination.up.clone().multiplyScalar((1_737_400+height)/1000);
    const offset=contextCameraOffset(live);
    const endpoint=target.clone().addScaledVector(destination.east,offset[0]).addScaledVector(destination.up,offset[1]).addScaledVector(destination.north,-offset[2]);
    const physicalCamera=sceneToBody(camera.position);
    fromDirection=physicalCamera.clone().normalize();fromUp=sceneToBody(camera.up,true).normalize();destinationUp=destination.up;
    tangentUp=fromUp.clone().addScaledVector(fromDirection,-fromUp.dot(fromDirection));
    if(tangentUp.lengthSq()<1e-10)tangentUp=frame.north.clone().addScaledVector(fromDirection,-frame.north.dot(fromDirection));
    if(tangentUp.lengthSq()<1e-10)tangentUp=frame.east.clone().addScaledVector(fromDirection,-frame.east.dot(fromDirection));
    tangentUp.normalize();
    navigation.begin({key:requestedKey,now,fromCamera:tuple(physicalCamera),fromTarget:tuple(sceneToBody(controls.target)),toCamera:tuple(endpoint),toTarget:tuple(target),overviewRadiusKm:Math.max(6200,(nasaGlobe?.maxRadiusKm??1770)*3.5),alreadyOverview:overview,reducedMotion:reducedMotion.matches});
    controls.minDistance=0.006;controls.maxPolarAngle=Math.PI;followPosition=null;awaitingHandoff=false;
  };
  const userStart=()=>{if(assetMotion){assetMotion=null;focusedAnchor=(getSettings().mode==='earth'?earth.position:getSettings().mode==='sun'?sun.position:controls.target).clone();followPosition=currentPoint.clone();rebuildControls();status('Asset focus travel canceled. Camera control is yours.');}if(geographicMotion){geographicMotion=null;status('Geographic camera rotation canceled. Camera control is yours.');}if(navigation.sample(performance.now())){navigation.cancel();canceledGesture=true;status("Site navigation canceled. Camera control is yours.");}};
  const userEnd=()=>{
    if(!canceledGesture)return;canceledGesture=false;
    onSiteMode();lastMode='orbit';lastReset=getSettings().reset;rebuildControls();
  };
  const cancelFocusGesture=()=>{if(assetMotion)userStart();};
  renderer.domElement.addEventListener('pointerdown',cancelFocusGesture,true);
  renderer.domElement.addEventListener('wheel',cancelFocusGesture,true);
  const bindGestures=()=>{controls.addEventListener('start',userStart);controls.addEventListener('end',userEnd);};
  function rebuildControls(){
    const target=controls.target.clone(),old={minDistance:controls.minDistance,maxDistance:controls.maxDistance,maxPolarAngle:controls.maxPolarAngle,enablePan:controls.enablePan};
    const position=camera.position.clone(),rotation=camera.quaternion.clone();
    controls.dispose();controls=new OrbitControls(camera,renderer.domElement);controls.target.copy(target);camera.position.copy(position);camera.quaternion.copy(rotation);
    Object.assign(controls,old,{enableDamping:false,screenSpacePanning:true});enableCameraGestures();allowFullPolarOrbit(controls);bindGestures();
  }
  bindGestures();
  if(handoff){
    camera.position.copy(bodyToLocal(new T.Vector3(...handoff.camera)));
    controls.target.copy(bodyToLocal(new T.Vector3(...handoff.target)));
    camera.up.copy(bodyToLocal(new T.Vector3(...handoff.up),true).normalize());
    camera.lookAt(controls.target);allowFullPolarOrbit(controls);rebuildControls();lastMode=getSettings().mode;lastReset=getSettings().reset;
    if(lastMode==="follow")followPosition=controls.target.clone();
    if(handoff.globe){
      const old=siteFrame(handoff.globe.lat,handoff.globe.lon,handoff.globe.referenceHeightM);
      const oldToBody=new T.Matrix4().makeBasis(old.east,old.up,old.north.clone().negate());
      oldToBody.setPosition(old.up.clone().multiplyScalar(old.referenceRadiusM/1000));
      const newToBody=new T.Matrix4().makeBasis(frame.east,frame.up,frame.north.clone().negate());
      newToBody.setPosition(frame.up.clone().multiplyScalar(frame.referenceRadiusM/1000));
      const conversion=newToBody.invert().multiply(oldToBody);
      nasaGlobe=handoff.globe.asset;nasaRequested=true;
      if(nasaGlobe.mesh.matrixAutoUpdate)nasaGlobe.mesh.updateMatrix();nasaGlobe.mesh.matrix.premultiply(conversion);nasaGlobe.mesh.matrixAutoUpdate=false;
      scene.add(nasaGlobe.mesh);onModelStatus('NASA LRO · original topographic Moon');
    }
    if(handoff.resume)configureNavigation(initial,performance.now(),sceneToBody(camera.position).length()>3500);
  }
  const lost = (event: Event) => {
    if(disposed)return;
    event.preventDefault();
    onContextLost();
    dispose();
  };
  renderer.domElement.addEventListener("webglcontextlost", lost);
  // OrbitControls handles pointer/touch; explicit keys keep camera use possible
  // without stealing the root's left/right time-scrubbing shortcuts.
  const key = (event: KeyboardEvent) => {
    if(event.key==='Escape'){userStart();userEnd();return;}
    const step = camera.position.distanceTo(controls.target) * 0.08;
    const offset = new T.Vector3();
    if (event.key === "+" || event.key === "=") camera.position.lerp(controls.target, 0.15);
    else if (event.key === "-") camera.position.sub(controls.target).multiplyScalar(1.18).add(controls.target);
    else if (event.key.toLowerCase() === "a") offset.x = -step;
    else if (event.key.toLowerCase() === "d") offset.x = step;
    else if (event.key.toLowerCase() === "w") offset.z = -step;
    else if (event.key.toLowerCase() === "s") offset.z = step;
    else return;
    userStart();camera.position.add(offset); controls.target.add(offset);userEnd();
    event.preventDefault();
  };
  renderer.domElement.addEventListener("keydown", key);
  disposeListeners = () => {
    renderer.domElement.removeEventListener("webglcontextlost", lost);
    renderer.domElement.removeEventListener("keydown", key);
    renderer.domElement.removeEventListener('pointerdown',cancelFocusGesture,true);
    renderer.domElement.removeEventListener('wheel',cancelFocusGesture,true);
    renderer.domElement.removeEventListener('pointerleave',poiLeave);
    renderer.domElement.removeEventListener('pointerdown',poiDown);renderer.domElement.removeEventListener('pointermove',poiMove);renderer.domElement.removeEventListener('pointerup',poiUp);
    clearPois();poiGeometry.dispose();
  };
  let shaderFailed = false;
  renderer.debug.onShaderError = (gl, program, vertexShader, fragmentShader) => {
    shaderFailed = true;
    console.error("Lunar scene shader compilation failed.", gl.getProgramInfoLog(program),
      gl.getShaderInfoLog(vertexShader), gl.getShaderInfoLog(fragmentShader));
  };
  let visualSite = siteNavigationKey(initial.lat,initial.lon);
  let visualFlight = initial.flight, visualShowFlight = initial.showFlight;
  let visualHorizon = initial.horizon;
  let visualReference = initial.referenceHeightM;
  const refreshLiveGeometry = (live: SceneProps) => {
    let flightChanged = false;
    const referenceM = live.referenceHeightM ?? (live.terrain?heightAt(live.terrain,live.lat,live.lon)?.heightM:null) ?? 0;
    const siteChanged = visualSite !== siteNavigationKey(live.lat,live.lon);
    if (visualFlight !== live.flight || visualShowFlight !== live.showFlight || visualReference !== live.referenceHeightM || visualSite !== siteNavigationKey(live.lat,live.lon)) {
      flightChanged = true;
      visualFlight = live.flight; visualShowFlight = live.showFlight;
      visualReference = live.referenceHeightM; visualReferenceM = referenceM;
      visualFrame = siteFrame(live.lat,live.lon,referenceM);visualSite=siteNavigationKey(live.lat,live.lon);
      flightPoints = live.showFlight ? live.flight?.points ?? [] : [];
      pathVectors = flightPoints.map(flightVector);
      flightBounds.setFromPoints(pathVectors.length ? pathVectors : [new T.Vector3()]);
      flightExtentKm = Math.max(4, flightBounds.getSize(new T.Vector3()).length());
      path.geometry.dispose();
      path.geometry.setPositions((pathVectors.length > 1 ? pathVectors : [new T.Vector3(), new T.Vector3()]).flatMap(v => [v.x, v.y, v.z]));
      path.computeLineDistances();
      travelled.geometry.dispose();
      travelled.geometry.setPositions([0, 0, 0, 0, 0, 0]);
      groundTrack.geometry.dispose();
      groundTrack.geometry=new T.BufferGeometry().setFromPoints(pathVectors.map(v => { const p = toGround(v).point; p.addScaledVector(p.clone().add(new T.Vector3(0,frame.referenceRadiusM/1000,0)).normalize(),0.025); return p; }));
      groundTrack.computeLineDistances();
      refreshTicks(); currentIndex = 0; lastTime = NaN; lastReadout = -Infinity;
      const siteHeight=displayHeight(live.terrain,live.lat,live.lon,referenceM).heightM;
      const up=localDirection(new T.Vector3(0,1,0),visualFrame);
      siteRing.position.copy(bodyToScene(visualFrame.up,siteHeight,frame)).addScaledVector(up,.004);
      siteRing.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),up);
      siteLabel.position.copy(siteRing.position).addScaledVector(up,.3);
      axes.position.copy(siteRing.position);axes.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(localDirection(new T.Vector3(1,0,0),visualFrame),up,localDirection(new T.Vector3(0,0,1),visualFrame)));
      host.dataset.flightRevision = String(Number(host.dataset.flightRevision) + 1);
      host.dataset.flightPointCount = String(pathVectors.length);
      const end = pathVectors.at(-1);
      host.dataset.flightEndpoint = end ? end.toArray().join(',') : '';
    }
    if (visualHorizon !== live.horizon || siteChanged) {
      visualHorizon = live.horizon;
      horizon.geometry.dispose(); horizon.geometry=new T.BufferGeometry().setFromPoints(horizonSegments(live.horizon).map(v=>localDirection(v,visualFrame)));
      host.dataset.horizonRevision = String(Number(host.dataset.horizonRevision) + 1);
    }
    // Keep the mounted terrain/Moon frame fixed; only the observer origin moves.
    horizon.position.copy(bodyToScene(visualFrame.up,referenceM+live.horizon.heightM,frame));
    return flightChanged;
  };
  let renderFrame = 0, clearanceReplay: typeof contactReplay.current = null, clearanceKey = '';
  let terrainClearanceM: number | null = null;
  const render = (now: number) => {
    if (disposed) return;
    const live = getLive(), settings = getSettings();
    placeBodies(live);
    const orbital=live.orbits;
    orbitRoot.position.copy(earth.position);orbitRoot.visible=settings.mode==='earth'&&earth.visible&&!!orbital?.enabled;
    if(orbital&&orbitRoot.visible){
      if(orbitCatalog!==orbital.catalog){for(const pin of orbitalPins){orbitRoot.remove(pin.mesh);(pin.mesh.material as T.Material).dispose();}orbitalPins=orbital.catalog.elements.map(e=>{const mesh=new T.Mesh(orbitalGeometry,new T.MeshBasicMaterial({color:e.NORAD_CAT_ID===66303?0xffb05d:0xa9def6}));orbitRoot.add(mesh);return{id:e.NORAD_CAT_ID,mesh};});orbitCatalog=orbital.catalog;trackKey='';lastOrbitAtMs=NaN;}
      const atMs=orbitTime(orbital,now),positions=[];
      if(atMs!==lastOrbitAtMs){lastOrbitAtMs=atMs;orbitalStateCache.clear();for(const e of orbital.catalog.elements)orbitalStateCache.set(e.NORAD_CAT_ID,orbitState(e,atMs));}
      for(const pin of orbitalPins){const state=orbitalStateCache.get(pin.id);pin.mesh.visible=!!state;if(!state)continue;pin.mesh.position.set(...state.sceneKm);const distance=camera.position.distanceTo(pin.mesh.position.clone().add(earth.position));pin.mesh.scale.setScalar(Math.max(2,distance*.003));(pin.mesh.material as T.MeshBasicMaterial).color.setHex(pin.id===orbital.selectedId?0xffb05d:0xa9def6);positions.push({id:pin.id,ecefKm:state.ecefKm,sceneKm:state.sceneKm});}
      const selectedOrbital=orbitalPins.find(p=>p.id===orbital.selectedId);
      if(orbitalLabelId!==orbital.selectedId){if(orbitalLabel){orbitRoot.remove(orbitalLabel);orbitalLabel.material.map?.dispose();orbitalLabel.material.dispose();}orbitalLabelId=orbital.selectedId;const element=orbital.catalog.elements.find(e=>e.NORAD_CAT_ID===orbital.selectedId);orbitalLabel=element?label(element.OBJECT_NAME,'#ffe0ac'):null;if(orbitalLabel)orbitRoot.add(orbitalLabel);}
      if(orbitalLabel){orbitalLabel.visible=!!selectedOrbital?.mesh.visible;if(selectedOrbital)orbitalLabel.position.copy(selectedOrbital.mesh.position).addScaledVector(camera.up,selectedOrbital.mesh.scale.x*3);}
      const key=`${orbital.selectedId}:${Math.floor(atMs/30000)}`;
      if(key!==trackKey){trackKey=key;const element=orbital.catalog.elements.find(e=>e.NORAD_CAT_ID===orbital.selectedId);const points=element?orbitTrack(element,atMs):[];const previous=track.geometry;track.geometry=new T.BufferGeometry().setFromPoints(points.map(p=>new T.Vector3(...p)));previous.dispose();track.visible=points.length>1;}
      if(now-orbitTelemetryAt>200){orbitTelemetryAt=now;host.dataset.orbitPositions=JSON.stringify(positions);host.dataset.orbitEpochUtc=new Date(atMs).toISOString();host.dataset.orbitSelected=String(orbital.selectedId);host.dataset.orbitCount=String(positions.length);}
    }else{host.dataset.orbitCount='0';host.dataset.orbitPositions='[]';}

    stars.visible=Number.isFinite(live.epochMs)&&live.epochMs!>=Date.UTC(1972,0,1)&&live.epochMs!<=8.64e15;
    if(stars.visible&&starEpoch!==live.epochMs){
      starEpoch=live.epochMs;
      const a=moonFixedStarDirection(starAxes[0],starEpoch!),b=moonFixedStarDirection(starAxes[1],starEpoch!),c=moonFixedStarDirection(starAxes[2],starEpoch!);
      starBodyRotation.set(a[0],b[0],c[0],a[1],b[1],c[1],a[2],b[2],c[2]);starRotation.multiplyMatrices(starBasis,starBodyRotation);
    }
    host.dataset.starCount=stars.visible?String(BRIGHT_STARS.length):'0';
    if(siteNavigationKey(preparingProps.lat,preparingProps.lon)!==siteNavigationKey(live.lat,live.lon)||preparingProps.terrain!==live.terrain||preparingProps.imagery!==live.imagery||preparingProps.map!==live.map)prepareSurface(live);
    const flightChanged = refreshLiveGeometry(live);
    const contactLive = live as ContactSceneProps;
    const contactState = refreshContact(contactLive);
    const nextKey=siteNavigationKey(live.lat,live.lon);
    if(nextKey!==requestedKey){
      requestedKey=nextKey;canceledGesture=false;
      configureNavigation(live,now,settings.mode==='globe'||sceneToBody(camera.position).length()>3500);
    }
    let sample=navigation.sample(now);
    if(sample&&reducedMotion.matches&&sample.phase!=='complete'){
      configureNavigation(live,now,true);sample=navigation.sample(now);
    }
    if(geographicMotion){
      const motion=geographicMotion,linear=reducedMotion.matches?1:Math.min(1,(now-motion.start)/1500),t=linear*linear*(3-2*linear);
      const direction=new T.Vector3(...shortestArcDirection(tuple(motion.from),tuple(motion.to),t));
      camera.position.copy(bodyToLocal(direction.clone().multiplyScalar(T.MathUtils.lerp(motion.from.length(),motion.to.length(),t))));
      controls.target.copy(bodyToLocal(motion.fromTarget.clone().lerp(new T.Vector3(),t)));
      const up=new T.Vector3(...shortestArcDirection(tuple(motion.fromUp),tuple(motion.toUp),t));up.addScaledVector(direction,-up.dot(direction));
      if(up.lengthSq()<1e-8)up.copy(motion.toUp);camera.up.copy(bodyToLocal(up.normalize(),true));camera.lookAt(controls.target);
      if(linear===1){geographicMotion=null;rebuildControls();}
    }
    const navigating=sample!==null||awaitingHandoff;
    if(!nasaRequested){
      nasaRequested=true;host.dataset.moonModel='loading';onModelStatus('Loading NASA’s original topographic Moon…');
      createNasaGlobe(initial.lat,initial.lon,frame.referenceRadiusM/1000,globeAbort.signal).then(result=>{
        if(disposed){result.dispose();return;}
        nasaGlobe=result;scene.add(result.mesh);if(result.mesh.material.map)renderer.initTexture(result.mesh.material.map);host.dataset.moonModel='ready';onModelStatus('NASA LRO · 1,015,808 original triangles · 8K image');
      }).catch(error=>{if(!globeAbort.signal.aborted){host.dataset.moonModel='error';console.error('NASA Moon model loading failed',error);onModelStatus('NASA model unavailable. Local terrain remains usable; retry 3D to reload.');}});
    }
    if(poiSites!==live.sites)updatePois(live);
    const terrainRangeKm=camera.position.distanceTo(siteRing.position),detail=terrainDetailPolicy(live.terrain,live.lat,live.lon,terrainRangeKm,requestedSurfaceSegments);
    if(detail.segments!==requestedSurfaceSegments&&!navigating){if(!lodChangedAt)lodChangedAt=now;if(now-lodChangedAt>500){lodChangedAt=0;prepareSurface(live,detail.segments);}}else lodChangedAt=0;
    host.dataset.terrainRangeKm=Number.isFinite(terrainRangeKm)?terrainRangeKm.toFixed(4):'';
    host.dataset.terrainSourceSpacingM=detail.spacingM===null?'unavailable':String(detail.spacingM);
    host.dataset.terrainDetail=detail.spacingM===null?'No fine measured DEM at selected point':`Measured DEM sampling ${detail.spacingM.toFixed(1)} m; mesh ${surfaceSegments} angular segments`;
    const globalSurface=(settings.mode==='globe'&&!detail.measuredCloseView)||sceneToBody(camera.position).length()>1850;
    ground.visible=!globalSurface||!nasaGlobe;
    if(nasaGlobe)nasaGlobe.mesh.visible=globalSurface;
    path.visible=travelled.visible=groundTrack.visible=pathVectors.length>1&&!['globe','earth','sun'].includes(settings.mode)&&!navigating;
    let vehicleMassKg: number | null = null;
    if (flightPoints.length) {
      const time = T.MathUtils.clamp(live.flightTime, flightPoints[0].t, flightPoints.at(-1)!.t);
      // Binary search supports backwards scrubbing as well as playback.
      let lo = 0, hi = flightPoints.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (flightPoints[mid].t < time) lo = mid + 1; else hi = mid; }
      currentIndex = lo;
      const b = flightPoints[lo], a = flightPoints[Math.max(0, lo - 1)];
      const f = b.t === a.t ? 0 : (time - a.t) / (b.t - a.t);
      currentPoint.copy(flightVector(a)).lerp(flightVector(b), f);
      vehicleMassKg = T.MathUtils.lerp(a.massKg, b.massKg, f);
      // Powered is a held state from the previous sample, not interpolated.
      plume.visible = time === b.t ? b.powered : a.powered;
      if (time !== lastTime) {
        const completed = pathVectors.slice(0, currentIndex).concat(currentPoint.clone());
        if (completed.length < 2) completed.push(currentPoint.clone());
        travelled.geometry.setPositions(completed.flatMap((v) => [v.x, v.y, v.z]));
        travelled.computeLineDistances();
        lastTime = time;
      }
    } else { currentPoint.copy(siteRing.position); plume.visible = false; }
    const touchdown = contactState.flight?.contact;
    const preparedContact = contactReplay.current;
    const inContact = !!touchdown && live.flightTime >= touchdown.timeS;
    const dynamicsFrame = inContact && preparedContact ? preparedContact.cache.sample(live.flightTime - touchdown!.timeS) : null;
    const rigidReadout = touchdown && dynamicsFrame && preparedContact ? contactReadout(touchdown,preparedContact,dynamicsFrame) : null;
    const contactBasis = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(
      localDirection(new T.Vector3(1,0,0),visualFrame),localDirection(new T.Vector3(0,1,0),visualFrame),localDirection(new T.Vector3(0,0,1),visualFrame)));
    const originLiftM = touchdown ? preparedContact?.liftM ?? 3.515 : 0;
    if (touchdown && dynamicsFrame) currentPoint.copy(flightVector({eastM:touchdown.eastM+dynamicsFrame.position[0],
      northM:touchdown.northM-dynamicsFrame.position[2],yM:touchdown.yM+dynamicsFrame.position[1]}));
    else if (touchdown) currentPoint.addScaledVector(localDirection(new T.Vector3(0,1,0),visualFrame),originLiftM/1000);
    const modelOrigin = currentPoint.clone();
    const vehicleRotation = new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),modelOrigin.clone().sub(moonCentre).normalize());
    if (touchdown && preparedContact) vehicleRotation.copy(contactBasis).multiply(dynamicsFrame ? new T.Quaternion(...dynamicsFrame.rotation) : preparedContact.rotation);
    if (rigidReadout) {
      currentPoint.copy(flightVector(rigidReadout));
      if (dynamicsFrame?.broken) modelOrigin.copy(currentPoint);
    } else if (contactParts) {
      // Descriptors are centred metres; the airborne launch mesh is bottom-based.
      // Use its actual displayed attitude for the COM, including during ascent.
      const centre = new T.Vector3();
      contactParts.descriptors.forEach(part => centre.addScaledVector(new T.Vector3(...part.offset),part.massShare));
      if (!touchdown) centre.y += 3.5;
      currentPoint.addScaledVector(centre.applyQuaternion(vehicleRotation),.001);
    }
    if (inContact) vehicleMassKg = dynamicsFrame?.broken ? dynamicsFrame.fragments.reduce((sum,piece)=>sum+piece.massKg,0) : preparedContact?.massKg ?? touchdown!.massKg;
    if (inContact) plume.visible = false;
    const outcome = contactState.flight?.landingOutcome;
    const outcomeColour = !outcome && !touchdown ? 0xd9b96e : outcome?.state === 'outside-assumed-limits' ? 0xef8b7b : outcome?.state === 'within-assumed-limits' ? 0x9ccaa9 : 0xe3be74;
    path.material.color.setHex(outcomeColour); travelled.material.color.setHex(outcome || touchdown ? outcomeColour : 0xffe5a4); currentRing.material.color.setHex(outcome || touchdown ? outcomeColour : 0xffe5a4);
    const outcomeLabel = outcome?.state === 'outside-assumed-limits' ? '! Outside entered contact limits' : outcome?.state === 'within-assumed-limits' ? '✓ Within entered contact limits' : '? Contact evidence unresolved';
    const unsupportedContact = touchdown ? contactUnsupported(touchdown, contactState.configuration) : null;
    const contactReason = contactPreparationError || unsupportedContact || contactReplay.reason;
    const dynamics = touchdown && inContact ? rigidReadout ? rigidReadout
      : {phase:'unsupported' as const, elapsedContactS:0, speedMps:Math.hypot(...touchdown.velocityMps), verticalMps:touchdown.velocityMps[1],
        eastM:touchdown.eastM,northM:touchdown.northM,yM:touchdown.yM+originLiftM, fragmentCount:0,
        note:`${contactReason || 'Contact replay is preparing; held at impact until ready.'} Impact-state snapshot only; post-contact speed unavailable. ${CONTACT_MODEL_NOTE}`} : null;
    if (now-lastDynamics >= 100) {
      const signature = dynamics ? `${host.dataset.flightRevision}:${dynamics.phase}:${dynamics.elapsedContactS}:${dynamics.note}` : '';
      if ((dynamics || hadDynamics) && signature !== dynamicsSignature) contactLive.onLandingDynamics?.(dynamics);
      dynamicsSignature = signature; hadDynamics = !!dynamics; lastDynamics = now;
    }
    host.dataset.contactReplay = contactReason ? 'unsupported' : contactReplay.status;
    host.dataset.contactFrames = String(preparedContact?.cache.length ?? 0);
    host.dataset.contactCacheBytes = String(preparedContact ? preparedContact.cache.packed.byteLength+preparedContact.cache.flags.byteLength : 0);
    const contactCaption = outcome || touchdown ? `${outcomeLabel} · ${contactReason ? 'Contact preview unavailable; inspect model limits.' : inContact ? dynamics?.phase === 'broken' ? 'Illustrative breakup' : 'Rigid-body contact preview' : preparedContact ? 'Contact replay ready' : 'Preparing contact replay'}` : '';
    contactText.hidden = !contactCaption;
    if (contactCaption !== previousContactText) {contactText.textContent = contactCaption; previousContactText = contactCaption;}
    contactText.title = `${outcome?.reasons.join(' ') ?? ''} ${contactReason} ${preparedContact?.note ?? ''} ${CONTACT_MODEL_NOTE}`;
    const missingRange=(settings.mode==='earth'&&!earth.visible)||(settings.mode==='sun'&&!sun.visible);
    if(missingRange){assetMotion=null;focusedAnchor=null;}
    if (!navigating && !missingRange && (settings.mode !== lastMode || settings.reset !== lastReset || missingFocusRange)) {
      const fromCamera=camera.position.clone(),fromTarget=controls.target.clone(),fromUp=camera.up.clone();
      const sourceCentre=earth.visible&&camera.position.distanceTo(earth.position)<camera.position.distanceTo(moonCentre)?earth.position.clone():sun.visible&&camera.position.distanceTo(sun.position)<camera.position.distanceTo(moonCentre)?sun.position.clone():moonCentre.clone();
      const focusWasMoving=assetMotion!==null;
      assetMotion=null;focusedAnchor=null;geographicMotion=null;
      controls.enabled = true;
      allowFullPolarOrbit(controls);
      controls.minDistance = settings.mode === "surface" ? 0.001 : 0.006;
      if (settings.mode === "flight") fit(flightBounds);
      if (settings.mode === "orbit") {
        camera.up.copy(localDirection(new T.Vector3(0,1,0),siteFrame(surfaceProps.lat,surfaceProps.lon,0)));
        controls.target.copy(siteRing.position);
        camera.position.copy(controls.target).add(localDirection(new T.Vector3(...contextCameraOffset(surfaceProps)), siteFrame(surfaceProps.lat,surfaceProps.lon,0)));
      }
      if(settings.mode==='sun'||settings.mode==='earth'){
        const object=settings.mode==='sun'?sun:earth,radius=ASSET_RADII_KM[settings.mode];
        if(object.visible){controls.target.copy(object.position);camera.up.set(0,1,0);camera.position.copy(controls.target).addScaledVector(new T.Vector3(.2,.35,1).normalize(),framingDistanceKm(radius,camera.aspect,camera.fov));}
      }
      if(settings.mode==='globe'){
        controls.target.set(0,-frame.referenceRadiusM/1000,0);
        camera.position.copy(controls.target).add(new T.Vector3(1200,4500,2800));
      }
      if (settings.mode === "surface") {
        const destination = siteFrame(surfaceProps.lat,surfaceProps.lon,0);
        camera.up.copy(localDirection(new T.Vector3(0,1,0),destination));
        camera.position.copy(siteRing.position).add(localDirection(new T.Vector3(0,0.003,0),destination));
        controls.target.copy(camera.position).add(localDirection(new T.Vector3(0,0.8,-10),destination));
      }
      if (settings.mode === "follow" || settings.mode === "vehicle") {
        controls.target.copy(currentPoint);
        camera.up.copy(localDirection(new T.Vector3(0,1,0),visualFrame));
        camera.position.copy(currentPoint).add(localDirection(followOffset,visualFrame));
        followPosition = currentPoint.clone();
      } else followPosition = null;
      const trackingTransfer = !focusWasMoving && lastMode !== settings.mode &&
        (lastMode === 'vehicle' || lastMode === 'follow') &&
        (settings.mode === 'vehicle' || settings.mode === 'follow');
      if (trackingTransfer) {
        // A local tracking change keeps the user's viewing offset. The
        // celestial transfer planner otherwise sends this metre-scale move
        // thousands of kilometres around the Moon before returning.
        camera.position.copy(fromCamera).add(currentPoint.clone().sub(fromTarget));
        controls.target.copy(currentPoint); camera.up.copy(fromUp);
      } else if(lastMode!==undefined){
        const toCamera=camera.position.clone(),toTarget=controls.target.clone();
        const toCentre=settings.mode==='earth'&&earth.visible?earth.position.clone():settings.mode==='sun'&&sun.visible?sun.position.clone():moonCentre.clone();
        assetMotion={plan:{startMs:now,fromCamera:tuple(fromCamera),fromTarget:tuple(fromTarget),fromCentre:tuple(sourceCentre),toCamera:tuple(toCamera),toTarget:tuple(toTarget),toCentre:tuple(toCentre),clearanceKm:Math.max(globeMinimumRadiusKm(nasaGlobe?.maxRadiusKm??1770)*3.5,toCamera.distanceTo(toCentre)*1.2)},fromUp,toUp:camera.up.clone(),anchor:toTarget.clone(),mode:settings.mode};
        camera.position.copy(fromCamera);controls.target.copy(fromTarget);camera.up.copy(fromUp);
      } else if(settings.mode==='earth'&&earth.visible) focusedAnchor=earth.position.clone();
      // OrbitControls caches object.up in its constructor. Every preset may
      // change that axis; recreate controls while retaining the exact pose.
      rebuildControls();
      lastMode = settings.mode; lastReset = settings.reset;
    }
    // Rebase an in-progress vehicle focus from its current pose when edited
    // inputs move the target. Scaling the new drift into the old plan jumps a frame.
    if (flightChanged && assetMotion && (assetMotion.mode === 'vehicle' || assetMotion.mode === 'follow')) {
      const motion = assetMotion;
      const offset = new T.Vector3(...motion.plan.toCamera).sub(new T.Vector3(...motion.plan.toTarget));
      const source = earth.visible && camera.position.distanceTo(earth.position)<camera.position.distanceTo(moonCentre) ? earth.position
        : sun.visible && camera.position.distanceTo(sun.position)<camera.position.distanceTo(moonCentre) ? sun.position : moonCentre;
      assetMotion = {...motion, fromUp:camera.up.clone(), anchor:currentPoint.clone(), plan:{...motion.plan,
        startMs:now, fromCamera:tuple(camera.position), fromTarget:tuple(controls.target), fromCentre:tuple(source),
        toCamera:tuple(currentPoint.clone().add(offset)), toTarget:tuple(currentPoint), toCentre:tuple(moonCentre)}};
    }
    missingFocusRange=missingRange;
    if (!navigating && !assetMotion && (settings.mode === "follow"||settings.mode === "vehicle") && followPosition) {
      // Translate both ends by the same physical COM displacement, including
      // edited paths and backwards scrubs. An unchanged refresh has zero delta.
      const delta = currentPoint.clone().sub(followPosition);
      camera.position.add(delta); controls.target.add(delta);
      followPosition.copy(currentPoint);
    }
    if(sample){
      camera.position.copy(bodyToLocal(new T.Vector3(...sample.camera)));
      controls.target.copy(bodyToLocal(new T.Vector3(...sample.target)));
      const direction=new T.Vector3(...sample.camera).normalize();
      const transported=tangentUp.clone().applyQuaternion(new T.Quaternion().setFromUnitVectors(fromDirection,direction));
      const up=sample.phase==='zoom-out'?fromUp.clone().lerp(tangentUp,sample.progress):sample.phase==='zoom-in'||sample.phase==='complete'?transported.lerp(destinationUp,sample.progress):transported;
      camera.up.copy(bodyToLocal(up.normalize(),true));camera.lookAt(controls.target);
      status(sample.phase==='zoom-out'?"Zooming out from the current lunar site.":sample.phase==='rotate'?"Moving around the Moon to the selected site.":sample.phase==='zoom-in'?"Approaching the selected lunar site.":"Selected lunar site reached.");
      if(sample.phase==='complete'){
        const retain = retainCameraAfterSiteArrival(navigationCamera, settings);
        if (!retain) onSiteMode();
        navigation.cancel();allowFullPolarOrbit(controls);controls.minDistance=.006;rebuildControls();lastMode="orbit";lastReset=retain?-1:settings.reset;
      }
    }
    if(assetMotion){
      const motion=assetMotion,position=sampleAssetFlight(motion.plan,now,reducedMotion.matches);
      const anchor=motion.mode==='earth'?earth.position:motion.mode==='sun'?sun.position:motion.mode==='vehicle'||motion.mode==='follow'?currentPoint:motion.anchor;
      const drift=anchor.clone().sub(motion.anchor);
      // Ramp target drift from zero so rapid retargeting starts at the exact pose.
      camera.position.fromArray(position.camera).addScaledVector(drift,position.progress);controls.target.fromArray(position.target).addScaledVector(drift,position.progress);
      camera.up.fromArray(shortestArcDirection(tuple(motion.fromUp),tuple(motion.toUp),position.progress));camera.lookAt(controls.target);
      host.dataset.assetFlight=position.complete?'complete':'traveling';
      if(position.complete){assetMotion=null;focusedAnchor=anchor.clone();followPosition=currentPoint.clone();rebuildControls();}
    } else if(!navigating&&(settings.mode==='earth'||settings.mode==='sun')){
      const object=settings.mode==='earth'?earth:sun;
      if(object.visible){if(focusedAnchor){camera.position.add(object.position.clone().sub(focusedAnchor));controls.target.add(object.position.clone().sub(focusedAnchor));}focusedAnchor=object.position.clone();}
    }
    host.dataset.focusRange=missingRange?'unavailable':'ready';
    host.dataset.assetFlight=assetMotion?'traveling':'idle';
    // Keep the camera above the displayed terrain/reference surface, including
    // after pointer pan/orbit and when a close follow passes a mountain.
    const centre = moonCentre;
    const radial = camera.position.clone().sub(centre);
    const cameraGround = radial.length()<2500?toGround(camera.position).point:null;
    const minRadius = !navigating&&!assetMotion&&settings.mode==='globe'&&globalSurface ? globeMinimumRadiusKm(nasaGlobe?.maxRadiusKm ?? 1770) : cameraGround?cameraGround.distanceTo(centre) + 0.002:0;
    controls.enablePan = !['sun','earth'].includes(settings.mode);
    if(!navigating&&!assetMotion&&(settings.mode==='sun'||settings.mode==='earth')){const object=settings.mode==='earth'?earth:sun;controls.minDistance=object.visible&&controls.target.distanceTo(object.position)<1?ASSET_RADII_KM[settings.mode]*1.02:.006;}
    // Orbit target may be panned off-centre: target-distance is not body radius.
    if(!navigating&&settings.mode==='globe') controls.minDistance=.006;
    if (radial.length()<2500 && radial.length() < minRadius) camera.position.fromArray(outsideSphere(camera.position.toArray(),centre.toArray(),minRadius));
    if(!navigating&&!geographicMotion&&!assetMotion)controls.update();
    // Wheel/pinch control updates must also respect the actual physical sphere.
    if(!navigating&&!assetMotion&&settings.mode==='globe') { camera.position.fromArray(outsideSphere(camera.position.toArray(),centre.toArray(),minRadius));camera.lookAt(controls.target); }
    host.dataset.globeMinimumRadiusKm=String(globeMinimumRadiusKm(nasaGlobe?.maxRadiusKm??1770));
    host.dataset.zoomEnabled=String(controls.enableZoom);host.dataset.panEnabled=String(controls.enablePan);host.dataset.rotateEnabled=String(controls.enableRotate);
    lander.position.copy(modelOrigin);
    const craftUp = currentPoint.clone().sub(centre).normalize();
    lander.quaternion.copy(vehicleRotation);
    if (contactModel) {contactModel.position.y = touchdown ? -3.5 : 0; contactModel.visible = !dynamicsFrame?.broken;}
    contactPieces.position.copy(touchdown ? flightVector(touchdown) : currentPoint); contactPieces.quaternion.copy(contactBasis);
    contactPieces.visible = !!dynamicsFrame?.broken && !['globe','earth','sun'].includes(settings.mode) && !navigating;
    if (contactParts) contactParts.objects.forEach((object,index) => {
      const piece = dynamicsFrame?.fragments[index]; object.visible = !!piece;
      if (piece) {object.position.fromArray(piece.position); object.quaternion.fromArray(piece.rotation);}
    });
    // NASA mesh is normalized to nominal metres; world units are kilometres.
    // Camera distance changes perspective only, never the spacecraft's dimensions.
    const distance=Math.max(.001,camera.position.distanceTo(currentPoint));
    const kmPerPixel=2*distance*Math.tan(T.MathUtils.degToRad(camera.fov/2))/Math.max(1,host.clientHeight);
    const scale=1;
    lander.scale.setScalar(.001);
    host.dataset.vehicleScale=String(lander.scale.x*1000);
    host.dataset.cameraMode=settings.mode;
    lander.traverse(object=>{if(object instanceof T.Mesh)object.castShadow=true;});
    const ringRadiusKm = kmPerPixel * 7;
    currentRing.position.copy(currentPoint).addScaledVector(craftUp, scale * 0.0023);
    currentRing.quaternion.copy(camera.quaternion);
    currentRing.scale.setScalar(ringRadiusKm);
    currentRing.visible = currentLabel.visible = flightPoints.length > 0 && !['globe','earth','sun'].includes(settings.mode)&&settings.mode!=='follow'&&settings.mode!=='vehicle'&&!navigating;
    lander.visible=!['globe','earth','sun'].includes(settings.mode)&&!navigating;
    currentLabel.position.copy(currentRing.position);
    currentLabel.position.addScaledVector(camera.up, ringRadiusKm * 1.8);
    const groundPoint = toGround(currentPoint);
    const dropPositions = dropLine.geometry.getAttribute("position");
    dropPositions.setXYZ(0, currentPoint.x, currentPoint.y, currentPoint.z);
    dropPositions.setXYZ(1, groundPoint.point.x, groundPoint.point.y, groundPoint.point.z);
    dropPositions.needsUpdate = true;
    dropLine.geometry.computeBoundingSphere();
    dropLine.computeLineDistances();
    dropLine.visible = flightPoints.length > 0 && settings.mode !== "surface" && !['globe','earth','sun'].includes(settings.mode)&&!navigating;
    const siteDistance = camera.position.distanceTo(siteRing.position);
    siteRing.scale.setScalar(Math.max(0.03, siteDistance * 0.003));
    siteLabel.visible = settings.guides && settings.mode !== "surface" && settings.mode !== "follow" && !['globe','earth','sun'].includes(settings.mode)&&!navigating;
    siteRing.visible = !['globe','earth','sun','follow','vehicle','surface'].includes(settings.mode)&&!navigating&&terrainRangeKm>5;
    axes.visible = settings.guides && settings.mode !== "surface" && settings.mode !== "follow" && !['globe','earth','sun'].includes(settings.mode)&&!navigating;
    tickLabels.forEach((tick) => { tick.visible = settings.mode === "flight"&&!navigating; });
    horizon.visible = settings.horizon && settings.mode === "surface"&&!navigating;
    const liveFrame=siteFrame(live.lat,live.lon,0);
    const sunDir = liveSky(live,live.pose.sunAz, live.pose.sunEl);
    fill.intensity = settings.inspection ? 1.0 : 0.18;
    host.dataset.lunarAppearance='neutral-linear-rec709-v1';
    host.dataset.lightingMode=settings.inspection?'atlas':'epoch';
    surfaceMaterial.setAtlasAppearance(settings.inspection);
    nasaGlobe?.setAtlasAppearance(settings.inspection);
    inspectionLight.visible = settings.inspection;
    // Stable site-relative illumination for coloured equipment; never a camera lamp.
    inspectionLight.position.copy(currentPoint).add(localDirection(new T.Vector3(-8,14,5),liveFrame));
    inspectionLight.target.position.copy(currentPoint);
    const sunRadius=sun.visible?ASSET_RADII_KM.sun:0,earthRadius=earth.visible?ASSET_RADII_KM.earth:0;
    stationRoot.visible=settings.mode==='earth'&&earth.visible&&registeredReady;
    if(celestialAssets.earth)celestialAssets.earth.group.visible=!stationRoot.visible;
    for(const pin of stationPins){
      const view=camera.position.clone().sub(earth.position),distance=view.length();
      pin.mesh.visible=stationRoot.visible&&pin.direction.dot(view.normalize())>ASSET_RADII_KM.earth/Math.max(1,distance);
      const pixelKm=2*camera.position.distanceTo(pin.mesh.position.clone().add(earth.position))*Math.tan(T.MathUtils.degToRad(camera.fov/2))/Math.max(1,host.clientHeight);
      pin.mesh.scale.setScalar(Math.max(10,pixelKm*6));
    }
    host.dataset.stationInspection=String(stationRoot.visible);
    host.dataset.visibleStations=JSON.stringify(stationPins.filter(pin=>pin.mesh.visible).map(pin=>{const screen=pin.mesh.position.clone().add(earth.position).project(camera);return{id:pin.station.id,latitudeDeg:pin.station.latitudeDeg,longitudeEastDeg:pin.station.longitudeEastDeg,x:(screen.x+1)*host.clientWidth/2,y:(1-screen.y)*host.clientHeight/2};}));
    sunLabel.visible=sun.visible;earthLabel.visible=earth.visible;
    sunLabel.position.copy(sun.position).add(new T.Vector3(0,sunRadius*1.8,0));
    earthLabel.position.copy(earth.position).add(new T.Vector3(0,earthRadius*1.8,0));
    // Directional light retains the supplied site azimuth/elevation, including
    // below-horizon positions; no artificial night-time Sun is introduced.
    const shadowTarget = (settings.mode === "follow"||settings.mode==="vehicle") ? groundPoint.point : new T.Vector3();
    sunlight.target.position.copy(shadowTarget);
    sunlight.position.copy(shadowTarget).addScaledVector(sunDir, 800);
    const shadowHalfSpanKm = settings.mode === "follow" || settings.mode === "vehicle" || settings.mode === "surface" ? 1.5 : settings.mode === "orbit" ? 28 : Math.min(500, Math.max(35, flightExtentKm * 0.6));
    const shadowCamera = sunlight.shadow.camera;
    if (shadowCamera.right !== shadowHalfSpanKm) {
      shadowCamera.left = shadowCamera.bottom = -shadowHalfSpanKm;
      shadowCamera.right = shadowCamera.top = shadowHalfSpanKm;
      shadowCamera.updateProjectionMatrix();
    }
    sunlight.shadow.normalBias = shadowHalfSpanKm * 0.00008;
    const physicalCamera=sceneToBody(camera.position),bodyDirection=physicalCamera.clone().normalize();
    const showPois=!navigating&&['globe','orbit'].includes(settings.mode);
    for(const item of poiRecords){
      item.mesh.visible=showPois&&item.direction.dot(bodyDirection)>Math.min(.9999,1737.4/physicalCamera.length());
      const pixelKm=2*camera.position.distanceTo(item.mesh.position)*Math.tan(T.MathUtils.degToRad(camera.fov/2))/Math.max(1,host.clientHeight);
      item.mesh.scale.setScalar(pixelKm*(item.site.id===live.selectedSiteId?7:5));item.mesh.material.color.setHex(item.site.id===live.selectedSiteId?0xe8b950:0xfff7df);
    }
    const poi=poiRecords.find(item=>item.site.id===(hoveredId??live.selectedSiteId)&&item.mesh.visible);
    const poiText=poi?.site.name??'';
    if(poiText!==lastPoiLabel){if(poiLabel){scene.remove(poiLabel);poiLabel.material.map?.dispose();poiLabel.material.dispose();}poiLabel=poi?label(poiText):null;if(poiLabel){poiLabel.material.depthTest=false;poiLabel.renderOrder=21;scene.add(poiLabel);}lastPoiLabel=poiText;}
    if(poiLabel&&poi){poiLabel.position.copy(poi.mesh.position).addScaledVector(camera.up,poi.mesh.scale.x*3);poiLabel.visible=showPois;}
    for(const node of host.parentElement?.querySelectorAll<HTMLButtonElement>('[data-globe-label]')??[]){const id=node.dataset.globeLabel,poi=poiRecords.find(p=>p.site.id===id);const point=poi?.mesh.position??((id==='nav-north-pole'||id==='nav-south-pole')?bodyToLocal(new T.Vector3(...geographicBodyVector(id==='nav-north-pole'?90:-90,0)).multiplyScalar(1740)):null);if(point){const screen=point.clone().project(camera),translate=`${(screen.x+1)*host.clientWidth/2}px ${(1-screen.y)*host.clientHeight/2}px`;if(node.style.translate!==translate)node.style.translate=translate;}}
    host.dataset.visiblePoiCount=String(poiRecords.filter(item=>item.mesh.visible).length);
    host.dataset.visiblePois=JSON.stringify(poiRecords.filter(item=>item.mesh.visible).map(item=>{const screen=item.mesh.position.clone().project(camera);return {id:item.site.id,name:item.site.name,lat:item.site.lat,lon:item.site.lon,x:(screen.x+1)*host.clientWidth/2,y:(1-screen.y)*host.clientHeight/2};}));
    cameraOffset.copy(camera.position).sub(controls.target);
    const clipBodies=[{centreKm:tuple(moonCentre),radiusKm:nasaGlobe?.maxRadiusKm??1770}];
    if(earth.visible)clipBodies.push({centreKm:tuple(earth.position),radiusKm:ASSET_RADII_KM.earth});
    if(sun.visible)clipBodies.push({centreKm:tuple(sun.position),radiusKm:ASSET_RADII_KM.sun});
    const clips=assetClipPlanes(tuple(camera.position),clipBodies,cameraOffset.length());camera.near=clips.near;camera.far=clips.far;
    // Frame the real decoded vehicle in the measured visible, empty canvas.
    // Keep the unexpanded control pose: debris pullback exists only for this render.
    const unexpandedCameraPosition = camera.position.clone();
    const framingRoot = live.framingRoot ?? host.closest<HTMLElement>(".lunar-app") ?? host.parentElement ?? host;
    if (!occlusion || framingRoot !== occlusionRoot || live.framingOccluderSelector !== occlusionSelector) {
      occlusion?.dispose(); occlusionRoot = framingRoot; occlusionSelector = live.framingOccluderSelector;
      occlusion = observeSceneOcclusion(host, framingRoot, occlusionSelector);
    }
    let safe: ScreenRect | null = null;
    let framingBounds: ScreenRect | null = null;
    let framingStatus = 'inactive';
    if ((settings.mode === 'vehicle' || settings.mode === 'follow') && !navigating) {
      lander.updateWorldMatrix(true,true); contactPieces.updateWorldMatrix(true,true);
      let points: T.Vector3[];
      if (dynamicsFrame?.broken && contactParts) {
        points = contactParts.objects.flatMap((object,index) => object.visible ? boxCorners(fragmentBoundsM[index],object.matrixWorld) : []);
      } else {
        const bound = vehicleBoundsM.clone();
        // Cached bounds are centred for contact; airborne geometry has its base at zero.
        if (contactModel) bound.translate(new T.Vector3(0,contactModel.position.y+3.5,0));
        points = boxCorners(bound,lander.matrixWorld);
      }
      if (dynamicsFrame?.broken) {
        pullBackForDebris(camera,points,controls.target,{centre:moonCentre,radiusAt:point=>toGround(point).point.distanceTo(moonCentre)});
        const fittedClips=assetClipPlanes(tuple(camera.position),clipBodies,camera.position.distanceTo(controls.target));
        camera.near=fittedClips.near;camera.far=fittedClips.far;
      }
      camera.clearViewOffset(); camera.zoom = 1; camera.updateProjectionMatrix();
      const width = Math.max(1,host.clientWidth), height = Math.max(1,host.clientHeight);
      const projected = projectedBounds(camera,points,width,height);
      if (projected) {
        const halfX = Math.max(Math.abs(projected.left-width/2),Math.abs(projected.right-width/2));
        const halfY = Math.max(Math.abs(projected.top-height/2),Math.abs(projected.bottom-height/2));
        safe = occlusion.measure(halfX/Math.max(1e-9,halfY));
      } else safe = occlusion.measure();
      const framed = frameVehicle(camera,points,width,height,safe);
      framingBounds = framed.bounds; framingStatus = framed.status;
    } else {
      safe = occlusion.measure();
      camera.clearViewOffset(); camera.zoom = 1; camera.updateProjectionMatrix();
    }
    host.dataset.vehicleFraming = framingStatus;
    host.dataset.vehicleScreenBounds = framingBounds ? JSON.stringify(framingBounds) : '';
    host.dataset.unoccludedCanvas = safe ? JSON.stringify(safe) : '';
    // Telemetry describes the fitted render, never the restored control pose.
    host.dataset.cameraPosition=camera.position.toArray().join(',');
    host.dataset.cameraTarget=controls.target.toArray().join(',');
    host.dataset.vehicleCameraDistanceKm=String(camera.position.distanceTo(currentPoint));
    host.dataset.cameraBodyRadiusKm=String(camera.position.distanceTo(moonCentre));
    host.dataset.cameraNearKm=String(camera.near);host.dataset.cameraFarKm=String(camera.far);
    host.dataset.framingProjectionZoom = String(camera.zoom);
    const geographic=cameraBodyGeography(tuple(sceneToBody(camera.position)),poleMeridian);
    if(geographic&&now-lastGeographicReadout>150){
      const north=bodyToLocal(new T.Vector3(...geographicNorthVector(geographic.latDeg,geographic.lonDeg)),true);
      const right=new T.Vector3(1,0,0).applyQuaternion(camera.quaternion),screenUp=new T.Vector3(0,1,0).applyQuaternion(camera.quaternion);
      const nx=north.dot(right),ny=north.dot(screenUp);
      const angle=Math.hypot(nx,ny)>1e-6?Math.atan2(nx,ny)*180/Math.PI:undefined;
      host.dataset.viewLatitude=String(geographic.latDeg);host.dataset.viewLongitude=String(geographic.lonDeg);host.dataset.screenNorthAngle=angle===undefined?'':String(angle);
      const labels:Array<{id:string;name:string;x:number;y:number;lat:number;lon:number;pole?:boolean}>=[];
      if(showPois){
        for(const pole of [{id:'nav-north-pole',name:'North pole · 90°N',lat:90},{id:'nav-south-pole',name:'South pole · 90°S',lat:-90}]){const direction=new T.Vector3(...geographicBodyVector(pole.lat,0));if(direction.dot(bodyDirection)>Math.min(.9999,1737.4/physicalCamera.length())){const screen=bodyToLocal(direction.multiplyScalar(1740)).project(camera);if(screen.z>-1&&screen.z<1)labels.push({...pole,lon:0,pole:true,x:(screen.x+1)*host.clientWidth/2,y:(1-screen.y)*host.clientHeight/2});}}
        for(const item of [...poiRecords].sort((a,b)=>Number(b.site.id===live.selectedSiteId)-Number(a.site.id===live.selectedSiteId))){if(!item.mesh.visible)continue;const screen=item.mesh.position.clone().project(camera),x=(screen.x+1)*host.clientWidth/2,y=(1-screen.y)*host.clientHeight/2;if(screen.z<=-1||screen.z>=1||x<16||x>host.clientWidth-16||y<16||y>host.clientHeight-16||labels.some(l=>Math.abs(l.x-x)<145&&Math.abs(l.y-y)<36))continue;labels.push({id:item.site.id,name:item.site.name,x,y,lat:item.site.lat,lon:item.site.lon});if(labels.length>=8)break;}
      }
      host.dataset.globeLabels=JSON.stringify(labels);
      onGeography({...geographic,screenNorthAngleDeg:angle,hoveredId,labels});lastGeographicReadout=now;
    }
    camera.updateProjectionMatrix();
    if (now - lastReadout >= 160) {
      const signature = `${scale.toFixed(1)}:${groundPoint.coverage}:${live.flightTime}:${visualSite}:${host.dataset.flightRevision}`;
      if (signature !== readoutSignature) {
        onReadout({ vehicleScale: scale, currentCoverage: groundPoint.coverage, timeSeconds: live.flightTime,
          eastKm: currentPoint.clone().sub(bodyToLocal(visualFrame.up.clone().multiplyScalar(visualFrame.referenceRadiusM/1000))).dot(localDirection(new T.Vector3(1,0,0),visualFrame)),
          northKm: currentPoint.clone().sub(bodyToLocal(visualFrame.up.clone().multiplyScalar(visualFrame.referenceRadiusM/1000))).dot(localDirection(new T.Vector3(0,0,-1),visualFrame)),
          tangentUpKm: currentPoint.clone().sub(bodyToLocal(visualFrame.up.clone().multiplyScalar(visualFrame.referenceRadiusM/1000))).dot(localDirection(new T.Vector3(0,1,0),visualFrame)) });
        readoutSignature = signature;
      }
      lastReadout = now;
    }
    // Render-relative origin only: persistent geometry, controls and physical state
    // keep their exact coordinates. Restore before events/raycasting can observe it.
    // Picking uses the fitted view even though OrbitControls retains its base pose.
    pickingCamera.copy(camera);pickingCamera.updateMatrixWorld(true);
    const renderOrigin=camera.position.clone();
    try {scene.position.copy(renderOrigin).negate();camera.position.set(0,0,0);renderer.render(scene,camera);}
    catch (error) { console.error("Lunar scene rendering failed.", error); onContextLost(); dispose(); return; }
    finally{scene.position.set(0,0,0);camera.position.copy(unexpandedCameraPosition);scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);}
    if (shaderFailed) { onContextLost(); dispose(); return; }
    const nextClearanceKey = dynamicsFrame ? `contact:${dynamicsFrame.timeS}` : `${modelOrigin.toArray()},${vehicleRotation.toArray()}`;
    if (preparedContact !== clearanceReplay || nextClearanceKey !== clearanceKey) {
      clearanceReplay = preparedContact; clearanceKey = nextClearanceKey;
      const inverseBasis = contactBasis.clone().invert();
      const clearancePose = dynamicsFrame ?? (touchdown && preparedContact ? {
        position:modelOrigin.clone().sub(flightVector(touchdown)).applyQuaternion(inverseBasis).multiplyScalar(1000).toArray(),
        rotation:inverseBasis.multiply(vehicleRotation).toArray(),broken:false,fragments:[],
      } : null);
      terrainClearanceM = preparedContact?.terrain && clearancePose ? minimumProxyTerrainClearance(preparedContact.terrain,preparedContact.cache.parts,clearancePose) : null;
    }
    // Observations of this completed render only. A broken assembly has no single
    // rigid attitude; do not substitute fragment zero's quaternion for the vehicle.
    host.dataset.vehicleWorldPosition = contactParts ? currentPoint.toArray().join(',') : '';
    host.dataset.vehicleQuaternion = contactModel && !dynamicsFrame?.broken ? lander.quaternion.toArray().join(',') : '';
    host.dataset.vehicleVisible = String(!!(lander.visible && contactModel?.visible || contactPieces.visible && contactParts?.objects.some(object=>object.visible)));
    host.dataset.landingContact = touchdown ? JSON.stringify(touchdown) : '';
    host.dataset.landingDynamics = dynamics ? JSON.stringify(dynamics) : '';
    host.dataset.landingFragmentCount = String(dynamicsFrame?.fragments.length ?? 0);
    host.dataset.landingMassKg = vehicleMassKg !== null && Number.isFinite(vehicleMassKg) ? String(vehicleMassKg) : '';
    host.dataset.terrainClearanceM = terrainClearanceM !== null && Number.isFinite(terrainClearanceM) ? String(terrainClearanceM) : '';
    host.dataset.flightTimeS = String(live.flightTime);
    host.dataset.landingContactTimeS = touchdown ? String(touchdown.timeS) : '';
    host.dataset.landingContactFrameIndex = dynamicsFrame ? String(Math.round(dynamicsFrame.timeS / CONTACT_STEP_S)) : '';
    host.dataset.landingContactFrameTimeS = touchdown && dynamicsFrame ? String(touchdown.timeS+dynamicsFrame.timeS) : '';
    host.dataset.renderFrame = String(++renderFrame);
    animationFrame = requestAnimationFrame(render);
  };
  animationFrame = requestAnimationFrame(render);
  return Object.assign(dispose,{capture:()=>capture(),navigateGeography,stepLongitude,inspectStation,inspectSatellite,isNavigating:()=>navigation.sample(performance.now())!==null||awaitingHandoff||geographicMotion!==null||assetMotion!==null});
  } catch (error) { dispose(); throw error; }
}
