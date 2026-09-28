import {densityContours,contourPaths} from './contours.js';
import {fieldForce} from './controls.js';
import {clamp,colorAt,random,hash} from '../puppet-studio/fx/math.js';
const cache=new Map();
class Fluid{
 constructor(config){this.config=config;this.n=Math.round(config.resolution);this.size=this.n*this.n;this.frame=0;for(const key of ['u','v','d','temperature','tmp','a','b','pressure','div','solid'])this[key]=new Float32Array(this.size);this.r=random(config.seed);}
 sample(field,x,y){const n=this.n;x=clamp(x,0,n-1.001);y=clamp(y,0,n-1.001);const i=Math.floor(x),j=Math.floor(y),fx=x-i,fy=y-j;return(field[i+j*n]*(1-fx)+field[i+1+j*n]*fx)*(1-fy)+(field[i+(j+1)*n]*(1-fx)+field[i+1+(j+1)*n]*fx)*fy;}
 step(){const c=this.config,n=this.n,dt=1/30,t=this.frame*dt;this.frame++;
  this.solid.fill(0);if(c.solidMask)for(let i=0;i<this.size;i++)this.solid[i]=c.solidMask[i]>.5?1:0;for(const o of c.obstacles??[]){const l=Math.max(0,Math.floor(o.x*n)),r=Math.min(n,Math.ceil((o.x+o.width)*n)),top=Math.max(0,Math.floor(o.y*n)),bottom=Math.min(n,Math.ceil((o.y+o.height)*n));for(let y=top;y<bottom;y++)for(let x=l;x<r;x++)this.solid[x+y*n]=1;}
  const emitting=(c.sourcePulse??0)<=0||((t-(c.delay??0))*(c.sourcePulse??0))%1<(c.sourceDuty??.5);
  if(emitting&&t>=(c.delay??0)&&t<(c.delay??0)+c.duration){const radius=Math.max(1,n*c.sourceRadius),cx=n*(c.sourceX??.5)+Math.sin(t*3)*n*(c.sourceWobble??.025),cy=n*(c.sourceY??.82);for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++){const i=x+y*n,dist=Math.hypot(x-cx,y-cy)/radius,mask=c.sourceMask?.[i]??Math.max(0,1-dist),w=mask*c.rate;if(w<=0||this.solid[i])continue;this.d[i]+=w*c.density*dt*9;this.temperature[i]+=w*c.temperature*dt*8;this.u[i]+=(c.velocityX/n+(this.r()-.5)*.2)*w;this.v[i]+=c.velocityY/n*w;}}
  for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++){const i=x+y*n;this.a[i]=(this.v[i+1]-this.v[i-1]-this.u[i+n]+this.u[i-n])*.5;}
  for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++){const i=x+y*n,dx=(Math.abs(this.a[i+1])-Math.abs(this.a[i-1]))*.5,dy=(Math.abs(this.a[i+n])-Math.abs(this.a[i-n]))*.5,len=Math.hypot(dx,dy)+.0001;this.u[i]+=dy/len*this.a[i]*c.vorticity*dt;this.v[i]-=dx/len*this.a[i]*c.vorticity*dt+c.buoyancy*this.temperature[i]*dt*8;const damping=1/(1+c.viscosity*dt*n*n);this.u[i]=(this.u[i]+(c.gravityX??0)*Math.min(1,this.d[i])*dt/n)*damping;this.v[i]=(this.v[i]+(c.gravityY??0)*Math.min(1,this.d[i])*dt/n)*damping;}
  if(c.surfaceTension>0){
   for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++){const i=x+y*n,gx=(this.d[i+1]-this.d[i-1])*.5,gy=(this.d[i+n]-this.d[i-n])*.5,len=Math.hypot(gx,gy)+.0001;this.a[i]=gx/len;this.b[i]=gy/len;}
   for(let y=2;y<n-2;y++)for(let x=2;x<n-2;x++){const i=x+y*n,curvature=(this.a[i+1]-this.a[i-1]+this.b[i+n]-this.b[i-n])*.5,edge=Math.min(1,Math.hypot(this.d[i+1]-this.d[i-1],this.d[i+n]-this.d[i-n]));this.u[i]-=c.surfaceTension*curvature*this.a[i]*edge*dt;this.v[i]-=c.surfaceTension*curvature*this.b[i]*edge*dt;}
  }
  if(c.motionFields?.length)for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++){const f=fieldForce(c.motionFields,[(c.x??0)+(x/n-.5)*c.width,(c.y??0)+(y/n-.5)*c.height],t),i=x+y*n;this.u[i]+=f[0]/c.width*dt;this.v[i]+=f[1]/c.height*dt;}
  this.pressure.fill(0);for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++){const i=x+y*n;this.div[i]=-.5*(this.u[i+1]-this.u[i-1]+this.v[i+n]-this.v[i-n]);}
  for(let k=0;k<18;k++)for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++){const i=x+y*n;this.pressure[i]=(this.div[i]+this.pressure[i-1]+this.pressure[i+1]+this.pressure[i-n]+this.pressure[i+n])/4;}
  for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++){const i=x+y*n;this.u[i]-=.5*(this.pressure[i+1]-this.pressure[i-1]);this.v[i]-=.5*(this.pressure[i+n]-this.pressure[i-n]);if(this.solid[i])this.u[i]=this.v[i]=0;}
  this.a.set(this.u);this.b.set(this.v);for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++){const i=x+y*n,bx=x-dt*this.a[i]*n,by=y-dt*this.b[i]*n;this.u[i]=this.sample(this.a,bx,by);this.v[i]=this.sample(this.b,bx,by);this.tmp[i]=this.solid[i]?0:this.sample(this.d,bx,by)*Math.exp(-c.dissipation*dt);}
  this.d.set(this.tmp);for(let i=0;i<this.size;i++)this.temperature[i]*=.985;
 }
}
export function fluidAt(config,time){const key=JSON.stringify(config),frame=Math.max(0,Math.floor(time*30));let fluid=cache.get(key);if(!fluid||fluid.frame>frame){fluid=new Fluid(config);cache.set(key,fluid);if(cache.size>12)cache.delete(cache.keys().next().value);}while(fluid.frame<frame)fluid.step();return {density:fluid.d,n:fluid.n,frame:fluid.frame};}
export function fluidPixels(config,time){const {density,n}=fluidAt(config,time),pixels=new Uint8ClampedArray(n*n*4);for(let i=0;i<density.length;i++){const d=clamp(density[i]),color=colorAt(config.colors,config.gradient?d:Math.floor(d*config.colors.length)/Math.max(1,config.colors.length-1));pixels[i*4]=color[0];pixels[i*4+1]=color[1];pixels[i*4+2]=color[2];pixels[i*4+3]=Math.round(255*(config.fade?d:d>.05?1:0));}return{pixels,width:n,height:n};}
export function clearFluidCache(){cache.clear();}

const contourCache=new WeakMap();
export function fluidContours(config,time){const state=fluidAt(config,time);let cached=contourCache.get(state.density);const key=[state.frame,config.threshold??.18,config.strokeWidth??2,config.width,config.height].join(':');if(cached?.key===key)return cached.value;const rings=densityContours(state.density,state.n,config.threshold??.18).map(r=>r.map(([x,y])=>[x/state.n*config.width,y/state.n*config.height]));const paths=contourPaths(rings,config.strokeWidth??2),value={...paths,rings};contourCache.set(state.density,{key,value});return value;}
