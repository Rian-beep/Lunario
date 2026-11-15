import test from 'node:test';import assert from 'node:assert/strict';
import catalog from '../public/data/catalog.json';import {mapAreaForLocation} from '../lib/map-coverage';
test('both poles, historic near-equatorial landings and prepared south sites choose the correct map',()=>{
 assert.equal(mapAreaForLocation(catalog.map,-90,0),'polar');
 assert.equal(mapAreaForLocation(catalog.map,90,0),'global');
 assert.equal(mapAreaForLocation(catalog.map,.674,23.47),'global');
 assert.equal(mapAreaForLocation(catalog.map,-89.5343,209.9477),'polar');
 for(const lon of [-180,-90,0,90,180,360])assert.equal(mapAreaForLocation(catalog.map,-85,lon),'polar');
 assert.equal(mapAreaForLocation(catalog.map,-79.999,0),'global');
});
test('image extent and invalid coordinates cannot silently claim polar map coverage',()=>{
 const cropped={...catalog.map,width:1,height:1};
 assert.equal(mapAreaForLocation(cropped,-85,0),'global');
 assert.equal(mapAreaForLocation(catalog.map,NaN,0),'global');
 assert.equal(mapAreaForLocation(catalog.map,-91,0),'global');
 assert.equal(mapAreaForLocation(catalog.map,-85,Infinity),'global');
});
