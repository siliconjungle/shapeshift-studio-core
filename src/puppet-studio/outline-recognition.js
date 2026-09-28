/** Infer likely outline colours from alpha-boundary prevalence versus interior paint. */
export function inferOutlinePalette(pixels,width,height){
 const count=width*height,dist=new Uint16Array(count),queue=new Int32Array(count);let write=0,read=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*width+x;if(pixels[i*4+3]<160)continue;dist[i]=65535;if(x===0||y===0||x===width-1||y===height-1||[i-1,i+1,i-width,i+width].some(n=>pixels[n*4+3]<160)){dist[i]=1;queue[write++]=i;}}
 while(read<write){const i=queue[read++],x=i%width;for(const n of [x?i-1:-1,x<width-1?i+1:-1,i-width,i+width])if(n>=0&&n<count&&dist[n]>dist[i]+1){dist[n]=dist[i]+1;queue[write++]=n;}}
 const buckets=new Map();let edgeTotal=0,innerTotal=0;
 for(let i=0;i<count;i++){if(!dist[i]||dist[i]===65535)continue;const edge=dist[i]<=2;if(!edge&&dist[i]<6)continue;const rgb=Array.from(pixels.subarray(i*4,i*4+3)),key=rgb.map(c=>Math.floor(c/24)).join(','),v=buckets.get(key)??{edge:0,inner:0,rgb:[0,0,0],count:0};v[edge?'edge':'inner']++;v.count++;rgb.forEach((c,k)=>v.rgb[k]+=c);buckets.set(key,v);if(edge)edgeTotal++;else innerTotal++;}
 if(!edgeTotal||!innerTotal)return [];
 return [...buckets.values()].filter(v=>v.edge/edgeTotal>.1&&(v.edge/edgeTotal)>3*(v.inner/innerTotal+.01)).sort((a,b)=>b.edge-a.edge).slice(0,4).map(v=>v.rgb.map(c=>Math.round(c/v.count)));
}
export function isOutlineColour(r,g,b,colours=[],tolerance=36){return colours.length?colours.some(c=>Math.hypot(r-c[0],g-c[1],b-c[2])<=tolerance):Math.max(r,g,b)<78;}
