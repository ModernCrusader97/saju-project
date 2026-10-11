// Only new short viewport layout checks. Actual React/Tailwind, native Chrome input, fictional person.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createServer} from 'node:http';
const root=path.resolve(process.env.SAJU_QA_REPO||fileURLToPath(new URL('../..',import.meta.url)));
const phase=process.env.SAJU_QA_PHASE||'after';assert(['before','after'].includes(phase));
const output=path.resolve(process.env.SAJU_QA_OUTPUT||path.join(root,'outputs/passport-short-viewport',phase));
const scratch=path.resolve(process.env.SAJU_QA_SCRATCH||path.join(root,'outputs/passport-short-viewport-runtime'));
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
const person={id:'qa-synthetic-short-screen',name:'홍길동',pillars:{dayKey:'갑자'}};
function Fixture(){const[open,setOpen]=useState(false);return <><button data-qa-launcher onClick={()=>setOpen(true)}>Open synthetic passport layout QA</button><Modal person={person} isOpen={open} onClose={()=>setOpen(false)}/></>;}
createRoot(document.getElementById('root')).render(<Fixture/>);window.ready=true;`;
await fs.writeFile(path.join(output,'synthetic-entry.jsx'),entry,{flag:'wx'});
const bundle=await build({absWorkingDir:root,stdin:{contents:entry,resolveDir:root,sourcefile:'synthetic-passport-height-entry.jsx',loader:'jsx'},bundle:true,write:false,format:'esm',platform:'browser',nodePaths:[dependencies],alias:{'@':root,react:path.join(dependencies,'react'),'react-dom':path.join(dependencies,'react-dom'),'lucide-react':path.join(dependencies,'lucide-react'),three:path.join(dependencies,'three')},define:{'process.env.NODE_ENV':"'production'"}});
const config=ts.transpileModule(await fs.readFile(path.join(root,'tailwind.config.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {default:cssConfig}=await import('data:text/javascript;base64,'+Buffer.from(config).toString('base64'));cssConfig.content=cssConfig.content.map(pattern=>path.resolve(root,pattern));
const css=await postcss([tailwind(cssConfig),autoprefixer]).process(await fs.readFile(path.join(root,'app/globals.css'),'utf8'),{from:path.join(root,'app/globals.css')});
await fs.writeFile(path.join(output,'bundle.js'),bundle.outputFiles[0].contents,{flag:'wx'});await fs.writeFile(path.join(output,'styles.css'),css.css,{flag:'wx'});
const html='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic Passport Short Viewport QA</title><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script type="module" src="/entry.js"></script></body></html>';
const server=createServer((req,res)=>{const routes={'/__passport-short-viewport':['text/html',html],'/entry.js':['text/javascript',bundle.outputFiles[0].contents],'/styles.css':['text/css',css.css]};if(req.method==='GET'&&routes[req.url]){res.setHeader('Content-Type',routes[req.url][0]);res.end(routes[req.url][1]);return;}res.statusCode=req.url==='/favicon.ico'?204:404;res.end();});
const checks=[],observations=[],outbound=[],pageErrors=[],consoleErrors=[];let context;
try{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const base='http://127.0.0.1:'+server.address().port;
 context=await chromium.launchPersistentContext(path.join(scratch,'chrome-profile-'+phase),{headless:true,executablePath:process.env.SAJU_QA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',viewport:{width:390,height:844},args:['--disable-background-networking','--disable-component-update','--no-first-run']});
 await context.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(url.origin===base&&req.method()==='GET')await route.continue();else{outbound.push({url:req.url(),method:req.method()});await route.abort();}});
 async function check(name,run){const record={name};try{record.observed=await run();record.pass=true;}catch(error){record.pass=false;record.error=error.message;}checks.push(record);}
 async function geometry(page){return page.evaluate(()=>{const dialog=document.querySelector('[role="dialog"]'),overlay=dialog.parentElement;const bounds=el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};const close=dialog.querySelector('button'),buttons=[...dialog.querySelectorAll('button')];return {viewport:{width:innerWidth,height:innerHeight},dialog:bounds(dialog),close:bounds(close),last_action:bounds(buttons.at(-1)),header:bounds(dialog.firstElementChild),scroll_top:overlay.scrollTop,scroll_height:overlay.scrollHeight,client_height:overlay.clientHeight,max_scroll:overlay.scrollHeight-overlay.clientHeight,document_scroll_y:scrollY,buttons:buttons.map(b=>b.textContent.trim())};});}
 for(const viewport of [{width:390,height:844},{width:1440,height:1000},{width:844,height:390},{width:390,height:360}]){
  const key=viewport.width+'x'+viewport.height,page=await context.newPage();await page.setViewportSize(viewport);page.on('pageerror',error=>pageErrors.push({key,error:error.message}));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  try{
   await page.goto(base+'/__passport-short-viewport',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.ready===true);await page.locator('[data-qa-launcher]').click();const dialog=page.getByRole('dialog',{name:'우주 여권',exact:true});await dialog.waitFor({state:'visible'});
   const opening=await geometry(page);await page.screenshot({path:path.join(output,'opening-'+key+'.png'),animations:'disabled'});
   await page.mouse.move(viewport.width/2,viewport.height/2);await page.mouse.wheel(0,-3000);await page.waitForTimeout(150);const top=await geometry(page);await page.screenshot({path:path.join(output,'top-'+key+'.png'),animations:'disabled'});
   await page.mouse.wheel(0,3000);await page.waitForTimeout(150);const bottom=await geometry(page);await page.screenshot({path:path.join(output,'bottom-'+key+'.png'),animations:'disabled'});
   await page.mouse.wheel(0,-3000);await page.waitForTimeout(150);const returnedTop=await geometry(page);
   const observe={key,opening,top,bottom,returned_top:returnedTop};observations.push(observe);await fs.writeFile(path.join(output,'geometry-'+key+'.json'),JSON.stringify(observe,null,2)+'\n',{flag:'wx'});
   await check('Header and close button are scroll reachable '+key,async()=>{assert(top.header.top>=0,'Passport header remains above the viewport at scrollTop=0.');assert(top.close.top>=0&&top.close.bottom<=viewport.height,'Passport close button is clipped above the viewport at scrollTop=0.');assert(top.dialog.left>=0&&top.dialog.right<=viewport.width,'Dialog must stay within horizontal viewport.');return top;});
   await check('Bottom action buttons are scroll reachable '+key,async()=>{assert(bottom.last_action.top>=0&&bottom.last_action.bottom<=viewport.height,'Passport bottom action is not fully reachable by native scrolling.');return bottom;});
   await check('Native pointer closes after scrolling back '+key,async()=>{assert(returnedTop.close.top>=0&&returnedTop.close.bottom<=viewport.height,'Native pointer cannot reach close after scrolling back to top.');await page.getByRole('button',{name:'우주 여권 닫기',exact:true}).click();assert.equal(await page.getByRole('dialog').count(),0);return {closed_by_native_pointer:true};});
  }finally{await page.close();}
 }
 const passed=checks.filter(x=>x.pass).length,failed=checks.length-passed;
 const report={status:failed||pageErrors.length||outbound.length||consoleErrors.length?'FAIL':'PASS',phase,at_utc:new Date().toISOString(),browser:await context.browser().version(),product:'components/planet/CosmicPassportModal.tsx',source_sha256:sha(source),harness_sha256:sha(await fs.readFile(fileURLToPath(import.meta.url))),css_sha256:sha(Buffer.from(css.css)),passed,failed,checks,observations,page_errors:pageErrors,console_errors:consoleErrors,outbound_requests:outbound,api_requests:0,database_operations:0,native_pointer:true,native_wheel:true,manual_dom_events:0,programmatic_scroll_or_focus:0,previous_suites_rerun:0,scope:'Actual production React/Tailwind passport dialog with fictional Hong Gildong on four native Chrome viewports. Only short-height header, close, bottom geometry and native scroll/pointer checks. Prior save/copy/focus/name/timer/gender suites not rerun; no full hosted app, actual art/model render, API/DB or clipboard operation.'};
 await fs.writeFile(path.join(output,'browser-results.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:report.status,phase,passed,failed,browser:report.browser,page_errors:pageErrors.length,outbound:outbound.length,report:path.join(output,'browser-results.json')}));process.exitCode=report.status==='PASS'?0:1;
}finally{if(context)await context.close();await new Promise(resolve=>server.close(resolve));}
