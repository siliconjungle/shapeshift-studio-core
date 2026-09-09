// Portable authoring values. Colours are sRGB triples, positions are local pixels in 2D and metres in 3D.
export const MAX_LIGHTS=16;
export const lightDefaults=()=>({enabled:true,color:[1,.68,.16],colorMode:'custom',intensity:2,range:4,falloff:2,offset:[0,0,0],direction:[0,0,1],frontOnly:false,nightOnly:false,pulse:{amount:0,speed:1,seed:0}});
export const coloringDefaults=()=>({tint:[1,1,1],strength:0,emissionColor:[1,.8,.45],emission:0,region:[.5,.5,.2,.2],regionOnly:false,mask:'all',face:'all',nightOnly:false,colorMode:'custom'});
export const lightPreset=(kind)=>({...lightDefaults(),...(kind==='firefly'?{range:1.9,intensity:1.6,pulse:{amount:.3,speed:1.8,seed:1}}:kind==='window'?{range:5.2,intensity:2.1,color:[1,.43,.12],frontOnly:true,nightOnly:true}:{range:4,intensity:2.9,color:[1,.43,.12],frontOnly:true,nightOnly:true,pulse:{amount:.12,speed:2.7,seed:2}})});
export function nightActivation(night){const t=Math.max(0,Math.min(1,(night-.12)/.68));return t*t*(3-2*t);}
export function lightPower(light,time,night=0){const p=light.pulse;const wave=p?(.65*Math.sin(time*p.speed*6.28318530718+p.seed)+.35*Math.sin(time*p.speed*10.173+p.seed*2.31)):0;return light.enabled?Math.max(0,light.intensity)*(light.nightOnly?nightActivation(night):1)*(1+(p?.amount??0)*wave):0;}
export function validateLighting(node){
 const check=(v,m)=>{if(!v)throw Error('3D scene: invalid '+m);};
 const num=(v,a,b,m)=>check(Number.isFinite(v)&&v>=a&&v<=b,m);
 const vec=(v,n,a,b,m)=>{check(Array.isArray(v)&&v.length===n,m);v.forEach(x=>num(x,a,b,m));};
 const mode=v=>check(['custom','environment'].includes(v),'light colour mode');
 if(node.light){const l=node.light;for(const k of ['enabled','frontOnly','nightOnly'])check(typeof l[k]==='boolean','light '+k);mode(l.colorMode);vec(l.color,3,0,1,'light colour');vec(l.offset,3,-1000,1000,'light offset');vec(l.direction,3,-1,1,'light direction');check(l.direction.some(x=>x!==0),'light direction');num(l.intensity,0,20,'light intensity');num(l.range,.01,1000,'light range');num(l.falloff,.1,8,'light falloff');num(l.pulse.amount,0,1,'flicker amount');num(l.pulse.speed,0,30,'flicker speed');num(l.pulse.seed,0,10000,'flicker seed');}
 if(node.coloring){const c=node.coloring;mode(c.colorMode);vec(c.tint,3,0,1,'tint');num(c.strength,0,1,'tint strength');vec(c.emissionColor,3,0,1,'emission colour');num(c.emission,0,10,'emission');vec(c.region,4,0,1,'glow region');check(c.region[2]>0&&c.region[3]>0,'glow radius');check(['all','warm','dark'].includes(c.mask),'glow mask');check(['all','front','back','left','right','top','bottom'].includes(c.face),'glow face');for(const k of ['regionOnly','nightOnly'])check(typeof c[k]==='boolean','glow '+k);}
}
export const LIGHT_CHANNELS=['light.intensity','light.range','light.color','light.offset','coloring.tint','coloring.strength','coloring.emission','coloring.emissionColor'];
export const LIGHT_VECTOR_CHANNELS=['light.color','light.offset','coloring.tint','coloring.emissionColor'];
