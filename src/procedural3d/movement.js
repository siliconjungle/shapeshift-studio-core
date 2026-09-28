import {Vector3,Matrix4} from 'three';
import {setWorld} from './math.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/** Steering adds a world-plane displacement to the sampled authored path. */
export function solveMovement(ordered,nodes,worlds,states,dt){
 const reports=[];
 for(const m of ordered){
  if(m.enabled===false)continue;
  const matrix=worlds.get(m.node),position=new Vector3().setFromMatrixPosition(matrix),up=new Vector3(...(m.up??[0,1,0])).normalize();
  let state=states.get(m.id);if(!state){state={offset:new Vector3(),angle:0,velocity:new Vector3(),angularVelocity:0};states.set(m.id,state);}
  position.add(state.offset);
  const forward=new Vector3(...(m.forward??[0,0,1])).transformDirection(matrix).applyAxisAngle(up,state.angle).projectOnPlane(up);
  if(forward.lengthSq()<1e-12){forward.set(0,0,1).projectOnPlane(up);if(forward.lengthSq()<1e-12)forward.set(1,0,0).projectOnPlane(up);}
  forward.normalize();
  const toward=new Vector3().setFromMatrixPosition(worlds.get(m.target)).sub(position).projectOnPlane(up),distance=toward.length();
  const direction=distance>1e-8?toward.clone().normalize():forward.clone();
  const angle=Math.atan2(up.dot(new Vector3().crossVectors(forward,direction)),clamp(forward.dot(direction),-1,1));
  const turnResponse=m.turnResponse??8,turnError=Math.max(0,Math.abs(angle)-(m.turnTolerance??.1));
  const desiredTurn=Math.sign(angle)*Math.min(m.turnSpeed??2,turnError*turnResponse);
  state.angularVelocity+=(desiredTurn-state.angularVelocity)*(1-Math.exp(-turnResponse*dt));
  let turn=state.angularVelocity*dt;if(Math.abs(turn)>Math.abs(angle)){turn=angle;state.angularVelocity=0;}state.angle+=turn;
  const min=m.minDistance??2,max=m.maxDistance??3,error=distance>max?distance-max:distance<min?distance-min:0;
  const response=m.moveResponse??6,desired=new Vector3();
  if(Math.abs(angle)<(m.moveAngle??Math.PI/2))desired.copy(direction).multiplyScalar(Math.sign(error)*Math.min(m.moveSpeed??1,Math.abs(error)*response));
  state.velocity.lerp(desired,1-Math.exp(-response*dt));
  const step=state.velocity.clone().multiplyScalar(dt);state.offset.add(step);position.add(step);
  const rotation=new Matrix4().makeRotationAxis(up,state.angle),pose=matrix.clone();pose.setPosition(0,0,0);pose.premultiply(rotation);pose.setPosition(position);setWorld(nodes,worlds,m.node,pose);
  reports.push({id:m.id,node:m.node,position:position.toArray(),velocity:state.velocity.toArray(),angularVelocity:state.angularVelocity,distance,angle,offset:state.offset.toArray(),turn:state.angle});
 }
 return reports;
}
