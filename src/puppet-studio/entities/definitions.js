import {validateReferenceSpec,referenceDependencies} from '../references/catalog.js';
// Portable, game-independent data contracts. No behaviours, scripts or engine imports.
export const ENTITY_FORMAT='shapeshift-entities';
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const safe=k=>!['__proto__','constructor','prototype'].includes(k);
const fail=m=>{throw new TypeError(m)};
export function jsonData(v,path='data',depth=0,seen=new Set()){
 if(depth>32)fail(path+': nesting exceeds 32');
 if(v===null||typeof v==='boolean'||typeof v==='string')return;
 if(typeof v==='number'){if(!Number.isFinite(v))fail(path+': expected finite number');return}
 if(typeof v!=='object'||seen.has(v)||(!Array.isArray(v)&&Object.getPrototypeOf(v)!==Object.prototype&&Object.getPrototypeOf(v)!==null))fail(path+': expected plain JSON');
 seen.add(v);for(const [k,x] of Object.entries(v)){if(!safe(k))fail(path+': reserved key '+k);jsonData(x,path+'.'+k,depth+1,seen)}seen.delete(v);
}
const id=v=>{if(typeof v!=='string'||!safe(v)||! /^[a-zA-Z][\w.:-]{0,127}$/.test(v))fail('Invalid definition ID')};
const types=['object','array','string','number','integer','boolean','null'];
const keys=new Set(['type','title','description','properties','required','additionalProperties','items','enum','minimum','maximum','minLength','maxLength','minItems','maxItems','reference']);
export function validateSchema(s,path='schema'){
 if(!record(s)||!types.includes(s.type))fail(path+': expected a supported type');
 for(const k of Object.keys(s))if(!keys.has(k))fail(path+': unsupported schema keyword '+k);
 for(const k of ['title','description'])if(s[k]!==undefined&&typeof s[k]!=='string')fail(path+'.'+k+': expected text');
 if(s.reference!==undefined){if(s.type!=='string')fail(path+': reference fields must be strings');validateReferenceSpec(s.reference)}
 if(s.enum!==undefined&&(!Array.isArray(s.enum)||!s.enum.length))fail(path+': enum must contain values');
 if(s.type==='object'){
  if(s.properties!==undefined&&!record(s.properties))fail(path+': properties must be an object');
  for(const [k,v] of Object.entries(s.properties??{}))validateSchema(v,path+'.'+k);
  if(s.required!==undefined&&(!Array.isArray(s.required)||new Set(s.required).size!==s.required.length||s.required.some(k=>typeof k!=='string'||!Object.hasOwn(s.properties??{},k))))fail(path+': required fields must be declared properties');
  if(s.additionalProperties!==undefined&&typeof s.additionalProperties!=='boolean')fail(path+': additionalProperties must be boolean');
 }else if(['properties','required','additionalProperties'].some(k=>s[k]!==undefined))fail(path+': object keywords require object type');
 if(s.type==='array'){if(!s.items)fail(path+': array items schema required');validateSchema(s.items,path+'[]')}else if(['items','minItems','maxItems'].some(k=>s[k]!==undefined))fail(path+': array keywords require array type');
 for(const [a,b,allowed] of [['minimum','maximum',['number','integer']],['minLength','maxLength',['string']],['minItems','maxItems',['array']]]){
  for(const k of [a,b])if(s[k]!==undefined&&(!allowed.includes(s.type)||!Number.isFinite(s[k])||(k!=='minimum'&&k!=='maximum'&&(!Number.isInteger(s[k])||s[k]<0))))fail(path+': invalid '+k);
  if(s[a]!==undefined&&s[b]!==undefined&&s[a]>s[b])fail(path+': inverted range');
 }
}
export function validateValue(value,s,path='value'){
 const matches=s.type==='object'?record(value):s.type==='array'?Array.isArray(value):s.type==='null'?value===null:s.type==='integer'?Number.isInteger(value):typeof value===s.type;
 if(!matches)fail(path+': expected '+s.type);
 if(s.enum&&!s.enum.some(v=>JSON.stringify(v)===JSON.stringify(value)))fail(path+': choose a listed value');
 if(s.type==='object'){
  for(const k of s.required??[])if(!Object.hasOwn(value,k))fail(path+'.'+k+': required');
  for(const [k,v] of Object.entries(value)){if(Object.hasOwn(s.properties??{},k))validateValue(v,s.properties[k],path+'.'+k);else if(s.additionalProperties===false)fail(path+'.'+k+': undeclared field')}
 }else if(s.type==='array')value.forEach((v,i)=>validateValue(v,s.items,path+'['+i+']'));
 for(const [key,actual,compare] of [['minimum',value,(a,b)=>a<b],['maximum',value,(a,b)=>a>b],['minLength',value?.length,(a,b)=>a<b],['maxLength',value?.length,(a,b)=>a>b],['minItems',value?.length,(a,b)=>a<b],['maxItems',value?.length,(a,b)=>a>b]])if(s[key]!==undefined&&compare(actual,s[key]))fail(path+': violates '+key+' '+s[key]);
}
export function validateEntityLibrary(library){
 jsonData(library);if(!record(library)||library.version!==1||!Array.isArray(library.components)||!Array.isArray(library.entities)||library.components.length>256||library.entities.length>2048)fail('Invalid entity library v1');
 const components=new Map();for(const c of library.components){id(c.id);if(components.has(c.id))fail('Duplicate component '+c.id);if(c.name!==undefined&&typeof c.name!=='string')fail('Component name must be text');validateSchema(c.schema,c.id);validateValue(c.defaults,c.schema,c.id+'.defaults');components.set(c.id,c)}
 const ids=new Set();for(const e of library.entities){id(e.id);if(ids.has(e.id))fail('Duplicate entity '+e.id);ids.add(e.id);if(typeof e.name!=='string'||!record(e.components))fail('Invalid entity '+e.id);for(const [key,value] of Object.entries(e.components)){if(!components.has(key))fail(e.id+': unknown component '+key);validateValue(value,components.get(key).schema,e.id+'.'+key)}}
 return library;
}
export function entityPacket(project){const l=project.entityDefinitions??{version:1,components:[],entities:[]};validateEntityLibrary(l);return {format:ENTITY_FORMAT,...structuredClone(l),dependencies:referenceDependencies(l)}}
export function readEntityPacket(packet){jsonData(packet);if(packet?.format!==ENTITY_FORMAT)fail('Choose a shapeshift-entities packet');const l=structuredClone(packet);delete l.format;delete l.dependencies;return validateEntityLibrary(l)}
// Games may pass the result to their own World.create() or component loaders.
export function instantiateEntity(packet,entityId){const l=readEntityPacket(packet),e=l.entities.find(e=>e.id===entityId);if(!e)fail('Unknown entity '+entityId);return structuredClone(e.components)}
