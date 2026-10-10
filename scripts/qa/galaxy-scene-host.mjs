// Executes the unchanged React animation closure, actual Three vectors, node builder,
// materials and disposal. Only GPU/environment, Canvas2D drawing and host time are stubs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Module, { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
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
async function view({ speed = 1, strict = false, reduced = false, initialPeople = [owner, friend], distance = 1 } = {}) {
  assert.equal(visibilityListeners.size, 0); assert.equal(resizeListeners.size, 0);
  clock = 1000; hidden = false; nextFrame = 0; frames = new Map(); renderers = []; observers = []; media = new Map(); environments = [];
  window.matchMedia('(prefers-reduced-motion: reduce)').matches = reduced;
  const Galaxy = sourceLoader()('components/planet/GalaxyCanvas.tsx').default;
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  let people = initialPeople, selected;
  const render = async () => { await act(async () => root.render(strict ? React.createElement(React.StrictMode, null,
    React.createElement(Galaxy, { guins: people, speedScale: speed, selectedPersonId: selected, distanceScale: distance })) :
    React.createElement(Galaxy, { guins: people, speedScale: speed, selectedPersonId: selected, distanceScale: distance }))); };
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
    async advance(count, delta, onFrame = () => {}) {
      const start = clock;
      await act(async () => {
        for (let i = 0; i < count; i++) {
          clock = start + (i + 1) * delta;
          const pending = [...frames.values()];
          assert.equal(pending.length, 1, "one animation callback"); frames.clear();
          pending[0](clock); onFrame(i + 1);
        }
      });
    },
    groups() { return renderer.scene.children.find(object => object.isGroup).children.filter(object => object.isGroup && object.children[0]?.isMesh); },
    nodes: () => lastNodes,
    async arrive() { people = [...people, incoming]; await render(); },
    async track() { selected = friend.id; await render(); },
    async setSpeed(value) { speed = value; await render(); },
  };
}

export { view, owner, friend, incoming, dom };
