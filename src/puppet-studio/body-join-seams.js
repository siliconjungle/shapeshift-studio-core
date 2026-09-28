import {isOutlineColour} from './outline-recognition.js';
import {point} from './joint-transforms.js';
let buffers;
function surfaces(size){if(!buffers)buffers=Array.from({length:3},()=>{const canvas=document.createElement('canvas');return {canvas,ctx:canvas.getContext('2d',{willReadFrequently:true})};});for(const s of buffers){if(s.canvas.width!==size)s.canvas.width=s.canvas.height=size;s.ctx.resetTransform();s.ctx.clearRect(0,0,size,size);}return buffers;}
export function maskDistance(mask,width,height){
 const d=new Float32Array(mask.length);for(let i=0;i<d.length;i++)d[i]=mask[i]?Math.min(i%width+1,width-i%width,Math.floor(i/width)+1,height-Math.floor(i/width)):0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*width+x;if(x)d[i]=Math.min(d[i],d[i-1]+1);if(y)d[i]=Math.min(d[i],d[i-width]+1);if(x&&y)d[i]=Math.min(d[i],d[i-width-1]+Math.SQRT2);if(y&&x<width-1)d[i]=Math.min(d[i],d[i-width+1]+Math.SQRT2);}
 for(let y=height-1;y>=0;y--)for(let x=width-1;x>=0;x--){const i=y*width+x;if(x<width-1)d[i]=Math.min(d[i],d[i+1]+1);if(y<height-1)d[i]=Math.min(d[i],d[i+width]+1);if(x<width-1&&y<height-1)d[i]=Math.min(d[i],d[i+width+1]+Math.SQRT2);if(x&&y<height-1)d[i]=Math.min(d[i],d[i+width-1]+Math.SQRT2);}
 return d;
}

// Repair only an internal boundary of a joined piece. Exterior ink and
// internal drawn details are protected by their distance to the silhouettes.
export function joinSeamPixels(body,part,width,height,{maxStroke=8,matches=[],inkColors=[]}={}){
 const dark=(p,i)=>isOutlineColour(p[i*4],p[i*4+1],p[i*4+2],inkColors);
 const count=width*height,am=new Uint8Array(count),bm=new Uint8Array(count),union=new Uint8Array(count),source=new Uint8ClampedArray(count*4);
 for(let i=0;i<count;i++){am[i]=body[i*4+3]>160;bm[i]=part[i*4+3]>160;union[i]=am[i]||bm[i];const top=bm[i]?part:body;source.set(top.subarray(i*4,i*4+4),i*4);}
 const ad=maskDistance(am,width,height),bd=maskDistance(bm,width,height),ud=maskDistance(union,width,height),stroke=[];
 for(let i=0;i<count;i++){if(am[i]&&dark(body,i)&&ad[i]<=maxStroke)stroke.push(ad[i]);if(bm[i]&&dark(part,i)&&bd[i]<=maxStroke)stroke.push(bd[i]);}stroke.sort((a,b)=>a-b);const lineWidth=Math.max(1.2,Math.min(maxStroke,(stroke[Math.floor(stroke.length*.9)]??2)+.5));
 const nearest=new Int32Array(count).fill(-1),queue=new Int32Array(count);let read=0,write=0;
 for(let i=0;i<count;i++)if(union[i]&&!dark(source,i)){nearest[i]=i;queue[write++]=i;}
 while(read<write){const i=queue[read++],x=i%width;for(const n of [x?i-1:-1,x<width-1?i+1:-1,i-width,i+width])if(n>=0&&n<count&&union[n]&&nearest[n]<0){nearest[n]=nearest[i];queue[write++]=n;}}
 const output=new Uint8ClampedArray(count*4);
 for(let i=0;i<count;i++){
  // Leave translucent paint to the normal compositor; an opaque repair
  // would otherwise undo fades or cover translucent artwork.
  if(!union[i]||ud[i]<=lineWidth||source[i*4+3]<255||(part[i*4+3]>0&&part[i*4+3]<255))continue;const x=(i%width+.5)/width*2-1,y=(Math.floor(i/width)+.5)/height*2-1,r=Math.hypot(x,y);if(r>=.92)continue;
  const boundary=bm[i]?bd[i]<=lineWidth+1:ad[i]<=lineWidth+1,repair=dark(source,i)&&boundary;
  let colour=Array.from(source.subarray(i*4,i*4+3));
  if(repair){if(am[i]&&!dark(body,i))colour=Array.from(body.subarray(i*4,i*4+3));else if(nearest[i]>=0)colour=Array.from(source.subarray(nearest[i]*4,nearest[i]*4+3));else continue;}
  if(isOutlineColour(...colour,inkColors))continue;
  let match=null,score=48;for(const m of matches){const d=Math.min(Math.hypot(...colour.map((v,k)=>v-m.body[k])),Math.hypot(...colour.map((v,k)=>v-m.part[k])));if(d<score){score=d;match=m;}}
  const fade=Math.min(1,Math.max(0,(.92-r)/.4));if(match)colour=colour.map((v,k)=>v+(match.colour[k]-v)*fade);
  if(repair||match){output.set(colour,i*4);output[i*4+3]=repair?255:Math.round(255*fade);}
 }
 return output;
}
export function drawBodyJoinSeam(ctx,frame,bodyWorld,drawBody,drawPart){
 if(!frame?.profile||frame.matchEdges===false)return;
 const centre=point(bodyWorld,{x:frame.anchor[0]+frame.dx,y:frame.anchor[1]+frame.dy}),worldScale=Math.max(Math.hypot(bodyWorld[0],bodyWorld[1]),Math.hypot(bodyWorld[2],bodyWorld[3])),radius=Math.max(16,Math.min(frame.radius*.45,frame.profile.halfWidth*1.8))*worldScale,m=ctx.getTransform(),scale=Math.min(3,Math.max(.5,Math.hypot(m.a,m.b))),size=Math.max(32,Math.min(512,Math.ceil(radius*2*scale))),ratio=size/(radius*2),[a,b,out]=surfaces(size);
 for(const [surface,draw]of [[a,drawBody],[b,drawPart]]){surface.ctx.setTransform(ratio,0,0,ratio,(-centre.x+radius)*ratio,(-centre.y+radius)*ratio);draw(surface.ctx);}
 const data=joinSeamPixels(a.ctx.getImageData(0,0,size,size).data,b.ctx.getImageData(0,0,size,size).data,size,size,{maxStroke:Math.max(3,6*ratio),matches:frame.profile.matches,inkColors:frame.profile.inkColors});
 out.ctx.putImageData(new ImageData(data,size,size),0,0);ctx.drawImage(out.canvas,centre.x-radius,centre.y-radius,radius*2,radius*2);
}
