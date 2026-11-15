/** Radius of a display proxy at a compressed distance preserving the source angular semidiameter. */
export function angularProxyRadiusKm(distanceKm:number,angularRadiusDeg:number):number|null{
 if(!Number.isFinite(distanceKm)||distanceKm<=0||!Number.isFinite(angularRadiusDeg)||angularRadiusDeg<=0||angularRadiusDeg>=90)return null;
 // A sphere's apparent half-angle is asin(radius/range), not atan(radius/range).
 return distanceKm*Math.sin(angularRadiusDeg*Math.PI/180);
}
