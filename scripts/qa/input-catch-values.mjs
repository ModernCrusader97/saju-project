// Actual React modal/response reader; controlled rejection values, no server writes.
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
const output = path.join(root, 'outputs/input-catch-values', phase);
await fs.mkdir(output, { recursive: true });
const { JSDOM } = await import(pathToFileURL(process.env.SAJU_QA_JSDOM_PATH).href);
const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://local.test/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
  IS_REACT_ACT_ENVIRONMENT: true });
const { createRoot } = await import('react-dom/client');
const require = createRequire(import.meta.url), { createLoader } = require('./load-ts.cjs');
async function compile(file, overrides = {}) {
  const absolute = path.join(root, file);
  const code = ts.transpileModule(await fs.readFile(absolute, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const m = new Module(absolute); m.filename = absolute; m.paths = Module._nodeModulePaths(path.dirname(absolute));
  m.require = name => Object.hasOwn(overrides, name) ? overrides[name] : require(name);
  m._compile(code, absolute); return m.exports;
}
const Modal = (await compile('components/SajuInputModal.tsx', {
  '@/lib/http-client': await compile('lib/http-client.ts'), '@/lib/saju/input': createLoader().load('lib/saju/input.ts'),
})).default;
const original = { fetch: globalThis.fetch, alert: globalThis.alert, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
const checks = [], observations = [];
const cases = [
  ['Error rejection', request => request.reject(new Error('Synthetic private detail'))],
  ['string rejection', request => request.reject('Synthetic private string')],
  ['null rejection', request => request.reject(null)],
  ['unreadable message property', (request, record) => request.reject(Object.defineProperty({}, 'message', {
    get() { record.messageReads++; throw new Error('The error payload must remain unread'); },
  }))],
  ['active rejection named AbortError', request => request.reject(new DOMException('Synthetic active rejection', 'AbortError'))],
  ['malformed JSON response', request => request.resolve(new Response('{broken', { headers: { 'content-type': 'application/json' } }))],
  ['invalid JSON shape', request => request.resolve(Response.json(null))],
];
try {
  for (const [name, deliver] of cases) {
    console.log('RUN ' + name);
    const alerts = [], requests = [], timers = new Map(), results = [], record = { name, messageReads: 0, closes: 0 };
    globalThis.fetch = (url, options) => {
      assert.equal(url, '/api/saju'); assert.equal(options.method, 'POST');
      return new Promise((resolve, reject) => requests.push({ options, resolve, reject }));
    };
    globalThis.alert = message => alerts.push(message);
    globalThis.setTimeout = (callback, delay, ...args) => {
      if (delay !== 900) return original.setTimeout(callback, delay, ...args);
      const id = {}; timers.set(id, () => callback(...args)); return id;
    };
    globalThis.clearTimeout = id => { if (!timers.delete(id)) original.clearTimeout(id); };
    const container = document.createElement('div'); document.body.append(container); const renderer = createRoot(container);
    try {
      await act(async () => renderer.render(React.createElement(Modal, { isOpen: true,
        onClose: () => { record.closes++; }, onSuccess: result => results.push(result) })));
      const input = () => container.querySelector('input[placeholder="예: 홍길동"]');
      await act(async () => {
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input(), '합성 오류 검증');
        input().dispatchEvent(new dom.window.Event('input', { bubbles: true }));
        container.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
      });
      assert.equal(requests.length, 1); assert.equal(timers.size, 1);
      await act(async () => deliver(requests[0], record));
      assert.deepEqual(alerts, ['네트워크 오류가 발생했습니다.']); assert.equal(record.messageReads, 0);
      assert.equal(input()?.value, '합성 오류 검증'); assert.equal(timers.size, 0);
      assert.equal(requests[0].options.signal.aborted, false); assert.deepEqual(results, []); assert.equal(record.closes, 0);
      checks.push({ name, status: 'PASS' }); console.log('PASS ' + name);
    } catch (error) { checks.push({ name, status: 'FAIL', error: String(error?.message || error) }); console.error(error?.message || error); }
    finally {
      observations.push({ ...record, alerts, requests: requests.length, pendingTimers: timers.size,
        results: results.length, activeSignalAborted: requests[0]?.options.signal.aborted });
      await act(async () => renderer.unmount()); timers.clear(); container.remove(); Object.assign(globalThis, original);
    }
  }
} finally {
  const report = { basis: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), phase,
    applicationSourceSHA256: createHash('sha256').update(await fs.readFile('components/SajuInputModal.tsx')).digest('hex'),
    passed: checks.filter(c => c.status === 'PASS').length, failed: checks.filter(c => c.status === 'FAIL').length,
    checks, observations,
    limits: ['Actual React/modal and response reader in jsdom; alert, HTTP and progress-time boundaries are controlled.',
      'No existing runtime defect is claimed. This suite preserves exception-shape-independent generic error handling.',
      'No native-browser, real server write, hosted-authentication or external AI check is performed.'] };
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  Object.assign(globalThis, original); dom.window.close();
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed })); process.exitCode = report.failed ? 1 : 0;
}
