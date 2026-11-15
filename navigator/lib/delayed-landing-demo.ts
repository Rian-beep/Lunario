import {buildSeries,diskFraction,formatPercent,indexToMs,type SampleSeries,type TerrainChoice} from './astro';
import {isGlobalTerrainChoice,resolveTerrainChoice} from './analysis-context';
import type {Catalog} from './catalog';
import type {EvidenceManifest} from './planning-types';
import type {ScenarioState} from './scenario';
import {evaluateScenario} from './assessment';
import {loadPlanningDemo} from './planning-demo-loader';

export const DELAYED_LANDING_ROLES=['baseline','delayed','alternative'] as const;
export type DelayedLandingRole=(typeof DELAYED_LANDING_ROLES)[number];

export const DELAYED_LANDING_CASE_NAMES={
  baseline:'Demo · original arrival',
  delayed:'Demo · delayed arrival',
  alternative:'Demo · alternative site',
} as const satisfies Record<DelayedLandingRole,string>;

export type SunSample={sun:boolean|null};

export type DelayedLandingCaseSummary={
  role:DelayedLandingRole;
  name:string;
  siteId:string;
  startIndex:number;
  endIndex:number;
  startUtc:string;
  endUtcExclusive:string;
  sunlitTerrainFraction:number;
  sunlitSphereFraction:number;
  longestDarkHours:number|null;
  state:ScenarioState;
};

export type DelayedLandingDemo={
  cases:DelayedLandingCaseSummary[];
  /** Baseline terrain vs smooth-Moon contrast for the impact one-liner. */
  contrastLine:string;
  /** Catalog index where the baseline case first has modeled sunlight. */
  baselinePlayheadIndex:number;
};

/** Fraction of samples with known sunlight that are lit; null if any sample is unknown. */
export function sunlitFraction(timeline:readonly SunSample[]):number|null{
  if(!timeline.length||timeline.some(sample=>sample.sun===null))return null;
  return timeline.filter(sample=>sample.sun).length/timeline.length;
}

/** Longest consecutive dark run in hours; null if coverage is incomplete. */
export function longestDarkHours(timeline:readonly SunSample[],stepHours:number):number|null{
  if(!timeline.length||!Number.isFinite(stepHours)||stepHours<=0||timeline.some(sample=>sample.sun===null))return null;
  let longest=0,run=0;
  for(const sample of timeline){
    if(!sample.sun){run+=1;if(run>longest)longest=run;}
    else run=0;
  }
  return longest*stepHours;
}

/** Offset into the stay timeline of the first sunlit sample, or null. */
export function firstSunlitOffset(timeline:readonly SunSample[]):number|null{
  const offset=timeline.findIndex(sample=>sample.sun===true);
  return offset>=0?offset:null;
}

/** Catalog playhead index that lands on sunlight for the stay, preferring the first lit sample. */
export function firstSunlitPlayhead(startIndex:number,endIndex:number,timeline:readonly SunSample[]):number{
  const offset=firstSunlitOffset(timeline);
  if(offset===null)return startIndex;
  return Math.max(startIndex,Math.min(endIndex,startIndex+offset));
}

/** Mission-compatible sunlight flags: any solar disk above the terrain horizon. */
export function sunlitFlagsFromSeries(series:SampleSeries):SunSample[]{
  return Array.from(series.sunEl,(el,i)=>{
    const horizon=series.sunHorizon[i],radius=series.sunRadius[i];
    if(!Number.isFinite(horizon)||!Number.isFinite(el)||!Number.isFinite(radius))return {sun:null};
    return {sun:diskFraction(el,horizon,radius)>0};
  });
}

/** First sunlit catalog index for a scenario using prepared/global terrain at the array height. */
export function firstSunlitPlayheadForScenario(catalog:Catalog,state:ScenarioState):number{
  const site=catalog.sites.find(entry=>entry.id===state.siteId);
  if(!site)return state.startIndex;
  const location=state.custom??{lat:site.lat,lon:site.lon};
  const terrain=resolveTerrainChoice(catalog,site,state.custom,state.arrayHeightM,state.terrainMode??'prepared');
  if(!terrain.mask.some(Number.isFinite))return state.startIndex;
  const series=buildSeries(catalog,location.lat,location.lon,terrain,state.startIndex,state.endIndex);
  return firstSunlitPlayhead(state.startIndex,state.endIndex,sunlitFlagsFromSeries(series));
}

/** One contrast line: terrain sunlight % against the smooth-Moon reference. */
export function formatTerrainSmoothContrast(terrainFraction:number,sphereFraction:number):string{
  if(!Number.isFinite(terrainFraction)||!Number.isFinite(sphereFraction)){
    throw new Error('Terrain and smooth-Moon sunlight fractions must be finite.');
  }
  return `${formatPercent(terrainFraction)} with real terrain against ${formatPercent(sphereFraction)} on a smooth Moon`;
}

/** True when a custom/nearest-grid prepared horizon is borrowed (not exact, not coarse global). */
export function isBorrowedHorizon(terrain:Pick<TerrainChoice,'exact'|'mask'> & {kind?:string;distanceKm?:number|null}):boolean{
  if(isGlobalTerrainChoice(terrain as TerrainChoice))return false;
  return !terrain.exact&&terrain.mask.some(Number.isFinite);
}

export function borrowedHorizonTopWarning(terrain:TerrainChoice):string|null{
  if(!isBorrowedHorizon(terrain))return null;
  const distance=terrain.distanceKm!==null&&Number.isFinite(terrain.distanceKm)
    ?` about ${terrain.distanceKm.toFixed(2)} km away`
    :'';
  const cell=terrain.cellLat!==null&&terrain.cellLon!==null
    ?` Nearest prepared cell: ${Math.abs(terrain.cellLat).toFixed(4)}° ${terrain.cellLat<0?'S':'N'}, ${((terrain.cellLon%360)+360)%360}° E${distance}.`
    :distance?` Nearest prepared cell is${distance}.`:'';
  return `Borrowed horizon warning: terrain sunlight and Earth-view results use a nearby prepared cell, not a measurement at this pin.${cell} Local crater rims can differ.`;
}

function caseName(role:DelayedLandingRole):string{
  return DELAYED_LANDING_CASE_NAMES[role];
}

export function summarizeDelayedLandingCase(
  role:DelayedLandingRole,
  state:ScenarioState,
  catalog:Catalog,
  timeline:readonly SunSample[],
  sphereTimeline:readonly SunSample[],
):DelayedLandingCaseSummary{
  const terrain=sunlitFraction(timeline);
  const sphere=sunlitFraction(sphereTimeline);
  if(terrain===null||sphere===null)throw new Error(`Demonstration case ${role} lacks complete sunlight coverage.`);
  const step=catalog.meta.stepHours;
  return {
    role,
    name:caseName(role),
    siteId:state.siteId,
    startIndex:state.startIndex,
    endIndex:state.endIndex,
    startUtc:new Date(indexToMs(catalog,state.startIndex)).toISOString(),
    endUtcExclusive:new Date(indexToMs(catalog,state.endIndex+1)).toISOString(),
    sunlitTerrainFraction:terrain,
    sunlitSphereFraction:sphere,
    longestDarkHours:longestDarkHours(timeline,step),
    state,
  };
}

/**
 * Load the three resource-screening demonstration cases into Compare:
 * Connecting Ridge baseline, same site delayed two weeks, and de Gerlache–Shackleton site-only alternative.
 * Starts the environmental clock on the first sunlit baseline sample and returns a terrain-vs-smooth contrast line.
 */
export async function loadDelayedLandingDemo(catalog:Catalog,manifest:EvidenceManifest):Promise<DelayedLandingDemo>{
  const demo=await loadPlanningDemo(catalog,manifest);
  const byRole=new Map(demo.map(item=>[item.role,item.state] as const));
  const cases:DelayedLandingCaseSummary[]=[];
  let baselineTimeline:readonly SunSample[]|null=null;
  for(const role of DELAYED_LANDING_ROLES){
    const state=byRole.get(role);
    if(!state)throw new Error(`Demonstration is missing the ${role} case.`);
    const assessment=evaluateScenario(catalog,state,manifest);
    if(role==='baseline')baselineTimeline=assessment.mission.timeline;
    cases.push(summarizeDelayedLandingCase(role,state,catalog,assessment.mission.timeline,assessment.sphereMission.timeline));
  }
  const baseline=cases[0]!;
  if(!baselineTimeline)throw new Error('Demonstration is missing the baseline sunlight timeline.');
  return {
    cases,
    contrastLine:formatTerrainSmoothContrast(baseline.sunlitTerrainFraction,baseline.sunlitSphereFraction),
    baselinePlayheadIndex:firstSunlitPlayhead(baseline.state.startIndex,baseline.state.endIndex,baselineTimeline),
  };
}
