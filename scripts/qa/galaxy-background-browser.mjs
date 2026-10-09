// Actual built Worker/WebGL scene; host rAF/time/visibility are explicitly synthetic.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root = process.cwd();
const require = createRequire(path.join(root, 'package.json'));
const { Miniflare } = require('miniflare');
const output = path.join(root, 'outputs/galaxy-resume');
await fs.mkdir(output, { recursive: true });
const { chromium } = await import(pathToFileURL(process.env.SAJU_QA_PLAYWRIGHT_PATH || path.join(root, '.sites-runtime/test-tools/node_modules/playwright/index.mjs')).href);
const checks = [], observations = [], outbound = [], errors = [];
const sha = value => createHash('sha256').update(value).digest('hex');
const headers = { 'oai-authenticated-user-id': 'galaxy-resume-synthetic', 'oai-authenticated-user-email': 'qa@example.invalid' };
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
  cf: false, logRequests: false, telemetry: { enabled: false }, d1Databases: { DB: 'galaxy-resume-synthetic' }, d1Persist: false,
  assets: { directory: 'dist/client', routerConfig: { has_user_worker: true } },
  outboundService: async request => { outbound.push(new URL(request.url).hostname); return new Response('blocked', { status: 502 }); },
});
const init = () => {
  let now = 1000, hidden = false, sequence = 0;
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
      const names = new WeakMap(), programs = new Map(); let active;
      const location = gl.getUniformLocation.bind(gl);
      gl.getUniformLocation = (program, name) => { const result = location(program, name); if (result) names.set(result, name); return result; };
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
        gl[method] = (...args) => { record.draws++; record.drawState.push({ method, count: args[2], ...structuredClone(programs.get(active)) }); return draw(...args); };
      }
      this.addEventListener('webglcontextlost', event => { record.losses++; events.push({ type: event.type, isTrusted: event.isTrusted }); });
    }
    return gl;
  };
  window.__resumeQa = {
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
  const step = delta => page.evaluate(delta => window.__resumeQa.step(delta), delta);
  const visibility = (hidden, elapsed) => page.evaluate(({ hidden, elapsed }) => window.__resumeQa.visibility(hidden, elapsed), { hidden, elapsed });
  const snapshot = async () => {
    const result = await page.evaluate(() => {
      const record = window.__resumeQa.records.find(record => record.canvas.closest('[data-scene="galaxy"]'));
      return { image: record.canvas.toDataURL('image/png'), draws: record.draws, states: record.drawState,
        pendingCount: window.__resumeQa.pendingCount, ready: record.canvas.closest('[data-scene]').dataset.sceneState,
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
  return { context, page, step, snapshot, visibility, pause, close: () => context.close() };
}
try {
  const db = await mf.getD1Database('DB');
  for (const file of (await fs.readdir(path.join(root, 'drizzle'))).filter(file => file.endsWith('.sql')).sort())
    for (const sql of (await fs.readFile(path.join(root, 'drizzle', file), 'utf8')).split('--> statement-breakpoint')) if (sql.trim()) await db.prepare(sql.trim()).run();
  origin = (await mf.ready).origin;
  const owner = await fetch(origin + '/api/guin', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ name: '합성 복귀 검증', birthYear: 2000, birthMonth: 1, birthDay: 1, birthHour: 12, birthMinute: 30, isUnknownTime: false }) });
  assert.equal(owner.status, 200); mapPath = '/guin/' + (await owner.json()).guinMap.id;
  const friend = await fetch(origin + '/api' + mapPath, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ friendName: '합성 복귀 친구', birthYear: 1997, birthMonth: 3, birthDay: 10, birthHour: 10, birthMinute: 30, isUnknownTime: false }) });
  assert.equal(friend.status, 200);
  browser = await chromium.launch({ executablePath: process.env.SAJU_QA_CHROME || '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  browserVersion = await browser.version();
  for (const paused of [false, true]) await check('built WebGL ' + (paused ? 'user pause' : 'playing') + ' resume matches ordinary frames', async () => {
    async function sequence(background) {
      const v = await view();
      try {
        for (let i = 0; i < 6; i++) await v.step(16);
        if (paused) await v.pause();
        const before = await v.snapshot(); assert(before.draws > 0); assert.equal(before.paused, paused);
        if (background) {
          await v.visibility(true); await v.step(300000);
          const hidden = await v.snapshot(); assert.equal(hidden.draws, before.draws); assert.equal(hidden.rasterHash, before.rasterHash);
          await v.visibility(false);
        }
        await v.step(16); const first = await v.snapshot();
        for (let i = 0; i < 5; i++) await v.step(16);
        const after = await v.snapshot();
        assert.equal(first.paused, paused); assert.equal(after.paused, paused);
        assert.equal(after.pendingCount, 1); assert.equal(after.ready, 'ready');
        if (background) {
          await fs.writeFile(path.join(output, paused ? 'paused-resumed.png' : 'playing-resumed.png'), Buffer.from(after.image.split(',')[1], 'base64'));
        }
        return { first: { rasterHash: first.rasterHash, stateHash: first.stateHash }, after: { rasterHash: after.rasterHash, stateHash: after.stateHash } };
      } finally { await v.close(); }
    }
    const control = await sequence(false), resumed = await sequence(true);
    assert.deepEqual(resumed, control, 'actual GPU uniform uploads and rendered pixels must match foreground control');
    observations.push({ scenario: paused ? 'paused resume' : 'playing resume', hiddenGapMs: 300000, control, resumed, matchingPixelsAndGPUState: true });
  });
  await check('built reduced-motion remains visually static across long gap', async () => {
    const v = await view(390, 'reduce');
    try {
      await v.step(16); const before = await v.snapshot(); assert(before.paused);
      await v.visibility(true); await v.step(86400000); await v.visibility(false); await v.step(16);
      const after = await v.snapshot(); assert.equal(after.rasterHash, before.rasterHash); assert.equal(after.paused, true);
      observations.push({ scenario: 'reduced motion', hiddenGapMs: 86400000, matchingPixels: true });
    } finally { await v.close(); }
  });
  await check('built resize preserves drawing and one animation chain', async () => {
    const v = await view();
    try {
      await v.step(16);
      for (const width of [320, 768, 1440]) {
        await v.page.setViewportSize({ width, height: 844 }); await v.page.waitForTimeout(100); await v.step(16);
        const state = await v.page.evaluate(() => {
          const canvas = document.querySelector('[data-scene="galaxy"] canvas');
          return { overflow: document.documentElement.scrollWidth - innerWidth, width: canvas.width, displayWidth: canvas.clientWidth,
            height: canvas.height, displayHeight: canvas.clientHeight, state: canvas.closest('[data-scene]').dataset.sceneState };
        });
        assert(state.overflow <= 1); assert(state.width > 0 && state.height > 0); assert.equal(state.state, 'ready');
        observations.push({ scenario: 'resize', viewportWidth: width, ...state });
      }
      const resized = await v.snapshot();
      assert(resized.draws > 0); assert.equal(resized.pendingCount, 1);
    } finally { await v.close(); }
  });
  await check('browser errors and outbound requests remain empty', async () => { assert.deepEqual(errors, []); assert.deepEqual(outbound, []); });
} finally {
  const report = { basis: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), browser: browserVersion,
    passed: checks.filter(check => check.status === 'PASS').length, failed: checks.filter(check => check.status === 'FAIL').length,
    checks, observations, errors, outbound,
    limits: ['Synthetic clock, rAF and visibility events; native hidden-tab state is not emulated by this environment',
      'Actual built Worker, disposable synthetic D1, Chromium/SwiftShader WebGL; no physical GPU/mobile tab suspension',
      'Existing shared Vector3 orbit-anchor drift is a separate baseline diagnostic; paused comparison means equivalent frames, not globally frozen orbits'] };
  await fs.writeFile(path.join(output, 'browser-results.json'), JSON.stringify(report, null, 2) + '\n');
  await browser?.close(); await mf.dispose();
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed }));
  process.exitCode = report.failed ? 1 : 0;
}
