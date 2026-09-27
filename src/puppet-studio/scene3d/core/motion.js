// Exact damped spring response remains stable across frame durations.
export function poseAt(time,keys){let a=keys[0],b=keys.at(-1);for(let i=1;i<keys.length;i++)if(time<=keys[i][0]){a=keys[i-1];b=keys[i];break;}const p=Math.max(0,Math.min(1,(time-a[0])/(b[0]-a[0]))),t=p*p*(3-2*p);return a.slice(1).map((v,i)=>v+(b[i+1]-v)*t);}
export function spring(value,velocity,target,dt,frequency=26,dampingRatio=.65){if(![value,velocity,target,dt,frequency,dampingRatio].every(Number.isFinite)||dt<0||frequency<0||dampingRatio<0)throw Error('Invalid spring parameters');
 if(frequency===0)return[value+velocity*dt,velocity];
 if(dampingRatio===1){const o=value-target,k=velocity+frequency*o,e=Math.exp(-frequency*dt);return[target+(o+k*dt)*e,(velocity-frequency*k*dt)*e];}
 if(dampingRatio>1){const o=value-target,z=Math.sqrt(dampingRatio*dampingRatio-1),a=-frequency/(dampingRatio+z),b=-frequency*(dampingRatio+z),c=(velocity-b*o)/(a-b),d=o-c,ea=Math.exp(a*dt),eb=Math.exp(b*dt);return[target+c*ea+d*eb,a*c*ea+b*d*eb];}
 const d=frequency*dampingRatio,w=frequency*Math.sqrt(1-dampingRatio*dampingRatio),e=Math.exp(-d*dt),s=Math.sin(w*dt),c=Math.cos(w*dt),o=value-target;return [target+e*(o*c+(velocity+d*o)*s/w),e*(velocity*c-(d*velocity+frequency*frequency*o)*s/w)];}

// Camera noise is sampled on an authored clock, not on render frame count.
export function sampleShake(clock,amplitude,definition){const tick=Math.floor(clock*definition.rate);return definition.channels.map(c=>Math.sin(tick*c.frequency+c.phase)*amplitude);}
export function decayShake(amplitude,dt,definition){return amplitude*Math.exp(-dt*definition.decay);}
