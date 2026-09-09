import * as T from 'three';
import {animateVectorLayers} from './vector-animation.js';
const Z=new T.Vector3(0,0,1);
export class SurfaceContactEffect {
 constructor(template,decals,effects,definition,{pass={value:0},isGround=object=>object.userData.decalReceiver==='ground'}={}){
  this.definition=definition;this.isGround=isGround;
  this.decal=new T.Group();this.decal.name='Surface contact decal';decals.add(this.decal);this.layers=template.layers.map(({id,mesh,center})=>{const clone=new T.Mesh(mesh.geometry,mesh.material.clone());clone.material.uniforms.pass=pass;clone.frustumCulled=false;clone.renderOrder=definition.renderOrder;this.decal.add(clone);return{id,mesh:clone,center:center.clone()};});
  this.spray=new T.Group();this.spray.name='Surface contact particles';effects.add(this.spray);
  const drop=new T.Shape();for(const [op,...values]of definition.particleShape){if(!['moveTo','lineTo','bezierCurveTo','quadraticCurveTo','closePath'].includes(op))throw Error('Unknown particle path operation '+op);drop[op](...values);}
  this.sparkGeometry=new T.ShapeGeometry(drop,definition.particleSegments);
  this.sparkMaterial=new T.ShaderMaterial({uniforms:{pass:pass,color:{value:new T.Color(definition.color)},alpha:{value:1}},vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',fragmentShader:'uniform float pass,alpha;uniform vec3 color;void main(){if(pass>.5)discard;gl_FragColor=vec4(color,alpha);\n#include <colorspace_fragment>\n}',transparent:true,depthWrite:false,side:T.DoubleSide});
  this.sparks=new T.InstancedMesh(this.sparkGeometry,this.sparkMaterial,definition.particles);this.sparks.instanceMatrix.setUsage(T.DynamicDrawUsage);this.sparks.frustumCulled=false;this.spray.add(this.sparks);
  this.coreGeometry=new T.CircleGeometry(definition.coreRadius,definition.coreSegments);this.coreMaterial=new T.ShaderMaterial({uniforms:{pass:pass,color:{value:new T.Color()},alpha:{value:1}},vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform float pass,alpha;uniform vec3 color;void main(){if(pass>.5)discard;gl_FragColor=vec4(color,alpha);\n#include <colorspace_fragment>\n}',transparent:true,depthWrite:false,side:T.DoubleSide});
  this.core=new T.Mesh(this.coreGeometry,this.coreMaterial);this.core.position.z=definition.coreOffset;this.core.renderOrder=definition.coreRenderOrder;this.decal.add(this.core);
  this.pose=new T.Object3D();this.point=new T.Vector3();this.normal=new T.Vector3(0,1,0);this.normalMatrix=new T.Matrix3();this.age=0;this.fade=0;this.touching=false;this.object=null;this.reset();
 }
 reset(){this.touching=false;this.object=null;this.fade=0;this.age=0;this.decal.visible=this.spray.visible=false;}
 setColor(hex){for(const {mesh}of this.layers)mesh.material.uniforms.color.value.set(hex);this.sparkMaterial.uniforms.color.value.set(hex).lerp(new T.Color('#ffffff'),this.definition.particleWhiteness);this.coreMaterial.uniforms.color.value.set(hex).lerp(new T.Color('#ffffff'),this.definition.coreWhiteness);}
 update(dt,hit,direction,width=1){
  if(hit){if(!this.touching||this.object!==hit.object||this.point.distanceToSquared(hit.point)>this.definition.restartDistanceSquared)this.age=0;
   this.touching=true;this.object=hit.object;this.point.copy(hit.point);this.normal.copy(hit.face?.normal??Z).applyNormalMatrix(this.normalMatrix.getNormalMatrix(hit.object.matrixWorld));if(this.normal.dot(direction)>0)this.normal.negate();this.fade=1;
   this.decal.position.copy(this.point).addScaledVector(this.normal,this.definition.surfaceOffset);this.spray.position.copy(this.decal.position);this.decal.quaternion.setFromUnitVectors(Z,this.normal);this.spray.quaternion.copy(this.decal.quaternion);
   const ground=this.isGround(hit.object);for(const {mesh}of this.layers){mesh.material.uniforms.groundDecal.value=ground?1:0;mesh.material.uniforms.groundY.value=hit.point.y+this.definition.surfaceOffset;}
  }else{this.touching=false;this.fade=Math.max(0,this.fade-dt/this.definition.fadeDuration);}
  this.decal.visible=this.spray.visible=this.fade>0;if(!this.decal.visible)return;this.age+=dt;
  const input={age:this.age,width,fade:this.fade};
  animateVectorLayers(this.definition.decalAnimation,this.decal,this.layers,input);
  animateVectorLayers(this.definition.coreAnimation,this.core,[],input);
  animateVectorLayers(this.definition.sprayAnimation,this.spray,[],input);
  for(let i=0;i<this.definition.particles;i++){
   animateVectorLayers(this.definition.particleAnimation,this.pose,[],{...input,index:i});this.pose.updateMatrix();this.sparks.setMatrixAt(i,this.pose.matrix);
  }this.sparks.instanceMatrix.needsUpdate=true;this.sparkMaterial.uniforms.alpha.value=this.fade;
 }
 dispose(){for(const {mesh}of this.layers)mesh.material.dispose();this.coreGeometry.dispose();this.coreMaterial.dispose();this.sparkGeometry.dispose();this.sparkMaterial.dispose();this.decal.removeFromParent();this.spray.removeFromParent();}
}
