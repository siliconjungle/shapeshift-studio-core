import {sampleRecipe} from './model.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function smoothMin(a,b,k){if(!k)return Math.min(a,b);const h=clamp(.5+.5*(b-a)/k,0,1);return b+(a-b)*h-k*h*(1-h);}
export function makeField(recipe,time=0){const r=sampleRecipe(recipe,time),parts=r.parts.map(p=>({...p,c:Math.cos(p.angle*Math.PI/180),s:Math.sin(p.angle*Math.PI/180)}));return(x,y,z=0)=>{
 if(r.mode==='metaballs'){let sum=0;for(const p of parts){const dx=x-p.position[0],dy=y-p.position[1],dz=r.dimension===3?z-p.position[2]:0;sum+=p.radius*p.radius/Math.max(1e-12,dx*dx+dy*dy+dz*dz);}return 1-sum;}
 let value=Infinity;for(const p of parts){const dx=x-p.position[0],dy=y-p.position[1],px=p.c*dx+p.s*dy,py=-p.s*dx+p.c*dy,pz=r.dimension===3?z-p.position[2]:0;let d;
 if(p.type==='ball')d=Math.hypot(px,py,pz)-p.radius;
 else if(p.type==='capsule')d=Math.hypot(px,py-clamp(py,-p.size[1],p.size[1]),pz)-p.radius;
 else if(p.type==='path'){const sd=polygonDistance(p.contours,px/p.size[0],py/p.size[1],p.fillRule)*Math.min(p.size[0],p.size[1]);if(r.dimension===2)d=sd;else{const z=Math.abs(pz)-p.size[2];d=Math.hypot(Math.max(sd,0),Math.max(z,0))+Math.min(Math.max(sd,z),0);}}
 else if(p.type==='ring')d=r.dimension===2?Math.abs(Math.hypot(px,py)-p.size[0])-p.radius:Math.hypot(Math.hypot(px,pz)-p.size[0],py)-p.radius;
 else{const q=[Math.abs(px)-p.size[0],Math.abs(py)-p.size[1],r.dimension===3?Math.abs(pz)-p.size[2]:-Infinity];d=Math.hypot(...q.map(v=>Math.max(v,0)))+Math.min(Math.max(...q),0)-p.radius;}
 if(value===Infinity)value=d;else if(p.operation==='subtract')value=-smoothMin(-value,d,r.blend);else if(p.operation==='intersect')value=-smoothMin(-value,-d,r.blend);else value=smoothMin(value,d,r.blend);
 }return value;};}
// Keep one frame box for the entire bake, including animated size/position keys.
export function recipeBounds(r){let lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity],radius2=0;for(const p of r.parts){const positions=[p.position],sizes=[p.size],radii=[p.radius];for(const t of r.tracks.filter(t=>t.part===p.id))for(const k of t.keys){if(t.channel==='position')positions.push(k.value);if(t.channel==='size')sizes.push(k.value);if(t.channel==='radius')radii.push(k.value);}const rad=Math.max(...radii),size=Math.max(...sizes.flat()),extent=p.type==='path'?Math.max(...p.contours.flat().flat().map(Math.abs))*size*1.5+size:p.type==='ball'?rad:p.type==='box'?Math.sqrt(3)*size+rad:size+rad;radius2+=rad*rad;for(const pos of positions)for(let i=0;i<3;i++){lo[i]=Math.min(lo[i],pos[i]-extent);hi[i]=Math.max(hi[i],pos[i]+extent);}}
 const blend=Math.max(r.blend,...r.tracks.filter(t=>t.channel==='blend').flatMap(t=>t.keys.map(k=>k.value))),padding=(r.mode==='metaballs'?Math.sqrt(radius2):blend*Math.max(1,r.parts.length-1)/4)+.15;
 const center=lo.map((v,i)=>(v+hi[i])/2),span=Math.max(...hi.slice(0,r.dimension).map((v,i)=>v-lo[i]))+padding*2;return{min:center.map(v=>v-span/2),max:center.map(v=>v+span/2),size:span};}

function polygonDistance(rings,x,y,rule){let distance=Infinity,winding=0,crossings=0;for(const ring of rings)for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1),0,1);distance=Math.min(distance,Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy));if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]){crossings++;winding+=b[1]>a[1]?1:-1;}}return (rule==='evenodd'?crossings%2:winding!==0)?-distance:distance;}
