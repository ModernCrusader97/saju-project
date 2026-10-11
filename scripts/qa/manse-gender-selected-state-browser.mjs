// New gender pressed-state checks only; actual page and Chrome AX, synthetic default example, no API/DB or old suites.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createServer} from 'node:http';
const root=path.resolve(process.env.SAJU_QA_REPO||fileURLToPath(new URL('../..',import.meta.url)));
const phase=process.env.SAJU_QA_PHASE||'after';assert(['before','after'].includes(phase));
const output=path.resolve(process.env.SAJU_QA_OUTPUT||path.join(root,'outputs/manse-gender-selected-state',phase));
const scratch=path.resolve(process.env.SAJU_QA_SCRATCH||path.join(root,'outputs/manse-gender-selected-state-runtime'));
await fs.mkdir(output,{recursive:true});await fs.mkdir(scratch,{recursive:true});
try{await fs.access(path.join(output,'browser-results.json'));throw Error('Use a fresh report directory');}catch(error){if(error.code!=='ENOENT')throw error;}
const dependencies=path.resolve(process.env.SAJU_QA_DEPENDENCY_ROOT||path.join(root,'node_modules'));
const {chromium}=await import(pathToFileURL(process.env.SAJU_QA_PLAYWRIGHT_PATH||path.join(root,'.sites-runtime/test-tools/node_modules/playwright/index.mjs')).href);
const {build}=await import(pathToFileURL(path.join(dependencies,'esbuild/lib/main.js')).href);
const {default:postcss}=await import(pathToFileURL(path.join(dependencies,'postcss/lib/postcss.js')).href);
const {default:tailwind}=await import(pathToFileURL(path.join(dependencies,'tailwindcss/lib/index.js')).href);
const {default:autoprefixer}=await import(pathToFileURL(path.join(dependencies,'autoprefixer/lib/autoprefixer.js')).href);
const {default:ts}=await import(pathToFileURL(path.join(dependencies,'typescript/lib/typescript.js')).href);
const sha=data=>createHash('sha256').update(data).digest('hex');
const source=await fs.readFile(path.join(root,'app/manse/page.tsx'));
const entry="import React from 'react';import {createRoot} from 'react-dom/client';import Page from './app/manse/page.tsx';createRoot(document.getElementById('root')).render(<Page/>);window.ready=true;";
await fs.writeFile(path.join(output,'synthetic-entry.jsx'),entry,{flag:'wx'});
const navigationStub="export const usePathname=()=>'/manse';";
const bundle=await build({absWorkingDir:root,stdin:{contents:entry,resolveDir:root,sourcefile:'synthetic-manse-gender-entry.jsx',loader:'jsx'},bundle:true,write:false,format:'esm',platform:'browser',nodePaths:[dependencies],alias:{'@':root,react:path.join(dependencies,'react'),'react-dom':path.join(dependencies,'react-dom'),'lucide-react':path.join(dependencies,'lucide-react'),three:path.join(dependencies,'three'),'korean-lunar-calendar':path.join(dependencies,'korean-lunar-calendar')},plugins:[{name:'synthetic-route-path-only',setup(b){b.onResolve({filter:/^next\/navigation$/},()=>({path:'route-path',namespace:'synthetic-route'}));b.onLoad({filter:/.*/,namespace:'synthetic-route'},()=>({contents:navigationStub,loader:'js'}));}}],define:{'process.env.NODE_ENV':"'production'"}});
const config=ts.transpileModule(await fs.readFile(path.join(root,'tailwind.config.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {default:cssConfig}=await import('data:text/javascript;base64,'+Buffer.from(config).toString('base64'));cssConfig.content=cssConfig.content.map(pattern=>path.resolve(root,pattern));
const css=await postcss([tailwind(cssConfig),autoprefixer]).process(await fs.readFile(path.join(root,'app/globals.css'),'utf8'),{from:path.join(root,'app/globals.css')});
await fs.writeFile(path.join(output,'bundle.js'),bundle.outputFiles[0].contents,{flag:'wx'});await fs.writeFile(path.join(output,'styles.css'),css.css,{flag:'wx'});
const html='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic Manse Gender State QA</title><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script type="module" src="/entry.js"></script></body></html>';
const server=createServer((req,res)=>{const routes={'/__manse-gender-selected-state':['text/html',html],'/entry.js':['text/javascript',bundle.outputFiles[0].contents],'/styles.css':['text/css',css.css]};if(req.method==='GET'&&routes[req.url]){res.setHeader('Content-Type',routes[req.url][0]);res.end(routes[req.url][1]);return;}res.statusCode=req.url==='/favicon.ico'?204:404;res.end();});
const checks=[],outbound=[],pageErrors=[],consoleErrors=[];let context;
try{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const base='http://127.0.0.1:'+server.address().port;
 context=await chromium.launchPersistentContext(path.join(scratch,'chrome-profile-'+phase),{headless:true,executablePath:process.env.SAJU_QA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',viewport:{width:390,height:844},args:['--disable-background-networking','--disable-component-update','--no-first-run']});
 await context.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(url.origin===base&&req.method()==='GET')await route.continue();else{outbound.push({url:req.url(),method:req.method()});await route.abort();}});
 const male='남성 (乾命)',female='여성 (坤命)';
 async function view(width){const page=await context.newPage();await page.setViewportSize({width,height:width===390?844:1000});page.on('pageerror',error=>pageErrors.push(error.message));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});await page.goto(base+'/__manse-gender-selected-state',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.ready===true);await page.getByRole('button',{name:male,exact:true}).waitFor({state:'visible'});return page;}
 async function check(name,run){const record={name};try{record.observed=await run();record.pass=true;}catch(error){record.pass=false;record.error=error.message;}checks.push(record);}
 for(const width of [390,1440])for(const action of ['initial','pointer-female','keyboard-female'])await check('native selected gender '+action+' '+width,async()=>{const page=await view(width);let cdp;try{
  if(action==='pointer-female')await page.getByRole('button',{name:female,exact:true}).click();
  if(action==='keyboard-female'){for(let count=0;count<15&&!(await page.getByRole('button',{name:female,exact:true}).evaluate(el=>el===document.activeElement));count++)await page.keyboard.press('Tab');assert(await page.getByRole('button',{name:female,exact:true}).evaluate(el=>el===document.activeElement),'Reach gender by native Tab');await page.keyboard.press('Space');}
  const selected=action==='initial'?male:female;await page.waitForFunction(label=>[...document.querySelectorAll('button')].some(el=>el.textContent.trim()===label&&el.classList.contains('bg-doryeong-navy')),selected);
  cdp=await context.newCDPSession(page);const tree=await cdp.send('Accessibility.getFullAXTree');const native=tree.nodes.filter(node=>node.role?.value==='button'&&[male,female].includes(node.name?.value)).map(node=>({name:node.name.value,role:node.role.value,pressed:node.properties?.find(property=>property.name==='pressed')?.value?.value??null}));
  const visual=await page.locator('form').evaluate(form=>({selected_buttons:[...form.querySelectorAll('button')].filter(el=>el.classList.contains('bg-doryeong-navy')).map(el=>el.textContent.trim()),gender_names:[...form.querySelectorAll('button')].slice(0,2).map(el=>el.textContent.trim()),values:[...form.querySelectorAll('input')].map(el=>el.value),input_error:form.querySelector('[role="alert"]')?.textContent??null,text:form.innerText}));
  const image=await page.screenshot({path:path.join(output,action+'-'+width+'.png'),animations:'disabled'});
  const observed={native_buttons:native,visual,screenshot_sha256:sha(image),actual_native_AX:true,manual_keyboard_or_AX_events:0};await fs.writeFile(path.join(output,action+'-'+width+'.json'),JSON.stringify(observed,null,2)+'\n',{flag:'wx'});
  assert.equal(native.length,2);assert.deepEqual(visual.selected_buttons,[selected]);for(const button of native)assert.equal(button.pressed,button.name===selected?'true':'false','Native AX pressed state must match the visible gender selection.');return observed;
 }finally{if(cdp)await cdp.detach();await page.close();}});
 const passed=checks.filter(x=>x.pass).length,failed=checks.length-passed;
 const report={status:failed||pageErrors.length||outbound.length||consoleErrors.length?'FAIL':'PASS',phase,at_utc:new Date().toISOString(),browser:await context.browser().version(),product:'app/manse/page.tsx',source_sha256:sha(source),harness_sha256:sha(await fs.readFile(fileURLToPath(import.meta.url))),css_sha256:sha(Buffer.from(css.css)),passed,failed,checks,page_errors:pageErrors,console_errors:consoleErrors,outbound_requests:outbound,api_requests:0,database_operations:0,actual_native_AX:true,native_keyboard_and_pointer:true,manual_keyboard_or_AX_events:0,previous_suites_rerun:0,synthetic_default_example_only:true,scope:'Actual production React/Tailwind /manse page and native Chrome gender pressed-state after native pointer/Tab+Space. Only usePathname is a fixed /manse route fixture. No previous label/checkbox/calculation, passport/collection, API/DB, model, hosted route, screen-reader hardware or full-app integration validation.'};
 await fs.writeFile(path.join(output,'browser-results.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:report.status,phase,passed,failed,browser:report.browser,page_errors:pageErrors.length,outbound:outbound.length,report:path.join(output,'browser-results.json')}));process.exitCode=report.status==='PASS'?0:1;
}finally{if(context)await context.close();await new Promise(resolve=>server.close(resolve));}
