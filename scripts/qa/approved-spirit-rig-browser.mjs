import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createServer} from 'vite';
import {execFileSync} from 'node:child_process';

const root=process.cwd(),output=path.resolve('outputs/rigged-greeting/browser');await fs.mkdir(output,{recursive:true});
const baselineRoot=process.env.SAJU_RIG_BASELINE_ROOT||'/workspace/saju-spirit-fashion-dew-water-20261010';
const baselineLoader=path.join(baselineRoot,'lib/planet/approved-jade-spirit.ts');await fs.access(baselineLoader);
const harness=path.join(output,'harness.mjs');
await fs.writeFile(harness,`
import * as T from 'three';
import {loadApprovedSpirit as loadRig} from '/lib/planet/approved-jade-spirit';
import {loadApprovedSpirit as loadV32} from '/@fs/${baselineLoader}';
import {createStudioEnvironment} from '/lib/planet/scene-environment';
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(498,466);
renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.style.cssText='margin:0';document.body.append(renderer.domElement);
const gl=renderer.getContext();let deletedTextures=0;const deleteTexture=gl.deleteTexture.bind(gl);gl.deleteTexture=t=>{deletedTextures++;deleteTexture(t)};
const scene=new T.Scene();scene.background=new T.Color('#eef0ef');const environment=createStudioEnvironment(renderer);
scene.environment=environment.texture;scene.environmentIntensity=1.05;scene.add(new T.HemisphereLight(0xf4f8fc,0x26343b,.85));
for(const[c,i,p]of[[0xfff1d9,2.1,[-3,4,4]],[0xc1e4f0,.8,[4,1,2]],[0xf5fbff,1.8,[0,3,-3]]]){const l=new T.DirectionalLight(c,i);l.position.set(...p);
if(p[0]===-3){l.castShadow=true;l.shadow.mapSize.set(1024,1024);Object.assign(l.shadow.camera,{left:-2.5,right:2.5,top:3,bottom:-2,near:.1,far:16});l.shadow.bias=-.0002}scene.add(l)}
const floor=new T.Mesh(new T.PlaneGeometry(12,12),new T.ShadowMaterial({color:0x1c4836,opacity:.09}));floor.rotation.x=-Math.PI/2;floor.position.y=-.016;floor.receiveShadow=true;scene.add(floor);
const camera=new T.PerspectiveCamera(38,498/466,.1,40);camera.position.set(0,1.70,5.7);camera.lookAt(0,1.24,0);
let spirit,variant,day,quality,hashes,release;const errors=[];renderer.debug.onShaderError=()=>errors.push('shader compile failure');
const sha=async a=>{const buffer=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);return [...new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))].map(n=>n.toString(16).padStart(2,'0')).join('')};
function cleanup(){if(!spirit)return;const s=spirit.bodyMesh.skeleton;let calls=0,events=0;const texture=s?.boneTexture,before=deletedTextures;
if(s){const dispose=s.dispose.bind(s);s.dispose=()=>{calls++;dispose()};texture?.addEventListener('dispose',()=>events++)}
spirit.dispose();spirit.dispose();renderer.render(scene,camera);release={skin:!!s,skeletonDisposals:calls,boneTextureDisposals:events,hadBoneTexture:!!texture,deletedTextures:deletedTextures-before,memory:{...renderer.info.memory}};spirit=undefined;return release;}
window.rigQA={async load(v,d='임술',q='high',outfit=false){const previous=cleanup();variant=v;day=d;quality=q;const start=performance.now();spirit=await(v==='rig'?loadRig:loadV32)(d,'병인',q);scene.add(spirit.group);
if(outfit)spirit.fashion.set({head:'sprout-pin',face:'round-sunglasses',neck:'ribbon-bow',back:'leaf-brooch'});
spirit.update(0,0,camera);renderer.render(scene,camera);const g=spirit.bodyMesh.geometry;hashes={position:await sha(g.attributes.position.array),normal:await sha(g.attributes.normal.array),uv:await sha(g.attributes.uv.array)};
return{variant,day,quality,loadMs:performance.now()-start,hashes,skin:!!spirit.bodyMesh.isSkinnedMesh,bones:spirit.bodyMesh.skeleton?.bones.length||0,previous};},
trigger(){spirit.triggerReaction()},reset(){spirit.reset()},tap(){for(let i=0;i<100;i++)spirit.triggerReaction()},
frame(t,angle=0){spirit.avatarPivot.rotation.y=angle;const start=performance.now();spirit.update(t,0,camera);const updateMs=performance.now()-start;renderer.render(scene,camera);
const b=spirit.bodyMesh,p=b.geometry.attributes.position,g=b.userData.approvedSpiritGreeting,hand=new T.Vector3(),point=new T.Vector3();for(const id of g.handVertexIDs)hand.add(b.getVertexPosition(id,point));hand.divideScalar(g.handVertexIDs.length);
let anchors=0,maxAttachmentError=0;spirit.fashion.group.traverse(o=>{const s=o.userData.support;if(!s)return;anchors++;const idx=b.geometry.index,tri=s.triangle,c=new T.Vector3();for(let k=0;k<3;k++)c.addScaledVector(b.getVertexPosition(idx.getX(tri*3+k),point),s.barycentric[k]);b.updateWorldMatrix(true,false);spirit.fashion.group.updateWorldMatrix(true,false);c.applyMatrix4(spirit.fashion.group.matrixWorld.clone().invert().multiply(b.matrixWorld));maxAttachmentError=Math.max(maxAttachmentError,c.distanceTo(new T.Vector3(...s.position)))});
const pixels=new Uint8Array(498*466*4);gl.readPixels(0,0,498,466,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let pixelHash=2166136261;for(const value of pixels)pixelHash=Math.imul(pixelHash^value,16777619)>>>0;
return{variant,day,quality,time:t,angle,stage:g.stage,lift:g.armLift,wrist:g.wrist,hand:hand.toArray(),depth:spirit.avatarPivot.scale.z,sourceMorph:[...b.morphTargetInfluences],bones:b.skeleton?.bones.length||0,skin:!!b.isSkinnedMesh,
skinPoseRevision:b.userData.approvedSkinPoseRevision,hashes,positionVersion:p.version,glError:gl.getError(),errors:[...errors],updateMs,pixelHash,anchors,maxAttachmentError,memory:{...renderer.info.memory},drawCalls:renderer.info.render.calls};},
dispose(){const result=cleanup();return result;}};
`);
const server=await createServer({root,configFile:false,logLevel:'error',resolve:{dedupe:['three']},optimizeDeps:{noDiscovery:true},server:{host:'127.0.0.1',port:0,fs:{allow:['/workspace']}},plugins:[{name:'rig-qa',configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url!=='/__rig-qa')return next();res.setHeader('Content-Type','text/html');res.end('<html><script type="module" src="/'+path.relative(root,harness)+'"></script></html>')})}}]});
const errors=[],outbound=[],cases=[],frames=[],releases=[];let browser;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
try{
  await server.listen();const origin=server.resolvedUrls.local[0];
  const{chromium}=await import(pathToFileURL('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'));
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:498,height:466}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===new URL(origin).origin||['data:','blob:'].includes(u.protocol))return route.continue();outbound.push(u.origin);return route.abort()});
  await page.goto(origin+'__rig-qa');await page.waitForFunction(()=>!!window.rigQA);
  const recordVideos=process.env.SAJU_RIG_VIDEO!=='0',fps=30,count=135;
  for(const variant of['v32','rig'])for(const[view,angle]of[['front',0],['side',-Math.PI/2]]){
    const load=await page.evaluate(v=>window.rigQA.load(v),variant);if(load.previous)releases.push(load.previous);
    assert.equal(load.hashes.position,'f7e39c85723b4220d0e69161e4405c3232d514b18be56e8a3854ec6fff48da8b');assert.equal(load.hashes.uv,'f3300a24812551e09c6b6a4bc31795feb19c80dc22cf1708cda7a64890e9539c');
    assert.equal(load.skin,variant==='rig');if(variant==='rig')assert.equal(load.bones,11);
    await page.evaluate(()=>window.rigQA.trigger());const directory=path.join(output,variant+'-'+view);await fs.mkdir(directory,{recursive:true});
    const samples=recordVideos?Array.from({length:count},(_,i)=>i):[0,15,30,39,48,60,75,90,105,120,134];
    for(const frame of samples){const state=await page.evaluate(args=>window.rigQA.frame(...args),[frame/fps,angle]);assert.equal(state.glError,0);assert.deepEqual(state.errors,[]);assert.equal(state.depth,1.35);assert.equal(state.sourceMorph[0],0);assert.equal(state.positionVersion,0);
      const file=path.join(directory,String(frame).padStart(4,'0')+'.png');await page.screenshot({path:file});frames.push({...state,view,file:path.relative(output,file)});}
    if(recordVideos)execFileSync('ffmpeg',['-loglevel','error','-y','-framerate',String(fps),'-i',path.join(directory,'%04d.png'),'-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-movflags','+faststart',path.join(output,variant+'-water-'+view+'.mp4')]);
    cases.push({...load,view,frames:samples.length});console.log('PASS native',variant,view,samples.length,'frames');
  }
  // Every stem and quality runs the actual rig shader/effect/fashion pipeline.
  for(const day of['갑술','을술','병술','정술','무술','기술','경술','신술','임술','계술'])for(const quality of['high','low']){
    const load=await page.evaluate(args=>window.rigQA.load(...args),['rig',day,quality,true]);releases.push(load.previous);
    await page.evaluate(()=>window.rigQA.trigger());const duration=3.9*({갑:1.04,을:1.12,병:.93,정:1.01,무:1.15,기:1.08,경:.98,신:1.03,임:1.11,계:1.17}[day[0]]);
    for(const progress of[.16,.265,.34,.38,.44,.53,.62,.70,.85,1.05]){const state=await page.evaluate(args=>window.rigQA.frame(...args),[duration*progress,-.28]);assert.equal(state.glError,0);assert.deepEqual(state.errors,[]);assert(state.anchors>=4);assert(state.maxAttachmentError<1e-8);assert.equal(state.sourceMorph.length,1);assert.equal(state.sourceMorph[0],0);frames.push({...state,case:'effects-fashion'});
      if(progress===.44)await page.screenshot({path:path.join(output,day+'-'+quality+'-effects-fashion.png')});}
    const paused=await page.evaluate(args=>window.rigQA.frame(...args),[duration*1.05,-.28]);const repeat=await page.evaluate(args=>window.rigQA.frame(...args),[duration*1.05,-.28]);assert.equal(paused.pixelHash,repeat.pixelHash);
    await page.evaluate(()=>window.rigQA.reset());await page.evaluate(()=>window.rigQA.trigger());const first=await page.evaluate(args=>window.rigQA.frame(...args),[duration*.5,0]);await page.evaluate(()=>window.rigQA.tap());const repeated=await page.evaluate(args=>window.rigQA.frame(...args),[duration*.5,0]);assert.equal(first.pixelHash,repeated.pixelHash);
    cases.push({...load,kind:'ten-stem-effects-fashion',pausedPixelsStable:true,tapsStable:true});console.log('PASS native',day,quality,'skin/FX/fashion');
  }
  releases.push(await page.evaluate(()=>window.rigQA.dispose()));
  for(const r of releases.filter(r=>r?.skin)){assert.equal(r.skeletonDisposals,1);assert.equal(r.hadBoneTexture,true);assert.equal(r.boneTextureDisposals,1);assert(r.deletedTextures>=1);}
  if(recordVideos)for(const view of['front','side'])execFileSync('ffmpeg',['-loglevel','error','-y','-i',path.join(output,'v32-water-'+view+'.mp4'),'-i',path.join(output,'rig-water-'+view+'.mp4'),'-filter_complex',"[0:v]drawtext=text='v32':x=14:y=14:fontsize=20:fontcolor=black[l];[1:v]drawtext=text='rig candidate':x=14:y=14:fontsize=20:fontcolor=black[r];[l][r]hstack=inputs=2",'-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',path.join(output,'compare-'+view+'.mp4')]);
  assert.deepEqual(errors,[]);assert.deepEqual(outbound,[]);
}catch(error){errors.push(error.stack);process.exitCode=1;console.error(error);}
finally{await fs.writeFile(path.join(output,'report.json'),JSON.stringify({status:process.exitCode?'FAIL':'PASS',cases,frames,releases,errors,outbound,
  baselineLoaderSHA256:sha(await fs.readFile(baselineLoader)),loaderSHA256:sha(await fs.readFile('lib/planet/approved-jade-spirit.ts')),harnessSHA256:sha(await fs.readFile(harness)),
  limits:['Actual Three WebGL2/Chromium SwiftShader; no physical mobile GPU certification.','Attached user video could not be materialized; comparison reproduces deployed c6b79d2 at identical camera and absolute times.','No deployed-session or redeployment claim.']},null,2)+'\n');await browser?.close();await server.close();}
