import {inferOutlinePalette,isOutlineColour} from './outline-recognition.js';
import {restWorlds} from './body-joins.js';
import {inverse,multiply,point} from './joint-transforms.js';
const pixels=new WeakMap(),bindings=new WeakMap();
export const inkPixel=(r,g,b)=>Math.max(r,g,b)<78;
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
function raster(image){if(pixels.has(image))return pixels.get(image);const w=image.naturalWidth??image.width,h=image.naturalHeight??image.height,scale=Math.min(1,768/Math.max(w,h)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,canvas.width,canvas.height);const result=ctx.getImageData(0,0,canvas.width,canvas.height);result.inkColors=inferOutlinePalette(result.data,result.width,result.height);pixels.set(image,result);return result;}
function sample(image,s,p){const crop=s.crop??[0,0,1,1],u=p.x/s.width+s.pivotX,v=p.y/s.height+s.pivotY;if(u<0||v<0||u>=1||v>=1)return [0,0,0,0];const x=Math.min(image.width-1,Math.floor((crop[0]+u*crop[2])*image.width)),y=Math.min(image.height-1,Math.floor((crop[1]+v*crop[3])*image.height)),i=(y*image.width+x)*4;return Array.from(image.data.subarray(i,i+4));}
function section(image,s,transform,anchor,axis,reach,offset){const cross=[-axis[1],axis[0]],samples=[];
 for(let i=0;i<=256;i++){const at=(i/256*2-1)*reach,p=point(transform,{x:anchor[0]+axis[0]*offset+cross[0]*at,y:anchor[1]+axis[1]*offset+cross[1]*at}),colour=sample(image,s,p);samples.push({at,colour});}
 // Use the connected interval nearest the authored connection, rather than
 // a distant arm, tail or an unrelated contour that crosses the same line.
 const spans=[];let run=null;for(const q of samples){if(q.colour[3]>160){if(!run)run=[];run.push(q);}else if(run){spans.push(run);run=null;}}if(run)spans.push(run);
 return spans.sort((a,b)=>Math.min(...a.map(q=>Math.abs(q.at)))-Math.min(...b.map(q=>Math.abs(q.at))))[0];
}
export function matchJoinSections(body,part,{inkColors=[]}={}){
 const isInk=c=>isOutlineColour(c[0],c[1],c[2],inkColors);
 if(!body?.length||!part?.length)return null;const bw=body.at(-1).at-body[0].at,pw=part.at(-1).at-part[0].at;if(bw<4||pw<4||pw/bw<.35||pw/bw>2.5)return null;
 const palette=[];for(const q of [...body,...part]){if(isInk(q.colour))continue;let c=palette.find(c=>distance(c.colour,q.colour)<48);if(!c){c={colour:q.colour.slice(0,3),body:[],part:[]};palette.push(c);}c[body.includes(q)?'body':'part'].push(q.colour);}
 const label=q=>isInk(q.colour)?'ink':palette.reduce((a,c,i)=>distance(c.colour,q.colour)<a.d?{i,d:distance(c.colour,q.colour)}:a,{i:-1,d:Infinity}).i;
 function edges(samples){const runs=[];for(const q of samples){const id=label(q);if(runs.at(-1)?.id===id)runs.at(-1).end=q.at;else runs.push({id,start:q.at,end:q.at});}return runs.filter(r=>r.end-r.start>bw/160);}
 const a=edges(body),b=edges(part),knots=[[body[0].at,part[0].at]];
 for(let i=1;i<a.length;i++){const candidates=b.slice(1).map((r,j)=>({r,previous:b[j]})).filter(({r,previous})=>previous.id===a[i-1].id&&r.id===a[i].id&&r.start>knots.at(-1)[1]);if(candidates.length===1)knots.push([a[i].start,candidates[0].r.start]);}
 knots.push([body.at(-1).at,part.at(-1).at]);
 const mean=values=>[0,1,2].map(i=>values.reduce((n,c)=>n+c[i],0)/values.length),matches=palette.filter(c=>c.body.length&&c.part.length).map(c=>{const from=mean(c.body),to=mean(c.part);return{body:from,part:to,colour:from.map((n,i)=>(n+to[i])/2)};});
 return {knots,inkColors,halfWidth:Math.max(Math.abs(body[0].at),Math.abs(body.at(-1).at)),matches};
}
export function prepareBodyJoinProfiles(project,images){const active=project.joints.filter(j=>j.bodyJoin?.enabled&&j.bodyJoin.matchEdges!==false),result=new Map();if(!active.length)return result;const rest=restWorlds(project);
 for(const part of active){const j=part.bodyJoin,body=project.joints.find(n=>n.id===j.targetNode),bi=images.get(body.sprite.asset),pi=images.get(part.sprite.asset);if(!bi||!pi)continue;
  const relative=multiply(inverse(rest.get(body.id)),rest.get(part.id)),signature=JSON.stringify([j.anchor,j.radius,body.sprite,part.sprite,relative]),old=bindings.get(part);if(old?.signature===signature&&old.bi===bi&&old.pi===pi){if(old.profile)result.set(part.id,old.profile);continue;}
  const centre=point(relative,{x:(.5-part.sprite.pivotX)*part.sprite.width,y:(.5-part.sprite.pivotY)*part.sprite.height}),local=point(inverse(relative),{x:j.anchor[0],y:j.anchor[1]}),uv=[local.x/part.sprite.width+part.sprite.pivotX,local.y/part.sprite.height+part.sprite.pivotY],edges=[Math.abs(uv[0]),Math.abs(1-uv[0]),Math.abs(uv[1]),Math.abs(1-uv[1])],edge=edges.indexOf(Math.min(...edges)),normal=[[1,0],[-1,0],[0,1],[0,-1]][edge],dx=edges[edge]<.25?relative[0]*normal[0]+relative[2]*normal[1]:centre.x-j.anchor[0],dy=edges[edge]<.25?relative[1]*normal[0]+relative[3]*normal[1]:centre.y-j.anchor[1],length=Math.hypot(dx,dy)||1,axis=[dx/length,dy/length],reach=Math.min(j.radius,Math.max(body.sprite.width,body.sprite.height)/2),bodyPixels=raster(bi),partPixels=raster(pi),partInverse=inverse(relative);
  let profile=null;for(const inset of [2,4,7,10]){const a=section(bodyPixels,body.sprite,[1,0,0,1,0,0],j.anchor,axis,reach,-inset),b=section(partPixels,part.sprite,partInverse,j.anchor,axis,reach,inset);profile=matchJoinSections(a,b,{inkColors:[...(bodyPixels.inkColors??[]),...(partPixels.inkColors??[])]});if(profile)break;}
  if(profile){profile.axis=axis;result.set(part.id,profile);}bindings.set(part,{signature,bi,pi,profile});
 }return result;
}
export function mapJoinCrossSection(value,knots){for(let i=1;i<knots.length;i++)if(value<=knots[i][0]){const a=knots[i-1],b=knots[i],t=(value-a[0])/Math.max(.0001,b[0]-a[0]);return a[1]+(b[1]-a[1])*t;}const end=knots.at(-1);return value+end[1]-end[0];}

// Recognition is only requested for an opted-in pair. A missing match is not
// permission to erase ink: return null so the editor can request a connection.
export function recognizeBodyJoin(project,images,partId,bodyId){
 const part=project.joints.find(j=>j.id===partId),body=project.joints.find(j=>j.id===bodyId);
 if(!part?.sprite||!body?.sprite||part===body)return null;
 const rest=restWorlds(project),relative=multiply(inverse(rest.get(bodyId)),rest.get(partId)),at=point(relative,{x:0,y:0});
 const join={targetNode:bodyId,enabled:true,matchEdges:true,anchor:[at.x,at.y],radius:Math.max(24,Math.min(body.sprite.width,body.sprite.height)*.75),strength:1};
 const candidate={...project,joints:project.joints.map(j=>j.id===partId?{...j,bodyJoin:join}:j)},profile=prepareBodyJoinProfiles(candidate,images).get(partId);
 return profile?.matches.length?{join,profile}:null;
}

export const outlinePaletteForImage=image=>raster(image).inkColors;
