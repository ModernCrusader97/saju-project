// Actual React GalaxyCanvas animation and Three scene; synthetic rAF, host clock
// and GPU boundary. The analytic oracle uses the existing angular speed .052.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { view, owner, friend, dom } from './galaxy-scene-host.mjs';

const root = process.cwd(), output = path.join(root, 'outputs/galaxy-anchor');
fs.mkdirSync(output, { recursive: true });
const phase = process.env.SAJU_QA_PHASE || 'after';
assert(['before', 'after'].includes(phase));
const durationSeconds = 3600, rates = [30, 60, 144], checks = [], observations = [];
const people = [owner, { ...friend, affinityScore: 91 },
  { ...friend, id: 'synthetic-near', name: '합성 가까운 친구', affinityScore: 98 },
  { ...friend, id: 'synthetic-far', name: '합성 바깥 친구', affinityScore: 80 }];
const axis = new THREE.Vector3(0, 1, 0), tolerance = 1e-6;
async function check(name, task) {
  try { await task(); checks.push({ name, status: 'PASS' }); }
  catch (error) { checks.push({ name, status: 'FAIL', error: error.message }); }
}
const positionArrays = vectors => vectors.map(vector => vector.toArray());
const maxDifference = (left, right) => Math.max(...left.map((vector, index) => vector.distanceTo(right[index])));
for (const fps of rates) {
  console.log('SIMULATE ' + phase + ' ' + fps + 'fps ' + durationSeconds + 's');
  const scene = await view({ initialPeople: people });
  try {
    await scene.frame(0);
    const nodes = scene.nodes(), groups = scene.groups(), anchors = nodes.map(node => node.worldPos.clone());
    const records = nodes.map((node, index) => ({ id: node.person.id, owner: node.isOwner,
      radius: Math.hypot(anchors[index].x, anchors[index].z),
      omega: node.isOwner ? 0 : .052 / Math.sqrt(Math.max(1, Math.hypot(anchors[index].x, anchors[index].z) / 6)),
      maxRadiusError: 0, maxPathError: 0, maxAngularSpeedRatio: 0,
      previousAngle: Math.atan2(groups[index].position.z, groups[index].position.x), signedTravel: 0 }));
    await scene.advance(durationSeconds * fps, 1000 / fps, frame => {
      const seconds = frame / fps;
      groups.forEach((group, index) => {
        const record = records[index], radius = Math.hypot(group.position.x, group.position.z);
        record.maxRadiusError = Math.max(record.maxRadiusError, Math.abs(radius - record.radius));
        const angle = Math.atan2(group.position.z, group.position.x);
        const step = Math.atan2(Math.sin(angle - record.previousAngle), Math.cos(angle - record.previousAngle));
        record.signedTravel += step; record.previousAngle = angle;
        if (record.omega) record.maxAngularSpeedRatio = Math.max(record.maxAngularSpeedRatio, Math.abs(step) * fps / record.omega);
        if (frame % fps === 0) {
          const expected = anchors[index].clone().applyAxisAngle(axis, seconds * record.omega);
          record.maxPathError = Math.max(record.maxPathError, group.position.distanceTo(expected));
        }
      });
    });
    const final = groups.map(group => group.position.clone()), current = nodes.map(node => node.worldPos.clone());
    const observation = { fps, durationSeconds, frames: durationSeconds * fps, anchorsBefore: positionArrays(anchors),
      anchorsAfter: positionArrays(current), finalPositions: positionArrays(final),
      maxAnchorDisplacement: maxDifference(current, anchors),
      records: records.map(({ previousAngle, ...record }) => { void previousAngle; return { ...record, expectedSignedTravel: -record.omega * durationSeconds }; }) };
    observations.push(observation);
    console.log(JSON.stringify({ fps, maxAnchorDisplacement: observation.maxAnchorDisplacement,
      maxRadiusError: Math.max(...records.map(record => record.maxRadiusError)),
      maxPathError: Math.max(...records.map(record => record.maxPathError)),
      maxAngularSpeedRatio: Math.max(...records.map(record => record.maxAngularSpeedRatio)) }));
    await check(fps + 'fps: original anchors remain exactly unchanged for one hour', () => assert.deepEqual(positionArrays(current), positionArrays(anchors)));
    await check(fps + 'fps: analytic paths retain the original angular speed', () => assert(records.every(record => record.maxPathError < tolerance), 'One-hour trajectory differs from rotation of its original anchor'));
    await check(fps + 'fps: orbital radii do not expand', () => assert(records.every(record => record.maxRadiusError < tolerance), 'Orbit radius expanded'));
    await check(fps + 'fps: angular velocity and accumulated travel remain bounded', () => {
      assert(records.filter(record => !record.owner).every(record => Math.abs(record.maxAngularSpeedRatio - 1) < tolerance), 'Angular speed accumulates instead of remaining constant');
      assert(records.every(record => Math.abs(record.signedTravel + record.omega * durationSeconds) < tolerance), 'Wrong accumulated orbital travel');
    });
  } finally { await scene.close(); }
}
await check('30/60/144fps yield the same final positions after one hour', () => {
  const first = observations[0].finalPositions.map(position => new THREE.Vector3(...position));
  for (const observation of observations.slice(1)) assert(maxDifference(first, observation.finalPositions.map(position => new THREE.Vector3(...position))) < tolerance);
});
await check('user pause freezes friend positions and anchors in the foreground', async () => {
  const scene = await view({ initialPeople: people });
  try {
    await scene.frame(0); await scene.advance(1200, 1000 / 60); await scene.click('움직임 멈춤');
    const before = scene.groups().map(group => group.position.toArray()), anchors = scene.nodes().map(node => node.worldPos.toArray());
    await scene.advance(600, 1000 / 60);
    assert.deepEqual(scene.groups().map(group => group.position.toArray()), before);
    assert.deepEqual(scene.nodes().map(node => node.worldPos.toArray()), anchors);
    assert(scene.button('움직임 재생'));
  } finally { await scene.close(); }
});
await check('reset restores the original anchors rather than the last rotated positions', async () => {
  const scene = await view({ initialPeople: people });
  try {
    await scene.frame(0); const original = scene.nodes().map(node => node.worldPos.toArray());
    await scene.advance(1200, 1000 / 60); await scene.click('초기화'); await scene.frame(0);
    assert.deepEqual(scene.groups().map(group => group.position.toArray()), original);
    assert(scene.snapshot().planets.every(planet => planet.spin === 0 && planet.surfaceTime === 0));
  } finally { await scene.close(); }
});
await check('incoming landing updates its curve without rewriting orbital anchors', async () => {
  const scene = await view({ initialPeople: people });
  try {
    await scene.frame(0); await scene.advance(60, 1000 / 60); await scene.arrive();
    const nodes = scene.nodes(), anchors = nodes.map(node => node.worldPos.clone());
    let maxAnchorDisplacement = 0;
    await scene.advance(180, 1000 / 60, () => { maxAnchorDisplacement = Math.max(maxAnchorDisplacement,
      maxDifference(nodes.map(node => node.worldPos), anchors)); });
    observations.push({ scenario: 'incoming landing', frames: 180, maxAnchorDisplacement });
    assert.equal(maxAnchorDisplacement, 0, 'Landing/connection rewrites an immutable anchor');
    const elapsed = 4;
    const expected = anchors.map((anchor, index) => anchor.clone().applyAxisAngle(axis, nodes[index].isOwner ? 0 : elapsed * .052 / Math.sqrt(Math.max(1, Math.hypot(anchor.x, anchor.z) / 6))));
    assert(maxDifference(scene.groups().map(group => group.position), expected) < tolerance, 'Post-landing orbit differs from its original anchor');
  } finally { await scene.close(); }
});
const sourceHash = file => createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const report = { phase, basis: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  method: 'Actual React animation closure, node builder, Three vectors/material time/disposal; synthetic clock/rAF, GPU/environment and Canvas2D boundary stubs',
  durationSeconds, rates, tolerance, passed: checks.filter(check => check.status === 'PASS').length,
  failed: checks.filter(check => check.status === 'FAIL').length, checks, observations,
  applicationSourceSha256: sourceHash('components/planet/GalaxyCanvas.tsx'),
  harnessSha256: sourceHash('scripts/qa/galaxy-orbit-anchor.mjs'), hostSha256: sourceHash('scripts/qa/galaxy-scene-host.mjs') };
fs.writeFileSync(path.join(output, phase + '-cpu-results.json'), JSON.stringify(report, null, 2) + '\n');
for (const check of checks) console.log(check.status + ' ' + check.name + (check.error ? ': ' + check.error : ''));
console.log(JSON.stringify({ passed: report.passed, failed: report.failed }));
dom.window.close(); process.exitCode = report.failed ? 1 : 0;
