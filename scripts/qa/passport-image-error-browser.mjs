// Actual React modal, native Chromium Image errors, Canvas and PNG downloads.
// All identities and images are synthetic. No API, database or hosted login.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'node:http';

const root=fileURLToPath(new URL('../..',import.meta.url));
const phase=process.env.SAJU_QA_PHASE || 'after';
assert(['before','after'].includes(phase));
const result=path.resolve(process.env.SAJU_QA_OUTPUT || path.join(root,'outputs/passport-image-error',phase));
const scratch=path.resolve(process.env.SAJU_QA_SCRATCH || path.join(root,'outputs/passport-image-error-runtime'));
await fs.mkdir(result,{recursive:true});await fs.mkdir(scratch,{recursive:true});
const reportPath=path.join(result,'browser-results.json');
try {await fs.access(reportPath);throw Error('Use a new report directory');}catch(error){if(error.code!=='ENOENT')throw error;}
const {chromium}=await import(pathToFileURL(process.env.SAJU_QA_PLAYWRIGHT_PATH || path.join(root,'.sites-runtime/test-tools/node_modules/playwright/index.mjs')).href);
const dependencies=path.resolve(process.env.SAJU_QA_DEPENDENCY_ROOT || path.join(root,'node_modules'));
const {build}=await import(pathToFileURL(path.join(dependencies,'esbuild/lib/main.js')).href);
const {default:postcss}=await import(pathToFileURL(path.join(dependencies,'postcss/lib/postcss.js')).href);
const {default:tailwindcss}=await import(pathToFileURL(path.join(dependencies,'tailwindcss/lib/index.js')).href);
const {default:autoprefixer}=await import(pathToFileURL(path.join(dependencies,'autoprefixer/lib/autoprefixer.js')).href);
const {default:ts}=await import(pathToFileURL(path.join(dependencies,'typescript/lib/typescript.js')).href);
const source=await fs.readFile(path.join(root,'components/planet/CosmicPassportModal.tsx'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const entry=path.join(result,'harness.jsx');
await fs.writeFile(entry,`
import React from 'react';
import {createRoot} from 'react-dom/client';
import Passport from './components/planet/CosmicPassportModal.tsx';
import {TEN_STEM_SPIRITS} from './lib/planet/spirit-profiles.ts';
const renderer=createRoot(document.getElementById('root'));
const person=Object.freeze({id:'synthetic-passport-image-error',name:'QA Snapshot',birthDate:'2000.1.1',relationType:'mentor',relationTitle:'QA',dayMaster:'QA',elementMatch:'QA',affinityScore:100,advice:'Synthetic only',pillars:{dayKey:Object.keys(TEN_STEM_SPIRITS)[0]+'자'}});
const onClose=()=>renderer.render(null);
window.mountPassport=snapshot=>renderer.render(React.createElement(Passport,{person,isOpen:true,onClose,planetSnapshotUrl:snapshot}));
window.goodSnapshot=()=>{const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d');x.fillStyle='#45aa96';x.fillRect(0,0,32,32);x.fillStyle='#ffe0a8';x.fillRect(8,8,16,16);return c.toDataURL('image/png');};
window.ready=true;
`,{flag:'wx'});
const bundle=await build({absWorkingDir:root,stdin:{contents:await fs.readFile(entry,'utf8'),resolveDir:root,sourcefile:'synthetic-passport-entry.jsx',loader:'jsx'},bundle:true,write:false,format:'esm',platform:'browser',nodePaths:[dependencies],alias:{'@':root,react:path.join(dependencies,'react'),'react-dom':path.join(dependencies,'react-dom'),'lucide-react':path.join(dependencies,'lucide-react'),'korean-lunar-calendar':path.join(dependencies,'korean-lunar-calendar')},define:{'process.env.NODE_ENV':"'production'"}});
const configSource=ts.transpileModule(await fs.readFile(path.join(root,'tailwind.config.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {default:cssConfig}=await import('data:text/javascript;base64,'+Buffer.from(configSource).toString('base64'));
cssConfig.content=cssConfig.content.map(pattern=>path.resolve(root,pattern));
const css=await postcss([tailwindcss(cssConfig),autoprefixer]).process(await fs.readFile(path.join(root,'app/globals.css'),'utf8'),{from:path.join(root,'app/globals.css')});
await fs.writeFile(path.join(result,'harness-bundle.js'),bundle.outputFiles[0].contents,{flag:'wx'});
await fs.writeFile(path.join(result,'harness-styles.css'),css.css,{flag:'wx'});
const html='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic Passport Image Error QA</title><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script type="module" src="/entry.js"></script></body></html>';
const server=createServer((req,res)=>{
 if(req.method!=='GET'){res.statusCode=405;res.end();return;}
 if(req.url==='/__passport-image-error'){res.setHeader('Content-Type','text/html');res.end(html);return;}
 if(req.url==='/entry.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle.outputFiles[0].contents);return;}
 if(req.url==='/styles.css'){res.setHeader('Content-Type','text/css');res.end(css.css);return;}
 if(req.url==='/invalid-snapshot.png'){res.setHeader('Content-Type','image/png');res.setHeader('Cache-Control','no-store');res.end('invalid-png-synthetic-fixture');return;}
 if(req.url==='/favicon.ico'){res.statusCode=204;res.end();return;}
 res.statusCode=404;res.end();
});
const checks=[],outbound=[],pageErrors=[],consoleErrors=[];
let context;
try{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const address=server.address();const base='http://127.0.0.1:'+address.port;
 context=await chromium.launchPersistentContext(path.join(scratch,'chrome-profile-'+phase),{headless:true,
  executablePath:process.env.SAJU_QA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  viewport:{width:390,height:844},acceptDownloads:true,downloadsPath:path.join(scratch,'browser-downloads-'+phase),
  args:['--disable-background-networking','--disable-component-update','--no-first-run']});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if((url.origin===base && req.method()==='GET') || ['data:','blob:'].includes(url.protocol))await route.continue();
  else{outbound.push({url:req.url(),method:req.method()});await route.abort();}
 });
 await context.addInitScript(()=>{
  window.imageEvents=[];window.downloadEvents=[];
  const NativeImage=window.Image;
  window.Image=function(...args){const image=new NativeImage(...args);for(const type of ['load','error'])image.addEventListener(type,event=>window.imageEvents.push({type,trusted:event.isTrusted,complete:image.complete,naturalWidth:image.naturalWidth,src:image.src}));return image;};
  window.Image.prototype=NativeImage.prototype;
  let seed=12345;window.resetStarSeed=()=>{seed=12345;};
  Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 });
 async function view(width=390){
  const page=await context.newPage();await page.setViewportSize({width,height:width===390?844:1000});
  const alerts=[],downloads=[];
  page.on('dialog',async dialog=>{alerts.push(dialog.message());await dialog.dismiss();});
  page.on('download',download=>downloads.push(download.suggestedFilename()));
  page.on('pageerror',error=>pageErrors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  await page.goto(base+'/__passport-image-error',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.ready===true);
  return {page,alerts,downloads,button:page.getByRole('button',{name:/9:16/})};
 }
 async function mount(v,kind){
  const snapshot=kind==='valid'?await v.page.evaluate(()=>window.goodSnapshot()):kind==='invalid-http'?base+'/invalid-snapshot.png':kind==='invalid-data'?'data:image/png;base64,aW52YWxpZC1wbmc=':undefined;
  await v.page.evaluate(snapshot=>window.mountPassport(snapshot),snapshot);await v.page.getByRole('dialog').waitFor();return snapshot;
 }
 async function errorState(v,name){
  await v.page.evaluate(()=>window.resetStarSeed());await v.button.click();
  await v.page.waitForFunction(()=>window.imageEvents.some(event=>event.type==='error' && event.trusted),null,{timeout:4000});
  await v.page.waitForTimeout(500);
  const state={disabled:await v.button.isDisabled(),label:await v.button.textContent(),native_image_events:await v.page.evaluate(()=>window.imageEvents),alerts:[...v.alerts],downloads:[...v.downloads]};
  await v.page.screenshot({path:path.join(result,name+'.png'),fullPage:true});return state;
 }
 async function exportPNG(v,name){
  await v.page.evaluate(()=>window.resetStarSeed());
  const pending=v.page.waitForEvent('download',{timeout:8000});await v.button.click();const download=await pending;
  const file=path.join(result,name+'.png');await download.saveAs(file);await v.page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(button=>button.textContent.includes('9:16')).disabled);
  const bytes=await fs.readFile(file);assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),1080);assert.equal(bytes.readUInt32BE(20),1920);
  const pixels=await v.page.evaluate(async data=>{const blob=await(await fetch('data:image/png;base64,'+data)).blob();const image=await createImageBitmap(blob);const canvas=new OffscreenCanvas(image.width,image.height);const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const rgba=ctx.getImageData(0,0,image.width,image.height).data;const digest=await crypto.subtle.digest('SHA-256',rgba);image.close();return Array.from(new Uint8Array(digest)).map(n=>n.toString(16).padStart(2,'0')).join('');},bytes.toString('base64'));
  return {file:path.basename(file),filename:download.suggestedFilename(),bytes:bytes.length,sha256:sha(bytes),decoded_rgba_sha256:pixels,width:1080,height:1920};
 }
 async function check(name,run){try{checks.push({name,status:'PASS',details:await run()});}catch(error){checks.push({name,status:'FAIL',error:error.message,details:error.details || null});}}
 const assertRecovered=state=>{try{assert.equal(state.disabled,false,'Download button must unlock after a native image error');assert.equal(state.alerts.length,1,'Existing save-error alert must appear once');assert.equal(state.downloads.length,0,'Failed image must not create a PNG');}catch(error){error.details=state;throw error;}};
 await check('corrupt-data-uri-image-error-recovers',async()=>{const v=await view();try{await mount(v,'invalid-data');const state=await errorState(v,'data-error-390');assertRecovered(state);return state;}finally{await v.page.close();}});
 await check('http-image-decode-error-recovers-wide',async()=>{const v=await view(1440);try{await mount(v,'invalid-http');const state=await errorState(v,'http-error-1440');assertRecovered(state);return state;}finally{await v.page.close();}});
 await check('same-open-dialog-can-retry-with-valid-snapshot',async()=>{const v=await view();try{await mount(v,'invalid-data');const state=await errorState(v,'before-retry-390');assertRecovered(state);await mount(v,'valid');const exported=await exportPNG(v,'retry-valid-export');assert.equal(v.alerts.length,1);assert((await v.page.evaluate(()=>window.imageEvents)).some(e=>e.type==='load' && e.trusted));await v.page.screenshot({path:path.join(result,'recovered-dialog-390.png'),fullPage:true});return {error_state:state,exported};}finally{await v.page.close();}});
 await check('valid-cached-snapshot-can-export-twice',async()=>{const v=await view(1440);try{await mount(v,'valid');const first=await exportPNG(v,'valid-first'),second=await exportPNG(v,'valid-cached-second');assert.equal(first.decoded_rgba_sha256,second.decoded_rgba_sha256);assert.equal(v.alerts.length,0);const events=await v.page.evaluate(()=>window.imageEvents);assert.equal(events.filter(e=>e.type==='load' && e.trusted).length,2);assert.equal(events.filter(e=>e.type==='error').length,0);return {first,second,native_image_events:events};}finally{await v.page.close();}});
 await check('missing-snapshot-fallback-still-exports',async()=>{const v=await view();try{await mount(v,'none');const exported=await exportPNG(v,'no-snapshot-fallback');assert.equal(v.alerts.length,0);assert.equal((await v.page.evaluate(()=>window.imageEvents)).length,0);return {exported};}finally{await v.page.close();}});
 const passed=checks.filter(c=>c.status==='PASS').length,failed=checks.length-passed;
 const report={status:failed?'REPRODUCED_FAILURE':'PASS_NATIVE_CHROME_PASSPORT_IMAGE_ERROR_RECOVERY',phase,application_source_sha256:sha(source),harness_bundle_sha256:sha(bundle.outputFiles[0].contents),harness_css_sha256:sha(css.css),checks,passed,failed,browser_version:context.browser()?.version() || 'persistent Chrome',page_errors:pageErrors,outbound_requests:outbound,console_errors:consoleErrors,native_image_error_fixture:'Real trusted Chromium image decode errors; no synthetic dispatch and no stubbed Image load/error or Canvas.',star_randomness_seeded_for_pixel_comparison:true,api_calls:0,database_reads_or_writes:0,auth_or_clipboard_permissions_changed:false,limits:['Actual current React component bundled in production mode with actual Tailwind styles; no built full-app route, hosted auth, live DB, physical device or model rendering claim.','Only synthetic malformed PNG and valid 32px Canvas snapshot fixtures; no user images or personal data.']};
 assert.equal(pageErrors.length,0,'Unexpected page exceptions');assert.equal(outbound.length,0,'Unexpected outbound requests');
 await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:report.status,phase,passed,failed,page_errors:pageErrors.length,outbound_requests:outbound.length,report:reportPath},null,2));
 if(failed)process.exitCode=1;
}finally{if(context)await context.close();await new Promise(resolve=>server.close(resolve));}
