import test from 'node:test';
import assert from 'node:assert/strict';
import {vectorizeRegionsExperimental as vectorizeVideo,validateVectorVideo,svgFrame,animatedSVG,sampleVectorVideo} from '../src/video-vectorizer/index.js';
import {signedArea} from '../src/video-vectorizer/regions.js';

function raster(width,height,paint,noise=0,seed=1){
  const data=new Uint8Array(width*height*4);
  let state=seed;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const sum=[0,0,0,0];
    for(let j=0;j<4;j++)for(let i=0;i<4;i++){
      const c=paint(x+(i+.5)/4,y+(j+.5)/4);for(let k=0;k<4;k++)sum[k]+=(c[k]??255)/16;
    }
    const p=(y*width+x)*4;
    for(let k=0;k<3;k++){state=(Math.imul(state,1664525)+1013904223)>>>0;data[p+k]=Math.max(0,Math.min(255,Math.round(sum[k]+(state%3-1)*noise)))}
    data[p+3]=Math.round(sum[3]);
  }
  return {width,height,data};
}
const white=[245,240,225],ink=[25,24,28],red=[205,65,50],palette=['#f5f0e1','#19181c','#cd4132'];
const center=ring=>ring.reduce((a,p)=>[a[0]+p[0]/ring.length,a[1]+p[1]/ring.length],[0,0]);

test('quiet source noise preserves exact contour coordinates and fill identities',async()=>{
  const frames=Array.from({length:6},(_,i)=>raster(48,40,(x,y)=>Math.hypot(x-24,y-20)<12?ink:white,1,i+4));
  const clip=await vectorizeVideo(frames,{palette,motionStep:8});
  validateVectorVideo(clip);assert.equal(clip.tracks.length,2);
  for(const track of clip.tracks)assert.equal(new Set(track.samples).size,1,'still tracks must hold exact geometry');
  assert.equal(svgFrame(clip,{frame:0}).replace('frame 1','frame N'),svgFrame(clip,{frame:5}).replace('frame 6','frame N'));
});

test('subpixel translation keeps persistent track/topology and follows the real movement',async()=>{
  const frames=Array.from({length:10},(_,i)=>raster(64,48,(x,y)=>Math.hypot(x-(23+i*.6),y-24)<11?red:white));
  const clip=await vectorizeVideo(frames,{palette,motionStep:8,pointSpacing:2});
  validateVectorVideo(clip);
  const track=clip.tracks.find(t=>t.color===2&&t.samples[0]>=0);assert.ok(track);
  assert.ok(track.samples.every(i=>i>=0),'moving object must remain the same track');
  const poses=track.samples.map(i=>track.poses[i]);assert.equal(new Set(poses.map(p=>p.epoch)).size,1);
  assert.equal(new Set(poses.map(p=>p.rings[0].length)).size,1);
  const a=center(poses[0].rings[0]),b=center(poses.at(-1).rings[0]);
  assert.ok(Math.abs(b[0]-a[0]-5.4)<.9,'motion must not be frozen to reduce flicker');
  assert.ok(Math.abs(b[1]-a[1])<.6,'motion should not introduce vertical drift');
  const midway=sampleVectorVideo(clip,{time:.125});assert.ok(midway.paths.some(p=>p.trackId===track.id));
});

test('holes survive conversion and output has real animated paths, not raster or frame swaps',async()=>{
  const frames=[0,1,2].map(i=>raster(48,48,(x,y)=>{const d=Math.hypot(x-24-i,y-24);return d<16&&d>7?red:white}));
  const clip=await vectorizeVideo(frames,{palette,motionStep:8});
  const region=clip.tracks.find(t=>t.color===2),pose=region.poses[region.samples[0]];
  assert.equal(pose.rings.length,2);assert.ok(signedArea(pose.rings[0])*signedArea(pose.rings[1])<0);
  const svg=animatedSVG(clip);
  assert.match(svg,/attributeName="d"/);assert.match(svg,/fill-rule="evenodd"/);
  assert.doesNotMatch(svg,/<image|data:image|<foreignObject|<script/);
});

test('a true disappearance removes the region instead of freezing a ghost',async()=>{
  const frames=Array.from({length:7},(_,i)=>raster(48,40,(x,y)=>i<3&&x>12&&x<30&&y>10&&y<30?red:white));
  const clip=await vectorizeVideo(frames,{palette,motionStep:8});
  assert.ok(sampleVectorVideo(clip,{frame:1}).paths.some(p=>p.color===palette[2]));
  assert.ok(!sampleVectorVideo(clip,{frame:4}).paths.some(p=>p.color===palette[2]));
  assert.ok(clip.diagnostics.deaths>=1);assert.match(animatedSVG(clip),/attributeName="display"/);
});

test('equal-colour objects retain separate identities while moving',async()=>{
  const frames=Array.from({length:6},(_,i)=>raster(80,48,(x,y)=>(Math.hypot(x-(18+i),y-15)<7||Math.hypot(x-(60-i),y-34)<7)?red:white));
  const clip=await vectorizeVideo(frames,{palette,motionStep:8});
  const objects=clip.tracks.filter(t=>t.color===2&&t.samples[0]>=0);assert.equal(objects.length,2);
  for(const track of objects)assert.ok(track.samples.every(i=>i>=0));
  const [a,b]=objects.map(t=>center(t.poses[t.samples.at(-1)].rings[0]));
  assert.ok(a[1]<b[1]);
});

test('timestamps, async input, bounds and cancellation are explicit',async()=>{
  const frame=raster(16,16,()=>white);
  async function* input(){yield {...frame,timestamp:10};yield {...frame,timestamp:10.2};}
  const clip=await vectorizeVideo(input(),{palette});
  assert.deepEqual(clip.timestamps,[0,10.2-10]);assert.equal(clip.diagnostics.exactDuplicateFrames,1);
  assert.throws(()=>svgFrame(clip,{frame:2}),/outside/);
  await assert.rejects(vectorizeVideo([{...frame,timestamp:10},{...frame,timestamp:9}],{palette}),/timestamps/);
  await assert.rejects(vectorizeVideo([frame,frame],{palette,maxFrames:1}),/maxFrames/);
  await assert.rejects(vectorizeVideo([{...frame,data:new Uint8Array(3)}]),/RGBA/);
  const controller=new AbortController();
  await assert.rejects(vectorizeVideo([frame,frame],{palette,signal:controller.signal,onProgress:p=>{if(p.stage==='tracking')controller.abort()}}),{name:'AbortError'});
});

test('transparent clips remain transparent and JSON round trips validate',async()=>{
  const frame=raster(12,12,()=>[0,0,0,0]);
  const clip=await vectorizeVideo([frame,frame]);assert.equal(clip.tracks.length,0);
  validateVectorVideo(JSON.parse(JSON.stringify(clip)));assert.doesNotMatch(svgFrame(clip),/<path/);
  const bad=structuredClone(clip);bad.timestamps[1]=bad.timestamps[0];assert.throws(()=>validateVectorVideo(bad),/timestamp/);
});
