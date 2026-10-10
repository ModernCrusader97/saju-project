// Real React/Three scene and external-store behavior; only the inherited host's
// GPU, Canvas2D, layout and clock boundaries inject deterministic failures.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import React, { act, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import ts from 'typescript';
import { ESLint } from 'eslint';

const root = process.cwd(), phase = process.env.SAJU_QA_PHASE || 'after';
const basis = '8ba3b9763bcaa88a8a3f2e108fa331a49800090f';
const output = path.join(root, 'outputs/galaxy-graphics-errors');
fs.mkdirSync(output, { recursive: true });
const sourceFile = 'components/planet/GalaxyCanvas.tsx';
const storeFile = 'lib/planet/graphics-error-store.ts';
const hostFile = 'scripts/qa/galaxy-scene-host.mjs';
const originalHost = fs.readFileSync(hostFile, 'utf8');
function replaceOnce(source, before, after) {
  assert.equal(source.split(before).length, 2, 'exact host boundary: ' + before);
  return source.replace(before, after);
}
let host = replaceOnce(originalHost, 'class RendererBoundary {',
  'let faults = {};\nfunction setFaults(config = {}) { faults = { ...config }; }\nclass RendererBoundary {');
host = replaceOnce(host, "constructor() { this.domElement = document.createElement('canvas');",
  "constructor() { if (faults.constructorFailures > 0) { faults.constructorFailures--; throw new Error('synthetic WebGL unavailable'); } this.domElement = document.createElement('canvas');");
host = replaceOnce(host, 'createStudioEnvironment: () => {',
  "createStudioEnvironment: () => { if (faults.environmentFailures > 0) { faults.environmentFailures--; throw new Error('synthetic reflection failure'); }");
host = replaceOnce(host, 'return { frame, visibility, snapshot, click, close, renderer, button, renderers, observers, environments,',
  'return { container, pendingFrames: () => frames.size, frame, visibility, snapshot, click, close, renderer, button, renderers, observers, environments,');
host = replaceOnce(host, 'export { view, owner, friend, incoming, dom };',
  'export { view, owner, friend, incoming, dom, setFaults };');
const fixture = path.join(output, 'scene-fault-host.mjs');
fs.writeFileSync(fixture, host);
const { view, owner, friend, dom, setFaults } = await import(pathToFileURL(fixture).href);
const checks = [], observations = [];
async function check(name, task) {
  console.log('RUN ' + name);
  try { await task(); checks.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
  catch (error) { checks.push({ name, status: 'FAIL', error: error.stack }); console.error(error); }
}
const sha = value => createHash('sha256').update(value).digest('hex');
const errors = {
  constructor: '3D 화면을 사용할 수 없어요. WebGL을 지원하는 브라우저에서 다시 열어주세요.',
  reflection: '반사광을 준비하지 못했어요. 아래 사주 구성은 계속 확인할 수 있어요.',
  shader: '은하 재질을 그리지 못했어요. 아래 관계 카드는 계속 확인할 수 있어요.',
  lost: '3D 연결이 잠시 끊겼어요. 복구를 기다려주세요.',
  restore: '반사광을 복구하지 못했어요. 화면을 다시 열어주세요.',
};
const state = v => ({ state: v.container.querySelector('[data-scene]').dataset.sceneState,
  message: v.container.querySelector('[role="status"] strong')?.textContent ?? null,
  people: [...v.container.querySelectorAll('.scene-fallback-list button')].map(button => button.textContent),
  renders: v.renderer?.renders ?? 0, generations: v.renderers.length, pendingFrames: v.pendingFrames() });
const capture = (v, label, scene = false) => observations.push({ label, ...state(v), ...(scene ? { scene: v.snapshot() } : {}) });
const expectError = (v, message) => {
  const s = state(v); assert.equal(s.state, 'fallback'); assert.equal(s.message, message);
  assert.deepEqual(s.people, [owner.name, friend.name]);
};
const close = async v => {
  await v.close(); assert.equal(v.pendingFrames(), 0);
  assert(v.renderers.every(renderer => renderer.disposals === 1 && renderer.losses === 1));
  assert(v.environments.every(environment => environment.disposals === 1));
  assert(v.observers.every(observer => !observer.active));
};
const dispatch = async (v, name) => {
  const event = new dom.window.Event(name, { cancelable: true });
  await act(async () => v.renderer.domElement.dispatchEvent(event));
  return event;
};
const lint = await new ESLint().lintFiles([sourceFile]);
await check('GalaxyCanvas has no synchronous React effect-state lint error', async () => {
  assert.equal(lint.flatMap(row => row.messages).filter(message => message.ruleId === 'react-hooks/set-state-in-effect').length, 0);
});
await check('only the graphics-error binding and stable store dependency change in GalaxyCanvas', async () => {
  let current = fs.readFileSync(sourceFile, 'utf8');
  const original = execFileSync('git', ['show', basis + ':' + sourceFile], { encoding: 'utf8' });
  if (current.includes('useSyncExternalStore')) {
    current = replaceOnce(current, ', useSyncExternalStore } from "react";', ' } from "react";');
    current = replaceOnce(current, 'import { createGraphicsErrorStore } from "@/lib/planet/graphics-error-store";\n', '');
    current = replaceOnce(current,
      '  const [graphicsErrors] = useState(createGraphicsErrorStore);\n  const graphicsError = useSyncExternalStore(\n    graphicsErrors.subscribe, graphicsErrors.getSnapshot, graphicsErrors.getServerSnapshot\n  );',
      '  const [graphicsError, setGraphicsError] = useState<string | null>(null);');
    current = current.replaceAll('graphicsErrors.setError(', 'setGraphicsError(');
    current = replaceOnce(current, '  }, [graphicsErrors]);', '  }, []);');
  }
  assert.equal(current, original, 'all remaining source, messages, rendering, controls and cleanup remain byte-identical');
  assert(lint.every(row => row.suppressedMessages.length === 0));
});
await check('per-instance snapshots notify only changes, unsubscribe and retain pre-subscription failures', async () => {
  assert(fs.existsSync(storeFile), 'renderer external error store is not implemented');
  const require = createRequire(import.meta.url);
  const mod = { exports: {} };
  const compiled = ts.transpileModule(fs.readFileSync(storeFile, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', compiled)(require, mod, mod.exports);
  const first = mod.exports.createGraphicsErrorStore(), second = mod.exports.createGraphicsErrorStore();
  assert.equal(first.getSnapshot(), null); assert.equal(first.getServerSnapshot(), null);
  first.setError(errors.constructor); assert.equal(first.getSnapshot(), errors.constructor);
  assert.equal(first.getServerSnapshot(), null); assert.equal(second.getSnapshot(), null);
  const seen = [], unsubscribe = first.subscribe(() => seen.push(first.getSnapshot()));
  first.setError(errors.constructor); first.setError(errors.lost); first.setError(null); first.setError(null);
  assert.deepEqual(seen, [errors.lost, null]); unsubscribe(); unsubscribe();
  first.setError(errors.restore); assert.deepEqual(seen, [errors.lost, null]);
  assert.equal(first.getSnapshot(), errors.restore);
  const View = () => React.createElement('span', null,
    useSyncExternalStore(first.subscribe, first.getSnapshot, first.getServerSnapshot) ?? 'ready');
  assert.equal(renderToString(React.createElement(View)), '<span>ready</span>', 'SSR uses initial null snapshot');
  const container = document.createElement('div'); document.body.append(container);
  const reactRoot = createRoot(container);
  try {
    await act(async () => reactRoot.render(React.createElement(View)));
    assert.equal(container.textContent, errors.restore, 'mount observes update before subscription');
    await act(async () => first.setError(null)); assert.equal(container.textContent, 'ready');
    await act(async () => first.setError(errors.shader)); assert.equal(container.textContent, errors.shader);
  } finally { await act(async () => reactRoot.unmount()); container.remove(); }
  first.setError(errors.constructor); assert.equal(second.getSnapshot(), null);
});

for (const strict of [false, true]) {
  const suffix = strict ? ' in Strict Mode' : '';
  await check('WebGL constructor failure shows the existing fallback and selectable people' + suffix, async () => {
    setFaults({ constructorFailures: strict ? 2 : 1 }); const v = await view({ strict });
    try {
      expectError(v, errors.constructor); assert.equal(v.pendingFrames(), 0); assert.equal(v.renderers.length, 0);
      capture(v, 'constructor-' + strict);
      await act(async () => v.container.querySelectorAll('.scene-fallback-list button')[1].click());
      assert(v.container.textContent.includes(friend.name));
      await act(async () => v.container.querySelector('[title="4기둥 행성 슬롯 상세 보기"]').click());
      assert(v.container.textContent.includes(friend.name + '님의 사주 행성 구성'));
      capture(v, 'fallback-selection-' + strict);
    } finally { await close(v); }
  });
  await check('reflection initialization failure disposes the renderer once' + suffix, async () => {
    setFaults({ environmentFailures: strict ? 2 : 1 }); const v = await view({ strict });
    try {
      expectError(v, errors.reflection); assert.equal(v.pendingFrames(), 0);
      assert.equal(v.renderers.length, strict ? 2 : 1); assert.equal(v.container.querySelectorAll('canvas').length, 0);
      capture(v, 'reflection-' + strict);
    } finally { await close(v); }
  });
  await check('shader failure stops drawing and context restoration resumes the same scene' + suffix, async () => {
    setFaults(); const v = await view({ strict });
    try {
      await v.frame(0); assert.equal(state(v).state, 'ready'); capture(v, 'ready-' + strict, true);
      const renders = v.renderer.renders, geometry = v.groups()[0].children[0].geometry;
      await act(async () => v.renderer.debug.onShaderError()); expectError(v, errors.shader);
      await v.frame(16); assert.equal(v.renderer.renders, renders); capture(v, 'shader-' + strict, true);
      const lost = await dispatch(v, 'webglcontextlost'); assert(lost.defaultPrevented); expectError(v, errors.lost);
      await v.frame(16); assert.equal(v.renderer.renders, renders); capture(v, 'lost-' + strict, true);
      await dispatch(v, 'webglcontextrestored'); assert.equal(state(v).state, 'ready');
      await v.frame(16); assert.equal(v.renderer.renders, renders + 1); assert.equal(v.groups()[0].children[0].geometry, geometry);
      capture(v, 'restored-' + strict, true);
      await v.track(); await v.frame(16); assert(v.button('은하 전체 조망'));
      await v.click('움직임 멈춤'); await v.setSpeed(.5); await v.frame(16); capture(v, 'controls-' + strict, true);
      await v.visibility(true, 300000); await v.frame(16); await v.visibility(false); await v.frame(16);
      capture(v, 'visibility-' + strict, true); assert.equal(v.renderers.length, strict ? 2 : 1);
    } finally { await close(v); }
  });
  await check('failed reflection restoration retains fallback until successful restoration' + suffix, async () => {
    setFaults(); const v = await view({ strict });
    try {
      await v.frame(0); await dispatch(v, 'webglcontextlost');
      setFaults({ environmentFailures: 1 }); await dispatch(v, 'webglcontextrestored'); expectError(v, errors.restore);
      const renders = v.renderer.renders; await v.frame(16); assert.equal(v.renderer.renders, renders);
      capture(v, 'restore-failed-' + strict);
      await dispatch(v, 'webglcontextrestored'); await v.frame(16);
      assert.equal(state(v).state, 'ready'); assert.equal(v.renderer.renders, renders + 1);
      capture(v, 'restore-retried-' + strict, true);
    } finally { await close(v); }
  });
}
await check('unmounted renderer callbacks do not alter a newly mounted scene', async () => {
  setFaults(); const previous = await view(); await previous.frame(0);
  const shader = previous.renderer.debug.onShaderError, canvas = previous.renderer.domElement;
  await close(previous);
  const next = await view();
  try {
    await next.frame(0); const before = state(next);
    await act(async () => { shader(); canvas.dispatchEvent(new dom.window.Event('webglcontextlost')); });
    assert.deepEqual(state(next), before); await next.frame(16); capture(next, 'isolated-remount', true);
  } finally { await close(next); }
});
await check('Strict Mode successful second setup clears its first initialization failure', async () => {
  for (const boundary of ['constructorFailures', 'environmentFailures']) {
    setFaults({ [boundary]: 1 }); const v = await view({ strict: true });
    try {
      assert.equal(state(v).state, 'ready'); assert.equal(state(v).message, null);
      assert.equal(v.pendingFrames(), 1); await v.frame(0);
      assert.equal(v.renderers.length, boundary === 'constructorFailures' ? 1 : 2);
      capture(v, 'strict-recovered-' + boundary, true);
    } finally { await close(v); }
  }
});

const source = fs.readFileSync(sourceFile, 'utf8');
const report = { basis, phase, sourceSha256: sha(source), originalHostSha256: sha(originalHost),
  harnessSha256: sha(fs.readFileSync(import.meta.filename)),
  passed: checks.filter(row => row.status === 'PASS').length, failed: checks.filter(row => row.status === 'FAIL').length,
  checks, observations,
  lint: lint.map(({ errorCount, warningCount, messages, suppressedMessages }) => ({ errorCount, warningCount, messages, suppressedMessages })),
  limits: ['Actual React/Three and production modules; GPU/environment, Canvas2D, layout and time are inherited host boundaries.',
    'Injected constructor/environment/shader errors and context events verify UI/lifecycle; native WebGL is a separate browser check.',
    'Existing orbit, geometry, materials, controls and cleanup are preserved; no performance improvement is claimed.'] };
fs.writeFileSync(path.join(output, phase + '-results.json'), JSON.stringify(report, null, 2) + '\n');
if (phase === 'after') {
  const beforeFile = path.join(output, 'before-results.json');
  if (fs.existsSync(beforeFile)) {
    const before = JSON.parse(fs.readFileSync(beforeFile, 'utf8'));
    assert.deepEqual(report.observations, before.observations, 'same scene states, messages, controls, poses and cleanup before/after');
    fs.writeFileSync(path.join(output, 'runtime-equivalence.json'), JSON.stringify({ basis, observations: observations.length,
      beforeSha256: sha(JSON.stringify(before.observations)), afterSha256: sha(JSON.stringify(observations)), identical: true }, null, 2) + '\n');
  }
}
console.log(JSON.stringify({ passed: report.passed, failed: report.failed, observations: observations.length }));
process.exitCode = report.failed ? 1 : 0;
