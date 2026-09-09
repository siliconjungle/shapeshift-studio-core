import {validateVectorEffect} from './vector-validation.js';
const check=(ok,message)=>{if(!ok)throw Error('3D effect library: '+message);};
const name=id=>typeof id==='string'&&/^[\w-]{1,100}$/.test(id)&&!['__proto__','constructor','prototype'].includes(id);
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export function validateEffectLibrary(d){
 check(d&&/^#[\da-f]{6}$/i.test(d.color),'invalid colour');check(d.geometry&&Object.keys(d.geometry).length<=128,'invalid geometry table');
 for(const [id,g]of Object.entries(d.geometry)){check(name(id),'invalid geometry ID');check(['shape','cylinder','ring','sphere','plane','circle'].includes(g.type),'invalid primitive');if(g.type==='shape'){check(Array.isArray(g.path)&&g.path.length<=4096,'invalid shape path');for(const [op,...args]of g.path){const arity={moveTo:2,lineTo:2,bezierCurveTo:6,quadraticCurveTo:4,closePath:0}[op];check(arity!==undefined&&args.length===arity&&args.every(finite),'invalid shape operation');}check(g.segments===undefined||finite(g.segments)&&g.segments>=1&&g.segments<=128,'invalid path detail');}else check(Array.isArray(g.args)&&g.args.length<=12&&g.args.every(v=>typeof v==='boolean'||finite(v)&&Math.abs(v)<=256),'invalid primitive arguments');}
 const ids=new Set();function node(n,depth=0){check(depth<16&&ids.size<1024&&name(n.id)&&!ids.has(n.id),'invalid effect hierarchy');ids.add(n.id);if(n.geometry)check(Object.hasOwn(d.geometry,n.geometry),'missing geometry');for(const key of ['position','rotation','scale'])if(n[key])check(Array.isArray(n[key])&&n[key].length===3&&n[key].every(finite),'invalid transform');for(const child of n.children??[])node(child,depth+1);}node(d.root);
 check(d.programs&&Object.keys(d.programs).length<=128,'invalid program table');
 for(const [id,p]of Object.entries(d.programs)){check(name(id)&&ids.has(p.root),'invalid program root');check(Array.isArray(p.targets)&&p.targets.length<=1024&&p.targets.every(id=>ids.has(id)),'invalid program targets');validateVectorEffect({projection:'surface',curveSegments:28,boundsTolerance:4,surfaceOffset:0,renderOrder:0,color:d.color,buckets:[{id:'all',when:true}],animation:p.animation});}
 for(const [id,n]of Object.entries(d.whiteness??{}))check(ids.has(id)&&finite(n)&&n>=0&&n<=1,'invalid palette binding');return ids;
}
export function validateAudioLibrary(d){
 check(d&&finite(d.volume)&&d.volume>=0&&d.volume<=1,'invalid audio volume');check(d.compressor&&d.noise&&d.voice&&d.variation&&d.cueVariation&&d.cues&&d.states&&d.beds,'incomplete audio definition');
 check(finite(d.noise.seconds)&&d.noise.seconds>0&&d.noise.seconds<=10,'invalid noise buffer');check(Array.isArray(d.variation.semitones)&&d.variation.semitones.length>0&&d.variation.semitones.length<=32,'invalid sound variations');
 for(const voices of Object.values(d.cues))check(Array.isArray(voices)&&voices.length<=128,'invalid cue voices');for(const id of Object.values(d.states))check(Object.hasOwn(d.beds,id),'missing audio bed');
 for(const bed of Object.values(d.beds)){check(Array.isArray(bed.voices)&&bed.voices.length<=32,'invalid audio bed');check(Array.isArray(bed.automation)&&bed.automation.length<=128,'invalid audio automation');for(const a of bed.automation)check(Number.isInteger(a.voice)&&a.voice>=0&&a.voice<bed.voices.length&&['frequency','gain','filter'].includes(a.parameter),'invalid automated voice');}
}
