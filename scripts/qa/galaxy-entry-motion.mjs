// Run the actual React/Three animation against an independent analytic orbit.
// GPU, Canvas2D and time are host boundaries; no production motion is replaced.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { view, incoming, dom } from './galaxy-scene-host.mjs';
import * as THREE from 'three';

const root = process.cwd(), output = path.join(root, 'outputs/galaxy-entry-appearance');
fs.mkdirSync(output, { recursive: true });
const phase = process.env.SAJU_QA_PHASE || 'after';
assert(['before', 'after'].includes(phase));
const checks = [], observations = [], duration = 2.8, axis = new THREE.Vector3(0, 1, 0);
const orbit = (anchor, seconds) => anchor.clone().applyAxisAngle(axis,
  seconds * .052 / Math.sqrt(Math.max(1, Math.hypot(anchor.x, anchor.z) / 6)));
async function check(name, task) {
  try { await task(); checks.push({ name, status: 'PASS' }); }
  catch (error) { checks.push({ name, status: 'FAIL', error: error.message }); }
}
async function arrival(scene, seconds) {
  await scene.frame(0);
  await scene.advance(seconds * 20, 50);
  await scene.arrive();
  const nodes = scene.nodes(), index = nodes.findIndex(node => node.person.id === incoming.id);
  return { nodes, group: scene.groups()[index], anchor: nodes[index].worldPos.clone(),
    anchors: nodes.map(node => node.worldPos.toArray()) };
}
for (const fps of [30, 60, 144]) for (const priorSeconds of [0, 20, 3600]) {
  const scene = await view();
  try {
    const { nodes, group, anchor, anchors } = await arrival(scene, priorSeconds);
    let previous = group.position.clone(), maxBoundarySpeed = 0, maxEndpointError = 0;
    const samples = [];
    await scene.advance(Math.ceil((duration + .1) * fps), 1000 / fps, frame => {
      const elapsed = frame / fps, speed = previous.distanceTo(group.position) * fps;
      if (elapsed >= duration - .05 && elapsed <= duration + .05) {
        maxBoundarySpeed = Math.max(maxBoundarySpeed, speed);
        samples.push({ elapsed, position: group.position.toArray(), speed });
      }
      if (Math.abs(elapsed - duration) < 1e-7)
        maxEndpointError = group.position.distanceTo(orbit(anchor, priorSeconds + elapsed));
      previous.copy(group.position);
    });
    const elapsed = Math.ceil((duration + .1) * fps) / fps;
    const finalError = group.position.distanceTo(orbit(anchor, priorSeconds + elapsed));
    const orbitalSpeed = Math.hypot(anchor.x, anchor.z) * .052 / Math.sqrt(Math.max(1, Math.hypot(anchor.x, anchor.z) / 6));
    observations.push({ fps, priorSeconds, maxBoundarySpeed, orbitalSpeed, maxEndpointError, finalError, samples });
    await check(`${fps}fps after ${priorSeconds}s: entry joins the moving orbit without a jump`, () => {
      assert(maxBoundarySpeed < orbitalSpeed + .12, `Boundary speed ${maxBoundarySpeed} exceeds continuous orbital approach ${orbitalSpeed}`);
      assert(maxEndpointError < 1e-6, `Entry ends ${maxEndpointError} units from the current orbit`);
      assert(finalError < 1e-6);
    });
    await check(`${fps}fps after ${priorSeconds}s: entry and connection preserve every rest anchor`, () => {
      assert.deepEqual(nodes.map(node => node.worldPos.toArray()), anchors);
    });
  } finally { await scene.close(); }
}
for (const priorSeconds of [0, 20]) await check(`entry velocity joins orbit at ${priorSeconds}s`, async () => {
  const scene = await view();
  try {
    const { group } = await arrival(scene, priorSeconds);
    await scene.advance(55, 50); await scene.frame(48);
    const before = group.position.clone(); await scene.frame(1);
    const velocityBefore = group.position.clone().sub(before).multiplyScalar(1000);
    await scene.frame(2); const after = group.position.clone(); await scene.frame(1);
    const velocityAfter = group.position.clone().sub(after).multiplyScalar(1000);
    const discontinuity = velocityBefore.distanceTo(velocityAfter);
    observations.push({ scenario: 'velocity', priorSeconds, velocityBefore: velocityBefore.toArray(),
      velocityAfter: velocityAfter.toArray(), discontinuity });
    assert(discontinuity < .01, `End velocity differs by ${discontinuity} units/s`);
  } finally { await scene.close(); }
});
await check('pause and zero speed freeze an unfinished entry; resume reaches the current orbit', async () => {
  const scene = await view();
  try {
    const { group, anchor } = await arrival(scene, 20);
    await scene.advance(60, 1000 / 60); await scene.click('움직임 멈춤');
    const paused = group.position.toArray(); await scene.advance(600, 1000 / 60);
    assert.deepEqual(group.position.toArray(), paused);
    await scene.click('움직임 재생'); await scene.setSpeed(0); await scene.advance(120, 1000 / 60);
    assert.deepEqual(group.position.toArray(), paused);
    await scene.setSpeed(2); await scene.advance(60, 1000 / 60);
    assert(group.position.distanceTo(orbit(anchor, 23)) < 1e-6);
  } finally { await scene.close(); }
});
await check('reduced motion settles directly on the current orbit, including after explicit playback', async () => {
  const scene = await view({ reduced: true });
  try {
    await scene.click('움직임 재생');
    const { group, anchor } = await arrival(scene, 20); await scene.frame(0);
    assert(group.position.distanceTo(orbit(anchor, 20)) < 1e-6, 'Reduced motion settles on a stale rest position');
  } finally { await scene.close(); }
});
await check('reset during entry restores original positions and an ordinary orbit', async () => {
  const scene = await view();
  try {
    const { group, anchor } = await arrival(scene, 20);
    await scene.advance(30, 1000 / 60); await scene.click('초기화'); await scene.frame(0);
    assert(group.position.distanceTo(anchor) < 1e-12);
    await scene.advance(60, 1000 / 60); assert(group.position.distanceTo(orbit(anchor, 1)) < 1e-6);
  } finally { await scene.close(); }
});
const hash = file => createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const report = { phase, method: 'Actual React GalaxyCanvas/Three, independent original-speed orbit oracle; GPU, Canvas2D and host-clock boundaries',
  duration, passed: checks.filter(c => c.status === 'PASS').length, failed: checks.filter(c => c.status === 'FAIL').length,
  checks, observations, sourceSha256: hash('components/planet/GalaxyCanvas.tsx'),
  harnessSha256: hash('scripts/qa/galaxy-entry-motion.mjs'), hostSha256: hash('scripts/qa/galaxy-scene-host.mjs') };
fs.writeFileSync(path.join(output, `${phase}-entry-cpu.json`), JSON.stringify(report, null, 2) + '\n');
for (const c of checks) console.log(c.status + ' ' + c.name + (c.error ? ': ' + c.error : ''));
console.log(JSON.stringify({ passed: report.passed, failed: report.failed }));
dom.window.close(); process.exitCode = report.failed ? 1 : 0;
