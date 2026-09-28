import {inverse,point} from '../joint-transforms.js';
import {constraintChain} from './model.js';

const unit=[1,0,0,1,0,0],rad=Math.PI/180;
const angleDelta=(a,b)=>((b-a+540)%360+360)%360-180;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const along=(a,b,length)=>{const d=distance(a,b);return d>1e-12?{x:a.x+(b.x-a.x)*length/d,y:a.y+(b.y-a.y)*length/d}:{x:a.x+length,y:a.y};};

// Rebuild a deterministic solution from the sampled FK pose on every call.
// FABRIK supplies a bend-controlled seed; rotation-only refinement handles
// scaled ancestors without changing any segment's authored translation/scale.
export function solveIKConstraint(nodes,pose,c,weight){
 const chain=constraintChain(nodes,c),bones=chain.slice(0,-1),tip=chain.at(-1);
 const parentWorld=id=>{const parent=pose.get(id).joint.parent;return parent?pose.get(parent).world:unit;};
 const position=id=>({x:pose.get(id).world[4],y:pose.get(id).world[5]});
 const frame=parentWorld(chain[0]),toFrame=inverse(frame),targetWorld=position(c.target),target=point(toFrame,targetWorld);
 const points=chain.map(id=>point(toFrame,position(id))),root={...points[0]},lengths=bones.map((_,i)=>distance(points[i],points[i+1])),total=lengths.reduce((a,b)=>a+b,0);
 if(total<1e-9)return [];
 const old=bones.map(id=>pose.get(id).transform.rotation),d=distance(root,target),direction=d>1e-12?{x:(target.x-root.x)/d,y:(target.y-root.y)/d}:{x:1,y:0},sign=c.invertDirection?-1:1;
 if(d>=total-1e-8){for(let i=1;i<points.length;i++)points[i]=along(points[i-1],{x:points[i-1].x+direction.x,y:points[i-1].y+direction.y},lengths[i-1]);}
 else if(bones.length===2&&lengths.every(v=>v>1e-9)){
  const [a,b]=lengths,r=Math.max(1e-9,d),cos=Math.max(-1,Math.min(1,(a*a+r*r-b*b)/(2*a*r))),sin=Math.sqrt(1-cos*cos)*sign;
  points[1]={x:root.x+a*(direction.x*cos-direction.y*sin),y:root.y+a*(direction.y*cos+direction.x*sin)};points[2]=along(points[1],target,b);
 }else{
  // Starting from a slight arch also escapes a perfectly straight FK chain.
  let sum=0;for(let i=1;i<points.length;i++){sum+=lengths[i-1];const t=sum/total,bend=Math.sin(Math.PI*t)*total*.35*sign;points[i]={x:root.x+direction.x*d*t-direction.y*bend,y:root.y+direction.y*d*t+direction.x*bend};}
  for(let pass=0;pass<96;pass++){
   points[points.length-1]={...target};for(let i=points.length-2;i>=0;i--)points[i]=along(points[i+1],points[i],lengths[i]);points[0]={...root};for(let i=1;i<points.length;i++)points[i]=along(points[i-1],points[i],lengths[i-1]);if(distance(points.at(-1),target)<1e-7)break;
  }
 }
 // Rotate each joint to place its next segment on the seeded direction.
 function aim(id,currentWorld,desiredWorld){const local=inverse(parentWorld(id)),origin=pose.get(id).transform,a=point(local,currentWorld),b=point(local,desiredWorld),ax=a.x-origin.x,ay=a.y-origin.y,bx=b.x-origin.x,by=b.y-origin.y;if(Math.hypot(ax,ay)<1e-10||Math.hypot(bx,by)<1e-10)return;origin.rotation+=angleDelta(Math.atan2(ay,ax)/rad,Math.atan2(by,bx)/rad);pose.updateBranch(id);}
 for(let i=0;i<bones.length;i++)aim(bones[i],position(chain[i+1]),point(frame,points[i+1]));
 // CCD only adjusts angles, preserving all authored bone lengths and scales.
 for(let pass=0;pass<96&&distance(position(tip),targetWorld)>1e-5;pass++)for(let i=bones.length-1;i>=0;i--)aim(bones[i],position(tip),targetWorld);
 const solved=bones.map(id=>pose.get(id).transform.rotation);
 for(let i=0;i<bones.length;i++){pose.get(bones[i]).transform.rotation=old[i]+angleDelta(old[i],solved[i])*weight;pose.updateBranch(bones[i]);}
 return bones;
}
