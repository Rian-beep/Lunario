import type {Site} from './catalog';
export const CUSTOM_MARKER_ID='user-custom-point';
/** Display identity only; never add this record to the scientific catalog. */
export function customSurfaceMarker(point:{lat:number;lon:number}|null|undefined):Site|null{
 if(!point)return null;
 if(!Number.isFinite(point.lat)||Math.abs(point.lat)>90||!Number.isFinite(point.lon))throw new RangeError('Invalid custom marker coordinates');
 return {id:CUSTOM_MARKER_ID,name:'Custom landing point',lat:point.lat,lon:((point.lon%360)+360)%360,group:'reference',summary:'Your selected coordinates. Open the inspector to compare sunlight, communications and evidence at this point.',source:'User-selected coordinates; not a cataloged mission landing site.',sourceUrl:'',demHeightM:null,slopeDeg:null,horizons:[]};
}
