export function nearestOnSegment(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));return[a[0]+t*dx,a[1]+t*dy];}
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]];
function sweepCircle(start,end,center,radius){
 const v=sub(end,start),m=sub(start,center),speed=dot(v,v),b=dot(m,v),c=dot(m,m)-radius*radius;
 if(speed<1e-16||c<-1e-7||b>=0)return null;
 const discriminant=b*b-speed*c;if(discriminant<0)return null;
 const t=(-b-Math.sqrt(discriminant))/speed;if(t< -1e-8||t>1)return null;
 const at=start.map((v,k)=>v+sub(end,start)[k]*Math.max(0,t)),n=sub(at,center),length=Math.hypot(...n);if(length<1e-10)return null;
 return {t:Math.max(0,t),at,normal:n.map(x=>x/length)};
}
/** Sweep a particle disc against the full finite capsule, including its end caps. */
export function sweepContact(start,end,radius,collider){
 if(collider.type==='circle')return sweepCircle(start,end,collider.center,radius+collider.radius);
 const edge=sub(collider.b,collider.a),length=Math.hypot(...edge),axis=edge.map(v=>v/length),normal=[axis[1],-axis[0]],motion=sub(end,start),from=dot(sub(start,collider.a),normal),toward=dot(motion,normal),hits=[];
 for(const sign of [-1,1]){
  if(sign*from<radius-1e-7||sign*toward>=-1e-10)continue;
  const t=(sign*radius-from)/toward;if(t< -1e-8||t>1)continue;
  const at=start.map((x,k)=>x+motion[k]*Math.max(0,t)),along=dot(sub(at,collider.a),axis);
  if(along>=0&&along<=length)hits.push({t:Math.max(0,t),at,normal:normal.map(v=>v*sign)});
 }
 for(const center of [collider.a,collider.b]){const hit=sweepCircle(start,end,center,radius);if(hit)hits.push(hit);}
 return hits.sort((a,b)=>a.t-b.t)[0]??null;
}
function recordContact(point,collider,normal,incoming){
 const existing=point.contacts.find(c=>c.collider===collider);
 if(existing){existing.incoming=Math.min(existing.incoming,incoming);existing.normal=normal;return;}
 point.contacts.push({collider,normal,incoming,friction:collider.friction??.5,bounce:collider.bounce??0});
}
export function collide(point,collider){
 if(!point.w)return;
 const start=point.old??point.p,velocity=sub(point.p,start),hit=sweepContact(start,point.p,point.radius,collider);
 if(hit){
  const depth=dot(sub(point.p,hit.at),hit.normal);
  if(depth<0)point.p=point.p.map((v,k)=>v-hit.normal[k]*depth);
  recordContact(point,collider,hit.normal,dot(velocity,hit.normal));
 }
 const q=collider.type==='circle'?collider.center:nearestOnSegment(point.p,collider.a,collider.b),r=point.radius+(collider.type==='circle'?collider.radius:0),delta=sub(point.p,q),d=Math.hypot(...delta);
 if(d>=r)return;
 const normal=d>1e-8?delta.map(v=>v/d):collider.type==='segment'?[(collider.b[1]-collider.a[1]),-(collider.b[0]-collider.a[0])]:[0,-1],n=Math.hypot(...normal);normal[0]/=n;normal[1]/=n;
 point.p=[q[0]+normal[0]*r,q[1]+normal[1]*r];recordContact(point,collider,normal,dot(velocity,normal));
}
/** Ray query used by feet; circle and finite segment contacts share the same terrain. */
export function contactAt(origin,direction,reach,colliders){
 const len=Math.hypot(...direction)||1,d=direction.map(v=>v/len);let best=null,bestT=reach;
 const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
 for(const c of colliders){let t;
  if(c.type==='segment'){const e=[c.b[0]-c.a[0],c.b[1]-c.a[1]],v=[c.a[0]-origin[0],c.a[1]-origin[1]],den=cross(d,e);if(Math.abs(den)<1e-9)continue;const u=cross(v,d)/den;t=cross(v,e)/den;if(u<0||u>1)continue;}
  else{const v=[origin[0]-c.center[0],origin[1]-c.center[1]],b=v[0]*d[0]+v[1]*d[1],disc=b*b-v[0]**2-v[1]**2+c.radius**2;if(disc<0)continue;t=-b-Math.sqrt(disc);if(t<0)t=-b+Math.sqrt(disc);}
  if(t>=0&&t<=bestT){bestT=t;const point=[origin[0]+d[0]*t,origin[1]+d[1]*t],normal=c.type==='circle'?point.map((v,k)=>(v-c.center[k])/c.radius):[c.b[1]-c.a[1],c.a[0]-c.b[0]],n=Math.hypot(...normal);for(let k=0;k<2;k++)normal[k]/=n;if(normal[0]*d[0]+normal[1]*d[1]>0)for(let k=0;k<2;k++)normal[k]*=-1;best={point,normal,collider:c};}
 }return best;
}

export function findContact(origin,direction,reach,colliders){return contactAt(origin,direction,reach,colliders)?.point??null;}
