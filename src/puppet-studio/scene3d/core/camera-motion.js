import {sampleShake,decayShake} from './motion.js';
export const cameraMotionDefaults=()=>({rate:50,decay:12,channels:[{frequency:12.9898,phase:0},{frequency:78.233,phase:1},{frequency:0,phase:0}]});
export function validateCameraMotion(d){const n=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max; if(!d||!n(d.rate,.1,1000)||!n(d.decay,0,1000)||!Array.isArray(d.channels)||d.channels.length!==3||!d.channels.every(c=>n(c.frequency,-10000,10000)&&n(c.phase,-10000,10000)))throw Error('3D camera: invalid shake profile');}
// Same update order as a live action controller: advance the non-frozen clock,
// decay the previous impulse, then accept this frame's newly triggered impulses.
// A seek has no previous frame; evaluate the authored envelope at its exact age.
export class CameraMotion {
 constructor(definition=cameraMotionDefaults()){this.configure(definition);this.reset();}
 configure(definition){validateCameraMotion(definition);this.definition=definition;}
 reset(clock=0){this.clock=clock;this.amplitude=0;this.lastClip=null;this.lastTime=-Infinity;this.offset=[0,0,0];}
 impulse(amount,mode='replace'){this.amplitude=mode==='add'?this.amplitude+amount:mode==='max'?Math.max(this.amplitude,amount):amount;}
 advance(dt){this.clock+=dt;this.amplitude=decayShake(this.amplitude,dt,this.definition);}
 sample(clip,time,{clock=time,continuous=false}={}){
  const ordered=clip.events.filter(e=>e.type==='shake').map((e,i)=>({e,i})).sort((a,b)=>a.e.time-b.e.time||a.i-b.i).map(x=>x.e);
  const forward=continuous&&this.lastClip!==null&&clock>=this.clock;
  if(forward){this.advance(clock-this.clock);const from=this.lastClip===clip.id&&time>=this.lastTime?this.lastTime:-Infinity;for(const e of ordered)if(e.time>from&&e.time<=time)this.impulse(e.amount??.08,e.shakeMode);}
  else{this.amplitude=0;let previous=0;for(const e of ordered){if(e.time>time)break;this.amplitude=decayShake(this.amplitude,e.time-previous,this.definition);this.impulse(e.amount??.08,e.shakeMode);previous=e.time;}this.amplitude=decayShake(this.amplitude,Math.max(0,time-previous),this.definition);}
  this.clock=clock;this.lastClip=clip.id;this.lastTime=time;this.offset=sampleShake(clock,this.amplitude,this.definition);return this.offset;
 }
 snapshot(){return{clock:this.clock,amplitude:this.amplitude,offset:this.offset.slice(),clip:this.lastClip,time:this.lastTime};}
}
