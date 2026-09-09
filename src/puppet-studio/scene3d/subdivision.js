import * as T from 'three';

// Keep the SVG paint order and every attribute at each triangle corner, but
// share subdivision vertices. Double precision intermediates match the former
// expanded builder; Float32 rounding happens only at the final buffer boundary.
export function subdivideIndexed(geometry,maxEdge=.06){
 const keys=Object.keys(geometry.attributes),arrays=keys.map(k=>Array.from(geometry.attributes[k].array)),sizes=keys.map(k=>geometry.attributes[k].itemSize);
 const positions=arrays[keys.indexOf('position')],indices=[],midpoints=new Map(),limit=maxEdge*maxEdge;
 function midpoint(a,b){
  const key=a<b?a+','+b:b+','+a;let id=midpoints.get(key);if(id!==undefined)return id;
  id=positions.length/3;
  for(let k=0;k<keys.length;k++){const values=arrays[k],size=sizes[k];for(let i=0;i<size;i++)values.push((values[a*size+i]+values[b*size+i])*.5);}
  midpoints.set(key,id);return id;
 }
 function distanceSquared(a,b){a*=3;b*=3;const x=positions[a]-positions[b],y=positions[a+1]-positions[b+1],z=positions[a+2]-positions[b+2];return x*x+y*y+z*z;}
 function triangle(a,b,c,depth){
  if(depth<7&&Math.max(distanceSquared(a,b),distanceSquared(b,c),distanceSquared(c,a))>limit){
   const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);
   triangle(a,ab,ca,depth+1);triangle(ab,b,bc,depth+1);triangle(ca,bc,c,depth+1);triangle(ab,bc,ca,depth+1);
  }else indices.push(a,b,c);
 }
 const source=geometry.index.array;for(let i=0;i<source.length;i+=3)triangle(source[i],source[i+1],source[i+2],0);
 const result=new T.BufferGeometry();for(let k=0;k<keys.length;k++)result.setAttribute(keys[k],new T.Float32BufferAttribute(arrays[k],sizes[k]));result.setIndex(indices);result.computeBoundingSphere();geometry.dispose();return result;
}
