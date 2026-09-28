import {sampleMotion} from './motion.js';

/** Clip-wide motion gating, derived from the earlier motion-hold experiment.
 * Directional temporal averaging distinguishes coherent movement from shimmer.
 * Anchored appearance checks admit births, blinks and newly revealed content. */
export function buildMotionGates(fields,frames,{tileSize=32,minimumSpeed=.15,updateSpeed=.5,accumulatedDistance=.65,directionalCoherence=.6}={}){
 const {width,height}=frames[0],columns=Math.ceil(width/tileSize),rows=Math.ceil(height/tileSize),cells=columns*rows;
 const anchors=new Int32Array(cells),accX=new Float32Array(cells),accY=new Float32Array(cells),cooldown=new Uint8Array(cells),masks=[];
 let held=0;
 for(let fi=0;fi<frames.length;fi++){
  const moving=new Uint8Array(cells),active=new Uint8Array(cells);
  for(let cell=0;cell<cells;cell++){
   const x0=cell%columns*tileSize,y0=Math.floor(cell/columns)*tileSize,x1=Math.min(width,x0+tileSize),y1=Math.min(height,y0+tileSize),x=(x0+x1)/2,y=(y0+y1)/2;
   let vx=0,vy=0,magnitude=0,weight=0;
   for(let dt=-3;dt<=3;dt++){
    const field=fields[fi+dt];if(!field)continue;
    const w=Math.exp(-dt*dt/(2*1.25**2)),d=sampleMotion(field,x*field.width/width,y*field.height/height),dx=d[0]*width/field.width,dy=d[1]*height/field.height;
    vx+=dx*w;vy+=dy*w;magnitude+=Math.hypot(dx,dy)*w;weight+=w;
   }
   vx/=weight||1;vy/=weight||1;magnitude/=weight||1;
   const speed=Math.hypot(vx,vy),coherent=speed>minimumSpeed&&speed/Math.max(.02,magnitude)>directionalCoherence;
   if(coherent){accX[cell]+=vx;accY[cell]+=vy}else{accX[cell]*=.5;accY[cell]*=.5}
   let appearance=0,strong=0,count=0;const a=frames[anchors[cell]].data,b=frames[fi].data;
   for(let yy=y0;yy<y1;yy+=2)for(let xx=x0;xx<x1;xx+=2){const p=(yy*width+xx)*4,delta=Math.max((Math.abs(a[p]-b[p])+Math.abs(a[p+1]-b[p+1])+Math.abs(a[p+2]-b[p+2]))/3,Math.abs(a[p+3]-b[p+3]));appearance+=delta;if(delta>25)strong++;count++;}
   if(fi===0||(coherent&&(cooldown[cell]>0||speed>updateSpeed||Math.hypot(accX[cell],accY[cell])>accumulatedDistance))||appearance/Math.max(1,count)>12||strong/Math.max(1,count)>.08)moving[cell]=1;
  }
  // Include the swept edge and adjacent revealed pixels, then keep a short tail.
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++)if(moving[y*columns+x])for(let yy=Math.max(0,y-1);yy<=Math.min(rows-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(columns-1,x+1);xx++)active[yy*columns+xx]=1;
  for(let cell=0;cell<cells;cell++){
   cooldown[cell]=active[cell]?2:Math.max(0,cooldown[cell]-1);active[cell]=cooldown[cell]>0?1:0;
   if(active[cell]){anchors[cell]=fi;accX[cell]=0;accY[cell]=0}else if(fi)held++;
  }
  masks.push(active);
 }
 return {tileSize,columns,rows,masks,heldFraction:held/Math.max(1,(frames.length-1)*cells)};
}
