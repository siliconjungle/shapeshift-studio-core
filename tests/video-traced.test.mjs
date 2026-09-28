import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {vectorizeVideo,trackTracedVideo,parseTracedSVG,svgFrame,animatedSVG,validateVectorVideo} from '../src/video-vectorizer/index.js';
import {temporalMedian} from '../src/video-vectorizer/temporal-raster.js';
const fixture='<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48" viewBox="2 2 64 48"><path d="M0 0 C21 0 43 0 64 0 C64 16 64 32 64 48 C43 48 21 48 0 48 C0 32 0 16 0 0 Z" fill="#f8f0db" transform="translate(2,2)"/><path d="M8 24 C8 4 52 4 52 24 C52 44 8 44 8 24 Z" fill="#221e20" transform="translate(2,2)"/><path d="M12 24 C12 9 48 9 48 24 C48 39 12 39 12 24 Z" fill="#609f9a" transform="translate(2,2)"/></svg>';
async function frame(svg,timestamp){const {data,info}=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({resolveWithObject:true});return {width:info.width,height:info.height,data,timestamp}}
test('stacked fitted curves round trip without new white seams or spilling fills',async()=>{
 const a=await frame(fixture,0),b=await frame(fixture,1/24);
 const clip=await trackTracedVideo([fixture,fixture],[a,b]);validateVectorVideo(clip);
 const rendered=await frame(svgFrame(clip),0);assert.deepEqual(rendered.data,a.data);
 for(const track of clip.tracks)assert.equal(new Set(track.samples).size,1);
 assert.deepEqual(clip.paintOrder[0],clip.tracks.map(t=>t.id));
 assert.match(animatedSVG(clip),/<use href=/);assert.doesNotMatch(animatedSVG(clip),/<image/);
});
test('preserve reference drawing order when overlapping shapes exchange their stack positions',async()=>{
 const parsed=parseTracedSVG(fixture);assert.equal(parsed.paths.length,3);
 const paths=fixture.match(/<path\b[^>]+\/>/g),reordered=fixture.replace(paths.join(''),[paths[0],paths[2],paths[1]].join(''));
 const frames=await Promise.all([frame(fixture,0),frame(reordered,.1)]);
 const clip=await trackTracedVideo([fixture,reordered],frames);validateVectorVideo(clip);
 assert.deepEqual((await frame(svgFrame(clip,{frame:1}),0)).data,frames[1].data);
 assert.notDeepEqual(clip.paintOrder[0],clip.paintOrder[1]);
 assert.match(animatedSVG(clip),/attributeName="href"/);
 assert.throws(()=>parseTracedSVG(fixture.replace('translate(2,2)','scale(2)')),/transform/);
});
test('public conversion requires a tracer and preserves its geometry and valid timing',async()=>{
 const source=await frame(fixture,0),calls=[];
 await assert.rejects(vectorizeVideo([source]),/traceFrame/);
 const clip=await vectorizeVideo([source],{traceFrame:(f,context)=>{calls.push(context.index);return fixture}});
 assert.deepEqual(calls,[0]);validateVectorVideo(clip);assert.equal(clip.tracks.length,3);
 await assert.rejects(trackTracedVideo([fixture,fixture],[{...source,timestamp:2},{...source,timestamp:1}]),/timestamp/);
});
test('temporal median rejects invalid motion and preserves source alpha',()=>{
 const f=value=>({width:4,height:4,data:Uint8Array.from({length:64},(_,i)=>i%4===3?255:value)});
 const field=(dx=0)=>({width:4,height:4,step:4,columns:2,rows:2,dx:new Float32Array(4).fill(dx),dy:new Float32Array(4)});
 const current=f(100),a=f(98),b=f(99);
 const stable=temporalMedian(current,[{frame:a,toNeighbor:field(),toCurrent:field()},{frame:b,toNeighbor:field(),toCurrent:field()}],{flowWidth:4,flowHeight:4});
 assert.equal(stable.data[0],99);assert.equal(stable.data[3],255);
 const invalid=temporalMedian(current,[{frame:a,toNeighbor:field(2),toCurrent:field(2)},{frame:b,toNeighbor:field(2),toCurrent:field(2)}],{flowWidth:4,flowHeight:4});
 assert.deepEqual(invalid.data,current.data);
});
test('source-checked mode does not freeze a large covering fill across a small boundary change',async()=>{
 const polygon=points=>'M'+points[0].join(' ')+points.slice(1).concat([points[0]]).map((p,i)=>'C'+points[i].join(' ')+' '+p.join(' ')+' '+p.join(' ')).join('')+'Z';
 const cover=notch=>'<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><path fill="#000000" d="'+polygon([[0,0],[120,0],[120,120],[0,120]])+'"/><path fill="#ffffff" d="'+polygon(notch?[[1,1],[59,1],[59,3],[61,3],[61,1],[119,1],[119,119],[1,119]]:[[1,1],[119,1],[119,119],[1,119]])+'"/></svg>';
 const a=cover(false),b=cover(true),frames=[await frame(a,0),await frame(b,1/24)];
 const clip=await trackTracedVideo([a,b],frames,{sourceColorBudget:8});
 assert.deepEqual((await frame(svgFrame(clip,{frame:1}),0)).data,frames[1].data,'preserve the new notch instead of reusing the older covering fill');
 assert.equal(clip.diagnostics.heldShapes,0);
});
