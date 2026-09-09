// Editor reference metadata. Stored component values remain plain JSON IDs.
export const REFERENCE_KINDS=['asset','rig','joint','clip','scene-node','entity','component','ability','effect','audio-library','library-source'];
export function validateReferenceSpec(spec){
 if(!spec||typeof spec!=='object'||Array.isArray(spec)||!REFERENCE_KINDS.includes(spec.kind))throw Error('Unknown reference kind');
 for(const key of Object.keys(spec))if(!['kind','dimension','category'].includes(key))throw Error('Unknown reference option '+key);
 if(spec.dimension!==undefined&&![2,3].includes(spec.dimension))throw Error('Reference dimension must be 2 or 3');
 if(['clip','audio-library'].includes(spec.kind)&&spec.dimension===undefined)throw Error('Clip and audio-library references need a dimension');
 if(spec.dimension!==undefined&&!['clip','audio-library','joint','scene-node','library-source'].includes(spec.kind))throw Error('This reference kind has no dimension');
 if(spec.kind==='joint'&&spec.dimension===3||spec.kind==='scene-node'&&spec.dimension===2)throw Error('Reference dimension does not match this kind');
 if(spec.category!==undefined&&(spec.kind!=='library-source'||typeof spec.category!=='string'))throw Error('Reference category requires a library source');
}
export function referenceCatalog(project,spec={}){
 const rows=[],add=(kind,items,dimension)=>{for(const item of items??[])rows.push({kind,id:item.id,name:item.name??item.title??item.id,...((dimension??item.dimension)?{dimension:dimension??item.dimension}:{}),...(item.category?{category:item.category}:{})})};
 add('asset',project.assets);add('rig',[{id:'$project',name:project.name+' · main rig'},...(project.puppetSources??[])]);add('joint',project.joints,2);add('clip',project.clips,2);add('clip',project.scene3d?.clips,3);add('scene-node',project.scene3d?.nodes,3);
 add('entity',project.entityDefinitions?.entities);add('component',project.entityDefinitions?.components);
 add('ability',project.abilities?.definitions?.filter(d=>d.type==='ability'));add('effect',project.abilities?.definitions?.filter(d=>d.type==='effect'));
 add('audio-library',Object.keys({...project.scene3d?.audioLibraries,...project.audioLibraries}).map(id=>({id,name:id})),2);add('audio-library',Object.keys(project.scene3d?.audioLibraries??{}).map(id=>({id,name:id})),3);
 add('library-source',project.library?.items);
 return rows.filter(r=>(!spec.kind||r.kind===spec.kind)&&(!spec.dimension||r.dimension===spec.dimension)&&(!spec.category||r.category===spec.category)).sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id)||((a.dimension??0)-(b.dimension??0)));
}
export const referenceKey=r=>JSON.stringify([r.kind,r.dimension??null,r.id]);
export function resolveReference(project,ref){return referenceCatalog(project,ref).find(r=>r.id===ref.id)??null}
export function componentReferences(library){
 const result=[],visit=(v,s,path,owner)=>{if(s.reference){if(typeof v==='string'&&v)result.push({...s.reference,id:v,path,owner});return}if(s.type==='object')for(const [key,child] of Object.entries(s.properties??{}))if(v&&Object.hasOwn(v,key))visit(v[key],child,[...path,key],owner);if(s.type==='array'&&Array.isArray(v))v.forEach((value,i)=>visit(value,s.items,[...path,i],owner))};
 for(const c of library?.components??[])visit(c.defaults,c.schema,[],{kind:'component',id:c.id});
 for(const e of library?.entities??[])for(const [id,value] of Object.entries(e.components)){const c=library.components.find(c=>c.id===id);if(c)visit(value,c.schema,[id],{kind:'entity',id:e.id})}
 return result;
}
export function referenceDependencies(library){const unique=new Map();for(const r of componentReferences(library)){const {owner,path,...ref}=r;unique.set(referenceKey(ref),ref)}return [...unique.values()]}
export function referenceIssues(project){return componentReferences(project.entityDefinitions).filter(r=>!resolveReference(project,r))}
export function assertProjectReferences(project){const issues=referenceIssues(project);if(issues.length)throw Error('Resolve missing references before exporting the complete project: '+issues.slice(0,5).map(r=>r.owner.id+'.'+r.path.join('.')+' → '+r.kind+' '+r.id).join('; '));}
