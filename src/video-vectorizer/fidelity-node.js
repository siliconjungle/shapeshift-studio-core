import sharp from 'sharp';

// Compare geometry changes against the actual source, using the same rasterizer
// for reference and candidate. A lower flicker score cannot excuse lost detail.
export async function approveTrackedFrame({source,referenceSVG,candidateSVG}){
 const [reference,candidate]=await Promise.all([referenceSVG,candidateSVG].map(svg=>sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer()));
 const measures=data=>{
  let error=0,lightLeaks=0,darkSpill=0;
  for(let p=0;p<data.length;p+=4){
   const a=source.data[p+3]/255,b=data[p+3]/255;
   for(let c=0;c<3;c++)error+=Math.abs(source.data[p+c]*a-data[p+c]*b);
   const sourceMean=(source.data[p]+source.data[p+1]+source.data[p+2])/3,mean=(data[p]+data[p+1]+data[p+2])/3;
   if(a>.5&&sourceMean<90&&Math.min(data[p],data[p+1],data[p+2])>180)lightLeaks++;
   if(Math.min(source.data[p],source.data[p+1],source.data[p+2])>200&&mean<90&&b>.5)darkSpill++;
  }
  return {meanError:error/(source.width*source.height*3),lightLeaks,darkSpill};
 };
 const a=measures(reference),b=measures(candidate);
 return {accepted:b.meanError<=a.meanError+.025&&b.lightLeaks<=a.lightLeaks+20&&b.darkSpill<=a.darkSpill+20,reference:a,candidate:b};
}
