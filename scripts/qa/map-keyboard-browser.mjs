// Real built forms and disposable local Worker/D1. Every successful write uses keyboard submission.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Miniflare } from 'miniflare';

const root = fileURLToPath(new URL('../..', import.meta.url));
const output = path.join(root, 'outputs/map-keyboard');
const phase = process.env.SAJU_QA_PHASE || 'after';
assert(['before', 'after'].includes(phase));
const widths = process.env.SAJU_QA_FORM_WIDTH ? [Number(process.env.SAJU_QA_FORM_WIDTH)] : [320, 390, 768];
assert(widths.every(width => [320, 390, 768].includes(width)));
await fs.mkdir(output, { recursive: true });
const checks = [], focus = [], saves = [], dialogs = [], outbound = [], errors = [];
async function check(name, page, run) {
  try { await run(); checks.push({ name, status: 'PASS' }); }
  catch (error) {
    checks.push({ name, status: 'FAIL', error: error.message });
    if (page) await page.screenshot({ path: path.join(output, phase + '-' + name + '.png') }).catch(() => {});
  }
}
async function walk(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (/\.m?js$/.test(entry.name)) files.push(full);
  }
  return files;
}
const entry = path.join(root, 'dist/server/index.js');
const mf = new Miniflare({ rootPath: root, modulesRoot: 'dist/server',
  modules: [entry, ...(await walk(path.join(root, 'dist/server'))).filter(file => file !== entry)]
    .map(file => ({ type: 'ESModule', path: file })),
  compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'], host: '127.0.0.1', port: 0,
  cf: false, logRequests: false, telemetry: { enabled: false }, d1Databases: { DB: 'map-keyboard-synthetic' }, d1Persist: false,
  assets: { directory: 'dist/client', routerConfig: { has_user_worker: true } },
  outboundService: async request => { outbound.push(new URL(request.url).hostname); return new Response('blocked', { status: 502 }); },
});
const isFocused = locator => locator.evaluate(element => element === document.activeElement);
async function tabTo(page, locator, key = 'Tab') {
  for (let step = 0; step < 80; step++) {
    if (await isFocused(locator)) return;
    await page.keyboard.press(key);
  }
  throw new Error('Keyboard Tab could not reach ' + await locator.evaluate(element => element.outerHTML.slice(0, 150)));
}
async function typeAt(page, locator, value) {
  await tabTo(page, locator);
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(value);
  assert.equal(await locator.inputValue(), value);
}
async function snapshotFocus(page, label) {
  // Observe after native smooth scrolling settles; do not move focus or scroll in the test.
  await page.evaluate(async () => {
    const deadline = performance.now() + 2000;
    let previous = '', stable = 0;
    while (performance.now() < deadline && stable < 4) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      const rect = document.activeElement.getBoundingClientRect();
      const current = [scrollY, rect.top, rect.bottom].join(',');
      stable = current === previous ? stable + 1 : 0;
      previous = current;
    }
  });
  const observation = await page.evaluate(() => {
    const element = document.activeElement;
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const join = document.querySelector('input[placeholder="예: 지우"]')?.closest('form')?.parentElement;
    return { tag: element.tagName, type: element.getAttribute('type'),
      name: element.getAttribute('aria-label') || element.getAttribute('placeholder') || element.textContent.trim().slice(0, 50),
      insideJoin: !!join?.contains(element), connected: element.isConnected,
      visible: rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= innerHeight,
      unobscured: hit === element || element.contains(hit),
      hit: hit?.getAttribute('aria-label') || hit?.tagName,
      top: rect.top, bottom: rect.bottom, scrollY, viewport: { width: innerWidth, height: innerHeight } };
  });
  focus.push({ label, ...observation });
  return observation;
}
async function pathThrough(page, label, controls, backwards = false) {
  const escaped = [];
  await tabTo(page, controls[0]);
  for (const [index, control] of controls.entries()) {
    assert(await isFocused(control), label + ' focus order at ' + index);
    const current = await snapshotFocus(page, label + '-' + index);
    if (!current.visible || !current.unobscured) escaped.push(current);
    if (index < controls.length - 1) await page.keyboard.press(backwards ? 'Shift+Tab' : 'Tab');
  }
  assert.deepEqual(escaped, [], label + ': focused controls must be visible');
}
const frame = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
let browser, browserVersion;
try {
  const d1 = await mf.getD1Database('DB');
  for (const file of (await fs.readdir(path.join(root, 'drizzle'))).filter(file => file.endsWith('.sql')).sort()) {
    for (const sql of (await fs.readFile(path.join(root, 'drizzle', file), 'utf8')).split('--> statement-breakpoint')) {
      if (sql.trim()) await d1.prepare(sql.trim()).run();
    }
  }
  const playwright = process.env.SAJU_QA_PLAYWRIGHT_PATH || path.join(root, '.sites-runtime/test-tools/node_modules/playwright/index.mjs');
  const { chromium } = await import(pathToFileURL(playwright).href);
  browser = await chromium.launch({ ...(process.env.SAJU_QA_CHROME ? { executablePath: process.env.SAJU_QA_CHROME } : {}),
    headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  browserVersion = await browser.version();
  const origin = (await mf.ready).origin;
  for (const width of widths) {
    console.log('KEYBOARD QA ' + phase + ' ' + width);
    const owner = '합성 소유자 ' + width, friend = '합성 주변인 ' + width;
    const context = await browser.newContext({ viewport: { width, height: 844 }, extraHTTPHeaders: {
      'oai-authenticated-user-id': 'map-keyboard-' + width, 'oai-authenticated-user-email': 'qa@example.invalid' } });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
      outbound.push(url.hostname); return route.abort();
    });
    const ownerReplies = [];
    await context.route('**/api/guin', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      const response = await route.fetch();
      ownerReplies.push({ status: response.status(), data: await response.json() });
      await route.fulfill({ response });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', async dialog => { dialogs.push({ width, message: dialog.message() }); await dialog.accept(); });
    const posts = [];
    page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname.startsWith('/api/guin')) posts.push(new URL(request.url()).pathname); });
    try {
      await page.goto(origin + '/guin', { waitUntil: 'networkidle' });
      const name = page.getByLabel('은하 이름', { exact: true });
      const unknown = page.getByLabel('은하 시간 모름', { exact: true });
      const year = page.getByLabel('은하 연도', { exact: true });
      const month = page.getByLabel('은하 월', { exact: true });
      const day = page.getByLabel('은하 일', { exact: true });
      const hour = page.getByLabel('은하 시', { exact: true });
      const minute = page.getByLabel('은하 분', { exact: true });
      const submit = page.getByRole('button', { name: '귀인 지도 만들기', exact: true });
      await tabTo(page, name);
      await check(width + '-owner-required-name-enter', page, async () => {
        await page.keyboard.press('Enter');
        assert(await isFocused(name));
        assert(await name.evaluate(element => element.validity.valueMissing));
        assert.deepEqual(posts, []);
      });
      await typeAt(page, name, owner);
      await check(width + '-owner-tab-visible', page, () => pathThrough(page, width + '-owner-tab', [name, year, month, day, unknown, hour, minute, submit]));
      await check(width + '-owner-shift-tab-visible', page, () => pathThrough(page, width + '-owner-shift', [submit, minute, hour, unknown, day, month, year, name], true));
      await check(width + '-owner-unknown-time-tab-order', page, async () => {
        await tabTo(page, unknown); await page.keyboard.press('Space'); await frame(page);
        assert(await unknown.isChecked()); assert.equal(await page.locator('form input[type=number]').count(), 3);
        await page.keyboard.press('Tab'); assert(await isFocused(submit));
        await page.keyboard.press('Shift+Tab'); assert(await isFocused(unknown));
        await page.keyboard.press('Space'); await frame(page);
        assert.equal(await unknown.isChecked(), false);
        await page.keyboard.press('Tab'); assert(await isFocused(hour));
      });
      await typeAt(page, year, '2000'); await typeAt(page, month, '2'); await typeAt(page, day, '30');
      await typeAt(page, hour, '12'); await typeAt(page, minute, '30');
      await check(width + '-owner-error-enter-keeps-focus-and-draft', page, async () => {
        await tabTo(page, day);
        const alert = page.waitForEvent('dialog'); await page.keyboard.press('Enter');
        assert.equal((await alert).message(), '존재하지 않는 생년월일입니다. 날짜를 다시 확인해주세요.');
        assert.equal(await name.inputValue(), owner); assert.deepEqual(posts, []);
        assert(await isFocused(day));
      });
      await typeAt(page, month, '1'); await typeAt(page, day, '1');
      await check(width + '-owner-enter-saves-and-navigates', page, async () => {
        await tabTo(page, name);
        const navigation = page.waitForURL(/\/guin\/[a-zA-Z0-9_-]+$/);
        await page.keyboard.press('Enter'); await navigation;
        await page.locator('.galaxy-heading h1').waitFor();
        assert.equal(ownerReplies.length, 1); assert.equal(ownerReplies[0].status, 200);
        assert.equal(ownerReplies[0].data.guinMap.ownerName, owner);
        assert.equal(posts.length, 1);
        saves.push({ width, flow: 'owner', name: owner, status: 200 });
      });
      if (!ownerReplies[0]?.data.guinMap) throw new Error('Keyboard owner submission did not create a test map');
      const mapPath = '/guin/' + ownerReplies[0].data.guinMap.id;
      const trigger = page.getByRole('button', { name: '친구 행성 등록', exact: true });
      const friendName = page.getByPlaceholder('예: 지우', { exact: true });
      const form = page.locator('form');
      const panel = form.locator('..');
      const close = panel.locator('button').first();
      const numbers = form.locator('input[type=number]');
      const fUnknown = form.locator('input[type=checkbox]');
      const fSubmit = page.getByRole('button', { name: '귀인 등록 완료하기', exact: true });
      const open = async () => { await tabTo(page, trigger); await page.keyboard.press('Enter'); await friendName.waitFor(); await frame(page); };
      await open();
      await check(width + '-friend-open-focus-inside', page, async () => {
        const current = await snapshotFocus(page, width + '-friend-open');
        assert(current.insideJoin && current.visible && current.unobscured, JSON.stringify(current));
      });
      await tabTo(page, friendName); await typeAt(page, friendName, friend);
      await check(width + '-friend-tab-visible', page, () => pathThrough(page, width + '-friend-tab', [friendName, numbers.nth(0), numbers.nth(1), numbers.nth(2), fUnknown, numbers.nth(3), numbers.nth(4), fSubmit]));
      await check(width + '-friend-shift-tab-visible', page, () => pathThrough(page, width + '-friend-shift', [fSubmit, numbers.nth(4), numbers.nth(3), fUnknown, numbers.nth(2), numbers.nth(1), numbers.nth(0), friendName], true));
      await check(width + '-friend-tab-wrap', page, async () => {
        await tabTo(page, fSubmit); await page.keyboard.press('Tab');
        assert(await isFocused(close), JSON.stringify(await snapshotFocus(page, width + '-friend-tab-wrap')));
      });
      await check(width + '-friend-shift-tab-wrap', page, async () => {
        await tabTo(page, close); await page.keyboard.press('Shift+Tab');
        assert(await isFocused(fSubmit), JSON.stringify(await snapshotFocus(page, width + '-friend-shift-wrap')));
      });
      await check(width + '-friend-unknown-time-tab-order', page, async () => {
        await tabTo(page, fUnknown); await page.keyboard.press('Space'); await frame(page);
        assert(await fUnknown.isChecked()); assert.equal(await numbers.count(), 3);
        await page.keyboard.press('Tab'); assert(await isFocused(fSubmit));
        await page.keyboard.press('Shift+Tab'); assert(await isFocused(fUnknown));
        await page.keyboard.press('Space'); await frame(page);
        await page.keyboard.press('Tab'); assert(await isFocused(numbers.nth(3)));
      });
      await check(width + '-friend-escape-restores-trigger', page, async () => {
        await tabTo(page, friendName); await page.keyboard.press('Escape');
        await friendName.waitFor({ state: 'hidden' }); await frame(page);
        const current = await snapshotFocus(page, width + '-friend-escape-return');
        assert(await isFocused(trigger) && current.visible && current.unobscured, JSON.stringify(current));
      });
      await open();
      await check(width + '-friend-reopen-keeps-draft', page, async () => { assert.equal(await friendName.inputValue(), friend); });
      await check(width + '-friend-close-enter-restores-trigger', page, async () => {
        await tabTo(page, close); await page.keyboard.press('Enter');
        await friendName.waitFor({ state: 'hidden' }); await frame(page);
        const current = await snapshotFocus(page, width + '-friend-close-return');
        assert(await isFocused(trigger) && current.visible && current.unobscured, JSON.stringify(current));
      });
      await open();
      await typeAt(page, numbers.nth(0), '2001'); await typeAt(page, numbers.nth(1), '2'); await typeAt(page, numbers.nth(2), '30');
      await check(width + '-friend-error-enter-keeps-focus-and-draft', page, async () => {
        await tabTo(page, fSubmit);
        const response = page.waitForResponse(response => new URL(response.url()).pathname === '/api' + mapPath && response.request().method() === 'POST');
        const alert = page.waitForEvent('dialog'); await page.keyboard.press('Enter');
        assert.equal((await response).status(), 400); assert.equal((await alert).message(), '등록 중 오류가 발생했습니다.');
        await frame(page); assert.equal(await friendName.inputValue(), friend);
        const current = await snapshotFocus(page, width + '-friend-error');
        assert(current.insideJoin && current.visible && current.unobscured, JSON.stringify(current));
        const saved = await page.request.get(origin + '/api' + mapPath);
        assert.equal((await saved.json()).guinMap.guins.length, 1);
      });
      await typeAt(page, numbers.nth(1), '3'); await typeAt(page, numbers.nth(2), '10');
      await check(width + '-friend-enter-save-restores-trigger', page, async () => {
        await tabTo(page, friendName);
        const response = page.waitForResponse(response => new URL(response.url()).pathname === '/api' + mapPath && response.request().method() === 'POST');
        const alert = page.waitForEvent('dialog'); await page.keyboard.press('Enter');
        const reply = await response;
        assert.equal(reply.status(), 200); assert.equal((await reply.json()).newPerson.name, friend);
        assert.equal((await alert).message(), owner + '님의 우리은하에 등록되었습니다! ✨');
        await friendName.waitFor({ state: 'hidden' }); await frame(page);
        const stored = await page.request.get(origin + '/api' + mapPath);
        const map = (await stored.json()).guinMap;
        assert.equal(map.guins.length, 2); assert.equal(map.guins.find(person => !person.isMe).name, friend);
        assert.equal(posts.length, 3, 'One owner save, one invalid friend request and one friend save');
        saves.push({ width, flow: 'friend', name: friend, status: 200 });
        const current = await snapshotFocus(page, width + '-friend-save-return');
        assert(await isFocused(trigger) && current.visible && current.unobscured, JSON.stringify(current));
      });
      await page.screenshot({ path: path.join(output, phase + '-' + width + '-completed.png') });
    } catch (error) { checks.push({ name: width + '-scenario', status: 'FAIL', error: error.stack || String(error) }); }
    finally { await context.close(); }
  }
  await check('no-browser-exceptions-or-external-calls', null, async () => { assert.deepEqual(errors, []); assert.deepEqual(outbound, []); });
} catch (error) { checks.push({ name: 'harness', status: 'FAIL', error: error.stack || String(error) }); }
finally { if (browser) await browser.close(); await mf.dispose(); }
const report = { status: checks.every(check => check.status === 'PASS') ? 'PASS' : 'FAIL', phase, browserVersion,
  coverage: { widths, pointerActions: 0, programmaticFocusActions: 0 }, checks, focus, saves, dialogs,
  limits: ['Synthetic local Worker/D1 and browser identities only; no production accounts or records',
    'Chromium keyboard events and text insertion; no physical keyboard, OS IME or assistive technology validation',
    'Native validation/alert behavior tested; browser/OS popup outer geometry and 3D art unmeasured'] };
await fs.writeFile(path.join(output, phase + '-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, checks: checks.length, failures: checks.filter(check => check.status === 'FAIL'), saves }, null, 2));
if (report.status !== 'PASS') process.exitCode = 1;
