import test from 'node:test';
import assert from 'node:assert/strict';
import {trackPaletteFrame} from '../src/video-vectorizer/palette-tracking.js';
import {paletteClassifier} from '../src/video-vectorizer/palette.js';
const palette=[[0,0,0],[100,100,100]],classify=paletteClassifier(palette);
const frame=v=>({width:1,height:1,data:new Uint8Array([v,v,v,255])});
test('source-quiet palette threshold noise holds exact assignments',()=>{
 const first=frame(49);let state=trackPaletteFrame(first,first,palette,classify,null);
 for(const v of [51,48,52,50,51]){const next=frame(v);state=trackPaletteFrame(next,next,palette,classify,state);assert.equal(state.labels[0],0);assert.equal(state.data[0],0)}
});
test('anchored comparison detects gradual real change rather than freezing it forever',()=>{
 const first=frame(49);let state=trackPaletteFrame(first,first,palette,classify,null);
 for(let v=50;v<=70;v++){const next=frame(v);state=trackPaletteFrame(next,next,palette,classify,state)}
 assert.equal(state.labels[0],1);assert.equal(state.data[0],100);
});
test('real motion uncovers old pixels and updates new pixels without a trail',()=>{
 const p=[[0,0,0],[255,255,255]],classify=paletteClassifier(p);
 function raster(x){const data=new Uint8Array(8*4).fill(255);for(let i=x;i<x+2;i++)data.set([0,0,0,255],i*4);return {width:8,height:1,data}}
 const a=raster(2),b=raster(3),first=trackPaletteFrame(a,a,p,classify,null),next=trackPaletteFrame(b,b,p,classify,first);
 assert.deepEqual(next.data,b.data);assert.equal(next.changed,2);
});
test('an inactive motion tile cannot retain a colour that contradicts the source',()=>{
 const a=frame(0),b=frame(100),old=trackPaletteFrame(a,a,palette,classify,null);
 const held=trackPaletteFrame(b,a,palette,classify,old,{sourceColorBudget:2,motionGate:{tileSize:1,columns:1,mask:new Uint8Array([0])}});
 assert.equal(held.labels[0],1,'source pixel overrides both stale paint and stale denoised input');
 assert.equal(held.anchors[0],100);
});
