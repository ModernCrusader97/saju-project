// Real SavedPage and built summary API, with synthetic data in fresh memory D1.
// Run after npm run build; set SAJU_QA_JSDOM_PATH to jsdom/lib/api.js.
import fs from 'node:fs/promises';
import path from 'node:path';
import Module, { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';
import { Miniflare } from 'miniflare';
import ts from 'typescript';
import React, { act } from 'react';

const root = process.cwd();
const { JSDOM } = await import(pathToFileURL(process.env.SAJU_QA_JSDOM_PATH || path.join(root, '.sites-runtime/test-tools/node_modules/jsdom/lib/api.js')).href);
const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://local.test/saved' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
const { createRoot } = await import('react-dom/client');
const require = createRequire(import.meta.url);
const owner = { 'oai-authenticated-user-id': 'saved-response-fixture', 'oai-authenticated-user-email': 'saved-response@example.invalid' };

async function walk(directory) {
  const files = [];
  for (const item of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) files.push(...await walk(file));
    else if (/\.m?js$/.test(file)) files.push(file);
  }
  return files;
}
const entry = path.join(root, 'dist/server/index.js');
const modules = [entry, ...(await walk(path.join(root, 'dist/server'))).filter(file => file !== entry)].map(file => ({ type: 'ESModule', path: file }));

async function fixture(t) {
  const outbound = [];
  const mf = new Miniflare({
    rootPath: root, modules, modulesRoot: 'dist/server', compatibilityDate: '2026-05-15',
    compatibilityFlags: ['nodejs_compat'], host: '127.0.0.1', port: 0, cf: false,
    logRequests: false, telemetry: { enabled: false }, d1Databases: { DB: 'saved-response-synthetic' },
    d1Persist: false, assets: { directory: 'dist/client', routerConfig: { has_user_worker: true } },
    outboundService: async request => { outbound.push(new URL(request.url).hostname); return new Response('External requests forbidden', { status: 502 }); },
  });
  t.after(async () => { await mf.dispose(); assert.deepEqual(outbound, []); });
  const db = await mf.getD1Database('DB');
  for (const file of (await fs.readdir('drizzle')).filter(name => name.endsWith('.sql')).sort()) {
    for (const sql of (await fs.readFile('drizzle/' + file, 'utf8')).split('--> statement-breakpoint')) if (sql.trim()) await db.prepare(sql.trim()).run();
  }
  const request = async (url, body) => {
    const response = await mf.dispatchFetch('http://preview.test' + url, {
      headers: { ...owner, ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json() };
  };
  const created = await request('/api/saju', { name: '합성 기록', gender: 'male', birthYear: 2000, birthMonth: 1, birthDay: 1, birthHour: 12, birthMinute: 30, isUnknownTime: false, calendarType: 'solar' });
  assert.equal(created.status, 200);
  assert.equal(created.data.fortune.generation.mode, 'template');
  return { db, fortune: created.data.fortune, summary: () => request('/api/saju?view=summary') };
}

async function mount(t) {
  const requests = [], errors = [];
  globalThis.fetch = (url, options = {}) => new Promise((resolve, reject) => requests.push({ url, signal: options.signal, resolve, reject }));
  const navigation = { useRouter: () => ({ push() { throw new Error('List response tests must not navigate'); } }), useSearchParams: () => new URLSearchParams() };
  const cache = new Map();
  async function compile(file) {
    if (cache.has(file)) return cache.get(file);
    const absolute = path.join(root, file);
    const code = ts.transpileModule(await fs.readFile(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
    const mod = new Module(absolute);
    mod.filename = absolute; mod.paths = Module._nodeModulePaths(path.dirname(absolute));
    const overrides = {
      'next/navigation': navigation,
      'next/link': { __esModule: true, default: props => React.createElement('a', props) },
      '@/components/Header': { __esModule: true, default: () => null },
      '@/components/FortuneCard': { __esModule: true, default: () => null },
    };
    if (file === 'app/saved/page.tsx') {
      overrides['@/lib/http-client'] = await compile('lib/http-client.ts');
    }
    mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
    mod._compile(code, absolute); cache.set(file, mod.exports); return mod.exports;
  }
  const Page = (await compile('app/saved/page.tsx')).default;
  const container = document.createElement('div'); document.body.append(container);
  const renderer = createRoot(container, { onUncaughtError: error => errors.push(error.message) });
  await act(async () => renderer.render(React.createElement(Page)));
  t.after(async () => { await act(async () => renderer.unmount()); container.remove(); });
  const answer = async (data, status = 200) => act(async () => requests.at(-1).resolve(Response.json(data, { status })));
  const retry = async () => {
    const button = [...container.querySelectorAll('button')].find(el => el.textContent === '다시 불러오기');
    assert(button, 'A recoverable list failure must offer retry');
    await act(async () => button.click());
    assert(container.textContent.includes('불러오는 중'));
  };
  return {
    requests, errors, answer, retry, text: () => container.textContent,
    alert: () => container.querySelector('[role="alert"]')?.textContent,
    search: async value => {
      const input = container.querySelector('input[aria-label="저장한 기록 검색"]'); assert(input);
      await act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
    },
  };
}

function assertRecoverable(view, label, status) {
  console.log(JSON.stringify({ case: label, httpStatus: status, renderErrors: view.errors, alert: view.alert() || null, visibleText: view.text() }));
  assert.deepEqual(view.errors, [], 'A bad summary must not crash the entire saved page');
  assert(view.alert()?.includes('기록 목록을 확인할 수 없습니다.'));
  assert(!view.text().includes('아직 보관된 사주 풀이가 없습니다.'), 'Invalid response is not an empty archive');
}

test('a null name returned by the real summary API cannot crash archive search', async t => {
  const f = await fixture(t);
  await f.db.prepare("UPDATE fortunes SET data=json_set(data,'$.analysis.name',NULL) WHERE id=?").bind(f.fortune.id).run();
  const response = await f.summary(); assert.equal(response.status, 200); assert.equal(response.data.fortuneSummaries[0].name, null);
  const view = await mount(t); await view.answer(response.data, response.status); await view.search('합성');
  assertRecoverable(view, 'null name from synthetic D1', response.status);
  await f.db.prepare("UPDATE fortunes SET data=json_set(data,'$.analysis.name',?) WHERE id=?").bind(f.fortune.analysis.name, f.fortune.id).run();
  await view.retry(); const recovered = await f.summary(); await view.answer(recovered.data, recovered.status);
  assert.equal(view.alert(), undefined); assert(view.text().includes('총 1권의 기록')); assert(view.text().includes('합성 기록님'));
  assert.equal(await f.db.prepare('SELECT COUNT(*) AS count FROM fortunes').first('count'), 1);
});

test('an invalid record date is a recoverable list error instead of a render exception', async t => {
  const f = await fixture(t);
  await f.db.prepare('UPDATE fortunes SET created_at=? WHERE id=?').bind('synthetic-invalid-date', f.fortune.id).run();
  const response = await f.summary(); assert.equal(response.status, 200);
  const view = await mount(t); await view.answer(response.data, response.status);
  assertRecoverable(view, 'invalid date from synthetic D1', response.status);
  await f.db.prepare('UPDATE fortunes SET created_at=? WHERE id=?').bind(f.fortune.createdAt, f.fortune.id).run();
  await view.retry(); const recovered = await f.summary(); await view.answer(recovered.data, recovered.status);
  assert.equal(view.alert(), undefined); assert(view.text().includes(f.fortune.createdAt.split('T')[0]));
});

test('a malformed list can retry through HTTP failure and then show a genuine empty result', async t => {
  const view = await mount(t); await view.answer({ fortuneSummaries: [null] });
  assertRecoverable(view, 'malformed list item', 200);
  await view.retry(); await view.answer({ error: '합성 저장소 오류' }, 503);
  assert(view.alert()?.includes('합성 저장소 오류')); assert(!view.text().includes('아직 보관된 사주 풀이가 없습니다.'));
  await view.retry(); await view.answer({ fortuneSummaries: [] });
  assert.equal(view.alert(), undefined); assert(view.text().includes('아직 보관된 사주 풀이가 없습니다.')); assert.deepEqual(view.errors, []);
});

test('the real API still lists legacy optional category and day-master fields with its defaults', async t => {
  const f = await fixture(t);
  await f.db.prepare("UPDATE fortunes SET data=json_remove(data,'$.category','$.analysis.dayMaster') WHERE id=?").bind(f.fortune.id).run();
  const response = await f.summary(); assert.equal(response.status, 200);
  assert.equal(response.data.fortuneSummaries[0].category, 'overall'); assert.equal(response.data.fortuneSummaries[0].dayMaster, '');
  const view = await mount(t); await view.answer(response.data, response.status); await view.search('합성');
  assert.deepEqual(view.errors, []); assert.equal(view.alert(), undefined); assert(view.text().includes('합성 기록님')); assert(view.text().includes('종합 사주'));
});
