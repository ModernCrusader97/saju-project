// Actual approved B GLB: image I/O alone is replaced for CPU geometry checks.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const root=process.cwd(),output=path.join(root,'outputs/surface-fissure-sand');
await fs.mkdir(output,{recursive:true});
const baseline=process.env.SAJU_QA_SAND_BASELINE==='1',entry=path.join(output,'cpu-runtime.mjs');
await build({stdin:{contents:`export * from './lib/planet/character-rest-coordinates';
 ${baseline?`import {createSurfaceStemAccents} from './lib/planet/surface-stem-accents';export const createSurfaceFissureSand=options=>createSurfaceStemAccents('戊',options);`:`export * from './lib/planet/surface-fissure-sand';export * from './lib/planet/sandstone-fissure-field';`}`,
 resolveDir:root},outfile:entry,bundle:true,platform:'node',format:'esm',packages:'external'});
const runtime=await import(pathToFileURL(entry).href);
const bytes=await fs.readFile('assets/source-reference/saju-b-evolving-light-v002/reference/SaJu_Jade_Approved_Static_Material.glb');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(sha(bytes),'0e339d90253c8bbf6a865210f39d200ec3b5c042bcddb7ce669cea5c75c37b84');
assert(bytes.equals(await fs.readFile('public/spirits/jade-v002/body.glb')),'Browser runtime GLB must equal the approved source byte for byte');
const loader=new GLTFLoader().register(()=>({name:'CPU_ONLY_IMAGE_IO',loadTexture:async()=>new THREE.Texture()}));
const model=(await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
const owner=new THREE.Group();model.position.x=-.42;model.scale.z=1.35;owner.add(model);
let body;model.traverse(mesh=>{if(mesh.isMesh&&mesh.geometry.getAttribute('position').count===33207)body=mesh;});
assert(body,'Expected real B body');body.morphTargetInfluences?.fill(0);
const attributeSHA=array=>sha(Buffer.from(array.buffer,array.byteOffset,array.byteLength));
const sourceHashes=()=>Object.fromEntries(['position','normal','uv'].map(name=>[name,attributeSHA(body.geometry.getAttribute(name).array)]).concat([['index',attributeSHA(body.geometry.index.array)]]));
const before=sourceHashes(),binding=runtime.bindCharacterRestCoordinates(owner,[body]),reports=[];
assert.equal(before.position,'f7e39c85723b4220d0e69161e4405c3232d514b18be56e8a3854ec6fff48da8b');
assert.equal(before.uv,'f3300a24812551e09c6b6a4bc31795feb19c80dc22cf1708cda7a64890e9539c');
const sourcePoint=source=>{
 const p=body.geometry.getAttribute('position'),idx=body.geometry.index;
 return [0,1,2].reduce((sum,j)=>sum.addScaledVector(new THREE.Vector3().fromBufferAttribute(p,idx.getX(source.triangle*3+j)),source.barycentric[j]),new THREE.Vector3());
};

for(const quality of ['low','high'])test(`戊 ${quality}: actual triangle fissure origins, original B geometry and bounded instances`,()=>{
 const effect=runtime.createSurfaceFissureSand({meshes:[body],quality});
 try{
  assert.equal(effect.diagnostics.supported,true,'The current disabled sand path must be replaced by verified surface fissure emitters');
  assert.equal(effect.diagnostics.mode,'triangle-fissure-gravity-sand');
  const grains=effect.group.getObjectByName('ActualSurfaceFissureSand');
  assert(grains?.isInstancedMesh);assert.equal(grains.count,quality==='low'?24:48);
  assert.equal(effect.group.children.length,1);assert(!Array.isArray(grains.material),'One shared material');
  assert.equal(grains.geometry.index?.count??grains.geometry.getAttribute('position').count,60,'20 triangle grain geometry');
  const sources=effect.group.userData.sandSources;
  assert.equal(sources.length,quality==='low'?4:6);
  for(const source of sources){
   assert(source.barycentric.every(n=>n>=0&&n<=1));assert(Math.abs(source.barycentric.reduce((a,b)=>a+b)-1)<1e-9);
   const point=sourcePoint(source),ids=[0,1,2].map(j=>body.geometry.index.getX(source.triangle*3+j)),rest=body.geometry.getAttribute('stemRestPosition');
   const expected=ids.reduce((sum,id,j)=>sum.addScaledVector(new THREE.Vector3().fromBufferAttribute(rest,id),source.barycentric[j]),new THREE.Vector3());
   assert(expected.distanceTo(new THREE.Vector3(...source.restPosition))<1e-6,'Crack field must use barycentric bound rest coordinates');
   assert(source.fieldDistance<.018,'Only deep .010–.055 fissures may emit');
   assert(Math.abs(runtime.sandstoneFissureDistance(source.restPosition,quality)-source.fieldDistance)<1e-7);
   assert(point.toArray().every(Number.isFinite));
  }
  model.add(effect.group);effect.update(1.9);
  const snapshot=Array.from(grains.instanceMatrix.array);effect.update(1.9);assert.deepEqual(Array.from(grains.instanceMatrix.array),snapshot);
  effect.update(0);const initial=Array.from(grains.instanceMatrix.array);effect.update(9);effect.update(0);assert.deepEqual(Array.from(grains.instanceMatrix.array),initial);
  assert.deepEqual(sourceHashes(),before,'Original positions, normals, UV and indices must stay unchanged');
  reports.push({quality,instances:grains.count,sourceCount:sources.length,sources});
 }finally{effect.dispose();effect.dispose();}
});

if(!baseline){
 test('attached source follows paused rigid rotations with inverse-transpose normals',()=>{
  const effect=runtime.createSurfaceFissureSand({meshes:[body],quality:'high'});model.add(effect.group);
  try{
   owner.scale.set(1.2,.8,1.1);owner.rotation.set(.25,.7,-.12);model.rotation.set(-.08,.4,.03);effect.update(2);
   const frame=effect.group.userData.sandFrame,sources=effect.group.userData.sandSources;
   owner.updateWorldMatrix(true,true);
   for(let i=0;i<sources.length;i++){
    const source=sources[i],point=sourcePoint(source).applyMatrix4(body.matrixWorld);
    assert(point.distanceTo(new THREE.Vector3(...frame.sourceWorld[i].position))<1e-6);
    const p=body.geometry.getAttribute('position'),idx=body.geometry.index,vertices=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,idx.getX(source.triangle*3+j)));
    const normal=new THREE.Triangle(...vertices).getNormal(new THREE.Vector3()).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(body.matrixWorld));
    assert(normal.dot(new THREE.Vector3(...frame.sourceWorld[i].normal))>.999999);
   }
   assert(Array.from(effect.group.children[0].instanceMatrix.array).every(Number.isFinite));
  }finally{effect.dispose();owner.scale.setScalar(1);owner.rotation.set(0,0,0);model.rotation.set(0,0,0);}
 });
 test('world-gravity flight remains vertical under nonuniform presentation; body-crossing particles hide',()=>{
  const effect=runtime.createSurfaceFissureSand({meshes:[body],quality:'high'});model.add(effect.group);
  try{
   const grains=effect.group.children[0],matrix=new THREE.Matrix4(),position=()=>{
    grains.getMatrixAt(0,matrix);return new THREE.Vector3().setFromMatrixPosition(matrix).applyMatrix4(grains.matrixWorld);
   };
   for(const rotation of [[0,0,0],[.2,1.2,-.15]]){
    owner.rotation.set(...rotation);owner.scale.set(1.2,.8,1.1);
    let checked=false;
    for(let t=0;t<5&&!checked;t+=.02){
     const points=[],scales=[];
     for(const time of [t,t+.02,t+.04]){effect.update(time);grains.updateWorldMatrix(true,false);points.push(position());scales.push(new THREE.Vector3().setFromMatrixScale(matrix).length());}
     if(scales.some(n=>n<.002))continue;
     const second=points[2].clone().add(points[0]).addScaledVector(points[1],-2);
     assert(Math.abs(second.x)<2e-6&&Math.abs(second.z)<2e-6,'Ballistic acceleration must follow world Y');assert(second.y<-1e-5);checked=true;
    }
    assert(checked,'At least one visible flight must be sampled');
   }
   owner.rotation.set(Math.PI/2,0,0);let hidden=0;
   for(let t=0;t<5;t+=.12){effect.update(t);hidden+=effect.group.userData.sandFrame.hiddenByBody;}
   assert(hidden>0,'Tilted flights crossing actual body triangles must be hidden');
   reports.push({collisionHiddenOverTiltedFrames:hidden});
  }finally{effect.dispose();owner.rotation.set(0,0,0);owner.scale.setScalar(1);}
 });
 test('one owned instance mesh/geometry/material releases once, source stays owned by caller',()=>{
  const effect=runtime.createSurfaceFissureSand({meshes:[body],quality:'low'}),grains=effect.group.children[0],counts=[0,0,0,0];
  [grains,grains.geometry,grains.material,body.geometry].forEach((resource,i)=>resource.addEventListener('dispose',()=>counts[i]++));
  effect.dispose();effect.dispose();effect.update(NaN);assert.deepEqual(counts,[1,1,1,0]);assert.equal(effect.group.children.length,0);
 });
 test('Gentle_wave_pose keeps rest crack identity and refits collision to actual posed vertices',()=>{
  const effect=runtime.createSurfaceFissureSand({meshes:[body],quality:'high',allowMorphTargets:true});model.add(effect.group);
  try{
   const sources=structuredClone(effect.group.userData.sandSources);body.morphTargetInfluences[0]=.65;effect.update(1.9);
   const frame=effect.group.userData.sandFrame;owner.updateWorldMatrix(true,true);
   for(let i=0;i<sources.length;i++){
    const source=sources[i],point=[0,1,2].reduce((sum,j)=>sum.addScaledVector(body.getVertexPosition(body.geometry.index.getX(source.triangle*3+j),new THREE.Vector3()),source.barycentric[j]),new THREE.Vector3()).applyMatrix4(body.matrixWorld);
    assert(point.distanceTo(new THREE.Vector3(...frame.sourceWorld[i].position))<1e-6,'Emitter must use actual current morph vertices');
   }
   assert(frame.colliderRefits>0,'Active wave must update collider vertices/bounds');
   assert.deepEqual(effect.group.userData.sandSources,sources,'Morph changes pose without moving the rest-space fissure identity');
   assert.deepEqual(sourceHashes(),before);
   const durations=[];for(let i=0;i<40;i++){body.morphTargetInfluences[0]=.35+.3*Math.sin(i*.3);const start=performance.now();effect.update(i*.03);if(i>=10)durations.push(performance.now()-start);}
   durations.sort((a,b)=>a-b);const budget={samples:durations.length,medianMs:durations[15],p95Ms:durations[28],averageMs:durations.reduce((a,b)=>a+b)/durations.length,colliderRefits:effect.group.userData.sandFrame.colliderRefits};reports.push({morphRefitBudget:budget});
   assert(budget.medianMs<=3,'Changing wave morph collision refit must stay within the 3ms local CPU median budget');
  }finally{body.morphTargetInfluences[0]=0;effect.dispose();}
 });
 test('invalid time, missing rest binding, active morph and singular transforms fail explicitly',()=>{
  const effect=runtime.createSurfaceFissureSand({meshes:[body]});try{assert.throws(()=>effect.update(NaN),/finite/);}finally{effect.dispose();}
  const unbound=body.clone();unbound.geometry=body.geometry.clone();unbound.geometry.deleteAttribute('stemRestPosition');
  try{assert.throws(()=>runtime.createSurfaceFissureSand({meshes:[unbound]}),/rest/i);}finally{unbound.geometry.dispose();}
  body.morphTargetInfluences[0]=.1;try{assert.throws(()=>runtime.createSurfaceFissureSand({meshes:[body]}),/Rigid|morph/);}finally{body.morphTargetInfluences[0]=0;}
  const singular=runtime.createSurfaceFissureSand({meshes:[body]});model.add(singular.group);owner.scale.x=0;
  try{assert.throws(()=>singular.update(1),/invertible|singular/);}finally{owner.scale.x=1;singular.dispose();}
 });
 test('fashion exclusion hides a source batch and restores unchanged seeds when removed',()=>{
  const effect=runtime.createSurfaceFissureSand({meshes:[body],quality:'high'});model.add(effect.group);
  try{
   effect.update(2);const expected=Array.from(effect.group.children[0].instanceMatrix.array),sources=structuredClone(effect.group.userData.sandSources);
   effect.group.userData.surfaceAttachmentExclusions=[{id:'qa-cover',shape:'box',min:[-10,-10,-10],max:[10,10,10]}];effect.update(2);
   assert.equal(effect.group.userData.sandFrame.excludedSourceCount,6);assert.equal(effect.group.userData.sandFrame.visibleCount,0);
   effect.group.userData.surfaceAttachmentExclusions=[];effect.update(2);assert.deepEqual(Array.from(effect.group.children[0].instanceMatrix.array),expected);assert.deepEqual(effect.group.userData.sandSources,sources);
  }finally{effect.dispose();}
 });
 test('real-body CPU update has finite bounded budget',()=>{
  const effect=runtime.createSurfaceFissureSand({meshes:[body],quality:'high'});model.add(effect.group);const durations=[];
  try{for(let i=0;i<100;i++){const start=performance.now();effect.update(i/20);durations.push(performance.now()-start);}durations.sort((a,b)=>a-b);
   const budget={samples:100,medianMs:durations[50],p95Ms:durations[95],maxMs:durations[99]};reports.push({cpuBudget:budget});assert(budget.medianMs<20,'Local CPU budget should support 60fps alongside renderer');
  }finally{effect.dispose();}
 });
}
if(!baseline&&process.env.SAJU_QA_SAND_WEBGL==='1')test('real WebGL: production sandstone crack formula, grain pixels, rotations and morphs',async()=>{
 const {createServer}=await import('vite');
 const {chromium}=await import(pathToFileURL(process.env.SAJU_QA_PLAYWRIGHT_PATH||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
 const harness=path.join(output,'browser-harness.mjs');
 await fs.writeFile(harness,`
 import * as THREE from 'three';
 import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
 import {createSurfaceFissureSand} from '../../lib/planet/surface-fissure-sand';
 import {SANDSTONE_FISSURE_GLSL,sandstoneFissureDistance} from '../../lib/planet/sandstone-fissure-field';
 import {bindCharacterRestCoordinates} from '../../lib/planet/character-rest-coordinates';
 import {createStemMaterial} from '../../lib/planet/approved-stem-materials';
 import {createStudioEnvironment} from '../../lib/planet/scene-environment';
 const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(480,480);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
 const gl=renderer.getContext(),nativeTextures=new Map(),nativeCreateTexture=gl.createTexture.bind(gl),nativeDeleteTexture=gl.deleteTexture.bind(gl);
 gl.createTexture=()=>{const texture=nativeCreateTexture();nativeTextures.set(texture,new Error().stack);return texture;};gl.deleteTexture=texture=>{nativeTextures.delete(texture);return nativeDeleteTexture(texture);};
 document.body.style.cssText='margin:0;background:#edf2ea';document.body.append(renderer.domElement);
 const scene=new THREE.Scene(),env=createStudioEnvironment(renderer);scene.background=new THREE.Color('#edf2ea');scene.environment=env.texture;scene.environmentIntensity=1.05;
 scene.add(new THREE.HemisphereLight(0xf4f8fc,0x26343b,.85));
 for(const [color,intensity,position] of [[0xfff1d9,2.1,[-3,4,4]],[0xc1e4f0,.8,[4,1,2]],[0xf5fbff,1.8,[0,3,-3]]]){const light=new THREE.DirectionalLight(color,intensity);light.position.set(...position);scene.add(light);}
 const camera=new THREE.PerspectiveCamera(38,1,.1,40);camera.position.set(0,1.7,5.7);camera.lookAt(-.42,1.24,0);
 const shaderErrors=[];renderer.debug.onShaderError=(gl,p,v,f)=>shaderErrors.push({program:gl.getProgramInfoLog(p),vertex:gl.getShaderInfoLog(v),fragment:gl.getShaderInfoLog(f)});
 const model=(await new GLTFLoader().loadAsync('/spirits/jade-v002/body.glb')).scene,owner=new THREE.Group();model.position.x=-.42;model.scale.z=1.35;owner.add(model);scene.add(owner);
 let body;model.traverse(mesh=>{if(mesh.isMesh&&mesh.geometry.getAttribute('position').count===33207)body=mesh;});body.morphTargetInfluences.fill(0);const binding=bindCharacterRestCoordinates(owner,[body]);
 const sourceResources=new Set();model.traverse(o=>{if(o.geometry)sourceResources.add(o.geometry);for(const m of [o.material].flat().filter(Boolean)){sourceResources.add(m);for(const value of Object.values(m))if(value?.isTexture)sourceResources.add(value);}});
 let effect,handle;const compiledShaders=[];
 function choose(quality){effect?.dispose();handle?.dispose();handle=createStemMaterial('戊',quality,{coordinateMode:'character-rest'});const originalCompile=handle.material.onBeforeCompile;handle.material.onBeforeCompile=(shader,renderer)=>{originalCompile(shader,renderer);compiledShaders.push(shader);};body.material=handle.material;effect=createSurfaceFissureSand({meshes:[body],quality,allowMorphTargets:true});model.add(effect.group);}
 function shaderFunction(source,name){const begin=source.indexOf('float '+name+'(')>=0?source.indexOf('float '+name+'('):source.indexOf('vec2 '+name+'('),brace=source.indexOf('{',begin);let depth=1,end=brace+1;for(;end<source.length&&depth;end++){if(source[end]==='{')depth++;if(source[end]==='}')depth--;}return source.slice(begin,end).replace(/\\s+/g,'');}
 async function fieldComparison(quality){
  choose(quality);const stub={vertexShader:THREE.ShaderLib.physical.vertexShader,fragmentShader:THREE.ShaderLib.physical.fragmentShader,uniforms:{}};handle.material.onBeforeCompile(stub,renderer);
  for(const name of ['stHash','stNoise','stFbm','stCell'])if(shaderFunction(stub.fragmentShader,name)!==shaderFunction(SANDSTONE_FISSURE_GLSL,name))throw new Error('Production fissure function drift: '+name);
  const actualCommon=stub.fragmentShader.slice(stub.fragmentShader.indexOf('float stHash('),stub.fragmentShader.indexOf('float stBotanical('));
  const actualStone=stub.fragmentShader.slice(stub.fragmentShader.indexOf('#elif STEM_KIND == 4'),stub.fragmentShader.indexOf('#elif STEM_KIND == 5'));
  const actualField=[actualStone.match(/vec3 warp=[^;]+;/)?.[0],actualStone.match(/vec2 blocks=[^;]+;/)?.[0],actualStone.match(/float fissure=[^;]+;/)?.[0]].join('');
  if(!actualField.includes('blocks=stCell')||!actualField.includes('.010,.055'))throw new Error('Actual production sandstone field was not extracted');
  const selected=effect.group.userData.sandSources.map(s=>s.restPosition),rest=body.geometry.getAttribute('stemRestPosition');
  const coordinates=[...selected,...Array.from({length:256},(_,i)=>new THREE.Vector3().fromBufferAttribute(rest,(i*127+3141)%rest.count).toArray())],count=coordinates.length;
  const data=new Float32Array(count*4);coordinates.forEach((p,i)=>data.set(p,i*4));const texture=new THREE.DataTexture(data,count,1,THREE.RGBAFormat,THREE.FloatType);texture.needsUpdate=true;
  const target=new THREE.WebGLRenderTarget(count,1,{type:THREE.FloatType,format:THREE.RGBAFormat,depthBuffer:false,stencilBuffer:false});
  const material=new THREE.RawShaderMaterial({glslVersion:THREE.GLSL3,uniforms:{uCoordinates:{value:texture}},vertexShader:'precision highp float;in vec3 position;void main(){gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'precision highp float;uniform sampler2D uCoordinates;out vec4 result;\\n#define STEM_OCTAVES '+(quality==='low'?3:4)+'\\n'+actualCommon+'\\nvoid main(){vec3 p=texelFetch(uCoordinates,ivec2(int(gl_FragCoord.x),0),0).xyz;'+actualField+'result=vec4(blocks.y,fissure,0.,1.);}'});
  const geometry=new THREE.PlaneGeometry(2,2),diagnosticScene=new THREE.Scene();diagnosticScene.add(new THREE.Mesh(geometry,material));
  const result=new Float32Array(count*4);renderer.setRenderTarget(target);renderer.render(diagnosticScene,new THREE.Camera());renderer.readRenderTargetPixels(target,0,0,count,1,result);renderer.setRenderTarget(null);
  const rows=coordinates.map((p,i)=>({coordinate:p,cpu:sandstoneFissureDistance(p,quality),gpu:result[i*4],fissure:result[i*4+1],selected:i<selected.length}));
  target.dispose();texture.dispose();material.dispose();geometry.dispose();
  return {quality,productionFunctionsEqual:true,samples:rows.length,maxDifference:Math.max(...rows.map(r=>Math.abs(r.cpu-r.gpu))),meanDifference:rows.reduce((s,r)=>s+Math.abs(r.cpu-r.gpu),0)/rows.length,selected:rows.filter(r=>r.selected)};
 }
 function pixels(){const gl=renderer.getContext(),result=new Uint8Array(480*480*4);gl.readPixels(0,0,480,480,gl.RGBA,gl.UNSIGNED_BYTE,result);return result;}
 window.sandQA={fieldComparison,
 frame(time,angle,morph=0,closeup=false){camera.position.set(0,closeup?1.15:1.7,closeup?2.75:5.7);camera.lookAt(-.42,closeup?1.05:1.24,0);model.rotation.y=angle;body.morphTargetInfluences[0]=morph;effect.update(time);handle.update(time);renderer.render(scene,camera);return {...effect.group.userData.sandFrame,draws:renderer.info.render.calls,triangles:renderer.info.render.triangles,errors:shaderErrors};},
 grainPixels(time,angle){this.frame(time,angle,0);const withSand=pixels();effect.group.visible=false;renderer.render(scene,camera);const without=pixels();effect.group.visible=true;let changed=0,maxDifference=0;for(let i=0;i<withSand.length;i+=4){const delta=Math.abs(withSand[i]-without[i])+Math.abs(withSand[i+1]-without[i+1])+Math.abs(withSand[i+2]-without[i+2]);if(delta>6)changed++;maxDifference=Math.max(maxDifference,delta);}return {changed,maxDifference};},
 sources(){return effect.group.userData.sandSources;},
 dispose(){
  effect.dispose();handle.dispose();for(const resource of sourceResources)resource.dispose();binding.dispose();owner.removeFromParent();env.dispose();scene.environment=null;renderer.render(scene,camera);
  const ownedCleanup={...renderer.info.memory},before=new Set(nativeTextures.keys());
  // Three r186 keeps one shared PBR DFG lookup texture. Identify the actual
  // uploaded uniform/GL handle rather than accepting an unexplained survivor.
  const lookup=compiledShaders.map(s=>s.uniforms.dfgLUT?.value).find(t=>t?.name==='DFG_LUT'),lookupHandle=lookup?renderer.properties.get(lookup).__webglTexture:null;
  const retainedIsThreeDFGLUT=before.size===1&&before.has(lookupHandle);renderer.dispose();const rendererCleanup={...renderer.info.memory};renderer.forceContextLoss();
  return {ownedCleanup,rendererCleanup,nativeAliveTextures:nativeTextures.size,retainedIsThreeDFGLUT,retainedTexture:lookup?{name:lookup.name,width:lookup.image.width,height:lookup.image.height}:null,contextReleased:gl.isContextLost()};
 }
 };
 `);
 const server=await createServer({root,configFile:false,logLevel:'error',server:{host:'127.0.0.1',port:0},optimizeDeps:{noDiscovery:true},plugins:[{name:'sand-surface-qa',configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url!=='/__sand')return next();res.setHeader('Content-Type','text/html');res.end('<html><body><script type="module" src="/'+path.relative(root,harness).replaceAll('\\','/')+'"></script></body></html>');});}}]});
 const errors=[],outbound=[],comparisons=[],frames=[];let browser,memory,completed=false;
 try{
  await server.listen();const origin=server.resolvedUrls.local[0];browser=await chromium.launch({executablePath:process.env.SAJU_QA_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:480,height:480}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===new URL(origin).origin||['data:','blob:'].includes(url.protocol))return route.continue();outbound.push(url.origin);return route.abort();});
  await page.goto(origin+'__sand');await page.waitForFunction(()=>!!window.sandQA);
  for(const quality of ['low','high']){
   const comparison=await page.evaluate(quality=>window.sandQA.fieldComparison(quality),quality);comparisons.push(comparison);
   for(const source of comparison.selected){assert(source.gpu<.018,`Actual GPU crack distance ${source.gpu} must remain in deep fissure`);assert(source.fissure>.92);}
   assert(comparison.maxDifference<2e-5,'CPU and production shader need a measured float32 error bound');
   let time=0,bestPixels={changed:0};for(const t of [.30,.65,1,1.4,1.8,2.2,2.6,3.05,3.4,3.8]){const changed=await page.evaluate(t=>window.sandQA.grainPixels(t,0),t);if(changed.changed>bestPixels.changed){time=t;bestPixels=changed;}}
   assert(bestPixels.changed>4,'Real rendered sand must change visible pixels');
   for(const [view,angle,morph] of [['front',0,0],['side',Math.PI/2,0],['oblique-wave',Math.PI/4,.65]]){
    const frame=await page.evaluate(args=>window.sandQA.frame(...args),[time,angle,morph]);assert.deepEqual(frame.errors,[]);assert(frame.draws>0);const file=`sand-${quality}-${view}.png`;await page.screenshot({path:path.join(output,file)});frames.push({quality,view,file,time,angle,morph,visible:frame.visibleCount,hiddenByBody:frame.hiddenByBody,sourceWorld:frame.sourceWorld,grainPixels:bestPixels});
   }
   // Same selected burst across three times is an actual WebGL frame comparison.
   for(const offset of [0,.12,.24]){const frame=await page.evaluate(t=>window.sandQA.frame(t,0,0,true),time+offset);const file=`sand-${quality}-motion-${offset.toFixed(2)}.png`;await page.screenshot({path:path.join(output,file)});frames.push({quality,file,time:time+offset,closeup:true,visible:frame.visibleCount,hiddenByBody:frame.hiddenByBody});}
  }
  memory=await page.evaluate(()=>window.sandQA.dispose());assert.equal(memory.ownedCleanup.geometries,0);assert(memory.retainedIsThreeDFGLUT,'Any retained texture must be positively identified as the shared Three DFG lookup');assert.equal(memory.nativeAliveTextures,1);assert(memory.contextReleased);assert.deepEqual(errors,[]);assert.deepEqual(outbound,[]);
  completed=true;
 }finally{
  await fs.writeFile(path.join(output,'browser-report.json'),JSON.stringify({status:completed?'PASS':'FAIL',comparisons,frames,memory,errors,outbound,limits:['Local Chromium SwiftShader WebGL2; no hosted authenticated session or physical mobile GPU','Production material functions are rendered numerically; no source textures or model geometry are replaced','Tiny detached grains use bounded segment hiding, no full collision/settling simulation','One engine-global DFG_LUT remains in Three counters after dispose; exact native handle is identified, then the QA WebGL context is released']},null,2)+'\n');await browser?.close();await server.close();
 }
});
test.after(async()=>{
 const status=baseline?'EXPECTED_PRECHANGE_FAILURE':'completed';
 await fs.writeFile(path.join(output,baseline?'baseline-cpu-report.json':'cpu-report.json'),JSON.stringify({status,glbSHA256:sha(bytes),sourceHashes:before,reports,limits:['CPU uses actual GLB triangles; glTF image decode alone is replaced','Static topology, rigid transforms and explicitly permitted pose morphs','Browser shader comparison is a separate real WebGL check']},null,2)+'\n');binding.dispose();
});
