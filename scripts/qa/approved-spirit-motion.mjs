// The original approved GLB supplies the mesh, facial transforms and wave target.
// Image I/O alone uses CPU placeholders. This is not an authored rig quality claim.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import nodeTest from 'node:test';
import { performance } from 'node:perf_hooks';
import { build } from 'esbuild';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const output = path.resolve('outputs/approved-spirit-motion/cpu');
await fs.mkdir(output, { recursive: true });
const entry = path.join(output, 'runtime.mjs');
await build({ stdin: { contents: "export * from './lib/planet/approved-spirit-motion';", resolveDir: process.cwd() },
  outfile: entry, bundle: true, platform: 'node', format: 'esm', packages: 'external' });
const { createApprovedSpiritMotion, APPROVED_SPIRIT_WAVE_MAX_WEIGHT } = await import(pathToFileURL(entry).href);
assert(APPROVED_SPIRIT_WAVE_MAX_WEIGHT > 0 && APPROVED_SPIRIT_WAVE_MAX_WEIGHT <= .45,
  'The preserved source pose study must retain the measured .45 analysis bound');
const bytes = await fs.readFile('public/spirits/jade-v002/body.glb');
const source = await fs.readFile('assets/source-reference/saju-b-evolving-light-v002/reference/SaJu_Jade_Approved_Static_Material.glb');
assert(bytes.equals(source), 'Runtime GLB must match its archived source byte for byte');
const loader = new GLTFLoader().register(() => ({ name: 'CPU_IMAGE_IO', loadTexture: async () => new THREE.Texture() }));
const reference = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
let referenceBody;
reference.scene.traverse(object => { if (object.isMesh && object.geometry.getAttribute('position').count === 33207) referenceBody = object; });
assert.equal(referenceBody.morphTargetDictionary.Gentle_wave_pose, 0);
assert(reference.animations.some(animation => animation.name === 'Gentle_wave_study' && animation.duration === 3));
const sha = array => createHash('sha256').update(Buffer.from(array.buffer, array.byteOffset, array.byteLength)).digest('hex');
const hashes = geometry => Object.fromEntries([
  ...Object.entries(geometry.attributes).map(([name, attribute]) => [name, sha(attribute.array)]),
  ['index', sha(geometry.index.array)],
  ...Object.entries(geometry.morphAttributes).flatMap(([name, attributes]) => attributes.slice(0, referenceBody.geometry.morphAttributes[name].length).map((attribute, i) => [`morph:${name}:${i}`, sha(attribute.array)])),
]);
const expectedHashes = hashes(referenceBody.geometry);
const geometry = referenceBody.geometry, positions = geometry.getAttribute('position'), target = geometry.morphAttributes.position[0];
const index = geometry.index, stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const report = { status: 'PENDING', sourceGLB_SHA256: sha(bytes),
  moduleSHA256: sha(await fs.readFile('lib/planet/approved-spirit-motion.ts')),
  harnessSHA256: sha(await fs.readFile(new URL(import.meta.url))),
  geometryHashes: expectedHashes, maxWaveWeight: APPROVED_SPIRIT_WAVE_MAX_WEIGHT, checks: [], testResults: [] };
const test = (name, run) => nodeTest(name, async () => {
  try { await run(); report.testResults.push({ name, status: 'PASS' }); }
  catch (error) { report.testResults.push({ name, status: 'FAIL', error: error.message }); throw error; }
});

function fixture(stem = '甲', modifyFace) {
  const model = reference.scene.clone(true); model.position.x = -.42; model.scale.z = 1.35;
  const root = new THREE.Group(); root.name = 'ApprovedSpiritMotionRoot';
  for (const child of [...model.children]) root.add(child);
  model.add(root); let body;
  root.traverse(object => { if (object.isMesh && object.geometry.getAttribute('position').count === 33207) body = object; });
  body.morphTargetInfluences.fill(0); modifyFace?.(root);
  const sourceGeometry = body.geometry, sourceDictionary = body.morphTargetDictionary, sourceInfluences = body.morphTargetInfluences;
  return { model, root, body, sourceGeometry, sourceDictionary, sourceInfluences, motion: createApprovedSpiritMotion(root, body, stem) };
}
const pose = f => ({ root: { position: f.root.position.toArray(), quaternion: f.root.quaternion.toArray(), scale: f.root.scale.toArray() },
  morph: [...f.body.morphTargetInfluences], faces: f.root.children.filter(o => /almond_gaze|small_eye_glint|expressive_brow|quiet_smile/.test(o.name))
    .map(o => ({ name: o.name, position: o.position.toArray(), quaternion: o.quaternion.toArray(), scale: o.scale.toArray() })) });
const handIDs = []; for (let i = 0; i < positions.count; i++) if (positions.getX(i) > .69 && positions.getY(i) > .70 && positions.getY(i) < .87) handIDs.push(i);
const handCenter = f => { const result = new THREE.Vector3(), v = new THREE.Vector3(); for (const id of handIDs) result.add(f.body.getVertexPosition(id, v)); return result.multiplyScalar(1 / handIDs.length); };
const response = f => f.body.userData.approvedSpiritGreeting.armLift;
const nearPose = (a, b, epsilon = 1e-12) => {
  const compare = (x, y) => { if (Array.isArray(x)) x.forEach((v, i) => compare(v, y[i]));
    else if (x && typeof x === 'object') Object.keys(x).forEach(k => compare(x[k], y[k]));
    else if (typeof x === 'number') assert(Math.abs(x - y) <= epsilon, `${x} differs from ${y}`); else assert.equal(x, y); };
  compare(a, b);
};
const point = new THREE.Vector3(), relative = new THREE.Matrix4();
function fullFloor(f, subset) {
  f.model.updateWorldMatrix(true, true); relative.copy(f.model.matrixWorld).invert().multiply(f.body.matrixWorld);
  let minimum = Infinity;
  if (subset) for (const id of subset) { f.body.getVertexPosition(id, point).applyMatrix4(relative); minimum = Math.min(minimum, point.y); }
  else for (let i = 0; i < positions.count; i++) { f.body.getVertexPosition(i, point).applyMatrix4(relative); minimum = Math.min(minimum, point.y); }
  return minimum;
}

test('original GLB neutral pose, face transforms and geometry remain exact at t=0 and reset', () => {
  const f = fixture(); const neutral = pose(f);
  assert.deepEqual(f.root.position.toArray(), [0, 0, 0]); assert.deepEqual(f.root.scale.toArray(), [1, 1, 1]);
  f.motion.update(0); assert.deepEqual(pose(f), neutral);
  f.motion.triggerReaction(); f.motion.update(.7); assert(response(f) > 0);
  f.motion.reset(); assert.deepEqual(pose(f), neutral);
  assert.deepEqual(hashes(f.body.geometry), expectedHashes);
  assert.equal(f.model.position.x, -.42); assert.deepEqual(f.model.scale.toArray(), [1, 1, 1.35]);
  f.motion.dispose();
});

test('all ten stem idles are bounded, distinct, neutral-arm and keep the original floor planted', () => {
  const variants = new Set(); let maxFloorError = 0;
  for (const stem of stems) {
    const f = fixture(stem), floor = fullFloor(f);
    for (const t of [0, .25, .6, 1.3, 2.4, 4.7, 8.8, 15, 23.1]) {
      f.motion.update(t); assert(f.body.morphTargetInfluences.every(weight => weight === 0));
      assert(Math.abs(f.root.position.x) <= .012); assert(Math.abs(f.root.scale.y - 1) <= .003 + 1e-12);
      assert(Math.abs(f.root.rotation.z) <= .006 + 1e-12);
      maxFloorError = Math.max(maxFloorError, Math.abs(fullFloor(f) - floor));
      assert.equal(f.model.position.x, -.42); assert.deepEqual(f.model.scale.toArray(), [1, 1, 1.35]);
    }
    f.motion.update(1.7); variants.add(JSON.stringify(pose(f).root)); f.motion.dispose();
  }
  assert.equal(variants.size, 10); assert(maxFloorError < 1e-9);
  report.idle = { stems: 10, variants: variants.size, maxFloorError, neutralMorph: true };
});

test('sole subset matches the full posed mesh across the complete allowed roll/scale/wave range', () => {
  let min = Infinity, affected = 0, minAffectedY = Infinity;
  for (let i = 0; i < positions.count; i++) {
    min = Math.min(min, positions.getY(i));
    if (Math.hypot(target.getX(i), target.getY(i), target.getZ(i)) > 1e-5) { affected++; minAffectedY = Math.min(minAffectedY, positions.getY(i)); }
  }
  const sole = []; for (let i = 0; i < positions.count; i++) if (positions.getY(i) <= min + .10) sole.push(i);
  assert.equal(affected, 4097); assert.equal(sole.length, 1577); assert(minAffectedY > .697);
  const f = fixture(); let error = 0, cases = 0;
  for (const roll of [-.006, -.003, 0, .003, .006]) for (const scaleY of [1, 1.0015, 1.003]) for (const weight of [0, .15, .30, APPROVED_SPIRIT_WAVE_MAX_WEIGHT]) {
    f.root.rotation.z = roll; f.root.scale.y = scaleY; f.body.morphTargetInfluences[0] = weight;
    error = Math.max(error, Math.abs(fullFloor(f) - fullFloor(f, sole))); cases++;
  }
  assert(error < 1e-12); f.motion.dispose();
  report.floorSubset = { totalVertices: positions.count, candidates: sole.length, affectedVertices: affected, minAffectedY, cases, maxSubsetError: error };
});

test('greeting raises the original mitten, makes three distinct wrist waves and returns to moving idle', () => {
  const f = fixture('丙'), idle = fixture('丙'); f.motion.triggerReaction();
  let maximumY = 0, minWaveX = Infinity, maxWaveX = -Infinity, maxima = 0, minima = 0, previousX, previousDirection = 0, minEyeScale = Infinity;
  for (let frame = 1; frame <= 720; frame++) {
    const time = frame / 120; f.motion.update(time); const hand = handCenter(f), greeting = f.body.userData.approvedSpiritGreeting;
    maximumY = Math.max(maximumY, hand.y); assert.equal(f.body.morphTargetInfluences[0], 0, 'Source pose stays neutral');
    assert(greeting.controlWeights.filter(weight => weight > 1e-10).length <= 2);
    if (greeting.stage === 'wave') {
      minWaveX = Math.min(minWaveX, hand.x); maxWaveX = Math.max(maxWaveX, hand.x);
      const difference = previousX === undefined ? 0 : hand.x - previousX;
      const direction = Math.abs(difference) > 1e-7 ? Math.sign(difference) : previousDirection;
      if (direction !== previousDirection && previousDirection) { if (direction < 0) maxima++; else minima++; }
      if (direction) previousDirection = direction; previousX = hand.x;
      assert(hand.y > 1.6, 'Wrist waves occur beside the face');
    }
    minEyeScale = Math.min(minEyeScale, f.root.children.find(o => o.name.includes('almond_gaze')).scale.y);
  }
  assert(maximumY > 1.70); assert(maxWaveX - minWaveX > .13); assert.equal(maxima, 3); assert.equal(minima, 3);
  assert(minEyeScale < .057 * .5); idle.motion.update(6); nearPose(pose(f), pose(idle));
  report.greeting = { maximumY, sideToSideTravel: maxWaveX - minWaveX, maxima, minima, minEyeScale, returnedToIdle: true };
  f.motion.dispose(); idle.motion.dispose();
});

test('active tap retriggers coalesce without any pose jump, including while paused', () => {
  const f = fixture(); f.motion.triggerReaction(); f.motion.update(.43); const beforeTap = pose(f), beforeTapHand = handCenter(f);
  for (let i = 0; i < 100; i++) f.motion.triggerReaction();
  assert.deepEqual(pose(f), beforeTap); f.motion.update(.43); assert.deepEqual(pose(f), beforeTap);
  f.motion.update(.43 + 1e-6); assert(handCenter(f).distanceTo(beforeTapHand) < 1e-5);
  f.motion.update(3.4); assert(response(f) > 0, 'The raised-hand greeting remains active');
  f.motion.update(8); assert.equal(f.body.morphTargetInfluences[0], 0, 'Repeated tap queue remains bounded');
  const idle = fixture(); idle.motion.update(8); nearPose(pose(f), pose(idle));
  f.motion.dispose(); idle.motion.dispose();
});

test('raised arm and the complete reaction stay planted, with a smooth return under user yaw', () => {
  const f = fixture('己'); f.model.rotation.y = .85;
  const floor = fullFloor(f), originalChildren = [...f.root.children];
  f.motion.triggerReaction(); let error = 0, largestWeightStep = 0, previousWeight = 0;
  for (let frame = 1; frame <= 1200; frame++) {
    f.motion.update(frame / 240); const weight = response(f);
    largestWeightStep = Math.max(largestWeightStep, Math.abs(weight - previousWeight)); previousWeight = weight;
    if (frame % 24 === 0) error = Math.max(error, Math.abs(fullFloor(f) - floor));
  }
  assert(error < 1e-9); assert(largestWeightStep < .01); assert.equal(previousWeight, 0);
  assert.equal(f.model.rotation.y, .85); assert.deepEqual(f.root.children, originalChildren, 'No separate arm or replacement mesh is introduced');
  assert.deepEqual(hashes(f.body.geometry), expectedHashes);
  report.reactionFloor = { yaw: .85, maxFloorError: error, largestWeightStepAt240Hz: largestWeightStep, originalChildrenPreserved: true };
  f.motion.dispose();
});

test('15 and 60 Hz plus one large time step produce the same pose and bounded queued wave', () => {
  const a = fixture('癸'), b = fixture('癸'), largeStep = fixture('癸');
  for (const f of [a, b, largeStep]) f.motion.triggerReaction();
  for (let frame = 1; frame <= 20; frame++) a.motion.update(frame / 60);
  for (let frame = 1; frame <= 5; frame++) b.motion.update(frame / 15);
  largeStep.motion.update(1 / 3); for (const f of [a, b, largeStep]) f.motion.triggerReaction();
  for (let frame = 21; frame <= 180; frame++) a.motion.update(frame / 60);
  for (let frame = 6; frame <= 45; frame++) b.motion.update(frame / 15);
  largeStep.motion.update(3); nearPose(pose(a), pose(b)); nearPose(pose(a), pose(largeStep));
  for (const f of [a, b, largeStep]) { f.motion.update(10); assert.equal(f.body.morphTargetInfluences[0], 0); f.motion.dispose(); }
});

test('absolute time repeats are stable, finite extremes remain finite and backwards seek cancels reaction', () => {
  const f = fixture('辛'); f.motion.update(.2); f.motion.triggerReaction(); f.motion.update(1); const held = pose(f);
  for (const t of [1, 1, NaN, Infinity, -Infinity]) f.motion.update(t); assert.deepEqual(pose(f), held);
  f.motion.update(.3); assert.equal(f.body.morphTargetInfluences[0], 0);
  const idle = fixture('辛'); idle.motion.update(.3); nearPose(pose(f), pose(idle));
  f.motion.update(Number.MAX_VALUE); assert(pose(f).root.position.every(Number.isFinite)); assert(pose(f).root.scale.every(Number.isFinite));
  f.motion.update(-1); f.motion.reset(); idle.motion.reset(); nearPose(pose(f), pose(idle));
  f.motion.dispose(); idle.motion.dispose();
});

test('dispose restores captured facial transforms and neutral root, then every method is inert', () => {
  const f = fixture('壬', root => root.traverse(o => { if (o.isMesh && /almond_gaze|small_eye_glint|expressive_brow|quiet_smile/.test(o.name)) {
    o.position.x += .002; o.position.y += .001; o.rotation.z += .003; o.scale.multiplyScalar(.99);
  } }));
  const original = pose(f); original.morph = original.morph.slice(0, f.sourceInfluences.length); f.motion.triggerReaction(); f.motion.update(.6); assert.notDeepEqual(pose(f), original);
  f.motion.dispose(); assert.deepEqual(pose(f), original);
  assert.equal(f.body.geometry, f.sourceGeometry); assert.equal(f.body.morphTargetDictionary, f.sourceDictionary); assert.equal(f.body.morphTargetInfluences, f.sourceInfluences);
  for (const t of [1, 8, 0]) { f.motion.triggerReaction(); f.motion.update(t); f.motion.reset(); f.motion.dispose(); }
  assert.deepEqual(pose(f), original); assert.deepEqual(hashes(f.body.geometry), expectedHashes);
});

test('geometry queries and allocations are confined to setup, with cached sole updates below the attachment budget', () => {
  const f = fixture('甲'); f.body.getVertexPosition = () => { throw new Error('Runtime motion must use cached sole coordinates'); };
  f.motion.triggerReaction(); for (let i = 0; i < 100; i++) f.motion.update(i / 60);
  const begin = performance.now(); for (let i = 0; i < 10000; i++) f.motion.update(i / 60);
  const perUpdateMs = (performance.now() - begin) / 10000; assert(perUpdateMs < 2.2);
  report.cachedUpdate = { calls: 10000, meanMilliseconds: perUpdateMs, bodyVertexQueriesPerUpdate: 0, budgetMilliseconds: 2.2 };
  f.motion.dispose();
});

test('the preserved original limited study still preserves welded seams and has no collapsed triangles, rest-normal reversal or new adjacent folds', () => {
  const edges = new Map(), triangles = [], edgeFaces = new Map(), welds = new Map();
  for (let i = 0; i < positions.count; i++) {
    const key = [positions.getX(i), positions.getY(i), positions.getZ(i)].map(v => Math.round(v * 1e6)).join(':');
    const group = welds.get(key) ?? []; group.push(i); welds.set(key, group);
  }
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), normal = new THREE.Vector3();
  for (let off = 0; off < index.count; off += 3) {
    const ids = [index.getX(off), index.getX(off + 1), index.getX(off + 2)];
    a.fromBufferAttribute(positions, ids[0]); b.fromBufferAttribute(positions, ids[1]).sub(a); c.fromBufferAttribute(positions, ids[2]).sub(a);
    normal.crossVectors(b, c); const doubledArea = normal.length(); if (doubledArea < 1e-12) continue;
    const face = triangles.length; triangles.push({ ids, normal: normal.clone().divideScalar(doubledArea), doubledArea });
    for (let j = 0; j < 3; j++) { const x = ids[j], y = ids[(j + 1) % 3], key = Math.min(x, y) + ':' + Math.max(x, y);
      edges.set(key, [x, y]); const faces = edgeFaces.get(key) ?? []; faces.push(face); edgeFaces.set(key, faces); }
  }
  const adjacent = [...edgeFaces.values()].filter(faces => faces.length === 2).map(([a, b]) => ({ a, b, originalDot: triangles[a].normal.dot(triangles[b].normal) }));
  const posed = new Float64Array(positions.count * 3), posedNormals = new Float64Array(triangles.length * 3);
  let minEdgeRatio = Infinity, maxEdgeRatio = 0, minAreaRatio = Infinity, minRestNormalDot = 1, maxWeldGap = 0, reversals = 0, collapses = 0, newFolds = 0;
  for (let sample = 0; sample <= 90; sample++) {
    const weight = APPROVED_SPIRIT_WAVE_MAX_WEIGHT * sample / 90;
    for (let i = 0; i < positions.count; i++) for (let axis = 0; axis < 3; axis++) posed[i * 3 + axis] = positions.array[i * 3 + axis] + weight * target.array[i * 3 + axis];
    for (const [x, y] of edges.values()) {
      const restLength = Math.hypot(positions.getX(x) - positions.getX(y), positions.getY(x) - positions.getY(y), positions.getZ(x) - positions.getZ(y));
      if (restLength < 1e-7) continue;
      const ratio = Math.hypot(posed[x * 3] - posed[y * 3], posed[x * 3 + 1] - posed[y * 3 + 1], posed[x * 3 + 2] - posed[y * 3 + 2]) / restLength;
      minEdgeRatio = Math.min(minEdgeRatio, ratio); maxEdgeRatio = Math.max(maxEdgeRatio, ratio);
    }
    for (const [face, triangle] of triangles.entries()) {
      a.fromArray(posed, triangle.ids[0] * 3); b.fromArray(posed, triangle.ids[1] * 3).sub(a); c.fromArray(posed, triangle.ids[2] * 3).sub(a);
      normal.crossVectors(b, c); const ratio = normal.length() / triangle.doubledArea;
      minAreaRatio = Math.min(minAreaRatio, ratio); if (ratio < .01) collapses++;
      normal.normalize(); const dot = normal.dot(triangle.normal); minRestNormalDot = Math.min(minRestNormalDot, dot); if (dot <= 0) reversals++;
      normal.toArray(posedNormals, face * 3);
    }
    for (const pair of adjacent) {
      a.fromArray(posedNormals, pair.a * 3); b.fromArray(posedNormals, pair.b * 3);
      if (pair.originalDot > .3 && a.dot(b) < -.25) newFolds++;
    }
    for (const group of welds.values()) if (group.length > 1) {
      const first = group[0]; for (const id of group.slice(1)) {
        // Rounded coordinate groups may contain close rather than exact duplicates.
        const baseGap = Math.hypot(positions.getX(first) - positions.getX(id), positions.getY(first) - positions.getY(id), positions.getZ(first) - positions.getZ(id));
        if (baseGap < 1e-7) maxWeldGap = Math.max(maxWeldGap, Math.hypot(posed[first * 3] - posed[id * 3], posed[first * 3 + 1] - posed[id * 3 + 1], posed[first * 3 + 2] - posed[id * 3 + 2]));
      }
    }
  }
  assert.equal(triangles.length, 62124); assert.equal(collapses, 0); assert.equal(reversals, 0); assert.equal(newFolds, 0);
  assert(minAreaRatio > .24); assert(minRestNormalDot > .07); assert(maxWeldGap < 1e-6);
  assert.deepEqual(hashes(referenceBody.geometry), expectedHashes);
  report.topology = { sampledWeights: 91, triangles: triangles.length, edges: edges.size, adjacentPairs: adjacent.length,
    minEdgeRatio, maxEdgeRatio, minAreaRatio, minRestNormalDot, collapsedBelowOnePercent: collapses, restNormalReversals: reversals, newSharpAdjacentFolds: newFolds, maxWeldGap };
  // Preserve why the full source-study amplitude was not adopted. A normal
  // reversal against rest can also mean legitimate rotation; these are
  // conservative local signals, not standalone global inversion proofs.
  report.largerAmplitudeProbes = [];
  for (const weight of [.55, .60, 1]) {
    let minArea = Infinity, minDot = 1, reversed = 0, collapsed = 0, folds = 0;
    for (let i = 0; i < positions.count * 3; i++) posed[i] = positions.array[i] + weight * target.array[i];
    for (const [face, triangle] of triangles.entries()) {
      a.fromArray(posed, triangle.ids[0] * 3); b.fromArray(posed, triangle.ids[1] * 3).sub(a); c.fromArray(posed, triangle.ids[2] * 3).sub(a);
      normal.crossVectors(b, c); const ratio = normal.length() / triangle.doubledArea;
      minArea = Math.min(minArea, ratio); if (ratio < .01) collapsed++;
      normal.normalize(); const dot = normal.dot(triangle.normal); minDot = Math.min(minDot, dot); if (dot <= 0) reversed++;
      normal.toArray(posedNormals, face * 3);
    }
    for (const pair of adjacent) {
      a.fromArray(posedNormals, pair.a * 3); b.fromArray(posedNormals, pair.b * 3);
      if (pair.originalDot > .3 && a.dot(b) < -.25) folds++;
    }
    report.largerAmplitudeProbes.push({ weight, minAreaRatio: minArea, minRestNormalDot: minDot,
      restNormalReversals: reversed, collapsedBelowOnePercent: collapsed, newSharpAdjacentFolds: folds });
  }
  report.checks.push('Original geometry and morph attributes unchanged; no new local collapses/folds at bounded weights. Global self-intersection and artistic shape still require actual GPU review.');
});

nodeTest.after(async () => {
  report.status = report.testResults.length === 11 && report.testResults.every(result => result.status === 'PASS') ? 'PASS' : 'FAIL';
  report.limitations = ['CPU uses real approved GLB with placeholder texture I/O.', 'Original limited pose study is retained at neutral; raised greeting uses runtime morphs derived from original connected topology.',
  'The original .45 pose-study bound is separate from the derived raised greeting; actual front/side GPU and joint appearance remain a separate required review.',
    'Topology assertions are local measurements, not a proof of global nonintersection or artistic approval.'];
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
});
