import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodeCatalog} from '../lib/catalog';
import {resolveAnalysisContext} from '../lib/analysis-context';
import {parseEvidenceManifest} from '../lib/provenance';
const c=decodeCatalog(JSON.parse(readFileSync('public/data/catalog.json','utf8')));
const manifest=parseEvidenceManifest(JSON.parse(readFileSync('public/data/evidence-manifest.json','utf8')));
const base={siteId:c.sites[0].id,custom:null,startIndex:100,endIndex:110,arrayHeightM:2,antennaHeightM:2,displayHeightM:2};
test('subsystem horizons vary independently and identity is explicit',()=>{
 const a=resolveAnalysisContext(c,base,manifest),b=resolveAnalysisContext(c,{...base,antennaHeightM:10},manifest),d=resolveAnalysisContext(c,{...base,arrayHeightM:10},manifest);
 assert.deepEqual(a.arraySeries,b.arraySeries);assert.deepEqual(a.antennaSeries,d.antennaSeries);
 assert.equal(b.antennaTerrain.heightM,10);assert.equal(d.arrayTerrain.heightM,10);
 assert.equal(a.datasetId,manifest.datasetId);
});
test('unsupported custom height stays unavailable; fixed 2m remains borrowed',()=>{
 const p={...base,custom:{lat:-85,lon:20},arrayHeightM:10};const a=resolveAnalysisContext(c,p,manifest);
 assert.ok([...a.arraySeries.sunHorizon].every(Number.isNaN));
 assert.equal(a.evidence.find(e=>e.id==='array-horizon')?.coverage,'unavailable');
 assert.equal(a.evidence.find(e=>e.id==='antenna-horizon')?.coverage,'borrowed');
});
test('empty grid, absent evidence and missing historical masks remain unknown',()=>{
 const a=resolveAnalysisContext({...c,grid:{...c.grid,lat:new Float64Array(),lon:new Float64Array()}},{...base,custom:{lat:-85,lon:20}},manifest);
 assert.ok([...a.arraySeries.sunHorizon].every(Number.isNaN));
 const b=resolveAnalysisContext(c,base,{...manifest,entries:[]});assert.ok([...b.arraySeries.sunHorizon].every(Number.isNaN));
 const d=resolveAnalysisContext({...c,sites:[{...c.sites[0],horizons:[]}]},base,manifest);assert.ok([...d.antennaSeries.earthHorizon].every(Number.isNaN));
});
test('last epoch is an endpoint, never a full additional forcing interval',()=>{
 assert.doesNotThrow(()=>resolveAnalysisContext(c,{...base,startIndex:c.meta.n-2,endIndex:c.meta.n-2},manifest));
 assert.throws(()=>resolveAnalysisContext(c,{...base,startIndex:c.meta.n-1,endIndex:c.meta.n-1},manifest),/outside/);
});
