import {compileExpression} from './expression.js';
const channels=new Set(['position.x','position.y','position.z','rotation.x','rotation.y','rotation.z','scale.x','scale.y','scale.z','alpha','time','flutter']);
const programs=new WeakMap(),layerInfo=new WeakMap();
function variableProgram(definition){return(definition??[]).map(([name,expression])=>[name,compileExpression(expression)]);}
function variables(program,context){for(const [name,sample]of program)context[name]=sample(context);return context;}
function trackProgram(definitions){return Object.entries(definitions??{}).map(([channel,expression])=>{if(!channels.has(channel))throw Error('Unknown vector animation channel '+channel);return{channel,path:channel.includes('.')?channel.split('.'):null,sample:compileExpression(expression)};});}
function tracks(mesh,program,context){for(const {channel,path,sample}of program){const value=sample(context);if(!Number.isFinite(value))throw Error('Non-finite vector animation channel '+channel);if(path)mesh[path[0]][path[1]]=value;else mesh.material.uniforms[channel].value=value;}}
function compile(definition){return{variables:variableProgram(definition.variables),visible:compileExpression(definition.visible),root:trackProgram(definition.root),layerVariables:variableProgram(definition.layerVariables),layers:(definition.layers??[]).map(rule=>({when:compileExpression(rule.when??true),variables:variableProgram(rule.variables),tracks:trackProgram(rule.tracks)}))};}
// Definitions are immutable authored snapshots. A store edit supplies a new
// definition; only poses and numeric inputs change during playback/scrubbing.
export function animateVectorLayers(definition,root,layers,input){
 let program=programs.get(definition);if(!program){program=compile(definition);programs.set(definition,program);}
 const context=variables(program.variables,{...input});root.visible=!!program.visible(context);if(!root.visible)return;
 tracks(root,program.root,context);
 for(let index=0;index<layers.length;index++){
  const layer=layers[index],{id,mesh,center}=layer;mesh.position.copy(center);mesh.rotation.set(0,0,0);mesh.scale.set(1,1,1);
  let info=layerInfo.get(layer);if(!info){info={sector:Number(id.match(/\d+$/)?.[0]??0),center:{x:center.x,y:center.y,z:center.z}};layerInfo.set(layer,info);}
  const local=variables(program.layerVariables,{...context,id,index,sector:info.sector,center:info.center});
  for(const rule of program.layers){if(!rule.when(local))continue;variables(rule.variables,local);tracks(mesh,rule.tracks,local);}
 }
}
