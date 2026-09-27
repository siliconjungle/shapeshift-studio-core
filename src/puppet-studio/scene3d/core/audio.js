import {evaluate} from './expression.js';
// Authored oscillator, noise, and envelope definitions supply the sound palette.
// State-driven beds follow simulation progress instead of running ahead of it.
export class ProceduralAudio {
 constructor(definition,context=null,{random=Math.random}={}){this.definition=structuredClone(definition);this.random=random;this.variants=new Map();this.lastCue=new Map();this.cast=null;this.context=context;this.volume=definition.volume;this.enabled=true;this.voices=new Set();this.beds=[];this.state='';this.events=[];if(context)this.connect();}
 connect(){const c=this.context;this.master=c.createGain();this.master.gain.value=this.volume;this.compressor=c.createDynamicsCompressor();for(const [name,value]of Object.entries(this.definition.compressor))this.compressor[name].value=value;this.master.connect(this.compressor);this.compressor.connect(c.destination);const n=c.sampleRate*this.definition.noise.seconds;this.noise=c.createBuffer(1,n,c.sampleRate);const data=this.noise.getChannelData(0);let seed=this.definition.noise.seed;for(let i=0;i<n;i++){seed=(Math.imul(seed,this.definition.noise.multiplier)+this.definition.noise.increment)|0;data[i]=(seed>>>0)/2147483648-1;}}
 unlock(){if(!this.enabled)return;try{if(!this.context){this.context=new (window.AudioContext||window.webkitAudioContext)();this.connect();}if(this.context.state==='suspended')this.context.resume().catch(()=>{});}catch{this.enabled=false;}}
 setVolume(value){this.volume=Math.max(0,Math.min(1,value));if(this.master)this.master.gain.setTargetAtTime(this.enabled?this.volume:0,this.context.currentTime,.02);}
 setEnabled(value){this.enabled=!!value;if(!value)this.stop();else this.unlock();this.setVolume(this.volume);}
 variant(kind){
  const config=this.definition.variation;let entry=this.variants.get(kind);if(!entry){entry={bag:[],last:-1};this.variants.set(kind,entry);}
  if(!entry.bag.length){entry.bag=config.semitones.map((_,i)=>i);for(let i=entry.bag.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[entry.bag[i],entry.bag[j]]=[entry.bag[j],entry.bag[i]];}if(entry.bag.at(-1)===entry.last){const end=entry.bag.length-1;[entry.bag[0],entry.bag[end]]=[entry.bag[end],entry.bag[0]];}}
  const index=entry.bag.pop();entry.last=index;const r=([a,b])=>a+(b-a)*this.random();
  return {index,pitch:2**((config.semitones[index]+r(config.pitchJitter))/12),gain:r(config.gain),duration:r(config.duration),tone:config.tones[index]*r(config.toneJitter),ring:r(config.ring),phase:r(config.phase),pulse:r(config.pulse),drift:r(config.drift),delay:r(config.delay)};
 }

 voice({type='sine',frequency=100,end=frequency,duration=.3,gain=.15,delay=0,filter=0,loop=false}){
  const c=this.context;if(!c||!this.enabled)return null;const t=c.currentTime+delay,s=type==='noise'?c.createBufferSource():c.createOscillator(),g=c.createGain();let f=null;
  if(type==='noise'){s.buffer=this.noise;s.loop=loop;s.playbackRate.value=this.definition.voice.noiseRateBase+this.random()*this.definition.voice.noiseRateSpread;}else{s.type=type;s.frequency.setValueAtTime(frequency,t);if(!loop)s.frequency.exponentialRampToValueAtTime(Math.max(15,end),t+duration);}
  if(filter){f=c.createBiquadFilter();f.type=type==='noise'?'bandpass':'lowpass';f.frequency.value=filter;f.Q.value=type==='noise'?this.definition.voice.noiseQ:this.definition.voice.toneQ;s.connect(f);f.connect(g);}else s.connect(g);
  g.connect(this.master);g.gain.setValueAtTime(loop?gain:.0001,t);if(!loop){g.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),t+this.definition.voice.attack);g.gain.exponentialRampToValueAtTime(.0001,t+duration);}
  const v={s,g,f,stopped:false};this.voices.add(v);s.onended=()=>{s.disconnect();f?.disconnect();g.disconnect();this.voices.delete(v);};if(type==='noise')s.start(t,this.random()*(loop?this.noise.duration:this.definition.voice.noiseOffset));else s.start(t);if(!loop)s.stop(t+duration+this.definition.voice.tail);return v;
 }
 stopVoice(v){if(!v||v.stopped)return;v.stopped=true;const t=this.context.currentTime;v.g.gain.cancelScheduledValues(t);v.g.gain.setTargetAtTime(.0001,t,this.definition.voice.stopSmoothing);try{v.s.stop(t+this.definition.voice.stopTail);}catch{}}
 stopBeds(){for(const v of this.beds)this.stopVoice(v);this.beds=[];}
 stop(){this.stopBeds();for(const v of this.voices)this.stopVoice(v);this.state='';this.cast=null;}
 cue(kind,strength=1){if(!this.context||!this.enabled||this.paused)return;this.events.push(kind);if(this.events.length>80)this.events.shift();const config=this.definition.cueVariation,v=this.variant(kind),now=this.context.currentTime,previous=this.lastCue.get(kind)??-Infinity,repetition=now-previous<config.repeatWindow?config.repeatGain:1;this.lastCue.set(kind,now);const gain=strength*v.gain*repetition;
  for(const layer of this.definition.cues[kind]??[]){if(layer.kind==='noise'){this.voice({type:'noise',duration:layer.duration*v.duration,gain:layer.gain*gain,filter:layer.filter*v.tone,delay:layer.delay*v.delay});}else{const f=layer.frequency,pitch=f<config.bassThreshold?Math.sqrt(v.pitch):v.pitch*(config.tonePitchBase+this.random()*config.tonePitchSpread);this.voice({frequency:f*pitch,end:layer.end*pitch,duration:layer.duration*v.duration,gain:layer.gain*gain*(f>config.ringThreshold?v.ring:1),type:layer.type,delay:layer.delay?Math.max(config.minimumDelay,layer.delay*v.delay+(this.random()-.5)*config.delayJitter):0});}}
 }
 sync(state,elapsed){if(!this.context||!this.enabled||this.paused)return;const kind=this.definition.states[state]??'';
  if(kind!==this.state){const previous=this.state,previousBed=this.definition.beds[previous];this.stopBeds();this.state=kind;const bed=this.definition.beds[kind];if(bed){if(!bed.reuseFrom?.includes(previous)||!this.cast)this.cast=this.variant(bed.variation);if(bed.enterCue)this.cue(bed.enterCue);this.beds=bed.voices.map(voice=>this.voice(voice));}else if(previousBed?.exitCue&&previousBed.exitTo.includes(kind))this.cue(previousBed.exitCue);}
  const bed=this.definition.beds[kind];if(!bed)return;const variables={state,elapsed,variant:this.cast};for(const [name,expression]of bed.variables)variables[name]=evaluate(expression,variables);const t=this.context.currentTime;for(const automation of bed.automation){const voice=this.beds[automation.voice],parameter=automation.parameter==='frequency'?voice.s.frequency:automation.parameter==='gain'?voice.g.gain:automation.parameter==='filter'?voice.f.frequency:null;if(!parameter)throw Error('Invalid audio automation target '+automation.parameter);parameter.setTargetAtTime(evaluate(automation.value,variables),t,automation.smoothing);}
 }

 dispose(){this.stop();this.master?.disconnect();this.compressor?.disconnect();this.context?.close?.();}
}
