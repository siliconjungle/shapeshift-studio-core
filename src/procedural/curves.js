/** Interpolating cardinal curves; zero curvature preserves the authored polygon. */
export function curvedPoints(points,{closed=false,curve=1,steps=8,radii}={}){
 if(!curve||points.length<2)return {points:points.map(p=>[...p]),radii:radii?.slice()};
 const out=[],widths=radii?[]:undefined,count=points.length,segments=closed?count:count-1;
 const at=i=>closed?points[(i+count)%count]:points[Math.max(0,Math.min(count-1,i))];
 for(let i=0;i<segments;i++){
  const prev=at(i-1),a=at(i),b=at(i+1),next=at(i+2);
  for(let j=0;j<steps;j++){
   const t=j/steps,t2=t*t,t3=t2*t,h00=2*t3-3*t2+1,h10=t3-2*t2+t,h01=-2*t3+3*t2,h11=t3-t2;
   const spline=a.map((v,k)=>h00*v+h10*(b[k]-prev[k])*.5+h01*b[k]+h11*(next[k]-a[k])*.5);
   out.push(a.map((v,k)=>v+(b[k]-v)*t+curve*(spline[k]-(v+(b[k]-v)*t))));
   if(widths)widths.push(radii[i]+(radii[(i+1)%count]-radii[i])*t);
  }
 }
 if(!closed){out.push([...points.at(-1)]);if(widths)widths.push(radii.at(-1));}
 return {points:out,radii:widths};
}
