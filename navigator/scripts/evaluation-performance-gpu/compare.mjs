import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const [beforePath,afterPath,output]=process.argv.slice(2);
assert.ok(beforePath&&afterPath&&output,'Usage: node compare.mjs before.json after.json output.json');
const before=JSON.parse(await readFile(beforePath)),after=JSON.parse(await readFile(afterPath));
assert.ok(before.hardware&&after.hardware,'Hardware comparison requires native GPU results');
assert.deepEqual(before.device,after.device);
assert.equal(!!before.mode.orbit,!!after.mode.orbit,'Matched camera-motion mode required');
assert.equal(before.browser,after.browser);assert.deepEqual(before.flags,after.flags);
for(const path of ['public/data/visual-moon/manifest.json','components/workbench/scene/visual-moon/material.ts'])assert.equal(before.sourceHashes[path],after.sourceHashes[path]);
assert.ok(before.runs.length>=3&&after.runs.length>=3,'At least three fresh-context samples per lane');
const views=before.runs[0].views;
for(const run of [...before.runs,...after.runs]){
 assert.deepEqual(run.views,views,'Six rendered views remain pixel-identical across lanes and runs');
 for(const sample of run.landmarks)assert.deepEqual(sample.actual,sample.expected,'All source landmarks retain exact sRGB code values');
 assert.equal(run.disposal.geometries,0);assert.equal(run.disposal.textures,1);
}
const range=values=>({min:Math.min(...values),max:Math.max(...values),median:[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)],samples:values});
const summarize=report=>({
 frameGapMs:range(report.runs.map(r=>r.afterReady3s.maxGapMs)),
 uploads:Object.fromEntries([1024,2048,4096,8192].map(width=>[width,range(report.runs.map(r=>r.uploads.find(u=>u.width===width).ms))])),
 decode:Object.fromEntries([1024,2048,4096,8192].map(width=>[width,Object.fromEntries(['main','worker'].map(mode=>[mode,range(report.runs.map(r=>r.decodes.find(d=>d.mode===mode&&d.width===width).decodeMs))]))])),
});
const result={beforeSource:before.baselineRef??before.commit,afterSource:after.commit,renderer:after.device.renderer,motion:after.mode.orbit?'Continuous fixture camera orbit at 0.05 radians/second':'Static fixture camera',before:summarize(before),after:summarize(after),identicalViews:views,landmarkCount:after.runs[0].landmarks.length,scope:'Local 150ms diagnostic screen, not a general performance acceptance threshold; no GPU fences or cold-network claim'};
result.frameGapMedianReduction=1-result.after.frameGapMs.median/result.before.frameGapMs.median;
await writeFile(output,JSON.stringify(result,null,2)+'\n');
assert.ok(result.before.frameGapMs.min>150,'Baseline must reproduce the frame-gap regression');
assert.ok(result.after.frameGapMs.max<150,'Fixed path must stay below the local screen in all samples');
assert.ok(result.frameGapMedianReduction>.6,'Median local gap must improve by at least 60%');
console.log(JSON.stringify(result,null,2));
