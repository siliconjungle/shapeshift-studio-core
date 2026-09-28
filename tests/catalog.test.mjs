import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {featureCatalog,queryCatalog,commandInfo,expandRecipe,catalogueMarkdown} from '../src/catalog/index.js';
const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url)));
test('catalogue covers every focused Core export and has unique, linked records',()=>{
 const ids=featureCatalog.features.map(f=>f.id);assert.equal(new Set(ids).size,ids.length);
 const recipes=featureCatalog.recipes.map(r=>r.id);assert.equal(new Set(recipes).size,recipes.length);
 const exports=new Set(featureCatalog.features.flatMap(f=>f.coreExports));
 for(const key of Object.keys(pkg.exports).filter(k=>!['.','./package.json','./catalog','./catalog.json'].includes(k)))assert.ok(exports.has(key),'Missing feature for '+key);
 for(const f of featureCatalog.features){assert.ok(f.title&&f.description&&f.requirements.length);for(const path of f.coreExports)assert.ok(pkg.exports[path],path);for(const id of f.recipes)assert.ok(recipes.includes(id));}
 for(const command of featureCatalog.commands){assert.ok(command.features.length);for(const id of command.features)assert.ok(ids.includes(id));}
 for(const recipe of featureCatalog.recipes){assert.ok(ids.includes(recipe.feature));assert.ok(recipe.requirements.length);assert.ok(expandRecipe(recipe.id).requests.length);}
});
test('search combines words, category and scope; results cannot mutate the catalogue',()=>{
 assert.ok(queryCatalog({query:'potion'}).features.some(f=>f.id==='liquid'));
 assert.equal(queryCatalog({query:'container liquid',scope:'core'}).features[0].id,'liquid');
 assert.equal(queryCatalog({query:'unfindable-random-term'}).total,0);
 const original=featureCatalog.features[0].title;queryCatalog().features[0].title='changed';assert.equal(featureCatalog.features[0].title,original);
 assert.ok(queryCatalog({id:'liquid'}).recipes.some(r=>r.id==='add-liquid'));
 assert.ok(commandInfo('vector.clip').features.includes('clipping'));
 assert.throws(()=>queryCatalog({id:'missing'}),/Unknown feature/);assert.throws(()=>commandInfo('missing'),/Unknown command/);assert.throws(()=>queryCatalog({scope:'unknown'}),/scope/);
});
test('recipes validate inputs, preserve JSON strings and never mutate data or execute requests',()=>{
 const before=JSON.stringify(featureCatalog),expanded=expandRecipe('add-liquid',{joint:'bottle',fill:.8});assert.equal(expanded.requests[0].args.commands.joint,'bottle');assert.equal(expanded.requests[0].args.commands.values.fill,.8);
 assert.throws(()=>expandRecipe('add-liquid',{fill:2}),/range/);assert.throws(()=>expandRecipe('add-liquid',{fill:'0.5'}),/number/);assert.throws(()=>expandRecipe('add-liquid',{color:'red'}),/format/);assert.throws(()=>expandRecipe('create-mesh',{columns:1.5}),/integer/);
 assert.throws(()=>expandRecipe('add-liquid',{unknown:1}),/unknown input/);assert.throws(()=>expandRecipe('add-liquid',JSON.parse('{"__proto__":{}}')),/unknown input/);assert.throws(()=>expandRecipe('missing'),/Unknown recipe/);
 const name='a `literal` $(string) <svg>';assert.equal(expandRecipe('rename-project',{name}).requests[0].args.commands.name,name);
 assert.equal(JSON.stringify(featureCatalog),before);assert.ok(Object.isFrozen(featureCatalog.features));
});
test('generated feature guide stays in sync with source data',()=>{assert.equal(fs.readFileSync(new URL('../docs/features.md',import.meta.url),'utf8'),catalogueMarkdown());});
