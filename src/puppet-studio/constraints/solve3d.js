import * as T from 'three';
import {solveConstraints} from './solve.js';
const rad=Math.PI/180,deg=180/Math.PI;
const compose=t=>new T.Matrix4().compose(new T.Vector3(...t.position),new T.Quaternion().setFromEuler(new T.Euler(...t.rotation.map(v=>v*rad))),new T.Vector3(...t.scale));
function decompose(m){const p=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();m.decompose(p,q,s);return{position:p.toArray(),rotation:new T.Euler().setFromQuaternion(q).toArray().slice(0,3).map(v=>v*deg),scale:s.toArray()};}
export function solveConstraints3D(nodes,constraints,clip,time){if(!constraints?.length)return new Map();const byId=new Map(nodes.map(n=>[n.id,n])),locals=new Map(nodes.map(n=>[n.id,{position:[...n.position],rotation:[...n.rotation],scale:[...n.scale]}])),worlds=new Map();
 const world=id=>{if(!id)return new T.Matrix4();if(!worlds.has(id)){const n=byId.get(id);worlds.set(id,world(n.parent).clone().multiply(compose(locals.get(id))));}return worlds.get(id);};
 const adapter={get(id,space){return space==='local'?structuredClone(locals.get(id)):decompose(world(id));},convert(id,t,from,to){if(from===to)return structuredClone(t);const parent=world(byId.get(id).parent).clone();return decompose((to==='local'?parent.invert():parent).multiply(compose(t)));},set(id,t){locals.set(id,t);worlds.clear();}};
 const changed=solveConstraints(nodes,constraints,clip,time,adapter);return new Map([...changed].map(id=>[id,locals.get(id)]));
}
