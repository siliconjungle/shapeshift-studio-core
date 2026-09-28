import test from 'node:test';import assert from 'node:assert/strict';
import {emptyProcedural,validateProcedural} from '../src/procedural/model.js';
import {ProceduralSimulation,ProceduralTimeline,STEP} from '../src/procedural/simulation.js';
import {contactAt} from '../src/procedural/collision.js';
import {applyProceduralCommand} from '../src/procedural/commands.js';
import {proceduralForJoints} from '../src/procedural/sources.js';
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function walker(){
 const p=emptyProcedural();p.gravity=[0,0];p.colliders=[{type:'segment',a:[-500,-100],b:[500,100]}];
 for(let i=0;i<4;i++){const x=i<2?-30:30,side=i%2?-1:1,foot=x+side*55;
  p.particles.push({id:'hip'+i,position:[x,-100],mass:0,radius:2,joint:'travel'},{id:'knee'+i,position:[x+side*25,-40],mass:1,radius:2},{id:'foot'+i,position:[foot,foot*.2],mass:1,radius:2},{id:'home'+i,position:[foot,0],mass:0,radius:2,joint:'travel'});
  p.chains.push({id:'leg'+i,particles:['hip'+i,'knee'+i,'foot'+i],lengths:[60,80],target:'home'+i,mode:'step',stepDistance:20,stepDuration:.25,stepHeight:20,overshoot:.4,direction:[0,1],reach:300});
 }
 p.gaits=[{id:'walk',groups:[['leg0','leg3'],['leg1','leg2']]}];p.supports=[{id:'body',particles:['hip0','hip1','hip2','hip3'],feet:['leg0','leg1','leg2','leg3'],height:85,maxOffset:100,maxTilt:.5,tilt:1,response:12,direction:[0,1]}];validateProcedural(p,[{id:'travel'}]);return p;
}
const anchorAt=(p,time)=>[p.position[0]+time*35,p.position[1]];
test('ray contacts report outward normals on slopes, walls, and circles',()=>{
 const h=contactAt([0,-100],[0,1],200,[{type:'segment',a:[-100,-20],b:[100,20]}]);assert.ok(Math.abs(h.point[1])<1e-8);assert.ok(Math.abs(h.normal[0]-Math.sin(Math.atan(.2)))<1e-8);assert.ok(h.normal[1]<0);
 const wall=contactAt([0,0],[1,0],100,[{type:'segment',a:[50,-50],b:[50,50]}]);assert.ok(distance(wall.normal,[-1,0])<1e-9);
 const circle=contactAt([0,-100],[0,1],200,[{type:'circle',center:[0,0],radius:20}]);assert.deepEqual(circle.normal,[0,-1]);
});
test('diagonal gait groups alternate fairly and planted feet do not slide',()=>{
 const sim=new ProceduralSimulation(walker(),{anchorAt}),groups=[];let previous=sim.frame(),last=null;
 for(let i=0;i<360;i++){const frame=sim.step(),moving=frame.contacts.filter(c=>c.moving).map(c=>c.id),active=moving.length?(moving.every(id=>['leg0','leg3'].includes(id))?0:1):null;
  if(active!==null){assert.ok(moving.every(id=>active===0?['leg0','leg3'].includes(id):['leg1','leg2'].includes(id)));if(active!==last)groups.push(active);last=active;}
  for(const c of frame.contacts){const old=previous.contacts.find(x=>x.id===c.id);if(c.grounded&&old.grounded)assert.ok(distance(c.position,old.position)<.003,'planted foot slid');assert.ok(c.error<.01,'reachable foot missed its planned target');}
  previous=frame;
 }
 assert.ok(groups.length>6);for(let i=1;i<groups.length;i++)assert.notEqual(groups[i],groups[i-1]);
});
test('body follows the terrain slope at its clearance and does not accumulate offsets',()=>{
 const sim=new ProceduralSimulation(walker(),{anchorAt}),first=sim.frame();assert.ok(Math.abs(first.supports[0].angle-Math.atan(.2))<1e-8);
 for(let i=0;i<180;i++)sim.step();const frame=sim.frame(),hips=['hip0','hip1','hip2','hip3'].map(id=>frame.points.get(id)),cx=hips.reduce((s,p)=>s+p[0],0)/4,cy=hips.reduce((s,p)=>s+p[1],0)/4;
 assert.ok(Math.abs(cy-(cx*.2-85))<2);assert.ok(Math.abs(frame.supports[0].angle-Math.atan(.2))<1e-8);assert.ok(Math.abs(distance(hips[0],hips[2])-60)<1e-8);
});
test('gait, support and contact diagnostics rewind deterministically',()=>{
 const timeline=new ProceduralTimeline(walker(),{anchorAt}),a=timeline.sample(4);timeline.sample(.2);assert.deepEqual(timeline.sample(4),a);
});
test('overshoot does not create endless stepping after the home point stops',()=>{
 const sim=new ProceduralSimulation(walker(),{anchorAt:(p,t)=>anchorAt(p,Math.min(t,1))});for(let i=0;i<240;i++)sim.step();assert.ok(sim.frame().contacts.every(c=>c.grounded&&!c.moving));
});
test('unreachable feet are reported rather than claiming a planted contact',()=>{
 const p=walker();p.supports=[];p.particles.find(p=>p.id==='hip0').position[1]=-400;const f=new ProceduralSimulation(p,{anchorAt}).frame(),foot=f.contacts.find(c=>c.id==='leg0');assert.ok(foot.error>100);assert.equal(foot.grounded,false);
});
test('invalid gait references fail atomically and deleting a chain cleans related controllers',()=>{
 const project={joints:[{id:'travel'}],procedural:walker()},before=JSON.stringify(project);assert.throws(()=>applyProceduralCommand(project,{op:'procedural.gait',value:{id:'walk',groups:[['missing']]}}),/step chain references/);assert.equal(JSON.stringify(project),before);
 applyProceduralCommand(project,{op:'procedural.remove',particles:['knee0']});assert.deepEqual(project.procedural.gaits[0].groups,[['leg3'],['leg1','leg2']]);assert.deepEqual(project.procedural.supports[0].feet,['leg1','leg2','leg3']);validateProcedural(project.procedural,project.joints);
 const copy=proceduralForJoints(project.procedural,new Set(['travel']));assert.deepEqual(copy.gaits,project.procedural.gaits);assert.deepEqual(copy.supports,project.procedural.supports);
});
