import {Vector3,Quaternion,Matrix3} from 'three';

export function worldRotation(matrix){
 const rotation=new Quaternion();matrix.decompose(new Vector3(),rotation,new Vector3());return rotation;
}

/** Capture a landing pose. Its heading stays attached to the terrain until the next step. */
export function orientContact(hit,chain,worlds){
 if(!hit||!chain.footOrientation||chain.footOrientation==='preserve')return;
 const rotation=worldRotation(worlds.get(chain.target));
 if(chain.footOrientation==='terrain'){
  const up=new Vector3(...(chain.footUp??[0,1,0])).normalize().applyQuaternion(rotation);
  rotation.premultiply(new Quaternion().setFromUnitVectors(up,hit.normal));
 }
 hit.rotation=rotation;
 hit.localRotation=worldRotation(worlds.get(hit.node)).invert().multiply(rotation);
}

export function updateContact(hit,worlds){
 const matrix=worlds.get(hit.node);if(!matrix)return;
 hit.point.copy(hit.local).applyMatrix4(matrix);
 hit.normal.copy(hit.localNormal).applyNormalMatrix(new Matrix3().getNormalMatrix(matrix));
 if(hit.rotation)hit.rotation.copy(worldRotation(matrix)).multiply(hit.localRotation);
}
