// A sealed 2D liquid container: inertial spring modes + an area-conserving free
// surface. This is deliberately a stylized slosh model, not a particle solver.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const tau=Math.PI*2,wrap=v=>Math.atan2(Math.sin(v),Math.cos(v));
export const polygonArea=p=>Math.abs(p.reduce((n,a,i)=>{const b=p[(i+1)%p.length];return n+a[0]*b[1]-b[0]*a[1];},0)/2);
export const polygonPath=p=>p.length?'M'+p.map(a=>a.map(v=>+v.toFixed(3)).join(' ')).join(' L')+' Z':'';
export function liquidDefaults(boundary=Array.from({length:64},(_,i)=>[Math.cos(i*tau/64)*90,Math.sin(i*tau/64)*110])){return {enabled:true,boundary,fill:.57,frequency:1.15,damping:.32,agitation:1,color:'#976bc4',shadow:'#634486',highlight:'#dbc0f0',ink:'#29232d',lineWidth:0,surfaceDepth:.06,meniscus:2,bubbles:5,layerOffset:-.01};}
export function validateLiquid(c){
 const check=(ok,m)=>{if(!ok)throw Error('Container liquid: '+m);};
 check(Array.isArray(c.boundary)&&c.boundary.length>=3&&c.boundary.length<=512&&c.boundary.every(p=>Array.isArray(p)&&p.length===2&&p.every(v=>Number.isFinite(v)&&Math.abs(v)<=10000)),'provide 3–512 finite boundary points');check(polygonArea(c.boundary)>1,'boundary has no area');
 for(const [k,a,b]of [['fill',0,1],['frequency',.2,8],['damping',.03,2],['agitation',0,3],['lineWidth',0,20],['bubbles',0,24],['layerOffset',-100,100]])check(Number.isFinite(c[k])&&c[k]>=a&&c[k]<=b,'invalid '+k);
 for(const k of ['color','shadow','highlight','ink'])check(/^#[\da-f]{6}$/i.test(c[k]),'invalid '+k);
 for(const [k,a,b]of [['surfaceDepth',0,.2],['meniscus',0,12]])if(c[k]!==undefined)check(Number.isFinite(c[k])&&c[k]>=a&&c[k]<=b,'invalid '+k);
 // A crossing contour has ambiguous volume. Concave, simple contours are fine.
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 for(let i=0;i<c.boundary.length;i++)for(let j=i+2;j<c.boundary.length;j++){if(i===0&&j===c.boundary.length-1)continue;const a=c.boundary[i],b=c.boundary[(i+1)%c.boundary.length],d=c.boundary[j],e=c.boundary[(j+1)%c.boundary.length];check(!(cross(a,b,d)*cross(a,b,e)<-1e-7&&cross(d,e,a)*cross(d,e,b)<-1e-7),'boundary must not cross itself');}
 return c;
}
export function createLiquidState(motion={angle:0,x:0,y:0}){return{time:0,slope:0,slopeVelocity:0,wave:0,waveVelocity:0,vx:0,vy:0,av:0,motion:{...motion}};}
export function advanceLiquid(state,motion,dt,c){
 if(!Number.isFinite(dt)||dt<=0)return state;
 // Bound catch-up after an inactive tab; don't turn a frame stall into an impulse.
 dt=Math.min(.1,dt);const from={...state.motion},steps=Math.ceil(dt*120),h=dt/steps,height=Math.max(...c.boundary.map(p=>p[1]))-Math.min(...c.boundary.map(p=>p[1])),g=Math.max(200,height*9),angleDelta=wrap(motion.angle-from.angle);
 for(let i=1;i<=steps;i++){
  const m={angle:from.angle+angleDelta*i/steps,x:from.x+(motion.x-from.x)*i/steps,y:from.y+(motion.y-from.y)*i/steps},vx=clamp((m.x-state.motion.x)/h,-g,g),vy=clamp((m.y-state.motion.y)/h,-g,g),av=clamp(wrap(m.angle-state.motion.angle)/h,-16,16),ax=clamp((vx-state.vx)/h,-g*3,g*3),ay=clamp((vy-state.vy)/h,-g*.7,g*.7),w=tau*c.frequency,target=clamp(Math.atan2(-ax,g-ay),-.8,.8);
  state.slopeVelocity+=clamp(av-state.av,-6,6)*.36*c.agitation;
  state.slopeVelocity+=(w*w*(target-state.slope)-2*c.damping*w*state.slopeVelocity)*h;
  state.slope=clamp(state.slope+state.slopeVelocity*h,-1.1,1.1);
  const waveW=w*1.65;state.waveVelocity+=clamp(av-state.av,-6,6)*height*.11*c.agitation+clamp(vx-state.vx,-height,height)*.045*c.agitation;
  state.waveVelocity+=(-waveW*waveW*state.wave-2*Math.max(.07,c.damping*.65)*waveW*state.waveVelocity)*h;
  state.wave=clamp(state.wave+state.waveVelocity*h,-height*.1,height*.1);
  Object.assign(state,{motion:m,vx,vy,av,time:state.time+h});
 }
 state.motion={...motion};return state;
}
export class LiquidTimeline{
 constructor(config,motion){this.config=config;this.motion=motion;this.reset();}
 reset(){this.frame=0;this.state=createLiquidState(this.motion(0));this.checkpoints=new Map([[0,structuredClone(this.state)]]);}
 sample(time){const frame=Math.max(0,Math.floor(time*120+1e-6));if(frame<this.frame){const at=[...this.checkpoints.keys()].filter(n=>n<=frame).sort((a,b)=>b-a)[0]??0;this.frame=at;this.state=structuredClone(this.checkpoints.get(at));}
  while(this.frame<frame){this.frame++;advanceLiquid(this.state,this.motion(this.frame/120),1/120,this.config);if(this.frame%120===0){this.checkpoints.set(this.frame,structuredClone(this.state));if(this.checkpoints.size>64)this.checkpoints.delete([...this.checkpoints.keys()].find(k=>k!==0));}}
  return structuredClone(this.state);
 }
}
export function liquidSurface(c,state,motion=state.motion){
 const a=motion.angle+state.slope,n=[Math.sin(a),Math.cos(a)],t=[n[1],-n[0]],uv=c.boundary.map(([x,y])=>[x*t[0]+y*t[1],x*n[0]+y*n[1]]),umin=Math.min(...uv.map(p=>p[0])),umax=Math.max(...uv.map(p=>p[0])),vmin=Math.min(...uv.map(p=>p[1])),vmax=Math.max(...uv.map(p=>p[1])),span=umax-umin;
 const fullness=Math.sin(Math.PI*clamp(c.fill,0,1))**.65;
 let contactMin=umin,contactMax=umax;
 const wave=u=>{const q=(u-umin)/span;return fullness*(state.wave*Math.cos(q*tau)*.55+state.waveVelocity/(tau*c.frequency*1.65)*Math.sin(q*tau)*.2)-(c.meniscus??0)*fullness*(Math.exp(-Math.abs(u-contactMin)/5)+Math.exp(-Math.abs(u-contactMax)/5));};
 const slices=[],count=160,du=span/count;let total=0;
 for(let k=0;k<count;k++){const u=umin+(k+.5)*du,crossings=[];for(let i=0;i<uv.length;i++){const p=uv[i],q=uv[(i+1)%uv.length];if((p[0]<=u&&q[0]>u)||(q[0]<=u&&p[0]>u))crossings.push(p[1]+(q[1]-p[1])*(u-p[0])/(q[0]-p[0]));}crossings.sort((a,b)=>a-b);const intervals=[];for(let i=0;i+1<crossings.length;i+=2){intervals.push([crossings[i],crossings[i+1]]);total+=(crossings[i+1]-crossings[i])*du;}slices.push({u,intervals,w:wave(u)});}
 const area=level=>slices.reduce((sum,s)=>sum+s.intervals.reduce((n,[lo,hi])=>n+Math.max(0,hi-Math.max(lo,level+s.w)),0)*du,0);
 const solve=()=>{let low=vmin-Math.abs(state.wave)*2-Math.abs(state.waveVelocity)-25,high=vmax+Math.abs(state.wave)*2+Math.abs(state.waveVelocity)+25;for(let i=0;i<32;i++){const mid=(low+high)/2;if(area(mid)>total*c.fill)low=mid;else high=mid;}return(low+high)/2;};
 let level=solve();
 const wet=slices.filter(s=>s.intervals.some(([lo,hi])=>level+s.w>=lo&&level+s.w<=hi));
 if(wet.length){contactMin=wet[0].u-du*.5;contactMax=wet.at(-1).u+du*.5;for(const s of slices)s.w=wave(s.u);level=solve();}
 const local=(u,v)=>[t[0]*u+n[0]*v,t[1]*u+n[1]*v],samples=Array.from({length:129},(_,i)=>{const u=umin+span*i/128;return[u,level+wave(u)];});
 const surface=samples.map(([u,v])=>local(u,v));
 const fillPath=offset=>polygonPath([...samples.map(([u,v])=>local(u,v+offset)),local(umax,vmax+span+1),local(umin,vmax+span+1)]);
 const width=contactMax-contactMin,capDepth=Math.min(width*(c.surfaceDepth??.06),Math.max(0,vmax-level)*.4,Math.max(0,level-vmin)*.45);
 const capLine=(side,from=0,to=1)=>Array.from({length:65},(_,i)=>{const q=from+(to-from)*i/64,u=contactMin+width*q,lens=Math.sqrt(Math.max(0,1-(q*2-1)**2));return local(u,level+wave(u)+side*capDepth*lens);});
 const frontSurface=samples.map(([u,v])=>local(u,v+capDepth*Math.sqrt(Math.max(0,1-((u-contactMin)/width*2-1)**2)))),bodyFill=polygonPath([...frontSurface,local(umax,vmax+span+1),local(umin,vmax+span+1)]);
 const cap=c.fill<=0||c.fill>=1?'':polygonPath([...capLine(-1),...capLine(1).reverse()]);
 const shine=capLine(-.55,.1,.48),ribbon=c.fill<=0||c.fill>=1?'':polygonPath([...shine,...shine.toReversed().map(([x,y])=>[x+n[0]*2,y+n[1]*2])]);
 // A curved lower shade, not a second horizontal layer of liquid.
 const shadeTop=Array.from({length:65},(_,i)=>{const q=i/64,u=umin+span*q;return local(u,level+(vmax-level)*(.68+.2*Math.sin(q*Math.PI)) + state.wave*.08*Math.sin(q*tau));});
 const shade=polygonPath([...shadeTop,local(umax,vmax+span),local(umin,vmax+span)]);
 const line='M'+surface.map(p=>p.map(v=>+v.toFixed(3)).join(' ')).join(' L');
 return {boundary:polygonPath(c.boundary),fill:c.fill<=0?'':c.fill>=1?polygonPath(c.boundary):bodyFill,shade:c.fill<=0?'':shade,ribbon,cap,surface:c.fill<=0||c.fill>=1?'':line,level,area:area(level),totalArea:total,normal:n,tangent:t,slices,range:{umin,umax,vmin,vmax},local};
}
export function liquidBubbles(c,state,surface){const {umin,umax,vmax}=surface.range,out=[];if(c.fill<=0)return out;for(let i=0;i<Math.round(c.bubbles);i++){const seed=(i*.61803398875+.21)%1,u=umin+(umax-umin)*(.12+seed*.76),life=(state.time*(.09+seed*.035)+seed)%1,v=vmax-(vmax-surface.level)*life;out.push({center:surface.local(u,v),radius:2.4+seed*2.8,opacity:Math.sin(life*Math.PI)*.38});}return out;}
