import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {createServer} from '/workspace/saju-project/node_modules/vite/dist/node/index.js';
import {chromium} from '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const root='/workspace/saju-spirit-dew-coalescence-20261010',out='/tmp/saju-face-duplicate-investigation-20261010';
const sha=b=>createHash('sha256').update(b).digest('hex');
const sources=['lib/planet/approved-jade-spirit.ts','lib/planet/approved-spirit-motion.ts','lib/planet/approved-stem-materials.ts','lib/planet/scene-environment.ts','components/planet/ElementalSpiritCanvas.tsx','lib/planet/surface-sliding-dew.ts','public/spirits/jade-v002/body.glb','node_modules/three/src/renderers/WebGLRenderer.js','node_modules/three/src/renderers/shaders/ShaderChunk/transmission_pars_fragment.glsl.js'];
const sourceHashes=Object.fromEntries(await Promise.all(sources.map(async f=>[f,sha(await fs.readFile(path.join(root,f)))])));
const errors=[],outbound=[],cases=[],comparisons=[],transmissionBuffers=[];
const server=await createServer({root,configFile:false,logLevel:'error',resolve:{alias:{'@face-loader':path.join(root,'lib/planet/approved-jade-spirit.ts'),'@face-environment':path.join(root,'lib/planet/scene-environment.ts'),'three/addons':path.join(root,'node_modules/three/examples/jsm'),'three':path.join(root,'node_modules/three/build/three.module.js')}},server:{host:'127.0.0.1',port:0,fs:{allow:[root,out,'/workspace/saju-project/node_modules']}},optimizeDeps:{noDiscovery:true},plugins:[{name:'face-duplicate-qa',configureServer(s){s.middlewares.use((req,res,next)=>{if(!req.url?.startsWith('/__face'))return next();res.setHeader('Content-Type','text/html');res.end('<html><body><script type="module" src="/@fs'+out+'/page.mjs"></script></body></html>');});}}]});
let browser;
const fileKey=s=>`${s.day}-${s.quality}-${s.time.toFixed(5)}-${s.close?'close':'full'}-${s.angle.toFixed(3)}-${s.pixelRatio}-${s.mode}`;
async function capture(page,args){const s=await page.evaluate(a=>window.faceQA.frame(...a),args);assert.equal(s.glError,0);assert.deepEqual(s.errors,[]);const file=fileKey(s)+'.png';const b=Buffer.from(s.png.split(',')[1],'base64');delete s.png;await fs.writeFile(path.join(out,file),b);s.file=file;s.pngSHA256=sha(b);return s;}
async function buffer(page,s){const rt=await page.evaluate(()=>window.faceQA.transmission());assert(rt);assert.equal(rt.glError,0);const file=fileKey(s)+'-transmission-buffer.png';const b=Buffer.from(rt.png.split(',')[1],'base64');delete rt.png;await fs.writeFile(path.join(out,file),b);transmissionBuffers.push({day:s.day,quality:s.quality,mode:s.mode,time:s.time,file,pngSHA256:sha(b),...rt});}
function assertSamePose(a,b){assert.deepEqual(a.geometryHashes,b.geometryHashes);assert.deepEqual(a.camera,b.camera);assert.deepEqual(a.bodyMorphs,b.bodyMorphs);assert.equal(a.bodyNativeTime,b.bodyNativeTime);assert.deepEqual(a.size,b.size);
for(const x of a.meshes){const y=b.meshes.find(o=>o.name===x.name);assert.deepEqual(x.matrix,y.matrix);assert.deepEqual(x.position,y.position);assert.deepEqual(x.scale,y.scale);assert.deepEqual(x.bounds,y.bounds);assert.equal(x.castShadow,y.castShadow);assert.equal(x.receiveShadow,y.receiveShadow);}}
const tempo={'임신':1.11,'계해':1.17,'신해':1.03,'기사':1.08};
const candidate='face-after-transmission-water';
async function writeProgress(){await fs.writeFile(path.join(out,'regression-progress.json'),JSON.stringify({sourceHashes,cases,comparisons,transmissionBuffers,errors,outbound},null,2)+'\n');}
try{await server.listen();const origin=server.resolvedUrls.local[0];browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
for(const quality of['high','low']){const page=await browser.newPage({viewport:{width:640,height:760}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===new URL(origin).origin||['data:','blob:'].includes(u.protocol))return route.continue();outbound.push(u.origin);return route.abort();});await page.goto(origin+'__face?antialias='+(quality==='high'));await page.waitForFunction(()=>!!window.faceQA);
for(const day of['임신','계해','신해','기사']){const loaded=await page.evaluate(a=>window.faceQA.load(...a),[day,quality]);assert.equal(loaded.faceNames.length,7);assert.equal(loaded.bodyReceiveShadow,false);console.log('Validate '+day+' '+quality);
for(const [close,time,angle,ratio]of[[false,0,0,1],[true,0,0,1],[true,5.8*tempo[day]-.14,0,1],[true,0,.55,1],[true,0,0,quality==='high'?1.75:1.35]]){
const original=await capture(page,['original',time,close,angle,ratio]);assert(original.meshes.filter(m=>m.name.match(/almond_gaze|small_eye_glint|expressive_brow|quiet_smile/)).every(m=>m.castShadow&&!m.receiveShadow));assert.equal(original.bodyNativeReceiveShadow,false);assert.equal(original.groundNativeReceiveShadow,true);assert.equal(original.groundLinkedShadowMap,true);
if(quality==='high'&&day==='임신'&&close&&time===0&&angle===0&&ratio===1)await buffer(page,original);
const faceOff=await capture(page,['face-caster-off',time,close,angle,ratio]);const faceCasterDifference=await page.evaluate(()=>window.faceQA.compare('original','face-caster-off'));if(day==='임신'||day==='계해')assert.equal(faceCasterDifference.changedPixels,0,'Face caster shadows cannot generate the reproduced water ghost');
const shadowOff=await capture(page,['shadow-off',time,close,angle,ratio]);assert.equal(shadowOff.groundLinkedShadowMap,false);assert.equal(shadowOff.bodyNativeReceiveShadow,null);const shadowDifference=await page.evaluate(()=>window.faceQA.compare('original','shadow-off'));
const fixed=await capture(page,[candidate,time,close,angle,ratio]);assertSamePose(original,fixed);assert.equal(fixed.bodyNativeReceiveShadow,false);assert.deepEqual(original.shadows,fixed.shadows);
const transmission=original.meshes.find(m=>m.name.includes('seamless_body')).material[0].transmission;
assert.equal(fixed.bodyNativeTransmission,original.bodyNativeTransmission);assert.equal(fixed.bodyNativeThickness,original.bodyNativeThickness);
if(day==='임신'||day==='계해'){assert.equal(fixed.passes.length,7);assert(fixed.passes.every(p=>p.target===null&&p.transparent&&p.colorWrite&&p.depthWrite));}
else assert.deepEqual(fixed.meshes.map(o=>o.material),original.meshes.map(o=>o.material));
if(transmission>0)assert.equal(original.passes.filter(p=>p.target!==null).length,7);else assert.equal(original.passes.filter(p=>p.target!==null).length,0);
const ghostDifference=await page.evaluate(m=>window.faceQA.compare('original',m),candidate);
if(day==='신해'||day==='기사')assert.equal(ghostDifference.changedPixels,0,'The untouched jade and silver paths remain pixel-identical');else assert(ghostDifference.changedPixels>0,'Existing water-body facial ghost changes under the exclusion control');
if(quality==='high'&&day==='임신'&&close&&time===0&&angle===0&&ratio===1)await buffer(page,fixed);
cases.push({day,quality,close,time,angle,ratio,loaded,original,faceOff,shadowOff,candidate:fixed,faceCasterDifference,shadowDifference,ghostDifference});
if(close&&time===0&&angle===0&&ratio===1){const suppressed=await capture(page,['face-exclude-offscreen',time,close,angle,ratio]);const candidateVsOffscreen=await page.evaluate(m=>window.faceQA.compare(m,'face-exclude-offscreen'),candidate);comparisons.push({day,quality,candidateVsOffscreen,suppressed});}
await writeProgress();}
}
await page.evaluate(()=>window.faceQA.dispose());await page.close();}
assert.deepEqual(errors,[]);assert.deepEqual(outbound,[]);console.log('PASS '+cases.length+' controlled pose cases, 4 materials, both quality modes');
}catch(e){errors.push(e.stack||String(e));process.exitCode=1;console.error(e);}finally{await fs.writeFile(path.join(out,'regression-report.json'),JSON.stringify({status:process.exitCode?'FAIL':'PASS',root,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourceHashes,harnessSHA256:sha(await fs.readFile(new URL(import.meta.url))),pageSHA256:sha(await fs.readFile(path.join(out,'page.mjs'))),cases,comparisons,transmissionBuffers,errors,outbound,limits:['Real approved loader/GLB/materials in local Chromium ANGLE SwiftShader. No inaccessible user screenshot or physical GPU was used.','Production body/face shadow receive flags and actual shader uniforms recorded. Matched absolute time/camera for all diagnostic controls.','Read-only diagnostic candidate; no product source edits, commits, pushes or deploys.','Full model geometry hashes, morphs, matrices, camera, transmission and thickness are checked identical between original and candidate.']},null,2)+'\n');await browser?.close();await server.close();}
