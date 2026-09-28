import test from 'node:test';import assert from 'node:assert/strict';
import {blendAttachmentPixels} from '../src/puppet-studio/scene3d/attachment-blend.js';
import {sceneDefaults,nodeDefaults,validateScene,applySceneCommand,sceneCapabilities} from '../src/puppet-studio/scene3d/schema.js';
const width=32,height=64,at=(x,y)=>(y*width+x)*4;
function art(){const data=new Uint8ClampedArray(width*height*4);for(let y=0;y<height;y++)for(let x=2;x<30;x++){const ink=x<4||x>27||y<2||y>61,c=ink?[25,35,45]:[130,160,185];data.set([...c,255],at(x,y));}for(let y=7;y<10;y++)for(let x=12;x<20;x++)data.set([25,35,45,255],at(x,y));data.set([230,240,210,255],at(16,11));return data;}
test('attachment repair preserves alpha, side ink, interior ink and distinct painted marks',()=>{
 const source=art(),original=source.slice(),out=blendAttachmentPixels(source,width,height,{length:20,colour:'#bf9365',inkColors:['#19232d']});
 assert.deepEqual(source,original);for(let i=3;i<out.length;i+=4)assert.equal(out[i],source[i]);
 assert.notDeepEqual(out.slice(at(16,0),at(16,0)+3),source.slice(at(16,0),at(16,0)+3));
 for(const [x,y]of [[2,4],[16,8],[16,11],[16,40],[16,63]])assert.deepEqual(out.slice(at(x,y),at(x,y)+4),source.slice(at(x,y),at(x,y)+4));
 assert.notDeepEqual(out.slice(at(8,4),at(8,4)+3),source.slice(at(8,4),at(8,4)+3));
 assert.deepEqual(blendAttachmentPixels(source,width,height,{enabled:false}),source);
 assert.deepEqual(blendAttachmentPixels(source,width,height,{strength:0}),source);
});
test('bottom cap, inferred ink, ink-only blending and translucent paint',()=>{
 const source=art();source.set([25,35,45,120],at(16,63));
 const out=blendAttachmentPixels(source,width,height,{end:'bottom',length:20,matchColor:false,colour:'#ff0000'});
 for(const [x,y]of [[16,0],[8,55],[16,63]])assert.deepEqual(out.slice(at(x,y),at(x,y)+4),source.slice(at(x,y),at(x,y)+4));
 assert.notDeepEqual(out.slice(at(20,63),at(20,63)+3),source.slice(at(20,63),at(20,63)+3));
});
test('join is discoverable, opt-in, validated, portable and cleaned when its body is removed',()=>{
 const s=sceneDefaults();s.nodes=[nodeDefaults('body','sphere'),{...nodeDefaults('leg','puppet'),puppet:{clip:'idle',pixelsPerUnit:100}}];validateScene(s);
 assert.equal(s.nodes[1].puppet.join,undefined);assert.equal(sceneCapabilities().puppets.join.field,'node.puppet.join');
 const p={assets:[],scene3d:s};const join={enabled:true,target:'body',end:'bottom',length:.15,strength:.8,matchColor:true,inkColors:['#19232d']};
 applySceneCommand(p,{op:'scene3d.node.update',id:'leg',values:{puppet:{join}}});validateScene(s);assert.deepEqual(JSON.parse(JSON.stringify(s)).nodes[1].puppet.join,join);
 for(const bad of [{target:'missing'},{end:'side'},{length:0},{strength:2},{enabled:1},{inkColors:['bad']},{matchColor:1}]){const c=structuredClone(s);Object.assign(c.nodes[1].puppet.join,bad);assert.throws(()=>validateScene(c),/puppet join/);}
 applySceneCommand(p,{op:'scene3d.node.remove',id:'body'});validateScene(s);assert.equal(s.nodes[0].puppet.join.enabled,false);assert.equal(s.nodes[0].puppet.join.target,'');
});
