import * as T from 'three';

// Each original cube face owns half of the adjacent chamfer and a third of
// each corner. Shared face boundaries map to the same physical position.
export function projectChamfer(x,y,width,height,depth,bevel,offset=0){
 const p=[x,y,depth/2],core=[width/2-bevel,height/2-bevel,depth/2-bevel];
 const excess=p.map((v,i)=>Math.max(0,Math.abs(v)-core[i]));
 const sum=excess.reduce((a,b)=>a+b,0);
 const n=new T.Vector3(Math.abs(x)>core[0]+1e-8?Math.sign(x):0,Math.abs(y)>core[1]+1e-8?Math.sign(y):0,1).normalize();
 return {position:p.map((v,i)=>Math.sign(v)*(Math.min(Math.abs(v),core[i])+excess[i]*bevel/sum)+n.getComponent(i)*offset),normal:n.toArray()};
}

function clip(poly,axis,value,positive){
 const out=[];
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],da=(a[axis]-value)*(positive?1:-1),db=(b[axis]-value)*(positive?1:-1);
  if(da>=-1e-9)out.push(a);
  if((da>1e-9&&db< -1e-9)||(da< -1e-9&&db>1e-9)){const t=da/(da-db);out.push(a.map((v,j)=>v+(b[j]-v)*t));}
 }
 return out;
}

// Clip at every crease before projection, rather than letting a large SVG
// triangle bridge a flat face and bevel. UVs remain tied to the source SVG.
export function chamferArtwork(source,width,height,depth,bevel){
 const pos=[],norm=[],uv=[],paint=[],p=source.attributes.position,c=source.attributes.sourcePaint;
 const xs=[-width/2,-width/2+bevel,width/2-bevel,width/2],ys=[-height/2,-height/2+bevel,height/2-bevel,height/2];
 const count=source.index?.count??p.count;
 for(let i=0;i<count;i+=3){
  const ids=[0,1,2].map(j=>source.index?source.index.getX(i+j):i+j);
  const triangle=ids.map(j=>[p.getX(j),p.getY(j),c.getX(j),c.getY(j),c.getZ(j)]);
  const minX=Math.min(...triangle.map(v=>v[0])),maxX=Math.max(...triangle.map(v=>v[0])),minY=Math.min(...triangle.map(v=>v[1])),maxY=Math.max(...triangle.map(v=>v[1]));
  for(let x=0;x<3;x++)for(let y=0;y<3;y++){
   if(maxX<xs[x]||minX>xs[x+1]||maxY<ys[y]||minY>ys[y+1])continue;
   let poly=clip(triangle,0,xs[x],true);poly=clip(poly,0,xs[x+1],false);poly=clip(poly,1,ys[y],true);poly=clip(poly,1,ys[y+1],false);
   const normal=projectChamfer((xs[x]+xs[x+1])/2,(ys[y]+ys[y+1])/2,width,height,depth,bevel).normal;
   for(let j=1;j<poly.length-1;j++){
    const tri=[poly[0],poly[j],poly[j+1]];
    if(Math.abs((tri[1][0]-tri[0][0])*(tri[2][1]-tri[0][1])-(tri[2][0]-tri[0][0])*(tri[1][1]-tri[0][1]))<1e-12)continue;
    for(const v of tri){pos.push(...projectChamfer(v[0],v[1],width,height,depth,bevel).position);norm.push(...normal);uv.push(v[0]/width+.5,v[1]/height+.5);paint.push(...v.slice(2));}
   }
  }
 }
 const g=new T.BufferGeometry();for(const [name,data,size] of [['position',pos,3],['normal',norm,3],['uv',uv,2],['sourcePaint',paint,3]])g.setAttribute(name,new T.Float32BufferAttribute(data,size));g.setAttribute('paintRole',new T.Float32BufferAttribute(new Float32Array(pos.length/3),1));g.setAttribute('paintTone',new T.Float32BufferAttribute(new Float32Array(pos.length/3).fill(1),1));g.computeBoundingSphere();return g;
}

export function bodyFace(width,height,depth,bevel){
 const pos=[],norm=[],uv=[];
 const xs=[-width/2,-width/2+bevel,width/2-bevel,width/2],ys=[-height/2,-height/2+bevel,height/2-bevel,height/2];
 for(let x=0;x<3;x++)for(let y=0;y<3;y++){
  const corners=[[xs[x],ys[y]],[xs[x+1],ys[y]],[xs[x+1],ys[y+1]],[xs[x],ys[y+1]]];
  const n=projectChamfer((xs[x]+xs[x+1])/2,(ys[y]+ys[y+1])/2,width,height,depth,bevel).normal;
  for(const i of [0,1,2,0,2,3]){const [a,b]=corners[i];pos.push(...projectChamfer(a,b,width,height,depth,bevel).position);norm.push(...n);uv.push(a/width+.5,b/height+.5);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(norm,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));return g;
}

export function chamferBox([x,y,z],bevel){
 if(!Number.isFinite(bevel)||bevel<=0||bevel>=Math.min(x,y,z)/2)throw Error('Chamfer must be positive and smaller than half the narrowest dimension');
 const defs=[[x,y,z,0,0],[x,y,z,0,Math.PI],[z,y,x,0,Math.PI/2],[z,y,x,0,-Math.PI/2],[x,z,y,-Math.PI/2,0],[x,z,y,Math.PI/2,0]];
 const parts=defs.map(([w,h,d,rx,ry])=>bodyFace(w,h,d,bevel).applyMatrix4(new T.Matrix4().makeRotationFromEuler(new T.Euler(rx,ry,0))));
 const g=T.mergeGeometries(parts);parts.forEach(p=>p.dispose());return g;
}
