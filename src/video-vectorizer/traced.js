import {updateTrackedCurves} from './curve-tracking.js';
import {detectTrailingHold} from './timing.js';

const num=n=>Number(n.toFixed(3));
export function bezierPath(rings,{scaleX=1,scaleY=1}={}){
 const p=([x,y])=>num(x*scaleX)+' '+num(y*scaleY);
 return rings.map(r=>'M'+p(r[0])+Array.from({length:(r.length-1)/3},(_,i)=>'C'+r.slice(i*3+1,i*3+4).map(p).join(' ')).join('')+'Z').join('');
}
// Strictly parse the M/C/Z spline subset emitted by the shared image converter.
// No DOM, scripts, external links, transforms other than translation, or raster.
export function parseTracedSVG(svg){
 if(/<image\b|<script\b|<foreignObject\b/i.test(svg))throw Error('Expected vector-only traced SVG');
 const box=svg.match(/viewBox="([^"]+)"/)?.[1].trim().split(/[ ,]+/).map(Number);
 if(!box||box.length!==4||box.some(n=>!Number.isFinite(n))||box[2]<=0||box[3]<=0)throw Error('Invalid traced SVG viewBox');
 const paths=[];
 for(const match of svg.matchAll(/<path\b([^>]*)\/?\s*>/g)){
  const attributes=match[1],d=attributes.match(/\bd="([^"]*)"/)?.[1],fill=attributes.match(/\bfill="(#[\da-f]{6})"/i)?.[1]?.toLowerCase();
  if(!d||!fill)throw Error('Trace paths need explicit solid fills');
  const transform=attributes.match(/\btransform="([^"]*)"/)?.[1],translate=transform?.match(/^translate\(\s*([-\d.e+]+)[ ,]+([-\d.e+]+)\s*\)$/i);
  if(transform&&!translate)throw Error('Unsupported trace transform');
  const dx=Number(translate?.[1]??0)-box[0],dy=Number(translate?.[2]??0)-box[1];
  const tokens=d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/g)??[];
  let cursor=0,ring=null;const rings=[];
  const point=()=>{const x=Number(tokens[cursor++]),y=Number(tokens[cursor++]);if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('Invalid trace coordinate');return [x+dx,y+dy]};
  while(cursor<tokens.length){const command=tokens[cursor++];if(command==='M'){ring=[point()];rings.push(ring)}else if(command==='C'&&ring)ring.push(point(),point(),point());else if(command==='Z')ring=null;else throw Error('Unsupported traced path command '+command)}
  if(ring)throw Error('Unclosed traced path');
  if(!rings.length||rings.some(r=>r.length<4||(r.length-1)%3))throw Error('Invalid traced spline');
  paths.push({fill,rings});
 }
 return {width:box[2],height:box[3],paths};
}
function bounds(rings){const p=rings.flat();return [Math.min(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1])),Math.max(...p.map(v=>v[0])),Math.max(...p.map(v=>v[1]))]}
function overlap(a,b){const area=r=>Math.max(0,r[2]-r[0])*Math.max(0,r[3]-r[1]);const i=area([Math.max(a[0],b[0]),Math.max(a[1],b[1]),Math.min(a[2],b[2]),Math.min(a[3],b[3])]);return i/Math.max(1,area(a)+area(b)-i)}
function identical(a,b){return a.length===b.length&&a.every((r,i)=>r.length===b[i].length&&r.every((p,j)=>p[0]===b[i][j][0]&&p[1]===b[i][j][1]))}
function quiet(a,b,box,tolerance){
 if(!a||!b)return false;
 const x0=Math.max(0,Math.floor(box[0])-2),x1=Math.min(a.width,Math.ceil(box[2])+2),y0=Math.max(0,Math.floor(box[1])-2),y1=Math.min(a.height,Math.ceil(box[3])+2);
 let changed=0,count=0;
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
  const p=(y*a.width+x)*4,d=(Math.abs(a.data[p]-b.data[p])+Math.abs(a.data[p+1]-b.data[p+1])+Math.abs(a.data[p+2]-b.data[p+2]))/3;
  count++;if(d>tolerance||Math.abs(a.data[p+3]-b.data[p+3])>tolerance)changed++;
 }
 return count>0&&changed/count<.001;
}

/** Track existing fitted, stacked curves without refitting them into polygon
 * regions. This conservative pass holds whole source-quiet shapes only; moving
 * shapes retain the reference fitter's exact coordinates and paint order. */
export async function trackTracedVideo(svgs,frames,options={}){
 if(!svgs.length||svgs.length!==frames.length)throw Error('Trace and source frame counts must match');
 const frameRate=options.frameRate??24;
 if(!Number.isFinite(frameRate)||frameRate<=0||frameRate>240)throw Error('Invalid frame rate');
 for(let i=0;i<frames.length;i++){
  const f=frames[i],t=f.timestamp??i/frameRate;
  if(!(f.data instanceof Uint8Array||f.data instanceof Uint8ClampedArray)||f.data.length!==f.width*f.height*4)throw Error('Invalid RGBA frame');
  if(!Number.isFinite(t)||(i&&t<=(frames[i-1].timestamp??(i-1)/frameRate)))throw Error('Invalid frame timestamps');
 }
 const timing=options.trimTrailingHold?detectTrailingHold(frames,{frameRate,...(options.trimTrailingHold===true?{}:options.trimTrailingHold)}):null;
 const count=timing?.endFrame??frames.length,first=parseTracedSVG(svgs[0]),palette=[],tracks=[],paintOrder=[],diagnostics={heldShapes:0,trackedShapes:0,topologyChanges:0,motionGuidedShapes:0,rejectedCurveUpdates:0,frameGuardRejections:0,frameValidation:[]};
 const timestamps=frames.slice(0,count).map((f,i)=>(f.timestamp??i/frameRate)-(frames[0].timestamp??0));
 let previous=[];
 for(let fi=0;fi<count;fi++){
  options.signal?.throwIfAborted();const trace=fi?parseTracedSVG(svgs[fi]):first;
  if(trace.width!==first.width||trace.height!==first.height||frames[fi].width!==first.width||frames[fi].height!==first.height)throw Error('Trace/source dimensions must match');
  const current=trace.paths.map(p=>({...p,box:bounds(p.rings)})),candidates=[];
  current.forEach((p,i)=>previous.forEach((old,j)=>{if(p.fill===old.fill){const score=overlap(p.box,old.box);if(score>.55)candidates.push({i,j,score:score/(1+Math.abs(p.rings.length-old.rings.length)*.1)})}}));
  candidates.sort((a,b)=>b.score-a.score||a.i-b.i||a.j-b.j);const matched=new Map(),used=new Set();
  for(const c of candidates)if(!matched.has(c.i)&&!used.has(c.j)){matched.set(c.i,c.j);used.add(c.j)}
  const order=[];
  for(let i=0;i<current.length;i++){
   const shape=current[i],old=previous[matched.get(i)];let color=palette.indexOf(shape.fill);if(color<0){color=palette.length;palette.push(shape.fill)}
   const track=old?.track??{id:'spline-'+String(tracks.length+1).padStart(6,'0'),color,fillRule:'nonzero',poses:[],samples:Array(count).fill(-1)};
   if(!old)tracks.push(track);else diagnostics.trackedShapes++;
   const oldPose=old?track.poses[track.samples[fi-1]]:null;
   // A hold may not hide a topology event or move a curve beyond a subpixel.
   const compatible=oldPose&&oldPose.rings.length===shape.rings.length;
   if((options.holdShapes??!Number.isFinite(options.sourceColorBudget))&&compatible&&overlap(shape.box,old.box)>.995&&quiet(frames[old.anchorFrame],frames[fi],shape.box,options.noiseTolerance??3)){
    shape.rings=oldPose.rings;shape.anchorFrame=old.anchorFrame;diagnostics.heldShapes++;
   }else if(compatible&&options.trackCurves&&options.motionFields?.[fi]){
    const candidate=updateTrackedCurves(oldPose.rings,shape.rings,options.motionFields[fi],frames[fi-1],frames[fi],options);
    if(candidate){shape.rings=candidate;shape.motionGuided=true;diagnostics.motionGuidedShapes++}else diagnostics.rejectedCurveUpdates++;
   }
   let pose=old?track.samples[fi-1]:-1;
   if(!oldPose||!identical(shape.rings,oldPose.rings)){
    const signature=r=>r.map(x=>x.length).join(','),sameTopology=oldPose&&(shape.motionGuided||(signature(oldPose.rings)===signature(shape.rings)&&shape.rings.every((r,ri)=>r.every((p,pi)=>Math.hypot(p[0]-oldPose.rings[ri][pi][0],p[1]-oldPose.rings[ri][pi][1])<2))));
    const epoch=oldPose?oldPose.epoch+(sameTopology?0:1):0;if(oldPose&&!sameTopology)diagnostics.topologyChanges++;
    pose=track.poses.length;track.poses.push({epoch,curveMode:'bezier',rings:shape.rings});
   }
   track.samples[fi]=pose;shape.track=track;shape.anchorFrame??=fi;order.push(track.id);
  }
  if(options.approveFrame&&current.some(p=>p.motionGuided)){
   const candidateSVG='<svg xmlns="http://www.w3.org/2000/svg" width="'+first.width+'" height="'+first.height+'" viewBox="0 0 '+first.width+' '+first.height+'">'+current.map(p=>'<path fill="'+p.fill+'" d="'+bezierPath(p.rings)+'"/>').join('')+'</svg>';
   const decision=await options.approveFrame({source:frames[fi],referenceSVG:svgs[fi],candidateSVG,frame:fi});
   diagnostics.frameValidation.push({frame:fi,...(typeof decision==='object'?decision:{accepted:decision===true})});
   if(!(decision===true||decision?.accepted)){
    diagnostics.frameGuardRejections++;
    for(let i=0;i<current.length;i++)if(current[i].motionGuided){
     const shape=current[i],track=shape.track,preceding=track.samples[fi-1],oldPose=track.poses[preceding],candidate=track.samples[fi];
     if(candidate!==preceding&&candidate===track.poses.length-1)track.poses.pop();
     shape.rings=trace.paths[i].rings;shape.anchorFrame=fi;shape.motionGuided=false;
     track.samples[fi]=track.poses.length;track.poses.push({epoch:oldPose.epoch+1,curveMode:'bezier',rings:shape.rings});
     diagnostics.motionGuidedShapes--;diagnostics.rejectedCurveUpdates++;
    }
   }
  }
  paintOrder.push(order);previous=current;options.onProgress?.({stage:'tracking',completed:fi+1,total:count});await new Promise(r=>setTimeout(r,0));
 }
 diagnostics.topologyChanges=tracks.reduce((sum,t)=>sum+t.poses.filter((p,i)=>i&&p.epoch!==t.poses[i-1].epoch).length,0);
 return {format:'shapeshift-vector-video',version:1,width:first.width,height:first.height,analysisWidth:first.width,analysisHeight:first.height,frameRate,frameCount:count,timestamps,duration:timing?.duration??timestamps.at(-1)+(count>1?timestamps.at(-1)-timestamps.at(-2):1/frameRate),timing,palette:palette.length?palette:['#000000','#ffffff'],tracks,paintOrder,diagnostics,settings:{backend:'stacked-reference-splines',noiseTolerance:options.noiseTolerance??3,trackCurves:!!options.trackCurves,curveTolerance:options.curveTolerance??.65}};
}

/** Browser-safe orchestration for a supplied image-to-SVG backend. Node users
 * can call convertVideoFile for the bundled reference fitter and decoder. */
export async function vectorizeVideo(input,options={}){
 if(typeof options.traceFrame!=='function')throw Error('Provide traceFrame, or use convertVideoFile from video-vectorizer/node for the shared image converter');
 const frames=[],svgs=[];let pixels=0;
 for await(const frame of input){
  options.signal?.throwIfAborted();
  if(!frame||!Number.isInteger(frame.width)||!Number.isInteger(frame.height)||frame.width<1||frame.height<1||!(frame.data instanceof Uint8Array||frame.data instanceof Uint8ClampedArray)||frame.data.length!==frame.width*frame.height*4)throw Error('Invalid RGBA frame');
  pixels+=frame.width*frame.height;if(frames.length>=(options.maxFrames??1000)||pixels>(options.maxTotalPixels??100000000))throw Error('Video exceeds conversion limits');
  frames.push(frame);
 }
 for(let i=0;i<frames.length;i++){
  options.signal?.throwIfAborted();svgs.push(await options.traceFrame(frames[i],{index:i,frames,signal:options.signal}));
  options.onProgress?.({stage:'tracing',completed:i+1,total:frames.length});
 }
 return trackTracedVideo(svgs,frames,options);
}
