// Actual new authored GLB, source materials, skinning and declared idle.
// SAJU_QA_PLAYWRIGHT_PATH=/absolute/playwright/index.mjs node scripts/qa/tiger-authored-browser.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';

const root = process.cwd(), output = path.join(root, 'outputs/tiger-authored-browser');
await fs.mkdir(output, { recursive: true });
const harness = path.join(output, 'harness.mjs');
await fs.writeFile(harness, `
import * as THREE from 'three';
import {loadZodiacPet,createZodiacPet} from '../../lib/planet/spirit-zodiac-pet';
import {loadApprovedSpirit} from '../../lib/planet/approved-jade-spirit';
import {createStudioEnvironment} from '../../lib/planet/scene-environment';
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(720,720);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
document.body.style.cssText='margin:0;background:#edf2ea';document.body.append(renderer.domElement);
const scene=new THREE.Scene(),env=createStudioEnvironment(renderer);scene.background=new THREE.Color('#edf2ea');scene.environment=env.texture;scene.environmentIntensity=1.05;
scene.add(new THREE.HemisphereLight(0xf4f8fc,0x26343b,.85));
for(const [color,intensity,position] of [[0xfff1d9,2.1,[-3,4,4]],[0xc1e4f0,.8,[4,1,2]],[0xf5fbff,1.8,[0,3,-3]]]){const l=new THREE.DirectionalLight(color,intensity);l.position.set(...position);if(position[0]<0){l.castShadow=true;l.shadow.mapSize.set(1024,1024);l.shadow.camera.left=-2;l.shadow.camera.right=2;l.shadow.camera.top=3;l.shadow.camera.bottom=-2;l.shadow.bias=-.0002;}scene.add(l);}
const floor=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.ShadowMaterial({opacity:.15}));floor.rotation.x=-Math.PI/2;floor.position.y=-.001;floor.receiveShadow=true;scene.add(floor);
const camera=new THREE.PerspectiveCamera(32,1,.01,40);
const errors=[];renderer.debug.onShaderError=(gl,p,v,f)=>errors.push({program:gl.getProgramInfoLog(p),vertex:gl.getShaderInfoLog(v),fragment:gl.getShaderInfoLog(f)});
const pet=await loadZodiacPet('인'),fallback=createZodiacPet('인');scene.add(pet.group);fallback.group.visible=false;scene.add(fallback.group);
const spirit=await loadApprovedSpirit('기인','갑자','high');spirit.group.visible=false;scene.add(spirit.group);
const box=object=>{object.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(object,true);return{min:b.min.toArray(),max:b.max.toArray(),size:b.getSize(new THREE.Vector3()).toArray()};};
const pose=()=>{const bones=[];pet.group.traverse(o=>{if(o.isBone)bones.push({name:o.name,position:o.position.toArray(),quaternion:o.quaternion.toArray(),scale:o.scale.toArray()});});return bones;};
const hash=async a=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(a.buffer,a.byteOffset,a.byteLength)))].map(x=>x.toString(16).padStart(2,'0')).join('');
window.tigerQA={
 metadata(){let meshes=0,triangles=0,skinned=0,textureMapped=0,emissive=0;pet.group.traverse(o=>{if(!o.isMesh)return;meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;skinned+=Number(!!o.isSkinnedMesh);textureMapped+=Number(!!o.material.map);emissive+=Number(!!o.material.emissive?.getHex());});return{...pet.group.userData,meshes,triangles,skinned,textureMapped,emissive,bounds:box(pet.group)};},
 frame(angle,time,mode='new'){pet.group.visible=mode==='new';fallback.group.visible=mode==='fallback';spirit.group.visible=mode==='pair';
 pet.group.rotation.y=angle;fallback.group.rotation.y=angle;pet.update(time);fallback.update(time);spirit.reset();spirit.update(time,0,camera);
 if(mode==='pair'){spirit.avatarPivot.rotation.y=angle;camera.position.set(0,1.6,5.8);camera.lookAt(0,1.24,0);}else{camera.position.set(0,.39,1.78);camera.lookAt(0,.33,0);}
 renderer.render(scene,camera);return{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,errors,bounds:box(pet.group),pose:pose()};},
 async stem(stem,quality){pet.group.visible=false;fallback.group.visible=false;spirit.group.visible=false;
 const sample=await loadApprovedSpirit(stem+'인','갑자',quality);scene.add(sample.group);camera.position.set(0,1.6,5.8);camera.lookAt(0,1.24,0);
 sample.update(1.25,1/60,camera);renderer.render(scene,camera);
 const fireCardCasters=[];if(stem==='병'||stem==='정')sample.propGroup.traverse(o=>{if(o.isInstancedMesh)fireCardCasters.push(o.castShadow);});
 const result={stem,quality,pet:sample.zodiacPet.userData,bodyPositionSHA256:await hash(sample.bodyMesh.geometry.attributes.position.array),bodyUVSHA256:await hash(sample.bodyMesh.geometry.attributes.uv.array),depth:sample.avatarPivot.scale.z,bodyCastShadow:sample.bodyMesh.castShadow,fireCardCasters,calls:renderer.info.render.calls,errors};
 sample.avatarPivot.rotation.y=.8;sample.update(1.25,0,camera);renderer.render(scene,camera);result.posedCalls=renderer.info.render.calls;
 sample.dispose();renderer.render(scene,camera);result.memoryAfterDispose={...renderer.info.memory};return result;},
 dispose(){pet.dispose();fallback.dispose();spirit.dispose();floor.removeFromParent();floor.geometry.dispose();floor.material.dispose();scene.environment=null;env.dispose();renderer.render(scene,camera);const memory={...renderer.info.memory};renderer.dispose();return memory;}
};
`);
const server = await createServer({ root, configFile: false, logLevel: 'error', server: { host: '127.0.0.1', port: 0 }, optimizeDeps: { noDiscovery: true },
  plugins: [{ name: 'tiger-authored-qa', configureServer(s) { s.middlewares.use((req, res, next) => {
    if (req.url !== '/__tiger') return next();
    res.setHeader('Content-Type', 'text/html'); res.end('<html><body><script type="module" src="/' + path.relative(root, harness).replaceAll('\\', '/') + '"></script></body></html>');
  }); } }] });
let browser, metadata, memory;
const errors = [], outbound = [], frames = [], stems = [];
try {
  await server.listen(); const origin = server.resolvedUrls.local[0];
  const { chromium } = process.env.SAJU_QA_PLAYWRIGHT_PATH ? await import(pathToFileURL(process.env.SAJU_QA_PLAYWRIGHT_PATH).href) : await import('playwright');
  browser = await chromium.launch({ executablePath: process.env.SAJU_QA_CHROME || '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 720, height: 720 } });
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('**/*', route => { const url = new URL(route.request().url());
    if (url.origin === new URL(origin).origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
    outbound.push(url.origin); return route.abort(); });
  await page.goto(origin + '__tiger'); await page.waitForFunction(() => !!window.tigerQA);
  metadata = await page.evaluate(() => window.tigerQA.metadata());
  assert.equal(metadata.assetStatus, 'authored-glb'); assert.equal(metadata.authorship, 'new-reconstruction');
  assert.equal(metadata.originalSourceStatus, 'missing-source'); assert.equal(metadata.latestApprovedStatus, 'new-candidate-unapproved');
  assert.equal(metadata.animation.clip, 'TigerIdle'); assert.equal(metadata.animation.duration, 5);
  assert.equal(metadata.skinned, 1); assert.equal(metadata.textureMapped, 1); assert.equal(metadata.emissive, 0);
  assert(metadata.triangles < 50000, 'keep the one pet below 50k triangles');
  for (const [name, angle] of [['front', 0], ['oblique', Math.PI / 4], ['side', Math.PI / 2]]) {
    for (const mode of ['fallback', 'new', 'pair']) {
      const frame = await page.evaluate(args => window.tigerQA.frame(...args), [angle, 0, mode]);
      assert(frame.calls > 0); assert.deepEqual(frame.errors, []);
      const file = `${mode}-${name}.png`; await page.screenshot({ path: path.join(output, file) });
      frames.push({ file, angle, time: 0, mode, calls: frame.calls, triangles: frame.triangles });
    }
  }
  let firstPose, changed = false;
  for (const time of [0, 1.25, 2.5, 3.75, 5]) {
    const frame = await page.evaluate(t => window.tigerQA.frame(0, t), time);
    if (!firstPose) firstPose = frame.pose;
    if (time === 5) assert.deepEqual(frame.pose, firstPose, 'idle loop endpoint returns exactly to initial pose');
    else if (time > 0) changed ||= JSON.stringify(frame.pose) !== JSON.stringify(firstPose);
    const file = `idle-${String(time).replace('.', '_')}.png`; await page.screenshot({ path: path.join(output, file) });
    frames.push({ file, angle: 0, time, mode: 'new', bounds: frame.bounds, pose: frame.pose });
  }
  assert(changed, 'the loaded animation changes the actual source bones');
  for (const quality of ['low', 'high']) for (const stem of ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계']) {
    const result = await page.evaluate(args => window.tigerQA.stem(...args), [stem, quality]);
    assert.equal(result.pet.assetStatus, 'authored-glb'); assert.equal(result.pet.authoredSha256, metadata.authoredSha256);
    assert.equal(result.pet.animation.clip, 'TigerIdle'); assert.equal(result.depth, 1.35);
    assert.equal(result.bodyPositionSHA256, 'f7e39c85723b4220d0e69161e4405c3232d514b18be56e8a3854ec6fff48da8b');
    assert.equal(result.bodyUVSHA256, 'f3300a24812551e09c6b6a4bc31795feb19c80dc22cf1708cda7a64890e9539c');
    assert.equal(result.bodyCastShadow, true);
    if (stem === '병' || stem === '정') { assert(result.fireCardCasters.length > 0); assert(result.fireCardCasters.every(casts => !casts)); }
    assert(result.calls > 0 && result.posedCalls > 0); assert.deepEqual(result.errors, []); stems.push(result);
  }
  assert(stems.every(result => JSON.stringify(result.memoryAfterDispose) === JSON.stringify(stems[0].memoryAfterDispose)), 'owned pet/temporary spirit resources remain flat through all 20 switches');
  memory = await page.evaluate(() => window.tigerQA.dispose()); assert.equal(memory.geometries, 0);
  assert.deepEqual(errors, []); assert.deepEqual(outbound, []);
  console.log(JSON.stringify({ status: 'PASS', metadata, frames: frames.length, stemQualityLoads: stems.length, memory }));
} catch (e) { errors.push(e.stack || String(e)); process.exitCode = 1; console.error(e); }
finally {
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ status: process.exitCode ? 'FAIL' : 'PASS', metadata, frames, stems, memory, errors, outbound,
    limits: ['New unapproved candidate, not a recovered historical tiger original', 'Actual locally served GLB and source materials/skin/idle; local Chromium SwiftShader, no hosted session or physical mobile GPU', 'Frames compare the unchanged procedural study with the new animal; the eleven other animals are unchanged'] }, null, 2) + '\n');
  await browser?.close(); await server.close();
}
