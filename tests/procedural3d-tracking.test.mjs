import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion} from 'three';
import {sceneDefaults,nodeDefaults,validateScene,applySceneCommand} from '../src/puppet-studio/scene3d/schema.js';
import {createSceneSampler} from '../src/puppet-studio/scene3d/animation.js';
import {emptyProcedural3D} from '../src/procedural3d/model.js';
import {sceneWorlds} from '../src/procedural3d/math.js';
import {primitiveTrackingScene} from '../src/procedural3d/builders.js';
const close=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
function fixture(){
 const s=sceneDefaults();s.nodes=[{...nodeDefaults('root','group'),position:[0,0,0]},{...nodeDefaults('head','box'),parent:'root',position:[0,0,0]},{...nodeDefaults('target','group'),position:[3,0,3]}];
 s.procedural=emptyProcedural3D();s.procedural.trackers=[{id:'look',node:'head',target:'target',response:4}];
 s.clips=[{id:'look',name:'Look',duration:3,loop:false,tracks:[],events:[]}];return s;
}
const worldDirection=(nodes,id,axis=[0,0,1])=>new Vector3(...axis).transformDirection(sceneWorlds(nodes).get(id));
test('tracking smooths toward a target with the same result across playback rates and rewind',()=>{
 const s=fixture(),before=JSON.stringify(s),sampler=createSceneSampler(s);validateScene(s);
 close(sampler.sample('look',0).procedural.trackers[0].yaw,0);
 close(sampler.sample('look',.5).procedural.trackers[0].yaw,Math.PI/4*(1-Math.exp(-2)));
 const expected=structuredClone(sampler.sample('look',2).procedural);sampler.sample('look',0);for(let t=0;t<=120;t++)sampler.sample('look',t/60);assert.deepEqual(sampler.sample('look',2).procedural,expected);
 assert.equal(JSON.stringify(s),before);sampler.dispose();
});
test('asymmetric local limits and a cone remain relative to the authored pose and animated parent',()=>{
 const s=fixture(),t=s.procedural.trackers[0];Object.assign(t,{yaw:[-.2,.6],pitch:[-.1,.3],cone:.4,response:100});
 s.nodes.find(n=>n.id==='head').rotation=[0,20,0];s.nodes.find(n=>n.id==='target').position=[8,8,0];
 s.clips[0].tracks=[{node:'root',channel:'rotation',keys:[{time:0,value:[0,0,0],easing:'linear'},{time:3,value:[0,60,0],easing:'linear'}]}];
 const sampler=createSceneSampler(s);for(let i=1;i<=120;i++){const frame=sampler.sample('look',i/60),r=frame.procedural.trackers[0];assert.ok(r.yaw>=-.2-1e-8&&r.yaw<=.6+1e-8);assert.ok(r.pitch>=-.1-1e-8&&r.pitch<=.3+1e-8);assert.ok(r.angle<=.4+1e-8);}
 sampler.dispose();
});
test('children track after parents even when listed first and can share an aiming origin',()=>{
 const s=fixture();s.nodes.push({...nodeDefaults('eye','sphere'),parent:'head',position:[.3,0,.2]});
 s.procedural.trackers[0].yaw=[-.3,.3];s.procedural.trackers[0].response=100;
 s.procedural.trackers.unshift({id:'eye-look',node:'eye',target:'target',origin:'head',response:100});
 const sampler=createSceneSampler(s),frame=sampler.sample('look',2);assert.deepEqual(frame.procedural.trackers.map(t=>t.node),['head','eye']);
 close(worldDirection(frame.nodes,'eye').distanceTo(new Vector3(3,0,3).normalize()),0);close(frame.procedural.trackers[0].yaw,.3);sampler.dispose();
});
test('arbitrary forward axes aim correctly without changing the piece shape or scale',()=>{
 const s=fixture();s.procedural.trackers[0].forward=[1,0,0];s.procedural.trackers[0].response=100;s.nodes.find(n=>n.id==='target').position=[3,1,-3];
 const node=s.nodes.find(n=>n.id==='head');node.dimensions=[2,.4,.6];node.scale=[1.2,.8,1.5];const sampler=createSceneSampler(s),frame=sampler.sample('look',2);
 close(worldDirection(frame.nodes,'head',[1,0,0]).distanceTo(new Vector3(3,1,-3).normalize()),0);assert.deepEqual(frame.byId.get('head').dimensions,node.dimensions);assert.deepEqual(frame.byId.get('head').scale,node.scale);sampler.dispose();
});
test('disabled and coincident targets stay finite and preserve the authored neutral rotation',()=>{
 const s=fixture();s.procedural.trackers[0].enabled=false;s.nodes.find(n=>n.id==='head').rotation=[12,25,5];let sampler=createSceneSampler(s);assert.deepEqual(sampler.sample('look',1).byId.get('head').rotation,[12,25,5]);sampler.dispose();
 s.procedural.trackers[0].enabled=true;s.nodes.find(n=>n.id==='target').position=[0,0,0];sampler=createSceneSampler(s);const q=new Quaternion(...sampler.sample('look',1).procedural.trackers[0].rotation);assert.ok(q.toArray().every(Number.isFinite));close(sampler.sample('look',1).procedural.trackers[0].angle,0);sampler.dispose();
});
test('tracking rejects invalid axes, feedback and duplicate outputs; deleting inputs cleans it',()=>{
 for(const change of [s=>s.procedural.trackers[0].forward=[0,0,0],s=>s.procedural.trackers[0].up=[0,0,2],s=>s.procedural.trackers[0].yaw=[.1,1],s=>s.procedural.trackers[0].target='missing',s=>s.nodes.find(n=>n.id==='target').parent='head',s=>s.procedural.trackers.push({...s.procedural.trackers[0],id:'second'})]){const s=fixture();change(s);assert.throws(()=>validateScene(s),/Procedural 3D/);}
 const s=fixture();applySceneCommand({scene3d:s,assets:[]},{op:'scene3d.node.remove',id:'target'});assert.equal(s.procedural.trackers.length,0);validateScene(s);
});
test('the head and eyes study combines tracking with native stepping and body support',()=>{
 const s=primitiveTrackingScene();validateScene(s);const sampler=createSceneSampler(s),frame=sampler.sample('walk',4);assert.equal(frame.procedural.trackers.length,3);assert.equal(frame.procedural.chains.length,4);assert.ok(frame.procedural.chains.every(c=>c.error<.01));assert.ok(frame.procedural.trackers.every(t=>Number.isFinite(t.yaw)));sampler.dispose();
});

test('mirrored pieces with diagonal forward axes aim through scaled and rotated parents',()=>{
 const s=fixture(),head=s.nodes.find(n=>n.id==='head'),root=s.nodes.find(n=>n.id==='root');head.mirror=[true,false];head.scale=[1.2,.8,1.5];root.scale=[2,1,.5];root.rotation=[0,30,0];root.mirror=[true,false];
 Object.assign(s.procedural.trackers[0],{forward:[1,0,1],yaw:[-Math.PI,Math.PI],pitch:[-Math.PI/2,Math.PI/2],response:100});s.nodes.find(n=>n.id==='target').position=[3,1,-3];validateScene(s);
 const sampler=createSceneSampler(s),frame=sampler.sample('look',2);close(worldDirection(frame.nodes,'head',[1,0,1]).distanceTo(new Vector3(3,1,-3).normalize()),0);sampler.dispose();
});
