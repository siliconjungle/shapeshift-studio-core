import * as T from 'three';


// Project the real solid mesh after its shared GPU deformation. An opaque mask
// unions the overlapping faces, avoiding darker patches where triangles overlap.
export class ProjectedShapeShadow {
 constructor(scene,{uniforms,bodyGLSL,groundY,groundSize,definition}){this.uniforms=uniforms;this.groundY=groundY;this.definition=definition;
  this.target=new T.WebGLRenderTarget(definition.resolution,definition.resolution,{depthBuffer:false,minFilter:T.LinearFilter,magFilter:T.LinearFilter});
  this.target.texture.name='Deformed shape shadow';this.maskScene=new T.Scene();this.camera=new T.Camera();this.casters=[];this.signature='';this.updates=0;this.enabled=true;
  this.projection={value:new T.Vector4(0,0,definition.span,definition.span)};
  this.castMaterial=new T.ShaderMaterial({uniforms:{...uniforms,shadowProjection:this.projection,groundY:{value:groundY}},vertexShader:bodyGLSL+`
   uniform vec3 light;uniform vec4 shadowProjection;uniform float groundY;
   void main(){vec3 p=deformBody((modelMatrix*vec4(position,1.)).xyz);
    vec2 ground=p.xz-light.xz/max(${definition.minimumLightY===.15?'.15':String(definition.minimumLightY)},light.y)*max(0.,p.y-groundY);
    gl_Position=vec4((ground-shadowProjection.xy)/shadowProjection.zw*2.,0.,1.);
   }`,fragmentShader:'void main(){gl_FragColor=vec4(1.);}',side:T.DoubleSide,depthTest:false,depthWrite:false,blending:T.NoBlending});
  this.material=new T.ShaderMaterial({uniforms:{pass:uniforms.pass,shadowMap:{value:this.target.texture},softness:{value:definition.initialSoftness},strength:{value:definition.initialStrength},groundHalf:{value:groundSize/2}},vertexShader:`varying vec2 shadowUV;varying vec3 world;void main(){shadowUV=uv;world=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}`,fragmentShader:`
   uniform sampler2D shadowMap;uniform float pass,softness,strength,groundHalf;varying vec2 shadowUV;varying vec3 world;
   void main(){if(pass>.5||max(abs(world.x),abs(world.z))>groundHalf)discard;
    float mask=texture2D(shadowMap,shadowUV).r*4.;
    mask+=texture2D(shadowMap,shadowUV+vec2(softness,0.)).r*2.;
    mask+=texture2D(shadowMap,shadowUV-vec2(softness,0.)).r*2.;
    mask+=texture2D(shadowMap,shadowUV+vec2(0.,softness)).r*2.;
    mask+=texture2D(shadowMap,shadowUV-vec2(0.,softness)).r*2.;
    mask+=texture2D(shadowMap,shadowUV+vec2(softness,softness)).r;
    mask+=texture2D(shadowMap,shadowUV-vec2(softness,softness)).r;
    mask+=texture2D(shadowMap,shadowUV+vec2(softness,-softness)).r;
    mask+=texture2D(shadowMap,shadowUV+vec2(-softness,softness)).r;
    float alpha=mask/16.*strength;if(alpha<.001)discard;
    // Black compositing always darkens, including the dark material stage.
    gl_FragColor=vec4(0.,0.,0.,alpha);
    #include <colorspace_fragment>
   }`,transparent:true,depthWrite:false,side:T.DoubleSide});
  this.receiver=new T.Mesh(new T.PlaneGeometry(1,1),this.material);this.receiver.name='Shape-projected ground shadow';
  // XY -> XZ with UV.y following world Z, matching the projection render target.
  this.receiver.rotation.x=Math.PI/2;this.receiver.position.y=groundY+definition.offset;this.receiver.renderOrder=definition.renderOrder;this.receiver.frustumCulled=false;scene.add(this.receiver);
  this.clearColor=new T.Color();scene.userData.shapeShadow=this;
 }
 setCasters(meshes){for(const {proxy}of this.casters)this.maskScene.remove(proxy);this.casters=meshes.map(source=>{const proxy=new T.Mesh(source.geometry,this.castMaterial);proxy.matrixAutoUpdate=false;proxy.frustumCulled=false;this.maskScene.add(proxy);return{source,proxy};});this.signature='';}
 update(renderer){
  const uniforms=this.uniforms,groundY=this.groundY,definition=this.definition;
  this.receiver.visible=this.enabled&&this.casters.length>0;if(!this.receiver.visible)return;
  const values=[...uniforms.bodyCenter.value,...uniforms.bodyShape.value,...uniforms.bodyBend.value,uniforms.bodyHalf.value,...uniforms.light.value];
  for(const {source,proxy}of this.casters){source.updateWorldMatrix(true,false);proxy.matrix.copy(source.matrixWorld);values.push(...source.matrixWorld.elements);}
  const signature=values.join(',');if(signature===this.signature)return;this.signature=signature;
  const light=uniforms.light.value,center=uniforms.bodyCenter.value,height=Math.max(0,center.y-groundY),slope=1/Math.max(definition.minimumLightY,light.y);
  // Broad enough for rotated, bent and stretched silhouettes; no camera-sized
  // target or rerasterisation on zoom. Penumbra grows gently as the boss lifts.
  const span=definition.span+Math.max(0,slope-definition.wideLightSlope)*definition.wideLightSpan;
  this.projection.value.set(center.x-light.x*slope*height,center.z-light.z*slope*height,span,span);
  this.receiver.position.set(this.projection.value.x,groundY+definition.offset,this.projection.value.y);this.receiver.scale.set(span,span,1);
  this.material.uniforms.softness.value=(definition.softness+Math.max(0,height-uniforms.bodyHalf.value)*definition.heightSoftness)/span;
  this.material.uniforms.strength.value=definition.strength/(1+Math.max(0,height-uniforms.bodyHalf.value)*definition.heightFade);
  const target=renderer.getRenderTarget(),alpha=renderer.getClearAlpha();renderer.getClearColor(this.clearColor);
  renderer.setRenderTarget(this.target);renderer.setClearColor(0,0);renderer.clear();renderer.render(this.maskScene,this.camera);
  renderer.setRenderTarget(target);renderer.setClearColor(this.clearColor,alpha);this.updates++;
 }
 dispose(){for(const {proxy}of this.casters)this.maskScene.remove(proxy);this.casters=[];this.target.dispose();this.castMaterial.dispose();this.material.dispose();this.receiver.geometry.dispose();this.receiver.removeFromParent();}
}
