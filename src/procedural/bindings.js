import {joinedArtwork} from '../puppet-studio/body-join-render.js';
import {multiply,inverse,point} from '../puppet-studio/joint-transforms.js';
// Interpolate orientation separately: averaging opposite matrices collapses art.
function components(m){const sx=Math.hypot(m[0],m[1]);return {angle:Math.atan2(m[1],m[0]),sx,sy:(m[0]*m[3]-m[1]*m[2])/sx,shear:(m[0]*m[2]+m[1]*m[3])/sx};}
function blendMatrix(a,b,w){
 if(w===0)return [...a];if(w===1)return [...b];
 const x=components(a),y=components(b),delta=Math.atan2(Math.sin(y.angle-x.angle),Math.cos(y.angle-x.angle)),angle=x.angle+delta*w,c=Math.cos(angle),s=Math.sin(angle),sx=x.sx+(y.sx-x.sx)*w,sy=x.sy+(y.sy-x.sy)*w,h=x.shear+(y.shear-x.shear)*w;
 return [c*sx,s*sx,c*h-s*sy,s*h+c*sy,a[4]+(b[4]-a[4])*w,a[5]+(b[5]-a[5])*w];
}
/** A binding preserves the sprite and draw layer; it only changes its pose or skin. */
export function makeSpriteBinding(definition,joint,particles,world,{mode='rigid',strength=1,stretch=false}={}){
 if(!particles.length)throw Error('Select at least one procedural point');
 return {joint,particles:[...particles],mode,strength,stretch,bindMatrix:[...world],rest:particles.map(id=>[...definition.particles.find(p=>p.id===id).position])};
}
export function bindingMatrix(binding,frame){
 const a=binding.rest[0],p=frame.points.get(binding.particles[0]);let angle=0,scale=1;
 if(binding.particles.length>1){const b=binding.rest[1],q=frame.points.get(binding.particles[1]);angle=Math.atan2(q[1]-p[1],q[0]-p[0])-Math.atan2(b[1]-a[1],b[0]-a[0]);if(binding.stretch)scale=Math.hypot(q[0]-p[0],q[1]-p[1])/Math.max(.001,Math.hypot(b[0]-a[0],b[1]-a[1]));}
 const c=Math.cos(angle)*scale,s=Math.sin(angle)*scale,delta=[c,s,-s,c,p[0]-c*a[0]+s*a[1],p[1]-s*a[0]-c*a[1]];
 return multiply(delta,binding.bindMatrix);
}
export function applySpriteBindings(definition,frame,pose){
 const bindings=new Map((definition.bindings??[]).filter(b=>b.mode==='rigid'&&b.enabled!==false).map(b=>[b.joint,b]));
 // Pose iteration is parent-first. A bound ancestor carries unbound descendants.
 const original=new Map([...pose].map(([id,p])=>[id,[...p.world]]));
 for(const [id,p]of pose){const binding=bindings.get(id);let world=p.world;
  if(p.joint.parent)world=multiply(pose.get(p.joint.parent).world,multiply(inverse(original.get(p.joint.parent)),original.get(id)));
  if(binding){const goal=bindingMatrix(binding,frame),w=binding.strength??1;world=blendMatrix(world,goal,w);}
  p.world=world;p.local=p.joint.parent?multiply(inverse(pose.get(p.joint.parent).world),world):[...world];
  if(binding){const t=components(p.local);p.transform={...p.transform,x:p.local[4],y:p.local[5],rotation:t.angle*180/Math.PI,scaleX:t.sx,scaleY:t.sy};}
 }
}
/** Inverse-distance skinning. Exact control-point hits follow their point exactly. */
export function deformSpritePoint(local,binding,frame,world){
 const restPoint=point(binding.bindMatrix,local),current=point(world,local);let sum=0,dx=0,dy=0;
 for(let i=0;i<binding.particles.length;i++){const rest=binding.rest[i],now=frame.points.get(binding.particles[i]),d2=(restPoint.x-rest[0])**2+(restPoint.y-rest[1])**2;
  if(d2<1e-10){sum=1;dx=now[0]-rest[0];dy=now[1]-rest[1];break;}
  const w=1/d2;sum+=w;dx+=(now[0]-rest[0])*w;dy+=(now[1]-rest[1])*w;
 }
 const weight=binding.strength??1,target={x:current.x+(restPoint.x+dx/sum-current.x)*weight,y:current.y+(restPoint.y+dy/sum-current.y)*weight};
 return point(inverse(world),target);
}
/** Shared textured mesh avoids antialias cracks between Canvas clip triangles. */
export function drawSoftSprite(ctx,image,sprite,binding,frame,world){
 const m=ctx.getTransform(),scale=Math.max(.5,Math.min(4,Math.max(Math.hypot(m.a,m.b),Math.hypot(m.c,m.d)))),warped=joinedArtwork(image,sprite,[],scale,{crop:sprite.crop??[0,0,1,1],deform:(x,y)=>deformSpritePoint({x,y},binding,frame,world)}),s=warped.sprite;
 ctx.drawImage(warped.canvas,-s.pivotX*s.width,-s.pivotY*s.height,s.width,s.height);
}
