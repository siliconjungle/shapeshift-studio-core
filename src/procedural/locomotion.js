import {contactAt} from './collision.js';
import {distance} from './constraints.js';
export const chainKey = chain => chain.id ?? chain.particles[0];
const unit = v => {const n=Math.hypot(...v);return n>1e-9?v.map(x=>x/n):[0,1];};
const dot = (a,b) => a[0]*b[0]+a[1]*b[1];
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));

/** Plans contacts before solving any limb, so scheduling cannot depend on draw order. */
export class FootPlanner {
 constructor(){this.states=new Map();this.gaits=new Map();}
 update(definition,points,time){
  const candidates=new Map();
  definition.chains.forEach((chain,index)=>{
   if(chain.mode!=='step')return;
   const direction=unit(chain.direction??[0,1]),reach=chain.reach??200,target=typeof chain.target==='string'?points.get(chain.target).p:chain.target;
   const ray=at=>chain.placement==='target'?{point:[...at],normal:direction.map(v=>-v)}:contactAt(at.map((v,k)=>v-direction[k]*reach/2),direction,reach,definition.colliders);
   let hit=ray(target),state=this.states.get(index);
   if(!state){state={foot:[...(hit?.point??points.get(chain.particles.at(-1)).p)],moving:false,normal:hit?.normal??direction.map(x=>-x),hasGround:!!hit};this.states.set(index,state);}
   state.hasGround=!!hit;
   if(state.moving){
    const u=clamp((time-state.start)/(chain.stepDuration??.2),0,1),s=u*u*(3-2*u),arc=Math.sin(u*Math.PI)*(chain.stepHeight??20);
    state.foot=state.from.map((v,k)=>v+(state.to[k]-v)*s-state.direction[k]*arc);
    if(u>=1){state.moving=false;state.normal=[...state.landingNormal];}
   }
   const homeDistance=hit?distance(state.foot,hit.point):0;
   if(hit&&!state.moving){
    const delta=hit.point.map((v,k)=>v-state.foot[k]),along=delta.map((v,k)=>v-direction[k]*dot(delta,direction)),len=Math.hypot(...along);
    if(len>1e-6&&(chain.overshoot??0)>0){const ahead=hit.point.map((v,k)=>v+along[k]/len*(chain.stepDistance??25)*chain.overshoot);hit=ray(ahead)??hit;}
   }
   candidates.set(index,{chain,state,hit,direction,wants:!!hit&&!state.moving&&homeDistance>(chain.stepDistance??25)});
  });
  const start=c=>{c.state.from=[...c.state.foot];c.state.to=[...c.hit.point];c.state.landingNormal=[...c.hit.normal];c.state.direction=[...c.direction];c.state.start=time;c.state.moving=true;};
  const managed=new Set();
  for(const gait of definition.gaits??[]){if(gait.enabled===false)continue;
   const groups=gait.groups.map(group=>[...candidates].filter(([,c])=>group.includes(chainKey(c.chain))).map(([i])=>i));groups.flat().forEach(i=>managed.add(i));
   const state=this.gaits.get(gait.id)??{next:0,active:null};this.gaits.set(gait.id,state);
   if(state.active!==null){if(groups[state.active].some(i=>candidates.get(i).state.moving))continue;state.next=(state.active+1)%groups.length;state.active=null;}
   for(let n=0;n<groups.length;n++){const g=(state.next+n)%groups.length,wanted=groups[g].map(i=>candidates.get(i)).filter(c=>c.wants);if(!wanted.length)continue;wanted.forEach(start);state.active=g;break;}
  }
  // Legacy groups remain available for one-at-a-time stepping.
  for(const [index,c]of candidates){if(managed.has(index)||!c.wants)continue;
   const busy=[...candidates].some(([i,other])=>i!==index&&(other.chain.group??'default')===(c.chain.group??'default')&&other.state.moving);
   if(!busy)start(c);
  }
  return this.states;
 }
}

/** Kinematic body correction above contact feet. No force or creature topology is assumed. */
export function supportBodies(definition,points,feet,states,dt){
 const corrections=[];
 for(const support of definition.supports??[]){if(support.enabled===false)continue;
  const contacts=definition.chains.flatMap((chain,i)=>{const foot=feet.get(i);return support.feet.includes(chainKey(chain))&&foot?.hasGround?[foot.moving?foot.from:foot.foot]:[];});
  if(!contacts.length)continue;
  const down=unit(support.direction??[0,1]),tangent=[down[1],-down[0]],body=support.particles.map(id=>points.get(id)),center=[0,1].map(k=>body.reduce((sum,p)=>sum+p.p[k],0)/body.length),mean=[0,1].map(k=>contacts.reduce((sum,p)=>sum+p[k],0)/contacts.length);
  let variance=0,covariance=0;for(const p of contacts){const delta=p.map((v,k)=>v-mean[k]),x=dot(delta,tangent);variance+=x*x;covariance+=x*dot(delta,down);}
  const slope=variance>1e-6?covariance/variance:0,ground=dot(mean,down)+slope*(dot(center,tangent)-dot(mean,tangent)),height=support.height,offset=clamp(ground-height-dot(center,down),-(support.maxOffset??100),support.maxOffset??100),angle=clamp(Math.atan(slope),-(support.maxTilt??.6),support.maxTilt??.6)*(support.tilt??1),blend=1-Math.exp(-(support.response??10)*dt);
  let state=states.get(support.id);if(!state){state={offset,angle};states.set(support.id,state);}else{state.offset+=(offset-state.offset)*blend;state.angle+=(angle-state.angle)*blend;}
  const c=Math.cos(state.angle),s=Math.sin(state.angle);
  for(const p of body){const x=p.p[0]-center[0],y=p.p[1]-center[1];p.p=[center[0]+c*x-s*y+down[0]*state.offset,center[1]+s*x+c*y+down[1]*state.offset];}
  corrections.push({id:support.id,offset:state.offset,angle:state.angle,contacts:contacts.length});
 }
 return corrections;
}
