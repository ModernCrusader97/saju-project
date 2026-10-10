// Built home/modal, native browser events; POST responses are local boundary fixtures.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Miniflare } from 'miniflare';
import { fullReading } from './detail-result-fixtures.mjs';
const root = process.cwd(), phase = process.env.SAJU_QA_PHASE || 'after';
assert(['before', 'after'].includes(phase));
const output = path.join(root, 'outputs/input-request', phase); await fs.mkdir(output, { recursive: true });
const { chromium } = await import(pathToFileURL(process.env.SAJU_QA_PLAYWRIGHT_PATH).href);
const checks = [], observations = [], errors = [], outbound = [];
async function walk(dir) { const out = []; for (const e of await fs.readdir(dir, { withFileTypes: true })) {
  const f = path.join(dir, e.name); if (e.isDirectory()) out.push(...await walk(f)); else if (/\.m?js$/.test(f)) out.push(f);
} return out; }
const entry = path.join(root, 'dist/server/index.js');
const mf = new Miniflare({ rootPath: root, modulesRoot: 'dist/server',
  modules: [entry, ...(await walk(path.join(root, 'dist/server'))).filter(f => f !== entry)].map(f => ({ type: 'ESModule', path: f })),
  compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'], host: '127.0.0.1', port: 0,
  cf: false, telemetry: { enabled: false }, d1Databases: { DB: 'input-request-synthetic' }, d1Persist: false,
  assets: { directory: 'dist/client', routerConfig: { has_user_worker: true } },
  outboundService: async r => { outbound.push(new URL(r.url).hostname); return new Response('blocked', { status: 502 }); },
});
let browser, origin;
async function view() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: {
    'oai-authenticated-user-id': 'input-request-synthetic', 'oai-authenticated-user-email': 'qa@example.invalid',
  } });
  await context.route('**/*', r => new URL(r.request().url()).origin === origin ? r.continue() : (outbound.push(new URL(r.request().url()).hostname), r.abort()));
  await context.addInitScript(() => {
    window.__inputRequests = []; window.__inputDocument = crypto.randomUUID();
    const original = window.fetch;
    window.fetch = async function(input, options = {}) {
      if (input !== '/api/saju' || options.method !== 'POST') return original.call(this, input, options);
      const row = { aborted: false, done: false, hasSignal: !!options.signal, category: JSON.parse(options.body).category };
      window.__inputRequests.push(row); options.signal?.addEventListener('abort', () => { row.aborted = true; });
      try { return await original.call(this, input, options); } finally { row.done = true; }
    };
  });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  const pending = [], dialogs = [];
  await page.route('**/api/saju', r => {
    if (r.request().method() === 'POST') pending.push(r); else return r.continue();
  });
  page.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(origin + '/', { waitUntil: 'networkidle' });
  const documentId = await page.evaluate(() => window.__inputDocument);
  const open = async (name = '나의 성향') => { await page.getByRole('button', { name, exact: true }).click(); await page.getByRole('heading', { name, exact: true }).waitFor(); };
  const send = async () => {
    const count = pending.length; await page.getByRole('button', { name: '나의 이야기 보기', exact: true }).click();
    await page.waitForFunction(n => window.__inputRequests.length > n, count);
    assert.equal(pending.length, count + 1); return pending[count];
  };
  const settle = async (request, body, status = 200) => { await request.fulfill({ status, json: body }).catch(() => {}); };
  const frames = () => page.evaluate(async () => { for (let i = 0; i < 12; i++) await new Promise(r => requestAnimationFrame(r)); });
  return { page, pending, dialogs, documentId, open, send, settle, frames, close: () => context.close() };
}
async function check(name, run) {
  console.log('RUN ' + name); try { await run(); checks.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
  catch (e) { checks.push({ name, status: 'FAIL', error: e.message }); console.error(e.message); }
}
try {
  origin = (await mf.ready).origin;
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  await check('closing pending input prevents a late error alert in the same document', async () => {
    const v = await view(); try {
      await v.open(); await v.page.getByPlaceholder('예: 홍길동').fill('합성 취소 검증'); const first = await v.send();
      await v.page.keyboard.press('Escape'); assert.equal(await v.page.getByText('나의 사주 정보', { exact: true }).count(), 0);
      await v.settle(first, { error: '합성 늦은 실패' }, 503);
      await v.page.waitForFunction(() => window.__inputRequests[0].done); await v.frames();
      const requests = await v.page.evaluate(() => window.__inputRequests);
      const sameDocument = v.documentId === await v.page.evaluate(() => window.__inputDocument);
      await v.page.screenshot({ path: path.join(output, 'closed.png') });
      observations.push({ scenario: 'late failure after Escape', requests, dialogs: [...v.dialogs], sameDocument });
      assert(sameDocument); assert.deepEqual(v.dialogs, []); assert(requests[0].aborted);
    } finally { await v.close(); }
  });
  await check('reopening pending input restores its draft and a fresh request', async () => {
    const v = await view(); try {
      await v.open(); await v.page.getByPlaceholder('예: 홍길동').fill('합성 보존 초안'); const first = await v.send();
      await v.page.keyboard.press('Escape'); await v.open('연애와 관계'); await v.frames();
      const inputCount = await v.page.getByPlaceholder('예: 홍길동').count();
      await v.page.screenshot({ path: path.join(output, 'reopened.png') });
      observations.push({ scenario: 'reopen a different category', inputCount, requests: await v.page.evaluate(() => window.__inputRequests) });
      if (!inputCount) { await v.settle(first, { error: '합성 이전 실패' }, 503); assert.fail('The canceled request must not keep the reopened modal in its loading state'); }
      assert.equal(await v.page.getByPlaceholder('예: 홍길동').inputValue(), '합성 보존 초안');
      const second = await v.send(); await v.settle(first, { success: true, fortune: fullReading('stale') }); await v.frames();
      assert.equal(await v.page.getByRole('heading', { name: '이번에 남긴 기록', exact: true }).count(), 0);
      assert.equal(await v.page.getByPlaceholder('예: 홍길동').count(), 0, 'The current request remains pending');
      await v.settle(second, { success: true, fortune: fullReading('fresh') });
      await v.page.getByRole('heading', { name: '이번에 남긴 기록', exact: true }).waitFor();
      assert.deepEqual(v.dialogs, []);
      const requests = await v.page.evaluate(() => window.__inputRequests); assert.equal(requests.length, 2);
      assert.deepEqual(requests.map(r => r.category), ['overall', 'love']);
    } finally { await v.close(); }
  });
  await check('an active failed request still permits explicit successful retry', async () => {
    const v = await view(); try {
      await v.open(); await v.page.getByPlaceholder('예: 홍길동').fill('합성 재시도');
      await v.settle(await v.send(), { error: '합성 현재 실패' }, 503);
      await v.page.getByPlaceholder('예: 홍길동').waitFor(); await v.frames();
      assert.deepEqual(v.dialogs, ['합성 현재 실패']); assert.equal(await v.page.getByPlaceholder('예: 홍길동').inputValue(), '합성 재시도');
      await v.settle(await v.send(), { success: true, fortune: fullReading('retry') });
      await v.page.getByRole('heading', { name: '이번에 남긴 기록', exact: true }).waitFor();
      observations.push({ scenario: 'active failure and manual retry', requests: await v.page.evaluate(() => window.__inputRequests), dialogs: [...v.dialogs] });
    } finally { await v.close(); }
  });
  await check('no page errors or outbound requests occur', async () => { assert.deepEqual(errors, []); assert.deepEqual(outbound, []); });
} finally {
  const r = { basis: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), phase,
    applicationSourceSHA256: createHash('sha256').update(await fs.readFile('components/SajuInputModal.tsx')).digest('hex'),
    passed: checks.filter(c => c.status === 'PASS').length, failed: checks.filter(c => c.status === 'FAIL').length,
    checks, observations, errors, outbound,
    limits: ['Actual built home/modal and native pointer/keyboard events in Chromium; HTTP POST replies are controlled boundary fixtures.',
      'No real /api/saju write or external AI request executes. Server persistence/rollback, hosted auth and other browsers are not tested.'] };
  await fs.writeFile(path.join(output, 'browser-results.json'), JSON.stringify(r, null, 2) + '\n');
  await browser?.close(); await mf.dispose(); console.log(JSON.stringify({ passed: r.passed, failed: r.failed })); process.exitCode = r.failed ? 1 : 0;
}
