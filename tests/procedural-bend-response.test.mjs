import test from 'node:test';import assert from 'node:assert/strict';
import {emptyProcedural,validateProcedural} from '../src/procedural/model.js';
import {applyAttachments,orderAttachments,pathBend} from '../src/procedural/attachments.js';
import {ProceduralSimulation,ProceduralTimeline} from '../src/procedural/simulation.js';
import {applyProceduralCommand} from '../src/procedural/commands.js';
import {captureProcedural,proceduralBindings,remapProcedural} from '../src/procedural/transfer.js';
import {proceduralForJoints} from '../src/procedural/sources.js';
import {makeSpriteBinding,bindingMatrix} from '../src/procedural/bindings.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function fixture(){
 const p=emptyProcedural();p.gravity=[0,0];p.particles=[['a',0,0],['b',10,0],['c',10,10],['out',0,0]].map(([id,x,y])=>({id,position:[x,y],mass:0,radius:2}));
 p.attachments=[{id:'response',particle:'out',sources:['a'],orient:['a','b'],offset:[1,2],bend:{particles:['a','b','c'],scale:[2,4],limit:Math.PI*2}}];return p;
}
test('measured bends drive local offsets, signed or absolute, with a clamp and no mutation',()=>{
 const p=fixture(),before=JSON.stringify(p),sim=new ProceduralSimulation(p);close(sim.frame().points.get('out')[0],1+Math.PI);close(sim.frame().points.get('out')[1],2+Math.PI*2);assert.equal(JSON.stringify(p),before);
 const q=fixture();q.particles[2].position=[10,-10];q.attachments[0].bend.limit=.5;let frame=new ProceduralSimulation(q).frame();close(frame.points.get('out')[0],0);close(frame.points.get('out')[1],0);
 q.attachments[0].bend.absolute=true;frame=new ProceduralSimulation(q).frame();close(frame.points.get('out')[0],2);close(frame.points.get('out')[1],4);
 q.particles.forEach(p=>p.position=[-p.position[1]+200,p.position[0]-50]);frame=new ProceduralSimulation(q).frame();close(frame.points.get('out')[0],196);close(frame.points.get('out')[1],-48);
});
test('accumulated turns cross 180 degrees continuously and coincident edges stay finite',()=>{
 for(const turn of [3.1,3.2,-3.1,-3.2]){
  const points=new Map([['0',{p:[0,0]}]]);for(let i=0;i<5;i++){const a=points.get(String(i)).p,angle=turn*i/4;points.set(String(i+1),{p:[a[0]+Math.cos(angle)*10,a[1]+Math.sin(angle)*10]});}
  close(pathBend([...points.keys()],points),turn);points.set('duplicate',{p:[...points.get('2').p]});close(pathBend(['0','1','2','duplicate','3','4','5'],points),turn);
 }
 close(pathBend(['a','b','c'],new Map(['a','b','c'].map(id=>[id,{p:[0,0]}]))),0);
});
test('measurement dependencies order attachments and chains and reject feedback atomically',()=>{
 const p=fixture();p.particles.push({id:'end',position:[20,20],mass:0,radius:1});p.chains=[{mode:'reach',particles:['out','end'],target:[30,30],lengths:[10]}];p.attachments.push({id:'derived-c',particle:'c',sources:['b'],offset:[0,10]});p.attachments.reverse();validateProcedural(p);
 const sim=new ProceduralSimulation(p);close(Math.hypot(...sim.frame().points.get('end').map((v,k)=>v-sim.frame().points.get('out')[k])),10);assert.equal(orderAttachments(p.attachments)[0].id,'derived-c');
 for(const alter of [p=>p.attachments[0].sources=['out'],p=>p.attachments[1].bend.particles=['a','b','end'],p=>p.attachments[1].bend.particles=['a','out','c'],p=>p.attachments[1].bend.limit=-1,p=>p.attachments[1].bend.scale=[NaN,0]]){
  const project={joints:[],procedural:structuredClone(p)},before=JSON.stringify(project),value=structuredClone(p);alter(value);assert.throws(()=>applyProceduralCommand(project,{op:'procedural.replace',value}));assert.equal(JSON.stringify(project),before);
 }
});
test('bend inputs survive library remapping, source extraction, replay and deletion',()=>{
 const p=fixture();p.particles[0].owner='root';p.drivers=[{particle:'c',type:'orbit',origin:[10,0],amplitude:[0,10],frequency:.2}];
 const packet=captureProcedural(p,2,new Set(['root'])),maps=proceduralBindings(packet,2,undefined,'copy'),placed=remapProcedural(packet,2,{root:'copy-root'},maps,[200,40]);validateProcedural(placed,[{id:'copy-root'}]);
 assert.deepEqual(placed.attachments[0].bend.particles,['a','b','c'].map(id=>maps.particles[id]));assert.equal(proceduralForJoints(placed,new Set(['copy-root'])).particles.length,4);
 const a=new ProceduralTimeline(p),b=new ProceduralTimeline(placed);for(const time of [.5,1,2,.5,2]){const x=a.sample(time),y=b.sample(time);x.points.forEach((point,id)=>point.forEach((v,k)=>close(y.points.get(maps.particles[id])[k],v+[200,40][k])));}
 const project={joints:[{id:'root'}],procedural:p};applyProceduralCommand(project,{op:'procedural.remove',particles:['c']});assert.ok(!project.procedural.particles.some(p=>p.id==='out'));assert.equal(project.procedural.attachments.length,0);
});
test('the same bend response drives existing sprite bindings without changing artwork scale',()=>{
 const p=fixture(),binding=makeSpriteBinding(p,'fin',['a','out'],[1,0,0,1,0,0]);binding.rest=[[0,0],[1,2]];
 const matrix=bindingMatrix(binding,new ProceduralSimulation(p).frame());close(Math.hypot(matrix[0],matrix[1]),1);close(matrix[0]*matrix[3]-matrix[1]*matrix[2],1);assert.ok(matrix.every(Number.isFinite));
 const points=new Map(p.particles.map(p=>[p.id,{p:[...p.position],w:0}]));applyAttachments(p.attachments,points);assert.ok(points.get('out').p[1]>2);
});
