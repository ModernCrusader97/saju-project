// Actual geometry, matrix, lifecycle and ownership tests. Browser image decoding
// alone is replaced; the approved source GLB is parsed unchanged.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const output = path.resolve('outputs/surface-sliding-dew/cpu');
await fs.mkdir(output, { recursive: true });
const entry = path.join(output, 'runtime.mjs');
const hasSlidingModule = existsSync('lib/planet/surface-sliding-dew.ts');
await build({
  stdin: { contents: hasSlidingModule
    ? `export {createSurfaceSlidingDew} from './lib/planet/surface-sliding-dew';`
    : `import {createSurfaceStemAccents} from './lib/planet/surface-stem-accents';
       export const createSurfaceSlidingDew = options => createSurfaceStemAccents('癸',options);`,
  resolveDir: process.cwd() },
  outfile: entry, bundle: true, platform: 'node', format: 'esm', packages: 'external',
});
const { createSurfaceSlidingDew } = await import(pathToFileURL(entry).href);
const bytes = await fs.readFile('assets/source-reference/saju-b-evolving-light-v002/reference/SaJu_Jade_Approved_Static_Material.glb');
const sourceHash = createHash('sha256').update(bytes).digest('hex');
const loader = new GLTFLoader().register(() => ({ name: 'CPU_IMAGE_IO', loadTexture: async () => new THREE.Texture() }));
const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const model = gltf.scene;
model.position.x = -.42;
model.scale.z = 1.35;
let body;
model.traverse(object => {
  if (object.isMesh && object.geometry.getAttribute('position')?.count === 33207) body = object;
});
assert(body, 'The real approved B body must be present');
body.morphTargetInfluences?.fill(0);
const root = new THREE.Group(); root.add(model);
const attributeHashes = () => Object.fromEntries(['position', 'normal', 'uv', 'index'].map(name => {
  const array = name === 'index' ? body.geometry.index.array : body.geometry.getAttribute(name).array;
  return [name, createHash('sha256').update(Buffer.from(array.buffer, array.byteOffset, array.byteLength)).digest('hex')];
}));
const originalHashes = attributeHashes();
const report = { sourceHash, sourceBytes: bytes.length, implementation: hasSlidingModule ? 'surface-sliding-dew' : 'legacy-condensation', tests: [], measurements: {} };
const record = name => report.tests.push(name);
const beads = effect => {
  const meshes = [];
  effect.group.traverse(object => { if (object.isInstancedMesh) meshes.push(object); });
  assert.equal(meshes.length, 1, 'Dew uses one bounded instanced draw');
  return meshes[0];
};
const matrix = new THREE.Matrix4();
// Attachment assertions apply to surface beads. The new explicitly detached
// pool is separately checked for world gravity, volume and flight ownership.
const attached = (effect, index) => !effect.group.userData.surfaceDewFrame ||
  effect.group.userData.surfaceDewFrame.pairs[Math.floor(index / 2)].slots[index % 2] === 'surface';
function poseAt(mesh, index) {
  mesh.getMatrixAt(index, matrix);
  const world = new THREE.Matrix4().copy(mesh.matrixWorld).multiply(matrix);
  const basis = [0, 1, 2].map(column => new THREE.Vector3().setFromMatrixColumn(world, column));
  return { center: new THREE.Vector3().setFromMatrixPosition(world), basis, visible: Math.max(...basis.map(v => v.length())) > 1e-5 };
}
function planeFixture(quality) {
  const source = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, 14, 14), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const container = new THREE.Group(); container.add(source);
  const effect = createSurfaceSlidingDew({ meshes: [source], detailScale: .5, quality });
  container.add(effect.group); container.updateMatrixWorld(true); effect.update(0);
  return { source, container, effect, mesh: beads(effect), dispose() { effect.dispose(); source.geometry.dispose(); source.material.dispose(); } };
}

test('dew contact actually slides downward rather than changing only bead radius', () => {
  const fixture = planeFixture('low');
  const previous = Array.from({ length: fixture.mesh.count }, (_, i) => poseAt(fixture.mesh, i).center.clone());
  let maximumDownwardMovement = 0;
  for (let time = .25; time <= 20; time += .25) {
    fixture.effect.update(time);
    for (let i = 0; i < fixture.mesh.count; i++) {
      const pose = poseAt(fixture.mesh, i);
      if (pose.visible) maximumDownwardMovement = Math.max(maximumDownwardMovement, previous[i].y - pose.center.y);
    }
  }
  fixture.dispose();
  assert(maximumDownwardMovement > .07, `Required real surface slide > .07; measured ${maximumDownwardMovement}`);
  report.measurements.flatSurfaceSlide = maximumDownwardMovement;
  record('downward-surface-slide');
});

test('attached beads stay outside their actual face plane through growth and travel', () => {
  const fixture = planeFixture('high');
  let minimumClearance = Infinity;
  for (let time = 0; time < 14; time += .17) {
    fixture.effect.update(time);
    for (let i = 0; i < fixture.mesh.count; i++) {
      const pose = poseAt(fixture.mesh, i);
      if (!pose.visible || !attached(fixture.effect, i)) continue;
      const support = Math.sqrt(pose.basis.reduce((sum, v) => sum + v.z * v.z, 0));
      minimumClearance = Math.min(minimumClearance, pose.center.z - support);
      assert(pose.center.x >= -1 - 1e-5 && pose.center.x <= 1 + 1e-5);
      assert(pose.center.y >= -1 - 1e-5 && pose.center.y <= 1 + 1e-5);
    }
  }
  fixture.dispose();
  assert(minimumClearance >= -1e-6, `Bead geometry must not enter the current actual triangle; clearance ${minimumClearance}`);
  report.measurements.minimumPlaneClearance = minimumClearance;
  record('plane-contact-clearance');
});

test('absolute time repeats after reverse seek and reset with a visible death and rebirth', () => {
  const fixture = planeFixture('high');
  const snapshots = new Map();
  for (const time of [-1.7, 0, 3.21, 9.83, 13.37]) {
    fixture.effect.update(time);
    snapshots.set(time, fixture.mesh.instanceMatrix.array.slice());
  }
  for (const time of [13.37, 3.21, 9.83, -1.7, 0]) {
    fixture.effect.update(time);
    assert.deepEqual(fixture.mesh.instanceMatrix.array, snapshots.get(time), `Stable absolute pose at ${time}`);
  }
  const visible = [];
  for (let time = 0; time < 42; time += .12) {
    fixture.effect.update(time);
    visible.push(poseAt(fixture.mesh, 0).visible);
  }
  assert(visible.includes(false), 'A bead must disappear between condensation cycles');
  let births = 0;
  for (let i = 1; i < visible.length; i++) if (!visible[i - 1] && visible[i]) births++;
  assert(births >= 2, `Expected two regrowth events; saw ${births}`);
  fixture.dispose(); report.measurements.rebirthsOver42Seconds = births; record('absolute-time-death-rebirth');
});

test('quality levels have fixed geometry budgets and isolated transparent material', () => {
  const low = planeFixture('low'), high = planeFixture('high');
  assert(low.mesh.count <= 48, 'Low quality budgets at most 48 beads');
  assert(high.mesh.count <= 80, 'High quality budgets at most 80 beads');
  assert(high.mesh.count > low.mesh.count);
  assert(low.mesh.geometry.index.count < high.mesh.geometry.index.count);
  for (const fixture of [low, high]) {
    assert(fixture.mesh.material.isMeshPhysicalMaterial);
    assert(fixture.mesh.material.transmission >= .9);
    assert(fixture.mesh.material.roughness < .1);
    assert.equal(fixture.mesh.castShadow, false, 'Transmissive beads do not cast opaque geometry shadows');
  }
  report.measurements.budgets = { low: low.mesh.count, high: high.mesh.count, lowTrianglesPerBead: low.mesh.geometry.index.count / 3, highTrianglesPerBead: high.mesh.geometry.index.count / 3 };
  low.dispose(); high.dispose(); record('quality-budget-and-material');
});

test('world normal and plane clearance survive paused nested nonuniform rotation', () => {
  const fixture = planeFixture('low');
  fixture.container.position.set(.5, -.3, .2);
  fixture.container.scale.set(.73, 1.28, 1.61);
  fixture.container.rotation.set(.35, -.47, .21);
  fixture.source.rotation.set(.22, .11, -.07);
  fixture.source.scale.set(1.06, .84, 1.27);
  fixture.container.updateMatrixWorld(true);
  const normal = new THREE.Vector3(0, 0, 1).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(fixture.source.matrixWorld));
  const origin = new THREE.Vector3().applyMatrix4(fixture.source.matrixWorld);
  fixture.effect.update(3.7);
  fixture.container.updateMatrixWorld(true);
  let minimumDot = 1, minimumClearance = Infinity;
  for (let i = 0; i < fixture.mesh.count; i++) {
    const pose = poseAt(fixture.mesh, i);
    if (!pose.visible || !attached(fixture.effect, i)) continue;
    minimumDot = Math.min(minimumDot, pose.basis[2].clone().normalize().dot(normal));
    const support = Math.sqrt(pose.basis.reduce((sum, v) => sum + Math.pow(v.dot(normal), 2), 0));
    minimumClearance = Math.min(minimumClearance, pose.center.clone().sub(origin).dot(normal) - support);
  }
  fixture.effect.update(3.7);
  assert(minimumDot > .99999, `Flattened axis must point along world normal: ${minimumDot}`);
  assert(minimumClearance >= -1e-6, `Nested transformed clearance: ${minimumClearance}`);
  fixture.dispose(); report.measurements.nonuniformNormalDot = minimumDot; report.measurements.nonuniformClearance = minimumClearance; record('paused-rotation-nonuniform-binding');
});

test('local accessory masking hides nearby beads and restores the same identities exactly', () => {
  const fixture = planeFixture('high');
  fixture.effect.update(3.7);
  const initial = fixture.mesh.instanceMatrix.array.slice();
  let selected = -1;
  for (let index = 0; index < fixture.mesh.count; index++) if (poseAt(fixture.mesh, index).visible) { selected = index; break; }
  assert(selected >= 0);
  const center = poseAt(fixture.mesh, selected).center;
  fixture.container.userData.surfaceAttachmentExclusions = [{ id: 'qa-local-glasses', shape: 'box',
    min: [center.x - .025, center.y - .025, -.05], max: [center.x + .025, center.y + .025, .05] }];
  fixture.effect.update(3.7);
  assert.equal(poseAt(fixture.mesh, selected).visible, false);
  let hiddenCount = 0, unchangedCount = 0;
  for (let index = 0; index < fixture.mesh.count; index++) {
    const before = initial.slice(index * 16, index * 16 + 16);
    const after = fixture.mesh.instanceMatrix.array.slice(index * 16, index * 16 + 16);
    if (before.every((value, offset) => value === after[offset])) unchangedCount++;
    else { hiddenCount++; assert.equal(poseAt(fixture.mesh, index).visible, false); }
  }
  assert(hiddenCount > 0 && hiddenCount < 6, `Only the small accessory region changes (${hiddenCount})`);
  assert(unchangedCount > fixture.mesh.count - 6);
  fixture.container.userData.surfaceAttachmentExclusions = [];
  fixture.effect.update(3.7);
  assert.deepEqual(fixture.mesh.instanceMatrix.array, initial, 'Unequipping restores every original bead identity and pose');
  fixture.dispose(); report.measurements.localMask = { hiddenCount, unchangedCount }; record('local-mask-stable-restoration');
});

test('real approved GLB shows cross-triangle contact travel and preserves source attributes', () => {
  root.rotation.set(0, 0, 0); root.scale.set(1, 1, 1); model.rotation.set(0, 0, 0); root.updateMatrixWorld(true);
  const effect = createSurfaceSlidingDew({ meshes: [body], quality: 'high' }); model.add(effect.group);
  effect.update(0); root.updateMatrixWorld(true);
  const mesh = beads(effect);
  const originalMaterial = body.material;
  const rayMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }); body.material = rayMaterial;
  const ray = new THREE.Raycaster(); ray.near = 0; ray.far = .18;
  const positions = new Map();
  let contactCount = 0, maxTravel = 0, crossedTriangles = 0, minNormalDot = 1, minClearance = Infinity;
  for (const time of [.0, .9, 1.8, 2.7, 3.6, 4.5, 5.4, 6.3, 7.2]) {
    effect.update(time); root.updateMatrixWorld(true);
    for (let index = 0; index < Math.min(16, mesh.count); index++) {
      const pose = poseAt(mesh, index);
      if (!pose.visible || !attached(effect, index)) continue;
      ray.set(pose.center, pose.basis[2].clone().normalize().negate());
      const hit = ray.intersectObject(body, false)[0];
      assert(hit, `Every visible bead must be just outside an actual B triangle: t=${time} slot=${index}`);
      const normal = hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(body.matrixWorld));
      const support = Math.sqrt(pose.basis.reduce((sum, v) => sum + Math.pow(v.dot(normal), 2), 0));
      minNormalDot = Math.min(minNormalDot, pose.basis[2].clone().normalize().dot(normal));
      minClearance = Math.min(minClearance, pose.center.clone().sub(hit.point).dot(normal) - support);
      const previous = positions.get(index);
      if (previous) {
        maxTravel = Math.max(maxTravel, previous.point.distanceTo(hit.point));
        if (previous.triangle !== hit.faceIndex && previous.point.distanceTo(hit.point) > .008) crossedTriangles++;
      }
      positions.set(index, { point: hit.point.clone(), triangle: hit.faceIndex }); contactCount++;
    }
  }
  body.material = originalMaterial; rayMaterial.dispose(); effect.dispose();
  report.measurements.approvedBody = { contactCount, maxTravel, crossedTriangles, minNormalDot, minClearance, attributeHashes: originalHashes };
  assert(contactCount > 60, `Actual source contact samples: ${contactCount}`);
  assert(maxTravel > .05, `Actual B surface travel must be visible: ${maxTravel}`);
  assert(crossedTriangles > 8, `Must cross real triangles: ${crossedTriangles}`);
  assert(minNormalDot > .99, `Actual B bead normal follows its face: ${minNormalDot}`);
  assert(minClearance >= -2e-5, `Actual B face clearance: ${minClearance}`);
  assert.deepEqual(attributeHashes(), originalHashes, 'POSITION/NORMAL/UV/index must stay byte identical');
  record('actual-glb-triangle-contact-and-preservation');
});

test('explicit morph opt-in reattaches actual B arm beads to the posed triangles', () => {
  root.rotation.set(.13, -.37, .04); root.scale.set(.89, 1.16, 1.08);
  model.rotation.set(.03, .07, -.02); body.morphTargetInfluences.fill(0); root.updateMatrixWorld(true);
  const effect = createSurfaceSlidingDew({ meshes: [body], quality: 'high', allowMorphTargets: true });
  model.add(effect.group); effect.update(4.25); root.updateMatrixWorld(true);
  const mesh = beads(effect), originalMaterial = body.material;
  const rayMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }); body.material = rayMaterial;
  const initial = Array.from({ length: mesh.count }, (_, index) => poseAt(mesh, index));
  const ray = new THREE.Raycaster(); ray.near = 0; ray.far = .2;
  const inverseBody = new THREE.Matrix4().copy(body.matrixWorld).invert(), restContacts = new Map();
  for (let index = 0; index < mesh.count; index++) {
    const pose = initial[index]; if (!pose.visible || !attached(effect, index)) continue;
    ray.set(pose.center, pose.basis[2].clone().normalize().negate());
    const hit = ray.intersectObject(body, false)[0];
    assert(hit, `Reference bead ${index} has an actual source contact`);
    const vertex = offset => body.getVertexPosition(body.geometry.index.getX(hit.faceIndex * 3 + offset), new THREE.Vector3());
    const triangle = new THREE.Triangle(vertex(0), vertex(1), vertex(2));
    restContacts.set(index, { triangle: hit.faceIndex, barycentric: triangle.getBarycoord(hit.point.clone().applyMatrix4(inverseBody), new THREE.Vector3()), point: hit.point.clone() });
  }
  let maximumMorphMotion = 0, movedArmBeads = 0, minDot = 1, maxBarycentricContactError = 0;
  try {
    body.morphTargetInfluences[0] = .65;
    assert.throws(() => createSurfaceSlidingDew({ meshes: [body], quality: 'low' }), /neutral morphs/);
    effect.update(4.25); root.updateMatrixWorld(true);
    const moved = [];
    for (let index = 0; index < mesh.count; index++) {
      const pose = poseAt(mesh, index);
      if (!pose.visible || !initial[index].visible || !attached(effect, index) || !restContacts.has(index)) continue;
      const displacement = pose.center.distanceTo(initial[index].center);
      maximumMorphMotion = Math.max(maximumMorphMotion, displacement);
      if (displacement > .03) movedArmBeads++;
      moved.push({ index, displacement, pose });
    }
    moved.sort((a, b) => b.displacement - a.displacement);
    for (const { index, pose } of moved) {
      ray.set(pose.center, pose.basis[2].clone().normalize().negate());
      const hit = ray.intersectObject(body, false)[0];
      assert(hit, `Moved arm bead ${index} remains just outside an actual posed triangle`);
      const vertex = offset => body.getVertexPosition(body.geometry.index.getX(hit.faceIndex * 3 + offset), new THREE.Vector3());
      const a = vertex(0), b = vertex(1), c = vertex(2);
      const normal = new THREE.Triangle(a, b, c).getNormal(new THREE.Vector3()).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(body.matrixWorld));
      const support = Math.sqrt(pose.basis.reduce((sum, v) => sum + Math.pow(v.dot(normal), 2), 0));
      minDot = Math.min(minDot, pose.basis[2].clone().normalize().dot(normal));
      assert(pose.center.clone().sub(hit.point).dot(normal) - support > -2e-5);
      const sourceContact = restContacts.get(index), sourceVertex = offset => body.getVertexPosition(body.geometry.index.getX(sourceContact.triangle * 3 + offset), new THREE.Vector3());
      const expected = sourceVertex(0).multiplyScalar(sourceContact.barycentric.x)
        .addScaledVector(sourceVertex(1), sourceContact.barycentric.y).addScaledVector(sourceVertex(2), sourceContact.barycentric.z).applyMatrix4(body.matrixWorld);
      maxBarycentricContactError = Math.max(maxBarycentricContactError, expected.distanceTo(hit.point));
    }
    assert(maximumMorphMotion > .04, `Original preserved wave morph must visibly move attached arm beads: ${maximumMorphMotion}`);
    assert(movedArmBeads >= 1, `Beads actually moved with the source arm: ${movedArmBeads}`);
    assert(maxBarycentricContactError < 2e-5, `Original triangle barycentric coordinates must survive the pose: ${maxBarycentricContactError}`);
    assert(minDot > .99, `Posed face normal alignment: ${minDot}`);
    assert.deepEqual(attributeHashes(), originalHashes);
    body.morphTargetInfluences.fill(0); effect.update(4.25); root.updateMatrixWorld(true);
    for (let index = 0; index < mesh.count; index++) assert(poseAt(mesh, index).center.distanceTo(initial[index].center) < 1e-8);
  } finally {
    body.morphTargetInfluences.fill(0); body.material = originalMaterial; rayMaterial.dispose(); effect.dispose();
    root.rotation.set(0, 0, 0); root.scale.set(1, 1, 1); model.rotation.set(0, 0, 0); root.updateMatrixWorld(true);
  }
  report.measurements.preservedWaveMorph = { weight: .65, maximumMorphMotion, movedArmBeads, minDot, maxBarycentricContactError };
  record('actual-morph-attachment-and-restoration');
});

test('actual GLB full cycles remain continuous with bounded quality update work', () => {
  const measurements = {};
  for (const quality of ['low', 'high']) {
    const constructionStart = performance.now();
    const effect = createSurfaceSlidingDew({ meshes: [body], quality, allowMorphTargets: true });
    const constructionMs = performance.now() - constructionStart;
    model.add(effect.group); root.updateMatrixWorld(true);
    const mesh = beads(effect), previous = [], scratch = new THREE.Vector3(), costs = [];
    let maximumVisibleStep = 0;
    for (let frame = 0; frame < 480; frame++) {
      const start = performance.now(); effect.update(frame / 30); costs.push(performance.now() - start);
      const array = mesh.instanceMatrix.array;
      for (let index = 0; index < mesh.count; index++) {
        const offset = index * 16;
        for (let component = 0; component < 16; component++) assert(Number.isFinite(array[offset + component]));
        const visible = Math.hypot(array[offset], array[offset + 1], array[offset + 2]) > 1e-5;
        scratch.set(array[offset + 12], array[offset + 13], array[offset + 14]).applyMatrix4(mesh.matrixWorld);
        if (visible && previous[index]?.visible) maximumVisibleStep = Math.max(maximumVisibleStep, scratch.distanceTo(previous[index].position));
        if (!previous[index]) previous[index] = { visible, position: scratch.clone() };
        else { previous[index].visible = visible; previous[index].position.copy(scratch); }
      }
    }
    costs.sort((a, b) => a - b);
    assert(maximumVisibleStep < .04, `Visible ${quality} beads must not jump across disconnected parts: ${maximumVisibleStep}`);
    measurements[quality] = { beads: mesh.count, frames: 480, seconds: 16, constructionMs,
      meanUpdateMs: costs.reduce((sum, ms) => sum + ms, 0) / costs.length,
      p95UpdateMs: costs[Math.floor(costs.length * .95)], maximumVisibleStep };
    effect.dispose();
  }
  report.measurements.cpuUpdateBudget = measurements; record('full-cycle-continuity-and-cpu-budget');
});

test('disposal releases only owned instance buffers geometry material exactly once', () => {
  const fixture = planeFixture('low');
  const owned = [fixture.mesh, fixture.mesh.geometry, fixture.mesh.material];
  const counts = owned.map(() => 0);
  owned.forEach((resource, index) => resource.addEventListener('dispose', () => counts[index]++));
  let sourceDisposed = 0; fixture.source.geometry.addEventListener('dispose', () => sourceDisposed++);
  const previous = fixture.mesh.instanceMatrix.array.slice();
  fixture.effect.dispose(); fixture.effect.dispose(); fixture.effect.update(20);
  assert.deepEqual(counts, [1, 1, 1]);
  assert.equal(sourceDisposed, 0);
  assert.equal(fixture.effect.group.children.length, 0);
  assert.equal(fixture.effect.group.parent, null);
  assert.deepEqual(fixture.mesh.instanceMatrix.array, previous, 'Released effects stop updating');
  fixture.source.geometry.dispose(); fixture.source.material.dispose(); record('idempotent-owned-disposal');
});

test('unsupported deformation and nonfinite values fail without changing the source', () => {
  const fixture = planeFixture('low');
  assert.throws(() => fixture.effect.update(NaN), /finite/);
  assert.throws(() => fixture.effect.update(Infinity), /finite/);
  assert.throws(() => createSurfaceSlidingDew({ meshes: [fixture.source], detailScale: 0 }), /positive/);
  const skinned = new THREE.SkinnedMesh(fixture.source.geometry, fixture.source.material);
  assert.throws(() => createSurfaceSlidingDew({ meshes: [skinned] }), /[Rr]igid/);
  fixture.dispose(); record('invalid-inputs');
});

process.on('exit', () => {
  // A failing run remains a failing run; no fabricated success marker.
  report.success = report.tests.length === 11;
  writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
});
