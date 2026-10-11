import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const phase=process.argv[2],groups=process.argv[3]||'http,close,dialog,filter,join';assert(['before','item1','item2','item3','item4','item5','final'].includes(phase));
const task='SaJuUiBatchTwo-20261011-Joseph',work='D:/Codex/Work/'+task,results='D:/Codex/Results/'+task,scratch='D:/Codex/Scratch/'+task,repo='D:/Codex/Work/SaJuUiOneBug-20261010-Joseph/repo';
const pre=JSON.parse(fs.readFileSync(results+'/batch-preflight.json','utf8'));if(phase==='before')for(const file of pre.sources)assert(fs.readFileSync(file.snapshot).equals(fs.readFileSync(repo+'/'+file.file)));
const env={...process.env,SAJU_QA_REPO:repo,SAJU_QA_PHASE:phase,SAJU_QA_GROUPS:groups,SAJU_QA_OUTPUT:results+'/'+phase,SAJU_QA_SCRATCH:scratch+'/runtime',SAJU_QA_PLAYWRIGHT_PATH:'D:/Codex/Scratch/SaJuUiOneBug-20261010-Joseph/test-tools/node_modules/playwright/index.mjs',SAJU_QA_CHROME:'C:/Program Files/Google/Chrome/Application/chrome.exe'};
const result=spawnSync('C:/Program Files/nodejs/node.exe',[work+'/authoring/batch_two_browser.mjs'],{env,windowsHide:true,maxBuffer:32*1024*1024,timeout:240000});fs.writeFileSync(results+'/'+phase+'-native-browser-process.log',Buffer.concat([result.stdout||Buffer.alloc(0),result.stderr||Buffer.alloc(0)]),{flag:'wx'});console.log(JSON.stringify({phase,groups,exit_code:result.status,signal:result.signal,spawn_error:result.error?.message??null,stdout:result.stdout?.toString('utf8'),stderr:result.stderr?.toString('utf8')}));process.exitCode=result.status??1;
