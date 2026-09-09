// Rig mirroring stays separate from positive animated scale, so a flip applies
// to every clip without collapsing through zero between animation keys.
export function mirroredScale(node,scale=node.scale){return scale.map((v,i)=>v*(node.mirror?.[i]?-1:1));}
