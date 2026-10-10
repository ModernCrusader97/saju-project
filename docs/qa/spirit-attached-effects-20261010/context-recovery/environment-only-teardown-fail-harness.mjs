// Exact production Worker/assets + disposable synthetic D1 + actual React UI.
// Synthetic rAF permits deterministic playback; only selected frames draw natively.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const root = process.cwd(), builtRoot = process.env.SAJU_QA_BUILT_ROOT || root;
const probeOnly = process.env.SAJU_QA_PROBE === '1';
const contextProbe = process.env.SAJU_QA_CONTEXT_PROBE === '1';
const output = path.join(root, 'outputs/spirit-attachment-worker');
await fs.mkdir(output, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const entry = path.join(builtRoot, 'dist/server/index.js');
const builtServerSha256 = sha(await fs.readFile(entry));
const harnessSHA256 = sha(await fs.readFile(new URL(import.meta.url)));
const bodySourceSha256 = sha(await fs.readFile(path.join(builtRoot, 'public/spirits/jade-v002/body.glb')));
assert.equal(bodySourceSha256, '0e339d90253c8bbf6a865210f39d200ec3b5c042bcddb7ce669cea5c75c37b84');
const sourceHashes = Object.fromEntries(await Promise.all([
  'components/planet/ElementalSpiritCanvas.tsx', 'lib/planet/approved-jade-spirit.ts',
  'lib/planet/approved-spirit-motion.ts', 'lib/planet/mesh-surface.ts',
  'lib/planet/surface-stem-accents.ts', 'lib/planet/surface-sliding-dew.ts',
  'lib/planet/surface-fissure-sand.ts', 'lib/planet/surface-woody-branches.ts',
  'lib/planet/affine-instance-normals.ts',
].map(async file => [file, sha(await fs.readFile(path.join(builtRoot, file)))])));
const require = createRequire(path.join(root, 'package.json'));
const { Miniflare } = require('miniflare');
const { chromium } = await import(pathToFileURL(process.env.SAJU_QA_PLAYWRIGHT_PATH ||
  '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const checks = [], cases = [], images = [], lifecycleObservations = [], errors = [], outbound = [], servedAssets = new Map(), servedBodyHashes = new Set();
const headers = { 'oai-authenticated-user-id': 'spirit-worker-synthetic', 'oai-authenticated-user-email': 'qa@example.invalid' };
const expected = {
  position: 'f7e39c85723b4220d0e69161e4405c3232d514b18be56e8a3854ec6fff48da8b',
  normal: '80706bee870329a0829113e63ed178f0a904029265da2c96c69ad50f9b1f9cec',
  uv: 'f3300a24812551e09c6b6a4bc31795feb19c80dc22cf1708cda7a64890e9539c',
  index: '934286d3bdd9361657e390c41762923871cec85a48a7d9775b362aee02dc7830',
  morphPosition: '7bf926ae1fd903a4a63d39b32c3c1cdafdcd30bc982138404f38b75f50c4dfde',
  morphNormal: 'cf790aaebf3c4a41cbed597f93c53a82f4ba43f726c178d9504bc30dffd1ffbd',
};
async function walk(dir) {
  const files = [];
  for (const item of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) files.push(...await walk(file)); else if (/\.m?js$/.test(file)) files.push(file);
  }
  return files;
}
async function check(name, run) {
  console.log('RUN ' + name);
  try { await run(); checks.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
  catch (error) { checks.push({ name, status: 'FAIL', error: error.stack }); console.error(error.stack); throw error; }
}

const initializeClock = () => {
  let now = 1000, sequence = 0, drawEnabled = true;
  const pending = new Map(), records = [];
  Object.defineProperty(performance, 'now', { configurable: true, value: () => now });
  window.requestAnimationFrame = callback => { const id = ++sequence; pending.set(id, callback); return id; };
  window.cancelAnimationFrame = id => pending.delete(id);
  const nativeContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, ...args) {
    const gl = nativeContext.call(this, type, ...args);
    if (gl && /^webgl/.test(type) && !records.some(record => record.gl === gl)) {
      const objectIds = new WeakMap(); let objectSequence = 0;
      const objectId = object => { if (!object) return null; if (!objectIds.has(object)) objectIds.set(object, ++objectSequence); return objectIds.get(object); };
      const record = { gl, canvas: this, draws: 0, skippedDraws: 0, nativeBody: [], glDiagnostics: [],
        contextId: records.length + 1, contextGeneration: 0, objectId, traceGl: false }; records.push(record);
      const getError = gl.getError.bind(gl);
      const captureError = (operation, args = []) => { const error = getError();
        if (error && error !== gl.CONTEXT_LOST_WEBGL) record.glDiagnostics.push({ operation, error,
          contextId: record.contextId, contextGeneration: record.contextGeneration,
          args: args.map(value => value && typeof value === 'object' ? { type: value.constructor?.name, id: objectId(value) } : value),
          stack: new Error('GL error boundary: ' + operation).stack }); };
      const getUniform = gl.getUniform.bind(gl);
      gl.getUniform = (...args) => { captureError('before QA getUniform'); const result = getUniform(...args); captureError('QA getUniform'); return result; };
      const readPixels = gl.readPixels.bind(gl);
      gl.readPixels = (...args) => { captureError('before QA readPixels'); const result = readPixels(...args); captureError('QA readPixels'); return result; };
      const matrices = new Map(), times = new Map(), markers = new Map(), morphWeights = new Map(); let active;
      this.addEventListener('webglcontextlost', () => { matrices.clear(); times.clear(); markers.clear(); morphWeights.clear(); active = undefined; }, true);
      this.addEventListener('webglcontextrestored', () => { record.contextGeneration++; record.traceGl = true; }, true);
      const getLocation = gl.getUniformLocation.bind(gl);
      gl.getUniformLocation = (program, name) => {
        const location = getLocation(program, name);
        if (location && name === 'modelMatrix') matrices.set(program, location);
        if (location && name === 'uStemTime') times.set(program, location);
        if (location && name === 'uStemCoordinateDensity') markers.set(program, location);
        if (location && /^morphTargetInfluences(?:\[0\])?$/.test(name)) morphWeights.set(program, location);
        return location;
      };
      const nativeUseProgram = gl.useProgram.bind(gl); gl.useProgram = program => { active = program; return nativeUseProgram(program); };
      for (const method of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
        const nativeDraw = gl[method].bind(gl);
        gl[method] = (...values) => {
          if (!drawEnabled) { record.skippedDraws++; return; }
          // The bark/stone recipes are static: their unused time uniform may be
          // optimized out. Identify the actual body program by its rest-density
          // uniform, then read its native model matrix for every stem.
          if (markers.has(active) && matrices.has(active)) {
            const influences = morphWeights.has(active) ? gl.getUniform(active, morphWeights.get(active)) : null;
            record.nativeBody.push({
            modelMatrix: [...gl.getUniform(active, matrices.get(active))],
            seconds: times.has(active) ? gl.getUniform(active, times.get(active)) : null,
            timeUniformOptimizedOut: !times.has(active), density: gl.getUniform(active, markers.get(active)),
            morphWeights: influences === null ? null : typeof influences === 'number' ? [influences] : [...influences],
            contextId: record.contextId, contextGeneration: record.contextGeneration,
            programId: objectId(active), programIsCurrent: gl.getParameter(gl.CURRENT_PROGRAM) === active, programIsLive: gl.isProgram(active),
            });
          }
          record.draws++; return nativeDraw(...values);
        };
      }
      const clear = gl.clear.bind(gl); gl.clear = (...values) => { if (drawEnabled) return clear(...values); };
      // Trace restore errors at the exact GL call without discarding them: every
      // consumed error remains a failing diagnostic in the snapshot/report.
      const methodNames = new Set();
      for (let prototype = Object.getPrototypeOf(gl); prototype && prototype !== Object.prototype; prototype = Object.getPrototypeOf(prototype))
        Object.getOwnPropertyNames(prototype).forEach(name => methodNames.add(name));
      for (const name of methodNames) {
        if (name === 'getError' || name === 'constructor' || typeof gl[name] !== 'function') continue;
        const method = gl[name].bind(gl);
        gl[name] = (...values) => { const result = method(...values); if (record.traceGl) captureError('GL ' + name, values); return result; };
      }
    }
    return gl;
  };
  window.__spiritWorkerQa = {
    records, pending,
    step(delta, draw = true) {
      now += delta; drawEnabled = draw; records.forEach(record => { record.nativeBody = []; });
      const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(callback => callback(now));
      drawEnabled = true; return { callbacks: callbacks.length, pending: pending.size };
    },
    advance(count, delta) { for (let i = 0; i < count; i++) this.step(delta, i === count - 1); },
  };
};

const bindView = () => {
  const canvas = document.querySelector('[data-scene="spirit"] canvas');
  for (let element = canvas; element; element = element.parentElement) {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = key && element[key]; fiber; fiber = fiber.return) {
      const refs = [];
      for (let hook = fiber.memoizedState; hook && typeof hook === 'object'; hook = hook.next) {
        if (hook.memoizedState && Object.hasOwn(hook.memoizedState, 'current')) refs.push(hook.memoizedState);
      }
      const spiritRef = refs.find(ref => ref.current?.bodyMesh && ref.current?.propGroup);
      const rendererRef = refs.find(ref => ref.current?.isWebGLRenderer);
      if (!spiritRef || !rendererRef) continue;
      const renderIndex = refs.findIndex(ref => typeof ref.current === 'function');
      const timeRef = refs[renderIndex + 1], renderRef = refs[renderIndex];
      if (!timeRef || typeof timeRef.current !== 'number') throw new Error('Actual motionTime ref unavailable');
      const spirit = spiritRef.current, renderer = rendererRef.current;
      const record = window.__spiritWorkerQa.records.find(row => row.canvas === renderer.domElement);
      window.__spiritWorkerQa.view = { spirit, renderer, record, timeRef, renderRef };
      return { stem: spirit.mapping.bodyStem, time: timeRef.current };
    }
  }
  return null;
};

const snapshot = async () => {
  const { spirit, renderer, record, timeRef } = window.__spiritWorkerQa.view;
  const body = spirit.bodyMesh, geometry = body.geometry, motionRoot = body.parent;
  const hash = async array => [...new Uint8Array(await crypto.subtle.digest('SHA-256',
    new Uint8Array(array.buffer, array.byteOffset, array.byteLength)))].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const gl = renderer.getContext(), pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
  gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  const attributes = {
    position: await hash(geometry.getAttribute('position').array), normal: await hash(geometry.getAttribute('normal').array),
    uv: await hash(geometry.getAttribute('uv').array), index: await hash(geometry.index.array),
    morphPosition: await hash(geometry.morphAttributes.position[0].array), morphNormal: await hash(geometry.morphAttributes.normal[0].array),
  };
  const accents = [], castFlags = [], effectObjects = new Set();
  spirit.propGroup.traverse(object => {
    effectObjects.add(object);
    if (object.isMesh) {
      castFlags.push({ name: object.name, instanced: !!object.isInstancedMesh, castShadow: object.castShadow,
        nonShadowTag: object.userData.surfaceNonShadowCaster === true });
      if (object.isInstancedMesh) accents.push({ name: object.name, count: object.count, matrix: awaitlessHash(object.instanceMatrix.array),
        particles: object.geometry.getAttribute('aParticle') ? awaitlessHash(object.geometry.getAttribute('aParticle').array) : null });
    }
  });
  function awaitlessHash(array) { let h = 2166136261; for (const byte of new Uint8Array(array.buffer, array.byteOffset, array.byteLength)) { h ^= byte; h = Math.imul(h, 16777619); } return h >>> 0; }
  const bodyCasters = []; motionRoot.traverse(object => { if (object.isMesh && !effectObjects.has(object)) bodyCasters.push({ name: object.name, castShadow: object.castShadow }); });
  const key = spirit.group.parent.children.find(object => object.isDirectionalLight && object.castShadow);
  const ground = spirit.group.parent.children.find(object => object.isMesh && object.material.type === 'ShadowMaterial');
  const native = record.nativeBody.at(-1) ?? null;
  const rendererProgram = renderer.properties.get(body.material).currentProgram?.program;
  let floor = Infinity; const point = body.position.clone();
  body.updateWorldMatrix(true, false);
  for (let i = 0; i < geometry.getAttribute('position').count; i++) {
    body.getVertexPosition(i, point).applyMatrix4(body.matrixWorld); floor = Math.min(floor, point.y);
  }
  return {
    ready: document.querySelector('[data-scene="spirit"]').dataset.sceneState, time: timeRef.current,
    pixels: await hash(pixels), attributes, stem: spirit.mapping.bodyStem, material: body.material.name,
    kind: body.material.defines?.STEM_KIND, program: body.material.customProgramCacheKey(), depth: spirit.avatarPivot.scale.z,
    presentationPosition: spirit.avatarPivot.position.toArray(), displayRotation: spirit.avatarPivot.rotation.toArray(),
    bodyMatrix: body.matrixWorld.toArray(), native, rendererProgramId: record.objectId(rendererProgram), morph: [...body.morphTargetInfluences], floor,
    motionRoot: { name: motionRoot.name, position: motionRoot.position.toArray(), scale: motionRoot.scale.toArray(), rotation: motionRoot.rotation.toArray() },
    accentsShareMotionRoot: spirit.propGroup.parent === motionRoot, accents, castFlags, bodyCasters,
    diagnostics: spirit.propGroup.userData.surfaceAccentDiagnostics, draws: record.draws, skippedDraws: record.skippedDraws,
    shadow: { enabled: renderer.shadowMap.enabled, actualType: renderer.shadowMap.type, mapSize: key.shadow.mapSize.toArray(),
      groundMaterial: ground.material.type, groundOpacity: ground.material.opacity, groundY: ground.position.y, receiveShadow: ground.receiveShadow },
    memory: { ...renderer.info.memory }, glError: gl.getError(), glDiagnostics: [...record.glDiagnostics],
  };
};

function valid(state, day, quality, requireNative = true) {
  assert.equal(state.ready, 'ready'); assert.equal(state.stem, day[0]); assert.deepEqual(state.attributes, expected);
  assert.equal(state.depth, 1.35); assert.deepEqual(state.presentationPosition, [-.42, 0, 0]);
  assert(state.morph[0] >= 0 && state.morph[0] <= .45); assert(state.accentsShareMotionRoot);
  assert.equal(state.motionRoot.name, 'ApprovedSpiritMotion');
  assert(Math.abs(state.motionRoot.position[0]) <= .012); assert(Math.abs(state.motionRoot.scale[1] - 1) <= .003 + 1e-12);
  assert(Math.abs(state.motionRoot.rotation[2]) <= .006 + 1e-12);
  assert(state.program.includes(':' + quality + ':')); assert(state.accents.length > 0);
  assert(state.diagnostics.budget.drawCalls <= 6); assert(state.diagnostics.budget.instances < 1200);
  assert.equal(state.bodyCasters.length, 8); assert(state.bodyCasters.every(row => row.castShadow));
  assert.deepEqual(state.shadow.mapSize, quality === 'high' ? [1024, 1024] : [512, 512]);
  assert(state.shadow.enabled && state.shadow.receiveShadow); assert.equal(state.shadow.actualType, 1);
  assert.equal(state.shadow.groundOpacity, .09); assert.equal(state.shadow.groundY, -.016);
  for (const flag of state.castFlags) if (flag.nonShadowTag || (['병', '정'].includes(day[0]) && flag.instanced)) assert.equal(flag.castShadow, false);
  assert.equal(state.glError, 0);
  assert.equal(state.glDiagnostics.length, 0, JSON.stringify(state.glDiagnostics.slice(0, 3)));
  if (requireNative) {
    assert(state.native, 'Actual GPU body draw required'); assert.equal(state.native.density, 1);
    assert(state.native.programIsCurrent && state.native.programIsLive);
    assert.equal(state.native.programId, state.rendererProgramId);
    assert(state.native.morphWeights, 'Actual GPU original morph uniform required');
    assert.equal(state.native.morphWeights.length, state.morph.length);
    state.native.morphWeights.forEach((value, index) => assert(Math.abs(value - state.morph[index]) < 1e-7));
    if (state.native.timeUniformOptimizedOut) assert([0, 4].includes(state.kind), 'Only static bark/stone may omit their time uniform');
    else assert(Math.abs(state.native.seconds - state.time) < 1e-5);
    state.native.modelMatrix.forEach((value, index) => assert(Math.abs(value - state.bodyMatrix[index]) < 2e-6));
  }
}

let mf, browser, origin, databaseCounts;
const assetsPromises = [];
async function ready(page, day) {
  for (let attempt = 0; attempt < 200; attempt++) {
    await page.evaluate(() => window.__spiritWorkerQa.step(0));
    const matched = await page.evaluate(({ day, bind }) => {
      if (!document.querySelector('[data-scene="spirit"][data-scene-state="ready"] canvas')) return false;
      const result = (0, eval)('(' + bind + ')')(); return result?.stem === day[0];
    }, { day, bind: bindView.toString() });
    if (matched) {
      await page.locator('[data-scene="spirit"] canvas').scrollIntoViewIfNeeded();
      await page.waitForTimeout(100); await page.evaluate(() => window.__spiritWorkerQa.step(0)); return;
    }
    await page.waitForTimeout(25);
  }
  throw new Error(day + ' actual Canvas failed to become ready');
}
const button = (page, name) => page.getByRole('button', { name, exact: true }).evaluate(element => element.click());
async function tap(page) {
  const box = await page.locator('[data-scene="spirit"] canvas').boundingBox();
  await page.mouse.click(box.x + box.width * .48, box.y + box.height * .44);
}
async function side(page) {
  const box = await page.locator('[data-scene="spirit"] canvas').boundingBox();
  const travel = Math.PI / 2 / .009;
  await page.mouse.move(box.x + box.width * .2, box.y + box.height * .43); await page.mouse.down();
  await page.mouse.move(box.x + box.width * .2 + travel, box.y + box.height * .43, { steps: 5 }); await page.mouse.up();
}
async function png(page, day, quality, label, state) {
  const file = day[0] + '-' + quality + '-' + label + '.png';
  const uri = await page.locator('[data-scene="spirit"] canvas').evaluate(canvas => canvas.toDataURL('image/png'));
  const bytes = Buffer.from(uri.split(',')[1], 'base64'); await fs.writeFile(path.join(output, file), bytes);
  images.push({ file, day, quality, label, time: state.time, waveWeight: state.morph[0], pixels: state.pixels, pngSHA256: sha(bytes) });
}
try {
  mf = new Miniflare({ rootPath: builtRoot, modulesRoot: 'dist/server',
    modules: [entry, ...(await walk(path.join(builtRoot, 'dist/server'))).filter(file => file !== entry)].map(file => ({ type: 'ESModule', path: file })),
    compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'], host: '127.0.0.1', port: 0,
    cf: false, logRequests: false, telemetry: { enabled: false }, d1Databases: { DB: 'spirit-worker-synthetic' }, d1Persist: false,
    assets: { directory: path.join(builtRoot, 'dist/client'), routerConfig: { has_user_worker: true } },
    outboundService: async request => { outbound.push(new URL(request.url).hostname); return new Response('blocked', { status: 502 }); },
  });
  const db = await mf.getD1Database('DB');
  for (const file of (await fs.readdir(path.join(root, 'drizzle'))).filter(name => name.endsWith('.sql')).sort())
    for (const sql of (await fs.readFile(path.join(root, 'drizzle', file), 'utf8')).split('--> statement-breakpoint')) if (sql.trim()) await db.prepare(sql.trim()).run();
  origin = (await mf.ready).origin;
  browser = await chromium.launch({ executablePath: process.env.SAJU_QA_CHROME || '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const quality of probeOnly || contextProbe ? ['high'] : ['high', 'low']) {
    const context = await browser.newContext({ viewport: quality === 'high' ? { width: 1280, height: 900 } : { width: 390, height: 844 },
      deviceScaleFactor: 1, isMobile: quality === 'low', hasTouch: quality === 'low', reducedMotion: 'reduce', extraHTTPHeaders: headers });
    await context.addInitScript(initializeClock);
    await context.route('**/*', route => { const url = new URL(route.request().url());
      if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
      outbound.push(url.hostname); return route.abort(); });
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => { if (new URL(response.url()).pathname === '/spirits/jade-v002/body.glb' && response.status() === 200)
      assetsPromises.push(response.body().then(bytes => servedBodyHashes.add(sha(bytes))).catch(error => errors.push('Body read: ' + error.message)));
      if (/\.m?js(?:\?|$)/.test(response.url()) && response.status() === 200) {
      assetsPromises.push(response.body().then(bytes => servedAssets.set(new URL(response.url()).pathname, sha(bytes))).catch(error => errors.push('Asset read: ' + error.message)));
    } });
    try {
      await page.goto(origin + '/planet?view=spirit', { waitUntil: 'networkidle' }); await ready(page, '을축');
      await page.locator('summary').filter({ hasText: '조합을 직접 둘러보기' }).evaluate(element => element.click());
      for (const day of probeOnly ? ['갑자'] : contextProbe ? ['계유'] : ['갑자', '을축', '병인', '정묘', '무진', '계유']) await check(day + ' ' + quality + ': exact Worker production controls and attached motion', async () => {
        await page.getByLabel('정령과 동반자 · 일주').evaluate((select, day) => { select.value = day; select.dispatchEvent(new Event('change', { bubbles: true })); }, day);
        await ready(page, day); await button(page, '정령 정면과 움직임 초기화');
        const initial = await page.evaluate(snapshot);
        if (!initial.native) console.log(JSON.stringify({ stage: 'initial-native', day, quality, time: initial.time, draws: initial.draws, native: initial.native, kind: initial.kind }));
        valid(initial, day, quality); assert.equal(initial.time, 0); assert.equal(initial.morph[0], 0);
        await png(page, day, quality, 'front', initial);
        await page.evaluate(() => window.__spiritWorkerQa.advance(6, 100));
        const held = await page.evaluate(snapshot); valid(held, day, quality, false); assert.equal(held.time, 0); assert.equal(held.pixels, initial.pixels);
        await button(page, '정령 움직임 재생'); await page.evaluate(() => window.__spiritWorkerQa.advance(36, 1000 / 60));
        const idle = await page.evaluate(snapshot); valid(idle, day, quality); assert(Math.abs(idle.time - .6) < 1e-10);
        assert.notEqual(idle.pixels, initial.pixels); assert.equal(idle.morph[0], 0); assert(Math.abs(idle.floor - initial.floor) < 1e-8);
        await tap(page); await page.evaluate(() => window.__spiritWorkerQa.advance(36, 1000 / 60));
        const wave = await page.evaluate(snapshot); valid(wave, day, quality); assert(wave.morph[0] > .3); assert(Math.abs(wave.floor - initial.floor) < 1e-8);
        await png(page, day, quality, 'wave', wave);
        const beforeRepeat = wave.morph[0]; for (let count = 0; count < 5; count++) await tap(page);
        assert.equal((await page.evaluate(snapshot)).morph[0], beforeRepeat, 'Repeated tap cannot jump current weight');
        await button(page, '정령 움직임 일시정지');
        const paused = await page.evaluate(snapshot); await page.evaluate(() => window.__spiritWorkerQa.advance(5, 100));
        const still = await page.evaluate(snapshot); assert.equal(still.time, paused.time); assert.equal(still.pixels, paused.pixels);
        await side(page); const rotated = await page.evaluate(snapshot); valid(rotated, day, quality);
        assert.equal(rotated.time, paused.time); assert.equal(rotated.morph[0], paused.morph[0]); assert.notEqual(rotated.pixels, paused.pixels);
        assert(Math.abs(rotated.displayRotation[1] - Math.PI / 2) < .015); await png(page, day, quality, 'side', rotated);
        await button(page, '정령 정면과 움직임 초기화'); const reset = await page.evaluate(snapshot); valid(reset, day, quality);
        assert.equal(reset.time, 0); assert.equal(reset.morph[0], 0); assert.equal(reset.pixels, initial.pixels);
        // Compare frame rates at matched *animation* time. The existing Canvas
        // clamps 15 Hz's 66.7ms delta to .05 rather than equating wall duration.
        await tap(page); await button(page, '정령 움직임 재생'); await page.evaluate(() => window.__spiritWorkerQa.advance(36, 1000 / 60));
        const sixty = await page.evaluate(snapshot); valid(sixty, day, quality);
        await button(page, '정령 움직임 일시정지'); await button(page, '정령 정면과 움직임 초기화'); await tap(page);
        await button(page, '정령 움직임 재생'); await page.evaluate(() => window.__spiritWorkerQa.advance(12, 1000 / 15));
        const fifteen = await page.evaluate(snapshot); valid(fifteen, day, quality);
        assert(Math.abs(fifteen.time - sixty.time) < 1e-10); assert(Math.abs(fifteen.morph[0] - sixty.morph[0]) < 1e-10);
        fifteen.bodyMatrix.forEach((value, index) => assert(Math.abs(value - sixty.bodyMatrix[index]) < 1e-10));
        const beforeGap = fifteen.time; await page.evaluate(() => window.__spiritWorkerQa.step(5000));
        const gap = await page.evaluate(snapshot); valid(gap, day, quality); assert(Math.abs(gap.time - beforeGap - .05) < 1e-10);
        await page.evaluate(() => window.__spiritWorkerQa.advance(150, 50));
        const returned = await page.evaluate(snapshot); valid(returned, day, quality); assert.equal(returned.morph[0], 0);
        await button(page, '정령 움직임 일시정지');
        cases.push({ day, quality, initial, idle, wave, paused, rotated, reset, sixtyHz: sixty, fifteenHz: fifteen, timeGap: gap, returned,
          checks: ['ready/pause stable', 'idle changes with neutral arm', 'native GPU body matrix equals CPU; active material time equals CPU', 'bounded original connected wave',
            'repeat taps no jump', 'paused drag same time/pose', 'exact reset', '15/60Hz at matched material time', '5s gap clamps to .05', 'returns to neutral idle'] });
      });
      if (probeOnly) continue;
      await check(quality + ': production WebGL context loss/restoration and UI unmount stop GPU work', async () => {
        const before = await page.evaluate(() => window.__spiritWorkerQa.view.record.draws);
        await page.evaluate(() => { const { renderer } = window.__spiritWorkerQa.view;
          window.__workerLoss = renderer.getContext().getExtension('WEBGL_lose_context'); window.__workerLoss.loseContext(); });
        await page.waitForSelector('[data-scene="spirit"][data-scene-state="fallback"]');
        await page.evaluate(() => window.__spiritWorkerQa.advance(3, 50)); assert.equal(await page.evaluate(() => window.__spiritWorkerQa.view.record.draws), before);
        await page.evaluate(() => window.__workerLoss.restoreContext()); await page.waitForSelector('[data-scene="spirit"][data-scene-state="ready"]');
        await page.evaluate(bindView); assert(await page.evaluate(() => window.__spiritWorkerQa.view.record.draws) > before);
        const restored = await page.evaluate(snapshot);
        lifecycleObservations.push({ quality, restored });
        if (restored.glError || restored.glDiagnostics.length) console.log(JSON.stringify({ stage: 'context-restored',
          glError: restored.glError, diagnostics: restored.glDiagnostics, rendererProgramId: restored.rendererProgramId,
          native: restored.native }));
        valid(restored, '계유', quality);
        // The profile button switches to the real PlanetCanvas, unmounting this
        // exact ElementalSpiritCanvas without unloading the document/observer.
        await button(page, '같은 나의 행성 보기'); await page.waitForSelector('[data-scene="spirit"]', { state: 'detached' });
        const stopped = await page.evaluate(() => { const record = window.__spiritWorkerQa.view.record;
          return { draws: record.draws, contextLost: record.gl.isContextLost(), connected: record.canvas.isConnected,
            children: window.__spiritWorkerQa.view.spirit.group.children.length, glDiagnostics: [...record.glDiagnostics] }; });
        lifecycleObservations.at(-1).unmounted = stopped;
        await page.evaluate(() => window.__spiritWorkerQa.advance(8, 50));
        assert.equal(await page.evaluate(() => window.__spiritWorkerQa.view.record.draws), stopped.draws);
        assert(stopped.contextLost && !stopped.connected); assert.equal(stopped.children, 0);
        assert.equal(stopped.glDiagnostics.length, 0, JSON.stringify(stopped.glDiagnostics.slice(0, 3)));
      });
      await Promise.all(assetsPromises);
    } finally { await context.close(); }
  }
  await check('source artifact and local-only data boundary remain exact', async () => {
    assert.equal(sha(await fs.readFile(entry)), builtServerSha256); assert.deepEqual(errors, []); assert.deepEqual(outbound, []);
    assert.equal(sha(await fs.readFile(new URL(import.meta.url))), harnessSHA256);
    for (const [file, hash] of Object.entries(sourceHashes)) assert.equal(sha(await fs.readFile(path.join(builtRoot, file))), hash);
    assert.deepEqual([...servedBodyHashes], [bodySourceSha256]);
    const tables = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").all();
    databaseCounts = {};
    for (const table of tables.results) { assert(/^[a-zA-Z0-9_]+$/.test(table.name));
      databaseCounts[table.name] = (await db.prepare('SELECT COUNT(*) AS count FROM "' + table.name + '"').first()).count; }
  });
} catch (error) { if (!checks.some(check => check.status === 'FAIL')) checks.push({ name: 'worker harness setup', status: 'FAIL', error: error.stack }); process.exitCode = 1; }
finally {
  const report = { status: process.exitCode ? 'FAIL' : probeOnly || contextProbe ? 'PROBE' : 'PASS', builtRoot, builtServerSha256, harnessSHA256, sourceHashes,
    bodySourceSha256, servedBodySha256: [...servedBodyHashes],
    harnessSha256: harnessSHA256,
    passed: checks.filter(check => check.status === 'PASS').length, failed: checks.filter(check => check.status === 'FAIL').length,
    browser: browser ? await browser.version() : null, checks, cases, images, lifecycleObservations,
    servedClientJS: Object.fromEntries(servedAssets), databaseCounts, errors, outbound,
    limits: ['Exact local production dist/server Worker plus its dist/client assets, disposable synthetic D1; no hosted authenticated session or real user data.',
      'Chromium SwiftShader with native selected-frame draws; no physical mobile GPU or suspension certification.',
      'Synthetic rAF/performance clock and skipped intermediate draws; CPU motion/effects update every stepped frame, selected screenshots/native uniform readbacks use real draw calls.',
      'Existing Canvas safeDelta caps each gap at .05 seconds, so 15/60Hz comparison matches animation time rather than wall duration.',
      'Native body draws/model matrices are required for every case. Static bark/stone can optimize out uStemTime; native active time assertions cover the other animated recipes.',
      'Only the original bounded .45 pose-study morph is exercised; local joint/topology CPU measurements and captured appearance are not a new production rig or global nonintersection proof.'] };
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser?.close(); await mf?.dispose();
  console.log(JSON.stringify({ status: report.status, cases: cases.length, checks: checks.length, images: images.length, builtServerSha256, harnessSHA256 }));
}
