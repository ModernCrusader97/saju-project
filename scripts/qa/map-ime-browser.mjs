// CDP composition in real built forms; synthesized input is not a physical OS IME.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Miniflare } from 'miniflare';

const root = fileURLToPath(new URL('../..', import.meta.url));
const output = path.join(root, 'outputs/map-ime');
const phase = process.env.SAJU_QA_PHASE || 'after';
assert(['before', 'after'].includes(phase));
await fs.mkdir(output, { recursive: true });
const checks = [], observations = [], outbound = [], errors = [];
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
  cf: false, logRequests: false, telemetry: { enabled: false }, d1Databases: { DB: 'map-ime-synthetic' }, d1Persist: false,
  assets: { directory: 'dist/client', routerConfig: { has_user_worker: true } },
  outboundService: async request => { outbound.push(new URL(request.url).hostname); return new Response('blocked', { status: 502 }); },
});
const frame = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
let browser, browserVersion;
try {
  const db = await mf.getD1Database('DB');
  for (const file of (await fs.readdir(path.join(root, 'drizzle'))).filter(file => file.endsWith('.sql')).sort()) {
    for (const sql of (await fs.readFile(path.join(root, 'drizzle', file), 'utf8')).split('--> statement-breakpoint')) {
      if (sql.trim()) await db.prepare(sql.trim()).run();
    }
  }
  const playwright = process.env.SAJU_QA_PLAYWRIGHT_PATH || path.join(root, '.sites-runtime/test-tools/node_modules/playwright/index.mjs');
  const { chromium } = await import(pathToFileURL(playwright).href);
  browser = await chromium.launch({ ...(process.env.SAJU_QA_CHROME ? { executablePath: process.env.SAJU_QA_CHROME } : {}),
    headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  browserVersion = await browser.version();
  const origin = (await mf.ready).origin;
  for (const flow of ['owner', 'friend']) for (const mode of ['active', 'committed', 'cancelled-empty']) {
    const label = flow + '-' + mode;
    const events = [], posts = [], replies = [], dialogs = [];
    const prefix = mode === 'cancelled-empty' ? '' : '합성 ' + label + ' ';
    const expected = prefix + '한글';
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: {
      'oai-authenticated-user-id': 'map-ime-' + label, 'oai-authenticated-user-email': 'qa@example.invalid' } });
    await context.exposeBinding('qaObserveIme', (_source, event) => events.push(event));
    await context.addInitScript(() => {
      for (const type of ['compositionstart', 'compositionupdate', 'compositionend', 'beforeinput', 'input', 'keydown', 'keypress', 'keyup', 'submit', 'invalid']) {
        // Read cancellation after all delegated handlers without changing the event.
        document.addEventListener(type, event => {
          if (!event.target.closest('form')) return;
          const observation = { type: event.type, key: event.key, keyCode: event.keyCode,
            isComposing: event.isComposing, inputType: event.inputType, data: event.data,
            value: event.target.value, isTrusted: event.isTrusted, cancelable: event.cancelable };
          setTimeout(() => window.qaObserveIme({ ...observation, defaultPrevented: event.defaultPrevented }), 0);
        }, type === 'invalid');
      }
    });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
      outbound.push(url.hostname); return route.abort();
    });
    await context.route('**/api/guin', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      const response = await route.fetch();
      replies.push({ status: response.status(), data: await response.json() });
      await route.fulfill({ response });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
    page.on('request', request => {
      if (request.method() === 'POST' && new URL(request.url()).pathname.startsWith('/api/guin')) posts.push(new URL(request.url()).pathname);
    });
    try {
      console.log('IME QA ' + phase + ' ' + label);
      await page.goto(origin + '/guin', { waitUntil: 'networkidle' });
      let mapPath;
      if (flow === 'friend') {
        await page.getByLabel('은하 이름', { exact: true }).fill('합성 IME 지도');
        const navigation = page.waitForURL(/\/guin\/[a-zA-Z0-9_-]+$/);
        await page.keyboard.press('Enter'); await navigation;
        assert.equal(replies[0].status, 200);
        mapPath = '/guin/' + replies[0].data.guinMap.id;
        await page.getByRole('button', { name: '친구 행성 등록', exact: true }).click();
      }
      const input = flow === 'owner' ? page.getByLabel('은하 이름', { exact: true }) : page.getByPlaceholder('예: 지우', { exact: true });
      await input.fill(prefix);
      const protocol = await context.newCDPSession(page);
      const from = events.length, postCount = posts.length, dialogCount = dialogs.length;
      await protocol.send('Input.imeSetComposition', { text: 'ㅎ', selectionStart: 1, selectionEnd: 1 });
      await protocol.send('Input.imeSetComposition', { text: '한글', selectionStart: 2, selectionEnd: 2 });
      assert.equal(await input.inputValue(), expected);
      if (mode === 'committed') await protocol.send('Input.insertText', { text: '한글' });
      if (mode === 'cancelled-empty') await protocol.send('Input.imeSetComposition', { text: '', selectionStart: 0, selectionEnd: 0 });
      const submitted = flow === 'owner' ? '/api/guin' : '/api' + mapPath;
      const response = mode === 'committed' ? page.waitForResponse(reply => new URL(reply.url()).pathname === submitted && reply.request().method() === 'POST') : null;
      await page.keyboard.press('Enter');
      if (response) {
        const reply = await response;
        assert.equal(reply.status(), 200);
        if (flow === 'owner') await page.waitForURL(/\/guin\/[a-zA-Z0-9_-]+$/);
        else await input.waitFor({ state: 'hidden' });
      } else {
        // Bound observation of the negative network assertion; Enter dispatch itself is synchronous.
        await page.waitForTimeout(400);
      }
      await frame(page);
      const trace = events.slice(from);
      const observation = { label, mode, flow, events: trace, postCount: posts.length - postCount,
        dialogCount: dialogs.length - dialogCount, urlChanged: !page.url().endsWith(flow === 'owner' ? '/guin' : mapPath),
        inputPresent: await input.count() === 1 };
      observations.push(observation);
      await check(label, page, async () => {
        assert(trace.some(event => event.type === 'compositionstart' && event.isTrusted));
        assert(trace.filter(event => event.type === 'compositionupdate' && event.isTrusted).length >= 2);
        assert(trace.some(event => event.type === 'input' && event.inputType === 'insertCompositionText' && event.isComposing));
        const enter = trace.find(event => event.type === 'keydown' && event.key === 'Enter');
        assert(enter?.isTrusted, 'Enter is sent by Chromium keyboard input, not DOM dispatchEvent');
        if (mode === 'active') {
          assert.equal(enter.isComposing, true);
          assert.equal(observation.postCount, 0, 'Composing Enter must not issue a save request');
          assert.equal(enter.defaultPrevented, true, 'Cancel implicit submission during composition');
          assert.equal(trace.filter(event => event.type === 'submit').length, 0);
          assert.equal(observation.dialogCount, 0);
          assert.equal(observation.urlChanged, false);
          assert(observation.inputPresent);
          assert.equal(await input.inputValue(), expected);
          assert(await input.evaluate(element => element === document.activeElement));
        } else if (mode === 'committed') {
          assert.equal(enter.isComposing, false);
          assert.equal(enter.defaultPrevented, false);
          const endIndex = trace.findIndex(event => event.type === 'compositionend');
          assert(endIndex >= 0 && endIndex < trace.indexOf(enter));
          assert.equal(observation.postCount, 1);
          const map = flow === 'owner' ? replies[0].data.guinMap : (await (await page.request.get(origin + '/api' + mapPath)).json()).guinMap;
          assert.equal(flow === 'owner' ? map.ownerName : map.guins.find(person => !person.isMe).name, expected);
          assert.equal(map.guins.length, flow === 'owner' ? 1 : 2);
        } else {
          assert.equal(enter.isComposing, false);
          assert.equal(enter.defaultPrevented, false);
          assert(trace.some(event => event.type === 'compositionend'));
          assert(trace.some(event => event.type === 'invalid'), 'Required name validation remains active after composition cancellation');
          assert.equal(await input.inputValue(), '');
          assert(await input.evaluate(element => element.validity.valueMissing));
          assert.equal(observation.postCount, 0);
          assert.equal(observation.dialogCount, 0);
          assert(observation.inputPresent);
        }
      });
      await protocol.detach();
    } catch (error) { checks.push({ name: label + '-scenario', status: 'FAIL', error: error.stack || String(error) }); }
    finally { await context.close(); }
  }
  await check('no-browser-exceptions-or-external-calls', null, async () => { assert.deepEqual(errors, []); assert.deepEqual(outbound, []); });
} catch (error) { checks.push({ name: 'harness', status: 'FAIL', error: error.stack || String(error) }); }
finally { if (browser) await browser.close(); await mf.dispose(); }
const report = { status: checks.every(check => check.status === 'PASS') ? 'PASS' : 'FAIL', phase, browserVersion,
  coverage: { forms: ['owner', 'friend'], modes: ['active', 'committed', 'cancelled-empty'], width: 390, height: 844,
    compositionSource: 'CDP Input.imeSetComposition / Input.insertText', enterSource: 'Playwright Chromium keyboard input', domKeyboardDispatches: 0, programmaticSubmissions: 0 },
  checks, observations, limits: ['Synthesized composition and keyboard events in Chromium; no physical keyboard or OS IME',
    'No desktop display/IBus/Fcitx tools available; no Safari, Firefox or actual mobile keyboard validation',
    'Only synthetic identities and nonpersistent local D1; no production records or external calls'] };
await fs.writeFile(path.join(output, phase + '-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, checks: checks.length, failures: checks.filter(check => check.status === 'FAIL'),
  observations: observations.map(({ label, postCount, inputPresent }) => ({ label, postCount, inputPresent })) }, null, 2));
if (report.status !== 'PASS') process.exitCode = 1;
