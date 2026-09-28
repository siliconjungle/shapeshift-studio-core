const add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]),mul=(a,s)=>a.map(x=>x*s),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=(a,f=[0,1,0])=>Math.hypot(...a)>1e-10?mul(a,1/Math.hypot(...a)):f,lerp=(a,b,t)=>add(mul(a,1-t),mul(b,t));
export function spinePoint(points,t){const v=Math.max(0,Math.min(1,t))*(points.length-1),i=Math.min(points.length-2,Math.floor(v)),u=v-i,p=points[i],q=points[i+1],a=points[i-1]??sub(mul(p,2),q),b=points[i+2]??sub(mul(q,2),p);return p.map((x,k)=>.5*((2*x)+(-a[k]+q[k])*u+(2*a[k]-5*x+4*q[k]-b[k])*u*u+(-a[k]+3*x-3*q[k]+b[k])*u*u*u));}
export function noodleDeformer(n,dimension=3){
 const count=128,points=Array.from({length:count+1},(_,i)=>spinePoint(n.points,i/count)),lengths=[0];for(let i=1;i<=count;i++)lengths.push(lengths[i-1]+Math.hypot(...sub(points[i],points[i-1])));const length=Math.max(1e-5,lengths[count]),frames=[];let right=[1,0,0],old=[0,1,0];
 for(let i=0;i<=count;i++){const tangent=unit(sub(points[Math.min(count,i+1)],points[Math.max(0,i-1)]),old),axis=cross(old,tangent),s=Math.hypot(...axis),c=Math.max(-1,Math.min(1,dot(old,tangent)));if(s>1e-8){const k=mul(axis,1/s);right=add(add(mul(right,c),mul(cross(k,right),s)),mul(k,dot(k,right)*(1-c)));}right=unit(sub(right,mul(tangent,dot(right,tangent))),unit(cross(tangent,[0,0,1]),[1,0,0]));frames.push({right,back:unit(cross(right,tangent),[0,0,1])});old=tangent;}
 const at=(values,t)=>{const v=t*(values.length-1),i=Math.min(values.length-2,Math.floor(v));return values[i]+(values[i+1]-values[i])*(v-i);};
 const compensation=n.volume?Math.pow(Math.max(.05,length*n.stretch),dimension===2?1:.5):1;
 const map=p=>{const u=Math.max(0,Math.min(1,p[1]+.5)),distance=u*length;let lo=0,hi=count;while(hi-lo>1){const mid=(lo+hi)>>1;if(lengths[mid]<distance)lo=mid;else hi=mid;}
  const f=(distance-lengths[lo])/Math.max(1e-10,lengths[hi]-lengths[lo]),t=(lo+f)/count,A=frames[lo],B=frames[hi];
  let rx=A.right[0]+(B.right[0]-A.right[0])*f,ry=A.right[1]+(B.right[1]-A.right[1])*f,rz=A.right[2]+(B.right[2]-A.right[2])*f,bx=A.back[0]+(B.back[0]-A.back[0])*f,by=A.back[1]+(B.back[1]-A.back[1])*f,bz=A.back[2]+(B.back[2]-A.back[2])*f;
  const rl=Math.hypot(rx,ry,rz)||1,bl=Math.hypot(bx,by,bz)||1;rx/=rl;ry/=rl;rz/=rl;bx/=bl;by/=bl;bz/=bl;
  const angle=(at(n.twists,t)+n.turn)*Math.PI/180,r=at(n.widths,t)*n.thickness/compensation,cos=Math.cos(angle),sin=Math.sin(angle),x=(p[0]*cos+p[2]*sin)*r,z=(-p[0]*sin+p[2]*cos)*r;
  // Extrapolate beyond either cap instead of collapsing outlying artwork.
  const tx=by*rz-bz*ry,ty=bz*rx-bx*rz,tz=bx*ry-by*rx,end=(p[1]+.5-u)*n.stretch/(Math.hypot(tx,ty,tz)||1),a=points[lo],b=points[hi],anchor=n.points[0];
  return [anchor[0]+(a[0]+(b[0]-a[0])*f-anchor[0])*n.stretch+rx*x+bx*z+tx*end,anchor[1]+(a[1]+(b[1]-a[1])*f-anchor[1])*n.stretch+ry*x+by*z+ty*end,anchor[2]+(a[2]+(b[2]-a[2])*f-anchor[2])*n.stretch+rz*x+bz*z+tz*end];};
 return {point:map,length,points,frames};
}
// Normal transformation through the deformation Jacobian retains smooth source
// normals and intentional hard edges, including after twist and nonuniform width.
export function deformNormal(map,p,n){const axis=Math.abs(n[1])<.9?[0,1,0]:[1,0,0],a=unit(cross(axis,n),[1,0,0]),b=cross(n,a),e=1e-4,da=sub(map(add(p,mul(a,e))),map(sub(p,mul(a,e)))),db=sub(map(add(p,mul(b,e))),map(sub(p,mul(b,e))));return unit(cross(da,db),n);}
