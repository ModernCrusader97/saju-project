// Real built Worker/D1 and browser form, with disposable synthetic records only.
// Run npm run build first. QA tool paths are optional checkout-local overrides.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Miniflare } from 'miniflare';

const root = fileURLToPath(new URL('../..', import.meta.url));
const output = path.join(root, 'outputs/name-idempotence');
await fs.mkdir(output, { recursive: true });
const require = createRequire(import.meta.url);
const { createLoader } = require('./load-ts.cjs');
const loader = createLoader();
const { parseSajuInput } = loader.load('lib/saju/input.ts');
const { analyzeSaju } = loader.load('lib/saju/manse.ts');
const birth = { gender: 'male', birthYear: 1995, birthMonth: 5, birthDay: 15,
  birthHour: 13, birthMinute: 30, isUnknownTime: false, calendarType: 'solar' };
const cases = [
  { label: 'ordinary name and trim', raw: '  합성 이름  ', expected: '합성 이름' },
  { label: 'over 50 BMP units', raw: '가'.repeat(51), expected: '가'.repeat(50) },
  { label: 'emoji fits at 50 units', raw: '가'.repeat(48) + '😀', expected: '가'.repeat(48) + '😀' },
  { label: 'emoji crosses 50 units', raw: '가'.repeat(49) + '😀', expected: '가'.repeat(49) },
  { label: 'space exposed by crossing emoji', raw: '가'.repeat(48) + ' 😀', expected: '가'.repeat(48) },
  { label: 'Unicode spaces exposed by crossing emoji', raw: '가'.repeat(47) + '\u00a0\u3000😀', expected: '가'.repeat(47) },
  { label: '26 emoji retain the 50-unit limit', raw: '😀'.repeat(26), expected: '😀'.repeat(25) },
];
const owner = { 'oai-authenticated-user-id': 'name-boundary-fixture', 'oai-authenticated-user-email': 'qa@example.invalid' };
const other = { 'oai-authenticated-user-id': 'name-boundary-other', 'oai-authenticated-user-email': 'other@example.invalid' };
const checks = [], outbound = [], errors = [], observations = [];
const fortuneNames = new Map();
async function check(name, run) {
  try { await run(); checks.push({ name, status: 'PASS' }); }
  catch (error) { checks.push({ name, status: 'FAIL', error: error.message }); }
}
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
const modules = [entry, ...(await walk(path.join(root, 'dist/server'))).filter(file => file !== entry)]
  .map(file => ({ type: 'ESModule', path: file }));
const mf = new Miniflare({ rootPath: root, modules, modulesRoot: 'dist/server',
  compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'], host: '127.0.0.1', port: 0,
  cf: false, logRequests: false, telemetry: { enabled: false },
  d1Databases: { DB: 'name-boundary-synthetic' }, d1Persist: false,
  assets: { directory: 'dist/client', routerConfig: { has_user_worker: true } },
  outboundService: async request => { outbound.push(new URL(request.url).hostname); return new Response('blocked', { status: 502 }); },
});
function normalized(actual, expected) {
  assert.equal(actual, expected);
  assert(actual.isWellFormed(), 'Saved name must remain valid UTF-16');
  assert(actual.length <= 50, 'Saved name must keep the UTF-16 unit limit');
}
async function request(url, body, headers = owner) {
  const response = await mf.dispatchFetch('http://preview.test' + url, {
    headers: { ...headers, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }),
  });
  return { response, data: await response.json() };
}
let browser, browserVersion;
try {
  const d1 = await mf.getD1Database('DB');
  for (const file of (await fs.readdir(path.join(root, 'drizzle'))).filter(file => file.endsWith('.sql')).sort()) {
    for (const sql of (await fs.readFile(path.join(root, 'drizzle', file), 'utf8')).split('--> statement-breakpoint')) {
      if (sql.trim()) await d1.prepare(sql.trim()).run();
    }
  }
  for (const fixture of cases) await check('API/local calculation/detail/summary: ' + fixture.label, async () => {
    const created = await request('/api/saju', { ...birth, name: fixture.raw });
    assert.equal(created.response.status, 200);
    fortuneNames.set(fixture.label, created.data.fortune.analysis.name);
    const input = parseSajuInput({ ...birth, name: fixture.raw });
    observations.push({ flow: 'fortune', fixture: fixture.label, firstUnits: input.name.length,
      secondUnits: parseSajuInput(input).name.length, storedUnits: created.data.fortune.analysis.name.length,
      namesAgree: input.name === created.data.fortune.analysis.name });
    normalized(input.name, fixture.expected);
    normalized(created.data.fortune.analysis.name, fixture.expected);
    const local = analyzeSaju(input);
    assert.equal(local.name, created.data.fortune.analysis.name);
    const id = created.data.fortune.id;
    normalized((await request('/api/saju/' + id)).data.fortune.analysis.name, fixture.expected);
    const summaries = (await request('/api/saju?view=summary')).data.fortuneSummaries;
    normalized(summaries.find(item => item.id === id).name, fixture.expected);
  });
  const map = await request('/api/guin', { ...birth, name: '합성 지도' });
  assert.equal(map.response.status, 200);
  for (const fixture of cases) await check('map owner/save/readback: ' + fixture.label, async () => {
    const created = await request('/api/guin', { ...birth, name: fixture.raw });
    assert.equal(created.response.status, 200);
    observations.push({ flow: 'map owner', fixture: fixture.label, storedUnits: created.data.guinMap.ownerName.length,
      namesAgree: created.data.guinMap.ownerName === fortuneNames.get(fixture.label) });
    normalized(created.data.guinMap.ownerName, fixture.expected);
    assert.equal(created.data.guinMap.ownerName, fortuneNames.get(fixture.label));
    assert.equal(created.data.guinMap.guins[0].name, fixture.expected + ' (나)');
    const saved = (await request('/api/guin/' + created.data.guinMap.id)).data.guinMap;
    normalized(saved.ownerName, fixture.expected);
    assert.equal(saved.guins[0].name, fixture.expected + ' (나)');
  });
  for (const fixture of cases) await check('map friend/save/readback: ' + fixture.label, async () => {
    const added = await request('/api/guin/' + map.data.guinMap.id, { ...birth, friendName: fixture.raw });
    assert.equal(added.response.status, 200);
    observations.push({ flow: 'map friend', fixture: fixture.label, storedUnits: added.data.newPerson.name.length,
      namesAgree: added.data.newPerson.name === fortuneNames.get(fixture.label) });
    normalized(added.data.newPerson.name, fixture.expected);
    assert.equal(added.data.newPerson.name, fortuneNames.get(fixture.label));
    const saved = (await request('/api/guin/' + map.data.guinMap.id)).data.guinMap;
    normalized(saved.guins.find(person => person.id === added.data.newPerson.id).name, fixture.expected);
  });
  await check('invalid names still return 400 and save no records', async () => {
    const count = async () => (await d1.prepare('SELECT COUNT(*) AS count FROM fortunes').first()).count;
    const before = await count();
    for (const name of ['', ' \t\n ', null, 42]) {
      const rejected = await request('/api/saju', { ...birth, name });
      assert.equal(rejected.response.status, 400);
      assert.equal(rejected.data.error, '이름을 입력해주세요.');
    }
    assert.equal(await count(), before);
  });
  await check('anonymous and other-owner list isolation remains intact', async () => {
    assert.equal((await request('/api/saju?view=summary', undefined, {})).response.status, 401);
    assert.deepEqual((await request('/api/saju?view=summary', undefined, other)).data.fortuneSummaries, []);
  });

  const playwrightPath = process.env.SAJU_QA_PLAYWRIGHT_PATH || path.join(root, '.sites-runtime/test-tools/node_modules/playwright/index.mjs');
  const { chromium } = await import(pathToFileURL(playwrightPath).href);
  browser = await chromium.launch({ ...(process.env.SAJU_QA_CHROME ? { executablePath: process.env.SAJU_QA_CHROME } : {}),
    headless: true, args: ['--no-sandbox'] });
  browserVersion = await browser.version();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: owner });
  const origin = (await mf.ready).origin;
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
    outbound.push(url.hostname); return route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  let submitted = 0;
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/saju' && request.method() === 'POST') submitted++; });
  async function openForm() {
    await page.goto(origin + '/', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '나의 성향', exact: true }).click();
    await page.getByPlaceholder('예: 홍길동', { exact: true }).waitFor();
  }
  for (const fixture of cases) await check('browser form/API agree: ' + fixture.label, async () => {
    await openForm();
    await page.getByPlaceholder('예: 홍길동', { exact: true }).fill(fixture.raw);
    const pending = page.waitForResponse(response => new URL(response.url()).pathname === '/api/saju'
      && response.request().method() === 'POST');
    await page.getByRole('button', { name: '나의 이야기 보기', exact: true }).click();
    const response = await pending;
    assert.equal(response.status(), 200);
    normalized((await response.json()).fortune.analysis.name, fixture.expected);
    await page.getByRole('heading', { name: '이번에 남긴 기록', exact: true }).waitFor();
    const heading = page.getByRole('heading', { name: fixture.expected + '님의 사주팔자 (四柱)', exact: true });
    await heading.waitFor();
    assert.equal((await heading.textContent()).trim(), fixture.expected + '님의 사주팔자 (四柱)');
  });
  await check('browser whitespace name keeps validation and makes no API request', async () => {
    await openForm();
    await page.getByPlaceholder('예: 홍길동', { exact: true }).fill('   ');
    const before = submitted;
    const pending = page.waitForEvent('dialog').then(async dialog => {
      assert.equal(dialog.message(), '이름을 입력해주세요.');
      await dialog.accept();
    });
    await page.getByRole('button', { name: '나의 이야기 보기', exact: true }).click();
    await pending;
    assert.equal(submitted, before);
  });
  await check('no external calls or browser exceptions', async () => {
    assert.deepEqual(outbound, []);
    assert.deepEqual(errors, []);
  });
} catch (error) { checks.push({ name: 'harness', status: 'FAIL', error: error.stack || String(error) }); }
finally {
  if (browser) await browser.close();
  await mf.dispose();
}
const report = { status: checks.every(check => check.status === 'PASS') ? 'PASS' : 'FAIL', browserVersion, checks, observations,
  limits: ['Synthetic disposable local D1 and identity only', 'No hosted login, production records or external AI calls', 'No new character-count, grapheme or question policy'] };
const phase = process.env.SAJU_QA_PHASE === 'before' ? 'before' : 'after';
await fs.writeFile(path.join(output, 'flow-' + phase + '-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (report.status !== 'PASS') process.exitCode = 1;
