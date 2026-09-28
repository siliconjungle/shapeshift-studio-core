import {gradingValues,validateGrading} from './color-grading.js';
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=(a,b,v)=>{const x=clamp((v-a)/(b-a));return x*x*(3-2*x)};
const luminance=c=>c[0]*.2126+c[1]*.7152+c[2]*.0722;
const linear=v=>v<.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);
const srgb=v=>v<.0031308?v*12.92:1.055*Math.pow(Math.max(0,v),1/2.4)-.055;
/** CPU equivalent of gradeSRGB in the shared shader. Straight-alpha sRGB in/out. */
export function gradePixels(frame,grading){
 validateGrading(grading);const {gradeTone:t,gradeBalance:b,gradeShadows:s,gradeHighlights:h}=gradingValues(grading);
 if(!t[0])return frame;
 const data=new Uint8Array(frame.data.length),sl=luminance(s),hl=luminance(h),gain=2**t[1];
 for(let p=0;p<data.length;p+=4){const source=[frame.data[p]/255,frame.data[p+1]/255,frame.data[p+2]/255],lum=luminance(source);
  let c=source.map((v,i)=>(srgb(linear(v)*gain)*[1+b[0]*.14,1+b[1]*.1,1-b[0]*.14][i]-.5)*t[2]+.5);const l=luminance(c),ink=(1-b[3])+b[3]*smooth(.015,.15,lum),amount=t[0]*ink;
  for(let k=0;k<3;k++){const graded=l+(c[k]-l)*t[3]+b[2]*((s[k]-sl)*(1-smooth(.1,.65,lum))+(h[k]-hl)*smooth(.35,.95,lum));data[p+k]=Math.round((source[k]+(clamp(graded)-source[k])*amount)*255)}
  data[p+3]=frame.data[p+3];
 }
 return {...frame,data};
}
