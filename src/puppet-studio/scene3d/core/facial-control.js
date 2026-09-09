// Timeline-owned facial channels compose over the independent expression layer.
// Half-open intervals and explicit priorities make seeking and overlapping actions deterministic.
export function validateFaceControl(c,duration){
 const fail=m=>{throw Error('3D face control: '+m);},number=(n,a,b)=>typeof n==='number'&&Number.isFinite(n)&&n>=a&&n<=b;
 if(!c||typeof c!=='object'||Array.isArray(c))fail('expected control object');
 for(const k of Object.keys(c))if(!['open','tilt','gaze','blink','priority','release'].includes(k))fail('unknown channel '+k);
 for(const [k,a,b]of [['open',0,1.3],['tilt',-1,1]])if(c[k]!==undefined&&c[k]!=='clip'&&!number(c[k],a,b))fail('invalid '+k);
 if(c.gaze!==undefined&&c.gaze!=='clip'&&!(Array.isArray(c.gaze)&&c.gaze.length===2&&c.gaze.every(n=>number(n,-2,2))))fail('invalid gaze');
 if(c.blink!==undefined&&typeof c.blink!=='boolean')fail('invalid blink');
 if(c.priority!==undefined&&!number(c.priority,-100,100))fail('invalid priority');
 if(c.release!==undefined&&!number(c.release,0,duration))fail('invalid release');
}
export function composeFace(eye,face,events,node,time){
 let open=eye.open*(face.expressionOpen??face.open),tilt=eye.tilt+face.tilt,gaze=[eye.gaze[0]+face.gaze[0],eye.gaze[1]+face.gaze[1]],blink=face.blink;
 const active=faceControlStack(events,node,time);
 for(const e of active){const c=e.faceControl??{open:'clip',tilt:'clip',gaze:[0,0],blink:false},remaining=e.time+e.duration-time,t=c.release?Math.min(1,remaining/c.release):1,w=t*t*(3-2*t),mix=(a,b)=>a+(b-a)*w;
  if(c.open!==undefined)open=mix(open,c.open==='clip'?eye.open:c.open);
  if(c.tilt!==undefined)tilt=mix(tilt,c.tilt==='clip'?eye.tilt:c.tilt);
  if(c.gaze!==undefined)gaze=gaze.map((v,i)=>mix(v,c.gaze==='clip'?eye.gaze[i]:c.gaze[i]));
  if(c.blink!==undefined)blink=mix(blink,c.blink?face.blink:0);
 }
 return{open:open*(1-blink),tilt,gaze};
}

export const faceControlStack=(events,node,time)=>events.filter(e=>e.node===node&&(e.faceControl||e.lockFace)&&time>=e.time&&time<e.time+e.duration).sort((a,b)=>(a.faceControl?.priority??0)-(b.faceControl?.priority??0)||a.time-b.time||a.id.localeCompare(b.id));
