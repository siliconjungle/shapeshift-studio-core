import {gradingGLSL,gradingUniforms,updateGradingUniforms} from '../../../rendering/color-grading.js';
import * as T from 'three';import {FXAAShader} from 'three/addons/shaders/FXAAShader.js';
const screenVertex=`varying vec2 uvv;void main(){uvv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const screenFragment=`${gradingGLSL}
precision highp float;uniform sampler2D colour,normalMap,depthMap,effectsMap;uniform vec2 resolution,depthRange;uniform float weight,scribble,view,pixelRatio,effectsEnabled,depthSpan,surfaceEdges;varying vec2 uvv;
// Interpolate binary coverage, never the packed material IDs. This keeps the
// silhouette smooth between mask pixels without introducing false face edges.
float occupied(vec2 p){vec2 pixel=p*resolution-.5,f=fract(pixel),base=(floor(pixel)+.5)/resolution,texel=1./resolution;
 float a=step(.5,texture2D(normalMap,base).a),b=step(.5,texture2D(normalMap,base+vec2(texel.x,0.)).a),c=step(.5,texture2D(normalMap,base+vec2(0.,texel.y)).a),d=step(.5,texture2D(normalMap,base+texel).a);
 return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
}
void main(){vec3 c=texture2D(colour,uvv).rgb;vec4 center=texture2D(normalMap,uvv);float depth=texture2D(depthMap,uvv).x;float ink=0.;float pressure=1.+scribble*(.18*sin(gl_FragCoord.x*.105+gl_FragCoord.y*.071)+.12*sin(gl_FragCoord.y*.24));float radius=max(.0,weight*pixelRatio*pressure);float centerOn=step(.5,center.a);
// Background only needs occupancy; painted faces do not need terrain depth
// differences. Preserve the same twelve taps and pressure-shaped contour.
if(view<.5||(view>3.5&&view<4.5)){
 for(int i=0;i<12;i++){
  float angle=float(i)*6.2831853/12.;vec2 offset=vec2(cos(angle),sin(angle))*radius/resolution;
  if(centerOn<.5){ink=max(ink,occupied(uvv+offset));}
  else{
   vec2 nearUV=uvv+offset*.48;vec4 nearMaterial=texture2D(normalMap,nearUV);
   float materialEdge=step(.055,abs(nearMaterial.a-center.a))*step(.5,nearMaterial.a);
   float paintedInk=0.;if(center.a<.85){vec3 painted=texture2D(colour,nearUV).rgb;paintedInk=(1.-smoothstep(.008,.018,max(max(painted.r,painted.g),painted.b)))*step(.5,nearMaterial.a);}
   float environmentEdge=0.;if(center.a>=.77&&center.a<.82){vec4 n=texture2D(normalMap,uvv+offset);float on=step(.5,n.a),d=texture2D(depthMap,uvv+offset).r;environmentEdge=max(smoothstep(.32,.64,length(n.rgb-center.rgb)),smoothstep(.1197,.3591,abs(d-depth)*depthSpan))*on;}
   ink=max(ink,max(environmentEdge,max(paintedInk,materialEdge)*surfaceEdges));
  }
 }
}
ink*=smoothstep(0.,.4,weight);
if(view>4.5)c=mix(vec3(.12),center.rgb,centerOn);else if(view>3.5)c=mix(vec3(.94,.93,.89),vec3(.003,.006,.004),ink);else if(view>2.5)c=mix(vec3(.10),center.rgb,centerOn);else if(view>1.5)c=vec3(mix(0.,1.-smoothstep(depthRange.x,depthRange.y,depth),centerOn));else if(view<.5)c=mix(c,vec3(.003,.006,.004),ink);
if(view<1.5&&effectsEnabled>.5){vec4 fx=texture2D(effectsMap,uvv);c=fx.rgb+c*(1.-fx.a);}
if(view<.5)c=gradeLinear(c);gl_FragColor=vec4(c,1.);
#include <colorspace_fragment>
}`;
export class IllustratedRenderer{setGrading(g){updateGradingUniforms(this.material.uniforms,g);}
constructor(renderer,uniforms){this.uniforms=uniforms;this.renderer=renderer;this.background=new T.Color('#e8e5dc');this.effectMaterials=new Set();this.hiddenMaterials=new Map();this.hiddenObjects=new Map();this.effects=new T.WebGLRenderTarget(1,1,{type:T.UnsignedByteType,samples:4});this.color=new T.WebGLRenderTarget(1,1,{type:T.UnsignedByteType,samples:4});this.normal=new T.WebGLRenderTarget(1,1,{type:T.UnsignedByteType,minFilter:T.NearestFilter,magFilter:T.NearestFilter,depthBuffer:true});this.normal.depthTexture=new T.DepthTexture(1,1,T.UnsignedIntType);this.normal.texture.name='world-normal';this.normal.depthTexture.name='scene-depth';this.screen=new T.Scene();this.camera=new T.Camera();this.material=new T.ShaderMaterial({vertexShader:screenVertex,fragmentShader:screenFragment,depthTest:false,depthWrite:false,uniforms:{...gradingUniforms(),surfaceEdges:{value:1},depthSpan:{value:39.9},effectsEnabled:{value:0},effectsMap:{value:this.effects.texture},colour:{value:this.color.texture},normalMap:{value:this.normal.texture},depthMap:{value:this.normal.depthTexture},resolution:uniforms.resolution,depthRange:{value:new T.Vector2(.1,.3)},pixelRatio:uniforms.pixelRatio,weight:uniforms.weight,scribble:uniforms.scribble,view:{value:0}}});this.screen.add(new T.Mesh(new T.PlaneGeometry(2,2),this.material));this.composite=new T.WebGLRenderTarget(1,1);this.final=new T.Scene();this.fxaa=new T.ShaderMaterial({uniforms:T.UniformsUtils.clone(FXAAShader.uniforms),vertexShader:FXAAShader.vertexShader,fragmentShader:FXAAShader.fragmentShader.replace(/}\s*$/, '#include <colorspace_fragment>\n}'),depthTest:false,depthWrite:false});this.fxaa.uniforms.tDiffuse.value=this.composite.texture;this.final.add(new T.Mesh(new T.PlaneGeometry(2,2),this.fxaa));}
resize(w,h){const uniforms=this.uniforms;uniforms.pixelRatio.value=this.renderer.getPixelRatio();this.effects.setSize(w,h);this.composite.setSize(w,h);this.fxaa.uniforms.resolution.value.set(1/w,1/h);this.color.setSize(w,h);this.normal.setSize(w,h);uniforms.resolution.value.set(w,h);}
render(scene,camera){
 const uniforms=this.uniforms;
 scene.userData.shapeShadow?.update(this.renderer);
 const r=this.renderer,background=scene.background,fx=scene.userData.inkEffects,fxVisible=fx?.visible,decals=scene.userData.groundDecals,decalsVisible=decals?.visible;
 let hasEffects=false;if(fxVisible)fx.traverseVisible(o=>{if(o.isMesh)hasEffects=true;});
 this.material.uniforms.effectsEnabled.value=hasEffects?1:0;
 if(fx)fx.visible=false;
 this.material.uniforms.depthSpan.value=camera.far-camera.near;uniforms.depthScale.value=39.9/(camera.far-camera.near);
 const distance=camera.position.length();this.material.uniforms.depthRange.value.set((distance-2.4-camera.near)/(camera.far-camera.near),(distance+2.4-camera.near)/(camera.far-camera.near));
 uniforms.pass.value=0;r.setRenderTarget(this.color);r.setClearColor(this.background,1);r.clear();r.render(scene,camera);
 uniforms.pass.value=this.material.uniforms.view.value>5.5?3:this.material.uniforms.view.value>4.5?2:1;
 if(decals)decals.visible=false;scene.background=null;r.setRenderTarget(this.normal);r.setClearColor(0,0);r.clear();r.render(scene,camera);uniforms.pass.value=0;
 if(fx)fx.visible=fxVisible;
 // An empty effect layer needs neither another scene/depth render nor a clear.
 if(hasEffects){
  r.setRenderTarget(this.effects);r.setClearColor(0,0);r.clear();
  const effectMaterials=this.effectMaterials,hidden=this.hiddenMaterials,visibility=this.hiddenObjects;
  effectMaterials.clear();hidden.clear();visibility.clear();fx.traverseVisible(o=>{if(o.material)effectMaterials.add(o.material);});
  scene.traverseVisible(o=>{if(o.material&&!effectMaterials.has(o.material)){if(!o.material.depthWrite){visibility.set(o,o.visible);o.visible=false;}else if(!hidden.has(o.material)){hidden.set(o.material,o.material.colorWrite);o.material.colorWrite=false;}}});
  r.render(scene,camera);for(const [m,value]of hidden)m.colorWrite=value;for(const [o,value]of visibility)o.visible=value;
  hidden.clear();visibility.clear();effectMaterials.clear();
 }
 if(decals)decals.visible=decalsVisible;scene.background=background;r.setClearColor(this.background,1);if(this.antialias==='msaa'){r.setRenderTarget(null);r.render(this.screen,this.camera);}else{r.setRenderTarget(this.composite);r.render(this.screen,this.camera);r.setRenderTarget(null);r.render(this.final,this.camera);}
}
dispose(){this.effects.dispose();this.color.dispose();this.normal.dispose();this.composite.dispose();this.material.dispose();this.fxaa.dispose();this.screen.children[0].geometry.dispose();this.final.children[0].geometry.dispose();}}
