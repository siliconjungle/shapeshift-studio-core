// Deterministic pyramidal block matching. Backward vectors map current pixels
// into the preceding frame; the same field predicts forward contour movement.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function pyramid(frame) {
  let {width:w,height:h,data}=frame;
  let values=new Float32Array(w*h);
  for(let i=0;i<values.length;i++)values[i]=data[i*4]*.299+data[i*4+1]*.587+data[i*4+2]*.114;
  const levels=[{w,h,values}];
  while(levels.length<3 && Math.min(w,h)>=32) {
    const nw=Math.ceil(w/2),nh=Math.ceil(h/2),next=new Float32Array(nw*nh);
    for(let y=0;y<nh;y++)for(let x=0;x<nw;x++) {
      let sum=0;for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)sum+=values[Math.min(h-1,y*2+dy)*w+Math.min(w-1,x*2+dx)];
      next[y*nw+x]=sum/4;
    }
    w=nw;h=nh;values=next;levels.push({w,h,values});
  }
  return levels;
}
function patchError(a,b,x,y,dx,dy) {
  let total=0;
  for(let oy=-3;oy<=3;oy++)for(let ox=-3;ox<=3;ox++) {
    const ax=clamp(x+ox,0,a.w-1),ay=clamp(y+oy,0,a.h-1);
    const bx=clamp(ax+dx,0,b.w-1),by=clamp(ay+dy,0,b.h-1);
    const d=a.values[ay*a.w+ax]-b.values[by*b.w+bx];total+=Math.min(900,d*d);
  }
  return total/49;
}
export function estimateMotion(previous,current,{motionStep=16}={}) {
  const a=pyramid(current),b=pyramid(previous),step=motionStep;
  const columns=Math.ceil(current.width/step)+1,rows=Math.ceil(current.height/step)+1;
  const dx=new Float32Array(columns*rows),dy=new Float32Array(dx.length),errors=new Float32Array(dx.length);
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++) {
    const px=Math.min(current.width-1,col*step),py=Math.min(current.height-1,row*step);
    let vx=0,vy=0,bestError=Infinity;
    for(let level=a.length-1;level>=0;level--) {
      if(level<a.length-1){vx*=2;vy*=2}
      const x=Math.round(px/2**level),y=Math.round(py/2**level),radius=level===a.length-1?4:2;
      let bx=vx,by=vy,score=Infinity;
      for(let yv=vy-radius;yv<=vy+radius;yv++)for(let xv=vx-radius;xv<=vx+radius;xv++) {
        const e=patchError(a[level],b[level],x,y,xv,yv)+.035*(xv*xv+yv*yv);
        if(e<score){score=e;bx=xv;by=yv}
      }
      vx=bx;vy=by;bestError=score;
    }
    const x=Math.round(px),y=Math.round(py),base=patchError(a[0],b[0],x,y,vx,vy);
    const sub=(lo,hi)=>{const den=lo-2*base+hi;return den>1e-4?clamp((lo-hi)/(2*den),-.5,.5):0};
    const slot=row*columns+col;
    dx[slot]=vx+sub(patchError(a[0],b[0],x,y,vx-1,vy),patchError(a[0],b[0],x,y,vx+1,vy));
    dy[slot]=vy+sub(patchError(a[0],b[0],x,y,vx,vy-1),patchError(a[0],b[0],x,y,vx,vy+1));
    errors[slot]=bestError;
  }
  // Spatially regularize unreliable/noisy matches while preserving coherent motion.
  const ox=dx.slice(),oy=dy.slice();
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
    let sx=0,sy=0,weight=0;
    for(let y=Math.max(0,row-1);y<=Math.min(rows-1,row+1);y++)for(let x=Math.max(0,col-1);x<=Math.min(columns-1,col+1);x++){
      const j=y*columns+x,w=(x===col&&y===row?4:1)/(1+errors[j]/64);sx+=ox[j]*w;sy+=oy[j]*w;weight+=w;
    }
    const j=row*columns+col;dx[j]=sx/weight;dy[j]=sy/weight;
    if(Math.hypot(dx[j],dy[j])<.12){dx[j]=0;dy[j]=0}
  }
  return {width:current.width,height:current.height,step,columns,rows,dx,dy};
}
export function sampleMotion(field,x,y) {
  if(!field)return [0,0];
  const gx=clamp(x/(field.stepX??field.step),0,field.columns-1),gy=clamp(y/(field.stepY??field.step),0,field.rows-1);
  const x0=Math.floor(gx),y0=Math.floor(gy),x1=Math.min(x0+1,field.columns-1),y1=Math.min(y0+1,field.rows-1),u=gx-x0,v=gy-y0;
  const sample=a=>(a[y0*field.columns+x0]*(1-u)+a[y0*field.columns+x1]*u)*(1-v)+(a[y1*field.columns+x0]*(1-u)+a[y1*field.columns+x1]*u)*v;
  return [sample(field.dx),sample(field.dy)];
}
export function scaleMotion(field,width,height){
  if(!field)return null;
  const sx=width/field.width,sy=height/field.height;
  return {...field,width,height,stepX:(field.stepX??field.step)*sx,stepY:(field.stepY??field.step)*sy,dx:Float32Array.from(field.dx,v=>v*sx),dy:Float32Array.from(field.dy,v=>v*sy)};
}
export function moveForward(field,point) {
  let x=point[0],y=point[1];
  for(let i=0;i<3;i++){const d=sampleMotion(field,x,y);x=point[0]-d[0];y=point[1]-d[1]}
  return [x,y];
}
