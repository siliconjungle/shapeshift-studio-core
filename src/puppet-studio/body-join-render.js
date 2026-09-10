import {deformBodyPoint} from './body-joins.js';

// A single reusable textured mesh, shared by the editor, Canvas exports and
// puppet instances in 3D scenes. Unjoined sprites take the original draw path.
let renderer,frame=0;
function createRenderer(){
 const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:true,preserveDrawingBuffer:true});
 if(!gl)throw Error('Body joins require WebGL 2.');
 const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
 const program=gl.createProgram(),vs=shader(gl.VERTEX_SHADER,`#version 300 es
 in vec2 position;in vec2 texcoord;out vec2 uv;uniform vec4 bounds;
 void main(){uv=texcoord;vec2 p=(position-bounds.xy)/bounds.zw;gl_Position=vec4(p.x*2.-1.,1.-p.y*2.,0.,1.);}`),fs=shader(gl.FRAGMENT_SHADER,`#version 300 es
 precision highp float;in vec2 uv;uniform sampler2D art;out vec4 colour;void main(){colour=texture(art,uv);}`);
 gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.deleteShader(vs);gl.deleteShader(fs);gl.useProgram(program);
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
 for(const [name,offset]of [['position',0],['texcoord',8]]){const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,16,offset);}
 const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
 return {canvas,gl,buffer,bounds:gl.getUniformLocation(program,'bounds')};
}
export function joinedArtwork(source,sprite,joins,scale=1){
 renderer??=createRenderer();const {canvas,gl,buffer,bounds}=renderer;
 const {width:w,height:h,pivotX,pivotY}=sprite,x=-pivotX*w,y=-pivotY*h;
 const smallest=Math.min(...joins.map(j=>j.radius)),nx=Math.min(96,Math.max(16,Math.ceil(w/Math.max(2,smallest/10)))),ny=Math.min(96,Math.max(16,Math.ceil(h/Math.max(2,smallest/10)))),points=[];
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(let row=0;row<=ny;row++)for(let col=0;col<=nx;col++){const p=deformBodyPoint(x+col/nx*w,y+row/ny*h,joins);points.push([p.x,p.y,col/nx,row/ny]);minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);}
 const vertices=new Float32Array(nx*ny*6*4);let cursor=0;
 for(let row=0;row<ny;row++)for(let col=0;col<nx;col++){const a=row*(nx+1)+col,b=a+1,c=a+nx+1,d=c+1;for(const i of [a,b,c,b,d,c]){vertices.set(points[i],cursor);cursor+=4;}}
 minX-=1;minY-=1;maxX+=1;maxY+=1;const width=maxX-minX,height=maxY-minY,res=Math.min(scale,2048/Math.max(width,height));
 const cw=Math.max(1,Math.ceil(width*res)),ch=Math.max(1,Math.ceil(height*res));if(canvas.width!==cw)canvas.width=cw;if(canvas.height!==ch)canvas.height=ch;
 gl.viewport(0,0,cw,ch);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.uniform4f(bounds,minX,minY,width,height);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.DYNAMIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,vertices.length/4);
 canvas.vectorFrame=++frame;
 return {canvas,sprite:{...sprite,width,height,pivotX:-minX/width,pivotY:-minY/height}};
}
export function drawJoinedArtwork(ctx,source,sprite,joins,scale=1){
 if(joins?.length){const warped=joinedArtwork(source,sprite,joins,scale);source=warped.canvas;sprite=warped.sprite;}
 ctx.drawImage(source,-sprite.pivotX*sprite.width,-sprite.pivotY*sprite.height,sprite.width,sprite.height);
}
