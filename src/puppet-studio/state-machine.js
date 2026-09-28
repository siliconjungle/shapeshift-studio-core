// Renderer-independent animation graphs. Runtime clocks/inputs never mutate the document.
export const MACHINE_COMMANDS=['stateMachine.put','stateMachine.remove'];
const fail=message=>{throw Error('State machine: '+message);};
const finite=(n,min,max)=>Number.isFinite(n)&&n>=min&&n<=max;
const idOK=id=>typeof id==='string'&&/^[\w-]{1,100}$/.test(id)&&!['__proto__','constructor','prototype','any','exit'].includes(id);
const nameOK=name=>typeof name==='string'&&name.trim().length>0&&name.length<=120;
function list(value,label,max){if(!Array.isArray(value)||value.length>max)fail('invalid '+label);const ids=new Set();for(const item of value){if(!item||!idOK(item.id)||ids.has(item.id))fail('invalid or duplicate '+label+' ID');ids.add(item.id);}return ids;}
export function machineClips(project,dimension){return dimension===3?project.scene3d?.clips??[]:project.clips??[];}
export function validateStateMachines(project){
 if(project.stateMachines===undefined)return project;
 list(project.stateMachines,'machines',64);
 for(const m of project.stateMachines){
  if(!nameOK(m.name)||![2,3].includes(m.dimension))fail('invalid name or dimension');
  const clips=new Map(machineClips(project,m.dimension).map(c=>[c.id,c]));
  const inputs=list(m.inputs,'inputs',64),definitions=new Map(m.inputs.map(i=>[i.id,i]));
  for(const i of m.inputs)if(!nameOK(i.name)||!['boolean','number','trigger'].includes(i.type)||(i.type==='number'?!finite(i.value,-1e9,1e9):i.type==='boolean'&&typeof i.value!=='boolean'))fail('invalid input '+i.id);
  list(m.layers,'layers',32);if(!m.layers.length)fail('at least one layer is required');
  for(const l of m.layers){
   if(!nameOK(l.name)||typeof l.enabled!=='boolean')fail('invalid layer');
   const states=list(l.states,'states',256);list(l.transitions,'transitions',1024);
   if(!states.has(l.entry))fail('choose an entry state');
   for(const s of l.states){if(!nameOK(s.name)||!['animation','blank'].includes(s.type)||!finite(s.x,0,10000)||!finite(s.y,0,10000))fail('invalid state '+s.id);if(s.type==='animation'&&(!clips.has(s.clip)||!finite(clips.get(s.clip)?.duration,.000001,3600)||!finite(s.speed,-20,20)||!['clip','loop','once'].includes(s.playback)))fail('invalid animation state '+s.name+' (check clip, speed and playback)');}
   for(const t of l.transitions){
    if(!(states.has(t.from)||t.from==='any')||!(states.has(t.to)||t.to==='exit')||typeof t.enabled!=='boolean'||!finite(t.duration,0,60)||!['linear','smooth'].includes(t.easing)||t.exitTime!==null&&!finite(t.exitTime,0,100))fail('invalid transition '+t.id);
    if(!Array.isArray(t.conditions)||t.conditions.length>32)fail('invalid conditions');
    for(const c of t.conditions){const input=definitions.get(c.input);if(!inputs.has(c.input))fail('missing condition input');const ops=input.type==='number'?['eq','ne','gt','ge','lt','le']:input.type==='boolean'?['eq','ne']:['fired'];if(!ops.includes(c.op)||(input.type==='number'?!finite(c.value,-1e9,1e9):input.type==='boolean'&&typeof c.value!=='boolean'))fail('invalid condition for '+input.name);}
   }
  }
 }
 return project;
}
export function newStateMachine(id,dimension,clip){const state={id:'state-'+id,name:clip?.name??'Blank',type:clip?'animation':'blank',x:100,y:100,...(clip?{clip:clip.id,speed:1,playback:'clip'}:{})};return{id,name:'State machine',dimension,inputs:[],layers:[{id:'layer-'+id,name:'Base layer',enabled:true,entry:state.id,states:[state],transitions:[]}]};}
export function applyStateMachineCommand(project,command){
 const current=project.stateMachines??[];
 if(command.op==='stateMachine.remove'){if(!current.some(m=>m.id===command.id))fail('missing machine');project.stateMachines=current.filter(m=>m.id!==command.id);return command.id;}
 if(command.op!=='stateMachine.put')fail('unknown command');
 const value=structuredClone(command.value),next=current.filter(m=>m.id!==value?.id);const at=current.findIndex(m=>m.id===value?.id);next.splice(at<0?next.length:at,0,value);
 validateStateMachines({...project,stateMachines:next});project.stateMachines=next;return value.id;
}
const condition=(c,values)=>{const v=values.get(c.input);switch(c.op){case'fired':return v===true;case'eq':return v===c.value;case'ne':return v!==c.value;case'gt':return v>c.value;case'ge':return v>=c.value;case'lt':return v<c.value;case'le':return v<=c.value;default:return false;}};
export function createStateMachine(project,id){
 validateStateMachines(project);const m=structuredClone(project.stateMachines?.find(m=>m.id===id));if(!m)fail('missing machine '+id);
 const clips=new Map(machineClips(project,m.dimension).map(c=>[c.id,{duration:c.duration,loop:c.loop}])),values=new Map(),layers=new Map();let events=[];
 const state=(layer,id)=>layer.states.find(s=>s.id===id);
 function sample(layer,id,elapsed,weight){const s=state(layer,id);if(!s||s.type!=='animation')return null;const c=clips.get(s.clip),age=elapsed*Math.abs(s.speed),loop=s.playback==='loop'||s.playback==='clip'&&c.loop,t=loop?age%c.duration:Math.min(c.duration,age);return{state:id,clip:s.clip,time:s.speed<0?c.duration-t:t,weight};}
 function eligible(l,r){if(r.state==='exit'||r.blend)return null;return l.transitions.find(t=>t.enabled&&(t.from===r.state||t.from==='any'&&t.to!==r.state)&&t.conditions.every(c=>condition(c,values))&&(t.exitTime===null||r.elapsed*Math.abs(state(l,r.state)?.speed??1)>=(clips.get(state(l,r.state)?.clip)?.duration??1)*t.exitTime));}
 function enter(l,r,t){const from=r.state;r.blend=t.duration?{from,elapsed:r.elapsed,time:0,duration:t.duration,easing:t.easing,id:t.id}:null;r.state=t.to;r.elapsed=0;events.push({type:'transition',layer:l.id,transition:t.id,from,to:t.to},{type:t.to==='exit'?'exit':'state',layer:l.id,state:t.to});}
 function advanceLayer(l,r,dt){
  // Inputs take effect at the start of this call. Exit-time crossings carry their
  // overshoot into the destination, independent of the caller's frame duration.
  let transitioned=false,t=eligible(l,r);if(t){enter(l,r,t);transitioned=true;}
  const before=r.elapsed;r.elapsed+=dt;
  if(r.blend){r.blend.elapsed+=dt;r.blend.time+=dt;if(r.blend.time>=r.blend.duration)r.blend=null;}
  if(!transitioned&&(t=eligible(l,r))){const s=state(l,r.state),threshold=t.exitTime===null?r.elapsed:(clips.get(s?.clip)?.duration??1)*t.exitTime/Math.abs(s?.speed??1),carry=Math.max(0,Math.min(dt,r.elapsed-Math.max(before,threshold)));r.elapsed-=carry;enter(l,r,t);r.elapsed=carry;if(r.blend){r.blend.elapsed+=carry;r.blend.time=carry;if(carry>=r.blend.duration)r.blend=null;}}
 }
 const api={dimension:m.dimension,definition:structuredClone(m),
  reset(){values.clear();for(const i of m.inputs)values.set(i.id,i.type==='trigger'?false:i.value);layers.clear();events=[];for(const l of m.layers){layers.set(l.id,{state:l.entry,elapsed:0,blend:null});if(l.enabled)events.push({type:'state',layer:l.id,state:l.entry});}return api.snapshot();},
  setInput(id,value){const i=m.inputs.find(i=>i.id===id);if(!i||i.type==='trigger'||(i.type==='number'?!finite(value,-1e9,1e9):typeof value!=='boolean'))fail('invalid input value '+id);values.set(id,value);return api;},
  fire(id){if(!m.inputs.some(i=>i.id===id&&i.type==='trigger'))fail('not a trigger '+id);values.set(id,true);return api;},
  advance(dt=0){if(!finite(dt,0,60))fail('delta must be between 0 and 60 seconds');events=[];for(const l of m.layers)if(l.enabled)advanceLayer(l,layers.get(l.id),dt);for(const i of m.inputs)if(i.type==='trigger')values.set(i.id,false);return api.snapshot();},
  snapshot(){return{machine:m.id,dimension:m.dimension,inputs:Object.fromEntries(values),events:structuredClone(events),layers:m.layers.filter(l=>l.enabled).map(l=>{const r=layers.get(l.id),b=r.blend,u=b?Math.min(1,b.time/b.duration):1,w=b?.easing==='smooth'?u*u*(3-2*u):u;return{id:l.id,name:l.name,state:r.state,elapsed:r.elapsed,transition:b?.id??null,samples:[b?sample(l,b.from,b.elapsed,1-w):null,sample(l,r.state,r.elapsed,w)].filter(Boolean)};})};}
 };api.reset();return api;
}
// Sparse property blending: later layers override only properties they animate.
// Missing properties in a crossfade interpolate from/to the underlying layer.
export function blendMachineLayers(frame,sample,rest){
 const result=new Map();
 for(const layer of frame.layers){const samples=layer.samples.map(s=>({weight:s.weight,values:new Map(sample(s).map(v=>[v.node+':'+v.channel,v]))})),keys=new Set(samples.flatMap(s=>[...s.values.keys()]));
  for(const key of keys){const example=samples.find(s=>s.values.has(key)).values.get(key),base=result.get(key)?.value??rest(example.node,example.channel);if(base===undefined)continue;const sum=samples.reduce((n,s)=>n+(s.values.has(key)?s.weight:0),0),parts=[{value:base,weight:Math.max(0,1-sum)},...samples.filter(s=>s.values.has(key)).map(s=>({value:s.values.get(key).value,weight:s.weight}))];const value=Array.isArray(base)?base.map((_,i)=>parts.reduce((v,p)=>v+p.value[i]*p.weight,0)):parts.reduce((v,p)=>v+p.value*p.weight,0);result.set(key,{node:example.node,channel:example.channel,value});}
 }
 return [...result.values()];
}
