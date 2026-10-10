// Built application, native keyboard events and local synthetic D1 only.
// No .focus()/.click(), synthetic rAF, hosted auth, or external API requests.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { Miniflare } from 'miniflare';
import { fullReading, summaries } from './detail-result-fixtures.mjs';

const root = process.cwd(), phase = process.env.SAJU_QA_PHASE || 'after';
assert(['before', 'after'].includes(phase));
const output = path.join(root, 'outputs/error-keyboard', phase);
await fs.mkdir(output, { recursive: true });
const { chromium } = await import(pathToFileURL(process.env.SAJU_QA_PLAYWRIGHT_PATH ||
  path.join(root, '.sites-runtime/test-tools/node_modules/playwright/index.mjs')).href);
const checks = [], observations = [], errors = [], consoleErrors = [], outbound = [];
const headers = { 'oai-authenticated-user-id': 'error-keyboard-synthetic', 'oai-authenticated-user-email': 'qa@example.invalid' };
const sha = value => createHash('sha256').update(value).digest('hex');
async function walk(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(file)); else if (/\.m?js$/.test(file)) files.push(file);
  }
  return files;
}
const entry = path.join(root, 'dist/server/index.js');
const mf = new Miniflare({ rootPath: root, modulesRoot: 'dist/server',
  modules: [entry, ...(await walk(path.join(root, 'dist/server'))).filter(file => file !== entry)].map(file => ({ type: 'ESModule', path: file })),
  compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'], host: '127.0.0.1', port: 0,
  cf: false, logRequests: false, telemetry: { enabled: false }, d1Databases: { DB: 'error-keyboard-synthetic' }, d1Persist: false,
  assets: { directory: 'dist/client', routerConfig: { has_user_worker: true } },
  outboundService: async request => { outbound.push(new URL(request.url).hostname); return new Response('blocked', { status: 502 }); },
});
async function check(name, run) {
  console.log('RUN ' + name);
  try { await run(); checks.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
  catch (error) { checks.push({ name, status: 'FAIL', error: error.stack }); console.error(error.message); }
}
const focused = locator => locator.evaluate(element => element === document.activeElement);
async function tabTo(page, locator) {
  for (let i = 0; i < 80; i++) {
    if (await focused(locator)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error('Native Tab cannot reach ' + await locator.evaluate(element => element.outerHTML.slice(0, 200)));
}
async function focusState(page) {
  // Native keyboard scrolling must settle before checking actual visibility.
  await page.evaluate(async () => {
    let previous = '', stable = 0;
    for (let i = 0; i < 120 && stable < 4; i++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      const r = document.activeElement.getBoundingClientRect(), current = [scrollY, r.top, r.bottom].join(',');
      stable = current === previous ? stable + 1 : 0; previous = current;
    }
  });
  return page.evaluate(() => {
    const e = document.activeElement, r = e.getBoundingClientRect(), style = getComputedStyle(e);
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { tag: e.tagName, name: e.getAttribute('aria-label') || e.textContent.trim().slice(0, 70),
      visible: r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight,
      unobscured: hit === e || e.contains(hit), focusVisible: e.matches(':focus-visible'),
      outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth,
      top: r.top, bottom: r.bottom, scrollY, hitTag: hit?.tagName,
      hitName: hit?.getAttribute('aria-label') || hit?.textContent?.trim().slice(0, 70) };
  });
}
let browser, browserVersion, origin, mapPath;
async function view(width, webglSupported = true) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, extraHTTPHeaders: headers });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
    outbound.push(url.hostname); return route.abort();
  });
  if (!webglSupported) await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      return /^webgl/.test(type) ? null : original.call(this, type, ...args);
    };
  });
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  return { page, close: () => context.close() };
}
async function openMap(v, fallback) {
  await v.page.goto(origin + mapPath, { waitUntil: 'networkidle' });
  await v.page.waitForSelector('[data-scene="galaxy"][data-scene-state="' + (fallback ? 'fallback' : 'ready') + '"]');
}
async function slotDialog(page) {
  return page.getByText('합성 키보드 친구님의 사주 행성 구성', { exact: true }).locator('..').locator('..').locator('..').locator('..');
}
try {
  const db = await mf.getD1Database('DB');
  for (const file of (await fs.readdir(path.join(root, 'drizzle'))).filter(file => file.endsWith('.sql')).sort())
    for (const sql of (await fs.readFile(path.join(root, 'drizzle', file), 'utf8')).split('--> statement-breakpoint')) if (sql.trim()) await db.prepare(sql.trim()).run();
  origin = (await mf.ready).origin;
  const input = { name: '합성 키보드 검증', birthYear: 2000, birthMonth: 1, birthDay: 1, birthHour: 12, birthMinute: 30, isUnknownTime: false };
  const owner = await fetch(origin + '/api/guin', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(input) });
  assert.equal(owner.status, 200); mapPath = '/guin/' + (await owner.json()).guinMap.id;
  const friend = await fetch(origin + '/api' + mapPath, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ ...input, friendName: '합성 키보드 친구' }) });
  assert.equal(friend.status, 200);
  browser = await chromium.launch({ executablePath: process.env.SAJU_QA_CHROME || '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  browserVersion = await browser.version();

  for (const width of [390, 1440]) {
    await check('fallback people use visible native Tab, Enter and Space at ' + width + 'px', async () => {
      const v = await view(width, false);
      try {
        await openMap(v, true);
        assert.equal(await v.page.locator('[data-scene="galaxy"] [role="status"] strong').textContent(),
          '3D 화면을 사용할 수 없어요. WebGL을 지원하는 브라우저에서 다시 열어주세요.');
        const people = v.page.locator('.scene-fallback-list button');
        await tabTo(v.page, people.nth(0)); const ownerFocus = await focusState(v.page);
        await v.page.keyboard.press('Enter');
        assert.equal(await v.page.getByText('나의 중심별', { exact: true }).count(), 1);
        await v.page.keyboard.press('Tab'); assert(await focused(people.nth(1)));
        const friendFocus = await focusState(v.page); await v.page.keyboard.press('Space');
        await v.page.locator('[title="4기둥 행성 슬롯 상세 보기"]').waitFor();
        observations.push({ scenario: 'fallback native person selection', width, ownerFocus, friendFocus });
        for (const f of [ownerFocus, friendFocus]) assert(f.visible && f.unobscured && f.focusVisible && f.outlineWidth === '3px');
      } finally { await v.close(); }
    });
    await check('fallback slot dialog contains keyboard focus, closes and returns focus at ' + width + 'px', async () => {
      const v = await view(width, false);
      try {
        await openMap(v, true); await tabTo(v.page, v.page.locator('.scene-fallback-list button').nth(1));
        await v.page.keyboard.press('Enter');
        const trigger = v.page.locator('[title="4기둥 행성 슬롯 상세 보기"]');
        await tabTo(v.page, trigger); await v.page.keyboard.press('Enter');
        const dialog = await slotDialog(v.page); await dialog.waitFor();
        const buttons = dialog.locator('button'); assert.equal(await buttons.count(), 2);
        const opened = await focusState(v.page);
        const firstInitiallyFocused = await focused(buttons.nth(0));
        const semantics = { role: await dialog.getAttribute('role'), modal: await dialog.getAttribute('aria-modal'),
          label: await dialog.getAttribute('aria-labelledby'), closeLabel: await buttons.nth(0).getAttribute('aria-label') };
        // Continue through every behavior before asserting, preserving baseline evidence.
        await tabTo(v.page, buttons.nth(0)); await v.page.keyboard.press('Shift+Tab');
        const reverseWrap = await focused(buttons.nth(1));
        const reverseFocus = await focusState(v.page);
        await tabTo(v.page, buttons.nth(1)); await v.page.keyboard.press('Tab');
        const forwardWrap = await focused(buttons.nth(0));
        const forwardFocus = await focusState(v.page);
        await v.page.screenshot({ path: path.join(output, 'dialog-' + width + '.png') });
        await v.page.keyboard.press('Escape');
        const escaped = await dialog.count() === 0, returned = await focused(trigger);
        const returnedFocus = await focusState(v.page);
        await v.page.screenshot({ path: path.join(output, 'returned-' + width + '.png') });
        if (escaped) {
          await v.page.keyboard.press('Space'); await dialog.waitFor();
          await tabTo(v.page, dialog.getByRole('button', { name: '닫기', exact: true }));
          await v.page.keyboard.press('Enter'); assert.equal(await dialog.count(), 0); assert(await focused(trigger));
          await v.page.keyboard.press('Enter'); await dialog.waitFor(); await v.page.keyboard.press('Space');
          assert.equal(await dialog.count(), 0); assert(await focused(trigger));
        }
        const facts = { width, opened, firstInitiallyFocused, semantics, reverseWrap, reverseFocus, forwardWrap,
          forwardFocus, escaped, returned, returnedFocus };
        observations.push({ scenario: 'fallback slot dialog', ...facts });
        assert(firstInitiallyFocused && opened.visible && opened.unobscured, 'opening the overlay must move keyboard focus to its visible close control');
        assert.equal(semantics.role, 'dialog'); assert.equal(semantics.modal, 'true'); assert(semantics.label); assert(semantics.closeLabel);
        assert(reverseWrap && forwardWrap, 'Tab and Shift+Tab must stay inside the open dialog');
        assert(escaped && returned, 'Escape closes the dialog and returns focus to its trigger');
        for (const f of [reverseFocus, forwardFocus, returnedFocus])
          assert(f.visible && f.unobscured && f.focusVisible && f.outlineWidth === '3px', 'wrapped and returned keyboard focus must remain visible');
        await v.page.keyboard.press('Tab');
        assert(!(await focused(trigger)), 'Tab must leave the trigger normally after closing the dialog');
      } finally { await v.close(); }
    });
    for (const kind of ['list', 'detail']) await check('saved ' + kind + ' retry uses Enter/Space and one request per attempt at ' + width + 'px', async () => {
      const v = await view(width), pending = []; let attempts = 0;
      const pattern = kind === 'list' ? '**/api/saju?view=summary' : '**/api/saju/a';
      try {
        if (kind === 'detail') await v.page.route('**/api/saju?view=summary', route => route.fulfill({ json: { fortuneSummaries: summaries } }));
        await v.page.route(pattern, route => {
          attempts++;
          if (attempts === 1) return route.fulfill({ status: 503, json: { error: '합성 ' + kind + ' 오류' } });
          pending.push(route);
        });
        await v.page.goto(origin + '/saved' + (kind === 'detail' ? '?id=a' : ''), { waitUntil: 'networkidle' });
        const retry = v.page.getByRole('button', { name: '다시 불러오기', exact: true }); await retry.waitFor();
        assert.equal(await v.page.getByRole('alert').textContent(), '합성 ' + kind + ' 오류다시 불러오기');
        await tabTo(v.page, retry); const firstFocus = await focusState(v.page); await v.page.keyboard.press('Enter');
        await v.page.waitForFunction(() => !document.querySelector('[role="alert"]'));
        await v.page.waitForFunction(text => document.body.textContent.includes(text), kind === 'list' ? '보관된 사주 서책을 불러오는 중이옵니다...' : '선택한 기록을 불러오고 있어요.');
        assert.equal(attempts, 2); assert.equal(await retry.count(), 0);
        await pending.shift().fulfill({ status: 503, json: { error: '합성 ' + kind + ' 재실패' } }); await retry.waitFor();
        await tabTo(v.page, retry); const secondFocus = await focusState(v.page); await v.page.keyboard.press('Space');
        await v.page.waitForFunction(() => !document.querySelector('[role="alert"]'));
        assert.equal(attempts, 3);
        await pending.shift().fulfill({ json: kind === 'list' ? { fortuneSummaries: summaries } : { fortune: fullReading('a') } });
        await v.page.getByText(kind === 'list' ? 'select-a' : 'reading-a-current', { exact: true }).waitFor();
        assert.equal(await retry.count(), 0); assert.equal(await v.page.getByRole('alert').count(), 0);
        for (const f of [firstFocus, secondFocus]) assert(f.visible && f.unobscured && f.focusVisible && f.outlineWidth === '3px');
        observations.push({ scenario: 'saved ' + kind + ' keyboard retry', width, attempts, firstFocus, secondFocus, successful: true });
      } finally { await v.close(); }
    });
  }
  await check('native context restoration removes the error after keyboard fallback selection', async () => {
    const v = await view(390);
    try {
      await openMap(v, false);
      await v.page.evaluate(() => {
        const canvas = document.querySelector('[data-scene="galaxy"] canvas');
        const gl = canvas.getContext('webgl2'), extension = gl.getExtension('WEBGL_lose_context');
        if (!extension) throw new Error('WEBGL_lose_context unavailable');
        window.__errorKeyboardExtension = extension;
        window.__errorKeyboardEvents = [];
        canvas.addEventListener('webglcontextlost', event => window.__errorKeyboardEvents.push({ type: event.type, trusted: event.isTrusted }));
        extension.loseContext();
      });
      await v.page.waitForSelector('[data-scene="galaxy"][data-scene-state="fallback"]');
      assert.equal(await v.page.locator('[data-scene="galaxy"] [role="status"] strong').textContent(), '3D 연결이 잠시 끊겼어요. 복구를 기다려주세요.');
      await tabTo(v.page, v.page.locator('.scene-fallback-list button').nth(1)); await v.page.keyboard.press('Space');
      await v.page.evaluate(() => window.__errorKeyboardExtension.restoreContext());
      await v.page.waitForSelector('[data-scene="galaxy"][data-scene-state="ready"]');
      assert.equal(await v.page.locator('.scene-fallback-list').count(), 0);
      const events = await v.page.evaluate(() => window.__errorKeyboardEvents); assert(events.some(e => e.trusted));
      const trigger = v.page.locator('[title="4기둥 행성 슬롯 상세 보기"]');
      await tabTo(v.page, trigger); await v.page.keyboard.press('Enter');
      const dialog = await slotDialog(v.page); await dialog.waitFor();
      assert.equal(await dialog.getAttribute('role'), 'dialog');
      const healthyDialogFocus = await focusState(v.page);
      await v.page.screenshot({ path: path.join(output, 'healthy-dialog-390.png') });
      await v.page.keyboard.press('Escape');
      assert.equal(await dialog.count(), 0); assert(await focused(trigger));
      const healthyReturnFocus = await focusState(v.page);
      for (const f of [healthyDialogFocus, healthyReturnFocus]) assert(f.visible && f.unobscured && f.focusVisible);
      observations.push({ scenario: 'native context restoration after keyboard selection', events, ready: true,
        healthyDialogFocus, healthyReturnFocus });
    } finally { await v.close(); }
  });
  await check('only intentional WebGL and HTTP fault console messages occur; no page errors or outbound requests', async () => {
    assert.deepEqual(errors, []); assert.deepEqual(outbound, []);
    const webgl = consoleErrors.filter(e => e === 'THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.');
    const http = consoleErrors.filter(e => e === 'Failed to load resource: the server responded with a status of 503 (Service Unavailable)');
    assert.equal(webgl.length, 4); assert.equal(http.length, 8); assert.equal(consoleErrors.length, webgl.length + http.length);
  });
} finally {
  const report = { basis: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), phase, browser: browserVersion,
    applicationSourceSHA256: sha(await fs.readFile(path.join(root, 'components/planet/GalaxyCanvas.tsx'))),
    passed: checks.filter(c => c.status === 'PASS').length, failed: checks.filter(c => c.status === 'FAIL').length,
    checks, observations, errors, consoleErrors, outbound,
    limits: ['Chromium/SwiftShader on a local built Worker with synthetic identity and ephemeral D1; no physical GPU, mobile OS or hosted auth.',
      'Native keyboard, rAF and scroll; unsupported WebGL and HTTP retry failures are explicit browser-boundary faults.',
      'Dialog DOM semantics/focus verified; screen-reader speech and Safari/Firefox not tested.'] };
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  await browser?.close(); await mf.dispose();
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed })); process.exitCode = report.failed ? 1 : 0;
}
