import * as T from 'three';
import {SVGLoader} from 'three/addons/loaders/SVGLoader.js';
import {evaluate} from './expression.js';
import {animateVectorLayers} from './vector-animation.js';
const clamp=T.MathUtils.clamp,ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
// Vector sprite layers remain filled GPU geometry. Only their procedural pose
// changes; no raster frame sheet, per-frame SVG parse or texture uploads.
export class LayeredVectorEffect {

 constructor(svg,parts,definition,{pass={value:0},groundY=0,groundSize=100,loader=SVGLoader}={}){this.definition=definition;this.root=new T.Group();this.layers=[];this.root.visible=false;const buckets=new Map(),view=svg.xml.getAttribute('viewBox').split(/\s+/).map(Number),w=parts.width,h=parts.height;
  for(const path of svg.paths)for(const shape of loader.createShapes(path)){
   const source=new T.ShapeGeometry(shape,definition.curveSegments??28);source.computeBoundingBox();const box=source.boundingBox,bounds=[box.min.x-view[0],box.min.y-view[1],box.max.x-view[0],box.max.y-view[1]];
   const candidates=parts.components.filter(c=>c.bounds[0]<=bounds[0]+definition.boundsTolerance&&c.bounds[1]<=bounds[1]+definition.boundsTolerance&&c.bounds[2]>=bounds[2]-definition.boundsTolerance&&c.bounds[3]>=bounds[3]-definition.boundsTolerance).sort((a,b)=>(a.bounds[2]-a.bounds[0])*(a.bounds[3]-a.bounds[1])-(b.bounds[2]-b.bounds[0])*(b.bounds[3]-b.bounds[1]));const component=candidates[0]||{bounds,area:(bounds[2]-bounds[0])*(bounds[3]-bounds[1])};
   const [x0,y0,x1,y1]=component.bounds,cx=(x0+x1)/w-1,cy=1-(y0+y1)/h,large=(x1-x0)/w>.5||(y1-y0)/h>.5,angle=(Math.atan2(cy,cx)+Math.PI*2)%(Math.PI*2),sector=Math.floor(angle/(Math.PI/4));
   const rule=definition.buckets.find(rule=>evaluate(rule.when,{large,cx,cy,sector,area:component.area,width:w,height:h}));if(!rule)continue;const id=rule.id+(rule.sector?sector:'');
   if(!buckets.has(id))buckets.set(id,{positions:[],paints:[],indices:[]});const bucket=buckets.get(id),array=source.attributes.position.array,base=bucket.positions.length/3,color=path.color;
   const whiteness=clamp((color.b-.025)/.85,0,.97),shade=clamp(Math.max(color.r,color.g,color.b)/.72,.62,1);
   for(let i=0;i<array.length;i+=3){bucket.positions.push((array[i]-view[0])/w*2-1,1-(array[i+1]-view[1])/h*2,0);bucket.paints.push(whiteness,shade);}
   for(const i of source.index.array)bucket.indices.push(base+i);source.dispose();
  }
  let index=0;for(const [id,bucket]of buckets){
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(bucket.positions,3));geometry.setAttribute('paint',new T.Float32BufferAttribute(bucket.paints,2));geometry.setIndex(bucket.indices);geometry.computeBoundingBox();const center=geometry.boundingBox.getCenter(new T.Vector3());geometry.translate(-center.x,-center.y,0);
   const material=new T.ShaderMaterial({uniforms:{groundDecal:{value:definition.projection==='ground'?1:0},groundY:{value:groundY+definition.surfaceOffset},groundHalf:{value:groundSize/2},pass,color:{value:new T.Color()},alpha:{value:1},time:{value:0},flutter:{value:0},seed:{value:index*.73}},vertexShader:'attribute vec2 paint;varying vec2 vPaint;uniform float time,flutter,seed,groundDecal,groundY;varying vec3 decalWorld;void main(){vPaint=paint;vec3 p=position;float a=atan(p.y,p.x);p.xy*=1.+flutter*sin(a*4.+time*11.+seed);p.x+=flutter*p.y*p.y*sin(time*8.+seed);vec4 world=modelMatrix*vec4(p,1.);if(groundDecal>.5)world.y=groundY;decalWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}',fragmentShader:'varying vec2 vPaint;uniform float pass,alpha,groundDecal,groundHalf;uniform vec3 color;varying vec3 decalWorld;void main(){if(pass>.5)discard;if(groundDecal>.5&&max(abs(decalWorld.x),abs(decalWorld.z))>groundHalf)discard;gl_FragColor=vec4(mix(color,vec3(1.,.985,.93),vPaint.x)*vPaint.y,alpha);\n#include <colorspace_fragment>\n}',side:T.DoubleSide,transparent:true,depthWrite:false});
   material.userData.groundDecal=definition.projection==='ground';const mesh=new T.Mesh(geometry,material);mesh.position.copy(center);mesh.frustumCulled=false;mesh.renderOrder=definition.renderOrder+index++;this.root.add(mesh);this.layers.push({id,mesh,center});
  }this.setColor(definition.color);
 }
 setColor(hex){for(const layer of this.layers)layer.mesh.material.uniforms.color.value.set(hex);}

 hide(){this.root.visible=false;}
 animate(age,strength=1){animateVectorLayers(this.definition.animation,this.root,this.layers,{age,strength});}
 dispose(){for(const {mesh}of this.layers){mesh.geometry.dispose();mesh.material.dispose();}this.layers.length=0;this.root.removeFromParent();}
}
