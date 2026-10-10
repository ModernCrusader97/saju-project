// Built Worker + disposable synthetic D1 + native SwiftShader WebGL.
// Synthetic rAF/time; draws sampled during pre-roll, every entry boundary frame.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
const root = process.cwd(), builtRoot = process.env.SAJU_QA_BUILT_ROOT || root;
const require = createRequire(path.join(root, 'package.json'));
const { Miniflare } = require('miniflare');
const { chromium } = await import(pathToFileURL(process.env.SAJU_QA_PLAYWRIGHT_PATH ||
  path.join(root, '.sites-runtime/test-tools/node_modules/playwright/index.mjs')).href);
const phase = process.env.SAJU_QA_PHASE || 'after', output = path.join(root, 'outputs/galaxy-entry-appearance');
assert(['before', 'after'].includes(phase)); await fs.mkdir(output, { recursive: true });
const checks = [], observations = [], errors = [], outbound = [], sha = value => createHash('sha256').update(value).digest('hex');
const applicationSourceSha256 = sha(await fs.readFile(path.join(builtRoot, 'components/planet/GalaxyCanvas.tsx')));
async function check(name, fn) {
  console.log('RUN ' + name);
  try { await fn(); checks.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
  catch (error) { checks.push({ name, status: 'FAIL', error: error.stack }); console.error(error.message); }
}
async function walk(dir) {
  const files = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(file)); else if (/\.m?js$/.test(file)) files.push(file);
  }
  return files;
}
const entry = path.join(builtRoot, 'dist/server/index.js');
const mf = new Miniflare({ rootPath: builtRoot, modulesRoot: 'dist/server',
  modules: [entry, ...(await walk(path.join(builtRoot, 'dist/server'))).filter(f => f !== entry)].map(file => ({ type: 'ESModule', path: file })),
  compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'], host: '127.0.0.1', port: 0,
  cf: false, logRequests: false, telemetry: { enabled: false }, d1Databases: { DB: 'entry-look-synthetic' }, d1Persist: false,
  assets: { directory: path.join(builtRoot, 'dist/client'), routerConfig: { has_user_worker: true } },
  outboundService: async request => { outbound.push(new URL(request.url).hostname); return new Response('blocked', { status: 502 }); },
});
const headers = { 'oai-authenticated-user-id': 'entry-look-synthetic', 'oai-authenticated-user-email': 'qa@example.invalid' };
const init = () => {
  let now = 1000, sequence = 0, drawEnabled = true;
  const pending = new Map(), records = [];
  Object.defineProperty(performance, 'now', { configurable: true, value: () => now });
  window.requestAnimationFrame = callback => { const id = ++sequence; pending.set(id, callback); return id; };
  window.cancelAnimationFrame = id => pending.delete(id);
  const context = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, ...args) {
    const gl = context.call(this, type, ...args);
    if (gl && /^webgl/.test(type) && !records.some(r => r.gl === gl)) {
      const record = { gl, canvas: this, matrices: [], draws: 0 }; records.push(record);
      const locations = new Map(), bodyPrograms = new Set(); let active;
      const getLocation = gl.getUniformLocation.bind(gl);
      gl.getUniformLocation = (program, name) => {
        const location = getLocation(program, name);
        if (name === 'modelMatrix' && location) locations.set(program, location);
        if (name === 'uLsTime' && location) bodyPrograms.add(program);
        return location;
      };
      const bindProgram = gl.useProgram.bind(gl);
      gl.useProgram = program => { active = program; return bindProgram(program); };
      for (const method of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
        const draw = gl[method].bind(gl);
        gl[method] = (...values) => {
          if (!drawEnabled) return;
          if (locations.has(active) && bodyPrograms.has(active)) record.matrices.push([...gl.getUniform(active, locations.get(active))]);
          record.draws++; return draw(...values);
        };
      }
      const clear = gl.clear.bind(gl); gl.clear = (...values) => { if (drawEnabled) return clear(...values); };
    }
    return gl;
  };
  window.__entryQa = {
    records, pending,
    step(delta, draw = true) {
      now += delta; drawEnabled = draw; records.forEach(r => { r.matrices = []; });
      const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(callback => callback(now));
      drawEnabled = true; return { callbacks: callbacks.length, pending: pending.size };
    },
    advance(count, delta) { for (let i = 0; i < count; i++) this.step(delta, i === count - 1); },
  };
};
const bindView = () => {
  const refs = [], seen = new Set();
  for (let el = document.querySelector('[data-scene] canvas'); el; el = el.parentElement) {
    const key = Object.keys(el).find(k => k.startsWith('__reactFiber$'));
    for (let fiber = key && el[key]; fiber; fiber = fiber.return) {
      if (seen.has(fiber)) continue; seen.add(fiber);
      for (let hook = fiber.memoizedState; hook && typeof hook === 'object'; hook = hook.next) {
        const value = hook.memoizedState?.current;
        if (value?.isScene || value?.isWebGLRenderer || value?.isPerspectiveCamera || value instanceof Map) refs.push(value);
      }
    }
  }
  const scene = refs.find(r => r.isScene), renderer = refs.find(r => r.isWebGLRenderer), camera = refs.find(r => r.isPerspectiveCamera);
  if (!scene || !renderer || !camera) throw new Error('Actual scene refs unavailable');
  const nodes = refs.find(r => r instanceof Map && [...r.values()][0]?.node?.person);
  const bodies = []; scene.traverse(mesh => { if (mesh.isMesh && mesh.material?.name.startsWith('living:')) bodies.push(mesh); });
  for (const mesh of bodies) {
    const material = mesh.material;
    if (material.userData.qaCompileWrapped) continue;
    material.userData.qaCompileWrapped = true;
    const compile = material.onBeforeCompile;
    material.onBeforeCompile = function(shader, ...args) { compile.call(this, shader, ...args); this.userData.qaUniforms = shader.uniforms; };
    material.needsUpdate = true;
  }
  window.__entryQa.view = { scene, renderer, camera, nodes, bodies };
};
const appearance = () => {
  const { bodies, scene, renderer, camera } = window.__entryQa.view, main = bodies[0];
  const uniform = main.material.userData.qaUniforms, image = uniform.uLsMask.value?.source.data;
  let hash = 2166136261;
  if (image) for (const byte of image.getContext('2d').getImageData(0, 0, image.width, image.height).data) { hash ^= byte; hash = Math.imul(hash, 16777619); }
  const effects = [];
  main.traverse(mesh => { if (mesh.userData.surfaceEffect) effects.push({ ...mesh.userData.surfaceEffect, count: mesh.count }); });
  return { material: main.material.name, day: uniform.uLsDay.value.toArray(), month: uniform.uLsMonth.value.toArray(),
    dayColor: uniform.uLsDayPrimary.value.toArray(), monthColor: uniform.uLsMonthPrimary.value.toArray(),
    mask: image ? { width: image.width, height: image.height, rgbaFnv1a: hash >>> 0 } : null,
    roughness: main.material.roughness, metalness: main.material.metalness, effects,
    effectRadius: main.children.find(g => g.name === 'living-planet-surface-effects')?.userData.surfaceEffects.radius,
    geometryRadius: main.geometry.parameters.radius, scale: main.scale.toArray(), exposure: renderer.toneMappingExposure,
    cameraPosition: camera.position.toArray(), lightIntensities: scene.children.filter(o => o.isLight).map(o => o.intensity) };
};
let browser, browserVersion, origin;
async function pageView(url, reducedMotion = 'no-preference') {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion, extraHTTPHeaders: headers });
  await context.addInitScript(init);
  await context.route('**/*', route => { const u = new URL(route.request().url());
    if (u.origin === origin || ['data:', 'blob:'].includes(u.protocol)) return route.continue();
    outbound.push(u.hostname); return route.abort(); });
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(origin + url, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-scene-state="ready"] canvas'); await page.evaluate(bindView);
  await page.evaluate(() => window.__entryQa.step(0));
  return { page, context, close: () => context.close() };
}
async function png(page, name) {
  const uri = await page.evaluate(() => document.querySelector('[data-scene] canvas').toDataURL('image/png'));
  await fs.writeFile(path.join(output, `${phase}-${name}.png`), Buffer.from(uri.split(',')[1], 'base64'));
}
async function createMap() {
  const reply = await fetch(origin + '/api/guin', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ name: '합성 진입 기준점', birthYear: 2000, birthMonth: 1, birthDay: 1, birthHour: 12, birthMinute: 30, isUnknownTime: false }) });
  assert.equal(reply.status, 200); return (await reply.json()).guinMap;
}
try {
  const db = await mf.getD1Database('DB');
  for (const file of (await fs.readdir(path.join(root, 'drizzle'))).filter(f => f.endsWith('.sql')).sort())
    for (const sql of (await fs.readFile(path.join(root, 'drizzle', file), 'utf8')).split('--> statement-breakpoint')) if (sql.trim()) await db.prepare(sql.trim()).run();
  origin = (await mf.ready).origin;
  browser = await chromium.launch({ executablePath: process.env.SAJU_QA_CHROME || '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  browserVersion = await browser.version();
  const helper = require('./scripts/qa/load-ts.cjs').createLoader({ three: THREE }).load('lib/planet/galaxy-helper.ts');
  for (const fps of [30, 60, 144]) await check(`${fps}fps actual WebGL entry reaches moving orbit continuously`, async () => {
    const map = await createMap(), v = await pageView('/guin/' + map.id);
    try {
      // Keep this synthetic fixture's random affinity identical before/after.
      // The real POST still parses/calculates/persists the same birth/person.
      await v.page.route(origin + '/api/guin/' + map.id, async route => {
        if (route.request().method() !== 'POST') return route.continue();
        const response = await route.fetch(), data = await response.json();
        data.guinMap.guins.at(-1).affinityScore = 91;
        await db.prepare('UPDATE guin_maps SET data=? WHERE id=?').bind(JSON.stringify(data.guinMap), map.id).run();
        return route.fulfill({ response, json: data });
      });
      await v.page.evaluate(() => window.__entryQa.advance(400, 50));
      await v.page.getByRole('button', { name: '친구 행성 등록', exact: true }).evaluate(button => button.click());
      // Deployed v29's join overlay identifies its form by the named input.
      const dialog = v.page.locator('form').filter({ has: v.page.getByPlaceholder('예: 지우') });
      await dialog.getByPlaceholder('예: 지우').fill('합성 진입 친구');
      const response = v.page.waitForResponse(r => r.url().endsWith('/api/guin/' + map.id) && r.request().method() === 'POST');
      await dialog.evaluate(form => form.requestSubmit());
      const data = await (await response).json(); assert(data.success); await dialog.waitFor({ state: 'hidden' });
      await v.page.evaluate(bindView);
      const friend = data.guinMap.guins.at(-1), node = helper.buildGalaxyNodes(data.guinMap.guins).find(n => n.person.id === friend.id);
      const anchor = node.worldPos.clone(), omega = .052 / Math.sqrt(Math.max(1, Math.hypot(anchor.x, anchor.z) / 6));
      const orbitalSpeed = Math.hypot(anchor.x, anchor.z) * omega, samples = [];
      for (let frame = 1; frame <= Math.ceil(2.95 * fps); frame++) {
        const elapsed = frame / fps, draw = frame % Math.round(fps / 4) === 0 || elapsed >= 2.7;
        const state = await v.page.evaluate(({ delta, draw, id }) => {
          window.__entryQa.step(delta, draw);
          const entry = window.__entryQa.view.nodes.get(id), record = window.__entryQa.records.find(r => r.canvas.closest('[data-scene="galaxy"]'));
          const position = entry.group.position.toArray();
          const matrix = record.matrices.find(m => Math.abs(Math.hypot(m[0], m[1], m[2]) - .88) < 1e-4);
          return { position, nativePosition: matrix?.slice(12, 15), draws: record.draws };
        }, { delta: 1000 / fps, draw, id: friend.id });
        samples.push({ elapsed, ...state });
        if (Math.abs(elapsed - 2.8) <= .5 / fps || frame === 1 || frame === Math.ceil(2.95 * fps)) await png(v.page, `entry-${fps}fps-${frame}`);
      }
      let maxBoundarySpeed = 0, maxNativeError = 0, finalError = 0;
      samples.forEach((s, i) => {
        const position = new THREE.Vector3(...s.position);
        if (s.nativePosition) maxNativeError = Math.max(maxNativeError, position.distanceTo(new THREE.Vector3(...s.nativePosition)));
        if (i && s.elapsed >= 2.75) maxBoundarySpeed = Math.max(maxBoundarySpeed,
          position.distanceTo(new THREE.Vector3(...samples[i - 1].position)) * fps);
        if (i === samples.length - 1) finalError = position.distanceTo(anchor.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), (20 + s.elapsed) * omega));
      });
      observations.push({ scenario: 'entry', fps, affinityScore: 91, anchor: anchor.toArray(), orbitalSpeed, maxBoundarySpeed, maxNativeError, finalError, samples });
      assert(samples.filter(s => s.elapsed >= 2.7).every(s => s.nativePosition), 'Boundary needs real body draw and native modelMatrix readback');
      assert(maxNativeError < 2e-5); assert(finalError < 2e-5);
      assert(maxBoundarySpeed < orbitalSpeed + .12, `Entry boundary speed ${maxBoundarySpeed} vs orbit ${orbitalSpeed}`);
    } finally { await v.close(); }
  });
  for (const mask of ['pangaea', 'archipelago']) await check(`same owner ${mask}: material, mask and supported effects agree across actual WebGL scenes`, async () => {
    const v = await pageView('/planet?view=planet&name=합성외형&y=2000&m=1&d=1&h=12&minute=30');
    try {
      if (mask === 'archipelago') await v.page.getByRole('button', { name: '작은 섬들', exact: true }).evaluate(b => b.click());
      await v.page.evaluate(bindView); await v.page.evaluate(() => window.__entryQa.step(0));
      const personal = await v.page.evaluate(appearance), session = await v.page.evaluate(() => JSON.parse(sessionStorage.getItem('saju:universe:v1')));
      await png(v.page, 'personal-' + mask);
      await v.page.goto(origin + '/guin', { waitUntil: 'networkidle' });
      await v.page.getByRole('button', { name: '귀인 지도 만들기', exact: true }).evaluate(b => b.click());
      await v.page.waitForURL(/\/guin\/[^/?]+$/); await v.page.waitForSelector('[data-scene="galaxy"][data-scene-state="ready"]');
      await v.page.evaluate(bindView); await v.page.evaluate(() => window.__entryQa.step(0));
      await v.page.getByRole('button', { name: '나의 별 추적', exact: true }).evaluate(b => b.click());
      await v.page.evaluate(() => window.__entryQa.advance(80, 50));
      const galaxy = await v.page.evaluate(appearance);
      const mapReply = await v.page.request.get(origin + '/api' + new URL(v.page.url()).pathname); const map = (await mapReply.json()).guinMap;
      await png(v.page, 'galaxy-owner-' + mask);
      observations.push({ scenario: 'same owner', mask, sessionPillars: { dayKey: session.dayKey, monthKey: session.monthKey, yearKey: session.yearKey, hourKey: session.hourKey },
        apiPillars: map.guins.find(p => p.isMe).pillars, personal, galaxy });
      assert.deepEqual(map.guins.find(p => p.isMe).pillars, { dayKey: session.dayKey, monthKey: session.monthKey, yearKey: session.yearKey, hourKey: session.hourKey });
      for (const key of ['material', 'day', 'month', 'dayColor', 'monthColor', 'mask', 'roughness', 'metalness', 'effects']) assert.deepEqual(galaxy[key], personal[key], key + ' differs');
      assert(galaxy.effects.length > 0); assert.equal(galaxy.effectRadius, galaxy.geometryRadius);
    } finally { await v.close(); }
  });
  await check('later owner mask survives navigation/reload; an unbound map uses its default', async () => {
    const v = await pageView('/planet?view=planet&name=합성후속무늬&y=2000&m=1&d=1&h=12&minute=30');
    try {
      await v.page.goto(origin + '/guin', { waitUntil: 'networkidle' });
      await v.page.getByRole('button', { name: '귀인 지도 만들기', exact: true }).evaluate(b => b.click());
      await v.page.waitForURL(/\/guin\/[^/?]+$/); await v.page.waitForSelector('[data-scene="galaxy"][data-scene-state="ready"]');
      const mapPath = new URL(v.page.url()).pathname;
      await v.page.goto(origin + '/planet?view=planet', { waitUntil: 'networkidle' });
      await v.page.waitForSelector('[data-scene="planet"][data-scene-state="ready"]');
      await v.page.getByRole('button', { name: '흐르는 띠', exact: true }).evaluate(b => b.click());
      await v.page.evaluate(bindView); await v.page.evaluate(() => window.__entryQa.step(0));
      const personal = await v.page.evaluate(appearance);
      await v.page.goto(origin + mapPath, { waitUntil: 'networkidle' });
      for (const reload of [false, true]) {
        if (reload) await v.page.reload({ waitUntil: 'networkidle' });
        await v.page.waitForSelector('[data-scene="galaxy"][data-scene-state="ready"]');
        await v.page.evaluate(bindView); await v.page.evaluate(() => window.__entryQa.step(0));
        const galaxy = await v.page.evaluate(appearance);
        assert.deepEqual(galaxy.mask, personal.mask); assert.deepEqual(galaxy.effects, personal.effects);
        assert.equal(await v.page.evaluate(() => JSON.parse(sessionStorage.getItem('saju:universe:v1')).maskStyle), 'bands');
      }
      const other = await createMap(); await v.page.goto(origin + '/guin/' + other.id, { waitUntil: 'networkidle' });
      await v.page.waitForSelector('[data-scene="galaxy"][data-scene-state="ready"]');
      await v.page.evaluate(bindView); await v.page.evaluate(() => window.__entryQa.step(0));
      const fallback = await v.page.evaluate(appearance);
      assert.deepEqual(fallback.mask, observations.find(o => o.scenario === 'same owner' && o.mask === 'pangaea').personal.mask);
      observations.push({ scenario: 'later mask', selected: 'bands', navigationAndReloadPreserved: true, unboundDefaultPreserved: true });
    } finally { await v.close(); }
  });
  await check('all ten existing effects compile and render in the galaxy with bounded local radii', async () => {
    const map = await createMap(), keys = ['갑자', '을축', '병인', '정묘', '무진', '기사', '경오', '신미', '임신', '계유'];
    const template = map.guins[0];
    // Explicit synthetic pillar fixtures for shader coverage, not calculated births.
    map.guins = keys.map((key, i) => ({ ...template, id: 'synthetic-stem-' + i, name: '합성 ' + key,
      isMe: i === 0, affinityScore: 91, pillars: { ...template.pillars, dayKey: key, monthKey: key } }));
    await db.prepare('UPDATE guin_maps SET data=? WHERE id=?').bind(JSON.stringify(map), map.id).run();
    const v = await pageView('/guin/' + map.id);
    try {
      const state = await v.page.evaluate(() => {
        const { nodes, renderer, scene, camera } = window.__entryQa.view;
        const effects = [...nodes.values()].map(e => e.mesh.children.find(g => g.name === 'living-planet-surface-effects'));
        if (effects.some(e => !e)) return { missing: true };
        renderer.compile(scene, camera); window.__entryQa.advance(20, 50);
        return { missing: false, ready: document.querySelector('[data-scene]').dataset.sceneState,
          programs: renderer.info.programs.length, batches: effects.map(e => e.children.length),
          radius: effects.map(e => e.userData.surfaceEffects.radius), calls: renderer.info.render.calls };
      });
      assert.equal(state.missing, false); assert.equal(state.ready, 'ready'); assert(state.programs > 0 && state.calls > 0);
      assert(state.batches.every(n => n > 0)); assert(state.radius.every(r => r === 1));
      observations.push({ scenario: 'ten stem shaders', keys, ...state }); await png(v.page, 'ten-stem-galaxy');
    } finally { await v.close(); }
  });
  await check('no page errors or outbound traffic', () => { assert.deepEqual(errors, []); assert.deepEqual(outbound, []); });
} finally {
  const report = { phase, browser: browserVersion, sourceRoot: root, builtRoot,
    sourceSha256: applicationSourceSha256, harnessSha256: sha(await fs.readFile(path.join(root, 'scripts/qa/galaxy-entry-appearance-browser.mjs'))),
    builtServerSha256: sha(await fs.readFile(entry)), passed: checks.filter(c => c.status === 'PASS').length, failed: checks.filter(c => c.status === 'FAIL').length,
    checks, observations, errors, outbound, limits: ['Native deployed v29 aa41b1a3601c5254c28bc5a4c853cd5efa50c5cc source recovered and used as the immutable integration basis',
      'Synthetic rAF/clock; real Worker, synthetic disposable D1 and SwiftShader WebGL, no physical GPU/mobile suspension',
      'Pre-roll draws sampled; every frame at the entry/orbit boundary uses native draws and GPU modelMatrix readback'] };
  await fs.writeFile(path.join(output, `${phase}-entry-appearance-browser.json`), JSON.stringify(report, null, 2) + '\n');
  await browser?.close(); await mf.dispose(); console.log(JSON.stringify({ passed: report.passed, failed: report.failed }));
  process.exitCode = report.failed ? 1 : 0;
}
