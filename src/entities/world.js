// Data ownership and lifecycle only. Gameplay rules belong to systems.
const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export class ComponentStore {
 constructor(name){this.name=name;this.entities=[];this.values=[];this.index=new Map();this.sparse=new Uint32Array(256);this.membershipRevision=0;this.valueRevision=0;}
 has(id){return Number.isInteger(id)&&id>=0&&id<this.sparse.length?(this.sparse[id]??0)!==0:this.index.has(id)}
 get(id){if(Number.isInteger(id)&&id>=0&&id<this.sparse.length)return this.values[this.sparse[id]-1];const i=this.index.get(id);return i===undefined?undefined:this.values[i]}
 // Dense entity IDs use a bounded sparse index. Keep dense values canonical:
 // swapping, replacing or deleting a row is visible immediately on every read.
 // High IDs and nonnumeric standalone store keys stay in the Map, so a long
 // running world's monotonic IDs cannot force an unbounded typed allocation.
 setSlot(id,slot){
  if(typeof id!=='number'||!Number.isInteger(id)||id<0||id>=65536)return;
  if(id>=this.sparse.length){const next=new Uint32Array(Math.min(65536,2**Math.ceil(Math.log2(id+1))));next.set(this.sparse);this.sparse=next;}
  this.sparse[id]=slot;
 }
 set(id,value){
  const i=this.index.get(id);if(i===undefined){this.index.set(id,this.entities.length);this.setSlot(id,this.entities.length+1);this.entities.push(id);this.values.push(value);this.membershipRevision++;}else this.values[i]=value;
  this.valueRevision++;return value;
 }
 remove(id){
  const i=this.index.get(id);if(i===undefined)return false;const last=this.entities.length-1;
  if(i!==last){const moved=this.entities[last];this.entities[i]=moved;this.values[i]=this.values[last];this.index.set(moved,i);this.setSlot(moved,i+1);}
  this.entities.pop();this.values.pop();this.index.delete(id);this.setSlot(id,0);this.membershipRevision++;this.valueRevision++;return true;
 }
}
export class EntityWorld {
 constructor(definitions=[]){
  this.nextId=1;this.entities=new Set();this.stores=new Map();this.definitions=new Map();this.resources=new Map();this.queries=new Map();this.structuralRevision=0;this.entityOwners=new Map();this.entityOwnerComponents=new Map();this.ownedEntities=new Map();
  for(const definition of definitions)this.define(definition);
 }
 define(definition){
  if(!definition||typeof definition.name!=='string'||!definition.name||this.stores.has(definition.name))throw Error('Invalid or duplicate component definition');
  this.definitions.set(definition.name,definition);this.stores.set(definition.name,new ComponentStore(definition.name));return this;
 }
 store(name){const store=this.stores.get(name);if(!store)throw Error('Unknown component: '+name);return store}
 alive(id){return this.entities.has(id)}
 assertEntity(id){if(!this.alive(id))throw Error('Unknown entity: '+id)}
 create(components={}){
  if(!isRecord(components))throw Error('Components must be a record');
  // Validate the entire spawn before making it queryable.
  const entries=Object.entries(components);for(const [name,value]of entries)this.validate(name,value);
  if(!Number.isSafeInteger(this.nextId)||this.nextId>0xffffffff)throw Error('Entity ID space exhausted');
  for(const [name,value]of entries)this.prepare(name,value);
  const id=this.nextId++;this.entities.add(id);for(const [name,value]of entries)this.store(name).set(id,value);this.structuralRevision++;return id;
 }
 validate(name,value){this.store(name);const definition=this.definitions.get(name);if(value===undefined||definition.validate&&!definition.validate(value))throw Error('Invalid '+name+' component')}
 prepare(name,value){this.definitions.get(name).prepare?.(value)}
 add(id,name,value){this.assertEntity(id);this.validate(name,value);const store=this.store(name),had=store.has(id);if(had&&this.definitions.get(name).replaceable===false&&store.get(id)!==value)throw Error('Cannot replace identity-bearing '+name+' component');this.prepare(name,value);store.set(id,value);if(!had)this.structuralRevision++;return value}
 get(id,name){this.assertEntity(id);return this.store(name).get(id)}
 has(id,name){return this.alive(id)&&this.store(name).has(id)}
 remove(id,name){this.assertEntity(id);const store=this.store(name);if(!store.has(id))return false;for(const child of this.ownedEntities.get(id)??[])if(this.entityOwnerComponents.get(child)===name)this.destroy(child);store.remove(id);this.structuralRevision++;return true}
 own(parent,child,{component}={}){
  this.assertEntity(parent);this.assertEntity(child);
  if(component!==undefined&&(!this.stores.has(component)||!this.has(parent,component)))throw Error('Ownership component is absent');
  for(let at=parent;at!==undefined;at=this.entityOwners.get(at))if(at===child)throw Error('Entity ownership cycle');
  const previous=this.entityOwners.get(child);if(previous===parent&&this.entityOwnerComponents.get(child)===component)return child;
  if(previous!==undefined){const siblings=this.ownedEntities.get(previous);siblings.delete(child);if(!siblings.size)this.ownedEntities.delete(previous);}
  this.entityOwners.set(child,parent);if(component===undefined)this.entityOwnerComponents.delete(child);else this.entityOwnerComponents.set(child,component);let children=this.ownedEntities.get(parent);if(!children)this.ownedEntities.set(parent,children=new Set());children.add(child);this.structuralRevision++;return child;
 }
 owner(id){return this.entityOwners.get(id)}
 owned(id){return Object.freeze([...(this.ownedEntities.get(id)??[])]);}
 destroy(id){
  if(!this.entities.has(id))return false;
  // Ownership is lifetime data, not a gameplay callback. Retire descendants
  // first, iteratively, so deep trees cannot overflow the call stack.
  const ids=[id];for(let i=0;i<ids.length;i++)for(const child of this.ownedEntities.get(ids[i])??[])ids.push(child);
  for(let i=ids.length-1;i>=0;i--){const current=ids[i],parent=this.entityOwners.get(current);if(parent!==undefined){const siblings=this.ownedEntities.get(parent);siblings.delete(current);if(!siblings.size)this.ownedEntities.delete(parent);}this.entityOwners.delete(current);this.entityOwnerComponents.delete(current);this.ownedEntities.delete(current);this.entities.delete(current);for(const store of this.stores.values())store.remove(current);this.structuralRevision++;}return true;
 }
 setResource(name,value){this.resources.set(name,value);return value}
 resource(name){if(!this.resources.has(name))throw Error('Unknown resource: '+name);return this.resources.get(name)}
 query(required,{without=[]}={}){
  if(!Array.isArray(required)||!required.length)throw Error('Query needs at least one component');
  const names=[...new Set(required)].sort(),excluded=[...new Set(without)].sort();for(const name of [...names,...excluded])this.store(name);
  const key=JSON.stringify([names,excluded]);let cached=this.queries.get(key);if(!cached){cached={stores:[...names,...excluded].map(name=>this.store(name)),versions:[],ids:[]};this.queries.set(key,cached);}
  if(cached.stores.some((store,i)=>store.membershipRevision!==cached.versions[i])){
   const stores=names.map(name=>this.store(name)),omitted=excluded.map(name=>this.store(name)),smallest=stores.reduce((a,b)=>a.entities.length<=b.entities.length?a:b);
   cached.ids=smallest.entities.filter(id=>stores.every(store=>store.has(id))&&omitted.every(store=>!store.has(id))).sort((a,b)=>a-b);
   cached.versions=cached.stores.map(store=>store.membershipRevision);
  }
  // Numeric creation order makes system results independent of swap-removal.
  // Treat the returned membership array as read-only; retain it for this pass.
  return cached.ids;
 }
 describe(){return {entities:this.entities.size,nextId:this.nextId,components:Object.fromEntries([...this.stores].map(([name,s])=>[name,{count:s.entities.length,membershipRevision:s.membershipRevision,valueRevision:s.valueRevision}])),resources:[...this.resources.keys()]}}
}
