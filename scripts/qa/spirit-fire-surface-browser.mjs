// Same harness on immutable v30 and the candidate. Real GLB/PNG/WebGL only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';

const root = process.cwd(), phase = process.env.SAJU_QA_PHASE || 'after';
assert(['before', 'after'].includes(phase));
const output = path.join(root, 'outputs/spirit-fire-surface', phase);
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const harnessSHA256 = createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex');
const loaderSHA256 = createHash('sha256').update(await fs.readFile(path.join(root, 'lib/planet/approved-jade-spirit.ts'))).digest('hex');
await fs.mkdir(output, { recursive: true });
const harness = path.join(output, 'harness.mjs');
await fs.writeFile(harness, `
import * as THREE from 'three';
import {loadApprovedSpirit} from '../../../lib/planet/approved-jade-spirit';
import {createStudioEnvironment} from '../../../lib/planet/scene-environment';
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(480,480);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
document.body.style.cssText='margin:0;background:#edf2ea';document.body.append(renderer.domElement);
const scene=new THREE.Scene(),env=createStudioEnvironment(renderer);scene.background=new THREE.Color('#edf2ea');scene.environment=env.texture;scene.environmentIntensity=1.05;
scene.add(new THREE.HemisphereLight(0xf4f8fc,0x26343b,.85));
for(const [color,intensity,position] of [[0xfff1d9,2.1,[-3,4,4]],[0xc1e4f0,.8,[4,1,2]],[0xf5fbff,1.8,[0,3,-3]]]){const l=new THREE.DirectionalLight(color,intensity);l.position.set(...position);scene.add(l);}
const camera=new THREE.PerspectiveCamera(38,1,.1,40);camera.position.set(0,1.7,5.7);camera.lookAt(0,1.24,0);
const errors=[];renderer.debug.onShaderError=(gl,p,v,f)=>errors.push({program:gl.getProgramInfoLog(p),vertex:gl.getShaderInfoLog(v),fragment:gl.getShaderInfoLog(f)});
const spirit=await loadApprovedSpirit('병인','병인','high');scene.add(spirit.group);
const body=spirit.bodyMesh,original=body.material,rest=body.geometry.getAttribute('stemRestPosition');
let clock,clockName;const compile=original.onBeforeCompile;
original.onBeforeCompile=function(shader,...args){compile.call(this,shader,...args);clockName=shader.uniforms.uStemTime?'uStemTime':'uLsTime';clock=shader.uniforms[clockName];};
// Compile the actual runtime material before observing its shader clock.
renderer.render(scene,camera);
if(!clock)throw new Error('Runtime fire shader has no observable material clock.');
const gpuClock=()=>{const program=renderer.properties.get(original).currentProgram.program;const gl=renderer.getContext();return gl.getUniform(program,gl.getUniformLocation(program,clockName));};
const conditions=()=>({camera:{fov:camera.fov,aspect:camera.aspect,near:camera.near,far:camera.far,position:camera.position.toArray(),worldMatrix:camera.matrixWorld.toArray(),projectionMatrix:camera.projectionMatrix.toArray()},
 lights:scene.children.filter(o=>o.isLight).map(o=>({type:o.type,color:o.color.getHexString(),intensity:o.intensity,position:o.position.toArray(),castShadow:o.castShadow,groundColor:o.groundColor?.getHexString()})),
 renderer:{toneMapping:renderer.toneMapping,exposure:renderer.toneMappingExposure,outputColorSpace:renderer.outputColorSpace,shadowMapEnabled:renderer.shadowMap.enabled},
 model:{position:spirit.avatarPivot.position.toArray(),scale:spirit.avatarPivot.scale.toArray(),rotation:spirit.avatarPivot.rotation.toArray(),bodyWorldMatrix:body.matrixWorld.toArray()}});
const diagnostic=new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide,toneMapped:false});
diagnostic.customProgramCacheKey=()=>rest?'qa-rest-density':'qa-radial-density';
diagnostic.onBeforeCompile=s=>{
 s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\\nvarying vec3 vQaCoordinate;'+(rest?'\\nattribute vec3 stemRestPosition;':''));
 s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\\nvQaCoordinate='+(rest?'stemRestPosition':'normalize(position)')+';');
 s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\\nvarying vec3 vQaCoordinate;');
 s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',
  '#include <color_fragment>\\nvec3 q='+(rest?'vQaCoordinate':'normalize(vQaCoordinate)')+';\\nvec3 phase=q*8.;vec3 edge=abs(fract(phase-.5)-.5)/max(fwidth(phase),vec3(.0001));float line=1.-clamp(min(edge.x,min(edge.y,edge.z)),0.,1.);float tile=mod(dot(floor(phase),vec3(1.)),2.);diffuseColor.rgb=mix(mix(vec3(.15,.40,.58),vec3(.65,.84,.92),tile),vec3(.03,.09,.15),line);');
};
const hash=async array=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(array.buffer,array.byteOffset,array.byteLength)))].map(x=>x.toString(16).padStart(2,'0')).join('');
window.fireQA={async metadata(){return{material:original.name,kind:original.defines?.STEM_KIND,program:original.customProgramCacheKey(),restCoordinateVertices:rest?.count??0,presentationDepth:spirit.avatarPivot.scale.z,
 positionSHA256:await hash(body.geometry.getAttribute('position').array),uvSHA256:await hash(body.geometry.getAttribute('uv').array),morphs:body.morphTargetInfluences,
 petStatus:spirit.zodiacPet.userData.assetStatus,authoredPetStatus:spirit.zodiacPet.userData.authoredAssetStatus??'not-tracked-in-v30',effects:spirit.propGroup.children.map(x=>x.name),clockUniform:clockName,initialMaterialSeconds:clock.value};},
 frame(angle,diagnosis){body.material=original;spirit.propGroup.visible=true;spirit.zodiacPet.visible=true;spirit.reset();const resetSeconds=clock.value;
 spirit.avatarPivot.rotation.y=angle;for(let step=1;step<=135;step++)spirit.update(step/60,1/60,camera);
 // Both APIs now reach 2.25 actual material seconds. Upload the runtime uniform
 // even when the final screenshot uses the independent coordinate diagnostic.
 renderer.render(scene,camera);const uploadedSeconds=gpuClock();
 if(diagnosis){body.material=diagnostic;spirit.propGroup.visible=false;spirit.zodiacPet.visible=false;renderer.render(scene,camera);}
 const effectClocks=[];spirit.propGroup.traverse(o=>{if(o.material?.uniforms?.uTime)effectClocks.push({name:o.name,seconds:o.material.uniforms.uTime.value});});
 return{draws:renderer.info.render.calls,errors,clock:{uniform:clockName,resetSeconds,steps:135,deltaSeconds:1/60,targetSeconds:2.25,materialSeconds:clock.value,uploadedSeconds,effectClocks},conditions:conditions()};},
 dispose(){body.material=original;diagnostic.dispose();spirit.dispose();renderer.render(scene,camera);return {...renderer.info.memory};}};
`);
const server = await createServer({ root, configFile: false, logLevel: 'error', server: { host: '127.0.0.1', port: 0 }, optimizeDeps: { noDiscovery: true },
  plugins: [{ name: 'fire-coordinate-qa', configureServer(s) { s.middlewares.use((req, res, next) => {
    if (req.url !== '/__fire') return next();
    res.setHeader('Content-Type', 'text/html'); res.end('<html><body><script type="module" src="/' + path.relative(root, harness).replaceAll('\\', '/') + '"></script></body></html>');
  }); } }] });
const errors = [], outbound = [], frames = []; let browser, metadata, memory;
try {
  await server.listen(); const origin = server.resolvedUrls.local[0];
  const { chromium } = process.env.SAJU_QA_PLAYWRIGHT_PATH ? await import(pathToFileURL(process.env.SAJU_QA_PLAYWRIGHT_PATH).href) : await import('playwright');
  browser = await chromium.launch({ executablePath: process.env.SAJU_QA_CHROME || '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 480, height: 480 } });
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('**/*', route => { const url = new URL(route.request().url());
    if (url.origin === new URL(origin).origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
    outbound.push(url.origin); return route.abort(); });
  await page.goto(origin + '__fire'); await page.waitForFunction(() => !!window.fireQA);
  metadata = await page.evaluate(() => window.fireQA.metadata());
  assert.equal(metadata.initialMaterialSeconds, 0);
  assert.equal(metadata.clockUniform, phase === 'before' ? 'uLsTime' : 'uStemTime');
  assert.equal(metadata.presentationDepth, 1.35); assert(metadata.morphs.every(w => w === 0));
  assert.equal(metadata.positionSHA256, 'f7e39c85723b4220d0e69161e4405c3232d514b18be56e8a3854ec6fff48da8b');
  assert.equal(metadata.uvSHA256, 'f3300a24812551e09c6b6a4bc31795feb19c80dc22cf1708cda7a64890e9539c');
  if (phase === 'after') { assert.equal(metadata.kind, 2); assert.equal(metadata.restCoordinateVertices, 33207); assert.match(metadata.program, /character-rest/); }
  else assert.equal(metadata.restCoordinateVertices, 0, 'Negative control must use the unbound v30 sphere path');
  assert.equal(metadata.petStatus, 'procedural-placeholder');
  for (const [name, angle] of [['front', 0], ['oblique', Math.PI / 4], ['side', Math.PI / 2]]) for (const diagnosis of [false, true]) {
    const result = await page.evaluate(args => window.fireQA.frame(...args), [angle, diagnosis]);
    assert(result.draws > 0); assert.deepEqual(result.errors, []);
    assert.equal(result.clock.resetSeconds, 0); assert.equal(result.clock.steps, 135);
    assert(Math.abs(result.clock.materialSeconds - 2.25) < 1e-10, 'Both API paths must reach 2.25 material seconds');
    assert(Math.abs(result.clock.uploadedSeconds - 2.25) < 1e-6, 'Actual uploaded GPU time uniform must equal 2.25');
    assert(result.clock.effectClocks.every(effect => Math.abs(effect.seconds - 2.25) < 1e-10));
    const file = `${diagnosis ? 'coordinates' : 'fire'}-${name}.png`; await page.screenshot({ path: path.join(output, file) });
    frames.push({ file, angle, diagnostic: diagnosis, clock: result.clock, conditions: result.conditions });
  }
  memory = await page.evaluate(() => window.fireQA.dispose()); assert.equal(memory.geometries, 0);
  assert.deepEqual(errors, []); assert.deepEqual(outbound, []);
  console.log(JSON.stringify({ status: 'PASS', phase, metadata, frames: frames.length, memory }));
} catch (e) { errors.push(e.stack || String(e)); process.exitCode = 1; console.error(e); }
finally {
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ status: process.exitCode ? 'FAIL' : 'PASS', phase, sourceCommit, harnessSHA256, loaderSHA256, metadata, frames, memory, errors, outbound,
    timing: 'Each frame resets, advances 135 steps at 1/60 second, then asserts both shader uniform reference and uploaded GPU time at 2.25 seconds',
    limits: ['Supersedes initial fire captures where native v30 delta=0 held material time at 0 while candidate absolute time was 2.25', 'Diagnostic grid replaces shading only in clearly named coordinate screenshots; fire screenshots use the actual runtime material and effects', 'Same 8 cycles per coordinate unit in both diagnostic modes; coordinate units are collapsed unit directions in v30, displayed rest units in candidate', 'This comparison harness does not enable shadows or add a ground; separate flame shadow regression uses actual Canvas shadow conditions', 'Local Chromium SwiftShader, no hosted authenticated session or physical mobile GPU', 'No authored animal GLB is available; the existing tiger remains a temporary procedural model'] }, null, 2) + '\n');
  await browser?.close(); await server.close();
}
