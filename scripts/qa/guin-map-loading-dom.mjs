// Run from the checkout: SAJU_QA_JSDOM_PATH=/path/to/jsdom/lib/api.js node scripts/qa/guin-map-loading-dom.mjs
// Exercises the real page and response reader with synthetic HTTP responses.
// Navigation, session restoration, and visual/3D components are boundary stubs.
import fs from 'node:fs/promises';
import path from 'node:path';
import Module, { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import React, { act } from 'react';

const checkout = process.cwd();
const { JSDOM } = await import(pathToFileURL(process.env.SAJU_QA_JSDOM_PATH || path.join(checkout, '.sites-runtime/test-tools/node_modules/jsdom/lib/api.js')).href);
const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://local.test/guin/qa-map-a' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
const { createRoot } = await import('react-dom/client');
const require = createRequire(import.meta.url);
const Empty = () => null;

async function compile(file, overrides = {}) {
  const absolute = path.join(checkout, file);
  const source = await fs.readFile(absolute, 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = new Module(absolute);
  mod.filename = absolute;
  mod.paths = Module._nodeModulePaths(path.dirname(absolute));
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  mod._compile(code, absolute);
  return mod.exports;
}

const reader = await compile('lib/http-client.ts');
const map = (id, ownerName) => ({ id, ownerName, ownerBirth: '2000.1.1', ownerDayMaster: '갑', ownerTheme: 'wood', createdAt: '2026-01-01T00:00:00.000Z', guins: [] });

async function createView(t, strict = false) {
  let routeId = 'qa-map-a';
  const requests = [];
  const restorations = [];
  // Ignore cancellation in this transport to exercise the late-response fence too.
  globalThis.fetch = (url, options = {}) => {
    assert.match(url, /^\/api\/guin\/qa-map-[a-z]+$/);
    return new Promise((resolve, reject) => requests.push({ url, options, resolve, reject }));
  };
  const Page = (await compile('app/guin/[id]/page.tsx', {
    '@/lib/http-client': reader,
    '@/lib/universe-state': { restoreGalaxyUniverse: value => restorations.push(value.id) },
    'next/navigation': { useParams: () => ({ id: routeId }) },
    '@/components/Header': Empty,
    '@/components/planet/GalaxyCanvas': { __esModule: true, default: Empty },
    '@/components/planet/CosmicPassportModal': Empty,
    '@/components/planet/GalaxyPokedexModal': Empty,
    '@/lib/saju/daily-orbital': { calculateDailyOrbitalWeather: () => [] },
  })).default;
  const container = document.createElement('div');
  document.body.append(container);
  const renderer = createRoot(container);
  let mounted = true;
  const unmount = async () => {
    if (mounted) {
      await act(async () => renderer.unmount());
      mounted = false;
    }
  };
  t.after(async () => { await unmount(); container.remove(); });
  const render = async id => {
    routeId = id;
    const page = React.createElement(Page);
    await act(async () => renderer.render(strict ? React.createElement(React.StrictMode, null, page) : page));
  };
  const answer = async (request, data, status = 200) => act(async () => request.resolve(Response.json(data, { status })));
  return { requests, restorations, render, answer, unmount, text: () => container.textContent, heading: () => container.querySelector('h1')?.textContent };
}

test('a late previous-route GET cannot replace the current map or restore its session', async t => {
  const view = await createView(t);
  await view.render('qa-map-a');
  const old = view.requests.at(-1);
  await view.render('qa-map-b');
  const current = view.requests.at(-1);
  assert.equal(current.url, '/api/guin/qa-map-b');
  await view.answer(current, { guinMap: map('qa-map-b', '합성 현재 지도') });
  assert.equal(view.heading(), '합성 현재 지도의 갤럭시');
  await view.answer(old, { guinMap: map('qa-map-a', '합성 이전 지도') });
  assert.equal(view.heading(), '합성 현재 지도의 갤럭시', 'A late previous GET must not display the wrong owner');
  assert.deepEqual(view.restorations, ['qa-map-b']);
  assert.equal(old.options.signal?.aborted, true);
});

test('changing a loaded route hides its map and starts the new loading state', async t => {
  const view = await createView(t);
  await view.render('qa-map-a');
  await view.answer(view.requests.at(-1), { guinMap: map('qa-map-a', '합성 이전 지도') });
  await view.render('qa-map-b');
  assert(view.text().includes('우리은하 인연망을 펼치는 중입니다...'));
  assert(!view.text().includes('합성 이전 지도'), 'Do not keep the previous owner visible under a new URL');
  await view.answer(view.requests.at(-1), { guinMap: map('qa-map-b', '합성 현재 지도') });
  assert.equal(view.heading(), '합성 현재 지도의 갤럭시');
});

test('changing a failed route clears its error before the next map arrives', async t => {
  const view = await createView(t);
  await view.render('qa-map-a');
  await view.answer(view.requests.at(-1), { error: '합성 이전 지도 오류' }, 503);
  assert(view.text().includes('합성 이전 지도 오류'));
  await view.render('qa-map-b');
  assert(view.text().includes('우리은하 인연망을 펼치는 중입니다...'));
  assert(!view.text().includes('합성 이전 지도 오류'));
  await view.answer(view.requests.at(-1), { guinMap: map('qa-map-b', '합성 복구 지도') });
  assert.equal(view.heading(), '합성 복구 지도의 갤럭시');
});

test('a late previous-route failure cannot finish loading the current route', async t => {
  const view = await createView(t);
  await view.render('qa-map-a');
  const old = view.requests.at(-1);
  await view.render('qa-map-b');
  const current = view.requests.at(-1);
  await view.answer(old, { error: '합성 늦은 오류' }, 503);
  assert(view.text().includes('우리은하 인연망을 펼치는 중입니다...'));
  assert(!view.text().includes('합성 늦은 오류'));
  await view.answer(current, { guinMap: map('qa-map-b', '합성 현재 지도') });
  assert.equal(view.heading(), '합성 현재 지도의 갤럭시');
});

test('unmount cancels the GET and a late success has no session side effect', async t => {
  const view = await createView(t);
  await view.render('qa-map-a');
  const pending = view.requests.at(-1);
  await view.unmount();
  await view.answer(pending, { guinMap: map('qa-map-a', '합성 닫힌 지도') });
  assert.deepEqual(view.restorations, [], 'An unmounted page must not restore a stale map into shared state');
  assert.equal(pending.options.signal?.aborted, true);
});

test('current HTTP and malformed-response errors still render without restoring a map', async t => {
  const view = await createView(t);
  await view.render('qa-map-a');
  await view.answer(view.requests.at(-1), { error: '합성 접근 오류' }, 403);
  assert(view.text().includes('합성 접근 오류'));
  await view.render('qa-map-b');
  await view.answer(view.requests.at(-1), []);
  assert(view.text().includes('서버 응답 형식을 확인할 수 없습니다.'));
  assert.deepEqual(view.restorations, []);
});

test('Strict Mode cleanup prevents a discarded mount from replacing its fresh load', async t => {
  const view = await createView(t, true);
  await view.render('qa-map-a');
  assert.equal(view.requests.length, 2);
  const [discarded, active] = view.requests;
  await view.answer(active, { guinMap: map('qa-map-a', '합성 현재 마운트') });
  await view.answer(discarded, { guinMap: map('qa-map-a', '합성 폐기 마운트') });
  assert.equal(view.heading(), '합성 현재 마운트의 갤럭시');
  assert.deepEqual(view.restorations, ['qa-map-a']);
  assert.equal(discarded.options.signal?.aborted, true);
});
