/** Uniform arc-length samples keep brush smoothing independent of boolean tessellation. */
export function sampleClosedContour(ring,spacing=3){
 const points=ring.slice(0,-1),edges=points.map((a,i)=>{const b=points[(i+1)%points.length];return {a,b,length:Math.hypot(b[0]-a[0],b[1]-a[1])};}).filter(e=>e.length>1e-8);
 const length=edges.reduce((n,e)=>n+e.length,0);if(length<1e-8)return [];
 const count=Math.max(3,Math.ceil(length/spacing)),samples=[];let edge=0,start=0;
 for(let i=0;i<count;i++){
  const at=i*length/count;while(edge<edges.length-1&&at>start+edges[edge].length){start+=edges[edge].length;edge++;}
  const e=edges[edge],t=(at-start)/e.length;samples.push([e.a[0]+(e.b[0]-e.a[0])*t,e.a[1]+(e.b[1]-e.a[1])*t,.5]);
 }
 samples.push([...samples[0]]);return samples;
}
