import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {updateTrackedCurves} from '../src/video-vectorizer/curve-tracking.js';
import {bezierPath} from '../src/video-vectorizer/traced.js';
import {trackTracedVideo,validateVectorVideo} from '../src/video-vectorizer/index.js';
const ring=[[12,24],[12,7],[52,7],[52,24],[52,41],[12,41],[12,24]];
const moved=(r,x,y=0)=>r.map(p=>[p[0]+x,p[1]+y]);
const field=(dx=0)=>({width:64,height:48,step:16,columns:5,rows:4,dx:new Float32Array(20).fill(dx),dy:new Float32Array(20)});
const svg=r=>'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48" viewBox="0 0 64 48"><path fill="#31555a" d="'+bezierPath([r])+'"/></svg>';
async function raster(r){const {data,info}=await sharp(Buffer.from(svg(r))).ensureAlpha().raw().toBuffer({resolveWithObject:true});return {width:info.width,height:info.height,data}}
test('motion updates original Bezier control points without refitting or changing their topology',async()=>{
 const next=moved(ring,1),a=await raster(ring),b=await raster(next);
 const result=updateTrackedCurves([ring],[next],field(-1),a,b);
 assert.ok(result);assert.deepEqual(result,[next]);
 const clip=await trackTracedVideo([svg(ring),svg(next)],[a,b],{trackCurves:true,motionFields:[null,field(-1)]});
 validateVectorVideo(clip);assert.equal(clip.diagnostics.motionGuidedShapes,1);
 const t=clip.tracks[0];assert.equal(t.poses[0].epoch,t.poses[1].epoch);
});
test('quiet source holds a fitted curve through small retracing noise',async()=>{
 const a=await raster(ring),jittered=ring.map((p,i)=>[p[0]+(i%2?.15:-.15),p[1]]);
 const result=updateTrackedCurves([ring],[jittered],field(),a,a);
 assert.deepEqual(result,[ring]);
});
test('reference geometry wins when flow is wrong or a contour/topology changes',async()=>{
 const a=await raster(ring),next=moved(ring,3),b=await raster(next);
 assert.equal(updateTrackedCurves([ring],[next],field(),a,b),null);
 assert.equal(updateTrackedCurves([ring],[ring,moved(ring,0,30)],field(),a,a),null);
 assert.equal(updateTrackedCurves([ring],[moved(ring,0,3)],field(-1),a,b),null);
});
