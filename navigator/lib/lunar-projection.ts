/** Stable south-polar stereographic coordinates from a lunar body direction.
 * Body +X=0°E, +Y=90°E, +Z=north; projected +X=90°E, +Y=0°E.
 * Avoid asin(z) and subtraction near the poles in a float32 shader.
 */
export const POLAR_BODY_GLSL='3474800.0 * vec2(body.y, body.x) / max(0.000001, 1.0 - body.z)';
export function polarBodyProjection(x:number,y:number,z:number){const norm=Math.hypot(x,y,z);if(!(norm>0)||!Number.isFinite(norm))throw Error('Finite body direction required');return{x:3474800*y/norm/Math.max(.000001,1-z/norm),y:3474800*x/norm/Math.max(.000001,1-z/norm)};}
