import test from 'node:test';import assert from 'node:assert/strict';
import {curvedPoints} from '../src/procedural/curves.js';
import {proceduralSurfaces,proceduralSVG} from '../src/procedural/surfaces.js';
import {emptyProcedural,validateProcedural,signedArea} from '../src/procedural/model.js';
const close=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
const points=[[0,-50],[50,0],[0,50],[-50,0]];
function fixture(){const p=emptyProcedural();p.particles=points.map((position,i)=>({id:'p'+i,position,mass:0,radius:8}));p.surfaces=[{id:'body',name:'Body',layer:2,opacity:1,fill:'#77ac95',stroke:'#24363b',strokeWidth:4,outline:'ink',shapes:[{type:'polygon',particles:p.particles.map(p=>p.id),curve:1}]}];return p;}
const frame=p=>({points:new Map(p.particles.map(p=>[p.id,p.position]))});
test('curves interpolate all control points, round the loop and retain tube endpoints and radii',()=>{
 const loop=curvedPoints(points,{closed:true});for(let i=0;i<points.length;i++)assert.deepEqual(loop.points[i*8],points[i]);
 assert.ok(Math.abs(signedArea(loop.points))>Math.abs(signedArea(points))*1.3);
 const tube=curvedPoints(points,{radii:[8,12,5,1]});assert.deepEqual(tube.points[0],points[0]);assert.deepEqual(tube.points.at(-1),points.at(-1));assert.equal(tube.radii[8],12);assert.equal(tube.radii.at(-1),1);assert.ok(tube.radii.every(r=>r>=1&&r<=12));
 assert.deepEqual(curvedPoints(points,{curve:0}).points,points);
});
test('curvature is translation-invariant and remains finite with coincident points',()=>{
 const a=curvedPoints(points,{closed:true}),b=curvedPoints(points.map(p=>[p[0]+350,p[1]-200]),{closed:true});a.points.forEach((p,i)=>{close(b.points[i][0],p[0]+350);close(b.points[i][1],p[1]-200);});
 const repeated=curvedPoints([[0,0],[0,0],[20,0],[20,0]],{radii:[1,2,2,1]});assert.ok(repeated.points.flat().every(Number.isFinite));assert.ok(repeated.radii.every(Number.isFinite));
});
test('curved geometry participates in layer union, holes, ink and SVG export without changing physics',()=>{
 const p=fixture();p.particles.push(...points.map((position,i)=>({id:'h'+i,position:position.map(v=>v*.3),mass:0,radius:2})));
 p.surfaces[0].shapes.push({type:'polygon',particles:['h0','h1','h2','h3'],curve:1,operation:'subtract'});
 p.surfaces.push({...structuredClone(p.surfaces[0]),id:'other',layer:1,shapes:[{type:'tube',particles:['p0','p1','p2'],curve:1,radii:[4,8,2]}]});validateProcedural(p,[]);
 const before=JSON.stringify(p),surfaces=proceduralSurfaces(p,frame(p)),body=surfaces.find(s=>s.id==='body');assert.deepEqual(surfaces.map(s=>s.layer),[1,2]);assert.equal(body.polygons.length,1);assert.equal(body.polygons[0].length,2);assert.ok(body.polygons[0][0].length>points.length+1);assert.ok(body.inkPath.length>0);
 const svg=proceduralSVG(p,frame(p));assert.ok(svg.includes(body.fillPath));assert.ok(svg.includes(body.inkPath));assert.ok(svg.includes('data-layer="2"'));assert.equal(JSON.stringify(p),before);
});
test('zero curvature preserves existing output and invalid curvature is rejected',()=>{
 const p=fixture();delete p.surfaces[0].shapes[0].curve;const original=proceduralSurfaces(p,frame(p))[0].fillPath;p.surfaces[0].shapes[0].curve=0;assert.equal(proceduralSurfaces(p,frame(p))[0].fillPath,original);
 for(const curve of [-1,2,NaN]){p.surfaces[0].shapes[0].curve=curve;assert.throws(()=>validateProcedural(p,[]),/surface curvature/);}
 p.surfaces[0].shapes[0]={type:'discs',particles:['p0'],curve:1};assert.throws(()=>validateProcedural(p,[]),/curvature requires/);
});

test('ink samples do not change when a contour contains tiny collinear tessellation edges',async()=>{
 const {sampleClosedContour}=await import('../src/procedural/contour-sampling.js');
 const sparse=[[0,0],[40,0],[40,40],[0,40],[0,0]],dense=[[0,0],[.00001,0],[.1,0],[12,0],[39.99,0],[40,0],[40,12],[40,40],[0,40],[0,0]],a=sampleClosedContour(sparse),b=sampleClosedContour(dense);assert.equal(a.length,b.length);a.forEach((p,i)=>p.forEach((v,k)=>close(v,b[i][k])));assert.deepEqual(a[0],a.at(-1));assert.deepEqual(sampleClosedContour([[0,0],[0,0]]),[]);
});
