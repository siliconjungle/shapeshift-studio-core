import * as T from 'three';
import {poseAt,spring,sampleShake} from './motion.js';
const forbidden=new Set(['__proto__','prototype','constructor']);
const path=p=>{const keys=Array.isArray(p)?p:String(p).split('.');if(keys.some(k=>forbidden.has(String(k))))throw Error('Reserved controller path');return keys;};
function read(o,p){for(const k of path(p))o=o?.[k];return o;}
function write(o,p,value){const keys=path(p);for(const k of keys.slice(0,-1))o=o[k]??={};o[keys.at(-1)]=structuredClone(value);}
export function mergeControllerParameters(base,patch){const result=structuredClone(base);for(const [k,v]of Object.entries(patch??{})){path(k);result[k]=v&&typeof v==='object'&&!Array.isArray(v)&&result[k]&&typeof result[k]==='object'?mergeControllerParameters(result[k],v):structuredClone(v);}return result;}
const vec=v=>new T.Vector3().fromArray(v),quat=q=>new T.Quaternion().fromArray(q);
// Numerical, vector and quaternion operations; no dynamic JS, DOM or recipe names.
const ops={
 list:(...v)=>v,add:(...v)=>v.reduce((a,b)=>a+b),sub:(a,b)=>a-b,mul:(...v)=>v.reduce((a,b)=>a*b),div:(a,b)=>a/b,pow:Math.pow,sin:Math.sin,cos:Math.cos,exp:Math.exp,abs:Math.abs,min:Math.min,max:Math.max,mod:(a,b)=>a%b,
 eq:(a,b)=>a===b,lt:(a,b)=>a<b,lte:(a,b)=>a<=b,gt:(a,b)=>a>b,gte:(a,b)=>a>=b,not:a=>!a,and:(...v)=>v.every(Boolean),or:(...v)=>v.some(Boolean),includes:(a,b)=>a.includes(b),at:(a,i)=>a[i],length:a=>a.length,
 clamp:T.MathUtils.clamp,lerp:T.MathUtils.lerp,smooth:t=>{t=T.MathUtils.clamp(t,0,1);return t*t*(3-2*t);},
 curve:(t,c)=>poseAt(t,c),spring:(x,v,target,dt,f,d)=>spring(x,v,target,dt,f,d),
 cross:(a,b)=>vec(a).cross(vec(b)).toArray(),vadd:(a,b)=>vec(a).add(vec(b)).toArray(),vscale:(a,s)=>vec(a).multiplyScalar(s).toArray(),vaddScaled:(a,b,s)=>vec(a).addScaledVector(vec(b),s).toArray(),vrotate:(a,q)=>vec(a).applyQuaternion(quat(q)).toArray(),vlength:a=>vec(a).length(),normalize:a=>vec(a).normalize().toArray(),
 axisAngle:(axis,angle)=>new T.Quaternion().setFromAxisAngle(vec(axis),angle).toArray(),qmul:(a,b)=>quat(a).multiply(quat(b)).toArray(),qslerp:(a,b,t)=>new T.Quaternion().slerpQuaternions(quat(a),quat(b),t).toArray(),
 matrix:(p,q,s)=>new T.Matrix4().compose(vec(p),quat(q),vec(s)).toArray(),shake:(clock,amount,definition)=>sampleShake(clock,amount,definition)
};
function compileExpression(e){if(!Array.isArray(e)){if(e&&typeof e==='object'){const fields=Object.entries(e).map(([k,v])=>[k,compileExpression(v)]);return ctx=>Object.fromEntries(fields.map(([k,f])=>[k,f(ctx)]));}return()=>e;}const [op,...args]=e;if(op==='literal'){const value=structuredClone(args[0]);return()=>value;}if(op==='var'){const keys=path(args[0]);return ctx=>read(ctx,keys);}if(op==='if'){const [c,a,b]=args.map(compileExpression);return ctx=>c(ctx)?a(ctx):b(ctx);}const fn=ops[op];if(!Object.hasOwn(ops,op))throw Error('Unknown controller expression '+op);const values=args.map(compileExpression);return ctx=>fn(...values.map(f=>f(ctx)));}
function compileProgram(program){if(!Array.isArray(program)||program.length>4096)throw Error('Invalid controller program');return program.map(command=>{if(!Array.isArray(command))throw Error('Invalid controller instruction');const [op,a,b,c]=command;
 if(op==='set'){const keys=Array.isArray(a)?a.map(compileExpression):path(a).map(k=>()=>k),value=compileExpression(b);return m=>{const p=keys.map(f=>f(m.context));m.writes?.add(p.join('.'));write(m.data,p,value(m.context));};}
 if(op==='local'){const value=compileExpression(b);path(a);return m=>write(m.locals,a,value(m.context));}
 if(op==='if'){const condition=compileExpression(a),yes=compileProgram(b),no=compileProgram(c??[]);return m=>m.run(condition(m.context)?yes:no);}
 if(op==='call'){const name=compileExpression(a),args=compileExpression(b??{});return m=>m.call(name(m.context),args(m.context));}
 if(op==='emit'){const name=compileExpression(a),args=compileExpression(b??{});return m=>m.emit(name(m.context),args(m.context));}
 if(op==='enter'){const name=compileExpression(a);return m=>m.enter(name(m.context));}
 if(op==='push'){const value=compileExpression(b);path(a);return m=>{const array=read(m.data,a);array.push(structuredClone(value(m.context)));if(c&&array.length>c)array.shift();};}
 if(op==='shift'){path(a);path(b);return m=>write(m.data,b,read(m.data,a).shift());}
 if(op==='for'){path(a);const count=compileExpression(b),body=compileProgram(c);return m=>{const n=count(m.context);if(!Number.isInteger(n)||n<0||n>256)throw Error('Invalid controller loop');for(let i=0;i<n;i++){write(m.locals,a,i);m.run(body);}};}
 throw Error('Unknown controller instruction '+op);
 });}
export class ActionMachine {
 constructor(definition,{parameters={},emit=()=>{}}={}){this.definition=definition;this.data=structuredClone(definition.initial);this.parameters=mergeControllerParameters(definition.parameters??{},parameters);for(const control of definition.controls??[]){const keys=path(control.path),value=read(this.parameters,keys);if(!Number.isFinite(value)||value<(control.min??-Infinity)||value>(control.max??Infinity))throw Error('Invalid controller parameter '+control.path);}this.locals={};this.emit=emit;this.programs=Object.fromEntries(Object.entries(definition.procedures??{}).map(([k,v])=>[k,compileProgram(v)]));this.states=Object.fromEntries(Object.entries(definition.states).map(([k,v])=>[k,compileProgram(v)]));this.before=compileProgram(definition.before??[]);this.after=compileProgram(definition.after??[]);this.entry=compileProgram(definition.enter??[]);this.budget=100000;this.call('initialize');}
 get context(){return{...this.data,...this.locals,parameters:this.parameters};}
 run(program){for(const instruction of program){if(--this.budget<0)throw Error('Controller instruction budget exceeded');instruction(this);}}
 call(name,args={}){const program=this.programs[name];if(!program)throw Error('Unknown controller procedure '+name);const previous=this.locals;this.locals={...previous,...args};try{this.run(program);}finally{this.locals=previous;}}
 enter(name){if(!Object.hasOwn(this.states,name))throw Error('Unknown controller state '+name);const previous=this.locals;this.locals={...previous,nextState:name};try{this.run(this.entry);}finally{this.locals=previous;}}
 dispatch(name,args={}){this.budget=100000;this.call(name,args);}
 step(dt,inputs={}){if(!Number.isFinite(dt)||dt<0||dt>.25)throw Error('Invalid controller frame duration');this.budget=100000;this.data.dt=dt;this.data.inputs=inputs;this.run(this.before);this.writes=new Set();if(this.data.active){this.run(this.states[this.data.state]);this.run(this.after);}return this.data;}
 snapshot(){return structuredClone(this.data);}
}
export function validateActionMachine(definition,parameters={}){const machine=new ActionMachine(definition,{parameters});return machine.definition;}
