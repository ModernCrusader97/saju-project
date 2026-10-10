// Built Manse form, native label clicks and keyboard events; no API calls.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Miniflare } from 'miniflare';
const root = process.cwd(), phase = process.env.SAJU_QA_PHASE || 'after';
assert(['before', 'after'].includes(phase));
const output = path.join(root, 'outputs/manse-form-labels', phase); await fs.mkdir(output, { recursive: true });
const { chromium } = await import(pathToFileURL(process.env.SAJU_QA_PLAYWRIGHT_PATH).href);
const fields = [['이름', 'textbox'], ['태어난 년도', 'spinbutton'], ['월', 'spinbutton'], ['일', 'spinbutton'], ['태어난 시 (0~23시):', 'spinbutton']];
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
  cf: false, telemetry: { enabled: false }, d1Databases: { DB: 'manse-label-synthetic' }, d1Persist: false,
  assets: { directory: 'dist/client', routerConfig: { has_user_worker: true } },
  outboundService: async r => { outbound.push(new URL(r.url).hostname); return new Response('blocked', { status: 502 }); },
});
let browser, origin;
async function view() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: {
    'oai-authenticated-user-id': 'manse-label-synthetic', 'oai-authenticated-user-email': 'qa@example.invalid',
  } });
  await context.route('**/*', r => new URL(r.request().url()).origin === origin
    ? r.continue() : (outbound.push(new URL(r.request().url()).hostname), r.abort()));
  await context.route('**/api/**', r => { api.push({ method: r.request().method(), path: new URL(r.request().url()).pathname }); return r.abort(); });
  const page = await context.newPage(); page.setDefaultTimeout(10000); page.on('pageerror', e => errors.push(e.message));
  await page.goto(origin + '/manse', { waitUntil: 'networkidle' });
  const submit = page.getByRole('button', { name: '정통 만세력 계산하기', exact: true });
  const form = page.locator('form').filter({ has: submit });
  const inputs = form.locator('input:not([type="checkbox"])'), unknown = form.getByRole('checkbox', { name: '시간 모름 (3주만 풀이)', exact: true });
  assert.equal(await inputs.count(), 5);
  const frames = () => page.evaluate(async () => { for (let i = 0; i < 3; i++) await new Promise(r => requestAnimationFrame(r)); });
  return { page, submit, form, inputs, unknown, frames, close: () => context.close() };
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
  await check('all five existing labels name their actual native controls', async v => {
    const records = [];
    for (let i = 0; i < fields.length; i++) {
      const [label, role] = fields[i];
      const native = await v.inputs.nth(i).evaluate(el => ({ id: el.id, type: el.type, value: el.value,
        labels: Array.from(el.labels || [], label => label.textContent.trim()),
        uniqueId: !!el.id && Array.from(document.querySelectorAll('[id]')).filter(other => other.id === el.id).length === 1 }));
      records.push({ label, role, namedControlCount: await v.form.getByRole(role, { name: label, exact: true }).count(), ...native });
    }
    observations.push({ scenario: 'existing label accessible names', records });
    await v.form.screenshot({ path: path.join(output, 'form.png') });
    assert(records.every(r => r.namedControlCount === 1 && r.uniqueId && r.labels.length === 1 && r.labels[0] === r.label));
  });
  await check('native clicks on each label focus its intended input', async v => {
    const records = [];
    for (let i = 0; i < fields.length; i++) {
      await v.submit.focus(); await v.form.getByText(fields[i][0], { exact: true }).click(); await v.frames();
      records.push({ label: fields[i][0], intendedInputFocused: await v.inputs.nth(i).evaluate(el => document.activeElement === el) });
    }
    observations.push({ scenario: 'native label activation', records }); assert(records.every(r => r.intendedInputFocused));
  });
  await check('native Tab order and disabled-hour skipping remain intact', async v => {
    await v.inputs.nth(0).focus();
    for (let i = 1; i < fields.length; i++) { await v.page.keyboard.press('Tab'); assert(await v.inputs.nth(i).evaluate(el => document.activeElement === el)); }
    await v.page.keyboard.press('Tab'); assert(await v.unknown.evaluate(el => document.activeElement === el));
    await v.page.keyboard.press('Space'); assert(await v.unknown.isChecked()); assert(await v.inputs.nth(4).isDisabled());
    await v.inputs.nth(3).focus(); await v.page.keyboard.press('Tab'); assert(await v.unknown.evaluate(el => document.activeElement === el));
    await v.page.keyboard.press('Shift+Tab'); assert(await v.inputs.nth(3).evaluate(el => document.activeElement === el));
    await v.page.keyboard.press('Tab'); assert(await v.unknown.evaluate(el => document.activeElement === el));
    await v.page.keyboard.press('Space'); assert(!(await v.unknown.isChecked())); assert(await v.inputs.nth(4).isEnabled()); assert.equal(await v.inputs.nth(4).inputValue(), '14');
  });
  await check('existing defaults and explicit calculation are preserved', async v => {
    const defaults = await v.inputs.evaluateAll(elements => elements.map(el => ({ type: el.type, value: el.value, min: el.min, max: el.max, maxLength: el.maxLength })));
    assert.deepEqual(defaults.map(e => e.value), ['홍길동', '1995', '5', '15', '14']);
    assert.equal(defaults[0].maxLength, 20); assert.deepEqual(defaults.slice(1).map(e => [e.min, e.max]), [['1900', '2100'], ['1', '12'], ['1', '31'], ['0', '23']]);
    for (const [i, value] of ['합성 연결', '2000', '1', '2', '12'].entries()) await v.inputs.nth(i).fill(value);
    await v.submit.click(); await v.page.getByText('합성 연결님의 사주 원국표', { exact: true }).waitFor();
    assert.equal(await v.form.getByRole('alert').count(), 0);
    observations.push({ scenario: 'defaults and calculation', defaults, resultName: '합성 연결' });
  });
  checks.push({ name: 'no page errors, API requests or outbound calls', status: errors.length || api.length || outbound.length ? 'FAIL' : 'PASS' });
  assert.deepEqual(errors, []); assert.deepEqual(api, []); assert.deepEqual(outbound, []);
} finally {
  const report = { basis: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), phase,
    applicationSourceSHA256: createHash('sha256').update(await fs.readFile('app/manse/page.tsx')).digest('hex'),
    passed: checks.filter(c => c.status === 'PASS').length, failed: checks.filter(c => c.status === 'FAIL').length,
    checks, observations, errors, api, outbound,
    limits: ['Actual built Manse form and native Chromium label/keyboard events at 390x844.',
      'No API call, real user DB or external AI call executes. Calendar calculation accuracy is outside this association change.',
      'Physical screen readers, hosted authentication, other browsers and physical devices are not tested.'] };
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  await browser?.close(); await mf.dispose(); console.log(JSON.stringify({ passed: report.passed, failed: report.failed })); process.exitCode = report.failed ? 1 : 0;
}
