import {CHANNELS,identity,sampleTrack,clamp,inverse,point} from './joint-transforms.js';
import {easeNames} from './fx/math.js';
import {validateBezier} from './authoring/easing.js';
import {sampleResolvedKeys} from './authoring/resolved-channels.js';
import {sampleKeys as sampleLight} from './scene3d/animation.js';
import {sampleKeys as sampleIllustration} from './vector/model.js';
export const JOYSTICK_COMMANDS=['joystick.create','joystick.configure','joystick.default','joystick.key','joystick.remove'];
const fail=m=>{throw Error('Joystick: '+m);},copy=v=>structuredClone(v),pair=(v,min,max)=>Array.isArray(v)&&v.length===2&&v.every(n=>Number.isFinite(n)&&n>=min&&n<=max);
export const sourceClipIds=p=>new Set(p.joints.flatMap(j=>Object.values(j.joystick?.axes??{}).filter(Boolean).map(a=>a.clip)));
// Transform keys store complete poses. Neutral, untouched components do not claim ownership.
export function joystickChannels(clip){
 const out=[];for(const [node,keys]of Object.entries(clip?.tracks??{}))for(const channel of CHANNELS)if(keys.some(k=>k.value[channel]!==identity()[channel]))out.push({kind:'transform',node,channel,keys,key:node+':'+channel});
 for(const t of clip?.joystickTracks??[])for(const [i,channel]of ['x','y'].entries())if(t.keys.some(k=>k.value[i]!==0))out.push({kind:'joystick',node:t.node,channel,index:i,keys:t.keys,key:t.node+':joystick.'+channel});
 for(const kind of ['meshTracks','soloTracks','drawOrderTracks','constraintWeights','constraintTracks','lightingTracks','illustrationTracks','resolvedTracks'])for(const t of clip?.[kind]??[])if(t.keys.length&&t.enabled!==false){const node=t.node??t.joint??t.constraint,channel=t.channel??kind;out.push({kind,node,channel,track:t,keys:t.keys,key:node+':'+channel});}return out;
}
function drivers(p){const clips=new Map(p.clips.map(c=>[c.id,c]));return p.joints.filter(j=>j.joystick).flatMap(j=>Object.entries(j.joystick.axes).filter(([,a])=>a).map(([axis,a])=>({joint:j,axis,binding:a,channels:joystickChannels(clips.get(a.clip))})));}
function order(p,ds){const controls=p.joints.filter(j=>j.joystick),done=new Set(),visiting=new Set(),out=[];function visit(j){if(done.has(j.id))return;if(visiting.has(j.id))fail('controls form a cycle');visiting.add(j.id);for(const d of ds)if(d.channels.some(c=>c.kind==='joystick'&&c.node===j.id))visit(d.joint);visiting.delete(j.id);done.add(j.id);out.push(j);}for(const j of controls)visit(j);return out;}
export function validateJoysticks(p){
 const nodes=new Map(p.joints.map(j=>[j.id,j])),clips=new Map(p.clips.map(c=>[c.id,c])),controls=p.joints.filter(j=>j.joystick!==undefined);if(controls.length>32)fail('maximum 32 controls');
 for(const j of controls){const v=j.joystick;if(!v||j.sprite||!pair(v.handle,-1,1)||!pair(v.size,16,2000)||typeof v.worldSpace!=='boolean'||!v.axes||typeof v.axes!=='object'||Array.isArray(v.axes))fail('invalid control geometry or handle');
  if(v.handleSource!==null&&v.handleSource!==undefined&&(!nodes.has(v.handleSource)||v.handleSource===j.id))fail('choose another object as handle source');
  for(const [axis,a]of Object.entries(v.axes)){if(!['x','y'].includes(axis))fail('unknown axis');if(a===null)continue;if(!a||!clips.has(a.clip)||typeof a.invert!=='boolean')fail('choose an existing source timeline');const c=clips.get(a.clip);if(c.effects?.some(e=>e.enabled!==false)||Object.keys(c.ik??{}).length||Object.values(c.tools??{}).some(v=>Array.isArray(v)&&v.length))fail('source timelines must use property keys; bake motion effects, IK and pose tools first');}
 }
 let count=0;for(const c of p.clips){const tracks=c.joystickTracks??[],seen=new Set();if(!Array.isArray(tracks)||tracks.length>32)fail('invalid handle tracks');for(const t of tracks){if(!nodes.get(t.node)?.joystick||seen.has(t.node)||!Array.isArray(t.keys))fail('invalid handle track owner');seen.add(t.node);let last=-1;for(const k of t.keys){if(++count>8192||!Number.isFinite(k.time)||k.time<0||k.time>c.duration||k.time<=last||!pair(k.value,-1,1)||!easeNames.includes(k.easing))fail('invalid handle key');validateBezier(k);last=k.time;}}}
 const ds=drivers(p),owners=new Map();order(p,ds);
 for(const d of ds)for(const c of d.channels){if(owners.has(c.key)&&owners.get(c.key)!==d)fail('conflicting property '+c.key+'; separate the channels in your axis timelines');owners.set(c.key,d);}
 const sourceIds=sourceClipIds(p);for(const clip of p.clips)if(!sourceIds.has(clip.id))for(const c of joystickChannels(clip))if(owners.has(c.key))fail(c.key+' is driven by a joystick; edit its source timeline instead');
 for(const j of controls){const v=j.joystick;if(!v.handleSource)continue;const dependencies=new Set();for(const id of [j.id,v.handleSource]){let n=nodes.get(id);while(n&&!dependencies.has(n.id)){dependencies.add(n.id);n=nodes.get(n.parent);}}
  for(const d of ds)for(const c of d.channels)if(dependencies.has(c.node)&&(c.kind==='transform'||c.kind==='resolvedTracks'&&CHANNELS.includes(c.channel)))fail('handle source and control placement cannot depend on joystick-driven transforms');
  if(ds.some(d=>d.channels.some(c=>c.kind==='joystick'&&c.node===j.id)))fail('a sourced handle cannot also be driven by another joystick');
 }return p;
}
export function joystickHandle(j,clip,time){const keys=clip?.joystickTracks?.find(t=>t.node===j.id)?.keys;return (keys?.length?sampleResolvedKeys(keys,time):j.joystick.handle).map(v=>clamp(v,-1,1));}
export function resolveJoysticks(project,clip,time,sourcePose){
 const controls=project.joints.filter(j=>j.joystick),handles=new Map(controls.map(j=>[j.id,joystickHandle(j,clip,time)])),owners=new Map();
 // Source timelines are edited directly; their keys must not drive themselves.
 if(!controls.length||sourceClipIds(project).has(clip?.id))return{clip,handles,owners,editingSource:true};
 const ds=drivers(project),clips=new Map(project.clips.map(c=>[c.id,c])),out={...(clip??{id:'joystick-rest',duration:120,fps:30,loop:false}),tracks:{...(clip?.tracks??{})}};
 const key=value=>[{time,value:copy(value),easing:'hold'}];
 for(const j of order(project,ds)){
  const v=j.joystick;let handle=[...handles.get(j.id)];if(v.handleSource&&sourcePose){const target=sourcePose.get(v.handleSource),local=point(inverse(sourcePose.get(j.id).world),{x:target.world[4],y:target.world[5]});handle=[clamp(local.x/(v.size[0]/2),-1,1),clamp(local.y/(v.size[1]/2),-1,1)];}
  if(!v.axes.x)handle[0]=0;if(!v.axes.y)handle[1]=0;handles.set(j.id,handle);
  for(const d of ds.filter(d=>d.joint===j)){const source=clips.get(d.binding.clip),i=d.axis==='x'?0:1,t=(1+(d.binding.invert?-1:1)*handle[i])/2*source.duration;
   for(const c of d.channels){owners.set(c.key,{node:j.id,axis:d.axis,clip:source.id,time:t});if(c.kind==='resolvedTracks'&&(t<c.track.start||t>c.track.end||t===c.track.end&&!c.track.inclusiveEnd&&c.track.end!==source.duration))continue;
    if(c.kind==='transform'){const value=sampleTrack(out.tracks[c.node],time);value[c.channel]=sampleTrack(c.keys,t)[c.channel];out.tracks[c.node]=key(value);continue;}
    if(c.kind==='joystick'){handles.get(c.node)[c.index]=clamp(sampleResolvedKeys(c.keys,t)[c.index],-1,1);continue;}
    let value;if(c.kind==='soloTracks'||c.kind==='drawOrderTracks'){const n=project.joints.find(j=>j.id===c.node);value=c.kind==='soloTracks'?n.solo.activeChild:project.drawOrder.find(e=>e.node===c.node).rule;for(const k of c.keys){if(k.time>t)break;value=k.value;}}
    else if(c.kind==='lightingTracks')value=sampleLight(c.keys,t);
    else if(c.kind==='illustrationTracks')value=sampleIllustration(c.keys,t);
    else if(typeof c.keys[0].value==='boolean'){value=c.keys[0].value;for(const k of c.keys){if(k.time>t)break;value=k.value;}}else value=sampleResolvedKeys(c.keys,t);
    const list=out[c.kind]??clip?.[c.kind]??[],same=track=>(track.node??track.joint??track.constraint)===c.node&&(track.channel??c.kind)===c.channel;
    out[c.kind]=[...list.filter(track=>!same(track)),{...c.track,keys:key(value),...(c.kind==='resolvedTracks'?{start:0,end:out.duration,inclusiveEnd:true}:{})}];
   }
  }
 }return{clip:out,handles,owners,editingSource:false};
}
export function pruneJoysticks(p){const ids=new Set(p.joints.map(j=>j.id)),clips=new Set(p.clips.map(c=>c.id));for(const j of p.joints)if(j.joystick){if(!ids.has(j.joystick.handleSource))j.joystick.handleSource=null;for(const axis of ['x','y'])if(!clips.has(j.joystick.axes[axis]?.clip))j.joystick.axes[axis]=null;}for(const c of p.clips)if(c.joystickTracks)c.joystickTracks=c.joystickTracks.filter(t=>p.joints.some(j=>j.id===t.node&&j.joystick));}
export function remapJoysticks(joints,clips,nodes={},animations={}){for(const j of joints)if(j.joystick){const v=j.joystick;v.handleSource=nodes[v.handleSource]??v.handleSource;for(const a of Object.values(v.axes))if(a)a.clip=animations[a.clip]??a.clip;}for(const c of clips)for(const t of c.joystickTracks??[])t.node=nodes[t.node]??t.node;}
export function applyJoystickCommand(project,c){
 if(c.dimension!==undefined&&c.dimension!==2)fail('author joysticks in a 2D rig');const p={...project,joints:copy(project.joints),clips:copy(project.clips)};let node=p.joints.find(j=>j.id===c.node),id=c.node;
 if(c.op==='joystick.create'){id=c.id??'joystick';if(c.id&&p.joints.some(j=>j.id===id))fail('duplicate ID');if(!c.id){let n=2;while(p.joints.some(j=>j.id===id))id='joystick-'+n++;}if(!/^[a-zA-Z0-9_.-]{1,80}$/.test(id)||id in Object.prototype||p.joints.length>=256)fail('invalid ID or joint limit');if(c.parent&&!p.joints.some(j=>j.id===c.parent))fail('missing parent');if(c.position!==undefined&&!pair(c.position,-100000,100000))fail('invalid position');node={id,name:c.name??'Joystick',parent:c.parent??null,layer:0,rest:{...identity(),x:c.position?.[0]??0,y:c.position?.[1]??0},joystick:{handle:[0,0],size:[160,160],worldSpace:true,handleSource:null,axes:{x:null,y:null}}};p.joints.push(node);}
 else if(!node?.joystick)fail('select a joystick');
 else if(c.op==='joystick.configure'){for(const k of Object.keys(c.values??{}))if(!['size','worldSpace','handleSource','axes'].includes(k))fail('unknown setting');Object.assign(node.joystick,copy(c.values));}
 else if(c.op==='joystick.default')node.joystick.handle=copy(c.value);
 else if(c.op==='joystick.remove'){delete node.joystick;pruneJoysticks(p);}
 else if(c.op==='joystick.key'){const clip=p.clips.find(x=>x.id===c.clip);if(!clip)fail('choose a clip');clip.joystickTracks??=[];let t=clip.joystickTracks.find(t=>t.node===id);if(!t){t={node:id,keys:[]};clip.joystickTracks.push(t);}t.keys=t.keys.filter(k=>Math.abs(k.time-c.time)>1e-6);if(!c.remove)t.keys.push({time:c.time,value:copy(c.value),easing:c.easing??'smooth'});t.keys.sort((a,b)=>a.time-b.time);if(!t.keys.length)clip.joystickTracks=clip.joystickTracks.filter(v=>v!==t);}
 else fail('unknown command');validateJoysticks(p);project.joints=p.joints;project.clips=p.clips;return id;
}
