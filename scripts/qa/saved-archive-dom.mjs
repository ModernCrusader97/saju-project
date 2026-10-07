// Runs the real SavedPage/response reader with a DOM and mocked network/router
// boundaries. This verifies lifecycle behavior, not visual/browser rendering.
import fs from 'node:fs/promises';
import path from 'node:path';
import Module, { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import ts from 'typescript';
import React, { act } from 'react';
const root = process.cwd();
const domPath = process.env.SAJU_QA_JSDOM_PATH || path.join(root, '.sites-runtime/test-tools/node_modules/jsdom/lib/api.js');
const { JSDOM } = await import(pathToFileURL(domPath).href);
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://local.test/saved' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
const { createRoot } = await import('react-dom/client');
const requests = [], checks = [], listeners = new Set();
let route = '', cursor = 0, history = [''];
const setRoute = value => { route = value; for (const callback of listeners) callback(); };
const router = { push(url) { const value = new URL(url, 'http://local.test').search; history = history.slice(0, cursor + 1); history.push(value); cursor++; setRoute(value); } };
const navigation = {
  useRouter: () => router,
  useSearchParams() { const value = React.useSyncExternalStore(callback => { listeners.add(callback); return () => listeners.delete(callback); }, () => route); return new URLSearchParams(value); },
};
globalThis.fetch = (url, options = {}) => new Promise((resolve, reject) => { requests.push({ url, signal: options.signal, resolve, reject }); });
const require = createRequire(import.meta.url);
async function compile(file, overrides = {}) {
  const absolute = path.join(root, file);
  const code = ts.transpileModule(await fs.readFile(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = new Module(absolute); mod.filename = absolute; mod.paths = Module._nodeModulePaths(path.dirname(absolute));
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  mod._compile(code, absolute); return mod.exports;
}
const responseReader = await compile('lib/http-client.ts');
const SavedPage = (await compile(process.env.SAJU_QA_PAGE || 'app/saved/page.tsx', {
  'next/navigation': navigation,
  'next/link': { __esModule: true, default: props => React.createElement('a', props) },
  '@/components/Header': { __esModule: true, default: () => null },
  '@/components/FortuneCard': { __esModule: true, default: ({ fortune }) => React.createElement('article', { 'data-detail-id': fortune.id }, fortune.title) },
  '@/lib/http-client': responseReader,
})).default;
let renderer;
const fixture = id => ({ id, createdAt: '2026-01-01T00:00:00.000Z', category: id === 'b' ? 'love' : 'overall', title: `record-${id}`, summary: `summary-${id}`, name: `person-${id}`, dayMaster: id === 'b' ? '을목' : '갑목' });
const full = id => ({ ...fixture(id), analysis: { name: `person-${id}` }, sections: [{ title: 'full', content: 'detail body' }] });
const all = () => document.body.textContent;
const detail = () => document.querySelector('article')?.dataset.detailId;
const button = text => [...document.querySelectorAll('button,[role="button"]')].find(el => el.textContent.includes(text));
const click = async text => { const el = button(text); assert(el, 'Missing control: ' + text); await act(async () => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))); };
const answer = async (request, data, status = 200) => { assert(request); await act(async () => { request.resolve(Response.json(data, { status })); }); };
const back = async () => act(async () => { if (cursor > 0) setRoute(history[--cursor]); });
const forward = async () => act(async () => { if (cursor + 1 < history.length) setRoute(history[++cursor]); });
const mount = async (search = '') => {
  if (renderer) await act(async () => renderer.unmount());
  route = search; cursor = 0; history = [search]; requests.length = 0;
  renderer = createRoot(document.getElementById('root'));
  await act(async () => renderer.render(React.createElement(SavedPage)));
};
try {
  await mount();
  assert.deepEqual(requests.map(r => r.url), ['/api/saju?view=summary']);
  await answer(requests[0], { fortuneSummaries: [fixture('a'), fixture('b')] });
  assert(all().includes('총 2권의 기록'));
  await click('record-a');
  assert.equal(requests.at(-1).url, '/api/saju/a');
  assert(all().includes('선택한 기록을 불러오고 있어요.'));
  await answer(requests.at(-1), { fortune: full('a') });
  assert.equal(detail(), 'a');
  await click('보관함 전체 목록으로 돌아가기');
  assert.equal(detail(), undefined);
  await back(); assert.equal(detail(), 'a');
  await forward(); assert.equal(detail(), undefined);
  await click('record-a'); assert.equal(detail(), 'a');
  assert.equal(requests.length, 2, 'Repeat detail, return, Back/Forward must not refetch the archive or cached reading');
  checks.push('list-once/detail-on-demand/cache/URL Back and Forward');

  await click('보관함 전체 목록으로 돌아가기');
  await click('record-b'); const lateB = requests.at(-1);
  await click('보관함 전체 목록으로 돌아가기'); assert.equal(lateB.signal.aborted, true);
  await click('record-a'); await answer(lateB, { fortune: full('b') });
  assert.equal(detail(), 'a', 'Late completed request must not replace a newer selected record');
  checks.push('dismissal aborts detail and late completion cannot replace a newer selection');

  await mount('?id=missing');
  assert.deepEqual(requests.map(r => r.url), ['/api/saju?view=summary', '/api/saju/missing']);
  await answer(requests[1], { error: '기록을 찾을 수 없습니다.' }, 404);
  assert(document.querySelector('[role="alert"]')); assert.equal(detail(), undefined);
  await click('보관함 전체 목록으로 돌아가기');
  await back();
  assert(all().includes('선택한 기록을 불러오고 있어요.'), 'Returning to a failed detail must show its new pending request, not the stale error');
  await answer(requests.at(-1), { error: '다시 실패한 합성 응답' }, 503);
  await click('다시 불러오기');
  assert(all().includes('선택한 기록을 불러오고 있어요.'));
  await answer(requests.at(-1), { fortune: full('missing') }); assert.equal(detail(), 'missing');
  checks.push('direct link/error/retry uses only requested detail');

  await mount();
  await answer(requests[0], { error: '저장소 오류' }, 503);
  assert(document.querySelector('[role="alert"]'));
  assert(!all().includes('아직 보관된 사주 풀이가 없습니다.'), 'A failed request must not look like an empty archive');
  await click('다시 불러오기');
  await answer(requests.at(-1), { fortuneSummaries: [] });
  assert(all().includes('아직 보관된 사주 풀이가 없습니다.'));
  checks.push('failed list is distinct from empty state and retry succeeds');

  await mount();
  await answer(requests[0], { fortuneSummaries: [fixture('a'), fixture('b')] });
  await click('연애운 (1)');
  assert(!button('record-a')); assert(button('record-b'));
  await click('전체 (2)');
  const input = document.querySelector('input[aria-label="저장한 기록 검색"]');
  for (const term of ['person-b', 'record-b', 'summary-b', '을목', 'no-match', 'PERSON-B']) {
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, term);
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    assert(!button('record-a'));
    if (term === 'no-match') { assert(!button('record-b')); assert(all().includes('검색 조건에 맞는 사주 기록이 없습니다.')); }
    else assert(button('record-b'));
  }
  await act(async () => button('record-b').dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })));
  assert.equal(requests.at(-1).url, '/api/saju/b');
  await answer(requests.at(-1), { fortune: full('a') });
  assert(all().includes('요청한 기록을 확인할 수 없습니다.')); assert.equal(detail(), undefined);
  checks.push('category/all four search fields/case-fold/no-match/Space activation/mismatched detail guard');

  await mount(); const pendingList = requests[0];
  await act(async () => renderer.unmount()); renderer = null;
  assert.equal(pendingList.signal.aborted, true);
  await answer(pendingList, { fortuneSummaries: [fixture('a')] });
  assert.equal(document.getElementById('root').textContent, '');
  checks.push('unmount aborts list and ignores late resolution');
  const result = { status: 'PASS', checks, limits: ['JSDOM lifecycle checks with real page component; not browser rendering or visual QA', 'API/router boundaries stubbed; full D1 API coverage lives in saved-archive.mjs'] };
  await fs.mkdir('outputs/saved-archive', { recursive: true });
  await fs.writeFile('outputs/saved-archive/dom-results.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  if (renderer) await act(async () => renderer.unmount());
  dom.window.close();
}
