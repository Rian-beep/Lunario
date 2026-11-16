"use client";
import { useEffect, useId, useRef, useState } from "react";
import { afterPaint } from "@/lib/after-paint";
import { createPortal } from "react-dom";
import type { LandingDynamicsReadout } from "@/lib/landing-contract";
import {PublicStationStory} from "./public-exploration";
import { StationWeather } from "./station-weather";
import {EarthOrbits} from './earth-orbits';
import orbitSnapshot from '@/public/data/orbits/catalog.json';
import {catalogEpoch,parseOrbitCatalog,type OrbitLayerState} from '@/lib/orbits';
import { HeaderLeanDropdown } from "./header-lean-dropdown";
import { physicalAsset, type AssetFocus } from "@/lib/asset-focus";
import { DSN_STATIONS, DSN_SOURCES, DSN_GEOMETRY_STATUS } from "@/lib/dsn";
import {heightAt,type TerrainData } from "@/lib/terrain";
import type { FlightResult } from "@/lib/flight";
import type { TerrainChoice } from "@/lib/astro";
import type { ImageryData } from "@/lib/imagery";
import {GlobeNavigation} from "./globe-navigation";
import type { Site, MapMeta } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Crosshair, Eye, Orbit, RotateCcw, Scan } from "lucide-react";
import { Info } from "./info";
import { CELESTIAL_ASSETS } from "@/lib/celestial-assets";
import { LANDER_ASSET } from "@/lib/equipment";
import { siteNavigationKey, reconcileSiteHandoff } from "@/lib/site-transition";
import { mountScene, type SceneCameraHandoff, type CameraMode, type CameraSettings, type Readout } from "./scene/runtime";
import { CesiumMoonCloseup } from "./cesium-moon-closeup";

type Pose = { sunAz: number; sunEl: number; earthAz: number; earthEl: number };
export type SceneProps = {
  ionAccessToken?:string;
  onIonCredits?:(credits:string[])=>void;
  assetFocus?: AssetFocus;
  controlsTarget?: HTMLElement | null;
  /** Scope containing the actual floating panels; defaults to the closest app. */
  framingRoot?: HTMLElement | null;
  /** Additional/current panel selectors; defaults include data-scene-occluder. */
  framingOccluderSelector?: string;
  focusRequestId?: number;
  followRequest?: { id: number; focusRequestId: number };
  onTrackingReady?: (ready: boolean) => void;
  flightPlaying?: boolean;
  landingConfiguration?: import('@/lib/landing-contract').LandingConfiguration;
  onLandingDynamics?: (value: LandingDynamicsReadout | null) => void;
  audienceMode?: 'public' | 'teach' | 'plan';
  siteEarthContact?: boolean | null;
  offline?: boolean;
  onAssetFocusChange?: (focus: AssetFocus) => void;
  onInspectTouchdown?: () => void;
  earthBodyKm?: readonly [number,number,number];
  sunBodyKm?: readonly [number,number,number];
  onPlace?:(lat:number,lon:number)=>void;
  earthRangeKm?: number;
  sunRangeKm?: number;
  /** UTC Unix milliseconds for the approximate IAU_MOON star background. */
  epochMs?: number;
  orbits?:OrbitLayerState;
  onSelectOrbital?:(id:number)=>void;
  imagery?: ImageryData | null;
  map: MapMeta;
  sites?:readonly Site[];
  selectedSiteId?:string;
  onSelectSite?:(id:string)=>void;
  terrain: TerrainData | null;
  lat: number;
  lon: number;
  pose: Pose;
  sunAngularRadiusDeg?:number;
  earthAngularRadiusDeg?:number;
  horizon: TerrainChoice;
  flight: FlightResult | null;
  flightTime: number;
  showFlight: boolean;
  /** Same reference elevation used by simulateFlight; needed if DEM is absent. */
  referenceHeightM?: number;
};

const bundledOrbits=parseOrbitCatalog(orbitSnapshot);
export function LunarScene(props: SceneProps) {
  const [orbits,setOrbits]=useState<OrbitLayerState>(()=>({catalog:bundledOrbits,atMs:catalogEpoch(bundledOrbits),enabled:true,selectedId:66303,rate:0,startedPerf:0}));
  const [orbitRequest,setOrbitRequest]=useState(0);
  const host = useRef<HTMLDivElement>(null);

  const runtime = useRef<ReturnType<typeof mountScene> | null>(null);
  const mounted = useRef<SceneProps | null>(null);
  const mountedRevision=useRef({revision:-1,retry:-1});
  const transfer = useRef<SceneCameraHandoff | null>(null);
  const [revision, setRevision] = useState(0);
  const [navigationStatus, setNavigationStatus] = useState("");
  const [ionToken,setIonToken]=useState("");
  const [ionCredits,setIonCredits]=useState<string[]>([]);
  const [ionDraft,setIonDraft]=useState("");
  const live = useRef(props);
  live.current = {...props,ionAccessToken:ionToken,onIonCredits:setIonCredits,orbits,onSelectOrbital:id=>{setOrbits(v=>({...v,selectedId:id}));setOrbitRequest(v=>v+1);}};
  const descriptionId = useId();
  const [error, setError] = useState<string | null>(null);
  const [textureFailed, setTextureFailed] = useState(false);
  const [mode, setMode] = useState<CameraMode | "auto">("auto");
  const [localFocus, setLocalFocus] = useState<AssetFocus>("moon");
  const [stationDetailsRequest,setStationDetailsRequest]=useState(0);
  const selectStation=(id:string|null)=>{setStationId(id);if(id)setStationDetailsRequest(v=>v+1);};
  const [stationId, setStationId] = useState<string | null>(null);
  const focus = props.assetFocus ?? localFocus;
  const focusRef = useRef(focus);
  const focusSerial = useRef(props.focusRequestId);
  const [horizon, setHorizon] = useState(false);
  const [inspection, setInspection] = useState(true);
  const [guides,setGuides]=useState(false);
  const [mapLabels,setMapLabels]=useState(true);
  const [showReadout,setShowReadout]=useState(false);
  const [reset, setReset] = useState(0);
  const [retry, setRetry] = useState(0);
  const [geography,setGeography]=useState<{latDeg:number;lonDeg:number;screenNorthAngleDeg?:number;hoveredId?:string;labels?:Array<{id:string;name:string;x:number;y:number;lat:number;lon:number;pole?:boolean;farSide?:boolean;offscreen?:boolean}>}>({latDeg:props.lat,lonDeg:props.lon});
  const [surfaceStatus,setSurfaceStatus]=useState('');
  const [detailStatus,setDetailStatus]=useState('Canonical terrain context. Visual detail loads only during close inspection.');
  const [modelStatus,setModelStatus]=useState('');
  const [equipmentStatus,setEquipmentStatus]=useState('loading');
  const [celestialStatus,setCelestialStatus]=useState({sun:'loading',earth:'loading'});
  const [readout, setReadout] = useState<Readout | null>(null);
  const activeMode = focus !== focusRef.current ? (focus === "earth" ? "earth" : focus === "lander" ? "vehicle" : "globe") : mode === "auto" ? (focus === "earth" ? "earth" : focus === "lander" ? "vehicle" : (mounted.current?.lat ?? props.lat) > -80 ? "globe" : "orbit") : mode === "follow" && !props.showFlight ? "orbit" : mode;
  const settings = useRef<CameraSettings>({ mode: activeMode, reset, horizon, inspection, guides });
  settings.current = { mode: activeMode, reset, horizon, inspection, guides };
  useEffect(() => {
    if (focusRef.current === focus && focusSerial.current === props.focusRequestId) return;
    focusSerial.current = props.focusRequestId;
    focusRef.current = focus;
    setMode(focus === 'earth' ? 'earth' : focus === 'lander' ? 'vehicle' : 'globe');
    setReset(value => value + 1);
  }, [focus, props.lat, props.focusRequestId]);
  useEffect(() => {
    if (!props.followRequest || props.followRequest.focusRequestId !== (props.focusRequestId ?? 0)) return;
    setMode('follow');
  }, [props.followRequest, props.focusRequestId]);
  useEffect(() => {
    const element = host.current, report = props.onTrackingReady;
    if (!element || !report) return;
    let previous: boolean | undefined;
    const inspect = () => {
      const d = element.dataset;
      const ready = d.cameraMode === 'follow' && d.assetFlight === 'idle' &&
        d.vehicleVisible === 'true' && d.vehicleFraming === 'framed' &&
        d.moonModel === 'ready' && equipmentStatus === 'ready' && d.contactReplay !== 'preparing';
      if (ready !== previous) { previous = ready; report(ready); }
    };
    const observer = new MutationObserver(inspect);
    observer.observe(element, {attributes: true, attributeFilter: ['data-render-frame']});
    inspect();
    return () => observer.disconnect();
  }, [props.onTrackingReady, props.followRequest?.id, equipmentStatus]);
  const selectFocus = (next: AssetFocus) => {
    if (props.assetFocus === undefined) {setLocalFocus(next); setMode(next === 'earth' ? 'earth' : next === 'lander' ? 'vehicle' : 'globe');}
    props.onAssetFocusChange?.(next);
    if (next === focus) {setMode(next === 'earth' ? 'earth' : next === 'lander' ? 'vehicle' : 'globe');setReset(value => value + 1);}
  };
  const focusRequest = useRef(selectFocus);focusRequest.current=selectFocus;
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const explicitMount=mountedRevision.current.revision!==revision||mountedRevision.current.retry!==retry;
    // Runtime owns cooperative site/resource swaps; only retry remounts WebGL.
    if(runtime.current&&!explicitMount)return;
    let handoff = transfer.current ?? runtime.current?.capture() ?? null;
    const destinationKey=siteNavigationKey(props.lat,props.lon);
    // A newer selection can arrive between an accepted handoff and this effect.
    if(handoff)handoff=reconcileSiteHandoff(handoff,destinationKey);
    transfer.current = null;
    runtime.current?.(); runtime.current = null;
    mounted.current = props;mountedRevision.current={revision,retry};
    setError(null);
    setTextureFailed(false);
    setModelStatus('');setEquipmentStatus('loading');
    const cancelMount = afterPaint(() => {
    try {
      runtime.current = mountScene(element, live.current, () => live.current, () => settings.current,
        setReadout, () => setTextureFailed(true), () => setError(
          "The 3D graphics view stopped. Retry 3D, or use the 2D map and numerical flight telemetry.",
        ),setModelStatus,setEquipmentStatus,handoff,value => {
          if (value.key !== siteNavigationKey(live.current.lat,live.current.lon)) return false;
          transfer.current=value;
          setMode(value.mode ?? "orbit");
          setRevision(v=>v+1);
          return true;
        },setNavigationStatus,(kind,status)=>setCelestialStatus(value=>({...value,[kind]:status})),request=>{
          if(settings.current.mode===request.mode&&settings.current.reset===request.reset)setMode('orbit');
        },setSurfaceStatus,setGeography,selectStation,()=>focusRequest.current('lander'),setDetailStatus);
    } catch (error) {
      handoff?.globe?.asset.dispose();
      console.error("Lunar scene initialization failed.", error);
      setError("3D rendering is unavailable in this browser. Use the 2D map and numerical flight telemetry, or retry 3D.");
    }
    });
    return () => {
      // A cancelled retry/site change must retain its transferred globe until
      // the next mount or the existing unmount disposer takes ownership.
      if (cancelMount() && handoff) transfer.current = handoff;
    };
  // Mount resources only; live pose/epoch updates are consumed by the render loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.terrain, props.imagery, props.map, props.lat, props.lon, props.horizon,
    props.flight, props.showFlight, props.referenceHeightM, retry, revision, navigationStatus]);
  useEffect(() => () => { runtime.current?.(); runtime.current=null; mounted.current=null; transfer.current?.globe?.asset.dispose();transfer.current=null; }, []);
  const hasFlight = props.showFlight && !!props.flight?.points.length;
  const pendingModel = !modelStatus || /^Loading/.test(modelStatus) ? 'Loading Moon model…' :
    focus==='earth'&&celestialStatus.earth==='loading' ? 'Loading Earth model…' :
    focus==='lander'&&equipmentStatus==='loading' ? 'Loading lander model…' :
    detailStatus.startsWith('Loading') ? 'Loading measured relief…' : '';
  const terrainSamplingM = props.terrain ? [props.terrain.overview, ...props.terrain.patches]
    .map((grid) => grid.inputPixelM ?? props.terrain!.sourcePixelM) : [];
  const sceneControls = <>
      {focus==='moon'&&['globe','orbit','surface'].includes(activeMode)&&<div className="globe-cardinals" role="group" aria-label="Moon navigation directions"><Button variant="ghost" aria-label="View north pole" onClick={()=>{setMode('globe');runtime.current?.navigateGeography(90,geography.lonDeg,true);}}>N ↑</Button><Button variant="ghost" aria-label="Rotate view west" onClick={()=>{setMode('globe');runtime.current?.stepLongitude(-30);}}>W ←</Button><Button variant="ghost" aria-label="Rotate view east" onClick={()=>{setMode('globe');runtime.current?.stepLongitude(30);}}>E →</Button><Button variant="ghost" aria-label="View south pole" onClick={()=>{setMode('globe');runtime.current?.navigateGeography(-90,geography.lonDeg,true);}}>S ↓</Button><Button variant="ghost" aria-pressed={mapLabels} onClick={()=>setMapLabels(v=>!v)}>Map labels</Button></div>}
      {focus==='moon'&&['globe','orbit'].includes(activeMode)&&<HeaderLeanDropdown label="Globe directions" className="header-globe-navigation"><GlobeNavigation viewLatDeg={geography.latDeg} viewLonDeg={geography.lonDeg} screenNorthAngleDeg={geography.screenNorthAngleDeg}
        onNorthPole={()=>{setMode('globe');runtime.current?.navigateGeography(90,geography.lonDeg,true);}} onSouthPole={()=>{setMode('globe');runtime.current?.navigateGeography(-90,geography.lonDeg,true);}}
        onEast={()=>{setMode('globe');runtime.current?.stepLongitude(30);}} onWest={()=>{setMode('globe');runtime.current?.stepLongitude(-30);}}
        selectedSite={props.sites?.find(site=>site.id===props.selectedSiteId)} hoveredSite={props.sites?.find(site=>site.id===geography.hoveredId)??null} onSelect={props.onSelectSite}/></HeaderLeanDropdown>}
      {focus === 'earth' && <div className="header-dsn-context">
        <EarthOrbits value={orbits} onChange={setOrbits} missionEpochMs={props.epochMs} offline={props.offline} audienceMode={props.audienceMode} openRequest={orbitRequest} onInspect={id=>runtime.current?.inspectSatellite(id)}/>

        <HeaderLeanDropdown label="Ground stations" className="header-station-details" openRequest={props.audienceMode==='public'?stationDetailsRequest:undefined}>
        <div role="group" aria-label="DSN ground complexes" className="header-station-buttons">{DSN_STATIONS.map(station => <Button key={station.id} variant="ghost" aria-pressed={stationId === station.id} onClick={() => {selectStation(station.id);setMode('earth');runtime.current?.inspectStation(station.id);}}>{station.name}</Button>)}</div>
          {!stationId && <p>Select Goldstone, Madrid or Canberra for its sourced antenna and dated weather context.</p>}
          {DSN_STATIONS.filter(station => station.id === stationId).map(station => <div key={station.id}>
            <strong>{station.name} · {station.antenna}</strong><p>{station.description}</p>
            {props.audienceMode==='public'&&<PublicStationStory station={station} contact={props.siteEarthContact??null}/>}
            <details open={props.audienceMode === 'plan' || undefined}><summary>Coordinates & source</summary>
              <p>WGS84 {station.latitudeDeg.toFixed(7)}°, {(((station.longitudeEastDeg+540)%360)-180).toFixed(7)}° east · {station.heightM.toFixed(3)} m ellipsoid height. <a href={DSN_SOURCES.coordinates} target="_blank" rel="noreferrer">JPL 810-005/301 Table 5</a>.</p>
              <p>Enlarged annotations at representative ground antennas, not satellites. NASA Blue Marble geography uses an Earth-fixed display attitude, not a qualified celestial frame. The original NASA Earth asset is retained.</p>
              <p>{DSN_GEOMETRY_STATUS.reason}</p>
            </details>
            <StationWeather station={station} epochMs={props.epochMs} offline={props.offline}/>
          </div>)}
        </HeaderLeanDropdown>
      </div>}
      <HeaderLeanDropdown label="Camera & lighting" className="header-camera"><div className="header-camera-options" role="group" aria-label="3D camera">

        <Button variant="ghost" aria-pressed={activeMode==='sun'} disabled={!physicalAsset('sun',props.sunRangeKm)} onClick={()=>setMode('sun')}>Inspect Sun</Button>
        {focus !== 'earth' && <><Button variant="ghost" aria-pressed={activeMode === "flight"} disabled={!hasFlight} onClick={() => setMode("flight")} title="Frame the complete propagated flight"><Scan />Flight</Button>
        <Button variant="ghost" aria-pressed={activeMode === "follow"} disabled={!hasFlight} onClick={() => setMode("follow")} title="Follow the current vehicle; drag to adjust the view"><Crosshair />Follow</Button></>}
        {focus === 'moon' && <><Button variant="ghost" aria-pressed={activeMode === "globe"} onClick={() => setMode("globe")} title="Explore the whole Moon and both poles">Globe</Button><Button variant="ghost" aria-pressed={activeMode === "orbit"} onClick={() => setMode("orbit")} title="Orbit the selected site's terrain"><Orbit />Orbit</Button>
        <Button variant="ghost" aria-pressed={activeMode === "surface"} onClick={() => setMode("surface")} title="View from 3 m above the displayed site surface"><Eye />Surface</Button></>}
        <Button variant="ghost" aria-label="Reset current 3D camera" onClick={() => setReset((value) => value + 1)}><RotateCcw /></Button>
        <Button variant="ghost" aria-pressed={inspection} onClick={() => setInspection(v=>!v)} title="Toggle stable atlas appearance / fixed studio light for visual relief and illustrative epoch lighting; computed sunlight and visibility are unchanged">{inspection ? detailStatus.startsWith('Effective source:') ? "Studio inspection light" : "Stable atlas appearance" : "Epoch light"}</Button>
        <Button variant="ghost" aria-pressed={showReadout} onClick={()=>setShowReadout(v=>!v)}>Vehicle readout</Button>
        <Button variant="ghost" aria-pressed={guides} onClick={()=>setGuides(v=>!v)}>Coordinate guides</Button>

      <details className="sq-notes" id={descriptionId}>
        <summary>Surface & scale</summary>
        <div className="sq-notes-body">
          {!props.offline&&<details className="ion-settings"><summary>Stream detailed Moon terrain · Cesium ion</summary>
            <p>Load NASA / USGS lunar tiles around the camera. The existing Moon stays visible while tiles arrive. This needs internet access and a read-only token for Cesium Moon (asset 2684829). The token is held only in this view’s memory, never saved or included in exports.</p>
            <label>Cesium asset-read token<input type="password" autoComplete="off" value={ionDraft} onChange={e=>setIonDraft(e.target.value)} placeholder="Paste your restricted ion token"/></label>
            <Button variant="outline" disabled={!ionDraft.trim()} onClick={()=>{setIonToken(ionDraft.trim());setIonDraft('');}}>Connect lunar tiles</Button>
            {ionToken&&<Button variant="outline" onClick={()=>{setMode('globe');runtime.current?.inspectTerrain();}}>Inspect selected site · 1 km above surface</Button>}
            {ionToken&&<Button variant="ghost" onClick={()=>{setIonToken('');setIonCredits([]);}}>Disconnect tiles</Button>}
            <p role="status">{ionToken?'Streaming requested. '+modelStatus:'Bundled NASA terrain is active.'}</p>
            <p>Provider source resolution reaches approximately 1 m imagery and 5 m terrain near the poles; mid-latitude source imagery is approximately 100 m and terrain 59 m. Visible detail loads progressively with camera scale and available coverage. <a href="https://cesium.com/platform/cesium-ion/content/cesium-moon/" target="_blank" rel="noreferrer">Source coverage and resolution</a>.</p>
            <p>Credits: NASA, USGS Astrogeology Science Center, Cesium. Streamed imagery shows historical illumination. Flight collision and planning calculations continue to use the documented numerical DEM; streamed tiles do not certify landing hazards.</p>
          </details>}
          <strong>Surface, lighting & scale <Info label="Sun direction" extra="3D lighting follows this direction. A small display fill reveals shadowed terrain; it does not change computed sunlight or Earth visibility." /></strong>
          <p>Original NASA Sun model: {celestialStatus.sun}. Original NASA Earth model: {celestialStatus.earth}. {CELESTIAL_ASSETS.sun.scope} Physical body radii and supplied JPL centre ranges are used; bodies with unavailable ranges are hidden. Directions retain the existing local pose and source-frame caveats. Inspection cameras change the viewpoint. Labels are enlarged. Earth credit: {CELESTIAL_ASSETS.earth.credit}.</p>
          <p>{LANDER_ASSET.scope} Vehicle scale is fixed at nominal 1× (7 m height); camera zoom never resizes the spacecraft. Asset credit: {LANDER_ASSET.credit}. Equipment status: {equipmentStatus}. {equipmentStatus==='error' ? 'NASA equipment could not load; no replacement geometry is shown.' : ''}</p>
          <p>Continuous lunar surface. LOLA heights are shown at <strong>1× relief</strong>, feathered over four grid cells at DEM edges. Areas outside prepared coverage use calibrated coarse global LOLA geometry where available (approximately 4.3 km equatorial output spacing), otherwise the smooth reference sphere. Imagery supplies no numerical heights or hazard measurements.</p>
          <p>Zooming close to the selected point switches from the nominal NASA globe to measured local relief where a DEM patch covers it. Close views refine the mesh cooperatively without restarting the scene. Extra triangles do not add measured detail.</p><p>{props.terrain&&heightAt(props.terrain,props.lat,props.lon,true)?`At this point: source pixels ${heightAt(props.terrain,props.lat,props.lon,true)!.inputPixelM} m; bundled samples approximately ${heightAt(props.terrain,props.lat,props.lon,true)!.stepM.toFixed(1)} m. Rocks smaller than this sampling are unresolved.`:'No fine local DEM covers this point. Coarse regional/global context remains available; zoom does not turn it into a landing-footprint survey.'}</p>
          <p>{props.terrain ? `DEM input sampling: ${Math.min(...terrainSamplingM)}–${Math.max(...terrainSamplingM)} m across bundled products. Surface mesh sampling is densest at the site and coarser regionally; interpolated display detail is not a new measurement.` : "Numerical terrain is unavailable. Only the reference-sphere shape is shown."}</p>
          <p>{textureFailed ? "Some bundled imagery could not load. Numerical shape remains available with a neutral material or the images that loaded." : props.imagery ? "NASA LROC / Moon Trek imagery is mapped from its polar extent and global longitude/latitude metadata. Its acquisition shadows are historical, not a simulation for this date." : "The bundled LOLA hillshade supplies the polar fallback texture with historical lighting. Outside its extent the surface uses a neutral material."}</p>
          <p>Epoch light follows the supplied Sun direction with a small display fill. Stable atlas appearance shows neutral source imagery without camera-dependent lighting or exposure. Its acquisition shadows remain historical. Disable it for illustrative epoch lighting. Neither changes computed terrain/sphere visibility. The Moon has no atmospheric sky glow.</p>
          <p>Close south-polar inspection can load a separate measured visual relief, with grid spacing from 150 m to 2 m in limited coverage. Grid spacing is not positional or elevation accuracy; this relief is not registered to flight/contact ground. Offline and active flight views retain canonical terrain. The visual relief has neutral shading, without photographic imagery.</p>
          <p data-surface-detail-source>{detailStatus}</p>
          <p>Visual relief elevations are metres relative to the 1,737,400 m sphere. Contributors and feather weights describe the camera target and available loaded sources. LOLA and stereo source frames have not been independently registered here. Extra mesh triangles and 2 m grid posts do not establish 2 m accuracy or resolved landing hazards.</p>
          <p>At the selected site: Sun azimuth {props.pose.sunAz.toFixed(2)}°, elevation {props.pose.sunEl.toFixed(2)}°; Earth azimuth {props.pose.earthAz.toFixed(2)}°, elevation {props.pose.earthEl.toFixed(2)}°. Azimuth starts at north and increases clockwise.</p>
          <p>All spatial readouts are local <strong>east, north and tangent up in km</strong>. Tangent up is relative to the site reference radius, not radial altitude or terrain clearance. Sun and Earth use physical kilometre scale when JPL ranges are supplied; amber and blue annotations identify them. The HYG v4.1 star background uses an approximate IAU_MOON rotation, not a qualified MOON_ME pointing frame; proper motion and apparent-position corrections are omitted. HYG credit: David Nash / Astronomy Nexus, CC BY-SA 4.0. Stars require a supplied epoch.</p>
          <p>Whole-Moon site markers are enlarged annotations at sourced catalogue coordinates, not physical spacecraft or terrain-hazard evidence. Back-side markers are hidden. Hover for the site name; click a marker to select that site and approach it.</p>
          <p>NASA lander geometry stays at nominal 1× scale (7 m height), anchored to the propagated position with illustrative radial-up attitude. The camera never resizes the spacecraft. Debris framing is a viewing aid, not structural certification. A separate ring marks the flight position when viewed from afar. The bright path is elapsed flight; the muted path is future flight. Dashed ground track and vertical guide are display projections, not a landing solution.</p>
          <p>Inspect lander moves the camera close to the physical model. Flight fits the whole path; Follow tracks the vehicle centre of mass and smoothly pulls back along the same viewing direction as debris spreads, without resizing any pieces; Orbit frames the site; Surface starts 3 m above the displayed ground. Drag to orbit, scroll or +/− to zoom; focus the canvas and use W/A/S/D to pan. Left/right arrows retain the time controls.</p>
          <label className="sq-horizon"><input type="checkbox" checked={horizon} onChange={(event) => setHorizon(event.target.checked)} /> Show {props.horizon.heightM} m observer horizon in Surface view (3 m camera)</label>
        </div>
      </details>
      </div></HeaderLeanDropdown>
  </>;
  return (
    <div className={`scene-wrap sq-scene${hasFlight ? " sq-flight" : ""}`} aria-describedby={descriptionId}>
      <div ref={host} className="scene-host" data-focus-request-id={props.focusRequestId} />
      <CesiumMoonCloseup host={host} lat={props.lat} lon={props.lon} focus={focus} />

      {surfaceStatus && <p className="sq-preparing" role="status">{surfaceStatus}</p>}
      {!error && pendingModel && <p className="sq-loading" role="status">{pendingModel} Camera controls remain available.</p>}

      <span className="sr-only" role="status">{navigationStatus}</span>
      {error && <div className="scene-error glass" role="alert">
        <p>{error}</p>
        <Button variant="outline" onClick={() => setRetry((value) => value + 1)}>Retry 3D</Button>
      </div>}
      {hasFlight && readout && !error && showReadout && <output className="sq-position glass" aria-live="off">
        <button className="sq-readout-close" aria-label="Dismiss vehicle readout" onClick={()=>setShowReadout(false)}>×</button>
        <strong>Current vehicle · {readout.timeSeconds.toFixed(1)} s from ignition</strong>
        <span>East {readout.eastKm.toFixed(2)} km · North {readout.northKm.toFixed(2)} km · Tangent up {readout.tangentUpKm.toFixed(2)} km</span>
        <span>{readout.currentCoverage === "fine" ? "Fine numerical terrain coverage" : readout.currentCoverage === "global-coarse" ? "Coarse global LOLA terrain · approximately 4.3 km spacing · fine clearance unknown" : readout.currentCoverage === "regional" ? "Regional DEM only · flight terrain clearance unknown" : "Reference-sphere context · terrain clearance unknown"}</span>
      </output>}
      {props.controlsTarget ? createPortal(sceneControls, props.controlsTarget) : <div className="scene-inline-controls">{sceneControls}</div>}
      {ionToken&&ionCredits.length>0&&focus==='moon'&&<p className="ion-credit" aria-label="Streamed lunar terrain attribution">{ionCredits.join(' · ')} · <a href="https://cesium.com/platform/cesium-ion/content/cesium-moon/" target="_blank" rel="noreferrer">Cesium Moon</a></p>}
      {mapLabels&&focus==='moon'&&['globe','orbit'].includes(activeMode)&&<div className="globe-map-labels" aria-label="Visible lunar landmarks">{geography.labels?.map(point=><button key={point.id} data-globe-label={point.id} className={point.pole?`pole-label ${point.farSide?'pole-far-side':''}`:''} style={{left:0,top:0,translate:`${point.x}px ${point.y}px`}} onClick={()=>{if(point.pole){setMode('globe');runtime.current?.navigateGeography(point.lat,geography.lonDeg,true);}else props.onSelectSite?.(point.id);}}>{point.name}{point.farSide?' · far side':point.offscreen?' · off-screen':''}</button>)}</div>}
      {focus==='moon'&&['globe','orbit','surface'].includes(activeMode)&&<output className="globe-location-readout" aria-label="Current globe orientation">{Math.abs(geography.latDeg).toFixed(1)}°{geography.latDeg<0?'S':'N'} · {Math.abs(geography.lonDeg).toFixed(1)}°{geography.lonDeg<0?'W':'E'} <span aria-hidden="true" style={{display:'inline-block',transform:`rotate(${geography.screenNorthAngleDeg??0}deg)`}}>↑ N</span></output>}
      <div className="scene-legend sq-legend">
        <span className="sun-dot" /> Sun <span className="earth-dot" /> Earth
        <span role={activeMode==='globe'?'status':undefined}>{activeMode==='sun'||activeMode==='earth'?`NASA ${activeMode==='sun'?'Sun':'Earth'} · physical km · ${activeMode==='earth'?'station inspection · display attitude':'authored orientation'}`:activeMode==='globe'?`${modelStatus||'NASA globe'} · nominal scale`:`Relief 1× · ${hasFlight && readout ? `Vehicle fixed ${readout.vehicleScale.toFixed(0)}× · ` : ""}Local ENU · km`}</span>
      </div>
      <style jsx>{`
        .sq-legend {background:none!important;border:0!important;box-shadow:none!important;padding:0!important;color:#d8d8d2}
        .sq-scene { background: #030404; color: #3e4635; }
        .sq-position { position: absolute; left: 50%; transform: translateX(-50%); bottom: 121px; width: max-content; max-width: calc(100% - 32px); border-radius: 12px; padding: 10px 15px; display: grid; gap: 3px; font-size: 12px; line-height: 1.45; text-align: center; font-variant-numeric: tabular-nums; pointer-events: none; }
        .sq-readout-close {position:absolute;right:4px;top:3px;pointer-events:auto;border:0;background:transparent;font-size:18px;width:25px;height:25px;cursor:pointer}.sq-position{padding-right:34px}
        .sq-position strong { font-weight: 600; font-size: 13px; }
        .sq-loading {position:absolute;left:12px;bottom:54px;max-width:calc(100% - 24px);margin:0;padding:4px 7px;background:#10120fe0;color:#f3eee1;font-size:12px;line-height:1.4;pointer-events:none;z-index:4;}
        .sq-preparing { position:absolute;top:70px;left:24px;max-width:340px;padding:8px 12px;background:var(--paper);color:var(--foreground);border:1px solid var(--border);border-radius:8px;font-size:12px;z-index:5; }
        .sq-flight .sq-position { bottom: 294px; }
        .sq-notes { position: static; z-index: 3; border-radius: 9px; font-size: 12px; line-height: 1.55; background: transparent; box-shadow: none; border: none; }
        .sq-notes summary { cursor: pointer; padding: 8px 10px; font-weight: 600; white-space: nowrap; }
        .sq-notes summary:focus-visible { outline: 2px solid #9a7941; outline-offset: 3px; }
        .sq-notes-body { position: static; width: 100%; padding: 10px; background: #fcfaf3f5; border: 1px solid #d8d5c8; border-radius: 14px; box-shadow: 0 12px 45px #0004; }
        .sq-notes-body > strong { display: block; margin-bottom: 10px; }
        .sq-notes-body p { margin: 0 0 10px; }
        .sq-horizon { display: flex; gap: 8px; align-items: center; }
        .sq-horizon input { accent-color: #737c53; }
        .sq-legend { color: #f3e9d3; background: #10120fe0; border: 1px solid #f3e9d32b; padding: 7px 10px; border-radius: 8px; font-size: 11px; bottom: 20px; max-width: calc(100% - 26px); flex-wrap: wrap; justify-content: center; white-space: normal; }
        .scene-error p { margin: 0 0 12px; }
        @media (max-width: 1000px) { .sq-legend { bottom: 13px; } }
      `}</style>
    </div>
  );
}
