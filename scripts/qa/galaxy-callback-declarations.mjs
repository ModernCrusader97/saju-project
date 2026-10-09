// Actual React/Three camera, raycasting and controls; inherited host owns environment boundaries.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { act } from 'react';
import * as THREE from 'three';
import ts from 'typescript';
import { ESLint } from 'eslint';
import { view, owner, friend, dom } from './galaxy-scene-host.mjs';

const basis = '5450f107182d9de0ef6d40281b8f018c45aea6f8';
const phase = process.env.SAJU_QA_PHASE || 'after';
assert(['before', 'after'].includes(phase));
const output = path.join(process.cwd(), 'outputs/galaxy-declarations');
fs.mkdirSync(output, { recursive: true });
const file = 'components/planet/GalaxyCanvas.tsx';
const source = fs.readFileSync(file, 'utf8');
const original = execFileSync('git', ['show', basis + ':' + file], { encoding: 'utf8' });
const parse = text => ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const component = tree => tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'GalaxyCanvas');
const hooks = tree => component(tree).body.statements.flatMap(statement => {
  const rows = [];
  const record = (call, binding) => {
    if (call && ts.isCallExpression(call) && /^use(State|Ref|Effect|Callback)$/.test(call.expression.getText()))
      rows.push({ hook: call.expression.getText(), binding, dependencies: call.arguments[1]?.getText() ?? null });
  };
  if (ts.isVariableStatement(statement))
    statement.declarationList.declarations.forEach(declaration => record(declaration.initializer, declaration.name.getText()));
  if (ts.isExpressionStatement(statement)) record(statement.expression, null);
  return rows;
});
const body = (tree, name) => {
  for (const statement of component(tree).body.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === name) return statement.body.getText();
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText() !== name) continue;
      const initializer = declaration.initializer;
      if (ts.isArrowFunction(initializer)) return initializer.body.getText();
      if (ts.isCallExpression(initializer) && ts.isArrowFunction(initializer.arguments[0])) return initializer.arguments[0].body.getText();
    }
  }
};
const currentTree = parse(source), originalTree = parse(original);
const checks = [], observations = [];
async function check(name, task) {
  console.log('RUN ' + name);
  try { await task(); checks.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
  catch (error) { checks.push({ name, status: 'FAIL', error: error.stack }); console.error(error); }
}
const close = async v => {
  await v.close();
  assert(v.renderers.every(renderer => renderer.disposals === 1 && renderer.losses === 1));
};
const capture = (v, label) => {
  const snapshot = v.snapshot();
  observations.push({ label, camera: snapshot.camera, spiral: snapshot.spiral, planets: snapshot.planets,
    overviewButton: Boolean(v.button('은하 전체 조망')), ownerButton: Boolean(v.button('나의 별 추적')),
    activeOwner: dom.window.document.body.textContent.includes(owner.name),
    activeFriend: dom.window.document.body.textContent.includes(friend.name), rendererGenerations: v.renderers.length });
};
const assertCamera = (v, theta, phi, radius) => {
  const expected = new THREE.Vector3(radius * Math.sin(phi) * Math.sin(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.cos(theta));
  assert(v.renderer.camera.position.distanceTo(expected) < 1e-9);
};
const pointer = (canvas, type, x, y) => {
  const event = new dom.window.MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperties(event, { pointerId: { value: 1 }, pointerType: { value: 'mouse' } });
  canvas.dispatchEvent(event);
};
const preparePointer = v => {
  const canvas = v.renderer.domElement, captures = new Set();
  canvas.setPointerCapture = id => captures.add(id);
  canvas.hasPointerCapture = id => captures.has(id);
  canvas.releasePointerCapture = id => captures.delete(id);
  canvas.parentElement.getBoundingClientRect = () => ({ left: 0, top: 0, width: 390, height: 480 });
  return canvas;
};
const tapPlanet = async (v, person) => {
  const canvas = preparePointer(v);
  const index = v.nodes().findIndex(node => node.person.id === person.id);
  assert(index >= 0);
  const projected = v.groups()[index].getWorldPosition(new THREE.Vector3()).project(v.renderer.camera);
  assert(Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1, 'fixture planet must be inside the viewport');
  const x = (projected.x + 1) * 195, y = (1 - projected.y) * 240;
  await act(async () => { pointer(canvas, 'pointerdown', x, y); pointer(canvas, 'pointerup', x, y); });
  assert(v.button('은하 전체 조망'));
  assert(dom.window.document.body.textContent.includes(person.name));
};

const lintScope = [file, 'lib/planet/surface-math.ts', 'lib/planet/galaxy-helper.ts', 'scripts/qa/galaxy-callback-declarations.mjs'];
const lint = await new ESLint().lintFiles(lintScope);
await check('no declaration-before-use compiler diagnostics', async () => {
  assert.equal(lint.flatMap(row => row.messages).filter(message => message.ruleId === 'react-hooks/immutability').length, 0);
});
await check('hook call order, dependency arrays and helper bodies preserve the basis', async () => {
  assert.deepEqual(hooks(currentTree), hooks(originalTree));
  assert.equal(body(currentTree, 'updateCameraPosition'), body(originalTree, 'updateCameraPosition'));
  assert.equal(body(currentTree, 'trackPlanet') ?? body(currentTree, 'startTrackingPlanet'), body(originalTree, 'startTrackingPlanet'));
});
for (const strict of [false, true]) {
  await check('initial camera and actual friend/owner raycast taps' + (strict ? ' in Strict Mode' : ''), async () => {
    const v = await view({ strict });
    try {
      await v.frame(0); assertCamera(v, .45, .52, 22);
      assert.equal(v.renderers.length, strict ? 2 : 1); capture(v, 'initial-' + strict);
      await tapPlanet(v, friend); await v.frame(16); capture(v, 'friend-tap-' + strict);
      await tapPlanet(v, owner); await v.frame(16); capture(v, 'owner-tap-' + strict);
    } finally { await close(v); }
  });
  await check('external selection keeps overview and owner controls stable across rerenders' + (strict ? ' in Strict Mode' : ''), async () => {
    const v = await view({ strict });
    try {
      await v.frame(0); await v.track(); await v.frame(16); capture(v, 'external-friend-' + strict);
      await v.click('은하 전체 조망'); assert(v.button('나의 별 추적'));
      await v.setSpeed(1.5); assert(v.button('나의 별 추적'));
      await v.click('움직임 멈춤'); assert(v.button('나의 별 추적')); await v.frame(16);
      capture(v, 'overview-rerender-' + strict);
      await v.click('나의 별 추적'); assert(v.button('은하 전체 조망'));
      assert(dom.window.document.body.textContent.includes(owner.name));
      await v.setSpeed(.5); await v.frame(16); capture(v, 'owner-rerender-' + strict);
      await v.click('초기화'); assert(v.button('나의 별 추적')); await v.frame(0);
      // Reset retains the smooth look-at offset; compare direction and record the full pose.
      const resetDirection = new THREE.Vector3(-Math.sin(.52) * Math.sin(.45), -Math.cos(.52), -Math.sin(.52) * Math.cos(.45));
      assert(v.renderer.camera.getWorldDirection(new THREE.Vector3()).distanceTo(resetDirection) < 1e-9);
      capture(v, 'reset-' + strict);
    } finally { await close(v); }
  });
}
await check('actual wheel and pointer rotation keep the existing camera equations', async () => {
  const v = await view();
  try {
    await v.frame(0); const canvas = preparePointer(v);
    await act(async () => canvas.dispatchEvent(new dom.window.WheelEvent('wheel', { deltaY: 50, bubbles: true, cancelable: true })));
    assertCamera(v, .45, .52, 22.9);
    await act(async () => { pointer(canvas, 'pointerdown', 20, 20); pointer(canvas, 'pointermove', 60, 30); pointer(canvas, 'pointerup', 60, 30); });
    assertCamera(v, .45 - 40 * .0065, .52 + 10 * .0065, 22.9);
    await v.frame(0); capture(v, 'wheel-rotation');
  } finally { await close(v); }
});
const sha = value => createHash('sha256').update(value).digest('hex');
const report = { basis, phase, applicationSourceSha256: sha(source), harnessSha256: sha(fs.readFileSync('scripts/qa/galaxy-callback-declarations.mjs')),
  hostSha256: sha(fs.readFileSync('scripts/qa/galaxy-scene-host.mjs')), lintScope,
  lintErrors: lint.reduce((sum, row) => sum + row.errorCount, 0), lintWarnings: lint.reduce((sum, row) => sum + row.warningCount, 0),
  hookCalls: hooks(currentTree), passed: checks.filter(row => row.status === 'PASS').length,
  failed: checks.filter(row => row.status === 'FAIL').length, checks, observations,
  limits: ['Actual React and Three/Raycaster; GPU, Canvas2D, layout, pointer capture and host time are test boundaries.', 'Stable selectedPersonId across UI/prop rerenders is checked with actual camera controls; no physical browser/mobile device.'] };
fs.writeFileSync(path.join(output, phase + '-callbacks.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: report.passed, failed: report.failed }));
process.exitCode = report.failed ? 1 : 0;
