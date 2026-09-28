import {orderChains} from './kinematics.js';
import {attachmentInputs,orderAttachments,applyAttachments} from './attachments.js';
import {constrainDistance,constrainBend,constrainArea,shapeMatch,solveChain,distance} from './constraints.js';
import {collide} from './collision.js';
import {FootPlanner,supportBodies,chainKey} from './locomotion.js';
export const STEP=1/60;
/** Stateful runtime for games and interactive previews; authoring data is never mutated. */
export class ProceduralSimulation {
 constructor(definition,{anchorAt=()=>null}={}){this.definition=definition;this.anchorAt=anchorAt;this.reset();}
 reset(){this.time=0;this.impulsesApplied=new Set();this.chainOrder=orderChains(this.definition);this.attachments=orderAttachments(this.definition.attachments);this.points=new Map(this.definition.particles.map(p=>[p.id,{id:p.id,p:[...p.position],old:[...p.position],w:p.mass===0?0:1/p.mass,radius:p.radius,gravity:p.gravity??this.definition.gravity,damping:p.damping??this.definition.damping,contacts:[]}]));for(const c of this.definition.chains)for(const id of c.particles.slice(c.mode==='follow'?0:1))this.points.get(id).w=0;this.planner=new FootPlanner();this.steps=this.planner.states;this.supportStates=new Map();this.supports=[];this.chainLengths=this.definition.chains.map(c=>c.lengths??c.particles.slice(1).map((id,i)=>distance(this.points.get(c.particles[i]).p,this.points.get(id).p)));this.applyPins(0);applyAttachments(this.attachments,this.points);this.solveKinematics(0,STEP);}
 applyPins(time,targets={}){
  for(const support of this.definition.supports??[])for(const id of support.particles){const p=this.definition.particles.find(p=>p.id===id);if(p.mass===0&&!p.joint)this.points.get(id).p=[...p.position];}
  for(const p of this.definition.particles){const at=p.joint?this.anchorAt(p,time):null;if(at){const point=this.points.get(p.id);point.p=[...at];point.w=0;}}
  for(const d of this.definition.drivers){const phase=time*d.frequency*Math.PI*2+(d.phase??0),at=targets[d.particle]??(d.type==='target'?d.origin:[d.origin[0]+Math.cos(phase)*d.amplitude[0],d.origin[1]+(d.type==='wave'?Math.sin(phase*2):Math.sin(phase))*d.amplitude[1]]),point=this.points.get(d.particle);point.p=[...at];point.w=0;}
 }
 // Velocity change in world pixels/second. Existing pins and constraints keep ownership.
 impulse(ids,velocity,dt=STEP){if(!Array.isArray(velocity)||velocity.length!==2||!velocity.every(Number.isFinite)||!Number.isFinite(dt)||dt<=0)throw Error('Invalid impulse');for(const id of ids){const p=this.points.get(id);if(!p)throw Error('Missing impulse point');if(p.w)for(let k=0;k<2;k++)p.old[k]-=velocity[k]*dt;}return this;}
 step(dt=STEP,{targets={}}={}){
  if(!Number.isFinite(dt)||dt<=0||dt>1/30)throw Error('Procedural step must be between 0 and 1/30 seconds');
  const config=this.definition,nextTime=this.time+dt;
  for(const e of config.impulses??[])if(!this.impulsesApplied.has(e.id)&&e.time<nextTime-1e-10){this.impulse(e.particles,e.velocity,dt);this.impulsesApplied.add(e.id);}
  for(const point of this.points.values()){point.contacts=[];const current=[...point.p],decay=Math.exp(-point.damping*dt);if(point.w)for(let k=0;k<2;k++)point.p[k]+=(point.p[k]-point.old[k])*decay+point.gravity[k]*dt*dt;point.old=current;}
  this.applyPins(nextTime,targets);
  const get=id=>this.points.get(id),strength=c=>1-Math.pow(1-(c.stiffness??1),1/config.iterations);
  for(let i=0;i<config.iterations;i++){
   applyAttachments(this.attachments,this.points);
   for(const c of config.distances)constrainDistance(get(c.a),get(c.b),c.length,strength(c));
   for(const c of config.bends)constrainBend(get(c.a),get(c.b),get(c.c),c.angle,c.limit,strength(c));
   for(const c of config.areas)constrainArea(c.particles.map(get),c.area,strength(c));
   for(const c of config.rigid)shapeMatch(c.particles.map(get),c.particles.map(id=>config.particles.find(p=>p.id===id).position),strength(c));
   for(const point of this.points.values())for(const collider of config.colliders)collide(point,collider);
  }
  this.solveKinematics(nextTime,dt);applyAttachments(this.attachments,this.points);
  for(const point of this.points.values())for(const {normal,friction,bounce,incoming} of point.contacts){
   let velocity=[point.p[0]-point.old[0],point.p[1]-point.old[1]],vn=velocity[0]*normal[0]+velocity[1]*normal[1];
   velocity=velocity.map((v,k)=>(v-vn*normal[k])*(1-friction)+Math.max(0,vn,-(incoming??vn)*bounce)*normal[k]);point.old=point.p.map((v,k)=>v-velocity[k]);
  }
  this.time=nextTime;return this.frame();
 }
 solveKinematics(time,dt){
  const config=this.definition,get=id=>this.points.get(id),solve=index=>{const chain=config.chains[index],target=chain.mode==='step'?this.steps.get(index).foot:typeof chain.target==='string'?get(chain.target).p:chain.target;solveChain(chain.particles.map(get),this.chainLengths[index],target,{mode:chain.mode,bendLimit:chain.bendLimit??Math.PI});applyAttachments(this.attachments,this.points);};
  // Resolve upstream spines/arms before sampling the homes of their stepping limbs.
  // Chains that depend on a stepping output wait for the final ordered pass.
  const stepOutputs=new Set(config.chains.filter(c=>c.mode==='step').flatMap(c=>c.particles.slice(1))),blocked=new Set(stepOutputs);
  for(const a of this.attachments)if(attachmentInputs(a).some(id=>blocked.has(id)))blocked.add(a.particle);
  for(const index of this.chainOrder){const c=config.chains[index];if(c.mode==='step'||blocked.has(c.particles[0])||blocked.has(c.target)){c.particles.slice(c.mode==='follow'?0:1).forEach(id=>blocked.add(id));for(const a of this.attachments)if(attachmentInputs(a).some(id=>blocked.has(id)))blocked.add(a.particle);}else solve(index);}
  this.planner.update(config,this.points,time);
  this.supports=supportBodies(config,this.points,this.steps,this.supportStates,dt);applyAttachments(this.attachments,this.points);
  for(const index of this.chainOrder)solve(index);
 }

 frame(){return {time:this.time,collisions:[...this.points.values()].flatMap(p=>p.contacts.map(c=>({particle:p.id,position:[...p.p],normal:[...c.normal],collider:c.collider.id??this.definition.colliders.indexOf(c.collider)}))),points:new Map([...this.points].map(([id,p])=>[id,[...p.p]])),supports:this.supports.map(s=>({...s})),contacts:[...this.steps].map(([index,s])=>{const chain=this.definition.chains[index],position=this.points.get(chain.particles.at(-1)).p,error=distance(position,s.foot);return {chain:index,id:chainKey(chain),position:[...position],target:[...s.foot],normal:[...s.normal],moving:s.moving,grounded:s.hasGround&&!s.moving&&error<.5,error};})};}
}
/** Deterministic timeline sampler. Rewinds restart; repeated samples do no work. */
export class ProceduralTimeline {
 constructor(definition,options){this.simulation=new ProceduralSimulation(definition,options);this.tick=0;}
 sample(time){if(!Number.isFinite(time)||time<0||time>120)throw Error('Procedural time must be 0–120 seconds');const target=Math.floor(time/STEP+1e-7);if(target<this.tick){this.simulation.reset();this.tick=0;}while(this.tick<target){this.simulation.step();this.tick++;}return this.simulation.frame();}
}
