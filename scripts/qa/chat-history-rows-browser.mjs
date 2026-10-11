// New history row rendering safety only. Fictional intercepted GETs; no live server/DB or chat POST.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createServer} from 'node:http';
const root=path.resolve(process.env.SAJU_QA_REPO||fileURLToPath(new URL('../..',import.meta.url))),phase=process.env.SAJU_QA_PHASE||'after';assert(['before','after'].includes(phase));
const output=path.resolve(process.env.SAJU_QA_OUTPUT||path.join(root,'outputs/chat-history-rows',phase)),scratch=path.resolve(process.env.SAJU_QA_SCRATCH||path.join(root,'outputs/chat-history-rows-runtime'));
await fs.mkdir(output,{recursive:true});await fs.mkdir(scratch,{recursive:true});try{await fs.access(path.join(output,'browser-results.json'));throw Error('Use a new report directory');}catch(error){if(error.code!=='ENOENT')throw error;}
const dependencies=path.resolve(process.env.SAJU_QA_DEPENDENCY_ROOT||path.join(root,'node_modules'));
const {chromium}=await import(pathToFileURL(process.env.SAJU_QA_PLAYWRIGHT_PATH||path.join(root,'.sites-runtime/test-tools/node_modules/playwright/index.mjs')).href);
const {build}=await import(pathToFileURL(path.join(dependencies,'esbuild/lib/main.js')).href);
const {default:postcss}=await import(pathToFileURL(path.join(dependencies,'postcss/lib/postcss.js')).href);
const {default:tailwind}=await import(pathToFileURL(path.join(dependencies,'tailwindcss/lib/index.js')).href);
const {default:autoprefixer}=await import(pathToFileURL(path.join(dependencies,'autoprefixer/lib/autoprefixer.js')).href);
const {default:ts}=await import(pathToFileURL(path.join(dependencies,'typescript/lib/typescript.js')).href);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),source=await fs.readFile(path.join(root,'components/AskDoryeongModal.tsx'));
const entry=`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import Modal from './components/AskDoryeongModal.tsx';
const fortune={id:'qa-fictional-chat-history',analysis:{name:'홍길동'}};
function Fixture(){const[open,setOpen]=useState(false);return <><button data-qa-launcher onClick={()=>setOpen(true)}>Open synthetic chat history QA</button><Modal fortune={fortune} isOpen={open} onClose={()=>setOpen(false)}/></>;}
createRoot(document.getElementById('root')).render(<Fixture/>);window.ready=true;`;
await fs.writeFile(path.join(output,'synthetic-entry.jsx'),entry,{flag:'wx'});
const bundle=await build({absWorkingDir:root,stdin:{contents:entry,resolveDir:root,sourcefile:'synthetic-chat-history-entry.jsx',loader:'jsx'},bundle:true,write:false,format:'esm',platform:'browser',nodePaths:[dependencies],alias:{'@':root,react:path.join(dependencies,'react'),'react-dom':path.join(dependencies,'react-dom'),'lucide-react':path.join(dependencies,'lucide-react')},define:{'process.env.NODE_ENV':"'production'"}});
const config=ts.transpileModule(await fs.readFile(path.join(root,'tailwind.config.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {default:cssConfig}=await import('data:text/javascript;base64,'+Buffer.from(config).toString('base64'));cssConfig.content=cssConfig.content.map(pattern=>path.resolve(root,pattern));
const css=await postcss([tailwind(cssConfig),autoprefixer]).process(await fs.readFile(path.join(root,'app/globals.css'),'utf8'),{from:path.join(root,'app/globals.css')});
await fs.writeFile(path.join(output,'bundle.js'),bundle.outputFiles[0].contents,{flag:'wx'});await fs.writeFile(path.join(output,'styles.css'),css.css,{flag:'wx'});
const html='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic Chat History Row QA</title><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script type="module" src="/entry.js"></script></body></html>';
const server=createServer((req,res)=>{const routes={'/__chat-history-rows':['text/html',html],'/entry.js':['text/javascript',bundle.outputFiles[0].contents],'/styles.css':['text/css',css.css]};if(req.method==='GET'&&routes[req.url]){res.setHeader('Content-Type',routes[req.url][0]);res.end(routes[req.url][1]);return;}res.statusCode=req.url==='/favicon.ico'?204:404;res.end();});
const checks=[],observations=[],outbound=[],pageErrors=[],consoleErrors=[],syntheticGets=[];let context;
const valid=[{role:'doryeong',content:'새 대화 기록 형식 확인용 가상 안내입니다.',createdAt:'2026-10-11T00:00:00.000Z'},{role:'user',content:'가상 질문 기록입니다.',createdAt:'2026-10-11T00:01:00.000Z'}];
const malformed={object_content:[{role:'user',content:{unexpected:'object'},createdAt:'2026-10-11T00:01:00.000Z'}],null_row:[null],numeric_content:[{role:'user',content:12345,createdAt:'2026-10-11T00:01:00.000Z'}]};
try{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const base='http://127.0.0.1:'+server.address().port;
 context=await chromium.launchPersistentContext(path.join(scratch,'chrome-profile-'+phase),{headless:true,executablePath:process.env.SAJU_QA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',viewport:{width:390,height:844},args:['--disable-background-networking','--disable-component-update','--no-first-run']});
 await context.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(url.origin===base&&req.method()==='GET')await route.continue();else{outbound.push({url:req.url(),method:req.method()});await route.abort();}});
 async function check(name,run){const record={name};try{record.observed=await run();record.pass=true;}catch(error){record.pass=false;record.error=error.message;}checks.push(record);}
 async function view(width,mode){const page=await context.newPage();await page.setViewportSize({width,height:width===390?844:1000});const errors=[],requests=[];let replyRows=mode==='valid'?valid:malformed[mode];
  page.on('pageerror',error=>{errors.push(error.message);pageErrors.push({mode,width,error:error.message});});page.on('console',message=>{if(message.type()==='error')consoleErrors.push({mode,width,error:message.text()});});
  await page.route('**/api/saju/qa-fictional-chat-history',async route=>{assert.equal(route.request().method(),'GET');requests.push({rows:replyRows});syntheticGets.push({mode,width,rows:replyRows});await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({chats:replyRows})});});
  await page.goto(base+'/__chat-history-rows',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.ready===true);await page.locator('[data-qa-launcher]').click();await page.waitForTimeout(180);assert.equal(requests.length,1);return {page,errors,requests,useValid(){replyRows=valid;}};
 }
 for(const width of [390,1440]){
  await check('Valid history text and composer remain usable '+width,async()=>{const {page,errors,requests}=await view(width,'valid');try{await page.getByText(valid[0].content,{exact:true}).waitFor({state:'visible'});await page.getByText(valid[1].content,{exact:true}).waitFor({state:'visible'});const input=page.getByRole('textbox',{name:'사주 풀이 질문',exact:true});assert(await input.isEnabled());assert.equal(await page.getByRole('alert').count(),0);assert.equal(errors.length,0);await page.screenshot({path:path.join(output,'valid-'+width+'.png'),animations:'disabled'});return {texts:valid.map(m=>m.content),input_enabled:true,gets:requests.length};}finally{await page.close();}});
  for(const mode of Object.keys(malformed))await check('Malformed '+mode+' shows retryable error and manual GET retry restores '+width,async()=>{const {page,errors,requests,useValid}=await view(width,mode);try{
   const alert=page.getByRole('alert'),input=page.getByRole('textbox',{name:'사주 풀이 질문',exact:true});
   const observed={mode,width,gets:requests.length,unexpected_page_errors:[...errors],visible_error:await alert.count()===1&&await alert.isVisible(),error_text:await alert.count()===1?await alert.textContent():null,composer_exists:await input.count()===1,composer_disabled:await input.count()===1?await input.isDisabled():null,body_text:await page.locator('body').innerText()};observations.push(observed);await fs.writeFile(path.join(output,mode+'-'+width+'.json'),JSON.stringify(observed,null,2)+'\n',{flag:'wx'});await page.screenshot({path:path.join(output,mode+'-'+width+'.png'),animations:'disabled'});
   assert.equal(observed.visible_error,true,'Malformed history rows must reach the existing retryable error UI.');assert(observed.error_text.includes('대화 기록을 확인할 수 없습니다.'));assert.equal(errors.length,0,'Malformed history must not cause a React/page render failure.');assert.equal(observed.composer_disabled,true);assert.equal(requests.length,1,'No automatic history retry');
   useValid();await page.getByRole('button',{name:'대화 기록 다시 불러오기',exact:true}).click();await page.getByText(valid[0].content,{exact:true}).waitFor({state:'visible'});assert.equal(requests.length,2);assert(await input.isEnabled());assert.equal(await page.getByRole('alert').count(),0);assert.equal(errors.length,0);await fs.writeFile(path.join(output,'retry-'+mode+'-'+width+'.json'),JSON.stringify({gets:2,history_restored:true,composer_enabled:true,page_errors:0},null,2)+'\n',{flag:'wx'});return {failure:observed,recovery:{manual_gets:2,history_restored:true,composer_enabled:true}};
  }finally{await page.close();}});
 }
 const passed=checks.filter(x=>x.pass).length,failed=checks.length-passed;
 const report={status:failed||pageErrors.length||outbound.length||consoleErrors.length?'FAIL':'PASS',phase,at_utc:new Date().toISOString(),browser:await context.browser().version(),product:'components/AskDoryeongModal.tsx',source_sha256:sha(source),harness_sha256:sha(await fs.readFile(fileURLToPath(import.meta.url))),css_sha256:sha(Buffer.from(css.css)),passed,failed,checks,observations,synthetic_gets:syntheticGets,page_errors:pageErrors,console_errors:consoleErrors,outbound_requests:outbound,actual_backend_requests:0,chat_posts:0,database_operations:0,native_pointer:true,manual_dom_events:0,previous_suites_rerun:0,scope:'Actual production React/Tailwind AskDoryeongModal with fictional person/history at 390x844/1440x1000. Only valid row controls and three malformed row cases plus existing manual history GET retry. Every history GET intercepted at the browser boundary; no actual backend/DB or chat POST. Previous history request ownership/send recovery/IME and all completed QA suites not rerun. No full hosted route or physical device claim.'};
 await fs.writeFile(path.join(output,'browser-results.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:report.status,phase,passed,failed,browser:report.browser,page_errors:pageErrors.length,console_errors:consoleErrors.length,actual_backend_requests:0,synthetic_gets:syntheticGets.length,report:path.join(output,'browser-results.json')}));process.exitCode=report.status==='PASS'?0:1;
}finally{if(context)await context.close();await new Promise(resolve=>server.close(resolve));}
