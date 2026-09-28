import test from 'node:test';import assert from 'node:assert/strict';
import {pixelErrors} from '../src/video-vectorizer/quality-node.js';
const f=(a,b)=>({width:2,height:1,data:new Uint8Array([a,a,a,255,b,b,b,255])});
test('pixel audit distinguishes source motion, frozen motion and invented flicker',()=>{
 const a=f(0,255),b=f(255,0);
 const exact=pixelErrors(b,b.data,{source:a.data,rendered:a.data});assert.equal(exact.meanError,0);assert.equal(exact.temporalResidual,0);
 const frozen=pixelErrors(b,a.data,{source:a.data,rendered:a.data});assert.equal(frozen.badPixels,2);assert.equal(frozen.temporalResidual,255);
 const flicker=pixelErrors(a,b.data,{source:a.data,rendered:a.data});assert.equal(flicker.quietJumps,1);assert.equal(flicker.temporalResidual,255);
});
