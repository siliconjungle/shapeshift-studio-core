import {sampleMotion} from './motion.js';
function pixel(frame,x,y){
 x=Math.max(0,Math.min(frame.width-1,x));y=Math.max(0,Math.min(frame.height-1,y));
 const xx=Math.floor(x),yy=Math.floor(y),u=x-xx,v=y-yy,out=[0,0,0,0];
 for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
  const p=(Math.min(frame.height-1,yy+dy)*frame.width+Math.min(frame.width-1,xx+dx))*4,w=(dx?u:1-u)*(dy?v:1-v);
  for(let c=0;c<4;c++)out[c]+=frame.data[p+c]*w;
 }
 return out;
}
// Motion-aligned median like the existing video preparation. Reject neighbours
// with inconsistent round-trip flow or a large source-colour disagreement.
export function temporalMedian(current,neighbors,{flowWidth,flowHeight,colorTolerance=25,roundTripTolerance=1.5}){
 const {width,height,data}=current,out=new Uint8Array(data.length),sx=flowWidth/width,sy=flowHeight/height;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const p=(y*width+x)*4,source=Array.from(data.subarray(p,p+4)),candidates=[source];
  for(const neighbor of neighbors){
   const [dx,dy]=sampleMotion(neighbor.toNeighbor,x*sx,y*sy),nx=x*sx+dx,ny=y*sy+dy;
   const back=sampleMotion(neighbor.toCurrent,nx,ny);
   if(nx<0||ny<0||nx>=flowWidth||ny>=flowHeight||Math.hypot(dx+back[0],dy+back[1])>roundTripTolerance){candidates.push(source);continue}
   const sample=pixel(neighbor.frame,x+dx/sx,y+dy/sy),error=(Math.abs(sample[0]-source[0])+Math.abs(sample[1]-source[1])+Math.abs(sample[2]-source[2]))/3;
   candidates.push(error<=colorTolerance&&Math.abs(sample[3]-source[3])<8?sample:source);
  }
  while(candidates.length<3)candidates.push(source);
  for(let c=0;c<3;c++){const a=candidates[0][c],b=candidates[1][c],d=candidates[2][c];out[p+c]=Math.round(a+b+d-Math.min(a,b,d)-Math.max(a,b,d))}
  out[p+3]=data[p+3];
 }
 return {width,height,data:out};
}
