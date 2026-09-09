// Prepared tessellations are derived caches, not authored artwork. Portable
// projects rebuild them from their embedded SVGs with the same worker kernels.
export function omitDerivedVectors(project){
 const scene=project.scene3d,rendering=scene?.rendering,libraries=Object.values(rendering?.vectorLibraries??{});if(!libraries.length)return project;
 const prefixes=libraries.map(l=>l.base),manifests=new Set(libraries.map(l=>l.manifest)),derived=new Set(Object.entries(rendering.resources??{}).filter(([url])=>manifests.has(url)||prefixes.some(prefix=>url.startsWith(prefix))).map(([,id])=>id));
 scene.resources=(scene.resources??[]).filter(r=>!derived.has(r.id));rendering.resources=Object.fromEntries(Object.entries(rendering.resources??{}).filter(([,id])=>!derived.has(id)));rendering.vectorLibraries={};return project;
}
