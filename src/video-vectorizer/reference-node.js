import {createHash} from 'node:crypto';
import {gradePixels} from '../rendering/color-grading-pixels.js';
import {buildMotionGates} from './motion-gates.js';
import {trackPaletteFrame} from './palette-tracking.js';
import {temporalMedian} from './temporal-raster.js';
import sharp from 'sharp';
import {convert} from '../image-vectorizer/node.js';
import {parsePalette,paletteClassifier,hexColor,buildPalette} from './palette.js';
import {trackTracedVideo,parseTracedSVG,bezierPath} from './traced.js';
import {detectTrailingHold} from './timing.js';
import {outlineSettings,createOutlineTracker} from './outline.js';
import {estimateMotion,scaleMotion} from './motion.js';

export async function clipPalette(frames,colors){
 const selected=Array.from({length:Math.min(12,frames.length)},(_,i)=>frames[Math.round(i*(frames.length-1)/Math.max(1,Math.min(12,frames.length)-1))]);
 const width=208,height=Math.max(1,Math.round(frames[0].height*width/frames[0].width)),inputs=[];
 for(let i=0;i<selected.length;i++){const f=selected[i];inputs.push({input:await sharp(f.data,{raw:{width:f.width,height:f.height,channels:4}}).resize(width,height).median(3).png().toBuffer(),left:i*width,top:0})}
 const png=await sharp({create:{width:width*inputs.length,height,channels:4,background:'#00000000'}}).composite(inputs).png({palette:true,colours:colors,dither:0,effort:10}).toBuffer();
 const raw=await sharp(png).ensureAlpha().raw().toBuffer(),palette=new Map();
 for(let p=0;p<raw.length;p+=4)if(raw[p+3]>=128){const c=[raw[p],raw[p+1],raw[p+2]];palette.set(c.join(','),c)}
 // PNG palette sizes are rounded to supported bit depths (e.g. 32 -> 256).
 // Honour the requested limit rather than silently tracing hundreds of shades.
 if(palette.size>colors)return buildPalette(frames,{colors,minColorDistance:0});
 return palette.size?[...palette.values()]:[[0,0,0],[255,255,255]];
}
// Node quality backend: the existing image converter owns all curve fitting.
// This adapter owns clip-wide colours, timing, identity and safe shape holds.
export async function vectorizeReferenceFrames(input,options={}){
 // Stabilize the source labels before invoking the proven spline fitter.
 // Curve advection remains opt-in: small contour errors can expose stacked
 // underpaint even when a whole-image error score accepts the change.
 options={flowBackend:'opencv',trackMotion:true,trackPalette:true,trackCurves:false,
  traceScale:2,tracePreset:'fidelity',traceSettings:{speckle:4,length:4.5},
  paletteMethod:'cluster',minColorDistance:4,spatialMedian:0,sourceColorBudget:8,...options};
 const frames=[];let pixels=0;
 for await(const f of input){
  options.signal?.throwIfAborted();
  if(!Number.isInteger(f.width)||!Number.isInteger(f.height)||f.width<1||f.height<1||f.data.length!==f.width*f.height*4)throw Error('Invalid RGBA frame');
  pixels+=f.width*f.height;
  if(frames.length>=(options.maxFrames??1000)||pixels>(options.maxTotalPixels??100000000))throw Error('Video exceeds conversion limits');
  if(frames.length&&(f.width!==frames[0].width||f.height!==frames[0].height))throw Error('Frame dimensions must match');
  frames.push(gradePixels(f,options.grading));
 }
 if(!frames.length)throw Error('Video contains no frames');
 const timing=options.trimTrailingHold?detectTrailingHold(frames,{frameRate:options.frameRate??24,...(options.trimTrailingHold===true?{}:options.trimTrailingHold)}):null;
 const retained=frames.slice(0,timing?.endFrame??frames.length);
 const colors=options.colors??16;if(!Number.isInteger(colors)||colors<4||colors>256)throw Error('colors must be an integer from 4 to 256');
 const traceCache=new Map();let preparedHolds=0;
 const palette=options.palette?parsePalette(options.palette):options.paletteMethod==='cluster'?buildPalette(retained,{colors,minColorDistance:options.minColorDistance??4}):await clipPalette(retained,colors),classify=paletteClassifier(palette),svgs=[];
 let exteriorBackground=null;if(options.sourceBackground){const rgb=parsePalette([options.sourceBackground,'#000000'])[0],graded=gradePixels({width:1,height:1,data:new Uint8Array([...rgb,255])},options.grading).data;exteriorBackground=hexColor(palette[classify(...graded.slice(0,3))]);}
 const traceScale=options.traceScale??1;
 if(![1,2,3].includes(traceScale))throw Error('traceScale must be 1, 2 or 3');
 const small=[];
 for(const f of frames){const {data,info}=await sharp(f.data,{raw:{width:f.width,height:f.height,channels:4}}).resize({width:Math.min(256,f.width)}).raw().toBuffer({resolveWithObject:true});small.push({width:info.width,height:info.height,data})}
 const estimator=options.flowBackend==='opencv'?(await import('./dense-motion-node.js')).estimateDenseMotion:estimateMotion;
 const motionFields=[],pairs=[];let paletteState=null;
 for(let i=0;i<Math.min(frames.length-1,retained.length+3);i++){
  options.signal?.throwIfAborted();pairs[i]={forward:await estimator(small[i],small[i+1],{motionStep:8}),backward:await estimator(small[i+1],small[i],{motionStep:8})};motionFields[i+1]=pairs[i].forward;
  options.onProgress?.({stage:'motion',completed:i+1,total:Math.min(frames.length-1,retained.length+3)});
 }
 const gates=options.trackMotion?buildMotionGates(motionFields,retained,options):null;
 const outline=outlineSettings(options.outline,options.outputWidth??retained[0].width);
 const outlineTracker=outline?createOutlineTracker(outline,{...options,alphaThreshold:options.alphaThreshold??128},retained.length,0):null;
 for(let i=0;i<retained.length;i++){
  options.signal?.throwIfAborted();const frame=retained[i];
  let visible=false;for(let p=3;p<frame.data.length;p+=4)if(frame.data[p]>=128){visible=true;break}
  if(!visible){await options.onPreparedFrame?.(frame,i);outlineTracker?.update(frame,scaleMotion(motionFields[i],frame.width,frame.height),i);svgs.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+frame.width+' '+frame.height+'"></svg>');paletteState=null;continue;}
  const nextPair=pairs[i],previousPair=pairs[i-1];
  const neighbors=[];if(previousPair)neighbors.push({frame:frames[i-1],toNeighbor:previousPair.forward,toCurrent:previousPair.backward});
  if(nextPair)neighbors.push({frame:frames[i+1],toNeighbor:nextPair.backward,toCurrent:nextPair.forward});
  let cleaned=i>0&&i<frames.length-1?temporalMedian(frame,neighbors,{flowWidth:small[i].width,flowHeight:small[i].height}):frame;
  if(options.denoiseColor)cleaned=await (await import('./dense-motion-node.js')).denoiseFrame(cleaned,{sigmaColor:options.denoiseColor});
  const traceFrame=traceScale===1?frame:{...frame,width:frame.width*traceScale,height:frame.height*traceScale,data:await sharp(frame.data,{raw:{width:frame.width,height:frame.height,channels:4}}).resize(frame.width*traceScale,frame.height*traceScale,{kernel:'cubic'}).raw().toBuffer()};
  const pipeline=sharp(cleaned.data,{raw:{width:frame.width,height:frame.height,channels:4}});
  if(traceScale!==1)pipeline.resize(traceFrame.width,traceFrame.height,{kernel:'cubic'});
  const data=await ((options.spatialMedian??3)?pipeline.median(options.spatialMedian??3):pipeline).raw().toBuffer();

  if(!options.trackPalette&&!gates)for(let p=0;p<data.length;p+=4){data[p+3]=traceFrame.data[p+3];const c=palette[classify(data[p],data[p+1],data[p+2])];data[p]=c[0];data[p+1]=c[1];data[p+2]=c[2];}
  let prepared=data;
  if(options.trackPalette||gates){paletteState=trackPaletteFrame(traceFrame,{...traceFrame,data},palette,classify,paletteState,{...options,motionGate:gates?{...gates,tileSize:gates.tileSize*traceScale,mask:gates.masks[i]}:null});prepared=paletteState.data;}
  if(outlineTracker){const outlineData=traceScale===1?prepared:await sharp(prepared,{raw:{width:traceFrame.width,height:traceFrame.height,channels:4}}).resize(frame.width,frame.height,{kernel:'nearest'}).raw().toBuffer();outlineTracker.update({...frame,data:outlineData},scaleMotion(motionFields[i],frame.width,frame.height),i);}
  const png=await sharp(prepared,{raw:{width:traceFrame.width,height:traceFrame.height,channels:4}}).png().toBuffer();
  await options.onPreparedFrame?.({...traceFrame,data:prepared},i);
  const key=createHash('sha256').update(prepared).digest('hex');
  if(traceCache.has(key)){svgs.push(traceCache.get(key));preparedHolds++;}else{
  const result=await convert(png,{preset:options.tracePreset??'cel',colors:Math.max(4,palette.length),preserveDarkColors:true,traceSettings:options.traceSettings});
  // The image fitter may average hierarchical cluster colours; restore shared
  // clip colours after tracing while retaining every spline and its paint order.
  let svg=result.svg.replace(/fill="(#[0-9a-f]{6})"/gi,(_,hex)=>'fill="'+hexColor(palette[classify(...[1,3,5].map(k=>parseInt(hex.slice(k,k+2),16)))])+'"');
  if(traceScale!==1){const traced=parseTracedSVG(svg);svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+frame.width+'" height="'+frame.height+'" viewBox="0 0 '+frame.width+' '+frame.height+'">'+traced.paths.map(p=>'<path fill="'+p.fill+'" d="'+bezierPath(p.rings,{scaleX:1/traceScale,scaleY:1/traceScale})+'"/>').join('')+'</svg>';}
  svgs.push(svg);
  traceCache.set(key,svgs.at(-1));}
  if(exteriorBackground){const overlay=await (await import('./exterior-node.js')).sourceExterior(frame,{background:exteriorBackground,tolerance:65,scale:2});svgs[svgs.length-1]=svgs.at(-1).replace('</svg>',overlay+'</svg>');}
  options.onProgress?.({stage:'tracing',completed:i+1,total:retained.length});
 }
 const approveFrame=options.trackCurves?(await import('./fidelity-node.js')).approveTrackedFrame:undefined;
 const clip=await trackTracedVideo(svgs,retained,{...options,motionFields,approveFrame,trimTrailingHold:false});
 clip.diagnostics.exactPreparedFrameHolds=preparedHolds;
 clip.settings.sourceBackground=options.sourceBackground??null;clip.settings.exteriorBackground=exteriorBackground;clip.settings.grading=options.grading??{preset:'neutral'};clip.settings.gradeBaked=true;clip.settings.preparationOrder=['decode','grade','shared-cel-palette','temporal-labels','trace'];
 clip.settings.traceSettings=options.traceSettings??null;clip.settings.denoiseColor=options.denoiseColor??0;clip.settings.minColorDistance=options.minColorDistance??4;
 clip.settings.traceScale=traceScale;clip.settings.paletteMethod=options.paletteMethod??'native';clip.settings.tracePreset=options.tracePreset??'cel';clip.settings.sourceColorBudget=Number.isFinite(options.sourceColorBudget)?options.sourceColorBudget:null;clip.settings.spatialMedian=options.spatialMedian??3;
 clip.settings.trackPalette=!!(options.trackPalette||gates);clip.settings.trackMotion=!!gates;if(gates)clip.diagnostics.motionHeldFraction=gates.heldFraction;clip.settings.colors=palette.length;clip.settings.temporalPreparation='bidirectional-motion-median';clip.settings.flowBackend=options.flowBackend??'block-matching';
 if(timing){clip.timing=timing;clip.duration=timing.duration;}
 if(outlineTracker){
  const color=clip.palette.length;for(const track of outlineTracker.tracks)track.color=color;
  clip.outline=outline;clip.palette.push(outline.color);clip.tracks.push(...outlineTracker.tracks);
  clip.paintOrder.forEach((order,i)=>order.push(...outlineTracker.tracks.filter(t=>t.samples[i]>=0).map(t=>t.id)));
 }
 clip.width=options.outputWidth??clip.width;clip.height=options.outputHeight??clip.height;
 if(options.audit)clip.diagnostics.sourceAudit=await (await import('./quality-node.js')).auditVectorVideo(clip,retained,options);
 return clip;
}
