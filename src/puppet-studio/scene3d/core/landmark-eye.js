// Landmark-driven plane warp, cutout and iris aperture; dimensions and timing
// belong to an authored eye definition rather than any particular character.
const scalar=n=>Number.isInteger(n)?n+'.':String(n);
export function landmarkEyeGLSL({depth,halfHeight,samples=64,normalStep='.002'}){
 if(!Number.isFinite(depth)||!Number.isFinite(halfHeight)||halfHeight<=0||!Number.isInteger(samples)||samples<8||samples>256||samples%2)throw Error('Invalid landmark eye geometry');
 if(!/^\.?\d+(?:\.\d+)?$/.test(String(normalStep)))throw Error('Invalid eye normal sampling step');
 const half=samples/2;
return `
uniform vec4 eyeBounds;uniform vec2 eyeCenter;uniform vec2 eyeContour[${samples}];uniform float blink,eyeTilt;uniform vec2 gaze;
float frontDepth(vec2 p){return ${scalar(depth)};}
vec2 eyeRange(float x){float u=clamp((x-eyeContour[0].x)/(eyeContour[${half-1}].x-eyeContour[0].x)*${half-1}.,0.,${half-1-.0001});int i=int(floor(u));float t=fract(u);return vec2(mix(eyeContour[${samples-1}-i].y,eyeContour[${samples-2}-i].y,t),mix(eyeContour[i].y,eyeContour[i+1].y,t));}
vec2 warpFront(vec2 p){if(p.x<=eyeContour[0].x||p.x>=eyeContour[${half-1}].x)return p;vec2 range=eyeRange(p.x);float y=p.y-eyeCenter.y;float h=max(.001,y>=0.?range.y-eyeCenter.y:eyeCenter.y-range.x);float ay=abs(y);float falloff=1.-smoothstep(h,${scalar(halfHeight)}-abs(eyeCenter.y),ay);float change=ay<h?y*(1.-blink):sign(y)*h*(1.-blink)*falloff;p.y-=change;p.y+=eyeTilt*(p.x-eyeCenter.x)*falloff;return p;}
vec2 unwarpEye(vec2 p){p.y-=eyeTilt*(p.x-eyeCenter.x);p.y=eyeCenter.y+(p.y-eyeCenter.y)/max(.02,blink);return p;}
bool insideEye(vec2 p){p=unwarpEye(p);bool inside=false;vec2 a=eyeContour[${samples-1}];for(int i=0;i<${samples};i++){vec2 b=eyeContour[i];if((a.y>p.y)!=(b.y>p.y)){float x=(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x;if(p.x<x)inside=!inside;}a=b;}return inside;}
vec3 frontNormal(vec2 p){float d=${normalStep};return normalize(vec3(-(frontDepth(p+vec2(d,0.))-frontDepth(p-vec2(d,0.)))/(d*2.),-(frontDepth(p+vec2(0.,d))-frontDepth(p-vec2(0.,d)))/(d*2.),1.));}
`;
}
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
export const sampleBlinkPulse=(t,d)=>t<0||t>d.duration?0:t<d.close?smooth(t/d.close):t<d.holdEnd?1:1-smooth((t-d.holdEnd)/d.open);
export function sampleBlink(time,forcedAt,definition){const cycle=((time%definition.cycle)+definition.cycle)%definition.cycle;return Math.max(sampleBlinkPulse(time-forcedAt,definition),...definition.at.map(s=>sampleBlinkPulse(cycle-s,definition)));}
