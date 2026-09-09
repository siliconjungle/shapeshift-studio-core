import {evaluate} from './expression.js';
// Ordered guarded transitions. Drivers supply context and execute commands;
// this engine has no knowledge of bosses, eyes, spells or particular actions.
export function runComposition(definition,event,context,dispatch){const variables={...context};for(const transition of definition.events[event]??[]){if(transition.when!==undefined&&!evaluate(transition.when,variables))continue;for(const command of transition.commands){const [op,...args]=command,values=args.map(a=>evaluate(a,variables));if(op==='let')variables[values[0]]=values[1];else{if(op==='set')variables[values[0]]=values[1];dispatch(op,...values);}}return transition.id;}return null;}
