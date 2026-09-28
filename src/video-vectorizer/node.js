// Optional Node adapter. The browser-safe core never imports child_process.
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {stat} from 'node:fs/promises';
import path from 'node:path';
import {vectorizeVideo} from './convert.js';
export {auditVectorVideo,pixelErrors} from './quality-node.js';
const execute=promisify(execFile);
function stopped(signal){if(signal?.aborted){const e=new Error('Video conversion aborted');e.name='AbortError';throw e;}}
export async function probeVideo(file,{ffprobe='ffprobe',signal}={}) {
  stopped(signal);const input=path.resolve(file),info=await stat(input);
  if(!info.isFile())throw Error('Video input must be a local regular file');
  const {stdout}=await execute(ffprobe,['-v','error','-select_streams','v:0','-show_entries','stream=width,height,avg_frame_rate,duration,color_space,color_range:stream_side_data=rotation:format=duration','-of','json',input],{signal,maxBuffer:1024*1024});
  const data=JSON.parse(stdout),stream=data.streams?.[0];
  if(!stream?.width||!stream?.height)throw Error('Input has no video stream');
  const rotation=stream.side_data_list?.find(s=>s.rotation!==undefined)?.rotation??0;
  const swap=Math.abs(rotation)%180===90;
  const [a,b]=String(stream.avg_frame_rate).split('/').map(Number),rate=a/b;
  return {width:swap?stream.height:stream.width,height:swap?stream.width:stream.height,frameRate:Number.isFinite(rate)&&rate>0?rate:24,duration:Number(stream.duration??data.format?.duration)||null,colorSpace:stream.color_space??null,colorRange:stream.color_range??null};
}
export async function* decodeVideoFrames(file,options={}) {
  const metadata=options.metadata??await probeVideo(file,options),limit=options.maxDimension??512,rate=options.frameRate??Math.min(60,metadata.frameRate);
  if(!Number.isInteger(limit)||limit<8||limit>4096)throw Error('maxDimension must be an integer from 8 to 4096');
  if(!Number.isFinite(rate)||rate<=0||rate>240)throw Error('Invalid decode frame rate');
  const scale=Math.min(1,limit/Math.max(metadata.width,metadata.height)),width=Math.max(1,Math.round(metadata.width*scale)),height=Math.max(1,Math.round(metadata.height*scale));
  stopped(options.signal);
  // Match browser YUV decoding: an untagged clip uses Rec.709, with bilinear
  // chroma reconstruction and accurate rounding. Resize only after RGB decode.
  const matrix=options.colorMatrix??({bt470bg:'bt601',smpte170m:'bt601',bt2020nc:'bt2020'}[metadata.colorSpace]??metadata.colorSpace??'bt709');
  if(!['bt709','bt601','bt2020','smpte240m','fcc','auto'].includes(matrix))throw Error('Unsupported video colour matrix '+matrix);
  const filter='scale=in_color_matrix='+matrix+':flags=bilinear+accurate_rnd+full_chroma_int,format=rgba,scale='+width+':'+height+':flags=lanczos,fps='+rate;
  const child=spawn(options.ffmpeg??'ffmpeg',['-v','error','-i',path.resolve(file),'-map','0:v:0','-vf',filter,'-f','rawvideo','-pix_fmt','rgba','pipe:1'],{stdio:['ignore','pipe','pipe']});
  let stderr='',closed=false;
  child.stderr.on('data',b=>{stderr=(stderr+b.toString()).slice(-8192)});
  const completion=new Promise((resolve,reject)=>{
    child.on('error',reject);child.on('close',code=>{closed=true;code===0?resolve():reject(Error('Video decoder failed: '+stderr.trim()))});
  });completion.catch(()=>{});
  const cancel=()=>child.kill();options.signal?.addEventListener('abort',cancel,{once:true});
  let frame=new Uint8Array(width*height*4),offset=0,index=0;
  try {
    for await(const chunk of child.stdout){
      stopped(options.signal);
      let cursor=0;
      while(cursor<chunk.length){
        const length=Math.min(frame.length-offset,chunk.length-cursor);frame.set(chunk.subarray(cursor,cursor+length),offset);cursor+=length;offset+=length;
        if(offset===frame.length){yield {width,height,data:frame,timestamp:index++/rate};frame=new Uint8Array(frame.length);offset=0;}
      }
    }
    stopped(options.signal);await completion;
    if(offset)throw Error('Video decoder returned an incomplete frame');
  } finally {
    options.signal?.removeEventListener('abort',cancel);
    if(!closed)child.kill();await completion.catch(()=>{});
  }
}
export async function convertVideoFile(file,options={}) {
  const metadata=await probeVideo(file,options),frameRate=options.frameRate??Math.min(60,metadata.frameRate);
  const frames=decodeVideoFrames(file,{maxDimension:1024,...options,metadata,frameRate});
  const converter=options.backend==='regions'?vectorizeVideo:(await import('./reference-node.js')).vectorizeReferenceFrames;
  const clip=await converter(frames,{...options,frameRate,outputWidth:metadata.width,outputHeight:metadata.height});
  clip.source={width:metadata.width,height:metadata.height,duration:metadata.duration,frameRate:metadata.frameRate,colorSpace:metadata.colorSpace??'bt709',colorRange:metadata.colorRange};
  return clip;
}
