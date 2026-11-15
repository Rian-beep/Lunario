/** Interpolate at declared source-pixel centres, using a one-pixel halo.
 * GeoTIFF output resizing replicates its cutout edge when upsampling; that
 * value does not represent the next declared coordinate. Missing support
 * stays missing rather than becoming a finite interpolated height.
 * @param {ArrayLike<number>} values
 * @param {number} sourceWidth
 * @param {number} sourceHeight
 * @param {number} outWidth
 * @param {number} outHeight
 * @param {number} stepX
 * @param {number} stepY
 * @param {number|null} noData
 */
export function resampleRegisteredTerrain(values,sourceWidth,sourceHeight,outWidth,outHeight,stepX,stepY,noData=null){
 if(![sourceWidth,sourceHeight,outWidth,outHeight].every(n=>Number.isInteger(n)&&n>0)||![stepX,stepY].every(n=>Number.isFinite(n)&&n>0)||values.length!==sourceWidth*sourceHeight)throw new RangeError('Invalid registered terrain grid');
 const out=new Float64Array(outWidth*outHeight);out.fill(NaN);
 const valid=v=>Number.isFinite(v)&&v!==noData&&Math.abs(v)<20000;
 for(let y=0;y<outHeight;y++)for(let x=0;x<outWidth;x++){
  const sx=x*stepX,sy=y*stepY,ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy;
  let value=0,known=true;
  for(const [dx,dy,w] of [[0,0,(1-fx)*(1-fy)],[1,0,fx*(1-fy)],[0,1,(1-fx)*fy],[1,1,fx*fy]]){
   if(w===0)continue;
   const col=ix+dx,row=iy+dy;
   if(col<0||row<0||col>=sourceWidth||row>=sourceHeight||!valid(values[row*sourceWidth+col])){known=false;break;}
   value+=w*values[row*sourceWidth+col];
  }
  if(known)out[y*outWidth+x]=value;
 }
 return out;
}
