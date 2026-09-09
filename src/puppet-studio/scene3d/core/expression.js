// A small serializable numeric graph, shared by procedural automation tools.
// No evaluated JavaScript or recipe-specific operators.
export function evaluate(expression,variables){
 if(!Array.isArray(expression))return expression;
 const [op,...args]=expression;
 if(op==='var'){let value=variables;for(const part of args[0].split('.')){if(['__proto__','prototype','constructor'].includes(part))throw Error('Reserved variable path');value=value?.[part];}if(value===undefined)throw Error('Unknown automation variable '+args[0]);return value;}
 if(op==='if')return evaluate(args[0],variables)?evaluate(args[1],variables):evaluate(args[2],variables);
 const values=args.map(a=>evaluate(a,variables));
 switch(op){case'clamp':return Math.max(values[1],Math.min(values[2],values[0]));case'mod':return values[0]%values[1];case'lt':return values[0]<values[1];case'startsWith':return String(values[0]).startsWith(values[1]);case'smooth':{const t=Math.max(0,Math.min(1,values[0]));return t*t*(3-2*t);}case'add':return values.reduce((a,b)=>a+b);case'sub':return values[0]-values[1];case'mul':return values.reduce((a,b)=>a*b);case'div':return values[0]/values[1];case'pow':return values[0]**values[1];case'min':return Math.min(...values);case'max':return Math.max(...values);case'sin':return Math.sin(values[0]);case'cos':return Math.cos(values[0]);case'exp':return Math.exp(values[0]);case'sqrt':return Math.sqrt(values[0]);case'abs':return Math.abs(values[0]);case'eq':return values[0]===values[1];case'gt':return values[0]>values[1];case'gte':return values[0]>=values[1];case'not':return !values[0];case'and':return values.every(Boolean);case'or':return values.some(Boolean);default:throw Error('Unknown automation operator '+op);}
}

// Compile to closures, never source text/eval. Arithmetic keeps the original
// association and branch semantics while avoiding per-sample operand arrays.
export function compileExpression(expression){
 if(!Array.isArray(expression))return()=>expression;
 const [op,...args]=expression;
 if(op==='var'){const parts=args[0].split('.');return variables=>{let value=variables;for(const part of parts){if(['__proto__','prototype','constructor'].includes(part))throw Error('Reserved variable path');value=value?.[part];}if(value===undefined)throw Error('Unknown automation variable '+args[0]);return value;};}
 const f=args.map(compileExpression),[a,b,c]=f;
 switch(op){
 case'if':return v=>a(v)?b(v):c(v);
 case'add':return v=>{let x=a(v);for(let i=1;i<f.length;i++)x+=f[i](v);return x;};
 case'mul':return v=>{let x=a(v);for(let i=1;i<f.length;i++)x*=f[i](v);return x;};
 case'sub':return v=>a(v)-b(v);case'div':return v=>a(v)/b(v);case'pow':return v=>a(v)**b(v);
 case'min':return v=>{let x=Infinity;for(const fn of f)x=Math.min(x,fn(v));return x;};case'max':return v=>{let x=-Infinity;for(const fn of f)x=Math.max(x,fn(v));return x;};
 case'sin':return v=>Math.sin(a(v));case'cos':return v=>Math.cos(a(v));case'exp':return v=>Math.exp(a(v));case'sqrt':return v=>Math.sqrt(a(v));case'abs':return v=>Math.abs(a(v));
 case'eq':return v=>a(v)===b(v);case'gt':return v=>a(v)>b(v);case'gte':return v=>a(v)>=b(v);case'lt':return v=>a(v)<b(v);case'not':return v=>!a(v);
 case'and':return v=>{let x=true;for(const fn of f){const value=fn(v);x=x&&!!value;}return x;};case'or':return v=>{let x=false;for(const fn of f){const value=fn(v);x=x||!!value;}return x;};
 case'mod':return v=>a(v)%b(v);case'clamp':return v=>{const x=a(v),low=b(v),high=c(v);return Math.max(low,Math.min(high,x));};
 case'smooth':return v=>{const t=Math.max(0,Math.min(1,a(v)));return t*t*(3-2*t);};case'startsWith':return v=>String(a(v)).startsWith(b(v));
 default:return()=>{throw Error('Unknown automation operator '+op);};
 }
}
