// Actual built Saved page and FortuneCard, with synthetic read-only API responses.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Miniflare } from 'miniflare';
import { fullReading as full, summaries } from './detail-result-fixtures.mjs';

const root = process.cwd(), phase = process.env.SAJU_QA_PHASE || 'after';
assert(['before', 'after'].includes(phase));
const output = path.join(root, 'outputs/saved-detail-analysis-response', phase);
await fs.mkdir(output, { recursive: true });
const { chromium } = await import(pathToFileURL(process.env.SAJU_QA_PLAYWRIGHT_PATH).href);
const checks = [], observations = [], outbound = [], unexpectedApi = [];
async function walk(dir) {
  const files = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...await walk(f)); else if (/\.m?js$/.test(f)) files.push(f);
  }
  return files;
}
const entry = path.join(root, 'dist/server/index.js');
const mf = new Miniflare({ rootPath: root, modulesRoot: 'dist/server',
  modules: [entry, ...(await walk(path.join(root, 'dist/server'))).filter(f => f !== entry)].map(f => ({ type: 'ESModule', path: f })),
  compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'], host: '127.0.0.1', port: 0,
  cf: false, telemetry: { enabled: false }, d1Databases: { DB: 'saved-analysis-synthetic' }, d1Persist: false,
  assets: { directory: 'dist/client', routerConfig: { has_user_worker: true } },
  outboundService: async r => { outbound.push(new URL(r.url).hostname); return new Response('blocked', { status: 502 }); },
});
let browser, origin;
async function view() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: {
    'oai-authenticated-user-id': 'saved-analysis-synthetic', 'oai-authenticated-user-email': 'qa@example.invalid',
  } });
  const pending = [], errors = [], consoleErrors = [], requests = [];
  await context.route('**/*', async r => {
    const url = new URL(r.request().url());
    if (url.origin !== origin) { outbound.push(url.hostname); return r.abort(); }
    if (url.pathname.startsWith('/api/')) {
      requests.push({ path: url.pathname, method: r.request().method() });
      if (r.request().method() === 'GET' && url.pathname === '/api/saju' && url.searchParams.get('view') === 'summary')
        return r.fulfill({ json: { fortuneSummaries: summaries } });
      if (r.request().method() === 'GET' && /^\/api\/saju\/[ab]$/.test(url.pathname)) {
        pending.push({ id: url.pathname.at(-1), route: r }); return;
      }
      unexpectedApi.push({ method: r.request().method(), path: url.pathname }); return r.abort();
    }
    return r.continue();
  });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  await page.goto(origin + '/saved', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'select-a', exact: false }).waitFor();
  async function waitRequest(count) {
    const until = Date.now() + 10000;
    while (pending.length < count) {
      assert(Date.now() < until, 'new detail request must appear'); await page.waitForTimeout(20);
    }
    assert.equal(pending.length, count); return pending.at(-1);
  }
  const h = { page, errors, consoleErrors, requests,
    async select(id) {
      const count = pending.length;
      await page.getByRole('button', { name: 'select-' + id, exact: false }).click();
      await page.waitForURL(url => url.searchParams.get('id') === id); return waitRequest(count + 1);
    },
    async answer(item, fortune) { await item.route.fulfill({ json: { fortune } }); },
    async shown(id) {
      await page.getByRole('heading', { name: `reading-${id}-current`, exact: true }).waitFor();
      await page.getByText(`person-${id}-current님의 사주팔자 (四柱)`, { exact: true }).waitFor();
      assert.equal(await page.getByRole('alert').count(), 0); assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, []);
    },
    async list() {
      await page.getByRole('button', { name: '← 보관함 전체 목록으로 돌아가기', exact: true }).click();
      await page.waitForURL(url => !url.searchParams.has('id'));
      await page.getByRole('button', { name: 'select-b', exact: false }).waitFor();
    },
    async retry() {
      const count = pending.length; await page.getByRole('button', { name: '다시 불러오기', exact: true }).click();
      const item = await waitRequest(count + 1);
      await page.getByRole('status').getByText('선택한 기록을 불러오고 있어요.', { exact: true }).waitFor();
      assert.equal(await page.getByRole('alert').count(), 0); return item;
    },
    close: () => context.close(),
  };
  return h;
}
async function check(name, run) {
  console.log('RUN ' + name); const h = await view();
  try { await run(h); checks.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
  catch (e) { checks.push({ name, status: 'FAIL', error: e.message }); console.error(e.message); }
  finally { observations.push({ name, errors: h.errors, consoleErrors: h.consoleErrors, requests: h.requests }); await h.close(); }
}
try {
  origin = (await mf.ready).origin;
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const invalid = [['missing', undefined], ['null', null], ['string', 'invalid analysis'], ['number', 1], ['boolean', false], ['array', []]];
  for (const [kind, value] of invalid) await check(`matching-ID ${kind} analysis stays retryable and recovers to the selected reading`, async h => {
    const a = await h.select('a'); await h.answer(a, full('a')); await h.shown('a');
    if (kind === 'missing') await h.page.screenshot({ path: path.join(output, 'valid-reading.png'), fullPage: true });
    await h.list(); const b = await h.select('b');
    const bad = full('b'); if (kind === 'missing') delete bad.analysis; else bad.analysis = value;
    assert.equal(bad.id, 'b'); await h.answer(b, bad);
    // Retain the actual failed UI before asserting. Baseline render crashes produce page errors.
    await h.page.waitForFunction(() => document.querySelector('[role="alert"]') || /This page couldn|Application error|client-side exception/i.test(document.body.textContent || ''), null, { timeout: 1500 }).catch(() => {});
    if (kind === 'missing') await h.page.screenshot({ path: path.join(output, 'invalid-analysis.png'), fullPage: true });
    const alert = h.page.getByRole('alert'); assert.equal(await alert.count(), 1, 'invalid analysis must use the existing retryable detail error');
    await alert.getByText('요청한 기록을 확인할 수 없습니다.', { exact: true }).waitFor();
    assert.equal(await h.page.getByRole('heading', { name: /^reading-/ }).count(), 0, 'previous A or invalid B must not remain visible');
    assert.equal(await h.page.getByRole('button', { name: '← 보관함 전체 목록으로 돌아가기', exact: true }).count(), 1);
    assert.deepEqual(h.errors, [], 'invalid analysis must never reach FortuneCard render');
    const retry = await h.retry(); assert.equal(retry.id, 'b'); await h.answer(retry, full('b')); await h.shown('b');
    assert.equal(await h.page.getByRole('heading', { name: 'reading-a-current', exact: true }).count(), 0);
    if (kind === 'missing') await h.page.screenshot({ path: path.join(output, 'recovered-reading.png'), fullPage: true });
  });
  await check('unknown birth time retains its valid object analysis and missing-hour presentation', async h => {
    const a = await h.select('a'), reading = full('a'); reading.analysis.hourPillar = null;
    await h.answer(a, reading); await h.shown('a');
    await h.page.getByText('시간 미상', { exact: true }).waitFor();
  });
  await check('legacy lunar result without optional solar conversion remains readable', async h => {
    const a = await h.select('a'), reading = full('a'); reading.analysis.calendarType = 'lunar'; delete reading.analysis.solarBirthDate;
    await h.answer(a, reading); await h.shown('a');
    await h.page.getByRole('status').getByText('이전 음력 결과에는 양력 환산 정보가 없습니다. 정확한 날짜 적용을 위해 다시 계산해주세요.', { exact: true }).waitFor();
  });
  checks.push({ name: 'no unexpected API requests or outbound calls', status: unexpectedApi.length || outbound.length ? 'FAIL' : 'PASS' });
} finally {
  const report = { basis: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), phase,
    applicationSourceSHA256: createHash('sha256').update(await fs.readFile('app/saved/page.tsx')).digest('hex'),
    passed: checks.filter(c => c.status === 'PASS').length, failed: checks.filter(c => c.status === 'FAIL').length,
    checks, observations, unexpectedApi, outbound,
    limits: ['Actual built Saved page, FortuneCard and client router in Chromium at 390x844.',
      'Only missing or non-object required analysis is under test; this does not validate every nested FortuneResult field.',
      'Summary/detail GETs are synthetic intercepted fixtures. No real user DB, API writes, chat or external AI runs.',
      'Physical devices, screen readers, other browsers, hosted authentication and calendar accuracy are not tested.'] };
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  await browser?.close(); await mf.dispose();
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed })); process.exitCode = report.failed ? 1 : 0;
}
