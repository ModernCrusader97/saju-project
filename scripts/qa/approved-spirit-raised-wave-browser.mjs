import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';

const root = process.cwd(), output = path.resolve('outputs/approved-spirit-raised-wave/native');
const transformOnly = process.env.SAJU_WAVE_QA_TRANSFORM_ONLY === '1';
await fs.mkdir(output, { recursive: true });
const fashionRoot = path.resolve(process.env.SAJU_WAVE_FASHION_ROOT || root);
const fashionPath = path.join(fashionRoot, 'lib/planet/spirit-fashion.ts');
await fs.access(fashionPath);
const harness = path.join(output, transformOnly ? 'loader-transform-harness.mjs' : 'harness.mjs');
await fs.writeFile(harness, `
import * as THREE from 'three';
import {loadApprovedSpirit} from '/lib/planet/approved-jade-spirit';
import {createStudioEnvironment} from '/lib/planet/scene-environment';
import {createSpiritFashion} from '/@fs${fashionPath}';
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(560,640);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
document.body.style.cssText='margin:0;background:#edf2ea';document.body.append(renderer.domElement);
const scene=new THREE.Scene(),environment=createStudioEnvironment(renderer);scene.environment=environment.texture;scene.environmentIntensity=1.05;scene.background=new THREE.Color('#edf2ea');
scene.add(new THREE.HemisphereLight(0xf4f8fc,0x26343b,.85));
for(const [color,intensity,pos]of [[0xfff1d9,2.1,[-3,4,4]],[0xc1e4f0,.8,[4,1,2]],[0xf5fbff,1.8,[0,3,-3]]]){const light=new THREE.DirectionalLight(color,intensity);light.position.set(...pos);if(pos[0]===-3){light.castShadow=true;light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-2.5,right:2.5,top:3,bottom:-2,near:.1,far:16});light.shadow.bias=-.0002;}scene.add(light);}
const floor=new THREE.Mesh(new THREE.PlaneGeometry(12,12),new THREE.ShadowMaterial({color:0x1c4836,opacity:.09}));floor.rotation.x=-Math.PI/2;floor.position.y=-.016;floor.receiveShadow=true;scene.add(floor);
const camera=new THREE.PerspectiveCamera(38,560/640,.1,40);camera.position.set(0,1.7,5.4);camera.lookAt(-.05,1.24,0);
const errors=[];renderer.debug.onShaderError=(gl,p,v,f)=>errors.push({program:gl.getProgramInfoLog(p),vertex:gl.getShaderInfoLog(v),fragment:gl.getShaderInfoLog(f)});
let spirit,fashion;const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
const v=new THREE.Vector3();
async function metadata(){const body=spirit.bodyMesh,g=body.userData.approvedSpiritGreeting,gl=renderer.getContext(),pixels=new Uint8Array(560*640*4);gl.readPixels(0,0,560,640,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
const hand=new THREE.Vector3();for(const id of g.handVertexIDs)hand.add(body.getVertexPosition(id,v));hand.multiplyScalar(1/g.handVertexIDs.length);
const supports=fashion.group.userData.diagnostics.triangleSupports;return{pixels:await hash(pixels),hand:hand.toArray(),greeting:structuredClone(g),morphs:[...body.morphTargetInfluences],qaEffectsSetupMorphCount:body.userData.raisedWaveQAEffectsSetupMorphCount,fashionSupports:supports,bodyPositionSHA256:await hash(body.geometry.attributes.position.array),normalSHA256:await hash(body.geometry.attributes.normal.array),uvSHA256:await hash(body.geometry.attributes.uv.array),shadowCaster:body.castShadow,presentationDepth:spirit.avatarPivot.scale.z,errors,glError:gl.getError(),triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls};}
window.raisedWaveQA={async load(day){fashion?.dispose();spirit?.dispose();spirit=await loadApprovedSpirit(day,'병인','high');scene.add(spirit.group);spirit.reset();const model=spirit.bodyMesh.parent;fashion=createSpiritFashion({body:spirit.bodyMesh,model,eyes:[spirit.eyeLeft,spirit.eyeRight],stem:day.charAt(0),quality:'high',presentationDepth:1.35});fashion.set({head:'sprout-pin',face:null,neck:'ribbon-bow',back:'leaf-brooch'});spirit.update(0,0,camera);fashion.update();renderer.render(scene,camera);return metadata();},
async frame(time,angle=0){spirit.avatarPivot.rotation.y=angle;spirit.update(time,0,camera);fashion.update();renderer.render(scene,camera);return metadata();},
trigger(){spirit.triggerReaction();},async reset(){spirit.reset();fashion.update();renderer.render(scene,camera);return metadata();},
dispose(){fashion?.dispose();spirit?.dispose();fashion=spirit=null;renderer.render(scene,camera);return{geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures};}};
`);
const loaderPath = path.join(root, 'lib/planet/approved-jade-spirit.ts');
let lifecycleAdapter = false, motionBeforeEffects = false;
const server = await createServer({ root, configFile: false, logLevel: 'error', resolve: { dedupe: ['three'] },
  server: { host: '127.0.0.1', port: 0, fs: { allow: ['/workspace'] } }, optimizeDeps: { noDiscovery: true },
  plugins: [{ name: 'raised-wave-qa', enforce: 'pre',
    // Reproduce the accepted loader ordering without editing another owner's
    // production file. Sand caches all derived morphs when it is constructed.
    transform(code, id) {
      if (id.split('?')[0] !== loaderPath) return;
      const initPattern = /^([ \t]*)motion\s*=\s*createApprovedSpiritMotion\(motionRoot,\s*body,\s*stem\);?[ \t]*(?:\r?\n|$)/m;
      const effectsPattern = /^([ \t]*)effects\s*=\s*createSurfaceStemAccents\b/m;
      const init = initPattern.exec(code), effects = effectsPattern.exec(code);
      if (!init || !effects) throw new Error('QA loader must expose its motion and effects construction statements.');
      if (init.index > effects.index) {
        lifecycleAdapter = true;
        code = code.slice(0, init.index) + code.slice(init.index + init[0].length);
        const destination = effectsPattern.exec(code);
        code = code.slice(0, destination.index) + init[0] + code.slice(destination.index);
      }
      motionBeforeEffects = initPattern.exec(code).index < effectsPattern.exec(code).index;
      if (!motionBeforeEffects) throw new Error('QA motion must initialize before any morph-dependent effects.');
      // Record the actual constructor-time control count, rather than relying
      // only on the transform flag or the later body geometry state.
      const constructor = effectsPattern.exec(code);
      return code.slice(0, constructor.index) + constructor[1] + 'body.userData.raisedWaveQAEffectsSetupMorphCount = body.geometry.morphAttributes.position.length;\n' + code.slice(constructor.index);
    },
    configureServer(s) { s.middlewares.use((req, res, next) => {
      if (req.url !== '/__raised-wave') return next();
      res.setHeader('Content-Type', 'text/html'); res.end('<html><body><script type="module" src="/' + path.relative(root, harness) + '"></script></body></html>');
    }); },
  }] });
let browser, memory;
const errors = [], outbound = [], cases = [], frames = [];
try {
  await server.listen(); const origin = server.resolvedUrls.local[0];
  if (transformOnly) {
    const transformed = await server.transformRequest('/lib/planet/approved-jade-spirit.ts');
    assert(motionBeforeEffects);
    const init = transformed.code.indexOf('motion = createApprovedSpiritMotion('), effects = transformed.code.indexOf('effects = createSurfaceStemAccents(');
    assert(init >= 0 && effects > init, 'Fetched Vite module must keep motion before effects');
    assert(transformed.code.includes('raisedWaveQAEffectsSetupMorphCount'));
    await fs.writeFile(path.join(output, 'loader-transform.mjs'), transformed.code);
    await fs.writeFile(path.join(output, 'loader-transform-report.json'), JSON.stringify({ status: 'PASS', transformOnly: true,
      lifecycleAdapter, motionBeforeEffects, sourceLoaderSHA256: createHash('sha256').update(await fs.readFile(loaderPath)).digest('hex'),
      transformedLoaderSHA256: createHash('sha256').update(transformed.code).digest('hex'), generatedBrowserHarnessSHA256: createHash('sha256').update(await fs.readFile(harness)).digest('hex'),
      limits: ['Read-only Vite transform verification; no browser, WebGL or render claim.'] }, null, 2) + '\n');
    console.log(`PASS fetched loader transform: adapter=${lifecycleAdapter}, motionBeforeEffects=${motionBeforeEffects}`);
  } else {
  const { chromium } = await import(pathToFileURL(process.env.SAJU_QA_PLAYWRIGHT_PATH || '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 560, height: 640 } });
  page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/*', route => { const url = new URL(route.request().url());
    if (url.origin === new URL(origin).origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
    outbound.push(url.origin); return route.abort(); });
  await page.goto(origin + '__raised-wave'); await page.waitForFunction(() => !!window.raisedWaveQA);
  for (const day of ['기사', '계유', '무진']) {
    const initial = await page.evaluate(day => window.raisedWaveQA.load(day), day), duration = initial.greeting.duration;
    assert.equal(initial.qaEffectsSetupMorphCount, 11); assert(motionBeforeEffects);
    assert.equal(initial.bodyPositionSHA256, 'f7e39c85723b4220d0e69161e4405c3232d514b18be56e8a3854ec6fff48da8b');
    assert.equal(initial.uvSHA256, 'f3300a24812551e09c6b6a4bc31795feb19c80dc22cf1708cda7a64890e9539c');
    for (const [view, angle] of [['front', 0], ['side', -Math.PI / 2]]) {
      await page.evaluate(() => window.raisedWaveQA.reset()); await page.evaluate(() => window.raisedWaveQA.trigger());
      const count = day === '기사' ? 76 : 19;
      for (let frame = 0; frame <= count; frame++) {
        const progress = frame / count, state = await page.evaluate(args => window.raisedWaveQA.frame(...args), [duration * progress, angle]);
        assert.equal(state.bodyPositionSHA256, initial.bodyPositionSHA256); assert.equal(state.normalSHA256, initial.normalSHA256); assert.equal(state.uvSHA256, initial.uvSHA256);
        assert.equal(state.presentationDepth, 1.35); assert.equal(state.shadowCaster, true); assert.equal(state.morphs[0], 0);
        assert.equal(state.morphs.length, 11); assert.equal(state.greeting.controlIndices.length, 10); assert.equal(state.greeting.controlWeights.length, 10);
        assert.equal(state.qaEffectsSetupMorphCount, 11);
        assert(state.morphs.filter(weight => weight > 1e-10).length <= 2); assert.equal(state.glError, 0); assert.deepEqual(state.errors, []);
        const file = `${day}-${view}-${String(frame).padStart(3, '0')}.png`; await page.screenshot({ path: path.join(output, file) });
        frames.push({ day, view, file, time: duration * progress, progress, ...state });
      }
      const repeat = await page.evaluate(args => window.raisedWaveQA.frame(...args), [duration, angle]);
      assert.equal(repeat.pixels, frames.at(-1).pixels, 'Paused absolute time must repeat exact native pixels');
      console.log(`PASS native ${day} ${view}: ${count + 1} frames`);
    }
    await page.evaluate(() => window.raisedWaveQA.reset()); await page.evaluate(() => window.raisedWaveQA.trigger());
    const tapPose = await page.evaluate(args => window.raisedWaveQA.frame(...args), [duration * .4, -.65]);
    await page.evaluate(() => { for (let i = 0; i < 100; i++) window.raisedWaveQA.trigger(); });
    const pausedTap = await page.evaluate(args => window.raisedWaveQA.frame(...args), [duration * .4, -.65]);
    assert.equal(tapPose.pixels, pausedTap.pixels); assert.deepEqual(tapPose.morphs, pausedTap.morphs);
    assert.equal(pausedTap.greeting.queued, true);
    const second = await page.evaluate(args => window.raisedWaveQA.frame(...args), [duration * 1.40, -.65]);
    assert.equal(second.greeting.stage, 'wave'); assert(second.hand[1] > 1.6);
    const completed = await page.evaluate(args => window.raisedWaveQA.frame(...args), [duration * 2.1, -.65]);
    assert.equal(completed.greeting.stage, 'idle'); assert(completed.morphs.every(weight => weight === 0));
    cases.push({ day, duration, sourceAttributeHashes: [initial.bodyPositionSHA256, initial.normalSHA256, initial.uvSHA256], tapStable: true, queuedRaisedCycle: true, returnedToIdle: true });
  }
  memory = await page.evaluate(() => window.raisedWaveQA.dispose()); assert.equal(memory.geometries, 1);
  assert.deepEqual(errors, []); assert.deepEqual(outbound, []);
  }
} catch (error) { errors.push(error.stack || String(error)); process.exitCode = 1; console.error(error); }
finally {
  if (!transformOnly) await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ status: process.exitCode ? 'FAIL' : 'PASS', cases, frames, memory,
    lifecycleAdapter, motionBeforeEffects, errors, outbound, harnessSHA256: createHash('sha256').update(await fs.readFile(harness)).digest('hex'),
    motionSHA256: createHash('sha256').update(await fs.readFile(path.join(root, 'lib/planet/approved-spirit-motion.ts'))).digest('hex'),
    controlsSHA256: createHash('sha256').update(await fs.readFile(path.join(root, 'lib/planet/approved-spirit-arm-controls.ts'))).digest('hex'),
    fashionModuleSHA256: createHash('sha256').update(await fs.readFile(fashionPath)).digest('hex'),
    limits: ['Actual original B GLB, production shaders, shadows and read-only fashion module on native Three WebGL/Chromium SwiftShader.',
      'QA applies the accepted motion-before-effects loader lifecycle adapter; production integration is owned by the root task.',
      'No physical mobile GPU or deployed-session certification.'] }, null, 2) + '\n');
  await browser?.close(); await server.close();
}
