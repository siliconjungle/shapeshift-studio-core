// Trim the stroke only. Keep cubic geometry so caps, joins and SVG export agree.
export const TRIM_DEFAULTS=Object.freeze({trimStart:0,trimEnd:1,trimOffset:0});
const measurements=new WeakMap();
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
const clamp=x=>Math.max(0,Math.min(1,x));
function split(p,t){const a=lerp(p[0],p[1],t),b=lerp(p[1],p[2],t),c=lerp(p[2],p[3],t),d=lerp(a,b,t),e=lerp(b,c,t),f=lerp(d,e,t);return [[p[0],a,d,f],[f,e,c,p[3]]];}
function bounds(p){return [distance(p[0],p[3]),distance(p[0],p[1])+distance(p[1],p[2])+distance(p[2],p[3])];}
function measureCurve(p){
 const leaves=[];let length=0;
 const visit=(p,a,b,depth)=>{const [chord,polygon]=bounds(p);if(depth===18||polygon-chord<=1e-5+polygon*1e-7){const size=(chord+polygon)/2;leaves.push({p,a,b,start:length,length:size});length+=size;return;}const [left,right]=split(p,.5),mid=(a+b)/2;visit(left,a,mid,depth+1);visit(right,mid,b,depth+1);};
 visit(p,0,1,0);return {length,leaves};
}
function parameter(segment,length){
 if(length<=0)return 0;if(length>=segment.length)return 1;
 if(segment.type==='L')return length/segment.length;
 const leaves=segment.leaves;let lo=0,hi=leaves.length-1;
 while(lo<hi){const mid=(lo+hi)>>1;if(leaves[mid].start+leaves[mid].length<length)lo=mid+1;else hi=mid;}
 const leaf=leaves[lo],target=length-leaf.start;let a=0,b=1;
 // Arc length is not proportional to t, even for a straight cubic.
 for(let i=0;i<28;i++){const t=(a+b)/2,[chord,polygon]=bounds(split(leaf.p,t)[0]);if((chord+polygon)/2<target)a=t;else b=t;}
 return leaf.a+(leaf.b-leaf.a)*(a+b)/2;
}
function measure(shape){
 const cached=measurements.get(shape.points);if(cached?.commands===shape.commands&&cached.pointCount===shape.points.length&&cached.commandCount===shape.commands.length)return cached;
 const contours=[];let contour=null,current=null,index=0,total=0;
 const begin=p=>{contour={start:p,segments:[],length:0,offset:total,closed:false};contours.push(contour);current=p;};
 const add=(type,p)=>{const measured=type==='C'?measureCurve(p):{length:distance(p[0],p[1])};contour.segments.push({type,p,start:contour.length,...measured});contour.length+=measured.length;total+=measured.length;current=p.at(-1);};
 for(const type of shape.commands){
  if(type==='M'){begin(shape.points.slice(index,index+2));index+=2;}
  else if(type==='Z'){if(contour&&!contour.closed){add('L',[current,contour.start]);contour.closed=true;}}
  else {if(contour.closed)begin(current);if(type==='L'){add(type,[current,shape.points.slice(index,index+2)]);index+=2;}else {add(type,[current,...[0,2,4].map(i=>shape.points.slice(index+i,index+i+2))]);index+=6;}}
 }
 const result={commands:shape.commands,pointCount:shape.points.length,commandCount:shape.commands.length,contours,length:total};measurements.set(shape.points,result);return result;
}
function sliceContour(contour,start,end){
 const out={commands:[],points:[]};
 for(const segment of contour.segments){
  const from=Math.max(0,start-segment.start),to=Math.min(segment.length,end-segment.start);if(to<=from||segment.length===0)continue;
  const a=parameter(segment,from),b=parameter(segment,to);let p=segment.p;
  if(segment.type==='C'){if(b<1)p=split(p,b)[0];if(a>0)p=split(p,a/b)[1];}else p=[lerp(p[0],p[1],a),lerp(p[0],p[1],b)];
  if(!out.commands.length){out.commands.push('M');out.points.push(...p[0]);}
  out.commands.push(segment.type);out.points.push(...p.slice(1).flat());
 }
 if(out.commands.length&&contour.closed&&start===0&&end===contour.length)out.commands.push('Z');
 return out;
}
export function trimStroke(shape){
 if(!shape.trimMode||shape.trimMode==='off')return shape;
 const start=clamp(shape.trimStart??0),end=clamp(shape.trimEnd??1),span=Math.abs(end-start);
 if(span>=1)return shape;
 const out={commands:[],points:[]};if(span===0)return out;
 const measured=measure(shape),offset=shape.trimOffset??0,begin=((Math.min(start,end)+offset)%1+1)%1;
 const ranges=length=>{const a=begin*length,b=(begin+span)*length;return b>length?[[a,length],[0,b-length]]:[[a,b]];};
 for(const contour of measured.contours){
  const intervals=shape.trimMode==='synced'?ranges(contour.length):ranges(measured.length).map(([a,b])=>[a-contour.offset,b-contour.offset]);
  const parts=intervals.map(([a,b])=>sliceContour(contour,Math.max(0,a),Math.min(contour.length,b))).filter(p=>p.commands.length);
  // A closed contour crossing its origin has a join, not two stroke caps.
  if(contour.closed&&parts.length===2){parts[0].commands=parts[0].commands.concat(parts[1].commands.slice(1));parts[0].points=parts[0].points.concat(parts[1].points.slice(2));parts.pop();}
  for(const part of parts){for(const command of part.commands)out.commands.push(command);for(const point of part.points)out.points.push(point);}
 }
 return out;
}

// Sample by travelled arc length across contours; exact nonzero whole laps
// land on the final endpoint, including for open paths.
export function samplePath(shape,progress){
 const measured=measure(shape);if(measured.length<=1e-10)return null;
 let u=((progress%1)+1)%1;if(progress!==0&&u===0)u=1;const length=u*measured.length;
 let contour=measured.contours.find(c=>c.length>1e-10&&length<=c.offset+c.length)??measured.contours.filter(c=>c.length>1e-10).at(-1),at=Math.max(0,Math.min(contour.length,length-contour.offset));
 const segment=contour.segments.find(s=>s.length>1e-10&&at<=s.start+s.length)??contour.segments.filter(s=>s.length>1e-10).at(-1),t=u===1?1:parameter(segment,at-segment.start),p=segment.p;
 let position,tangent;if(segment.type==='L'){position=lerp(p[0],p[1],t);tangent=[p[1][0]-p[0][0],p[1][1]-p[0][1]];}else{const q=1-t;position=[0,1].map(i=>q*q*q*p[0][i]+3*q*q*t*p[1][i]+3*q*t*t*p[2][i]+t*t*t*p[3][i]);tangent=[0,1].map(i=>3*q*q*(p[1][i]-p[0][i])+6*q*t*(p[2][i]-p[1][i])+3*t*t*(p[3][i]-p[2][i]));if(Math.hypot(...tangent)<1e-10){const candidates=t<.5?[p[1],p[2],p[3]].map(v=>[v[0]-p[0][0],v[1]-p[0][1]]):[p[2],p[1],p[0]].map(v=>[p[3][0]-v[0],p[3][1]-v[1]]);tangent=candidates.find(v=>Math.hypot(...v)>1e-10)??[1,0];}}
 const n=Math.hypot(...tangent)||1;return{position,tangent:tangent.map(v=>v/n),length:measured.length};
}
