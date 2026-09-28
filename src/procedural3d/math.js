import {mirroredScale} from '../puppet-studio/scene3d/core/mirroring.js';
import {Vector3,Quaternion,Matrix4,Euler} from 'three';
export const vector=v=>new Vector3(...v);
export function sceneWorlds(nodes){const byId=new Map(nodes.map(n=>[n.id,n])),worlds=new Map();function world(id){if(worlds.has(id))return worlds.get(id);const n=byId.get(id),local=new Matrix4().compose(vector(n.position),new Quaternion().setFromEuler(new Euler(...n.rotation.map(v=>v*Math.PI/180))),vector(mirroredScale(n)));if(n.parent)local.premultiply(world(n.parent));worlds.set(id,local);return local;}for(const n of nodes)world(n.id);return worlds;}
export function setWorld(nodes,worlds,id,matrix){const byId=new Map(nodes.map(n=>[n.id,n])),n=byId.get(id),local=n.parent?worlds.get(n.parent).clone().invert().multiply(matrix):matrix,position=new Vector3(),rotation=new Quaternion(),scale=new Vector3();local.decompose(position,rotation,scale);n.position=position.toArray();n.rotation=new Euler().setFromQuaternion(rotation).toArray().slice(0,3).map(v=>v*180/Math.PI);n.scale=mirroredScale(n,scale.toArray());const next=sceneWorlds(nodes);worlds.clear();for(const [id,m]of next)worlds.set(id,m);}
export function solveChain3D(points,lengths,target,{pole=new Vector3(0,1,0),bendLimit=Math.PI,mode='reach'}={}){
 const root=points[0].clone(),total=lengths.reduce((a,b)=>a+b,0),direction=new Vector3(),axis=new Vector3();
 const forward=()=>{let previous=null;for(let i=1;i<points.length;i++){direction.subVectors(points[i],points[i-1]);if(direction.lengthSq()<1e-12)direction.copy(previous??pole);direction.normalize();if(previous&&direction.angleTo(previous)>bendLimit){axis.crossVectors(previous,direction);if(axis.lengthSq()<1e-12)axis.crossVectors(previous,new Vector3(1,0,0));if(axis.lengthSq()<1e-12)axis.crossVectors(previous,new Vector3(0,0,1));direction.copy(previous).applyAxisAngle(axis.normalize(),bendLimit);}points[i].copy(points[i-1]).addScaledVector(direction,lengths[i-1]);previous=direction.clone();}};
 if(mode==='follow'){points[0].copy(target);forward();return points;}
 if(root.distanceTo(target)>=total){direction.subVectors(target,root).normalize();for(let i=1;i<points.length;i++)points[i].copy(points[i-1]).addScaledVector(direction,lengths[i-1]);return points;}
 // A two-link analytic solution supplies a stable knee plane, including straight rest chains.
 if(points.length===3){const d=Math.max(1e-8,root.distanceTo(target)),reach=Math.max(Math.abs(lengths[0]-lengths[1])+1e-8,Math.min(total-1e-8,d)),x=(lengths[0]**2-lengths[1]**2+reach**2)/(2*reach),h=Math.sqrt(Math.max(0,lengths[0]**2-x*x));direction.subVectors(target,root);if(direction.lengthSq()<1e-12)direction.set(1,0,0);direction.normalize();axis.copy(pole).addScaledVector(direction,-pole.dot(direction));if(axis.lengthSq()<1e-10)axis.crossVectors(direction,new Vector3(1,0,0));if(axis.lengthSq()<1e-10)axis.crossVectors(direction,new Vector3(0,0,1));points[1].copy(root).addScaledVector(direction,x).addScaledVector(axis.normalize(),h);points[2].copy(root).addScaledVector(direction,reach);if(bendLimit>=Math.PI-1e-8)return points;}
 for(let step=0;step<32;step++){points.at(-1).copy(target);for(let i=points.length-2;i>=0;i--){direction.subVectors(points[i],points[i+1]);if(direction.lengthSq()<1e-12)direction.copy(pole);points[i].copy(points[i+1]).addScaledVector(direction.normalize(),lengths[i]);}points[0].copy(root);forward();if(points.at(-1).distanceToSquared(target)<1e-8)break;}
 return points;
}

/** Remove the displayed procedural pose before committing a gizmo edit. */
export function unapplySceneProcedural(sample,id,current){
 const base=sample?.procedural?.authored.find(n=>n.id===id),solved=sample?.byId.get(id);if(!base||!solved)return current;
 const matrix=n=>new Matrix4().compose(vector(n.position),new Quaternion().setFromEuler(new Euler(...n.rotation.map(v=>v*Math.PI/180))),vector(mirroredScale(n)));
 const result=matrix({...current,mirror:base.mirror}).multiply(matrix(solved).invert()).multiply(matrix(base)),p=new Vector3(),q=new Quaternion(),s=new Vector3();result.decompose(p,q,s);
 return {position:p.toArray(),rotation:new Euler().setFromQuaternion(q).toArray().slice(0,3).map(v=>v*180/Math.PI),scale:mirroredScale(base,s.toArray())};
}
