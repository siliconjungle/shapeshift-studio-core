import test from 'node:test';import assert from 'node:assert/strict';
import {makeBodyJoin,bodyJoinFrame,deformBodyPoint,bindBodyJoinGeometry,validateBodyJoins} from '../src/puppet-studio/body-joins.js';
import {matchJoinSections,mapJoinCrossSection} from '../src/puppet-studio/body-join-profiles.js';
import {joinSeamPixels} from '../src/puppet-studio/body-join-seams.js';
import {BufferGeometry,Float32BufferAttribute} from 'three';
const rest={x:0,y:0,rotation:0,scaleX:1,scaleY:1};
function fixture(){return{joints:[{id:'body',rest:{...rest},sprite:{width:200,height:100}},{id:'head',parent:'body',rest:{...rest,x:80},sprite:{width:50,height:50}}]};}
const pose=new Map([['body',{world:[1,0,0,1,0,0]}],['head',{world:[0,1,-1,0,95,8]}]]);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6);
test('joins are opt-in and move the collar while leaving distant vertices fixed',()=>{
 const p=fixture();assert.equal(bodyJoinFrame(p,pose).size,0);const j=p.joints[1].bodyJoin=makeBodyJoin(p,'head','body',{radius:80});validateBodyJoins(p);const frame=bodyJoinFrame(p,pose).get('body');assert.deepEqual(deformBodyPoint(-60,20,frame),{x:-60,y:20});const q=deformBodyPoint(80,0,frame);near(q.x,95);near(q.y,8);j.enabled=false;assert.equal(bodyJoinFrame(p,pose).size,0);j.enabled=true;j.strength=0;assert.equal(bodyJoinFrame(p,pose).size,0);
});
test('the Three binding preserves depth and paint data and restores the source mesh',()=>{
 const p=fixture();p.joints[1].bodyJoin=makeBodyJoin(p,'head','body');const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute([80,0,2,85,0,2,80,5,2],3));g.setAttribute('uv',new Float32BufferAttribute([0,0,1,0,0,1],2));g.setIndex([0,1,2]);const original=g.attributes.position.array.slice(),uv=g.attributes.uv,index=g.index,binding=bindBodyJoinGeometry(g);binding.update(bodyJoinFrame(p,pose).get('body'));near(g.attributes.position.getX(0),95);near(g.attributes.position.getZ(0),2);assert.equal(g.attributes.uv,uv);assert.equal(g.index,index);binding.restore();assert.deepEqual(g.attributes.position.array,original);g.dispose();
});
test('silhouette matching aligns exterior edges and corresponding interior colour boundaries',()=>{
 const section=(width,split)=>Array.from({length:81},(_,i)=>{const at=(i/80*2-1)*width;return{at,colour:i<4||i>76?[20,15,10,255]:at<split?[130,145,70,255]:[240,220,180,255]};});const m=matchJoinSections(section(40,0),section(22,5));near(mapJoinCrossSection(-40,m.knots),-22);near(mapJoinCrossSection(40,m.knots),22);assert.ok(mapJoinCrossSection(0,m.knots)>3);assert.equal(m.matches.length,2);
});
test('seam repair preserves outside ink, interior markings and fades',()=>{
 const n=64,a=new Uint8ClampedArray(n*n*4),b=new Uint8ClampedArray(a.length),ink=[20,15,10,255],green=[130,145,70,255],belly=[240,220,180,255];
 const rect=(p,left,right)=>{for(let y=8;y<56;y++)for(let x=left;x<right;x++)p.set(x<left+2||x>=right-2||y<10||y>=54?ink:y<32?green:belly,(y*n+x)*4);};rect(a,5,42);rect(b,30,60);a.set(ink,(26*n+20)*4);
 const patch=joinSeamPixels(a,b,n,n),at=(x,y)=>Array.from(patch.subarray((y*n+x)*4,(y*n+x)*4+4));assert.deepEqual(at(30,25),green);assert.deepEqual(at(30,38),belly);assert.equal(at(30,8)[3],0);assert.equal(at(20,26)[3],0);
 for(let i=3;i<b.length;i+=4)if(b[i])b[i]=200;assert.equal(joinSeamPixels(a,b,n,n)[(25*n+30)*4+3],0);
});
