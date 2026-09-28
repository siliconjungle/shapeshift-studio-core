import {colorDistance} from './palette.js';

/** Hold palette assignments against anchored source colours, not the preceding
 * output. This stops threshold noise without freezing accumulated real motion. */
export function trackPaletteFrame(source,cleaned,palette,classify,previous,{noiseTolerance=3,labelHysteresis=8,motionGate,sourceColorBudget=Infinity}={}){
 // Buffer.slice() is a shared view; callers may supply Node Buffers. Anchors
 // must own their bytes so later updates never mutate the source frames.
 const count=source.width*source.height,data=new Uint8Array(source.data.length),labels=new Uint16Array(count),anchors=new Uint8Array(previous?previous.anchors:source.data);
 let held=0,changed=0;
 for(let p=0;p<count;p++){
  const k=p*4,r=cleaned.data[k],g=cleaned.data[k+1],b=cleaned.data[k+2];let label=classify(r,g,b);
  if(previous){
   const old=previous.labels[p],delta=(Math.abs(source.data[k]-anchors[k])+Math.abs(source.data[k+1]-anchors[k+1])+Math.abs(source.data[k+2]-anchors[k+2]))/3;
   const alphaStable=Math.abs(source.data[k+3]-anchors[k+3])<=noiseTolerance;
   const inactive=motionGate&&!motionGate.mask[Math.floor(Math.floor(p/source.width)/motionGate.tileSize)*motionGate.columns+Math.floor((p%source.width)/motionGate.tileSize)];
   if(alphaStable&&(inactive||delta<=noiseTolerance||colorDistance(r,g,b,palette[old])<=colorDistance(r,g,b,palette[label])+labelHysteresis**2)){label=old;held++}
   else{anchors.set(source.data.subarray(k,k+4),k);changed++}
  }
  if(Number.isFinite(sourceColorBudget)){
   const sr=source.data[k],sg=source.data[k+1],sb=source.data[k+2],best=classify(sr,sg,sb);
   // Neither a motion gate nor a denoiser may keep paint that contradicts the
   // current source. Measure error in RGB units, not a whole-frame average.
   if(Math.sqrt(colorDistance(sr,sg,sb,palette[label]))>Math.sqrt(colorDistance(sr,sg,sb,palette[best]))+sourceColorBudget){
    label=best;anchors.set(source.data.subarray(k,k+4),k);
   }
  }
  labels[p]=label;data[k]=palette[label][0];data[k+1]=palette[label][1];data[k+2]=palette[label][2];data[k+3]=source.data[k+3];
 }
 return {data,labels,anchors,held,changed};
}
