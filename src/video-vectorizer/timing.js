// Compare the entire tail to one fixed source image. Adjacent-frame comparisons
// alone can mistake slow cumulative movement for a still hold.
function thumbnail({width,height,data}) {
  const w=Math.min(width,208),h=Math.max(1,Math.round(height*w/width)),out=new Float32Array(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const x0=Math.floor(x*width/w),x1=Math.max(x0+1,Math.floor((x+1)*width/w));
    const y0=Math.floor(y*height/h),y1=Math.max(y0+1,Math.floor((y+1)*height/h));
    const k=(y*w+x)*4,n=(x1-x0)*(y1-y0);
    for(let yy=y0;yy<y1;yy++)for(let xx=x0;xx<x1;xx++){
      const p=(yy*width+xx)*4,a=data[p+3]/255;
      for(let c=0;c<3;c++)out[k+c]+=data[p+c]*a/n;
      out[k+3]+=data[p+3]/n;
    }
  }
  return out;
}

/** Return an exclusive source end frame; never remove pauses inside the action.
 * All frames must have matching dimensions and increasing timestamps.
 * keepSeconds is the final pose's retained settling time, not a speed change.
 */
export function detectTrailingHold(frames,{frameRate=24,keepSeconds=.35,minHoldSeconds=.75,pixelThreshold=8,maxChangedFraction=.001}={}) {
  for(const [key,value,min,max]of [['frameRate',frameRate,.1,240],['keepSeconds',keepSeconds,0,60],['minHoldSeconds',minHoldSeconds,0,60],['pixelThreshold',pixelThreshold,0,255],['maxChangedFraction',maxChangedFraction,0,1]])
    if(!Number.isFinite(value)||value<min||value>max)throw Error('Invalid trailing hold '+key);
  if(!frames.length)throw Error('Video contains no frames');
  const times=frames.map((f,i)=>f.timestamp??i/frameRate),last=frames.length-1;
  const step=last?times[last]-times[last-1]:1/frameRate,duration=times[last]-times[0]+step;
  const reference=thumbnail(frames[last]);let start=last;
  for(let i=last-1;i>=0;i--){
    const candidate=thumbnail(frames[i]);let changed=0;
    for(let p=0;p<reference.length;p+=4){
      const rgb=(Math.abs(candidate[p]-reference[p])+Math.abs(candidate[p+1]-reference[p+1])+Math.abs(candidate[p+2]-reference[p+2]))/3;
      if(Math.max(rgb,Math.abs(candidate[p+3]-reference[p+3]))>pixelThreshold)changed++;
    }
    if(changed/(reference.length/4)>maxChangedFraction)break;
    start=i;
  }
  let end=frames.length;
  if(times[last]+step-times[start]>=minHoldSeconds){
    end=start+1;
    while(end<frames.length&&times[end]<times[start]+keepSeconds)end++;
  }
  const endTime=end<frames.length?times[end]-times[0]:duration;
  return {sourceFrameCount:frames.length,endFrame:end,holdStartFrame:start,sourceDuration:duration,duration:endTime,removedFrames:frames.length-end,removedSeconds:duration-endTime,keepSeconds};
}
