import {sampleClosedContour} from './contour-sampling.js';
import {curvedPoints} from './curves.js';
import fastClipping from 'polygon-clipping';
import * as preciseClipping from 'polyclip-ts';
// Re-evaluate near-degenerate boolean arrangements with decimal arithmetic.
const clipping=Object.fromEntries(['union','difference'].map(op=>[op,(...shapes)=>{
 try{return fastClipping[op](...shapes);}catch{
  // Snap computed intersections as well as authored vertices. Decimal
  // arithmetic alone can still leave microscopic gaps at a touching fold.
  preciseClipping.setPrecision(1e-7);
  try{return preciseClipping[op](...shapes);}finally{preciseClipping.setPrecision();}
 }
}]));
import {getStroke} from 'perfect-freehand';
const circle=(p,r,n=24)=>Array.from({length:n},(_,i)=>[p[0]+Math.cos(i/n*Math.PI*2)*r,p[1]+Math.sin(i/n*Math.PI*2)*r]);
// Snap contour construction to 1/10000 pixel before boolean operations. This
// prevents near-coincident circle/bridge endpoints forming microscopic edges.
const close=points=>{const out=points.map(p=>p.map(x=>Math.round(x*10000)/10000));return [...out,out[0]];};
function tube(points,radii){
 const shapes=points.map((p,i)=>[close(circle(p,radii[i]))]);
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy);if(d<1e-6)continue;const nx=-dy/d,ny=dx/d,ra=radii[i-1],rb=radii[i];shapes.push([close([[a[0]+nx*ra,a[1]+ny*ra],[a[0]-nx*ra,a[1]-ny*ra],[b[0]-nx*rb,b[1]-ny*rb],[b[0]+nx*rb,b[1]+ny*rb]])]);}
 return clipping.union(...shapes);
}
const path = polygons => polygons.flatMap(poly=>poly.map(ring=>'M'+ring.map(p=>p.map(x=>Number(x.toFixed(3))).join(' ')).join('L')+'Z')).join('');
/** Each surface unions only its own shapes, so layer boundaries remain intentional. */
export function proceduralSurfaces(definition,frame){
 const particles=new Map(definition.particles.map(p=>[p.id,p]));
 return definition.surfaces.filter(s=>s.enabled!==false).map(surface=>{
  let polygons=[];
  for(const shape of surface.shapes){let points=shape.particles.map(id=>frame.points.get(id)),radii=shape.radii??shape.particles.map(id=>Math.max(.01,particles.get(id).radius));let next;
   if(shape.curve&&shape.type!=='discs')({points,radii}=curvedPoints(points,{radii,closed:shape.type==='polygon',curve:shape.curve}));
   if(shape.type==='polygon')next=[[close(points)]];
   else if(shape.type==='tube')next=tube(points,radii);
   else next=clipping.union(...points.map((p,i)=>[close(circle(p,radii[i]))]));
   polygons=shape.operation==='subtract'?(polygons.length?clipping.difference(polygons,next):[]):polygons.length?clipping.union(polygons,next):next;
  }
  let ink=[];
  if(surface.outline==='ink'&&surface.strokeWidth>0&&surface.stroke!=='none'){
   // Uniform pressure is stable under playback; thinning is driven by curvature,
   // never by frame rate. Every closed contour, including holes, receives ink.
   for(const poly of polygons)for(const ring of poly){const samples=sampleClosedContour(ring);
    if(samples.length<2)continue;const stroke=getStroke(samples,{size:surface.strokeWidth,thinning:surface.thinning??0,smoothing:surface.smoothing??.5,streamline:0,simulatePressure:false,last:true,start:{cap:true},end:{cap:true}});if(stroke.length>2)ink.push([close(stroke)]);
   }
  }
  return {...surface,polygons,fillPath:path(polygons),inkPath:path(ink)};
 }).sort((a,b)=>a.layer-b.layer);
}
export function drawProceduralSurface(ctx,surface){
 ctx.save();ctx.globalAlpha*=surface.opacity??1;const p=new Path2D(surface.fillPath);
 if(surface.fill!=='none'){ctx.fillStyle=surface.fill;ctx.fill(p,'evenodd');}
 if(surface.stroke!=='none'&&surface.strokeWidth>0){if(surface.outline==='ink'){ctx.fillStyle=surface.stroke;ctx.fill(new Path2D(surface.inkPath),'nonzero');}else{ctx.strokeStyle=surface.stroke;ctx.lineWidth=surface.strokeWidth;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke(p);}}
 ctx.restore();
}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function proceduralSVG(definition,frame,{viewBox=[-300,-250,600,500]}={}){
 const body=proceduralSurfaces(definition,frame).map(s=>`<g id="${esc(s.id)}" data-layer="${s.layer}" opacity="${s.opacity??1}"><path d="${s.fillPath}" fill="${s.fill}" fill-rule="evenodd" stroke="${s.outline==='round'?s.stroke:'none'}" stroke-width="${s.strokeWidth}" stroke-linejoin="round"/>${s.inkPath?`<path d="${s.inkPath}" fill="${s.stroke}" fill-rule="nonzero"/>`:''}</g>`).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.join(' ')}">${body}</svg>`;
}
