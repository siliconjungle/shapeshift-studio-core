// One palette for the entire clip; no per-frame clustering or colour renumbering.
export const TRANSPARENT = 65535;
export const colorDistance = (r,g,b,c) => .3*(r-c[0])**2 + .59*(g-c[1])**2 + .11*(b-c[2])**2;
export const hexColor = c => '#'+c.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
export function parsePalette(palette) {
  if (!Array.isArray(palette) || palette.length < 2 || palette.length > 256) throw Error('palette must contain 2–256 colours');
  return palette.map(c => {
    if (typeof c !== 'string' || !/^#[0-9a-f]{6}$/i.test(c)) throw Error('palette colours must be #rrggbb');
    return [1,3,5].map(i=>parseInt(c.slice(i,i+2),16));
  });
}
export function buildPalette(frames, {colors=24, palette, alphaThreshold=128,minColorDistance=14}={}) {
  if (palette) return parsePalette(palette);
  const bins = new Map(), total = frames.reduce((n,f)=>n+f.data.length/4,0);
  const step = Math.max(1,Math.floor(total/24000));
  let serial=0;
  for (const frame of frames) for (let p=0;p<frame.data.length;p+=4,serial++) {
    if (serial%step || frame.data[p+3]<alphaThreshold) continue;
    const d=frame.data,key=(d[p]>>3)*1024+(d[p+1]>>3)*32+(d[p+2]>>3);
    let entry=bins.get(key);
    if (!entry) bins.set(key,entry={n:0,r:0,g:0,b:0});
    entry.n++;entry.r+=d[p];entry.g+=d[p+1];entry.b+=d[p+2];
  }
  if (!bins.size) return [[0,0,0],[255,255,255]];
  const samples=[...bins.values()].map(v=>({n:v.n,c:[v.r/v.n,v.g/v.n,v.b/v.n]}));
  samples.sort((a,b)=>b.n-a.n || a.c[0]-b.c[0] || a.c[1]-b.c[1] || a.c[2]-b.c[2]);
  const centers=[samples[0].c.slice()], distances=new Float64Array(samples.length).fill(Infinity);
  while (centers.length<Math.min(colors,samples.length)) {
    let best=-1,score=-1;
    samples.forEach((v,i)=>{
      distances[i]=Math.min(distances[i],colorDistance(...v.c,centers.at(-1)));
      const s=distances[i]*Math.sqrt(v.n);if(s>score){score=s;best=i;}
    });
    if(score<1e-6)break;
    centers.push(samples[best].c.slice());
  }
  let weights=centers.map(()=>1);
  for(let iteration=0;iteration<10;iteration++) {
    const sums=centers.map(()=>[0,0,0,0]);
    for(const v of samples) {
      let best=0,error=Infinity;
      centers.forEach((c,i)=>{const e=colorDistance(...v.c,c);if(e<error){best=i;error=e}});
      const s=sums[best];s[0]+=v.c[0]*v.n;s[1]+=v.c[1]*v.n;s[2]+=v.c[2]*v.n;s[3]+=v.n;
    }
    sums.forEach((s,i)=>{if(s[3])centers[i]=s.slice(0,3).map(v=>v/s[3])});weights=sums.map(s=>s[3]);
  }
  // Near-identical clusters turn compression grain into separate painted shapes.
  // Merge once over the entire clip, preserving distinct dark painted shadows.
  while(centers.length>2){
    let pair=null,best=minColorDistance**2;
    for(let i=0;i<centers.length;i++)for(let j=i+1;j<centers.length;j++){
      const d=colorDistance(...centers[i],centers[j]);if(d<best){best=d;pair=[i,j]}
    }
    if(!pair)break;
    const [i,j]=pair,total=weights[i]+weights[j]||1;
    centers[i]=centers[i].map((v,k)=>(v*weights[i]+centers[j][k]*weights[j])/total);weights[i]=total;
    centers.splice(j,1);weights.splice(j,1);
  }
  return [...new Map(centers.map(c=>{c=c.map(Math.round);return [hexColor(c),c]})).values()]
    .sort((a,b)=>(a[0]*.3+a[1]*.59+a[2]*.11)-(b[0]*.3+b[1]*.59+b[2]*.11));
}
export function paletteClassifier(palette) {
  // Two candidates retain boundary precision without a full palette scan per pixel.
  const table=new Uint16Array(32768*2);
  for(let key=0;key<32768;key++) {
    const r=((key>>10)&31)*8+3.5,g=((key>>5)&31)*8+3.5,b=(key&31)*8+3.5;
    let first=0,second=0,a=Infinity,z=Infinity;
    palette.forEach((c,i)=>{const d=colorDistance(r,g,b,c);if(d<a){second=first;z=a;first=i;a=d}else if(d<z){second=i;z=d}});
    table[key*2]=first;table[key*2+1]=second;
  }
  return (r,g,b)=>{
    const k=((r>>3)*1024+(g>>3)*32+(b>>3))*2,a=table[k],z=table[k+1];
    return colorDistance(r,g,b,palette[z])<colorDistance(r,g,b,palette[a])?z:a;
  };
}
