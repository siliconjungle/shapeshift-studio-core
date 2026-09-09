import {imageFrame} from './frames.js';
import {random,hash,lerp,clamp,colorAt,pathAt,easing,parameter,curve} from './math.js';
const range=(r,v)=>lerp(v[0],v[1],r());
export function emitterOrigin(e,t){const path=pathAt(e.path,easing(((Math.max(0,t)/(e.pathDuration||1))%(e.pathClosed?1:Infinity)),e.pathEasing),e.pathClosed),phase=t*(e.orbitSpeed??1)*Math.PI*2;return{x:parameter(e.x,t)+path.x+Math.cos(phase)*(e.orbit??0),y:parameter(e.y,t)+path.y+Math.sin(phase)*(e.orbit??0)};}
export function births(e,time,{loopDuration=0,lookback=0}={}){
 const out=[],rate=Math.max(0,parameter(e.rate,time)),burst=Math.max(0,Math.floor(e.burst)),life=e.life[1]+lookback,start=e.delay,end=start+e.duration;
 if(e.enabled===false||time<start&&!loopDuration)return out;
 const period=e.loop&&loopDuration?loopDuration:0,minCycle=period?Math.floor((time-life-end)/period):0,maxCycle=period?Math.floor((time-start)/period):0;
 for(let cycle=minCycle;cycle<=maxCycle;cycle++){
  const offset=cycle*period;if(burst){for(let i=0;i<burst;i++){const birth=start+offset;if(time-birth>=0&&time-birth<=life)out.push({birth,index:i});}}
  else if(rate){const first=Math.max(0,Math.ceil((time-life-start-offset)*rate)),last=Math.min(Math.floor(e.duration*rate)-1,Math.floor((time-start-offset)*rate));for(let i=first;i<=last;i++)out.push({birth:start+offset+i/rate,index:i});}
  if(out.length>=6000)break;
 }
 return out.slice(0,6000);
}
function spawnPosition(e,r,birth,contour){const p=emitterOrigin(e,birth),dist=()=>{const u=r();return e.distribution==='gaussian'?(r()+r()+u)/3:e.distribution==='inverse-gaussian'?(u<.5?u*u:1-(1-u)**2):u;};let x=0,y=0;
 if(e.shape==='rectangle'){x=(dist()-.5)*e.width;y=(dist()-.5)*e.height;}
 if(e.shape==='ellipse'){const a=r()*Math.PI*2,m=Math.sqrt(dist());x=Math.cos(a)*m*e.width/2;y=Math.sin(a)*m*e.height/2;}
 if(e.shape==='diamond'){x=(dist()-.5)*e.width;y=(dist()-.5)*e.height*(1-Math.abs(x/(e.width/2||1)));}
 if(e.shape==='line')x=(dist()-.5)*e.width;
 if(e.shape==='contour'&&contour?.length){const q=contour[Math.floor(r()*contour.length)];x=(q.x-.5)*e.width;y=(q.y-.5)*e.height;}
 return{x:p.x+x,y:p.y+y};}
export function sampleParticle(e,birth,index,time,contour,originOverride=null){
 const r=random(hash(e.seed,index,e.id)),chance=r();if(chance>e.chance)return null;const life=range(r,e.life),age=time-birth;if(age<0||age>=life)return null;
 const p=originOverride??spawnPosition(e,r,birth,contour),speed=range(r,e.speed),direction=range(r,e.direction)*Math.PI/180,angle=range(r,e.angle),spin=range(r,e.spin),size=range(r,e.size),phase=r()*Math.PI*2;
 let x=p.x,y=p.y,vx=Math.cos(direction)*speed,vy=Math.sin(direction)*speed;
 const steps=Math.max(1,Math.ceil(age*30)),dt=age/steps;
 for(let i=0;i<steps;i++){const t=i*dt,d=Math.exp(-Math.max(0,e.drag)*dt),dx=(e.attractor?.x??0)-x,dy=(e.attractor?.y??0)-y,len=Math.max(10,Math.hypot(dx,dy)),force=e.attractor?.strength??0;
  vx=(vx+((e.gravityX??0)+dx/len*force+Math.sin(t*6+phase)*(e.turbulence??0))*dt)*d;vy=(vy+((e.gravityY??0)+dy/len*force+Math.cos(t*5+phase)*(e.turbulence??0))*dt)*d;const speedFactor=curve(e.overLife?.speed,t/life,1);x+=vx*dt*speedFactor;y+=vy*dt*speedFactor;
  if(e.collision?.enabled&&y>e.collision.y){y=e.collision.y-(y-e.collision.y);vy=-Math.abs(vy)*e.collision.bounce;vx*=.85;}
 }
 const u=age/life,wave=Math.sin(age*(e.wiggleSpeed??4)*Math.PI*2+phase)*(e.wiggle??0);x+=Math.cos(direction+Math.PI/2)*wave;y+=Math.sin(direction+Math.PI/2)*wave;
 const alpha=e.alpha??[0,1,0],opacity=u<.5?lerp(alpha[0],alpha[1],u*2):lerp(alpha[1],alpha[2],(u-.5)*2),radius=size*lerp(1,e.sizeEnd,u)*curve(e.overLife?.size,u,1);
 return{x,y,vx,vy,age,life,u,size:radius,rotation:(e.orientToVelocity?Math.atan2(vy,vx)*180/Math.PI:angle)+spin*age+curve(e.overLife?.rotation,u,0),opacity:clamp(opacity*curve(e.overLife?.alpha,u,1)),color:colorAt(e.colors,u),scaleX:e.scaleX,scaleY:e.scaleY,shape:e.particleShape,asset:e.asset,frameRate:e.frameRate,blend:e.blend,origin:e.pivot??[.5,.5],seed:index};
}
export function sampleEmitter(e,time,options={}){
 const particles=[];for(const {birth,index} of births(e,time,options)){const p=sampleParticle(e,birth,index,time,options.contour);if(p)particles.push(p);}
 if(e.repel>0){const grid=new Map(),cell=24;for(const p of particles){const key=Math.floor(p.x/cell)+','+Math.floor(p.y/cell);if(!grid.has(key))grid.set(key,[]);grid.get(key).push(p);}
  for(const p of particles){let ox=0,oy=0;const gx=Math.floor(p.x/cell),gy=Math.floor(p.y/cell);for(let x=gx-1;x<=gx+1;x++)for(let y=gy-1;y<=gy+1;y++)for(const q of grid.get(x+','+y)??[]){if(q===p)continue;const dx=p.x-q.x,dy=p.y-q.y,d=Math.hypot(dx,dy);if(d>0&&d<cell){const force=(1-d/cell)*Math.min(e.repel,20);ox+=dx/d*force;oy+=dy/d*force;}}p.x+=ox;p.y+=oy;}}
 return particles;
}
export function sampleParticleSystem(emitters,time,{loopDuration=0,contours=new Map()}={}){
 const result=[],map=new Map(emitters.map(e=>[e.id,e]));
 for(const e of emitters){if(e.enabled===false)continue;const own=sampleEmitter(e,time,{loopDuration,contour:contours.get(e.contour)});result.push({emitter:e,particles:own});
  for(const [kind,childId]of [['death',e.deathEmit],['step',e.stepEmit]]){const child=map.get(childId);if(!child||child.id===e.id)continue;const particles=[];
   for(const {birth,index}of births(e,time,{loopDuration,lookback:child.life[1]})){const rand=random(hash(e.seed,index,e.id));rand();const life=range(rand,e.life),events=kind==='death'?[life]:Array.from({length:Math.min(20,Math.ceil(life*8))},(_,i)=>i/8);
    for(const offset of events){const event=birth+offset;if(event>time||time-event>child.life[1])continue;const parent=sampleParticle(e,birth,index,birth+Math.min(offset,life-.00001),contours.get(e.contour));if(!parent)continue;for(let k=0;k<Math.min(child.burst||1,40);k++){const p=sampleParticle(child,event,hash(index,k,offset),time,contours.get(child.contour),parent);if(p)particles.push(p);}}
    if(particles.length>4000)break;
   }
   result.push({emitter:{...child,layer:e.layer+.01},particles:particles.slice(0,4000)});
  }
 }
 return result.sort((a,b)=>a.emitter.layer-b.emitter.layer);
}
export function particlePath(ctx,shape,size){
 ctx.beginPath();if(shape==='square')ctx.rect(-size/2,-size/2,size,size);else if(shape==='spark')ctx.ellipse(0,0,size,size*.2,0,0,Math.PI*2);else if(shape==='ring'){ctx.arc(0,0,size/2,0,Math.PI*2);ctx.arc(0,0,size*.3,0,Math.PI*2,true);}else if(shape==='cross'){const a=size/2,b=size/6;ctx.moveTo(-b,-a);for(const [x,y]of [[b,-a],[b,-b],[a,-b],[a,b],[b,b],[b,a],[-b,a],[-b,b],[-a,b],[-a,-b],[-b,-b]])ctx.lineTo(x,y);ctx.closePath();}else if(shape==='heart'){ctx.moveTo(0,size*.4);ctx.bezierCurveTo(-size,-size*.2,-size*.3,-size*.8,0,-size*.25);ctx.bezierCurveTo(size*.3,-size*.8,size,-size*.2,0,size*.4);}else if(['star','triangle','diamond'].includes(shape)){const count=shape==='star'?10:shape==='triangle'?3:4;for(let i=0;i<count;i++){const a=i/count*Math.PI*2-Math.PI/2,r=size/2*(shape==='star'&&i%2?.4:1);ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();}else ctx.arc(0,0,size/2,0,Math.PI*2);
}
export function drawParticles(ctx,particles,images){for(const p of particles){if(p.size<.01||p.opacity<=0)continue;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rotation*Math.PI/180);ctx.scale(p.scaleX,p.scaleY);ctx.globalAlpha*=p.opacity;ctx.globalCompositeOperation=p.blend;const color='rgb('+p.color.join(',')+')',image=images.get(p.asset);
 if(p.shape==='image'&&image){const frame=imageFrame(image,p.age,p.frameRate),w=p.size,h=w*(frame.height??frame.naturalHeight)/(frame.width??frame.naturalWidth);ctx.drawImage(frame,-w*p.origin[0],-h*p.origin[1],w,h);}
 else if(p.shape==='soft'){const gradient=ctx.createRadialGradient(0,0,0,0,0,p.size/2);gradient.addColorStop(0,color);gradient.addColorStop(1,'rgba('+p.color.join(',')+',0)');ctx.fillStyle=gradient;ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size);}
 else{ctx.fillStyle=color;particlePath(ctx,p.shape,p.size);ctx.fill();}ctx.restore();}}
