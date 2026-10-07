import fs from 'node:fs/promises';import path from 'node:path';import Module,{createRequire} from 'node:module';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';import ts from 'typescript';import React,{act} from 'react';
const root=process.cwd();const {JSDOM}=await import(pathToFileURL(process.env.SAJU_QA_JSDOM_PATH||path.join(root,'.sites-runtime/test-tools/node_modules/jsdom/lib/api.js')).href);
const dom=new JSDOM('<!doctype html><body><button id="opener">열기</button><div id="root"></div></body>',{url:'http://local.test/saved'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});dom.window.HTMLElement.prototype.scrollIntoView=()=>{};
const {createRoot}=await import('react-dom/client');const require=createRequire(import.meta.url);const requests=[];globalThis.fetch=(url,options={})=>new Promise(resolve=>requests.push({url,options,resolve}));
async function compile(file,overrides={}){const absolute=path.join(root,file);const code=ts.transpileModule(await fs.readFile(absolute,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;const mod=new Module(absolute);mod.filename=absolute;mod.paths=Module._nodeModulePaths(path.dirname(absolute));mod.require=n=>Object.hasOwn(overrides,n)?overrides[n]:require(n);mod._compile(code,absolute);return mod.exports;}
const reader=await compile('lib/http-client.ts');let focusHook={};try{focusHook=await compile('hooks/use-dialog-focus.ts');}catch(error){if(error.code!=='ENOENT')throw error;}
const overrides={'@/lib/http-client':reader,'@/hooks/use-dialog-focus':focusHook,'@/lib/saju/input':{HOUR_PERIODS:[{hour:13,label:'합성 시간'}]}};
const Birth=(await compile('components/SajuInputModal.tsx',overrides)).default;const Chat=(await compile('components/AskDoryeongModal.tsx',overrides)).default;
const checks=[];let renderer=createRoot(document.getElementById('root'));
const key=async(el,key,shiftKey=false)=>act(async()=>el.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key,shiftKey,bubbles:true,cancelable:true})));
const targets=dialog=>[...dialog.querySelectorAll('button,input,select,textarea,a[href]')].filter(el=>!el.disabled&&!el.hidden);
try{for(const [name,Component,props,closeName] of [['birth',Birth,{categoryTitle:'합성 사주 입력'},'입력창 닫기'],['chat',Chat,{fortune:{id:'modal-fixture',analysis:{name:'합성 사용자'}}},'대화 닫기']]){
 let closed=0;const onClose=()=>closed++;const opener=document.getElementById('opener');opener.focus();
 await act(async()=>renderer.render(React.createElement(Component,{...props,isOpen:true,onClose})));
 const dialog=document.querySelector('[role="dialog"]');assert(dialog,`${name}: overlay must expose dialog semantics`);assert.equal(dialog.getAttribute('aria-modal'),'true');
 const title=document.getElementById(dialog.getAttribute('aria-labelledby'));assert(title&&title.textContent.trim(),`${name}: dialog must have a visible accessible title`);assert(document.activeElement===dialog,`${name}: focus must enter the opened dialog`);
 const close=dialog.querySelector(`button[aria-label="${closeName}"]`);assert(close);assert(close.classList.contains('min-h-11')&&close.classList.contains('min-w-11'),`${name}: close control must declare a 44px minimum target`);
 if(name==='chat'){await act(async()=>requests.at(-1).resolve(Response.json({chats:[]})));}
 let focusables=targets(dialog);const first=focusables[0],last=focusables.at(-1);assert(first&&last);
 last.focus();await key(last,'Tab');assert(document.activeElement===first,`${name}: Tab must wrap inside dialog`);
 first.focus();await key(first,'Tab',true);assert(document.activeElement===last,`${name}: Shift+Tab must wrap inside dialog`);
 await act(async()=>renderer.render(React.createElement(Component,{...props,isOpen:true,onClose:()=>{closed+=10;}})));
 assert(document.activeElement===last,`${name}: callback changes must not steal focus`);
 await act(async()=>last.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',isComposing:true,bubbles:true,cancelable:true})));assert.equal(closed,0,`${name}: IME composition Escape must not dismiss the dialog`);
 await key(last,'Escape');assert.equal(closed,10,`${name}: Escape must call the latest close handler once`);
 await act(async()=>renderer.render(React.createElement(Component,{...props,isOpen:false,onClose})));assert(document.activeElement===opener,`${name}: closing must restore opener focus`);
 checks.push(`${name}: named dialog/focus entry/Tab wrap/latest Escape/restore/44px close declaration`);
 await act(async()=>renderer.unmount());renderer=createRoot(document.getElementById('root'));
 }
 function Dynamic({mode}){const ref=React.useRef(null);focusHook.useDialogFocus(true,ref,()=>{});return React.createElement('div',{ref,role:'dialog',tabIndex:-1},mode==='removed'?null:React.createElement('input',{id:'dynamic-field',disabled:mode==='disabled'}),React.createElement('button',{id:'dynamic-last'},'last'));}
 await act(async()=>renderer.render(React.createElement(Dynamic,{mode:'normal'})));const dynamic=document.querySelector('[role="dialog"]');
 document.getElementById('dynamic-field').focus();await act(async()=>renderer.render(React.createElement(Dynamic,{mode:'disabled'})));await key(document.getElementById('dynamic-field'),'Tab');assert(document.activeElement===document.getElementById('dynamic-last'),'A disabled active control must not break Tab containment');
 await act(async()=>renderer.render(React.createElement(Dynamic,{mode:'normal'})));document.getElementById('dynamic-field').focus();await act(async()=>renderer.render(React.createElement(Dynamic,{mode:'removed'})));assert(document.activeElement===dynamic,'Removing the focused form during loading must keep focus in the dialog');
 checks.push('dynamic disabled and removed controls retain focus containment');
 const result={status:'PASS',checks,limits:['JSDOM validates focus/event/semantic behavior, not real browser layout or assistive technology','44px is the CSS minimum declaration, not a device measurement','No API writes or real-user data']};await fs.mkdir('outputs/modal-accessibility',{recursive:true});await fs.writeFile('outputs/modal-accessibility/dom-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await act(async()=>renderer.unmount());dom.window.close();}
