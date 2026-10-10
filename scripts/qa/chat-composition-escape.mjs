// Actual built chat dialog; CDP composition and trusted native keyboard/pointer events.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Miniflare } from 'miniflare';
import { fullReading as full } from './detail-result-fixtures.mjs';

const root = process.cwd(), phase = process.env.SAJU_QA_PHASE || 'after';
assert(['before', 'after'].includes(phase));
const output = path.join(root, 'outputs/chat-composition-escape', phase);
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
  cf: false, telemetry: { enabled: false }, d1Databases: { DB: 'chat-composition-synthetic' }, d1Persist: false,
  assets: { directory: 'dist/client', routerConfig: { has_user_worker: true } },
  outboundService: async r => { outbound.push(new URL(r.url).hostname); return new Response('blocked', { status: 502 }); },
});
let browser, origin;
async function view() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: {
    'oai-authenticated-user-id': 'chat-composition-synthetic', 'oai-authenticated-user-email': 'qa@example.invalid',
  } });
  await context.addInitScript(() => {
    window.__chatCompositionEvents = [];
    for (const type of ['compositionstart', 'compositionupdate', 'compositionend', 'input', 'keydown']) {
      document.addEventListener(type, event => {
        if (event.target?.getAttribute?.('aria-label') !== '사주 풀이 질문') return;
        window.__chatCompositionEvents.push({ type, key: event.key, isComposing: event.isComposing,
          isTrusted: event.isTrusted, inputType: event.inputType, data: event.data, value: event.target.value });
      });
    }
  });
  const errors = [], consoleErrors = [], requests = [];
  await context.route('**/*', r => {
    const u = new URL(r.request().url());
    if (u.origin !== origin) { outbound.push(u.hostname); return r.abort(); }
    if (u.pathname.startsWith('/api/')) {
      const request = { path: u.pathname, method: r.request().method() }; requests.push(request);
      if (request.method === 'GET' && u.pathname === '/api/saju' && u.searchParams.get('view') === 'summary')
        return r.fulfill({ json: { fortuneSummaries: [] } });
      if (request.method === 'GET' && u.pathname === '/api/saju/a')
        return r.fulfill({ json: { fortune: full('a'), chats: [] } });
      unexpectedApi.push(request); return r.abort();
    }
    return r.continue();
  });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  await page.goto(origin + '/saved?id=a', { waitUntil: 'networkidle' });
  const input = page.getByRole('textbox', { name: '사주 풀이 질문', exact: true });
  const protocol = await context.newCDPSession(page);
  const frames = () => page.evaluate(async () => { for (let i = 0; i < 3; i++) await new Promise(r => requestAnimationFrame(r)); });
  const open = async () => {
    await page.getByRole('button', { name: '풀이에 관해 더 물어보기', exact: true }).click();
    await page.waitForFunction(() => { const el = document.querySelector('input[aria-label="사주 풀이 질문"]'); return el && !el.disabled; });
    await frames();
  };
  const compose = async () => {
    await protocol.send('Input.imeSetComposition', { text: 'ㅎ', selectionStart: 1, selectionEnd: 1 });
    await protocol.send('Input.imeSetComposition', { text: '한글', selectionStart: 2, selectionEnd: 2 }); await frames();
  };
  const key = async () => { await page.keyboard.press('Escape'); await frames(); };
  return { page, input, protocol, open, compose, key, frames, errors, consoleErrors, requests,
    events: () => page.evaluate(() => window.__chatCompositionEvents), close: () => context.close() };
}
async function check(name, run) {
  console.log('RUN ' + name); const v = await view();
  try { await run(v); checks.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
  catch (e) { checks.push({ name, status: 'FAIL', error: e.message }); console.error(e.message); }
  finally { observations.push({ name, events: await v.events(), errors: v.errors, consoleErrors: v.consoleErrors, requests: v.requests }); await v.close(); }
}
try {
  origin = (await mf.ready).origin;
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  await check('active-composition Escape keeps the chat open and the committed prefix intact', async v => {
    const prefix = '합성 질문 '; await v.open(); await v.input.fill(prefix);
    await v.page.screenshot({ path: path.join(output, 'chat-open.png'), animations: 'disabled' });
    await v.compose(); assert.equal(await v.input.inputValue(), prefix + '한글');
    await v.key();
    await v.page.screenshot({ path: path.join(output, 'after-composing-escape.png'), animations: 'disabled' });
    const events = await v.events(), escape = events.find(e => e.type === 'keydown' && e.key === 'Escape');
    assert(events.some(e => e.type === 'compositionstart' && e.isTrusted));
    assert(events.some(e => e.type === 'input' && e.inputType === 'insertCompositionText' && e.isComposing && e.isTrusted));
    assert(escape?.isTrusted && escape.isComposing, 'actual Chromium Escape must be sent during native composition');
    assert.equal(await v.input.count(), 1, 'IME Escape must not invoke dialog close');
    assert((await v.input.inputValue()).startsWith(prefix), 'the already committed question prefix must survive');
    assert(await v.input.evaluate(el => document.activeElement === el));
  });
  await check('ordinary native Escape closes the dialog and reopening retains the draft', async v => {
    await v.open(); await v.input.fill('합성 일반 질문'); await v.key(); assert.equal(await v.input.count(), 0);
    const escape = (await v.events()).find(e => e.type === 'keydown' && e.key === 'Escape'); assert(escape?.isTrusted && !escape.isComposing);
    await v.open(); assert.equal(await v.input.inputValue(), '합성 일반 질문');
  });
  await check('Escape after composition commit still closes and preserves the complete question', async v => {
    const prefix = '합성 확정 '; await v.open(); await v.input.fill(prefix); await v.compose();
    await v.protocol.send('Input.insertText', { text: '한글' }); await v.frames(); assert.equal(await v.input.inputValue(), prefix + '한글');
    await v.key(); assert.equal(await v.input.count(), 0);
    const events = await v.events(), escape = events.find(e => e.type === 'keydown' && e.key === 'Escape');
    assert(events.some(e => e.type === 'compositionend')); assert(escape?.isTrusted && !escape.isComposing);
    await v.open(); assert.equal(await v.input.inputValue(), prefix + '한글');
  });
  await check('Escape after composition cancellation still closes and retains the committed prefix', async v => {
    const prefix = '합성 취소 '; await v.open(); await v.input.fill(prefix); await v.compose();
    await v.protocol.send('Input.imeSetComposition', { text: '', selectionStart: 0, selectionEnd: 0 }); await v.frames();
    assert.equal(await v.input.inputValue(), prefix); await v.key(); assert.equal(await v.input.count(), 0);
    const escape = (await v.events()).find(e => e.type === 'keydown' && e.key === 'Escape'); assert(escape?.isTrusted && !escape.isComposing);
    await v.open(); assert.equal(await v.input.inputValue(), prefix);
  });
  await check('native close button and backdrop pointer still close and retain the draft', async v => {
    await v.open(); await v.input.fill('합성 명시적 닫기');
    await v.page.getByRole('button', { name: '대화 닫기', exact: true }).click(); assert.equal(await v.input.count(), 0);
    await v.open(); assert.equal(await v.input.inputValue(), '합성 명시적 닫기');
    const backdrop = v.page.locator('div.fixed.inset-0').filter({ has: v.input });
    const rect = await backdrop.boundingBox(); assert(rect); await v.page.mouse.click(rect.x + 4, rect.y + 4); await v.frames();
    assert.equal(await v.input.count(), 0); await v.open(); assert.equal(await v.input.inputValue(), '합성 명시적 닫기');
  });
  checks.push({ name: 'no browser errors, unexpected API requests, chat POSTs or outbound calls',
    status: unexpectedApi.length || outbound.length || observations.some(o => o.errors.length || o.consoleErrors.length || o.requests.some(r => r.method !== 'GET')) ? 'FAIL' : 'PASS' });
} finally {
  const report = { basis: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), phase,
    applicationSourceSHA256: createHash('sha256').update(await fs.readFile('components/AskDoryeongModal.tsx')).digest('hex'),
    passed: checks.filter(c => c.status === 'PASS').length, failed: checks.filter(c => c.status === 'FAIL').length,
    checks, observations, outbound, unexpectedApi,
    coverage: { compositionSource: 'CDP Input.imeSetComposition / Input.insertText', escapeSource: 'Chromium native keyboard',
      domKeyboardDispatches: 0, handlerInvocations: 0, programmaticSubmissions: 0, chatPOSTs: 0 },
    limits: ['Actual built chat dialog in Chromium at 390x844; composition-start/update and Escape events are trusted browser events.',
      'Composition is synthesized through CDP; physical keyboards and OS IMEs are not tested.',
      'Only valid intercepted synthetic GET responses; no actual user DB, chat sending, recovery/error-response rerun or external AI.',
      'Other browsers, physical devices, screen readers, hosted authentication and unrelated completed flows are not tested.'] };
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  await browser?.close(); await mf.dispose();
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed })); process.exitCode = report.failed ? 1 : 0;
}
