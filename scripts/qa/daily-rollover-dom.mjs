// Real DailyPage and offline pillar calculation; synthetic browser clock only.
// SAJU_QA_JSDOM_PATH=/path/to/jsdom/lib/api.js node scripts/qa/daily-rollover-dom.mjs
import fs from 'node:fs';
import path from 'node:path';
import Module, { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import React, { act } from 'react';
import { renderToString } from 'react-dom/server';

const checkout = process.cwd();
const { JSDOM } = await import(pathToFileURL(process.env.SAJU_QA_JSDOM_PATH || path.join(checkout, '.sites-runtime/test-tools/node_modules/jsdom/lib/api.js')).href);
const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://local.test/daily', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
const { createRoot, hydrateRoot } = await import('react-dom/client');
const require = createRequire(import.meta.url);
globalThis.fetch = () => { throw new Error('Daily clock QA must make no network requests'); };

function loadPage() {
  const cache = new Map();
  function load(file) {
    const absolute = path.resolve(checkout, file);
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const mod = new Module(absolute);
    mod.filename = absolute;
    mod.paths = Module._nodeModulePaths(path.dirname(absolute));
    cache.set(absolute, mod);
    mod.require = specifier => {
      if (specifier === '@/components/Header') return { __esModule: true, default: () => null };
      const local = specifier.startsWith('@/') ? path.join(checkout, specifier.slice(2)) : specifier.startsWith('.') ? path.resolve(path.dirname(absolute), specifier) : null;
      if (local) {
        const resolved = [local, local + '.ts', local + '.tsx'].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
        assert(resolved, 'Missing local dependency ' + specifier);
        return load(resolved);
      }
      return require(specifier);
    };
    const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
    mod._compile(code, absolute);
    return mod.exports;
  }
  return load('app/daily/page.tsx').default;
}

async function createView(t, start, { strict = false, hydrate = false } = {}) {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: start.getTime() });
  const activeTimers = new Set();
  const schedule = globalThis.setTimeout;
  const cancel = globalThis.clearTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback, delay, ...args) => {
    const id = schedule(() => { activeTimers.delete(id); callback(...args); }, delay);
    activeTimers.add(id);
    return id;
  });
  t.mock.method(globalThis, 'clearTimeout', id => { activeTimers.delete(id); return cancel(id); });
  const Page = loadPage();
  const container = document.createElement('div');
  document.body.append(container);
  const page = React.createElement(Page);
  const content = strict ? React.createElement(React.StrictMode, null, page) : page;
  const errors = [];
  let renderer;
  let mounted = true;
  if (hydrate) {
    const html = renderToString(page);
    assert(html.includes('오늘의 해석'));
    container.innerHTML = html;
    await act(async () => { renderer = hydrateRoot(container, page, { onRecoverableError: error => errors.push(error.message) }); });
  } else {
    renderer = createRoot(container);
    await act(async () => renderer.render(content));
  }
  const unmount = async () => {
    if (mounted) { await act(async () => renderer.unmount()); mounted = false; }
  };
  t.after(async () => { await unmount(); container.remove(); });
  return {
    heading: () => container.querySelector('h2')?.textContent,
    pillar: () => container.querySelector('strong')?.textContent,
    advance: async ms => act(async () => t.mock.timers.tick(ms)),
    jump: ms => t.mock.timers.setTime(ms),
    event: async (target, name) => act(async () => target.dispatchEvent(new dom.window.Event(name))),
    unmount, activeTimers, errors,
  };
}

test('an open daily page updates its date and pillar at local midnight', async t => {
  const view = await createView(t, new Date(2026, 9, 9, 23, 59, 59, 900));
  assert.equal(view.heading(), '2026년 10월 9일 운세');
  const before = view.pillar();
  await view.advance(99);
  assert.equal(view.heading(), '2026년 10월 9일 운세');
  await view.advance(1);
  console.log(JSON.stringify({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, case: 'local midnight', heading: view.heading(), pillarBefore: before, pillarAfter: view.pillar() }));
  assert.equal(view.heading(), '2026년 10월 10일 운세');
  assert.notEqual(view.pillar(), before, 'The pillar must follow the same local day as the heading');
});

test('returning to a suspended tab refreshes a date missed while timers were paused', async t => {
  const view = await createView(t, new Date(2026, 9, 9, 12));
  view.jump(new Date(2026, 9, 12, 9).getTime());
  await view.event(document, 'visibilitychange');
  assert.equal(view.heading(), '2026년 10월 12일 운세');
});

test('window focus refreshes the date after a clock jump', async t => {
  const view = await createView(t, new Date(2026, 9, 9, 12));
  view.jump(new Date(2026, 9, 11, 9).getTime());
  await view.event(window, 'focus');
  assert.equal(view.heading(), '2026년 10월 11일 운세');
});

test('server placeholder hydrates to the local date without recoverable mismatch', async t => {
  const view = await createView(t, new Date(2026, 9, 9, 12), { hydrate: true });
  assert.equal(view.heading(), '2026년 10월 9일 운세');
  assert.deepEqual(view.errors, []);
});

test('Strict Mode cleanup retains one clock and handles a year boundary', async t => {
  const view = await createView(t, new Date(2026, 11, 31, 23, 59, 59, 900), { strict: true });
  await view.advance(100);
  assert.equal(view.heading(), '2027년 1월 1일 운세');
  assert.equal(view.activeTimers.size, 1, 'Strict Mode must leave only one next-day timer');
});

test('unmount clears scheduled work and tab-return listeners', async t => {
  const addedDocument = t.mock.method(document, 'addEventListener');
  const removedDocument = t.mock.method(document, 'removeEventListener');
  const addedWindow = t.mock.method(window, 'addEventListener');
  const removedWindow = t.mock.method(window, 'removeEventListener');
  const view = await createView(t, new Date(2026, 9, 9, 12));
  await view.unmount();
  assert.equal(view.activeTimers.size, 0);
  for (const [added, removed, name] of [[addedDocument, removedDocument, 'visibilitychange'], [addedWindow, removedWindow, 'focus']]) {
    for (const call of added.mock.calls.filter(call => call.arguments[0] === name)) {
      assert(removed.mock.calls.some(removal => removal.arguments[0] === name && removal.arguments[1] === call.arguments[1]), name + ' handler leaked');
    }
  }
});

for (const [month, day, label] of [[2, 8, 'spring'], [10, 1, 'autumn']]) {
  test('local calendar day length governs the ' + label + ' rollover', async t => {
    const start = new Date(2026, month, day);
    const next = new Date(2026, month, day + 1);
    const view = await createView(t, start);
    const elapsed = next.getTime() - start.getTime();
    await view.advance(elapsed - 1);
    assert.equal(view.heading(), `2026년 ${month + 1}월 ${day}일 운세`);
    await view.advance(1);
    console.log(JSON.stringify({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, case: label + ' day length', hours: elapsed / 3600000, heading: view.heading() }));
    assert.equal(view.heading(), `2026년 ${month + 1}월 ${day + 1}일 운세`);
  });
}
