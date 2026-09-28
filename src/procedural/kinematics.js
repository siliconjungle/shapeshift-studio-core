import {attachmentInputs} from './attachments.js';
/** Order chains by root/target dependencies, including weighted attachment paths. */
export function orderChains(definition){
 const chains=definition.chains,attachments=new Map((definition.attachments??[]).map(a=>[a.particle,a])),writers=new Map();
 chains.forEach((c,i)=>{for(const id of c.particles.slice(c.mode==='follow'?0:1)){if(writers.has(id))throw Error('Procedural: point has multiple chain outputs');writers.set(id,i);}});
 const inputs=(id,seen=new Set())=>{if(!id||seen.has(id))return seen;seen.add(id);const a=attachments.get(id);if(a)for(const ref of attachmentInputs(a))inputs(ref,seen);return seen;};
 const done=new Set(),visiting=new Set(),ordered=[];
 function visit(index){
  if(done.has(index))return;if(visiting.has(index))throw Error('Procedural: chain dependency cycle');visiting.add(index);
  const c=chains[index],refs=new Set();if(c.mode!=='follow')for(const id of inputs(c.particles[0]))refs.add(id);if(typeof c.target==='string')for(const id of inputs(c.target))refs.add(id);
  for(const id of refs)if(writers.has(id))visit(writers.get(id));
  visiting.delete(index);done.add(index);ordered.push(index);
 }
 chains.forEach((_,i)=>visit(i));return ordered;
}
