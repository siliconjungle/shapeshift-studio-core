// Recorded speech and animation share a seconds-based, seekable timeline.
export const VISEMES=['rest','MBP','AI','E','O','U','FV','L','WQ','TH','CDGKNRSTYZ'];
export const SPEECH_COMMANDS=['speech.chunk','speech.rig','speech.place','speech.remove'];
const channels=['x','y','rotation','scaleX','scaleY'];
const check=(ok,message)=>{if(!ok)throw Error('Speech: '+message);};
const number=(n,min,max)=>Number.isFinite(n)&&n>=min&&n<=max;
const id=s=>typeof s==='string'&&/^[\w.-]{1,80}$/.test(s)&&!(s in Object.prototype);
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
export function visemeWeights(cues,time,{attack=.035,release=.055,rest='rest'}={}){
 const weights={[rest]:0};let sum=0;
 for(const q of cues??[]){if(time<q.start-attack||time>q.end+release)continue;const w=Math.min(attack?smooth((time-q.start+attack)/attack):Number(time>=q.start),release?1-smooth((time-q.end)/release):Number(time<q.end));weights[q.pose]=(weights[q.pose]??0)+w;sum+=w;}
 if(sum>1)for(const key in weights)weights[key]/=sum;else weights[rest]+=1-sum;
 return weights;
}
export function envelopeAt(chunk,time){const e=chunk.envelope;if(!e?.length)return 0;const at=Math.max(0,time*(chunk.envelopeRate??60)),i=Math.floor(at);return (e[i]??0)+((e[i+1]??0)-(e[i]??0))*(at-i);}
export function validateSpeech(project){
 const speech=project.speech;if(!speech){check(!project.clips.some(c=>c.dialogue?.length),'dialogue requires a speech library');return;}
 check(speech.version===1,'unsupported version');
 for(const [key,c]of Object.entries(speech.chunks??{})){
  check(id(key),'invalid chunk ID');check(typeof c.src==='string'&&/^(data:audio\/|https?:\/\/|\.?\.?\/|\/)/.test(c.src),'audio needs an audio data URL, HTTP URL or explicit relative path');
  check(number(c.duration,.01,600),'chunk duration must be 0.01–600 seconds');check(Array.isArray(c.cues)&&c.cues.length<=10000,'provide timed viseme cues');let last=-1;
  for(const q of c.cues){check(VISEMES.includes(q.pose)&&number(q.start,0,c.duration)&&number(q.end,q.start+.000001,c.duration)&&q.start>=last,'invalid or unsorted viseme cue');last=q.start;}
  if(c.envelope){check(Array.isArray(c.envelope)&&c.envelope.length<=72000&&c.envelope.every(n=>number(n,0,1))&&number(c.envelopeRate,1,120),'invalid normalized audio envelope');}
 }
 const joints=new Set(project.joints.map(j=>j.id)),assets=new Set(project.assets.map(a=>a.id));
 for(const [key,r]of Object.entries(speech.rigs??{})){
  check(id(key),'invalid rig ID');check(number(r.attack??.035,0,.3)&&number(r.release??.055,0,.3),'invalid blend times');check(r.poses&&typeof r.poses==='object'&&!Array.isArray(r.poses),'provide named rig poses');
  for(const [pose,binding]of Object.entries(r.poses)){
   check(id(pose),'invalid pose name');
   for(const [joint,value]of Object.entries(binding.values??{})){check(joints.has(joint),'missing joint '+joint);for(const [k,v]of Object.entries(value))check(channels.includes(k)&&number(v,k.startsWith('scale')?.05:-10000,k.startsWith('scale')?20:10000),'invalid pose transform');}
   for(const [joint,asset]of Object.entries(binding.artwork??{}))check(joints.has(joint)&&assets.has(asset),'missing artwork or joint');
  }
  for(const [viseme,pose]of Object.entries(r.map??{}))check(VISEMES.includes(viseme)&&Object.hasOwn(r.poses,pose),'invalid viseme-to-pose binding');
  if(r.envelope){check(joints.has(r.envelope.joint)&&channels.includes(r.envelope.channel)&&number(r.envelope.amount,-100,100),'invalid envelope binding');}
 }
 for(const clip of project.clips){const seen=new Set(),events=clip.dialogue??[];check(Array.isArray(events)&&events.length<=256,'maximum 256 chunks per clip');
  for(const e of events){const c=speech.chunks?.[e.chunk],r=speech.rigs?.[e.rig];check(id(e.id)&&!seen.has(e.id)&&id(e.chunk)&&id(e.rig)&&Object.hasOwn(speech.chunks??{},e.chunk)&&Object.hasOwn(speech.rigs??{},e.rig)&&c&&r,'missing chunk/rig or duplicate event');seen.add(e.id);check(number(e.time,0,clip.duration)&&number(e.rate??1,.25,4)&&number(e.gain??.72,0,2),'invalid placement');check(e.time+c.duration/(e.rate??1)<=clip.duration+1e-6,'chunk extends beyond clip');
   for(const other of events){if(other===e||other.enabled===false||e.enabled===false||other.rig!==e.rig)continue;const d=speech.chunks[other.chunk];if(d)check(e.time>=other.time+d.duration/(other.rate??1)-1e-6||other.time>=e.time+c.duration/(e.rate??1)-1e-6,'chunks on one rig must not overlap');}
  }
 }
}
export function speechAt(project,clip,time){
 const transforms={},artwork={},active=[];
 for(const event of clip?.dialogue??[]){if(event.enabled===false)continue;const chunk=project.speech?.chunks?.[event.chunk],rig=project.speech?.rigs?.[event.rig];if(!chunk||!rig)continue;const local=(time-event.time)*(event.rate??1);if(local<0||local>=chunk.duration)continue;
  const weights=visemeWeights(chunk.cues,local,rig),mapped={};
  for(const [v,w]of Object.entries(weights)){const pose=rig.map?.[v]??(rig.poses[v]?v:'rest');mapped[pose]=(mapped[pose]??0)+w;}
  let chosen='rest',best=-1;for(const [pose,w]of Object.entries(mapped)){if(w>best){chosen=pose;best=w;}for(const [joint,values]of Object.entries(rig.poses[pose]?.values??{})){const t=transforms[joint]??={};for(const [k,v]of Object.entries(values))t[k]=(t[k]??0)+(v-(k.startsWith('scale')?1:0))*w;}}
  Object.assign(artwork,rig.poses[chosen]?.artwork??{});
  if(rig.envelope){const {joint,channel,amount}=rig.envelope,t=transforms[joint]??={};t[channel]=(t[channel]??0)+envelopeAt(chunk,local)*amount;}
  active.push({id:event.id,chunk:event.chunk,rig:event.rig,time:local,pose:chosen,viseme:Object.entries(weights).sort((a,b)=>b[1]-a[1])[0][0],weights});
 }
 return {transforms,artwork,active};
}
export function applySpeechCommand(project,c){
 check(c.dimension!==3,'author speech on a 2D puppet clip');project.speech??={version:1,chunks:{},rigs:{}};
 if(c.op==='speech.chunk'||c.op==='speech.rig'){check(id(c.id),'invalid ID');project.speech[c.op==='speech.chunk'?'chunks':'rigs'][c.id]=structuredClone(c.value);}
 else{const clip=project.clips.find(x=>x.id===c.clip);check(clip,'choose a clip');clip.dialogue??=[];if(c.op==='speech.remove')clip.dialogue=clip.dialogue.filter(e=>e.id!==c.id);else if(c.op==='speech.place'){const event={id:c.id,time:c.time??0,chunk:c.chunk,rig:c.rig,rate:c.rate??1,gain:c.gain??.72,enabled:c.enabled!==false},at=clip.dialogue.findIndex(e=>e.id===c.id);if(at<0)clip.dialogue.push(event);else clip.dialogue[at]=event;clip.dialogue.sort((a,b)=>a.time-b.time);}else throw Error('Unknown speech command');}
 validateSpeech(project);return c.id;
}
