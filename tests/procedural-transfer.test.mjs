import test from 'node:test';import assert from 'node:assert/strict';
import {solveChain} from '../src/procedural/constraints.js';
import {emptyProcedural,validateProcedural} from '../src/procedural/model.js';
import {proceduralForJoints} from '../src/procedural/sources.js';
import {captureProcedural,proceduralBindings,remapProcedural,appendProcedural,validateProceduralPacket} from '../src/procedural/transfer.js';

test('a folded following chain chooses the same bend after world translation',()=>{
 const points=Array.from({length:10},(_,i)=>({p:[80+i*16,0],w:1})),moved=points.map(p=>({p:[p.p[0]+500,200],w:1})),lengths=Array(9).fill(16);
 solveChain(points,lengths,[120,0],{mode:'follow',bendLimit:2});solveChain(moved,lengths,[620,200],{mode:'follow',bendLimit:2});
 points.forEach((p,i)=>p.p.forEach((v,k)=>assert.ok(Math.abs(moved[i].p[k]-v-[500,200][k])<1e-7)));
});

test('generated component ownership survives transfer and linked-source extraction',()=>{
 const p=emptyProcedural();p.particles=[{id:'a',position:[0,0],mass:1,radius:4},{id:'b',position:[10,0],mass:1,radius:4}];p.distances=[{a:'a',b:'b',length:10}];p.colliders=[{type:'segment',a:[-100,100],b:[100,100]}];
 const packet=captureProcedural(p,2,new Set(['root']),{includeUnattached:true,owner:'root'});validateProceduralPacket(packet,2,[{id:'root'}]);const maps=proceduralBindings(packet,2,p,'copy'),placed=remapProcedural(packet,2,{root:'other'},maps,[200,0]);appendProcedural(p,placed,2);
 const extracted=proceduralForJoints(p,new Set(['other']));assert.equal(extracted.particles.length,2);assert.equal(extracted.distances.length,1);assert.deepEqual(extracted.particles[0].position,[200,0]);validateProcedural(extracted,[{id:'other'}]);assert.throws(()=>validateProcedural(extracted,[{id:'root'}]),/missing owner/);
});


test('impulses retain only captured targets and remap their references without changing velocity',()=>{
 const p=emptyProcedural();p.particles=[{id:'a',owner:'root',position:[0,0],mass:1,radius:4},{id:'b',owner:'other',position:[10,0],mass:1,radius:4}];p.impulses=[{id:'kick',particles:['a','b'],time:.5,velocity:[12,-30]}];
 const packet=captureProcedural(p,2,new Set(['root']));assert.deepEqual(packet.impulses[0].particles,['a']);const maps=proceduralBindings(packet,2,p,'copy');const placed=remapProcedural(packet,2,{root:'copy'},maps,[200,100]);assert.deepEqual(placed.impulses[0].particles,[maps.particles.a]);assert.deepEqual(placed.impulses[0].velocity,[12,-30]);appendProcedural(p,placed,2);assert.equal(p.impulses.length,2);validateProceduralPacket(placed,2,[{id:'copy'}]);
});
