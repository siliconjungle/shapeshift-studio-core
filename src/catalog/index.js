import data from './features.json' with {type:'json'};
const copy=value=>structuredClone(value);
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const featureCatalog=freeze(data);
export function queryCatalog({query='',id,category,scope}={}){
 if(typeof query!=='string'||query.length>500)throw Error('Catalog query must be a string of at most 500 characters');
 if(scope!==undefined&&!['core','web'].includes(scope))throw Error('Catalog scope must be core or web');
 if(id!==undefined){const feature=data.features.find(f=>f.id===id);if(!feature)throw Error('Unknown feature: '+id);return copy({...feature,recipes:data.recipes.filter(r=>r.feature===id)});}
 const terms=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
 const features=data.features.filter(f=>(!category||f.category===category)&&(!scope||f.scope.includes(scope))&&terms.every(t=>JSON.stringify(f).toLowerCase().includes(t)));
 return copy({version:data.version,total:features.length,categories:[...new Set(data.features.map(f=>f.category))],features});
}
export function commandInfo(op){const command=data.commands.find(c=>c.op===op);if(!command)throw Error('Unknown command: '+op);return copy({...command,recipes:data.recipes.filter(r=>r.requests.some(req=>req.op==='document.dispatch'&&[req.args.commands].flat().some(c=>c.op===op)))});}
function validate(value,schema,path){
 const type=schema.type;
 if(type==='object'){
  if(!value||Array.isArray(value)||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw Error(path+' must be an object');
  for(const key of Object.keys(value))if(['__proto__','constructor','prototype'].includes(key)||!Object.hasOwn(schema.properties??{},key))throw Error(path+': unknown input '+key);
  for(const key of schema.required??[])if(!Object.hasOwn(value,key))throw Error(path+'.'+key+' is required');
  for(const [key,v]of Object.entries(value))validate(v,schema.properties[key],path+'.'+key);
 }else if(type==='array'){
  if(!Array.isArray(value))throw Error(path+' must be an array');value.forEach((v,i)=>validate(v,schema.items,path+'['+i+']'));
 }else if(type==='number'||type==='integer'){
  if(!Number.isFinite(value)||type==='integer'&&!Number.isInteger(value))throw Error(path+' must be a finite '+type);
 }else if(typeof value!==type)throw Error(path+' must be a '+type);
 if(schema.enum&&!schema.enum.includes(value))throw Error(path+' must be one of '+schema.enum.join(', '));
 if(schema.minimum!==undefined&&value<schema.minimum||schema.maximum!==undefined&&value>schema.maximum)throw Error(path+' is out of range');
 if(schema.minLength!==undefined&&value.length<schema.minLength||schema.maxLength!==undefined&&value.length>schema.maxLength)throw Error(path+' has invalid length');
 if(schema.pattern&&!new RegExp(schema.pattern).test(value))throw Error(path+' has invalid format');
}
export function expandRecipe(id,inputs={}){
 const recipe=data.recipes.find(r=>r.id===id);if(!recipe)throw Error('Unknown recipe: '+id);
 validate(inputs,recipe.inputSchema,'inputs');
 const values={};for(const [key,schema]of Object.entries(recipe.inputSchema.properties))if(Object.hasOwn(inputs,key))values[key]=copy(inputs[key]);else if(Object.hasOwn(schema,'default'))values[key]=copy(schema.default);
 validate(values,recipe.inputSchema,'inputs');
 const expand=value=>{if(Array.isArray(value))return value.map(expand);if(value&&typeof value==='object'){if(Object.keys(value).length===1&&Object.hasOwn(value,'$input')){if(!Object.hasOwn(values,value.$input))throw Error('Missing recipe input '+value.$input);return copy(values[value.$input]);}return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,expand(v)]));}return value;};
 return {id:recipe.id,feature:recipe.feature,title:recipe.title,requirements:copy(recipe.requirements),notes:copy(recipe.notes),inputs:values,requests:expand(recipe.requests)};
}
export function catalogueMarkdown(){
 const lines=['# Shapeshift Studio feature catalogue','','Generated from Studio Core `src/catalog/features.json`. Edit that source and regenerate; the editor, CLI and API read the same catalogue.','','## Start here','','- In the editor, choose **Features**. Search by task, tool, command or Core import.','- Offline: `npm run studio -- catalog`, `npm run studio -- catalog --query liquid`, or `npm run studio -- catalog liquid`.','- Recipe inputs: `npm run studio -- recipe add-liquid --json \'{"joint":"body","fill":0.7}\'`. This prints requests; it does not execute them.','- Live API: `catalog.search`, `catalog.feature`, `catalog.recipe` and `catalog.command`.','- Core: import `{queryCatalog, expandRecipe}` from `@shapeshift-labs/studio-core/catalog`.','','A recipe’s JSON Schema describes its inputs. The advanced command index lists every advertised authoring command; it is not a full schema for every project payload. Read the project for IDs, check recipe requirements, and dispatch requests explicitly. The runtime still validates project-dependent constraints.','','## Contents','',...data.features.map(f=>`- [${f.title}](#${f.id}) — ${f.description}`)];
 for(const f of data.features){lines.push('',`<a id="${f.id}"></a>`,`## ${f.title}`,'',f.description,'',`Category: ${f.category}. Available in: ${f.scope.join(', ')}.`,'','Requirements:',...f.requirements.map(t=>'- '+t));if(f.limitations.length)lines.push('','Limits:',...f.limitations.map(t=>'- '+t));lines.push('',`[Documentation](${f.documentation})`);if(f.panel)lines.push('',`Editor tool: **${f.panel}**.`);if(f.coreExports.length)lines.push('','Core imports:',...f.coreExports.map(p=>'- `@shapeshift-labs/studio-core'+p.slice(1)+'`'));if(f.commands.length)lines.push('','Commands: '+f.commands.map(c=>'`'+c+'`').join(', ')+'.');for(const ex of f.examples)lines.push('',`${ex.title}: \\${ex.url}`.replace('\\','/'));for(const ex of f.codeExamples??[])lines.push('',ex.title,'','```'+ex.language,ex.code,'```');
  for(const r of data.recipes.filter(r=>r.feature===f.id))lines.push('',`### ${r.title}`,'',...r.requirements.map(t=>'- '+t),...r.notes.map(t=>'- '+t),'',`CLI: \`npm run studio -- recipe ${r.id}\``,'','Input schema:','','```json',JSON.stringify(r.inputSchema,null,2),'```','','Requests with default inputs:','','```json',JSON.stringify(expandRecipe(r.id).requests,null,2),'```');
 }
 return lines.join('\n')+'\n';
}
