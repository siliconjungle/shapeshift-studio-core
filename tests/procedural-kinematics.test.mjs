import test from 'node:test';import assert from 'node:assert/strict';
import {emptyProcedural,validateProcedural} from '../src/procedural/model.js';
import {ProceduralSimulation} from '../src/procedural/simulation.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<.001,`${a} != ${b}`);
function fixture(){
 const p=emptyProcedural();p.gravity=[0,0];p.particles=[['a',0,0],['b',20,0],['goal',50,50],['hip',20,10],['knee',40,10],['foot',60,10],['footgoal',65,65]].map(([id,x,y])=>({id,position:[x,y],mass:0,radius:1}));
 p.attachments=[{id:'hip-follow',particle:'hip',sources:['b'],offset:[0,10]}];p.chains=[{id:'spine',particles:['a','b'],target:'goal',mode:'follow',lengths:[20],bendLimit:Math.PI},{id:'leg',particles:['hip','knee','foot'],target:'footgoal',mode:'reach',lengths:[30,30],bendLimit:Math.PI}];p.drivers=[{particle:'goal',type:'target',origin:[50,50],amplitude:[0,0],frequency:0}];return p;
}
test('moving spine attachments feed the limb solve in the same frame irrespective of chain list order',()=>{
 const p=fixture(),reversed=structuredClone(p);reversed.chains.reverse();validateProcedural(p,[]);validateProcedural(reversed,[]);const a=new ProceduralSimulation(p),b=new ProceduralSimulation(reversed);
 for(const goal of [[65,45],[70,50],[55,45]]){const x=a.step(1/60,{targets:{goal}}),y=b.step(1/60,{targets:{goal}});assert.deepEqual(x.points,y.points);
  close(Math.hypot(...x.points.get('hip').map((v,i)=>v-x.points.get('knee')[i])),30);close(Math.hypot(...x.points.get('knee').map((v,i)=>v-x.points.get('foot')[i])),30);close(x.points.get('hip')[0],x.points.get('b')[0]);close(x.points.get('hip')[1],x.points.get('b')[1]+10);
 }
});
test('top-down target placement samples the updated attached home and steps without terrain',()=>{
 const p=fixture();p.attachments.push({id:'home-follow',particle:'footgoal',sources:['b'],offset:[20,30]});Object.assign(p.chains[1],{mode:'step',placement:'target',stepDistance:4,stepHeight:0,stepDuration:.2,overshoot:0});validateProcedural(p,[]);const sim=new ProceduralSimulation(p),first=sim.frame(),initial=first.points.get('foot').slice();
 const next=sim.step(1/60,{targets:{goal:[65,45]}});assert.equal(next.contacts[0].moving,true);next.points.get('foot').forEach((v,i)=>close(v,initial[i]));close(sim.steps.get(1).to[0],next.points.get('footgoal')[0]);close(sim.steps.get(1).to[1],next.points.get('footgoal')[1]);
 for(let i=0;i<30;i++)sim.step(1/60,{targets:{goal:[65,45]}});const landed=sim.frame();assert.equal(landed.contacts[0].grounded,true);close(landed.contacts[0].error,0);assert.deepEqual(p.colliders,[]);
});
test('feedback through attached roots, duplicate outputs and unknown placement modes are rejected',()=>{
 const p=fixture();p.attachments[0].sources=['foot'];assert.throws(()=>validateProcedural(p,[]),/chain dependency cycle/);
 const q=fixture();q.chains.push({...q.chains[1],id:'duplicate'});assert.throws(()=>validateProcedural(q,[]),/multiple chain outputs/);
 const r=fixture();r.chains[1].placement='guess';assert.throws(()=>validateProcedural(r,[]),/unknown step placement/);
});

test('two-link limbs handle near-extension, folded targets and unequal inner reach',async()=>{
 const {solveChain}=await import('../src/procedural/constraints.js');
 for(const [lengths,target]of [[[30,30],[59.999,0]],[[30,30],[0,0]],[[30,20],[1,0]],[[30,20],[20,20]]])for(const side of [-1,1]){
  const points=[[0,0],[20,side*20],[40,0]].map(p=>({p}));solveChain(points,lengths,target);
  for(let i=1;i<3;i++)close(Math.hypot(...points[i].p.map((v,k)=>v-points[i-1].p[k])),lengths[i-1]);
  const expected=Math.max(0,Math.abs(lengths[0]-lengths[1])-Math.hypot(...target));close(Math.hypot(...points[2].p.map((v,k)=>v-target[k])),expected);assert.ok(points.flatMap(p=>p.p).every(Number.isFinite));
 }
});

test('kinematic outputs ignore free-body inertia while an attached soft point retains physics',()=>{
 const p=fixture();p.gravity=[0,300];for(const point of p.particles)if(['a','b','knee','foot'].includes(point.id))point.mass=1;
 p.particles.push({id:'soft',position:[0,0],mass:1,radius:1});
 p.distances.push({a:'b',b:'soft',length:15,stiffness:.5});
 const authored=JSON.stringify(p),sim=new ProceduralSimulation(p),reference=structuredClone(p);
 reference.gravity=[0,0];reference.distances=[];const kinematic=new ProceduralSimulation(reference);
 for(let i=0;i<60;i++){
  const targets={goal:[50+i/5,50]},frame=sim.step(1/60,{targets}),expected=kinematic.step(1/60,{targets});
  for(const id of ['a','b','hip','knee','foot'])assert.deepEqual(frame.points.get(id),expected.points.get(id));
 }
 assert.ok(sim.points.get('soft').w>0);assert.ok(sim.points.get('soft').p[1]>0);
 assert.equal(JSON.stringify(p),authored);
 const released=structuredClone(p);released.chains=[];released.attachments=[];released.distances=[];
 const free=new ProceduralSimulation(released),before=free.frame().points.get('b')[1];
 assert.ok(free.step().points.get('b')[1]>before);
});

test('a bend-limited long chain escapes a tight fold while following live targets',async()=>{
 const {solveChain}=await import('../src/procedural/constraints.js'),lengths=Array(9).fill(20);
 for(const offset of [[0,0],[1000,-400]]){
  const root=[-130+offset[0],-80+offset[1]],points=Array.from({length:10},(_,i)=>({p:[root[0]+i*20,root[1]]}));
  solveChain(points,lengths,[60+offset[0],-40+offset[1]],{bendLimit:2});
  for(let i=0;i<30;i++){
   const target=[-25+i+offset[0],-65+Math.sin(i/5)*25+offset[1]];solveChain(points,lengths,target,{bendLimit:2});
   close(Math.hypot(...points.at(-1).p.map((v,k)=>v-target[k])),0);assert.deepEqual(points[0].p,root);
   let previous;for(let j=1;j<points.length;j++){
    const delta=points[j].p.map((v,k)=>v-points[j-1].p[k]),angle=Math.atan2(delta[1],delta[0]);close(Math.hypot(...delta),20);
    if(previous!==undefined)assert.ok(Math.abs(Math.atan2(Math.sin(angle-previous),Math.cos(angle-previous)))<=2+1e-8);previous=angle;
   }
  }
 }
 const one=[{p:[0,0]},{p:[10,0]}];solveChain(one,[10],[2,1],{bendLimit:0});close(Math.hypot(...one[1].p),10);
});

test('a touching live tentacle fold produces a closed finite fill and ink',async()=>{
 const {addProceduralPrimitive}=await import('../src/procedural/builders.js'),{proceduralSurfaces}=await import('../src/procedural/surfaces.js');
 const project={joints:[],procedural:emptyProcedural()};addProceduralPrimitive(project,{id:'reach',kind:'tentacle',count:10,spacing:20,position:[-130,-80],layer:0});
 Object.assign(project.procedural.drivers[0],{origin:[20,-40],frequency:.15,phase:0});const sim=new ProceduralSimulation(project.procedural);
 for(let i=0;i<30;i++){
  const frame=sim.step(1/60,{targets:{'reach-target':[-25+i,-65+Math.sin(i/5)*25]}}),[surface]=proceduralSurfaces(project.procedural,frame);
  assert.ok(surface.polygons.length);assert.ok(surface.inkPath.length);assert.ok(surface.polygons.flat(3).every(Number.isFinite));
  for(const poly of surface.polygons)for(const ring of poly)assert.deepEqual(ring[0],ring.at(-1));
 }
});
