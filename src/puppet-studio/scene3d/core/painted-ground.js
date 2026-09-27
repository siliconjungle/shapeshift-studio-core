import {uploadTextureGradually} from './texture-upload.js';
import * as T from 'three';

// One flat plane. Prepared sizes of the generated SVG artwork are decoded
// asynchronously; no live SVG repaint runs during camera interaction.
export async function loadPaintedGround(scene,{definition,inkMaterial,uniforms,resolve=url=>url}){
 if(!Array.isArray(definition.variants)||definition.variants.length!==3)throw Error('Painted ground requires three matched variants');
 const loader=new T.TextureLoader(),names=definition.variants;
 const [manifest,assets]=await Promise.all([fetch(resolve(definition.manifest)).then(r=>r.json()),Promise.all(names.map(async name=>{const [height,roughness]=await Promise.all([loader.loadAsync(resolve(definition.maps+name+'-height.png')),loader.loadAsync(resolve(definition.maps+name+'-roughness.png'))]);return {height,roughness};}))]);
 for(const a of assets)for(const t of [a.height,a.roughness]){t.wrapS=t.wrapT=T.RepeatWrapping;t.needsUpdate=true;}
 const textures=assets.map(()=>{const t=new T.Texture();t.colorSpace=T.SRGBColorSpace;t.anisotropy=definition.anisotropy;t.wrapS=t.wrapT=T.RepeatWrapping;return t;});const [texture]=textures;
 let currentSize=0,pendingSize=0,disposed=false,lastZoom=0,zoomChangedAt=0,wantedSize=definition.initialSize;
 async function rasterize(size,renderer){
  if(disposed||size===currentSize||pendingSize)return;pendingSize=size;const next=[];
  try{
   for(let i=0;i<names.length;i++){
    const response=await fetch(resolve(definition.paint+manifest[names[i]][size]));if(!response.ok)throw Error('Missing prepared ground texture');
    const bitmap=await createImageBitmap(await response.blob(),{imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:'none'});
    const t=new T.Texture(bitmap);t.colorSpace=T.SRGBColorSpace;t.anisotropy=definition.anisotropy;t.wrapS=t.wrapT=T.RepeatWrapping;t.needsUpdate=true;next.push(t);
    if(disposed||size!==wantedSize)return;
    if(renderer){await new Promise(resolve=>requestAnimationFrame(resolve));await uploadTextureGradually(renderer,t,()=>disposed||size!==wantedSize);}
   }
   if(disposed||size!==wantedSize)return;
   // Upload one texture per frame, then switch the matched set atomically.
   if(currentSize){for(const t of textures){t.image?.close?.();t.dispose();}textures.splice(0,3,...next);material.uniforms.map.value=next[0];material.uniforms.mapB.value=next[1];material.uniforms.mapC.value=next[2];}
   else{textures.forEach((t,i)=>{t.image=next[i].image;t.needsUpdate=true;});}
   next.length=0;currentSize=size;
  }finally{for(const t of next){t.image?.close?.();t.dispose();}pendingSize=0;}
 }
 await rasterize(definition.initialSize);
 const root=new T.Group();root.name='Generated ground';const material=inkMaterial({map:texture,heightMap:assets[0].height,roughnessMap:assets[0].roughness,environment:1});material.uniforms.bodyShape={value:new T.Vector3(1,0,0)};material.uniforms.bodyBend={value:new T.Vector2()};material.uniforms.surfaceFlash={value:0};material.uniforms.floorTint={value:new T.Vector3(1,1,1)};
 material.uniforms.floorVariants.value=1;for(const [i,suffix]of [[1,'B'],[2,'C']]){material.uniforms['map'+suffix].value=textures[i];material.uniforms['height'+suffix].value=assets[i].height;material.uniforms['roughness'+suffix].value=assets[i].roughness;}
 const mesh=new T.Mesh(new T.PlaneGeometry(definition.size,definition.size),material);mesh.name='Ground plane';mesh.rotation.x=-Math.PI/2;mesh.position.y=definition.y;root.add(mesh);scene.add(root);
 const originalStone=new T.Color(definition.originalStone),tint=material.uniforms.floorTint.value;
 function updatePalette(){const c=uniforms.palette.value[0];tint.set(Math.pow(c.r/originalStone.r,definition.tintExponent),Math.pow(c.g/originalStone.g,definition.tintExponent),Math.pow(c.b/originalStone.b,definition.tintExponent));}
 function updateQuality(camera,renderer){if(!root.visible)return;const zoom=camera.zoom*renderer.getPixelRatio(),now=performance.now();if(Math.abs(zoom-lastZoom)>definition.zoomTolerance){lastZoom=zoom;zoomChangedAt=now;}
 const wanted=renderer.domElement.height*camera.zoom*definition.tileSize/(camera.top-camera.bottom);wantedSize=wanted>definition.largeThreshold?definition.largeSize:wanted>definition.mediumThreshold?definition.mediumSize:definition.initialSize;
 if(!pendingSize&&wantedSize!==currentSize&&now-zoomChangedAt>definition.zoomIdleMs)rasterize(wantedSize,renderer).catch(console.error);
 }
 return {root,solid:[mesh],get texture(){return textures[0];},textures,assets,updatePalette,updateQuality,get textureSize(){return currentSize;},dispose(){disposed=true;textures.forEach(t=>{t.image?.close?.();t.dispose();});assets.forEach(a=>{a.height.dispose();a.roughness.dispose();});mesh.geometry.dispose();material.dispose();root.removeFromParent();}};
}
