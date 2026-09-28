import test from 'node:test';import assert from 'node:assert/strict';import sharp from 'sharp';
import {sourceExterior} from '../src/video-vectorizer/exterior-node.js';
import {vectorizeReferenceFrames} from '../src/video-vectorizer/reference-node.js';
import {svgFrame} from '../src/video-vectorizer/index.js';
test('source exterior covers spill but leaves enclosed light details and inner paint alone',async()=>{
 const image='<svg width="64" height="64"><rect width="64" height="64" fill="#faf0dc"/><rect x="16" y="16" width="32" height="32" fill="#201820"/><circle cx="32" cy="32" r="6" fill="#faf0dc"/></svg>';
 const data=await sharp(Buffer.from(image)).ensureAlpha().raw().toBuffer(),frame={width:64,height:64,data};
 const overlay=await sourceExterior(frame,{background:'#faf0dc',tolerance:65});
 const result=await sharp(Buffer.from('<svg width="64" height="64"><rect width="64" height="64" fill="#ff0000"/>'+overlay+'</svg>')).ensureAlpha().raw().toBuffer();
 assert.deepEqual([...result.slice(0,3)],[250,240,220]);assert.deepEqual([...result.slice((32*64+32)*4,(32*64+32)*4+3)],[255,0,0]);
 const clip=await vectorizeReferenceFrames([frame],{colors:4,sourceBackground:'#faf0dc'});assert.equal(clip.settings.exteriorBackground,'#faf0dc');assert.doesNotMatch(svgFrame(clip),/<image/);
});
test('background containment never paints over source transparency',async()=>{
 const frame={width:2,height:2,data:new Uint8Array(16)};assert.equal(await sourceExterior(frame,{background:'#ffffff'}),'');
});
