// Reproduce selected computed-color contrast from the retained RED/GREEN browser evidence.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const evidence=new URL('../docs/qa/scientific-audit/ui/evidence/',import.meta.url);
const before=JSON.parse(await readFile(new URL('supporting-text-before.json',evidence),'utf8'));
const after=JSON.parse(await readFile(new URL('supporting-text-after.json',evidence),'utf8'));
const rgb=text=>text.match(/[\d.]+/g).slice(0,3).map(Number);
// WCAG 2.2 relative luminance for sRGB, not a raster glyph measurement.
const luminance=values=>values.map(v=>v/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[0.2126,0.7152,0.0722][i],0);
const contrast=(a,b)=>{const [lo,hi]=[luminance(rgb(a)),luminance(rgb(b))].sort((x,y)=>x-y);return(hi+0.05)/(lo+0.05);};
const white='rgb(255, 255, 255)';
const report={criterion:4.5,unit:'contrast ratio : 1',before:{notes:contrast(before.notes[0].color,white),sampleValues:contrast(before.notes[1].color,before.readout)},after:{notes:contrast(after.notes[0].color,white),sampleValues:contrast(after.notes[1].color,after.readout)}};
assert.ok(report.before.notes<report.criterion&&report.before.sampleValues<report.criterion,'Retained baseline must reproduce the discrepancy.');
assert.ok(report.after.notes>=report.criterion&&report.after.sampleValues>=report.criterion,'Fixed selected text must clear the same criterion.');
console.log(JSON.stringify(report,null,2));
