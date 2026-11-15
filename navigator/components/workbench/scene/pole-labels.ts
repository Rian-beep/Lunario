export type Pole='north'|'south';
export type PolePlacement={x:number;y:number;farSide:boolean;offscreen:boolean};
/** Front-facing means visible from the camera above a sphere, not merely positive latitude. */
export function poleFacesCamera(pole:Pole,cameraBody:readonly[number,number,number],radiusKm=1737.4):boolean{
 const distance=Math.hypot(...cameraBody);
 return distance>radiusKm&&(pole==='north'?cameraBody[2]:-cameraBody[2])>radiusKm;
}
/** Far-side labels sit beyond the projected limb; they never masquerade as surface pins. */
export function placePoleLabel(input:{pole:Pole;cameraBody:readonly[number,number,number];projected:{x:number;y:number;z:number};centre:{x:number;y:number};radiusPx:number;width:number;height:number}):PolePlacement|null{
 const {pole,cameraBody,projected,centre,radiusPx,width,height}=input;
 if(![...cameraBody,projected.x,projected.y,projected.z,centre.x,centre.y,radiusPx,width,height].every(Number.isFinite)||width<1||height<1)return null;
 const farSide=!poleFacesCamera(pole,cameraBody);
 let {x,y}=projected;
 if(farSide){
  let dx=x-centre.x,dy=y-centre.y;
  if(Math.hypot(dx,dy)<1){dx=0;dy=pole==='north'?-1:1;}
  const factor=(Math.max(0,radiusPx)+30)/Math.hypot(dx,dy);
  x=centre.x+dx*factor;y=centre.y+dy*factor;
 }
 const mx=Math.min(92,width/2),my=Math.min(30,height/2);
 const offscreen=projected.z<=-1||projected.z>=1||x<mx||x>width-mx||y<my||y>height-my;
 return {x:Math.round(Math.max(mx,Math.min(width-mx,x))),y:Math.round(Math.max(my,Math.min(height-my,y))),farSide,offscreen};
}
