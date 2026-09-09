import {validateEntityLibrary,readEntityPacket} from './definitions.js';
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
export const ENTITY_COMMANDS=['entity.init','entity.create','entity.duplicate','entity.rename','entity.remove','entity.assign','entity.detach','entity.values','entity.import','component.define','component.remove'];
export function applyEntityCommand(project,c){
 const l=structuredClone(project.entityDefinitions??{version:1,components:[],entities:[]});
 const entity=()=>{const e=l.entities.find(e=>e.id===c.id);if(!e)throw Error('Unknown entity '+c.id);return e};
 if(c.op==='entity.import'){const incoming=readEntityPacket(c.value);if(c.mode===undefined||c.mode==='replace'){project.entityDefinitions=incoming;return}if(c.mode!=='merge')throw Error('Choose merge or replace');for(const key of ['components','entities'])for(const row of incoming[key]){const old=l[key].find(d=>d.id===row.id);if(old&&JSON.stringify(canonical(old))!==JSON.stringify(canonical(row)))throw Error('Conflicting '+key+' ID: '+row.id+'. Rename it or choose Replace library.');if(!old)l[key].push(row)}validateEntityLibrary(l);project.entityDefinitions=l;return}
 if(c.op==='entity.create'){if(l.entities.some(e=>e.id===c.id))throw Error('Entity ID already exists');l.entities.push({id:c.id,name:c.name??c.id,components:{}})}
 else if(c.op==='entity.duplicate'){const e=structuredClone(entity());if(l.entities.some(e=>e.id===c.newId))throw Error('Entity ID already exists');e.id=c.newId;e.name=c.name??e.name+' copy';l.entities.push(e)}
 else if(c.op==='entity.rename')entity().name=c.name;
 else if(c.op==='entity.remove'){entity();l.entities=l.entities.filter(e=>e.id!==c.id)}
 else if(c.op==='entity.assign'){const e=entity(),d=l.components.find(d=>d.id===c.component);if(!d)throw Error('Unknown component');if(Object.hasOwn(e.components,c.component))throw Error('Component already assigned');Object.defineProperty(e.components,c.component,{value:structuredClone(d.defaults),enumerable:true,writable:true,configurable:true})}
 else if(c.op==='entity.detach'){const e=entity();if(!Object.hasOwn(e.components,c.component))throw Error('Component not assigned');delete e.components[c.component]}
 else if(c.op==='entity.values'){const e=entity();if(!Object.hasOwn(e.components,c.component))throw Error('Component not assigned');e.components[c.component]=structuredClone(c.value)}
 else if(c.op==='component.define'){const i=l.components.findIndex(d=>d.id===c.value.id);if(i<0)l.components.push(structuredClone(c.value));else l.components[i]=structuredClone(c.value)}
 else if(c.op==='component.remove'){if(l.entities.some(e=>Object.hasOwn(e.components,c.id)))throw Error('Detach this component from entities before removing it');if(!l.components.some(d=>d.id===c.id))throw Error('Unknown component');l.components=l.components.filter(d=>d.id!==c.id)}
 else if(c.op!=='entity.init')throw Error('Unknown entity command '+c.op);
 validateEntityLibrary(l);project.entityDefinitions=l;return c.newId??c.id??c.value?.id;
}
