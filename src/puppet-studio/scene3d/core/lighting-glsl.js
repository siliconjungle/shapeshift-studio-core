import {MAX_LIGHTS} from './lighting-definition.js';
export const lightingGLSL=`
uniform int puppetLightCount;
uniform vec4 puppetLightPosition[${MAX_LIGHTS}],puppetLightColor[${MAX_LIGHTS}],puppetLightDirection[${MAX_LIGHTS}];
uniform float puppetLightFalloff[${MAX_LIGHTS}];
uniform vec3 puppetWorldTint,puppetTint,puppetEmissionColor;
uniform float puppetTintStrength,puppetEmission,puppetRegionOnly,puppetMask;
uniform vec4 puppetRegion;
vec3 puppetLighting(vec3 shaded,vec3 source,vec3 p,vec2 uv,float ink){
 if(ink>.5&&!(puppetMask>1.5&&puppetRegionOnly>.5&&puppetEmission>0.))return shaded;
 vec3 light=vec3(0.);
 for(int i=0;i<${MAX_LIGHTS};i++){
  if(i>=puppetLightCount)break;
  vec3 d=p-puppetLightPosition[i].xyz;
  float reach=max(0.,1.-length(d)/max(.01,puppetLightPosition[i].w));
  float front=mix(1.,smoothstep(-.45,.15,dot(d,puppetLightDirection[i].xyz)),puppetLightDirection[i].w);
  light+=puppetLightColor[i].rgb*puppetLightColor[i].a*pow(reach,puppetLightFalloff[i])*front;
 }
 vec3 result=shaded*puppetWorldTint*mix(vec3(1.),puppetTint,puppetTintStrength)+source*light;
 float mask=1.;
 if(puppetRegionOnly>.5)mask=1.-smoothstep(.88,1.,length((uv-puppetRegion.xy)/max(puppetRegion.zw,vec2(.0001))));
 if(puppetMask>.5&&puppetMask<1.5)mask*=smoothstep(.28,.60,source.r)*smoothstep(.15,.35,source.g)*(1.-smoothstep(.65,.92,source.b/max(source.g,.001)));
 if(puppetMask>1.5)mask*=1.-smoothstep(.015,.04,max(source.r,max(source.g,source.b)));
 return mix(result,puppetEmissionColor,min(1.,puppetEmission)*mask)+puppetEmissionColor*max(0.,puppetEmission-1.)*mask;
}
`;
