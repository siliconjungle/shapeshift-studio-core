// Convex dice and regular solids with inset face panels and chamfered edges.
// Atlas UVs belong to each face; the whole skin deforms as one mesh.
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,t)=>a.map(v=>v*t),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>mul(a,1/(Math.hypot(...a)||1)),mean=ps=>mul(ps.reduce(add,[0,0,0]),1/ps.length);
export const DICE_SIDES=[4,5,6,8,10,12,20];
export function solidVertices(sides,kind='die'){
 if(!Number.isInteger(sides)||sides<3||sides>20||!['die','prism'].includes(kind)||kind==='die'&&!DICE_SIDES.includes(sides))throw Error('Choose a supported solid or a prism with 3–20 sides');
 if(sides===5&&kind==='die')return solidVertices(10);
 if(kind==='prism')return [-.65,.65].flatMap(y=>Array.from({length:sides},(_,i)=>[Math.cos(i*2*Math.PI/sides),y,Math.sin(i*2*Math.PI/sides)]));
 if(sides===4)return [[1,1,1],[-1,-1,1],[-1,1,-1],[1,-1,-1]];
 if(sides===6)return [-1,1].flatMap(x=>[-1,1].flatMap(y=>[-1,1].map(z=>[x,y,z])));
 if(sides===8)return [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
 if(sides===10){const n=5,h=Math.sqrt(4*Math.sin(Math.PI/n)**2-4*Math.sin(Math.PI/(2*n))**2)/2,anti=[-1,1].flatMap(sign=>Array.from({length:n},(_,i)=>{const a=i*2*Math.PI/n+(sign===1?Math.PI/n:0);return[Math.cos(a),sign*h,Math.sin(a)];}));return solidFaces(anti).map(f=>mul(f.normal,1/dot(f.normal,f.center)));}
 const g=(1+Math.sqrt(5))/2,vertices=[];if(sides===12)vertices.push(...solidVertices(6));
 for(const a of [-1,1])for(const b of [-1,1])for(let axis=0;axis<3;axis++){const p=sides===20?[0,a,b*g]:[0,a/g,b*g];vertices.push([p[axis],p[(axis+1)%3],p[(axis+2)%3]]);}return vertices;
}
export function solidFaces(vertices){const found=new Map();for(let a=0;a<vertices.length;a++)for(let b=a+1;b<vertices.length;b++)for(let c=b+1;c<vertices.length;c++){let n=unit(cross(sub(vertices[b],vertices[a]),sub(vertices[c],vertices[a])));if(Math.hypot(...n)<.5)continue;let d=dot(n,vertices[a]),dist=vertices.map(p=>dot(n,p)-d);if(dist.some(v=>v>1e-6)&&dist.some(v=>v<-1e-6))continue;if(d<0){n=mul(n,-1);d=-d;}const ids=vertices.map((p,i)=>Math.abs(dot(n,p)-d)<1e-6?i:-1).filter(i=>i>=0),key=ids.join(',');if(found.has(key))continue;const center=mean(ids.map(i=>vertices[i])),right=unit(sub(vertices[ids[0]],center)),up=cross(n,right);ids.sort((a,b)=>Math.atan2(dot(sub(vertices[a],center),up),dot(sub(vertices[a],center),right))-Math.atan2(dot(sub(vertices[b],center),up),dot(sub(vertices[b],center),right)));found.set(key,{ids,normal:n,center,right,up});}return [...found.values()];}
export function regularSolid({sides=6,kind='die',bevel=.09}={}){
 if(!Number.isFinite(bevel)||bevel<.015||bevel>.2)throw Error('Edge softness must be between .015 and .2');
 let vertices=solidVertices(sides,kind);const radius=Math.max(...vertices.map(p=>Math.hypot(...p)));vertices=vertices.map(p=>{const v=mul(p,.94/radius);if(kind==='die'&&[5,10].includes(sides))v[1]*=.78;return v;});const faces=solidFaces(vertices),prism=kind==='prism',count=sides,columns=Math.ceil(Math.sqrt(count+1)),rows=Math.ceil((count+1)/columns),positions=[],normals=[],uvs=[],indices=[],edges=new Map(),corners=vertices.map(()=>[]);let number=0;
 const triangle=(ps,normal,uv)=>{const start=positions.length/3;for(let i=0;i<3;i++){positions.push(...ps[i]);normals.push(...normal);uvs.push(...uv[i]);}indices.push(start,start+1,start+2);};
 const blank=[((count%columns)+.5)/columns,1-(Math.floor(count/columns)+.5)/rows];
 for(const f of faces){f.right=unit(sub(vertices[f.ids[1]],vertices[f.ids[0]]));f.up=cross(f.normal,f.right);f.value=prism&&Math.abs(f.normal[1])>.01?0:(number++%count)+1;f.inset=f.ids.map(i=>add(mul(vertices[i],1-bevel),mul(f.center,bevel)));const xs=f.inset.map(p=>dot(sub(p,f.center),f.right)),ys=f.inset.map(p=>dot(sub(p,f.center),f.up)),span=2*Math.max(...xs.map(Math.abs)),height=2*Math.max(...ys.map(Math.abs)),tile=f.value?f.value-1:count;
  f.uvRadius=Math.min(...xs.map((x,i)=>{const j=(i+1)%xs.length;return Math.abs(x*ys[j]-xs[j]*ys[i])/Math.hypot(xs[j]-x,ys[j]-ys[i]);}))*.9/Math.max(span,height);
  const uv=p=>{const x=.5+dot(sub(p,f.center),f.right)/Math.max(span,height)*.9,y=.5+dot(sub(p,f.center),f.up)/Math.max(span,height)*.9;return[(tile%columns+x)/columns,1-(Math.floor(tile/columns)+1-y)/rows];};
  for(let i=0;i<f.ids.length;i++){const j=(i+1)%f.ids.length,a=f.ids[i],b=f.ids[j];triangle([f.center,f.inset[i],f.inset[j]],f.normal,[uv(f.center),uv(f.inset[i]),uv(f.inset[j])]);corners[a].push(f.inset[i]);const key=[a,b].sort((x,y)=>x-y).join(',');if(!edges.has(key))edges.set(key,[]);edges.get(key).push({a,b,p:f.inset[i],q:f.inset[j]});}
 }
 for(const pair of edges.values()){if(pair.length!==2)throw Error('Solid has an open edge');const [a,b]=pair,ps=[a.p,a.q,b.a===a.b?b.p:b.q,b.a===a.b?b.q:b.p],n=unit(mean(ps));for(const ids of [[0,1,2],[0,2,3]]){let t=ids.map(i=>ps[i]);if(dot(cross(sub(t[1],t[0]),sub(t[2],t[0])),n)<0)t.reverse();triangle(t,n,[blank,blank,blank]);}}
 for(let i=0;i<vertices.length;i++){const ps=corners[i],n=unit(vertices[i]),center=mean(ps),r=unit(sub(ps[0],center)),u=cross(n,r);ps.sort((a,b)=>Math.atan2(dot(sub(a,center),u),dot(sub(a,center),r))-Math.atan2(dot(sub(b,center),u),dot(sub(b,center),r)));for(let j=0;j<ps.length;j++)triangle([center,ps[j],ps[(j+1)%ps.length]],n,[blank,blank,blank]);}
 return{mesh:{positions,normals,indices,uvs},faces,vertices,count,columns,rows,sides,kind,bevel};
}
