// Built Home, native browser events and the actual input parser; no API writes.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Miniflare } from 'miniflare';
const root = process.cwd(), phase = process.env.SAJU_QA_PHASE || 'after';
assert(['before', 'after'].includes(phase));
const output = path.join(root, 'outputs/home-validation-state', phase);
await fs.mkdir(output, { recursive: true });
const require = createRequire(import.meta.url), { createLoader } = require('./load-ts.cjs');
const { parseSajuInput } = createLoader().load('lib/saju/input.ts');
const { chromium } = await import(pathToFileURL(process.env.SAJU_QA_PLAYWRIGHT_PATH).href);
const checks = [], observations = [], errors = [], outbound = [], api = [];
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
  cf: false, telemetry: { enabled: false }, d1Databases: { DB: 'home-validation-synthetic' }, d1Persist: false,
  assets: { directory: 'dist/client', routerConfig: { has_user_worker: true } },
  outboundService: async r => { outbound.push(new URL(r.url).hostname); return new Response('blocked', { status: 502 }); },
});
let browser, origin;
async function view() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: {
    'oai-authenticated-user-id': 'home-validation-synthetic', 'oai-authenticated-user-email': 'qa@example.invalid',
  } });
  await context.route('**/*', r => new URL(r.request().url()).origin === origin
    ? r.continue() : (outbound.push(new URL(r.request().url()).hostname), r.abort()));
  await context.route('**/api/**', r => { api.push({ method: r.request().method(), path: new URL(r.request().url()).pathname }); return r.abort(); });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  page.on('pageerror', e => errors.push(e.message));
  const destinations = [];
  await page.route('**/planet?*', r => {
    assert(r.request().isNavigationRequest()); destinations.push(Object.fromEntries(new URL(r.request().url()).searchParams));
    return r.fulfill({ contentType: 'text/html', body: '<!doctype html><body>QA validated destination</body>' });
  });
  await page.goto(origin + '/', { waitUntil: 'networkidle' });
  const form = page.locator('#birth-form');
  const input = label => form.getByLabel(label, { exact: true });
  const send = () => form.getByRole('button', { name: '나의 우주 보기', exact: true }).click();
  const frames = () => page.evaluate(async () => { for (let i = 0; i < 3; i++) await new Promise(r => requestAnimationFrame(r)); });
  const badDate = async () => {
    await input('연도').fill('2000'); await input('월').fill('2'); await input('일').fill('30'); await send();
    await form.getByRole('alert').waitFor(); assert((await form.getByRole('alert').textContent()).includes('존재하지 않는 생년월일'));
  };
  const draft = async () => ({ name: (await input('이름 또는 별명').inputValue()).trim() || '나', gender: 'male', calendarType: 'solar',
    birthYear: await input('연도').inputValue(), birthMonth: await input('월').inputValue(), birthDay: await input('일').inputValue(),
    birthHour: (await input('시간 모름').isChecked()) ? undefined : await input('태어난 시각').inputValue(),
    isUnknownTime: await input('시간 모름').isChecked() });
  return { page, form, input, send, frames, badDate, draft, destinations, close: () => context.close() };
}
async function check(name, run) {
  console.log('RUN ' + name); const v = await view();
  try { await run(v); checks.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
  catch (e) { checks.push({ name, status: 'FAIL', error: e.message }); console.error(e.message); }
  finally { await v.close(); }
}
try {
  origin = (await mf.ready).origin;
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  await check('correcting an invalid date removes the previous attempt error', async v => {
    await v.badDate(); await v.input('일').fill('29'); await v.frames();
    const parsed = parseSajuInput(await v.draft()); assert.equal(parsed.birthDay, 29);
    const alert = await v.form.getByRole('alert').allTextContents();
    observations.push({ scenario: 'corrected leap-day draft', acceptedDate: parsed.solarBirthDate, alert, destinations: v.destinations });
    await v.form.screenshot({ path: path.join(output, 'corrected-date.png') });
    assert.deepEqual(alert, []); assert.deepEqual(v.destinations, []);
  });
  await check('unknown time removes the obsolete known-hour error', async v => {
    await v.input('태어난 시각').fill(''); await v.send(); await v.form.getByRole('alert').waitFor();
    assert((await v.form.getByRole('alert').textContent()).includes('0~23'));
    await v.input('시간 모름').check(); await v.frames(); assert(await v.input('태어난 시각').isDisabled());
    const parsed = parseSajuInput(await v.draft()); assert.equal(parsed.isUnknownTime, true); assert.equal(parsed.birthHour, undefined);
    const alert = await v.form.getByRole('alert').allTextContents();
    observations.push({ scenario: 'known-hour failure changed to unknown time', isUnknownTime: parsed.isUnknownTime, alert });
    await v.form.screenshot({ path: path.join(output, 'unknown-time.png') }); assert.deepEqual(alert, []);
  });
  await check('correcting a known hour removes the previous hour error', async v => {
    await v.input('태어난 시각').fill(''); await v.send(); await v.form.getByRole('alert').waitFor();
    await v.input('태어난 시각').fill('20'); await v.frames();
    assert.equal(parseSajuInput(await v.draft()).birthHour, 20);
    assert.equal(await v.form.getByRole('alert').count(), 0);
  });
  await check('focus without editing retains the current attempt error', async v => {
    await v.badDate(); const before = await v.form.getByRole('alert').textContent();
    await v.input('일').focus(); await v.frames(); assert.equal(await v.form.getByRole('alert').textContent(), before);
    assert.deepEqual(v.destinations, []);
  });
  await check('editing an invalid draft clears the old error and resubmission validates again', async v => {
    await v.badDate(); await v.input('일').fill('31'); await v.frames();
    assert.equal(await v.form.getByRole('alert').count(), 0); assert.throws(() => parseSajuInput({ name: '나', birthYear: 2000, birthMonth: 2, birthDay: 31 }));
    await v.send(); await v.form.getByRole('alert').waitFor();
    assert((await v.form.getByRole('alert').textContent()).includes('존재하지 않는 생년월일'));
    assert.equal(await v.input('일').inputValue(), '31'); assert.deepEqual(v.destinations, []);
  });
  await check('explicit resubmission uses the corrected draft and existing destination query', async v => {
    await v.badDate(); await v.input('이름 또는 별명').fill('  합성 교정  '); await v.input('일').fill('29'); await v.send();
    await v.page.waitForURL('**/planet?*');
    assert.deepEqual(v.destinations, [{ name: '합성 교정', y: '2000', m: '2', d: '29', h: '14', unknown: 'false' }]);
    observations.push({ scenario: 'manual corrected resubmission', destinations: v.destinations });
  });
  await check('editing the separate reading modal preserves the birth-form error', async v => {
    await v.badDate(); const before = await v.form.getByRole('alert').textContent();
    await v.page.getByRole('button', { name: '나의 성향', exact: true }).click();
    await v.page.getByPlaceholder('예: 홍길동').fill('합성 별도 입력'); await v.frames();
    assert.equal(await v.form.getByRole('alert').textContent(), before); await v.page.keyboard.press('Escape');
    assert.equal(await v.form.getByRole('alert').textContent(), before); assert.deepEqual(v.destinations, []);
  });
  checks.push({ name: 'no page errors, API requests or outbound calls', status: errors.length || api.length || outbound.length ? 'FAIL' : 'PASS' });
  assert.deepEqual(errors, []); assert.deepEqual(api, []); assert.deepEqual(outbound, []);
} finally {
  const report = { basis: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), phase,
    applicationSourceSHA256: createHash('sha256').update(await fs.readFile('app/page.tsx')).digest('hex'),
    passed: checks.filter(c => c.status === 'PASS').length, failed: checks.filter(c => c.status === 'FAIL').length,
    checks, observations, errors, api, outbound,
    limits: ['Actual built Home and native Chromium events; corrected DOM values also pass the actual CPU input parser.',
      'Only the destination document response is replaced. No planet renderer, API write, real user DB or external AI call executes.',
      'Hosted authentication, other browsers and physical devices are not tested.'] };
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  await browser?.close(); await mf.dispose();
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed })); process.exitCode = report.failed ? 1 : 0;
}
