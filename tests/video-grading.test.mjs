import test from 'node:test';import assert from 'node:assert/strict';
import {gradePixels} from '../src/rendering/color-grading-pixels.js';
import {vectorizeReferenceFrames} from '../src/video-vectorizer/reference-node.js';
test('source grading preserves neutral bytes and alpha and follows shader exposure',()=>{
 const frame={width:2,height:1,data:new Uint8Array([128,128,128,123,0,0,0,255])};
 assert.equal(gradePixels(frame,{preset:'neutral'}),frame);
 const result=gradePixels(frame,{exposure:1,inkProtection:0});assert.equal(result.data[0],176);assert.equal(result.data[3],123);assert.equal(result.data[4],0);assert.equal(frame.data[0],128);
});
test('grade is applied before palette/tracing and prepared frames expose the same colours',async()=>{
 const data=new Uint8Array(24*24*4);for(let p=0;p<data.length;p+=4)data.set([128,128,128,255],p);
 const prepared=[];const clip=await vectorizeReferenceFrames([{width:24,height:24,data}],{colors:4,grading:{exposure:1,inkProtection:0},onPreparedFrame:f=>prepared.push(f)});
 assert.equal(prepared.length,1);assert.equal(prepared[0].data[0],176);assert.ok(clip.palette.includes('#b0b0b0'));assert.equal(clip.settings.gradeBaked,true);assert.equal(data[0],128);
});
