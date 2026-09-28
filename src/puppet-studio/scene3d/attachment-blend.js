import {inferOutlinePalette,isOutlineColour} from '../outline-recognition.js';

const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
/** Local end-cap repair for overlapping puppet attachments. Alpha and source data
 * stay unchanged. Only ink contiguous with the chosen terminal edge is repaired;
 * side ink and enclosed drawn marks are retained. Length is in texture pixels. */
export function blendAttachmentPixels(source,width,height,{enabled=true,end='top',length=height*.15,strength=1,matchColor=true,colour,inkColors=[]}={}){
 const output=new Uint8ClampedArray(source);
 if(!enabled||strength<=0||length<=0)return output;
 const colors=inkColors.length?inkColors.map(rgb):inferOutlinePalette(source,width,height);
 const ink=i=>isOutlineColour(source[i*4],source[i*4+1],source[i*4+2],colors);
 const opaque=i=>source[i*4+3]===255;
 const paint=i=>Array.from(source.subarray(i*4,i*4+3));
 const row=y=>end==='bottom'?height-1-y:y;
 const buckets=new Map();
 // Most prevalent non-ink pigment. Distinct pale marks and other painted regions
 // do not get recoloured just because they lie inside the attachment zone.
 for(let i=0;i<width*height;i++)if(opaque(i)&&!ink(i)){
  const c=paint(i),key=c.map(v=>Math.floor(v/24)).join(','),bucket=buckets.get(key)??{count:0,total:[0,0,0]};bucket.count++;c.forEach((v,k)=>bucket.total[k]+=v);buckets.set(key,bucket);
 }
 const base=[...buckets.values()].sort((a,b)=>b.count-a.count)[0];
 if(!base)return output;
 const fill=base.total.map(v=>v/base.count),target=colour?rgb(colour):fill;
 const span=Math.min(height/2,length),limit=Math.min(height,Math.ceil(span)),fade=y=>{const t=Math.max(0,1-y/span);return t*t*(3-2*t)*strength;};
 const sides=[];
 for(let y=0;y<limit;y++){
  let left=width,right=-1;for(let x=0;x<width;x++)if(source[(row(y)*width+x)*4+3]>=160){left=Math.min(left,x);right=x;}
  let l=left,r=right;while(l<=right&&ink(row(y)*width+l))l++;while(r>=left&&ink(row(y)*width+r))r--;
  sides[y]={left,right,guard:Math.max(1,Math.min(width*.2,Math.max(l-left,right-r)))};
 }
 // Trace inward from the chosen end of each column. Stop at the first pigment,
 // so internal marks never become candidates for ink erasure.
 for(let x=0;x<width;x++){
  let start=-1,seed=-1;const candidates=[];
  for(let y=0;y<limit;y++){
   const i=row(y)*width+x;
   if(source[i*4+3]<160){if(start>=0)break;continue;}
   if(start<0)start=y;
   if(!ink(i)){if(opaque(i))seed=i;break;}
   if(opaque(i))candidates.push([i,y]);
  }
  if(seed<0)continue;
  for(const [i,y]of candidates){const {left,right,guard}=sides[y];if(x-left<=guard||right-x<=guard)continue;const f=fade(y),c=paint(seed);for(let k=0;k<3;k++)output[i*4+k]=source[i*4+k]+(c[k]-source[i*4+k])*f;}
 }
 if(matchColor&&colour)for(let y=0;y<limit;y++)for(let x=0;x<width;x++){
  const i=row(y)*width+x;if(!opaque(i))continue;
  const c=Array.from(output.subarray(i*4,i*4+3));if(distance(c,fill)>48)continue;
  const f=fade(y);for(let k=0;k<3;k++)output[i*4+k]=c[k]+(target[k]-c[k])*f;
 }
 return output;
}
