import test from 'node:test';import assert from 'node:assert/strict';
import {emptyProcedural,validateProcedural} from '../src/procedural/model.js';
import {applyProceduralCommand} from '../src/procedural/commands.js';
import {applyAttachments,orderAttachments} from '../src/procedural/attachments.js';
import {ProceduralSimulation,ProceduralTimeline} from '../src/procedural/simulation.js';
import {collide,sweepContact} from '../src/procedural/collision.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const particle=(id,position,mass=1)=>({id,position,mass,radius:2});
function fixture(){const p=emptyProcedural();p.gravity=[0,0];p.particles=[particle('a',[0,0],0),particle('b',[10,0],0),particle('c',[0,0]),particle('d',[0,0])];p.attachments=[{id:'one',particle:'c',sources:['a','b'],weights:[3,1],offset:[2,4],orient:['a','b']},{id:'two',particle:'d',sources:['c'],offset:[1,0]}];return p;}

test('weighted points use a rotating local offset and resolve nested dependencies',()=>{
 const p=fixture(),points=new Map(p.particles.map(p=>[p.id,{p:p.position,w:1}]));points.get('b').p=[0,20];applyAttachments(orderAttachments([...p.attachments].reverse()),points);
 assert.deepEqual(points.get('c').p,[-4,7]);assert.deepEqual(points.get('d').p,[-3,7]);assert.equal(points.get('c').w,0);
});
test('attachments follow sampled driver motion and rewind exactly',()=>{
 const p=fixture();p.drivers=[{particle:'b',type:'orbit',origin:[10,0],amplitude:[10,10],frequency:.5}];validateProcedural(p);const timeline=new ProceduralTimeline(p),frame=timeline.sample(1);timeline.sample(.1);assert.deepEqual(timeline.sample(1),frame);const sim=new ProceduralSimulation(p);sim.step(1/60,{targets:{b:[0,20]}});assert.deepEqual(sim.points.get('c').p,[-4,7]);
});
test('attachment cycles, multiple writers, zero weights and invalid outputs are rejected atomically',()=>{
 for(const alter of [p=>{p.attachments[0].sources=['d'];p.attachments[0].weights=[1];},p=>p.attachments[0].weights=[0,0],p=>p.drivers.push({particle:'c',type:'target',origin:[0,0],amplitude:[0,0],frequency:0}),p=>p.chains.push({mode:'follow',particles:['c','a'],target:'b'})]){const project={joints:[],procedural:fixture()},before=JSON.stringify(project),value=structuredClone(project.procedural);alter(value);assert.throws(()=>applyProceduralCommand(project,{op:'procedural.replace',value}));assert.equal(JSON.stringify(project),before);}
});
test('removing an attachment source removes downstream derived points and their bindings',()=>{
 const project={joints:[],procedural:fixture()};applyProceduralCommand(project,{op:'procedural.remove',particles:['a']});assert.deepEqual(project.procedural.particles.map(p=>p.id),['b']);assert.equal(project.procedural.attachments.length,0);validateProcedural(project.procedural);
});

test('fast particles cannot tunnel through finite terrain segments from either side',()=>{
 const wall={type:'segment',a:[-20,0],b:[20,0]};for(const sign of [-1,1]){const p={p:[5,sign*100],old:[0,-sign*100],radius:3,w:1,contacts:[]};collide(p,wall);close(p.p[0],5);close(p.p[1],-sign*3);assert.equal(p.contacts.length,1);}
 assert.equal(sweepContact([30,-100],[30,100],3,wall),null);
});
test('sweeps cover circle obstacles and round segment end caps',()=>{
 const circle={type:'circle',center:[0,0],radius:10},point={p:[100,0],old:[-100,0],radius:2,w:1,contacts:[]};collide(point,circle);close(point.p[0],-12);
 const wall={type:'segment',a:[0,0],b:[10,0]},hit=sweepContact([12,-20],[12,20],3,wall);assert.ok(hit);close(hit.at[1],-Math.sqrt(5));assert.ok(hit.normal[0]>0&&hit.normal[1]<0);
});
test('bounce uses the incoming speed and simultaneous corner contacts remain bounded',()=>{
 const p=emptyProcedural();p.gravity=[0,0];p.damping=0;p.particles=[particle('ball',[-20,-20])];p.colliders=[{type:'segment',a:[-100,0],b:[100,0],friction:0,bounce:.5},{type:'segment',a:[0,-100],b:[0,100],friction:0,bounce:.5}];
 const sim=new ProceduralSimulation(p),ball=sim.points.get('ball');ball.old=[-120,-120];sim.step();close(ball.p[0],-2);close(ball.p[1],-2);close(ball.p[0]-ball.old[0],-50);close(ball.p[1]-ball.old[1],-50);sim.step();close(ball.p[0],-52);close(ball.p[1],-52);
});
