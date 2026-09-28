import {emptyProcedural,signedArea} from './model.js';
const length=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
/** Builders create ordinary editable data, never runtime creature special cases. */
export function addProceduralPrimitive(project,{id='rig',kind='rope',count=8,position=[-140,-100],spacing=30,radius=12,layer=5}={}){
 const p=project.procedural??=emptyProcedural();
 if(!['rope','spine','tentacle','soft','rigid','limb'].includes(kind))throw Error('Unknown procedural primitive');
 if(!Number.isInteger(count)||count<3||count>64)throw Error('Choose 3–64 points');
 if(p.particles.some(n=>n.id.startsWith(id+'-')))throw Error('Choose a unique rig name');
 const loop=kind==='soft'||kind==='rigid',ids=[];
 for(let i=0;i<count;i++){const a=i/count*Math.PI*2,at=loop?[position[0]+Math.cos(a)*spacing,position[1]+Math.sin(a)*spacing]:[position[0]+i*spacing,position[1]+(kind==='limb'?Math.sin(i/(count-1)*Math.PI)*-35:0)];const key=id+'-'+i;ids.push(key);p.particles.push({id:key,position:at,mass:!loop&&i===0?0:1,radius});}
 const particle=i=>p.particles.find(n=>n.id===ids[i]);
 for(let i=1;i<count;i++)p.distances.push({a:ids[i-1],b:ids[i],length:length(particle(i-1).position,particle(i).position),stiffness:1});
 if(loop){p.distances.push({a:ids.at(-1),b:ids[0],length:length(particle(count-1).position,particle(0).position),stiffness:1});if(kind==='soft')p.areas.push({particles:ids,area:signedArea(ids.map((_,i)=>particle(i).position)),stiffness:.85});else p.rigid.push({particles:ids,stiffness:1});}
 else for(let i=2;i<count;i++)p.bends.push({a:ids[i-2],b:ids[i-1],c:ids[i],angle:0,limit:kind==='rope'?1.8:.65,stiffness:.8});
 if(['tentacle','spine','limb'].includes(kind)){
  const key=id+'-target',end=particle(count-1).position;p.particles.push({id:key,position:[...end],mass:0,radius:5});p.drivers.push({particle:key,type:'orbit',origin:kind==='spine'?[...position]:[position[0]+spacing*(count-1)*.65,position[1]+40],amplitude:[40,50],frequency:.2,phase:0});p.chains.push({id,particles:ids,target:key,mode:kind==='spine'?'follow':kind==='limb'?'step':'reach',bendLimit:2,stepHeight:25,stepDistance:25,stepDuration:.22,reach:250,direction:[0,1],group:id});
 }
 p.surfaces.push({id:id+'-surface',name:kind[0].toUpperCase()+kind.slice(1),layer,fill:'#98bd99',stroke:'#202936',strokeWidth:4,outline:'ink',opacity:1,smoothing:.5,thinning:0,shapes:[{type:loop?'polygon':'tube',particles:ids,radii:ids.map((_,i)=>loop?radius:Math.max(2,radius*(1-i/count*.8)))}]});
 return ids;
}
