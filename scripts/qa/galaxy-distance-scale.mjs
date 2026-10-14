// Actual node builder and Three CPU positions; no renderer, network or DB.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLoader } from './load-ts.mjs';

const { buildGalaxyNodes } = createLoader({ three: THREE }).load('lib/planet/galaxy-helper.ts');
const pillars = { dayKey: '갑자', monthKey: '병인', yearKey: '경오', hourKey: '임신' };
const people = [
  { id: 'synthetic-owner', name: '합성 중심별', isMe: true, pillars, affinityScore: 100 },
  { id: 'synthetic-middle', name: '합성 중간 인연', isMe: false, pillars, affinityScore: 90 },
  { id: 'synthetic-low', name: '합성 낮은 인연', isMe: false, pillars, affinityScore: 85 },
  { id: 'synthetic-near', name: '합성 가까운 인연', isMe: false, pillars, affinityScore: 98 },
];
const original = JSON.stringify(people), checks = [], observations = [];
const plain = nodes => nodes.map(n => ({ id: n.person.id, arm: n.armIndex,
  radius: n.baseRadius, angle: n.baseAngle, position: n.worldPos.toArray(),
  dayKey: n.dayKey, monthKey: n.monthKey, yearKey: n.yearKey, hourKey: n.hourKey }));
function check(name, task) {
  try { task(); checks.push({ name, status: 'PASS' }); }
  catch (error) { checks.push({ name, status: 'FAIL', error: error.message }); }
}
function close(actual, expected) { assert(Math.abs(actual - expected) < 1e-12, `Expected ${expected}, received ${actual}`); }
const normal = buildGalaxyNodes(people, 1);
check('default and explicit 1x are identical', () => assert.deepEqual(plain(buildGalaxyNodes(people)), plain(normal)));
check('1x retains the established owner/middle/low/near layout', () => {
  assert.equal(JSON.stringify(normal.map(n => n.armIndex)), JSON.stringify([0, 1, 2, 0]));
  for (const [i, radius] of [5.8, 5.4, 9.4, 8].entries()) close(normal[i].baseRadius, radius);
});
for (const scale of [0.7, 1.5]) {
  const nodes = buildGalaxyNodes(people, scale);
  observations.push({ scale, nodes: plain(nodes) });
  for (const index of [1, 2]) check(`${nodes[index].person.id}: ${scale}x radial distance matches the displayed multiplier`, () => {
    close(nodes[index].baseRadius, normal[index].baseRadius * scale);
    close(Math.hypot(nodes[index].worldPos.x, nodes[index].worldPos.z), Math.hypot(normal[index].worldPos.x, normal[index].worldPos.z) * scale);
  });
  check(`owner and high-score controls at ${scale}x remain scaled once`, () => {
    for (const index of [0, 3]) close(nodes[index].baseRadius, normal[index].baseRadius * scale);
    assert.deepEqual(nodes.map(n => [n.person.id, n.armIndex, n.baseAngle, n.dayKey, n.monthKey, n.yearKey, n.hourKey]),
      normal.map(n => [n.person.id, n.armIndex, n.baseAngle, n.dayKey, n.monthKey, n.yearKey, n.hourKey]));
  });
}
check('existing high-score minimum/maximum radius bounds remain intact', () => {
  const near = { ...people[3] };
  close(buildGalaxyNodes([people[0], near, { ...near, id: 'synthetic-min' }], 0.7)[2].baseRadius, 3.5);
  close(buildGalaxyNodes([people[0], ...Array(7).fill(near)], 1.5)[7].baseRadius, 14);
});
check('input people stay unchanged and empty lists remain empty', () => {
  assert.equal(JSON.stringify(people), original); assert.equal(buildGalaxyNodes([], 0.7).length, 0);
});
const report = { passed: checks.filter(c => c.status === 'PASS').length,
  failed: checks.filter(c => c.status === 'FAIL').length, checks, observations, normal: plain(normal),
  scope: 'Actual current TypeScript node builder, real Three CPU Vector3; no app/browser/GPU/DB/provider acceptance',
  real_API_DB_auth_payment_permission_calls: 0 };
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.failed ? 1 : 0;
