import {TRANSPARENT,colorDistance} from './palette.js';
import {sampleMotion} from './motion.js';

export function segmentFrame(frame,palette,classify,previous,field,{alphaThreshold=128,colorHysteresis=6,spatialDenoise=2,noiseTolerance=3,previousFrame}={}) {
  const {width,height,data}=frame,n=width*height,labels=new Uint16Array(n),priorComponents=new Int32Array(n).fill(-1);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const p=y*width+x,k=p*4;
    if(data[k+3]<alphaThreshold){labels[p]=TRANSPARENT;continue}
    let label=classify(data[k],data[k+1],data[k+2]);
    if(previous){
      if(previousFrame){
        const old=previousFrame.data,difference=(Math.abs(data[k]-old[k])+Math.abs(data[k+1]-old[k+1])+Math.abs(data[k+2]-old[k+2]))/3;
        if(difference<=noiseTolerance&&Math.abs(data[k+3]-old[k+3])<=noiseTolerance){labels[p]=previous.labels[p];priorComponents[p]=previous.componentIds[p]-1;continue;}
      }
      const d=sampleMotion(field,x,y),px=Math.round(x+d[0]),py=Math.round(y+d[1]);
      if(px>=0&&py>=0&&px<width&&py<height){
        const old=py*width+px,prior=previous.labels[old];priorComponents[p]=previous.componentIds[old]-1;
        if(prior!==TRANSPARENT && colorDistance(data[k],data[k+1],data[k+2],palette[prior]) <= colorDistance(data[k],data[k+1],data[k+2],palette[label])+colorHysteresis**2)label=prior;
      }
    }
    labels[p]=label;
  }
  // Suppress isolated near-colour noise without crossing high-contrast ink edges.
  for(let pass=0;pass<spatialDenoise;pass++){
    const before=labels.slice();
    for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
      const p=y*width+x,own=before[p];if(own===TRANSPARENT)continue;
      const neighbors=[before[p-width-1],before[p-width],before[p-width+1],before[p-1],before[p+1],before[p+width-1],before[p+width],before[p+width+1]];
      if(neighbors.filter(c=>c===own).length>=3)continue;
      let best=own,count=0;
      for(const c of neighbors){if(c===TRANSPARENT)continue;const n=neighbors.filter(v=>v===c).length;if(n>count){count=n;best=c}}
      if(count>=4&&colorDistance(...palette[own],palette[best])<=24**2)labels[p]=best;
    }
  }
  return {labels,priorComponents};
}
export function components(labels,width,height) {
  const ids=new Uint32Array(labels.length),regions=[],queue=new Int32Array(labels.length);
  for(let seed=0;seed<labels.length;seed++){
    if(ids[seed] || labels[seed]===TRANSPARENT)continue;
    const id=regions.length+1,color=labels[seed],pixels=[];
    let first=0,last=1,minX=width,minY=height,maxX=0,maxY=0,sx=0,sy=0;
    queue[0]=seed;ids[seed]=id;
    while(first<last){
      const p=queue[first++],x=p%width,y=Math.floor(p/width);pixels.push(p);
      minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);sx+=x+.5;sy+=y+.5;
      const visit=q=>{if(!ids[q]&&labels[q]===color){ids[q]=id;queue[last++]=q}};
      if(x)visit(p-1);if(x+1<width)visit(p+1);if(y)visit(p-width);if(y+1<height)visit(p+width);
    }
    regions.push({id:id-1,color,pixels,area:pixels.length,bbox:[minX,minY,maxX+1,maxY+1],center:[sx/pixels.length,sy/pixels.length]});
  }
  return {regions,componentIds:ids};
}
export function removeSpeckles(labels,width,height,minimumArea=4) {
  const first=components(labels,width,height);
  for(const region of first.regions){
    if(region.area>=minimumArea)continue;
    const counts=new Map();
    for(const p of region.pixels){
      const x=p%width,y=Math.floor(p/width),adj=[];
      if(x)adj.push(p-1);if(x+1<width)adj.push(p+1);if(y)adj.push(p-width);if(y+1<height)adj.push(p+width);
      for(const q of adj)if(labels[q]!==region.color)counts.set(labels[q],(counts.get(labels[q])??0)+1);
    }
    const replacement=[...counts].sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0]?.[0];
    if(replacement!==undefined)for(const p of region.pixels)labels[p]=replacement;
  }
  return components(labels,width,height);
}
export function signedArea(ring) {
  let area=0;for(let i=0,j=ring.length-1;i<ring.length;j=i++)area+=ring[j][0]*ring[i][1]-ring[i][0]*ring[j][1];return area/2;
}
export function regionRings(region,componentIds,width,height) {
  const stride=width+1,edges=[],outgoing=new Map();
  const edge=(x,y,xx,yy,dir)=>{
    const a=y*stride+x,b=yy*stride+xx,index=edges.length;edges.push({a,b,dir});
    if(!outgoing.has(a))outgoing.set(a,[]);outgoing.get(a).push(index);
  };
  const inside=p=>componentIds[p]===region.id+1;
  for(const p of region.pixels){
    const x=p%width,y=Math.floor(p/width);
    if(!y||!inside(p-width))edge(x,y,x+1,y,0);
    if(x+1===width||!inside(p+1))edge(x+1,y,x+1,y+1,1);
    if(y+1===height||!inside(p+width))edge(x+1,y+1,x,y+1,2);
    if(!x||!inside(p-1))edge(x,y+1,x,y,3);
  }
  const used=new Uint8Array(edges.length),rings=[],priority=[1,0,3,2];
  for(let start=0;start<edges.length;start++){
    if(used[start])continue;
    const first=edges[start].a,ring=[];let current=start,closed=false;
    for(let guard=0;guard<=edges.length;guard++){
      const e=edges[current];used[current]=1;ring.push([e.a%stride,Math.floor(e.a/stride)]);
      if(e.b===first){closed=true;break}
      const choices=(outgoing.get(e.b)??[]).filter(i=>!used[i]);
      if(!choices.length)break;
      choices.sort((a,b)=>priority.indexOf((edges[a].dir-e.dir+4)%4)-priority.indexOf((edges[b].dir-e.dir+4)%4));
      current=choices[0];
    }
    if(!closed)throw Error('Open region boundary');
    if(ring.length>=3 && Math.abs(signedArea(ring))>=.5)rings.push(ring);
  }
  return rings.sort((a,b)=>Math.abs(signedArea(b))-Math.abs(signedArea(a)));
}
// Match by motion-warped pixel overlap, not array order or frame-local path IDs.
export function matchRegions(regions,priorComponents,previous) {
  if(!previous)return new Map();
  const candidates=[];
  for(const region of regions){
    const overlaps=new Map();
    for(const p of region.pixels){const id=priorComponents[p];if(id>=0)overlaps.set(id,(overlaps.get(id)??0)+1)}
    for(const [id,overlap]of overlaps){
      const old=previous.regions[id];if(!old||old.color!==region.color)continue;
      const iou=overlap/(region.area+old.area-overlap);
      if(iou>=.12 && overlap/Math.min(region.area,old.area)>=.28)candidates.push({current:region.id,previous:id,score:iou,overlap});
    }
  }
  candidates.sort((a,b)=>b.score-a.score||b.overlap-a.overlap||a.current-b.current||a.previous-b.previous);
  const matched=new Map(),claimed=new Set();
  for(const c of candidates)if(!matched.has(c.current)&&!claimed.has(c.previous)){matched.set(c.current,c.previous);claimed.add(c.previous)}
  return matched;
}
