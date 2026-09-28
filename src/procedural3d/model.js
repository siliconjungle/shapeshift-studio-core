import {trackingOrder} from './tracking.js';
export const emptyProcedural3D=()=>({version:1,chains:[],terrains:[],gaits:[],bodies:[],trackers:[],movers:[]});
const check=(ok,message)=>{if(!ok)throw Error('Procedural 3D: '+message);};
const number=(v,min,max,label)=>check(Number.isFinite(v)&&v>=min&&v<=max,label+' out of range');
const list=(v,max,label)=>check(Array.isArray(v)&&v.length<=max,label+' must be a bounded list');
const vector=(v,label)=>{list(v,3,label);check(v.length===3,label+' needs XYZ');v.forEach(x=>number(x,-10000,10000,label));};
export function validateProcedural3D(p,nodes){
 if(p===undefined)return;check(p?.version===1,'unknown version');
 const ids=new Set(nodes.map(n=>n.id)),unique=new Set(),outputs=new Set();
 for(const key of ['chains','terrains','gaits','bodies'])list(p[key],128,key);
 list(p.trackers??[],128,'trackers');list(p.movers??[],128,'movers');
 check(new Set(p.terrains).size===p.terrains.length,'duplicate terrain');
 for(const id of p.terrains){const n=nodes.find(n=>n.id===id);check(n&&['box','sphere','cylinder','cone','plane'].includes(n.type),'terrain must be a box, sphere, cylinder, cone or plane');}
 const ref=id=>check(ids.has(id),'missing node '+id),id=v=>check(typeof v==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(v),'invalid controller ID');
 for(const c of p.chains){check(c.enabled===undefined||typeof c.enabled==='boolean','chain enabled must be boolean');id(c.id);check(!unique.has(c.id),'duplicate chain');unique.add(c.id);ref(c.root);ref(c.target);check(['reach','follow','step'].includes(c.mode),'unknown chain mode');list(c.segments,32,'segments');check(c.segments.length>0,'chain needs segments');list(c.lengths,32,'lengths');check(c.lengths.length===c.segments.length,'one length per segment');c.lengths.forEach(x=>number(x,.001,100,'segment length'));list(c.rest,33,'rest points');check(c.rest.length===c.lengths.length+1,'rest point count');c.rest.forEach(v=>vector(v,'rest point'));vector(c.pole??[0,1,0],'pole');check(['x','y','z'].includes(c.axis??'y'),'invalid bone axis');number(c.bendLimit??Math.PI,0,Math.PI,'bend limit');
  for(const node of [...c.segments,...(c.joints??[])]){ref(node);check(!outputs.has(node),'node is driven by multiple chains');outputs.add(node);check(node!==c.root&&node!==c.target&&!p.terrains.includes(node),'chain output cannot also be its root, target or terrain');}
  if(c.joints){list(c.joints,33,'joint objects');check(c.joints.length===c.rest.length,'one joint object per point');}
  if(c.footOrientation!==undefined){check(['preserve','target','terrain'].includes(c.footOrientation),'unknown foot orientation');check(c.footOrientation==='preserve'||(c.mode==='step'&&c.joints?.length),'foot orientation needs a stepping chain with a foot joint');}if(c.footUp!==undefined){vector(c.footUp,'foot local up');check(Math.hypot(...c.footUp)>1e-6,'zero foot up direction');}
  if(c.mode==='step'){vector(c.direction??[0,-1,0],'contact direction');check(Math.hypot(...(c.direction??[0,-1,0]))>1e-6,'zero contact direction');number(c.reach??5,.01,100,'contact reach');number(c.stepDistance??.35,.001,10,'stride threshold');number(c.stepHeight??.3,0,10,'step lift');number(c.stepDuration??.25,.02,10,'step duration');number(c.overshoot??.4,0,2,'overshoot');}
 }
 const stepping=new Set(p.chains.filter(c=>c.mode==='step').map(c=>c.id)),assigned=new Set(),gaits=new Set();
 for(const g of p.gaits){id(g.id);check(!gaits.has(g.id),'duplicate gait');gaits.add(g.id);list(g.groups,32,'gait groups');check(g.groups.length,'empty gait');for(const group of g.groups){list(group,128,'gait group');check(group.length,'empty gait group');for(const key of group){check(stepping.has(key)&&!assigned.has(key),'gait needs unique stepping chains');assigned.add(key);}}}
 const bodies=new Set();for(const b of p.bodies){ref(b.node);check(!bodies.has(b.node)&&!outputs.has(b.node),'duplicate body output');bodies.add(b.node);list(b.chains,128,'support chains');check(b.chains.length&&new Set(b.chains).size===b.chains.length&&b.chains.every(id=>stepping.has(id)),'body needs stepping chains');vector(b.up??[0,1,0],'body up');check(Math.hypot(...(b.up??[0,1,0]))>1e-6,'zero up direction');number(b.height,0,100,'clearance');number(b.maxOffset??3,0,100,'body travel');number(b.maxTilt??.7,0,Math.PI/2,'body tilt');number(b.response??10,.01,100,'body response');}
 const trackingIds=new Set(),trackingOutputs=new Set();
 for(const t of p.trackers??[]){
  id(t.id);check(!trackingIds.has(t.id),'duplicate tracker');trackingIds.add(t.id);ref(t.node);ref(t.target);if(t.origin!==undefined)ref(t.origin);
  check(!trackingOutputs.has(t.node)&&!outputs.has(t.node)&&!bodies.has(t.node),'duplicate tracking output');trackingOutputs.add(t.node);
  check(!nodes.find(n=>n.id===t.node).attachment,'track the puppet joint instead of a socket attachment');
  check(t.enabled===undefined||typeof t.enabled==='boolean','tracker enabled must be boolean');
  const f=t.forward??[0,0,1],u=t.up??[0,1,0];vector(f,'tracking forward');vector(u,'tracking up');
  check(Math.hypot(...f)>1e-6&&Math.hypot(...u)>1e-6,'zero tracking axis');
  check(Math.hypot(f[1]*u[2]-f[2]*u[1],f[2]*u[0]-f[0]*u[2],f[0]*u[1]-f[1]*u[0])/(Math.hypot(...f)*Math.hypot(...u))>1e-6,'tracking axes must not be parallel');
  for(const [name,limit]of [['yaw',Math.PI],['pitch',Math.PI/2]]){const range=t[name]??(name==='yaw'?[-Math.PI/2,Math.PI/2]:[-Math.PI/4,Math.PI/4]);list(range,2,'tracking '+name);check(range.length===2,'tracking range needs minimum and maximum');number(range[0],-limit,0,'tracking minimum');number(range[1],0,limit,'tracking maximum');}
  number(t.cone??Math.PI,0,Math.PI,'tracking cone');number(t.response??8,.01,100,'tracking response');
 }
 const moverIds=new Set(),moverOutputs=new Set();
 for(const m of p.movers??[]){
  id(m.id);check(!moverIds.has(m.id),'duplicate mover');moverIds.add(m.id);ref(m.node);ref(m.target);
  check(!moverOutputs.has(m.node)&&!outputs.has(m.node)&&!trackingOutputs.has(m.node),'duplicate movement output');moverOutputs.add(m.node);
  check(!nodes.find(n=>n.id===m.node).attachment,'move the puppet joint instead of a socket attachment');check(m.enabled===undefined||typeof m.enabled==='boolean','mover enabled must be boolean');
  for(const [key,fallback]of [['forward',[0,0,1]],['up',[0,1,0]]]){vector(m[key]??fallback,'movement '+key);check(Math.hypot(...(m[key]??fallback))>1e-6,'zero movement axis');}
  number(m.minDistance??2,0,10000,'minimum target distance');number(m.maxDistance??3,m.minDistance??2,10000,'maximum target distance');
  number(m.moveSpeed??1,0,100,'move speed');number(m.turnSpeed??2,0,20,'turn speed');number(m.moveResponse??6,.01,100,'move response');number(m.turnResponse??8,.01,100,'turn response');number(m.turnTolerance??.1,0,Math.PI,'turn tolerance');number(m.moveAngle??Math.PI/2,.001,Math.PI,'movement facing angle');
 }
 trackingOrder(p.movers??[],nodes);
 trackingOrder(p.trackers??[],nodes);
 const ancestors=(id,predicate)=>{let n=nodes.find(n=>n.id===id);while(n){check(!predicate(n.id),'tracking input/output feedback');n=nodes.find(v=>v.id===n.parent);}};
 for(const t of p.trackers??[])for(const id of [t.node,t.target,t.origin].filter(Boolean))ancestors(id,id=>outputs.has(id));
 for(const m of p.movers??[])for(const id of [m.node,m.target])ancestors(id,id=>outputs.has(id)||trackingOutputs.has(id));
 for(const id of p.terrains)ancestors(id,id=>trackingOutputs.has(id));
 // Roots/targets/terrain must remain independent of segment outputs.
 const byId=new Map(nodes.map(n=>[n.id,n]));for(const key of [...p.terrains,...p.chains.flatMap(c=>[c.root,c.target]),...p.bodies.map(b=>b.node)]){let n=byId.get(key);while(n){check(!outputs.has(n.id),'input is parented beneath a chain output');n=byId.get(n.parent);}}
 return p;
}
