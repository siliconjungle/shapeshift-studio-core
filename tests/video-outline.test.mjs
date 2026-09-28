import test from 'node:test';
import assert from 'node:assert/strict';
import {vectorizeRegionsExperimental as vectorizeVideo,validateVectorVideo,svgFrame,animatedSVG} from '../src/video-vectorizer/index.js';
import {silhouetteInkBands} from '../src/video-vectorizer/silhouette-ink.js';

function frame(offset=0){
 const width=64,height=48,data=new Uint8Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const inside=x>=12+offset&&x<44+offset&&y>=8&&y<40;
  const inner=x>=22+offset&&x<34+offset&&y>=18&&y<30;
  const line=y===16&&x>=20+offset&&x<38+offset;
  const c=line?[20,20,20]:inside&&!inner?[100,150,130]:[250,245,235];
  data.set([...c,255],(y*width+x)*4);
 }
 return {width,height,data};
}
test('outer silhouette is separate, temporally tracked, and leaves all inner artwork identical',async()=>{
 const frames=[frame(0),frame(1),frame(2),frame(2)];
 const options={palette:['#faf5eb','#649682','#141414'],motionStep:8};
 const plain=await vectorizeVideo(frames,options);
 const clip=await vectorizeVideo(frames,{...options,outline:{background:'#faf5eb',width:4.4,displayWidth:64}});
 validateVectorVideo(JSON.parse(JSON.stringify(clip)));
 assert.deepEqual(clip.tracks.filter(t=>!t.kind),plain.tracks,'outline must not thicken inner lines or change the paint');
 const edges=clip.tracks.filter(t=>t.kind==='outer-outline');assert.equal(edges.length,1);
 assert.ok(edges[0].samples.every(i=>i>=0));
 for(const pose of edges[0].poses)assert.equal(pose.rings.length,1,'do not outline enclosed painted details');
 assert.equal(edges[0].samples[2],edges[0].samples[3]);
 assert.match(svgFrame(clip),/data-ink-edge="true"/);
 const animation=animatedSVG(clip);assert.match(animation,/stroke-width="4.4"/);assert.match(animation,/stroke-linejoin="round"/);
 await assert.rejects(vectorizeVideo(frames,{...options,outline:true}),/Opaque video needs/);
});
test('map band width is fixed in display units, independent of output resolution',()=>{
 const loop=[[.2,.2],[.8,.2],[.8,.8],[.2,.8]];
 function extents(size){const points=silhouetteInkBands([loop],{box:[0,0,size,size],bandWidth:4.4,displayWidth:100}).flat();return [Math.min(...points.map(p=>p[0])),Math.max(...points.map(p=>p[0]))].map(x=>x*100/size)}
 for(const size of [100,200,832]){const [lo,hi]=extents(size);assert.ok(Math.abs(lo-17.8)<.1);assert.ok(Math.abs(hi-82.2)<.1)}
});
