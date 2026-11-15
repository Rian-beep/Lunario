import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nativeZoomEstablished,contrastRatio,changedPaths,summarizeChecks} from '../../scripts/evaluation-audience/checks.mjs';
const normal={dpr:1,innerWidth:1600,outerWidth:1600,screenshotWidth:1600,visualScale:1};
test('native zoom evidence distinguishes page/pinch scale from layout zoom',()=>{
 assert.equal(nativeZoomEstablished(normal,{...normal,dpr:2,innerWidth:800}),true);
 assert.equal(nativeZoomEstablished(normal,{...normal,innerWidth:800,outerWidth:800,screenshotWidth:800}),false);
 assert.equal(nativeZoomEstablished(normal,{...normal,visualScale:2}),false);
 assert.equal(nativeZoomEstablished(normal,{...normal,dpr:2,innerWidth:800,screenshotWidth:800}),false);
 assert.equal(nativeZoomEstablished(normal,null),false);
});
test('contrast oracle preserves endpoints and validates inputs',()=>{
 assert.equal(contrastRatio([0,0,0],[255,255,255]),21);
 assert.equal(contrastRatio([255,255,255],[0,0,0]),21);
 assert.equal(contrastRatio([32,45,60],[32,45,60]),1);
 assert.throws(()=>contrastRatio([NaN,0,0],[0,0,0]));
 assert.throws(()=>contrastRatio([0,0,0,0],[0,0,0]));
});
test('held-input audit catches nested hardware drift, additions and removals',()=>{
 const a={startIndex:1,endIndex:10,mission:{loadW:4},operations:{delay:0}};
 assert.deepEqual(changedPaths(a,{...a,startIndex:25,endIndex:34}),['startIndex','endIndex']);
 assert.deepEqual(changedPaths(a,{...a,mission:{loadW:6}}),['mission.loadW']);
 assert.deepEqual(changedPaths({x:1},{y:1}),['x','y']);
 assert.deepEqual(changedPaths(a,structuredClone(a)),[]);
});
test('failed journeys cannot silently count as completed',()=>{
 assert.deepEqual(summarizeChecks([{status:'pass'},{status:'fail'},{status:'fail'}]),{total:3,passed:1,failed:2});
});
test('actual UI notebook export changes only array height and preserves unknown radio evidence',async()=>{
 const {readFile}=await import('node:fs/promises');
 const fixture=JSON.parse(await readFile(new URL('./fixtures/agent-array-height-notebook.json',import.meta.url),'utf8'));
 assert.equal(fixture.records.length,1);
 const record=fixture.records[0];
 assert.deepEqual(changedPaths(record.baseline,record.candidate),['arrayHeightM']);
 assert.equal(record.baseline.antennaHeightM,record.candidate.antennaHeightM);
 assert.equal(record.before.contactFraction,record.after.contactFraction);
 assert.equal(record.before.assumedMarginDb,null);
 assert.equal(record.after.assumedMarginDb,null);
 assert.match(record.explanation,/Agent observation/);
});
