import {finalChannels,writePath} from './authoring/resolved-channels.js';
import {validateBezier} from './authoring/easing.js';
import {styledJoints} from './authoring/appearance.js';
import {validateLighting,MAX_LIGHTS,LIGHT_CHANNELS,lightPreset} from './scene3d/core/lighting-definition.js';
import {sampleKeys,setPath} from './scene3d/animation.js';
export const lightPreset2D=kind=>{const l=lightPreset(kind);l.range*=100;l.direction=[0,1,0];l.frontOnly=false;return l;};
export function sampleLighting2D(project,clip,time,overrides=[]){const base=styledJoints(project),joints=new Map(base.map(j=>[j.id,j]));for(const t of clip?.lightingTracks??[]){let j=joints.get(t.node);if(j===base.find(n=>n.id===t.node)){j=structuredClone(j);joints.set(t.node,j);}setPath(j,t.channel,sampleKeys(t.keys,time,t.channel.split('.').reduce((o,k)=>o[k],j)));}for(const t of finalChannels(clip,time,overrides))if(t.channel.startsWith('light.')||t.channel.startsWith('coloring.')){const j=joints.get(t.node);if(j){const copy=structuredClone(j);writePath(copy,t.channel,t.value);joints.set(t.node,copy);}}return joints;}
export function validateLighting2D(project){
 if(project.joints.filter(j=>j.light).length>MAX_LIGHTS)throw Error('Maximum 16 puppet lights');for(const j of project.joints)validateLighting(j);
 const e=project.lighting;if(e){if(!Number.isFinite(e.night)||e.night<0||e.night>1||!/^#[a-f0-9]{6}$/i.test(e.lightColor))throw Error('Invalid puppet lighting environment');if(e.nightTint&&(!Array.isArray(e.nightTint)||e.nightTint.length!==3||e.nightTint.some(v=>!Number.isFinite(v)||v<0||v>1)))throw Error('Invalid night tint');}
 for(const clip of project.clips){const tracks=clip.lightingTracks??[],seen=new Set();if(!Array.isArray(tracks)||tracks.length>2048)throw Error('Invalid light animation tracks');for(const t of tracks){const j=project.joints.find(j=>j.id===t.node),id=t.node+':'+t.channel;if(!j||!LIGHT_CHANNELS.includes(t.channel)||!j[t.channel.split('.')[0]]||seen.has(id))throw Error('Invalid light animation binding');seen.add(id);if(!Array.isArray(t.keys)||t.keys.length>10000)throw Error('Invalid light keys');let last=-1;for(const k of t.keys){if(!Number.isFinite(k.time)||k.time<=last||k.time<0||k.time>clip.duration||!['linear','smooth','in','out','back','elastic','step','bezier'].includes(k.easing))throw Error('Invalid light key time/easing');validateBezier(k);last=k.time;const test=structuredClone(j);setPath(test,t.channel,k.value);validateLighting(test);}}}
}
export function applyLightingCommand(project,c,merge){
 if(c.op==='lighting.settings'){project.lighting??={night:0,lightColor:'#f0bf4b'};merge(project.lighting,c.values);return;}
 const joint=project.joints.find(j=>j.id===(c.joint??c.node));if(!joint)throw Error('Missing light joint');
 if(c.op==='lighting.node'){for(const key of Object.keys(c.values))if(!['light','coloring'].includes(key))throw Error('Invalid light property');merge(joint,c.values);return;}
 if(c.op==='lighting.key'){if(!LIGHT_CHANNELS.includes(c.channel))throw Error('Invalid light channel');const clip=project.clips.find(x=>x.id===c.clip);if(!clip)throw Error('Missing light clip');clip.lightingTracks??=[];let track=clip.lightingTracks.find(t=>t.node===joint.id&&t.channel===c.channel);if(!track){track={node:joint.id,channel:c.channel,keys:[]};clip.lightingTracks.push(track);}track.keys=track.keys.filter(k=>Math.abs(k.time-c.time)>1e-6);if(!c.remove)track.keys.push({time:c.time,value:structuredClone(c.value),easing:c.easing??'smooth'});track.keys.sort((a,b)=>a.time-b.time);return;}
 throw Error('Unknown lighting command');
}
