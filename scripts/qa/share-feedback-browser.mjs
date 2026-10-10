// Built Worker, native keyboard and actual browser timers. Clipboard is a boundary stub.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Miniflare } from 'miniflare';

const root = process.cwd(), phase = process.env.SAJU_QA_PHASE || 'after';
assert(['before', 'after'].includes(phase));
const output = path.join(root, 'outputs/share-feedback', phase);
await fs.mkdir(output, { recursive: true });
const { chromium } = await import(pathToFileURL(process.env.SAJU_QA_PLAYWRIGHT_PATH ||
  path.join(root, '.sites-runtime/test-tools/node_modules/playwright/index.mjs')).href);
const headers = { 'oai-authenticated-user-id': 'share-feedback-synthetic', 'oai-authenticated-user-email': 'qa@example.invalid' };
const checks = [], observations = [], errors = [], consoleErrors = [], outbound = [];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
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
  cf: false, telemetry: { enabled: false }, d1Databases: { DB: 'share-feedback-synthetic' }, d1Persist: false,
  assets: { directory: 'dist/client', routerConfig: { has_user_worker: true } },
  outboundService: async request => { outbound.push(new URL(request.url).hostname); return new Response('blocked', { status: 502 }); },
});
const focused = locator => locator.evaluate(element => element === document.activeElement);
async function tabTo(page, locator) {
  for (let i = 0; i < 100; i++) {
    if (await focused(locator)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error('Native Tab could not reach the share button');
}
const share = page => page.getByRole('button', { name: /^(은하 링크 공유|복사 완료!)$/ });
async function waitAfterWrite(page, index, milliseconds) {
  await page.waitForFunction(({ index, milliseconds }) =>
    performance.now() >= window.__shareWrites[index].time + milliseconds, { index, milliseconds });
}
let browser, browserVersion, origin, mapPath;
async function view(width) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, extraHTTPHeaders: headers });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
    outbound.push(url.hostname); return route.abort();
  });
  await context.addInitScript(() => {
    window.__shareWrites = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async text => { window.__shareWrites.push({ text, time: performance.now() }); },
    } });
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      return /^webgl/.test(type) ? null : original.call(this, type, ...args);
    };
  });
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  let posts = 0;
  page.on('request', request => { if (request.method() === 'POST') posts++; });
  await page.goto(origin + mapPath, { waitUntil: 'networkidle' });
  await tabTo(page, share(page));
  return { page, posts: () => posts, close: () => context.close() };
}
async function check(name, run) {
  console.log('RUN ' + name);
  try { await run(); checks.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
  catch (error) { checks.push({ name, status: 'FAIL', error: error.message }); console.error(error.message); }
}
try {
  const db = await mf.getD1Database('DB');
  for (const file of (await fs.readdir(path.join(root, 'drizzle'))).filter(file => file.endsWith('.sql')).sort())
    for (const sql of (await fs.readFile(path.join(root, 'drizzle', file), 'utf8')).split('--> statement-breakpoint')) if (sql.trim()) await db.prepare(sql.trim()).run();
  origin = (await mf.ready).origin;
  const owner = await fetch(origin + '/api/guin', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ name: '합성 공유 검증', birthYear: 2000, birthMonth: 1, birthDay: 1, birthHour: 12, birthMinute: 30, isUnknownTime: false }) });
  assert.equal(owner.status, 200); mapPath = '/guin/' + (await owner.json()).guinMap.id;
  browser = await chromium.launch({ executablePath: process.env.SAJU_QA_CHROME || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  browserVersion = await browser.version();
  for (const width of [390, 1440]) {
    await check('native repeated copy keeps the recent acknowledgment at ' + width + 'px', async () => {
      const v = await view(width);
      try {
        await v.page.keyboard.press('Enter'); assert.equal((await share(v.page).textContent()).trim(), '복사 완료!');
        await waitAfterWrite(v.page, 0, 1200); await v.page.keyboard.press('Enter');
        const writes = await v.page.evaluate(() => window.__shareWrites);
        assert.equal(writes.length, 2); assert(writes[1].time - writes[0].time < 1750, 'The second copy must precede the first deadline');
        await waitAfterWrite(v.page, 0, 2250);
        const recent = await v.page.evaluate(() => ({ now: performance.now(), label: [...document.querySelectorAll('button')]
          .find(e => /^(은하 링크 공유|복사 완료!)$/.test(e.textContent.trim())).textContent.trim() }));
        const elapsedAfterLatest = recent.now - writes[1].time;
        assert(elapsedAfterLatest < 1900, 'Observe while the recent acknowledgment is still due');
        await v.page.screenshot({ path: path.join(output, 'recent-copy-' + width + '.png') });
        await waitAfterWrite(v.page, 1, 2250);
        const expired = (await share(v.page).textContent()).trim();
        observations.push({ scenario: 'native repeated copy', width, writes, recent, elapsedAfterLatest, expired, posts: v.posts() });
        assert.equal(recent.label, '복사 완료!', 'The previous copy deadline must not hide feedback from the recent copy');
        assert.equal(expired, '은하 링크 공유');
        assert(writes.every(write => write.text === origin + mapPath)); assert.equal(v.posts(), 0);
      } finally { await v.close(); }
    });
    await check('native copy restarts normally after expiry at ' + width + 'px', async () => {
      const v = await view(width);
      try {
        await v.page.keyboard.press('Space'); await waitAfterWrite(v.page, 0, 2250);
        assert.equal((await share(v.page).textContent()).trim(), '은하 링크 공유');
        await v.page.keyboard.press('Enter');
        assert.equal((await share(v.page).textContent()).trim(), '복사 완료!');
        const writes = await v.page.evaluate(() => window.__shareWrites);
        assert.equal(writes.length, 2); assert(writes.every(write => write.text === origin + mapPath)); assert.equal(v.posts(), 0);
        observations.push({ scenario: 'native copy after expiry', width, writes, posts: v.posts() });
      } finally { await v.close(); }
    });
  }
  await check('copy adds no unexpected errors or outbound requests', async () => {
    assert.deepEqual(errors, []); assert.deepEqual(outbound, []);
    assert.equal(consoleErrors.length, 4);
    assert(consoleErrors.every(message => message === 'THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.'));
  });
} finally {
  const clientFingerprint = createHash('sha256');
  for (const file of (await walk(path.join(root, 'dist/client'))).sort()) {
    clientFingerprint.update(path.relative(root, file)); clientFingerprint.update(await fs.readFile(file));
  }
  const report = { basis: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), phase, browser: browserVersion,
    applicationSourceSHA256: sha(await fs.readFile(path.join(root, 'app/guin/[id]/page.tsx'))),
    clientJavaScriptSHA256: clientFingerprint.digest('hex'),
    passed: checks.filter(c => c.status === 'PASS').length, failed: checks.filter(c => c.status === 'FAIL').length,
    checks, observations, errors, consoleErrors, outbound,
    limits: ['Actual Chromium keyboard, performance clock and browser timers on a built local Worker with synthetic identity/ephemeral D1.',
      'Clipboard writes are intercepted; OS clipboard permission and contents are not tested. WebGL is explicitly unsupported for these UI checks.',
      'Component unmount/Strict Mode cleanup uses the separate React DOM suite; Safari/Firefox and physical devices are not tested.'] };
  await fs.writeFile(path.join(output, 'browser-results.json'), JSON.stringify(report, null, 2) + '\n');
  await browser?.close(); await mf.dispose(); console.log(JSON.stringify({ passed: report.passed, failed: report.failed }));
  process.exitCode = report.failed ? 1 : 0;
}
