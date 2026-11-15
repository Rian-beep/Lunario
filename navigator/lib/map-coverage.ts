import type {MapMeta} from './catalog';
import {latLonToProjected} from './astro';
/** Match the South Pole view's supported latitude and exact bundled image bounds. */
export function mapAreaForLocation(map:MapMeta,lat:number,lon:number):'polar'|'global'{
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat < -90||lat > -80)return 'global';
 const point=latLonToProjected(lat,lon);
 const x=(point.x-map.tieX)/map.scaleM-map.centerOffset;
 const y=(map.tieY-point.y)/map.scaleM-map.centerOffset;
 return x>=0&&y>=0&&x<map.width&&y<map.height?'polar':'global';
}
