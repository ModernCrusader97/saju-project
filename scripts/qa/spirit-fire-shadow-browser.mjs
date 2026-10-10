// Actual GLB/fire shaders, Canvas-equivalent shadows, and the actual React Canvas.
// Before records immutable candidate ee6e974's erroneous flame-card casters.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';

const root = process.cwd(), phase = process.env.SAJU_QA_PHASE || 'after';
assert(['before', 'after'].includes(phase));
const output = path.join(root, 'outputs/spirit-fire-shadow', phase);
await fs.mkdir(output, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const source = {
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  loaderSHA256: sha(await fs.readFile('lib/planet/approved-jade-spirit.ts')),
  canvasSHA256: sha(await fs.readFile('components/planet/ElementalSpiritCanvas.tsx')),
  harnessSHA256: sha(await fs.readFile(new URL(import.meta.url))),
};
const shared = `
const meshRows=root=>{const rows=[];root.traverse(o=>{if(o.isMesh)rows.push({name:o.name,castShadow:o.castShadow,receiveShadow:o.receiveShadow,instanced:!!o.isInstancedMesh,geometry:o.geometry.type,transparent:!!o.material.transparent,customDepthMaterial:!!o.customDepthMaterial});});return rows;};
const inspect=(spirit,renderer,scene,camera)=>{const effects=new Set();spirit.propGroup.traverse(o=>effects.add(o));const body=[];spirit.avatarPivot.traverse(o=>{if(o.isMesh&&!effects.has(o))body.push({name:o.name,castShadow:o.castShadow});});const key=scene.children.find(o=>o.isDirectionalLight&&o.castShadow),ground=scene.children.find(o=>o.isMesh&&o.material.type==='ShadowMaterial');
return {body,particles:meshRows(spirit.propGroup),shadowMap:{enabled:renderer.shadowMap.enabled,type:renderer.shadowMap.type},keyLight:{color:key.color.getHexString(),intensity:key.intensity,position:key.position.toArray(),mapSize:key.shadow.mapSize.toArray(),bias:key.shadow.bias,camera:Object.fromEntries(['left','right','top','bottom','near','far'].map(k=>[k,key.shadow.camera[k]]))},ground:{material:ground.material.type,opacity:ground.material.opacity,color:ground.material.color.getHexString(),receiveShadow:ground.receiveShadow,position:ground.position.toArray(),rotation:ground.rotation.toArray(),width:ground.geometry.parameters.width,height:ground.geometry.parameters.height},camera:{position:camera.position.toArray(),matrix:camera.matrixWorld.toArray(),projection:camera.projectionMatrix.toArray()},model:{position:spirit.avatarPivot.position.toArray(),scale:spirit.avatarPivot.scale.toArray(),rotation:spirit.avatarPivot.rotation.toArray(),morphs:spirit.bodyMesh.morphTargetInfluences},materialSeconds:spirit.bodyMesh.material.__qaClock?.value??null,effectSeconds:spirit.propGroup.children.filter(o=>o.material?.uniforms?.uTime).map(o=>o.material.uniforms.uTime.value)};};
const observeClock=spirit=>{const material=spirit.bodyMesh.material,compile=material.onBeforeCompile;material.onBeforeCompile=function(shader,...args){compile.call(this,shader,...args);material.__qaClock=shader.uniforms.uStemTime??shader.uniforms.uLsTime;};};
const hash=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
`;
const harness = path.join(output, 'harness.mjs');
await fs.writeFile(harness, `
import * as THREE from 'three';
import {loadApprovedSpirit} from '../../../lib/planet/approved-jade-spirit';
import {createStudioEnvironment} from '../../../lib/planet/scene-environment';
${shared}
document.body.style.cssText='margin:0;background:#edf2ea';
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setSize(480,480);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;document.body.append(renderer.domElement);
const scene=new THREE.Scene(),env=createStudioEnvironment(renderer);scene.environment=env.texture;scene.environmentIntensity=1.05;
scene.add(new THREE.HemisphereLight(0xf4f8fc,0x26343b,.85));const key=new THREE.DirectionalLight(0xfff1d9,2.1);key.position.set(-3,4,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-2.5,right:2.5,top:3,bottom:-2,near:.1,far:16});key.shadow.bias=-.0002;scene.add(key);
for(const [color,intensity,position]of[[0xc1e4f0,.8,[4,1,2]],[0xf5fbff,1.8,[0,3,-3]]]){const light=new THREE.DirectionalLight(color,intensity);light.position.set(...position);scene.add(light);}
const ground=new THREE.Mesh(new THREE.PlaneGeometry(12,12),new THREE.ShadowMaterial({color:0x1c4836,opacity:.09}));ground.rotation.x=-Math.PI/2;ground.position.y=-.016;ground.receiveShadow=true;scene.add(ground);
const camera=new THREE.PerspectiveCamera(38,1,.1,40);camera.position.set(0,1.7,5.7);camera.lookAt(0,1.24,0);
const errors=[];renderer.debug.onShaderError=(gl,p,v,f)=>errors.push({program:gl.getProgramInfoLog(p),vertex:gl.getShaderInfoLog(v),fragment:gl.getShaderInfoLog(f)});
let current,currentKey,defaultFlags;const pixels=new Map();
async function load(day,quality){if(currentKey===day+quality)return;current?.dispose();current=await loadApprovedSpirit(day,'병인',quality);currentKey=day+quality;observeClock(current);scene.add(current.group);defaultFlags=new Map();current.group.traverse(o=>{if(o.isMesh)defaultFlags.set(o,o.castShadow);});}
window.shadowQA={async frame(day,quality,angle,mode='production'){await load(day,quality);for(const[o,flag]of defaultFlags)o.castShadow=flag;current.reset();current.avatarPivot.rotation.y=angle;for(let step=1;step<=135;step++)current.update(step/60,1/60,camera);
 const effects=new Set();current.propGroup.traverse(o=>effects.add(o));if(mode!=='production')current.propGroup.traverse(o=>{if(o.isInstancedMesh)o.castShadow=false;});if(mode==='body-disabled')current.avatarPivot.traverse(o=>{if(o.isMesh&&!effects.has(o))o.castShadow=false;});
 renderer.render(scene,camera);const gl=renderer.getContext(),data=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,data);pixels.set(mode,data);return{...inspect(current,renderer,scene,camera),hash:await hash(data),draws:renderer.info.render.calls,errors};},
 compare(a,b){const first=pixels.get(a),second=pixels.get(b);let changedPixels=0,maxChannelDelta=0,totalDelta=0;for(let i=0;i<first.length;i+=4){let changed=false;for(let c=0;c<4;c++){const delta=Math.abs(first[i+c]-second[i+c]);changed||=delta>0;totalDelta+=delta;maxChannelDelta=Math.max(maxChannelDelta,delta);}if(changed)changedPixels++;}return{changedPixels,maxChannelDelta,totalDelta};},
 async casters(day,quality){await load(day,quality);return meshRows(current.avatarPivot).sort((a,b)=>a.name.localeCompare(b.name));},
 dispose(){current?.dispose();current=null;scene.remove(ground);ground.geometry.dispose();ground.material.dispose();key.shadow.dispose();renderer.render(scene,camera);return{...renderer.info.memory};}};
`);
const component = path.join(output, 'component.mjs');
await fs.writeFile(component, `
import React from 'react';import {createRoot}from'react-dom/client';import {flushSync}from'react-dom';import ElementalSpiritCanvas from '../../../components/planet/ElementalSpiritCanvas';
${shared}
document.body.style.cssText='margin:0;background:#edf2ea';document.head.insertAdjacentHTML('beforeend','<style>[data-scene]{position:relative;width:100%;height:520px}[data-scene]>div:first-child{width:100%;height:100%;min-height:380px}canvas{display:block}button{position:relative;z-index:3}</style>');
window.__qaInstances=[];let draws=0,last;
window.__qaObserveSpirit=spirit=>{observeClock(spirit);window.__qaInstances.push(spirit);return spirit;};
window.__qaObserveRenderer=renderer=>{const render=renderer.render;renderer.render=function(scene,camera){render.call(this,scene,camera);draws++;const spirit=window.__qaInstances.find(s=>s.group.parent===scene);if(spirit)last=inspect(spirit,renderer,scene,camera);};};
const mount=document.createElement('div');document.body.append(mount);const root=createRoot(mount);
window.canvasShadowQA={render(day='병인'){flushSync(()=>root.render(React.createElement(React.StrictMode,null,React.createElement(ElementalSpiritCanvas,{dayKey:day,monthKey:'병인'}))));},inspect(){return last;},draws(){return draws;},unmount(){flushSync(()=>root.unmount());}};window.canvasShadowQA.render();
`);
const constructor = 'renderer=new THREE.WebGLRenderer({antialias:!low,alpha:true,powerPreference:"high-performance",preserveDrawingBuffer:true});';
const server = await createServer({ root, configFile: false, logLevel: 'error', server: { host: '127.0.0.1', port: 0 },
  resolve: { alias: { '@': root } }, optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'] },
  plugins: [{ name: 'observe-production-canvas-shadow-state', enforce: 'pre', transform(code, id) {
    if (id.split('?')[0] === path.join(root, 'components/planet/ElementalSpiritCanvas.tsx')) {
      assert(code.includes(constructor), 'Canvas observation must attach to its existing renderer without changing setup');
      return code.replace(constructor, constructor + 'window.__qaObserveRenderer?.(renderer);');
    }
    if (id.split('?')[0] === path.join(root, 'lib/planet/approved-jade-spirit.ts')) {
      return code.replace('export async function loadApprovedSpirit(', 'async function observedProductionLoadApprovedSpirit(')
        + '\nexport async function loadApprovedSpirit(...args) { const spirit = await observedProductionLoadApprovedSpirit(...args); return window.__qaObserveSpirit?.(spirit) ?? spirit; }\n';
    }
  }, configureServer(s) { s.middlewares.use((req, res, next) => {
    const file = req.url === '/__shadow' ? harness : req.url === '/__canvas-shadow' ? component : null;
    if (!file) return next(); res.setHeader('Content-Type', 'text/html');
    res.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><script type="module" src="/' + path.relative(root, file).replaceAll('\\', '/') + '"></script></body></html>');
  }); } }] });
const results = [], checks = [], errors = [], outbound = [], nonFireCasters = {}, componentResults = [];
let browser, memory;
const assertFlags = (state, expectedParticleCasting, mapSize) => {
  assert.equal(state.body.length, 8); assert(state.body.every(mesh => mesh.castShadow), 'All original B meshes must remain shadow casters');
  assert.equal(state.particles.length, 1); assert(state.particles.every(mesh => mesh.instanced && mesh.transparent && !mesh.customDepthMaterial));
  assert(state.particles.every(mesh => mesh.castShadow === expectedParticleCasting), 'Only fire-card shadow casting should be excluded');
  // Three r186 converts the Canvas's legacy PCFSoftShadowMap request to PCF.
  assert.equal(state.shadowMap.enabled, true); assert.equal(state.shadowMap.type, 1);
  assert.deepEqual(state.keyLight.mapSize, [mapSize, mapSize]); assert.equal(state.keyLight.bias, -.0002);
  assert.equal(state.ground.opacity, .09); assert.equal(state.ground.receiveShadow, true); assert.equal(state.ground.position[1], -.016);
  assert.deepEqual(state.model.morphs, [0]); assert.equal(state.model.scale[2], 1.35);
};
try {
  await server.listen(); const origin = server.resolvedUrls.local[0];
  const { chromium } = process.env.SAJU_QA_PLAYWRIGHT_PATH ? await import(pathToFileURL(process.env.SAJU_QA_PLAYWRIGHT_PATH).href) : await import('playwright');
  browser = await chromium.launch({ executablePath: process.env.SAJU_QA_CHROME || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const guard = async page => {
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.route('**/*', route => { const url = new URL(route.request().url()); if (url.origin === new URL(origin).origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue(); outbound.push(url.origin); return route.abort(); });
  };
  const page = await browser.newPage({ viewport: { width: 480, height: 480 } }); await guard(page);
  await page.goto(origin + '__shadow'); await page.waitForFunction(() => !!window.shadowQA);
  for (const day of ['병인', '정묘']) for (const quality of ['high', 'low']) {
    let visibleCardShadowPixels = 0;
    for (const [name, angle] of [['front', 0], ['oblique', Math.PI / 4], ['side', Math.PI / 2]]) {
      const production = await page.evaluate(args => window.shadowQA.frame(...args), [day, quality, angle]);
      const file = `${day}-${quality}-${name}.png`;
      if (quality === 'high') await page.screenshot({ path: path.join(output, file) });
      results.push({ day, quality, name, file: quality === 'high' ? file : null, production });
      assertFlags(production, phase === 'before', 1024); assert(Math.abs(production.materialSeconds - 2.25) < 1e-10);
      assert(production.effectSeconds.every(t => Math.abs(t - 2.25) < 1e-10)); assert.deepEqual(production.errors, []);
      const reference = await page.evaluate(args => window.shadowQA.frame(...args), [day, quality, angle, 'cards-disabled']);
      const cardDifference = await page.evaluate(() => window.shadowQA.compare('production', 'cards-disabled'));
      const noBody = await page.evaluate(args => window.shadowQA.frame(...args), [day, quality, angle, 'body-disabled']);
      const bodyDifference = await page.evaluate(() => window.shadowQA.compare('cards-disabled', 'body-disabled'));
      Object.assign(results.at(-1), { referenceHash: reference.hash, noBodyHash: noBody.hash, cardDifference, bodyDifference });
      assert(bodyDifference.changedPixels > 0, 'Real body shadows must remain visible on ShadowMaterial ground');
      if (phase === 'after') assert.equal(cardDifference.changedPixels, 0, 'Production must match disabling only flame-card casters');
      visibleCardShadowPixels += cardDifference.changedPixels;
    }
    if (phase === 'before') assert(visibleCardShadowPixels > 0, day + ' negative control must visibly reproduce card-shadow artifacts');
  }
  checks.push('丙/丁, high/low and front/oblique/side: original eight B casters preserved, actual ground body shadows observed, card-only pixel comparison checked');
  for (const day of ['갑자', '을축', '무진', '기사', '경오', '신미', '임신', '계유']) for (const quality of ['high', 'low']) {
    nonFireCasters[day + ':' + quality] = await page.evaluate(args => window.shadowQA.casters(...args), [day, quality]);
  }
  checks.push('Non-fire body/accent caster flags recorded in both qualities for before/after regression comparison');
  memory = await page.evaluate(() => window.shadowQA.dispose()); assert.equal(memory.geometries, 0);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const ui = await context.newPage(); await guard(ui); await ui.goto(origin + '__canvas-shadow');
  await ui.waitForSelector('[data-scene-state="ready"]');
  const picture = () => ui.locator('[data-scene] canvas').evaluate(async canvas => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canvas.toDataURL())))].map(v => v.toString(16).padStart(2, '0')).join(''));
  for (const day of ['병인', '정묘']) {
    await ui.evaluate(day => window.canvasShadowQA.render(day), day);
    await ui.waitForFunction(day => document.querySelector('[data-scene-state="ready"]') && document.querySelector('[data-scene]').textContent.includes('일간 ' + day[0] + ' 정령'), day);
    await ui.getByRole('button', { name: '정령 움직임 재생' }).waitFor();
    // Loading removal changes layout; let the production ResizeObserver finish
    // its initial projection/size update before measuring a paused image.
    await ui.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await ui.waitForTimeout(100);
    const initial = await picture(), initialState = await ui.evaluate(() => window.canvasShadowQA.inspect());
    assertFlags(initialState, phase === 'before', 512); await ui.waitForTimeout(200); assert.equal(await picture(), initial);
    await ui.screenshot({ path: path.join(output, day + '-canvas-paused.png') });
    const box = await ui.locator('[data-scene] canvas').boundingBox();
    await ui.mouse.move(box.x + box.width * .35, box.y + box.height * .4); await ui.mouse.down(); await ui.mouse.move(box.x + box.width * .65, box.y + box.height * .4, { steps: 4 }); await ui.mouse.up();
    assert.notEqual(await picture(), initial); const rotated = await ui.evaluate(() => window.canvasShadowQA.inspect()); assertFlags(rotated, phase === 'before', 512); assert.equal(rotated.materialSeconds, initialState.materialSeconds); assert(Math.abs(rotated.model.rotation[1]) > .1);
    await ui.screenshot({ path: path.join(output, day + '-canvas-rotated.png') });
    await ui.getByRole('button', { name: '정령 정면과 움직임 초기화' }).click(); assert.equal(await picture(), initial);
    await ui.getByRole('button', { name: '정령 움직임 재생' }).click(); await ui.waitForTimeout(250);
    const playing = await ui.evaluate(() => window.canvasShadowQA.inspect()); assert(playing.materialSeconds > 0); assertFlags(playing, phase === 'before', 512);
    await ui.getByRole('button', { name: '정령 움직임 일시정지' }).click(); const paused = await picture(); await ui.waitForTimeout(200); assert.equal(await picture(), paused);
    componentResults.push({ day, initial: initialState, rotated, playing, pauseStable: true, resetExact: true });
  }
  await ui.evaluate(() => window.canvasShadowQA.unmount()); const stopped = await ui.evaluate(() => window.canvasShadowQA.draws()); await ui.waitForTimeout(200); assert.equal(await ui.evaluate(() => window.canvasShadowQA.draws()), stopped); assert.equal(await ui.locator('canvas').count(), 0); await context.close();
  checks.push('Actual React Canvas/StrictMode/mobile: ready, paused stability, drag at unchanged clock, exact reset, play/pause and unmount, with its real shadow settings');
  assert.deepEqual(errors, []); assert.deepEqual(outbound, []);
  console.log(JSON.stringify({ status: 'PASS', phase, views: results.length, componentCases: componentResults.length, checks, memory }));
} catch (error) { errors.push(error.stack || String(error)); process.exitCode = 1; console.error(error); }
finally {
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ status: process.exitCode ? 'FAIL' : 'PASS', phase, source, checks, results, nonFireCasters, componentResults, memory, errors, outbound,
    limits: ['Local Chromium SwiftShader, no physical GPU or hosted authentication', 'The before control is candidate ee6e974 with the erroneous fire castShadow=true, not native v30 which has no these fire cards', 'Reference probes disable only fire casting or original B casting to measure shadow contributions; production screenshots keep normal runtime flags', 'Canvas observation only stores the production renderer and loader result through Vite instrumentation; no lighting, shadow, animation or production source configuration is changed'] }, null, 2) + '\n');
  await browser?.close(); await server.close();
}
