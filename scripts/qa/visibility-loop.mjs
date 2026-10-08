import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';

// Removing the shared gate or scheduling a frame while offscreen must fail.
for (const name of ['ElementalSpiritCanvas', 'PlanetCanvas', 'GalaxyCanvas']) {
  const source = await fs.readFile(`components/planet/${name}.tsx`, 'utf8');
  assert(source.includes('createVisibilityLoop(container, animate)'), `${name} must use the shared visibility gate`);
}
const compiled = ts.transpileModule(await fs.readFile('lib/planet/visibility-loop.ts', 'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const { createVisibilityLoop } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const checks = [];
function environment({ hidden = false, observer = true, brokenObserver = false, brokenObserve = false } = {}) {
  let time = 100, id = 0, observerInstance;
  const frames = new Map(), listeners = new Set();
  const element = {};
  globalThis.performance = { now: () => time };
  globalThis.document = { hidden, addEventListener: (type, fn) => listeners.add(fn), removeEventListener: (type, fn) => listeners.delete(fn) };
  globalThis.requestAnimationFrame = callback => { const next = ++id; frames.set(next, callback); return next; };
  globalThis.cancelAnimationFrame = key => frames.delete(key);
  if (observer) globalThis.IntersectionObserver = class {
    constructor(callback) { if (brokenObserver) throw new Error('Synthetic observer unavailable'); this.callback = callback; observerInstance = this; }
    observe(target) { if (brokenObserve) throw new Error('Synthetic observe failure'); this.target = target; }
    disconnect() { this.disconnected = true; }
  }; else delete globalThis.IntersectionObserver;
  return {
    element, frames, listeners,
    tick(ms = 16) { time += ms; const due = [...frames.values()]; frames.clear(); due.forEach(callback => callback(time)); },
    advance(ms) { time += ms; },
    visible(value) { observerInstance.callback([{ target: element, isIntersecting: value }]); },
    hidden(value) { document.hidden = value; [...listeners].forEach(callback => callback()); },
    observer: () => observerInstance,
  };
}
{
 const e = environment(), calls = []; const stop = createVisibilityLoop(e.element, (now, previous) => calls.push(now - previous));
 assert.equal(e.frames.size, 0, 'Wait for the first viewport observation'); e.visible(false);
 for (let n = 0; n < 180; n++) e.tick(); assert.equal(calls.length, 0); assert.equal(e.frames.size, 0);
 e.visible(true); e.tick(); assert.equal(calls.length, 1); assert.equal(e.frames.size, 1); stop();
 checks.push('offscreen 180 ticks produce zero automatic callbacks; visibility resumes one loop');
}
{
 const e = environment(), calls = []; const stop = createVisibilityLoop(e.element, (now, previous) => calls.push(now - previous));
 e.visible(true); e.tick(); e.hidden(true); assert.equal(e.frames.size, 0); e.advance(160000); e.hidden(false); e.tick();
 assert.deepEqual(calls, [16, 16]); e.visible(false); e.advance(160000); e.visible(true); e.tick(); assert.deepEqual(calls, [16, 16, 16]); stop();
 checks.push('document and viewport suspension exclude 160-second hidden intervals from delta');
}
{
 const e = environment({ hidden: true }), calls = []; const stop = createVisibilityLoop(e.element, () => calls.push(1));
 e.visible(true); e.tick(); assert.equal(calls.length, 0); e.hidden(false); e.tick(); assert.equal(calls.length, 1); e.visible(false); e.hidden(true); e.hidden(false); e.tick(); assert.equal(calls.length, 1); stop();
 checks.push('initially hidden and offscreen states both gate scheduling');
}
{
 const e = environment(), calls = []; const stop = createVisibilityLoop(e.element, () => calls.push(1));
 e.visible(true); const stale = [...e.frames.values()][0]; e.visible(false); e.visible(true); stale(1000);
 assert.equal(calls.length, 0); assert.equal(e.frames.size, 1); e.tick(); assert.equal(calls.length, 1); stop(); stale(2000); assert.equal(calls.length, 1);
 checks.push('canceled stale callbacks cannot render or create duplicate loops');
}
{
 const e = environment(), calls = []; const stop = createVisibilityLoop(e.element, () => calls.push(1));
 e.visible(true); e.visible(true); e.hidden(false); assert.equal(e.frames.size, 1); stop(); stop();
 assert.equal(e.frames.size, 0); assert.equal(e.listeners.size, 0); assert(e.observer().disconnected); e.visible(true); assert.equal(e.frames.size, 0);
 checks.push('repeated visibility events and idempotent disposal leave no frame or listener');
}
{
 for (const options of [{observer:false}, {brokenObserver:true}, {brokenObserve:true}]) { const e = environment(options), calls = []; const stop = createVisibilityLoop(e.element, () => calls.push(1)); e.tick(); assert.equal(calls.length, 1); e.hidden(true); e.tick(); assert.equal(calls.length, 1); stop(); }
 checks.push('missing or unavailable IntersectionObserver falls back to document visibility');
}
{
 const e = environment(), oldCalls = [], freshCalls = []; const stop = createVisibilityLoop(e.element, () => oldCalls.push(1)); e.visible(true); const stale = [...e.frames.values()][0]; const oldObserver=e.observer(); stop();
 const stopFresh = createVisibilityLoop(e.element, () => freshCalls.push(1)); e.visible(true); oldObserver.callback([{target:e.element,isIntersecting:true}]); stale(1000); e.tick();
 assert.equal(oldCalls.length, 0); assert.equal(freshCalls.length, 1); assert.equal(e.frames.size, 1); stopFresh();
 checks.push('remounts are isolated from disposed observer and animation callbacks');
}
{
 const e = environment(); let count = 0, stop; stop = createVisibilityLoop(e.element, () => { count++; stop(); }); e.visible(true); e.tick(); assert.equal(count, 1); assert.equal(e.frames.size, 0);
 checks.push('disposal from a callback cannot resurrect the loop');
}
const result = { status:'PASS', checks, limits:['Synthetic browser scheduling boundaries; no WebGL or real-browser QA', 'Motion preferences remain in the three original animation bodies'] };
await fs.mkdir('outputs/visibility-loop', {recursive:true}); await fs.writeFile('outputs/visibility-loop/results.json', JSON.stringify(result,null,2)); console.log(JSON.stringify(result,null,2));
