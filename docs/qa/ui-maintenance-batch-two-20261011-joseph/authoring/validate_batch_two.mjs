import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
const mode=process.argv[2],repo='D:/Codex/Work/SaJuUiOneBug-20261010-Joseph/repo',results='D:/Codex/Results/SaJuUiBatchTwo-20261011-Joseph',scratch='D:/Codex/Scratch/SaJuUiBatchTwo-20261011-Joseph';
assert(['baseline','final'].includes(mode));const pre=JSON.parse(fs.readFileSync(results+'/batch-preflight.json','utf8'));
const {ESLint}=await import(pathToFileURL(repo+'/node_modules/eslint/lib/api.js').href),eslint=new ESLint({cwd:repo});
const normalize=record=>({file:path.relative(repo,record.filePath).replaceAll('\\','/'),errorCount:record.errorCount,warningCount:record.warningCount,messages:record.messages.map(({ruleId,severity,message,line,column})=>({ruleId,severity,message,line,column}))});
const before=[];for(const source of pre.sources)before.push(...await eslint.lintText(fs.readFileSync(source.snapshot,'utf8'),{filePath:repo+'/'+source.file}));
if(mode==='baseline'){
 const proof={status:'RECORDED_BASELINE_WITH_REAL_PRODUCT_FILENAMES',at_utc:new Date().toISOString(),records:before.map(normalize),errors:before.reduce((sum,item)=>sum+item.errorCount,0),warnings:before.reduce((sum,item)=>sum+item.warningCount,0)};
 fs.writeFileSync(results+'/lint-before.json',JSON.stringify(proof,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({stage:'lint-before',errors:proof.errors,warnings:proof.warnings}));
}else{
 const final=JSON.parse(fs.readFileSync(results+'/final/browser-results.json','utf8')),progress=JSON.parse(fs.readFileSync(results+'/progress-5of5.json','utf8'));
 assert.equal(progress.validated_new_fix_count,5);assert.equal(final.status,'PASS');assert.equal(final.passed,26);assert.equal(final.failed,0);assert.equal(final.page_errors.length,0);assert.equal(final.console_errors.length,0);assert.equal(final.expected_console_errors.length,2);assert.equal(final.outbound_requests.length,0);
 const qa='scripts/qa/ui-maintenance-batch-two-browser.mjs',after=await eslint.lintFiles([...pre.sources.map(item=>repo+'/'+item.file),repo+'/'+qa]);
 const stable=messages=>messages.map(({ruleId,severity,message})=>({ruleId,severity,message}));
 for(const old of before){const current=after.find(item=>path.resolve(item.filePath).toLowerCase()===path.resolve(old.filePath).toLowerCase());assert(current);assert.equal(current.errorCount,old.errorCount);assert.equal(current.warningCount,old.warningCount);assert.deepEqual(stable(current.messages),stable(old.messages));}
 const qaResult=after.find(item=>path.resolve(item.filePath).toLowerCase()===path.resolve(repo+'/'+qa).toLowerCase());assert.equal(qaResult.errorCount,0);assert.equal(qaResult.warningCount,0);
 const lint={status:'PASS_NO_NEW_PRODUCT_DIAGNOSTICS_QA_CLEAN_EXISTING_BASELINES_PRESERVED',before:before.map(normalize),after:after.map(normalize),existing_product_errors:before.reduce((sum,item)=>sum+item.errorCount,0),existing_product_warnings:before.reduce((sum,item)=>sum+item.warningCount,0),new_errors:0,new_warnings:0,qa_errors:0,qa_warnings:0,rules_or_suppressions_changed:false};fs.writeFileSync(results+'/lint-comparison.json',JSON.stringify(lint,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({stage:'lint',status:lint.status,existing_errors:lint.existing_product_errors,existing_warnings:lint.existing_product_warnings,new_errors:0,new_warnings:0}));
 assert(!fs.existsSync(repo+'/.npmrc'),'Do not read project npm credentials');assert(!fs.readdirSync(repo).some(name=>/^\.env(?:\.|$)/.test(name)),'Build must not read environment credential files');
 for(const name of ['empty-user.npmrc','empty-global.npmrc'])fs.writeFileSync(scratch+'/'+name,'',{flag:'wx'});
 const env={...process.env,NPM_CONFIG_USERCONFIG:scratch+'/empty-user.npmrc',NPM_CONFIG_GLOBALCONFIG:scratch+'/empty-global.npmrc',NPM_CONFIG_CACHE:scratch+'/npm-cache',NPM_CONFIG_UPDATE_NOTIFIER:'false',GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'Never'},node='C:/Program Files/nodejs/node.exe';
 function gate(name,args,command){const fd=fs.openSync(results+'/'+name+'.log','wx');let result;try{result=spawnSync(node,args,{cwd:repo,env,windowsHide:true,stdio:['ignore',fd,fd],timeout:600000});}finally{fs.closeSync(fd);}const proof={command,exit_code:result.status,signal:result.signal,spawn_error:result.error?.message??null,at_utc:new Date().toISOString(),own_current_batch_branch_run:true,no_install_deploy_or_real_backend_data_operation:true};fs.writeFileSync(results+'/'+name+'.json',JSON.stringify(proof,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({stage:name,exit_code:result.status,signal:result.signal}));assert.equal(result.status,0,command);}
 gate('production-build',['C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js','run','build'],'npm run build for this validated batch of five; empty npm configs; no install, deployment, env/credential file or real API/DB operation');
 gate('types',['node_modules/typescript/lib/tsc.js','--noEmit','--incremental','false'],'tsc --noEmit --incremental false after this batch production build');
}
