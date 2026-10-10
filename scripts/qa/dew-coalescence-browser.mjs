// Actual WebGL before/after under matched clock, camera, body and shadow state.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
const root = process.cwd(), phase = process.env.SAJU_DEW_PHASE || 'after';
assert(['before', 'after'].includes(phase));
const base = path.resolve(process.env.SAJU_DEW_BASE || '../saju-spirit-effects-normal-checkpoint-20261010');
const reference = path.resolve(process.env.SAJU_FASHION_REFERENCE || '../saju-spirit-fashion-slots-20261010');
const head = cwd => execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
assert.equal(head(base), '9ec0150bf7f595f28541d91355bf64143bd137e8');
assert.equal(head(reference), '3fb604600de32687df4f2b2d3561e88ff9657486');
assert.equal(execFileSync('git', ['status', '--porcelain=v1'], { cwd: reference, encoding: 'utf8' }).trim(), '');
const sourceRoot = phase === 'before' ? base : root;
const output = path.join(root, 'outputs/surface-dew-coalescence/webgl', phase); await fs.mkdir(output, { recursive: true });
const sha = b => createHash('sha256').update(b).digest('hex');
const sourceHashes = Object.fromEntries(await Promise.all(['lib/planet/surface-sliding-dew.ts', 'lib/planet/surface-attachment-exclusions.ts',
  'lib/planet/approved-jade-spirit.ts', 'lib/planet/approved-spirit-motion.ts', 'components/planet/ElementalSpiritCanvas.tsx',
  'public/spirits/jade-v002/body.glb'].map(async f => [f, sha(await fs.readFile(path.join(sourceRoot, f)))])));
const expected = { position: 'f7e39c85723b4220d0e69161e4405c3232d514b18be56e8a3854ec6fff48da8b',
  normal: '80706bee870329a0829113e63ed178f0a904029265da2c96c69ad50f9b1f9cec',
  uv: 'f3300a24812551e09c6b6a4bc31795feb19c80dc22cf1708cda7a64890e9539c',
  index: '934286d3bdd9361657e390c41762923871cec85a48a7d9775b362aee02dc7830' };
const frames = [], cases = [], errors = [], outbound = [];
const server = await createServer({ root, configFile: false, logLevel: 'error',
  resolve: { alias: { '@dew-loader': path.join(sourceRoot, 'lib/planet/approved-jade-spirit.ts'),
    '@dew-environment': path.join(sourceRoot, 'lib/planet/scene-environment.ts'), '@dew-fashion': path.join(reference, 'lib/planet/spirit-fashion.ts') } },
  server: { host: '127.0.0.1', port: 0, fs: { allow: [root, base, reference, '/workspace/saju-project/node_modules'] } },
  optimizeDeps: { noDiscovery: true },
  plugins: [{ name: 'dew-qa', configureServer(s) { s.middlewares.use((req, res, next) => {
    if (!req.url?.startsWith('/__dew')) return next(); res.setHeader('Content-Type', 'text/html');
    res.end('<html><body><script type="module" src="/scripts/qa/dew-coalescence-page.mjs"></script></body></html>');
  }); } }] });
let browser;
function validate(s, day) {
  assert.deepEqual(s.attributes, expected); assert.equal(s.depth, 1.35); assert.equal(s.glError, 0); assert.deepEqual(s.errors, []);
  assert.equal(s.bodyCasters.length, 8); assert(s.bodyCasters.every(o => o.cast));
  assert(s.shadow.enabled); assert.equal(s.shadow.groundY, -.016); assert.equal(s.shadow.opacity, .09);
  if (day === '계유') assert(s.flags.every(o => !o.cast && !o.receive));
  if (day === '병인') assert(s.flags.filter(o => o.name).every(o => !o.cast));
  assert(s.nativeModel, 'Read the actual linked body shader model uniform.');
  s.nativeModel.forEach((n, i) => assert(Math.abs(n - s.bodyMatrix[i]) < 1e-5));
  assert(Number.isFinite(s.materialTime), 'Read the actual linked material time, even for delta=0.');
}
async function capture(page, quality, label, args, day = '계유') {
  const s = await page.evaluate(a => window.dewQA.frame(...a), args); validate(s, day);
  const file = quality + '-' + label + '.png', bytes = Buffer.from(s.png.split(',')[1], 'base64');
  delete s.png; await fs.writeFile(path.join(output, file), bytes);
  frames.push({ quality, label, file, pngSHA256: sha(bytes), ...s }); return s;
}
try {
  await server.listen(); const origin = server.resolvedUrls.local[0];
  const { chromium } = await import(pathToFileURL('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const quality of ['high', 'low']) {
    const page = await browser.newPage({ viewport: { width: 640, height: 760 } });
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.route('**/*', route => { const u = new URL(route.request().url());
      if (u.origin === new URL(origin).origin || ['data:', 'blob:'].includes(u.protocol)) return route.continue();
      outbound.push(u.origin); return route.abort(); });
    await page.goto(origin + '__dew?quality=' + quality); await page.waitForFunction(() => !!window.dewQA);
    const initial = await page.evaluate(q => window.dewQA.load(q), quality); validate(initial, '계유');
    let schedule;
    if (phase === 'after') {
      const candidates = initial.lifecycle.pairs.map((p, i) => ({ p, i })).filter(o => o.p.canDetach);
      let selected;
      // Inspect each candidate at the same attached lifecycle phase. Looking
      // only at one global time could select an already hidden/fallen slot.
      for (const candidate of candidates) {
        const cycle = candidate.p.phaseOffset > .25 ? 1 : 0;
        const probe = await page.evaluate(t => window.dewQA.frame(t), (cycle + .30 - candidate.p.phaseOffset) * candidate.p.period);
        const position = probe.instances[candidate.i * 2].center;
        if (position[2] > .05 && position[1] > .35 && position[1] < 1.85) {
          const release = await page.evaluate(t => window.dewQA.frame(t), (cycle + .66 - candidate.p.phaseOffset) * candidate.p.period);
          if (release.lifecycle.pairs[candidate.i].slots[0] === 'fall') { selected = { ...candidate, position }; break; }
        }
      }
      assert(selected, 'Actual front-facing B dew route must be visible at its attached phase.');
      const p = selected.p, cycle = p.phaseOffset > .25 ? 1 : 0;
      schedule = { quality, pair: selected.i, period: p.period, phase: p.phaseOffset,
        times: [.30, .46, .55, .66, .66 + .45 / p.period, .96, 1.25].map(age => (cycle + age - p.phaseOffset) * p.period),
        labels: ['separate', 'merging', 'merged', 'release', 'falling', 'empty', 'regrowth'], zoomTarget: selected.position };
      await fs.writeFile(path.join(output, quality + '-schedule.json'), JSON.stringify(schedule, null, 2) + '\n');
    } else schedule = JSON.parse(await fs.readFile(path.join(root, 'outputs/surface-dew-coalescence/webgl/after', quality + '-schedule.json')));
    await page.evaluate(() => window.dewQA.reset());
    for (let i = 0; i < schedule.times.length; i++) await capture(page, quality, schedule.labels[i], [schedule.times[i]]);
    const selected = frames.filter(f => f.quality === quality && schedule.labels.includes(f.label));
    if (phase === 'after') {
      const a = selected.find(f => f.label === 'separate'), b = selected.find(f => f.label === 'merged');
      const pair = schedule.pair; assert(a.instances[pair * 2 + 1].volume > 0); assert.equal(b.instances[pair * 2 + 1].volume, 0);
      assert(b.instances[pair * 2].volume > a.instances[pair * 2].volume);
      assert.equal(selected.find(f => f.label === 'falling').lifecycle.pairs[pair].slots[0], 'fall');
      assert.equal(selected.find(f => f.label === 'empty').instances[pair * 2].volume, 0);
      assert(selected.find(f => f.label === 'regrowth').instances[pair * 2 + 1].volume > 0);
    }
    for (const label of ['separate', 'merged', 'falling']) {
      const i = schedule.labels.indexOf(label); await page.evaluate(t => window.dewQA.frame(t), schedule.times[i]);
      const zoomed = await page.evaluate(t => window.dewQA.zoom(t), schedule.zoomTarget); validate(zoomed, '계유');
      const file = quality + '-' + label + '-closeup.png', bytes = Buffer.from(zoomed.png.split(',')[1], 'base64'); delete zoomed.png;
      await fs.writeFile(path.join(output, file), bytes); frames.push({ quality, label: label + '-closeup', file, pngSHA256: sha(bytes), ...zoomed });
      await page.evaluate(() => window.dewQA.unzoom());
    }
    if (phase === 'after') {
      await page.evaluate(() => window.dewQA.reset()); const clear = await page.evaluate(t => window.dewQA.frame(t), schedule.times[1]);
      for (const face of ['round-sunglasses', 'fitted-mask']) {
        const dressed = await page.evaluate(f => window.dewQA.fashion(f), face); validate(dressed, '계유');
        assert(dressed.masks.length === 4); assert.deepEqual(dressed.maskOverlaps, []);
        const file = quality + '-fashion-' + face + '.png';
        await fs.writeFile(path.join(output, file), Buffer.from(dressed.png.split(',')[1], 'base64')); delete dressed.png;
        frames.push({ quality, label: 'fashion-' + face, file, ...dressed });
        const moving = await page.evaluate(t => window.dewQA.wave(t), schedule.times[1]); validate(moving, '계유');
        assert(moving.morph[0] > 0 && moving.morph[0] <= .45);
        assert.deepEqual(moving.maskOverlaps, [], 'Posed surface and flying beads stay outside all four actual accessory envelopes.');
        const waveFile = quality + '-fashion-' + face + '-wave.png', waveBytes = Buffer.from(moving.png.split(',')[1], 'base64');
        delete moving.png; await fs.writeFile(path.join(output, waveFile), waveBytes);
        frames.push({ quality, label: 'fashion-' + face + '-wave', file: waveFile, pngSHA256: sha(waveBytes), ...moving });
        await page.evaluate(() => window.dewQA.clearFashion()); await page.evaluate(() => window.dewQA.reset());
        const restored = await page.evaluate(t => window.dewQA.frame(t), schedule.times[1]);
        assert.equal(restored.matrixSHA256, clear.matrixSHA256); assert.equal(restored.pixels, clear.pixels);
      }
    }
    await page.evaluate(q => window.dewQA.load(q, '병인'), quality);
    const fire = await capture(page, quality, 'fire-shadow-same-time', [2.25, .6], '병인');
    cases.push({ quality, schedule, cleanup: await page.evaluate(() => window.dewQA.dispose()), firePixels: fire.pixels });
    assert.equal(cases.at(-1).cleanup.nativeLiveBeforeForcedLoss, 0);
    assert.equal(cases.at(-1).cleanup.created, cases.at(-1).cleanup.explicitDeleted);
    await page.close(); console.log('PASS ' + phase + ' ' + quality);
  }
  assert.deepEqual(errors, []); assert.deepEqual(outbound, []);
} catch (e) { errors.push(e.stack || String(e)); process.exitCode = 1; console.error(e); }
finally {
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ status: process.exitCode ? 'FAIL' : 'PASS', phase,
    sourceRoot, sourceCommit: head(sourceRoot), sourceHashes, fashionReferenceCommit: head(reference),
    harnessSHA256: sha(await fs.readFile(new URL(import.meta.url))), pageSHA256: sha(await fs.readFile(path.join(root, 'scripts/qa/dew-coalescence-page.mjs'))),
    cases, frames, errors, outbound, limitations: ['Actual source loader/GLB/materials in local Chromium SwiftShader; exact production Worker separately checked.',
      'Same body/material time, camera and shadows for before/after; no physical GPU or hosted logged-in validation.'] }, null, 2) + '\n');
  await browser?.close(); await server.close();
}
