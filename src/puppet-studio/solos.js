// Solo groups select one direct child; that child's complete subtree remains live.
export const SOLO_COMMANDS=['solo.create','solo.wrap','solo.enable','solo.disable','solo.default','solo.key'];
const fail=m=>{throw Error('Solo: '+m);};
export function activeSolo(group,clip,time){let selected=group.solo.activeChild;for(const k of clip?.soloTracks?.find(t=>t.node===group.id)?.keys??[]){if(k.time>time)break;selected=k.value;}return selected;}
export function soloHidden(project,clip,time){
 const children=new Map(),hidden=new Set();for(const j of project.joints){if(!children.has(j.parent))children.set(j.parent,[]);children.get(j.parent).push(j);}
 const hide=j=>{if(hidden.has(j.id))return;hidden.add(j.id);for(const child of children.get(j.id)??[])hide(child);};
 for(const j of project.joints)if(j.solo){const active=activeSolo(j,clip,time);for(const child of children.get(j.id)??[])if(child.id!==active)hide(child);}return hidden;
}
export function soloProject(project,pose){return pose.soloHidden?.size?{...project,joints:project.joints.map(j=>pose.soloHidden.has(j.id)?{...j,hidden:true}:j)}:project;}
export function validateSolos(project){
 const nodes=new Map(project.joints.map(j=>[j.id,j]));
 const valid=(owner,value)=>value===null||typeof value==='string'&&nodes.get(value)?.parent===owner;
 for(const j of project.joints)if(j.solo!==undefined){if(!j.solo||typeof j.solo!=='object'||Array.isArray(j.solo)||j.sprite||!valid(j.id,j.solo.activeChild))fail('a Solo must be a group with a direct child selected (or None)');}
 let count=0;for(const clip of project.clips??[]){const tracks=clip.soloTracks??[],seen=new Set();if(!Array.isArray(tracks)||tracks.length>256)fail('invalid tracks');for(const t of tracks){if(!nodes.get(t.node)?.solo||seen.has(t.node)||!Array.isArray(t.keys))fail('invalid track owner');seen.add(t.node);let last=-1;for(const k of t.keys){if(++count>4096||!Number.isFinite(k.time)||k.time<0||k.time>clip.duration||k.time<=last||k.easing!=='hold'||!valid(t.node,k.value))fail('keys must select direct children and use hold easing inside the clip');last=k.time;}}}return project;
}
export function pruneSolos(project){const nodes=new Map(project.joints.map(j=>[j.id,j])),valid=(id,v)=>nodes.get(v)?.parent===id;for(const j of project.joints)if(j.solo&&!valid(j.id,j.solo.activeChild))j.solo.activeChild=null;for(const c of project.clips??[])if(c.soloTracks){c.soloTracks=c.soloTracks.filter(t=>nodes.get(t.node)?.solo);for(const t of c.soloTracks)for(const k of t.keys)if(!valid(t.node,k.value))k.value=null;}}
export function remapSolos(joints,clips,bindings){for(const j of joints)if(j.solo&&bindings[j.solo.activeChild])j.solo.activeChild=bindings[j.solo.activeChild];for(const c of clips)for(const t of c.soloTracks??[]){t.node=bindings[t.node]??t.node;for(const k of t.keys)k.value=bindings[k.value]??k.value;}}
export function applySoloCommand(project,c){
 if(c.dimension!==undefined&&c.dimension!==2)fail('author Solo groups in a 2D rig');const p={...project,joints:structuredClone(project.joints),clips:structuredClone(project.clips)},nodes=new Map(p.joints.map(j=>[j.id,j]));let node=nodes.get(c.node),id=c.node;
 if(c.op==='solo.create'||c.op==='solo.wrap'){
  const ids=c.op==='solo.wrap'?c.children:[];if(!Array.isArray(ids)||c.op==='solo.wrap'&&!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!nodes.has(id)))fail('choose sibling pieces to wrap');
  const parent=ids.length?nodes.get(ids[0]).parent:c.parent??null;if(parent!==null&&!nodes.has(parent)||ids.some(id=>nodes.get(id).parent!==parent))fail('pieces must share a parent');
  id=c.id??'solo';if(c.id&&nodes.has(id))fail('duplicate group ID');if(!c.id){let n=2;while(nodes.has(id))id='solo-'+n++;}if(!/^[a-zA-Z0-9_.-]{1,80}$/.test(id)||id in Object.prototype||p.joints.length>=256)fail('invalid group ID or joint limit');
  node={id,name:c.name??'Solo',parent,layer:0,rest:{x:0,y:0,rotation:0,scaleX:1,scaleY:1},solo:{activeChild:ids[0]??null}};p.joints.push(node);
  // Identity insertion preserves all existing local animation and world transforms.
  for(const child of ids)nodes.get(child).parent=id;
  // Wrapping the selected branch of another Solo preserves its selection/keys.
  const owner=nodes.get(parent);if(owner?.solo&&ids.includes(owner.solo.activeChild)){node.solo.activeChild=owner.solo.activeChild;owner.solo.activeChild=id;}
  for(const clip of p.clips){const t=clip.soloTracks?.find(t=>t.node===parent);if(t){const keys=t.keys.filter(k=>ids.includes(k.value)).map(k=>({...k}));if(keys.length)clip.soloTracks.push({node:id,keys});for(const k of t.keys)if(ids.includes(k.value))k.value=id;}}
 }else{if(!node)fail('missing group');if(c.op==='solo.enable'){if(node.sprite)fail('select a group without artwork');node.solo??={activeChild:p.joints.find(j=>j.parent===id)?.id??null};}
  else if(!node.solo)fail('select a Solo group');
  else if(c.op==='solo.disable'){delete node.solo;pruneSolos(p);}
  else if(c.op==='solo.default')node.solo.activeChild=c.child??null;
  else if(c.op==='solo.key'){const clip=p.clips.find(v=>v.id===c.clip);if(!clip)fail('choose a clip');clip.soloTracks??=[];let t=clip.soloTracks.find(t=>t.node===id);if(!t){t={node:id,keys:[]};clip.soloTracks.push(t);}t.keys=t.keys.filter(k=>Math.abs(k.time-c.time)>1e-6);if(!c.remove)t.keys.push({time:c.time,value:c.child??null,easing:'hold'});t.keys.sort((a,b)=>a.time-b.time);if(!t.keys.length)clip.soloTracks=clip.soloTracks.filter(v=>v!==t);}
  else fail('unknown command');}
 validateSolos(p);project.joints=p.joints;project.clips=p.clips;return id;
}
