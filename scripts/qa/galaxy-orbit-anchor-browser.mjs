import { createLoader } from './load-ts.mjs';
// Actual built animation and WebGL. Simulate every frame; native draw/clear
// runs at minute samples during long simulations. All uniform uploads stay native.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as THREE from 'three';
const root = process.cwd();
const require = createRequire(path.join(root, 'package.json'));
const { Miniflare } = require('miniflare');
const output = path.join(root, 'outputs/galaxy-anchor');
await fs.mkdir(output, { recursive: true });
const { chromium } = await import(pathToFileURL(process.env.SAJU_QA_PLAYWRIGHT_PATH || path.join(root, '.sites-runtime/test-tools/node_modules/playwright/index.mjs')).href);
const checks = [], observations = [], outbound = [], errors = [];
const sha = value => createHash('sha256').update(value).digest('hex');
const headers = { 'oai-authenticated-user-id': 'galaxy-anchor-synthetic', 'oai-authenticated-user-email': 'qa@example.invalid' };
async function check(name, task) {
  console.log('RUN ' + name);
  try { await task(); checks.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
  catch (error) { checks.push({ name, status: 'FAIL', error: error.stack }); console.error(error); }
}
async function walk(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(file)); else if (/\.m?js$/.test(file)) files.push(file);
  }
  return files;
}
const entry = path.join(root, 'dist/server/index.js');
const mf = new Miniflare({ rootPath: root, modulesRoot: 'dist/server',
  modules: [entry, ...(await walk(path.join(root, 'dist/server'))).filter(file => file !== entry)].map(file => ({ type: 'ESModule', path: file })),
  compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'], host: '127.0.0.1', port: 0,
  cf: false, logRequests: false, telemetry: { enabled: false }, d1Databases: { DB: 'galaxy-anchor-synthetic' }, d1Persist: false,
  assets: { directory: 'dist/client', routerConfig: { has_user_worker: true } },
  outboundService: async request => { outbound.push(new URL(request.url).hostname); return new Response('blocked', { status: 502 }); },
});
const init = () => {
  let now = 1000, hidden = false, sequence = 0, nativeDraw = true;
  const pending = new Map(), records = [], events = [];
  Object.defineProperty(performance, 'now', { configurable: true, value: () => now });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => hidden ? 'hidden' : 'visible' });
  window.requestAnimationFrame = callback => { const id = ++sequence; pending.set(id, callback); return id; };
  window.cancelAnimationFrame = id => pending.delete(id);
  const originalContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, ...args) {
    const gl = originalContext.call(this, type, ...args);
    if (gl && /^webgl/.test(type) && !records.some(record => record.gl === gl)) {
      const record = { gl, canvas: this, draws: 0, losses: 0, drawState: [] };
      records.push(record);
      const names = new WeakMap(), programs = new Map(), matrixLocations = new Map(); let active;
      const location = gl.getUniformLocation.bind(gl);
      gl.getUniformLocation = (program, name) => { const result = location(program, name); if (result) { names.set(result, name); if (name === "modelMatrix") matrixLocations.set(program, result); } return result; };
      const bindProgram = gl.useProgram.bind(gl);
      gl.useProgram = program => { active = program; if (!programs.has(program)) programs.set(program, {}); return bindProgram(program); };
      for (const method of ['uniform1f', 'uniformMatrix4fv']) {
        const upload = gl[method].bind(gl);
        gl[method] = (...args) => {
          const name = names.get(args[0]);
          if (['uLsTime', 'modelMatrix', 'modelViewMatrix', 'viewMatrix', 'projectionMatrix'].includes(name))
            programs.get(active)[name] = method === 'uniform1f' ? args[1] : [...args[2]];
          return upload(...args);
        };
      }
      for (const method of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
        const draw = gl[method].bind(gl);
        gl[method] = (...args) => {
          if (!nativeDraw) return;
          record.draws++;
          const state = structuredClone(programs.get(active));
          if (matrixLocations.has(active) && state.uLsTime !== undefined) state.nativeModelMatrix = [...gl.getUniform(active, matrixLocations.get(active))];
          record.drawState.push({ method, count: args[2], ...state }); return draw(...args);
        };
      }
      const clear = gl.clear.bind(gl); gl.clear = (...args) => { if (nativeDraw) return clear(...args); };
      this.addEventListener('webglcontextlost', event => { record.losses++; events.push({ type: event.type, isTrusted: event.isTrusted }); });
    }
    return gl;
  };
  window.__orbitQa = {
    records, events,
    step(delta) {
      now += delta; for (const record of records) record.drawState = [];
      const callbacks = [...pending.values()]; pending.clear(); for (const callback of callbacks) callback(now);
      return { callbackCount: callbacks.length, pendingCount: pending.size };
    },
    visibility(value, elapsed = 0) {
      now += elapsed; hidden = value; const event = new Event('visibilitychange'); document.dispatchEvent(event);
      events.push({ type: event.type, hidden, isTrusted: event.isTrusted, now });
    },
    advance(count, delta) {
      const start = now;
      for (let i = 0; i < count; i++) {
        nativeDraw = i === count - 1; now = start + (i + 1) * delta;
        for (const record of records) record.drawState = [];
        const callbacks = [...pending.values()]; pending.clear();
        if (callbacks.length !== 1) throw new Error("Expected one animation callback");
        for (const callback of callbacks) callback(now);
      }
      nativeDraw = true; for (const record of records) record.gl.finish();
      return { pendingCount: pending.size, now };
    },
    get pendingCount() { return pending.size; },
    get now() { return now; },
  };
};
let browser, browserVersion, origin, mapPath;
async function view(width = 390, reducedMotion = 'no-preference') {
  const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion, extraHTTPHeaders: headers });
  await context.addInitScript(init);
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
    outbound.push(url.hostname); return route.abort();
  });
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + mapPath, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-scene="galaxy"][data-scene-state="ready"]');
  await page.evaluate(() => document.fonts.ready);
  const step = delta => page.evaluate(delta => window.__orbitQa.step(delta), delta);
  const visibility = (hidden, elapsed) => page.evaluate(({ hidden, elapsed }) => window.__orbitQa.visibility(hidden, elapsed), { hidden, elapsed });
  const snapshot = async () => {
    const result = await page.evaluate(() => {
      const record = window.__orbitQa.records.find(record => record.canvas.closest('[data-scene="galaxy"]'));
      return { image: record.canvas.toDataURL('image/png'), draws: record.draws, states: record.drawState,
        pendingCount: window.__orbitQa.pendingCount, ready: record.canvas.closest('[data-scene]').dataset.sceneState,
        paused: document.querySelector('[title="은하와 천체 움직임 일시정지 또는 재생"]').textContent === '움직임 재생' };
    });
    return { ...result, rasterHash: sha(result.image), stateHash: sha(JSON.stringify(result.states)) };
  };
  const pause = async () => {
    const box = await page.getByRole('button', { name: '움직임 멈춤', exact: true }).boundingBox();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x + box.width / 2, y: box.y + box.height / 2, button: 'left', clickCount: 1 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x + box.width / 2, y: box.y + box.height / 2, button: 'left', clickCount: 1 });
    await cdp.detach(); await page.getByRole('button', { name: '움직임 재생', exact: true }).waitFor();
  };
  return { context, page, step, snapshot, visibility, pause,
    advance: (count, delta) => page.evaluate(({count, delta}) => window.__orbitQa.advance(count, delta), {count, delta}),
    close: () => context.close() };
}

const phase = process.env.SAJU_QA_PHASE || 'after';
assert(['before', 'after'].includes(phase));
const durationSeconds = 3600, sampleSeconds = 60, fpsRates = [30, 60, 144], tolerance = 2e-5;
const applicationSourceSha256 = sha(await fs.readFile(path.join(root, 'components/planet/GalaxyCanvas.tsx')));
const clientFiles = (await walk(path.join(root, 'dist/client'))).sort();
const fingerprint = createHash('sha256');
for (const file of clientFiles) fingerprint.update(path.relative(root, file)).update(await fs.readFile(file));
const builtClientFingerprint = fingerprint.digest('hex');
const nodesFrom = map => createLoader({ three: THREE }).load('lib/planet/galaxy-helper.ts').buildGalaxyNodes(map.guins);
const bodies = state => state.states.filter(draw => {
  const matrix = draw.nativeModelMatrix; if (!matrix) return false;
  const scale = Math.hypot(matrix[0], matrix[1], matrix[2]);
  return Math.abs(scale - 1.3) < 1e-4 || Math.abs(scale - .88) < 1e-4;
}).map(draw => ({ position: new THREE.Vector3(draw.nativeModelMatrix[12], draw.nativeModelMatrix[13], draw.nativeModelMatrix[14]),
  scale: Math.hypot(draw.nativeModelMatrix[0], draw.nativeModelMatrix[1], draw.nativeModelMatrix[2]) }));
const axis = new THREE.Vector3(0, 1, 0);
try {
  const db = await mf.getD1Database('DB');
  for (const file of (await fs.readdir(path.join(root, 'drizzle'))).filter(file => file.endsWith('.sql')).sort())
    for (const sql of (await fs.readFile(path.join(root, 'drizzle', file), 'utf8')).split('--> statement-breakpoint')) if (sql.trim()) await db.prepare(sql.trim()).run();
  origin = (await mf.ready).origin;
  const ownerReply = await fetch(origin + '/api/guin', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ name: '합성 공전 기준점', birthYear: 2000, birthMonth: 1, birthDay: 1, birthHour: 12, birthMinute: 30, isUnknownTime: false }) });
  assert.equal(ownerReply.status, 200); mapPath = '/guin/' + (await ownerReply.json()).guinMap.id;
  const friendReply = await fetch(origin + '/api' + mapPath, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ friendName: '합성 공전 친구', birthYear: 1997, birthMonth: 3, birthDay: 10, birthHour: 10, birthMinute: 30, isUnknownTime: false }) });
  assert.equal(friendReply.status, 200); const map = (await friendReply.json()).guinMap;
  // Fix this disposable fixture's random affinity so both bodies remain in view.
  map.guins.find(person => !person.isMe).affinityScore = 91;
  await db.prepare('UPDATE guin_maps SET data=? WHERE id=?').bind(JSON.stringify(map), map.id).run();
  const nodes = nodesFrom(map);
  browser = await chromium.launch({ executablePath: process.env.SAJU_QA_CHROME || '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  browserVersion = await browser.version();
  for (const fps of fpsRates) {
    console.log('SIMULATE ' + phase + ' WebGL ' + fps + 'fps ' + durationSeconds + 's');
    const v = await view(1440);
    try {
      await v.step(0); const first = await v.snapshot(), firstBodies = bodies(first);
      assert.equal(firstBodies.length, nodes.length, 'Native shader modelMatrix must expose both planet centers');
      const order = firstBodies.map(body => nodes.findIndex(node => node.worldPos.distanceTo(body.position) < tolerance));
      assert.equal(new Set(order).size, nodes.length); assert(order.every(index => index >= 0));
      const records = order.map((nodeIndex, index) => {
        const node = nodes[nodeIndex], anchor = node.worldPos.clone(), radius = Math.hypot(anchor.x, anchor.z);
        return { id: node.person.id, owner: node.isOwner, anchor, radius,
          omega: node.isOwner ? 0 : .052 / Math.sqrt(Math.max(1, radius / 6)),
          previousAngle: Math.atan2(firstBodies[index].position.z, firstBodies[index].position.x),
          maxPathError: 0, maxRadiusError: 0, maxAngularStepError: 0, signedTravel: 0 };
      });
      const samples = [];
      for (let seconds = sampleSeconds; seconds <= durationSeconds; seconds += sampleSeconds) {
        const progress = await v.advance(sampleSeconds * fps, 1000 / fps);
        assert.equal(progress.pendingCount, 1);
        const state = await v.snapshot(), currentBodies = bodies(state);
        assert.equal(currentBodies.length, records.length, 'Both bodies must be drawn at every GPU sample');
        assert.equal(state.ready, 'ready');
        currentBodies.forEach((body, index) => {
          const record = records[index], expected = record.anchor.clone().applyAxisAngle(axis, record.omega * seconds);
          record.maxPathError = Math.max(record.maxPathError, body.position.distanceTo(expected));
          record.maxRadiusError = Math.max(record.maxRadiusError, Math.abs(Math.hypot(body.position.x, body.position.z) - record.radius));
          const angle = Math.atan2(body.position.z, body.position.x);
          const step = Math.atan2(Math.sin(angle - record.previousAngle), Math.cos(angle - record.previousAngle));
          record.maxAngularStepError = Math.max(record.maxAngularStepError, Math.abs(step + record.omega * sampleSeconds));
          record.previousAngle = angle; record.signedTravel += step;
        });
        samples.push({ seconds, positions: currentBodies.map(body => body.position.toArray()), nativeDraws: state.draws, rasterHash: state.rasterHash });
        if (seconds % 600 === 0) console.log(JSON.stringify({ phase, fps, seconds, nativeDraws: state.draws, maxPathError: Math.max(...records.map(record => record.maxPathError)) }));
        if (seconds === durationSeconds) await fs.writeFile(path.join(output, phase + '-gpu-' + fps + 'fps.png'), Buffer.from(state.image.split(',')[1], 'base64'));
      }
      observations.push({ fps, durationSeconds, simulatedFrames: durationSeconds * fps, nativeRenderSampleSeconds: sampleSeconds,
        records: records.map(({ anchor, previousAngle, ...record }) => { void previousAngle; return { ...record, anchor: anchor.toArray(), expectedSignedTravel: -record.omega * durationSeconds }; }), samples });
      await check(fps + 'fps WebGL: native model matrices follow original paths for one hour', () => assert(records.every(record => record.maxPathError < tolerance), 'Native GPU modelMatrix diverges from the original orbit'));
      await check(fps + 'fps WebGL: radii remain bounded', () => assert(records.every(record => record.maxRadiusError < tolerance)));
      await check(fps + 'fps WebGL: angular speed and travel do not accumulate', () => {
        assert(records.every(record => record.maxAngularStepError < tolerance));
        assert(records.every(record => Math.abs(record.signedTravel + record.omega * durationSeconds) < tolerance));
      });
    } finally { await v.close(); }
  }
  await check('WebGL 30/60/144fps final planet centers agree', () => {
    const reference = observations[0].samples.at(-1).positions;
    for (const observation of observations.slice(1)) observation.samples.at(-1).positions.forEach((position, index) => {
      assert(new THREE.Vector3(...position).distanceTo(new THREE.Vector3(...reference[index])) < tolerance);
    });
  });
  await check('actual WebGL user pause holds planet centers', async () => {
    const v = await view(1440);
    try {
      await v.step(0); await v.advance(60, 1000 / 60); await v.pause();
      await v.step(16); const first = bodies(await v.snapshot()).map(body => body.position);
      await v.advance(600, 1000 / 60); const last = bodies(await v.snapshot()).map(body => body.position);
      assert.equal(first.length, last.length); assert(first.every((position, index) => position.distanceTo(last[index]) < tolerance));
    } finally { await v.close(); }
  });
  await check('browser errors and outbound requests remain empty', async () => { assert.deepEqual(errors, []); assert.deepEqual(outbound, []); });
} finally {
  const report = { phase, basis: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), browser: browserVersion,
    applicationSourceSha256, builtClientFingerprint, harnessSha256: sha(await fs.readFile(path.join(root, 'scripts/qa/galaxy-orbit-anchor-browser.mjs'))),
    durationSeconds, sampleSeconds, fpsRates, tolerance,
    passed: checks.filter(check => check.status === 'PASS').length, failed: checks.filter(check => check.status === 'FAIL').length,
    checks, observations, errors, outbound,
    limits: ['Every simulated rAF executes the actual built animation and renderer, including native uniform uploads. Intermediate native draw/clear is suppressed; real shaders render once per simulated minute and in the pause check.',
      'Native modelMatrix values are read back with gl.getUniform; milestone pixels are real WebGL PNGs after gl.finish.',
      'Chromium/SwiftShader with synthetic clock/rAF and disposable local D1; no claim of physical GPU frame rate or OS tab suspension'] };
  await fs.writeFile(path.join(output, phase + '-gpu-results.json'), JSON.stringify(report, null, 2) + '\n');
  await browser?.close(); await mf.dispose();
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed }));
  process.exitCode = report.failed ? 1 : 0;
}
