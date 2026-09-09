import * as T from 'three';
export function vectorBucket(zoom,pixelRatio,{minimum=-2,maximum=3}={}){return Math.max(minimum,Math.min(maximum,Math.floor(Math.log2(zoom*pixelRatio))));}
export class VectorLODLibrary{
 constructor({manifest,base,names,cacheSize=2},fetcher=fetch){if(!Array.isArray(names)||!names.length||names.length>32||!Number.isInteger(cacheSize)||cacheSize<1||cacheSize>32)throw Error('Invalid vector detail library');this.url=manifest;this.base=base;this.names=names;this.cacheSize=cacheSize;this.fetch=url=>fetcher(url);this.manifest=null;this.cache=new Map();}
 async load(bucket){
  this.manifest??=this.fetch(this.url).then(r=>{if(!r.ok)throw Error('Missing vector detail assets');return r.json();});
  if(this.cache.has(bucket))return this.cache.get(bucket);
  const promise=this.manifest.then(async m=>Promise.all(this.names.map(async name=>{const response=await this.fetch(this.base+m.buckets[bucket][name]);if(!response.ok)throw Error('Missing '+name+' vector detail');return response.arrayBuffer();})));
  this.cache.set(bucket,promise);while(this.cache.size>this.cacheSize)this.cache.delete(this.cache.keys().next().value);
  try{return await promise;}catch(error){this.cache.delete(bucket);throw error;}
 }
}
export function geometryFromLOD(buffer){
 const length=new DataView(buffer).getUint32(0,true),header=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,4,length))),start=(4+length+3)&~3,geometry=new T.BufferGeometry();
 for(const a of header){const data=new (a.name==='index'?Uint32Array:Float32Array)(buffer,start+a.offset,a.length),attribute=new T.BufferAttribute(data,a.size);if(a.name==='index')geometry.setIndex(attribute);else geometry.setAttribute(a.name,attribute);}
 geometry.computeBoundingSphere();return geometry;
}
