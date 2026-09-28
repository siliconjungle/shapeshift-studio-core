import {mirroredScale} from '../puppet-studio/scene3d/core/mirroring.js';
import {Vector3,Quaternion,Matrix4,Euler} from 'three';
import {sceneWorlds} from './math.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const quaternion=rotation=>new Quaternion().setFromEuler(new Euler(...rotation.map(v=>v*Math.PI/180)));

/** Parents and tracked inputs must be solved before their dependants. */
export function trackingOrder(trackers,nodes){
 const byId=new Map(nodes.map(n=>[n.id,n])),ordered=[],visiting=new Set(),done=new Set();
 const beneath=(id,ancestor)=>{while(id){if(id===ancestor)return true;id=byId.get(id)?.parent;}return false;};
 function visit(t){
  if(done.has(t))return;if(visiting.has(t))throw Error('Procedural 3D: tracking dependency cycle');visiting.add(t);
  for(const other of trackers)if([byId.get(t.node)?.parent,t.target,t.origin].some(id=>beneath(id,other.node)))visit(other);
  visiting.delete(t);done.add(t);ordered.push(t);
 }
 trackers.forEach(visit);return ordered;
}

/** Local, neutral-relative tracking keeps limits stable while the parent moves. */
export function solveTracking(ordered,nodes,worlds,states,dt){
 const byId=new Map(nodes.map(n=>[n.id,n])),reports=[];
 for(const t of ordered){
  if(t.enabled===false)continue;
  const n=byId.get(t.node),neutral=quaternion(n.rotation),scale=new Vector3(...mirroredScale(n)),forward=new Vector3(...(t.forward??[0,0,1])).multiply(scale).normalize(),up=new Vector3(...(t.up??[0,1,0])).multiply(scale).normalize();
  const right=new Vector3().crossVectors(up,forward).normalize();up.crossVectors(forward,right).normalize();
  const basis=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(right,up,forward));
  const origin=new Vector3().setFromMatrixPosition(worlds.get(t.origin??t.node)),goal=new Vector3().setFromMatrixPosition(worlds.get(t.target));
  if(n.parent){const inverse=worlds.get(n.parent).clone().invert();origin.applyMatrix4(inverse);goal.applyMatrix4(inverse);}
  const direction=goal.sub(origin).applyQuaternion(neutral.clone().invert()).applyQuaternion(basis.clone().invert());
  const yaw=t.yaw??[-Math.PI/2,Math.PI/2],pitch=t.pitch??[-Math.PI/4,Math.PI/4];
  let state=states.get(t.id);if(!state){state={yaw:0,pitch:0};states.set(t.id,state);}
  if(direction.lengthSq()>1e-12){
   const response=1-Math.exp(-(t.response??8)*dt);
   state.yaw+=(clamp(Math.atan2(direction.x,direction.z),...yaw)-state.yaw)*response;
   state.pitch+=(clamp(Math.atan2(direction.y,Math.hypot(direction.x,direction.z)),...pitch)-state.pitch)*response;
  }
  const aim=new Vector3(Math.sin(state.yaw)*Math.cos(state.pitch),Math.sin(state.pitch),Math.cos(state.yaw)*Math.cos(state.pitch));
  const correction=new Quaternion().setFromUnitVectors(new Vector3(0,0,1),aim),angle=correction.angleTo(new Quaternion()),cone=t.cone??Math.PI;
  if(angle>cone)correction.slerp(new Quaternion(),1-cone/angle);
  const local=neutral.multiply(basis).multiply(correction).multiply(basis.clone().invert());
  n.rotation=new Euler().setFromQuaternion(local).toArray().slice(0,3).map(v=>v*180/Math.PI);
  const next=sceneWorlds(nodes);worlds.clear();for(const [id,m]of next)worlds.set(id,m);
  const actual=new Vector3(0,0,1).applyQuaternion(correction);
  reports.push({id:t.id,node:t.node,yaw:Math.atan2(actual.x,actual.z),pitch:Math.atan2(actual.y,Math.hypot(actual.x,actual.z)),angle:Math.min(angle,cone),rotation:local.toArray()});
 }
 return reports;
}
