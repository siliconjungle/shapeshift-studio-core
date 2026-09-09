import * as T from 'three';

// Keep the previous matched floor set visible while the next one is uploaded.
// Allocate once, transfer small strips between frames, and build mipmaps only
// after the final strip. The complete bitmap remains available for context loss.
export async function uploadTextureGradually(renderer,texture,cancelled=()=>false){
 const image=texture.image,height=image.height,width=image.width;
 if(width<=1024){renderer.initTexture(texture);return;}
 texture.source.dataReady=false;
 renderer.initTexture(texture);
 texture.generateMipmaps=false;
 const position=new T.Vector2();let batchStart=performance.now();
 try{
  for(let y=0;y<height;y+=128){
   if(cancelled())return;
   if(performance.now()-batchStart>4){await new Promise(resolve=>requestAnimationFrame(resolve));batchStart=performance.now();}
   const rows=Math.min(128,height-y),strip=await createImageBitmap(image,0,y,width,rows,{imageOrientation:'none',premultiplyAlpha:'none',colorSpaceConversion:'none'}),source=new T.Texture(strip);
   try{texture.generateMipmaps=y+rows===height;position.set(0,y);renderer.copyTextureToTexture(source,texture,null,position);}finally{strip.close();source.dispose();}
  }
 }finally{texture.generateMipmaps=true;texture.source.dataReady=true;}
}
