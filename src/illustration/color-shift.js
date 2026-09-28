// Per-artwork colour transforms. Geometry and alpha are untouched.
export const colorShiftDefaults=()=>({enabled:true,mode:'tint',color:'#976bc4',amount:0,hue:0,preserveInk:true,inkThreshold:.2});
const clamp=x=>Math.max(0,Math.min(1,x));
export function validateColorShift(c){
 if(!c||!['tint','hue'].includes(c.mode)||!/^#[\da-f]{6}$/i.test(c.color))throw Error('Invalid colour shift');
 for(const [k,lo,hi]of [['amount',0,1],['hue',-360,360],['inkThreshold',0,.5]])if(!Number.isFinite(c[k])||c[k]<lo||c[k]>hi)throw Error('Invalid colour shift '+k);
 for(const k of ['enabled','preserveInk'])if(typeof c[k]!=='boolean')throw Error('Invalid colour shift '+k);
 return c;
}
export function shiftRGB(rgb,c){
 if(!c?.enabled||!c.amount)return rgb;
 const [r,g,b]=rgb.map(x=>x/255),lum=.2126*r+.7152*g+.0722*b;
 const protection=c.preserveInk?clamp((lum-c.inkThreshold)/.15):1,t=c.amount*protection;
 let target;
 if(c.mode==='hue'){
  const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,s=max?d/max:0;
  let h=d===0?0:max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;
  h=((h+c.hue/60)%6+6)%6;const chroma=max*s,x=chroma*(1-Math.abs(h%2-1)),m=max-chroma;
  target=([[chroma,x,0],[x,chroma,0],[0,chroma,x],[0,x,chroma],[x,0,chroma],[chroma,0,x]][Math.floor(h)]).map(v=>v+m);
 }else{
  const tint=[1,3,5].map(i=>parseInt(c.color.slice(i,i+2),16)/255);
  // Keep tonal structure instead of replacing every fill with one flat swatch.
  const tl=.2126*tint[0]+.7152*tint[1]+.0722*tint[2];target=tint.map(v=>clamp(v+lum-tl));
 }
 return rgb.map((v,i)=>Math.round(v+(target[i]*255-v)*t));
}
export function shiftColor(color,c){if(!/^#[\da-f]{6}$/i.test(color)||!c?.enabled||!c.amount)return color;return '#'+shiftRGB([1,3,5].map(i=>parseInt(color.slice(i,i+2),16)),c).map(v=>v.toString(16).padStart(2,'0')).join('');}
