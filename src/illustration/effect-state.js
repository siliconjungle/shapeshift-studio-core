// Runtime-only property state: ECS adapters and event handlers feed values here.
// The project document remains unchanged. No dependency on an ECS or UI framework.
import {ILLUSTRATION_CHANNELS,illustrationAt} from './tracks.js';
import {blendColor} from './liquid-actions.js';
const safePath=p=>typeof p==='string'&&p.length<=200&&p.split('.').every(k=>/^[\w-]+$/.test(k)&&!['__proto__','prototype','constructor'].includes(k));
const read=(o,path)=>path.split('.').reduce((v,k)=>v&&Object.hasOwn(v,k)?v[k]:undefined,o);
const lerp=(a,b,t)=>typeof a==='string'?blendColor(a,b,t):a+(b-a)*t;
export function validateEffectValue(channel,value){const range=ILLUSTRATION_CHANNELS[channel];if(!Object.hasOwn(ILLUSTRATION_CHANNELS,channel)||(range==='color'?!/^#[\da-f]{6}$/i.test(value):!Number.isFinite(value)||value<range[0]||value>range[1]))throw Error('Invalid illustration effect value: '+channel);}
export function validateEffectBindings(bindings=[],joints=[]){
 if(!Array.isArray(bindings)||bindings.length>512)throw Error('Invalid illustration bindings');const seen=new Set();
 for(const b of bindings){const id=b.joint+':'+b.channel,node=joints.find(j=>j.id===b.joint);if(!node||seen.has(id)||!['data','state'].includes(b.source)||!safePath(b.path)||b.channel.startsWith('liquid.')&&!node.liquid)throw Error('Invalid illustration binding');seen.add(id);if(b.equals!==undefined&&!['string','number','boolean'].includes(typeof b.equals))throw Error('Invalid state comparison');
 if(!Object.hasOwn(ILLUSTRATION_CHANNELS,b.channel))throw Error('Invalid bound property');
 if(b.from!==undefined||b.to!==undefined){validateEffectValue(b.channel,b.from);validateEffectValue(b.channel,b.to);if(!Number.isFinite(b.min??0)||!Number.isFinite(b.max??1)||(b.max??1)<=(b.min??0))throw Error('Invalid binding input range');}
 }
}
export function resolveEffectBindings(bindings=[],data={},states={}){const out=[];for(const b of bindings){let raw=read(b.source==='state'?states:data,b.path);if(raw===undefined)continue;if(b.equals!==undefined)raw=raw===b.equals;let value=raw;if(b.from!==undefined){const n=typeof raw==='boolean'?Number(raw):raw;if(!Number.isFinite(n))continue;const t=Math.max(0,Math.min(1,(n-(b.min??0))/((b.max??1)-(b.min??0))));value=lerp(b.from,b.to,t);}try{validateEffectValue(b.channel,value);}catch{continue;}out.push({joint:b.joint,channel:b.channel,value});}return out;}
export function resolveEffectProperties(base,tracks,joint,prefix,time,values=[]){const out=illustrationAt(base,tracks,joint,prefix,time);for(const v of values)if(v.joint===joint&&v.channel.startsWith(prefix+'.')){validateEffectValue(v.channel,v.value);out[v.channel.slice(prefix.length+1)]=v.value;}return out;}
export function createEffectState(){const values=new Map(),transitions=new Map();let clock=0;
 const key=(joint,channel)=>{if(typeof joint!=='string'||!joint.length)throw Error('Effect needs a joint');return joint+':'+channel;};
 const api={
  set(joint,channel,value){validateEffectValue(channel,value);const id=key(joint,channel);transitions.delete(id);values.set(id,{joint,channel,value});return api;},
  clear(joint,channel){const id=key(joint,channel);transitions.delete(id);values.delete(id);return api;},
  dispatch(event){const {joint,channel,value,duration=.2,easing='smooth',from}=event;validateEffectValue(channel,value);if(from!==undefined)validateEffectValue(channel,from);if(!Number.isFinite(duration)||duration<0||duration>120||!['linear','smooth'].includes(easing))throw Error('Invalid effect transition');const id=key(joint,channel),start=from??values.get(id)?.value;if(start===undefined)throw Error('First effect transition needs a starting value');if(!duration)return api.set(joint,channel,value);values.set(id,{joint,channel,value:start});transitions.set(id,{joint,channel,from:start,to:value,start:clock,duration,easing});return api;},
  advance(dt){if(!Number.isFinite(dt)||dt<0||dt>60)throw Error('Invalid effect delta');clock+=dt;for(const [id,t]of transitions){let u=Math.min(1,(clock-t.start)/t.duration);if(t.easing==='smooth')u=u*u*(3-2*u);values.set(id,{joint:t.joint,channel:t.channel,value:lerp(t.from,t.to,u)});if(clock>=t.start+t.duration)transitions.delete(id);}return api.snapshot();},
  snapshot(){return [...values.values()].map(v=>({...v}));},reset(){values.clear();transitions.clear();clock=0;return api;}
 };return api;
}
