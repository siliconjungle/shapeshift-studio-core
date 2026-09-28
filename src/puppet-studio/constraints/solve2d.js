import {solvePathConstraint} from './path2d.js';
import {matrix,multiply,inverse} from '../joint-transforms.js';
import {solveIKConstraint} from './ik2d.js';
import {solveConstraints} from './solve.js';
const unit=[1,0,0,1,0,0],fromTransform=t=>({position:[t.x,t.y],rotation:[t.rotation],scale:[t.scaleX,t.scaleY]}),toTransform=t=>({x:t.position[0],y:t.position[1],rotation:t.rotation[0],scaleX:t.scale[0],scaleY:t.scale[1]});
function decompose(m){const sx=Math.hypot(m[0],m[1]),det=m[0]*m[3]-m[1]*m[2];return{position:[m[4],m[5]],rotation:[Math.atan2(m[1],m[0])*180/Math.PI],scale:[sx,det/Math.max(sx,1e-12)]};}
export function solveConstraints2D(project,clip,time,pose){if(!project.constraints?.length)return;const parent=id=>{const p=pose.get(id);return p.joint.parent?pose.get(p.joint.parent).world:unit;};
 const adapter={followPath:(c,weight,time,authored)=>solvePathConstraint(project,pose,c,weight,time,authored),ik:(c,weight)=>solveIKConstraint(project.joints,pose,c,weight),get(id,space){const p=pose.get(id);return space==='local'?fromTransform(p.transform):decompose(p.world);},convert(id,t,from,to){if(from===to)return structuredClone(t);return decompose(multiply(to==='local'?inverse(parent(id)):parent(id),matrix(toTransform(t))));},set(id,t){const p=pose.get(id);Object.assign(p.transform,toTransform(t));pose.updateBranch(id);}};
 return solveConstraints(project.joints,project.constraints,clip,time,adapter);
}
