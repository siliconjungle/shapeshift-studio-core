import {constraintOrder,constraintChannels,constraintStrength,constraintValue} from './model.js';
const safeScale=t=>{t.scale=t.scale.map(v=>Math.abs(v)<1e-6?(v<0?-1:1)*1e-6:v);return t;};
const copy=t=>({position:[...t.position],rotation:[...t.rotation],scale:[...t.scale]}),mix=(a,b,w)=>a.map((v,i)=>v+(b[i]-v)*w);
// Adapters provide TRS in local/world space and conversion through the owner's
// parent matrix. Copy and limits use independent spaces. Distance is world-space.
export function solveConstraints(nodes,constraints,clip,time,adapter){
 constraints=(constraints??[]).map(c=>c.type==='followPath'?{...c,...Object.fromEntries(['distance','orient','ownerOffset'].map(k=>[k,constraintValue(c,clip,time,k)]))}:c);
 const changed=new Set(),authored=new Map();for(const c of constraints??[])if(c.ownerOffset&&!authored.has(c.node))authored.set(c.node,adapter.get(c.node,'local'));
 for(const c of constraintOrder(nodes,constraints??[])){const weight=constraintStrength(c,clip,time);if(!weight)continue;
  if(c.type==='followPath'){if(adapter.followPath(c,weight,time,authored.get(c.node)))changed.add(c.node);continue;}
  if(c.type==='ik'){for(const id of adapter.ik(c,weight))changed.add(id);continue;}
  if(c.type==='distance'){const base=adapter.get(c.node,'world'),target=adapter.get(c.target,'world').position,delta=base.position.map((v,i)=>v-target[i]),length=Math.hypot(...delta);if(c.mode==='closer'&&length<=c.distance||c.mode==='further'&&length>=c.distance)continue;const desired=copy(base),direction=length>1e-10?delta.map(v=>v/length):delta.map((_,i)=>i===0?1:0);desired.position=target.map((v,i)=>v+direction[i]*c.distance);const local=adapter.convert(c.node,desired,'world','local'),old=adapter.get(c.node,'local');local.position=mix(old.position,local.position,weight);adapter.set(c.node,{...old,position:local.position});changed.add(c.node);continue;}
  const old=adapter.get(c.node,'local'),desired=copy(adapter.get(c.node,c.destinationSpace));
  if(c.target){const target=adapter.get(c.target,c.sourceSpace);for(const channel of constraintChannels(c.type)){const p=c.channels[channel];for(let i=0;i<p.axes.length;i++)if(p.axes[i]){let value=target[channel][i]*p.multiplier[i];if(c.ownerOffset)value=channel==='scale'?value*authored.get(c.node)[channel][i]:value+authored.get(c.node)[channel][i];desired[channel][i]=value+p.offset[i];}}}
  const limited=adapter.convert(c.node,safeScale(desired),c.destinationSpace,c.limitSpace);
  for(const channel of constraintChannels(c.type)){const p=c.channels[channel];for(let i=0;i<p.axes.length;i++){// Limits can operate even when copying this axis is disabled.
   if(p.min[i]!==null)limited[channel][i]=Math.max(p.min[i],limited[channel][i]);if(p.max[i]!==null)limited[channel][i]=Math.min(p.max[i],limited[channel][i]);}}
  const local=adapter.convert(c.node,safeScale(limited),c.limitSpace,'local'),result={},affected=constraintChannels(c.type);
  if(affected.includes('rotation')&&[c.sourceSpace,c.destinationSpace,c.limitSpace].includes('world'))local.rotation=local.rotation.map((v,i)=>old.rotation[i]+((v-old.rotation[i]+540)%360+360)%360-180);
  for(const channel of ['position','rotation','scale'])result[channel]=affected.includes(channel)?mix(old[channel],local[channel],weight):old[channel];
  // Preserve invertibility through zero/negative scale crossings.
  result.scale=result.scale.map(v=>Math.abs(v)<1e-6?(v<0?-1:1)*1e-6:v);adapter.set(c.node,result);changed.add(c.node);
 }
 return changed;
}
