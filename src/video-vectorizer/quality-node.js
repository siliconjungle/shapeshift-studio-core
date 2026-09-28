import sharp from 'sharp';
import {svgFrame} from './output.js';

// Source-relative pixel errors. Temporal error compares the CHANGE in the SVG
// to the CHANGE in the source, so freezing genuine motion cannot improve it.
export function pixelErrors(source,rendered,previous){
 const {width,height,data}=source;let absolute=0,edgeError=0,edgePixels=0,badPixels=0,temporal=0,quietJumps=0,quietPixels=0;
 if(rendered.length!==data.length)throw Error('Quality comparison dimensions must match');
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const p=(y*width+x)*4;let error=0,ds=0,dr=0,edge=false;
  for(let c=0;c<3;c++){
   const value=data[p+c]*data[p+3]/255,out=rendered[p+c]*rendered[p+3]/255;error+=Math.abs(value-out);
   for(const q of [x+1<width?p+4:p,y+1<height?p+width*4:p])if(Math.abs(data[p+c]-data[q+c])>12)edge=true;
   if(previous){const a=value-previous.source[p+c]*previous.source[p+3]/255,b=out-previous.rendered[p+c]*previous.rendered[p+3]/255;ds+=Math.abs(a);dr+=Math.abs(b);temporal+=Math.abs(b-a);}
  }
  absolute+=error;if(error/3>25)badPixels++;
  if(edge){edgeError+=error;edgePixels++}
  if(previous&&ds/3<=3&&Math.min(data[p],data[p+1],data[p+2])<190){quietPixels++;if(dr/3>25)quietJumps++;}
 }
 return {meanError:absolute/(width*height*3),edgeError:edgeError/Math.max(1,edgePixels*3),edgePixels,badPixels,temporalResidual:previous?temporal/(width*height*3):null,quietJumps,quietPixels};
}

export async function auditVectorVideo(clip,frames,{signal,onProgress}={}){
 const report={frames:[],outlineIncluded:!!clip.outline};let previous;
 for(let frame=0;frame<clip.frameCount;frame++){
  signal?.throwIfAborted();const source=frames[frame];if(!source)throw Error('Missing audit source frame');
  const rendered=await sharp(Buffer.from(svgFrame(clip,{frame}))).resize(source.width,source.height).ensureAlpha().raw().toBuffer();
  report.frames.push({frame,...pixelErrors(source,rendered,previous)});previous={source:source.data,rendered};
  onProgress?.({stage:'checking',completed:frame+1,total:clip.frameCount});
 }
 const n=report.frames.length;report.meanError=report.frames.reduce((s,f)=>s+f.meanError,0)/n;report.badPixels=report.frames.reduce((s,f)=>s+f.badPixels,0);
 report.temporalResidual=report.frames.slice(1).reduce((s,f)=>s+f.temporalResidual,0)/Math.max(1,n-1);report.quietJumps=report.frames.reduce((s,f)=>s+f.quietJumps,0);
 return report;
}
