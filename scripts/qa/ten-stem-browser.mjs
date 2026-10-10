// Local real WebGL/GLB/PNG rendering; no app DB, deployment or external traffic.
// SAJU_QA_PLAYWRIGHT_PATH=/path/to/playwright/index.mjs SAJU_QA_CHROME=/path/to/chromium
// SAJU_QA_PHASE=before records the original behavior without new-material assertions.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';

const root = process.cwd(), phase = process.env.SAJU_QA_PHASE || 'after';
assert(['before', 'after'].includes(phase));
const output = path.join(root, 'outputs/ten-stem-materials', phase);
await fs.mkdir(output, { recursive: true });
const harness = path.join(output, 'harness.mjs');
await fs.writeFile(harness, `
import * as THREE from 'three';
import {loadApprovedSpirit} from '../../../lib/planet/approved-jade-spirit';
import {createStudioEnvironment} from '../../../lib/planet/scene-environment';
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});
renderer.setSize(480,480);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
document.body.style.cssText='margin:0;background:#edf2ea';document.body.append(renderer.domElement);
const errors=[];renderer.debug.onShaderError=(gl,program,vertex,fragment)=>errors.push({program:gl.getProgramInfoLog(program),vertex:gl.getShaderInfoLog(vertex),fragment:gl.getShaderInfoLog(fragment)});
const env=createStudioEnvironment(renderer),scene=new THREE.Scene();scene.background=new THREE.Color('#edf2ea');scene.environment=env.texture;scene.environmentIntensity=1.05;
scene.add(new THREE.HemisphereLight(0xf4f8fc,0x26343b,.85));
for(const [color,intensity,position] of [[0xfff1d9,2.1,[-3,4,4]],[0xc1e4f0,.8,[4,1,2]],[0xf5fbff,1.8,[0,3,-3]]]){const l=new THREE.DirectionalLight(color,intensity);l.position.set(...position);scene.add(l);}
const camera=new THREE.PerspectiveCamera(38,1,.1,40);camera.position.set(0,1.70,5.7);camera.lookAt(0,1.24,0);
const gl=renderer.getContext();let current;
const hash=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
async function pixels(){const data=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,data);const colors=new Set();for(let i=0;i<data.length;i+=16)colors.add(data[i]+','+data[i+1]+','+data[i+2]);return{hash:await hash(data),colors:colors.size};}
function update(t){current.update(t,1/60,camera);scene.updateMatrixWorld(true);renderer.render(scene,camera);}
window.stemQA={async inspect(day='을축',quality='high',angle=0){current?.dispose();current=await loadApprovedSpirit(day,'병인',quality);scene.add(current.group);current.avatarPivot.rotation.y=angle;update(0);const geometry=current.bodyMesh.geometry,positions=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');const bounds=new THREE.Box3().setFromObject(current.bodyMesh,true),petBounds=new THREE.Box3().setFromObject(current.zodiacPet,true);return{day,quality,angle,material:current.bodyMesh.material.name,kind:current.bodyMesh.material.defines?.STEM_KIND,jade:current.bodyMesh.material.userData.approvedJadeVersion,depth:current.avatarPivot.scale.z,bodyDimensions:bounds.getSize(new THREE.Vector3()).toArray(),petGap:petBounds.min.x-bounds.max.x,positionHash:await hash(new Uint8Array(positions.array.buffer,positions.array.byteOffset,positions.array.byteLength)),uvHash:await hash(new Uint8Array(uv.array.buffer,uv.array.byteOffset,uv.array.byteLength)),morphs:current.bodyMesh.morphTargetInfluences,mode:current.propGroup.userData.surfaceAccentDiagnostics?.mode,effects:current.propGroup.children.map(o=>o.name),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,...await pixels()};},async frame(t){update(t);return pixels();},async reset(){current.reset();update(0);return pixels();},memory(){return {...renderer.info.memory};},errors,async dispose(){current?.dispose();current=null;renderer.render(scene,camera);return {...renderer.info.memory};}};
`);
const componentHarness = path.join(output, 'component.mjs');
await fs.writeFile(componentHarness, `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import ElementalSpiritCanvas from '../../../components/planet/ElementalSpiritCanvas';
document.body.style.cssText='margin:0;background:#edf2ea';
document.head.insertAdjacentHTML('beforeend','<style>[data-scene]{position:relative;width:100%;height:520px}[data-scene]>div:first-child{width:100%;height:100%;min-height:380px}canvas{display:block}button{position:relative;z-index:3}</style>');
const mount=document.createElement('div');document.body.append(mount);let root=createRoot(mount),draws=0;
for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const original=WebGL2RenderingContext.prototype[name];WebGL2RenderingContext.prototype[name]=function(...args){draws++;return original.apply(this,args);};}
window.componentQA={render(day='을축',month='병인'){flushSync(()=>root.render(React.createElement(React.StrictMode,null,React.createElement(ElementalSpiritCanvas,{dayKey:day,monthKey:month}))));},unmount(){flushSync(()=>root.unmount());},draws(){return draws;}};
window.componentQA.render();
`);
const server = await createServer({ root, configFile: false, logLevel: 'error',
  server: { host: '127.0.0.1', port: 0 }, optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'] },
  resolve: { alias: { '@': root } },
  plugins: [{ name: 'stem-qa', configureServer(s) {
    s.middlewares.use((req, res, next) => {
      if (req.url === '/__stem') { res.setHeader('Content-Type', 'text/html'); res.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><script type="module" src="/' + path.relative(root, harness).replaceAll('\\', '/') + '"></script></body></html>'); }
      else if (req.url === '/__component') { res.setHeader('Content-Type', 'text/html'); res.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><script type="module" src="/' + path.relative(root, componentHarness).replaceAll('\\', '/') + '"></script></body></html>'); }
      else next();
    });
  } }],
});
const results = [], checks = [], errors = [], outbound = [];
let browser;
try {
  await server.listen();
  const origin = server.resolvedUrls.local[0];
  const { chromium } = process.env.SAJU_QA_PLAYWRIGHT_PATH
    ? await import(pathToFileURL(process.env.SAJU_QA_PLAYWRIGHT_PATH).href) : await import('playwright');
  browser = await chromium.launch({ executablePath: process.env.SAJU_QA_CHROME || '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 480, height: 480 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(origin).origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
    outbound.push(url.origin); return route.abort();
  });
  await page.goto(origin + '__stem'); await page.waitForFunction(() => !!window.stemQA);
  const keys = ['갑자', '을축', '병인', '정묘', '무진', '기사', '경오', '신미', '임신', '계유'];
  for (const quality of ['high', 'low']) for (const [index, day] of keys.entries()) {
    const result = await page.evaluate(args => window.stemQA.inspect(...args), [day, quality]); results.push(result);
    assert.equal(result.depth, 1.35); assert(result.morphs.every(weight => weight === 0));
    assert.equal(result.positionHash, 'f7e39c85723b4220d0e69161e4405c3232d514b18be56e8a3854ec6fff48da8b');
    assert.equal(result.uvHash, 'f3300a24812551e09c6b6a4bc31795feb19c80dc22cf1708cda7a64890e9539c');
    assert(result.colors > 50); assert(result.drawCalls > 0); assert(result.petGap > .035);
    assert(Math.abs(result.bodyDimensions[0] - 1.754512906) < 1e-5);
    assert(Math.abs(result.bodyDimensions[1] - 2.384797894) < 1e-5);
    assert(result.bodyDimensions[2] > 1.20 && result.bodyDimensions[2] < 1.40);
    if (phase === 'after') {
      if (index === 5) assert.equal(result.jade, 'v002'); else assert.equal(result.kind, index);
      if ([0, 1, 2, 3, 9].includes(index)) assert(result.effects.length > 0); else assert.equal(result.effects.length, 0);
    }
    if (quality === 'high') await page.screenshot({ path: path.join(output, day + '-front.png') });
    const animated = await page.evaluate(() => window.stemQA.frame(2.25));
    const repeated = await page.evaluate(() => window.stemQA.frame(2.25));
    result.repeatedTimeStable = repeated.hash === animated.hash;
    if (phase === 'after') assert.deepEqual(repeated, animated);
    if (phase === 'after' && [1, 2, 3, 5, 7, 8, 9].includes(index)) assert.notEqual(animated.hash, result.hash, day + ' must advance visible pixels');
    const reset = await page.evaluate(() => window.stemQA.reset()); assert.equal(reset.hash, result.hash, day + ' reset must exactly restore time zero');
  }
  checks.push('20 actual GLB/material/effect renders at low and high quality; original position/UV/morph/depth/dimensions/pet spacing');
  checks.push(phase === 'after' ? 'absolute time produces identical repeated frames and exact time-zero reset' : 'original delta-time behavior recorded; exact time-zero reset checked');
  for (const [day, angle, name] of [['갑자', Math.PI / 4, 'bark-oblique'], ['을축', Math.PI / 2, 'vine-side'], ['기사', Math.PI / 2, 'jade-side']]) {
    const result = await page.evaluate(args => window.stemQA.inspect(...args), [day, 'high', angle]); assert(result.petGap > .035);
    await page.screenshot({ path: path.join(output, name + '.png') }); results.push(result);
  }
  checks.push('front/oblique/side keep original B and separate pet composition');
  const memory = await page.evaluate(() => window.stemQA.dispose());
  assert.equal(memory.geometries, 0, 'Repeated replacements must release all model and instance geometry');
  for (const day of ['기사', '임신', '을축']) {
    await page.evaluate(day => window.stemQA.inspect(day), day);
    assert.deepEqual(await page.evaluate(() => window.stemQA.dispose()), memory, 'GPU resource count must stay stable after another replacement');
  }
  checks.push('after repeated load/replace/dispose, no model geometry remains and retained renderer/environment texture count stays stable');
  assert.deepEqual(await page.evaluate(() => window.stemQA.errors), []);
  assert.deepEqual(errors, []); assert.deepEqual(outbound, []);
  checks.push('zero shader errors, browser errors or external requests');
  if (phase === 'after') {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const ui = await context.newPage();
    ui.on('pageerror', error => errors.push(error.message));
    ui.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await ui.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(origin).origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
      outbound.push(url.origin); return route.abort();
    });
    await ui.goto(origin + '__component');
    await ui.waitForSelector('[data-scene-state="ready"]');
    const picture = () => ui.locator('[data-scene] canvas').evaluate(async canvas => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canvas.toDataURL())))].map(n => n.toString(16).padStart(2, '0')).join(''));
    for (const day of ['갑자', '을축', '병인', '정묘', '기사', '임신', '계유']) {
      await ui.evaluate(async day => {
        window.componentQA.render(day);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }, day);
      await ui.waitForFunction(day => document.querySelector('[data-scene-state="ready"]') && document.querySelector('[data-scene]').textContent.includes('일간 ' + day[0] + ' 정령'), day);
      await ui.waitForTimeout(100);
      await ui.getByRole('button', { name: '정령 움직임 재생' }).waitFor();
      const still = await picture(); await ui.waitForTimeout(200); assert.equal(await picture(), still, day + ' reduced motion must stay paused');
      const box = await ui.locator('[data-scene] canvas').boundingBox();
      await ui.mouse.move(box.x + box.width * .35, box.y + box.height * .4);
      await ui.mouse.down(); await ui.mouse.move(box.x + box.width * .65, box.y + box.height * .4, { steps: 4 }); await ui.mouse.up();
      assert.notEqual(await picture(), still, day + ' paused drag must rotate body and attachments');
      await ui.getByRole('button', { name: '정령 정면과 움직임 초기화' }).click();
      assert.equal(await picture(), still, day + ' paused reset must return the exact front frame');
      if (day === '기사') await ui.screenshot({ path: path.join(output, 'jade-component-mobile.png') });
    }
    checks.push('actual ElementalSpiritCanvas in Strict Mode/mobile viewport: seven material/effect families load, start paused, rotate with attachments and reset exactly');
    await ui.getByRole('button', { name: '정령 움직임 재생' }).click(); await ui.waitForTimeout(200);
    const moving = await picture(); await ui.waitForTimeout(250); assert.notEqual(await picture(), moving);
    await ui.getByRole('button', { name: '정령 움직임 일시정지' }).click();
    const paused = await picture(); await ui.waitForTimeout(200); assert.equal(await picture(), paused);
    const drawn = await ui.evaluate(() => window.componentQA.draws());
    await ui.evaluate(() => { window.qaGl = document.querySelector('[data-scene] canvas').getContext('webgl2'); window.qaLoss = window.qaGl.getExtension('WEBGL_lose_context'); window.qaLoss.loseContext(); });
    await ui.waitForSelector('[data-scene-state="fallback"]');
    await ui.evaluate(() => window.qaLoss.restoreContext()); await ui.waitForSelector('[data-scene-state="ready"]');
    assert(await ui.evaluate(() => window.componentQA.draws()) > drawn);
    checks.push('actual Canvas play/pause and WebGL context restoration resume drawing');
    await ui.evaluate(() => window.componentQA.unmount());
    const stopped = await ui.evaluate(() => window.componentQA.draws());
    await ui.waitForTimeout(300); assert.equal(await ui.evaluate(() => window.componentQA.draws()), stopped);
    assert.equal(await ui.locator('canvas').count(), 0);
    checks.push('actual Canvas unmount stops draws and removes the renderer');
    assert.deepEqual(errors, []); assert.deepEqual(outbound, []);
    await context.close();
  }
  console.log(JSON.stringify({ status: 'PASS', phase, renders: results.length, checks, memory }));
} catch (error) { errors.push(error.stack || String(error)); process.exitCode = 1; console.error(error); }
finally {
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ status: process.exitCode ? 'FAIL' : 'PASS', phase, checks, errors, outbound, results,
    limits: ['Chromium SwiftShader; no physical mobile GPU', 'Local renderer harness loads production loader and actual GLB/PNGs; hosted auth and user DB are not accessed', 'No complete vine body, curved sand, water spray or sliding dew claim'] }, null, 2) + '\n');
  await browser?.close(); await server.close();
}
