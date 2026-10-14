import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(root, 'package.json'));
const { build } = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { Module } = require('node:module');
async function loadComponent(relative) {
  const result = await build({entryPoints:[path.join(root,relative)],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',packages:'external',plugins:[{name:'native-repository-alias',setup(build){build.onResolve({filter:/^@\//},args=>{const base=path.join(root,args.path.slice(2));const file=[base,base+'.ts',base+'.tsx',base+'.json'].find(fs.existsSync);if(!file)throw Error('Missing native module '+args.path);return{path:file};});}}]});
  const qaModule = new Module(path.join(root, relative+'.qa.cjs'));
  qaModule.filename=path.join(root,relative+'.qa.cjs');qaModule.paths=Module._nodeModulePaths(root);qaModule._compile(result.outputFiles[0].text,qaModule.filename);
  return qaModule.exports.default;
}
const person = (id,key) => ({id,name:'QA 합성 인물',relationTitle:'QA',relationType:'supporter',dayMaster:key[0],elementMatch:'wood',advice:'합성 데이터',affinityScore:50,pillars:{dayKey:key,monthKey:'병인',yearKey:'을축'}});
const Pokedex = await loadComponent('components/planet/GalaxyPokedexModal.tsx');
const Passport = await loadComponent('components/planet/CosmicPassportModal.tsx');
const html = renderToStaticMarkup(React.createElement(Pokedex,{isOpen:true,onClose:()=>{},guins:[person('one','갑자'),person('two','갑술'),person('three','갑자')]}));
const text = html.replace(/<[^>]*>/g,'');
const passport = renderToStaticMarkup(React.createElement(Passport,{isOpen:true,onClose:()=>{},person:person('owner','을축')}));
const stale = renderToStaticMarkup(React.createElement(Passport,{isOpen:true,onClose:()=>{},person:person('owner','을축'),planetSnapshotUrl:'https://example.invalid/stale-three-dimensional-snapshot.png'}));
const source = fs.readFileSync(path.join(root,'lib/planet/theme-library.ts'),'utf8');
const keys = [...source.matchAll(/\{ key: "([^"]+)", hanja:/g)].map(match=>match[1]);
assert.equal(keys.length,60);
const checks = [
 ['collection_counts_full_key_not_shared_stem',()=>assert.match(text,/2\s*\/\s*60/,'Two different whole ganzi sharing 갑 must count as 2/60')],
 ['collection_contains_all_sixty_canonical_labels',()=>assert.deepEqual(keys.filter(key=>!text.includes(key)),[],'Every canonical label must be rendered')],
 ['passport_displays_matching_full_key_portrait',()=>assert.match(passport,/data-ganzi-key="을축"/,'Passport must show the same-key mascot portrait')],
 ['passport_ignores_stale_3D_capture_for_mascot',()=>assert.ok(!stale.includes('stale-three-dimensional-snapshot.png'),'Old scene capture must not replace the current mascot')],
];
const results=[];
for(const [id,check] of checks){try{check();results.push({id,pass:true});}catch(error){results.push({id,pass:false,message:error.message});}}
const summary={status:results.every(x=>x.pass)?'PASS_REAL_PRODUCTION_SSR_MASCOT_CONTRACTS':'FAIL_EXPECTED_MASCOT_FEATURE_BOUNDARIES',checks:results,passed:results.filter(x=>x.pass).length,failed:results.filter(x=>!x.pass).length,source:'Real native React production components and synthetic person data; no backend or 3D render',does_not_validate_unavailable_original_image_bytes:true};
console.log(JSON.stringify(summary,null,2));if(summary.failed)process.exitCode=1;
