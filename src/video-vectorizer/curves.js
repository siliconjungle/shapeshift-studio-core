import {signedArea} from './regions.js';
import {moveForward} from './motion.js';
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export function ringLength(ring){let n=0;for(let i=0;i<ring.length;i++)n+=distance(ring[i],ring[(i+1)%ring.length]);return n;}
function center(ring){return ring.reduce((a,p)=>[a[0]+p[0]/ring.length,a[1]+p[1]/ring.length],[0,0]);}
function resample(ring,count,offset=0) {
  const lengths=[0];for(let i=0;i<ring.length;i++)lengths.push(lengths.at(-1)+distance(ring[i],ring[(i+1)%ring.length]));
  const total=lengths.at(-1),out=[];
  for(let i=0;i<count;i++){
    const at=((i/count+offset)%1+1)%1*total;
    let lo=0,hi=ring.length;while(lo+1<hi){const mid=(lo+hi)>>1;if(lengths[mid]<=at)lo=mid;else hi=mid;}
    const a=ring[lo],b=ring[(lo+1)%ring.length],u=(at-lengths[lo])/Math.max(1e-9,lengths[lo+1]-lengths[lo]);
    out.push([a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u]);
  }
  return out;
}
function phaseAt(ring,point) {
  let best=Infinity,phase=0,at=0;const total=ringLength(ring);
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
    const t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/Math.max(1e-9,len*len)));
    const d=Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dy);
    if(d<best){best=d;phase=(at+t*len)/total}at+=len;
  }
  return phase;
}
function sourceDifference(a,b,p) {
  if(!a||!b)return Infinity;
  const x=Math.round(p[0]),y=Math.round(p[1]);let total=0,count=0;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=a.width||yy>=a.height)continue;
    const k=(yy*a.width+xx)*4;for(let c=0;c<3;c++)total+=Math.abs(a.data[k+c]-b.data[k+c]);count+=3;
  }
  return count?total/count:Infinity;
}
function ringPairing(raw,previous) {
  if(raw.length!==previous.length)return null;
  const result=[],used=new Set();
  for(const old of previous){
    const c=center(old),area=signedArea(old);let best=-1,score=Infinity;
    raw.forEach((ring,i)=>{
      if(used.has(i)||Math.sign(signedArea(ring))!==Math.sign(area))return;
      const ratio=Math.abs(signedArea(ring)/area);if(ratio<.2||ratio>5)return;
      const s=distance(c,center(ring))+Math.abs(Math.log(ratio))*4;if(s<score){score=s;best=i}
    });
    if(best<0)return null;result.push(raw[best]);used.add(best);
  }
  return result;
}
export function fitContours(raw,previous,field,previousFrame,currentFrame,{
  pointSpacing=3,curveHysteresis=.6,noiseTolerance=3,maxPointsPerRing=512
}={}) {
  const paired=previous?ringPairing(raw,previous):null;
  if(!paired)return {rings:raw.map(r=>resample(r,Math.max(4,Math.min(maxPointsPerRing,Math.ceil(ringLength(r)/pointSpacing))))),newTopology:true,heldPoints:0,totalPoints:raw.reduce((n,r)=>n+r.length,0)};
  let heldPoints=0,totalPoints=0;
  const rings=paired.map((ring,ri)=>{
    const old=previous[ri],quiet=old.map(p=>sourceDifference(previousFrame,currentFrame,p)<=noiseTolerance);
    // Flat/noisy patches cannot establish motion reliably. Anchor those points
    // before phase matching so background flow cannot rotate a still contour.
    const predicted=old.map((p,i)=>quiet[i]?p:moveForward(field,p)),phase=phaseAt(ring,predicted[0]);
    let target,score=Infinity;
    // Match contour phase globally; never match unrelated control-point indices.
    for(const shift of [-1,-.5,0,.5,1]){
      const candidate=resample(ring,old.length,phase+shift/old.length);
      let e=0;for(let i=0;i<old.length;i+=Math.max(1,Math.floor(old.length/40)))e+=distance(candidate[i],predicted[i])**2;
      if(e<score){target=candidate;score=e;}
    }
    totalPoints+=old.length;
    return old.map((p,i)=>{
      const prediction=predicted[i];
      const dx=target[i][0]-prediction[0],dy=target[i][1]-prediction[1],error=Math.hypot(dx,dy);
      let next;
      if(error<=curveHysteresis)next=prediction;
      else {
        const amount=(1-curveHysteresis/error)*(error>2?.95:.65);
        next=[prediction[0]+dx*amount,prediction[1]+dy*amount];
      }
      if(distance(next,p)<.025){heldPoints++;return p;}
      return next;
    });
  });
  // A correspondence failure must reinitialize explicitly, not invert a ring.
  if(rings.some((ring,i)=>Math.sign(signedArea(ring))!==Math.sign(signedArea(previous[i]))))
    return fitContours(raw,null,field,previousFrame,currentFrame,{pointSpacing,curveHysteresis,noiseTolerance,maxPointsPerRing});
  return {rings,newTopology:false,heldPoints,totalPoints};
}
export function sameRings(a,b) {
  return a.length===b.length&&a.every((r,i)=>r.length===b[i].length&&r.every((p,j)=>p[0]===b[i][j][0]&&p[1]===b[i][j][1]));
}
const number=n=>Number(n.toFixed(3)).toString();
export function ringsPath(rings,{curveTension=.12,scaleX=1,scaleY=1}={}) {
  const pair=p=>number(p[0]*scaleX)+' '+number(p[1]*scaleY);
  return rings.map(ring=>{
    let path='M'+pair(ring[0]);
    for(let i=0;i<ring.length;i++){
      const a=ring[(i+ring.length-1)%ring.length],b=ring[i],c=ring[(i+1)%ring.length],d=ring[(i+2)%ring.length];
      const cp=[b[0]+(c[0]-a[0])*curveTension,b[1]+(c[1]-a[1])*curveTension];
      const cq=[c[0]-(d[0]-b[0])*curveTension,c[1]-(d[1]-b[1])*curveTension];
      path+='C'+pair(cp)+' '+pair(cq)+' '+pair(c);
    }
    return path+'Z';
  }).join('');
}
