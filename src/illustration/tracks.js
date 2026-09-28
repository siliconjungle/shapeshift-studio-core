import {sampleKeys} from '../puppet-studio/vector/model.js';
import {easeNames} from '../puppet-studio/fx/math.js';
export const ILLUSTRATION_CHANNELS={'liquid.fill':[0,1],'liquid.color':'color','liquid.shadow':'color','liquid.highlight':'color','colorShift.amount':[0,1],'colorShift.hue':[-360,360],'colorShift.color':'color'};
export function validateIllustrationTracks(tracks=[],joints=[]){
 if(!Array.isArray(tracks)||tracks.length>1024)throw Error('Invalid illustration tracks');const seen=new Set();
 for(const t of tracks){const node=joints.find(j=>j.id===t.joint),range=ILLUSTRATION_CHANNELS[t.channel],id=t.joint+':'+t.channel;if(!node||!Object.hasOwn(ILLUSTRATION_CHANNELS,t.channel)||seen.has(id))throw Error('Invalid or duplicate illustration target');seen.add(id);
  if(t.channel.startsWith('liquid.')&&!node.liquid)throw Error('Liquid track needs a container');
  if(!Array.isArray(t.keys)||!t.keys.length||t.keys.length>2000)throw Error('Invalid illustration keys');
  t.keys.forEach((k,i)=>{if(!Number.isFinite(k.time)||k.time<0||k.time>120||i&&k.time<=t.keys[i-1].time||k.easing&&!easeNames.includes(k.easing))throw Error('Invalid illustration key timing');if(range==='color'?!/^#[\da-f]{6}$/i.test(k.value):!Number.isFinite(k.value)||k.value<range[0]||k.value>range[1])throw Error('Invalid illustration key value');});
 }
}
export function illustrationAt(base,tracks,joint,prefix,time){const out={...base};for(const t of tracks??[])if(t.joint===joint&&t.channel.startsWith(prefix+'.')){const key=t.channel.slice(prefix.length+1);out[key]=sampleKeys(t.keys,time,base[key]);}return out;}
export function putIllustrationKey(tracks,joint,channel,time,value,easing='smooth'){
 const next=structuredClone(tracks??[]);let track=next.find(t=>t.joint===joint&&t.channel===channel);if(!track)next.push(track={joint,channel,keys:[]});track.keys=track.keys.filter(k=>Math.abs(k.time-time)>1e-6);track.keys.push({time,value,easing});track.keys.sort((a,b)=>a.time-b.time);return next;
}
