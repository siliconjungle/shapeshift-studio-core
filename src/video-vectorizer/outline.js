import {components,regionRings,matchRegions,signedArea} from './regions.js';
import {TRANSPARENT} from './palette.js';
import {sampleMotion} from './motion.js';
import {fitContours,sameRings} from './curves.js';

export function outlineSettings(value,width){
 if(!value)return null;
 const out={width:4.4,displayWidth:width,color:'#211e1a',background:null,backgroundTolerance:24,minArea:16,...(value===true?{}:value)};
 for(const key of ['width','displayWidth','backgroundTolerance','minArea'])if(!Number.isFinite(out[key])||out[key]<=0)throw Error('Invalid outline '+key);
 if(!/^#[0-9a-f]{6}$/i.test(out.color))throw Error('Invalid outline color');
 if(out.background!==null)if(!/^#[0-9a-f]{6}$/i.test(out.background))throw Error('Invalid outline background');
 return out;
}

// Only background connected to the image edge is removed. Enclosed light paint
// (eyes, hat decorations, highlights) stays inside the character silhouette.
export function silhouetteLabels(frame,options,alphaThreshold=128){
 const {width:w,height:h,data}=frame,n=w*h,exterior=new Uint8Array(n),queue=new Int32Array(n);
 const bg=options.background?[1,3,5].map(i=>parseInt(options.background.slice(i,i+2),16)):null,tolerance=options.backgroundTolerance;
 const eligible=p=>data[p*4+3]<alphaThreshold||(bg&&Math.max(...bg.map((v,c)=>Math.abs(v-data[p*4+c])))<=tolerance);
 let head=0,tail=0;
 const visit=p=>{if(!exterior[p]&&eligible(p)){exterior[p]=1;queue[tail++]=p}};
 for(let x=0;x<w;x++){visit(x);visit((h-1)*w+x)}
 for(let y=0;y<h;y++){visit(y*w);visit(y*w+w-1)}
 if(!tail&&!bg)throw Error('Opaque video needs outline.background to identify the outer silhouette');
 while(head<tail){const p=queue[head++],x=p%w,y=Math.floor(p/w);if(x)visit(p-1);if(x+1<w)visit(p+1);if(y)visit(p-w);if(y+1<h)visit(p+w)}
 return Uint16Array.from(exterior,v=>v?TRANSPARENT:0);
}

export function createOutlineTracker(options,config,frameCount,colorIndex){
 const tracks=[];let previous=null,previousFrame=null;
 return {tracks,update(frame,motion,fi){
   const {width,height}=frame,labels=silhouetteLabels(frame,options,config.alphaThreshold),initial=components(labels,width,height);
   for(const r of initial.regions)if(r.area<options.minArea)for(const p of r.pixels)labels[p]=TRANSPARENT;
   const current=components(labels,width,height);
   const prior=new Int32Array(labels.length).fill(-1);
   if(previous)for(let y=0;y<height;y++)for(let x=0;x<width;x++){
     const d=sampleMotion(motion,x,y),px=Math.round(x+d[0]),py=Math.round(y+d[1]);
     if(px>=0&&px<width&&py>=0&&py<height)prior[y*width+x]=previous.componentIds[py*width+px]-1;
   }
   const matches=matchRegions(current.regions,prior,previous);
   for(const region of current.regions){
     const old=previous?.regions[matches.get(region.id)];
     const raw=regionRings(region,current.componentIds,width,height).filter(r=>signedArea(r)>0);
     const fit=fitContours(raw,old?.rings,motion,previousFrame,frame,config);
     const track=old?.track??{id:'outline-'+String(tracks.length+1).padStart(6,'0'),kind:'outer-outline',color:colorIndex,poses:[],samples:new Array(frameCount).fill(-1)};
     if(!old)tracks.push(track);
     const epoch=(old?.epoch??0)+(old&&fit.newTopology?1:0),preceding=old?track.samples[fi-1]:-1;
     let pose=preceding;
     if(pose<0||fit.newTopology||!sameRings(fit.rings,track.poses[pose].rings)){pose=track.poses.length;track.poses.push({epoch,rings:fit.rings})}
     track.samples[fi]=pose;Object.assign(region,{track,epoch,rings:track.poses[pose].rings});
   }
   previous=current;previousFrame=frame;
 },hold(fi){for(const r of previous.regions)r.track.samples[fi]=r.track.samples[fi-1]}};
}
