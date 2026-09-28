import test from 'node:test';
import assert from 'node:assert/strict';
import {detectTrailingHold,vectorizeRegionsExperimental as vectorizeVideo,validateVectorVideo} from '../src/video-vectorizer/index.js';
function frame(x,t,alpha=255){
 const width=48,height=24,data=new Uint8Array(width*height*4).fill(255);
 for(let y=6;y<18;y++)for(let xx=x;xx<x+8;xx++){const p=(y*width+xx)*4;data[p]=30;data[p+1]=60;data[p+2]=90;data[p+3]=alpha;}
 return {width,height,data,timestamp:t};
}
test('trim only a long trailing hold; retain internal pauses and timestamps',async()=>{
 const positions=[4,5,6,...Array(10).fill(6),7,8,9,...Array(20).fill(9)];
 const frames=positions.map((x,i)=>frame(x,10+i/10));
 const timing=detectTrailingHold(frames,{frameRate:10,keepSeconds:.3});
 assert.equal(timing.holdStartFrame,15);assert.equal(timing.endFrame,18);
 const full=await vectorizeVideo(frames,{frameRate:10});
 const trimmed=await vectorizeVideo(frames,{frameRate:10,trimTrailingHold:{keepSeconds:.3}});
 validateVectorVideo(trimmed);assert.equal(full.frameCount,36);assert.equal(trimmed.frameCount,18);
 assert.equal(trimmed.timestamps[13],frames[13].timestamp-10);
 assert.equal(trimmed.duration,timing.duration);assert.equal(trimmed.timing.removedFrames,18);
 for(const track of trimmed.tracks)assert.equal(track.samples.length,18);
});
test('slow cumulative motion, short pauses, and transparency changes are retained',()=>{
 const moving=Array.from({length:25},(_,i)=>frame(4+Math.floor(i/3),i/10));
 assert.equal(detectTrailingHold(moving,{frameRate:10}).removedFrames,0);
 const alpha=Array.from({length:25},(_,i)=>frame(6,i/10,i*10));
 assert.equal(detectTrailingHold(alpha,{frameRate:10}).removedFrames,0);
 assert.throws(()=>detectTrailingHold(moving,{keepSeconds:-1}),/keepSeconds/);
});
