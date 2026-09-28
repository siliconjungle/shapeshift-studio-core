// Renderer-independent piecewise-affine resizing. Source dimensions remain
// authored data: repeated resizes never accumulate deformation.
export function slicingDefaults(size){return {enabled:true,sourceSize:[...size],axes:size.map((_,i)=>size.length===3&&i!==1?{cuts:[],fixed:[false]}:{cuts:[.2,.8],fixed:[true,false,true]})};}
export function validateSlicing(value,dimension){
 if(value===undefined)return;
 const fail=message=>{throw Error('N-slicing: '+message);};
 if(!value||typeof value.enabled!=='boolean'||!Array.isArray(value.sourceSize)||value.sourceSize.length!==dimension||value.sourceSize.some(n=>!Number.isFinite(n)||n<=0||n>1e6))fail('invalid reference size');
 if(!Array.isArray(value.axes)||value.axes.length!==dimension)fail('invalid axes');
 for(const axis of value.axes){
  if(!axis||!Array.isArray(axis.cuts)||axis.cuts.length>32||!Array.isArray(axis.fixed)||axis.fixed.length!==axis.cuts.length+1||axis.fixed.some(v=>typeof v!=='boolean')||axis.fixed.every(Boolean))fail('each axis needs at least one stretch band and at most 32 cuts');
  let previous=0;for(const cut of axis.cuts){if(!Number.isFinite(cut)||cut<=previous||cut>=1)fail('cuts must be increasing percentages between 0 and 100');previous=cut;}
 }
}
export function slicingAxis(axis,sourceSize,targetSize){
 const cuts=[0,...(axis?.cuts??[]),1],fixed=axis?.fixed??[false];
 const fixedSize=cuts.slice(1).reduce((n,end,i)=>n+(fixed[i]?(end-cuts[i])*sourceSize:0),0),stretchSize=sourceSize-fixedSize;
 // Below the sum of protected bands, shrink them together and collapse stretch
 // bands. This remains continuous and never inverts geometry.
 const fixedScale=fixedSize?Math.min(1,targetSize/fixedSize):1,stretchScale=stretchSize?Math.max(0,targetSize-fixedSize)/stretchSize:0;
 let dest=0;return cuts.slice(1).map((end,i)=>{const from=cuts[i]*sourceSize,to=end*sourceSize,scale=fixed[i]?fixedScale:stretchScale,band={from,to,start:dest,end:dest+(to-from)*scale,scale,fixed:fixed[i]};dest=band.end;return band;});
}
export function sliceCoordinate(value,bands){const band=bands.find(b=>value<=b.to)??bands.at(-1);return band.start+(value-band.from)*band.scale;}
export function slicingMaps(value,target){return target.map((size,i)=>slicingAxis(value?.enabled?value.axes[i]:null,value?.enabled?value.sourceSize[i]:size,size));}
