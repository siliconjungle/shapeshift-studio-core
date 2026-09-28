import {outlineSettings,createOutlineTracker} from './outline.js';
import {detectTrailingHold} from './timing.js';
import {buildPalette,paletteClassifier,hexColor} from './palette.js';
import {estimateMotion} from './motion.js';
import {segmentFrame,removeSpeckles,regionRings,matchRegions} from './regions.js';
import {fitContours,sameRings} from './curves.js';

const defaults={colors:24,frameRate:24,alphaThreshold:128,minRegionArea:4,pointSpacing:3,curveHysteresis:.6,colorHysteresis:6,noiseTolerance:3,motionStep:16,maxPointsPerRing:512,maxFrames:1000,maxFramePixels:4194304,maxTotalPixels:100000000,minColorDistance:14,spatialDenoise:2};
function settings(options) {
  const out={...defaults,...options};
  for(const [key,lo,hi,integer]of [
    ['colors',2,256,true],['frameRate',.1,240,false],['alphaThreshold',0,255,true],
    ['minRegionArea',1,10000,true],['pointSpacing',.5,32,false],['curveHysteresis',0,10,false],
    ['colorHysteresis',0,64,false],['noiseTolerance',0,32,false],['motionStep',4,64,true],
    ['minColorDistance',0,64,false],['spatialDenoise',0,4,true],['maxTotalPixels',1,1000000000,true],['maxPointsPerRing',4,4096,true],['maxFrames',1,10000,true],['maxFramePixels',1,16777216,true]
  ])if(!Number.isFinite(out[key])||out[key]<lo||out[key]>hi||(integer&&!Number.isInteger(out[key])))throw Error('Invalid '+key);
  return out;
}
function abort(signal){if(signal?.aborted){const error=new Error('Video conversion aborted');error.name='AbortError';throw error;}}
function equalPixels(a,b){if(a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true;}
/**
 * Convert decoded RGBA frames into persistent region tracks.
 * Accepts arrays or async iterables; never decodes media or imports a renderer.
 * Frames are borrowed read-only for the duration of the conversion.
 */
export async function vectorizeVideo(input,options={}) {
  const config=settings(options),frames=[];
  for await(const frame of input){
    abort(config.signal);
    if(!frame||!Number.isInteger(frame.width)||!Number.isInteger(frame.height)||frame.width<1||frame.height<1||frame.width*frame.height>config.maxFramePixels)throw Error('Invalid frame dimensions');
    if(!(frame.data instanceof Uint8Array || frame.data instanceof Uint8ClampedArray)||frame.data.length!==frame.width*frame.height*4)throw Error('Frames must contain width × height RGBA bytes');
    if(frames.length&&(frame.width!==frames[0].width||frame.height!==frames[0].height))throw Error('All frames must have equal dimensions');
    if(frames.length>=config.maxFrames)throw Error('Video exceeds maxFrames; no frames were silently dropped');
    if((frames.length+1)*frame.width*frame.height>config.maxTotalPixels)throw Error('Video exceeds maxTotalPixels');
    frames.push(frame);
  }
  if(!frames.length)throw Error('Video contains no frames');
  const {width,height}=frames[0],timestamps=frames.map((f,i)=>f.timestamp??i/config.frameRate);
  const origin=timestamps[0];
  for(let i=0;i<timestamps.length;i++)if(!Number.isFinite(timestamps[i])||(i&&timestamps[i]<=timestamps[i-1]))throw Error('Frame timestamps must be finite and strictly increasing');
  for(let i=0;i<timestamps.length;i++)timestamps[i]-=origin;
  let timing;
  if(config.trimTrailingHold){
    timing=detectTrailingHold(frames,{frameRate:config.frameRate,...(config.trimTrailingHold===true?{}:config.trimTrailingHold)});
    frames.length=timing.endFrame;timestamps.length=timing.endFrame;
  }
  config.onProgress?.({stage:'palette',completed:0,total:frames.length});
  const palette=buildPalette(frames,config),classify=paletteClassifier(palette),tracks=[];
  const outline=outlineSettings(config.outline,config.outputWidth??width);
  const outlineTracker=outline?createOutlineTracker(outline,config,frames.length,palette.length):null;
  let previous=null,previousFrame=null,trackSerial=0;
  const diagnostics={births:0,deaths:0,topologyChanges:0,heldPoints:0,totalPoints:0,exactDuplicateFrames:0,frames:[]};
  for(let fi=0;fi<frames.length;fi++){
    abort(config.signal);const frame=frames[fi];
    if(previousFrame&&equalPixels(frame.data,previousFrame.data)){
      for(const region of previous.regions)region.track.samples[fi]=region.track.samples[fi-1];
      outlineTracker?.hold(fi);
      diagnostics.exactDuplicateFrames++;diagnostics.frames.push({regions:previous.regions.length,matched:previous.regions.length,held:true});
      previousFrame=frame;config.onProgress?.({stage:'tracking',completed:fi+1,total:frames.length});continue;
    }
    const motion=previousFrame?estimateMotion(previousFrame,frame,config):null;
    const segmented=segmentFrame(frame,palette,classify,previous,motion,{...config,previousFrame});
    const current=removeSpeckles(segmented.labels,width,height,config.minRegionArea);
    current.labels=segmented.labels;
    const matches=matchRegions(current.regions,segmented.priorComponents,previous),alive=new Set();
    for(const region of current.regions){
      const old=previous?.regions[matches.get(region.id)],raw=regionRings(region,current.componentIds,width,height);
      if(!raw.length)continue;
      const fit=fitContours(raw,old?.rings,motion,previousFrame,frame,config);
      diagnostics.heldPoints+=fit.heldPoints;diagnostics.totalPoints+=fit.totalPoints;
      let track=old?.track;
      if(!track){
        track={id:'region-'+String(++trackSerial).padStart(6,'0'),color:region.color,poses:[],samples:new Array(frames.length).fill(-1)};
        tracks.push(track);diagnostics.births++;
      }
      alive.add(track.id);
      let epoch=old?.epoch??0;
      if(old&&fit.newTopology){epoch++;diagnostics.topologyChanges++}
      const preceding=old?track.samples[fi-1]:-1;
      let pose;
      if(preceding>=0 && !fit.newTopology && sameRings(fit.rings,track.poses[preceding].rings))pose=preceding;
      else{pose=track.poses.length;track.poses.push({epoch,rings:fit.rings});}
      track.samples[fi]=pose;region.track=track;region.rings=track.poses[pose].rings;region.epoch=epoch;
    }
    if(previous)for(const old of previous.regions)if(old.track&&!alive.has(old.track.id))diagnostics.deaths++;
    diagnostics.frames.push({regions:current.regions.length,matched:matches.size,held:false});
    outlineTracker?.update(frame,motion,fi);
    previous=current;previousFrame=frame;
    config.onProgress?.({stage:'tracking',completed:fi+1,total:frames.length});
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  const outputWidth=config.outputWidth??width,outputHeight=config.outputHeight??height;
  if(!Number.isFinite(outputWidth)||!Number.isFinite(outputHeight)||outputWidth<=0||outputHeight<=0)throw Error('Invalid output dimensions');
  return {
    format:'shapeshift-vector-video',version:1,width:outputWidth,height:outputHeight,
    analysisWidth:width,analysisHeight:height,frameRate:config.frameRate,frameCount:frames.length,timestamps,
    timing,
    duration:timing?.duration??timestamps.at(-1)+(frames.length>1?timestamps.at(-1)-timestamps.at(-2):1/config.frameRate),
    palette:[...palette.map(hexColor),...(outline?[outline.color]:[])],tracks:[...tracks,...(outlineTracker?.tracks??[])],outline,diagnostics,
    settings:Object.fromEntries(Object.keys(defaults).map(k=>[k,config[k]]))
  };
}
