const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const hex=c=>'#'+c.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
export function blendColor(a,b,t){return hex(rgb(a).map((v,i)=>v+(rgb(b)[i]-v)*t));}
export function liquidPalette(color){return{color,shadow:blendColor(color,'#33233f',.32),highlight:blendColor(color,'#fff5e3',.5)};}
export function mixLiquid(fill,color,ingredient,amount){const added=Math.min(Math.max(0,1-fill),Math.max(0,amount)),next=fill+added;return{fill:next,color:next?blendColor(color,ingredient,added/next):ingredient,added};}

// Follow a world-vertical stream from the neck to the moving free surface.
export function pourImpact(surface, motion, mouth) {
  const direction=[Math.sin(motion.angle),Math.cos(motion.angle)],n=surface.normal,t=surface.tangent;
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1],denom=dot(direction,n);
  let distance=Math.max(0,(surface.level-dot(mouth,n))/Math.max(.05,denom));
  for(let i=0;i<3;i++){
    const point=mouth.map((v,k)=>v+direction[k]*distance),u=dot(point,t);
    const slice=surface.slices.reduce((best,s)=>Math.abs(s.u-u)<Math.abs(best.u-u)?s:best);
    distance=Math.max(0,(surface.level+slice.w-dot(mouth,n))/Math.max(.05,denom));
  }
  return mouth.map((v,k)=>v+direction[k]*(distance+6));
}
