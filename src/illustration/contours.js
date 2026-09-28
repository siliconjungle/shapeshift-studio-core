import {getStroke} from 'perfect-freehand';
// Coherent, repeatable redraws; neighbouring points (including Bézier handles)
// share the same smooth displacement. No accumulated drift when scrubbing.
export function boilPoint(x,y,time,{amount=0,rate=8,variants=3,seed=1,scale=60}={}){const frame=((Math.floor(time*rate)%variants)+variants)%variants,k=seed*1.73+frame*2.39;return[x+amount*Math.sin(y/scale+k)*Math.sin(x/scale*.7+k*.31),y+amount*Math.sin(x/scale+k*1.37)*Math.sin(y/scale*.8+k*.71)];}
export function boilShape(shape,time,config){if(!config?.enabled||!config.amount)return shape;const points=shape.points.slice();for(let i=0;i<points.length;i+=2)[points[i],points[i+1]]=boilPoint(points[i],points[i+1],time,config);return {...shape,points};}
// March a padded scalar grid. Each cell is triangulated consistently, avoiding
// ambiguous saddle connections. Result retains independent islands and holes.
export function densityContours(density,n,threshold=.18){const segments=[],value=(x,y)=>x<1||y<1||x>n||y>n?0:density[(y-1)*n+x-1],edge=(a,b)=>{const t=(threshold-a[2])/(b[2]-a[2]);return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];};
 for(let y=0;y<n+1;y++)for(let x=0;x<n+1;x++){const a=[x,y,value(x,y)],b=[x+1,y,value(x+1,y)],c=[x+1,y+1,value(x+1,y+1)],d=[x,y+1,value(x,y+1)];for(const tri of [[a,b,c],[a,c,d]]){const cuts=[];for(let i=0;i<3;i++){const p=tri[i],q=tri[(i+1)%3];if((p[2]>=threshold)!==(q[2]>=threshold))cuts.push(edge(p,q));}if(cuts.length===2)segments.push(cuts);}}
 const key=p=>p.map(v=>Math.round(v*1e7)).join(','),adj=new Map();segments.forEach((s,i)=>s.forEach(p=>{const k=key(p);if(!adj.has(k))adj.set(k,[]);adj.get(k).push(i);}));const used=new Set(),loops=[];
 for(let i=0;i<segments.length;i++){if(used.has(i))continue;let current=i,p=segments[i][0],first=key(p),ring=[];for(let guard=0;guard<=segments.length;guard++){used.add(current);ring.push(p.map(v=>v-.5));const s=segments[current],q=key(s[0])===key(p)?s[1]:s[0];if(key(q)===first)break;const next=adj.get(key(q))?.find(j=>!used.has(j));if(next===undefined)break;p=q;current=next;}if(ring.length>2)loops.push(ring);}
 return loops;
}
export function contourPaths(rings,width=1){const path=points=>'M'+points.map(p=>p.join(' ')).join('L')+'Z';return{fill:rings.map(path).join(''),ink:width>0?rings.map(r=>path(getStroke([...r,r[0]],{size:width,thinning:0,smoothing:.5,streamline:0,simulatePressure:false,last:true}))).join(''):''};}
