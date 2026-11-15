/** Camera/display geography in the numerical Moon-body frame: +X 0°, +Y 90°E, +Z north. */
export type GeographicVector=readonly [number,number,number];
export type GeographicView={latDeg:number;lonDeg:number};
const radians=Math.PI/180;
export function normalizeGeographicLongitude(lonDeg:number):number{
 if(!Number.isFinite(lonDeg))throw new RangeError('Longitude must be finite');
 return ((lonDeg%360)+540)%360-180;
}
function latitude(latDeg:number){if(!Number.isFinite(latDeg)||latDeg< -90||latDeg>90)throw new RangeError('Latitude must be between −90 and 90 degrees');return latDeg*radians;}
export function geographicBodyVector(latDeg:number,lonDeg:number,radius=1):GeographicVector{
 const lat=latitude(latDeg),lon=normalizeGeographicLongitude(lonDeg)*radians;
 if(!Number.isFinite(radius)||radius<=0)throw new RangeError('Geographic radius must be positive and finite');
 const c=Math.cos(lat);return [radius*c*Math.cos(lon),radius*c*Math.sin(lon),radius*Math.sin(lat)];
}
/** North tangent retains the chosen meridian even at either pole. */
export function geographicNorthVector(latDeg:number,lonDeg:number):GeographicVector{
 const lat=latitude(latDeg),lon=normalizeGeographicLongitude(lonDeg)*radians;
 return [-Math.sin(lat)*Math.cos(lon),-Math.sin(lat)*Math.sin(lon),Math.cos(lat)];
}
/** At the exact pole longitude is indeterminate; retain a caller's orientation meridian. */
export function cameraBodyGeography(cameraBody:GeographicVector,poleMeridianDeg=0):GeographicView|null{
 if(!cameraBody.every(Number.isFinite))return null;
 const radius=Math.hypot(...cameraBody);if(!Number.isFinite(radius)||radius===0)return null;
 const horizontal=Math.hypot(cameraBody[0],cameraBody[1]);
 return {latDeg:Math.atan2(cameraBody[2],horizontal)/radians,lonDeg:horizontal<=radius*Number.EPSILON*4?normalizeGeographicLongitude(poleMeridianDeg):normalizeGeographicLongitude(Math.atan2(cameraBody[1],cameraBody[0])/radians)};
}
export function stepViewLongitude(latDeg:number,lonDeg:number,deltaDeg:number):GeographicView{
 latitude(latDeg);if(!Number.isFinite(deltaDeg))throw new RangeError('Longitude step must be finite');
 return {latDeg,lonDeg:normalizeGeographicLongitude(normalizeGeographicLongitude(lonDeg)+deltaDeg)};
}
export const GEOGRAPHIC_POLES={north:{latDeg:90,lonDeg:0},south:{latDeg:-90,lonDeg:0}} as const;
export function formatGeographicView(latDeg:number,lonDeg:number):string{
 latitude(latDeg);const lon=normalizeGeographicLongitude(lonDeg);
 return `${Math.abs(latDeg).toFixed(2)}°${latDeg<0?'S':'N'}, ${Math.abs(lon).toFixed(2)}°${lon<0?'W':'E'}`;
}
