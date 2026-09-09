import * as T from 'three';
import {animateVectorLayers} from './vector-animation.js';
const geometryTypes={cylinder:T.CylinderGeometry,ring:T.RingGeometry,sphere:T.SphereGeometry,plane:T.PlaneGeometry,circle:T.CircleGeometry};
export function createEffectMaterial(color,pass={value:0}){return new T.ShaderMaterial({uniforms:{pass,color:{value:new T.Color(color)},alpha:{value:1}},vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform float pass,alpha;uniform vec3 color;void main(){if(pass>.5)discard;gl_FragColor=vec4(color,alpha);\n#include <colorspace_fragment>\n}',side:T.DoubleSide,transparent:true,depthWrite:false});}
// Scene graphs and procedural programs are data. The runtime understands meshes,
// groups, palette weights and numeric tracks; no particular boss or action.
export class ProceduralEffects{
 constructor(definition,{pass={value:0}}={}){this.definition=definition;this.nodes=new Map();this.geometries=new Map();this.programs=new Map();
  for(const [id,g]of Object.entries(definition.geometry)){let geometry;if(g.type==='shape'){const shape=new T.Shape();for(const [op,...args]of g.path){if(!['moveTo','lineTo','bezierCurveTo','quadraticCurveTo','closePath'].includes(op))throw Error('Unknown effect shape operation '+op);shape[op](...args);}geometry=new T.ShapeGeometry(shape,g.segments);}else{const Constructor=Object.hasOwn(geometryTypes,g.type)?geometryTypes[g.type]:null;if(!Constructor)throw Error('Unknown effect geometry '+g.type);geometry=new Constructor(...g.args);}this.geometries.set(id,geometry);}
  const make=d=>{if(this.nodes.has(d.id))throw Error('Duplicate effect node '+d.id);let node;if(d.geometry){const geometry=this.geometries.get(d.geometry);if(!geometry)throw Error('Unknown effect geometry '+d.geometry);const material=createEffectMaterial(d.color??definition.color,pass);material.uniforms.alpha.value=d.alpha??1;node=new T.Mesh(geometry,material);}else node=new T.Group();this.nodes.set(d.id,node);if(d.position)node.position.fromArray(d.position);if(d.rotation)node.rotation.fromArray(d.rotation);if(d.scale)node.scale.fromArray(d.scale);if(d.visible!==undefined)node.visible=d.visible;for(const child of d.children??[])node.add(make(child));return node;};
  this.root=make(definition.root);
  for(const [name,p]of Object.entries(definition.programs)){const root=this.nodes.get(p.root),layers=p.targets.map(id=>{const mesh=this.nodes.get(id);if(!mesh)throw Error('Unknown effect program target '+id);return{id,mesh,center:mesh.position.clone()};});if(!root)throw Error('Unknown effect program root '+p.root);this.programs.set(name,{root,layers,animation:p.animation});}
  this.recolor(definition.color);
 }
 get(id){const node=this.nodes.get(id);if(!node)throw Error('Unknown effect node '+id);return node;}
 recolor(hex){const base=new T.Color(hex),white=new T.Color('#ffffff');for(const [id,amount]of Object.entries(this.definition.whiteness))this.get(id).material.uniforms.color.value.copy(base).lerp(white,amount);}
 sample(name,context){const p=this.programs.get(name);if(!p)throw Error('Unknown effect program '+name);animateVectorLayers(p.animation,p.root,p.layers,context);}
 dispose(){for(const geometry of this.geometries.values())geometry.dispose();for(const node of this.nodes.values())node.material?.dispose();this.root.removeFromParent();this.nodes.clear();this.geometries.clear();this.programs.clear();}
}
