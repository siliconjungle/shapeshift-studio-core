import {assertData as jsonValue} from '../../gameplay-effects/definitions.js';
export const RENDER_MODES=['native','billboard','axial-billboard','fixed','ground','decal','screen'];
export const EFFECT_KINDS=['scenery','character','resource','particle','emote','decal','overlay'];
const finite=(v,min,max,label)=>{if(!Number.isFinite(v)||v<min||v>max)throw Error('Invalid '+label);};
function validateAction(a){
 if(a.duration!==undefined)finite(a.duration,0,120,'action duration');
 if(a.speed!==undefined)finite(a.value??a.speed,0,8,'playback speed');
 if(a.type==='burst')finite(a.count??9,1,100,'particle count');
 if(['reaction','sound'].includes(a.type)&&typeof a.id!=='string')throw Error('Action ID required');
 if(a.type==='voice'&&(!/^[a-z0-9-]+$/.test(a.variant??'')||!/^[a-z0-9-]+$/.test(a.clip??'')))throw Error('Voice variant and clip required');
 if(a.type==='render')validateRender(a);
}
export function validateRender(n){if(n.height!==undefined)finite(n.height,.001,100,'art height');if(n.mode!==undefined&&!RENDER_MODES.includes(n.mode))throw Error('Unknown rendering mode');if(n.kind!==undefined&&!EFFECT_KINDS.includes(n.kind))throw Error('Unknown effect kind');for(const key of ['position','rotation','scale'])if(n[key]!==undefined){if(!Array.isArray(n[key])||n[key].length!==3)throw Error(key+' requires three numbers');n[key].forEach(v=>finite(v,-10000,10000,key));}if(n.opacity!==undefined)finite(n.opacity,0,1,'opacity');}
export function validateAbilityPresentation(bindings){
 if(bindings===undefined)return;
 jsonValue(bindings);if(!bindings||Array.isArray(bindings)||typeof bindings!=='object')throw Error('Invalid native ability presentation');
 const allowed=['reaction','sound','voice','hit','burst','shake','render','flash'];
 for(const stages of Object.values(bindings))for(const [stage,actions] of Object.entries(stages)){
  if(stage==='duration'){finite(actions,.01,120,'ability visual duration');continue}
  if(stage==='nodes'){if(!Array.isArray(actions)||actions.length>16)throw Error('Invalid ability visual nodes');const ids=new Set();for(const n of actions){if(typeof n.id!=='string'||!/^[a-zA-Z][\w.:-]*$/.test(n.id)||['constructor','prototype','__proto__'].includes(n.id)||ids.has(n.id))throw Error('Duplicate or missing ability node ID');ids.add(n.id);if(!/^[a-zA-Z0-9_/-]+$/.test(n.asset)||n.asset.includes('..'))throw Error('Invalid ability vector asset');validateRender(n);if(n.follow!==undefined&&typeof n.follow!=='boolean')throw Error('Invalid ability node follow')}continue}

  if(!['apply','tick','end','restore'].includes(stage)||!Array.isArray(actions)||actions.length>32)throw Error('Invalid ability presentation stage');
  for(const a of actions){if(!allowed.includes(a.type))throw Error('Ability presentation cannot change gameplay');validateAction({...a,...(a.position==='$event:abilityPosition'?{position:[0,0,0]}:{})});if(stage==='restore'&&a.type!=='render')throw Error('Restore may only reconstruct persistent rendering')}
 }
}
