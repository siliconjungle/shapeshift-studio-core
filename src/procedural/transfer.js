import {emptyProcedural,validateProcedural} from './model.js';
import {proceduralComponents,proceduralForJoints} from './sources.js';
import {emptyProcedural3D,validateProcedural3D} from '../procedural3d/model.js';

const copy=x=>structuredClone(x);
export const proceduralLists=dimension=>dimension===3?['chains','gaits','bodies','trackers','movers']:['particles','distances','bends','areas','rigid','chains','drivers','colliders','surfaces','bindings','connections','gaits','supports','attachments','impulses'];
const refs3=c=>[c.root,c.target,...c.segments,...(c.joints??[])];
const clean=s=>String(s).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,45);
const unique=(used,base)=>{let id=base,i=2;while(used.has(id))id=base+'_'+i++;used.add(id);return id;};

/** Durable IDs also identify constraints without user-visible names. */
export function identifyProcedural(p,dimension){
 if(!p)return;
 for(const key of proceduralLists(dimension)){
  const used=new Set((p[key]??[]).map(v=>v.id).filter(Boolean));
  for(const [i,v]of (p[key]??[]).entries())if(!v.id)v.id=unique(used,key==='chains'&&dimension===2?v.particles[0]:key+'_'+i);
 }
}

/** Include the complete connected controller, its inputs and authored hierarchy. */
export function proceduralNodeClosure(p,dimension,nodes,selected,{terrains=p?.terrains}={}){
 const ids=new Set(selected),chains=new Set();
 const components=p&&dimension===2?proceduralComponents(p):null;
 let changed=true;
 while(changed){
  const before=ids.size+chains.size;
  for(const n of nodes){if(ids.has(n.parent))ids.add(n.id);if(ids.has(n.id)&&n.parent)ids.add(n.parent);if(ids.has(n.id)&&n.bodyJoin)ids.add(n.bodyJoin.targetNode);}
  if(p&&dimension===3){
   for(const t of [...(p.trackers??[]),...(p.movers??[])])if(ids.has(t.node))for(const id of [t.target,t.origin].filter(Boolean))ids.add(id);
   for(const c of p.chains)if(chains.has(c.id)||refs3(c).some(id=>ids.has(id))){chains.add(c.id);for(const id of refs3(c))ids.add(id);}
   for(const g of p.gaits)if(g.groups.flat().some(id=>chains.has(id)))for(const id of g.groups.flat())chains.add(id);
   for(const b of p.bodies)if(ids.has(b.node)||b.chains.some(id=>chains.has(id))){ids.add(b.node);for(const id of b.chains)chains.add(id);}
  }else if(components){for(const owners of components.owners.values())if([...owners].some(id=>ids.has(id)))for(const id of owners)ids.add(id);}
  changed=ids.size+chains.size!==before;
 }
 // Terrain is a shared input, not a reason to capture every character using it.
 if(p&&dimension===3&&p.chains.some(c=>chains.has(c.id)&&c.mode==='step')){
  for(const id of terrains){let n=nodes.find(n=>n.id===id);while(n){ids.add(n.id);n=nodes.find(parent=>parent.id===n.parent);}}
 }
 return ids;
}

export function captureProcedural(p,dimension,ids,{includeUnattached=false,owner}={}){
 if(!p)return undefined;
 identifyProcedural(p,dimension);
 if(dimension===2){
  const out=proceduralForJoints(p,ids,{includeUnattached});
  if(!out.particles.length)return undefined;
  // Ownership groups generated-only geometry without attaching it to a pose.
  if(owner){const {root,owners}=proceduralComponents(p);for(const point of out.particles)if(!owners.get(root(point.id))?.size)point.owner=owner;}
  return copy(out);
 }
 const chains=p.chains.filter(c=>refs3(c).every(id=>ids.has(id))),keys=new Set(chains.map(c=>c.id));
 const trackers=(p.trackers??[]).filter(t=>ids.has(t.node)&&ids.has(t.target)&&(!t.origin||ids.has(t.origin)));
 const movers=(p.movers??[]).filter(m=>ids.has(m.node)&&ids.has(m.target));
 if(!chains.length&&!trackers.length&&!movers.length)return undefined;
 return copy({...p,chains,trackers,movers,terrains:chains.some(c=>c.mode==='step')?p.terrains.filter(id=>ids.has(id)):[],gaits:p.gaits.filter(g=>g.groups.flat().every(id=>keys.has(id))),bodies:p.bodies.filter(b=>ids.has(b.node)&&b.chains.every(id=>keys.has(id)))});
}

export function proceduralBindings(p,dimension,destination,prefix){
 const maps={};for(const key of proceduralLists(dimension)){
  const used=new Set((destination?.[key]??[]).map(v=>v.id));maps[key]={};
  for(const [i,v]of (p[key]??[]).entries())maps[key][v.id]=prefix===null?v.id:unique(used,clean(prefix)+'_'+key+'_'+i);
 }return maps;
}

/** Schema-aware reference remapping. Geometry, colours and shader strings stay opaque. */
export function remapProcedural(source,dimension,nodeMap,maps,delta=dimension===3?[0,0,0]:[0,0]){
 const out=copy(source),node=id=>nodeMap[id]??id,ref=(key,id)=>maps[key]?.[id]??id;
 for(const key of proceduralLists(dimension))for(const v of out[key]??[])v.id=ref(key,v.id);
 if(dimension===3){
  out.terrains=out.terrains.map(node);
  for(const t of [...(out.trackers??[]),...(out.movers??[])]){t.node=node(t.node);t.target=node(t.target);if(t.origin)t.origin=node(t.origin);}
  for(const c of out.chains){c.root=node(c.root);c.target=node(c.target);c.segments=c.segments.map(node);if(c.joints)c.joints=c.joints.map(node);}
  for(const g of out.gaits)g.groups=g.groups.map(group=>group.map(id=>ref('chains',id)));
  for(const b of out.bodies){b.node=node(b.node);b.chains=b.chains.map(id=>ref('chains',id));}
  return out;
 }
 const point=id=>ref('particles',id),at=v=>v.map((x,i)=>x+delta[i]);
 for(const p of out.particles){p.position=at(p.position);if(p.joint)p.joint=node(p.joint);if(p.owner)p.owner=node(p.owner);}
 for(const c of out.distances){c.a=point(c.a);c.b=point(c.b);}
 for(const c of out.bends){c.a=point(c.a);c.b=point(c.b);c.c=point(c.c);}
 for(const c of [...out.areas,...out.rigid,...out.chains,...(out.bindings??[]),...(out.supports??[]),...(out.impulses??[])])c.particles=c.particles.map(point);
 const groups=new Map();for(const c of out.chains){c.target=typeof c.target==='string'?point(c.target):at(c.target);if(c.group){if(!groups.has(c.group))groups.set(c.group,c.id);c.group=groups.get(c.group);}}
 for(const a of out.attachments??[]){a.particle=point(a.particle);a.sources=a.sources.map(point);if(a.orient)a.orient=a.orient.map(point);if(a.bend)a.bend.particles=a.bend.particles.map(point);}
 for(const d of out.drivers){d.particle=point(d.particle);d.origin=at(d.origin);}
 for(const c of out.colliders){if(c.type==='segment'){c.a=at(c.a);c.b=at(c.b);}else c.center=at(c.center);}
 for(const s of out.surfaces)for(const shape of s.shapes)shape.particles=shape.particles.map(point);
 for(const b of out.bindings??[]){b.joint=node(b.joint);b.rest=b.rest.map(at);b.bindMatrix[4]+=delta[0];b.bindMatrix[5]+=delta[1];}
 for(const c of out.connections??[]){c.joint=node(c.joint);c.particle=point(c.particle);c.surface=ref('surfaces',c.surface);}
 for(const g of out.gaits??[])g.groups=g.groups.map(group=>group.map(id=>ref('chains',id)));
 for(const s of out.supports??[])s.feet=s.feet.map(id=>ref('chains',id));
 return out;
}

export function appendProcedural(destination,source,dimension){
 const out=destination??(dimension===3?emptyProcedural3D():emptyProcedural());
 if(dimension===2){
  // Imported bodies retain their authored acceleration and drag alongside other rigs.
  for(const p of source.particles){p.gravity??=copy(source.gravity);p.damping??=source.damping;}
  out.iterations=Math.max(out.iterations,source.iterations);
 }
 for(const key of proceduralLists(dimension))(out[key]??=[]).push(...copy(source[key]??[]));
 if(dimension===3)out.terrains=[...new Set([...out.terrains,...source.terrains])];
 return out;
}

export function validateProceduralPacket(p,dimension,nodes){
 if(!p)return;
 (dimension===3?validateProcedural3D:validateProcedural)(p,nodes);
 for(const key of proceduralLists(dimension)){
  const ids=(p[key]??[]).map(v=>v.id);
  if(ids.some(id=>typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(id)||['__proto__','constructor','prototype'].includes(id))||new Set(ids).size!==ids.length)throw Error('Library procedural: missing or duplicate '+key+' IDs');
 }
}
