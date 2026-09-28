import {nodeDefaults,sceneDefaults,materialDefaults} from '../puppet-studio/scene3d/schema.js';
import {emptyProcedural3D} from './model.js';
import {sceneWorlds,vector} from './math.js';
export function addSceneChain(scene,{id='chain',root,target,mode='reach',count=2,length=1,thickness=.12,primitive='cylinder',rest,pole=[0,1,0],position=[0,2,0]}={}){
 const p=scene.procedural??=emptyProcedural3D();if(!Number.isInteger(count)||count<1||count>24)throw Error('Choose 1–24 links');if(!['cylinder','box','cone'].includes(primitive))throw Error('Choose a link primitive');
 if(p.chains.some(c=>c.id===id)||scene.nodes.some(n=>n.id.startsWith(id+'-')))throw Error('Choose a unique chain ID');
 const add=(name,type,values)=>{const n={...nodeDefaults(name,type),...values};scene.nodes.push(n);return n;};
 if(!root){root=id+'-root';add(root,'group',{position});}
 const matrix=sceneWorlds(scene.nodes).get(root);if(!matrix)throw Error('Choose a root object');
 rest??=Array.from({length:count+1},(_,i)=>[i*length*.8,Math.sin(i/count*Math.PI)*length*.5-i*length*.3,0]);
 const lengths=rest.slice(1).map((v,i)=>vector(v).distanceTo(vector(rest[i]))),world=rest.map(v=>vector(v).applyMatrix4(matrix)),segments=[],joints=[];
 if(!target){target=id+'-target';add(target,'group',{position:world.at(-1).toArray()});}
 for(let i=0;i<count;i++){const key=id+'-link-'+i;segments.push(key);add(key,primitive,{position:world[i].clone().add(world[i+1]).multiplyScalar(.5).toArray(),dimensions:[thickness,1,thickness],segments:16});}
 for(let i=0;i<=count;i++){const key=id+'-joint-'+i;joints.push(key);add(key,'sphere',{position:world[i].toArray(),dimensions:[thickness*1.3,thickness*1.3,thickness*1.3],segments:12});}
 const chain={id,root,target,segments,joints,lengths,rest,mode,pole,axis:'y',bendLimit:Math.PI,direction:[0,-1,0],reach:6,stepDistance:.35,stepHeight:.3,stepDuration:.25,overshoot:.4};p.chains.push(chain);return chain;
}
/** An example document composed entirely from generic primitives and controllers. */
export function primitiveWalkerScene({legs=8}={}){
 if(!Number.isInteger(legs)||legs<4||legs>16||legs%2)throw Error('Choose an even limb count from 4–16');
 const scene=sceneDefaults();scene.name='Primitive terrain walker';scene.procedural=emptyProcedural3D();scene.camera={...scene.camera,position:[7,5.5,8],target:[0,1,.7],size:7.5};
 scene.materials.push({...materialDefaults('ground'),palette:['#87918c','#a8b3a2','#edf0dc','#343f3d'],ink:.4,scribble:0});scene.materials[0].palette=['#839fb8','#cf9365','#edf0dc','#1a2531'];scene.materials[0].scribble=0;
 const add=(id,type,values)=>{const n={...nodeDefaults(id,type),...values};scene.nodes.push(n);return n;};
 add('floor','box',{position:[0,-.2,0],dimensions:[14,.4,14],material:'ground'});add('ramp','box',{position:[0,.4,1.8],rotation:[-15,0,0],dimensions:[5,.2,4],material:'ground'});scene.procedural.terrains=['floor','ramp'];
 add('walker','group',{position:[0,1.6,-2.4]});add('shell','sphere',{parent:'walker',position:[0,0,0],dimensions:[1.5,.8,2],segments:24});
 const groups=[[],[]];for(let i=0;i<legs;i++){const side=i%2?-1:1,row=Math.floor(i/2),z=(row/(legs/2-1)-.5)*1.5,root='hip-'+i,home='home-'+i;add(root,'group',{parent:'walker',position:[side*.55,0,z]});add(home,'group',{parent:'walker',position:[side*1.9,-1.6,z*1.3]});
  const c=addSceneChain(scene,{id:'leg-'+i,root,target:home,mode:'step',rest:[[0,0,0],[side*.85,.2,0],[side*1.35,-1.6,z*.3]],pole:[side,.8,0],count:2,thickness:.13});groups[(row+(i%2))%2].push(c.id);
 }
 scene.procedural.gaits=[{id:'alternating',groups}];scene.procedural.bodies=[{node:'walker',chains:groups.flat(),height:1.6,maxOffset:2,maxTilt:.6,response:10,up:[0,1,0]}];
 scene.clips=[{id:'walk',name:'Across the ramp',duration:12,loop:true,tracks:[{node:'walker',channel:'position',keys:[{time:0,value:[0,1.6,-2.4],easing:'smooth'},{time:6,value:[0,1.6,3],easing:'smooth'},{time:12,value:[0,1.6,-2.4],easing:'smooth'}]}],events:[]}];return scene;
}

/** Parent/child tracking and independent eye limits, authored entirely as reusable data. */
export function primitiveTrackingScene(){
 const scene=primitiveWalkerScene({legs:4});scene.name='Primitive head and eyes';scene.materials[0].palette=['#72917b','#acc47c','#edf0dc','#1a2531'];
 scene.materials.push({...materialDefaults('eye-white'),palette:['#bbc6b6','#e4ebd4','#ffffff','#263327'],scribble:0},{...materialDefaults('pupil'),palette:['#102522','#102522','#102522','#102522'],ink:0,scribble:0});
 const add=(id,type,values)=>scene.nodes.push({...nodeDefaults(id,type),...values});
 add('head','sphere',{parent:'walker',position:[0,.15,1.05],dimensions:[.9,.65,.9],segments:24});
 add('look-target','sphere',{position:[3,2.5,3],dimensions:[.16,.16,.16],material:'eye-white'});
 scene.procedural.trackers=[{id:'head-tracking',node:'head',target:'look-target',yaw:[-1,1],pitch:[-.6,.6],cone:1.1,response:5}];
 for(const [side,x]of [['left',-.32],['right',.32]]){
  const id=side+'-eye';add(id,'sphere',{parent:'head',position:[x,.17,.27],dimensions:[.33,.33,.33],segments:20,material:'eye-white'});
  add(side+'-pupil','sphere',{parent:id,position:[0,0,.15],dimensions:[.17,.22,.07],segments:16,material:'pupil'});
  scene.procedural.trackers.push({id:side+'-tracking',node:id,target:'look-target',origin:'head',yaw:side==='left'?[-1,.5]:[-.5,1],pitch:[-.45,.45],cone:1,response:14});
 }
 for(const c of scene.procedural.chains)c.footOrientation='terrain';
 scene.clips[0].tracks.push({node:'look-target',channel:'position',keys:[{time:0,value:[3,2.5,3],easing:'smooth'},{time:3,value:[-3,3,3],easing:'smooth'},{time:6,value:[3,1,5],easing:'smooth'},{time:9,value:[-3,2.5,1],easing:'smooth'},{time:12,value:[3,2.5,3],easing:'smooth'}]});
 return scene;
}

/** The root has no movement keys: the target alone drives the complete creature. */
export function primitiveSeekingScene(){
 const scene=primitiveTrackingScene();scene.name='Follow a target';
 scene.clips[0].tracks=scene.clips[0].tracks.filter(t=>t.node!=='walker');
 scene.procedural.movers=[{id:'body-movement',node:'walker',target:'look-target',minDistance:2.5,maxDistance:3.2,moveSpeed:.9,moveResponse:5,turnSpeed:1,turnResponse:6,turnTolerance:.12,moveAngle:Math.PI/3}];
 scene.clips[0].duration=20;scene.clips[0].tracks.find(t=>t.node==='look-target').keys=[{time:0,value:[2,2,3],easing:'smooth'},{time:6,value:[-2,2,4],easing:'smooth'},{time:10,value:[-3,2,0],easing:'smooth'},{time:14,value:[1,2,-1],easing:'smooth'},{time:20,value:[2,2,3],easing:'smooth'}];
 return scene;
}
