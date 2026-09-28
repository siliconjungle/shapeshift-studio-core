import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMotionGates} from '../src/video-vectorizer/motion-gates.js';
const frame=(value=100)=>({width:64,height:48,data:Uint8Array.from({length:64*48*4},(_,i)=>i%4===3?255:value)});
const field=dx=>({width:64,height:48,step:16,columns:5,rows:4,dx:new Float32Array(20).fill(dx),dy:new Float32Array(20)});
test('alternating movement estimates and small appearance noise settle to exact holds',()=>{
 const frames=Array.from({length:15},(_,i)=>frame(100+(i%2?2:-2))),fields=frames.map((_,i)=>i?field(i%2?.2:-.2):null);
 const gates=buildMotionGates(fields,frames);
 assert.ok(gates.masks[7].every(v=>v===0));assert.ok(gates.masks[11].every(v=>v===0));
});
test('coherent slow motion remains active after its first accumulated update',()=>{
 const frames=Array.from({length:15},()=>frame()),fields=frames.map((_,i)=>i?field(-.3):null);
 const gates=buildMotionGates(fields,frames);
 for(const mask of gates.masks.slice(2,-2))assert.ok(mask.every(v=>v===1));
});
test('appearance changes open the gate even when flow cannot describe a new object',()=>{
 const frames=[frame(),frame(),frame(),frame(220),frame(220)],fields=frames.map((_,i)=>i?field(0):null);
 const gates=buildMotionGates(fields,frames);assert.ok(gates.masks[2].every(v=>!v));assert.ok(gates.masks[3].every(v=>v===1));
});
