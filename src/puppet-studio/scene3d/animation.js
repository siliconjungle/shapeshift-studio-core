import {fieldResponse} from '../../illustration/controls.js';
import {sceneWorlds} from '../../procedural3d/math.js';
import {SceneProceduralTimeline} from '../../procedural3d/runtime.js';
import {easing as sharedEase} from '../fx/math.js';
import {influence,shortAngle} from '../motion-tools/core.js';
import {scenePoseLayers} from '../motion-tools/scene-layers.js';
import {compileExpression} from './core/expression.js';
export function ease(t,type='smooth',bezier){if(type==='bezier')return sharedEase(t,type,bezier);t=Math.max(0,Math.min(1,t));if(type==='step')return t>=1?1:0;if(type==='linear')return t;if(type==='in')return t*t*t;if(type==='out')return 1-(1-t)**3;if(type==='back'){const x=t-1;return 1+2.70158*x*x*x+1.70158*x*x;}if(type==='elastic')return t===0||t===1?t:2**(-10*t)*Math.sin((t-.075)*Math.PI*2/.3)+1;return t*t*(3-2*t);}
export function sampleKeys(keys,time,fallback){if(!keys.length)return fallback;if(time<=keys[0].time)return structuredClone(keys[0].value);if(time>=keys.at(-1).time)return structuredClone(keys.at(-1).value);const b=keys.findIndex(k=>k.time>time),a=keys[b-1],next=keys[b],t=ease((time-a.time)/(next.time-a.time),next.easing,next.bezier);return Array.isArray(a.value)?a.value.map((x,i)=>x+(next.value[i]-x)*t):a.value+(next.value-a.value)*t;}
export function setPath(object,path,value){const parts=path.split('.');let target=object;for(const p of parts.slice(0,-1))target=target[p]??=(p==='material'?{flash:0}:{});target[parts.at(-1)]=value;}
export function animationTime(clip,time){const windows=clip.events.filter(e=>e.type==='hitstop').map(e=>[e.time,Math.min(time,e.time+e.duration)]).filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0]);let frozen=0,end=-Infinity;for(const [a,b]of windows){frozen+=Math.max(0,b-Math.max(a,end));end=Math.max(end,b);}return Math.max(0,time-frozen);}
export function sampleScene(scene,clipId,time){const sampler=createSceneSampler(scene);try{return sampler.sample(clipId,time);}finally{sampler.dispose();}}

// A sampler owns its mutable pose. Rebuild it only when authored scene data
// changes. Callers retaining a frame must clone it (sampleScene remains portable).
export function createSceneSampler(scene,{corrections=true}={}){
 const nodes=structuredClone(scene.nodes),byId=new Map(nodes.map(n=>[n.id,n])),restById=new Map(scene.nodes.map(n=>[n.id,n]));
 const plans=new Map();
 function binding(n,path,rest){const parts=path.split('.');let target=n,source=rest;for(const key of parts.slice(0,-1)){target=target[key]??={};source=source?.[key];}const key=parts.at(-1);return{target,key,hasRest:Object.hasOwn(source??{},key),rest:structuredClone(source?.[key])};}
 for(const clip of scene.clips){const tracks=[];for(const track of clip.tracks){if(track.controllerOwned)continue;const n=byId.get(track.node),rest=restById.get(track.node);if(!n||!track.keys.length&&!track.program)continue;const bindings=[];
   if(track.channel.startsWith('eye.')){for(const [face,surface]of Object.entries(n.surfaces))if(surface.eye)bindings.push(binding(surface,track.channel,rest.surfaces[face]));}
   else bindings.push(binding(n,track.channel==='material.flash'?'flash':track.channel,rest));
   const program=track.program?{variables:(track.program.variables??[]).map(([id,e])=>[id,compileExpression(e)]),values:track.program.values.map(compileExpression)}:null;tracks.push({track,bindings,node:n,program});
 }plans.set(clip.id,{clip,tracks});}
 const procedural=scene.procedural?new SceneProceduralTimeline(scene,createSceneSampler({...scene,procedural:undefined},{corrections:false})):null;
 const baseSampler=scene.clips.some(c=>c.tools?.follow?.length||c.tools?.layers?.some(l=>l.sourceClip))?createSceneSampler({...scene,clips:scene.clips.map(c=>({...c,tools:undefined,events:c.events.filter(e=>e.type!=='hitstop')}))}):null;
 let previous=null;const result={nodes,byId,clip:null,time:0,dirtyNodes:[],transformNodes:[]};
 function restore(b){if(!b.hasRest){delete b.target[b.key];return;}if(Array.isArray(b.rest)&&Array.isArray(b.target[b.key])){b.target[b.key].length=b.rest.length;for(let i=0;i<b.rest.length;i++)b.target[b.key][i]=b.rest[i];}else b.target[b.key]=structuredClone(b.rest);}
 function assign(b,keys,time){let a,next,u=0;if(time<=keys[0].time)a=keys[0];else if(time>=keys.at(-1).time)a=keys.at(-1);else{let lo=1,hi=keys.length-1;while(lo<hi){const mid=(lo+hi)>>>1;if(keys[mid].time>time)hi=mid;else lo=mid+1;}next=keys[lo];a=keys[lo-1];u=ease((time-a.time)/(next.time-a.time),next.easing,next.bezier);}
   const value=a.value;if(Array.isArray(value)){let out=b.target[b.key],changed=false;if(!Array.isArray(out)||out.length!==value.length){out=b.target[b.key]=new Array(value.length);changed=true;}for(let i=0;i<value.length;i++){const x=next?value[i]+(next.value[i]-value[i])*u:value[i];if(out[i]!==x){out[i]=x;changed=true;}}return changed;}
   const raw=next?value+(next.value-value)*u:value,x=typeof b.rest==='boolean'?Boolean(raw):raw;if(b.target[b.key]===x)return false;b.target[b.key]=x;return true;
 }
 return{nodes,byId,dispose(){procedural?.dispose();baseSampler?.dispose();},sample(clipId,time,{parameters={}}={}){const plan=plans.get(clipId)??plans.values().next().value;if(!plan)throw Error('Scene needs an animation clip');const dirty=new Set(),transforms=new Set();
   if(previous!==plan){if(previous)for(const {bindings}of previous.tracks)for(const b of bindings)restore(b);for(const n of nodes){dirty.add(n);transforms.add(n);}}
   const toolPose=!!(scene.procedural||scene.motionFields?.length||plan.clip.tools||previous?.clip.tools);
   if(toolPose)for(const n of nodes){const rest=restById.get(n.id);for(const k of ['position','rotation','scale','deform']){if(Array.isArray(n[k]))n[k].splice(0,n[k].length,...rest[k]);else Object.assign(n[k],structuredClone(rest[k]));}dirty.add(n);transforms.add(n);}
   const t=animationTime(plan.clip,time);
   for(const {track,bindings,node,program}of plan.tracks){let changed=false;if(program){const input={time:t,duration:plan.clip.duration,parameters:{...track.program.parameters,...parameters}};for(const [id,fn]of program.variables)input[id]=fn(input);const values=program.values.map(fn=>fn(input));for(const b of bindings){if(Array.isArray(b.rest)){const out=b.target[b.key];for(let i=0;i<values.length;i++){if(out[i]!==values[i])changed=true;out[i]=values[i];}}else{changed=b.target[b.key]!==values[0]||changed;b.target[b.key]=values[0];}}}else for(const b of bindings)changed=assign(b,track.keys,t)||changed;if(changed){dirty.add(node);if(['position','rotation','scale'].includes(track.channel))transforms.add(node);}}
   const sampleLayer=(l,at)=>{const source=scene.clips.find(c=>c.id===l.sourceClip),age=Math.max(0,at-(l.start??0))*(l.speed??1)+(l.offset??0),sample=baseSampler.sample(source.id,l.loop===false?Math.min(source.duration,age):age%source.duration),values={};for(const id of l.joints){const n=sample.byId.get(id),rest=restById.get(id);values[id]={position:n.position.map((v,i)=>v-rest.position[i]),rotation:n.rotation.map((v,i)=>v-rest.rotation[i]),scale:n.scale.map((v,i)=>v/rest.scale[i])};}return values;};if(plan.clip.tools)scenePoseLayers(nodes,plan.clip.tools,t,plan.clip.duration,sampleLayer,'base');
   for(const f of plan.clip.tools?.follow??[]){const w=influence(f,t,plan.clip.duration),node=byId.get(f.joint),source=f.source??node?.parent;if(!w||!node||!source)continue;const current=baseSampler.sample(plan.clip.id,t).byId.get(source).rotation.slice(),lag=(f.lagFrames??3)/(plan.clip.fps??30),oldTime=plan.clip.loop?(t-lag+plan.clip.duration)%plan.clip.duration:Math.max(0,t-lag),old=baseSampler.sample(plan.clip.id,oldTime).byId.get(source).rotation;for(let i=0;i<3;i++)node.rotation[i]+=Math.max(-(f.limit??45),Math.min(f.limit??45,shortAngle(current[i],old[i])))*w*(f.strength??.65);}
   if(procedural){const frame=procedural.sample(plan.clip.id,time,{parameters});for(const value of frame.nodes){const n=byId.get(value.id);for(const k of ['position','rotation','scale'])n[k].splice(0,3,...value[k]);dirty.add(n);transforms.add(n);}result.procedural={time:frame.time,chains:frame.chains,bodies:frame.bodies,trackers:frame.trackers,movers:frame.movers,authored:frame.authored};}
   if(scene.motionFields?.length){const worlds=sceneWorlds(nodes);for(const n of nodes){if(!n.fieldReceiver?.enabled)continue;const m=worlds.get(n.id).elements,f=fieldResponse(scene.motionFields,[m[12],m[13],m[14]],t,n.fieldReceiver);const inv=worlds.get(n.id).clone().invert().elements,localX=inv[0]*f[0]+inv[4]*f[1]+inv[8]*f[2],localZ=inv[2]*f[0]+inv[6]*f[1]+inv[10]*f[2];n.deform.bend[0]+=localX*(n.fieldReceiver.bend??.08);n.deform.bend[1]+=localZ*(n.fieldReceiver.bend??.08);dirty.add(n);}}
   if(corrections&&plan.clip.tools)scenePoseLayers(nodes,plan.clip.tools,t,plan.clip.duration,sampleLayer,'corrective');
   previous=plan;result.clip=plan.clip;result.time=time;result.dirtyNodes=Array.from(dirty);result.transformNodes=Array.from(transforms);return result;
 }};
}
