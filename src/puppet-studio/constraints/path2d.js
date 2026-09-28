import {point,multiply,inverse} from '../joint-transforms.js';
import {sampleVector} from '../vector/model.js';
import {samplePath} from '../vector/trim.js';
import {boundVector,assetMatrix} from '../bone-binding/model.js';
const cache=new WeakMap(),unit=[1,0,0,1,0,0];
export function pathFrame(project,c,pose,time){
 const target=project.joints.find(j=>j.id===c.target),asset=project.assets.find(a=>a.id===target.sprite.asset),v=asset.vector,bound=boundVector(v,target,pose,time),vector=bound?.vector??v,sprite=bound?.sprite??target.sprite,shapes=(bound?vector.shapes:sampleVector(vector,time)).filter(s=>c.path===null||s.id===c.path),m=multiply(pose.get(target.id).world,assetMatrix(sprite,vector)),key=c.path??'*';
 let entries=cache.get(target.sprite);if(!entries){entries=new Map();cache.set(target.sprite,entries);}let entry=entries.get(key);
 if(!entry||entry.matrix.some((v,i)=>v!==m[i])||entry.shapes.length!==shapes.length||entry.shapes.some((s,i)=>s.points.length!==shapes[i].points.length||s.points.some((v,k)=>v!==shapes[i].points[k])||s.commands.join()!==shapes[i].commands.join())){
  const shape={commands:[],points:[]};for(const s of shapes){shape.commands.push(...s.commands);for(let i=0;i<s.points.length;i+=2){const p=point(m,{x:s.points[i],y:s.points[i+1]});shape.points.push(p.x,p.y);}}entry={matrix:[...m],shapes:shapes.map(s=>({points:[...s.points],commands:[...s.commands]})),shape};entries.set(key,entry);
 }return samplePath(entry.shape,c.distance);
}
export function solvePathConstraint(project,pose,c,weight,time,authored){
 const frame=pathFrame(project,c,pose,time);if(!frame)return false;const owner=pose.get(c.node),parent=owner.joint.parent?pose.get(owner.joint.parent).world:unit,local=point(inverse(parent),{x:frame.position[0],y:frame.position[1]}),old=owner.transform;
 if(c.ownerOffset){local.x+=authored.position[0];local.y+=authored.position[1];}
 old.x+=(local.x-old.x)*weight;old.y+=(local.y-old.y)*weight;
 if(c.orient){const inv=inverse(parent),[x,y]=frame.tangent,dx=inv[0]*x+inv[2]*y,dy=inv[1]*x+inv[3]*y,angle=Math.atan2(dy,dx)*180/Math.PI-(old.scaleX<0?180:0),delta=((angle-old.rotation+180)%360+360)%360-180;old.rotation+=delta*weight;}
 pose.updateBranch(c.node);return true;
}
