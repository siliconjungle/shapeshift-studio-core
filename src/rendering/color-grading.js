// Shared final-scene colour contract. Inputs/outputs are straight-alpha sRGB;
// Three adapters convert linear render targets at this boundary, exactly once.
export const GRADING_VERSION=1;
export const GRADING_CONTROLS={amount:[0,1,.01],exposure:[-2,2,.01],contrast:[.5,1.5,.01],saturation:[0,2,.01],temperature:[-1,1,.01],tint:[-1,1,.01],split:[0,.4,.01],inkProtection:[0,1,.01]};
const neutral={amount:1,exposure:0,contrast:1,saturation:1,temperature:0,tint:0,split:0,inkProtection:1,shadows:'#7288aa',highlights:'#ffe5b0'};
export const GRADING_PRESETS={neutral};
export function validateGrading(g){if(g===undefined)return;if(!g||typeof g!=='object'||Array.isArray(g))throw Error('Grading must be an object');for(const k of Object.keys(g))if(!['version','preset','enabled','shadows','highlights',...Object.keys(GRADING_CONTROLS)].includes(k))throw Error('Unknown grading field '+k);if(g.version!==undefined&&g.version!==1)throw Error('Unsupported grading version');if(g.enabled!==undefined&&typeof g.enabled!=='boolean')throw Error('Grading enabled must be boolean');if(g.preset!==undefined&&(typeof g.preset!=='string'||!g.preset.length||g.preset.length>100))throw Error('Unknown grading preset');for(const [k,[lo,hi]]of Object.entries(GRADING_CONTROLS))if(g[k]!==undefined&&(!Number.isFinite(g[k])||g[k]<lo||g[k]>hi))throw Error('Grading '+k+' must be between '+lo+' and '+hi);for(const k of ['shadows','highlights'])if(g[k]!==undefined&&!/^#[\da-f]{6}$/i.test(g[k]))throw Error('Grading '+k+' must be #rrggbb');}
export function resolveGrading(g,catalog={},active='neutral'){const preset=g?.preset==='auto'?active:g?.preset??'neutral';return {version:1,enabled:true,preset,...neutral,...(catalog?.[preset]?.values??catalog?.[preset]??GRADING_PRESETS[preset]??{}),...g};}
export function gradingActive(g){return g.enabled&&g.amount>0&&(g.exposure!==0||g.contrast!==1||g.saturation!==1||g.temperature!==0||g.tint!==0||g.split!==0);}
export function gradingValues(g,catalog,active){const v=resolveGrading(g,catalog,active),rgb=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255);return {gradeTone:[gradingActive(v)?v.amount:0,v.exposure,v.contrast,v.saturation],gradeBalance:[v.temperature,v.tint,v.split,v.inkProtection],gradeShadows:rgb(v.shadows),gradeHighlights:rgb(v.highlights)};}
export const gradingUniforms=()=>Object.fromEntries(Object.entries(gradingValues()).map(([k,v])=>[k,{value:v}]));
export function updateGradingUniforms(uniforms,g,catalog,active){const values=gradingValues(g,catalog,active);for(const k in values){const a=uniforms[k].value,b=values[k];for(let i=0;i<b.length;i++)a[i]=b[i];}}
export const gradingGLSL=`
uniform vec4 gradeTone,gradeBalance;uniform vec3 gradeShadows,gradeHighlights;
vec3 gradeToLinear(vec3 c){return mix(c/12.92,pow(max((c+.055)/1.055,vec3(0.)),vec3(2.4)),step(vec3(.04045),c));}
vec3 gradeToSRGB(vec3 c){return mix(c*12.92,1.055*pow(max(c,vec3(0.)),vec3(1./2.4))-.055,step(vec3(.0031308),c));}
vec3 gradeSRGB(vec3 source){
 if(gradeTone.x<=0.)return source;
 float lum=dot(source,vec3(.2126,.7152,.0722));
 vec3 c=gradeToSRGB(gradeToLinear(source)*exp2(gradeTone.y));
 c*=vec3(1.+gradeBalance.x*.14,1.+gradeBalance.y*.1,1.-gradeBalance.x*.14);
 c=(c-.5)*gradeTone.z+.5;
 c=mix(vec3(dot(c,vec3(.2126,.7152,.0722))),c,gradeTone.w);
 vec3 shadows=gradeShadows-vec3(dot(gradeShadows,vec3(.2126,.7152,.0722)));
 vec3 highlights=gradeHighlights-vec3(dot(gradeHighlights,vec3(.2126,.7152,.0722)));
 c+=gradeBalance.z*(shadows*(1.-smoothstep(.1,.65,lum))+highlights*smoothstep(.35,.95,lum));
 float ink=mix(1.,smoothstep(.015,.15,lum),gradeBalance.w);
 return mix(source,clamp(c,0.,1.),gradeTone.x*ink);
}
vec3 gradeLinear(vec3 c){if(gradeTone.x<=0.)return c;return gradeToLinear(gradeSRGB(gradeToSRGB(c)));}
`;
