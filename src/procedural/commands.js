import {attachmentInputs} from './attachments.js';
import {emptyProcedural,validateProcedural} from './model.js';
import {addProceduralPrimitive} from './builders.js';
export const PROCEDURAL_COMMANDS=['procedural.impulse','procedural.replace','procedural.settings','procedural.primitive','procedural.particle','procedural.surface','procedural.driver','procedural.remove','procedural.bind','procedural.unbind','procedural.connection','procedural.disconnect','procedural.chain','procedural.gait','procedural.support','procedural.attachment','procedural.detach'];
export function applyProceduralCommand(project,command){
 if(!command.op?.startsWith('procedural.'))return false;
 const before=project.procedural,candidate={joints:project.joints,procedural:structuredClone(before??emptyProcedural())},p=candidate.procedural;
 const update=(array,id,values)=>{const item=array.find(x=>x.id===id||x.particle===id);if(!item)throw Error('Procedural item not found: '+id);Object.assign(item,values);};
 switch(command.op){
  case 'procedural.impulse':p.impulses=(p.impulses??[]).filter(e=>e.id!==command.id);if(!command.remove)p.impulses.push({...structuredClone(command.value),id:command.id});break;
  case 'procedural.replace':candidate.procedural=structuredClone(command.value);break;
  case 'procedural.settings':for(const key of ['gravity','damping','iterations'])if(command.values[key]!==undefined)p[key]=structuredClone(command.values[key]);break;
  case 'procedural.primitive':addProceduralPrimitive(candidate,command.values);break;
  case 'procedural.particle':update(p.particles,command.id,command.values);break;
  case 'procedural.surface':update(p.surfaces,command.id,command.values);break;
  case 'procedural.chain':{const c=p.chains.find(c=>(c.id??c.particles[0])===command.id);if(!c)throw Error('Missing chain');Object.assign(c,structuredClone(command.values));break;}
  case 'procedural.gait':p.gaits=[...(p.gaits??[]).filter(g=>g.id!==command.value.id),structuredClone(command.value)];break;
  case 'procedural.support':p.supports=[...(p.supports??[]).filter(g=>g.id!==command.value.id),structuredClone(command.value)];break;
  case 'procedural.attachment':p.attachments=[...(p.attachments??[]).filter(a=>a.particle!==command.value.particle),structuredClone(command.value)];break;
  case 'procedural.detach':p.attachments=(p.attachments??[]).filter(a=>a.particle!==command.particle);break;
  case 'procedural.driver':update(p.drivers,command.id,command.values);break;
  case 'procedural.bind':p.bindings=[...(p.bindings??[]).filter(b=>b.joint!==command.value.joint),structuredClone(command.value)];break;
  case 'procedural.connection':p.connections=[...(p.connections??[]).filter(c=>c.id!==command.value.id),structuredClone(command.value)];break;
  case 'procedural.disconnect':p.connections=(p.connections??[]).filter(c=>c.id!==command.id);break;
  case 'procedural.unbind':p.bindings=(p.bindings??[]).filter(b=>b.joint!==command.joint);break;
  case 'procedural.remove':{
   const ids=new Set(command.particles??[]);let count;do{count=ids.size;for(const a of p.attachments??[])if(attachmentInputs(a).some(id=>ids.has(id)))ids.add(a.particle);}while(count!==ids.size);p.attachments=(p.attachments??[]).filter(a=>!ids.has(a.particle));p.connections=(p.connections??[]).filter(c=>!ids.has(c.particle)&&c.surface!==command.surface);p.particles=p.particles.filter(n=>!ids.has(n.id));p.impulses=(p.impulses??[]).map(e=>({...e,particles:e.particles.filter(id=>!ids.has(id))})).filter(e=>e.particles.length);
   for(const key of ['distances','bends'])p[key]=p[key].filter(c=>![c.a,c.b,c.c].some(id=>ids.has(id)));
   for(const key of ['areas','rigid','chains'])p[key]=p[key].filter(c=>!c.particles.some(id=>ids.has(id))&&!ids.has(c.target));
   const chains=new Set(p.chains.filter(c=>c.mode==='step').map(c=>c.id??c.particles[0]));p.gaits=(p.gaits??[]).filter(g=>g.id!==command.gait).map(g=>({...g,groups:g.groups.map(group=>group.filter(key=>chains.has(key))).filter(g=>g.length)})).filter(g=>g.groups.length);p.supports=(p.supports??[]).filter(s=>s.id!==command.support&&!s.particles.some(id=>ids.has(id))).map(s=>({...s,feet:s.feet.filter(id=>chains.has(id))})).filter(s=>s.feet.length);
   p.bindings=(p.bindings??[]).filter(b=>!b.particles.some(id=>ids.has(id)));p.drivers=p.drivers.filter(d=>!ids.has(d.particle));p.surfaces=p.surfaces.filter(s=>s.id!==command.surface).map(s=>({...s,shapes:s.shapes.filter(shape=>!shape.particles.some(id=>ids.has(id)))}));break;
  }
  default:throw Error('Unknown procedural command '+command.op);
 }
 validateProcedural(candidate.procedural,project.joints);project.procedural=candidate.procedural;return true;
}
