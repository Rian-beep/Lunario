import {Box3, Matrix4, PerspectiveCamera, Vector3} from 'three';

export type ScreenRect = {left:number;top:number;right:number;bottom:number};
const area = (r:ScreenRect) => Math.max(0,r.right-r.left)*Math.max(0,r.bottom-r.top);
const finiteRect = (r:ScreenRect) => Object.values(r).every(Number.isFinite);

/** Intersection in one CSS-pixel coordinate space; touching edges have no visible area. */
export function intersectRects(a:ScreenRect,b:ScreenRect):ScreenRect|null {
  if(!finiteRect(a)||!finiteRect(b))return null;
  const r={left:Math.max(a.left,b.left),top:Math.max(a.top,b.top),right:Math.min(a.right,b.right),bottom:Math.min(a.bottom,b.bottom)};
  return area(r)>0?r:null;
}

const intersects = (a:ScreenRect,b:ScreenRect) => a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;

/** Empty rectangle maximizing vehicle fit; inputs are measured CSS pixels, not panel presets. */
export function unoccludedRect(viewport:ScreenRect, obstacles:readonly ScreenRect[], padding=12, aspectRatio=1):ScreenRect|null {
  const bounds={left:viewport.left+padding,top:viewport.top+padding,right:viewport.right-padding,bottom:viewport.bottom-padding};
  if(!finiteRect(bounds)||area(bounds)===0)return null;
  const blocked=obstacles.filter(r=>area(r)>0&&intersects(bounds,r)).map(r=>({
    left:Math.max(bounds.left,r.left-padding),right:Math.min(bounds.right,r.right+padding),
    top:Math.max(bounds.top,r.top-padding),bottom:Math.min(bounds.bottom,r.bottom+padding),
  }));
  const xs=[...new Set([bounds.left,bounds.right,...blocked.flatMap(r=>[r.left,r.right])])].sort((a,b)=>a-b);
  let best:ScreenRect|null=null,score=-Infinity,bestArea=0;
  const ratio=Number.isFinite(aspectRatio)&&aspectRatio>0?aspectRatio:1;
  for(let l=0;l<xs.length-1;l++)for(let r=l+1;r<xs.length;r++){
    const strips=blocked.filter(b=>b.left<xs[r]&&b.right>xs[l]).sort((a,b)=>a.top-b.top);
    let top=bounds.top;
    const consider=(bottom:number)=>{
      const candidate={left:xs[l],right:xs[r],top,bottom},size=area(candidate);
      // Stable central tie-break, independent of DOM order.
      const distance=Math.hypot(candidate.left+candidate.right-bounds.left-bounds.right,candidate.top+candidate.bottom-bounds.top-bounds.bottom);
      const next=Math.min((candidate.right-candidate.left)/ratio,candidate.bottom-candidate.top);
      if(size>0&&(next>score+1e-9||Math.abs(next-score)<1e-9&&size-distance*1e-6>bestArea)){best=candidate;score=next;bestArea=size-distance*1e-6;}
    };
    for(const b of strips){if(b.top>top)consider(b.top);top=Math.max(top,b.bottom);}
    if(top<bounds.bottom)consider(bounds.bottom);
  }
  return best;
}

export function boxCorners(box:Box3, matrix?:Matrix4):Vector3[] {
  if(box.isEmpty())return [];
  const points:Vector3[]=[];
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
    const p=new Vector3(x,y,z);if(matrix)p.applyMatrix4(matrix);points.push(p);
  }
  return points;
}

export function projectedBounds(camera:PerspectiveCamera, points:readonly Vector3[], width:number,height:number):ScreenRect|null {
  if(!points.length||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return null;
  camera.updateMatrixWorld(true);
  const bounds={left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity};
  for(const point of points){
    if(!point.toArray().every(Number.isFinite))return null;
    const local=point.clone().applyMatrix4(camera.matrixWorldInverse);
    if(local.z>=-camera.near)return null;
    const p=point.clone().project(camera),x=(p.x+1)*width/2,y=(1-p.y)*height/2;
    if(!Number.isFinite(x)||!Number.isFinite(y))return null;
    bounds.left=Math.min(bounds.left,x);bounds.right=Math.max(bounds.right,x);
    bounds.top=Math.min(bounds.top,y);bounds.bottom=Math.max(bounds.bottom,y);
  }
  return bounds;
}

/** Render-only pullback. The caller restores the unexpanded pose after rendering.
 * The enclosing sphere includes every original fragment corner, even behind the camera.
 * A C1 upper envelope of base distance and 1.2 radius + near avoids a zoom kink.
 */
export function pullBackForDebris(camera:PerspectiveCamera, points:readonly Vector3[], target:Vector3,
  terrain?:{centre:Vector3;radiusAt:(point:Vector3)=>number}) {
  if(!points.length||!target.toArray().every(Number.isFinite)||!points.every(p=>p.toArray().every(Number.isFinite)))return false;
  const offset=camera.position.clone().sub(target),base=offset.length();
  if(!Number.isFinite(base)||base<=0||!Number.isFinite(camera.near)||camera.near<=0)return false;
  const radius=Math.max(...points.map(p=>p.distanceTo(target)));
  if(!Number.isFinite(radius)||radius<=0)return false;
  const required=1.2*radius+camera.near,band=base*.1,difference=required-base;
  let distance=difference<=-band?base:difference>=band?required:base+(difference+band)**2/(4*band);
  const direction=offset.divideScalar(base),candidate=target.clone().addScaledVector(direction,distance);
  // Stay on the viewing ray if an inward orbit puts the expanded pose below terrain.
  // Solve the exit from the sampled sphere, then resample at the new geographic point.
  if(terrain&&distance>base){
    for(let i=0;i<16;i++){
      const groundRadius=terrain.radiusAt(candidate)+.002;
      if(!Number.isFinite(groundRadius)||groundRadius<=0)return false;
      if(candidate.distanceTo(terrain.centre)>=groundRadius)break;
      const relative=target.clone().sub(terrain.centre),along=relative.dot(direction);
      const discriminant=along*along+groundRadius*groundRadius-relative.lengthSq();
      if(discriminant<0)return false;
      distance=Math.max(distance,-along+Math.sqrt(discriminant))+.000001;
      candidate.copy(target).addScaledVector(direction,distance);
      if(i===15)return false;
    }
  }
  if(distance>base){camera.position.copy(candidate);camera.updateMatrixWorld(true);}
  return true;
}

/** Off-axis projection only: physical camera pose, COM target and user pan/orbit stay untouched. */
export function frameVehicle(camera:PerspectiveCamera, points:readonly Vector3[], width:number,height:number, safe:ScreenRect|null) {
  camera.clearViewOffset();camera.zoom=1;camera.updateProjectionMatrix();
  if(!safe)return {status:'occluded' as const,bounds:projectedBounds(camera,points,width,height)};
  if(!finiteRect(safe)||area(safe)<=0)return {status:'occluded' as const,bounds:projectedBounds(camera,points,width,height)};
  const base=projectedBounds(camera,points,width,height);
  const cx=(safe.left+safe.right)/2,cy=(safe.top+safe.bottom)/2;
  if(!base||area(base)<=0){camera.setViewOffset(width,height,width/2-cx,height/2-cy,width,height);return {status:'unavailable' as const,bounds:null};}
  // Fit relative to the optical axis, retaining the visible effect of user pan.
  // Never enlarge the asset: its actual mesh bounds only limit projection zoom.
  const halfX=Math.max(Math.abs(base.left-width/2),Math.abs(base.right-width/2));
  const halfY=Math.max(Math.abs(base.top-height/2),Math.abs(base.bottom-height/2));
  camera.zoom=Math.min(1,(safe.right-safe.left)/2/Math.max(1e-9,halfX),(safe.bottom-safe.top)/2/Math.max(1e-9,halfY));
  camera.setViewOffset(width,height,width/2-cx,height/2-cy,width,height);
  camera.updateProjectionMatrix();
  const bounds=projectedBounds(camera,points,width,height);
  return {status:bounds?'framed' as const:'unavailable' as const,bounds};
}

export const SCENE_OCCLUDERS = '[data-scene-occluder], .inspector, .site-drawer, .workspace-heading, .location-restore, .drawer-toggles, .timeline, .timeline-restore, .flight-telemetry, .flight-hud-restore, .sq-position, .sq-legend, .scene-inline-controls, .scene-contact-status, .sq-preparing, .comparison-sheet, .comparison-restore, .header-dropdown-content';

/** Observe actual panels, including new/dismissed panels and CSS resize/reflow. */
export function observeSceneOcclusion(host:HTMLElement, root:HTMLElement, selector=SCENE_OCCLUDERS) {
  let elements:Element[]=[], lastSignature='', lastSafe:ScreenRect|null=null;
  const resized=new ResizeObserver(()=>{lastSignature='';});
  const refresh=()=>{
    const next=[...root.querySelectorAll(selector)];
    for(const el of elements)if(!next.includes(el))resized.unobserve(el);
    for(const el of next)if(!elements.includes(el))resized.observe(el);
    elements=next;lastSignature='';
  };
  // Ignore render-loop telemetry attributes; react only to layout/visibility mutations.
  const mutated=new MutationObserver(records=>{
    if(records.some(record=>record.type==='attributes'||[...record.addedNodes,...record.removedNodes].some(node=>node.nodeType===1)))refresh();
  });
  mutated.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden','open','data-scene-occluder']});
  resized.observe(host);refresh();
  const invalidate=()=>{lastSignature='';};
  const visualViewport=window.visualViewport;
  root.addEventListener('scroll',invalidate,true);window.addEventListener('resize',invalidate);
  visualViewport?.addEventListener('resize',invalidate);visualViewport?.addEventListener('scroll',invalidate);
  return {
    measure(aspectRatio=1){
      // Geometry can move without resizing (CSS transforms, ancestor reflow).
      // Read measured rectangles; only rerun the rectangle search when they change.
      const canvas=host.getBoundingClientRect();
      const drawing=host.querySelector('canvas')?.getBoundingClientRect()??canvas;
      const visibleCanvas=intersectRects(canvas,drawing);
      const viewport=visibleCanvas?intersectRects(visibleCanvas,visualViewport?{left:visualViewport.offsetLeft,top:visualViewport.offsetTop,
        right:visualViewport.offsetLeft+visualViewport.width,bottom:visualViewport.offsetTop+visualViewport.height}
        :{left:0,top:0,right:window.innerWidth,bottom:window.innerHeight}):null;
      const obstacles=elements.filter(el=>{
        if(el.closest('[hidden]')||!el.getClientRects().length)return false;
        const style=getComputedStyle(el);return style.display!=='none'&&style.visibility!=='hidden'&&style.visibility!=='collapse'&&style.opacity!=='0';
      }).map(el=>el.getBoundingClientRect());
      const signature=JSON.stringify([canvas.left,canvas.top,canvas.right,canvas.bottom,viewport,aspectRatio,obstacles.map(r=>[r.left,r.top,r.right,r.bottom])]);
      if(signature!==lastSignature){
        const safe=viewport?unoccludedRect(viewport,obstacles,12,aspectRatio):null;
        lastSafe=safe?{left:safe.left-canvas.left,right:safe.right-canvas.left,top:safe.top-canvas.top,bottom:safe.bottom-canvas.top}:null;
        lastSignature=signature;
      }
      return lastSafe;
    },
    dispose(){resized.disconnect();mutated.disconnect();root.removeEventListener('scroll',invalidate,true);window.removeEventListener('resize',invalidate);visualViewport?.removeEventListener('resize',invalidate);visualViewport?.removeEventListener('scroll',invalidate);},
  };
}
