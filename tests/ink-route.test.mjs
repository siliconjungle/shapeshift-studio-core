import test from 'node:test';import assert from 'node:assert/strict';
import {inkRoute,routePoint} from '../src/procedural/ink-route.js';
const points=[{x:0,y:0},{x:80,y:20},{x:150,y:-20},{x:240,y:0}];
test('ink routes keep endpoints, evenly space marks by distance, and replay deterministically',()=>{
 const route=inkRoute(points);assert.deepEqual(route,inkRoute(points));assert.deepEqual(routePoint(route,0),points[0]);assert.deepEqual(routePoint(route,1),points.at(-1));
 assert.ok(route.marks.length>10);const gaps=route.marks.slice(1).map((p,i)=>p.t-route.marks[i].t);assert.ok(Math.max(...gaps)-Math.min(...gaps)<1e-10);assert.ok(route.marks.every(p=>p.d.startsWith('M')&&p.d.endsWith('Z')&&!/NaN|Infinity/.test(p.d)));
 const dots=inkRoute(points,{dash:0});assert.ok(dots.marks.length);assert.notEqual(dots.marks[0].d,route.marks[0].d);
});
test('collapsed and short paths stay finite, huge paths have bounded output, invalid settings reject',()=>{
 const route=inkRoute([{x:3,y:7},{x:3,y:7}]);assert.equal(route.length,0);assert.deepEqual(route.marks,[]);assert.deepEqual(routePoint(route,.5),{x:3,y:7});
 assert.equal(inkRoute([{x:0,y:0},{x:1,y:1}]).marks.length,0);
 assert.ok(inkRoute([{x:0,y:0},{x:1e6,y:0}],{spacing:.01}).marks.length<=2048);
 for(const opts of [{width:0},{dash:-1},{spacing:0},{roughness:2}])assert.throws(()=>inkRoute(points,opts));
});
