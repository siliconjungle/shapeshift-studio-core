import * as T from 'three';
import {createUniforms} from './uniforms.js';
// Exact illustrated surface/stroke kernels, instantiated with recipe inputs.
export function createIllustratedMaterials({bodyGLSL,eyeGLSL,groundTileSize,inputs,shared={}}){
const uniforms=createUniforms(inputs,shared);
const vertex=eyeGLSL+bodyGLSL+`varying vec3 vNormal,vWorld,vSource,vRestWorld;varying vec2 vUv,vLocal;varying float vTone,vRole;attribute float paintRole,paintTone;attribute vec3 sourcePaint;varying vec3 vSourcePaint;uniform float front,iris;void main(){vec3 p=position;vec3 n=normal;
if(iris>.5){p.xy=p.xy*vec2(.42,.39)+gaze+eyeCenter;vec2 q=unwarpEye(p.xy);p.z=frontDepth(q);n=frontNormal(q);}
else if(front>.5){if(front<1.5){p.z=frontDepth(p.xy);n=frontNormal(p.xy);}if(p.z>1.149){p.xy=warpFront(p.xy);}}
vSourcePaint=sourcePaint;vUv=uv;vSource=position;vLocal=p.xy;vTone=paintTone;vRole=paintRole;vRestWorld=(modelMatrix*vec4(p,1.)).xyz;vNormal=bodyNormal(normalize(mat3(modelMatrix)*n),vRestWorld);vWorld=deformBody(vRestWorld);gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`;
const fragment=eyeGLSL+bodyGLSL+`precision highp float;uniform mat4 modelMatrix,projectionMatrix;uniform vec3 palette[4],light,lightColor,energyColor,floorTint;varying vec3 vSourcePaint;uniform float sourceColors;uniform float depthScale,pass,bands,role,tone,front,iris,usePaint,useMap;uniform sampler2D map,heightMap,roughnessMap,mapB,mapC,heightB,heightC,roughnessB,roughnessC;uniform float floorVariants;uniform float useDetail,relief,sheen,hitFlash,eyeCharge,environment;varying vec3 vNormal,vWorld,vSource,vRestWorld;varying vec2 vUv,vLocal;varying float vTone,vRole;
vec3 colour(float r){if(r<.5)return palette[0];if(r<1.5)return palette[1];if(r<2.5)return palette[2];return palette[3];}
float edge(float d){float aa=max(fwidth(d),.0005);return 1.-smoothstep(-aa,aa,d);}
// Unwrapped world coordinates preserve derivatives and tile scale while panning
// or zooming. RepeatWrapping handles the periodic sample, including mip filters.
vec2 detailUV(){return floorVariants>.5?vec2(vRestWorld.x,-vRestWorld.z)/${groundTileSize.toFixed(1)}+.5:vUv;}
float groundVariant(){vec2 cell=floor(detailUV());return floor(fract(sin(dot(cell,vec2(127.1,311.7)))*43758.5453)*3.);}

vec4 surfaceColour(vec2 uv){vec2 dx=dFdx(uv),dy=dFdy(uv);if(floorVariants>.5){float id=groundVariant();if(id>1.5)return textureGrad(mapC,uv,dx,dy);if(id>.5)return textureGrad(mapB,uv,dx,dy);}return textureGrad(map,uv,dx,dy);}
float surfaceHeight(vec2 uv){vec2 dx=dFdx(uv),dy=dFdy(uv);if(floorVariants>.5){float id=groundVariant();if(id>1.5)return textureGrad(heightC,uv,dx,dy).r;if(id>.5)return textureGrad(heightB,uv,dx,dy).r;}return textureGrad(heightMap,uv,dx,dy).r;}
float surfaceRoughness(vec2 uv){vec2 dx=dFdx(uv),dy=dFdy(uv);if(floorVariants>.5){float id=groundVariant();if(id>1.5)return textureGrad(roughnessC,uv,dx,dy).r;if(id>.5)return textureGrad(roughnessB,uv,dx,dy).r;}return textureGrad(roughnessMap,uv,dx,dy).r;}
void main(){if(iris>.5&&(blink<.01||!insideEye(vLocal)))discard;
if(front>.5&&front<1.5&&vRole>1.5&&vRole<2.5&&(blink<.01||!insideEye(vLocal)))discard;
vec4 depthClip=projectionMatrix*viewMatrix*vec4(deformBody(vRestWorld),1.);gl_FragDepth=depthClip.z/depthClip.w*.5+.5-(iris>.5?.00008:usePaint>.5||useMap>.5?.00004:0.)*depthScale;
vec3 n=normalize(vNormal);if(!gl_FrontFacing)n=-n;
float height=0.44,roughness=.92;
if(useDetail>.5){
 vec2 detail=detailUV();height=surfaceHeight(detail);roughness=surfaceRoughness(detail);
 // Surface derivatives form a world-space cotangent frame. Height follows UV
 // artwork while lighting follows the cube's actual orientation and eye warp.
 vec3 dp1=dFdx(vWorld),dp2=dFdy(vWorld);vec2 du1=dFdx(detailUV()),du2=dFdy(detailUV());
 vec3 cross2=cross(dp2,n),cross1=cross(n,dp1);
 vec3 tangent=cross2*du1.x+cross1*du2.x,bitangent=cross2*du1.y+cross1*du2.y;
 float inverseScale=inversesqrt(max(max(dot(tangent,tangent),dot(bitangent,bitangent)),1e-12));
 vec2 texel=vec2(1./1024.);
 vec2 gradient=vec2(surfaceHeight(detail+vec2(texel.x,0.))-surfaceHeight(detail-vec2(texel.x,0.)),surfaceHeight(detail+vec2(0.,texel.y))-surfaceHeight(detail-vec2(0.,texel.y)))/(2.*texel);
 gradient=clamp(gradient*relief,vec2(-.7),vec2(.7));
 n=normalize(n-(tangent*gradient.x+bitangent*gradient.y)*inverseScale);
}
if(pass>2.5){gl_FragColor=vec4(vec3(roughness),1.);return;}
if(pass>1.5){gl_FragColor=vec4(vec3(height),1.);return;}
if(pass>.5){gl_FragColor=vec4(n*.5+.5,(environment>.5?.79:iris>.5?.95:(front>.5&&front<1.5&&insideEye(vLocal)?.88:.55+.1*mix(role,vRole,usePaint))));return;}
float r=mix(role,vRole,usePaint),t=mix(tone,vTone,usePaint);vec3 c=colour(r)*t;if(usePaint>.5&&sourceColors>.5)c=vSourcePaint;
float diffuse=max(0.,dot(n,light));float band=floor(diffuse*(bands-.001))/max(1.,bands-1.);float lighting=.78+band*.22;
// Engraved channels are slightly occluded; surface relief never changes the
// physical cube depth or its silhouette. Specular is stepped like the fills.
lighting*=mix(1.,.92+.08*smoothstep(.27,.46,height),useDetail);
vec3 viewDirection=normalize(vec3(viewMatrix[0][2],viewMatrix[1][2],viewMatrix[2][2])),halfDirection=normalize(light+viewDirection);
float spec=pow(max(0.,dot(n,halfDirection)),mix(72.,8.,roughness));
float highlight=smoothstep(.34,.38,spec)*.65+smoothstep(.72,.76,spec)*.35;
float sheenAmount=(1.-roughness)*highlight*sheen*step(.01,diffuse);
if(r>2.5){lighting=1.;sheenAmount=0.;}
if(useMap>.5){c=surfaceColour(detailUV()).rgb;if(environment>.5){
 // Broad, world-anchored mineral variation crosses tile boundaries continuously.
 float mineral=sin(vRestWorld.x*.23+sin(vRestWorld.z*.17))*sin(vRestWorld.z*.19-vRestWorld.x*.08);
 float fleck=sin(vRestWorld.x*.61+vRestWorld.z*.31)*sin(vRestWorld.z*.47);
 c*=floorTint*(1.+mineral*.085+fleck*.025);
}}
c=mix(c,mix(palette[2],lightColor,.55),sheenAmount);if(iris>.5)c=mix(c,mix(energyColor,vec3(1.),.4),eyeCharge*.85);
// Tint the illuminated bands; keep ambient shadow and black ink intact.
vec3 lightTint=r>2.5?vec3(1.):mix(vec3(1.),lightColor,.32*band);
gl_FragColor=vec4(mix(c*lighting*lightTint,palette[2],hitFlash),1.);
#include <colorspace_fragment>
}`;
function inkMaterial({role=0,tone=1,front=0,iris=0,usePaint=0,map=null,heightMap=null,roughnessMap=null,environment=0}={}){const material=new T.ShaderMaterial({uniforms:{...uniforms,sourceColors:{value:0},floorVariants:{value:0},mapB:{value:null},mapC:{value:null},heightB:{value:null},heightC:{value:null},roughnessB:{value:null},roughnessC:{value:null},floorTint:{value:new T.Vector3(1,1,1)},environment:{value:environment},role:{value:role},tone:{value:tone},front:{value:front},iris:{value:iris},usePaint:{value:usePaint},useMap:{value:map?1:0},map:{value:map},heightMap:{value:heightMap},roughnessMap:{value:roughnessMap},useDetail:{value:heightMap?1:0}},vertexShader:vertex,fragmentShader:fragment,side:T.DoubleSide,depthWrite:!(usePaint||front===1||iris)});material.userData.vectorOverlay=!!(usePaint||front===1||iris);return material;}
// Pressure-shaped ribbons: geometry is a static parametrisation. Width, wobble,
// taper and screen-space extrusion are evaluated on the GPU every frame.
function gpuStrokes(segments,{width=1,detail=24}={}){
 const positions=[],params=[],indices=[];for(let i=0;i<=detail;i++){const t=i/detail;positions.push(t,-1,0,t,1,0);params.push(t,-1,t,1);if(i<detail){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}}
 const g=new T.InstancedBufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('param',new T.Float32BufferAttribute(params,2));g.setIndex(indices);g.setAttribute('start',new T.InstancedBufferAttribute(new Float32Array(segments.flatMap(s=>s[0])),3));g.setAttribute('end',new T.InstancedBufferAttribute(new Float32Array(segments.flatMap(s=>s[1])),3));g.setAttribute('seed',new T.InstancedBufferAttribute(new Float32Array(segments.map((_,i)=>i*.731)),1));g.instanceCount=segments.length;
 const m=new T.ShaderMaterial({uniforms:{...uniforms,strokeScale:{value:width}},vertexShader:bodyGLSL+`attribute vec2 param;attribute vec3 start,end;attribute float seed;uniform vec2 resolution;uniform float weight,scribble,strokeScale,pixelRatio,depthScale;varying float side,taper;void main(){float t=param.x;vec3 center=mix(start,end,t),before=mix(start,end,max(0.,t-.002)),after=mix(start,end,min(1.,t+.002));vec4 a=projectionMatrix*viewMatrix*vec4(deformBody((modelMatrix*vec4(before,1.)).xyz),1.),b=projectionMatrix*viewMatrix*vec4(deformBody((modelMatrix*vec4(after,1.)).xyz),1.);vec2 dir=(b.xy/b.w-a.xy/a.w)*resolution;float len=length(dir);vec2 perp=vec2(-dir.y,dir.x)/max(len,.00001);vec4 p=projectionMatrix*viewMatrix*vec4(deformBody((modelMatrix*vec4(center,1.)).xyz),1.);float pressure=.85+.15*sin(t*9.+seed)+.09*sin(t*24.+seed*7.);float wav=(sin(t*17.+seed*12.)+.35*sin(t*43.+seed))*scribble;float w=weight*pixelRatio*strokeScale*(1.+scribble*(pressure-1.));float cap=smoothstep(0.,.07,t)*smoothstep(0.,.07,1.-t);p.xy+=perp*(param.y*w*mix(.55,1.,cap)+wav)*2./resolution*p.w;p.z-=.00012*p.w*depthScale;gl_Position=p;side=param.y;taper=cap;}`,fragmentShader:`uniform float pass;varying float side,taper;void main(){if(pass>.5)discard;float aa=fwidth(side);float alpha=1.-smoothstep(1.-aa,1.,abs(side));gl_FragColor=vec4(.003,.006,.004,alpha);}`,transparent:true,depthWrite:false,side:T.DoubleSide});const mesh=new T.Mesh(g,m);mesh.frustumCulled=false;mesh.renderOrder=10;mesh.userData.gpuStroke=true;return mesh;
}

return {uniforms,inkMaterial,gpuStrokes};
}
