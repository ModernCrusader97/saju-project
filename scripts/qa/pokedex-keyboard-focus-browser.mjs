// Actual current collection modal, native keyboard/pointer and focus observations only.
// Synthetic collection data only; no API, DB, auth, external requests or model rendering.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createServer} from 'node:http';
const root=path.resolve(process.env.SAJU_QA_REPO||fileURLToPath(new URL('../..',import.meta.url)));
const phase=process.env.SAJU_QA_PHASE||'after';assert(['before','after'].includes(phase));
const output=path.resolve(process.env.SAJU_QA_OUTPUT||path.join(root,'outputs/pokedex-keyboard-focus',phase));
const scratch=path.resolve(process.env.SAJU_QA_SCRATCH||path.join(root,'outputs/pokedex-keyboard-focus-runtime'));
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
const source=await fs.readFile(path.join(root,'components/planet/GalaxyPokedexModal.tsx'));
const entry=`import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import Modal from './components/planet/GalaxyPokedexModal.tsx';
import {TEN_STEM_SPIRITS} from './lib/planet/spirit-profiles.ts';
const renderer=createRoot(document.getElementById('root'));
window.closeCalls=0;
function Fixture({collected}){const [open,setOpen]=useState(false);const guins=Object.keys(TEN_STEM_SPIRITS).slice(0,collected).map((stem,i)=>({id:'synthetic-'+i,name:'QA Collection',pillars:{dayKey:stem+'자'}}));
return <><button data-qa-launcher aria-label="Open synthetic collection QA" onClick={()=>setOpen(true)}>Open synthetic collection QA</button><button data-qa-background aria-label="Background next action QA">Background next action QA</button><Modal guins={guins} isOpen={open} onClose={()=>{window.closeCalls++;setOpen(false)}}/></>;}
window.mountFixture=collected=>{window.closeCalls=0;renderer.render(<Fixture key={collected} collected={collected}/>);};window.ready=true;`;
await fs.writeFile(path.join(output,'synthetic-entry.jsx'),entry,{flag:'wx'});
const bundle=await build({absWorkingDir:root,stdin:{contents:entry,resolveDir:root,sourcefile:'synthetic-pokedex-entry.jsx',loader:'jsx'},bundle:true,write:false,format:'esm',platform:'browser',nodePaths:[dependencies],alias:{'@':root,react:path.join(dependencies,'react'),'react-dom':path.join(dependencies,'react-dom'),'lucide-react':path.join(dependencies,'lucide-react'),three:path.join(dependencies,'three'),'korean-lunar-calendar':path.join(dependencies,'korean-lunar-calendar')},loader:{'.glsl':'text'},define:{'process.env.NODE_ENV':"'production'"}});
const config=ts.transpileModule(await fs.readFile(path.join(root,'tailwind.config.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {default:cssConfig}=await import('data:text/javascript;base64,'+Buffer.from(config).toString('base64'));
cssConfig.content=cssConfig.content.map(pattern=>path.resolve(root,pattern));
const css=await postcss([tailwind(cssConfig),autoprefixer]).process(await fs.readFile(path.join(root,'app/globals.css'),'utf8'),{from:path.join(root,'app/globals.css')});
await fs.writeFile(path.join(output,'bundle.js'),bundle.outputFiles[0].contents,{flag:'wx'});await fs.writeFile(path.join(output,'styles.css'),css.css,{flag:'wx'});
const html='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic Collection Native AX QA</title><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script type="module" src="/entry.js"></script></body></html>';
const server=createServer((req,res)=>{if(req.method!=='GET'){res.statusCode=405;res.end();return;}const routes={'/__pokedex-keyboard-focus':['text/html',html],'/entry.js':['text/javascript',bundle.outputFiles[0].contents],'/styles.css':['text/css',css.css]};if(routes[req.url]){res.setHeader('Content-Type',routes[req.url][0]);res.end(routes[req.url][1]);return;}res.statusCode=req.url==='/favicon.ico'?204:404;res.end();});
const checks=[],outbound=[],pageErrors=[],consoleErrors=[];let context;
try{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const base='http://127.0.0.1:'+server.address().port;
 context=await chromium.launchPersistentContext(path.join(scratch,'chrome-profile-'+phase),{headless:true,executablePath:process.env.SAJU_QA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',viewport:{width:390,height:844},args:['--disable-background-networking','--disable-component-update','--no-first-run']});
 await context.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(url.origin===base&&req.method()==='GET')await route.continue();else{outbound.push({url:req.url(),method:req.method()});await route.abort();}});
 async function view(width=390,collected=0){const page=await context.newPage();await page.setViewportSize({width,height:width===390?844:1000});page.on('pageerror',error=>pageErrors.push(error.message));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});await page.goto(base+'/__pokedex-keyboard-focus',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.ready===true);await page.evaluate(n=>window.mountFixture(n),collected);await page.locator('[data-qa-launcher]').click();await page.locator('.fixed button').waitFor({state:'visible'});return page;}
 async function check(name,run){const record={name};try{record.observed=await run();record.pass=true;}catch(error){record.pass=false;record.error=error.message;}checks.push(record);}
 for(const width of [390,1440]){
  for(const target of ['opening','Tab','Shift+Tab'])await check('focus stays in collection '+target+' '+width,async()=>{
   const page=await view(width,0);if(target!=='opening')await page.keyboard.press(target);
   const observed=await page.evaluate(()=>({inside:document.querySelector('.fixed')?.contains(document.activeElement)??false,active_tag:document.activeElement?.tagName,active_name:document.activeElement?.getAttribute('aria-label')??'',close_calls:window.closeCalls}));
   await fs.writeFile(path.join(output,'focus-'+target.replaceAll('+','-')+'-'+width+'.json'),JSON.stringify(observed,null,2)+'\n',{flag:'wx'});
   if(target==='opening')await page.screenshot({path:path.join(output,'opening-'+width+'.png'),animations:'disabled'});
   await page.close();assert.equal(observed.inside,true,'Active focus must remain inside the visible collection overlay.');return observed;
  });
  for(const how of ['Escape','Enter'])await check('close returns focus and releases Tab '+how+' '+width,async()=>{
   const page=await view(width,0);if(how==='Enter'){for(let attempt=0;attempt<3&&!await page.evaluate(()=>document.querySelector('.fixed')?.contains(document.activeElement));attempt++)await page.keyboard.press('Tab');}
   await page.keyboard.press(how);await page.locator('.fixed').waitFor({state:'hidden'});
   const returned=await page.evaluate(()=>document.activeElement===document.querySelector('[data-qa-launcher]'));
   await page.keyboard.press('Tab');const released=await page.evaluate(()=>document.activeElement===document.querySelector('[data-qa-background]'));
   const observed={returned_to_opener:returned,closed_tab_released:released,close_calls:await page.evaluate(()=>window.closeCalls)};
   await fs.writeFile(path.join(output,'return-'+how+'-'+width+'.json'),JSON.stringify(observed,null,2)+'\n',{flag:'wx'});await page.close();assert.equal(returned,true,'Closing the modal must return keyboard focus to its opener.');assert.equal(released,true);assert.equal(observed.close_calls,1);return observed;
  });
 }
 const passed=checks.filter(x=>x.pass).length,failed=checks.length-passed;
 const report={status:failed||pageErrors.length||outbound.length||consoleErrors.length?'FAIL':'PASS',phase,at_utc:new Date().toISOString(),browser:await context.browser().version(),product:'components/planet/GalaxyPokedexModal.tsx',source_sha256:sha(source),harness_sha256:sha(await fs.readFile(fileURLToPath(import.meta.url))),css_sha256:sha(Buffer.from(css.css)),passed,failed,checks,page_errors:pageErrors,console_errors:consoleErrors,outbound_requests:outbound,api_requests:0,database_operations:0,actual_native_chrome_AX:false,actual_native_keyboard_and_pointer:true,manual_keyboard_or_AX_event_dispatches:0,synthetic_collection_only:true,scope:'Actual production-mode React collection component and native keyboard focus, with synthetic empty collection and actual Tailwind. No prior name tests, built full-app route, hosted auth/DB, physical keyboard/screen-reader/mobile or model-render claim.'};
 await fs.writeFile(path.join(output,'browser-results.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:report.status,phase,passed,failed,browser:report.browser,page_errors:pageErrors.length,outbound:outbound.length,report:path.join(output,'browser-results.json')}));process.exitCode=report.status==='PASS'?0:1;
}finally{if(context)await context.close();await new Promise(resolve=>server.close(resolve));}
