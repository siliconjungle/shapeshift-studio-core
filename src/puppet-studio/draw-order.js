export const DRAW_ORDER_COMMANDS=['drawOrder.add','drawOrder.update','drawOrder.remove','drawOrder.default','drawOrder.key'];
const fail=m=>{throw Error('Draw order: '+m);},copy=v=>structuredClone(v);
export function drawOrderMembers(project,node){const ids=new Set([node]);let changed=true;while(changed){changed=false;for(const j of project.joints)if(ids.has(j.parent)&&!ids.has(j.id)){ids.add(j.id);changed=true;}}return ids;}
export function activeDrawOrder(entry,clip,time){let rule=entry.rule??null;for(const k of clip?.drawOrderTracks?.find(t=>t.node===entry.node)?.keys??[]){if(k.time>time)break;rule=k.value;}return rule;}
export function resolvedDrawOrder(project,clip,time){
 let order=project.joints.filter(j=>j.sprite).sort((a,b)=>a.layer-b.layer).map(j=>j.id);
 const active=(project.drawOrder??[]).map(e=>({...e,current:e.rules.find(r=>r.id===activeDrawOrder(e,clip,time)),members:drawOrderMembers(project,e.node)})).filter(e=>e.current),done=new Set(),visiting=new Set();
 function apply(e){if(done.has(e.node))return;if(visiting.has(e.node))fail('active rules form a dependency cycle');visiting.add(e.node);
  for(const other of active)if(other!==e&&(e.members.has(other.node)||other.members.has(e.current.target)&&!other.members.has(e.node)))apply(other);
  const moved=order.filter(id=>e.members.has(id));order=order.filter(id=>!e.members.has(id));const at=order.indexOf(e.current.target);if(at<0)fail('target must be a drawable outside the moved group');order.splice(at+(e.current.placement==='above'?1:0),0,...moved);visiting.delete(e.node);done.add(e.node);
 }
 for(const e of active)apply(e);
 for(const e of active){const target=order.indexOf(e.current.target);if(order.some((id,i)=>e.members.has(id)&&(e.current.placement==='above'?i<target:i>target)))fail('active group rules conflict');}
 return order;
}
export function drawOrderLayers(project,clip,time){
 if(!project.drawOrder?.some(e=>activeDrawOrder(e,clip,time)!==null))return null;
 const slots=project.joints.filter(j=>j.sprite).sort((a,b)=>a.layer-b.layer).map(j=>j.layer);
 // Break equal-layer ties without crossing the next authored layer slot.
 for(let i=0;i<slots.length;){let end=i+1;while(end<slots.length&&slots[end]===slots[i])end++;const step=Math.min(.001,((slots[end]??slots[i]+1)-slots[i])/(end-i+1));for(let n=end-1;n>i;n--)slots[n]+=step*(n-i);i=end;}
 return new Map(resolvedDrawOrder(project,clip,time).map((id,i)=>[id,slots[i]]));
}
export function validateDrawOrder(project){
 const entries=project.drawOrder??[],nodes=new Map(project.joints.map(j=>[j.id,j])),owners=new Set();if(!Array.isArray(entries)||entries.length>256)fail('maximum 256 owners');
 for(const e of entries){if(!e||!nodes.has(e.node)||owners.has(e.node)||!Array.isArray(e.rules)||e.rules.length>32)fail('invalid owner or rules');owners.add(e.node);const ids=new Set(),members=drawOrderMembers(project,e.node);
  for(const r of e.rules){if(!r||typeof r.id!=='string'||!(/^[\w-]{1,100}$/).test(r.id)||['constructor','prototype','__proto__'].includes(r.id)||ids.has(r.id))fail('unique rule IDs required');ids.add(r.id);if(typeof r.name!=='string'||r.name.length>100||!nodes.get(r.target)?.sprite||members.has(r.target)||!['above','below'].includes(r.placement))fail('choose a drawable target outside the owner’s group');}
  if(e.rule!==null&&!ids.has(e.rule))fail('invalid default rule');
 }
 resolvedDrawOrder(project,null,0);let count=0;
 for(const clip of project.clips??[]){const tracks=clip.drawOrderTracks??[],seen=new Set(),times=new Set([0]);if(!Array.isArray(tracks)||tracks.length>256)fail('invalid animation tracks');for(const t of tracks){const e=entries.find(e=>e.node===t.node);if(!e||seen.has(t.node)||!Array.isArray(t.keys))fail('invalid track owner');seen.add(t.node);let previous=-1;for(const k of t.keys){if(++count>4096)fail('maximum 4096 draw-order keys');if(!Number.isFinite(k.time)||k.time<0||k.time>clip.duration||k.time<=previous||k.easing!=='hold'||k.value!==null&&!e.rules.some(r=>r.id===k.value))fail('invalid held rule key');previous=k.time;times.add(k.time);}}
  for(const time of times)resolvedDrawOrder(project,clip,time);
 }return project;
}
export function pruneDrawOrder(project){
 const nodes=new Set(project.joints.map(j=>j.id));if(project.drawOrder)project.drawOrder=project.drawOrder.filter(e=>nodes.has(e.node));for(const e of project.drawOrder??[]){e.rules=e.rules.filter(r=>nodes.has(r.target));if(!e.rules.some(r=>r.id===e.rule))e.rule=null;}
 for(const clip of project.clips??[])if(clip.drawOrderTracks){clip.drawOrderTracks=clip.drawOrderTracks.filter(t=>(project.drawOrder??[]).some(e=>e.node===t.node));for(const t of clip.drawOrderTracks){const e=project.drawOrder.find(e=>e.node===t.node);for(const k of t.keys)if(!e.rules.some(r=>r.id===k.value))k.value=null;}}
}
export function remapDrawOrder(entries,bindings){return entries.map(e=>({...copy(e),node:bindings[e.node]??e.node,rules:e.rules.map(r=>({...r,target:bindings[r.target]??r.target}))}));}
export function applyDrawOrderCommand(project,c){
 if(c.dimension!==undefined&&c.dimension!==2)fail('draw-order rules belong to 2D rigs');const p={...project,drawOrder:copy(project.drawOrder??[]),clips:copy(project.clips)};let e=p.drawOrder.find(e=>e.node===c.node),id=c.id;
 if(c.op==='drawOrder.add'){if(!e){e={node:c.node,rule:null,rules:[]};p.drawOrder.push(e);}if(!id){let n=1;while(e.rules.some(r=>r.id==='rule-'+n))n++;id='rule-'+n;}if(e.rules.some(r=>r.id===id))fail('duplicate rule ID');e.rules.push({id,name:c.name??(c.placement==='below'?'Below':'Above')+' '+(project.joints.find(j=>j.id===c.target)?.name??c.target),target:c.target,placement:c.placement??'above'});}
 else if(!e)fail('create a rule for this owner first');
 else if(c.op==='drawOrder.update'){const r=e.rules.find(r=>r.id===id);if(!r)fail('missing rule');for(const k of Object.keys(c.values??{}))if(!['name','target','placement'].includes(k))fail('unknown property');Object.assign(r,copy(c.values));}
 else if(c.op==='drawOrder.remove'){if(!e.rules.some(r=>r.id===id))fail('missing rule');e.rules=e.rules.filter(r=>r.id!==id);pruneDrawOrder(p);}
 else if(c.op==='drawOrder.default')e.rule=c.rule??null;
 else if(c.op==='drawOrder.key'){const clip=p.clips.find(x=>x.id===c.clip);if(!clip)fail('choose a clip');clip.drawOrderTracks??=[];let track=clip.drawOrderTracks.find(t=>t.node===c.node);if(!track){track={node:c.node,keys:[]};clip.drawOrderTracks.push(track);}track.keys=track.keys.filter(k=>Math.abs(k.time-c.time)>1e-6);if(!c.remove)track.keys.push({time:c.time,value:c.rule??null,easing:'hold'});track.keys.sort((a,b)=>a.time-b.time);if(!track.keys.length)clip.drawOrderTracks=clip.drawOrderTracks.filter(t=>t!==track);}
 else fail('unknown command');validateDrawOrder(p);project.drawOrder=p.drawOrder;project.clips=p.clips;return id??c.node;
}
