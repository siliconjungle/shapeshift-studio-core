// Shared cutout keyframe math used by Studio and in-game god portraits.
import {easing} from './fx/math.js';
export const CHANNELS = ['x', 'y', 'rotation', 'scaleX', 'scaleY'];
export const identity = () => ({x:0, y:0, rotation:0, scaleX:1, scaleY:1});
export const clone = value => structuredClone(value);
export const clamp = (x,a,b) => Math.min(b,Math.max(a,x));
export const multiply = (a,b) => [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
export const point = (m,p) => ({x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]});
export function inverse(m){const d=m[0]*m[3]-m[1]*m[2];if(Math.abs(d)<1e-10)throw Error('A joint cannot have zero scale.');return [m[3]/d,-m[1]/d,-m[2]/d,m[0]/d,(m[2]*m[5]-m[3]*m[4])/d,(m[1]*m[4]-m[0]*m[5])/d];}
export function matrix(t){const a=t.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return [c*t.scaleX,s*t.scaleX,-s*t.scaleY,c*t.scaleY,t.x,t.y];}
export function sampleTrack(keys,time){
  if(!keys?.length)return identity();
  if(time<=keys[0].time)return {...identity(),...keys[0].value};
  const last=keys.at(-1);if(time>=last.time)return {...identity(),...last.value};
  const end=keys.findIndex(k=>k.time>time),a=keys[end-1],b=keys[end];
  let u=(time-a.time)/(b.time-a.time);
  u=easing(u,a.easing,a.bezier);
  const v=identity();for(const c of CHANNELS)v[c]=(a.value[c]??v[c])+((b.value[c]??v[c])-(a.value[c]??v[c]))*u;
  return v;
}
