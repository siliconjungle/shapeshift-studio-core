// Shared implementation of the existing Little Gods image converter. Keep its
// stacked VTracer splines: video tracking must not replace this curve fitter.
import sharp from 'sharp';
import {vectorize, ColorMode, Hierarchical, PathSimplifyMode} from '@neplex/vectorizer';

export const presets = {
  fidelity: {colors:64, speckle:1, precision:8, difference:0, corner:80, length:1.5},
  cel: {colors:16, speckle:4, precision:6, difference:14, corner:80, length:4.5, median:3},
  inkwell: {colors:40, speckle:3, precision:6, difference:8, corner:70, length:3.5},
  detail: {colors:80, speckle:2, precision:7, difference:4, corner:60, length:2.5},
  simple: {colors:20, speckle:5, precision:6, difference:12, corner:80, length:4.5},
};

export async function convert(input, options={}) {
  const preset=options.preset??'inkwell';
  if(!presets[preset])throw Error(`Unknown preset: ${preset}`);
  const config={...presets[preset]};
  for(const [key,min,max]of [['speckle',0,32],['length',.5,10],['difference',0,255]])if(options.traceSettings?.[key]!==undefined){
    const value=options.traceSettings[key];if(!Number.isFinite(value)||value<min||value>max)throw Error('Invalid trace setting '+key);config[key]=value;
  }
  if(options.preserveDarkColors)config.preserveDarkColors=true;
  if(options.colors!==undefined)config.colors=options.colors;
  if(!Number.isInteger(config.colors)||config.colors<4||config.colors>256)throw Error('colors must be an integer between 4 and 256');
  const threshold=options.alphaThreshold??128;
  if(!Number.isInteger(threshold)||threshold<1||threshold>255)throw Error('alphaThreshold must be between 1 and 255');
  const {data:original,info}=await sharp(input,{limitInputPixels:16_000_000}).rotate().toColourspace('srgb').ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const {width,height}=info,data=Buffer.from(original);
  let solid=0,partial=0;
  for(let i=0;i<data.length;i+=4){
    if(data[i+3]>0&&data[i+3]<255)partial++;
    if(data[i+3]<threshold)data.fill(0,i,i+4);
    else {data[i+3]=255;solid++;}
  }
  const warnings=[];
  if(partial/(width*height)>.05)warnings.push('Contains substantial soft transparency; this silhouette preset makes it opaque or transparent.');
  if(!solid)throw Error('No visible artwork remains at this alpha threshold');
  // An explicit transparent border makes colour-key discovery reliable, even for
  // opaque source images. The viewBox removes this padding without moving anchors.
  let colourData=data;
  if(config.median){
    colourData=await sharp(data,{raw:{width,height,channels:4}}).median(config.median).raw().toBuffer();
    for(let i=0;i<colourData.length;i+=4){
      colourData[i+3]=data[i+3];
      if(!data[i+3])colourData.fill(0,i,i+4);
      else if(!config.preserveDarkColors&&Math.max(colourData[i],colourData[i+1],colourData[i+2])<55){colourData[i]=22;colourData[i+1]=28;colourData[i+2]=23}
    }
  }
  const prepared=await sharp(colourData,{raw:{width,height,channels:4}})
    .extend({top:2,bottom:2,left:2,right:2,background:{r:0,g:0,b:0,alpha:0}})
    .png({palette:true,colours:config.colors,dither:0,effort:10}).toBuffer();
  let svg=await vectorize(prepared,{
    colorMode:ColorMode.Color,hierarchical:Hierarchical.Stacked,mode:PathSimplifyMode.Spline,
    colorPrecision:config.precision,filterSpeckle:config.speckle,layerDifference:config.difference,
    cornerThreshold:config.corner,lengthThreshold:config.length,maxIterations:10,spliceThreshold:45,pathPrecision:2,
  });
  svg=svg.replace(/<svg\b[^>]*>/,`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="2 2 ${width} ${height}" preserveAspectRatio="xMidYMid meet">`);
  if(preset==='cel'||preset==='fidelity'){
    // VTracer averages hierarchical clusters, which can introduce new colours.
    // Snap the final fills back to the quantized palette, not just the input PNG.
    const raw=await sharp(prepared).ensureAlpha().raw().toBuffer(),unique=new Map();
    for(let i=0;i<raw.length;i+=4)if(raw[i+3]>127){const rgb=[raw[i],raw[i+1],raw[i+2]];unique.set(rgb.join(','),rgb)}
    const palette=[...unique.values()];
    svg=svg.replace(/fill="(#[a-fA-F0-9]{6})"/g,(_,hex)=>{
      const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));let best=palette[0],distance=Infinity;
      for(const color of palette){const d=(rgb[0]-color[0])**2*.3+(rgb[1]-color[1])**2*.59+(rgb[2]-color[2])**2*.11;if(d<distance){distance=d;best=color}}
      return 'fill="#'+best.map(n=>n.toString(16).padStart(2,'0')).join('')+'"';
    });
  }
  if(/<image\b|data:image|<foreignObject\b/i.test(svg))throw Error('Output is not pure vector artwork');
  const {data:rendered}=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let intersection=0,union=0,totalError=0;
  for(let i=0;i<data.length;i+=4){
    const a=data[i+3]>127,b=rendered[i+3]>127;if(a&&b)intersection++;if(a||b)union++;
    // Compare premultiplied colours so invisible RGB never affects this metric.
    if(a||b)for(let c=0;c<3;c++)totalError+=Math.abs(original[i+c]*original[i+3]/255-rendered[i+c]*rendered[i+3]/255);
  }
  const silhouetteIoU=intersection/union,meanColorError=totalError/(Math.max(1,union)*3*255);
  const colours=new Set([...svg.matchAll(/fill="(#[a-fA-F0-9]+)"/g)].map(m=>m[1].toLowerCase())).size;
  const paths=(svg.match(/<path\b/g)||[]).length;
  const curves=[...svg.matchAll(/\bd="([^"]*)"/g)].reduce((sum,m)=>sum+(m[1].match(/[CcQq]/g)||[]).length,0);
  if(silhouetteIoU<.97)warnings.push('Silhouette changed noticeably; inspect small details or try the detail preset.');
  if(meanColorError>.08)warnings.push('Colour/detail difference is high; try the detail preset or more colours.');
  if(paths>1500)warnings.push('Dense vector result; the simple preset may produce a more practical asset.');
  return {svg,original:await sharp(original,{raw:{width,height,channels:4}}).png().toBuffer(),stats:{width,height,preset,settings:config,alphaThreshold:threshold,paths,colours,curves,bytes:Buffer.byteLength(svg),silhouetteIoU,meanColorError,warnings}};
}
