// Supplements existing loader/parity tests: shadowed declarations and geometry
// reuse with correct names/metadata. Product sources and assets are never edited.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {build} from 'esbuild';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const root=process.cwd(), output=path.resolve('outputs/zodiac-renderer-mapping');
await fs.mkdir(output,{recursive:true});
const branches=['자','축','인','묘','진','사','오','미','신','유','술','해'];
const animals=['rat','ox','tiger','rabbit','dragon','snake','horse','sheep','monkey','rooster','dog','pig'];
const oracle=new Map(branches.map((branch,i)=>[branch,animals[i]]));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const generatorPath='lib/planet/spirit-zodiac-pet.ts', profilesPath='lib/planet/spirit-profiles.ts';
const generator=await fs.readFile(generatorPath,'utf8'),profiles=await fs.readFile(profilesPath,'utf8');
const manifestText=await fs.readFile('public/models/zodiac-pets/manifest.json','utf8');
const sourceBlob='8595a73296087b93c34487dad9b55174cc396238';
const original=execFileSync('git',['cat-file','blob',sourceBlob],{encoding:'utf8'});
const checks=[],controls=[],sourceRows=[],runtimeRows=[];
const fingerprints={high:{},low:{}},requests=[];
async function check(name,fn){
  try{await fn();checks.push({name,status:'PASS'});console.log('PASS',name);}
  catch(error){checks.push({name,status:'FAIL',error:error.stack});console.error('FAIL',name,error.message);}
}
function ast(source,file='fixture.ts'){
  const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  assert.equal(tree.parseDiagnostics.length,0,'Source must parse before checking mapping');return tree;
}
function collect(tree,predicate){
  const nodes=[];function visit(node){if(predicate(node))nodes.push(node);ts.forEachChild(node,visit);}visit(tree);return nodes;
}
function declaration(source,name){
  const tree=ast(source),nodes=collect(tree,n=>ts.isVariableDeclaration(n)&&n.name.getText(tree)===name);
  assert.equal(nodes.length,1,`${name}: expected one declaration`);
  let value=nodes[0].initializer;while(ts.isAsExpression(value)||ts.isParenthesizedExpression(value))value=value.expression;
  assert(ts.isObjectLiteralExpression(value),`${name}: expected explicit object`);return{tree,value};
}
function properties(object){
  assert(ts.isObjectLiteralExpression(object));
  return object.properties.map(property=>{
    assert(ts.isPropertyAssignment(property),'Mapping spreads/computed properties need explicit review');
    assert(ts.isIdentifier(property.name)||ts.isStringLiteral(property.name));
    return{key:property.name.text,value:property.initializer,node:property};
  });
}
function domain(keys,label){
  assert.equal(new Set(keys).size,keys.length,`${label}: duplicate branch declaration`);
  assert.deepEqual([...keys].sort(),[...branches].sort(),`${label}: missing or extra zodiac branch`);
}
function catalog(source,name,manifest=false){
  const parsed=declaration(manifest?`const ${name} = ${source};`:source,name);
  const object=manifest?properties(parsed.value).find(p=>p.key==='pets')?.value:parsed.value;
  assert(object,`${name}: missing pets table`);
  const rows=properties(object);domain(rows.map(r=>r.key),name);
  const values=rows.map(row=>{
    const fields=new Map(properties(row.value).map(p=>[p.key,p.value]));
    const branch=fields.get('branch')?.text,animal=fields.get('animal')?.text;
    assert.equal(branch,row.key,`${name}: key/branch mismatch ${row.key}`);
    assert.equal(animal,oracle.get(row.key),`${name}: wrong animal for ${row.key}`);
    return{branch,animal,line:parsed.tree.getLineAndCharacterOfPosition(row.node.getStart(parsed.tree)).line+1};
  });
  assert.equal(new Set(values.map(r=>r.animal)).size,12,`${name}: duplicate animal`);return values;
}
function clauses(source){
  const tree=ast(source),functions=collect(tree,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='createZodiacPet');
  assert.equal(functions.length,1);
  const switches=collect(functions[0],n=>ts.isSwitchStatement(n)&&n.expression.getText(tree)==='resolved');
  assert.equal(switches.length,1);
  const rows=switches[0].caseBlock.clauses.map(clause=>{
    assert(ts.isCaseClause(clause)&&ts.isStringLiteral(clause.expression),'Each zodiac must have an explicit case');
    return{branch:clause.expression.text,line:tree.getLineAndCharacterOfPosition(clause.getStart(tree)).line+1,sha256:sha(clause.getText(tree))};
  });domain(rows.map(r=>r.branch),'generator cases');return rows;
}
function geometryIdentity(pet){
  // Root display translation, names, UUIDs, colors and provenance labels are
  // deliberately excluded. Pet-local normalized shape remains authoritative.
  const shapes=[];pet.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const chain=[];for(let node=mesh;node&&node!==pet;node=node.parent)chain.unshift(node);
    const matrix=new THREE.Matrix4();for(const node of chain){node.updateMatrix();matrix.multiply(node.matrix);}
    const positions=mesh.geometry.getAttribute('position').array,index=mesh.geometry.index?.array;
    const bytes=array=>Buffer.from(array.buffer,array.byteOffset,array.byteLength);
    shapes.push(JSON.stringify({position:sha(bytes(positions)),index:index?sha(bytes(index)):null,matrix:matrix.elements}));
  });assert(shapes.length>0,'Pet must contain actual drawable geometry');return sha(shapes.sort().join('\n'));
}
async function bundle(name,mutant=false){
  const file=path.join(output,`${name}.mjs`);
  await build({stdin:{contents:`export * from './lib/planet/approved-jade-spirit';export * from './lib/planet/spirit-zodiac-pet';`,resolveDir:root},
    outfile:file,bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'qa-boundaries',setup(builder){
      builder.onResolve({filter:/\.glsl\?raw$/},args=>({path:path.resolve(args.resolveDir,args.path.slice(0,-4)),namespace:'raw-glsl'}));
      builder.onLoad({filter:/.*/,namespace:'raw-glsl'},async args=>({contents:await fs.readFile(args.path,'utf8'),loader:'text'}));
      if(mutant)builder.onLoad({filter:/[\\/]spirit-zodiac-pet\.ts$/},async args=>({loader:'ts',resolveDir:path.dirname(args.path),
        contents:(await fs.readFile(args.path,'utf8')).replace('export async function loadZodiacPet(', 'async function originalLoadZodiacPet(')+`
        export async function loadZodiacPet(branch: string, quality: SpiritQuality='high', options: ZodiacPetLoadOptions={}) {
          const pet=await originalLoadZodiacPet(branch==='인'?'술':branch,quality,options);
          if(branch==='인') { pet.group.userData={...pet.group.userData,branch:'인',animal:'tiger'};
            pet.group.traverse(object=>{object.name=object.name.replace(/^dog/,'tiger');}); }
          return pet;
        }` }));
    }}]});return import(pathToFileURL(file).href);
}

await check('profiles and raw manifest have exactly twelve explicit, unshadowed branch/animal mappings',()=>{
  catalog(profiles,'ZODIAC_FEATURES');catalog(manifestText,'manifest',true);
});
await check('twelve generator cases match the preserved source blob individually',()=>{
  assert.equal(sha(original),'d6e8384d03f1a3eec3ec0f916fb9212ac10c14aa32f41c0d8751892ea54b0daa');
  const historical=new Map(clauses(original).map(r=>[r.branch,r]));
  for(const row of clauses(generator)){
    assert.equal(row.sha256,historical.get(row.branch).sha256,`${row.branch}: generator case changed from preserved source`);
    sourceRows.push({...row,animal:oracle.get(row.branch),preservedSourceLine:historical.get(row.branch).line});
  }
});
await check('negative controls reject missing and duplicate cases plus shadowed profile/JSON keys',()=>{
  const fixtures=[
    ['missing generator case',()=>clauses(generator.replace("case '유':","case 'invalid-bird':")),/missing or extra/],
    ['duplicate generator case',()=>clauses(generator.replace("case '유':","case '자':")),/duplicate/],
    ['shadowed profile key',()=>catalog(profiles.replace('export const ZODIAC_FEATURES = {','export const ZODIAC_FEATURES = {\n자: {branch:"자",animal:"rat"},'),'ZODIAC_FEATURES'),/duplicate/],
    ['shadowed JSON key',()=>catalog(manifestText.replace('"pets": {','"pets": {"자":{"branch":"자","animal":"rat"},'),'manifest',true),/duplicate/],
  ];
  for(const[name,fn,pattern]of fixtures){assert.throws(fn,pattern,name);controls.push({name,status:'REJECTED_AS_EXPECTED'});}
});

const body=await fs.readFile('public/spirits/jade-v002/body.glb');
assert.equal(sha(body),'0e339d90253c8bbf6a865210f39d200ec3b5c042bcddb7ce669cea5c75c37b84');
const imageBoundary=new GLTFLoader().register(()=>({name:'CPU_IMAGE_IO',loadTexture:async()=>new THREE.Texture()}));
const nativeGLTF=GLTFLoader.prototype.loadAsync,nativeTexture=THREE.TextureLoader.prototype.loadAsync,nativeFetch=globalThis.fetch;
GLTFLoader.prototype.loadAsync=async function(url){
  requests.push(String(url));assert.equal(url,'/spirits/jade-v002/body.glb');
  return imageBoundary.parseAsync(body.buffer.slice(body.byteOffset,body.byteOffset+body.byteLength),'');
};
THREE.TextureLoader.prototype.loadAsync=async function(url){
  requests.push(String(url));assert.match(String(url),/\/spirits\/jade-v002\/(base-color|fields)\.png$/);
  return new THREE.Texture({width:String(url).endsWith('fields.png')?2048:1024,height:1024});
};
globalThis.fetch=async url=>{requests.push(String(url));throw new Error('Unexpected network request in offline mapping QA');};
try{
  const api=await bundle('current-runtime');
  await check('every quality has twelve distinct geometry identities independent of all names/colors/labels',()=>{
    for(const quality of['high','low']){
      for(const branch of branches){const pet=api.createZodiacPet(branch,quality);try{fingerprints[quality][branch]=geometryIdentity(pet.group);}finally{pet.dispose();}}
      assert.equal(new Set(Object.values(fingerprints[quality])).size,12,`${quality}: two branches reuse the same shape`);
    }
  });
  await check('actual approved GLB renderer assembly retains each geometry identity across contrasting month branches',async()=>{
    for(const quality of['high','low'])for(const [i,branch]of branches.entries())for(const monthKey of['병인','정묘']){
      const dayKey=(i%2?'을':'갑')+branch,spirit=await api.loadApprovedSpirit(dayKey,monthKey,quality);
      try{
        const pet=spirit.zodiacPet;
        assert.equal(pet.parent,spirit.group,'Pet must be attached to the actual returned scene');
        assert.equal(pet.userData.branch,branch);assert.equal(pet.userData.animal,oracle.get(branch));
        assert.equal(geometryIdentity(pet),fingerprints[quality][branch],`${branch}: wrong rendered animal shape`);
        runtimeRows.push({dayKey,monthKey,quality,branch,animal:oracle.get(branch),geometrySha256:geometryIdentity(pet)});
      }finally{spirit.dispose();}
    }
    assert.equal(requests.filter(url=>url.includes('/models/zodiac-pets/')).length,0);
  });
  await check('mislabeled tiger-to-dog renderer mutation is rejected by geometry while identity labels remain correct',async()=>{
    const mutant=await bundle('negative-control-runtime',true),spirit=await mutant.loadApprovedSpirit('갑인','을축','low');
    try{
      assert.equal(spirit.zodiacPet.userData.branch,'인');assert.equal(spirit.zodiacPet.userData.animal,'tiger');
      const fingerprint=geometryIdentity(spirit.zodiacPet);
      assert.equal(fingerprint,fingerprints.low.술,'Negative fixture really reuses dog geometry');
      assert.throws(()=>assert.equal(fingerprint,fingerprints.low.인,'인: wrong rendered animal shape'),/wrong rendered animal shape/);
      controls.push({name:'metadata-correct tiger-to-dog geometry reuse',status:'REJECTED_AS_EXPECTED',geometrySha256:fingerprint});
    }finally{spirit.dispose();}
  });
}finally{
  GLTFLoader.prototype.loadAsync=nativeGLTF;THREE.TextureLoader.prototype.loadAsync=nativeTexture;globalThis.fetch=nativeFetch;
}
const sourceHashes={};
for(const file of[generatorPath,profilesPath,'public/models/zodiac-pets/manifest.json','lib/planet/approved-jade-spirit.ts','components/planet/ElementalSpiritCanvas.tsx'])sourceHashes[file]=sha(await fs.readFile(file));
const status=checks.every(c=>c.status==='PASS')?'PASS':'FAIL';
const report={status,base:'c6b79d2e1f0e4bf3aa77c948b0b7190d69ad6573',checks,controls,sourceRows,runtimeRows,fingerprints,sourceHashes,
  originalSource:{blob:sourceBlob,sha256:sha(original),firstVerifiedCommit:'dffb235fbe47c063b8535a21b4fdf3ea8235d6aa',firstVerifiedCommitEvidence:'Existing preserved forensic report; this runner verifies the actual blob and per-case contents'},
  runtimeBodySha256:sha(body),confirmedMissingBranches:status==='PASS'?[]:null,confirmedDuplicateShapes:status==='PASS'?[]:null,authoredAnimalGLBRequests:requests.filter(url=>url.includes('/models/zodiac-pets/')),
  limits:['CPU executes actual Three objects and approved GLB assembly; image/network I/O are explicit offline boundaries. No new GPU/browser/visual approval claim.',
    'Standalone animal GLB absence does not imply the existing generator is missing or unfinished. Latest model/eye/limb/dragon/idle approval remains unverified.',
    'Negative renderer mutation is in an output-only bundle. No product source, model, manifest, rig or galaxy file is changed.']};
await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
if(report.status!=='PASS')process.exitCode=1;
