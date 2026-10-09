// Real production client/router with synthetic deferred API responses only.
// Run npm run build first. Tool paths can be overridden without product dependency changes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Miniflare } from 'miniflare';
import { root, output, fullReading as full, summaries } from './detail-result-fixtures.mjs';

await fs.mkdir(output, { recursive: true });
async function walk(directory) {
  const paths = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await walk(full));
    else if (/\.m?js$/.test(entry.name)) paths.push(full);
  }
  return paths;
}
const entry = path.join(root, 'dist/server/index.js');
const modules = [entry, ...(await walk(path.join(root, 'dist/server'))).filter(p => p !== entry)]
  .map(p => ({ type: 'ESModule', path: p }));
const outbound = [], errors = [], checks = [], requestFailures = [], consoleErrors = [], routeControls = [];
const mf = new Miniflare({ rootPath: root, modules, modulesRoot: 'dist/server',
  compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'], host: '127.0.0.1', port: 0,
  cf: false, logRequests: false, telemetry: { enabled: false },
  d1Databases: { DB: 'detail-result-browser-fixture' }, d1Persist: false,
  assets: { directory: 'dist/client', routerConfig: { has_user_worker: true } },
  outboundService: async request => { outbound.push(new URL(request.url).hostname); return new Response('blocked', { status: 502 }); },
});
let browser, browserVersion;
async function waitForCount(read, expected) {
  const until = Date.now() + 10000;
  while (read() !== expected) {
    if (Date.now() > until) assert.equal(read(), expected, 'Timed out waiting for a new detail request');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}
try {
  const origin = (await mf.ready).origin;
  const playwrightPath = process.env.SAJU_QA_PLAYWRIGHT_PATH
    || path.join(root, '.sites-runtime/test-tools/node_modules/playwright/index.mjs');
  const { chromium } = await import(pathToFileURL(playwrightPath).href);
  browser = await chromium.launch({
    ...(process.env.SAJU_QA_CHROME ? { executablePath: process.env.SAJU_QA_CHROME } : {}),
    headless: true, args: ['--no-sandbox'],
  });
  browserVersion = await browser.version();
  async function harness() {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 },
      extraHTTPHeaders: { 'oai-authenticated-user-id': 'detail-browser-fixture', 'oai-authenticated-user-email': 'qa@example.invalid' } });
    const pending = [];
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin && !['data:', 'blob:'].includes(url.protocol)) {
        outbound.push(url.hostname); return route.abort();
      }
      if (url.pathname === '/api/saju' && url.searchParams.get('view') === 'summary')
        return route.fulfill({ json: { fortuneSummaries: summaries } });
      if (/^\/api\/saju\/[ab]$/.test(url.pathname)) {
        pending.push({ id: url.pathname.slice('/api/saju/'.length), route, request: route.request() });
        return;
      }
      // A future unexpected API request must fail rather than access a real record.
      if (url.pathname.startsWith('/api/')) throw new Error('Unexpected API request: ' + url.pathname);
      return route.continue();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(error.stack || error.message));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('requestfailed', request => {
      if (new URL(request.url()).pathname.startsWith('/api/saju/'))
        requestFailures.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText });
    });
    try {
      await page.goto(origin + '/saved', { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'select-a', exact: false }).waitFor();
    } catch (error) { await context.close(); throw error; }
    const h = {
      page, pending,
      async select(id) {
        const count = pending.filter(item => item.id === id).length;
        await page.getByRole('button', { name: 'select-' + id, exact: false }).click();
        await page.waitForURL(url => url.searchParams.get('id') === id);
        await waitForCount(() => pending.filter(item => item.id === id).length, count + 1);
        return pending.filter(item => item.id === id).at(-1);
      },
      async list() {
        await page.getByRole('button', { name: '← 보관함 전체 목록으로 돌아가기', exact: true }).click();
        await page.waitForURL(url => !url.searchParams.has('id'));
        await page.getByRole('button', { name: 'select-a', exact: false }).waitFor();
      },
      async answer(item, data, status = 200) {
        try {
          await item.route.fulfill({ json: data, status });
          routeControls.push({ id: item.id, status, delivered: true });
        } catch (error) {
          if (item.request.failure()?.errorText !== 'net::ERR_ABORTED') throw error;
          routeControls.push({ id: item.id, status, delivered: false, canceled: true });
        }
      },
      async loading() {
        await page.getByRole('status').getByText('선택한 기록을 불러오고 있어요.', { exact: true }).waitFor();
        assert.equal(await page.getByRole('alert').count(), 0);
        assert.equal(await page.locator('h2').filter({ hasText: /^reading-/ }).count(), 0);
      },
      async shown(id, version = 'current') {
        await page.getByRole('heading', { name: `reading-${id}-${version}`, exact: true }).waitFor();
        await page.getByText(`person-${id}-${version}님의 사주팔자 (四柱)`, { exact: true }).waitFor();
        assert.equal(await page.getByRole('alert').count(), 0);
      },
      async failure(message) {
        const alert = page.getByRole('alert'); await alert.waitFor();
        if (message) await alert.getByText(message, { exact: true }).waitFor();
        assert.equal(await page.locator('h2').filter({ hasText: /^reading-/ }).count(), 0);
      },
      async retry() {
        const count = pending.length;
        await page.getByRole('button', { name: '다시 불러오기', exact: true }).click();
        await waitForCount(() => pending.length, count + 1);
        await h.loading(); return pending.at(-1);
      },
      async settle() { await page.waitForTimeout(80); },
      async dispose() { await context.close(); },
    };
    return h;
  }
  async function check(name, run) {
    const h = await harness();
    try { await run(h); checks.push(name); console.log('PASS: ' + name); }
    finally { await h.dispose(); }
  }
  await check('real selection hides A during B pending, failure and successful retry', async h => {
    const a = await h.select('a'); await h.answer(a, { fortune: full('a') }); await h.shown('a'); await h.list();
    const b = await h.select('b'); await h.loading();
    await h.answer(b, { error: '합성 B 상세 실패' }, 503); await h.failure('합성 B 상세 실패');
    const retry = await h.retry(); await h.answer(retry, { fortune: full('b') }); await h.shown('b');
  });
  await check('real A to B to A rejects old same-ID success while fresh A is pending', async h => {
    const oldA = await h.select('a'); await h.list(); const oldB = await h.select('b'); await h.list();
    const newA = await h.select('a'); await h.loading();
    await h.answer(oldA, { fortune: full('a', 'old') }); await h.settle(); await h.loading();
    await h.answer(newA, { fortune: full('a', 'new') }); await h.shown('a', 'new');
    await h.answer(oldB, { error: '늦은 B 오류' }, 503); await h.settle(); await h.shown('a', 'new');
  });
  await check('real late A failure does not end current B loading', async h => {
    const oldA = await h.select('a'); await h.list(); const b = await h.select('b'); await h.loading();
    await h.answer(oldA, { error: '늦은 A 오류' }, 404); await h.settle(); await h.loading();
    await h.answer(b, { fortune: full('b') }); await h.shown('b');
  });
  await check('browser Back to a failed detail starts fresh loading without the previous error', async h => {
    const a = await h.select('a'); await h.answer(a, { error: '이전 A 오류' }, 404); await h.failure('이전 A 오류'); await h.list();
    const count = h.pending.filter(item => item.id === 'a').length;
    await h.page.goBack(); await h.page.waitForURL(url => url.searchParams.get('id') === 'a');
    await waitForCount(() => h.pending.filter(item => item.id === 'a').length, count + 1); await h.loading();
    await h.answer(h.pending.at(-1), { fortune: full('a') }); await h.shown('a');
  });
  await check('current network failure and mismatched response remain retryable without A', async h => {
    const a = await h.select('a'); await h.answer(a, { fortune: full('a') }); await h.shown('a'); await h.list();
    const b = await h.select('b'); await b.route.abort('failed'); await h.failure();
    const mismatch = await h.retry(); await h.answer(mismatch, { fortune: full('a', 'wrong') });
    await h.failure('요청한 기록을 확인할 수 없습니다.');
    const retry = await h.retry(); await h.answer(retry, { fortune: full('b') }); await h.shown('b');
  });
  assert.deepEqual(errors, []); assert.deepEqual(outbound, []);
  assert(consoleErrors.every(message => /server responded with a status of (?:404|503)\b|net::ERR_FAILED/.test(message)),
    'Unexpected browser console error: ' + consoleErrors.join('\n'));
  console.log(JSON.stringify({ status: 'PASS', checks: checks.length, browserVersion }));
} catch (error) { errors.push(error.stack || String(error)); process.exitCode = 1; console.error(error); }
finally {
  await browser?.close(); await mf.dispose();
  await fs.writeFile(path.join(output, 'browser-report.json'), JSON.stringify({
    status: process.exitCode ? 'FAIL' : 'PASS', browserVersion, checks, errors, outbound,
    requestFailures, consoleErrors, routeControls,
    limits: ['Real production Worker/client and real Next router/URL Back with Chromium',
      'Synthetic deferred/intercepted detail and summary API responses; disposable local D1 only',
      'Canceled browser fetch may stop delivery; DOM regression separately tests late parsed-body completion',
      'No physical mobile, hosted login, live user data, deployment or chat interaction'],
  }, null, 2) + '\n');
}
