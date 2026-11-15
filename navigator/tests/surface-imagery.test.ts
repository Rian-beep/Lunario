import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import sharp from 'sharp';
import {latLonToProjected} from '../lib/astro';
const imagery=JSON.parse(readFileSync('public/data/imagery.json','utf8')),catalog=JSON.parse(readFileSync('public/data/catalog.json','utf8'));
test('surface patches contain their named site, retain real source resolution and decode at declared dimensions',async()=>{
 const patches=imagery.patches.filter((p:{id:string})=>p.id.endsWith('-nac-surface'));assert.equal(patches.length,6);let total=0;
 for(const p of patches){const site=catalog.sites.find((s:{id:string})=>p.id===s.id+'-nac-surface');assert.ok(site);const xy=latLonToProjected(site.lat,site.lon);assert.ok(xy.x>=p.x0&&xy.x<=p.x0+p.width*p.stepM);assert.ok(xy.y<=p.y0&&xy.y>=p.y0-p.height*p.stepM);assert.ok(p.stepM>2&&p.stepM<2.1);assert.equal(p.sourcePixelM,1);assert.match(p.sourceEndpoint,/trek.nasa.gov/);const path='public'+p.url;const decoded=await sharp(path).metadata();assert.equal(decoded.width,p.width);assert.equal(decoded.height,p.height);total+=statSync(path).size;}
 assert.ok(total<1_000_000,'bounded centre patches add less than 1 MB of compressed imagery');assert.ok(imagery.patches.some((p:{id:string})=>p.id==='connecting-ridge-nac'),'broader source retained');
});
