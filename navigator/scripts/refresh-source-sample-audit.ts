import fs from 'node:fs';import assert from 'node:assert/strict';import {decodeTerrain} from '../lib/terrain';
const file='docs/qa/scientific-audit/sources/references/capture.json',capture=JSON.parse(fs.readFileSync(file,'utf8')),terrain=decodeTerrain(JSON.parse(fs.readFileSync('public/data/terrain.json','utf8')));
for(const source of capture.sources){const grid=source.lod==='overview'?terrain.overview:terrain.patches.find(g=>g.id===source.gridId&&g.lod===source.lod);assert.ok(grid);
 for(const sample of source.samples){const col=sample.index%grid.width,row=Math.floor(sample.index/grid.width);assert.ok(Math.abs(grid.x0+col*grid.stepM-sample.xM)<1e-6);assert.ok(Math.abs(grid.y0-row*(grid.stepYM??grid.stepM)-sample.yM)<1e-6);
 const value=grid.heights[sample.index],known=typeof value==='number'&&Number.isFinite(value);sample.bundledHeightM=known?value:null;sample.errorM=known&&sample.expectedHeightM!==null?value-sample.expectedHeightM:null;sample.clampedErrorM=known&&sample.clampedHeightM!==null?value-sample.clampedHeightM:null;
 if(!sample.outside)assert.ok(sample.errorM!==null&&Math.abs(sample.errorM)<=sample.toleranceM,`${source.lod}: ${sample.errorM}`);
 }}
fs.writeFileSync(file,JSON.stringify(capture,null,2)+'\n');
const edge=capture.sources.find((s:{lod:string})=>s.lod==='fine40').samples.at(-1);
fs.writeFileSync('docs/qa/scientific-audit/integration/terrain-registration-after.json',JSON.stringify({scope:'same bounded original COG sample stencils and declared coordinates; not independent physical accuracy',edge,errorM:edge.errorM,toleranceM:edge.toleranceM,sampleCount:capture.sources.reduce((n:number,s:{samples:unknown[]})=>n+s.samples.length,0)},null,2)+'\n');console.log('All supported original-source sample stencils match corrected grids; edge error m:',edge.errorM);
