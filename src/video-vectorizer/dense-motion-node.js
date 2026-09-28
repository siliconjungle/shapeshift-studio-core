// Optional Node motion backend. Uses the packaged OpenCV.js distribution; no
// Python service, browser global or downloaded runtime is required at conversion.
let runtime;
async function openCV(){
 runtime??=(async()=>{
  const {default:module}=await import('@techstark/opencv-js');
  if(module instanceof Promise)return {cv:await module};
  if(module.Mat)return {cv:module};
  await new Promise(resolve=>{module.onRuntimeInitialized=resolve});return {cv:module};
 })();
 return runtime;
}
export async function estimateDenseMotion(previous,current){
 if(previous.width!==current.width||previous.height!==current.height)throw Error('Motion frame dimensions must match');
 const {cv}=await openCV(),{width,height}=current,owned=[];
 const own=value=>{owned.push(value);return value};
 try{
  const a=own(cv.matFromArray(height,width,cv.CV_8UC4,current.data)),b=own(cv.matFromArray(height,width,cv.CV_8UC4,previous.data));
  const grayA=own(new cv.Mat()),grayB=own(new cv.Mat()),flow=own(new cv.Mat()),smooth=own(new cv.Mat());
  cv.cvtColor(a,grayA,cv.COLOR_RGBA2GRAY);cv.cvtColor(b,grayB,cv.COLOR_RGBA2GRAY);
  cv.calcOpticalFlowFarneback(grayA,grayB,flow,.5,3,15,3,5,1.2,0);
  cv.GaussianBlur(flow,smooth,new cv.Size(5,5),1.2,1.2,cv.BORDER_REPLICATE);
  const step=4,columns=Math.ceil(width/step)+1,rows=Math.ceil(height/step)+1,dx=new Float32Array(columns*rows),dy=new Float32Array(dx.length);
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
   const x=Math.min(width-1,col*step),y=Math.min(height-1,row*step),p=(y*width+x)*2,i=row*columns+col;
   dx[i]=smooth.data32F[p];dy[i]=smooth.data32F[p+1];
  }
  return {width,height,step,columns,rows,dx,dy,method:'opencv-farneback'};
 }finally{for(const value of owned.reverse())value.delete()}
}

/** Remove low-amplitude compression grain without averaging across ink edges. */
export async function denoiseFrame(frame,{sigmaColor=12}={}){
 const {cv}=await openCV(),owned=[],own=v=>{owned.push(v);return v};
 try{
  const rgba=own(cv.matFromArray(frame.height,frame.width,cv.CV_8UC4,frame.data)),rgb=own(new cv.Mat()),filtered=own(new cv.Mat());
  cv.cvtColor(rgba,rgb,cv.COLOR_RGBA2RGB);cv.bilateralFilter(rgb,filtered,5,sigmaColor,2,cv.BORDER_REPLICATE);
  const data=new Uint8Array(frame.data.length);
  for(let p=0,q=0;p<data.length;p+=4,q+=3){data[p]=filtered.data[q];data[p+1]=filtered.data[q+1];data[p+2]=filtered.data[q+2];data[p+3]=frame.data[p+3];}
  return {...frame,data};
 }finally{for(const mat of owned.reverse())mat.delete()}
}
