import sharp from 'sharp';
import {convert} from '../image-vectorizer/node.js';
import {silhouetteLabels} from './outline.js';
import {TRANSPARENT} from './palette.js';
import {parseTracedSVG,bezierPath} from './traced.js';
import {flattenSpline} from './curve-tracking.js';
/** Draw only the source-connected exterior over stacked paint. Inner artwork
 * and enclosed light details are untouched. Uses the same stacked spline fit. */
export async function sourceExterior(frame,{background,tolerance=60,scale=2}={}){
 if(!background)return '';
 if(!/^#[0-9a-f]{6}$/i.test(background)||!Number.isFinite(tolerance)||tolerance<0||tolerance>255||![1,2,3].includes(scale))throw Error('Invalid source exterior settings');
 // Transparent artwork already has an explicit exterior; never paint it opaque.
 for(let p=3;p<frame.data.length;p+=4)if(frame.data[p]<128)return '';
 const enlarged={width:frame.width*scale,height:frame.height*scale,data:await sharp(frame.data,{raw:{width:frame.width,height:frame.height,channels:4}}).resize(frame.width*scale,frame.height*scale,{kernel:'cubic'}).raw().toBuffer()};
 const labels=silhouetteLabels(enlarged,{background,backgroundTolerance:tolerance}),data=new Uint8Array(labels.length*4);
 let visible=0;
 for(let p=0;p<labels.length;p++){const alpha=labels[p]===TRANSPARENT?0:255;data.set([0,0,0,alpha],p*4);if(alpha)visible++;}
 if(!visible)return '<path fill="'+background+'" d="M0 0C0 0 '+frame.width+' 0 '+frame.width+' 0C'+frame.width+' 0 '+frame.width+' '+frame.height+' '+frame.width+' '+frame.height+'C'+frame.width+' '+frame.height+' 0 '+frame.height+' 0 '+frame.height+'C0 '+frame.height+' 0 0 0 0Z"/>';
 const png=await sharp(data,{raw:{width:enlarged.width,height:enlarged.height,channels:4}}).png().toBuffer();
 const result=await convert(png,{preset:'fidelity',colors:4,preserveDarkColors:true,traceSettings:{speckle:4,length:4.5}});
 const parsed=parseTracedSVG(result.svg);
 const width=enlarged.width,height=enlarged.height,corners=[[0,0],[width,0],[width,height],[0,height],[0,0]],outer=[corners[0]];
 for(let i=1;i<corners.length;i++)outer.push(corners[i-1],corners[i],corners[i]);
 const holes=parsed.paths.flatMap(p=>p.rings).map(r=>{const poly=flattenSpline(r);let area=0;for(let i=1;i<poly.length;i++)area+=poly[i-1][0]*poly[i][1]-poly[i][0]*poly[i-1][1];return area>0?[...r].reverse():r;});
 return '<path fill="'+background+'" d="'+bezierPath([outer,...holes],{scaleX:1/scale,scaleY:1/scale})+'"/>';
}
