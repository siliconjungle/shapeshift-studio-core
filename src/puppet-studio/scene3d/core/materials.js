import * as T from 'three';
import { createUniforms } from './uniforms.js';
// Neutral shader defaults; scenes only override the inputs they author.
export function illustratedMaterialInputs() {
  const float = (value) => ({ type: 'float', value }),
    vec2 = (...value) => ({ type: 'vec2', value }),
    vec3 = (...value) => ({ type: 'vec3', value });
  return {
    depthScale: float(1),
    bodyBend: vec2(1, 0),
    bodyShape: vec3(1, 0, 0),
    bodyCenter: vec3(0, 0, 0),
    bodyHalf: float(1),
    energyColor: { type: 'color', value: '#ffffff' },
    lightColor: { type: 'color', value: '#ffffff' },
    irisEmission: float(0),
    surfaceFlash: float(0),
    pixelRatio: float(1),
    relief: float(0),
    sheen: float(0),
    eyeBounds: { type: 'vec4', value: [1, 1, 0, 0] },
    eyeCenter: vec2(0, 0),
    eyeContour: { type: 'vec2s', value: Array.from({ length: 64 }, () => [0, 0]) },
    eyeTilt: float(0),
    pass: float(0),
    palette: { type: 'colors', value: ['#475569', '#94a3b8', '#f8fafc', '#0f172a'] },
    bands: float(3),
    light: { type: 'vec3', value: [-1, 1, 1], normalize: true },
    time: float(0),
    gaze: vec2(0, 0),
    blink: float(1),
    scribble: float(0),
    resolution: vec2(1, 1),
    weight: float(1),
  };
}
// SVG shading uses broad palette regions over smooth surface normals. The small
// transition width antialiases the region boundaries without revealing triangles.
export const shadingMode = (def) => def.shading ?? (def.flat ? 'svg' : 'lit');
export const shadingValue = (def) => ({ lit: 0, svg: 1, solid: 2 })[shadingMode(def)];
export const svgShadingGLSL = `
vec3 svgShade(vec3 base,vec3 ink,vec3 paper,float lightAmount,float steps,float contrast,float softness){
 float amount=clamp(lightAmount*.5+.5,0.,1.),count=clamp(floor(steps+.5),2.,12.);
 float aa=max(fwidth(amount),.001)+softness,level=0.;
 for(int i=1;i<12;i++){if(float(i)>=count)break;float threshold=float(i)/count;level+=smoothstep(threshold-aa,threshold+aa,amount);}
 level/=count-1.;vec3 shadow=mix(base,ink,contrast),highlight=mix(base,paper,contrast*.48);
 return level<.5?mix(shadow,base,level*2.):mix(base,highlight,(level-.5)*2.);
}
`;
// Pixel width from a material's chosen units. Projection makes object-relative
// ink scale with both object transforms and camera zoom in either projection.
export const outlineWidthGLSL = `
uniform float objectInk,relativeInk;uniform vec3 inkDimensions;
float objectInkPixels(vec3 world,mat4 model,mat4 view,mat4 projection,vec2 viewport,float pixelRatio){
 float span=max(max(inkDimensions.x*length(model[0].xyz),inkDimensions.y*length(model[1].xyz)),inkDimensions.z*length(model[2].xyz));
 if(objectInk>1.5)span=1.;
 float clipW=abs((projection*view*vec4(world,1.)).w);
 return mix(pixelRatio,relativeInk*span*abs(projection[1][1])*viewport.y*.5/max(.0001,clipW),step(.5,objectInk));
}
`;
// Exact illustrated surface/stroke kernels, instantiated with recipe inputs.
export function createIllustratedMaterials({ bodyGLSL, eyeGLSL, groundTileSize, inputs = {}, shared = {} }) {
  const uniforms = {
    ...createUniforms(inputs = {}, shared),
    shadingStyle: { value: 0 },
    shadeContrast: { value: 0.3 },
    shadeSoftness: { value: 0.025 },
    preservePaint: { value: 0 },
    objectInk: { value: 0 },
    relativeInk: { value: 0.02 },
    inkDimensions: { value: new T.Vector3(1, 1, 1) },
    inkScale: { value: 1 },
  };
  uniforms.irisScale ??= { value: new T.Vector2(1, 1) };
  const vertex =
    eyeGLSL +
    bodyGLSL +
    `varying vec3 vNormal,vWorld,vSource,vRestWorld;varying vec2 vUv,vLocal;varying float vTone,vRole;attribute float paintRole,paintTone;attribute vec3 sourcePaint;varying vec3 vSourcePaint;uniform float front,iris;uniform vec2 irisScale;void main(){vec3 p=position;vec3 n=normal;
if(iris>.5){p.xy=p.xy*irisScale+gaze+eyeCenter;vec2 q=unwarpEye(p.xy);p.z=frontDepth(q);n=frontNormal(q);}
else if(front>.5){if(front<1.5){p.z=frontDepth(p.xy);n=frontNormal(p.xy);}if(p.z>frontDepth(p.xy)-.001){p.xy=warpFront(p.xy);}}
vSourcePaint=sourcePaint;vUv=uv;vSource=position;vLocal=p.xy;vTone=paintTone;vRole=paintRole;vRestWorld=(modelMatrix*vec4(p,1.)).xyz;vNormal=bodyNormal(normalize(mat3(modelMatrix)*n),vRestWorld);vWorld=deformBody(vRestWorld);gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`;
  const fragment =
    eyeGLSL +
    bodyGLSL +
    svgShadingGLSL +
    `precision highp float;uniform mat4 modelMatrix,projectionMatrix;uniform vec3 palette[4],light,lightColor,energyColor,floorTint;varying vec3 vSourcePaint;uniform float sourceColors;uniform float preservePaint,shadingStyle,shadeContrast,shadeSoftness,depthScale,pass,bands,role,tone,front,iris,usePaint,useMap;uniform sampler2D map,heightMap,roughnessMap,mapB,mapC,heightB,heightC,roughnessB,roughnessC;uniform float floorVariants;uniform float useDetail,relief,sheen,surfaceFlash,irisEmission,environment;varying vec3 vNormal,vWorld,vSource,vRestWorld;varying vec2 vUv,vLocal;varying float vTone,vRole;
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
if(useMap>.5){c=surfaceColour(detailUV()).rgb;if(environment>.5&&preservePaint<.5){
 // Broad, world-anchored mineral variation crosses tile boundaries continuously.
 float mineral=sin(vRestWorld.x*.23+sin(vRestWorld.z*.17))*sin(vRestWorld.z*.19-vRestWorld.x*.08);
 float fleck=sin(vRestWorld.x*.61+vRestWorld.z*.31)*sin(vRestWorld.z*.47);
 c*=floorTint*(1.+mineral*.085+fleck*.025);
}}
if(shadingStyle>.5||preservePaint>.5&&(usePaint>.5||useMap>.5)){if(shadingStyle>.5&&shadingStyle<1.5&&r<2.5&&!(preservePaint>.5&&(usePaint>.5||useMap>.5)))c=svgShade(c,palette[3],palette[2],dot(n,light),bands,shadeContrast,shadeSoftness);lighting=1.;sheenAmount=0.;}
c=mix(c,mix(palette[2],lightColor,.55),sheenAmount);if(iris>.5)c=mix(c,mix(energyColor,vec3(1.),.4),irisEmission*.85);
// Tint the illuminated bands; keep ambient shadow and black ink intact.
vec3 lightTint=(r>2.5||shadingStyle>.5||preservePaint>.5&&(usePaint>.5||useMap>.5))?vec3(1.):mix(vec3(1.),lightColor,.32*band);
gl_FragColor=vec4(mix(c*lighting*lightTint,palette[2],surfaceFlash),1.);
#include <colorspace_fragment>
}`;
  function inkMaterial({
    role = 0,
    tone = 1,
    front = 0,
    iris = 0,
    usePaint = 0,
    map = null,
    heightMap = null,
    roughnessMap = null,
    environment = 0,
  } = {}) {
    const material = new T.ShaderMaterial({
      uniforms: {
        ...uniforms,
        sourceColors: { value: 0 },
        floorVariants: { value: 0 },
        mapB: { value: null },
        mapC: { value: null },
        heightB: { value: null },
        heightC: { value: null },
        roughnessB: { value: null },
        roughnessC: { value: null },
        floorTint: { value: new T.Vector3(1, 1, 1) },
        environment: { value: environment },
        role: { value: role },
        tone: { value: tone },
        front: { value: front },
        iris: { value: iris },
        usePaint: { value: usePaint },
        useMap: { value: map ? 1 : 0 },
        map: { value: map },
        heightMap: { value: heightMap },
        roughnessMap: { value: roughnessMap },
        useDetail: { value: heightMap ? 1 : 0 },
      },
      vertexShader: vertex,
      fragmentShader: fragment,
      side: T.DoubleSide,
      depthWrite: !(usePaint || front === 1 || iris),
    });
    material.userData.vectorOverlay = !!(usePaint || front === 1 || iris);
    return material;
  }
  // Pressure-shaped ribbons: geometry is a static parametrisation. Width, wobble,
  // taper and screen-space extrusion are evaluated on the GPU every frame.
  function gpuStrokes(segments, { width = 1, detail = 24 } = {}) {
    const positions = [],
      params = [],
      indices = [];
    for (let i = 0; i <= detail; i++) {
      const t = i / detail;
      positions.push(t, -1, 0, t, 1, 0);
      params.push(t, -1, t, 1);
      if (i < detail) {
        const k = i * 2;
        indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    const g = new T.InstancedBufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    g.setAttribute('param', new T.Float32BufferAttribute(params, 2));
    g.setIndex(indices);
    g.setAttribute('start', new T.InstancedBufferAttribute(new Float32Array(segments.flatMap((s) => s[0])), 3));
    g.setAttribute('end', new T.InstancedBufferAttribute(new Float32Array(segments.flatMap((s) => s[1])), 3));
    g.setAttribute('seed', new T.InstancedBufferAttribute(new Float32Array(segments.map((_, i) => i * 0.731)), 1));
    g.instanceCount = segments.length;
    const m = new T.ShaderMaterial({
      uniforms: { ...uniforms, strokeScale: { value: width } },
      vertexShader:
        bodyGLSL +
        outlineWidthGLSL +
        `attribute vec2 param;attribute vec3 start,end;attribute float seed;uniform vec2 resolution;uniform float weight,scribble,strokeScale,pixelRatio,depthScale,inkScale;varying float side,taper;void main(){float t=param.x;vec3 center=mix(start,end,t),before=mix(start,end,max(0.,t-.002)),after=mix(start,end,min(1.,t+.002));vec4 a=projectionMatrix*viewMatrix*vec4(deformBody((modelMatrix*vec4(before,1.)).xyz),1.),b=projectionMatrix*viewMatrix*vec4(deformBody((modelMatrix*vec4(after,1.)).xyz),1.);vec2 dir=(b.xy/b.w-a.xy/a.w)*resolution;float len=length(dir);vec2 perp=vec2(-dir.y,dir.x)/max(len,.00001);vec4 p=projectionMatrix*viewMatrix*vec4(deformBody((modelMatrix*vec4(center,1.)).xyz),1.);float pressure=.85+.15*sin(t*9.+seed)+.09*sin(t*24.+seed*7.);float wav=(sin(t*17.+seed*12.)+.35*sin(t*43.+seed))*scribble;float w=weight*inkScale*objectInkPixels(deformBody((modelMatrix*vec4(center,1.)).xyz),modelMatrix,viewMatrix,projectionMatrix,resolution,pixelRatio)*strokeScale*(1.+scribble*(pressure-1.));float cap=smoothstep(0.,.07,t)*smoothstep(0.,.07,1.-t);p.xy+=perp*(param.y*w*mix(.55,1.,cap)+wav)*2./resolution*p.w;p.z-=.00012*p.w*depthScale;gl_Position=p;side=param.y;taper=cap;}`,
      fragmentShader: `uniform float pass;varying float side,taper;void main(){if(pass>.5)discard;float aa=fwidth(side);float alpha=1.-smoothstep(1.-aa,1.,abs(side));gl_FragColor=vec4(.003,.006,.004,alpha);}`,
      transparent: true,
      depthWrite: false,
      side: T.DoubleSide,
    });
    const mesh = new T.Mesh(g, m);
    mesh.frustumCulled = false;
    mesh.renderOrder = 10;
    mesh.userData.gpuStroke = true;
    return mesh;
  }

  function outlineMaterial() {
    const v =
      outlineWidthGLSL +
      vertex
        .replace('void main(){', 'uniform vec2 resolution;uniform float pixelRatio,weight,inkScale,scribble;void main(){')
        .replace(
          'gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);',
          `vec4 clip=projectionMatrix*viewMatrix*vec4(vWorld,1.),nearClip=projectionMatrix*viewMatrix*vec4(vWorld+normalize(vNormal)*.002,1.);vec2 direction=normalize((nearClip.xy/nearClip.w-clip.xy/clip.w)*resolution+vec2(.000001));float pressure=1.+scribble*(.2*sin(position.x*23.+position.y*13.)+.13*sin(position.z*31.));float width=objectInkPixels(vWorld,modelMatrix,viewMatrix,projectionMatrix,resolution,pixelRatio)*inkScale*weight;clip.xy+=direction*width*pressure*2./resolution*clip.w;gl_Position=clip;`,
        );
    return new T.ShaderMaterial({
      uniforms: { ...uniforms, front: { value: 0 }, iris: { value: 0 } },
      vertexShader: v,
      fragmentShader: `uniform float pass;uniform vec3 palette[4];void main(){if(pass>.5)discard;gl_FragColor=vec4(palette[3],1.);\n#include <colorspace_fragment>\n}`,
      side: T.BackSide,
    });
  }
  return { uniforms, inkMaterial, gpuStrokes, outlineMaterial };
}
