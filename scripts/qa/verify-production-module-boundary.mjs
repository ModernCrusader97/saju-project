import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const defaultRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
async function entries(directory){
 const result=[];
 for(const entry of await fs.readdir(directory,{withFileTypes:true})){
  const file=path.join(directory,entry.name);
  if(entry.isDirectory())result.push(...await entries(file));
  else if(/\.(?:ts|tsx|js|jsx|mts|mjs)$/.test(entry.name))result.push(file);
 }
 return result;
}
export async function verifyProductionModuleBoundary({root=defaultRoot}={}){
 const entryPoints=await entries(path.join(root,'app'));
 const result=await build({absWorkingDir:root,entryPoints,outdir:path.join(root,'dist-module-audit-unused'),write:false,bundle:true,metafile:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',loader:{'.css':'empty','.glsl':'text'},logLevel:'silent',plugins:[{name:'actual-app-module-alias',setup(builder){
  builder.onResolve({filter:/^@\//},async args=>{const base=path.join(root,args.path.slice(2));for(const suffix of ['','.ts','.tsx','.js','.mjs','.json','/index.ts','/index.tsx'])try{if((await fs.stat(base+suffix)).isFile())return{path:base+suffix}}catch{}throw Error('Unresolved source alias: '+args.path)});
  builder.onResolve({filter:/^cloudflare:/},args=>({path:args.path,external:true}));
 }}]});
 const inputs=Object.keys(result.metafile.inputs).sort();
 const archived=inputs.filter(input=>input.split(path.sep).join('/').includes('docs/qa/'));
 if(archived.length)throw Error('Historical QA is imported by current production source: '+archived.join(', '));
 return{status:'PASS_NO_HISTORICAL_QA_IN_PRODUCTION_JS_TS_GRAPH',entry_points:entryPoints.length,module_inputs:inputs.length,historical_QA_inputs:archived,method:'Compile-only esbuild app entry/dependency graph, packages external, CSS empty; no module execution, output writes, backend, DB, model reads or rendering',inputs};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const report=await verifyProductionModuleBoundary();console.log(JSON.stringify(report,null,2))}catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1}
}
