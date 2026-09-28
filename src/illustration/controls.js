import {parameter} from '../puppet-studio/fx/math.js';
// Pose drivers read a snapshot before any correction is applied. No feedback,
// history or keyframe mutation: direct seeking and reverse playback agree.
const clamp=x=>Math.max(0,Math.min(1,x));
export function driverWeight(driver,poses){
 if(!driver)return 1;
 const source=poses.get(driver.joint);if(!source)return 0;
 const path=driver.channel.split('.');let value=source.transform??source;
 for(const key of path)value=Array.isArray(value)?value[{x:0,y:1,z:2}[key]]:value?.[key];
 if(!Number.isFinite(value))return 0;if(driver.absolute)value=Math.abs(value);
 const u=clamp((value-driver.from)/(driver.to-driver.from));return driver.easing==='linear'?u:u*u*(3-2*u);
}
export function validateDriver(d,ids,dimension=2){if(!d)return;const channels=dimension===2?['rotation','x','y','scaleX','scaleY']:['rotation.x','rotation.y','rotation.z','position.x','position.y','position.z','scale.x','scale.y','scale.z'];
 if(!ids.has(d.joint)||!channels.includes(d.channel)||![d.from,d.to].every(Number.isFinite)||Math.abs(d.from-d.to)<1e-6||Math.max(Math.abs(d.from),Math.abs(d.to))>1e5)throw Error('Correction driver needs an existing joint, channel and distinct finite limits');
}
export function correctedArtwork(joint,layers,poses,time,influence){
 let out=joint;
 const solo=layers?.some(l=>l.solo&&l.enabled!==false);
 for(const l of layers??[]){if(solo&&!l.solo)continue;const a=l.artwork?.[joint.id];if(!a)continue;const w=influence(l,time)*driverWeight(l.driver,poses);if(l.enabled===false||!w&&a.vectorPose===undefined)continue;
  if(out===joint)out=structuredClone(joint);out.visual??={};
  if(a.asset&&w>=(a.threshold??.5))out.sprite={...out.sprite,asset:a.asset};
  if(a.morph){out.visual.morph={...out.visual.morph,enabled:true,weight:1};for(const k of ['inflate','taper','bend'])out.visual.morph[k]=parameter(out.visual.morph[k],time,0)+(a.morph[k]??0)*w;}
  if(a.vectorPose!==undefined)out.visual.vectorPoseTime=a.vectorPose*w;
  if(a.shade)out.visual.illustratedShade={...a.shade,opacity:(a.shade.opacity??.4)*w};
 }
 return out;
}
const bounded=(v,lo,hi,label)=>{if(!Number.isFinite(v)||v<lo||v>hi)throw Error('Invalid '+label);};
export function validateArtwork(a,joints,assets){
 if(!a)return;
 for(const [id,v]of Object.entries(a)){
  if(!joints.has(id)||!v||typeof v!=='object')throw Error('Correction artwork needs an existing joint');
  if(v.asset&&!assets.has(v.asset))throw Error('Correction replacement artwork is missing');
  if(v.shade?.asset&&!assets.has(v.shade.asset))throw Error('Correction shadow artwork is missing');
  bounded(v.threshold??.5,0,1,'replacement threshold');
  if(v.vectorPose!==undefined)bounded(v.vectorPose,0,120,'vector pose time');
  for(const n of Object.values(v.morph??{}))bounded(n,-4,4,'correction morph');
  if(v.shade){const h=v.shade;if(h.kind&&!['shape','hatch'].includes(h.kind))throw Error('Invalid authored shade kind');if(h.color&&!/^#[\da-f]{6}$/i.test(h.color))throw Error('Invalid authored shade colour');bounded(h.opacity??.4,0,1,'shade opacity');bounded(h.angle??0,-360,360,'shade angle');for(const k of ['x','y'])bounded(h[k]??.5,-2,2,'shade position');bounded(h.spacing??14,1,200,'hatch spacing');bounded(h.lineWidth??2,.1,20,'hatch width');}
 }
}
export function validateReceiver(r){if(!r)return;if(typeof r.enabled!=='boolean')throw Error('Motion receiver enabled must be boolean');bounded(r.lag??.2,.01,5,'response lag');bounded(r.strength??1,0,20,'response strength');for(const k of ['rotation','translation','bend'])bounded(r[k]??0,-20,20,'response '+k);}
// Spatial fields are scene data; receivers opt in with stiffness/damping/weight.
// Position uses world coordinates, with Y down in 2D and XYZ in 3D.
export function fieldForce(fields,position,time){const out=position.map(()=>0);for(const f of fields??[]){if(f.enabled===false)continue;const age=time-(f.start??0);if(age<0||age>(f.duration??1e9))continue;const center=position.map((_,i)=>(f.center[i]??0)+(f.velocity?.[i]??0)*age),d=position.map((v,i)=>v-center[i]),r=Math.hypot(...d),reach=f.radius;if(r>=reach)continue;
 let gain=(1-r/reach)**2*f.strength;
 if(f.kind==='pulse'){const arrival=r/(f.speed??200),t=age-arrival;if(t<0)continue;gain*=Math.exp(-t*(f.decay??4));}
 else gain*=.65+.35*Math.sin(age*(f.frequency??.8)*Math.PI*2-r/Math.max(1,reach)*2);
 for(let i=0;i<out.length;i++)out[i]+=gain*(f.radial?(r?d[i]/r:0):(f.direction?.[i]??0));
 }return out;}
export function fieldResponse(fields,position,time,receiver={}){const response=position.map(()=>0),lag=Math.max(.01,receiver.lag??.2),samples=12;let sum=0;
 for(let i=0;i<samples;i++){const age=i*lag*4/(samples-1),w=Math.exp(-age/lag);const force=(time-age<0?position.map(()=>0):fieldForce(fields,position,time-age));sum+=w;for(let k=0;k<response.length;k++)response[k]+=force[k]*w;}
 return response.map(x=>x/sum*(receiver.strength??1));}
export function validateFields(fields,dimension=2){if(!fields)return;if(!Array.isArray(fields)||fields.length>32)throw Error('Maximum 32 motion fields');const ids=new Set();for(const f of fields){if(!f.id||ids.has(f.id)||!['gust','pulse'].includes(f.kind))throw Error('Motion fields need unique IDs and gust/pulse kind');ids.add(f.id);for(const k of ['center','direction'])if(!Array.isArray(f[k])||f[k].length!==dimension||f[k].some(x=>!Number.isFinite(x)||Math.abs(x)>1e6))throw Error('Invalid motion field '+k);if(f.velocity&&(!Array.isArray(f.velocity)||f.velocity.length!==dimension||f.velocity.some(x=>!Number.isFinite(x))))throw Error('Invalid field movement');for(const k of ['radius','strength','start','duration','frequency','speed','decay'])if(f[k]!==undefined&&(!Number.isFinite(f[k])||Math.abs(f[k])>1e6))throw Error('Invalid field '+k);if(!Number.isFinite(f.radius)||!Number.isFinite(f.strength)||f.radius<=0||(f.speed??1)<=0||(f.duration??1)<=0)throw Error('Fields need positive reach, speed and duration');}}
