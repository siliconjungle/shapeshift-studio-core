// JSON authoring contracts. Executable code belongs in registered domain commands.
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fail=message=>{throw new TypeError(`Ability definition: ${message}`)};
const finite=(n,label,min=0)=>{if(!Number.isFinite(n)||n<min)fail(label)};
const id=(v,label)=>{if(typeof v!=='string'||!/^[a-zA-Z][\w.:-]*$/.test(v)||['__proto__','constructor','prototype'].includes(v))fail(label)};
export function assertData(value,path='data',seen=new Set()){
 if(value===null||typeof value==='string'||typeof value==='boolean')return;
 if(typeof value==='number'){if(!Number.isFinite(value))fail(`${path} must be finite`);return}
 if(typeof value!=='object'||seen.has(value)||(!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null))fail(`${path} must be acyclic JSON`);
 seen.add(value);for(const [key,item] of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(key))fail(`${path}.${key} is forbidden`);assertData(item,`${path}.${key}`,seen)}seen.delete(value);
}
export function validateSelector(s){
 if(!record(s))fail('selector must be an object');
 if(s.from!==undefined&&!['target','source','eventTarget','eventSource','world'].includes(s.from))fail('selector.from');
 for(const field of ['requires','without'])if(s[field]!==undefined&&(!Array.isArray(s[field])||s[field].some(v=>typeof v!=='string')))fail(`selector.${field}`);
 if(s.radius!==undefined)finite(s.radius,'selector.radius');
 if(s.limit!==undefined&&(!Number.isInteger(s.limit)||s.limit<1||s.limit>1024))fail('selector.limit');
 if(s.relation!==undefined&&!['ally','enemy','self','any'].includes(s.relation))fail('selector.relation');
 if(s.alive!==undefined&&typeof s.alive!=='boolean')fail('selector.alive');
 return s;
}
function validateSteps(steps){
 if(!Array.isArray(steps)||steps.length>128)fail('steps must be a bounded array');
 for(const step of steps){if(!record(step))fail('step');id(step.op,'operation');if(step.select)validateSelector(step.select);if(step.delay!==undefined)finite(step.delay,'delay');if(step.amount!==undefined||['damage','heal'].includes(step.op))finite(step.amount,'amount');if(step.effect!==undefined||step.op==='apply')id(step.effect,'effect');if(step.op==='spawn')id(step.archetype,'archetype');if(step.offset!==undefined&&(!Array.isArray(step.offset)||step.offset.length!==2||!step.offset.every(Number.isFinite)))fail('spawn offset');if(step.chance!==undefined){finite(step.chance,'chance');if(step.chance>1)fail('chance')}if(step.capture!==undefined&&!['live','snapshot'].includes(step.capture))fail('capture');}
}
export function validateDefinition(d){
 assertData(d);if(!record(d))fail('expected object');id(d.id,'id');if(d.version!==1)fail('unsupported version');
 if(!['ability','effect'].includes(d.type))fail('type');
 if(d.target)validateSelector(d.target);validateSteps(d.steps??[]);
 if(d.social){if(d.type!=='ability'||!['help','harm'].includes(d.social.kind))fail('social policy');finite(d.social.strength??.5,'social strength');if((d.social.strength??.5)>1)fail('social strength');if(d.social.on!==undefined){if(!Array.isArray(d.social.on)||d.social.on.length>32)fail('social operations');for(const op of d.social.on)id(op,'social operation')}}
 if(d.cooldown!==undefined)finite(d.cooldown,'cooldown');
 if(d.costs!==undefined){
  if(d.type!=='ability'||!Array.isArray(d.costs)||d.costs.length>16)fail('costs must be a bounded ability resource list');
  const resources=new Set();for(const cost of d.costs){if(!record(cost))fail('cost');id(cost.resource,'cost resource');finite(cost.amount,'cost amount');if(resources.has(cost.resource))fail('duplicate cost resource');resources.add(cost.resource)}
 }
 if(d.type==='effect'){
  if(d.duration!==null)finite(d.duration,'duration');
  if(d.period!==undefined){finite(d.period,'period',.001);validateSteps(d.tick??[])}
  for(const field of ['apply','end'])if(d[field])validateSteps(d[field]);
  if(d.stack&&!['refresh','stack','replace','ignore'].includes(d.stack.mode))fail('stack mode');
  if(d.stack?.scope&&!['target','source'].includes(d.stack.scope))fail('stack scope');
  if(d.stack?.max!==undefined&&(!Number.isInteger(d.stack.max)||d.stack.max<1||d.stack.max>1024))fail('stack max');
  for(const flag of ['sourceBound','surviveDeath','resetCadence'])if(d[flag]!==undefined&&typeof d[flag]!=='boolean')fail(flag);
  for(const m of d.modifiers??[]){id(m.stat,'modifier stat');if(!['add','multiply','override'].includes(m.mode))fail('modifier mode');if(!Number.isFinite(m.value)||!Number.isFinite(m.priority??0))fail('modifier value/priority')}
  for(const t of d.triggers??[]){id(t.event,'trigger event');validateSteps(t.steps);if(t.chance!==undefined){finite(t.chance,'trigger chance');if(t.chance>1)fail('trigger chance')}if(t.subject&&!['target','source','any'].includes(t.subject))fail('trigger subject')}
  if(d.aura){validateSelector(d.aura.select);id(d.aura.effect,'aura effect');finite(d.aura.interval??.25,'aura interval',.05)}
 }
 return d;
}
function freeze(v){if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v}
export function createRegistry(definitions){
 const map=new Map();for(const source of definitions){const d=freeze(structuredClone(validateDefinition(source)));if(map.has(d.id))fail(`duplicate ${d.id}`);map.set(d.id,d)}
 for(const d of map.values()){
  const all=[d.steps,d.apply,d.tick,d.end,...(d.triggers??[]).map(t=>t.steps)].flatMap(v=>v??[]);
  for(const step of all)if((step.op==='apply'||step.effect)&&map.get(step.effect)?.type!=='effect')fail(`unknown effect ${step.effect}`);
  if(d.aura&&map.get(d.aura.effect)?.type!=='effect')fail(`unknown aura effect ${d.aura.effect}`);
 }
 for(const d of map.values()){const seen=new Set();let at=d;while(at?.aura){if(seen.has(at.id))fail('cyclic aura ownership');seen.add(at.id);at=map.get(at.aura.effect)}}
 return Object.freeze({get:id=>map.get(id),list:()=>[...map.values()]});
}
