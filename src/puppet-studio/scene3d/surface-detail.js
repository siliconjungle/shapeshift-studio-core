// Optional authored maps augment the same multipass material as the Watcher.
// Height remains available to its relief inspector; normals and occlusion can
// also be supplied explicitly for assets with their own preparation pipeline.
export function attachSurfaceDetail(material,{normalMap=null,occlusionMap=null}={}){
 if(!normalMap&&!occlusionMap)return material;
 Object.assign(material.uniforms,{authoredNormal:{value:normalMap},authoredOcclusion:{value:occlusionMap},hasAuthoredNormal:{value:normalMap?1:0},hasAuthoredOcclusion:{value:occlusionMap?1:0}});
 material.fragmentShader='uniform sampler2D authoredNormal,authoredOcclusion;uniform float hasAuthoredNormal,hasAuthoredOcclusion;\n'+material.fragmentShader;
 material.fragmentShader=material.fragmentShader.replace('if(pass>2.5)',`if(hasAuthoredNormal>.5){
  vec3 base=normalize(vNormal);if(!gl_FrontFacing)base=-base;
  vec3 dx=dFdx(vWorld),dy=dFdy(vWorld);vec2 ux=dFdx(vUv),uy=dFdy(vUv);float det=ux.x*uy.y-ux.y*uy.x;
  if(abs(det)>1e-10){vec3 tangent=normalize((dx*uy.y-dy*ux.y)/det);tangent=normalize(tangent-base*dot(base,tangent));vec3 bitangent=normalize(cross(base,tangent));bitangent*=sign(dot(bitangent,(dy*ux.x-dx*uy.x)/det));vec3 detail=texture2D(authoredNormal,vUv).xyz*2.-1.;detail.xy*=relief/.045;n=normalize(tangent*detail.x+bitangent*detail.y+base*detail.z);}
 }
 if(pass>2.5)`);
 material.fragmentShader=material.fragmentShader.replace('vec3 viewDirection=', 'if(hasAuthoredOcclusion>.5)lighting*=texture2D(authoredOcclusion,vUv).r;\nvec3 viewDirection=');
 return material;
}
