/** Derived points follow a weighted position on a deforming rig. */
export const attachmentInputs=a=>[...a.sources,...(a.orient??[]),...(a.bend?.particles??[])];
/** Sum local turns instead of wrapping a head-to-tail angle at 180 degrees. */
export function pathBend(ids,points){
 let angle=0,previous;
 for(let i=1;i<ids.length;i++){
  const a=points.get(ids[i-1]).p,b=points.get(ids[i]).p,dx=b[0]-a[0],dy=b[1]-a[1];
  if(Math.hypot(dx,dy)<1e-8)continue;
  const next=Math.atan2(dy,dx);if(previous!==undefined){const turn=Math.atan2(Math.sin(next-previous),Math.cos(next-previous));angle+=Math.abs(Math.abs(turn)-Math.PI)<1e-10?Math.PI:turn;}previous=next;
 }
 return angle;
}
export function orderAttachments(attachments=[]){
 const byPoint=new Map(attachments.map(a=>[a.particle,a])),done=new Set(),visiting=new Set(),ordered=[];
 const visit=a=>{if(done.has(a.particle))return;if(visiting.has(a.particle))throw Error('Procedural: attachment dependency cycle');visiting.add(a.particle);for(const id of attachmentInputs(a))if(byPoint.has(id))visit(byPoint.get(id));visiting.delete(a.particle);done.add(a.particle);ordered.push(a);};
 for(const a of attachments)visit(a);return ordered;
}

export function applyAttachments(ordered,points){
 for(const a of ordered){
  const weights=a.weights??a.sources.map(()=>1),total=weights.reduce((s,v)=>s+v,0),position=[0,0];
  a.sources.forEach((id,i)=>{const p=points.get(id).p;position[0]+=p[0]*weights[i]/total;position[1]+=p[1]*weights[i]/total;});
  let x=1,y=0;if(a.orient){const p=points.get(a.orient[0]).p,q=points.get(a.orient[1]).p,dx=q[0]-p[0],dy=q[1]-p[1],length=Math.hypot(dx,dy);if(length>1e-8){x=dx/length;y=dy/length;}}
  let offset=a.offset??[0,0];
  if(a.bend){const b=a.bend,raw=pathBend(b.particles,points),angle=Math.max(-b.limit,Math.min(b.limit,b.absolute?Math.abs(raw):raw));offset=offset.map((v,i)=>v+angle*b.scale[i]);}
  const point=points.get(a.particle);point.p=[position[0]+x*offset[0]-y*offset[1],position[1]+y*offset[0]+x*offset[1]];point.w=0;
 }
}
