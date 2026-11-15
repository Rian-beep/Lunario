import {test} from 'node:test';
import assert from 'node:assert/strict';
import {customSurfaceMarker,CUSTOM_MARKER_ID} from '../lib/custom-marker';
test('custom coordinate becomes a display marker without invented terrain or mission evidence',()=>{const point={lat:-89.5,lon:-150};const marker=customSurfaceMarker(point)!;assert.equal(marker.id,CUSTOM_MARKER_ID);assert.equal(marker.lat,point.lat);assert.equal(marker.lon,210);assert.equal(marker.demHeightM,null);assert.equal(marker.slopeDeg,null);assert.deepEqual(marker.horizons,[]);assert.equal(marker.mission,undefined);assert.equal(point.lon,-150);});
test('absence and invalid user coordinates never become a pin at zero',()=>{assert.equal(customSurfaceMarker(null),null);assert.throws(()=>customSurfaceMarker({lat:91,lon:0}),RangeError);assert.throws(()=>customSurfaceMarker({lat:0,lon:NaN}),RangeError);});
