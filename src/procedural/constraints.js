// An exactly folded chain has two equivalent turn directions. Pick one
// consistently so roundoff after translating a rig cannot flip its bend.
const wrap = a => {const value=Math.atan2(Math.sin(a),Math.cos(a));return Math.abs(Math.abs(value)-Math.PI)<1e-10?Math.PI:value;};
export const distance = (a,b) => Math.hypot(b[0]-a[0],b[1]-a[1]);
export function constrainDistance(a,b,length,stiffness=1){
 const dx=b.p[0]-a.p[0],dy=b.p[1]-a.p[1],d=Math.hypot(dx,dy),w=a.w+b.w;
 if(w===0)return;const error=(d-length)*stiffness/w,ux=d>1e-9?dx/d:1,uy=d>1e-9?dy/d:0;
 a.p[0]+=ux*error*a.w;a.p[1]+=uy*error*a.w;b.p[0]-=ux*error*b.w;b.p[1]-=uy*error*b.w;
}
export function constrainBend(a,b,c,angle,limit,stiffness=1){
 const u=[b.p[0]-a.p[0],b.p[1]-a.p[1]],v=[c.p[0]-b.p[0],c.p[1]-b.p[1]],u2=u[0]**2+u[1]**2,v2=v[0]**2+v[1]**2;
 if(u2<1e-8||v2<1e-8)return;const delta=wrap(Math.atan2(v[1],v[0])-Math.atan2(u[1],u[0])-angle),error=delta-Math.max(-limit,Math.min(limit,delta));
 const ga=[-u[1]/u2,u[0]/u2],gc=[-v[1]/v2,v[0]/v2],gb=[-ga[0]-gc[0],-ga[1]-gc[1]],points=[a,b,c],grad=[ga,gb,gc];
 const weight=points.reduce((sum,p,i)=>sum+p.w*(grad[i][0]**2+grad[i][1]**2),0);if(weight<1e-12)return;
 points.forEach((p,i)=>{p.p[0]-=stiffness*error*p.w*grad[i][0]/weight;p.p[1]-=stiffness*error*p.w*grad[i][1]/weight;});
}
export function constrainArea(points,target,stiffness=1){
 let area=0,weight=0;const grads=points.map((p,i)=>{const prev=points[(i+points.length-1)%points.length].p,next=points[(i+1)%points.length].p;area+=p.p[0]*next[1]-p.p[1]*next[0];const g=[(next[1]-prev[1])/2,(prev[0]-next[0])/2];weight+=p.w*(g[0]**2+g[1]**2);return g;});
 if(weight<1e-10)return;const correction=(area/2-target)*stiffness/weight;points.forEach((p,i)=>{p.p[0]-=correction*p.w*grads[i][0];p.p[1]-=correction*p.w*grads[i][1];});
}
export function shapeMatch(points,rest,stiffness=1){
 const center=points.reduce((s,p)=>[s[0]+p.p[0]/points.length,s[1]+p.p[1]/points.length],[0,0]);
 const rc=rest.reduce((s,p)=>[s[0]+p[0]/rest.length,s[1]+p[1]/rest.length],[0,0]);let dot=0,cross=0;
 points.forEach((p,i)=>{const x=rest[i][0]-rc[0],y=rest[i][1]-rc[1],u=p.p[0]-center[0],v=p.p[1]-center[1];dot+=x*u+y*v;cross+=x*v-y*u;});
 const angle=Math.atan2(cross,dot),c=Math.cos(angle),s=Math.sin(angle);
 points.forEach((p,i)=>{if(!p.w)return;const x=rest[i][0]-rc[0],y=rest[i][1]-rc[1];p.p[0]+=(center[0]+c*x-s*y-p.p[0])*stiffness;p.p[1]+=(center[1]+s*x+c*y-p.p[1])*stiffness;});
}
export function solveChain(points,lengths,target,{mode='reach',bendLimit=Math.PI}={}){
 if(mode==='follow'){
  points[0].p=[...target];let previous=null;
  for(let i=1;i<points.length;i++){const a=points[i-1].p,b=points[i].p;let angle=Math.atan2(b[1]-a[1],b[0]-a[0]);if(previous!==null)angle=previous+Math.max(-bendLimit,Math.min(bendLimit,wrap(angle-previous)));points[i].p=[a[0]+Math.cos(angle)*lengths[i-1],a[1]+Math.sin(angle)*lengths[i-1]];previous=angle;}return;
 }
 const root=[...points[0].p],total=lengths.reduce((a,b)=>a+b,0);
 if(distance(root,target)>=total){const d=distance(root,target)||1,u=[(target[0]-root[0])/d,(target[1]-root[1])/d];points[0].p=root;for(let i=1;i<points.length;i++)points[i].p=points[i-1].p.map((x,k)=>x+u[k]*lengths[i-1]);return;}
 // Two-link limbs have an exact solution; iterative convergence slows near extension.
 if(points.length===3&&bendLimit>=Math.PI-1e-8){
  const delta=target.map((v,k)=>v-root[k]),d=Math.hypot(...delta),old=points[1].p.map((v,k)=>v-root[k]),oldLength=Math.hypot(...old),u=d>1e-8?delta.map(v=>v/d):oldLength>1e-8?old.map(v=>v/oldLength):[1,0];
  const reach=Math.max(Math.abs(lengths[0]-lengths[1]),Math.min(total,d));
  if(reach<1e-8){points[1].p=root.map((v,k)=>v+u[k]*lengths[0]);points[2].p=[...root];return;}
  const x=(lengths[0]**2-lengths[1]**2+reach**2)/(2*reach),h=Math.sqrt(Math.max(0,lengths[0]**2-x*x)),side=u[0]*old[1]-u[1]*old[0]<-1e-8?-1:1;
  points[1].p=[root[0]+u[0]*x-u[1]*h*side,root[1]+u[1]*x+u[0]*h*side];points[2].p=root.map((v,k)=>v+u[k]*reach);return;
 }
 // A constrained fold can trap the forward/backward solve. Retry from two
 // distributed arcs only after it stalls, retaining the closest valid pose.
 let best,bestError=Infinity;
 for(let attempt=0;attempt<(points.length>2?3:1);attempt++){
 if(attempt){
  const heading=Math.atan2(target[1]-root[1],target[0]-root[0]),spread=Math.min(bendLimit*(points.length-2),Math.PI*2*(1-distance(root,target)/total))*(attempt===1?1:-1);
  points[0].p=[...root];for(let i=1;i<points.length;i++){const angle=heading+spread*((i-1)/(points.length-2)-.5);points[i].p=[points[i-1].p[0]+Math.cos(angle)*lengths[i-1],points[i-1].p[1]+Math.sin(angle)*lengths[i-1]];}
 }
 for(let step=0;step<24;step++){
  points.at(-1).p=[...target];
  for(let i=points.length-2;i>=0;i--){const a=points[i+1].p,b=points[i].p,d=distance(a,b)||1;points[i].p=a.map((x,k)=>x+(b[k]-x)*lengths[i]/d);}
  points[0].p=[...root];let previous=null;
  for(let i=1;i<points.length;i++){const a=points[i-1].p,b=points[i].p;let angle=Math.atan2(b[1]-a[1],b[0]-a[0]);if(previous!==null)angle=previous+Math.max(-bendLimit,Math.min(bendLimit,wrap(angle-previous)));points[i].p=[a[0]+Math.cos(angle)*lengths[i-1],a[1]+Math.sin(angle)*lengths[i-1]];previous=angle;}
  const error=distance(points.at(-1).p,target);if(error<bestError){bestError=error;best=points.map(p=>[...p.p]);}
  if(error<.001)return;
 }

 }
 points.forEach((p,i)=>p.p=best[i]);
}
