import test from 'node:test';import assert from 'node:assert/strict';import {Vector3,Quaternion} from 'three';
import {primitiveWalkerScene,addSceneChain} from '../src/procedural3d/builders.js';
import {sceneDefaults,nodeDefaults,validateScene,applySceneCommand} from '../src/puppet-studio/scene3d/schema.js';
import {createSceneSampler} from '../src/puppet-studio/scene3d/animation.js';
import {sceneWorlds,solveChain3D} from '../src/procedural3d/math.js';
import {PrimitiveTerrain} from '../src/procedural3d/terrain.js';
const close=(a,b,e=1e-5)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
test('generic 3D chain builder creates validated editable primitive objects',()=>{for(const mode of ['reach','follow','step'])for(const primitive of ['cylinder','box','cone']){const s=sceneDefaults();addSceneChain(s,{mode,primitive,count:5});validateScene(s);assert.equal(s.procedural.chains[0].segments.length,5);assert.equal(s.nodes.filter(n=>n.type===primitive).length,5);}});
test('3D IK preserves lengths and reaches in arbitrary planes with a stable knee direction',()=>{for(const target of [[1,-1,1],[-1,.4,1],[.5,1,-1],[0,0,0]]){const points=[new Vector3(),new Vector3(1,0,0),new Vector3(2,0,0)],goal=new Vector3(...target);solveChain3D(points,[1,1],goal,{pole:new Vector3(0,1,0)});close(points[0].distanceTo(points[1]),1);close(points[1].distanceTo(points[2]),1);close(points[2].distanceTo(goal),0);}});
test('unequal links report their minimum reach without collapsing at the root',()=>{const p=[new Vector3(),new Vector3(2,0,0),new Vector3(3,0,0)];solveChain3D(p,[2,1],new Vector3());close(p[0].distanceTo(p[1]),2);close(p[1].distanceTo(p[2]),1);close(p[2].length(),1);});
test('rotated primitive terrain gives real world contacts and normals',()=>{const scene=primitiveWalkerScene(),terrain=new PrimitiveTerrain(scene),worlds=sceneWorlds(scene.nodes);terrain.update(scene.nodes,worlds);const hit=terrain.cast(new Vector3(0,4,1.8),new Vector3(0,-1,0),6);assert.equal(hit.node,'ramp');assert.ok(hit.normal.y>.9&&hit.normal.z<-.2);const node=scene.nodes.find(n=>n.id==='ramp');node.position[1]+=1;terrain.update(scene.nodes,sceneWorlds(scene.nodes));close(terrain.cast(new Vector3(0,5,1.8),new Vector3(0,-1,0),8).point.y-hit.point.y,1);terrain.dispose();});
test('primitive endpoints match solved 3D joints, including under an animated parent',()=>{const scene=primitiveWalkerScene();scene.nodes.find(n=>n.id==='leg-0-link-0').parent='walker';const before=JSON.stringify(scene),sampler=createSceneSampler(scene);for(const time of [0,2,4]){const frame=sampler.sample('walk',time),worlds=sceneWorlds(frame.nodes);for(const chain of frame.procedural.chains){const def=scene.procedural.chains.find(c=>c.id===chain.id);for(let i=0;i<def.segments.length;i++){const node=frame.byId.get(def.segments[i]),m=worlds.get(node.id),a=new Vector3(0,-node.dimensions[1]/2,0).applyMatrix4(m),b=new Vector3(0,node.dimensions[1]/2,0).applyMatrix4(m);close(a.distanceTo(new Vector3(...chain.points[i])),0);close(b.distanceTo(new Vector3(...chain.points[i+1])),0);}}}assert.equal(JSON.stringify(scene),before);sampler.dispose();});
test('3D gait groups retain planted feet, adjust body over the ramp and replay deterministically',()=>{const scene=primitiveWalkerScene(),sampler=createSceneSampler(scene);let previous=null,sawRamp=false,sawTilt=false,sawSwing=false;for(let i=0;i<=300;i++){const frame=sampler.sample('walk',i/60).procedural,moving=frame.chains.filter(c=>c.moving).map(c=>c.id);if(moving.length){sawSwing=true;assert.ok(scene.procedural.gaits[0].groups.some(g=>moving.every(id=>g.includes(id))));}for(const c of frame.chains){assert.ok(c.error<.01);const old=previous?.chains.find(o=>o.id===c.id);if(c.grounded&&old?.grounded)close(new Vector3(...c.points.at(-1)).distanceTo(new Vector3(...old.points.at(-1))),0,.0001);if(c.terrain==='ramp')sawRamp=true;}if(frame.bodies[0].offset>.2&&Math.abs(frame.bodies[0].tilt[0])>.08)sawTilt=true;previous=structuredClone(frame);}assert.ok(sawRamp&&sawTilt&&sawSwing);const expected=structuredClone(sampler.sample('walk',4).procedural);sampler.sample('walk',.2);assert.deepEqual(sampler.sample('walk',4).procedural,expected);sampler.dispose();});
test('3D definitions survive JSON and deleting a root cleans controller references',()=>{const scene=validateScene(JSON.parse(JSON.stringify(primitiveWalkerScene()))),p={assets:[],scene3d:scene};applySceneCommand(p,{op:'scene3d.node.remove',id:'hip-0'});validateScene(scene);assert.ok(scene.procedural.chains.every(c=>c.id!=='leg-0'));assert.ok(scene.procedural.gaits.every(g=>!g.groups.flat().includes('leg-0')));assert.ok(!scene.procedural.bodies[0].chains.includes('leg-0'));});
test('invalid references and feedback hierarchies are rejected',()=>{const s=primitiveWalkerScene();s.procedural.chains[0].root='missing';assert.throws(()=>validateScene(s),/missing node/);s.procedural.chains[0].root='hip-0';s.nodes.find(n=>n.id==='hip-0').parent='leg-0-link-0';assert.throws(()=>validateScene(s),/input is parented/);});

test('planted 3D feet follow an animated terrain primitive without sliding locally',()=>{
 const scene=primitiveWalkerScene();scene.procedural.terrains=['floor'];scene.clips[0].tracks=[{node:'floor',channel:'position',keys:[{time:0,value:[0,-.2,0],easing:'linear'},{time:2,value:[0,.8,0],easing:'linear'}]}];
 const sampler=createSceneSampler(scene),first=structuredClone(sampler.sample('walk',0).procedural),next=sampler.sample('walk',1).procedural;
 for(let i=0;i<next.chains.length;i++){assert.equal(next.chains[i].grounded,true);assert.equal(next.chains[i].moving,false);close(next.chains[i].points.at(-1)[1]-first.chains[i].points.at(-1)[1],.5);close(next.chains[i].points.at(-1)[0],first.chains[i].points.at(-1)[0]);}sampler.dispose();
});

const footScene=()=>{
 const scene=sceneDefaults();addSceneChain(scene,{id:'limb',mode:'step',rest:[[0,0,0],[1,0,0],[1,-2,0]],count:2});
 scene.nodes.push({...nodeDefaults('ground','box'),position:[0,-.2,0],dimensions:[20,.4,20]});scene.procedural.terrains=['ground'];
 Object.assign(scene.procedural.chains[0],{footOrientation:'target',stepDuration:1,stepDistance:.2,overshoot:0});
 scene.clips=[{id:'move',name:'Move',duration:3,loop:false,tracks:[],events:[]}];return scene;
};
const rotationOf=matrix=>{const q=new Quaternion();matrix.decompose(new Vector3(),q,new Vector3());return q;};
test('shaped feet match the slope, preserve dimensions and replay under a moving parent',()=>{
 const scene=primitiveWalkerScene();for(const c of scene.procedural.chains)c.footOrientation='terrain';
 const foot=scene.nodes.find(n=>n.id==='leg-0-joint-2');Object.assign(foot,{type:'box',parent:'walker',dimensions:[.4,.08,.6],scale:[1.2,1,.8]});
 validateScene(scene);const before=JSON.stringify(scene),sampler=createSceneSampler(scene),frame=sampler.sample('walk',4),worlds=sceneWorlds(frame.nodes);
 let onRamp=false;for(const c of frame.procedural.chains.filter(c=>c.grounded)){
  const def=scene.procedural.chains.find(d=>d.id===c.id),m=worlds.get(def.joints.at(-1)),up=new Vector3(0,1,0).applyQuaternion(rotationOf(m));
  close(up.distanceTo(new Vector3(...c.normal)),0);if(c.terrain==='ramp')onRamp=true;
 }
 assert.ok(onRamp);close(new Vector3().setFromMatrixScale(worlds.get(foot.id)).distanceTo(new Vector3(1.2,1,.8)),0);
 const expected=structuredClone(frame.procedural);sampler.sample('walk',.2);assert.deepEqual(sampler.sample('walk',4).procedural,expected);assert.equal(JSON.stringify(scene),before);sampler.dispose();
});
test('foot turning interpolates during a step and keeps the landed heading while planted',()=>{
 const scene=footScene();scene.clips[0].tracks=[{node:'limb-target',channel:'position',keys:[{time:0,value:[1,0,0],easing:'linear'},{time:.01,value:[2,0,0],easing:'linear'}]},{node:'limb-target',channel:'rotation',keys:[{time:0,value:[0,0,0],easing:'linear'},{time:.01,value:[0,90,0],easing:'linear'},{time:1.1,value:[0,90,0],easing:'linear'},{time:2,value:[0,150,0],easing:'linear'}]}];
 const sampler=createSceneSampler(scene),yaw=degrees=>new Quaternion().setFromAxisAngle(new Vector3(0,1,0),degrees*Math.PI/180);
 const mid=sampler.sample('move',31/60).procedural.chains[0];assert.equal(mid.moving,true);close(new Quaternion(...mid.footRotation).angleTo(yaw(45)),0);
 const landed=sampler.sample('move',2).procedural.chains[0];assert.equal(landed.grounded,true);close(new Quaternion(...landed.footRotation).angleTo(yaw(90)),0);sampler.dispose();
});
test('planted foot orientation rotates with its terrain and supports a custom artwork up axis',()=>{
 const scene=footScene(),c=scene.procedural.chains[0];c.footOrientation='terrain';c.footUp=[0,0,1];c.stepDistance=10;
 scene.clips[0].tracks=[{node:'ground',channel:'rotation',keys:[{time:0,value:[0,0,0],easing:'linear'},{time:2,value:[0,60,0],easing:'linear'}]}];
 const sampler=createSceneSampler(scene),first=sampler.sample('move',0).procedural.chains[0],next=sampler.sample('move',1).procedural.chains[0];assert.equal(next.moving,false);
 const expected=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI/6).multiply(new Quaternion(...first.footRotation));close(new Quaternion(...next.footRotation).angleTo(expected),0);close(new Vector3(0,0,1).applyQuaternion(expected).distanceTo(new Vector3(0,1,0)),0);sampler.dispose();
});
test('foot orientation rejects missing output, invalid modes and a zero up axis',()=>{
 const scene=footScene(),c=scene.procedural.chains[0];c.footOrientation='guess';assert.throws(()=>validateScene(scene),/unknown foot orientation/);c.footOrientation='terrain';c.footUp=[0,0,0];assert.throws(()=>validateScene(scene),/zero foot up/);c.footUp=[0,1,0];c.mode='reach';assert.throws(()=>validateScene(scene),/stepping chain/);c.mode='step';delete c.joints;assert.throws(()=>validateScene(scene),/foot joint/);
});
