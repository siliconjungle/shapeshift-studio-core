import {moveForward} from './motion.js';

const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function area(points){let sum=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];sum+=a[0]*b[1]-a[1]*b[0]}return sum/2}
function lineDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/Math.max(1e-12,dx*dx+dy*dy)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)}
const middle=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
export function flattenSpline(ring){
 const points=[ring[0]];
 const visit=(a,b,c,d,depth=0)=>{
  if(depth>=12||(dist(a,d)<=4&&Math.max(lineDistance(b,a,d),lineDistance(c,a,d))<=.08)){points.push(d);return}
  const ab=middle(a,b),bc=middle(b,c),cd=middle(c,d),abc=middle(ab,bc),bcd=middle(bc,cd),m=middle(abc,bcd);
  visit(a,ab,abc,m,depth+1);visit(m,bcd,cd,d,depth+1);
 };
 for(let i=0;i<ring.length-1;i+=3)visit(ring[i],ring[i+1],ring[i+2],ring[i+3]);
 if(dist(points[0],points.at(-1))>1e-6)points.push(points[0]);
 return points;
}
function segmentIndex(poly,cellSize){
 const cells=new Map();
 for(let i=1;i<poly.length;i++){
  const a=poly[i-1],b=poly[i],x0=Math.floor(Math.min(a[0],b[0])/cellSize),x1=Math.floor(Math.max(a[0],b[0])/cellSize),y0=Math.floor(Math.min(a[1],b[1])/cellSize),y1=Math.floor(Math.max(a[1],b[1])/cellSize);
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const key=x+','+y;if(!cells.has(key))cells.set(key,[]);cells.get(key).push([a,b])}
 }
 return cells;
}
function nearest(p,cells,cellSize,radius){
 const x=Math.floor(p[0]/cellSize),y=Math.floor(p[1]/cellSize),reach=Math.ceil(radius/cellSize);let best=Infinity,result=null;
 for(let yy=y-reach;yy<=y+reach;yy++)for(let xx=x-reach;xx<=x+reach;xx++)for(const [a,b]of cells.get(xx+','+yy)??[]){
  const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/Math.max(1e-12,dx*dx+dy*dy)));
  const q=[a[0]+t*dx,a[1]+t*dy],d=dist(p,q);if(d<best){best=d;result=q}
 }
 return best<=radius?result:null;
}
function within(a,b,tolerance){
 const cells=segmentIndex(b,tolerance*2),cellSize=tolerance*2;
 for(const p of a){const x=Math.floor(p[0]/cellSize),y=Math.floor(p[1]/cellSize);let best=Infinity;
  for(let yy=y-1;yy<=y+1;yy++)for(let xx=x-1;xx<=x+1;xx++)for(const [u,v]of cells.get(xx+','+yy)??[])best=Math.min(best,lineDistance(p,u,v));
  if(best>tolerance)return false;
 }
 return true;
}
function localDifference(a,b,p){
 let total=0,count=0;
 for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
  const x=Math.round(p[0])+dx,y=Math.round(p[1])+dy;if(x<0||y<0||x>=a.width||y>=a.height)continue;
  const k=(y*a.width+x)*4;for(let c=0;c<3;c++)total+=Math.abs(a.data[k+c]-b.data[k+c]);count+=3;
 }
 return count?total/count:0;
}
function advectRing(ring,field,previous,current,noiseTolerance){
 const sx=field.width/current.width,sy=field.height/current.height,deltas=[];
 for(let i=0;i<ring.length;i+=3){
  const p=ring[i];if(localDifference(previous,current,p)<=noiseTolerance){deltas.push([0,0]);continue}
  const moved=moveForward(field,[p[0]*sx,p[1]*sy]);deltas.push([moved[0]/sx-p[0],moved[1]/sy-p[1]]);
 }
 // Identical closed endpoints get identical movement, even at image borders.
 if(dist(ring[0],ring.at(-1))<1e-6)deltas[deltas.length-1]=deltas[0];
 const out=[ring[0].map((v,k)=>v+deltas[0][k])];
 for(let i=0;i<deltas.length-1;i++){
  const a=deltas[i],b=deltas[i+1];
  for(let j=1;j<=3;j++)out.push(ring[i*3+j].map((v,k)=>v+a[k]*(1-j/3)+b[k]*(j/3)));
 }
 return out;
}
function correctRing(predicted,old,reference,previous,current,noiseTolerance){
 const cells=segmentIndex(reference,4),offsets=[],locked=[];
 for(let i=0;i<predicted.length;i+=3){
  const p=predicted[i],q=nearest(p,cells,4,3);if(!q)return null;
  locked.push(localDifference(previous,current,old[i])<=noiseTolerance);
  if(locked.at(-1)){offsets.push([0,0]);continue}
  const dx=q[0]-p[0],dy=q[1]-p[1],length=Math.hypot(dx,dy),amount=length>.2?Math.min(1.5,length-.2)/length:0;
  offsets.push([dx*amount,dy*amount]);
 }
 const n=offsets.length-1,smoothed=offsets.slice(0,n).map((d,i)=>{
  if(locked[i])return [0,0];
  // Nearby anchors share correction; long curves do not pull their neighbours.
  let weight=1,result=[...d];
  for(const j of [(i+n-1)%n,(i+1)%n]){const w=.35*Math.exp(-dist(predicted[i*3],predicted[j*3])/12);weight+=w;result[0]+=offsets[j][0]*w;result[1]+=offsets[j][1]*w}
  return result.map(v=>v/weight);
 });
 smoothed.push(smoothed[0]);const out=[predicted[0].map((v,k)=>v+smoothed[0][k])];
 for(let i=0;i<n;i++)for(let j=1;j<=3;j++)out.push(predicted[i*3+j].map((v,k)=>v+smoothed[i][k]*(1-j/3)+smoothed[i+1][k]*j/3));
 return out;
}

/** Keep an existing smooth spline only when its motion-guided geometry stays
 * close to the fresh reference fit in BOTH directions. Reference geometry wins
 * when motion, ring correspondence, or topology is uncertain. */
export function updateTrackedCurves(oldRings,reference,field,previous,current,{curveTolerance=.65,noiseTolerance=3}={}){
 if(!field||oldRings.length!==reference.length)return null;
 const predicted=oldRings.map(r=>advectRing(r,field,previous,current,noiseTolerance));
 const referencePolys=reference.map(flattenSpline),used=new Set();
 for(let ri=0;ri<predicted.length;ri++){
  const ring=predicted[ri];
  const poly=flattenSpline(ring),signed=area(poly);let match=-1;
  for(let i=0;i<referencePolys.length;i++){
   const candidate=referencePolys[i];if(used.has(i)||Math.sign(signed)!==Math.sign(area(candidate)))continue;
   if(within(poly,candidate,curveTolerance)&&within(candidate,poly,curveTolerance)){match=i;break}
   const corrected=correctRing(ring,oldRings[ri],candidate,previous,current,noiseTolerance);
   if(corrected){const flat=flattenSpline(corrected);if(Math.sign(area(flat))===Math.sign(signed)&&within(flat,candidate,curveTolerance)&&within(candidate,flat,curveTolerance)){predicted[ri]=corrected;match=i;break}}
  }
  if(match<0)return null;used.add(match);
 }
 return predicted;
}
