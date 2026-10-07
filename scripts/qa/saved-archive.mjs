import { Miniflare } from 'miniflare';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const output = path.join(root, 'outputs/saved-archive');
await fs.mkdir(output, { recursive: true });
async function walk(dir) {
  const files = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(file));
    else if (/\.m?js$/.test(file)) files.push(file);
  }
  return files;
}
const entry = path.join(root, 'dist/server/index.js');
const modules = [entry, ...(await walk(path.join(root, 'dist/server'))).filter(p => p !== entry)].map(p => ({ type: 'ESModule', path: p }));
const outbound = [], checks = [];
const mf = new Miniflare({
  rootPath: root, modules, modulesRoot: 'dist/server', compatibilityDate: '2026-05-15',
  compatibilityFlags: ['nodejs_compat'], host: '127.0.0.1', port: 0, cf: false, logRequests: false,
  telemetry: { enabled: false }, d1Databases: { DB: 'saved-archive-synthetic' }, d1Persist: false,
  assets: { directory: 'dist/client', routerConfig: { has_user_worker: true } },
  outboundService: async request => { outbound.push(new URL(request.url).hostname); return new Response('Outbound blocked by test', { status: 502 }); },
});
const owner = { 'oai-authenticated-user-id': 'archive-fixture', 'oai-authenticated-user-email': 'archive@example.invalid' };
const other = { 'oai-authenticated-user-id': 'another-fixture', 'oai-authenticated-user-email': 'another@example.invalid' };
async function request(url, headers = owner, body) {
  const response = await mf.dispatchFetch('http://preview.test' + url, {
    headers: { ...headers, ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  return { response, text, data: JSON.parse(text) };
}
let browser;
try {
  const d1 = await mf.getD1Database('DB');
  for (const file of (await fs.readdir('drizzle')).filter(f => f.endsWith('.sql')).sort()) {
    for (const sql of (await fs.readFile('drizzle/' + file, 'utf8')).split('--> statement-breakpoint')) if (sql.trim()) await d1.prepare(sql.trim()).run();
  }
  const created = await request('/api/saju', owner, { name: '합성 기록', gender: 'male', birthYear: 2000, birthMonth: 1, birthDay: 1, birthHour: 12, birthMinute: 30, isUnknownTime: false, calendarType: 'solar' });
  assert.equal(created.response.status, 200);
  const fixture = created.data.fortune;
  await d1.prepare('DELETE FROM fortunes').run(); // Disposable synthetic DB only.
  for (let i = 0; i < 120; i++) {
    const value = { ...fixture, id: `archive-${i}`, createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(), title: `합성 기록 ${i}`, category: i % 2 ? 'love' : 'overall', sections: [{ title: 'Synthetic fixture', content: '상세한 합성 풀이 문장입니다. '.repeat(350) }] };
    await d1.prepare('INSERT INTO fortunes (id,owner_id,created_at,data) VALUES (?,?,?,?)').bind(value.id, owner['oai-authenticated-user-id'], value.createdAt, JSON.stringify(value)).run();
  }
  const full = await request('/api/saju');
  const summary = await request('/api/saju?view=summary');
  assert.equal(summary.response.status, 200);
  assert(Array.isArray(summary.data.fortuneSummaries), 'The summary endpoint must return compact fortuneSummaries, not full readings');
  assert.equal(summary.data.fortuneSummaries.length, 120);
  assert.deepEqual(summary.data.fortuneSummaries.map(f => f.id), full.data.fortunes.map(f => f.id));
  for (const item of summary.data.fortuneSummaries) {
    assert.deepEqual(Object.keys(item).sort(), ['id', 'createdAt', 'category', 'title', 'summary', 'name', 'dayMaster'].sort());
    const original = full.data.fortunes.find(f => f.id === item.id);
    assert.deepEqual(item, { id: original.id, createdAt: original.createdAt, category: original.category || 'overall', title: original.title, summary: original.summary, name: original.analysis.name, dayMaster: original.analysis.dayMaster || '' });
  }
  const fullBytes = Buffer.byteLength(full.text), summaryBytes = Buffer.byteLength(summary.text);
  assert(summaryBytes < fullBytes * .1, 'Large archive fixture should transfer less than 10% of the previous payload');
  checks.push('120 compact summaries preserve order/search/category fields and omit full analysis/sections');
  assert.equal((await request('/api/saju?view=summary', {})).response.status, 401);
  assert.deepEqual((await request('/api/saju?view=summary', other)).data.fortuneSummaries, []);
  assert.equal((await request('/api/saju/archive-119', other)).response.status, 404);
  checks.push('summary and detail retain anonymous/cross-owner isolation');
  assert.equal((await request('/api/saju/archive-119')).data.fortune.sections[0].content, '상세한 합성 풀이 문장입니다. '.repeat(350));
  checks.push('legacy full-list and selected detail APIs remain complete');
  const { FORTUNE_SUMMARY_SQL } = await import('../../lib/db/fortune-summary.ts');
  const plan = (await d1.prepare('EXPLAIN QUERY PLAN ' + FORTUNE_SUMMARY_SQL).bind(owner['oai-authenticated-user-id']).all()).results;
  assert(plan.some(row => row.detail.includes('idx_fortunes_owner_created')));
  assert(!plan.some(row => row.detail.includes('TEMP B-TREE')));
  checks.push('summary query uses existing owner/date index without a temporary sort');
  if (process.env.SAJU_QA_BROWSER) {
    const { chromium } = await import(pathToFileURL(process.env.SAJU_QA_PLAYWRIGHT_PATH).href);
    browser = await chromium.launch({ executablePath: process.env.SAJU_QA_BROWSER, headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: owner });
    const origin = (await mf.ready).origin;
    const requests = [], errors = [];
    page.on('request', req => { if (new URL(req.url()).pathname.startsWith('/api/saju')) requests.push(new URL(req.url()).pathname + new URL(req.url()).search); });
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(origin + '/saved');
    await page.getByText('총 120권의 기록').waitFor();
    await page.screenshot({ path: path.join(output, process.env.SAJU_QA_BASELINE ? 'before-mobile.png' : 'after-mobile.png'), fullPage: false });
    assert.deepEqual(requests, ['/api/saju?view=summary'], 'Archive entry must fetch one compact list and no full readings');
    assert.deepEqual(errors, []);
    checks.push('mobile archive entry requests only one compact list');
  }
  assert.equal(outbound.length, 0);
  const result = { status: 'PASS', checks, fullBytes, summaryBytes, reductionPercent: Number((100 * (1 - summaryBytes / fullBytes)).toFixed(2)), queryPlan: plan, limits: ['Synthetic disposable local D1 only; not production latency', 'No production records read or changed', '3D art assets remain unchanged and are not validated by this test'] };
  await fs.writeFile(path.join(output, 'api-results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser?.close();
  await mf.dispose();
}
