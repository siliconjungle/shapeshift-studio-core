import test from 'node:test';import assert from 'node:assert/strict';import {Vector3} from 'three';
import {sceneDefaults,nodeDefaults,validateScene,applySceneCommand} from '../src/puppet-studio/scene3d/schema.js';
import {createSceneSampler} from '../src/puppet-studio/scene3d/animation.js';
import {emptyProcedural3D} from '../src/procedural3d/model.js';
import {primitiveSeekingScene} from '../src/procedural3d/builders.js';
const close=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
function fixture(target=[0,0,6]){
 const s=sceneDefaults();s.nodes=[{...nodeDefaults('actor','group'),position:[0,0,0]},{...nodeDefaults('target','group'),position:target}];
 s.procedural=emptyProcedural3D();s.procedural.movers=[{id:'seek',node:'actor',target:'target',minDistance:2,maxDistance:3,moveSpeed:2}];
 s.clips=[{id:'move',name:'Move',duration:20,loop:false,tracks:[],events:[]}];return s;
}
test('approach and retreat settle inside the distance band without drifting or changing source data',()=>{
 for(const target of [[0,0,6],[0,0,.5]]){
  const s=fixture(target),before=JSON.stringify(s);validateScene(s);const sampler=createSceneSampler(s);
  const frame=sampler.sample('move',10),r=frame.procedural.movers[0],distance=new Vector3(...target).distanceTo(new Vector3(...r.position));assert.ok(distance>=2&&distance<=3,`distance ${distance}`);assert.ok(Math.hypot(...r.velocity)<1e-6);
  const position=[...r.position];sampler.sample('move',15).procedural.movers[0].position.forEach((v,i)=>close(v,position[i]));assert.equal(JSON.stringify(s),before);sampler.dispose();
 }
});
test('a target behind the actor causes a turn in place before approach',()=>{
 const s=fixture([5,0,-5]),sampler=createSceneSampler(s),first=sampler.sample('move',.1).procedural.movers[0];close(Math.hypot(...first.position),0);assert.ok(first.turn>0);
 const next=sampler.sample('move',4).procedural.movers[0];assert.ok(Math.hypot(...next.position)>1);assert.ok(Math.abs(next.angle)<.2);sampler.dispose();
});
test('arbitrary movement planes preserve height and layered authored translation',()=>{
 const s=fixture([6,4,8]);Object.assign(s.procedural.movers[0],{up:[0,0,1],forward:[1,0,0]});s.clips[0].tracks=[{node:'actor',channel:'position',keys:[{time:0,value:[0,0,2],easing:'linear'},{time:10,value:[0,0,4],easing:'linear'}]}];
 const sampler=createSceneSampler(s),r=sampler.sample('move',5).procedural.movers[0];close(r.position[2],3);assert.ok(r.position[0]>1);close(r.velocity[2],0);sampler.dispose();
});
test('movement replay is deterministic across sampling rates and coincident targets remain finite',()=>{
 const s=fixture([0,0,0]),sampler=createSceneSampler(s),expected=structuredClone(sampler.sample('move',4).procedural);assert.ok(expected.movers[0].position.every(Number.isFinite));assert.ok(Math.hypot(...expected.movers[0].position)>1);
 sampler.sample('move',0);for(let i=0;i<=120;i++)sampler.sample('move',i/30);assert.deepEqual(sampler.sample('move',4).procedural,expected);sampler.dispose();
});
test('movement supports parented actors and disabled controllers preserve animation',()=>{
 const s=fixture();s.nodes.push({...nodeDefaults('parent','group'),position:[4,1,0],rotation:[0,30,0]});s.nodes[0].parent='parent';s.nodes[1].position=[4,1,6];const sampler=createSceneSampler(s),frame=sampler.sample('move',10),r=frame.procedural.movers[0];close(r.position[1],1);assert.ok(r.distance>=2&&r.distance<=3);sampler.dispose();
 s.procedural.movers[0].enabled=false;const disabled=createSceneSampler(s);assert.deepEqual(disabled.sample('move',10).byId.get('actor').position,[0,0,0]);disabled.dispose();
});
test('movement rejects invalid ranges, duplicate writers and target feedback; deletion cleans inputs',()=>{
 for(const change of [s=>s.procedural.movers[0].minDistance=4,s=>s.procedural.movers[0].up=[0,0,0],s=>s.procedural.movers[0].moveSpeed=-1,s=>s.procedural.movers[0].target='missing',s=>s.nodes[1].parent='actor',s=>s.procedural.movers.push({...s.procedural.movers[0],id:'duplicate'})]){const s=fixture();change(s);assert.throws(()=>validateScene(s),/Procedural 3D/);}
 const s=fixture();applySceneCommand({scene3d:s,assets:[]},{op:'scene3d.node.remove',id:'target'});assert.deepEqual(s.procedural.movers,[]);validateScene(s);
});
test('the target-driven creature combines movement, planted steps, support and head tracking',()=>{
 const s=primitiveSeekingScene();validateScene(s);assert.ok(!s.clips[0].tracks.some(t=>t.node==='walker'));const sampler=createSceneSampler(s);let moved=false,stepped=false,grounded=false;
 for(let i=0;i<=600;i++){
  const p=sampler.sample('walk',i/60).procedural;assert.equal(p.trackers.length,3);assert.equal(p.movers.length,1);if(Math.hypot(...p.movers[0].offset)>.5)moved=true;if(p.chains.some(c=>c.moving))stepped=true;if(p.chains.some(c=>c.grounded))grounded=true;assert.ok(p.chains.every(c=>c.error<.01),`unreachable step at ${i/60}`);
 }
 assert.ok(moved&&stepped&&grounded);sampler.dispose();
});
