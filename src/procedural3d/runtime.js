import {solveMovement} from './movement.js';
import {trackingOrder,solveTracking} from './tracking.js';
import {Vector3,Quaternion,Matrix4} from 'three';
import {vector,sceneWorlds,setWorld,solveChain3D} from './math.js';
import {orientContact,updateContact,worldRotation} from './foot-orientation.js';
import {PrimitiveTerrain} from './terrain.js';
const STEP=1/60,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const position=matrix=>new Vector3().setFromMatrixPosition(matrix);

/** Deterministic scene-space replay. The source sampler never consumes solved output. */
export class SceneProceduralTimeline {
 constructor(scene,sampler){this.scene=scene;this.definition=scene.procedural;this.sampler=sampler;this.terrain=new PrimitiveTerrain(scene);this.signature=null;this.movementOrder=trackingOrder(scene.procedural.movers??[],scene.nodes);this.trackingOrder=trackingOrder(scene.procedural.trackers??[],scene.nodes);}
 reset(clip,parameters){this.clip=clip;this.parameters=parameters;this.tick=-1;this.feet=new Map();this.chains=new Map();this.gaits=new Map();this.bodies=new Map();this.tracking=new Map();this.movement=new Map();this.frame=null;}
 sample(clip,time,{parameters={}}={}){
  const signature=JSON.stringify([clip,parameters]),tick=Math.floor(Math.max(0,time)/STEP+1e-7);if(signature!==this.signature||tick<this.tick){this.reset(clip,parameters);this.signature=signature;}
  while(this.tick<tick){this.tick++;this.advance(this.tick*STEP);}
  return this.frame;
 }
 advance(time){
  const raw=this.sampler.sample(this.clip,time,{parameters:this.parameters}),nodes=structuredClone(raw.nodes),worlds=sceneWorlds(nodes),defs=new Map(nodes.map(n=>[n.id,n]));
  const authored=nodes.map(({id,position,rotation,scale,mirror})=>({id,position:[...position],rotation:[...rotation],scale:[...scale],mirror})),candidates=new Map(),p=this.definition;
  const movers=solveMovement(this.movementOrder,nodes,worlds,this.movement,time===0?0:STEP);this.terrain.update(nodes,worlds);
  for(const c of p.chains){if(c.enabled===false)continue;const root=worlds.get(c.root),home=position(worlds.get(c.target));let points=this.chains.get(c.id);if(!points){points=c.rest.map(v=>vector(v).applyMatrix4(root));this.chains.set(c.id,points);}if(c.mode!=='step')continue;
   const direction=vector(c.direction??[0,-1,0]).normalize(),reach=c.reach??5,ray=at=>this.terrain.cast(at.clone().addScaledVector(direction,-reach/2),direction,reach);let hit=ray(home),state=this.feet.get(c.id);orientContact(hit,c,worlds);
   if(!state){state={foot:(hit?.point??points.at(-1)).clone(),normal:(hit?.normal??direction.clone().negate()).clone(),moving:false,contact:hit,rotation:hit?.rotation?.clone()};this.feet.set(c.id,state);}
   if(!state.moving&&state.contact&&worlds.has(state.contact.node)){updateContact(state.contact,worlds);state.foot.copy(state.contact.point);state.normal.copy(state.contact.normal);if(state.rotation)state.rotation.copy(state.contact.rotation);}
   if(state.moving){updateContact(state.to,worlds);const u=clamp((time-state.start)/(c.stepDuration??.25),0,1),ease=u*u*(3-2*u);state.foot.lerpVectors(state.from,state.to.point,ease).addScaledVector(state.direction,-Math.sin(u*Math.PI)*(c.stepHeight??.3));if(state.rotation&&state.to.rotation)state.rotation.slerpQuaternions(state.fromRotation,state.to.rotation,ease);if(u>=1){state.moving=false;state.contact=state.to;state.normal.copy(state.to.normal);}}
   const wants=!!hit&&!state.moving&&state.foot.distanceTo(hit.point)>(c.stepDistance??.35);
   if(wants&&(c.overshoot??.4)>0){const along=hit.point.clone().sub(state.foot).projectOnPlane(direction);if(along.lengthSq()>1e-10)hit=ray(hit.point.clone().addScaledVector(along.normalize(),(c.stepDistance??.35)*(c.overshoot??.4)))??hit;}
   orientContact(hit,c,worlds);state.hasGround=!!hit;candidates.set(c.id,{c,state,hit,direction,wants});
  }
  const start=c=>{c.state.from=c.state.foot.clone();c.state.fromRotation=c.state.rotation?.clone();if(c.hit.rotation&&!c.state.rotation){c.state.rotation=worldRotation(worlds.get(c.c.joints.at(-1)));c.state.fromRotation=c.state.rotation.clone();}c.state.to=c.hit;c.state.direction=c.direction.clone();c.state.start=time;c.state.moving=true;},owned=new Set();
  for(const gait of p.gaits){if(gait.enabled===false)continue;gait.groups.flat().forEach(id=>owned.add(id));let state=this.gaits.get(gait.id);if(!state){state={next:0,active:null};this.gaits.set(gait.id,state);}if(state.active!==null){if(gait.groups[state.active].some(id=>this.feet.get(id)?.moving))continue;state.next=(state.active+1)%gait.groups.length;state.active=null;}for(let n=0;n<gait.groups.length;n++){const g=(state.next+n)%gait.groups.length,wanted=gait.groups[g].map(id=>candidates.get(id)).filter(c=>c?.wants);if(!wanted.length)continue;wanted.forEach(start);state.active=g;break;}}
  for(const [id,c]of candidates)if(!owned.has(id)&&c.wants)start(c);
  const bodyReports=[];
  for(const b of p.bodies){if(b.enabled===false)continue;const feet=b.chains.map(id=>this.feet.get(id)).filter(f=>f?.hasGround);if(!feet.length)continue;
   const up=vector(b.up??[0,1,0]).normalize(),toY=new Quaternion().setFromUnitVectors(up,new Vector3(0,1,0)),contacts=feet.map(f=>(f.moving?f.from:f.foot).clone().applyQuaternion(toY)),mean=contacts.reduce((s,v)=>s.add(v),new Vector3()).multiplyScalar(1/contacts.length);
   let xx=0,zz=0,xz=0,xy=0,zy=0;for(const v of contacts){const x=v.x-mean.x,y=v.y-mean.y,z=v.z-mean.z;xx+=x*x;zz+=z*z;xz+=x*z;xy+=x*y;zy+=z*y;}
   const det=xx*zz-xz*xz,a=Math.abs(det)>1e-10?(xy*zz-zy*xz)/det:0,k=Math.abs(det)>1e-10?(zy*xx-xy*xz)/det:0;
   const normal=Math.abs(det)>1e-10?new Vector3(-a,1,-k).normalize().applyQuaternion(toY.clone().invert()):feet.reduce((v,f)=>v.add(f.normal),new Vector3()).normalize();if(normal.dot(up)<0)normal.negate();
   const matrix=worlds.get(b.node),center=position(matrix),local=center.clone().applyQuaternion(toY),ground=mean.y+a*(local.x-mean.x)+k*(local.z-mean.z),offset=clamp(ground+b.height-local.y,-(b.maxOffset??3),b.maxOffset??3),tilt=new Quaternion().setFromUnitVectors(up,normal),angle=tilt.angleTo(new Quaternion()),limit=b.maxTilt??.7;if(angle>limit)tilt.slerp(new Quaternion(),1-limit/angle);
   let state=this.bodies.get(b.node);if(!state){state={offset,tilt:tilt.clone()};this.bodies.set(b.node,state);}else{const t=1-Math.exp(-(b.response??10)*STEP);state.offset+=(offset-state.offset)*t;state.tilt.slerp(tilt,t);}
   const q=new Quaternion(),scale=new Vector3();matrix.decompose(center,q,scale);center.addScaledVector(up,state.offset);q.premultiply(state.tilt);setWorld(nodes,worlds,b.node,new Matrix4().compose(center,q,scale));bodyReports.push({node:b.node,offset:state.offset,tilt:state.tilt.toArray(),normal:normal.toArray()});
  }
  const trackers=solveTracking(this.trackingOrder,nodes,worlds,this.tracking,time===0?0:STEP);
  const reports=[];
  for(const c of p.chains){if(c.enabled===false)continue;const root=worlds.get(c.root),points=this.chains.get(c.id),foot=this.feet.get(c.id),target=foot?foot.foot:position(worlds.get(c.target));points[0].copy(position(root));const pole=vector(c.pole??[0,1,0]).transformDirection(root);solveChain3D(points,c.lengths,target,{pole,bendLimit:c.bendLimit??Math.PI,mode:c.mode});
   const axis=c.axis??'y',unit=axis==='x'?new Vector3(1,0,0):axis==='z'?new Vector3(0,0,1):new Vector3(0,1,0);
   for(let i=0;i<c.segments.length;i++){const id=c.segments[i],node=defs.get(id),mid=points[i].clone().add(points[i+1]).multiplyScalar(.5),dir=points[i+1].clone().sub(points[i]),rotation=new Quaternion().setFromUnitVectors(unit,dir.clone().normalize()),scale=new Vector3().setFromMatrixScale(worlds.get(id));scale[axis]=dir.length()/node.dimensions[['x','y','z'].indexOf(axis)];setWorld(nodes,worlds,id,new Matrix4().compose(mid,rotation,scale));}
   for(let i=0;i<(c.joints?.length??0);i++){const id=c.joints[i],m=worlds.get(id).clone();if(i===c.joints.length-1&&foot?.rotation){const at=new Vector3(),q=new Quaternion(),scale=new Vector3();m.decompose(at,q,scale);m.compose(points[i],foot.rotation,scale);}else m.setPosition(points[i]);setWorld(nodes,worlds,id,m);}
   const error=points.at(-1).distanceTo(target);reports.push({id:c.id,points:points.map(p=>p.toArray()),target:target.toArray(),error,moving:foot?.moving??false,grounded:!!foot?.hasGround&&!foot.moving&&error<.01,normal:foot?.normal.toArray(),terrain:foot?.contact?.node,footRotation:foot?.rotation?.toArray()});
  }
  this.frame={time,nodes,authored,chains:reports,bodies:bodyReports,trackers,movers};
 }
 dispose(){this.terrain.dispose();}
}
