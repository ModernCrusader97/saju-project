// Executes the unchanged React animation closure, actual Three vectors, node builder,
// materials and disposal. Only GPU/environment, Canvas2D drawing and host time are stubs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Module, { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import React, { act } from 'react';
import * as THREE from 'three';

const checkout = process.cwd();
fs.mkdirSync(path.join(checkout, 'outputs/galaxy-resume'), { recursive: true });
const require = createRequire(path.join(checkout, 'package.json'));

const { JSDOM } = await import(pathToFileURL(process.env.SAJU_QA_JSDOM_PATH || path.join(checkout, '.sites-runtime/test-tools/node_modules/jsdom/lib/api.js')).href);
const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://local.test/galaxy-resume' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document,
  HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
const { createRoot } = await import('react-dom/client');
let clock, hidden, nextFrame, frames, renderers, observers, media, lastNodes, environments;
const visibilityListeners = new Set(), resizeListeners = new Set();
for (const [target, type, listeners] of [[document, 'visibilitychange', visibilityListeners], [window, 'resize', resizeListeners]]) {
  const add = target.addEventListener.bind(target), remove = target.removeEventListener.bind(target);
  target.addEventListener = (name, callback, options) => { if (name === type) listeners.add(callback); add(name, callback, options); };
  target.removeEventListener = (name, callback, options) => { if (name === type) listeners.delete(callback); remove(name, callback, options); };
}
Object.defineProperty(globalThis.performance, 'now', { configurable: true, value: () => clock });
Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => hidden ? 'hidden' : 'visible' });
globalThis.requestAnimationFrame = callback => { const id = ++nextFrame; frames.set(id, callback); return id; };
globalThis.cancelAnimationFrame = id => frames.delete(id);
window.matchMedia = query => {
  if (!media.has(query)) media.set(query, { matches: false, listeners: new Set(),
    addEventListener(_type, callback) { this.listeners.add(callback); },
    removeEventListener(_type, callback) { this.listeners.delete(callback); } });
  return media.get(query);
};
globalThis.ResizeObserver = class {
  constructor(callback) { this.callback = callback; this.active = false; observers.push(this); }
  observe(element) { this.element = element; this.active = true; }
  disconnect() { this.active = false; }
};
let dimensions = { width: 390, height: 480 };
Object.defineProperties(dom.window.HTMLElement.prototype, {
  clientWidth: { configurable: true, get: () => dimensions.width },
  clientHeight: { configurable: true, get: () => dimensions.height },
});
dom.window.HTMLCanvasElement.prototype.getContext = function(type) {
  if (type !== '2d') return null;
  if (!this.qaContext) this.qaContext = {
    createImageData: (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
    putImageData(image) { this.image = image; }, getImageData() { return this.image; },
    createRadialGradient: () => ({ addColorStop() {} }),
    beginPath() {}, roundRect() {}, fill() {}, stroke() {}, arc() {}, fillText() {}, fillRect() {},
  };
  return this.qaContext;
};
class RendererBoundary {
  constructor() { this.domElement = document.createElement('canvas'); this.debug = {}; this.renders = 0;
    this.disposals = 0; this.losses = 0; this.sizes = []; renderers.push(this); }
  setSize(w, h) { this.sizes.push([w, h]); }
  setPixelRatio() {}
  render(scene, camera) { this.scene = scene; this.camera = camera; scene.updateMatrixWorld(); camera.updateMatrixWorld(); this.renders++; }
  dispose() { this.disposals++; }
  forceContextLoss() { this.losses++; }
}
function sourceLoader() {
  const cache = new Map();
  const boundaries = {
    three: { ...THREE, WebGLRenderer: RendererBoundary },
    '@/lib/planet/scene-environment': { createStudioEnvironment: () => {
      const target = new THREE.WebGLRenderTarget(1, 1), record = { disposals: 0 };
      target.addEventListener('dispose', () => record.disposals++); environments.push(record); return target;
    } },
  };
  function load(file) {
    const absolute = path.resolve(checkout, file);
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const mod = new Module(absolute); mod.filename = absolute; mod.paths = Module._nodeModulePaths(path.dirname(absolute));
    cache.set(absolute, mod);
    mod.require = name => {
      if (Object.hasOwn(boundaries, name)) return boundaries[name];
      if (name === '@/lib/planet/galaxy-helper') {
        const helper = load('lib/planet/galaxy-helper.ts');
        return { ...helper, buildGalaxyNodes: (...args) => { lastNodes = helper.buildGalaxyNodes(...args); return lastNodes; } };
      }
      if (name.startsWith('@/') || name.startsWith('.')) {
        const resolved = name.startsWith('@/') ? path.join(checkout, name.slice(2)) : path.resolve(path.dirname(absolute), name);
        return load(fs.existsSync(resolved) ? resolved : resolved + '.ts');
      }
      return require(name);
    };
    mod._compile(ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
    }).outputText, absolute);
    return mod.exports;
  }
  return load;
}
const pillars = { dayKey: '갑자', monthKey: '병인', yearKey: '경오', hourKey: '임신' };
const owner = { id: 'synthetic-owner', name: '합성 중심별', isMe: true, relationTitle: '나', pillars };
const friend = { id: 'synthetic-friend', name: '합성 친구', isMe: false, relationTitle: '친구', affinityScore: 91, pillars };
const incoming = { ...friend, id: 'synthetic-incoming', name: '합성 새 친구' };
const round = n => Number(n.toFixed(12));
const vector = v => v.toArray().map(round);
const checks = [], observations = [];
async function view({ speed = 1, strict = false, reduced = false } = {}) {
  assert.equal(visibilityListeners.size, 0); assert.equal(resizeListeners.size, 0);
  clock = 1000; hidden = false; nextFrame = 0; frames = new Map(); renderers = []; observers = []; media = new Map(); environments = [];
  window.matchMedia('(prefers-reduced-motion: reduce)').matches = reduced;
  const Galaxy = sourceLoader()('components/planet/GalaxyCanvas.tsx').default;
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  let people = [owner, friend], selected;
  const render = async () => { await act(async () => root.render(strict ? React.createElement(React.StrictMode, null,
    React.createElement(Galaxy, { guins: people, speedScale: speed, selectedPersonId: selected })) :
    React.createElement(Galaxy, { guins: people, speedScale: speed, selectedPersonId: selected }))); };
  await render();
  const renderer = renderers.at(-1);
  const frame = async delta => {
    clock += delta;
    const pending = [...frames.entries()]; assert.equal(pending.length, 1, 'exactly one animation callback'); frames.clear();
    await act(async () => pending[0][1](clock));
  };
  const visibility = async (state, elapsed = 0) => {
    clock += elapsed; hidden = state; await act(async () => document.dispatchEvent(new window.Event('visibilitychange')));
  };
  const button = text => [...container.querySelectorAll('button')].find(button => button.textContent === text);
  const click = async text => { assert(button(text), 'button ' + text); await act(async () => button(text).click()); };
  const snapshot = () => {
    const galaxy = renderer.scene.children.find(object => object.isGroup);
    const planets = galaxy.children.filter(object => object.isGroup && object.children[0]?.isMesh);
    const lines = galaxy.children.filter(object => object.isLine && !object.isLineLoop);
    return {
      spiral: round(galaxy.children[0].rotation.y), camera: vector(renderer.camera.position),
      planets: planets.map(group => ({ position: vector(group.position), spin: round(group.children[0].rotation.y),
        surfaceTime: round(group.children[0].material.userData.livingSurface.time.value),
        belt: round(group.children.find(object => object.isPoints).rotation.y),
        satellite: round(group.children.find(object => object.isGroup).rotation.y),
        satelliteSpin: round(group.children.find(object => object.isGroup).children[0].rotation.y) })),
      lines: lines.map(line => [...line.geometry.attributes.position.array].map(round)),
      pulses: galaxy.children.filter(object => object.isMesh).map(object => vector(object.position)),
    };
  };
  const close = async () => { await act(async () => root.unmount()); container.remove(); };
  return { frame, visibility, snapshot, click, close, renderer, button, renderers, observers, environments,
    nodes: () => lastNodes,
    async arrive() { people = [...people, incoming]; await render(); },
    async track() { selected = friend.id; await render(); },
    async setSpeed(value) { speed = value; await render(); },
  };
}
async function run(name, task) {
  console.log('RUN ' + name);
  try { await task(); checks.push({ name, status: 'PASS' }); }
  catch (error) { console.log(error.stack); checks.push({ name, status: 'FAIL', error: error.stack }); }
}
async function compareGap({ gap = 300000, hiddenFrames = 0, speed = 1, pause = false, landing = false, tracking = false }) {
  const options = { speed };
  async function runSequence(background) {
    const v = await view(options);
    try {
      for (let i = 0; i < 6; i++) await v.frame(16);
      if (tracking) await v.track();
      if (landing) await v.arrive();
      if (pause) await v.click('움직임 멈춤');
      const before = v.snapshot(), renders = v.renderer.renders;
      if (background) {
        await v.visibility(true);
        if (hiddenFrames) for (let i = 0; i < hiddenFrames; i++) await v.frame(gap / hiddenFrames);
        else clock += gap;
        assert.deepEqual(v.snapshot(), before, 'hidden callbacks do not update scene');
        assert.equal(v.renderer.renders, renders, 'hidden callbacks do not render');
        await v.visibility(false);
      }
      await v.frame(16);
      const first = v.snapshot();
      for (let i = 0; i < 5; i++) await v.frame(16);
      const after = v.snapshot();
      if (pause) assert(v.button('움직임 재생'), 'explicit user pause remains enabled');
      return { first, after };
    } finally { await v.close(); }
  }
  const control = await runSequence(false), resumed = await runSequence(true);
  assert.deepEqual(resumed, control, 'visible resumed frames must match uninterrupted frames, including actual orbit, pulses and camera');
  observations.push({ scenario: { gap, hiddenFrames, speed, pause, landing, tracking }, firstFrameMatchesControl: true, subsequentFramesMatchControl: true });
}
for (const gap of [1000, 300000, 86400000]) await run('hidden gap ' + gap + 'ms matches foreground control', () => compareGap({ gap }));
for (const options of [{ hiddenFrames: 3 }, { speed: 3 }, { pause: true }, { pause: true, hiddenFrames: 3 },
  { landing: true }, { landing: true, pause: true }, { tracking: true }]) {
  await run('resume ' + JSON.stringify(options), () => compareGap(options));
}
await run('visible rAF stall is capped to 50ms', async () => {
  async function snapshot(delta) {
    const v = await view(); try { await v.frame(16); await v.frame(delta); return v.snapshot(); } finally { await v.close(); }
  }
  assert.deepEqual(await snapshot(300000), await snapshot(50));
});
await run('foreground speed and shader time use ordinary elapsed seconds', async () => {
  const v = await view();
  try {
    for (const delta of [10, 16, 24, 50]) await v.frame(delta);
    const state = v.snapshot();
    assert.equal(state.spiral, .0026); assert.equal(state.planets[0].spin, .016);
    assert.equal(state.planets[0].surfaceTime, .1); assert.equal(state.planets[0].belt, .0075);
    assert.equal(state.planets[0].satellite, .032); assert.equal(state.planets[0].satelliteSpin, .021);
    await v.setSpeed(3); await v.frame(16);
    assert.equal(v.snapshot().planets[0].surfaceTime, .148);
    await v.setSpeed(0); const stopped = v.snapshot().planets[0]; await v.frame(16);
    assert.equal(v.snapshot().planets[0].surfaceTime, stopped.surfaceTime);
  } finally { await v.close(); }
});
await run('user pause time survives visibility and advances only after explicit play', async () => {
  const v = await view();
  try {
    await v.frame(16); await v.click('움직임 멈춤'); const paused = v.snapshot();
    await v.visibility(true); clock += 86400000; await v.visibility(false);
    for (let i = 0; i < 3; i++) await v.frame(16);
    const after = v.snapshot();
    assert.equal(after.spiral, paused.spiral); assert.equal(after.planets[0].surfaceTime, paused.planets[0].surfaceTime);
    assert.equal(after.planets[0].spin, paused.planets[0].spin); assert(v.button('움직임 재생'));
    await v.click('움직임 재생'); await v.frame(16);
    assert(v.snapshot().planets[0].surfaceTime > after.planets[0].surfaceTime);
  } finally { await v.close(); }
});
await run('reduced-motion initialization and visibility preserve zero simulation time', async () => {
  const v = await view({ reduced: true });
  try { await v.frame(16); const before = v.snapshot(); await v.visibility(true); clock += 300000;
    await v.visibility(false); await v.frame(16); assert.deepEqual(v.snapshot(), before); assert(v.button('움직임 재생'));
  } finally { await v.close(); }
});
await run('repeated hide/show cycles keep a single rAF chain', async () => {
  const v = await view();
  try { for (let i = 0; i < 10; i++) { await v.visibility(true); clock += 300000; await v.visibility(false); await v.frame(16); }
    assert.equal(v.renderer.renders, 10); assert.equal(v.snapshot().planets[0].surfaceTime, .16);
  } finally { await v.close(); }
});
await run('resize paths and unmount disposal remain functional', async () => {
  const v = await view();
  await v.frame(16); dimensions = { width: 768, height: 512 };
  await act(async () => window.dispatchEvent(new window.Event('resize')));
  assert.deepEqual(v.renderer.sizes.at(-1), [768, 512]); assert.equal(v.renderer.camera.aspect, 1.5);
  dimensions = { width: 320, height: 480 }; v.observers.at(-1).callback();
  assert.deepEqual(v.renderer.sizes.at(-1), [320, 480]);
  const sizeCount = v.renderer.sizes.length; await v.close();
  assert.equal(frames.size, 0); assert.equal(v.renderer.disposals, 1); assert.equal(v.renderer.losses, 1);
  assert.equal(visibilityListeners.size, 0); assert.equal(resizeListeners.size, 0); assert.equal(v.environments[0].disposals, 1);
  assert(!v.observers.at(-1).active); assert.equal(window.matchMedia('(prefers-reduced-motion: reduce)').listeners.size, 0);
  await v.visibility(false); await act(async () => window.dispatchEvent(new window.Event('resize')));
  assert.equal(v.renderer.sizes.length, sizeCount); dimensions = { width: 390, height: 480 };
});
await run('Strict Mode discards its first loop and cleans both renderer generations once', async () => {
  const v = await view({ strict: true });
  assert.equal(v.renderers.length, 2); assert.equal(v.renderers[0].disposals, 1); assert.equal(frames.size, 1);
  await v.frame(16); await v.close();
  assert.equal(frames.size, 0); for (const renderer of v.renderers) { assert.equal(renderer.disposals, 1); assert.equal(renderer.losses, 1); }
  assert.equal(visibilityListeners.size, 0); assert.equal(resizeListeners.size, 0);
  for (const environment of v.environments) assert.equal(environment.disposals, 1);
});
// Separate diagnostic; this does not assert an unrelated baseline defect is fixed.
{
  const v = await view();
  try {
    const anchor = v.nodes()[1].worldPos, initial = anchor.clone();
    await v.frame(16); await v.frame(16); await v.click('움직임 멈춤');
    const before = v.snapshot().planets[1].position;
    await v.frame(16); const after = v.snapshot().planets[1].position;
    observations.push({ diagnostic: 'existing shared Vector3 anchor, independent of visibility',
      anchorObjectRetained: anchor === v.nodes()[1].worldPos, anchorMovedDistance: anchor.distanceTo(initial),
      pausedForegroundPositionChanged: JSON.stringify(before) !== JSON.stringify(after), before, after });
  } finally { await v.close(); }
}
const sourceHash = file => createHash('sha256').update(fs.readFileSync(path.join(checkout, file))).digest('hex');
const report = { basis: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: checkout, encoding: 'utf8' }).trim(),
  sourceHashes: Object.fromEntries(['components/planet/GalaxyCanvas.tsx', 'lib/planet/surface-math.ts', 'lib/planet/galaxy-helper.ts'].map(file => [file, sourceHash(file)])),
  method: 'real React component/source and Three CPU objects; synthetic clock/visibility; GPU/environment and Canvas2D boundary stubs',
  passed: checks.filter(c => c.status === 'PASS').length, failed: checks.filter(c => c.status === 'FAIL').length, checks, observations };
fs.writeFileSync(path.join(checkout, 'outputs/galaxy-resume/clock-results.json'), JSON.stringify(report, null, 2) + '\n');
for (const check of checks) console.log(check.status + ' ' + check.name + (check.error ? '\n' + check.error : ''));
console.log(JSON.stringify({ passed: report.passed, failed: report.failed, diagnostic: observations.at(-1) }));
dom.window.close();
process.exitCode = report.failed ? 1 : 0;
