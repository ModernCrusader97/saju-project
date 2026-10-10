// Real React page; controlled feedback time, clipboard and HTTP boundaries.
// Visual components/navigation are stubs. No hosted services or user database.
import fs from 'node:fs/promises';
import path from 'node:path';
import Module, { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import ts from 'typescript';
import React, { act } from 'react';

const root = process.cwd(), phase = process.env.SAJU_QA_PHASE || 'after';
assert(['before', 'after'].includes(phase));
const output = path.join(root, 'outputs/share-feedback', phase);
await fs.mkdir(output, { recursive: true });
const { JSDOM } = await import(pathToFileURL(process.env.SAJU_QA_JSDOM_PATH ||
  path.join(root, '.sites-runtime/test-tools/node_modules/jsdom/lib/api.js')).href);
const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://local.test/guin/qa-share-a' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document,
  HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
const { createRoot } = await import('react-dom/client');
const require = createRequire(import.meta.url), Empty = () => null;
const originalTimeout = globalThis.setTimeout, originalClear = globalThis.clearTimeout;
const originalFetch = globalThis.fetch, originalAlert = globalThis.alert;
const checks = [], observations = [];

async function compile(file, overrides = {}) {
  const absolute = path.join(root, file), source = await fs.readFile(absolute, 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = new Module(absolute); mod.filename = absolute;
  mod.paths = Module._nodeModulePaths(path.dirname(absolute));
  mod.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  mod._compile(code, absolute); return mod.exports;
}
const reader = await compile('lib/http-client.ts');
const map = id => ({ id, ownerName: '합성 복사 검증', ownerBirth: '2000.1.1', ownerDayMaster: '갑',
  ownerTheme: 'wood', createdAt: '2026-01-01T00:00:00.000Z', guins: [] });

async function createView(strict = false) {
  let now = 0, serial = 0, fired = 0, canceled = 0, routeId = 'qa-share-a', mounted = true;
  const timers = new Map(), writes = [];
  // Intercept only the existing two-second feedback deadline; keep React's timers real.
  globalThis.setTimeout = (callback, delay, ...args) => {
    if (delay !== 2000) return originalTimeout(callback, delay, ...args);
    const id = { feedbackTimer: ++serial };
    timers.set(id, { due: now + delay, run: () => callback(...args) }); return id;
  };
  globalThis.clearTimeout = id => {
    if (timers.delete(id)) canceled++; else originalClear(id);
  };
  globalThis.fetch = async (url, options = {}) => {
    assert.equal(options.method, undefined, 'This suite must never create a person');
    assert.match(url, /^\/api\/guin\/qa-share-[ab]$/);
    return Response.json({ guinMap: map(url.split('/').at(-1)) });
  };
  globalThis.alert = () => { throw new Error('Unexpected alert in copy feedback'); };
  Object.defineProperty(navigator, 'clipboard', { configurable: true,
    value: { writeText: async text => { writes.push(text); } } });
  const Page = (await compile('app/guin/[id]/page.tsx', {
    '@/lib/http-client': reader, '@/lib/universe-state': { restoreGalaxyUniverse: Empty },
    'next/navigation': { useParams: () => ({ id: routeId }) }, '@/components/Header': Empty,
    '@/components/planet/GalaxyCanvas': { __esModule: true, default: Empty },
    '@/components/planet/CosmicPassportModal': Empty, '@/components/planet/GalaxyPokedexModal': Empty,
    '@/lib/saju/daily-orbital': { calculateDailyOrbitalWeather: () => [] },
  })).default;
  const container = document.createElement('div'); document.body.append(container);
  const renderer = createRoot(container);
  const render = async id => {
    routeId = id; dom.reconfigure({ url: 'http://local.test/guin/' + id });
    const page = React.createElement(Page);
    await act(async () => renderer.render(strict ? React.createElement(React.StrictMode, null, page) : page));
  };
  const button = () => Array.from(container.querySelectorAll('button')).find(e =>
    ['은하 링크 공유', '복사 완료!'].includes(e.textContent.trim()));
  const unmount = async () => {
    if (mounted) { await act(async () => renderer.unmount()); mounted = false; }
  };
  const advance = async milliseconds => {
    const end = now + milliseconds;
    while (true) {
      const next = [...timers].filter(([, timer]) => timer.due <= end).sort((a, b) => a[1].due - b[1].due)[0];
      if (!next) break;
      const [id, timer] = next; now = timer.due; timers.delete(id); fired++;
      await act(async () => timer.run());
    }
    now = end;
  };
  await render(routeId);
  return { render, advance, unmount, writes,
    copy: async () => { assert(button()); await act(async () => button().click()); },
    label: () => button()?.textContent.trim(), pending: () => timers.size,
    facts: () => ({ now, fired, canceled, pending: timers.size, writes: [...writes] }),
    dispose: async () => {
      await unmount(); timers.clear(); container.remove();
      globalThis.setTimeout = originalTimeout; globalThis.clearTimeout = originalClear;
      globalThis.fetch = originalFetch; globalThis.alert = originalAlert;
    } };
}

async function check(name, run, strict = false) {
  const view = await createView(strict); console.log('RUN ' + name);
  try { await run(view); checks.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
  catch (error) { checks.push({ name, status: 'FAIL', error: error.message }); console.error(error.message); }
  finally { observations.push({ name, ...view.facts() }); await view.dispose(); }
}

try {
  await check('single copy stays acknowledged for two seconds', async v => {
    await v.copy(); assert.equal(v.label(), '복사 완료!');
    await v.advance(1999); assert.equal(v.label(), '복사 완료!');
    await v.advance(1); assert.equal(v.label(), '은하 링크 공유'); assert.equal(v.pending(), 0);
  });
  await check('a later copy receives its own full two-second acknowledgment', async v => {
    await v.copy(); await v.advance(1500); await v.copy();
    await v.advance(500); assert.equal(v.label(), '복사 완료!', 'The first copy deadline must not erase the recent acknowledgment');
    await v.advance(1499); assert.equal(v.label(), '복사 완료!');
    await v.advance(1); assert.equal(v.label(), '은하 링크 공유');
  });
  await check('a burst of copies owns one pending feedback deadline', async v => {
    for (let i = 0; i < 5; i++) await v.copy();
    assert.equal(v.pending(), 1, 'Repeated copies must replace their old feedback work');
    await v.advance(2000); assert.equal(v.label(), '은하 링크 공유'); assert.equal(v.facts().fired, 1);
  });
  await check('unmount leaves no pending feedback callback', async v => {
    await v.copy(); await v.unmount();
    assert.equal(v.pending(), 0, 'Leaving the page must cancel its feedback work');
    await v.advance(3000); assert.equal(v.facts().fired, 0);
  });
  await check('a keyed route replacement disposes the old feedback deadline', async v => {
    await v.copy(); await v.advance(500); await v.render('qa-share-b');
    assert.equal(v.label(), '은하 링크 공유'); assert.equal(v.pending(), 0, 'A replaced map must release its feedback deadline');
    await v.advance(2000); assert.equal(v.facts().fired, 0);
  });
  await check('copy can start fresh after the previous acknowledgment expires', async v => {
    await v.copy(); await v.advance(2000); await v.copy();
    await v.advance(1999); assert.equal(v.label(), '복사 완료!');
    await v.advance(1); assert.equal(v.label(), '은하 링크 공유');
  });
  await check('every copy keeps the current map URL and clipboard call count', async v => {
    await v.copy(); await v.copy();
    assert.deepEqual(v.writes, ['http://local.test/guin/qa-share-a', 'http://local.test/guin/qa-share-a']);
  });
  await check('Strict Mode also releases feedback work when the page leaves', async v => {
    await v.copy(); await v.unmount(); assert.equal(v.pending(), 0);
    await v.advance(3000); assert.equal(v.facts().fired, 0);
  }, true);
} finally {
  const source = await fs.readFile(path.join(root, 'app/guin/[id]/page.tsx'));
  const report = { basis: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), phase,
    applicationSourceSHA256: createHash('sha256').update(source).digest('hex'),
    passed: checks.filter(c => c.status === 'PASS').length, failed: checks.filter(c => c.status === 'FAIL').length,
    checks, observations, limits: ['Real React and page/response reader; navigation and 3D components are boundary stubs.',
      'Feedback time, clipboard and HTTP are controlled boundaries; native browser time is verified separately.'] };
  await fs.writeFile(path.join(output, 'dom-results.json'), JSON.stringify(report, null, 2) + '\n');
  dom.window.close(); console.log(JSON.stringify({ passed: report.passed, failed: report.failed }));
  process.exitCode = report.failed ? 1 : 0;
}
