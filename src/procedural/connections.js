import {drawBodyJoinSeam} from '../puppet-studio/body-join-seams.js';
import {outlinePaletteForImage} from '../puppet-studio/body-join-profiles.js';
import {drawProceduralSurface} from './surfaces.js';
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
/** A local seam repair between existing art and a generated fill. Both retain
 * their own outside contour and drawing layer; only this pair opts in. */
export function surfaceConnectionLayers(project,images,pose,drawPiece){
 const layers=[];for(const c of project.procedural?.connections??[]){
  if(c.enabled===false)continue;
  const piece=project.joints.find(j=>j.id===c.joint),surface=pose.procedural?.surfaces.find(s=>s.id===c.surface),anchor=pose.procedural?.points.get(c.particle),image=images.get(piece?.sprite?.asset);
  if(!piece||piece.hidden||!surface||!anchor||!image)continue;
  const inkColors=[...outlinePaletteForImage(image),...(surface.stroke!=='none'?[rgb(surface.stroke)]:[])];
  const frame={anchor,dx:0,dy:0,radius:c.radius/.45,profile:{halfWidth:c.radius,inkColors,matches:[]}},art=ctx=>drawPiece(ctx,piece),fill=ctx=>drawProceduralSurface(ctx,surface),draws=piece.layer>=surface.layer?[fill,art]:[art,fill];
  layers.push({layer:Math.max(piece.layer,surface.layer)+.002,draw:ctx=>drawBodyJoinSeam(ctx,frame,[1,0,0,1,0,0],...draws)});
 }
 return layers;
}
