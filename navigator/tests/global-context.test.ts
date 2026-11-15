import {test,before} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {decodeCatalog} from '../lib/catalog';import {withLandingSites} from '../lib/landing-catalog';import {LANDING_SITES} from '../lib/landing-sites';import {decodeGlobalTerrain,sampleGlobalHeight,type GlobalTerrainData} from '../lib/global-terrain';import {terrainForGlobal} from '../lib/global-horizon';import {parseEvidenceManifest} from '../lib/provenance';import {resolveAnalysisContext,resolveTerrainChoice,isGlobalTerrainChoice} from '../lib/analysis-context';import {evaluateScenario,PLANNING_MODEL_VERSION} from '../lib/assessment';import {parseScenario,type ScenarioState} from '../lib/scenario';import {createDecisionPackage,importDecisionPackage,stringifyDecisionPackage} from '../lib/decision-export';import {diffScenarios} from '../lib/scenario-diff';import {terrainForSite} from '../lib/astro';
let data:GlobalTerrainData;
const catalog=withLandingSites(decodeCatalog(JSON.parse(readFileSync('public/data/catalog.json','utf8'))),LANDING_SITES);
before(async()=>{data=await decodeGlobalTerrain(JSON.parse(readFileSync('public/data/global-terrain.json','utf8')),new Uint8Array(readFileSync('public/data/global-terrain.bin.gz')));catalog.globalTerrain=data;});
const manifest=parseEvidenceManifest(JSON.parse(readFileSync('public/data/evidence-manifest.json','utf8')));
const demo=JSON.parse(readFileSync('public/data/planning-demo.json','utf8'));const historical=demo.cases.find((v:{role:string})=>v.role==='unknown-historical').state as ScenarioState;
const bounds={siteIds:catalog.sites.map(s=>s.id),samples:catalog.meta.n,stepHours:catalog.meta.stepHours};
const legacy=parseScenario(historical,bounds)!;const globalState:ScenarioState={...legacy,terrainMode:'global-context'};
const request=(s:ScenarioState)=>({terrainMode:s.terrainMode,siteId:s.siteId,custom:s.custom,startIndex:s.startIndex,endIndex:s.endIndex,arrayHeightM:s.arrayHeightM,antennaHeightM:s.antennaHeightM,displayHeightM:s.heightM});
test('real global evidence source is present; absent and explicit prepared modes preserve historical unknown',()=>{
 const source=manifest.entries.find(e=>e.id==='horizon-global');assert.ok(source,'Parent must register actual horizon-global evidence before claiming integrated availability');assert.equal(source.coverage,'partial');assert.equal(source.sha256,data.packed.sha256);assert.ok(manifest.datasetId.includes(data.packed.decodedSha256.slice(0,16)),'Dataset identity must bind the global artifact version');
 assert.equal(legacy.terrainMode,undefined);for(const state of [legacy,{...legacy,terrainMode:'prepared' as const}]){const assessment=evaluateScenario(catalog,state,manifest);assert.equal(assessment.outcome,'incomplete');assert.equal(assessment.mission.generatedWh,null);assert.equal(assessment.evidence.find(e=>e.id==='array-horizon')!.coverage,'unavailable');}
});
test('explicit historical global context uses actual numerical masks and stays partial without borrowed-grid language',()=>{
 const before=structuredClone(globalState),context=resolveAnalysisContext(catalog,request(globalState),manifest),site=catalog.sites.find(s=>s.id===globalState.siteId)!;
 assert.ok(isGlobalTerrainChoice(context.arrayTerrain));assert.equal(context.arrayTerrain.cellLat,site.lat);assert.equal(context.arrayTerrain.cellLon,site.lon);assert.equal(context.arrayTerrain.distanceKm,0);
 assert.deepEqual(context.arrayTerrain.mask,terrainForGlobal(data,site.lat,site.lon,2).mask);assert.ok(context.arraySeries.sunHorizon.every(Number.isFinite));assert.ok(context.antennaSeries.earthHorizon.every(Number.isFinite));
 for(const id of ['array-horizon','antenna-horizon']){const ref=context.evidence.find(e=>e.id===id)!;assert.equal(ref.coverage,'partial');assert.ok(ref.notes.some(n=>n.includes('requested coordinates')));assert.ok(!ref.notes.some(n=>n.includes('borrowed grid horizon')));}
 const assessment=evaluateScenario(catalog,globalState,manifest);assert.ok(['conditional','fails-assessed'].includes(assessment.outcome));assert.equal(assessment.modelVersion,PLANNING_MODEL_VERSION);assert.equal(PLANNING_MODEL_VERSION,'planning-4');assert.equal(assessment.mission.knownFraction,1);assert.notEqual(assessment.scenarioKey,evaluateScenario(catalog,legacy,manifest).scenarioKey);assert.deepEqual(globalState,before);
});
test('array and antenna heights 0/2/10 resolve independently; unsupported5 stays unknown',()=>{
 const normal=resolveAnalysisContext(catalog,request(globalState),manifest);
 for(const height of [0,2,10]){
  const antenna=resolveAnalysisContext(catalog,request({...globalState,antennaHeightM:height}),manifest),array=resolveAnalysisContext(catalog,request({...globalState,arrayHeightM:height}),manifest);
  assert.deepEqual(antenna.arraySeries,normal.arraySeries);assert.deepEqual(array.antennaSeries,normal.antennaSeries);assert.equal(antenna.antennaTerrain.heightM,height);assert.equal(array.arrayTerrain.heightM,height);
 }
 const unsupported=resolveAnalysisContext(catalog,request({...globalState,arrayHeightM:5}),manifest);assert.ok(unsupported.arraySeries.sunHorizon.every(Number.isNaN));assert.equal(unsupported.evidence.find(e=>e.id==='array-horizon')!.coverage,'unavailable');assert.equal(parseScenario({...globalState,arrayHeightM:5},bounds),null);
});
test('prepared named masks and prepared2m polar custom masks retain priority',()=>{
 const named=catalog.sites.find(s=>s.id==='connecting-ridge')!;
 for(const height of [0,2,10]){const selected=resolveTerrainChoice(catalog,named,null,height,'global-context');assert.equal(isGlobalTerrainChoice(selected),false);assert.deepEqual(selected,terrainForSite(named,height));}
 const polar=resolveTerrainChoice(catalog,named,{lat:-85,lon:20},2,'global-context');assert.equal(isGlobalTerrainChoice(polar),false);assert.ok(polar.mask.some(Number.isFinite));
 const height0=resolveTerrainChoice(catalog,named,{lat:-85,lon:20},0,'global-context');assert.ok(isGlobalTerrainChoice(height0));
});
test('absent global manifest or absent numerical DEM cannot create a passing terrain assessment',()=>{
 const missingSource={...manifest,entries:manifest.entries.filter(e=>e.id!=='horizon-global')};
 for(const [c,m] of [[catalog,missingSource],[{...catalog,globalTerrain:undefined},manifest]] as const){const context=resolveAnalysisContext(c,request(globalState),m),assessment=evaluateScenario(c,globalState,m);assert.equal(context.evidence.find(e=>e.id==='array-horizon')!.coverage,'unavailable');assert.ok(context.arraySeries.sunHorizon.every(Number.isNaN));assert.equal(assessment.outcome,'incomplete');assert.equal(assessment.mission.generatedWh,null);}
 const missing={...data,id:'synthetic-missing-data',samples:new Int16Array(data.samples.length).fill(data.nodata),northPoleM:null,southPoleM:null};const context=resolveAnalysisContext({...catalog,globalTerrain:missing},request(globalState),manifest);assert.equal(context.evidence.find(e=>e.id==='array-horizon')!.coverage,'unavailable');
});
test('real pole/dateline resolution remains finite, normalized and isolated from mask mutation',()=>{
 const site=catalog.sites.find(s=>s.id===globalState.siteId)!;
 for(const lat of [-90,90]){const selected=resolveTerrainChoice(catalog,site,{lat,lon:180},0,'global-context');assert.ok(selected.mask.every(Number.isFinite));assert.ok(isGlobalTerrainChoice(selected));assert.equal(sampleGlobalHeight(data,lat,0),sampleGlobalHeight(data,lat,120));}
 const a=resolveTerrainChoice(catalog,site,{lat:10.00000001,lon:-180},2,'global-context'),b=resolveTerrainChoice(catalog,site,{lat:10.00000001,lon:180},2,'global-context');assert.deepEqual(a.mask,b.mask);assert.equal(a.cellLat,10.00000001);assert.equal(a.cellLon,180);a.mask.fill(999);assert.ok(resolveTerrainChoice(catalog,site,{lat:10.00000001,lon:180},2,'global-context').mask.every(v=>v!==999));
});
test('explicit mode and global source identity survive export/import with fresh authority recomputation',()=>{
 const state={...globalState,endIndex:globalState.startIndex+23},pkg=createDecisionPackage(catalog,state,manifest,legacy),restored=importDecisionPackage(JSON.parse(stringifyDecisionPackage(pkg)),catalog,manifest);
 assert.ok(isGlobalTerrainChoice((pkg.resolved as unknown as {array:ReturnType<typeof terrainForGlobal>}).array));assert.ok((pkg.rawTimeSeries as unknown as {array:{sunHorizon:number[]}}).array.sunHorizon.every(Number.isFinite));assert.equal(restored.state.terrainMode,'global-context');assert.equal(restored.assessment.scenarioKey,evaluateScenario(catalog,state,manifest).scenarioKey);assert.equal(restored.assessment.datasetId,manifest.datasetId);assert.equal(restored.historicalTrusted,false);assert.ok(diffScenarios({...state,terrainMode:undefined},state).some(d=>d.path==='terrainMode'));assert.equal(restored.assessment.evidence.find(e=>e.id==='array-horizon')!.coverage,'partial');
});
test('exact-coordinate custom mode never silently reuses the nearby polar prepared mask',()=>{
 const lat=-83.89579688154942,lon=117.43363996861967,site=catalog.sites[0];
 const borrowed=resolveTerrainChoice(catalog,site,{lat,lon},2,'global-context');assert.ok(!isGlobalTerrainChoice(borrowed));assert.ok(borrowed.distanceKm!>3);
 const point=resolveTerrainChoice(catalog,site,{lat,lon},2,'global-at-point');assert.ok(isGlobalTerrainChoice(point));assert.equal(point.cellLat,lat);assert.equal(point.cellLon,lon);assert.equal(point.distanceKm,0);assert.notDeepEqual(point.mask,borrowed.mask);
 const without={...catalog};delete without.globalTerrain;const unavailable=resolveTerrainChoice(without,site,{lat,lon},2,'global-at-point');assert.ok(unavailable.mask.every(Number.isNaN));
});
