import {Miniflare} from 'miniflare';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const outbound=[];
async function walk(dir){let out=[];for(const entry of await fs.readdir(dir,{withFileTypes:true})){const path=dir+'/'+entry.name;if(entry.isDirectory())out.push(...await walk(path));else if(/\.(m?js)$/.test(entry.name))out.push(path);}return out;}
const paths=await walk(process.cwd()+'/dist/server');
const entry=process.cwd()+'/dist/server/index.js';
const modules=[entry,...paths.filter(p=>p!==entry)].map(path=>({type:'ESModule',path}));
const mf=new Miniflare({rootPath:process.cwd(),modules,modulesRoot:'dist/server',compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],host:'127.0.0.1',port:0,cf:false,logRequests:false,telemetry:{enabled:false},bindings:{GEMINI_API_KEY:'not-a-real-test-key'},d1Databases:{DB:'saju-integration-test'},d1Persist:false,assets:{directory:'dist/client',routerConfig:{has_user_worker:true}},outboundService:async request=>{outbound.push(new URL(request.url).hostname);const body=await request.json();const input=JSON.parse(body.contents[0].parts[0].text);return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({factEcho:input.facts,summary:'합성 자료에 대한 모의 설명입니다.',basisFactIds:Object.keys(input.facts),uncertainty:'해석의 정확성을 보장하지 않습니다.'})}]}}],modelVersion:'mock-gemini',usageMetadata:{promptTokenCount:1,candidatesTokenCount:1,totalTokenCount:2}});}});
const owner={'oai-authenticated-user-id':'fixture-owner','oai-authenticated-user-email':'owner@example.invalid'};
const other={'oai-authenticated-user-id':'fixture-other','oai-authenticated-user-email':'other@example.invalid'};
const checks=[];
async function req(path,body,headers=owner){const res=await mf.dispatchFetch('http://preview.test'+path,{method:body===undefined?'GET':'POST',headers:{...headers,...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});const text=await res.text();if(!text.trim())throw new Error('Empty response: '+path+' status='+res.status+' location='+res.headers.get('location'));let data;try{data=JSON.parse(text);}catch{throw new Error('Non-JSON response: '+path+' status='+res.status+' body='+text.slice(0,500));}return{res,data};}
try{
 const d1=await mf.getD1Database('DB');
 for(const file of (await fs.readdir('drizzle')).filter(x=>x.endsWith('.sql')).sort())for(const sql of (await fs.readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint'))if(sql.trim())await d1.prepare(sql.trim()).run();
 const input={name:'Preview Test',gender:'male',birthYear:2000,birthMonth:1,birthDay:1,birthHour:12,birthMinute:30,isUnknownTime:false,calendarType:'solar'};
 let r=await req('/api/saju',input);assert.equal(r.res.status,200,JSON.stringify(r.data));const id=r.data.fortune.id;assert.equal(r.data.fortune.generation.mode,'template');checks.push('template fortune creation');
 r=await req('/api/saju');assert(r.data.fortunes.some(x=>x.id===id));checks.push('saved list');
 r=await req('/api/saju/'+id);assert.equal(r.data.fortune.id,id);checks.push('saved detail');
 r=await req('/api/saju/'+id+'/chat',{question:'This is a synthetic test.'});assert.equal(r.res.status,200,JSON.stringify(r.data));assert.equal(typeof r.data.reply,'string');
 r=await req('/api/saju/'+id);assert.deepEqual(r.data.chats.map(x=>x.role),['user','doryeong']);checks.push('chat persistence');
 r=await req('/api/saju',{...input,birthMonth:2,birthDay:30});assert.equal(r.res.status,400);checks.push('invalid date rejected');
 r=await req('/api/saju',undefined,{});assert.equal(r.res.status,401);checks.push('anonymous API rejected');
 r=await req('/api/saju',undefined,other);assert.deepEqual(r.data.fortunes,[]);r=await req('/api/saju/'+id,undefined,other);assert.equal(r.res.status,404);checks.push('cross-user fortune isolation');
 r=await req('/api/guin',input);assert.equal(r.res.status,200,JSON.stringify(r.data));const mapId=r.data.guinMap.id;
 const friends=await Promise.all(['Friend One','Friend Two'].map(friendName=>req('/api/guin/'+mapId,{...input,friendName})));friends.forEach(x=>assert.equal(x.res.status,200,JSON.stringify(x.data)));
 r=await req('/api/guin/'+mapId);assert.equal(r.data.guinMap.guins.length,3);checks.push('map persistence and concurrent friend inserts');
 r=await req('/api/guin/'+mapId,undefined,other);assert.equal(r.res.status,404);r=await req('/api/guin/'+mapId,{...input,friendName:'Forbidden'},other);assert.equal(r.res.status,404);checks.push('cross-user map isolation');
 for(const path of ['/','/daily','/manse','/planet','/lab','/ai-test','/saved','/guin','/guin/'+mapId]){const res=await mf.dispatchFetch('http://preview.test'+path,{headers:owner});const html=await res.text();assert.equal(res.status,200,html.slice(0,300));assert(html.includes('<html'));if(path==='/'){const urls=[...html.matchAll(/(?:src|href)="([^" ]+\.(?:js|css)(?:\?[^" ]*)?)"/g)].map(x=>x[1]).filter(x=>x.startsWith('/'));for(const url of [...new Set(urls)].slice(0,5)){const asset=await mf.dispatchFetch('http://preview.test'+url);assert.equal(asset.status,200,url);}checks.push('client assets');}checks.push('page '+path);}
 assert.equal(outbound.length,0,JSON.stringify(outbound));checks.push('ordinary flows make zero outbound requests');
 r=await req('/api/ai-test',{case:'known_time',name:'User-provided data'});assert.equal(r.res.status,400);assert.equal(outbound.length,0);checks.push('AI test rejects extra personal-data fields');
 for(let i=0;i<6;i++){r=await req('/api/ai-test',{case:i%2?'unknown_time':'known_time'});assert.equal(r.res.status,200,JSON.stringify(r.data));assert.equal(r.data.valid,true);if(i%2)assert.equal(r.data.facts.hourPillar,'unknown');}
 assert.equal(outbound.length,6);assert(outbound.every(x=>x==='generativelanguage.googleapis.com'));checks.push('fixed Gemini fixtures and fact validation (mock-only)');
 r=await req('/api/ai-test',{case:'known_time'});assert.equal(r.res.status,429);assert.equal(outbound.length,6);checks.push('six-call daily cap stops further calls');
 console.log(JSON.stringify({status:'PASS',count:checks.length,checks,limits:['No browser/WebGL/touch validation','Synthetic local identity; hosted login not exercised','Fresh local test database only']},null,2));
}catch(error){console.error(error);process.exitCode=1;}finally{await mf.dispose();}
