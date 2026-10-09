// Actual modal, Chromium Canvas and PNG downloads. No API or user data.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'vite';
import ts from 'typescript';

const root = fileURLToPath(new URL('../..', import.meta.url));
const output = path.join(root, 'outputs/passport-title-fit');
const phase = process.env.SAJU_QA_PHASE === 'before' ? 'before' : 'after';
await fs.mkdir(output, { recursive: true });
const baselineSHA = 'd84d77659faa7942c903f14885f3a7eaa47c2801';
const component = 'components/planet/CosmicPassportModal.tsx';
const baseline = execFileSync('git', ['show', baselineSHA + ':' + component], { cwd: root, encoding: 'utf8' });
// Keep disposable browser fixtures outside the application's TypeScript inputs.
for (const filename of ['baseline.tsx', 'harness.tsx']) await fs.rm(path.join(output, filename), { force: true });
await fs.writeFile(path.join(output, 'baseline-source.txt'), baseline);
await fs.writeFile(path.join(output, 'baseline.jsx'), ts.transpileModule(baseline, {
  fileName: component, compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.Preserve },
}).outputText);
await fs.writeFile(path.join(output, 'harness.jsx'), `
import React from 'react';
import { createRoot } from 'react-dom/client';
import Current from '/components/planet/CosmicPassportModal.tsx';
import Baseline from './baseline.jsx';
const root = createRoot(document.getElementById('root'));
window.mountPassport = (variant, name, snapshot) => {
  const person = Object.freeze({ id: 'synthetic', name, birthDate: '2000.1.1',
    relationType: 'mentor', relationTitle: '합성', dayMaster: '갑목', elementMatch: '목',
    affinityScore: 100, advice: '합성 자료', pillars: { dayKey: '갑자' } });
  window.passportPerson = person;
  root.render(React.createElement(variant === 'baseline' ? Baseline : Current,
    { key: variant + name + snapshot, person, isOpen: true,
      onClose: () => root.render(null), planetSnapshotUrl: snapshot }));
};
window.ready = true;
`);

const cases = [
  { id: 'short-korean', name: '합성이', short: true },
  { id: 'short-english', name: 'QA', short: true },
  { id: 'short-emoji', name: '😀', short: true },
  { id: 'short-zwj', name: '👨‍👩‍👧‍👦', short: true },
  { id: 'short-combining', name: 'e\u0301', short: true },
  { id: 'empty', name: '', short: true },
  { id: 'shrink-only', name: '가'.repeat(10) },
  { id: 'long-korean', name: '가'.repeat(50) },
  { id: 'long-english', name: 'W'.repeat(50) },
  { id: 'long-emoji', name: '😀'.repeat(25) },
  { id: 'long-zwj', name: '👨‍👩‍👧‍👦'.repeat(40) },
  { id: 'long-combining', name: 'e\u0301'.repeat(150) },
  { id: 'short-snapshot', name: '합성이', short: true, snapshot: true },
];
const records = [], checks = [], errors = [], outbound = [];
async function check(name, run) {
  try { await run(); checks.push({ name, status: 'PASS' }); }
  catch (error) { checks.push({ name, status: 'FAIL', error: error.message }); }
}
const server = await createServer({ root, configFile: false, logLevel: 'error',
  resolve: { alias: { '@': root } },
  optimizeDeps: { include: ['react', 'react-dom/client', 'lucide-react'] },
  server: { host: '127.0.0.1', port: 0 },
  plugins: [{ name: 'passport-title-qa', configureServer(server) {
    server.middlewares.use((request, response, next) => {
      if (request.url !== '/__passport-title') return next();
      response.setHeader('Content-Type', 'text/html');
      response.end('<!doctype html><div id="root"></div><script type="module" src="/outputs/passport-title-fit/harness.jsx"></script>');
    });
  } }],
});
let browser, browserVersion;
try {
  await server.listen();
  const origin = 'http://127.0.0.1:' + server.httpServer.address().port;
  const playwrightPath = process.env.SAJU_QA_PLAYWRIGHT_PATH || path.join(root, '.sites-runtime/test-tools/node_modules/playwright/index.mjs');
  const { chromium } = await import(pathToFileURL(playwrightPath).href);
  browser = await chromium.launch({ ...(process.env.SAJU_QA_CHROME ? { executablePath: process.env.SAJU_QA_CHROME } : {}),
    headless: true, args: ['--no-sandbox'] });
  browserVersion = await browser.version();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
    outbound.push(url.hostname); return route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + '/__passport-title');
  await page.waitForFunction(() => window.ready);
  await page.evaluate(async () => {
    await document.fonts.ready;
    let seed = 1;
    Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const isCard = canvas => canvas.width === 1080 && canvas.height === 1920;
    const fillRect = CanvasRenderingContext2D.prototype.fillRect;
    CanvasRenderingContext2D.prototype.fillRect = function(...args) {
      if (isCard(this.canvas) && args.join(',') === '0,0,1080,1920') seed = 20261010;
      return fillRect.apply(this, args);
    };
    const roundRect = CanvasRenderingContext2D.prototype.roundRect;
    CanvasRenderingContext2D.prototype.roundRect = function(...args) {
      if (isCard(this.canvas) && args[1] === 240) window.frame = args;
      return roundRect.apply(this, args);
    };
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text, x, y, ...args) {
      if (isCard(this.canvas) && x === 540 && y === 360) {
        const fontSize = Number(this.font.match(/(\d+)px/)[1]);
        const metrics = this.measureText(text);
        const probe = document.createElement('canvas'); probe.width = 1080; probe.height = 160;
        const ctx = probe.getContext('2d'); ctx.font = this.font; ctx.textAlign = this.textAlign;
        ctx.fillStyle = this.fillStyle; ctx.fillText(text, 540, 110);
        const pixels = ctx.getImageData(0, 0, 1080, 160).data;
        let left = 1080, right = -1, ink = 0;
        for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) {
          const px = ((i - 3) / 4) % 1080; left = Math.min(left, px); right = Math.max(right, px); ink++;
        }
        window.title = { text, font: this.font, fontSize, width: metrics.width,
          actualLeft: metrics.actualBoundingBoxLeft, actualRight: metrics.actualBoundingBoxRight,
          inkBounds: { left, right }, ink, x, y };
      }
      return fillText.call(this, text, x, y, ...args);
    };
    const toDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(...args) {
      if (isCard(this)) window.card = this;
      return toDataURL.apply(this, args);
    };
    const snapshot = document.createElement('canvas'); snapshot.width = 64; snapshot.height = 64;
    const ctx = snapshot.getContext('2d'); ctx.fillStyle = '#1ca575'; ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#caedf1'; ctx.fillRect(16, 16, 32, 32);
    window.snapshot = snapshot.toDataURL('image/png');
  });

  async function capture(variant, fixture) {
    await page.evaluate(() => { window.frame = null; window.title = null; window.card = null; });
    await page.evaluate(({ variant, name, snapshot }) => window.mountPassport(variant, name, snapshot ? window.snapshot : undefined),
      { variant, name: fixture.name, snapshot: fixture.snapshot });
    await page.getByRole('dialog', { name: '우주 여권', exact: true }).waitFor();
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: '인스타 스토리용 9:16 카드 저장 (PNG)', exact: true }).click();
    const download = await pending;
    const file = phase + '-' + variant + '-' + fixture.id + '.png';
    await download.saveAs(path.join(output, file));
    const data = await page.evaluate(async () => {
      const ctx = window.card.getContext('2d');
      const bytes = ctx.getImageData(0, 0, 1080, 1920).data;
      const hash = await crypto.subtle.digest('SHA-256', bytes);
      const sha256 = [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, '0')).join('');
      bytes.fill(0, 250 * 1080 * 4, 400 * 1080 * 4);
      const restHash = await crypto.subtle.digest('SHA-256', bytes);
      const nonTitleSha256 = [...new Uint8Array(restHash)].map(value => value.toString(16).padStart(2, '0')).join('');
      return { title: window.title, frame: window.frame, width: window.card.width, height: window.card.height,
        sha256, nonTitleSha256, originalName: window.passportPerson.name, valid: window.title.text.isWellFormed() };
    });
    return { ...data, file };
  }
  for (const fixture of cases) {
    const original = await capture('baseline', fixture);
    const current = await capture('current', fixture);
    records.push({ id: fixture.id, nameUnits: fixture.name.length, baseline: original, current });
    await check(fixture.id + ': title stays inside current frame and name stays intact', async () => {
      assert.deepEqual(current.frame, [80, 240, 920, 1500, 48]);
      assert.equal(current.width, 1080); assert.equal(current.height, 1920);
      assert.equal(current.originalName, fixture.name);
      assert.equal(current.nonTitleSha256, original.nonTitleSha256, 'Pixels outside the title band must not change');
      assert(current.valid);
      assert(current.title.width <= 872);
      assert(current.title.ink > 0);
      assert(current.title.inkBounds.left >= 104 && current.title.inkBounds.right < 976,
        'Actual glyph pixels must stay inside x=104..975');
      assert(current.title.fontSize >= 36 && current.title.fontSize <= 72);
    });
    if (fixture.short) await check(fixture.id + ': original 72px full-image pixels remain identical', async () => {
      assert(original.title.width <= 872, 'Fixture must be a fitting original short title');
      assert.equal(current.title.font, 'bold 72px serif');
      assert.equal(current.title.text, `${fixture.name}님의 우주 정령`);
      assert.equal(current.sha256, original.sha256, 'All 1080×1920 RGBA pixels must match');
      assert((await fs.readFile(path.join(output, current.file))).equals(await fs.readFile(path.join(output, original.file))),
        'Downloaded PNG bytes must also match');
    });
    if (!fixture.short) await check(fixture.id + ': reduce font then preserve complete graphemes', async () => {
      const fit = await page.evaluate(({ name, title }) => {
        const text = name + '님의 우주 정령';
        const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d'); ctx.textAlign = 'center';
        const fits = value => { const m = ctx.measureText(value); return Math.max(m.width, 2 * m.actualBoundingBoxLeft, 2 * m.actualBoundingBoxRight) <= 872; };
        ctx.font = 'bold 36px serif';
        const fullFitsAt36 = fits(text);
        const graphemes = [...new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(text)].map(item => item.segment);
        const prefix = title.text.endsWith('…') ? title.text.slice(0, -1) : title.text;
        const count = graphemes.findIndex((_, index) => graphemes.slice(0, index + 1).join('') === prefix) + 1;
        const nextDoesNotFit = !fits(graphemes.slice(0, count + 1).join('') + '…');
        ctx.font = 'bold ' + (title.fontSize + 1) + 'px serif';
        return { text, fullFitsAt36, graphemePrefix: count > 0 || prefix === '', nextDoesNotFit,
          nextFontFits: fits(text) };
      }, { name: fixture.name, title: current.title });
      if (fit.fullFitsAt36) {
        assert.equal(current.title.text, fit.text);
        assert(current.title.fontSize < 72);
        assert.equal(fit.nextFontFits, false, 'Use the largest fitting font');
      } else {
        assert.equal(current.title.fontSize, 36);
        assert(current.title.text.endsWith('…'));
        assert(fit.graphemePrefix, 'Ellipsis may follow only a complete grapheme prefix');
        assert(fit.nextDoesNotFit, 'Keep the longest fitting grapheme prefix');
      }
    });
  }
  await check('existing Escape close behavior and no browser exceptions or external requests', async () => {
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog', { name: '우주 여권', exact: true }).count(), 0);
    assert.deepEqual(errors, []); assert.deepEqual(outbound, []);
  });
} catch (error) { checks.push({ name: 'harness', status: 'FAIL', error: error.stack || String(error) }); }
finally { if (browser) await browser.close(); await server.close(); }
const report = { status: checks.every(check => check.status === 'PASS') ? 'PASS' : 'FAIL', baselineSHA, browserVersion,
  cases: records, checks, limits: ['Actual modal in an isolated Vite page; full production routing is separate',
    'Stars are seeded only in QA for pixel comparison', 'Synthetic immutable name props and one fixed snapshot only; no actual user records'] };
await fs.writeFile(path.join(output, 'canvas-' + phase + '-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, cases: records.length, browserVersion, checks }, null, 2));
if (report.status !== 'PASS') process.exitCode = 1;
