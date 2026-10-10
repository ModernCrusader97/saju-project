// Actual TypeScript state boundary and built modal; POST replies are synthetic.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { Miniflare } from 'miniflare';

const root = process.cwd(), phase = process.env.SAJU_QA_PHASE || 'after';
assert(['before', 'after'].includes(phase));
const output = path.join(root, 'outputs/calendar-option-types', phase);
await fs.mkdir(output, { recursive: true });
const file = path.join(root, 'components/SajuInputModal.tsx');
const source = await fs.readFile(file, 'utf8');
const checks = [], observations = [], errors = [], outbound = [], bodies = [], dialogs = [], acceptedDialogs = [];
async function check(name, run) {
  console.log('RUN ' + name);
  try { await run(); checks.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
  catch (e) { checks.push({ name, status: 'FAIL', error: e.message }); console.error(e.message); }
}
await check('an invalid calendar option ID fails the actual state setter type check', async () => {
  const target = '{ id: "solar", label: "양력" }';
  assert.equal(source.split(target).length, 2);
  const mutated = source.replace(target, '{ id: "solra", label: "양력" }');
  const configFile = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
  assert.equal(configFile.error, undefined);
  const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root, { incremental: false });
  assert.equal(config.errors.length, 0);
  const host = ts.createCompilerHost(config.options), originalSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (name, version, ...args) => path.resolve(name) === file
    ? ts.createSourceFile(name, mutated, version, true)
    : originalSourceFile(name, version, ...args);
  const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram(config.fileNames, config.options, host));
  const records = diagnostics.map(d => ({ code: d.code, file: d.file ? path.relative(root, d.file.fileName) : null,
    line: d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : null,
    message: ts.flattenDiagnosticMessageText(d.messageText, '\n') }));
  observations.push({ scenario: 'in-memory typo solra, never written or executed', diagnostics: records });
  assert.equal(records.length, 1, 'The invalid option must produce one state-domain diagnostic');
  assert.equal(records[0].code, 2345); assert.equal(records[0].file, 'components/SajuInputModal.tsx');
  assert(mutated.split('\n')[records[0].line - 1].includes('setCalendarType(item.id)'));
});

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
  cf: false, telemetry: { enabled: false }, d1Databases: { DB: 'calendar-option-synthetic' }, d1Persist: false,
  assets: { directory: 'dist/client', routerConfig: { has_user_worker: true } },
  outboundService: async r => { outbound.push(new URL(r.url).hostname); return new Response('blocked', { status: 502 }); },
});
let browser;
try {
  const { chromium } = await import(pathToFileURL(process.env.SAJU_QA_PLAYWRIGHT_PATH).href);
  const origin = (await mf.ready).origin;
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: {
    'oai-authenticated-user-id': 'calendar-option-synthetic', 'oai-authenticated-user-email': 'qa@example.invalid',
  } });
  await context.route('**/*', r => new URL(r.request().url()).origin === origin
    ? r.continue() : (outbound.push(new URL(r.request().url()).hostname), r.abort()));
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); acceptedDialogs.push(d.message()); });
  await page.route('**/api/saju', r => {
    assert.equal(r.request().method(), 'POST'); bodies.push(r.request().postDataJSON());
    return r.fulfill({ status: 422, json: { error: '합성 달력 검사 응답' } });
  });
  await page.goto(origin + '/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '나의 성향', exact: true }).click();
  await page.getByPlaceholder('예: 홍길동').fill('합성 달력 검증');
  const yearSelector = 'form:has(input[placeholder="예: 홍길동"]) input[type="number"]';
  for (const [id, label, yearMax] of [['solar', '양력', '2100'], ['lunar', '음력 (평달)', '2050'], ['leap-lunar', '음력 (윤달)', '2050']]) {
    await check('native selection preserves the ' + id + ' payload and calendar year range', async () => {
      await page.getByRole('button', { name: label, exact: true }).click();
      await page.waitForFunction(({ selector, max }) => document.querySelector(selector)?.max === max,
        { selector: yearSelector, max: yearMax });
      assert.equal(await page.locator(yearSelector).first().getAttribute('max'), yearMax);
      const reply = page.waitForResponse(r => new URL(r.url()).pathname === '/api/saju' && r.request().method() === 'POST');
      await page.getByRole('button', { name: '나의 이야기 보기', exact: true }).click(); await reply;
      await page.getByPlaceholder('예: 홍길동').waitFor();
      await page.evaluate(async () => { for (let i = 0; i < 3; i++) await new Promise(r => requestAnimationFrame(r)); });
      const body = bodies.at(-1);
      assert.equal(body.calendarType, id); assert.equal(body.name, '합성 달력 검증');
      assert.equal(body.birthYear, 1995); assert.equal(body.birthMonth, 5); assert.equal(body.birthDay, 15);
      observations.push({ scenario: label, yearMax, payload: body });
      if (id === 'lunar') await page.screenshot({ path: path.join(output, 'selected-lunar.png') });
    });
  }
  await check('calendar checks have no page errors or outbound calls', async () => {
    assert.deepEqual(errors, []); assert.deepEqual(outbound, []); assert.equal(bodies.length, 3);
    assert.deepEqual(dialogs, Array(3).fill('합성 달력 검사 응답'));
    assert.deepEqual(acceptedDialogs, dialogs);
  });
  await context.close();
} finally {
  const report = { basis: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), phase,
    applicationSourceSHA256: createHash('sha256').update(source).digest('hex'),
    passed: checks.filter(c => c.status === 'PASS').length, failed: checks.filter(c => c.status === 'FAIL').length,
    checks, observations, errors, outbound,
    limits: ['The invalid ID is an in-memory compile-only mutation, never written or used in a request.',
      'Actual built modal and native Chromium events; synthetic POST replies prevent server writes and external AI calls.',
      'No runtime defect is claimed for the three existing valid choices. Server calendar calculations, hosted auth and other browsers are not tested.'] };
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  await browser?.close(); await mf.dispose();
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed })); process.exitCode = report.failed ? 1 : 0;
}
