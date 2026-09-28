import {attachmentInputs} from './attachments.js';
/** Keep whole connected simulations when extracting a linked puppet source.
 * A cross-source connection is an authoring error, never a dangling reference.
 */
export function proceduralComponents(definition){
 const parent=new Map(definition.particles.map(p=>[p.id,p.id]));
 const root=id=>{let at=id;while(parent.get(at)!==at)at=parent.get(at);return at;};
 const connect=ids=>{for(const id of ids.slice(1))parent.set(root(id),root(ids[0]));};
 for(const c of definition.distances)connect([c.a,c.b]);
 for(const c of definition.bends)connect([c.a,c.b,c.c]);
 for(const c of [...definition.areas,...definition.rigid,...definition.chains])connect([...c.particles,...(typeof c.target==='string'?[c.target]:[])]);
 for(const b of definition.bindings??[])connect(b.particles);
 for(const a of definition.attachments??[])connect([a.particle,...attachmentInputs(a)]);
 for(const s of definition.surfaces)connect(s.shapes.flatMap(x=>x.particles));
 const byChain=new Map(definition.chains.map(c=>[c.id??c.particles[0],c]));
 for(const g of definition.gaits??[])connect(g.groups.flat().map(key=>byChain.get(key).particles[0]));
 for(const s of definition.supports??[])connect([...s.particles,...s.feet.map(key=>byChain.get(key).particles[0])]);
 const owners=new Map();
 const own=(particle,joint)=>{const id=root(particle);if(!owners.has(id))owners.set(id,new Set());owners.get(id).add(joint);};
 for(const p of definition.particles)if(p.joint)own(p.id,p.joint);
 for(const b of definition.bindings??[])own(b.particles[0],b.joint);
 for(const c of definition.connections??[]){const surface=definition.surfaces.find(s=>s.id===c.surface);connect([c.particle,...surface.shapes.flatMap(s=>s.particles)]);}
 // Connections link a sprite to the complete generated surface. Rebuild ownership after joining components.
 owners.clear();for(const p of definition.particles){if(p.joint)own(p.id,p.joint);if(p.owner)own(p.id,p.owner);}for(const b of definition.bindings??[])own(b.particles[0],b.joint);for(const c of definition.connections??[])own(c.particle,c.joint);
 return {root,owners};
}
export function proceduralForJoints(definition,jointIds,{includeUnattached=false}={}){
 if(!definition)return undefined;
 const {root,owners}=proceduralComponents(definition);
 const ids=new Set();for(const p of definition.particles){const refs=owners.get(root(p.id))??new Set(),selected=[...refs].filter(id=>jointIds.has(id));if(selected.length&&selected.length!==refs.size)throw Error('Procedural connection crosses linked puppet sources');if(selected.length||(!refs.size&&includeUnattached))ids.add(p.id);}
 const has=id=>ids.has(id),all=c=>c.particles.every(has);
 const retainedChains=new Set(definition.chains.filter(all).map(c=>c.id??c.particles[0]));
 return {...definition,...(definition.impulses?{impulses:definition.impulses.map(e=>({...e,particles:e.particles.filter(has)})).filter(e=>e.particles.length)}:{}),...(definition.attachments?{attachments:definition.attachments.filter(a=>has(a.particle)&&attachmentInputs(a).every(has))}:{}),...(definition.gaits?{gaits:definition.gaits.filter(g=>g.groups.flat().every(id=>retainedChains.has(id)))}:{}),...(definition.supports?{supports:definition.supports.filter(s=>all(s)&&s.feet.every(id=>retainedChains.has(id)))}:{}),...(definition.connections?{connections:definition.connections.filter(c=>jointIds.has(c.joint)&&has(c.particle))}:{}),particles:definition.particles.filter(p=>has(p.id)),distances:definition.distances.filter(c=>has(c.a)&&has(c.b)),bends:definition.bends.filter(c=>has(c.a)&&has(c.b)&&has(c.c)),areas:definition.areas.filter(all),rigid:definition.rigid.filter(all),chains:definition.chains.filter(all),drivers:definition.drivers.filter(d=>has(d.particle)),surfaces:definition.surfaces.filter(s=>s.shapes.every(all)),bindings:(definition.bindings??[]).filter(b=>jointIds.has(b.joint)&&all(b))};
}
