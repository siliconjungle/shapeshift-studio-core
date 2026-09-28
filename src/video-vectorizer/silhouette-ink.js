import {getStroke} from 'perfect-freehand';

/** Filled silhouette bands shared with the Little Gods map. Width is measured
 * at displayWidth; interior painted paths are never input to this function. */
export function silhouetteInkBands(loops,{box=[0,0,1,1],displayWidth=240,bandWidth=3.8,detail=false}={}){
 const baseSize=bandWidth*box[2]/displayWidth,paths=[];
 for(const loop of loops){if(loop.length<3)continue;const raw=loop.map(([x,y])=>[box[0]+x*box[2],box[1]+y*box[3],.5]);
  const minSpan=Math.min(Math.max(...raw.map(p=>p[0]))-Math.min(...raw.map(p=>p[0])),Math.max(...raw.map(p=>p[1]))-Math.min(...raw.map(p=>p[1])));
  const size=detail?Math.min(baseSize,Math.max(.75*box[2]/displayWidth,minSpan*.3)):baseSize;
  const lengths=raw.map((p,i)=>Math.hypot(p[0]-raw[(i+1)%raw.length][0],p[1]-raw[(i+1)%raw.length][1])),total=lengths.reduce((a,b)=>a+b,0),count=Math.max(24,Math.min(detail?2048:512,Math.ceil(total/Math.max(1,size*(detail?.125:.5))))),points=[];let edge=0,along=0;
  for(let i=0;i<count;i++){const distance=i*total/count;while(edge<raw.length-1&&along+lengths[edge]<distance)along+=lengths[edge++];const a=raw[edge],b=raw[(edge+1)%raw.length],t=(distance-along)/Math.max(.0001,lengths[edge]);points.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,.5]);}
  // Short overlapping open arcs avoid a self-intersecting closed stroke at the
  // seam, which SVG triangulation can otherwise fill as a triangular wedge.
  for(let start=0;start<count;start+=20){const arc=Array.from({length:Math.min(20,count-start)+3},(_,i)=>points[(start+i)%count]);const stroke=getStroke(arc,{size,thinning:0,streamline:0,smoothing:.3,simulatePressure:false,last:true});
   if(stroke.length)paths.push(stroke);
  }
 }
 return paths;
}
export const inkBandPath=stroke=>'M'+stroke.map(p=>p.map(v=>+v.toFixed(3)).join(',')).join('L')+'Z';
