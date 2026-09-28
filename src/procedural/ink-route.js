import {getStroke} from 'perfect-freehand';
import {random} from '../puppet-studio/fx/math.js';

const mix=(a,b,t)=>a+(b-a)*t;
const point=(a,b,t)=>({x:mix(a.x,b.x,t),y:mix(a.y,b.y,t)});
const distance=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);
const path=outline=>outline.length?'M'+outline.map(p=>p.map(v=>+v.toFixed(2)).join(',')).join('L')+'Z':'';
/** Catmull–Rom route fitted through authored waypoints, with arc-length-spaced
 * Perfect Freehand ink marks. Pure, deterministic and independent of the DOM.
 * t is distance / total length, so callers can reveal or travel at steady speed. */
export function inkRoute(waypoints,{width=3,dash=4,spacing=16,seed=1,roughness=.2,margin=12}={}){
 if(!Array.isArray(waypoints)||waypoints.length<2||waypoints.length>128||waypoints.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))throw Error('Route needs 2–128 finite waypoints');
 if(![width,dash,spacing,roughness,margin].every(Number.isFinite)||width<=0||dash<0||spacing<=0||roughness<0||roughness>1||margin<0)throw Error('Invalid route style');
 const samples=[{...waypoints[0],length:0}],rand=random(seed);let length=0;
 for(let i=0;i<waypoints.length-1;i++){
  const a=waypoints[Math.max(0,i-1)],b=waypoints[i],c=waypoints[i+1],d=waypoints[Math.min(waypoints.length-1,i+2)];
  const count=Math.min(256,Math.max(12,Math.ceil(distance(b,c)/3)));
  for(let j=1;j<=count;j++){const t=j/count,t2=t*t,t3=t2*t,p={};for(const k of ['x','y'])p[k]=.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t2+(-a[k]+3*b[k]-3*c[k]+d[k])*t3);length+=distance(samples.at(-1),p);samples.push({...p,length});}
 }
 const at=t=>routePoint({samples,length},t),marks=[],usable=Math.max(0,length-margin*2);
 if(usable>0){const count=Math.min(2048,Math.max(1,Math.round(usable/spacing))),step=usable/count;
  for(let i=0;i<count;i++){const along=margin+(i+.5)*step,t=along/length,p=at(t),jitter=(rand()-.5)*roughness*width,localWidth=width*(1+(rand()-.5)*roughness*.4),half=Math.min(dash/2,step*.35),a=at((along-half)/length),b=at((along+half)/length),dx=b.x-a.x,dy=b.y-a.y,m=Math.hypot(dx,dy)||1,nx=-dy/m,ny=dx/m;
   // Sample the curved route inside each dash and vary pressure through the
   // stroke. Perfect Freehand supplies the filled contour, including round caps.
   const input=half>0?Array.from({length:5},(_,j)=>{
    const u=j/4,q=at((along-half+2*half*u)/length);
    return[q.x+nx*jitter,q.y+ny*jitter,.35+Math.sin(u*Math.PI)*.35];
   }):[[p.x,p.y,.5]];
   marks.push({t,x:p.x,y:p.y,d:path(getStroke(input,{size:localWidth,thinning:half>0?.35:0,smoothing:.5,streamline:0,simulatePressure:false,last:true}))});
  }
 }
 return{samples,length,marks,d:'M'+samples.map(p=>`${p.x.toFixed(2)},${p.y.toFixed(2)}`).join('L')};
}
export function routePoint(route,t){const target=Math.max(0,Math.min(1,t))*route.length,s=route.samples;if(!route.length)return{x:s[0].x,y:s[0].y};let lo=1,hi=s.length-1;while(lo<hi){const mid=(lo+hi)>>>1;if(s[mid].length<target)lo=mid+1;else hi=mid;}const a=s[lo-1],b=s[lo];return point(a,b,(target-a.length)/Math.max(1e-9,b.length-a.length));}
