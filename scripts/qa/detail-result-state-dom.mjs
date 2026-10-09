// Complements saved-archive-dom.mjs with delayed-body, same-ID and real-card lifecycle checks.
// All requests are deferred synthetic fixtures. Product files are only read, never mutated.
import fs from 'node:fs/promises';
import path from 'node:path';
import Module, { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import ts from 'typescript';
import React, { act } from 'react';
import { createHash } from 'node:crypto';
import { root, output, fullReading as full } from './detail-result-fixtures.mjs';
const require = createRequire(import.meta.url);
await fs.mkdir(output, { recursive: true });
const pagePath = path.join(root, 'app/saved/page.tsx');
const sourceHash = async () => createHash('sha256').update(await fs.readFile(pagePath)).digest('hex');
const beforeHash = await sourceHash();
const { JSDOM } = await import(pathToFileURL(process.env.SAJU_QA_JSDOM_PATH || path.join(root, '.sites-runtime/test-tools/node_modules/jsdom/lib/api.js')).href);
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://local.test/saved' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
const { createRoot } = await import('react-dom/client');
const reactErrors = [], unhandled = [], logError = console.error;
console.error = (...args) => { reactErrors.push(args.map(String).join(' ')); logError(...args); };
const onUnhandled = error => unhandled.push(String(error));
process.on('unhandledRejection', onUnhandled);
async function compile(file, overrides = {}) {
  const absolute = path.join(root, file);
  const code = ts.transpileModule(await fs.readFile(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = new Module(absolute); mod.filename = absolute; mod.paths = Module._nodeModulePaths(path.dirname(absolute));
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  mod._compile(code, absolute); return mod.exports;
}
const reader = await compile('lib/http-client.ts');
const card = await compile('components/FortuneCard.tsx', { './AskDoryeongModal': { __esModule: true, default: () => null } });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const checks = [], failures = [];
let harness;
async function createHarness() {
  if (harness) await harness.dispose();
  let search = '', renderer, active = false;
  const listeners = new Set(), requests = [];
  const navigation = { useRouter: () => ({ push: url => setRoute(new URL(url, 'http://local.test').search) }),
    useSearchParams: () => { const value = React.useSyncExternalStore(callback => { listeners.add(callback); return () => listeners.delete(callback); }, () => search); return new URLSearchParams(value); } };
  function setRoute(value) { search = value; for (const callback of listeners) callback(); }
  globalThis.fetch = (url, options = {}) => {
    assert(url === '/api/saju?view=summary' || /^\/api\/saju\/[ab]$/.test(url), 'Unexpected request: ' + url);
    const request = { url, signal: options.signal, ...deferred() };
    requests.push(request); return request.promise;
  };
  const Page = (await compile('app/saved/page.tsx', { 'next/navigation': navigation,
    'next/link': { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) },
    '@/components/Header': { __esModule: true, default: () => null }, '@/components/FortuneCard': card, '@/lib/http-client': reader })).default;
  const h = {
    requests,
    async mount(id = 'a', strict = false) { search = id ? '?id=' + encodeURIComponent(id) : ''; renderer = createRoot(document.getElementById('root')); active = true; await act(async () => renderer.render(strict ? React.createElement(React.StrictMode, null, React.createElement(Page)) : React.createElement(Page))); },
    async select(id) { await act(async () => setRoute(id ? '?id=' + encodeURIComponent(id) : '')); },
    request(id) { const matches = requests.filter(request => request.url === '/api/saju/' + encodeURIComponent(id)); assert(matches.length, 'missing request for ' + id); return matches.at(-1); },
    count(id) { return requests.filter(request => request.url === '/api/saju/' + encodeURIComponent(id)).length; },
    async answer(request, data, status = 200) { await act(async () => request.resolve(Response.json(data, { status }))); },
    async reject(request, error = new TypeError('synthetic network failure')) { await act(async () => request.reject(error)); },
    async beginBody(request, status = 200) { const body = deferred(); let read = false; await act(async () => request.resolve({ ok: status < 400, status, json: () => { read = true; return body.promise; } })); assert(read); return body; },
    async resolveBody(body, data) { await act(async () => body.resolve(data)); },
    async rejectBody(body) { await act(async () => body.reject(new SyntaxError('synthetic JSON parse failure'))); },
    async retry() { const button = [...document.querySelectorAll('button')].find(button => button.textContent === '다시 불러오기'); assert(button); await act(async () => button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))); },
    text: () => document.body.textContent,
    shown(id, version = 'current') { assert([...document.querySelectorAll('h2')].some(heading => heading.textContent === `reading-${id}-${version}`), 'missing current reading ' + id + '-' + version); assert(this.text().includes(`person-${id}-${version}님의 사주팔자`)); },
    hidden(id) { assert(![...document.querySelectorAll('h2')].some(heading => heading.textContent?.startsWith(`reading-${id}-`)), 'stale previous reading visible: ' + id); },
    pending() { assert(document.querySelector('[role="status"]')?.textContent.includes('선택한 기록을 불러오고 있어요.'), 'pending selection must show loading'); assert.equal(document.querySelector('[role="alert"]'), null, 'old error visible during fresh request'); assert(![...document.querySelectorAll('h2')].some(heading => heading.textContent?.startsWith('reading-')), 'previous reading visible during current pending request'); },
    error(message) { assert(document.querySelector('[role="alert"]')?.textContent.includes(message), 'missing current error: ' + message); assert.equal(document.querySelector('[role="status"]'), null); assert(![...document.querySelectorAll('h2')].some(heading => heading.textContent?.startsWith('reading-')), 'previous reading visible during current failure'); },
    async dispose() { if (active) { await act(async () => renderer.unmount()); active = false; } },
  };
  harness = h; return h;
}
const cases = [
  ['loaded A is hidden during B pending, HTTP failure and retry', async h => {
    await h.mount(); await h.answer(h.request('a'), { fortune: full('a') }); h.shown('a');
    await h.select('b'); h.pending(); h.hidden('a');
    await h.answer(h.request('b'), { error: 'B HTTP failure' }, 503); h.error('B HTTP failure'); h.hidden('a');
    await h.retry(); h.pending(); await h.answer(h.request('b'), { fortune: full('b') }); h.shown('b'); h.hidden('a');
  }],

  ['A to B to A ignores the first same-ID response while the fresh A is pending', async h => {
    await h.mount(); const oldA = h.request('a'); await h.select('b'); const oldB = h.request('b'); await h.select('a'); const newA = h.request('a');
    assert(oldA.signal.aborted && oldB.signal.aborted); assert.notEqual(oldA, newA); h.pending();
    await h.answer(oldA, { fortune: full('a', 'old') }); h.pending();
    await h.answer(newA, { fortune: full('a', 'new') }); h.shown('a', 'new');
    await h.reject(oldB); h.shown('a', 'new'); assert.equal(document.querySelector('[role="alert"]'), null);
  }],
  ['late previous network failure cannot end B loading or overwrite B error', async h => {
    await h.mount(); const oldA = h.request('a'); await h.select('b'); h.pending(); await h.reject(oldA); h.pending();
    await h.answer(h.request('b'), { error: 'current B error' }, 404); h.error('current B error'); assert(!h.text().includes('synthetic network failure'));
  }],
  ['late response.json success after route change is discarded', async h => {
    await h.mount(); const oldA = h.request('a'); const body = await h.beginBody(oldA); await h.select('b'); assert(oldA.signal.aborted);
    await h.answer(h.request('b'), { fortune: full('b') }); await h.resolveBody(body, { fortune: full('a', 'old') }); h.shown('b'); h.hidden('a');
    await h.select('a'); assert.equal(h.count('a'), 2); h.pending();
  }],
  ['late response.json failure cannot display an old error over B', async h => {
    await h.mount(); const oldA = h.request('a'); const body = await h.beginBody(oldA); await h.select('b'); await h.rejectBody(body); h.pending();
    await h.answer(h.request('b'), { fortune: full('b') }); h.shown('b'); assert.equal(document.querySelector('[role="alert"]'), null);
  }],
  ['revisiting failed A after another target clears its old error before the fresh request', async h => {
    await h.mount(); await h.answer(h.request('a'), { error: 'old A error' }, 500); h.error('old A error');
    await h.select('b'); h.pending(); const oldB = h.request('b'); await h.select('a'); h.pending(); assert.equal(h.count('a'), 2);
    await h.reject(oldB); h.pending(); await h.answer(h.request('a'), { fortune: full('a') }); h.shown('a');
  }],

  ['current malformed JSON and response-shape failures stay retryable without previous A', async h => {
    await h.mount(); await h.answer(h.request('a'), { fortune: full('a') }); await h.select('b');
    const body = await h.beginBody(h.request('b')); await h.rejectBody(body); h.error('synthetic JSON parse failure'); h.hidden('a');
    await h.retry(); h.pending(); await h.answer(h.request('b'), null); h.error('서버 응답 형식을 확인할 수 없습니다.');
    await h.retry(); h.pending(); await h.answer(h.request('b'), { fortune: full('b') }); h.shown('b');
  }],

  ['unmount aborts pending details and ignores late body success and failure', async h => {
    await h.mount(); const pending = h.request('a'), body = await h.beginBody(pending); await h.dispose(); assert(pending.signal.aborted);
    await h.resolveBody(body, { fortune: full('a') }); assert.equal(document.getElementById('root').textContent, '');
    h = await createHarness(); await h.mount(); const second = h.request('a'); await h.dispose(); assert(second.signal.aborted); await h.reject(second); assert.equal(document.getElementById('root').textContent, '');
  }],
  ['Strict Mode discarded mount cannot finish the active detail request', async h => {
    await h.mount('a', true); const attempts = h.requests.filter(request => request.url === '/api/saju/a'); assert.equal(attempts.length, 2); assert(attempts[0].signal.aborted); assert(!attempts[1].signal.aborted);
    await h.answer(attempts[0], { fortune: full('a', 'discarded') }); h.pending();
    await h.answer(attempts[1], { error: 'active A error' }, 404); h.error('active A error');
    await h.retry(); h.pending(); await h.answer(h.request('a'), { fortune: full('a') }); h.shown('a');
  }],
];
try {
  for (const [name, run] of cases) {
    try { const h = await createHarness(); await run(h); checks.push(name); console.log('PASS: ' + name); }
    catch (error) { failures.push({ name, error: error.stack || String(error), text: document.body.textContent?.slice(0, 1600) }); console.error('FAIL: ' + name, error); }
  }
  await harness?.dispose(); await act(async () => {});
  assert.deepEqual(reactErrors, []); assert.deepEqual(unhandled, []);
  assert.equal(await sourceHash(), beforeHash, 'Product source must remain unchanged');
} catch (error) { failures.push({ name: 'harness', error: error.stack || String(error) }); }
finally {
  await harness?.dispose(); console.error = logError;
  process.removeListener('unhandledRejection', onUnhandled); dom.window.close();
  const report = { status: failures.length ? 'FAIL' : 'PASS', scope: 'Existing saved reading detail GET selection lifecycle, not archive-list/map/chat/daily changes', sourceSha256: beforeHash, sourceUnchanged: await sourceHash() === beforeHash, checks, failures, reactErrors, unhandled,
    limits: ['Real SavedPage, FortuneCard, response reader and pinned calculation code in JSDOM', 'Header and chat UI excluded; API/router boundaries deliberately deferred and synthetic', 'No source mutations or live requests', 'No production data, auth, external calls, browser visuals or physical-device checks'] };
  await fs.writeFile(path.join(output, 'dom-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, checks: checks.length, failures: failures.length }));
  if (failures.length) process.exitCode = 1;
}
