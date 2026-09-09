import {mirroredScale} from './mirroring.js';
import * as T from 'three';
// Authored placement is outside the action machine's simulation. Replaying or
// resetting an action must never replace a user's placement with its seed pose.
export class ControllerPlacement {
 constructor(reference,node){this.reference=structuredClone(reference);this.position=new T.Vector3();this.rotation=new T.Quaternion();this.scale=new T.Vector3();this.offset=new T.Quaternion();this.factor=new T.Vector3();this.set(node);}
 set(node){this.mirror=node.mirror;this.position.fromArray(node.position);this.rotation.setFromEuler(new T.Euler(...node.rotation.map(T.MathUtils.degToRad)));this.scale.fromArray(node.scale);this.update();}
 update(){this.offset.copy(this.rotation).multiply(new T.Quaternion(...this.reference.quaternion).invert());this.factor.copy(this.scale).divide(new T.Vector3(...this.reference.scale));this.identity=this.position.distanceToSquared(new T.Vector3(...this.reference.position))<1e-24&&Math.abs(this.offset.w)>1-1e-14&&this.factor.distanceToSquared(new T.Vector3(1,1,1))<1e-24;}
 point(p){if(this.identity)return p;return p.sub(new T.Vector3(...this.reference.position)).multiply(this.factor).applyQuaternion(this.offset).add(this.position);}
 apply(root,pose){if(this.identity){root.position.fromArray(pose.position);root.quaternion.fromArray(pose.quaternion);root.scale.fromArray(mirroredScale(this,pose.scale));return;}root.position.copy(this.point(new T.Vector3(...pose.position)));root.quaternion.copy(this.offset).multiply(new T.Quaternion(...pose.quaternion));root.scale.fromArray(mirroredScale(this,pose.scale)).multiply(this.factor);}
 capture(root,pose){this.rotation.copy(root.quaternion).multiply(new T.Quaternion(...pose.quaternion).invert()).multiply(new T.Quaternion(...this.reference.quaternion));this.scale.fromArray(mirroredScale(this,root.scale.toArray())).divide(new T.Vector3(...pose.scale)).multiply(new T.Vector3(...this.reference.scale));this.update();const delta=new T.Vector3(...pose.position).sub(new T.Vector3(...this.reference.position)).multiply(this.factor).applyQuaternion(this.offset);this.position.copy(root.position).sub(delta);}
 definition(){const e=new T.Euler().setFromQuaternion(this.rotation);return {position:this.position.toArray(),rotation:[e.x,e.y,e.z].map(T.MathUtils.radToDeg),scale:this.scale.toArray()};}
}
