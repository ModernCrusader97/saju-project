// Actual WebGL, production Canvas/wardrobe UI and real GLB/PNGs. Local only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
const root = process.cwd(), output = path.resolve('outputs/spirit-fashion/browser'); await fs.mkdir(output, { recursive: true });
const harness = path.join(output, 'harness.mjs'), component = path.join(output, 'component.mjs');
await fs.writeFile(harness, `
import * as THREE from 'three';
import {loadApprovedSpirit} from '../../../lib/planet/approved-jade-spirit';
import {EMPTY_FASHION} from '../../../lib/planet/spirit-fashion-catalog';
import {createStudioEnvironment} from '../../../lib/planet/scene-environment';
document.body.style.cssText='margin:0;background:#edf2ea';
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(640,640);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;document.body.append(renderer.domElement);
const errors=[];renderer.debug.onShaderError=(gl,program)=>errors.push(gl.getProgramInfoLog(program));
const scene=new THREE.Scene();scene.background=new THREE.Color('#edf2ea');const environment=createStudioEnvironment(renderer);scene.environment=environment.texture;scene.environmentIntensity=1.05;
scene.add(new THREE.HemisphereLight(0xf4f8fc,0x26343b,.85));const key=new THREE.DirectionalLight(0xfff1d9,2.1);key.position.set(-3,4,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-2.5,right:2.5,top:3,bottom:-2,near:.1,far:16});key.shadow.bias=-.0002;scene.add(key);
for(const [color,intensity,position] of [[0xc1e4f0,.8,[4,1,2]],[0xf5fbff,1.8,[0,3,-3]]]){const light=new THREE.DirectionalLight(color,intensity);light.position.set(...position);scene.add(light);}
const ground=new THREE.Mesh(new THREE.PlaneGeometry(12,12),new THREE.ShadowMaterial({color:0x1c4836,opacity:.09}));ground.rotation.x=-Math.PI/2;ground.position.y=-.016;ground.receiveShadow=true;scene.add(ground);
const camera=new THREE.PerspectiveCamera(38,1,.1,40);camera.position.set(0,1.7,5.7);camera.lookAt(0,1.24,0);
let current;const gl=renderer.getContext(),buffers=new Set();let created=0,deleted=0;
const create=gl.createBuffer.bind(gl),remove=gl.deleteBuffer.bind(gl);gl.createBuffer=(...args)=>{const b=create(...args);buffers.add(b);created++;return b;};gl.deleteBuffer=b=>{if(buffers.delete(b))deleted++;return remove(b);};
const hash=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
const effectMatrices=()=>{const rows=[];current.propGroup.traverse(o=>{if(o.isInstancedMesh)rows.push([o.name,...o.instanceMatrix.array]);});return JSON.stringify(rows);};
function render(t=2.25){current?.update(t,0,camera);scene.updateMatrixWorld(true);renderer.render(scene,camera);renderer.render(scene,camera);}
async function imageHash(){const data=new Uint8Array(640*640*4);gl.readPixels(0,0,640,640,gl.RGBA,gl.UNSIGNED_BYTE,data);let colors=new Set();for(let i=0;i<data.length;i+=32)colors.add(data[i]+','+data[i+1]+','+data[i+2]);return{pixelHash:await hash(data),colors:colors.size};}
function attachmentState(){const owner=current.fashion.group.parent,body=current.bodyMesh;let maxSupportError=0,minNormalDot=1;
 const supports=current.fashion.group.children.map(item=>{const s=item.userData.support,v=[0,1,2].map(j=>body.getVertexPosition(body.geometry.index.getX(s.triangle*3+j),new THREE.Vector3()));
 const actual=v.reduce((sum,p,j)=>sum.addScaledVector(p,s.barycentric[j]),new THREE.Vector3()).applyMatrix4(body.matrixWorld),published=new THREE.Vector3(...s.position).applyMatrix4(current.fashion.group.matrixWorld);
 const normal=new THREE.Triangle(...v).getNormal(new THREE.Vector3()).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(body.matrixWorld));
 maxSupportError=Math.max(maxSupportError,actual.distanceTo(published));minNormalDot=Math.min(minNormalDot,new THREE.Vector3(0,0,1).transformDirection(item.matrixWorld).dot(normal));
 return{id:item.userData.fashionItemId,support:actual.toArray(),worldPosition:item.getWorldPosition(new THREE.Vector3()).toArray()};});
 return{waveWeight:body.morphTargetInfluences[0],owner:owner.name,ownerMatrix:owner.matrixWorld.toArray(),supports,maxSupportError,minNormalDot,regionWorldCenters:owner.userData.surfaceAttachmentExclusions.map(r=>new THREE.Vector3(...r.min).add(new THREE.Vector3(...r.max)).multiplyScalar(.5).applyMatrix4(owner.matrixWorld).toArray())};}
window.fashionQA={errors,async load(day='갑자',quality='high') {current?.dispose();renderer.render(scene,camera);current=await loadApprovedSpirit(day,'병인',quality);scene.add(current.group);render();const geometry=current.bodyMesh.geometry;return{day,quality,defaultItems:current.fashion.group.children.length,bodyPositionHash:await hash(new Uint8Array(geometry.attributes.position.array.buffer)),bodyUVHash:await hash(new Uint8Array(geometry.attributes.uv.array.buffer)),depth:current.avatarPivot.scale.z,effects:effectMatrices(),...await imageHash()};},
 async set(selection,angle=0,t=2.25){const began=performance.now();current.fashion.set(selection);const equipMs=performance.now()-began;current.avatarPivot.rotation.y=angle;render(t);return{...current.fashion.group.userData.diagnostics,...attachmentState(),effects:effectMatrices(),equipMs,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,...await imageHash()};},
 async frame(t,angle=0){current.avatarPivot.rotation.y=angle;render(t);return{...attachmentState(),...await imageHash()};},
 async wave(t=.65,angle=0){current.reset();current.update(0,0,camera);current.triggerReaction();current.avatarPivot.rotation.y=angle;render(t);return{...attachmentState(),...await imageHash()};},
 async clear(){current.fashion.set(EMPTY_FASHION);current.reset();render();return{effects:effectMatrices(),...await imageHash()};},
 memory(){return{...renderer.info.memory,buffers:buffers.size,created,deleted};},async dispose(){current?.dispose();current=null;renderer.render(scene,camera);return{...renderer.info.memory,buffers:buffers.size,created,deleted};},
 finish(){current?.dispose();scene.environment=null;environment.dispose();ground.geometry.dispose();ground.material.dispose();key.shadow.dispose();renderer.dispose();return{buffers:buffers.size,created,deleted};}};
`);
await fs.writeFile(component, `
import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
import ElementalSpiritCanvas from '../../../components/planet/ElementalSpiritCanvas';import SpiritFashionPanel from '../../../components/planet/SpiritFashionPanel';
import {useSpiritFashion} from '../../../hooks/use-spirit-fashion';import {fashionStem} from '../../../lib/planet/spirit-fashion-catalog';
import '../../../app/globals.css';
document.body.style.cssText='margin:0;background:#edf2ea;padding:12px';document.head.insertAdjacentHTML('beforeend','<style>[data-scene]{height:520px;min-height:520px}[data-scene]>div:first-child{height:100%}.spirit-fashion-panel{margin:12px 0;padding:16px;background:white}button[aria-pressed=true]{outline:2px solid #52856b}.fashion-slot-grid{display:grid!important}</style>');
let setDay,draws=0;for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const prior=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...args){draws++;return prior.apply(this,args);};}
function App(){const[day,changeDay]=React.useState('갑자');setDay=changeDay;const wardrobe=useSpiritFashion(fashionStem(day));return React.createElement(React.Fragment,null,React.createElement(ElementalSpiritCanvas,{dayKey:day,monthKey:'병인',fashion:wardrobe.selection}),React.createElement(SpiritFashionPanel,{stem:fashionStem(day),selection:wardrobe.selection,onChange:wardrobe.change,ready:wardrobe.ready,persisted:wardrobe.persisted}));}
const host=document.createElement('main');document.body.append(host);const root=createRoot(host);root.render(React.createElement(React.StrictMode,null,React.createElement(App)));
window.componentQA={setDay:day=>flushSync(()=>setDay(day)),draws:()=>draws,unmount:()=>root.unmount(),async pixels(){const canvas=document.querySelector('canvas');return canvas?.toDataURL();}};
`);
const server = await createServer({ root, configFile: false, cacheDir: path.join(output, '.vite-cache'), logLevel: 'error', resolve: { alias: { '@': root } }, server: { host: '127.0.0.1', port: 4207, strictPort: true },
  optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'] },
  plugins: [{ name: 'qa', configureServer(s) { s.middlewares.use((req, res, next) => {
    if (req.url === '/favicon.ico') { res.statusCode = 204; res.end(); return; }
    const file = req.url === '/__fashion' ? harness : req.url === '/__fashion-ui' ? component : null;
    if (!file) return next(); res.setHeader('Content-Type', 'text/html'); res.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><script type="module" src="/' + path.relative(root, file).replaceAll('\\', '/') + '"></script></body></html>');
  }); } }] });
await server.listen();
const { chromium } = await import(pathToFileURL(process.env.SAJU_QA_PLAYWRIGHT_PATH || '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const report = { status: 'RUNNING', checks: [], errors: [], outbound: [], results: [], motion: [], limits: ['Local Chromium SwiftShader; no physical GPU/device test.', 'Uses production loader, actual approved GLB/PNGs, and production Canvas + wardrobe component/hook.', 'No deployed fashion or hosted authenticated visual claim.', 'Physical fabric/fire collisions are not simulated.'] };
let browser;
const outfit = { head: 'sprout-pin', face: 'round-sunglasses', neck: 'ribbon-bow', back: 'leaf-brooch' };
function record(page) { page.on('pageerror', error => report.errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); }); page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:4207') && !request.url().startsWith('data:') && !request.url().startsWith('blob:')) report.outbound.push(request.url()); }); }
try {
  browser = await chromium.launch({ executablePath: process.env.SAJU_QA_CHROME || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  if (process.env.SAJU_QA_UI_ONLY !== '1') {
  const page = await browser.newPage({ viewport: { width: 640, height: 640 } }); record(page); await page.goto('http://127.0.0.1:4207/__fashion'); await page.waitForFunction(() => !!window.fashionQA);
  // Three allocates a renderer-owned transmission target lazily when the first
  // transmissive jade/dew material is drawn. Warm those actual paths BEFORE
  // comparing disposal baselines; its lifetime belongs to renderer.dispose().
  for (const day of ['기사', '계유']) { await page.evaluate(day => window.fashionQA.load(day, 'high'), day); await page.evaluate(() => window.fashionQA.dispose()); }
  report.rendererWarmup = await page.evaluate(() => window.fashionQA.memory());
  let clean;
  for (const quality of ['low', 'high']) for (const day of ['갑자', '을축', '병인', '정묘', '무진', '기사', '경오', '신미', '임신', '계유']) {
    const base = await page.evaluate(([day, quality]) => window.fashionQA.load(day, quality), [day, quality]); assert.equal(base.defaultItems, 0); assert.equal(base.depth, 1.35);
    assert.equal(base.bodyPositionHash, 'f7e39c85723b4220d0e69161e4405c3232d514b18be56e8a3854ec6fff48da8b'); assert.equal(base.bodyUVHash, 'f3300a24812551e09c6b6a4bc31795feb19c80dc22cf1708cda7a64890e9539c');
    const dressed = await page.evaluate(outfit => window.fashionQA.set(outfit), outfit); assert.equal(dressed.itemCount, 4); assert.equal(dressed.exclusions.length, 4); assert(dressed.colors > 400); assert.notEqual(dressed.pixelHash, base.pixelHash); assert(dressed.equipMs < 300, 'four-item synchronous build budget is 300ms on this QA host');
    if (quality === 'high' && ['갑자', '병인', '기사', '계유'].includes(day)) await page.screenshot({ path: path.join(output, day + '-four-items-front.png') });
    const masked = await page.evaluate(config => window.fashionQA.set(config, 1.05), { ...outfit, head: 'crescent-pin', face: 'fitted-mask' }); assert.equal(masked.itemCount, 4); assert.notEqual(masked.pixelHash, dressed.pixelHash); assert(masked.equipMs < 300, 'mask build budget is 300ms on this QA host');
    if (quality === 'high' && ['갑자', '을축', '병인', '계유'].includes(day)) await page.screenshot({ path: path.join(output, day + '-mask-side.png') });
    if (quality === 'high') {
      const wave = await page.evaluate(() => window.fashionQA.wave(.65, 1.05)); assert(wave.waveWeight > .37 && wave.waveWeight <= .45); assert.equal(wave.owner, 'ApprovedSpiritMotion');
      assert(wave.maxSupportError < 1e-7 && wave.minNormalDot > .99999); assert.equal(wave.supports.length, 4); assert.notEqual(wave.pixelHash, masked.pixelHash); assert.notDeepEqual(wave.regionWorldCenters, masked.regionWorldCenters);
      report.motion.push({ day, quality, ...wave }); if (['갑자', '을축', '병인', '계유'].includes(day)) await page.screenshot({ path: path.join(output, day + '-mask-wave-side.png') });
    }
    const cleared = await page.evaluate(() => window.fashionQA.clear()); assert.equal(cleared.effects, base.effects, 'original stable attachment matrices must return'); assert.equal(cleared.pixelHash, base.pixelHash, 'default rendered image must return at same shader time');
    const memory = await page.evaluate(() => window.fashionQA.dispose()); const snapshot = { geometries: memory.geometries, textures: memory.textures, buffers: memory.buffers }; clean ??= snapshot; assert.deepEqual(snapshot, clean, 'no per-stem/material/item GPU resource residue');
    report.results.push({ day, quality, bodyPositionHash: base.bodyPositionHash, bodyUVHash: base.bodyUVHash, depth: base.depth, dressed: { itemCount: dressed.itemCount, equipMs: dressed.equipMs, drawCalls: dressed.drawCalls, triangles: dressed.triangles, pixelHash: dressed.pixelHash }, mask: { equipMs: masked.equipMs, pixelHash: masked.pixelHash }, clearRestoresImage: true, memory: snapshot });
  }
  report.checks.push('40 actual GLB/PNG renders: ten stems × two qualities × sunglasses/mask outfits; original geometry and same-time default image restored');
  report.checks.push('ten actual WebGL original-wave poses: hardware current triangle supports/normals and moving motionRoot regions; screenshots front/side');
  await page.evaluate(() => window.fashionQA.load('계유', 'high')); await page.evaluate(outfit => window.fashionQA.set(outfit), outfit);
  const frames=[];for (const [time, angle, name] of [[0, 0, 'idle-start'], [1.5, 0, 'idle-later'], [1.5, 1.57, 'rotated-profile'], [1.5, 3.14, 'rotated-back']]) { frames.push(await page.evaluate(([t, a]) => window.fashionQA.frame(t, a), [time, angle])); await page.screenshot({ path: path.join(output, '계유-' + name + '.png') }); }
  assert.notDeepEqual(frames[0].supports.map(p=>p.worldPosition),frames[1].supports.map(p=>p.worldPosition)); assert.notDeepEqual(frames[0].regionWorldCenters,frames[1].regionWorldCenters); assert(frames.every(f=>f.maxSupportError<1e-7&&f.minNormalDot>.99999));
  report.idle=frames.slice(0,2);await page.evaluate(()=>window.fashionQA.wave(.65,0));await page.screenshot({path:path.join(output,'계유-sunglasses-wave-front.png')});
  report.checks.push('actual front/profile/back and separate idle-time keyframes captured with model-mounted accessories');
  report.buffers = await page.evaluate(() => window.fashionQA.finish()); assert.equal(report.buffers.buffers, 0); assert.equal(report.buffers.created, report.buffers.deleted); assert.deepEqual(await page.evaluate(() => window.fashionQA.errors), []); await page.close();
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const ui = await context.newPage(); record(ui); await ui.goto('http://127.0.0.1:4207/__fashion-ui'); await ui.waitForSelector('[data-scene-state="ready"]'); await ui.getByRole('button', { name: '새싹 핀 착용', exact: true }).waitFor();
  for (const slot of ['머리', '얼굴', '목', '등']) assert.equal(await ui.getByRole('button', { name: slot + ' 장식 벗기' }).getAttribute('aria-pressed'), 'true');
  for (const label of ['새싹 핀', '동그란 선글라스', '작은 리본', '잎사귀 등 장식']) { await ui.getByRole('button', { name: label + ' 착용', exact: true }).click(); await ui.waitForTimeout(50); }
  await ui.getByRole('button', { name: '곡면 마스크 착용', exact: true }).click(); await ui.waitForTimeout(80); assert.equal(await ui.getByRole('button', { name: '동그란 선글라스 착용', exact: true }).getAttribute('aria-pressed'), 'false');
  assert.equal(await ui.getByRole('button', { name: '곡면 마스크 착용', exact: true }).getAttribute('aria-pressed'), 'true');
  await ui.screenshot({ path: path.join(output, 'mobile-ui-four-items-mask.png'), fullPage: true });
  const stored = await ui.evaluate(() => JSON.parse(localStorage.getItem('saju.spirit-fashion.v1'))); assert.equal(stored.version, 1); assert.equal(stored.outfits.갑.face, 'fitted-mask'); assert.equal(stored.outfits.을.face, null);
  await ui.evaluate(() => window.componentQA.setDay('경오')); await ui.waitForSelector('[data-scene-state="ready"]'); assert.equal(await ui.getByRole('button', { name: '머리 장식 벗기' }).getAttribute('aria-pressed'), 'true');
  await ui.getByRole('button', { name: '초승달 핀 착용', exact: true }).click(); await ui.waitForTimeout(50);
  await ui.evaluate(() => window.componentQA.setDay('갑자')); await ui.waitForSelector('[data-scene-state="ready"]'); assert.equal(await ui.getByRole('button', { name: '곡면 마스크 착용', exact: true }).getAttribute('aria-pressed'), 'true');
  await ui.reload(); await ui.waitForSelector('[data-scene-state="ready"]'); assert.equal(await ui.getByRole('button', { name: '곡면 마스크 착용', exact: true }).getAttribute('aria-pressed'), 'true');
  report.checks.push('production wardrobe UI: equip/face replace/four-slot combination, per-stem switch and browser reload persistence');
  await ui.getByRole('button', { name: '얼굴 장식 벗기' }).click(); await ui.waitForTimeout(80); const canvas = ui.locator('canvas'); const rect = await canvas.boundingBox();
  const initial = await ui.evaluate(() => window.componentQA.pixels());
  await ui.mouse.move(rect.x + 180, rect.y + 270); await ui.mouse.down(); await ui.mouse.move(rect.x + 320, rect.y + 270, { steps: 8 }); await ui.mouse.up();
  assert.notEqual(await ui.evaluate(() => window.componentQA.pixels()), initial); await ui.screenshot({ path: path.join(output, 'mobile-ui-paused-rotation.png'), fullPage: true });
  await ui.getByRole('button', { name: '정령 정면과 움직임 초기화', exact: true }).click(); await ui.waitForTimeout(50); assert.equal(await ui.evaluate(() => window.componentQA.pixels()), initial);
  const paused = await ui.evaluate(() => window.componentQA.draws()); await ui.waitForTimeout(180); assert.equal(await ui.evaluate(() => window.componentQA.draws()), paused);
  await ui.getByRole('button', { name: '정령 움직임 재생', exact: true }).click(); await canvas.click({ position: { x: 180, y: 270 }, force: true }); await ui.waitForTimeout(180); await ui.getByRole('button', { name: '정령 움직임 일시정지', exact: true }).click();
  await ui.screenshot({ path: path.join(output, 'mobile-ui-expression-frame.png'), fullPage: true }); assert(await ui.evaluate(() => window.componentQA.draws()) > paused);
  await ui.getByRole('button', { name: '정령 움직임 재생', exact: true }).click(); await ui.waitForTimeout(500); await ui.getByRole('button', { name: '정령 움직임 일시정지', exact: true }).click();
  await ui.screenshot({ path: path.join(output, 'mobile-ui-wave-frame.png'), fullPage: true });
  await ui.getByRole('button', { name: '장식 모두 벗기', exact: true }).click(); await ui.waitForTimeout(80); for (const slot of ['머리', '얼굴', '목', '등']) assert.equal(await ui.getByRole('button', { name: slot + ' 장식 벗기' }).getAttribute('aria-pressed'), 'true');
  report.checks.push('actual Canvas reduced-motion pause, paused rotation, reset, original greeting/blink and raised-wave frames, playback and clear all');
  for (const corrupt of ['{bad', JSON.stringify({ version: 2, outfits: { 갑: outfit } })]) {
    await ui.evaluate(value => localStorage.setItem('saju.spirit-fashion.v1', value), corrupt); await ui.reload(); await ui.waitForSelector('[data-scene-state="ready"]');
    for (const slot of ['머리', '얼굴', '목', '등']) assert.equal(await ui.getByRole('button', { name: slot + ' 장식 벗기' }).getAttribute('aria-pressed'), 'true');
    assert.equal(await ui.getByRole('button', { name: '작은 리본 착용', exact: true }).isEnabled(), true);
  }
  report.checks.push('production hook reload repairs damaged JSON and rejects unknown storage versions without blocking the scene');
  await ui.evaluate(() => window.componentQA.unmount()); const stopped = await ui.evaluate(() => window.componentQA.draws()); await ui.waitForTimeout(180); assert.equal(await ui.evaluate(() => window.componentQA.draws()), stopped); assert.equal(await ui.locator('canvas').count(), 0);
  report.checks.push('StrictMode production Canvas unmount stops rendering and removes canvas'); await context.close();
  const denied = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await denied.addInitScript(() => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === 'saju.spirit-fashion.v1') throw new DOMException('QA blocked wardrobe storage', 'QuotaExceededError'); return original.call(this, key, value); }; });
  const deniedUI = await denied.newPage(); record(deniedUI); await deniedUI.goto('http://127.0.0.1:4207/__fashion-ui'); await deniedUI.waitForSelector('[data-scene-state="ready"]');
  await deniedUI.getByRole('button', { name: '작은 리본 착용', exact: true }).click(); await deniedUI.getByText('저장할 수 없어 이번 화면에서만 착용돼요.', { exact: false }).waitFor();
  assert.equal(await deniedUI.getByRole('button', { name: '작은 리본 착용', exact: true }).getAttribute('aria-pressed'), 'true');
  await deniedUI.evaluate(() => window.componentQA.unmount()); await denied.close(); report.checks.push('actual storage write denial keeps equipment usable and reports browser-only unsaved state');
  assert.deepEqual(report.errors, []); assert.deepEqual(report.outbound, []); report.status = 'PASS'; console.log(JSON.stringify({ status: report.status, checks: report.checks, buffers: report.buffers, renders: report.results.length }));
} catch (error) { report.status = 'FAIL'; report.errors.push(error.stack || String(error)); process.exitCode = 1; console.error(error); }
finally { await fs.writeFile(path.join(output, process.env.SAJU_QA_UI_ONLY === '1' ? 'ui-report.json' : 'report.json'), JSON.stringify(report, null, 2) + '\n'); await browser?.close(); await server.close(); }
