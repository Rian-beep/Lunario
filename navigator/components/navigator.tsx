"use client";
import {PublicSiteStory} from "@/components/workbench/public-exploration";
import {UiThemeToggle} from "@/components/ui-theme-toggle";
import {LunarWindowBrand} from '@/components/branding/lunar-window-brand';
import {LunarWindowLoader, LunarioStartup} from '@/components/branding/lunar-window-loader';
import {SiteShellBrandLink, SiteShellNavLinks} from '@/components/site-shell-nav';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {earthMoonContext} from "@/lib/dsn";
import {nasaDirectionToBodyPoint,physicalAsset,type AssetFocus} from "@/lib/asset-focus";
import {customSurfaceMarker,CUSTOM_MARKER_ID} from "@/lib/custom-marker";
import {observedAbsence,observedAbsenceNote} from "@/lib/observed-duration";
import {AudienceContextPanel} from "@/components/workbench/audience-context";
import {AudienceTaskStrip} from "@/components/audience/task-strip";
import {WorkspaceDialog} from "@/components/workbench/workspace-dialog";
import {inspectorBounds,inspectorPanelWidth} from "@/lib/inspector-layout";
import {createPlaybackClock,environmentPlaybackRate,type PlaybackClock} from "@/lib/playback";
import {
  Map as MapIcon,
  Layers,
  Sun,
  Globe2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Clock3,
  Play,
  Pause,
  RotateCcw,
  Share2,
  Download,
  Plus,
  SlidersHorizontal,
  BookOpen,
  Rocket,
  Compass,
  ChartNoAxesCombined,
  Database,
  Search,
  X,
  ArrowRight,
  Check,
  Columns3,
  Maximize2,
  Navigation,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { PolarMap } from "@/components/polar-map";
import {GlobalMap} from "@/components/global-map";
import {DataConnections} from "@/components/workbench/data-connections";
import {AssessmentExplanation} from "@/components/workbench/assessment-explanation";
import {LearningDialog, VariableReference} from "@/components/workbench/physics-reference";
import dynamic from 'next/dynamic';
const TouchdownLab=dynamic(()=>import('@/components/workbench/touchdown-lab').then(m=>m.TouchdownLab),{ssr:false});
const SolarSystemView=dynamic(()=>import('@/components/workbench/solar-system-view').then(m=>m.SolarSystemView),{ssr:false});
const LunarScene=dynamic(()=>import('@/components/workbench/scene').then(m=>m.LunarScene),{ssr:false});
const ReplanningWorkspace=dynamic(()=>import('@/components/replanning/workspace').then(m=>m.ReplanningWorkspace));
const TeachingStudio=dynamic(()=>import('@/components/audience/teaching-studio').then(m=>m.TeachingStudio));
const EngineeringEvidenceWorkspace=dynamic(()=>import('@/components/engineering/evidence-workspace').then(m=>m.EngineeringEvidenceWorkspace));
import {LANDING_SITES} from "@/lib/landing-sites";
import {withLandingSites} from "@/lib/landing-catalog";
import {loadImagery,type ImageryData} from "@/lib/imagery";
import { AudienceContext, Info } from "@/components/workbench/info";
import { AudienceGuide } from "@/components/workbench/audience-guide";
import {Alternatives} from "@/components/workbench/alternatives";
import { VisibilityWindows } from "@/components/workbench/visibility-windows";
import {
  FlightGraphs,
  FlightParameterInfo,
  ResourceGraphs,
} from "@/components/workbench/science-charts";
import { Metric, Section, number } from "@/components/workbench/controls";
import {
  PlannerInputs,
  FlightPanel,
  TeachPanel,
  ResourcesPanel,
  AnalysisPanel,
  Comparison,
  DateSearch,
  type SavedScenario,
} from "@/components/workbench/panels";
import { loadCatalog, GROUP_LABEL, type Catalog } from "@/lib/catalog";
import {
  buildSeries,
  summarize,
  formatPercent,
  formatLat,
  formatUtc,
  indexToMs,
  parseLatitude,
  parseLongitude,
  poseAt,
  csvFor,
  downloadText,
} from "@/lib/astro";
import { DEFAULT_REQUIREMENTS, DEFAULT_OPERATIONS } from "@/lib/planning-types";
import { DEFAULT_MISSION, evaluateMission } from "@/lib/mission";
import { HeaderLandingStatus, currentLandingDynamics, type LandingReadout } from "@/components/workbench/header-landing-status";
import { createLandingFlight } from "@/lib/landing-presets";
import type { LandingContact, LandingOutcome } from "@/lib/landing-contract";
import { DEFAULT_FLIGHT, simulateFlight } from "@/lib/flight";
import {
  loadTerrain,
  heightAt,
  localToLunar,
  type TerrainData,
} from "@/lib/terrain";
import {
  parseScenario,
  encodeScenario,
  decodeScenario,
  type ScenarioState,
} from "@/lib/scenario";

type Mode = "public" | "teach" | "plan";
import {sampleGlobalHeight,loadGlobalTerrain} from "@/lib/global-terrain";
import {resolveTerrainChoice,isGlobalTerrainChoice} from "@/lib/analysis-context";
import {
  borrowedHorizonTopWarning,
  firstSunlitPlayheadForScenario,
  loadDelayedLandingDemo,
} from "@/lib/delayed-landing-demo";
import {TeachingWorkbench} from "./workbench/teaching-workbench";
import {MissionCalendar} from "./workbench/mission-calendar";
import {SensitivityPanel} from "./workbench/sensitivity-panel";
import {DecisionPackageControls} from "./workbench/decision-package";
import {DecisionPanel} from "./workbench/decision-panel";
import {createDecisionPackage,stringifyDecisionPackage} from "@/lib/decision-export";
import {loadEvidenceManifest} from "@/lib/provenance";
import {evaluateScenario} from "@/lib/assessment";
import type {EvidenceManifest} from "@/lib/planning-types";

type View = "map" | "terrain" | "split";
type Panel =
  "overview" | "teach" | "plan" | "flight" | "analysis" | "dates" | "sources" | "variables";
const STORAGE = "solarreach-workbench-v1",
  SAVED = "solarreach-comparisons-v1";
export function Navigator() {
  const [guideOpen, setGuideOpen] = useState(true);
  const [brandIntroReady,setBrandIntroReady]=useState(false);
  const completeBrandIntro=useCallback(()=>setBrandIntroReady(true),[]);
  const [focusMode,setFocusMode]=useState(false);
  const [assetFocus,setAssetFocus]=useState<AssetFocus>('moon');
  const [focusRequestId,setFocusRequestId]=useState(0);
  const [followRequest,setFollowRequest]=useState<{id:number;focusRequestId:number}>();
  const [flightPlaybackRevision,setFlightPlaybackRevision]=useState(0);
  const [flightTrackingReady,setFlightTrackingReady]=useState(false);
  const [pendingFlightPlay,setPendingFlightPlay]=useState(false);
  const [controlsTarget,setControlsTarget]=useState<HTMLDivElement|null>(null);
  const [learnOpen,setLearnOpen]=useState(false);
  const [teachingStudioOpen,setTeachingStudioOpen]=useState(false);
  const [engineeringOpen,setEngineeringOpen]=useState(false);
  const [engineeringVisited,setEngineeringVisited]=useState(false);
  const landingConfigured=useRef(false);
  const [landingReadout,setLandingReadout]=useState<LandingReadout|null>(null);
  const [touchdownOpen,setTouchdownOpen]=useState(false),[solarOverviewOpen,setSolarOverviewOpen]=useState(false);
  const [audienceContextCollapsed,setAudienceContextCollapsed]=useState(false);
  const [preferredInspectorWidth,setPreferredInspectorWidth]=useState<number|null>(null),[viewportWidth,setViewportWidth]=useState(1440);
  const inspectorResize=useRef<{pointerId:number;x:number;width:number}|null>(null);
  useEffect(()=>{const update=()=>setViewportWidth(innerWidth);update();window.addEventListener('resize',update);try{const n=Number(localStorage.getItem('solarreach-inspector-width-v1'));if(n>=360&&n<=1040)setPreferredInspectorWidth(n);}catch{setPreferredInspectorWidth(null);}return()=>window.removeEventListener('resize',update);},[]);
  useEffect(()=>{if(preferredInspectorWidth===null)return;const timer=setTimeout(()=>{try{localStorage.setItem('solarreach-inspector-width-v1',String(preferredInspectorWidth));}catch{setNotice('Panel width is temporary because view preferences could not be saved.');}},200);return()=>clearTimeout(timer);},[preferredInspectorWidth]);
  const [headingVisible,setHeadingVisible]=useState(true);
  const [headingMinimized,setHeadingMinimized]=useState(true);
  const [flightHud,setFlightHud]=useState<'full'|'compact'|'hidden'>('compact');
  const [compareMinimized,setCompareMinimized]=useState(false);
  const [comparisonReferenceId,setComparisonReferenceId]=useState<string|undefined>();
  const [comparisonFocus,setComparisonFocus]=useState<string[]|null>(null);
  const [comparisonMode,setComparisonMode]=useState<"saved"|"alternatives"|"calendar"|"replan">("saved");
  const [timelineMode,setTimelineMode]=useState<'full'|'compact'|'hidden'>('compact');
  useEffect(()=>{try{const saved=localStorage.getItem('solarreach-timeline-view-v1');if(saved==='full'||saved==='compact'||saved==='hidden')setTimelineMode(saved);}catch{setNotice('Timeline view preference is unavailable; using the compact view.');}},[]);
  function changeTimeline(mode:'full'|'compact'|'hidden'){
    setTimelineMode(mode);if(mode==='hidden')setPlaying(false);
    try{localStorage.setItem('solarreach-timeline-view-v1',mode);}catch{setNotice('Timeline preference could not be saved on this device.');}
  }
  const [evidenceManifest,setEvidenceManifest]=useState<EvidenceManifest|null>(null);
  const [globalTerrainError,setGlobalTerrainError]=useState('');
  const [evidenceError,setEvidenceError]=useState('');
  const [imageryData,setImageryData]=useState<ImageryData|null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [data, setData] = useState<TerrainData | null>(null),
    [state, setState] = useState<ScenarioState | null>(null),
    [error, setError] = useState(""),
    [terrainError, setTerrainError] = useState("");
  const [mode, setMode] = useState<Mode>("public"),
    [view, setView] = useState<View>("map"),
    [panel, setPanel] = useState<Panel>("overview"),
    [leftOpen, setLeftOpen] = useState(false),
    [rightOpen, setRightOpen] = useState(false),
    [compareOpen, setCompareOpen] = useState(false),
    [saved, setSaved] = useState<SavedScenario[]>([]);
  const [flightRequested,setFlightRequested]=useState(false);
  const [mapArea,setMapArea]=useState<"polar"|"global">("polar");
  const [siteFilter,setSiteFilter]=useState<"all"|"polar"|"apollo"|"robotic"|"attempt">("all");
  const [query, setQuery] = useState(""),
    [latDraft, setLatDraft] = useState("89.5 S"),
    [lonDraft, setLonDraft] = useState("0 E"),
    [coordError, setCoordError] = useState(""),
    [imagery, setImagery] = useState(true),
    [light, setLight] = useState(false),
    [layers, setLayers] = useState(false);
  const [playhead, setPlayhead] = useState(0),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(6),
    [reduced, setReduced] = useState(false),
    [notice, setNotice] = useState(""),
    [demoContrastLine, setDemoContrastLine] = useState(""),
    [flightTime, setFlightTime] = useState(0),
    [flightPlaying, setFlightPlaying] = useState(false),
    [flightSpeed, setFlightSpeed] = useState(10);
  const inspectorWidth=inspectorPanelWidth(preferredInspectorWidth,mode,panel==='analysis'||panel==='flight',viewportWidth);
  const inspectorLimits=inspectorBounds(viewportWidth,panel==='analysis'||panel==='flight');
  const announced = useRef("");
  const environmentClock=useRef<PlaybackClock|null>(null),flightClock=useRef<PlaybackClock|null>(null);
  const latestPlayhead=useRef(playhead),latestFlightTime=useRef(flightTime);
  latestPlayhead.current=playhead;latestFlightTime.current=flightTime;
  useEffect(() => {
    let active = true;
    loadCatalog()
      .then((rawCatalog) => {
        if (!active) return;
        const c=withLandingSites(rawCatalog,LANDING_SITES);
        const bounds = { siteIds: c.sites.map((s) => s.id), samples: c.meta.n, stepHours:c.meta.stepHours };
        const start = Math.round(
          (Date.parse(c.meta.demo.start) - c.t0ms) / 3600000,
        );
        let initial: ScenarioState = {
          schemaVersion:2, terrainMode:"global-context", arrayHeightM:2, antennaHeightM:2,
          requirements:structuredClone(DEFAULT_REQUIREMENTS), operations:structuredClone(DEFAULT_OPERATIONS),
          siteId: c.meta.demo.siteId,
          custom: null,
          startIndex: start,
          endIndex: start + c.meta.demo.hours - 1,
          heightM: 2,
          mission: { ...DEFAULT_MISSION },
          flight: { ...DEFAULT_FLIGHT },
        };
        const shared = new URLSearchParams(window.location.search).get(
          "scenario",
        );
        if (shared) {
          const parsed = decodeScenario(shared, bounds);
          if (parsed) initial = parsed;
          else
            setNotice(
              "This shared scenario is invalid or outside the catalog. Showing the default site.",
            );
        } else
          try {
            const stored = localStorage.getItem(STORAGE);
            if (stored) {
              const parsed = parseScenario(JSON.parse(stored), bounds);
              if (parsed) initial = parsed;
            }
          } catch {
            setNotice(
              "Local storage is unavailable. You can still export and share scenarios.",
            );
          }
        try {
          const raw = JSON.parse(localStorage.getItem(SAVED) ?? "[]");
          if (Array.isArray(raw))
            setSaved(
              raw.flatMap((v: SavedScenario) => {
                const parsed = parseScenario(v?.state, bounds);
                return parsed &&
                  typeof v.id === "string" &&
                  typeof v.name === "string"
                  ? [{ id: v.id, name: v.name, state: parsed }]
                  : [];
              }),
            );
        } catch {
          setNotice(
            "Saved comparisons could not be read. Current analysis remains available.",
          );
        }
        if((initial.custom?.lat ?? c.sites.find(s=>s.id===initial.siteId)?.lat ?? -90)>-80)setMapArea("global");
        setCatalog(c);
        setState(initial);
        const opensOnCatalogDemo=initial.siteId===c.meta.demo.siteId&&initial.startIndex===start&&!initial.custom;
        setPlayhead(opensOnCatalogDemo?firstSunlitPlayheadForScenario(c,initial):initial.startIndex);
      })
      .catch(
        (e) =>
          active &&
          setError(
            e instanceof Error ? e.message : "The catalog could not be loaded.",
          ),
      );
    loadEvidenceManifest().then(m=>{if(active)setEvidenceManifest(m);}).catch(e=>{if(active)setEvidenceError(String(e.message??e));});
    return () => {
      active = false;
    };
  }, []);
  useEffect(()=>{if(view!=='map'||panel==='flight'||assetFocus==='lander')setFlightRequested(true);},[view,panel,assetFocus]);
  // The 2D prepared map does not need the large numerical 3D datasets.
  const needsGlobalTerrain=useMemo(()=>{
    if(!catalog||!state||catalog.globalTerrain||(state.terrainMode??'prepared')==='prepared')return false;
    if(view!=='map'||state.terrainMode==='global-at-point')return true;
    const selected=catalog.sites.find(s=>s.id===state.siteId);if(!selected)return false;
    return [state.heightM,state.arrayHeightM,state.antennaHeightM].some(height=>[0,2,10].includes(height)&&!resolveTerrainChoice(catalog,selected,state.custom,height,'prepared').mask.some(Number.isFinite));
  },[catalog,state,view]);
  useEffect(()=>{
    if(!needsGlobalTerrain)return;let active=true;
    loadGlobalTerrain().then(globalTerrain=>{if(active){setCatalog(previous=>previous?{...previous,globalTerrain}:previous);setGlobalTerrainError('');}}).catch(error=>{if(active)setGlobalTerrainError(String(error.message??error));});
    return()=>{active=false;};
  },[needsGlobalTerrain]);
  useEffect(()=>{
    if(view==='map')return;let active=true;
    loadImagery().then(value=>{if(active)setImageryData(value);}).catch(()=>{if(active)setNotice('Higher-resolution imagery is unavailable; original relief remains available.');});
    loadTerrain().then(value=>{if(active){setData(value);setTerrainError('');}}).catch(error=>{if(active)setTerrainError(String(error.message??error));});
    return()=>{active=false;};
  },[view]);
  useEffect(() => {
    const q = matchMedia("(prefers-reduced-motion: reduce)"),
      apply = () => setReduced(q.matches);
    apply();
    q.addEventListener("change", apply);
    return () => q.removeEventListener("change", apply);
  }, []);
  useEffect(() => {
    if (!state) return;
    try {
      localStorage.setItem(STORAGE, JSON.stringify(state));
    } catch {
      setNotice(
        "Changes are in memory only: browser storage is full or unavailable. Export your scenario to keep it.",
      );
    }
  }, [state]);
  useEffect(() => {
    if (!catalog) return;
    try {
      localStorage.setItem(SAVED, JSON.stringify(saved));
    } catch {
      setNotice(
        "Comparisons could not be stored locally. Export them before leaving.",
      );
    }
  }, [saved, catalog]);
  const update = useCallback((patch:Partial<ScenarioState>)=>{
    if(!state||!catalog)return false;
    const next=parseScenario({...state,...patch},{siteIds:catalog.sites.map(s=>s.id),samples:catalog.meta.n,stepHours:catalog.meta.stepHours});
    if(!next){setNotice('This change exceeds prepared coverage or invalidates a scheduled operation/contact window. Previous inputs were retained.');return false;}
    setState(next);return true;
  },[state,catalog]);
  const site = useMemo(
    () => catalog?.sites.find((s) => s.id === state?.siteId) ?? null,
    [catalog, state?.siteId],
  );
  const location = useMemo(
    () => state?.custom ?? (site ? { lat: site.lat, lon: site.lon } : null),
    [state?.custom?.lat,state?.custom?.lon, site], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const groupSites=useMemo(()=>catalog?.sites.filter(s=>siteFilter==='all'||siteFilter==='polar'&&s.lat<=-80||siteFilter==='apollo'&&s.group==='apollo'||siteFilter==='robotic'&&(s.group==='robotic'||s.group==='clps')||siteFilter==='attempt'&&s.group==='attempt')??[],[catalog,siteFilter]);
  const mapSites=useMemo(()=>!site||groupSites.some(s=>s.id===site.id)?groupSites:[...groupSites,site],[groupSites,site]);
  const sceneSites=useMemo(()=>{const custom=customSurfaceMarker(state?.custom);return custom?[...mapSites,custom]:mapSites;},[mapSites,state?.custom?.lat,state?.custom?.lon]); // eslint-disable-line react-hooks/exhaustive-deps
  const sceneContext=useMemo(()=>catalog?earthMoonContext(catalog,playhead):null,[catalog,playhead]);
  const scenePositions=useMemo(()=>({earth:sceneContext?.earthDirection?nasaDirectionToBodyPoint(sceneContext.earthDirection,sceneContext.rangeKm):undefined,sun:sceneContext?.sunDirection&&sceneContext.sunRangeKm?nasaDirectionToBodyPoint(sceneContext.sunDirection,sceneContext.sunRangeKm):undefined}),[sceneContext]);
  const displayHeightM=state?.heightM,customLocation=state?.custom,terrainMode=state?.terrainMode;
  const terrain = useMemo(()=>catalog&&site&&displayHeightM!==undefined?resolveTerrainChoice(catalog,site,customLocation??null,displayHeightM,terrainMode??'prepared'):null,[catalog,site,displayHeightM,customLocation?.lat,customLocation?.lon,terrainMode]); // eslint-disable-line react-hooks/exhaustive-deps
  const sceneTerrain=useMemo(()=>data?{...data,globalTerrain:catalog?.globalTerrain}:null,[data,catalog?.globalTerrain]);
  const series = useMemo(
    () =>
      catalog && state && location && terrain
        ? buildSeries(
            catalog,
            location.lat,
            location.lon,
            terrain,
            state.startIndex,
            state.endIndex,
          )
        : null,
    [catalog, location, terrain, state?.startIndex,state?.endIndex], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const summary = useMemo(
    () =>
      series && catalog ? summarize(series, catalog.meta.stepHours, {antennaMaskDeg:state?.mission.antennaMaskDeg}) : null,
    [series, catalog,state?.mission.antennaMaskDeg],
  );
  const terrainOnlySummary=useMemo(()=>series&&catalog?summarize(series,catalog.meta.stepHours):null,[series,catalog]);
  const planning = useMemo(()=>{
    if(!catalog||!state||!evidenceManifest)return {result:null,error:evidenceError};
    try{return {result:evaluateScenario(catalog,state,evidenceManifest),error:''};}
    catch(error){return {result:null,error:error instanceof Error?error.message:'Scenario assessment unavailable.'};}
  },[catalog,state,evidenceManifest,evidenceError]);
  const mission = useMemo(()=>planning.result?.mission??(series&&catalog&&state?evaluateMission(series,catalog.meta.stepHours,state.mission):null),[planning,series,catalog,state]);
  const sphere = useMemo(()=>planning.result?.sphereMission??(series&&catalog&&state?evaluateMission(series,catalog.meta.stepHours,state.mission,true):null),[planning,series,catalog,state]);
  const observedDark=useMemo(()=>series&&catalog?observedAbsence(Array.from(series.sunEl,(el,i)=>Number.isFinite(el)&&Number.isFinite(series.sunRadius[i])&&Number.isFinite(series.sunHorizon[i])?el+series.sunRadius[i]>series.sunHorizon[i]:null),catalog.meta.stepHours):null,[series,catalog]);
  const observedBlackout=useMemo(()=>mission&&catalog?observedAbsence(mission.timeline.map(t=>t.contact),catalog.meta.stepHours):null,[mission,catalog]);
  const referenceHeightM = useMemo(() => {
    const globalHeight=state?.terrainMode!==undefined&&state.terrainMode!=='prepared'&&catalog?.globalTerrain&&location?sampleGlobalHeight(catalog.globalTerrain,location.lat,location.lon):null;
    const fallback = globalHeight??(state?.custom ? 0 : (site?.demHeightM ?? 0));
    return data && location ? (heightAt(data, location.lat, location.lon)?.heightM ?? fallback) : fallback;
  }, [data, location, site, state?.custom,state?.terrainMode,catalog?.globalTerrain]);
  const flightInputKey=JSON.stringify(state?.flight);
  const flight = useMemo(() => {
    if (!state || !location || !flightRequested) return null;
    const base = referenceHeightM;
    const ground = data
      ? (east: number, north: number) => {
          const p = localToLunar(east, north, location.lat, location.lon),
            h = heightAt(data, p.lat, p.lon, true);
          return h
            ? h.heightM -
                base -
                (east * east + north * north) / (2 * (1737400 + base))
            : null;
        }
      : undefined;
    return simulateFlight(state.flight, ground, 1737400 + base, {latitudeDeg: location.lat});
  }, [flightInputKey, location, data, referenceHeightM,flightRequested]); // eslint-disable-line react-hooks/exhaustive-deps
  const relative = series
    ? Math.max(0, Math.min(series.sunEl.length - 1, playhead - series.index0))
    : 0;
  const pose = useMemo(
    () =>
      series
        ? poseAt(series, relative)
        : { sunAz: 0, sunEl: 0, earthAz: 0, earthEl: 0 },
    [series, relative],
  );
  const currentSlot = Math.floor(relative),
    current = mission?.timeline[currentSlot];
  const showFlight = assetFocus === "lander" || panel === "flight";
  const landingFlight = flight as (typeof flight & {previewEndTimeS?:number;contact?:LandingContact;landingOutcome?:LandingOutcome});
  const endFlight = landingFlight?.previewEndTimeS ?? flight?.points.at(-1)?.t ?? 1;
  const landingReadoutKey=useMemo(()=>({flight,startIndex:state?.startIndex}),[flight,state?.startIndex]);
  const onLandingDynamics=useCallback((value:LandingReadout["value"]|null)=>{
    setLandingReadout(value?{key:landingReadoutKey,value}:null);
  },[landingReadoutKey]);
  useEffect(() => {
    setFlightTime(0);
    setFlightPlaying(false);
  }, [flightInputKey,state?.siteId,state?.custom?.lat,state?.custom?.lon,state?.startIndex]);
  useEffect(() => {
    if (!playing || !state || !catalog) { environmentClock.current=null;return; }
    const now=performance.now(),start=Math.min(state.endIndex,environmentClock.current?.positionAt(now)??latestPlayhead.current);
    const clock=createPlaybackClock({startPosition:start,endPosition:state.endIndex,startWallMs:now,ratePerSecond:environmentPlaybackRate(speed,catalog.meta.stepHours),reducedMotion:reduced});
    environmentClock.current=clock;
    let frame=0;
    const tick=(time:number)=>{const sample=clock.sample(time);setPlayhead(sample.position);if(sample.complete){environmentClock.current=null;setPlaying(false);}else frame=requestAnimationFrame(tick);};
    frame=requestAnimationFrame(tick);
    return ()=>cancelAnimationFrame(frame);
  }, [playing,speed,reduced,state?.endIndex,catalog]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if(!flightPlaying){flightClock.current=null;return;}
    const now=performance.now(),start=Math.min(endFlight,flightClock.current?.positionAt(now)??latestFlightTime.current);
    const clock=createPlaybackClock({startPosition:start,endPosition:endFlight,startWallMs:now,ratePerSecond:flightSpeed,reducedMotion:reduced});
    flightClock.current=clock;
    let frame=0;
    const tick=(time:number)=>{const sample=clock.sample(time);setFlightTime(sample.position);if(sample.complete){flightClock.current=null;setFlightPlaying(false);}else frame=requestAnimationFrame(tick);};
    frame=requestAnimationFrame(tick);
    return ()=>cancelAnimationFrame(frame);
  },[flightPlaying,endFlight,flightSpeed,reduced,flightPlaybackRevision]);
  useEffect(()=>{
    if(pendingFlightPlay&&flightTrackingReady){setPendingFlightPlay(false);setFlightPlaying(true);}
  },[pendingFlightPlay,flightTrackingReady]);
  useEffect(()=>{
    if(!pendingFlightPlay)return;
    const timer=setTimeout(()=>{setPendingFlightPlay(false);setNotice('The Follow view is not ready. Check the 3D status and try Play experiment again.');},90000);
    return()=>clearTimeout(timer);
  },[pendingFlightPlay]);
  function toggleEnvironmentPlayback(){
    if(playing){const position=environmentClock.current?.positionAt(performance.now());if(position!==undefined)setPlayhead(position);setPlaying(false);}
    else{if(state&&playhead>=state.endIndex)setPlayhead(state.startIndex);setPlaying(true);}
  }
  function toggleFlightPlayback(){
    if(pendingFlightPlay){setPendingFlightPlay(false);return;}
    if(flightPlaying){const position=flightClock.current?.positionAt(performance.now());if(position!==undefined)setFlightTime(position);setFlightPlaying(false);}
    else playFlightExperiment();
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('dialog[open],[role="dialog"]')) return;
      if (
        el.closest(
          'input,textarea,select,summary,[contenteditable],button,a,[role="slider"],[role="tab"],[role="separator"]',
        )
      )
        return;
      if (el.closest("[data-map-root]") && e.key !== " ") return;
      if (e.code === "Space") {
        e.preventDefault();
        if (showFlight) toggleFlightPlayback();
        else toggleEnvironmentPlayback();
      }
      if (state && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        setPlaying(false);
        setPlayhead((v) =>
          Math.max(
            state.startIndex,
            Math.min(
              state.endIndex,
              v + (e.key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 6 : 1),
            ),
          ),
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, showFlight,playing,flightPlaying]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!current) return;
    const message = `${playing ? "Playing" : "Paused"}. ${current.sun === null ? "Sunlight unknown" : current.sun ? "Sunlit" : "In shadow"}.`;
    if (message !== announced.current) {
      announced.current = message;
      const live = document.getElementById("playback-status");
      if (live) live.textContent = message;
    }
  }, [playing, current]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 10000);
    return () => clearTimeout(timer);
  }, [notice]);
  const selectSite = (id: string) => {
    if(mode==='public'){setLeftOpen(false);if(headingVisible)setHeadingMinimized(false);}
    if((catalog?.sites.find(s=>s.id===id)?.lat ?? -90)>-80)setMapArea("global");
    update({ siteId: id, custom: null, terrainMode:state?.terrainMode??'prepared' });
    setCoordError("");
  };
  function range(start: number, end: number) {
    if (!catalog) return;
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end >= catalog.meta.n-1 ||
      end < start
    ) {
      setNotice(
        "Choose a valid interval inside 1 Jan 2026–1 Jan 2028. End must follow start.",
      );
      return;
    }
    if(!update({ startIndex: Math.round(start), endIndex: Math.round(end) }))return;
    setPlayhead(Math.round(start));
    setPlaying(false);
  }
  function saveScenario() {
    setComparisonFocus(null);
    if (!state || !site) return;
    setSaved((v) => [
      ...v,
      {
        id: crypto.randomUUID(),
        name: state.custom
          ? `Custom ${formatLat(state.custom.lat)}`
          : site.name,
        state: structuredClone(state),
      },
    ]);
    setNotice("Scenario saved with its dates and hardware assumptions.");
  }
  function openPanel(p: Panel) {
    setPanel(p);
    setRightOpen(true);
    if (p === "flight") {
      setView("terrain");
      requestAssetFocus('lander');
    }
  }
  function requestAssetFocus(next:AssetFocus){
    setPendingFlightPlay(false);
    setAssetFocus(next);
    setFocusRequestId(value=>value+1);
    setView(current=>current==='map'?'terrain':current);
    if(next==='lander'&&state){
      setAudienceContextCollapsed(true);
      if(!landingConfigured.current&&update({flight:createLandingFlight(state.flight)}))landingConfigured.current=true;
      setPanel('flight');setRightOpen(true);setLeftOpen(false);setPlaying(false);
    }
  }
  function followFlightExperiment(){
    setFlightTrackingReady(false);
    setView('terrain');setAssetFocus('lander');setPlaying(false);
    setAudienceContextCollapsed(true);setLeftOpen(false);
    setFollowRequest(previous=>({id:(previous?.id??0)+1,focusRequestId}));
    if(flightHud==='hidden')setFlightHud('compact');
  }
  function playFlightExperiment(replay=false){
    followFlightExperiment();
    if(replay||flightTime>=endFlight){flightClock.current=null;setFlightTime(0);setFlightPlaybackRevision(value=>value+1);}
    setFlightPlaying(false);setPendingFlightPlay(true);
  }
  async function exploreDelayDemo(){
    if(!catalog||!evidenceManifest)return;
    try{
      const demo=await loadDelayedLandingDemo(catalog,evidenceManifest);
      const selected=demo.cases.map(c=>({id:crypto.randomUUID(),name:c.name,state:c.state}));
      setSaved(v=>[...v,...selected]);
      setComparisonReferenceId(selected[0].id);
      setComparisonFocus(selected.map(c=>c.id));
      landingConfigured.current=false;
      setState(structuredClone(selected[0].state));
      setPlayhead(demo.baselinePlayheadIndex);
      setPlaying(false);
      setFlightPlaying(false);
      setComparisonMode('saved');
      setCompareMinimized(false);
      setCompareOpen(true);
      setGuideOpen(false);
      setDemoContrastLine(demo.contrastLine);
      setNotice(`${demo.contrastLine}. Loaded original arrival, 14-day delay, and site-only alternative into Compare. Hardware and stay length are unchanged; source limits remain conditional.`);
    }
    catch(error){setNotice(error instanceof Error?error.message:'Demonstration could not load.');}
  }
  function saveExactScenario(s:ScenarioState,name='Tested scenario'){setSaved(v=>[...v,{id:crypto.randomUUID(),name,state:structuredClone(s)}]);setNotice('Exact scenario saved for comparison.');}
  function comparePair(base:ScenarioState,candidate:ScenarioState){const baseId=crypto.randomUUID(),candidateId=crypto.randomUUID();setSaved(v=>[...v,{id:baseId,name:'Controlled baseline',state:structuredClone(base)},{id:candidateId,name:'Controlled candidate',state:structuredClone(candidate)}]);setComparisonReferenceId(baseId);setComparisonFocus([baseId,candidateId]);setComparisonMode('saved');setCompareMinimized(false);setCompareOpen(true);}
  function openReplanning(){setPendingFlightPlay(false);setGuideOpen(false);setPlaying(false);setFlightPlaying(false);setComparisonMode('replan');setCompareMinimized(false);setCompareOpen(true);}
  function openTeachingStudio(){setPendingFlightPlay(false);setGuideOpen(false);setPlaying(false);setFlightPlaying(false);setTeachingStudioOpen(true);}
  function openEngineeringEvidence(){setPendingFlightPlay(false);setGuideOpen(false);setPlaying(false);setFlightPlaying(false);setEngineeringVisited(true);setEngineeringOpen(true);}
  function inspectReplannedScenario(next:ScenarioState,index:number){openSavedScenario(next);setPlayhead(Math.max(next.startIndex,Math.min(next.endIndex,index)));setPanel('analysis');setRightOpen(true);}
  function openAlternatives(){setComparisonMode('alternatives');setCompareMinimized(false);setCompareOpen(true);}
  function openSavedScenario(s:ScenarioState){landingConfigured.current=false;setState(structuredClone(s));setPlayhead(s.startIndex);setPlaying(false);setFlightPlaying(false);if((s.custom?.lat??catalog?.sites.find(p=>p.id===s.siteId)?.lat??-90)>-80)setMapArea('global');setCompareOpen(false);}
  function exportScenario() {
    if(!state||!catalog||!evidenceManifest){setNotice('Prepared evidence must load before exporting a reproducible decision.');return;}
    try{downloadText('solarreach-decision.json',stringifyDecisionPackage(createDecisionPackage(catalog,state,evidenceManifest)));setNotice('Decision package exported with exact inputs, model, sources and time series.');}
    catch(error){setNotice(error instanceof Error?error.message:'Decision export failed.');}
  }
  if (error)
    return (
      <><LunarioStartup ready /><main className="startup">
        <h1>Unable to load the lunar catalog</h1>
        <p>{error}</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </main></>
    );
  if (
    !catalog ||
    !state ||
    !site ||
    !location ||
    !terrain ||
    !series ||
    !summary ||
    !mission ||
    !sphere
  )
    return (
      <><LunarioStartup ready={false} /><LunarWindowLoader /></>
    );
  const now = indexToMs(catalog, playhead),
    name = state.custom ? "Custom landing point" : site.name;
  const currentFlight =
    flight?.points.find((p) => p.t >= flightTime) ?? flight?.points.at(-1) ?? null;
  const contactActive=!!landingFlight?.contact&&flightTime>=landingFlight.contact.timeS;
  const dynamics=currentLandingDynamics(landingReadout,landingReadoutKey,landingFlight?.contact,flightTime,flightPlaying?flightSpeed:0);
  const shift = (h: number) => range(state.startIndex + h, state.endIndex + h);
  const poseDescription = `Sun ${number(pose.sunEl, 2)}° above the local horizontal; Earth ${number(pose.earthEl, 2)}°. Terrain horizons determine actual visibility.`;
  const borrowedHorizonBanner=borrowedHorizonTopWarning(terrain);
  const tabs: [Panel, string, typeof Compass][] = [
    ["overview", "Site overview", Compass],
    ["analysis", "Horizon analysis", ChartNoAxesCombined],
    ["dates", "Find landing dates", Search],
    ["flight", "Flight preview", Rocket],
    ["sources", "Data sources", Database],
  ];
  return (
    <AudienceContext.Provider value={mode}>
      <LunarioStartup ready onComplete={completeBrandIntro} />
      <div className={`lunar-app ${focusMode?"focus-mode":""}`}>
        <a className="skip-link" href="#lunar-workspace">
          Skip to lunar workspace
        </a>
        <div id="playback-status" className="sr-only" aria-live="polite" />
        <div className="sr-only" aria-live="polite">
          {notice}
        </div>
        {borrowedHorizonBanner&&!focusMode&&(
          <aside className="borrowed-horizon-banner" role="alert">
            <strong>Borrowed horizon</strong>
            <span>{borrowedHorizonBanner}</span>
          </aside>
        )}
        {demoContrastLine&&!focusMode&&(
          <aside className="demo-contrast-banner" aria-label="Delayed landing contrast">
            <strong>Terrain vs smooth Moon</strong>
            <span>{demoContrastLine}</span>
            <Button variant="ghost" size="icon" aria-label="Dismiss terrain contrast" onClick={()=>setDemoContrastLine('')}><X size={14}/></Button>
          </aside>
        )}
        <header className="app-header" hidden={focusMode}>
          <div className="header-primary-row">
          <div className="header-brand-cluster">
            <SiteShellBrandLink>
              <LunarWindowBrand icon={<span className="brand-orbit"><Sun size={17} /></span>} />
            </SiteShellBrandLink>
            <SiteShellNavLinks />
          </div>
          <div
            className="audience-switch"
            role="group"
            aria-label="Audience mode"
          >
            {(
              [
                ["public", "Public", Globe2],
                ["teach", "Educator", BookOpen],
                ["plan", "Planner", SlidersHorizontal],
              ] as const
            ).map(([id, label, Icon]) => (
              <Button
                key={id}
                variant="ghost"
                aria-pressed={mode === id}
                onClick={() => {
                  setMode(id);setAudienceContextCollapsed(false);
                  if(id==='public'&&assetFocus==='lander')requestAssetFocus('moon');
                  openPanel(id === "public" ? "overview" : id);
                  setGuideOpen(true);
                }}
              >
                <Icon size={15} />
                {label}
              </Button>
            ))}
          </div>
          <div className="header-actions">
            <UiThemeToggle/>
            <Button variant="ghost" onClick={()=>{setFocusMode(true);setGuideOpen(false);}} aria-label="Hide panels for unobstructed view"><Maximize2 size={16}/><span>Hide panels</span></Button>
            <Button variant="ghost" onClick={() => setGuideOpen(true)} aria-label="Open current mode guide"><BookOpen size={16}/><span>Mode guide</span></Button>
            <span className="data-badge">
              <i />
              NASA data
            </span>
            <Button
              variant="ghost"
              aria-label="Share current scenario"
              onClick={async () => {
                const url = new URL(window.location.href);
                url.searchParams.set("scenario", encodeScenario(state,{siteIds:catalog.sites.map(s=>s.id),samples:catalog.meta.n,stepHours:catalog.meta.stepHours}));
                try {
                  await navigator.clipboard.writeText(url.toString());
                  setNotice(
                    "Scenario link copied, including site, dates and hardware inputs.",
                  );
                } catch {
                  setNotice(
                    "Clipboard unavailable. Use Export scenario to keep the inputs.",
                  );
                }
              }}
            >
              <Share2 size={17} />
              <span>Share</span>
            </Button>
            <Button variant="outline" aria-label="Export current scenario" onClick={exportScenario}>
              <Download size={15} />
              <span>Export</span>
            </Button>
          </div>
          </div>
          <div className="header-context-toolbar" aria-label="Workspace controls">
          <div
            className="view-switch"
            role="group"
            aria-label="Visualization"
          >
            <Button
              variant="ghost"
              aria-pressed={view === "map"}
              onClick={() => setView("map")}
            >
              <MapIcon size={15} />
              2D map
            </Button>
            <Button
              variant="ghost"
              aria-pressed={view === "terrain"}
              onClick={() => setView("terrain")}
            >
              <Layers size={15} />
              3D terrain
            </Button>
            <select hidden={view==='terrain'} className="map-area-select" aria-label="Map region" value={mapArea} onChange={e=>{const value=e.target.value as 'polar'|'global';setMapArea(value);if(value==='polar'&&location.lat>-80)selectSite(catalog.meta.demo.siteId);}}><option value="polar">South pole</option><option value="global">Whole Moon</option></select>
            <Button
              variant="ghost"
              aria-label="Split map and 3D"
              aria-pressed={view === "split"}
              onClick={() => setView("split")}
            >
              <Columns3 size={15} />
            </Button>
          </div>
          <div className="drawer-toggles">
            <Button
              variant="outline"
              aria-label={leftOpen ? (mode==='public'?"Hide pick-a-site drawer":"Hide site drawer") : (mode==='public'?"Pick a site":"Show site drawer")}
              aria-expanded={leftOpen}
              onClick={() => setLeftOpen(!leftOpen)}
            >
              <Navigation size={15} />
              {mode==='public'?'Pick a site':'Sites'}
            </Button>
            <Button
              variant="outline"
              aria-label={rightOpen ? "Hide inspector" : "Show inspector"}
              aria-expanded={rightOpen}
              onClick={() => setRightOpen(!rightOpen)}
            >
              <SlidersHorizontal size={15} />
              Inspector
            </Button>
          </div>
            <div className="header-asset-focus" role="group" aria-label="3D asset focus">{(mode==='public'?(['moon','earth'] as const):(['moon','earth','lander'] as const)).map(value=><Button key={value} variant="ghost" aria-pressed={assetFocus===value} disabled={value==='earth'&&!physicalAsset('earth',sceneContext?.rangeKm)} onClick={()=>requestAssetFocus(value)}>{value==='moon'?'Moon':value==='earth'?'Earth':'Lander'}</Button>)}</div>
            <div className="header-scene-controls" ref={setControlsTarget} hidden={view==='map'} />
            {mode!=='public'&&<Button variant="outline" aria-label="Replan mission" disabled={!evidenceManifest} onClick={openReplanning}><Columns3 size={15}/>Replan mission</Button>}
            {mode==='teach'&&<Button variant="outline" onClick={openTeachingStudio} disabled={!evidenceManifest}>Teaching studio</Button>}
            {mode==='plan'&&<Button variant="outline" onClick={openEngineeringEvidence} disabled={!evidenceManifest||!planning.result}>Engineering evidence</Button>}
            {mode!=='public'&&<Button className="header-learn" variant="ghost" aria-label={mode==='plan'?'Var':'Learn'} aria-pressed={mode==='plan'?rightOpen&&panel==='variables':learnOpen} onClick={()=>mode==='plan'?openPanel('variables'):setLearnOpen(true)}><BookOpen size={15}/>{mode==='plan'?'Var':'Learn'}</Button>}
            {mode!=='public'&&<Button variant="ghost" onClick={()=>{setPlaying(false);setFlightPlaying(false);setTouchdownOpen(true);}}>Lab</Button>}
            {mode==='public'&&<Button variant="outline" aria-label="Compare sites and dates" onClick={()=>{setCompareMinimized(false);setCompareOpen(true);}}><Columns3 size={15}/>Compare</Button>}
            <Button variant="outline" aria-label="Show a delayed landing" disabled={!evidenceManifest} onClick={exploreDelayDemo}>Show a delayed landing</Button>
          </div>

        </header>
        {focusMode&&<Button className="focus-restore glass" variant="outline" onClick={()=>setFocusMode(false)}><Maximize2 size={15}/> Show controls</Button>}
        {learnOpen&&!focusMode&&<LearningDialog mode={mode} onClose={()=>setLearnOpen(false)}/>}
        {touchdownOpen&&<dialog aria-label="Touchdown experiment" onCancel={e=>{e.preventDefault();setTouchdownOpen(false);}} ref={node=>{if(node&&!node.open)node.showModal();}} style={{position:'fixed',inset:16,width:'calc(100vw - 32px)',height:'calc(100dvh - 32px)',maxWidth:'none',maxHeight:'none',padding:0,border:0,borderRadius:20,overflow:'hidden'}}><TouchdownLab onClose={()=>setTouchdownOpen(false)}/></dialog>}
        {solarOverviewOpen&&<dialog aria-label="Sun Earth Moon scale explorer" onCancel={e=>{e.preventDefault();setSolarOverviewOpen(false);}} ref={node=>{if(node&&!node.open)node.showModal();}} style={{position:'fixed',inset:16,width:'calc(100vw - 32px)',height:'calc(100dvh - 32px)',maxWidth:'none',maxHeight:'none',padding:0,border:0,borderRadius:20,overflow:'hidden'}}><SolarSystemView catalog={catalog} timeIndex={playhead} onClose={()=>setSolarOverviewOpen(false)}/></dialog>}
        {teachingStudioOpen&&evidenceManifest&&<WorkspaceDialog label="Teaching studio" onClose={()=>setTeachingStudioOpen(false)}><TeachingStudio catalog={catalog} manifest={evidenceManifest} state={state} onChange={next=>update(next)} onCompare={(base,candidate)=>{setTeachingStudioOpen(false);comparePair(base,candidate);}} onClose={()=>setTeachingStudioOpen(false)}/></WorkspaceDialog>}
        {engineeringVisited&&evidenceManifest&&planning.result&&<WorkspaceDialog label="Engineering evidence workspace" open={engineeringOpen} onClose={()=>setEngineeringOpen(false)}><EngineeringEvidenceWorkspace catalog={catalog} manifest={evidenceManifest} state={state} assessment={planning.result} onInspect={index=>{setEngineeringOpen(false);setPlaying(false);setFlightPlaying(false);setPlayhead(Math.max(state.startIndex,Math.min(state.endIndex,index)));openPanel('analysis');}} onClose={()=>setEngineeringOpen(false)}/></WorkspaceDialog>}
        <AudienceGuide mode={mode} open={guideOpen&&brandIntroReady} onClose={() => setGuideOpen(false)}/>
        <main
          id="lunar-workspace"
          className="workspace"
          aria-label="Lunar workbench"
          style={{'--active-inspector-width':`${inspectorWidth}px`} as CSSProperties}
        >
          <div className={`viewport ${view === "split" ? "split-view" : ""}`}>
            <>
            {view !== "terrain" && (
              <div className="map-pane" key="map">
                {mapArea==='global'?<GlobalMap sites={mapSites} selectedId={state.custom?null:site.id} compareIds={saved.map(s=>s.state.siteId)} custom={state.custom} onSelect={selectSite} onPlace={(lat,lon)=>{if(mode==='public'&&headingVisible)setHeadingMinimized(false);update({custom:{lat,lon},terrainMode:state.terrainMode??'prepared'});setLatDraft(`${Math.abs(lat).toFixed(4)} ${lat<0?'S':'N'}`);setLonDraft(lon.toFixed(4));}}/>:<PolarMap
                  catalog={catalog}
                  sites={mapSites.filter(s=>s.lat<=-80)}
                  selectedId={state.custom ? null : site.id}
                  compareIds={saved.map((v) => v.state.siteId)}
                  custom={state.custom}
                  timeIndex={Math.floor(playhead)}
                  expanded
                  imagery={imagery}
                  lighting={light}
                  onSelect={selectSite}
                  onPlace={(lat, lon) => {
                    if(mode==='public'&&headingVisible)setHeadingMinimized(false);
                    update({ custom: { lat, lon }, terrainMode:state.terrainMode??'prepared' });
                    setLatDraft(`${Math.abs(lat).toFixed(4)} ${lat<0?"S":"N"}`);
                    setLonDraft(String(lon.toFixed(4)));
                  }}
                />}
              </div>
            )}
            {view !== "map" && (
              <div className="terrain-pane" key="terrain">
                <LunarScene
                  assetFocus={assetFocus}
                  earthBodyKm={scenePositions.earth}
                  sunBodyKm={scenePositions.sun}
                  onPlace={(lat,lon)=>{if(mode==='public'&&headingVisible)setHeadingMinimized(false);update({custom:{lat,lon},terrainMode:'global-at-point'});setLatDraft(`${Math.abs(lat).toFixed(4)} ${lat<0?'S':'N'}`);setLonDraft(lon.toFixed(4));setNotice('Custom point selected. Coarse terrain context is not a measured landing-footprint assessment.');}}
                  earthRangeKm={sceneContext?.rangeKm}
                  sunRangeKm={sceneContext?.sunRangeKm??undefined}
                  epochMs={sceneContext?.epochMs}
                  onAssetFocusChange={requestAssetFocus}
                  focusRequestId={focusRequestId}
                  followRequest={followRequest}
                  onTrackingReady={setFlightTrackingReady}
                  controlsTarget={controlsTarget}
                  flightPlaying={flightPlaying}
                  landingConfiguration={state.flight.landing}
                  onLandingDynamics={onLandingDynamics}
                  audienceMode={mode}
                  siteEarthContact={current?.contact??null}
                  offline={typeof globalThis.location!=='undefined'&&globalThis.location.protocol==='file:'}
                  sites={sceneSites}
                  selectedSiteId={state.custom?CUSTOM_MARKER_ID:site.id}
                  onSelectSite={id=>{if(id===CUSTOM_MARKER_ID){setRightOpen(true);setPanel(mode==='plan'?'plan':'overview');}else selectSite(id);}}
                  terrain={sceneTerrain}
                  imagery={imageryData}
                  referenceHeightM={referenceHeightM}
                  lat={location.lat}
                  lon={location.lon}
                  pose={pose}
                  sunAngularRadiusDeg={series.sunRadius[Math.floor(relative)]}
                  earthAngularRadiusDeg={series.earthRadius[Math.floor(relative)]}
                  horizon={terrain}
                  map={catalog.map}
                  flight={flight}
                  flightTime={flightTime}
                  showFlight={showFlight}
                />
              </div>
            )}
            </>
          </div>
          {headingVisible?<div hidden={focusMode} className={`workspace-heading ${headingMinimized?'location-minimized':''}`}>
            <div className="location-actions"><Button variant="ghost" size="icon" aria-label={headingMinimized?'Expand location card':'Minimize location card'} onClick={()=>setHeadingMinimized(v=>!v)}>{headingMinimized?<ChevronDown size={14}/>:<ChevronUp size={14}/>}</Button><Button variant="ghost" size="icon" aria-label="Dismiss location card" onClick={()=>setHeadingVisible(false)}><X size={14}/></Button></div>
            <div>
              <p>Moon / {mapArea==="global"?"Whole Moon":"South polar region"}</p>
              <h1>{name}</h1>
              <span>
                {formatLat(location.lat)} &nbsp;{" "}
                {(((location.lon % 360) + 360) % 360).toFixed(4)}° E ·{" "}
                {terrain.heightM} m observer
              </span><small className="terrain-source-caption">{isGlobalTerrainChoice(terrain)?'≈4.3 km coarse terrain context':terrain.mask.some(Number.isFinite)?terrain.exact?'Prepared site horizon':`Borrowed horizon · ${number(terrain.distanceKm,2)} km away`:'Terrain horizon unavailable'}</small>{!terrain.mask.some(Number.isFinite)&&catalog.globalTerrain&&state.terrainMode!=='global-context'&&<Button className="terrain-context-action" variant="ghost" onClick={()=>update({terrainMode:'global-context'})} title="Uses calibrated coarse LOLA elevations at approximately4.3km spacing; fine obstacles remain unassessed">Calculate coarse global context</Button>}
              {mode==='public'&&!headingMinimized&&<PublicSiteStory site={state.custom?null:site} sites={catalog.sites} lat={location.lat} lon={location.lon} radiusM={catalog.meta.moonRadiusM}/>}
            </div>
          </div>:<Button hidden={focusMode} className="location-restore glass" variant="outline" onClick={()=>setHeadingVisible(true)}><Navigation size={14}/> Location</Button>}
          {leftOpen && (
            <aside hidden={focusMode} className="site-drawer glass" aria-label="Landing sites">
              <div className="drawer-heading">
                <h2>
                  Sites & missions <span>{catalog.sites.length}</span>
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close site drawer"
                  onClick={() => setLeftOpen(false)}
                >
                  <X />
                </Button>
              </div>
              <label className="site-search">
                <Search size={14} />
                <Input
                  aria-label="Search landing sites"
                  placeholder="Find a site"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <select className="site-filter" aria-label="Filter landing sites" value={siteFilter} onChange={e=>setSiteFilter(e.target.value as typeof siteFilter)}><option value="all">All sites and missions</option><option value="polar">South-pole sites</option><option value="apollo">Apollo landings</option><option value="robotic">Robotic landings</option><option value="attempt">Landing attempts</option></select>
              <div className="site-list">
                {groupSites
                  .filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))
                  .map((s) => (
                    <button
                      key={s.id}
                      className={`site-item ${s.id === site.id && !state.custom ? "selected" : ""}`}
                      onClick={() => selectSite(s.id)}
                    >
                      <span
                        className={`site-symbol ${s.group === "derived" ? "derived" : ""}`}
                      />
                      <span>
                        <strong>{s.name}</strong>
                        <small>{GROUP_LABEL[s.group]}{s.mission?.coordinateKind==="planned-target"?" · planned target":s.mission?.approximate?" · approximate":s.mission?.outcome==="partial"?" · off-nominal":""}</small>
                      </span>
                      {s.id === site.id && !state.custom && <Check size={13} />}
                    </button>
                  ))}
                {!catalog.sites.some((s) =>
                  s.name.toLowerCase().includes(query.toLowerCase()),
                ) && (
                  <p className="muted">
                    No matching site. Try another name or coordinates.
                  </p>
                )}
              </div>
              <details className="coordinate-form">
                <summary>
                  Use custom coordinates <Plus size={13} />
                </summary>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const lat = parseLatitude(latDraft),
                      lon = parseLongitude(lonDraft);
                    if (lat == null || lon == null) {
                      setCoordError(
                        "Enter latitude −90° to 90° and longitude −180° to 360°.",
                      );
                      return;
                    }
                    update({ custom: { lat, lon }, terrainMode:state.terrainMode??'prepared' });
                    if(lat>-80)setMapArea("global");
                    setCoordError("");
                  }}
                >
                  <label>
                    Latitude <Info label="Latitude" />
                    <Input
                      aria-label="Custom latitude"
                      value={latDraft}
                      onChange={(e) => setLatDraft(e.target.value)}
                    />
                  </label>
                  <label>
                    Longitude <Info label="Longitude" />
                    <Input
                      aria-label="Custom longitude"
                      value={lonDraft}
                      onChange={(e) => setLonDraft(e.target.value)}
                    />
                  </label>
                  <Button type="submit" variant="outline">
                    Use coordinates <ArrowRight size={13} />
                  </Button>
                  {coordError && (
                    <p className="input-error" role="alert">
                      {coordError}
                    </p>
                  )}
                </form>
              </details>
              <div className="site-drawer-footer">
                <span>{catalog.sites.length} sites · sourced coordinates</span>
                <button onClick={() => openPanel("sources")}>
                  Source details
                </button>
              </div>
            </aside>
          )}
          {rightOpen && (
            <aside
              hidden={focusMode}
              className={`inspector glass ${panel === "analysis" ? "inspector-wide" : ""}`}
              aria-label="Scenario inspector"
              id="scenario-inspector"
              style={{width:inspectorWidth,maxWidth:'calc(100% - 32px)'}}
            >
              <div className="inspector-resize-handle" role="separator" tabIndex={0} aria-label="Resize scenario inspector" aria-orientation="vertical" aria-controls="scenario-inspector" aria-valuemin={inspectorLimits.min} aria-valuemax={inspectorLimits.max} aria-valuenow={inspectorWidth}
                onPointerDown={e=>{inspectorResize.current={pointerId:e.pointerId,x:e.clientX,width:inspectorWidth};e.currentTarget.setPointerCapture(e.pointerId);}}
                onPointerMove={e=>{const drag=inspectorResize.current;if(drag&&drag.pointerId===e.pointerId)setPreferredInspectorWidth(Math.max(inspectorLimits.min,Math.min(inspectorLimits.max,drag.width+drag.x-e.clientX)));}}
                onPointerUp={e=>{inspectorResize.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
                onPointerCancel={()=>{inspectorResize.current=null;}}
                onKeyDown={e=>{const next=e.key==='ArrowLeft'?inspectorWidth+32:e.key==='ArrowRight'?inspectorWidth-32:e.key==='Home'?inspectorLimits.min:e.key==='End'?inspectorLimits.max:null;if(next!==null){e.preventDefault();e.stopPropagation();setPreferredInspectorWidth(Math.max(inspectorLimits.min,Math.min(inspectorLimits.max,next)));}}}><span aria-hidden="true">⋮</span></div>
              <div className="inspector-nav">
                <Button variant="ghost" size="icon" aria-label={inspectorWidth<700?'Widen inspector':'Compact inspector'} title="Change panel width; drag its left edge for a custom size" onClick={()=>setPreferredInspectorWidth(inspectorWidth<700?Math.min(800,inspectorLimits.max):inspectorLimits.min)}><Maximize2 size={16}/></Button>
                {tabs.map(([p, label, Icon]) => (
                  <Button
                    key={p}
                    variant="ghost"
                    size="icon"
                    title={label}
                    aria-label={label}
                    aria-pressed={panel === p}
                    onClick={() => openPanel(p)}
                  >
                    <Icon size={17} />
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close inspector"
                  onClick={() => setRightOpen(false)}
                >
                  <X size={15} />
                </Button>
              </div>
              <div className="inspector-scroll" key={panel}>
          {evidenceManifest&&planning.result&&<details className="mission-task-context"><summary>Mission context & next steps</summary><div aria-label="Audience task context" role="region"><AudienceTaskStrip key={mode} mode={mode} catalog={catalog} manifest={evidenceManifest} state={state} assessment={planning.result} playhead={playhead} siteName={name} onInspect={()=>openPanel(mode==='plan'?'plan':mode==='teach'?'teach':'overview')} onReplan={openReplanning} onTeach={openTeachingStudio}/></div></details>}
                {panel==='variables'&&<VariableReference key={assetFocus} topicId={assetFocus==='earth'?'communications':assetFocus==='lander'?'descent':'light'}/>}
                <details hidden={panel==='variables'} className="audience-mode-context" open={!audienceContextCollapsed} onToggle={e=>setAudienceContextCollapsed(!e.currentTarget.open)}><summary>{mode==='public'?'How to read this site':mode==='teach'?'Equations & guided investigation':'Planning context & decision margins'}</summary><AudienceContextPanel mode={mode} state={state} assessment={planning.result} siteName={name}/></details>
                {panel === "overview" && (
                  <>
                    <Button className="wide-button" variant="outline" disabled={!evidenceManifest} onClick={exploreDelayDemo} aria-label="Show a delayed landing">Show a delayed landing</Button>
                    {demoContrastLine&&<aside className="constraint" aria-label="Delayed landing contrast"><strong>Terrain vs smooth Moon</strong><p>{demoContrastLine}</p></aside>}
                    <Section title="At this moment">
                      {summary.known < summary.samples && <p className="constraint warning">{summary.known===0?"No local terrain horizon is prepared for this site. The smooth-sphere figures below exclude local hills and craters.":`Terrain coverage is known for ${number(100 * summary.known / summary.samples, 1)}% of this period. Visibility percentages use known samples; interrupted darkness forecasts remain unknown.`}</p>}
                      <div className="instant-status">
                        <span
                          className={current?.sun ? "sun-dot" : "shadow-dot"}
                        />
                        {current?.sun === null
                          ? (mode==='public'?"We do not know if sunlight reaches here":"Sunlight unknown")
                          : current?.sun
                            ? (mode==='public'?"Sunlight reaches this place":"In sunlight")
                            : (mode==='public'?"Sun is hidden behind the hills":"In shadow")}
                        <span
                          className={
                            current?.contact ? "earth-dot" : "shadow-dot"
                          }
                        />
                        {current?.contact === null
                          ? (mode==='public'?"Earth view is unknown":"Earth view unknown")
                          : current?.contact
                            ? (mode==='public'?"Earth is above the hills":"Earth in view")
                            : (mode==='public'?"Earth is hidden behind the hills":"Earth below mask")}
                      </div>
                      <p className="muted">{poseDescription}</p>
                    </Section>
                    {state.custom&&!isGlobalTerrainChoice(terrain)&&terrain.distanceKm!==null&&terrain.distanceKm>0&&<aside className="constraint warning"><strong>Borrowed horizon, not a measurement at this pin</strong><p>These terrain metrics use {Math.abs(terrain.cellLat??0).toFixed(4)}° {((terrain.cellLat??0)<0?'S':'N')}, {terrain.cellLon?.toFixed(4)}° E, {number(terrain.distanceKm,2)} km away. Nearby crater rims can give very different results.</p>{catalog.globalTerrain&&<Button variant="outline" onClick={()=>update({terrainMode:'global-at-point'})}>Evaluate these exact coordinates</Button>}<p>Exact-coordinate context uses approximately 4.3 km global terrain sampling; it does not resolve local obstacles.</p></aside>}
                    <div className="metric-grid">
                      <Metric
                        label="Time in sunlight"
                        value={number(summary.sunlitTerrain * 100)}
                        unit="%"
                        sphere={formatPercent(summary.sunlitSphere)}
                      />
                      <Metric
                        label={mode==='public'?"Earth in view":"Earth contact"}
                        detail={mode==='public'
                          ?`From ${state.heightM} m above the ground, Earth must clear the surrounding hills. Terrain-only share of samples: ${number((terrainOnlySummary?.earthTerrain??NaN)*100)}%. Seeing Earth is not the same as a working radio link.`
                          :`At the ${state.heightM} m display height, Earth must clear both terrain and the ${state.mission.antennaMaskDeg}° minimum antenna elevation above horizontal. Terrain-only visibility: ${number((terrainOnlySummary?.earthTerrain??NaN)*100)}%.${state.antennaHeightM!==state.heightM?` The mission antenna is at ${state.antennaHeightM} m and has ${number((mission.contactFraction??NaN)*100)}% contact geometry.`:""} This is not a confirmed radio service.`}
                        value={number(summary.earthTerrain * 100)}
                        unit="%"
                        sphere={formatPercent(summary.earthSphere)}
                      />
                      <Metric
                        label="Longest darkness"
                        value={`${observedDark?.lowerBound?"≥ ":""}${number(summary.longestDarkTerrain, 0)}`}
                        detail={observedAbsenceNote(observedDark,"modeled sunlight")}
                        unit="h"
                        sphere={`${number(summary.longestDarkSphere, 0)} h`}
                      />
                      <Metric
                        label="Longest blackout"
                        value={`${observedBlackout?.lowerBound?"≥ ":""}${number(mission.longestBlackoutHours, 0)}`}
                        unit="h"
                        detail={`Includes antenna mask. ${observedAbsenceNote(observedBlackout,"modeled Earth contact")}`}
                      />
                    </div>
                    <Section title="Terrain evidence"><p className="muted">{isGlobalTerrainChoice(terrain)?'Calculated here from calibrated global LOLA elevations. Approximately 4.3 km equatorial output spacing; local obstacles are unresolved. This is conditional terrain context, not fine landing-site evidence.':terrain.mask.some(Number.isFinite)?'Prepared site or nearest polar-grid horizon; original source resolution and observer height are retained.':'No prepared terrain horizon covers this request. Sun/Earth geometry remains available; terrain-dependent results are unknown.'}</p><label>Terrain calculation mode<select aria-label="Terrain calculation mode" value={state.terrainMode??'prepared'} onChange={e=>update({terrainMode:e.target.value as ScenarioState['terrainMode']})}><option value="prepared">Prepared horizons only</option><option value="global-context">Prepared first, coarse global fallback</option><option value="global-at-point">Coarse global at exact custom coordinates</option></select></label>{globalTerrainError&&<p role="status">Global numerical terrain unavailable: {globalTerrainError}</p>}</Section>
                    <VisibilityWindows catalog={catalog} mission={mission} startIndex={state.startIndex} cursor={playhead} planner={mode === "plan"} arrayHeightM={state.arrayHeightM} antennaHeightM={state.antennaHeightM} minimumElevationDeg={state.mission.antennaMaskDeg}/>
                    <Section title="Why this site matters">
                      {site.mission&&!state.custom&&<p className="muted">{site.mission.program} · {site.mission.date} · {site.mission.outcome==='landed'?'Successful landing':site.mission.outcome==='partial'?'Off-nominal touchdown':'Landing attempt'}{site.mission.approximate?' · Approximate/estimated location; see source.':''}</p>}
                      {site.mission&&!state.custom&&<details className="location-provenance"><summary>Location provenance</summary><p>{site.mission.coordinateKind==='planned-target'?'This pin is a planned target; the actual landing/impact location is unknown.':site.mission.coordinateKind==='observed'?'Published observed feature; identification and coordinate uncertainty are described in the source notes.':site.mission.approximate?'This is a reported approximate region, not a precisely observed landing point.':'Published spacecraft position; coordinate precision does not imply zero uncertainty.'}</p>{site.mission.frame&&<p>Frame: {site.mission.frame}</p>}{site.mission.accuracy&&<p>{site.mission.accuracy}</p>}{site.mission.sourceNotes&&<p>{site.mission.sourceNotes}</p>}{site.mission.supportingSourceUrls?.map((url,i)=><p key={url}><a href={url} target="_blank" rel="noreferrer">Supporting source {i+1}</a></p>)}<p>Mission date is historical context. Visibility is evaluated for your selected catalog epoch, not a reconstruction of the original flight.</p></details>}
                      <p>
                        {state.custom
                          ? (isGlobalTerrainChoice(terrain)?"A custom lunar coordinate evaluated with a coarse numerical global terrain horizon at these coordinates.":terrain.mask.some(Number.isFinite)?"A custom lunar coordinate. Sun/Earth geometry is evaluated here; its terrain horizon is borrowed from a nearby precomputed cell.":"A custom lunar coordinate outside prepared terrain-horizon coverage. Sun/Earth geometry and a smooth-sphere reference are available; terrain-based visibility and resources remain unknown.")
                          : site.summary}
                      </p>
                      {state.custom && !isGlobalTerrainChoice(terrain) && terrain.distanceKm !== null && (
                        <div className="constraint warning">
                          Nearest horizon cell is {number(terrain.distanceKm)}{" "}
                          km away. Fixed {terrain.heightM} m observer;{" "}
                          {terrain.stepDeg}° azimuth sampling.
                        </div>
                      )}
                      {!state.custom && (
                        <>
                          <p className="site-facts">
                            <span>
                              Elevation
                              <Info label="Site elevation" />
                              <strong>{number(site.demHeightM, 0)} m</strong>
                            </span>
                            <span>
                              Slope (40 m DEM)<Info label="Surface slope" />
                              <strong>{number(site.slopeDeg)}°</strong>
                            </span>
                          </p>
                          {site.group === "derived" && (
                            <p className="muted">
                              Derived LOLA sample, not a published NASA landing
                              pin.
                            </p>
                          )}
                          <a
                            className="resource-link"
                            href={site.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Published coordinate source <ArrowRight size={12} />
                          </a>
                        </>
                      )}
                    </Section>
                    <Section title="A different kind of day"><p className="muted">Earth’s day is about 24 hours. A lunar sunrise-to-sunrise cycle averages about 29.5 Earth days; near the poles, low Sun angles and local terrain break that simple pattern. The next sunlight and Earth-visibility changes above come from this site and date, not that average.</p><a className="resource-link" href="https://science.nasa.gov/wp-content/uploads/2023/05/ladee-press-kit-08292013.pdf" target="_blank" rel="noreferrer">NASA lunar-day reference</a></Section>
                    <Section title="See the terrain change the result">
                      <p className="muted">
                        At the south pole, a crater rim can hide the Sun or
                        Earth. The smooth-sphere values show how much local
                        terrain changes the picture.
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => openPanel("analysis")}
                      >
                        Inspect the horizon <ArrowRight size={13} />
                      </Button>
                    </Section>
                    <Button
                      className="wide-button"
                      onClick={() => openPanel("flight")}
                    >
                      <Rocket size={15} />
                      Preview a lunar flight
                    </Button>
                    <Button
                      variant="ghost"
                      className="wide-button"
                      onClick={() => {
                        saveScenario();
                        setComparisonMode('saved');setCompareMinimized(false);
                        setCompareOpen(true);
                      }}
                    >
                      <Plus size={15} />
                      Save to comparison
                    </Button>
                  </>
                )}
                {panel === "plan" && (
                  <>
                    {planning.result&&<details className="planning-details"><summary>Why this plan has this result</summary><AssessmentExplanation assessment={planning.result}/></details>}
                    <DataConnections missionStartUtc={new Date(indexToMs(catalog,state.startIndex)).toISOString()} missionEndUtcExclusive={new Date(indexToMs(catalog,state.endIndex+1)).toISOString()} mode={mode} offline={globalThis.location?.protocol==='file:'}/>
                    <DecisionPanel state={state} result={planning.result} error={planning.error} stepHours={catalog.meta.stepHours} onChange={next=>update(next)} onInspect={i=>{setPlaying(false);setPlayhead(state.startIndex+i);setPanel("analysis");}}/>
                    {evidenceManifest&&<><Button className="wide-button" variant="outline" onClick={exploreDelayDemo} aria-label="Show a delayed landing">Show a delayed landing</Button><Button className="wide-button" onClick={()=>{setComparisonMode('calendar');setCompareMinimized(false);setCompareOpen(true);}}>Find whole-mission arrival windows</Button><SensitivityPanel catalog={catalog} manifest={evidenceManifest} state={state} onOpen={openSavedScenario} onSave={saveExactScenario}/><DecisionPackageControls catalog={catalog} manifest={evidenceManifest} state={state} onImport={openSavedScenario}/></>}
                    <Section title="Replan a slipped mission" detail="Hold the stay length and hardware constant. Screen date slips and nearby sites against your own power, contact and terrain limits."><Button className="wide-button" onClick={openAlternatives}><Columns3 size={15}/> Compare alternative dates & sites</Button></Section>
                    <Section
                      title="Mission resource budget"
                      detail="Your vehicle assumptions, evaluated at this site across the selected stay."
                    />
                    <div className="metric-grid">
                      <Metric
                        label="Generated energy"
                        value={number(
                          mission.generatedWh == null
                            ? null
                            : mission.generatedWh / 1000,
                          2,
                        )}
                        unit="kWh"
                        sphere={`${number(sphere.generatedWh == null ? null : sphere.generatedWh / 1000, 2)} kWh`}
                      />
                      <Metric
                        label="Minimum battery"
                        value={number(mission.minBatteryWh, 0)}
                        unit="Wh"
                        sphere={`${number(sphere.minBatteryWh, 0)} Wh`}
                      />
                    </div>
                    <PlannerInputs
                      radio={state.radio ?? {}}
                      onRadioChange={(radio) => update({radio})}
                      value={state.mission}
                      onChange={(mission) => update({ mission })}
                      result={mission}
                    />
                    <details className="resource-graphs">
                      <summary>Power & storage plots</summary>
                      <ResourceGraphs
                        cursor={relative}
                        onCursor={index=>{setPlaying(false);setPlayhead(Math.max(state.startIndex,Math.min(state.endIndex,series.index0+index)));}}
                        catalog={catalog}
                        series={series}
                        result={mission}
                        sphereResult={sphere}
                        reserveWh={
                          state.mission.batteryWh * state.mission.reserveSoc
                        }
                      />
                    </details>
                    <Button
                      className="wide-button"
                      onClick={() => {
                        saveScenario();
                        setComparisonMode('saved');setCompareMinimized(false);
                        setCompareOpen(true);
                      }}
                    >
                      Compare this configuration
                    </Button>
                  </>
                )}
                {panel === "teach" && (
                  <>
                  <TeachPanel
                    heightM={state.heightM}
                    onHeight={(heightM) => update({ heightM })}
                    custom={!!state.custom}
                    onDateShift={shift}
                    onSite={selectSite}
                  />
                  {evidenceManifest&&!teachingStudioOpen&&<TeachingWorkbench catalog={catalog} manifest={evidenceManifest} state={state} onChange={next=>update(next)} onCompare={comparePair}/>}
                  </>
                )}
                {panel === "flight" && flight && (
                  <>
                    <FlightPanel
                      value={state.flight}
                      onChange={(flight) => {if(update({flight})){landingConfigured.current=true;flightClock.current=null;setPendingFlightPlay(false);setFlightPlaying(false);setFlightTime(0);}}}
                      result={flight}
                      playing={flightPlaying}
                      preparing={pendingFlightPlay}
                      onPlay={()=>playFlightExperiment()}
                      onPause={()=>{setPendingFlightPlay(false);if(flightPlaying)toggleFlightPlayback();}}
                      onReplay={()=>playFlightExperiment(true)}
                      onFollow={followFlightExperiment}
                    />
                    <details className="flight-secondary"><summary>Guidance, path colours & separate touchdown lab</summary>
                      <HeaderLandingStatus outcome={landingFlight?.landingOutcome}
                        assisted={state.flight.landing?.guidance==='target-landing'}
                        contactActive={contactActive} dynamics={dynamics}
                        onReset={()=>{if(update({flight:createLandingFlight(state.flight,true)})){landingConfigured.current=true;setFlightPlaying(false);setFlightTime(0);}}}/>
                      <Button variant="outline" onClick={()=>{setPlaying(false);setFlightPlaying(false);setTouchdownOpen(true);}}>Explore rigid-body touchdown</Button>
                      <p className="muted">Separate experiment: release the real-size NASA display model over a synthetic plane, rather than this selected site.</p>
                    </details>
                    <FlightGraphs
                      flight={flight}
                      cursor={flightTime}
                      onCursor={(t) => {
                        setFlightPlaying(false);
                        setFlightTime(t);
                      }}
                    />
                  </>
                )}
                {panel === "analysis" && (
                  <>
                    <div className="observer-bar">
                      <span>
                        Observer height <Info label="Observer height" />
                      </span>
                      <div className="segmented">
                        {[0, 2, 10].map((h) => (
                          <Button
                            key={h}
                            variant="ghost"
                            aria-pressed={state.heightM === h}
                            disabled={!!state.custom && (state.terrainMode??'prepared')==='prepared' && h!==2}
                            onClick={() => update({ heightM: h })}
                          >
                            {h} m
                          </Button>
                        ))}
                      </div>
                      {state.custom && (
                        <p className="muted">
                          Prepared custom horizons are fixed at 2 m. Explicit global terrain supports 0, 2 and 10 m with coarse sampling.
                        </p>
                      )}
                    </div>
                    <AnalysisPanel
                      catalog={catalog}
                      series={series}
                      terrain={terrain}
                      summary={summary}
                      antennaMaskDeg={state.mission.antennaMaskDeg}
                      observerHeightM={state.heightM}
                      cursor={relative}
                      onCursor={(n) => {
                        setPlaying(false);
                        setPlayhead(series.index0 + n);
                      }}
                    />
                  </>
                )}
                {panel === "dates" && (terrain.mask.some(Number.isFinite) ? (
                  <DateSearch
                    key={`${site.id}-${state.custom?.lat}-${state.custom?.lon}-${state.heightM}`}
                    catalog={catalog}
                    lat={location.lat}
                    lon={location.lon}
                    terrain={terrain}
                    onOpen={range}
                  />
                ) : <Section title="Landing-date search"><p>There is no numerical terrain horizon for this location. A terrain-based date ranking is unavailable. Horizon analysis still shows Sun/Earth geometry and the smooth-sphere reference.</p></Section>)}
                {panel === "sources" && <><Button variant="outline" className="wide-button" onClick={()=>{setPlaying(false);setFlightPlaying(false);setSolarOverviewOpen(true);}}>Explore Sun, Earth & Moon at true scale</Button><DataConnections missionStartUtc={new Date(indexToMs(catalog,state.startIndex)).toISOString()} missionEndUtcExclusive={new Date(indexToMs(catalog,state.endIndex+1)).toISOString()} mode={mode} offline={typeof location!=='undefined'&&globalThis.location?.protocol==='file:'}/><ResourcesPanel catalog={catalog} /></>}
              </div>
              <div className="inspector-footer">
                <span className="data-status-dot" />
                Hourly ephemeris · {terrain.mask.some(Number.isFinite) ? "Terrain-aware horizons" : "No local terrain horizon"}
              </div>
            </aside>
          )}
          <div className="map-bottom-tools" hidden={focusMode}>
            {view!=="terrain"&&mapArea==="polar"&&<div className="glass layer-tools">
              <Button
                variant="ghost"
                aria-expanded={layers}
                onClick={() => setLayers(!layers)}
              >
                <Layers size={15} />
                Layers
              </Button>
              <Button
                variant="ghost"
                aria-label="Show full map"
                title="Hide panels and controls; use Show controls to restore them"
                onClick={() => {setFocusMode(true);setGuideOpen(false);}}
              >
                <Maximize2 size={15} />
              </Button>
            </div>}

          </div>
            <Button
              className="glass compare-toggle compare-side" data-scene-occluder aria-label="Compare scenarios" title="Compare scenarios"
              variant="ghost"
              aria-expanded={compareOpen}
              onClick={() => {setCompareMinimized(false);setCompareOpen(!compareOpen);}}
            >
              <Columns3 size={15} />
              <span className="compare-label">Compare</span> <span>{saved.length}</span>
              {compareOpen ? (
                <ChevronRight size={13} />
              ) : (
                <ChevronLeft size={13} />
              )}
            </Button>
          {layers && view!=="terrain" && mapArea==="polar" && (
            <div className="layer-popover glass">
              <h3>Map layers</h3><Button className="layer-close" size="icon" variant="ghost" aria-label="Dismiss map layers" onClick={()=>setLayers(false)}><X size={15}/></Button>
              <label>
                <input
                  type="radio"
                  name="basemap"
                  checked={!imagery}
                  onChange={() => setImagery(false)}
                />
                LOLA relief · bundled
              </label>
              <label>
                <input
                  type="radio"
                  name="basemap"
                  checked={imagery}
                  onChange={() => setImagery(true)}
                />
                LROC WAC imagery · bundled
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={light}
                  onChange={(e) => setLight(e.target.checked)}
                />
                Hourly lighting wash
              </label>
              <p>
                Imagery records historical illumination. The wash is a coarse
                horizon-grid estimate, not a per-pixel shadow simulation.
              </p>
            </div>
          )}
          {terrainError && view !== "map" && (
            <div className="terrain-notice glass">
              {terrainError} Reference surface shown.
            </div>
          )}
          {showFlight && currentFlight && !focusMode && assetFocus!=='earth' && (flightHud==='hidden'?<Button className="flight-hud-restore glass" variant="outline" onClick={()=>setFlightHud('compact')}><Rocket size={15}/> Flight controls</Button>:<div
              className={`flight-telemetry glass ${flightHud==='compact'?'flight-hud-compact':''}`}
              aria-label="Flight telemetry"
            >
              <div>
                <span>
                  Flight time {flight ? <FlightParameterInfo label="Flight time (s)" flight={flight}/> : <Info label="Flight time (s)"/>}
                </span>
                <strong>
                  {number(flightTime, 0)} <small>s</small>
                </strong>
              </div>
              <div>
                <span>
                  {contactActive?"Contact tangent up":"Radial altitude"} <Info label="Height above surface (km)" />
                </span>
                <strong>
                  {contactActive?(dynamics&&dynamics.phase!=='unsupported'?number(dynamics.yM/1000,3):"—"):number(currentFlight.altitudeM / 1000, 2)} <small>km</small>
                </strong>
              </div>
              <div>
                <span>
                  Speed <Info label="Speed (m/s)" />
                </span>
                <strong>
                  {contactActive?(dynamics&&dynamics.phase!=='unsupported'?number(dynamics.speedMps,1):"—"):number(currentFlight.speedMps, 0)} <small>m/s</small>
                </strong>
              </div>
              <div>
                <span>Propellant <Info label="Propellant" /></span>
                <strong>
                  {number(currentFlight.massKg - state.flight.dryMassKg, 0)}{" "}
                  <small>kg</small>
                </strong>
              </div>
              <div className="flight-play">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={pendingFlightPlay ? "Cancel flight preparation" : flightPlaying ? "Pause flight" : "Play flight"}
                  onClick={toggleFlightPlayback}
                >
                  {flightPlaying || pendingFlightPlay ? <Pause /> : <Play />}
                </Button>
                <Slider
                  min={0}
                  max={endFlight}
                  step={1}
                  value={[flightTime]}
                  aria-label="Flight time in seconds"
                  onValueChange={(v) => {
                    setFlightPlaying(false);
                    setFlightTime(Array.isArray(v) ? v[0] : v);
                  }}
                />
                <select
                  aria-label="Flight playback speed"
                  value={flightSpeed}
                  onChange={(e) => setFlightSpeed(Number(e.target.value))}
                >
                  <option value={1}>1×</option>
                  <option value={10}>10×</option>
                  <option value={50}>50×</option>
                </select>
              </div>
              <div className="flight-hud-actions"><Button size="icon" variant="ghost" aria-label={flightHud==='compact'?'Expand flight telemetry':'Minimize flight telemetry'} onClick={()=>setFlightHud(flightHud==='compact'?'full':'compact')}>{flightHud==='compact'?<ChevronUp size={15}/>:<ChevronDown size={15}/>}</Button><Button size="icon" variant="ghost" aria-label="Dismiss flight telemetry" onClick={()=>setFlightHud('hidden')}><X size={15}/></Button></div>
            </div>
          )}
        </main>
        {timelineMode==='hidden'?<Button hidden={focusMode} className="timeline-restore glass" variant="outline" onClick={()=>changeTimeline('compact')}><Clock3 size={15}/> Show timeline</Button>:<footer hidden={focusMode} className={`timeline glass ${timelineMode==='compact'?'timeline-compact':''}`}>
          <div className="timeline-top">
            <div className="time-stamp">
              <span>
                Mission epoch / UTC <Info label="Time (UTC)" />
              </span>
              <strong>{formatUtc(now)}</strong>
            </div>
            <div className="date-fields">
              <label>
                Landing UTC <Info label="Time (UTC)" />
                <Input
                  type="datetime-local"
                  aria-label="Landing date and time UTC"
                  min="2026-01-01T00:00"
                  max="2027-12-31T23:00"
                  value={new Date(indexToMs(catalog, state.startIndex))
                    .toISOString()
                    .slice(0, 16)}
                  onChange={(e) => {
                    const ms = Date.parse(e.target.value + "Z");
                    if (!Number.isFinite(ms)) {
                      setNotice("Enter a complete UTC landing date.");
                      return;
                    }
                    const a = Math.round((ms - catalog.t0ms) / 3600000);
                    range(a, a + (state.endIndex - state.startIndex));
                  }}
                />
              </label>
              <label>
                Stay <Info label="Stay length" />
                <select
                  aria-label="Mission duration"
                  value={
                    [156, 336, 708, 8760].includes(
                      state.endIndex - state.startIndex + 1,
                    )
                      ? state.endIndex - state.startIndex + 1
                      : "custom"
                  }
                  onChange={(e) => {
                    if (e.target.value !== "custom")
                      range(
                        state.startIndex,
                        state.startIndex + Number(e.target.value) - 1,
                      );
                  }}
                >
                  <option value={156}>6.5 days</option>
                  <option value={336}>14 days</option>
                  <option value={708}>29.5 days</option>
                  <option value={8760}>365 days</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              <label>
                End UTC <Info label="Time (UTC)" />
                <Input
                  type="datetime-local"
                  aria-label="End date and time UTC"
                  min="2026-01-01T00:00"
                  max="2028-01-01T00:00"
                  value={new Date(indexToMs(catalog, state.endIndex + 1))
                    .toISOString()
                    .slice(0, 16)}
                  onChange={(e) => {
                    const ms = Date.parse(e.target.value + "Z");
                    range(
                      state.startIndex,
                      Math.round((ms - catalog.t0ms) / 3600000) - 1,
                    );
                  }}
                />
              </label>
            </div>
            <Button
              variant="ghost"
              title="Export hourly samples"
              aria-label="Export hourly science CSV"
              onClick={() =>
                downloadText(
                  "solarreach-hourly.csv",
                  csvFor(catalog, [
                    {
                      name,
                      id: state.custom ? "custom" : site.id,
                      lat: location.lat,
                      lon: location.lon,
                      terrain,
                      series,
                    },
                  ]),
                )
              }
            >
              <Download size={16} />
            </Button>
            <div className="timeline-actions">
              <Button size="icon" variant="ghost" aria-label={timelineMode==='full'?'Minimize timeline':'Expand timeline'} aria-expanded={timelineMode==='full'} onClick={()=>changeTimeline(timelineMode==='full'?'compact':'full')}>{timelineMode==='full'?<ChevronDown size={17}/>:<ChevronUp size={17}/>}</Button>
              <Button size="icon" variant="ghost" aria-label="Dismiss timeline" onClick={()=>changeTimeline('hidden')}><X size={17}/></Button>
            </div>
          </div>
          <div className="timeline-scrub">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Reset mission time"
              onClick={() => {
                setPlaying(false);
                setPlayhead(state.startIndex);
              }}
            >
              <RotateCcw size={16} />
            </Button>
            <Button
              className="play-button"
              size="icon"
              aria-label={
                playing
                  ? "Pause environmental playback"
                  : "Play environmental playback"
              }
              onClick={toggleEnvironmentPlayback}
            >
              {playing ? <Pause size={17} /> : <Play size={17} />}
            </Button>
            <select
              aria-label="Environmental playback speed"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            >
              <option value={1}>1 h/s</option>
              <option value={6}>6 h/s</option>
              <option value={24}>1 d/s</option>
            </select>
            <div className="timeline-track">
              <Slider
                min={state.startIndex}
                max={Math.max(state.startIndex + 1, state.endIndex)}
                step={1}
                value={[playhead]}
                aria-label="Mission time"
                onValueChange={(v) => {
                  setPlaying(false);
                  setPlayhead(Array.isArray(v) ? v[0] : v);
                }}
              />
              <div
                className="window-strips"
                aria-label="Sunlight and Earth contact intervals"
              >
                <div>
                  {mission.timeline
                    .filter(
                      (_, i) =>
                        i %
                          Math.max(
                            1,
                            Math.ceil(mission.timeline.length / 600),
                          ) ===
                        0,
                    )
                    .map((p, i) => (
                      <i
                        key={i}
                        style={{
                          background:
                            p.sun === null
                              ? "#7c8491"
                              : p.sun
                                ? "var(--sun)"
                                : "#303742",
                        }}
                      />
                    ))}
                </div>
                <div>
                  {mission.timeline
                    .filter(
                      (_, i) =>
                        i %
                          Math.max(
                            1,
                            Math.ceil(mission.timeline.length / 600),
                          ) ===
                        0,
                    )
                    .map((p, i) => (
                      <i
                        key={i}
                        style={{
                          background:
                            p.contact === null
                              ? "#7c8491"
                              : p.contact
                                ? "var(--earth)"
                                : "#303742",
                        }}
                      />
                    ))}
                </div>
              </div>
              <div className="timeline-labels">
                <span>
                  {formatUtc(indexToMs(catalog, state.startIndex), false)}
                </span>
                <span className="timeline-key">
                  <i className="sun-dot" />
                  Sunlight <i className="earth-dot" />
                  Earth view
                </span>
                <span>
                  {formatUtc(indexToMs(catalog, state.endIndex), false)}
                </span>
              </div>
            </div>
          </div>
        </footer>}
        {compareOpen&&!focusMode&&compareMinimized&&<Button className="comparison-restore glass" variant="outline" onClick={()=>setCompareMinimized(false)}>Restore comparisons</Button>}
        {compareOpen && (
          <section
            className="comparison-sheet glass"
            hidden={compareMinimized||focusMode}
            role="dialog"
            aria-modal="false"
            aria-label="Mission scenario comparisons"
          >
            <div className="comparison-header"><div className="comparison-tabs" role="group" aria-label="Comparison workspace"><Button variant="ghost" aria-pressed={comparisonMode==='replan'} onClick={openReplanning}>Replan mission</Button><Button variant="ghost" aria-pressed={comparisonMode==='alternatives'} onClick={()=>setComparisonMode('alternatives')}>Contingency planning</Button><Button variant="ghost" aria-pressed={comparisonMode==='calendar'} onClick={()=>setComparisonMode('calendar')}>Mission calendar</Button><Button variant="ghost" aria-pressed={comparisonMode==='saved'} onClick={()=>setComparisonMode('saved')}>Saved scenarios ({saved.length})</Button></div><div className="comparison-window-actions"><Button variant="ghost" size="icon" aria-label="Minimize comparisons" onClick={()=>setCompareMinimized(true)}><ChevronDown size={16}/></Button><Button variant="ghost" size="icon" aria-label="Close comparisons" onClick={()=>setCompareOpen(false)}><X size={16}/></Button></div></div>
            {notice&&<aside className="comparison-notice" aria-label="Comparison update"><span>{notice}</span><Button variant="ghost" size="icon" aria-label="Dismiss notification" onClick={()=>setNotice('')}><X size={14}/></Button></aside>}
            {demoContrastLine&&comparisonMode==='saved'&&<aside className="comparison-notice demo-contrast-notice" aria-label="Delayed landing contrast"><span>{demoContrastLine}</span></aside>}
            {comparisonMode==='saved'&&comparisonFocus&&<div className="comparison-coverage-notice">Showing the controlled comparison ({comparisonFocus.length} scenarios). <Button variant="ghost" onClick={()=>setComparisonFocus(null)}>Show all saved scenarios</Button></div>}
            {comparisonMode==='saved'&&saved.length>0&&saved.every(item=>(item.state.terrainMode??'prepared')==='prepared'&&!item.state.custom&&!catalog.sites.find(s=>s.id===item.state.siteId)?.horizons.length)&&<aside className="comparison-coverage-notice"><strong>Historical coordinates do not yet have terrain coverage.</strong><p>These records locate past spacecraft or approximate impact regions. The smooth-sphere values are geometric context; terrain, power and storage feasibility remain unassessed.</p><Button variant="outline" onClick={()=>{selectSite(catalog.meta.demo.siteId);setCompareOpen(false);setMode('plan');setPanel('plan');setRightOpen(true);}}>Use a prepared polar planning baseline</Button></aside>}
            {comparisonMode==='replan'?(evidenceManifest?<ReplanningWorkspace catalog={catalog} manifest={evidenceManifest} current={state} scenarios={saved} referenceId={comparisonReferenceId} onOpen={openSavedScenario} onInspect={inspectReplannedScenario} onSave={saveExactScenario} onCalendar={()=>setComparisonMode('calendar')} onClose={()=>setCompareOpen(false)}/>:<p>{evidenceError||'Loading evidence manifest…'}</p>):comparisonMode==='calendar'?(evidenceManifest?<MissionCalendar catalog={catalog} manifest={evidenceManifest} state={state} onOpen={openSavedScenario} onSave={saveExactScenario} onCompare={comparePair}/>:<p>{evidenceError||'Loading evidence manifest…'}</p>):comparisonMode==='alternatives'?<Alternatives catalog={catalog} baseline={state} onOpen={openSavedScenario} onSave={(scenario,name)=>{setSaved(v=>[...v,{id:crypto.randomUUID(),name,state:structuredClone(scenario)}]);setNotice('Alternative saved with its date, site and hardware assumptions.');}}/>:<Comparison
              catalog={catalog}
              key={comparisonReferenceId??'saved'}
              initialReferenceId={comparisonReferenceId}
              manifest={evidenceManifest}
              items={comparisonFocus?saved.filter(item=>comparisonFocus.includes(item.id)):saved}
              onAdd={saveScenario}
              onRemove={(id) => setSaved(saved.filter((v) => v.id !== id))}
              onOpen={openSavedScenario}
            />}
          </section>
        )}
        {notice && !focusMode && (!compareOpen || compareMinimized) && (
          <div className="notice glass" role="status">
            {notice}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Dismiss notification"
              onClick={() => setNotice("")}
            >
              <X size={14} />
            </Button>
          </div>
        )}
      </div>
    </AudienceContext.Provider>
  );
}
