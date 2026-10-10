// Compiled recipe contracts and real GLB rest-coordinate samples. Native shader
// field readback and visual comparisons are separate; this is not GPU shading.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const root = process.cwd(), baseline = path.resolve('../saju-spirit-dew-coalescence-20261010');
const output = path.resolve('outputs/spirit-integration/water/cpu'); await fs.mkdir(output, { recursive: true });
const sha = b => createHash('sha256').update(b).digest('hex');
const api = [];
for (const [label, sourceRoot] of [['before', baseline], ['after', root]]) {
  const file = path.join(output, label + '.mjs');
  await build({stdin:{contents:`export * from ${JSON.stringify(path.join(sourceRoot,'lib/planet/approved-stem-materials.ts'))}; export * from ${JSON.stringify(path.join(sourceRoot,'lib/planet/character-rest-coordinates.ts'))};`,resolveDir:root},
    outfile:file,bundle:true,platform:'node',format:'esm',packages:'external'});
  api.push(await import(pathToFileURL(file).href));
}
const compile = (module, stem, quality = 'high') => {
  const handle = module.createStemMaterial(stem, quality, {coordinateMode:'character-rest',coordinateDensity:stem === '壬' ? 2.6 : 1});
  const shader = {vertexShader:THREE.ShaderLib.physical.vertexShader,fragmentShader:THREE.ShaderLib.physical.fragmentShader,uniforms:{}};
  handle.material.onBeforeCompile(shader); return {handle, shader};
};
const waterBranch = shader => shader.fragmentShader.split('#elif STEM_KIND == 8')[1].split('#elif STEM_KIND == 9')[0];
const coefficient = branch => Number(branch.match(/s\.height=([.\d]+)\*wave\+/)?.[1]);
const bytes = await fs.readFile('public/spirits/jade-v002/body.glb');
assert.equal(sha(bytes),'0e339d90253c8bbf6a865210f39d200ec3b5c042bcddb7ce669cea5c75c37b84');
const loader = new GLTFLoader().register(()=>({name:'CPU_IMAGE_IO',loadTexture:async()=>new THREE.Texture()}));
const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const group = new THREE.Group(); group.add(gltf.scene); gltf.scene.scale.z = 1.35;
let body; gltf.scene.traverse(o=>{if(o.isMesh&&o.geometry.attributes.position.count===33207)body=o;});
body.morphTargetInfluences.fill(0); group.updateWorldMatrix(true,true);
const original = Object.fromEntries(['position','normal','uv'].map(n=>[n,sha(Buffer.from(body.geometry.attributes[n].array.buffer))]));
const binding = api[1].bindCharacterRestCoordinates(group,[body]);
const report = {status:'RUNNING',sourceGLBSHA256:sha(bytes),measurements:{},checks:[],limits:['CPU texture image placeholders; actual archived positions and depth1.35 rest binding.','Compiled shader contracts and independently evaluated broad sinusoid; native full shader field/render checked separately.']};

test('壬 broad height is exactly half on the actual original GLB rest coordinates',()=>{
  const a=compile(api[0],'壬'),b=compile(api[1],'壬'),ca=coefficient(waterBranch(a.shader)),cb=coefficient(waterBranch(b.shader));
  assert.equal(ca,.034); assert.equal(cb,.017);
  const positions=body.geometry.attributes.stemRestPosition, axis=new THREE.Vector3(.18,1,.24).normalize(), p=new THREE.Vector3(),q=new THREE.Vector3();
  let samples=0,sumA=0,sumB=0,maxRatioError=0,maxA=0,maxB=0;
  for(const time of [0,.2,.7,1.25,2.4,5.5,12]) for(let i=0;i<positions.count;i+=13){
    p.fromBufferAttribute(positions,i).multiplyScalar(2.6);const lat=p.dot(axis);
    const angle=1.08*time+.14*Math.sin(lat*2.5)*Math.sin(time*.8)+.055*(Math.sin(lat*4+time*1.6)-Math.sin(lat*4));
    q.copy(p).applyAxisAngle(axis,-angle);
    const warp=.55*Math.sin(q.dot(new THREE.Vector3(3.1,2.6,1.4)))+.45*Math.sin(q.dot(new THREE.Vector3(-1.8,3.4,2.6)));
    const wave=Math.sin(q.dot(new THREE.Vector3(9.5,2.2,4.2))+.85*warp), before=ca*wave,after=cb*wave;
    maxRatioError=Math.max(maxRatioError,Math.abs(after-before*.5));sumA+=before**2;sumB+=after**2;maxA=Math.max(maxA,Math.abs(before));maxB=Math.max(maxB,Math.abs(after));samples++;
  }
  assert.equal(maxRatioError,0);assert.equal(Math.sqrt(sumB/sumA),.5);
  report.measurements={samples,maxBroadBefore:maxA,maxBroadAfter:maxB,rmsRatio:Math.sqrt(sumB/sumA),maxHalfError:maxRatioError};
  a.handle.dispose();b.handle.dispose();report.checks.push('actual rest samples: broad sinusoid halves exactly');
});
test('壬 ripples, flow phase, foam, color and optics retain their complete compiled recipe',()=>{
  for(const quality of ['low','high']){
    const a=compile(api[0],'壬',quality),b=compile(api[1],'壬',quality);
    const recipe = s => s.replace(/\s*\/\/ Half the broad relief; keep the moving fine ripples and breaker detail\.\n/,'\n');
    assert.equal(recipe(waterBranch(a.shader).replace('s.height=.034*wave+','s.height=.017*wave+')),recipe(waterBranch(b.shader)));
    for(const key of ['transmission','thickness','ior','attenuationDistance','roughness','metalness','transparent','depthWrite'])assert.equal(a.handle.material[key],b.handle.material[key],key);
    assert.notEqual(a.handle.material.customProgramCacheKey(),b.handle.material.customProgramCacheKey(),'before/after shaders cannot alias the Three program cache');
    a.handle.dispose();b.handle.dispose();
  }
  report.checks.push('only broad coefficient and water program cache identity change');
});
test('other nine recipes, vertex shaders, material settings and cache identity are preserved',()=>{
  const removeInactiveWater=s=>s.replace(/#elif STEM_KIND == 8[\s\S]*?(?=#elif STEM_KIND == 9)/,'#elif STEM_KIND == 8\n');
  for(const stem of ['甲','乙','丙','丁','戊','己','庚','辛','癸']){
    const a=compile(api[0],stem),b=compile(api[1],stem);
    assert.equal(a.shader.vertexShader,b.shader.vertexShader);assert.equal(removeInactiveWater(a.shader.fragmentShader),removeInactiveWater(b.shader.fragmentShader));
    assert.equal(a.handle.material.customProgramCacheKey(),b.handle.material.customProgramCacheKey());
    a.handle.dispose();b.handle.dispose();
  }report.checks.push('all nine other active stem shader recipes/cache identities retained');
});
test('source attributes remain exact after rest binding and release',()=>{
  binding.dispose();for(const name of ['position','normal','uv'])assert.equal(sha(Buffer.from(body.geometry.attributes[name].array.buffer)),original[name]);
  report.checks.push('original GLB POSITION/NORMAL/UV preserved');
});
process.on('exit',code=>{report.status=code?'FAIL':'PASS';writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');});
