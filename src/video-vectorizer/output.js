import {bezierPath} from './traced.js';
import {silhouetteInkBands,inkBandPath} from './silhouette-ink.js';
import {outlineSettings} from './outline.js';
import {ringsPath} from './curves.js';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function validateVectorVideo(clip) {
  if(!clip||clip.format!=='shapeshift-vector-video'||clip.version!==1)throw Error('Unsupported vector video');
  for(const key of ['width','height','analysisWidth','analysisHeight','frameRate','duration'])if(!Number.isFinite(clip[key])||clip[key]<=0)throw Error('Invalid '+key);
  if(!Number.isInteger(clip.frameCount)||clip.frameCount<1||clip.timestamps?.length!==clip.frameCount)throw Error('Invalid frame count');
  clip.timestamps.forEach((t,i)=>{if(!Number.isFinite(t)||t<0||(i&&t<=clip.timestamps[i-1])||t>=clip.duration)throw Error('Invalid timestamp')});
  if(!Array.isArray(clip.palette)||!clip.palette.length||clip.palette.some(c=>!/^#[0-9a-f]{6}$/i.test(c)))throw Error('Invalid palette');
  if(!Array.isArray(clip.tracks))throw Error('Invalid tracks');
  if(clip.outline)outlineSettings(clip.outline,clip.width);
  const ids=new Set();
  for(const track of clip.tracks){
    if(track.fillRule!==undefined&&!['nonzero','evenodd'].includes(track.fillRule))throw Error('Invalid fill rule');
    if(track.kind!==undefined&&track.kind!=='outer-outline')throw Error('Invalid track kind');
    if(track.kind==='outer-outline'&&!clip.outline)throw Error('Missing outline settings');
    if(typeof track.id!=='string'||!track.id||ids.has(track.id))throw Error('Invalid track id');ids.add(track.id);
    if(!Number.isInteger(track.color)||track.color<0||track.color>=clip.palette.length)throw Error('Invalid track colour');
    if(track.samples?.length!==clip.frameCount||!Array.isArray(track.poses))throw Error('Invalid track samples');
    const epochs=new Map();
    for(const pose of track.poses){
      if(!Number.isInteger(pose.epoch)||pose.epoch<0||!Array.isArray(pose.rings)||!pose.rings.length)throw Error('Invalid pose');
      for(const ring of pose.rings)if(!Array.isArray(ring)||ring.length<3||ring.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>!Number.isFinite(v))))throw Error('Invalid contour points');
      if(pose.curveMode!==undefined&&pose.curveMode!=='bezier')throw Error('Invalid curve mode');
      if(pose.curveMode==='bezier'&&pose.rings.some(r=>(r.length-1)%3))throw Error('Invalid Bezier spline');
      const signature=pose.rings.map(r=>r.length).join(',');
      if(epochs.has(pose.epoch)&&epochs.get(pose.epoch)!==signature)throw Error('Topology changed within an epoch');epochs.set(pose.epoch,signature);
    }
    for(const pose of track.samples)if(!Number.isInteger(pose)||pose < -1||pose>=track.poses.length)throw Error('Invalid pose index');
  }
  if(clip.paintOrder){
    if(clip.paintOrder.length!==clip.frameCount)throw Error('Invalid paint order');
    clip.paintOrder.forEach((order,i)=>{if(!Array.isArray(order)||new Set(order).size!==order.length||order.some(id=>!ids.has(id)))throw Error('Invalid paint order');const active=clip.tracks.filter(t=>t.samples[i]>=0).map(t=>t.id);if(active.length!==order.length||active.some(id=>!order.includes(id)))throw Error('Missing painted track')});
  }
  return clip;
}
function frameAt(clip,options) {
  if(options.frame!==undefined){
    if(!Number.isInteger(options.frame)||options.frame<0||options.frame>=clip.frameCount)throw Error('Frame index outside clip');
    return {i:options.frame,u:0,time:clip.timestamps[options.frame]};
  }
  const time=options.time??0;if(!Number.isFinite(time))throw Error('Invalid sample time');
  const t=Math.max(0,Math.min(clip.duration,time));let lo=0,hi=clip.frameCount;
  while(lo+1<hi){const mid=(lo+hi)>>1;if(clip.timestamps[mid]<=t)lo=mid;else hi=mid;}
  const u=options.interpolate===false||lo+1===clip.frameCount?0:(t-clip.timestamps[lo])/(clip.timestamps[lo+1]-clip.timestamps[lo]);
  return {i:lo,u,time:t};
}
export function sampleVectorVideo(clip,options={}) {
  const {i,u,time}=frameAt(clip,options),paths=[];
  for(const track of clip.tracks){
    const index=track.samples[i];if(index<0)continue;
    const a=track.poses[index],b=u>0&&i+1<clip.frameCount?track.poses[track.samples[i+1]]:null;
    let rings=a.rings;
    if(b&&b!==a&&b.epoch===a.epoch)rings=a.rings.map((r,ri)=>r.map((p,pi)=>[p[0]+(b.rings[ri][pi][0]-p[0])*u,p[1]+(b.rings[ri][pi][1]-p[1])*u]));
    paths.push({kind:track.kind,curveMode:a.curveMode,fillRule:track.fillRule??'evenodd',id:track.id+'-e'+a.epoch,trackId:track.id,color:clip.palette[track.color],rings,epoch:a.epoch});
  }
  if(clip.paintOrder){const order=new Map(clip.paintOrder[i].map((id,index)=>[id,index]));paths.sort((a,b)=>order.get(a.trackId)-order.get(b.trackId));}
  return {frame:i,time,width:clip.width,height:clip.height,paths};
}
function root(clip){return '<svg xmlns="http://www.w3.org/2000/svg" width="'+clip.width+'" height="'+clip.height+'" viewBox="0 0 '+clip.width+' '+clip.height+'">';}
const posePath=(pose,settings)=>pose.curveMode==='bezier'?bezierPath(pose.rings,settings):ringsPath(pose.rings,settings);
const pathOptions=clip=>({scaleX:clip.width/clip.analysisWidth,scaleY:clip.height/clip.analysisHeight});
function framePath(p,clip,settings){
  if(p.kind==='outer-outline'){
    const loops=p.rings.map(r=>r.map(([x,y])=>[x/clip.analysisWidth,y/clip.analysisHeight]));
    const bands=silhouetteInkBands(loops,{box:[0,0,clip.width,clip.height],displayWidth:clip.outline.displayWidth,bandWidth:clip.outline.width});
    return '<g data-ink-edge="true" data-track="'+escape(p.trackId)+'" fill="'+escape(p.color)+'">'+bands.map(b=>'<path d="'+inkBandPath(b)+'"/>').join('')+'</g>';
  }
  return '<path id="'+escape(p.id)+'" data-track="'+escape(p.trackId)+'" fill="'+escape(p.color)+'" fill-rule="'+p.fillRule+'" d="'+posePath(p,settings)+'"/>';
}
export function svgFrame(clip,options={}) {
  const frame=sampleVectorVideo(clip,options),settings=pathOptions(clip);
  return root(clip)+'<title>Vector video frame '+(frame.frame+1)+'</title>'+frame.paths.map(p=>framePath(p,clip,settings)).join('')+'</svg>';
}
export function animatedSVG(clip,{loop=false}={}) {
  validateVectorVideo(clip);
  const out=[root(clip),'<title>Shapeshift vector video</title>'],repeat=loop?'indefinite':'1',settings=pathOptions(clip);
  const keytime=i=>i===clip.frameCount?1:clip.timestamps[i]/clip.duration;
  if(clip.paintOrder)out.push('<defs>');
  for(const track of clip.tracks)for(const epoch of [...new Set(track.poses.map(p=>p.epoch))]){
    const active=track.samples.map(index=>index>=0&&track.poses[index].epoch===epoch);
    const first=active.indexOf(true);if(first<0)continue;
    let lastPose=track.samples[first];
    const samples=track.samples.map((index,i)=>{if(active[i])lastPose=index;return lastPose});
    const keys=[{frame:0,pose:samples[0]}];
    for(let i=1;i<samples.length;i++)if(samples[i]!==samples[i-1]){
      if(keys.at(-1).frame!==i-1)keys.push({frame:i-1,pose:samples[i-1]});
      keys.push({frame:i,pose:samples[i]});
    }
    keys.push({frame:clip.frameCount,pose:samples.at(-1)});
    const paths=new Map(keys.map(k=>[k.pose,posePath(track.poses[k.pose],settings)]));
    const visibility=[{frame:0,value:active[0]?'inline':'none'}];
    for(let i=1;i<active.length;i++)if(active[i]!==active[i-1])visibility.push({frame:i,value:active[i]?'inline':'none'});
    visibility.push({frame:clip.frameCount,value:active.at(-1)?'inline':'none'});
    const paint=track.kind==='outer-outline'?'data-ink-edge="true" fill="none" stroke="'+escape(clip.palette[track.color])+'" stroke-width="'+clip.outline.width*clip.width/clip.outline.displayWidth+'" stroke-linecap="round" stroke-linejoin="round"':'fill="'+escape(clip.palette[track.color])+'"';
    out.push('<path id="'+escape(track.id)+'-e'+epoch+'" '+paint+' fill-rule="'+(track.fillRule??'evenodd')+'" display="'+visibility[0].value+'" d="'+paths.get(keys[0].pose)+'">');
    if(new Set(keys.map(k=>k.pose)).size>1)out.push('<animate attributeName="d" dur="'+clip.duration+'s" values="'+keys.map(k=>paths.get(k.pose)).join(';')+'" keyTimes="'+keys.map(k=>keytime(k.frame)).join(';')+'" calcMode="linear" repeatCount="'+repeat+'" fill="freeze"/>');
    if(visibility.length>2)out.push('<animate attributeName="display" dur="'+clip.duration+'s" values="'+visibility.map(k=>k.value).join(';')+'" keyTimes="'+visibility.map(k=>keytime(k.frame)).join(';')+'" calcMode="discrete" repeatCount="'+repeat+'" fill="freeze"/>');
    out.push('</path>');
  }
  if(clip.paintOrder){
    out.push('</defs>');const byId=new Map(clip.tracks.map(t=>[t.id,t]));
    const capacity=Math.max(...clip.paintOrder.map(o=>o.length));
    // Paint slots reference persistent animated paths. Only stacking changes;
    // no raster images or per-frame copies of the whole drawing are exported.
    out.push('<defs><path id="empty-slot" d=""/></defs>');
    for(let slot=0;slot<capacity;slot++){
      const values=clip.paintOrder.map((order,i)=>{const t=byId.get(order[slot]);return t?'#'+t.id+'-e'+t.poses[t.samples[i]].epoch:'#empty-slot'});
      const keys=[{frame:0,value:values[0]}];for(let i=1;i<values.length;i++)if(values[i]!==values[i-1])keys.push({frame:i,value:values[i]});keys.push({frame:clip.frameCount,value:values.at(-1)});
      out.push('<use href="'+escape(values[0])+'">');
      if(keys.length>2)out.push('<animate attributeName="href" values="'+keys.map(k=>escape(k.value)).join(';')+'" keyTimes="'+keys.map(k=>keytime(k.frame)).join(';')+'" dur="'+clip.duration+'s" calcMode="discrete" repeatCount="'+repeat+'" fill="freeze"/>');
      out.push('</use>');
    }
  }
  out.push('</svg>');return out.join('');
}
