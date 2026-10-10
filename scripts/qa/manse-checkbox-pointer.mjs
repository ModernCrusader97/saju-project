// Actual built Manse page: fresh native pointer coordinates, no forced clicks or API calls.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Miniflare } from 'miniflare';

const root = process.cwd(), phase = process.env.SAJU_QA_PHASE || 'after';
assert(['before', 'after'].includes(phase));
const output = path.join(root, 'outputs/manse-checkbox-pointer', phase);
await fs.mkdir(output, { recursive: true });
const { chromium } = await import(pathToFileURL(process.env.SAJU_QA_PLAYWRIGHT_PATH).href);
const widths = [320, 360, 390, 430, 1100];
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
  cf: false, telemetry: { enabled: false }, d1Databases: { DB: 'manse-pointer-synthetic' }, d1Persist: false,
  assets: { directory: 'dist/client', routerConfig: { has_user_worker: true } },
  outboundService: async r => { outbound.push(new URL(r.url).hostname); return new Response('blocked', { status: 502 }); },
});
let browser, origin;
async function view(width) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, extraHTTPHeaders: {
    'oai-authenticated-user-id': 'manse-pointer-synthetic', 'oai-authenticated-user-email': 'qa@example.invalid',
  } });
  await context.route('**/*', r => new URL(r.request().url()).origin === origin
    ? r.continue() : (outbound.push(new URL(r.request().url()).hostname), r.abort()));
  await context.route('**/api/**', r => { api.push({ method: r.request().method(), path: new URL(r.request().url()).pathname }); return r.abort(); });
  const page = await context.newPage();
  page.setDefaultTimeout(10000); page.on('pageerror', e => errors.push(e.message));
  await page.goto(origin + '/manse', { waitUntil: 'networkidle' });
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: '정통 만세력 계산하기', exact: true }) });
  const unknown = form.getByRole('checkbox', { name: '시간 모름 (3주만 풀이)', exact: true });
  const hour = form.getByRole('spinbutton', { name: '태어난 시 (0~23시):', exact: true });
  const frames = () => page.evaluate(async () => { for (let i = 0; i < 3; i++) await new Promise(r => requestAnimationFrame(r)); });
  // Observation only: native browser event targets and trust; no application handlers are invoked.
  await page.evaluate(() => {
    window.__mansePointerEvents = [];
    const record = event => window.__mansePointerEvents.push({ type: event.type, trusted: event.isTrusted,
      targetId: event.target.id, targetType: event.target.type, targetTag: event.target.tagName,
      x: event.clientX, y: event.clientY });
    document.addEventListener('pointerdown', record, true); document.addEventListener('click', record, true);
  });
  async function geometry() {
    await unknown.scrollIntoViewIfNeeded(); await frames();
    return unknown.evaluate(el => {
      const hour = document.getElementById('manse-hour'), group = hour.parentElement, row = group.parentElement;
      const rect = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
      const checkboxRect = rect(el), hourRect = rect(hour);
      const x = checkboxRect.x + checkboxRect.width / 2, y = checkboxRect.y + checkboxRect.height / 2;
      const hit = document.elementFromPoint(x, y);
      const overlap = Math.max(0, Math.min(checkboxRect.right, hourRect.right) - Math.max(checkboxRect.x, hourRect.x))
        * Math.max(0, Math.min(checkboxRect.bottom, hourRect.bottom) - Math.max(checkboxRect.y, hourRect.y));
      const style = node => { const s = getComputedStyle(node); return { flex: s.flex, flexWrap: s.flexWrap,
        minWidth: s.minWidth, maxWidth: s.maxWidth, opacity: s.opacity, position: s.position, zIndex: s.zIndex, pointerEvents: s.pointerEvents }; };
      return { checked: el.checked, hourDisabled: hour.disabled, hourValue: hour.value,
        checkboxRect, hourRect, groupRect: rect(group), rowRect: rect(row), labelRect: rect(el.parentElement),
        center: { x, y }, centerInsideCurrentCheckbox: x > checkboxRect.x && x < checkboxRect.right && y > checkboxRect.y && y < checkboxRect.bottom,
        centerInsideViewport: x >= 0 && x < innerWidth && y >= 0 && y < innerHeight,
        centerHitsCheckbox: hit === el, centerHit: { tag: hit?.tagName, id: hit?.id, type: hit?.type, disabled: hit?.disabled },
        overlapArea: overlap, rowStyle: style(row), groupStyle: style(group), hourStyle: style(hour), checkboxStyle: style(el),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth };
    });
  }
  const pointer = async record => { await page.mouse.click(record.center.x, record.center.y); await frames(); };
  return { page, form, unknown, hour, frames, geometry, pointer, close: () => context.close() };
}
async function check(name, width, run) {
  console.log('RUN ' + name); const v = await view(width);
  try { await run(v); checks.push({ name, width, status: 'PASS' }); console.log('PASS ' + name); }
  catch (e) { checks.push({ name, width, status: 'FAIL', error: e.message }); console.error(e.message); }
  finally { await v.close(); }
}
try {
  origin = (await mf.ready).origin;
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  for (const width of widths) await check(`checkbox center toggles both ways without hour overlap at ${width}px`, width, async v => {
    const initial = await v.geometry();
    if ([390, 1100].includes(width)) await v.form.screenshot({ path: path.join(output, `form-${width}-known.png`) });
    // Recompute after screenshots, scroll and each state change; stale QA coordinates cannot cause the result.
    const first = await v.geometry(); await v.pointer(first);
    const checked = await v.geometry();
    if ([390, 1100].includes(width)) await v.form.screenshot({ path: path.join(output, `form-${width}-unknown.png`) });
    const second = await v.geometry(); await v.pointer(second);
    const unchecked = await v.geometry();
    const events = await v.page.evaluate(() => window.__mansePointerEvents);
    observations.push({ scenario: 'fresh native checkbox center clicks', width, initial, first, checked, second, unchecked, events });
    assert(checked.checked && checked.hourDisabled, 'first native pointer click must check unknown time and disable hour');
    assert(!unchecked.checked && !unchecked.hourDisabled, 'second native pointer click must uncheck unknown time and enable hour');
    for (const r of [first, second, unchecked]) {
      assert(r.centerInsideCurrentCheckbox && r.centerInsideViewport, 'fresh center must be within the current checkbox and viewport');
      assert(r.centerHitsCheckbox, 'current checkbox center must hit the checkbox');
      assert.equal(r.overlapArea, 0, 'hour and checkbox rectangles must not overlap');
      assert(!r.horizontalOverflow, 'form must not cause horizontal document overflow');
      assert.equal(r.hourValue, '14');
    }
    assert(events.filter(e => e.type === 'pointerdown').length === 2 && events.every(e => e.trusted));
  });
  await check('native caption clicks toggle unknown time both ways at 390px', 390, async v => {
    const caption = v.form.getByText('시간 모름 (3주만 풀이)', { exact: true });
    await caption.click(); await v.frames(); assert(await v.unknown.isChecked()); assert(await v.hour.isDisabled());
    await caption.click(); await v.frames(); assert(!(await v.unknown.isChecked())); assert(await v.hour.isEnabled());
    assert.equal(await v.hour.inputValue(), '14');
  });
  await check('native Tab and Space preserve disabled-hour skipping at 390px', 390, async v => {
    const day = v.form.getByRole('spinbutton', { name: '일', exact: true });
    await day.focus(); await v.page.keyboard.press('Tab'); assert(await v.hour.evaluate(el => document.activeElement === el));
    await v.page.keyboard.press('Tab'); assert(await v.unknown.evaluate(el => document.activeElement === el));
    await v.page.keyboard.press('Space'); assert(await v.unknown.isChecked()); assert(await v.hour.isDisabled());
    await day.focus(); await v.page.keyboard.press('Tab'); assert(await v.unknown.evaluate(el => document.activeElement === el));
    await v.page.keyboard.press('Shift+Tab'); assert(await day.evaluate(el => document.activeElement === el));
    await v.page.keyboard.press('Tab'); await v.page.keyboard.press('Space');
    assert(!(await v.unknown.isChecked())); assert(await v.hour.isEnabled()); assert.equal(await v.hour.inputValue(), '14');
  });
  checks.push({ name: 'no page errors, API requests or outbound calls', status: errors.length || api.length || outbound.length ? 'FAIL' : 'PASS' });
} finally {
  const report = { basis: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), phase,
    applicationSourceSHA256: createHash('sha256').update(await fs.readFile('app/manse/page.tsx')).digest('hex'),
    widths, passed: checks.filter(c => c.status === 'PASS').length, failed: checks.filter(c => c.status === 'FAIL').length,
    checks, observations, errors, api, outbound,
    limits: ['Actual built Manse page with native Chromium pointer, label and keyboard events.',
      'Fresh viewport coordinates are measured after scrolling and after every state change. No force click, z-index override, handler invocation or event interception fix.',
      'No API call, real user DB or external AI call executes. Physical devices, screen readers, other browsers, hosted authentication and calendar accuracy are not tested.'] };
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  await browser?.close(); await mf.dispose();
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed })); process.exitCode = report.failed ? 1 : 0;
}
