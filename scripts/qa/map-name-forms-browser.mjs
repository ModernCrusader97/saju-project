// Form-driven browser QA; real local Worker/D1, disposable synthetic identities.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Miniflare } from 'miniflare';

const root = fileURLToPath(new URL('../..', import.meta.url));
const output = path.join(root, 'outputs/map-name-forms');
const phase = process.env.SAJU_QA_PHASE || 'after';
assert(['before', 'before-layout', 'after'].includes(phase));
const widths = process.env.SAJU_QA_FORM_WIDTH ? [Number(process.env.SAJU_QA_FORM_WIDTH)] : [320, 390];
assert(widths.every(width => [320, 390].includes(width)));
await fs.mkdir(output, { recursive: true });
const cases = [
  { key: 'ordinary', raw: '  합성 이름  ', expected: '합성 이름' },
  { key: 'space-boundary', raw: '가'.repeat(48) + ' 😀', expected: '가'.repeat(48) },
  { key: 'pair-crosses', raw: '가'.repeat(49) + '😀', expected: '가'.repeat(49) },
  { key: 'pair-fits', raw: '가'.repeat(48) + '😀', expected: '가'.repeat(48) + '😀' },
];
const fixtures = process.env.SAJU_QA_FORM_CASE ? cases.filter(fixture => fixture.key === process.env.SAJU_QA_FORM_CASE) : cases;
assert(fixtures.length);
const checks = [], observations = [], layouts = [], dialogs = [], outbound = [], errors = [];
async function check(name, page, run) {
  try { await run(); checks.push({ name, status: 'PASS' }); }
  catch (error) {
    checks.push({ name, status: 'FAIL', error: error.message });
    if (page) await page.screenshot({ path: path.join(output, phase + '-' + name.replace(/[^a-z0-9-]/gi, '-') + '.png'), fullPage: true }).catch(() => {});
  }
}
async function walk(directory) {
  const result = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(full));
    else if (/\.m?js$/.test(entry.name)) result.push(full);
  }
  return result;
}
const entry = path.join(root, 'dist/server/index.js');
const modules = [entry, ...(await walk(path.join(root, 'dist/server'))).filter(file => file !== entry)]
  .map(file => ({ type: 'ESModule', path: file }));
const mf = new Miniflare({ rootPath: root, modules, modulesRoot: 'dist/server',
  compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'], host: '127.0.0.1', port: 0,
  cf: false, logRequests: false, telemetry: { enabled: false }, d1Databases: { DB: 'map-form-synthetic' }, d1Persist: false,
  assets: { directory: 'dist/client', routerConfig: { has_user_worker: true } },
  outboundService: async request => { outbound.push(new URL(request.url).hostname); return new Response('blocked', { status: 502 }); },
});
async function layout(page, form, label) {
  await form.evaluate(form => {
    let parent = form;
    while (parent && getComputedStyle(parent).position !== 'fixed') parent = parent.parentElement;
    if (!parent) window.scrollTo({ top: window.scrollY + form.getBoundingClientRect().top - 16, behavior: 'instant' });
  });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const data = await form.evaluate(form => {
    const bounds = form.getBoundingClientRect();
    const measure = document.createElement('canvas').getContext('2d');
    const controls = [...form.querySelectorAll('input, button, select, [role=alert], .form-error')].map(element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      measure.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const numericTextWidth = element.type === 'number' ? measure.measureText(element.value).width : 0;
      const numericAvailableWidth = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      return { tag: element.tagName, type: element.getAttribute('type'), label: element.getAttribute('aria-label') || element.getAttribute('placeholder') || element.textContent.trim(),
        left: rect.left, right: rect.right, width: rect.width, height: rect.height,
        textOverflow: element.tagName === 'INPUT' ? 0 : element.scrollWidth - element.clientWidth,
        numericTextWidth, numericAvailableWidth,
        validationMessage: element.validationMessage || '' };
    }).filter(rect => rect.width && rect.height);
    const submit = form.querySelector('button[type=submit]');
    const button = submit.getBoundingClientRect();
    const hit = document.elementFromPoint(button.left + button.width / 2, button.top + button.height / 2);
    return { viewport: innerWidth, documentOverflow: document.documentElement.scrollWidth - innerWidth,
      submitUnobscured: hit === submit || submit.contains(hit),
      form: { left: bounds.left, right: bounds.right }, controls };
  });
  const protocol = await page.context().newCDPSession(page);
  try {
    const document = await protocol.send('DOM.getDocument');
    const inputs = await protocol.send('DOM.querySelectorAll', { nodeId: document.root.nodeId, selector: 'form input[type=number]' });
    const numeric = data.controls.filter(control => control.type === 'number');
    assert.equal(inputs.nodeIds.length, numeric.length);
    for (const [index, nodeId] of inputs.nodeIds.entries()) {
      const { node } = await protocol.send('DOM.describeNode', { nodeId, depth: -1, pierce: true });
      const descendants = [];
      const visit = node => { descendants.push(node); for (const child of [...(node.children || []), ...(node.shadowRoots || [])]) visit(child); };
      visit(node);
      const viewport = descendants.find(node => {
        const attributes = node.attributes || [];
        return attributes.some((attribute, index) => attribute === 'id' && attributes[index + 1] === 'editing-view-port');
      });
      if (!viewport) {
        await fs.writeFile(path.join(output, 'native-input-probe.json'), JSON.stringify(node, null, 2));
        throw new Error('Chromium numeric editing viewport was not found');
      }
      const { model } = await protocol.send('DOM.getBoxModel', { backendNodeId: viewport.backendNodeId });
      numeric[index].numericAvailableWidth = model.content[2] - model.content[0];
    }
  } finally { await protocol.detach(); }
  layouts.push({ label, ...data });
  assert(data.form.left >= -1 && data.form.right <= data.viewport + 1, JSON.stringify(data));
  const escaped = data.controls.filter(control => control.left < data.form.left - 1 || control.right > data.form.right + 1
    || control.left < -1 || control.right > data.viewport + 1 || control.textOverflow > 1
    || control.numericTextWidth > control.numericAvailableWidth + 1);
  assert.deepEqual(escaped, [], JSON.stringify({ label, escaped }));
  assert(data.documentOverflow <= 1, JSON.stringify({ label, documentOverflow: data.documentOverflow }));
  assert(data.submitUnobscured, label + ': submit button must be reachable above the fixed navigation');
  await form.screenshot({ path: path.join(output, phase + '-' + label + '.png') });
}
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
  for (const width of widths) for (const fixture of fixtures) {
    const label = width + '-' + fixture.key;
    console.log('FORM QA ' + phase + ' ' + label);
    const identity = { 'oai-authenticated-user-id': 'map-form-' + label, 'oai-authenticated-user-email': 'qa@example.invalid' };
    const context = await browser.newContext({ viewport: { width, height: 844 }, extraHTTPHeaders: identity });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
      outbound.push(url.hostname); return route.abort();
    });
    const ownerReplies = [];
    // Capture the real response before the form immediately navigates away.
    await context.route('**/api/guin', async route => {
      if (route.request().method() !== 'POST') return route.continue();
      const response = await route.fetch();
      ownerReplies.push({ status: response.status(), data: await response.json() });
      await route.fulfill({ response });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    page.on('pageerror', error => errors.push({ label, message: error.message }));
    page.on('dialog', async dialog => { dialogs.push({ label, type: dialog.type(), message: dialog.message() }); await dialog.accept(); });
    const posts = [];
    page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname.startsWith('/api/guin')) posts.push(new URL(request.url()).pathname); });
    let created, mapPath;
    try {
      await page.goto(origin + '/guin', { waitUntil: 'networkidle' });
      const ownerName = page.getByLabel('은하 이름', { exact: true });
      await ownerName.fill(fixture.raw);
      const ownerForm = page.locator('form');
      await check(label + '-owner-layout', page, () => layout(page, ownerForm, label + '-owner'));
      await check(label + '-owner-error-keeps-draft', page, async () => {
        await page.getByLabel('은하 월', { exact: true }).fill('2');
        await page.getByLabel('은하 일', { exact: true }).fill('30');
        const dialog = page.waitForEvent('dialog');
        await page.getByRole('button', { name: '귀인 지도 만들기', exact: true }).click();
        assert.equal((await dialog).message(), '존재하지 않는 생년월일입니다. 날짜를 다시 확인해주세요.');
        assert.equal(await ownerName.inputValue(), fixture.raw);
        assert.deepEqual(posts, []);
        await layout(page, ownerForm, label + '-owner-error');
      });
      await page.getByLabel('은하 월', { exact: true }).fill('1');
      await page.getByLabel('은하 일', { exact: true }).fill('1');
      await check(label + '-owner-save-and-display', page, async () => {
        const response = page.waitForResponse(response => new URL(response.url()).pathname === '/api/guin' && response.request().method() === 'POST');
        const outcome = Promise.race([
          page.waitForURL(/\/guin\/[a-zA-Z0-9_-]+$/, { timeout: 8000 }).then(() => 'navigation', error => error.message),
          page.waitForEvent('dialog', { timeout: 8000 }).then(dialog => dialog.message(), error => error.message),
        ]);
        await page.getByRole('button', { name: '귀인 지도 만들기', exact: true }).click();
        const result = await response;
        assert.equal(result.status(), 200);
        assert.equal(ownerReplies.length, 1);
        assert.equal(ownerReplies[0].status, 200);
        created = ownerReplies[0].data.guinMap;
        mapPath = '/guin/' + created.id;
        observations.push({ label, flow: 'owner', rawUnits: fixture.raw.length, storedName: created.ownerName, storedUnits: created.ownerName.length });
        assert.equal(created.ownerName, fixture.expected);
        assert.equal(await outcome, 'navigation');
        await page.locator('.galaxy-heading h1').waitFor();
        assert.equal((await page.locator('.galaxy-heading h1').textContent()).trim(), fixture.expected + '의 갤럭시');
        assert.equal(await page.evaluate(() => sessionStorage.getItem('saju:galaxy-path')), mapPath);
      });
      if (!created) throw new Error('Owner form did not create a test map');
      await check(label + '-owner-reopen-and-refresh', page, async () => {
        await page.goto(origin + '/guin', { waitUntil: 'networkidle' });
        assert.equal(await ownerName.inputValue(), fixture.expected);
        await page.reload({ waitUntil: 'networkidle' });
        assert.equal(await ownerName.inputValue(), fixture.expected);
        const tab = page.locator('.bottom-nav a').filter({ hasText: '은하' });
        assert.equal(await tab.getAttribute('href'), mapPath);
        assert.equal(posts.length, 1, 'Reopen and reload must not create another map');
      });
      await page.goto(origin + mapPath, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: '친구 행성 등록', exact: true }).click();
      const friendName = page.getByPlaceholder('예: 지우', { exact: true });
      await friendName.fill(fixture.raw);
      await check(label + '-friend-close-and-reopen-draft', page, async () => {
        await page.getByRole('button', { name: '✕', exact: true }).click();
        assert.equal(await friendName.count(), 0);
        await page.getByRole('button', { name: '친구 행성 등록', exact: true }).click();
        assert.equal(await friendName.inputValue(), fixture.raw);
      });
      const friendForm = page.locator('form');
      const numbers = friendForm.locator('input[type=number]');
      await check(label + '-friend-layout-and-error', page, async () => {
        await layout(page, friendForm, label + '-friend');
        await numbers.nth(1).fill('2'); await numbers.nth(2).fill('30');
        const response = page.waitForResponse(response => new URL(response.url()).pathname === '/api' + mapPath && response.request().method() === 'POST');
        const dialog = page.waitForEvent('dialog');
        await page.getByRole('button', { name: '귀인 등록 완료하기', exact: true }).click();
        assert.equal((await response).status(), 400);
        assert.equal((await dialog).message(), '등록 중 오류가 발생했습니다.');
        assert.equal(await friendName.inputValue(), fixture.raw);
        assert.equal(await page.locator('.relationship-card').count(), 1);
        await layout(page, friendForm, label + '-friend-error');
      });
      await numbers.nth(1).fill('3'); await numbers.nth(2).fill('10');
      await check(label + '-friend-save-and-display', page, async () => {
        const response = page.waitForResponse(response => new URL(response.url()).pathname === '/api' + mapPath && response.request().method() === 'POST');
        const dialog = page.waitForEvent('dialog');
        await page.getByRole('button', { name: '귀인 등록 완료하기', exact: true }).click();
        const result = await response;
        assert.equal(result.status(), 200);
        const person = (await result.json()).newPerson;
        assert.equal((await dialog).message(), fixture.expected + '님의 우리은하에 등록되었습니다! ✨');
        observations.push({ label, flow: 'friend', storedName: person.name, storedUnits: person.name.length });
        assert.equal(person.name, fixture.expected);
        assert.equal(await friendName.count(), 0);
        assert.equal((await page.locator('.relationship-card h4').last().textContent()).trim(), fixture.expected);
      });
      await check(label + '-friend-reopen-refresh-and-storage', page, async () => {
        await page.getByRole('button', { name: '친구 행성 등록', exact: true }).click();
        assert.equal(await friendName.inputValue(), '', 'Saved name is shown in the card; a new draft starts empty');
        await page.keyboard.press('Escape');
        assert.equal((await page.locator('.relationship-card h4').last().textContent()).trim(), fixture.expected);
        const count = posts.length;
        await page.reload({ waitUntil: 'networkidle' });
        assert.equal((await page.locator('.galaxy-heading h1').textContent()).trim(), fixture.expected + '의 갤럭시');
        assert.equal((await page.locator('.relationship-card h4').last().textContent()).trim(), fixture.expected);
        const saved = await page.request.get(origin + '/api' + mapPath);
        assert.equal(saved.status(), 200);
        const map = (await saved.json()).guinMap;
        assert.equal(map.ownerName, fixture.expected);
        assert.equal(map.guins.find(person => person.isMe).name, fixture.expected + ' (나)');
        assert.equal(map.guins.find(person => !person.isMe).name, fixture.expected);
        assert.equal(posts.length, count, 'Modal and reload must not save a second friend');
        await page.screenshot({ path: path.join(output, phase + '-' + label + '-saved.png'), fullPage: true });
      });
    } catch (error) { checks.push({ name: label + '-scenario', status: 'FAIL', error: error.message }); }
    finally { await context.close(); }
  }
  await check('no-external-calls-or-browser-exceptions', null, async () => { assert.deepEqual(outbound, []); assert.deepEqual(errors, []); });
} catch (error) { checks.push({ name: 'harness', status: 'FAIL', error: error.stack || String(error) }); }
finally { if (browser) await browser.close(); await mf.dispose(); }
const report = { status: checks.every(check => check.status === 'PASS') ? 'PASS' : 'FAIL', browserVersion,
  coverage: { widths, fixtures: fixtures.map(fixture => fixture.key) }, checks, observations, layouts, dialogs,
  limits: ['Synthetic disposable local Worker/D1 and identities only; no hosted login or production records',
    'Native alert text and handling tested; browser/OS popup geometry cannot be measured by page DOM screenshots',
    'Software WebGL is used to load the real map UI; no 3D art or physical-device validation'] };
await fs.writeFile(path.join(output, 'forms-' + phase + '-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, browserVersion, checks: checks.length, failures: checks.filter(check => check.status === 'FAIL'), observations }, null, 2));
if (report.status !== 'PASS') process.exitCode = 1;
