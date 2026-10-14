import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {ESLint} from 'eslint';

const defaultRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function inventory(directory,root){
 const result=[];
 for(const entry of await fs.readdir(directory,{withFileTypes:true})){
  const file=path.join(directory,entry.name);
  if(entry.isSymbolicLink())throw Error('Historical evidence symlink is forbidden: '+path.relative(root,file));
  if(entry.isDirectory())result.push(...await inventory(file,root));
  else if(entry.isFile())result.push(path.relative(root,file).split(path.sep).join('/'));
 }
 return result.sort();
}
export async function auditHistoricalQA({root=defaultRoot,lintReportPath}={}){
 const baseline=JSON.parse(await fs.readFile(path.join(root,'docs/maintenance/historical-qa-integrity-20261014.json'),'utf8'));
 const expected=baseline.files.map(file=>file.path).sort();
 if(new Set(expected).size!==expected.length||expected.some(name=>!name.startsWith('docs/qa/')||name.split('/').includes('..')))throw Error('Unsafe or duplicate historical manifest entry');
 const actual=await inventory(path.join(root,'docs/qa'),root);
 if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('Historical evidence path inventory changed; new baseline review required');
 for(const file of baseline.files){const bytes=await fs.readFile(path.join(root,file.path));if(bytes.length!==file.bytes||sha(bytes)!==file.SHA256)throw Error('Historical evidence byte/SHA mismatch: '+file.path)}
 const result={status:'PASS_IMMUTABLE_HISTORICAL_QA_INTEGRITY',files:actual.length,bytes:baseline.files.reduce((sum,file)=>sum+file.bytes,0),captured_historical_lint:baseline.historical_lint_baseline,raw_diagnostics_are_preserved_not_repaired:true};
 if(lintReportPath){
  const results=await new ESLint({cwd:root}).lintFiles(['docs/qa']);
  await fs.writeFile(lintReportPath,JSON.stringify(results),{flag:"wx"});
  const errors=results.reduce((sum,file)=>sum+file.errorCount,0),warnings=results.reduce((sum,file)=>sum+file.warningCount,0);
  result.fresh_raw_ESLint={exit:errors?1:0,errors,warnings,report:lintReportPath};
  if(errors!==baseline.historical_lint_baseline.errors||warnings!==baseline.historical_lint_baseline.warnings)throw Error('Historical raw diagnostics changed; inspect preserved report before approving a new baseline');
 }
 return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);let lintReportPath;
 if(args.length){if(args.length!==2||args[0]!=='--lint-report')throw Error('Usage: audit-historical-qa.mjs [--lint-report NEW_REPORT.json]');lintReportPath=path.resolve(args[1]);}
 try{console.log(JSON.stringify(await auditHistoricalQA({lintReportPath}),null,2))}catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1}
}
