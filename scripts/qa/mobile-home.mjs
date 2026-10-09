// Real built app, local disposable D1, synthetic identity and existing static images.
// No hosted auth, real user DB, provider traffic or deployment.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { Miniflare } from 'miniflare';

const root = process.cwd(), phase = process.env.SAJU_QA_HOME_PHASE || 'after';
assert(['before', 'after'].includes(phase));
const output = path.join(root, 'outputs/mobile-home', phase);
await fs.mkdir(output, { recursive: true });
const checks = [], widths = [], errors = [], outbound = [], sourceChecks = [];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const source = await fs.readFile('app/page.tsx', 'utf8');
const syntax = ts.createSourceFile('app/page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const links = [];
function scan(node) {
  if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(syntax) === 'Link') {
    const attributes = node.attributes.properties.filter(ts.isJsxAttribute);
    const href = attributes.find(a => a.name.getText(syntax) === 'href')?.initializer;
    const prefetch = attributes.find(a => a.name.getText(syntax) === 'prefetch')?.initializer;
    if (href && ts.isStringLiteral(href) && ['/planet', '/guin'].includes(href.text))
      links.push({ href: href.text, disabledPrefetch: !!prefetch && ts.isJsxExpression(prefetch) && prefetch.expression?.kind === ts.SyntaxKind.FalseKeyword });
  }
  ts.forEachChild(node, scan);
}
scan(syntax);
if (phase === 'after') {
  assert(source.includes("from 'next/link'"), 'Home entries must import internal Next Link');
  assert.deepEqual(links.map(l => l.href).sort(), ['/guin', '/planet']);
  assert(links.every(l => l.disabledPrefetch), 'Both entries must disable prefetch');
  sourceChecks.push('two internal Next Links with explicit prefetch=false');
}
const jadeSource = await fs.readFile('assets/source-reference/saju-b-evolving-light-v002/preview_keyframes/001.png');
const jadeRuntime = await fs.readFile('public/spirits/jade-v002/still.png');
assert(jadeSource.equals(jadeRuntime));
const assetHashes = { jade: hash(jadeSource), cosmos: hash(await fs.readFile('public/images/cosmos-cover.png')) };
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
const modules = [entry, ...(await walk(path.join(root, 'dist/server'))).filter(p => p !== entry)].map(p => ({ type: 'ESModule', path: p }));
const mf = new Miniflare({ rootPath: root, modules, modulesRoot: 'dist/server', compatibilityDate: '2026-05-15',
  compatibilityFlags: ['nodejs_compat'], host: '127.0.0.1', port: 0, cf: false, logRequests: false, telemetry: { enabled: false },
  d1Databases: { DB: 'mobile-home-fixture' }, d1Persist: false,
  assets: { directory: 'dist/client', routerConfig: { has_user_worker: true } },
  outboundService: async request => { outbound.push(new URL(request.url).hostname); return new Response('QA blocks outbound', { status: 502 }); },
});
let browser, browserVersion, qaPage, failurePage;
const owner = { 'oai-authenticated-user-id': 'mobile-home-fixture', 'oai-authenticated-user-email': 'qa@example.invalid' };
const readingNames = ['나의 성향', '연애와 관계', '두 사람의 궁합', '일과 재물', '한 해의 흐름', '긴 시간의 흐름', '궁금한 이야기'];
const form = page => page.locator('form.birth-panel');
async function check(name, run) { if (process.env.SAJU_QA_HOME_CHECK && !name.includes(process.env.SAJU_QA_HOME_CHECK)) return; await run(); checks.push(name); console.log('PASS: ' + name); }
try {
  const d1 = await mf.getD1Database('DB');
  for (const file of (await fs.readdir('drizzle')).filter(f => f.endsWith('.sql')).sort())
    for (const sql of (await fs.readFile('drizzle/' + file, 'utf8')).split('--> statement-breakpoint')) if (sql.trim()) await d1.prepare(sql.trim()).run();
  const origin = (await mf.ready).origin;
  const { chromium } = await import(pathToFileURL(process.env.SAJU_QA_PLAYWRIGHT_PATH || path.join(root, '.sites-runtime/browser-qa/node_modules/playwright-core/index.mjs')).href);
  browser = await chromium.launch({ executablePath: process.env.SAJU_QA_CHROME || '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  browserVersion = await browser.version();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: owner, reducedMotion: 'reduce' });
  const requests = [];
  await context.addInitScript(() => {
    window.__homeWebGL = 0;
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) { if (location.pathname === '/' && /^webgl/.test(type)) window.__homeWebGL++; return original.call(this, type, ...args); };
  });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
    outbound.push(url.hostname); return route.abort();
  });
  const page = await context.newPage(); qaPage = page; page.setDefaultTimeout(20000);
  page.on('request', request => requests.push({ url: request.url(), method: request.method(), type: request.resourceType() }));
  page.on('pageerror', error => errors.push(error.stack || error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  async function home() { await page.goto(origin + '/', { waitUntil: 'networkidle' }); await page.getByRole('heading', { name: '나를 닮은 우주', exact: true }).waitFor(); }
  await home();
  await check('five real responsive widths, loaded original images and no horizontal overflow', async () => {
    for (const width of [320, 360, 390, 430, 1100]) {
      await page.setViewportSize({ width, height: width > 767 ? 920 : 844 }); await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(120);
      const measurement = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - innerWidth,
        images: [...document.querySelectorAll('.home-workspace img')].map(image => ({ src: new URL(image.src).pathname, loaded: image.complete && image.naturalWidth > 0, width: image.getBoundingClientRect().width, height: image.getBoundingClientRect().height })),
        inputs: [...document.querySelectorAll('form.birth-panel input:not([type=checkbox])')].map(input => ({ width: input.getBoundingClientRect().width, height: input.getBoundingClientRect().height, fontSize: parseFloat(getComputedStyle(input).fontSize) })),
        canvasCount: document.querySelectorAll('canvas').length, webglCalls: window.__homeWebGL,
        navigation: [...document.querySelectorAll('.bottom-nav a')].map(a => a.textContent.trim()),
      }));
      assert(measurement.overflow <= 1, JSON.stringify({ width, ...measurement }));
      assert(measurement.images.every(image => image.loaded && image.width > 0 && image.height > 0));
      assert(measurement.inputs.every(input => input.width > 40 && input.height >= 44 && (phase === 'before' || input.fontSize >= 16)));
      assert.equal(measurement.canvasCount, 0); assert.equal(measurement.webglCalls, 0);
      assert.deepEqual(measurement.navigation, ['정령', '행성', '은하']);
      if (phase === 'after') {
        assert.deepEqual(measurement.images.map(image => image.src), ['/spirits/jade-v002/still.png', '/images/cosmos-cover.png']);
        await page.getByRole('link', { name: '나의 우주 만들기', exact: true }).waitFor();
        assert.equal(await page.locator('section[aria-label="예시 먼저 둘러보기"]').getByText('예시', { exact: true }).count(), 2);
      }
      await page.screenshot({ path: path.join(output, 'home-' + width + '.png'), fullPage: true });
      await page.screenshot({ path: path.join(output, 'home-' + width + '-viewport.png') });
      widths.push({ width, ...measurement });
    }
  });
  await check('home loads no model, three bundle, route prefetch or WebGL', async () => {
    if (phase === 'after') {
      const cards = page.locator('section[aria-label="예시 먼저 둘러보기"] a');
      for (const card of await cards.all()) { await card.hover(); await card.focus(); }
      await page.waitForTimeout(400);
    }
    const forbidden = requests.filter(request => { const url = new URL(request.url); return /^\/(planet|guin)(?:\.rsc)?(?:\/|$)/.test(url.pathname) || /\.glb$|three[-.]/i.test(url.pathname); });
    assert.deepEqual(forbidden, []); assert.equal(await page.locator('canvas').count(), 0);
  });
  if (phase === 'after') await check('keyboard CTA focuses and scrolls the existing form at all five widths', async () => {
    for (const width of [320, 360, 390, 430, 1100]) {
      await home(); await page.setViewportSize({ width, height: width > 767 ? 920 : 844 });
      const cta = page.getByRole('link', { name: '나의 우주 만들기', exact: true });
      // Reach it through actual keyboard traversal and verify visible focus.
      for (let i = 0; i < 20 && !(await cta.evaluate(el => el === document.activeElement)); i++) await page.keyboard.press('Tab');
      assert(await cta.evaluate(el => el === document.activeElement));
      assert(await cta.evaluate(el => parseFloat(getComputedStyle(el).outlineWidth) >= 3));
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.activeElement?.id === 'birth-form' && Math.abs(document.getElementById('birth-form').getBoundingClientRect().top) < 40);
      await page.keyboard.press('Tab'); assert(await form(page).getByLabel('이름 또는 별명').evaluate(el => el === document.activeElement));
      await page.screenshot({ path: path.join(output, 'form-focus-' + width + '.png') });
    }
  });
  await check('original form defaults, unknown time and invalid-date rejection remain intact', async () => {
    await home();
    assert.equal(await form(page).getByLabel('연도', { exact: true }).inputValue(), '1998');
    assert.equal(await form(page).getByLabel('월', { exact: true }).inputValue(), '5');
    assert.equal(await form(page).getByLabel('일', { exact: true }).inputValue(), '15');
    assert.equal(await form(page).getByLabel('태어난 시각').inputValue(), '14');
    await form(page).getByLabel('시간 모름').check(); assert(await form(page).getByLabel('태어난 시각').isDisabled());
    await form(page).getByLabel('시간 모름').uncheck(); assert(await form(page).getByLabel('태어난 시각').isEnabled());
    await form(page).getByLabel('월', { exact: true }).fill('2'); await form(page).getByLabel('일', { exact: true }).fill('30');
    await form(page).getByRole('button', { name: '나의 우주 보기', exact: true }).click();
    await page.getByRole('alert').getByText('존재하지 않는 생년월일입니다.', { exact: false }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/');
  });
  await check('known and unknown time preserve the original planet query and trimmed/default name', async () => {
    // Only destination document I/O is replaced, keeping the real input handler intact.
    const documents = [];
    await page.route('**/planet?*', async route => {
      if (!route.request().isNavigationRequest()) return route.continue();
      documents.push(route.request().url()); return route.fulfill({ contentType: 'text/html', body: '<html><body>QA destination</body></html>' });
    });
    for (const unknown of [false, true]) {
      await home(); await form(page).getByLabel('이름 또는 별명').fill(unknown ? '' : '  입력 회귀  ');
      await form(page).getByLabel('연도', { exact: true }).fill('2000'); await form(page).getByLabel('월', { exact: true }).fill('1'); await form(page).getByLabel('일', { exact: true }).fill('2');
      if (unknown) await form(page).getByLabel('시간 모름').check();
      await form(page).getByRole('button', { name: '나의 우주 보기', exact: true }).click(); await page.waitForURL('**/planet?*');
      assert.deepEqual(Object.fromEntries(new URL(page.url()).searchParams), { name: unknown ? '나' : '입력 회귀', y: '2000', m: '1', d: '2', h: '14', unknown: String(unknown) });
    }
    assert.equal(documents.length, 2); await page.unroute('**/planet?*');
  });
  await check('all original reading topics still open and the real modal saves to disposable D1', async () => {
    await home();
    for (const name of readingNames) {
      await page.getByRole('button', { name, exact: true }).click();
      await page.getByRole('heading', { name, exact: true }).waitFor(); await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('heading', { name, exact: true }).count(), 0);
    }
    await page.getByRole('button', { name: '나의 성향', exact: true }).click();
    await page.getByPlaceholder('예: 홍길동').fill('홈 저장 회귀');
    const modalForm = page.locator('form').filter({ has: page.getByPlaceholder('예: 홍길동') });
    const submit = modalForm.locator('button[type=submit]');
    const response = page.waitForResponse(response => new URL(response.url()).pathname === '/api/saju' && response.request().method() === 'POST');
    await submit.click(); const result = await (await response).json(); assert.equal(result.success, true); assert(result.fortune.id);
    await page.getByRole('heading', { name: '이번에 남긴 기록', exact: true }).waitFor();
    await page.getByText('홈 저장 회귀', { exact: false }).first().waitFor();
    const list = await (await context.request.get(origin + '/api/saju')).json(); assert(list.fortunes.some(f => f.id === result.fortune.id));
    await page.getByRole('button', { name: '닫기', exact: true }).click(); assert.equal(await page.getByRole('heading', { name: '이번에 남긴 기록', exact: true }).count(), 0);
  });
  await check('existing header drawer keyboard trap, Escape and saved navigation remain usable', async () => {
    await home(); const trigger = page.getByRole('button', { name: '전체 메뉴 열기', exact: true });
    await trigger.click(); const drawer = page.getByRole('dialog', { name: '전체 메뉴', exact: true });
    const close = drawer.getByRole('button', { name: '메뉴 닫기', exact: true }); assert(await close.evaluate(el => el === document.activeElement));
    await page.keyboard.press('Shift+Tab'); assert(await drawer.getByRole('link', { name: '가상 AI 연결 시험', exact: true }).evaluate(el => el === document.activeElement));
    await page.keyboard.press('Tab'); assert(await close.evaluate(el => el === document.activeElement));
    await page.keyboard.press('Escape'); assert.equal(await drawer.count(), 0); assert(await trigger.evaluate(el => el === document.activeElement));
    const saved = page.locator('.home-workspace a[href="/saved"]'); await saved.click(); await page.waitForURL('**/saved'); await page.getByText('홈 저장 회귀', { exact: false }).first().waitFor();
  });
  if (phase === 'after') await check('both real internal entries navigate to their existing routes and keyboard focus is visible', async () => {
    for (const [name, target] of [['정령 · 행성 보기', '/planet'], ['은하 보기', '/guin']]) {
      await home(); const link = page.getByRole('link', { name, exact: true });
      for (let i = 0; i < 20 && !(await link.evaluate(el => el === document.activeElement)); i++) await page.keyboard.press('Tab');
      assert(await link.evaluate(el => el === document.activeElement));
      assert(await link.evaluate(el => parseFloat(getComputedStyle(el).outlineWidth) >= 3));
      await page.keyboard.press('Enter'); await page.waitForURL(url => url.pathname === target);
      assert.equal(new URL(page.url()).pathname, target);
      if (target === '/planet') await page.getByRole('heading', { name: '나를 닮은 정령', exact: true }).waitFor();
      else await page.getByLabel('은하 이름', { exact: true }).waitFor();
      assert.equal(await page.getByRole('heading', { name: '나를 닮은 우주', exact: true }).count(), 0);
    }
  });
  assert.deepEqual(errors, []); assert.deepEqual(outbound, []);
  await context.close(); console.log(JSON.stringify({ status: 'PASS', phase, widths: widths.length, checks: checks.length, sourceChecks }));
} catch (error) {
  errors.push(error.stack || String(error)); process.exitCode = 1; console.error(error);
  if (qaPage) { failurePage = { url: qaPage.url(), ...await qaPage.evaluate(() => ({ active: document.activeElement?.outerHTML, text: document.body.innerText.slice(0, 1200) })) }; await qaPage.screenshot({ path: path.join(output, 'failure.png') }); }
}
finally {
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ status: process.exitCode ? 'FAIL' : 'PASS', phase, browserVersion, sourceChecks, assetHashes, links, widths, checks, errors, outbound, failurePage,
    limits: ['Real built Worker/client/HTML/CSS with Chromium; screenshots require visual inspection', 'Synthetic local identity and fresh disposable D1; no hosted auth or real user data', 'Only successful birth form destination document I/O is stubbed to inspect query parameters; internal Link navigation and modal save are real', 'Home has no WebGL; physical mobile/touch and full planet/galaxy rendering are outside this home regression'] }, null, 2) + '\n');
  await browser?.close(); await mf.dispose();
}
