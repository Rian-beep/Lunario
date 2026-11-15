import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Catalog,Site} from '../lib/catalog';
import {withLandingSites} from '../lib/landing-catalog';
const record={id:'apollo-11',name:'Apollo 11',lat:.674,lon:23.473,program:'Apollo',date:'1969-07-20',outcome:'landed' as const,approximate:false,sourceUrl:'https://science.nasa.gov/',summary:'Published lunar-module position.'};
test('historic sites add coordinates with unavailable terrain, rather than fabricated masks',()=>{
  const c=withLandingSites({sites:[]} as unknown as Catalog,[record]);
  assert.equal(c.sites[0].group,'apollo');assert.deepEqual(c.sites[0].horizons,[]);assert.equal(c.sites[0].demHeightM,null);
});
test('existing catalog positions and measured masks survive mission metadata enrichment',()=>{
  const existing={id:record.id,lat:1,lon:2,horizons:[{heightM:2,stepDeg:360,mask:new Float64Array([3])}]} as Site;
  const c=withLandingSites({sites:[existing]} as unknown as Catalog,[record]);
  assert.equal(c.sites.length,1);assert.equal(c.sites[0].lat,1);assert.equal(c.sites[0].horizons,existing.horizons);assert.equal(c.sites[0].mission?.program,'Apollo');
});
