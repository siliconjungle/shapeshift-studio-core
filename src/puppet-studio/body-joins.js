import {matrix,multiply,inverse,point} from './joint-transforms.js';

// A join is authored on the moving piece. It deforms artwork, never keyframes
// or the skeleton, so scrubbing and exported playback give the same result.
export function restWorlds(project){
 const joints=new Map(project.joints.map(j=>[j.id,j])),out=new Map();
 function visit(id){if(out.has(id))return out.get(id);const j=joints.get(id),m=j.parent?multiply(visit(j.parent),matrix(j.rest)):matrix(j.rest);out.set(id,m);return m;}
 for(const j of project.joints)visit(j.id);return out;
}
export function makeBodyJoin(project,partId,bodyId,{radius,strength=1}={}){
 const body=project.joints.find(j=>j.id===bodyId),part=project.joints.find(j=>j.id===partId);
 if(!body?.sprite||!part?.sprite||part===body)throw Error('Choose two different artwork pieces.');
 const rest=restWorlds(project),p=point(multiply(inverse(rest.get(bodyId)),rest.get(partId)),{x:0,y:0});
 return {targetNode:bodyId,enabled:true,matchEdges:true,anchor:[p.x,p.y],radius:radius??Math.max(24,Math.min(body.sprite.width,body.sprite.height)*.75),strength};
}
export function validateBodyJoins(project){
 const joints=new Map(project.joints.map(j=>[j.id,j]));
 for(const j of project.joints){const v=j.bodyJoin;if(v===undefined)continue;
  const fail=message=>{throw Error('Body join: '+message);};
  if(!v||Array.isArray(v)||!j.sprite||!joints.get(v.targetNode)?.sprite||v.targetNode===j.id)fail('choose another artwork piece as the body');
  if(v.matchEdges!==undefined&&typeof v.matchEdges!=='boolean')fail('matchEdges must be true or false');
  if(typeof v.enabled!=='boolean')fail('enabled must be true or false');
  if(!Array.isArray(v.anchor)||v.anchor.length!==2||v.anchor.some(n=>!Number.isFinite(n)||Math.abs(n)>100000))fail('invalid connection point');
  if(!Number.isFinite(v.radius)||v.radius<1||v.radius>10000)fail('bend reach must be 1–10000 pixels');
  if(!Number.isFinite(v.strength)||v.strength<0||v.strength>1)fail('strength must be 0–1');
 }
}
export function applyBodyJoinCommand(project,c){
 const j=project.joints.find(j=>j.id===c.joint);if(!j)throw Error('Choose a piece to join.');
 if(c.op==='bodyJoin.remove'){delete j.bodyJoin;return j.id;}
 if(c.op==='bodyJoin.create')j.bodyJoin=makeBodyJoin(project,j.id,c.body,c.values);
 else if(c.op==='bodyJoin.update'){if(!j.bodyJoin)throw Error('Join this piece first.');j.bodyJoin={...j.bodyJoin,...c.values};}
 else throw Error('Unknown body join command');
 validateBodyJoins(project);return j.id;
}
export function bodyJoinFrame(project,pose,profiles=new Map()){
 const active=project.joints.filter(j=>j.bodyJoin?.enabled&&j.bodyJoin.strength>0);if(!active.length)return new Map();
 const rest=restWorlds(project),result=new Map();
 for(const part of active){const join=part.bodyJoin,body=join.targetNode;
  if(!pose.has(body)||!pose.has(part.id))continue;
  const relative=multiply(inverse(rest.get(body)),rest.get(part.id));
  const delta=multiply(multiply(inverse(pose.get(body).world),pose.get(part.id).world),inverse(relative));
  const profile=join.matchEdges!==false?profiles.get(part.id):null;
  if(!profile&&delta.every((v,i)=>Math.abs(v-[1,0,0,1,0,0][i])<1e-9))continue;
  const angle=Math.atan2(delta[1]-delta[2],delta[0]+delta[3]),co=Math.cos(angle),si=Math.sin(angle);
  // Polar decomposition: interpolate rotation without shrinking at a turn.
  const stretch=[co*delta[0]+si*delta[1],-si*delta[0]+co*delta[1],co*delta[2]+si*delta[3],-si*delta[2]+co*delta[3]];
  const anchor={x:join.anchor[0],y:join.anchor[1]},target=point(delta,anchor);
  const item={...join,partId:part.id,profile,angle,stretch,dx:target.x-anchor.x,dy:target.y-anchor.y};
  if(!result.has(body))result.set(body,[]);result.get(body).push(item);
 }
 return result;
}
export function deformBodyPoint(x,y,joins){
 let dx=0,dy=0,total=0;
 for(const j of joins??[]){const ax=x-j.anchor[0],ay=y-j.anchor[1],profile=j.profile,n=profile?.axis;
  const along=n?ax*n[0]+ay*n[1]:0,across=n?-ax*n[1]+ay*n[0]:0;
  const distance=n?Math.hypot(along,Math.max(0,Math.abs(across)-profile.halfWidth)):Math.hypot(ax,ay);
  const u=Math.min(1,distance/j.radius),t=Math.max(0,(u-.18)/.82),w=(1-t*t*(3-2*t))*j.strength;if(w<=0)continue;
  let fx=ax,fy=ay;
  if(profile){const knots=profile.knots;let mapped=across+knots.at(-1)[1]-knots.at(-1)[0];for(let i=1;i<knots.length;i++)if(across<=knots[i][0]){const a=knots[i-1],b=knots[i];mapped=a[1]+(b[1]-a[1])*(across-a[0])/Math.max(.0001,b[0]-a[0]);break;}const shift=(mapped-across)*w;fx-=n[1]*shift;fy+=n[0]*shift;}
  const s=j.stretch,px=fx*(1+w*(s[0]-1))+fy*w*s[2],py=fx*w*s[1]+fy*(1+w*(s[3]-1)),co=Math.cos(j.angle*w),si=Math.sin(j.angle*w);
  dx+=co*px-si*py-ax+j.dx*w;dy+=si*px+co*py-ay+j.dy*w;total+=w;
 }
 const divisor=Math.max(1,total);return {x:x+dx/divisor,y:y+dy/divisor};
}
// Renderer adapter: deform the original XY vertices, preserving Z, paint,
// indices and UVs. Passing no joins restores the exact original mesh.
export function deformBodyPositions(rest,output,joins,stride=3){
 for(let i=0;i<rest.length;i+=stride){const p=deformBodyPoint(rest[i],rest[i+1],joins);output[i]=p.x;output[i+1]=p.y;for(let k=2;k<stride;k++)output[i+k]=rest[i+k];}return output;
}
export function bindBodyJoinGeometry(geometry){
 const positions=geometry.getAttribute('position'),rest=positions.array.slice();
 return {update(joins){deformBodyPositions(rest,positions.array,joins,positions.itemSize);positions.needsUpdate=true;geometry.computeBoundingBox();geometry.computeBoundingSphere();},restore(){this.update([]);}};
}
