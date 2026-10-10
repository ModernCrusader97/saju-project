// CPU QA loads the exact approved B GLB. Texture I/O alone is replaced here.
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

const output = path.resolve('outputs/approved-spirit-raised-wave/cpu');
await fs.mkdir(output, { recursive: true });
// An isolated pre-fashion baseline can select a read-only fashion checkout.
// The integrated repository always uses its own module without extra settings.
const fashionPath = path.resolve(process.env.SAJU_WAVE_FASHION_ROOT || process.cwd(), 'lib/planet/spirit-fashion.ts');
await fs.access(fashionPath);
await build({ stdin: { contents: `export * from './lib/planet/approved-spirit-motion';
  export * from './lib/planet/character-rest-coordinates';
  export * from './lib/planet/mesh-surface';
  export * from './lib/planet/surface-triangle-walk';
  export * from './lib/planet/surface-fissure-sand';
  export {createSpiritFashion} from ${JSON.stringify(fashionPath)};`, resolveDir: process.cwd() },
  outfile: path.join(output, 'runtime.mjs'), bundle: true, platform: 'node', format: 'esm', packages: 'external',
  plugins: [{ name: 'inspect-actual-private-sand-collider', setup(builder) {
    // QA export only: use the actual production class to inspect cached vertices
    // and segment hits without exposing a new production API.
    builder.onLoad({ filter: /surface-fissure-sand\.ts$/ }, async args => ({
      contents: (await fs.readFile(args.path, 'utf8')).replace('class RigidTriangleCollider', 'export class RigidTriangleCollider'), loader: 'ts',
    }));
  } }] });
const runtime = await import(pathToFileURL(path.join(output, 'runtime.mjs')).href);
const bytes = await fs.readFile('public/spirits/jade-v002/body.glb');
const sourcePath = 'assets/source-reference/saju-b-evolving-light-v002/reference/SaJu_Jade_Approved_Static_Material.glb';
assert(bytes.equals(await fs.readFile(sourcePath)), 'Runtime and archived B GLBs must match byte for byte');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(hash(bytes), '0e339d90253c8bbf6a865210f39d200ec3b5c042bcddb7ce669cea5c75c37b84');
const loader = new GLTFLoader().register(() => ({ name: 'CPU_IMAGE_IO', loadTexture: async () => new THREE.Texture() }));
const source = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
let sourceBody;
source.scene.traverse(o => { if (o.isMesh && o.geometry.attributes.position.count === 33207) sourceBody = o; });
assert(sourceBody);
const originalGeometry = sourceBody.geometry, position = originalGeometry.attributes.position, index = originalGeometry.index;
const handIDs = [], point = new THREE.Vector3();
for (let i = 0; i < position.count; i++) {
  // Distal original right mitten, independent of any new animation controls.
  if (position.getX(i) > .69 && position.getY(i) < .87 && position.getY(i) > .70) handIDs.push(i);
}
assert(handIDs.length > 300);
const attributeHash = attribute => hash(Buffer.from(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength));
const sourceHashes = geometry => Object.fromEntries([
  ...Object.entries(originalGeometry.attributes).map(([name]) => [name, attributeHash(geometry.attributes[name])]),
  ['index', attributeHash(geometry.index)],
  ...Object.entries(originalGeometry.morphAttributes).flatMap(([name, attributes]) => attributes.map((_, id) => [`morph:${name}:${id}`, attributeHash(geometry.morphAttributes[name][id])])),
]);
const expectedHashes = sourceHashes(originalGeometry);
const report = { status: 'PENDING', sourceGLB_SHA256: hash(bytes), sourceGLBPath: sourcePath,
  moduleSHA256: hash(await fs.readFile('lib/planet/approved-spirit-motion.ts')),
  controlsSHA256: hash(await fs.readFile('lib/planet/approved-spirit-arm-controls.ts')),
  sandColliderSHA256: hash(await fs.readFile('lib/planet/surface-fissure-sand.ts')),
  fashionPath, fashionModuleSHA256: hash(await fs.readFile(fashionPath)),
  harnessSHA256: hash(await fs.readFile(new URL(import.meta.url))), sourceHashes: expectedHashes,
  testResults: [], handVertices: handIDs.length };
const test = (name, run) => nodeTest(name, async () => {
  try { await run(); report.testResults.push({ name, status: 'PASS' }); }
  catch (error) { report.testResults.push({ name, status: 'FAIL', error: error.message }); throw error; }
});
function fixture(stem = '甲', bindRest = false) {
  const model = source.scene.clone(true), root = new THREE.Group();
  model.position.x = -.42; model.scale.z = 1.35;
  for (const child of [...model.children]) root.add(child);
  model.add(root); let body;
  root.traverse(o => { if (o.isMesh && o.geometry.attributes.position.count === 33207) body = o; });
  body.morphTargetInfluences.fill(0);
  if (bindRest) body.geometry = body.geometry.clone();
  const geometry = body.geometry, dictionary = body.morphTargetDictionary, influences = body.morphTargetInfluences;
  const binding = bindRest ? runtime.bindCharacterRestCoordinates(model, [body]) : undefined;
  const begin = performance.now(), motion = runtime.createApprovedSpiritMotion(root, body, stem);
  return { model, root, body, motion, geometry, dictionary, influences, binding, setupMs: performance.now() - begin };
}
function centroid(body, ids = handIDs) {
  const out = new THREE.Vector3();
  for (const id of ids) out.add(body.getVertexPosition(id, point));
  return out.multiplyScalar(1 / ids.length);
}
const greeting = f => f.body.userData.approvedSpiritGreeting;
const stagesAt = (f, progress) => { f.motion.update(greeting(f).duration * progress); return greeting(f); };
const stats = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return { samples: sorted.length, medianMs: sorted[Math.floor(sorted.length / 2)], p95Ms: sorted[Math.floor(sorted.length * .95)], maximumMs: sorted.at(-1) };
};
function actualAnchor(body, triangle, barycentric, root) {
  const vertices = [0, 1, 2].map(j => body.getVertexPosition(index.getX(triangle * 3 + j), new THREE.Vector3()));
  const position = vertices.reduce((sum, p, j) => sum.addScaledVector(p, barycentric[j]), new THREE.Vector3());
  const normal = new THREE.Triangle(...vertices).getNormal(new THREE.Vector3());
  body.updateWorldMatrix(true, false); root.updateWorldMatrix(true, false);
  const relative = root.matrixWorld.clone().invert().multiply(body.matrixWorld);
  return { position: position.applyMatrix4(relative), normal: normal.applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(relative)) };
}

test('the exact source GLB has one limited morph study and no skeleton, skin or joint attributes', async () => {
  const jsonLength = bytes.readUInt32LE(12), document = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const meshes = [];
  source.scene.traverse(o => { if (o.isMesh) meshes.push({ name: o.name, vertices: o.geometry.attributes.position.count,
    attributes: Object.keys(o.geometry.attributes), dictionary: o.morphTargetDictionary, skinned: !!o.isSkinnedMesh }); });
  assert.equal(meshes.length, 8); assert.equal(document.skins?.length ?? 0, 0);
  assert(meshes.every(m => !m.skinned && !m.attributes.some(a => /skin|joint|weight/i.test(a))));
  assert(document.meshes.every(m => m.primitives.every(p => !('JOINTS_0' in p.attributes) && !('WEIGHTS_0' in p.attributes))));
  assert.equal(originalGeometry.morphAttributes.position.length, 1); assert.equal(originalGeometry.morphAttributes.normal.length, 1);
  assert.deepEqual(sourceBody.morphTargetDictionary, { Gentle_wave_pose: 0 });
  assert.deepEqual(document.animations.flatMap(a => a.channels.map(c => c.target.path)), ['weights']);
  const builderPaths = ['assets/source-reference/saju-b-jade-reconstruction-baseline-20261006/scripts/build_jade_v003.py',
    'assets/source-reference/saju-b-jade-reconstruction-baseline-20261006/scripts/finalize_jade.py'];
  const builders = await Promise.all(builderPaths.map(async file => ({ path: file, SHA256: hash(await fs.readFile(file)) })));
  originalGeometry.computeBoundingBox();
  report.sourceStructure = { meshes, skinCount: 0, boneCount: 0, animationPaths: ['weights'], animation: source.animations.map(a => ({ name: a.name, duration: a.duration })),
    bounds: { min: originalGeometry.boundingBox.min.toArray(), max: originalGeometry.boundingBox.max.toArray() }, builders,
    finding: 'The exact B GLB contains no skeletal rig. The previous small gesture drove its only limited arm morph, whose shape and bounded amplitude cannot make the requested full raised greeting.' };
});

test('the actual original mitten reaches beside the face before its greeting', () => {
  const f = fixture(); const rest = centroid(f.body); f.motion.triggerReaction();
  let maximumY = rest.y, atMaximum;
  for (let i = 0; i <= 360; i++) {
    f.motion.update(i / 90); const hand = centroid(f.body);
    if (hand.y > maximumY) { maximumY = hand.y; atMaximum = hand.toArray(); }
  }
  f.motion.dispose();
  report.raisedHand = { rest: rest.toArray(), maximumY, atMaximum, verticalTravel: maximumY - rest.y, firstControlSetupMs: f.setupMs };
  assert(maximumY > 1.55, `Hand must rise beside the face; original distal-mitten centroid only reached y=${maximumY.toFixed(4)}`);
  assert(maximumY - rest.y > .70, 'Greeting must raise the arm clearly from idle');
});

test('eight raise keys plus two wrist keys use at most two active controls and keep the original study neutral', () => {
  const f = fixture(), g = greeting(f), derived = f.body.geometry.morphAttributes.position.slice(1), normalDerived = f.body.geometry.morphAttributes.normal.slice(1);
  assert.equal(f.body.morphTargetInfluences.length, 11); assert.equal(g.controlIndices.length, 10); assert.equal(g.controlWeights.length, 10);
  assert.equal(g.handVertexIDs.length, handIDs.length); assert.equal(g.cycles, 3);
  assert.equal(g, f.root.userData.approvedSpiritGreeting); assert.deepEqual(g.controlIndices, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const before = derived.map(attributeHash), normalBefore = normalDerived.map(attributeHash); f.motion.triggerReaction();
  let maximumActive = 0, minimumWavingY = Infinity, minWaveX = Infinity, maxWaveX = -Infinity, maxima = 0, minima = 0, previousX, previousDirection = 0;
  for (let frame = 0; frame <= 960; frame++) {
    stagesAt(f, frame / 960);
    assert.equal(f.body.morphTargetInfluences[0], 0);
    assert.deepEqual(g.controlWeights, g.controlIndices.map(id => f.body.morphTargetInfluences[id]));
    assert(g.controlWeights.every(w => Number.isFinite(w) && w >= 0 && w <= 1));
    assert(g.controlWeights.reduce((sum, w) => sum + w, 0) <= 1 + 1e-12);
    maximumActive = Math.max(maximumActive, g.controlWeights.filter(w => w > 1e-10).length);
    if (g.stage === 'wave') {
      const hand = centroid(f.body); minimumWavingY = Math.min(minimumWavingY, hand.y); minWaveX = Math.min(minWaveX, hand.x); maxWaveX = Math.max(maxWaveX, hand.x);
      const delta = previousX === undefined ? 0 : hand.x - previousX, direction = Math.abs(delta) > 1e-7 ? Math.sign(delta) : previousDirection;
      if (direction !== previousDirection && previousDirection) { if (direction < 0) maxima++; else minima++; }
      if (direction) previousDirection = direction; previousX = hand.x;
      assert.equal(g.armLift, 1);
    }
  }
  assert.equal(maxima, 3); assert.equal(minima, 3); assert.equal(maximumActive, 2); assert(minimumWavingY > 1.6); assert(maxWaveX - minWaveX > .13);
  assert.equal(g.stage, 'idle'); assert(f.body.morphTargetInfluences.every(w => w === 0));
  assert.deepEqual(derived.map(attributeHash), before); assert.deepEqual(normalDerived.map(attributeHash), normalBefore);
  report.controls = { totalInfluences: 11, derivedControls: 10, maximumActive, minimumWavingY, lateralTravel: maxWaveX - minWaveX, maxima, minima, field: g.field,
    cachedControlSetupMs: f.setupMs, perFrameGeometryWrites: 0 };
  f.motion.dispose();
});

test('interpolated raised poses preserve welded seams, local oriented area and adjacent shoulder continuity', () => {
  const welds = new Map(), vertexNodes = new Uint32Array(position.count), seamPairs = [];
  for (let id = 0; id < position.count; id++) {
    const key = [position.getX(id), position.getY(id), position.getZ(id)].map(v => Math.round(v * 1e6)).join(':');
    let group = welds.get(key); if (!group) { group = { node: welds.size, ids: [] }; welds.set(key, group); }
    vertexNodes[id] = group.node; group.ids.push(id);
  }
  for (const { ids } of welds.values()) for (const id of ids.slice(1)) {
    if (point.fromBufferAttribute(position, id).distanceTo(new THREE.Vector3().fromBufferAttribute(position, ids[0])) < 1e-7) seamPairs.push([ids[0], id]);
  }
  const triangles = [], edgeFaces = new Map(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), normal = new THREE.Vector3(), restNormal = originalGeometry.attributes.normal;
  for (let offset = 0; offset < index.count; offset += 3) {
    const ids = [0, 1, 2].map(j => index.getX(offset + j));
    a.fromBufferAttribute(position, ids[0]); b.fromBufferAttribute(position, ids[1]).sub(a); c.fromBufferAttribute(position, ids[2]).sub(a); normal.crossVectors(b, c);
    const area = normal.length(); if (area < 1e-12) continue; normal.divideScalar(area);
    const smoothNormal = ids.reduce((sum, id) => sum.add(new THREE.Vector3().fromBufferAttribute(restNormal, id)), new THREE.Vector3()).normalize();
    const face = triangles.length; triangles.push({ ids, area, normal: normal.clone(), restSmoothDot: normal.dot(smoothNormal), shoulder: ids.some(id => position.getX(id) > .25 && position.getX(id) < .66 && position.getY(id) > 1.0 && position.getY(id) < 1.40) });
    for (let j = 0; j < 3; j++) {
      const va = ids[j], vb = ids[(j + 1) % 3], x = vertexNodes[va], y = vertexNodes[vb]; if (x === y) continue;
      const key = `${Math.min(x, y)}:${Math.max(x, y)}`;
      let edge = edgeFaces.get(key);
      if (!edge) { edge = { ids: [va, vb], faces: [], restLength: point.fromBufferAttribute(position, va).distanceTo(new THREE.Vector3().fromBufferAttribute(position, vb)) }; edgeFaces.set(key, edge); }
      edge.faces.push(face);
    }
  }
  const adjacent = [...edgeFaces.values()].filter(e => e.faces.length === 2).map(e => ({ a: e.faces[0], b: e.faces[1], restDot: triangles[e.faces[0]].normal.dot(triangles[e.faces[1]].normal) }));
  const f = fixture(), posed = new Float64Array(position.count * 3), faceNormals = new Float64Array(triangles.length * 3), posedSmooth = new Float64Array(position.count * 3);
  let minAreaRatio = Infinity, maxAreaRatio = 0, minShoulderAreaRatio = Infinity, minEdgeRatio = Infinity, maxEdgeRatio = 0, maxEdge,
    maxWeldGap = 0, collapsed = 0, folds = 0, orientedReversals = 0, minOrientedAreaRatio = Infinity, minRestNormalDot = 1, maxProtectedDisplacement = 0;
  f.motion.triggerReaction();
  const progressSamples = Array.from({ length: 161 }, (_, sample) => sample / 160);
  const liftProgress = amount => {
    let low = 0, high = 1;
    for (let i = 0; i < 60; i++) { const t = (low + high) / 2, lift = t * t * t * (t * (t * 6 - 15) + 10); if (lift < amount) low = t; else high = t; }
    return (low + high) / 2 * .25;
  };
  for (let step = 1; step <= 16; step++) { const progress = liftProgress(step / 16); progressSamples.push(progress, 1 - progress); }
  for (const wrist of [-1, -.75, -.5, -.25, 0, .25, .5, .75, 1]) progressSamples.push(.25 + .5 * (2 * Math.PI + Math.asin(wrist)) / (6 * Math.PI));
  progressSamples.sort((a, b) => a - b);
  for (const progress of progressSamples) {
    stagesAt(f, progress);
    const geometry = f.body.geometry, active = f.body.morphTargetInfluences.map((weight, id) => ({ weight, id })).filter(p => p.weight !== 0);
    for (let id = 0; id < position.count; id++) {
      f.body.getVertexPosition(id, point).toArray(posed, id * 3);
      normal.fromBufferAttribute(restNormal, id);
      for (const { weight, id: target } of active) normal.addScaledVector(new THREE.Vector3().fromBufferAttribute(geometry.morphAttributes.normal[target], id), weight);
      normal.normalize().toArray(posedSmooth, id * 3);
      if (position.getX(id) <= .25 || position.getY(id) <= .52 || position.getY(id) >= 1.40) {
        maxProtectedDisplacement = Math.max(maxProtectedDisplacement, point.distanceTo(a.fromBufferAttribute(position, id)));
      }
      assert(geometry.boundingBox.containsPoint(point), 'Convex native morph blends must stay inside the expanded pose bounds');
    }
    for (const edge of edgeFaces.values()) {
      if (edge.restLength < 1e-7) continue;
      const [x, y] = edge.ids, length = a.fromArray(posed, x * 3).distanceTo(b.fromArray(posed, y * 3)), ratio = length / edge.restLength;
      minEdgeRatio = Math.min(minEdgeRatio, ratio);
      if (ratio > maxEdgeRatio) {
        maxEdgeRatio = ratio; maxEdge = { vertexIDs: edge.ids, ratio, originalLength: edge.restLength, posedLength: length, progress, stage: greeting(f).stage,
          restEndpoints: edge.ids.map(id => new THREE.Vector3().fromBufferAttribute(position, id).toArray()), posedEndpoints: edge.ids.map(id => Array.from(posed.slice(id * 3, id * 3 + 3))) };
      }
    }
    for (const [face, triangle] of triangles.entries()) {
      a.fromArray(posed, triangle.ids[0] * 3); b.fromArray(posed, triangle.ids[1] * 3).sub(a); c.fromArray(posed, triangle.ids[2] * 3).sub(a); normal.crossVectors(b, c);
      const ratio = normal.length() / triangle.area; minAreaRatio = Math.min(minAreaRatio, ratio); maxAreaRatio = Math.max(maxAreaRatio, ratio);
      if (triangle.shoulder) minShoulderAreaRatio = Math.min(minShoulderAreaRatio, ratio);
      if (ratio < .01) collapsed++;
      normal.normalize().toArray(faceNormals, face * 3); minRestNormalDot = Math.min(minRestNormalDot, normal.dot(triangle.normal));
      const transportedNormal = triangle.ids.reduce((sum, id) => sum.add(new THREE.Vector3().fromArray(posedSmooth, id * 3)), new THREE.Vector3()).normalize();
      // Signed area uses the locally transported normal. A >90° intended arm
      // rotation can have a negative rest-normal dot without an inverted surface.
      if (triangle.restSmoothDot > .3) {
        const oriented = ratio * normal.dot(transportedNormal); minOrientedAreaRatio = Math.min(minOrientedAreaRatio, oriented); if (oriented <= 0) orientedReversals++;
      }
    }
    for (const pair of adjacent) if (pair.restDot > .3 && a.fromArray(faceNormals, pair.a * 3).dot(b.fromArray(faceNormals, pair.b * 3)) < -.25) folds++;
    for (const [first, id] of seamPairs) maxWeldGap = Math.max(maxWeldGap, a.fromArray(posed, first * 3).distanceTo(b.fromArray(posed, id * 3)));
  }
  report.raisedTopology = { samples: progressSamples.length, explicitRaiseAndLowerLiftAmounts: Array.from({ length: 16 }, (_, i) => (i + 1) / 16), explicitWristMixtures: [-1, -.75, -.5, -.25, 0, .25, .5, .75, 1],
    triangles: triangles.length, weldedNodes: welds.size, seamPairs: seamPairs.length,
    edges: edgeFaces.size, adjacentPairs: adjacent.length, minAreaRatio, maxAreaRatio, minShoulderAreaRatio, minEdgeRatio, maxEdgeRatio, maxEdge,
    maxWeldGap, collapsedBelowOnePercent: collapsed, newSharpAdjacentFolds: folds, localOrientedReversals: orientedReversals,
    minLocalOrientedAreaRatio: minOrientedAreaRatio, minRestNormalDotDiagnosticOnly: minRestNormalDot, maxProtectedDisplacement,
    limits: 'Local area/orientation/adjacency checks and native visual review are not a mathematical global nonintersection proof.' };
  assert.equal(triangles.length, 62124); assert(minAreaRatio > .60); assert(minShoulderAreaRatio > .60); assert.equal(collapsed, 0); assert.equal(folds, 0);
  assert.equal(orientedReversals, 0); assert(minOrientedAreaRatio > .30); assert(maxWeldGap < 1e-6); assert.equal(maxProtectedDisplacement, 0);
  assert.deepEqual(sourceHashes(f.body.geometry), expectedHashes); f.motion.dispose();
});

test('fresh GLTF parses share immutable controls only after exact source position/normal/index byte verification', async () => {
  const parsed = [];
  for (let parse = 0; parse < 2; parse++) {
    const model = (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene, root = new THREE.Group();
    for (const child of [...model.children]) root.add(child); model.add(root); let body;
    root.traverse(o => { if (o.isMesh && o.geometry.attributes.position.count === 33207) body = o; });
    const geometry = body.geometry; body.morphTargetInfluences.fill(0); const start = performance.now(), motion = runtime.createApprovedSpiritMotion(root, body, '己');
    parsed.push({ model, root, body, geometry, motion, setupMs: performance.now() - start });
  }
  assert.notEqual(parsed[0].geometry, parsed[1].geometry); assert.notEqual(parsed[0].geometry.attributes.position.array, parsed[1].geometry.attributes.position.array);
  assert.equal(greeting(parsed[0]).field, greeting(parsed[1]).field);
  for (let key = 1; key <= 10; key++) {
    assert.notEqual(parsed[0].body.geometry.morphAttributes.position[key], parsed[1].body.geometry.morphAttributes.position[key]);
    assert.equal(parsed[0].body.geometry.morphAttributes.position[key].array, parsed[1].body.geometry.morphAttributes.position[key].array);
    assert.equal(parsed[0].body.geometry.morphAttributes.normal[key].array, parsed[1].body.geometry.morphAttributes.normal[key].array);
  }
  for (const f of parsed) {
    assert.deepEqual(sourceHashes(f.body.geometry), expectedHashes); assert(f.setupMs < Math.max(20, report.raisedHand.firstControlSetupMs * .2));
    f.motion.triggerReaction(); stagesAt(f, .4);
  }
  assert(centroid(parsed[0].body).distanceTo(centroid(parsed[1].body)) < 1e-12);
  // A same-count mesh with one changed source byte must derive its own controls.
  const changed = source.scene.clone(true), root = new THREE.Group(); for (const child of [...changed.children]) root.add(child); changed.add(root); let body;
  root.traverse(o => { if (o.isMesh && o.geometry.attributes.position.count === 33207) body = o; });
  body.geometry = body.geometry.clone(); const n = body.geometry.attributes.normal, changedID = handIDs[0]; n.setX(changedID, n.getX(changedID) + .001); body.morphTargetInfluences.fill(0);
  const changedGeometry = body.geometry, start = performance.now(), motion = runtime.createApprovedSpiritMotion(root, body, '己'), changedSetupMs = performance.now() - start;
  assert.notEqual(body.userData.approvedSpiritGreeting.field, greeting(parsed[0]).field);
  assert.notEqual(body.geometry.morphAttributes.normal[8].array, parsed[0].body.geometry.morphAttributes.normal[8].array);
  report.crossParseCache = { coldOriginalSetupMs: report.raisedHand.firstControlSetupMs, verifiedFreshParseSetupMs: parsed.map(f => f.setupMs),
    separateSourceArrays: true, sharedImmutablePoseArrays: true, sharedPoseBytes: 10 * 2 * 33207 * 3 * 4,
    sourceSnapshotBytes: position.array.byteLength + originalGeometry.attributes.normal.array.byteLength + index.array.byteLength,
    sameCountChangedNormalRecomputed: true, changedSetupMs, retainedSharedEntries: 1 };
  motion.dispose(); changedGeometry.dispose(); for (const f of parsed) { f.motion.dispose(); f.geometry.dispose(); }
});

test('the head, feet, opposite arm and all original source attributes are preserved; reset and disposal restore exact ownership', () => {
  const f = fixture('戊', true), owned = f.body.geometry;
  assert.notEqual(owned, f.geometry); assert.equal(owned.index, f.geometry.index);
  for (const [name, attribute] of Object.entries(f.geometry.attributes)) assert.equal(owned.attributes[name], attribute);
  for (const [name, attributes] of Object.entries(f.geometry.morphAttributes)) {
    assert.equal(attributes.length, 1); assert.notEqual(owned.morphAttributes[name], attributes); assert.equal(owned.morphAttributes[name][0], attributes[0]);
  }
  assert.deepEqual(sourceHashes(owned), expectedHashes);
  const restAttributes = runtime.CHARACTER_REST_ATTRIBUTES.map(name => owned.attributes[name]), restHashes = restAttributes.map(attributeHash);
  const faces = f.root.children.filter(o => o.isMesh && o !== f.body).map(o => ({ o, position: o.position.clone(), scale: o.scale.clone(), quaternion: o.quaternion.clone() }));
  let disposals = 0, attributesAttachedAtDispose = false;
  owned.addEventListener('dispose', () => { disposals++; attributesAttachedAtDispose = owned.morphAttributes.position.length === 11 && owned.morphAttributes.normal.length === 11 && runtime.CHARACTER_REST_ATTRIBUTES.every(name => !!owned.attributes[name]); });
  f.motion.triggerReaction(); stagesAt(f, .45); f.motion.reset(); assert(f.body.morphTargetInfluences.every(w => w === 0));
  for (const face of faces) { assert(face.o.position.equals(face.position)); assert(face.o.scale.equals(face.scale)); assert(face.o.quaternion.equals(face.quaternion)); }
  assert.deepEqual(restAttributes.map(attributeHash), restHashes); f.motion.triggerReaction(); stagesAt(f, .4); f.motion.dispose();
  assert.equal(disposals, 1); assert(attributesAttachedAtDispose); assert.equal(f.body.geometry, f.geometry); assert.equal(f.body.morphTargetDictionary, f.dictionary); assert.equal(f.body.morphTargetInfluences, f.influences);
  assert.deepEqual(f.influences, [0]); assert.equal(f.body.userData.approvedSpiritGreeting, undefined); assert.equal(f.root.userData.approvedSpiritGreeting, undefined);
  f.motion.dispose(); f.motion.triggerReaction(); f.motion.update(8); f.motion.reset(); assert.equal(disposals, 1); assert.deepEqual(f.influences, [0]);
  assert.deepEqual(sourceHashes(f.body.geometry), expectedHashes); f.binding.dispose(); f.geometry.dispose();
});

test('actual moving triangles and rest-space coordinates remain compatible with MeshSurface and triangle walkers under display depth and yaw', () => {
  const f = fixture('己', true), surface = new runtime.MeshSurface([f.body], { allowMorphTargets: true }), walker = new runtime.SurfaceTriangleWalker([f.body], { allowMorphTargets: true });
  f.model.rotation.y = .72; const rest = runtime.CHARACTER_REST_ATTRIBUTES.map(name => attributeHash(f.body.geometry.attributes[name]));
  const handSet = new Set(handIDs); let handTriangle;
  for (let offset = 0; offset < index.count; offset += 3) if ([0, 1, 2].every(j => handSet.has(index.getX(offset + j)))) { handTriangle = offset / 3; break; }
  assert.notEqual(handTriangle, undefined);
  const anchor = { mesh: f.body, triangle: handTriangle, barycentric: new THREE.Vector3(.2, .3, .5) }, path = walker.path(anchor, { direction: new THREE.Vector3(0, 1, 0), length: .04 });
  assert(path.length > 1); f.motion.triggerReaction(); let maxPositionError = 0, maxNormalError = 0;
  for (const progress of [.1, .2, .3, .4, .5, .6, .7, .85, 1]) {
    stagesAt(f, progress);
    for (const current of [anchor, ...path]) {
      const actual = actualAnchor(f.body, current.triangle, current.barycentric.toArray(), f.model), resolved = surface.resolve(current, f.model), walked = walker.sampler.resolve(current, f.model);
      maxPositionError = Math.max(maxPositionError, resolved.position.distanceTo(actual.position), walked.position.distanceTo(actual.position));
      maxNormalError = Math.max(maxNormalError, resolved.normal.distanceTo(actual.normal), walked.normal.distanceTo(actual.normal));
    }
    assert.deepEqual(runtime.CHARACTER_REST_ATTRIBUTES.map(name => attributeHash(f.body.geometry.attributes[name])), rest);
  }
  assert(maxPositionError < 1e-10); assert(maxNormalError < 1e-10); assert.equal(f.model.scale.z, 1.35); assert.equal(f.model.rotation.y, .72);
  report.attachments = { pathPoints: path.length, anchorTriangle: handTriangle, maxPositionError, maxNormalError, depth: 1.35, yaw: .72, immutableRestBindings: true };
  f.motion.dispose(); f.binding.dispose(); f.geometry.dispose();
});

test('all six read-only fashion items follow their original support triangles through raised waves and active replacement', () => {
  const f = fixture('己'), eyes = []; f.root.traverse(o => { if (o.isMesh && o.name.includes('almond_gaze')) eyes.push(o); });
  const fashion = runtime.createSpiritFashion({ body: f.body, model: f.root, eyes, stem: '기', presentationDepth: 1.35 });
  fashion.set({ head: 'sprout-pin', face: 'round-sunglasses', neck: 'ribbon-bow', back: 'leaf-brooch' });
  let maxPositionError = 0, maxNormalError = 0; f.motion.triggerReaction();
  for (const progress of [.12, .3, .4, .55, .7, .86, 1]) {
    stagesAt(f, progress); f.model.rotation.y = -.8 + progress; fashion.update();
    if (progress === .55) fashion.set({ head: 'crescent-pin', face: 'fitted-mask', neck: 'ribbon-bow', back: 'leaf-brooch' });
    for (const support of fashion.group.userData.diagnostics.triangleSupports) {
      const actual = actualAnchor(f.body, support.triangle, support.barycentric, fashion.group);
      maxPositionError = Math.max(maxPositionError, actual.position.distanceTo(new THREE.Vector3(...support.position)));
      maxNormalError = Math.max(maxNormalError, actual.normal.distanceTo(new THREE.Vector3(...support.normal)));
    }
  }
  assert(maxPositionError < 1e-10); assert(maxNormalError < 1e-10); assert.deepEqual(sourceHashes(f.body.geometry), expectedHashes);
  report.fashionFollow = { itemsChecked: 6, supportsPerOutfit: 4, replacedDuringActiveWave: true, maxPositionError, maxNormalError, modulePath: fashionPath };
  fashion.dispose(); f.motion.dispose();
});

test('sand created after derived controls retains crack identity and refits the actual posed triangle cache within its isolated update budget', () => {
  const f = fixture('戊', true), begin = performance.now(), effect = runtime.createSurfaceFissureSand({ meshes: [f.body], quality: 'high', allowMorphTargets: true });
  const effectSetupMs = performance.now() - begin; f.root.add(effect.group); const sources = structuredClone(effect.group.userData.sandSources), times = [];
  f.motion.triggerReaction(); let maxPositionError = 0;
  for (let sample = 0; sample < 120; sample++) {
    const time = greeting(f).duration * (.02 + sample * .96 / 120); f.motion.update(time);
    const start = performance.now(); effect.update(time); if (sample >= 20) times.push(performance.now() - start);
    const frame = effect.group.userData.sandFrame;
    for (const [id, source] of sources.entries()) {
      const actual = actualAnchor(f.body, source.triangle, source.barycentric, new THREE.Group());
      maxPositionError = Math.max(maxPositionError, actual.position.distanceTo(new THREE.Vector3(...frame.sourceWorld[id].position)));
    }
  }
  assert.deepEqual(effect.group.userData.sandSources, sources); assert(maxPositionError < 1e-10); assert(effect.group.userData.sandFrame.colliderRefits >= 100);
  const beforeRepeat = effect.group.userData.sandFrame.colliderRefits; effect.update(effect.group.userData.sandFrame.time); assert.equal(effect.group.userData.sandFrame.colliderRefits, beforeRepeat);
  const budget = stats(times); report.sandRefit = { ...budget, effectSetupMs, colliderRefits: beforeRepeat, maxEmitterPositionError: maxPositionError,
    requiredInitializationOrder: 'Rest/material binding, then motion, then effects', meaningfulControlsAtConstruction: 10 };
  assert(budget.medianMs <= 3, `Changing raised-control collision refit median ${budget.medianMs.toFixed(3)}ms exceeds the isolated 3ms budget`);
  f.motion.dispose(); effect.dispose(); f.binding.dispose(); f.geometry.dispose();
});

test('optimized relative-morph collision vertices and segment hits equal actual Three queries, including custom and absolute fallbacks', () => {
  const f = fixture(), fallbackBody = f.body.clone(); f.root.add(fallbackBody);
  const originalQuery = THREE.Mesh.prototype.getVertexPosition;
  fallbackBody.getVertexPosition = function (id, target) { return originalQuery.call(this, id, target); };
  const fast = new runtime.RigidTriangleCollider(f.body), fallback = new runtime.RigidTriangleCollider(fallbackBody);
  const boundsA = new THREE.Box3(), boundsB = new THREE.Box3(), start = new THREE.Vector3(), end = new THREE.Vector3(), normal = new THREE.Vector3();
  let vertexComparisons = 0, segmentComparisons = 0, intersectingSegments = 0, maximumVertexError = 0;
  f.motion.triggerReaction();
  for (let sample = 0; sample <= 24; sample++) {
    stagesAt(f, sample / 24); fallbackBody.morphTargetInfluences = [...f.body.morphTargetInfluences]; fast.refresh(); fallback.refresh();
    assert.deepEqual(fast.worldBounds(boundsA), fallback.worldBounds(boundsB));
    for (let id = 0; id < position.count; id++) {
      f.body.getVertexPosition(id, point); const actual = point.toArray();
      for (let axis = 0; axis < 3; axis++) {
        const fastValue = fast.vertices[id * 3 + axis], fallbackValue = fallback.vertices[id * 3 + axis];
        assert.equal(fastValue, actual[axis]); assert.equal(fastValue, fallbackValue); maximumVertexError = Math.max(maximumVertexError, Math.abs(fastValue - actual[axis])); vertexComparisons++;
      }
    }
    for (let probe = 0; probe < 12; probe++) {
      const triangle = (probe * 5179 + sample * 127) % (index.count / 3), pose = actualAnchor(f.body, triangle, [1 / 3, 1 / 3, 1 / 3], new THREE.Group());
      normal.copy(pose.normal); start.copy(pose.position).addScaledVector(normal, .10); end.copy(pose.position).addScaledVector(normal, -.10);
      const hit = fast.intersects(start, end); assert.equal(hit, fallback.intersects(start, end)); if (hit) intersectingSegments++; segmentComparisons++;
      start.addScaledVector(normal, 1); end.copy(start).addScaledVector(normal, .1); assert.equal(fast.intersects(start, end), fallback.intersects(start, end)); segmentComparisons++;
    }
  }
  assert(intersectingSegments > 200); assert.equal(maximumVertexError, 0);
  // Oversized finite controls retain the full-node refit/padding path.
  f.body.morphTargetInfluences.fill(0); f.body.morphTargetInfluences[8] = 1.2; fallbackBody.morphTargetInfluences = [...f.body.morphTargetInfluences]; fast.refresh(); fallback.refresh();
  assert.deepEqual(fast.worldBounds(boundsA), fallback.worldBounds(boundsB)); assert.deepEqual(fast.vertices, fallback.vertices);
  // A custom vertex query must still control the collider's moving vertices.
  let customQueries = 0; fallbackBody.getVertexPosition = function (id, target) { customQueries++; return originalQuery.call(this, id, target).add(new THREE.Vector3(.002, 0, 0)); };
  fallbackBody.morphTargetInfluences[8] = .8; fallback.refresh(); assert(customQueries > 10000);
  const probe = fallback.affectedVertices[0]; assert.equal(fallback.vertices[probe * 3], originalQuery.call(fallbackBody, probe, point).x + .002);
  assert.throws(() => { fallbackBody.morphTargetInfluences[8] = NaN; fallback.refresh(); }, /finite/);
  const absoluteBody = sourceBody.clone(); absoluteBody.geometry = originalGeometry.clone(); absoluteBody.geometry.morphTargetsRelative = false;
  const sourceDelta = originalGeometry.morphAttributes.position[0], values = new Float32Array(position.count * 3);
  for (let i = 0; i < values.length; i++) values[i] = position.array[i] + sourceDelta.array[i];
  absoluteBody.geometry.morphAttributes.position = [new THREE.BufferAttribute(values, 3)]; absoluteBody.morphTargetInfluences = [.35];
  const absolute = new runtime.RigidTriangleCollider(absoluteBody);
  for (let id = 0; id < position.count; id++) { absoluteBody.getVertexPosition(id, point); assert.deepEqual(Array.from(absolute.vertices.slice(id * 3, id * 3 + 3)), point.toArray()); }
  report.sandExactness = { samples: 25, vertexAxisComparisons: vertexComparisons, segmentComparisons, intersectingSegments, maximumVertexError,
    exactSameBounds: true, customQueryFallback: true, absoluteMorphFallback: true, oversizedControlsPreserved: true, nonfiniteRejected: true };
  absolute.clear(); absoluteBody.geometry.dispose(); fast.clear(); fallback.clear(); fallbackBody.removeFromParent(); f.motion.dispose();
});

test('tap blinking preserves the original elapsed-time curve independently of the longer greeting for every stem', () => {
  const tempos = { 甲: 1.04, 乙: 1.12, 丙: .93, 丁: 1.01, 戊: 1.15, 己: 1.08, 庚: .98, 辛: 1.03, 壬: 1.11, 癸: 1.17 };
  let maxError = 0;
  for (const [stem, tempo] of Object.entries(tempos)) {
    const f = fixture(stem), eye = f.root.children.find(o => o.name.includes('almond_gaze')), glint = f.root.children.find(o => o.name.includes('small_eye_glint'));
    const eyeScale = eye.scale.y, glintScale = glint.scale.y; f.motion.triggerReaction();
    for (const elapsed of [0, .1, .2, .24 * tempo, .36 * tempo, .48 * tempo, .60 * tempo, .75 * tempo]) {
      f.motion.update(elapsed); const blink = elapsed >= 0 && elapsed < .48 * tempo ? Math.sin(Math.PI * elapsed / (.48 * tempo)) ** 2 : 0, expected = 1 - .78 * blink;
      maxError = Math.max(maxError, Math.abs(eye.scale.y / eyeScale - expected), Math.abs(glint.scale.y / glintScale - expected));
    }
    f.motion.dispose();
  }
  assert(maxError < 1e-12); report.originalTapBlink = { stems: 10, durationBeforeTempo: .48, maxCurveError: maxError };
});

test('absolute timing, paused repeated taps, 15/60Hz queued re-entry and a large step agree on actual hand positions', () => {
  const a = fixture('癸'), b = fixture('癸'), skipped = fixture('癸');
  for (const f of [a, b, skipped]) f.motion.triggerReaction();
  for (let i = 0; i <= 20; i++) a.motion.update(i / 60);
  for (let i = 0; i <= 5; i++) b.motion.update(i / 15);
  skipped.motion.update(1 / 3);
  for (const f of [a, b, skipped]) {
    const weights = [...f.body.morphTargetInfluences], hand = centroid(f.body);
    for (let i = 0; i < 100; i++) f.motion.triggerReaction();
    f.motion.update(1 / 3); assert.deepEqual(f.body.morphTargetInfluences, weights); assert(centroid(f.body).distanceTo(hand) < 1e-12); assert(greeting(f).queued);
  }
  const target = greeting(a).duration * 1.44;
  for (let i = 21; i / 60 < target; i++) a.motion.update(i / 60);
  for (let i = 6; i / 15 < target; i++) b.motion.update(i / 15);
  for (const f of [a, b, skipped]) f.motion.update(target);
  assert.deepEqual(a.body.morphTargetInfluences, b.body.morphTargetInfluences); assert.deepEqual(a.body.morphTargetInfluences, skipped.body.morphTargetInfluences);
  assert(centroid(a.body).distanceTo(centroid(b.body)) < 1e-12); assert(centroid(a.body).distanceTo(centroid(skipped.body)) < 1e-12); assert.equal(greeting(a).stage, 'wave'); assert(centroid(a.body).y > 1.6);
  for (const f of [a, b, skipped]) { f.motion.update(greeting(f).duration * 2.1); assert(f.body.morphTargetInfluences.every(w => w === 0)); f.motion.update(.1); assert.equal(greeting(f).stage, 'idle'); f.motion.dispose(); }
  report.timing = { queueRequestsPerFixture: 100, maximumAdditionalCycles: 1, comparedFrameRates: [15, 60], largeStepEquivalent: true, identicalActualHand: true };
});

test('motion updates only cached transforms and control weights; all native geometry attributes remain static', () => {
  const f = fixture(); const versions = [...Object.values(f.body.geometry.attributes), ...f.body.geometry.morphAttributes.position, ...f.body.geometry.morphAttributes.normal].map(a => a.version);
  f.body.getVertexPosition = () => { throw new Error('No complete posed-geometry update is permitted per motion frame'); };
  const start = performance.now(); for (let i = 0; i < 10000; i++) { if (i % 400 === 0) f.motion.triggerReaction(); f.motion.update(i / 60); }
  const meanMs = (performance.now() - start) / 10000;
  assert(meanMs < 2.2); assert.deepEqual([...Object.values(f.body.geometry.attributes), ...f.body.geometry.morphAttributes.position, ...f.body.geometry.morphAttributes.normal].map(a => a.version), versions);
  report.cachedMotionUpdate = { samples: 10000, meanMs, completeVertexQueries: 0, attributeVersionChanges: 0 }; f.motion.dispose();
});
nodeTest.after(async () => {
  report.status = report.testResults.every(row => row.status === 'PASS') ? 'PASS' : 'FAIL';
  report.limits = ['CPU uses exact source GLB triangles; image decode alone is replaced.', 'Source study remains neutral; derived static morphs use Mesh.getVertexPosition, rest-coordinate attributes and native Three position/normal/depth paths.',
    'Performance numbers are local isolated CPU measurements; native GPU rendering and visual review are recorded by the separate browser harness.'];
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
});
