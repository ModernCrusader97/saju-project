import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
const root=process.cwd(),output=path.resolve('outputs/spirit-attachments-browser');
await fs.mkdir(output,{recursive:true});
const harness=path.join(output,'harness.mjs');
await fs.writeFile(harness,`
import * as THREE from 'three';
import {loadApprovedSpirit} from '../../lib/planet/approved-jade-spirit';
import {createStudioEnvironment} from '../../lib/planet/scene-environment';
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(480,560);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
document.body.style.cssText='margin:0;background:#edf2ea';document.body.append(renderer.domElement);
const scene=new THREE.Scene(),environment=createStudioEnvironment(renderer);scene.environment=environment.texture;scene.environmentIntensity=1.05;scene.background=new THREE.Color('#edf2ea');
scene.add(new THREE.HemisphereLight(0xf4f8fc,0x26343b,.85));
for(const [color,intensity,pos] of [[0xfff1d9,2.1,[-3,4,4]],[0xc1e4f0,.8,[4,1,2]],[0xf5fbff,1.8,[0,3,-3]]]){const light=new THREE.DirectionalLight(color,intensity);light.position.set(...pos);if(pos[0]===-3){light.castShadow=true;light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-2.5,right:2.5,top:3,bottom:-2,near:.1,far:16});light.shadow.bias=-.0002;}scene.add(light);}
const floor=new THREE.Mesh(new THREE.PlaneGeometry(12,12),new THREE.ShadowMaterial({color:0x1c4836,opacity:.09}));floor.rotation.x=-Math.PI/2;floor.position.y=-.016;floor.receiveShadow=true;scene.add(floor);
const camera=new THREE.PerspectiveCamera(38,480/560,.1,40);camera.position.set(0,1.7,5.7);camera.lookAt(0,1.24,0);
const errors=[];renderer.debug.onShaderError=(gl,p,v,f)=>errors.push({program:gl.getProgramInfoLog(p),vertex:gl.getShaderInfoLog(v),fragment:gl.getShaderInfoLog(f)});
let spirit;
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
const snapshot=()=>{const result=[];spirit.propGroup.traverse(o=>{if(o.isInstancedMesh)result.push({name:o.name,count:o.count,matrix:Array.from(o.instanceMatrix.array),particles:o.geometry.getAttribute('aParticle')?Array.from(o.geometry.getAttribute('aParticle').array):undefined});});return result;};
async function metadata(){const gl=renderer.getContext(),pixels=new Uint8Array(480*560*4);gl.readPixels(0,0,480,560,gl.RGBA,gl.UNSIGNED_BYTE,pixels);const snap=snapshot(),active=snap.map(o=>({name:o.name,count:o.count,visible:o.matrix.filter((_,i)=>i%16===0).filter(v=>Math.abs(v)>1e-8).length}));return{pixels:await hash(pixels),snapshot:await hash(new TextEncoder().encode(JSON.stringify(snap))),active,diagnostics:spirit.propGroup.userData.surfaceAccentDiagnostics,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,bodyHash:await hash(spirit.bodyMesh.geometry.getAttribute('position').array),uvHash:await hash(spirit.bodyMesh.geometry.getAttribute('uv').array),morph:spirit.bodyMesh.morphTargetInfluences,errors,glError:gl.getError()};}
window.attachmentQA={async load(day,quality){spirit?.dispose();spirit=await loadApprovedSpirit(day,'병인',quality);scene.add(spirit.group);spirit.reset();spirit.update(0,0,camera);renderer.render(scene,camera);return metadata();},
async frame(time,angle=0,tilt=0){spirit.avatarPivot.rotation.y=angle;spirit.avatarPivot.rotation.x=tilt;spirit.update(time,0,camera);renderer.render(scene,camera);return metadata();},
async masked(time,enabled){spirit.avatarPivot.userData.surfaceAttachmentExclusions=enabled?[{id:'qa-local-accessory',shape:'box',min:[-.1,.65,-2],max:[1.25,2.4,2]}]:[];spirit.update(time,0,camera);renderer.render(scene,camera);return metadata();},
wave(){spirit.triggerReaction();},async reset(){spirit.reset();spirit.update(0,0,camera);renderer.render(scene,camera);return metadata();},
performance(){const times=[];for(let i=0;i<120;i++){const start=performance.now();spirit.update(1.5+i/30,1/30,camera);times.push(performance.now()-start);}times.sort((a,b)=>a-b);return{medianMs:times[60],p95Ms:times[114],scope:'CPU update only on Chromium SwiftShader host; not physical mobile FPS'};},
async dispose(){spirit?.dispose();spirit=null;renderer.render(scene,camera);return{geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures};}};
`);
const server=await createServer({root,configFile:false,logLevel:'error',server:{host:'127.0.0.1',port:0},optimizeDeps:{noDiscovery:true},plugins:[{name:'attachment-qa',configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url!=='/__attachments')return next();res.setHeader('Content-Type','text/html');res.end('<html><body><script type="module" src="/'+path.relative(root,harness).replaceAll('\\\\','/')+'"></script></body></html>');});}}]});
let browser;const errors=[],outbound=[],results=[],frames=[],timings=[];let memory;
try{await server.listen();const origin=server.resolvedUrls.local[0];const{chromium}=await import(pathToFileURL(process.env.SAJU_QA_PLAYWRIGHT_PATH||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:480,height:560}});
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===new URL(origin).origin||['data:','blob:'].includes(url.protocol))return route.continue();outbound.push(url.origin);return route.abort();});
await page.goto(origin+'__attachments');await page.waitForFunction(()=>!!window.attachmentQA);
const stems=['갑자','을축','병인','정묘','무진','기사','경오','신미','임신','계유'];
for(const quality of ['low','high'])for(const day of stems){
const original=await page.evaluate(args=>window.attachmentQA.load(...args),[day,quality]);assert.equal(original.bodyHash,'f7e39c85723b4220d0e69161e4405c3232d514b18be56e8a3854ec6fff48da8b');assert.equal(original.uvHash,'f3300a24812551e09c6b6a4bc31795feb19c80dc22cf1708cda7a64890e9539c');
assert(original.diagnostics.budget.drawCalls<=6);assert(original.diagnostics.budget.instances<1200);assert(original.diagnostics.budget.triangles<30000);
const first=await page.evaluate(()=>window.attachmentQA.frame(2.25));const again=await page.evaluate(()=>window.attachmentQA.frame(2.25));assert.equal(again.snapshot,first.snapshot);assert.equal(again.pixels,first.pixels);
const moving=await page.evaluate(()=>window.attachmentQA.frame(3.1));const backwards=await page.evaluate(()=>window.attachmentQA.frame(2.25));assert.equal(backwards.snapshot,first.snapshot);assert.equal(backwards.pixels,first.pixels);
if(['갑','을','병','정','무','계'].includes(day[0]))assert.notEqual(moving.snapshot,first.snapshot,'Actual effect matrices/particle state must move');
const mask=await page.evaluate(()=>window.attachmentQA.masked(2.25,true));const clear=await page.evaluate(()=>window.attachmentQA.masked(2.25,false));assert.equal(clear.snapshot,first.snapshot);assert.equal(clear.pixels,first.pixels);
if(['갑','을','병','정','무','계'].includes(day[0]))assert.notEqual(mask.snapshot,first.snapshot,'A local accessory must suppress overlapping attachments');
const rotated=await page.evaluate(()=>window.attachmentQA.frame(2.25,Math.PI/2,.15));assert.notEqual(rotated.pixels,first.pixels);
const reset=await page.evaluate(()=>window.attachmentQA.reset());assert.equal(reset.snapshot,original.snapshot);assert.equal(reset.pixels,original.pixels);
await page.evaluate(()=>window.attachmentQA.frame(2.25));await page.evaluate(()=>window.attachmentQA.wave());const waving=await page.evaluate(()=>window.attachmentQA.frame(3.0,.6));assert(waving.morph[0]>0&&waving.morph[0]<=.45,'Existing attached arm wave must be active and bounded');if(quality==='high'){const file=day[0]+'-wave.png';await page.screenshot({path:path.join(output,file)});frames.push({day,label:'wave',time:3.0,angle:.6,pixels:waving.pixels,file});}const idle=await page.evaluate(()=>window.attachmentQA.frame(6.5));assert.equal(idle.morph[0],0,'Wave returns to idle');
for(const result of [original,first,moving,mask,clear,rotated,reset,waving,idle]){assert.deepEqual(result.errors,[]);assert.equal(result.glError,0);}
results.push({day,quality,mode:original.diagnostics.mode,budget:original.diagnostics.budget,frames:{initial:original.pixels,active:first.pixels,mask:mask.pixels,wave:waving.pixels},waveWeight:waving.morph[0],limits:original.diagnostics.limitations});
if(quality==='high'&&['갑','을','병','정','무','계'].includes(day[0])){
for(const [label,time,angle]of [['front',2.25,0],['side',2.25,Math.PI/2],['motion-a',1.8,.6],['motion-b',2.8,.6]]){const frame=await page.evaluate(args=>window.attachmentQA.frame(...args),[time,angle]);const file=day[0]+'-'+label+'.png';await page.screenshot({path:path.join(output,file)});frames.push({day,label,time,angle,pixels:frame.pixels,file});}
}
timings.push({day,quality,...await page.evaluate(()=>window.attachmentQA.performance())});
console.log('PASS '+day+' '+quality);
}
memory=await page.evaluate(()=>window.attachmentQA.dispose());assert.equal(memory.geometries,1,'Only owned QA floor geometry remains');assert.deepEqual(errors,[]);assert.deepEqual(outbound,[]);
}catch(e){errors.push(e.stack||String(e));process.exitCode=1;console.error(e);}
finally{await fs.writeFile(path.join(output,'report.json'),JSON.stringify({status:process.exitCode?'FAIL':'PASS',cases:results.length,results,frames,timings,memory,errors,outbound,harnessSHA256:createHash('sha256').update(await fs.readFile(harness)).digest('hex'),limits:['Actual Three WebGL with production loader/GLB/materials/shadow lighting; Chromium SwiftShader','No physical mobile GPU performance certification','No hosted signed-in screenshot; no hosted access bypass']},null,2)+'\n');await browser?.close();await server.close();}
