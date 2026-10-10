// Actual modal/React; fetch deliberately ignores abort to test late-response guards.
import fs from 'node:fs/promises';
import path from 'node:path';
import Module, { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import ts from 'typescript';
import React, { act } from 'react';
const root = process.cwd(), phase = process.env.SAJU_QA_PHASE || 'after';
assert(['before', 'after'].includes(phase));
const output = path.join(root, 'outputs/input-request', phase); await fs.mkdir(output, { recursive: true });
const { JSDOM } = await import(pathToFileURL(process.env.SAJU_QA_JSDOM_PATH).href);
const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://local.test/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
const { createRoot } = await import('react-dom/client');
const require = createRequire(import.meta.url), { createLoader } = require('./load-ts.cjs');
async function compile(file, overrides = {}) {
  const absolute = path.join(root, file), code = ts.transpileModule(await fs.readFile(absolute, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const m = new Module(absolute); m.filename = absolute; m.paths = Module._nodeModulePaths(path.dirname(absolute));
  m.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name); m._compile(code, absolute); return m.exports;
}
const Modal = (await compile('components/SajuInputModal.tsx', {
  '@/lib/http-client': await compile('lib/http-client.ts'), '@/lib/saju/input': createLoader().load('lib/saju/input.ts'),
})).default;
const originalFetch = globalThis.fetch, originalAlert = globalThis.alert;
const originalTimeout = globalThis.setTimeout, originalClear = globalThis.clearTimeout;
const checks = [], observations = [];
async function view(strict = false) {
  const requests = [], alerts = [], results = [], timers = new Map(); let mounted = true, closes = 0;
  globalThis.fetch = (url, options) => {
    assert.equal(url, '/api/saju'); assert.equal(options.method, 'POST');
    return new Promise((resolve, reject) => requests.push({ options, resolve, reject }));
  };
  globalThis.alert = message => alerts.push(message);
  globalThis.setTimeout = (callback, delay, ...args) => {
    if (delay !== 900) return originalTimeout(callback, delay, ...args);
    const id = {}; timers.set(id, () => callback(...args)); return id;
  };
  globalThis.clearTimeout = id => { if (!timers.delete(id)) originalClear(id); };
  const container = document.createElement('div'); document.body.append(container); const renderer = createRoot(container);
  let open = true, category = 'overall';
  const draw = () => {
    const element = React.createElement(Modal, { isOpen: open, category,
      onClose: () => { closes++; open = false; draw(); }, onSuccess: f => results.push(f.id) });
    renderer.render(strict ? React.createElement(React.StrictMode, null, element) : element);
  };
  await act(async () => draw());
  const input = () => container.querySelector('input[placeholder="예: 홍길동"]');
  const name = async text => act(async () => {
    assert(input(), 'The input must be available');
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input(), text);
    input().dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  const send = async () => {
    const before = requests.length; await act(async () => {
      assert(container.querySelector('form'), 'The reopened modal must show the editable form');
      container.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    }); assert.equal(requests.length, before + 1); return requests.at(-1);
  };
  const close = () => act(async () => window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  const reopen = next => act(async () => { open = true; category = next; draw(); });
  const reply = (request, data, status = 200) => act(async () => request.resolve(Response.json(data, { status })));
  const unmount = async () => { if (mounted) { await act(async () => renderer.unmount()); mounted = false; } };
  return { requests, alerts, results, timers, name, send, close, reopen, reply, unmount,
    input, text: () => container.textContent, closes: () => closes,
    dispose: async () => { await unmount(); timers.clear(); container.remove();
      globalThis.fetch = originalFetch; globalThis.alert = originalAlert; globalThis.setTimeout = originalTimeout; globalThis.clearTimeout = originalClear; } };
}
async function check(name, run, strict = false) {
  const v = await view(strict); console.log('RUN ' + name);
  try { await run(v); checks.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
  catch (e) { checks.push({ name, status: 'FAIL', error: e.message }); console.error(e.message); }
  finally { observations.push({ name, alerts: [...v.alerts], results: [...v.results], closes: v.closes(), pendingTimers: v.timers.size,
    requests: v.requests.map(r => ({ aborted: !!r.options.signal?.aborted, category: JSON.parse(r.options.body).category })) }); await v.dispose(); }
}
const success = id => ({ success: true, fortune: { id } });
try {
  await check('Escape releases the pending request and progress timer', async v => {
    await v.name('합성 취소'); const request = await v.send(); await v.close();
    assert(request.options.signal?.aborted); assert.equal(v.timers.size, 0);
  });
  await check('reopening preserves the draft and shows an editable form', async v => {
    await v.name('합성 초안'); await v.send(); await v.close(); await v.reopen('love');
    assert(v.input()); assert.equal(v.input().value, '합성 초안');
  });
  await check('late failed replies after close have no alert', async v => {
    await v.name('합성 실패'); const request = await v.send(); await v.close();
    await v.reply(request, { error: '합성 늦은 오류' }, 503); assert.deepEqual(v.alerts, []);
  });
  await check('late success after close has no result or second close callback', async v => {
    await v.name('합성 성공'); const request = await v.send(); await v.close();
    await v.reply(request, success('stale')); assert.deepEqual(v.results, []); assert.equal(v.closes(), 1);
  });
  await check('a superseded reply cannot finish the current loading state', async v => {
    await v.name('합성 새 요청'); const old = await v.send(); await v.close(); await v.reopen('love');
    const current = await v.send(); await v.reply(old, { error: '합성 오래된 오류' }, 503);
    assert.equal(v.input(), null); assert(v.text().includes('사주 4주와 오행')); assert.deepEqual(v.alerts, []);
    await v.reply(current, success('current')); assert.deepEqual(v.results, ['current']);
  });
  await check('active failure restores the draft and allows manual successful retry', async v => {
    await v.name('합성 재시도'); await v.reply(await v.send(), { error: '합성 현재 오류' }, 503);
    assert.deepEqual(v.alerts, ['합성 현재 오류']); assert.equal(v.input().value, '합성 재시도');
    await v.reply(await v.send(), success('retry')); assert.deepEqual(v.results, ['retry']); assert.equal(v.timers.size, 0);
  });
  await check('unmount cancels work and ignores an abort-insensitive late rejection', async v => {
    await v.name('합성 떠난 화면'); const request = await v.send(); await v.unmount();
    await act(async () => request.reject(new Error('synthetic network failure')));
    assert(request.options.signal?.aborted); assert.equal(v.timers.size, 0); assert.deepEqual(v.alerts, []);
  });
  await check('Strict Mode preserves cancellation and a fresh reopen', async v => {
    await v.name('합성 엄격 모드'); const request = await v.send(); await v.close(); await v.reopen('love');
    await v.reply(request, success('discarded')); assert.deepEqual(v.results, []); assert(v.input()); assert.equal(v.timers.size, 0);
  }, true);
} finally {
  const r = { basis: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), phase,
    applicationSourceSHA256: createHash('sha256').update(await fs.readFile('components/SajuInputModal.tsx')).digest('hex'),
    passed: checks.filter(c => c.status === 'PASS').length, failed: checks.filter(c => c.status === 'FAIL').length,
    checks, observations, limits: ['Actual React modal and response reader; progress time and HTTP replies are controlled.',
      'Transport intentionally ignores abort. Callback suppression is tested separately from native browser abort. No server write executes.'] };
  await fs.writeFile(path.join(output, 'dom-results.json'), JSON.stringify(r, null, 2) + '\n');
  dom.window.close(); console.log(JSON.stringify({ passed: r.passed, failed: r.failed })); process.exitCode = r.failed ? 1 : 0;
}
