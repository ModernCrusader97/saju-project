// New invite-copy failure tests only; no image generation, prior suite, API/DB, or OS clipboard change.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createServer} from 'node:http';
const root=path.resolve(process.env.SAJU_QA_REPO||fileURLToPath(new URL('../..',import.meta.url)));
const phase=process.env.SAJU_QA_PHASE||'after';assert(['before','after'].includes(phase));
const output=path.resolve(process.env.SAJU_QA_OUTPUT||path.join(root,'outputs/passport-invite-copy-failure',phase));
const scratch=path.resolve(process.env.SAJU_QA_SCRATCH||path.join(root,'outputs/passport-invite-copy-failure-runtime'));
await fs.mkdir(output,{recursive:true});await fs.mkdir(scratch,{recursive:true});
try{await fs.access(path.join(output,'browser-results.json'));throw Error('Use a new report directory');}catch(error){if(error.code!=='ENOENT')throw error;}
const dependencies=path.resolve(process.env.SAJU_QA_DEPENDENCY_ROOT||path.join(root,'node_modules'));
const {chromium}=await import(pathToFileURL(process.env.SAJU_QA_PLAYWRIGHT_PATH||path.join(root,'.sites-runtime/test-tools/node_modules/playwright/index.mjs')).href);
const {build}=await import(pathToFileURL(path.join(dependencies,'esbuild/lib/main.js')).href);
const {default:postcss}=await import(pathToFileURL(path.join(dependencies,'postcss/lib/postcss.js')).href);
const {default:tailwind}=await import(pathToFileURL(path.join(dependencies,'tailwindcss/lib/index.js')).href);
const {default:autoprefixer}=await import(pathToFileURL(path.join(dependencies,'autoprefixer/lib/autoprefixer.js')).href);
const {default:ts}=await import(pathToFileURL(path.join(dependencies,'typescript/lib/typescript.js')).href);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const source=await fs.readFile(path.join(root,'components/planet/CosmicPassportModal.tsx'));
const entry=`import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import Modal from './components/planet/CosmicPassportModal.tsx';
const renderer=createRoot(document.getElementById('root'));
const person={id:'qa-synthetic-copy',name:'QA & 초대',pillars:{dayKey:'갑자'}};
function Fixture(){const[open,setOpen]=useState(false);return <><button data-qa-launcher onClick={()=>setOpen(true)}>Open synthetic passport copy QA</button><Modal person={person} isOpen={open} onClose={()=>setOpen(false)}/></>;}
renderer.render(<Fixture/>);window.ready=true;`;
await fs.writeFile(path.join(output,'synthetic-entry.jsx'),entry,{flag:'wx'});
const bundle=await build({absWorkingDir:root,stdin:{contents:entry,resolveDir:root,sourcefile:'synthetic-passport-copy-entry.jsx',loader:'jsx'},bundle:true,write:false,format:'esm',platform:'browser',nodePaths:[dependencies],alias:{'@':root,react:path.join(dependencies,'react'),'react-dom':path.join(dependencies,'react-dom'),'lucide-react':path.join(dependencies,'lucide-react'),three:path.join(dependencies,'three')},define:{'process.env.NODE_ENV':"'production'"}});
const config=ts.transpileModule(await fs.readFile(path.join(root,'tailwind.config.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {default:cssConfig}=await import('data:text/javascript;base64,'+Buffer.from(config).toString('base64'));
cssConfig.content=cssConfig.content.map(pattern=>path.resolve(root,pattern));
const css=await postcss([tailwind(cssConfig),autoprefixer]).process(await fs.readFile(path.join(root,'app/globals.css'),'utf8'),{from:path.join(root,'app/globals.css')});
await fs.writeFile(path.join(output,'bundle.js'),bundle.outputFiles[0].contents,{flag:'wx'});await fs.writeFile(path.join(output,'styles.css'),css.css,{flag:'wx'});
const html='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic Passport Invite Copy QA</title><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script type="module" src="/entry.js"></script></body></html>';
const server=createServer((req,res)=>{const routes={'/__passport-invite-copy-failure':['text/html',html],'/entry.js':['text/javascript',bundle.outputFiles[0].contents],'/styles.css':['text/css',css.css]};if(req.method==='GET'&&routes[req.url]){res.setHeader('Content-Type',routes[req.url][0]);res.end(routes[req.url][1]);return;}res.statusCode=req.url==='/favicon.ico'?204:404;res.end();});
const checks=[],outbound=[],pageErrors=[],consoleErrors=[];let context;
try{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const base='http://127.0.0.1:'+server.address().port;
 context=await chromium.launchPersistentContext(path.join(scratch,'chrome-profile-'+phase),{headless:true,executablePath:process.env.SAJU_QA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',viewport:{width:390,height:844},args:['--disable-background-networking','--disable-component-update','--no-first-run']});
 await context.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(url.origin===base&&req.method()==='GET')await route.continue();else{outbound.push({url:req.url(),method:req.method()});await route.abort();}});
 async function view(width,mode){const page=await context.newPage();await page.setViewportSize({width,height:width===390?844:1000});const errors=[];
  page.on('pageerror',error=>{errors.push(error.message);pageErrors.push({mode,width,error:error.message});});page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  await page.addInitScript(clipboardMode=>{window.copyMode=clipboardMode;window.copyWrites=[];
   const clipboard={writeText(text){window.copyWrites.push(text);if(window.copyMode==='denied')return Promise.reject(new DOMException('Synthetic clipboard denial','NotAllowedError'));if(window.copyMode==='throw')throw new Error('Synthetic synchronous clipboard failure');return Promise.resolve();}};
   Object.defineProperty(navigator,'clipboard',{configurable:true,get(){return window.copyMode==='unavailable'?undefined:clipboard;}});
  },mode);
  await page.goto(base+'/__passport-invite-copy-failure',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.ready===true);await page.locator('[data-qa-launcher]').click();await page.getByRole('dialog',{name:'우주 여권',exact:true}).waitFor({state:'visible'});return{page,errors};
 }
 async function check(name,run){const record={name};try{record.observed=await run();record.pass=true;}catch(error){record.pass=false;record.error=error.message;}checks.push(record);}
 const originalLabel='카톡 초대 링크 복사 (내 은하로 착륙해줘)',successLabel='카톡 착륙 초대 링크 복사 완료!',errorLabel='초대 링크를 복사하지 못했어요. 다시 시도해 주세요.';
 for(const width of [390,1440]){
  await check('successful copy preserves encoded invite and UI '+width,async()=>{const{page,errors}=await view(width,'ok');try{
   await page.screenshot({path:path.join(output,'opening-'+width+'.png'),animations:'disabled'});await page.getByRole('button',{name:originalLabel,exact:true}).click();await page.getByRole('button',{name:successLabel,exact:true}).waitFor({state:'visible'});
   const observed={writes:await page.evaluate(()=>window.copyWrites.map(url=>({path:new URL(url).pathname,join:new URL(url).searchParams.get('join'),from:new URL(url).searchParams.get('from')}))),error_count:errors.length,alert_count:await page.getByRole('alert').count()};await fs.writeFile(path.join(output,'success-'+width+'.json'),JSON.stringify(observed,null,2)+'\n',{flag:'wx'});
   assert.deepEqual(observed.writes,[{path:'/guin',join:'true',from:'QA & 초대'}]);assert.equal(observed.error_count,0);assert.equal(observed.alert_count,0);return observed;
  }finally{await page.close();}});
  for(const mode of ['denied','throw','unavailable'])await check('failed copy reports error and permits manual retry '+mode+' '+width,async()=>{const{page,errors}=await view(width,mode);try{
   await page.getByRole('button',{name:originalLabel,exact:true}).click();await page.waitForTimeout(80);
   const alert=page.getByRole('alert');const failure={visible_error:await alert.count()===1&&await alert.isVisible()&&await alert.textContent()===errorLabel,unexpected_page_errors:[...errors],copy_button_still_ready:await page.getByRole('button',{name:originalLabel,exact:true}).isEnabled(),false_success_count:await page.getByRole('button',{name:successLabel,exact:true}).count(),copy_attempts:await page.evaluate(()=>window.copyWrites.length)};
   await fs.writeFile(path.join(output,'failed-'+mode+'-'+width+'.json'),JSON.stringify(failure,null,2)+'\n',{flag:'wx'});if(mode==='denied')await page.screenshot({path:path.join(output,'failed-'+width+'.png'),animations:'disabled'});
   assert.equal(failure.visible_error,true,'A failed invite-copy operation must show actionable error feedback.');assert.equal(errors.length,0,'Copy rejection must be handled.');assert.equal(failure.copy_button_still_ready,true);assert.equal(failure.false_success_count,0);assert.equal(failure.copy_attempts,mode==='unavailable'?0:1,'No automatic retries');
   await page.evaluate(()=>{window.copyMode='ok';});await page.getByRole('button',{name:originalLabel,exact:true}).click();await page.getByRole('button',{name:successLabel,exact:true}).waitFor({state:'visible'});
   const recovery={success_button_visible:true,error_cleared:await page.getByRole('alert').count()===0,copy_attempts:await page.evaluate(()=>window.copyWrites.length),page_errors:errors.length};await fs.writeFile(path.join(output,'retry-'+mode+'-'+width+'.json'),JSON.stringify(recovery,null,2)+'\n',{flag:'wx'});assert.equal(recovery.error_cleared,true);assert.equal(recovery.copy_attempts,mode==='unavailable'?1:2);assert.equal(recovery.page_errors,0);return{failure,recovery};
  }finally{await page.close();}});
 }
 const passed=checks.filter(x=>x.pass).length,failed=checks.length-passed;
 const report={status:failed||pageErrors.length||outbound.length||consoleErrors.length?'FAIL':'PASS',phase,at_utc:new Date().toISOString(),browser:await context.browser().version(),product:'components/planet/CosmicPassportModal.tsx',source_sha256:sha(source),harness_sha256:sha(await fs.readFile(fileURLToPath(import.meta.url))),css_sha256:sha(Buffer.from(css.css)),passed,failed,checks,page_errors:pageErrors,console_errors:consoleErrors,outbound_requests:outbound,api_requests:0,database_operations:0,native_pointer:true,browser_boundary_clipboard_faults:['denied promise','synchronous throw','API unavailable'],real_clipboard_writes:0,permission_changes:0,manual_dom_events:0,previous_suites_rerun:0,scope:'Actual production React/Tailwind passport component and native Chrome pointer with synthetic person and clipboard boundary faults. No previous image-save, close-name/focus or timer QA rerun; no full hosted/built app route, actual OS clipboard permission/content, auth/DB or model-render claim.'};
 await fs.writeFile(path.join(output,'browser-results.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:report.status,phase,passed,failed,browser:report.browser,page_errors:pageErrors.length,outbound:outbound.length,report:path.join(output,'browser-results.json')}));process.exitCode=report.status==='PASS'?0:1;
}finally{if(context)await context.close();await new Promise(resolve=>server.close(resolve));}
