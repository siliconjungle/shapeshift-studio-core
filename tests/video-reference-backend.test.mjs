import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {vectorizeReferenceFrames} from '../src/video-vectorizer/reference-node.js';
import {svgFrame,validateVectorVideo} from '../src/video-vectorizer/index.js';
import {approveTrackedFrame} from '../src/video-vectorizer/fidelity-node.js';
const options={colors:4,palette:['#f8f0db','#223344','#bb6655']};
const drawing=(x=24)=>'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48" viewBox="0 0 64 48"><path fill="#f8f0db" d="M0 0H64V48H0Z"/><circle fill="#223344" cx="'+x+'" cy="24" r="12"/><circle fill="#bb6655" cx="'+(x+3)+'" cy="20" r="3"/></svg>';
async function raster(svg){const {data,info}=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({resolveWithObject:true});return {width:info.width,height:info.height,data}}
test('default-quality backend holds noisy still art as identical SVG geometry',async()=>{
 const base=await raster(drawing()),frames=Array.from({length:5},(_,i)=>{const data=Uint8Array.from(base.data,(v,p)=>p%4===3?v:Math.max(0,Math.min(255,v+((p*13+i*17)%3)-1)));return {...base,data}});
 const clip=await vectorizeReferenceFrames(frames,options);validateVectorVideo(clip);
 assert.equal(clip.diagnostics.exactPreparedFrameHolds,4);
 const first=svgFrame(clip).replace('frame 1','frame N');
 for(let frame=1;frame<5;frame++)assert.equal(svgFrame(clip,{frame}).replace('frame '+(frame+1),'frame N'),first);
});
test('quality backend preserves real movement while keeping colours and vector output',async()=>{
 const frames=[];for(let i=0;i<8;i++)frames.push(await raster(drawing(24+i*.8)));
 const clip=await vectorizeReferenceFrames(frames,options);validateVectorVideo(clip);
 async function centroid(index){const svg=svgFrame(clip,{frame:index});assert.doesNotMatch(svg,/<image|data:image/);const f=await raster(svg);let sum=0,count=0;for(let y=0;y<f.height;y++)for(let x=0;x<f.width;x++){const p=(y*f.width+x)*4;if(f.data[p]<80&&f.data[p+1]<100){sum+=x;count++}}return sum/count}
 const displacement=await centroid(7)-await centroid(0);assert.ok(displacement>4.6&&displacement<6.6,'real displacement should be about 5.6 pixels, got '+displacement);
 assert.ok(clip.palette.every(c=>options.palette.includes(c)));
 assert.equal(clip.settings.flowBackend,'opencv');
 assert.equal(clip.settings.trackMotion,true);
 assert.equal(clip.settings.trackCurves,false,'retain fitted curves by default');
});
test('quality backend outer ink leaves every inner fill and curve unchanged',async()=>{
 const frames=[await raster(drawing()),await raster(drawing(25))];
 const sourceCopies=frames.map(f=>Buffer.from(f.data));
 const plain=await vectorizeReferenceFrames(frames,options);
 frames.forEach((f,i)=>assert.deepEqual(f.data,sourceCopies[i],'Buffer input must not be mutated'));
 const inked=await vectorizeReferenceFrames(frames,{...options,outline:{width:4.4,displayWidth:64,background:'#f8f0db'}});
 validateVectorVideo(inked);
 assert.deepEqual(inked.tracks.filter(t=>t.kind!=='outer-outline'),plain.tracks);
 const edges=inked.tracks.filter(t=>t.kind==='outer-outline');assert.equal(edges.length,1);
 for(let i=0;i<frames.length;i++)assert.deepEqual(inked.paintOrder[i].filter(id=>!edges.some(t=>t.id===id)),plain.paintOrder[i]);
 for(const pose of edges[0].poses)assert.equal(pose.rings.length,1);
});
test('source-fidelity guard rejects misplaced fills despite an otherwise smooth shape',async()=>{
 const referenceSVG=drawing(),source=await raster(referenceSVG);
 assert.equal((await approveTrackedFrame({source,referenceSVG,candidateSVG:referenceSVG})).accepted,true);
 const bad=await approveTrackedFrame({source,referenceSVG,candidateSVG:drawing(30)});assert.equal(bad.accepted,false);assert.ok(bad.candidate.meanError>bad.reference.meanError);
});
test('supersampled tracing keeps original dimensions, source alpha and subpixel movement',async()=>{
 const frames=[await raster(drawing()),await raster(drawing(25))];
 const clip=await vectorizeReferenceFrames(frames,{...options,traceScale:2,tracePreset:'fidelity',sourceColorBudget:2,spatialMedian:0,audit:true});
 validateVectorVideo(clip);assert.equal(clip.width,64);assert.equal(clip.height,48);
 assert.equal(clip.analysisWidth,64);assert.equal(clip.settings.traceScale,2);
 assert.equal(clip.diagnostics.sourceAudit.frames.length,2);assert.ok(clip.diagnostics.sourceAudit.meanError<6);
 const output=await raster(svgFrame(clip,{frame:1}));assert.equal(output.width,64);assert.equal(output.height,48);
 let error=0;for(let p=0;p<output.data.length;p+=4){assert.equal(output.data[p+3],255);for(let c=0;c<3;c++)error+=Math.abs(output.data[p+c]-frames[1].data[p+c])}
 assert.ok(error/(64*48*3)<6,'retain the source drawing at its original coordinate scale');
});
