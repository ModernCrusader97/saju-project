import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const manifestArg=process.argv.indexOf('--manifest');
const manifest=JSON.parse(fs.readFileSync(manifestArg>=0?process.argv[manifestArg+1]:path.join(root,'lib/planet/ganzi-mascot-manifest.json'),'utf8'));
const recordsArg=process.argv.indexOf('--records');
const selected=recordsArg>=0?new Map(JSON.parse(fs.readFileSync(process.argv[recordsArg+1],'utf8')).expected_selected_originals.map(x=>[x.key,x])):undefined;
const keys=[...fs.readFileSync(path.join(root,'lib/planet/theme-library.ts'),'utf8').matchAll(/\{ key: "([^"]+)", hanja:/g)].map(match=>match[1]);
const problems=[];
if(manifest.entries.length!==60||new Set(manifest.entries.map(x=>x.key)).size!==60)problems.push('Missing or duplicate manifest keys');
if(JSON.stringify(keys)!==JSON.stringify(manifest.entries.map(x=>x.key)))problems.push('Canonical key ordering mismatch');
if(new Set(manifest.entries.map(x=>x.src)).size!==60)problems.push('Duplicate portrait paths');
if(manifest.verifiedOriginalCount!==manifest.entries.filter(x=>x.ready).length)problems.push('Ready count mismatch');
if(manifest.complete!==(manifest.entries.length===60&&manifest.entries.every(x=>x.ready)))problems.push('Completion flag mismatch');
if(JSON.stringify(manifest.missingOriginalKeys)!==JSON.stringify(manifest.entries.filter(x=>!x.ready).map(x=>x.key)))problems.push('Missing key list mismatch');
for(const asset of manifest.entries){
 if(selected&&asset.originalSha256!==selected.get(asset.key)?.sha256)problems.push('Wrong original image mapping '+asset.key);
 for(const [urlField,hashField]of [['src','sha256'],['thumbnailSrc','thumbnailSha256']]){
  const url=asset[urlField];if(!url.startsWith('/mascots/'+manifest.version+'/')||url.includes('..')||url.includes('://')){problems.push('Invalid same-origin path '+asset.key);continue;}
  if(asset.ready){const file=path.join(root,'public',url.slice(1));if(!fs.existsSync(file)){problems.push('Ready asset file absent '+asset.key);continue;}if(createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==asset[hashField])problems.push('Derived byte SHA mismatch '+asset.key);}
 }
}
const missing=manifest.entries.filter(x=>!x.ready).map(x=>x.key);
const summary={status:problems.length?'FAIL_ASSET_MAPPING_OR_BYTE_IDENTITY':missing.length?'BLOCKED_MISSING_ORIGINALS_FULL_APPLICATION_NOT_VERIFIED':'PASS_ALL_60_MASCOT_ASSETS',canonical_keys:keys.length,ready:manifest.entries.filter(x=>x.ready).length,missing,problems,version:manifest.version,metadata_coverage_is_not_image_acceptance:true};
if(process.argv.includes('--self-test')){
 const invalidCases=[['missing-key',x=>x.entries.pop()],['duplicate-key',x=>x.entries[1].key=x.entries[0].key],['swapped-original',x=>x.entries[1].originalSha256=x.entries[0].originalSha256],['duplicate-path',x=>x.entries[1].src=x.entries[0].src]];
 assert(selected,'--self-test requires --records');
 const {spawnSync}=await import('node:child_process');const os=await import('node:os');const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'ganzi-asset-negative-'));const tests=[];
 try{for(const [id,mutate]of invalidCases){const bad=structuredClone(manifest);mutate(bad);const file=path.join(temporary,id+'.json');fs.writeFileSync(file,JSON.stringify(bad));const result=spawnSync(process.execPath,[fileURLToPath(import.meta.url),'--manifest',file,'--records',process.argv[recordsArg+1]],{encoding:'utf8'});const report=JSON.parse(result.stdout);assert.equal(result.status,1);assert(report.problems.length>0,id+' must fail mapping validation, independently from unavailable images');tests.push({id,rejected:true,problems:report.problems});}}finally{fs.rmSync(temporary,{recursive:true});}
 console.log(JSON.stringify({status:'PASS_INVALID_MAPPINGS_REJECTED',tests,asset_intake_status:summary.status,ready:summary.ready,missing:missing.length},null,2));
}else{console.log(JSON.stringify(summary,null,2));if(problems.length||missing.length)process.exitCode=1;}
