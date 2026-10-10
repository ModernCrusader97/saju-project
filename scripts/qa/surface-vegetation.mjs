// Actual original B GLB triangles/transforms; no sphere or approximate body proxy.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createLoader } from './load-ts.cjs';

const output = path.resolve(process.env.SAJU_QA_VEGETATION_OUTPUT || 'outputs/surface-vegetation');
const phase = process.env.SAJU_QA_PHASE || 'after';
const checks = [], observations = [];
const sha = attribute => createHash('sha256').update(Buffer.from(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength)).digest('hex');
const source = await fs.readFile('public/spirits/jade-v002/body.glb');
const textures = [];
const gltf = await new GLTFLoader().register(() => ({ name: 'vegetation_cpu_images', loadTexture() {
  const texture = new THREE.Texture(); textures.push(texture); return Promise.resolve(texture);
} })).parseAsync(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength), '');
const model = gltf.scene, root = new THREE.Group();
model.position.x = -.42; model.scale.z = 1.35; root.add(model);
let body;
model.traverse(object => { if (object.isMesh && object.geometry.getAttribute('position').count === 33207) body = object; });
assert(body); body.morphTargetInfluences.fill(0); root.updateWorldMatrix(true, true);
const original = { position: sha(body.geometry.getAttribute('position')), uv: sha(body.geometry.getAttribute('uv')) };
assert.equal(original.position, 'f7e39c85723b4220d0e69161e4405c3232d514b18be56e8a3854ec6fff48da8b');
const load = createLoader({ three: THREE }).load;
const matrices = effect => effect.group.children.filter(mesh => mesh.isInstancedMesh).map(mesh => Array.from(mesh.instanceMatrix.array));
const instancePosition = (mesh, index, target = new THREE.Vector3()) => {
  const matrix = new THREE.Matrix4(); mesh.getMatrixAt(index, matrix);
  return target.set(0, 0, 0).applyMatrix4(matrix);
};
const faceBox = new THREE.Box3(), inverseBody = body.matrixWorld.clone().invert();
model.traverse(mesh => { if (mesh.isMesh && /almond_gaze|quiet_smile|expressive_brow|small_eye_glint/.test(mesh.name)) {
  mesh.geometry.computeBoundingBox(); faceBox.union(mesh.geometry.boundingBox.clone().applyMatrix4(inverseBody.clone().multiply(mesh.matrixWorld)));
} });
faceBox.expandByScalar(.08);
async function check(name, task) {
  try { await task(); checks.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
  catch (error) { checks.push({ name, status: 'FAIL', error: error.stack }); console.error('FAIL ' + name + ': ' + error.message); }
}
function ownedResources(effect) {
  const resources = new Set();
  effect.group.traverse(mesh => { if (!mesh.isMesh) return; resources.add(mesh.geometry); for (const m of [mesh.material].flat()) resources.add(m); if (mesh.isInstancedMesh) resources.add(mesh); });
  const counts = new Map([...resources].map(resource => [resource, 0]));
  for (const resource of resources) resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1));
  return counts;
}
function maskRestoration(effect, mesh, index) {
  effect.update(7.5); const original = matrices(effect), point = instancePosition(mesh, index);
  const inModel = point.clone().applyMatrix4(effect.group.matrixWorld).applyMatrix4(model.matrixWorld.clone().invert());
  const visible = () => effect.group.children.filter(mesh => mesh.isInstancedMesh).reduce((total, batch) => {
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < batch.count; i++) { batch.getMatrixAt(i, matrix); if (Math.abs(matrix.determinant()) > 1e-14) total++; }
    return total;
  }, 0);
  const originalVisible = visible();
  const regions = [{ id: 'qa-local-accessory', shape: 'sphere', center: inModel.toArray(), radius: .006 },
    { id: 'qa-local-accessory', shape: 'box', min: inModel.clone().addScalar(-.006).toArray(), max: inModel.clone().addScalar(.006).toArray() }];
  for (const region of regions) {
    model.userData.surfaceAttachmentExclusions = [region]; effect.update(7.5);
    assert.notDeepEqual(matrices(effect), original, 'Only covered roots/segments should hide');
    const matrix = new THREE.Matrix4(); mesh.getMatrixAt(index, matrix); assert.equal(matrix.determinant(), 0, 'Covered instance hides by zero scale');
    assert(visible() > 0 && visible() < originalVisible, 'Only a local subset hides');
    if (mesh.name.startsWith('NormalRootedWoodyBranches') && index === 0) {
      const leaves = effect.group.children.find(mesh => mesh.name === 'WoodyBranchTipLeaves');
      const firstAnchor = Number(mesh.name.split('_').at(-1));
      for (let j = 0; j < 3; j++) { leaves.getMatrixAt(firstAnchor * 3 + j, matrix); assert.equal(matrix.determinant(), 0, 'All leaves of a covered branch hide together'); }
    }
    delete model.userData.surfaceAttachmentExclusions;
    effect.update(7.5); assert.deepEqual(matrices(effect), original, 'Unequipping restores identical IDs and matrices');
  }
}
const vertex = (anchor, component, posed = true) => {
  const index = anchor.mesh.geometry.index, id = index ? index.getX(anchor.triangle * 3 + component) : anchor.triangle * 3 + component;
  const point = new THREE.Vector3();
  if (posed) anchor.mesh.getVertexPosition(id, point); else point.fromBufferAttribute(anchor.mesh.geometry.getAttribute('position'), id);
  return point;
};
function anchorPoint(anchor, posed = true) {
  return vertex(anchor, 0, posed).multiplyScalar(anchor.barycentric.x)
    .addScaledVector(vertex(anchor, 1, posed), anchor.barycentric.y).addScaledVector(vertex(anchor, 2, posed), anchor.barycentric.z);
}
function posedPlane(anchor) {
  const points = [0, 1, 2].map(i => vertex(anchor, i).applyMatrix4(anchor.mesh.matrixWorld));
  const normal = new THREE.Triangle(...points).getNormal(new THREE.Vector3());
  return { normal, point: points[0] };
}
function branchGeometryCheck(effect, high) {
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), collision = new THREE.Mesh(body.geometry, material);
  collision.matrixAutoUpdate = false; collision.matrixWorld.copy(body.matrixWorld);
  collision.morphTargetInfluences = body.morphTargetInfluences.slice();
  const ray = new THREE.Raycaster(), crossings = []; let sweeps = 0;
  try {
    for (const batch of effect.group.children.filter(mesh => mesh.name.startsWith('NormalRootedWoodyBranches'))) {
      const p = batch.geometry.getAttribute('position');
      for (let instance = 0; instance < batch.count; instance++) {
        const matrix = new THREE.Matrix4(); batch.getMatrixAt(instance, matrix);
        const world = effect.group.matrixWorld.clone().multiply(matrix); let offset = 0;
        for (const [curve, rows] of [[0, high ? 23 : 17], [1, high ? 13 : 10], [2, high ? 13 : 10]]) {
          const centers = Array.from({ length: rows }, (_, row) => {
            const center = new THREE.Vector3();
            for (let radial = 0; radial < 6; radial++) center.add(new THREE.Vector3().fromBufferAttribute(p, offset + row * 7 + radial));
            return center.multiplyScalar(1 / 6).applyMatrix4(world);
          });
          for (let row = curve ? 0 : 3; row < rows - 1; row++) {
            const delta = centers[row + 1].clone().sub(centers[row]); ray.set(centers[row], delta.clone().normalize()); ray.near = 1e-6; ray.far = delta.length() - 1e-6;
            if (ray.intersectObject(collision, false).length) crossings.push({ batch: batch.name, instance, curve, row }); sweeps++;
          }
          offset += rows * 7;
        }
      }
    }
  } finally { material.dispose(); }
  assert.equal(crossings.length, 0, `Woody curved/fork centerline crosses the actual B body: ${JSON.stringify(crossings.slice(0, 4))}`);
  return { woodyCenterlineSweeps: sweeps, woodyCenterlineCrossings: crossings.length };
}
function vineGeometryCheck(effect) {
  const attachment = effect.group.userData.vineAttachment;
  const segments = effect.group.children.find(mesh => mesh.name === 'ConnectedVineSegments');
  const leaves = effect.group.children.find(mesh => mesh.name === 'ConnectedVineLeaves');
  let minimum = Infinity, maxLeafDistance = 0, visibleSegments = 0;
  const renderedSegments = [];
  for (let i = 0; i < segments.count; i++) {
    const { from, to } = attachment.segmentAnchors[i];
    assert.equal(from.mesh, to.mesh); assert.equal(from.triangle, to.triangle, 'Every nonzero stem segment lies in one real source triangle');
    const local = new THREE.Matrix4(); segments.getMatrixAt(i, local);
    if (Math.abs(local.determinant()) < 1e-14) continue;
    const world = effect.group.matrixWorld.clone().multiply(local), { normal, point } = posedPlane(from);
    const a = new THREE.Vector3(0, -.5, 0).applyMatrix4(world), b = new THREE.Vector3(0, .5, 0).applyMatrix4(world);
    const x = new THREE.Vector3().setFromMatrixColumn(world, 0), z = new THREE.Vector3().setFromMatrixColumn(world, 2);
    const support = Math.hypot(normal.dot(x), normal.dot(z));
    const clearance = Math.min(normal.dot(a.clone().sub(point)), normal.dot(b.clone().sub(point))) - support;
    assert(clearance > -1e-6, `Full vine tube cross-section penetrates its posed body plane by ${-clearance}`);
    minimum = Math.min(minimum, clearance); renderedSegments.push(new THREE.Line3(a, b)); visibleSegments++;
  }
  assert(visibleSegments > 0);
  for (let i = 0; i < leaves.count; i++) {
    const matrix = new THREE.Matrix4(); leaves.getMatrixAt(i, matrix);
    if (Math.abs(matrix.determinant()) < 1e-14) continue;
    const root = instancePosition(leaves, i).applyMatrix4(effect.group.matrixWorld);
    const distance = Math.min(...renderedSegments.map(segment => segment.closestPointToPoint(root, true, new THREE.Vector3()).distanceTo(root)));
    assert(distance < 1e-6, `Leaf root is disconnected from rendered stem by ${distance}`); maxLeafDistance = Math.max(maxLeafDistance, distance);
  }
  return { minimumTubePlaneClearance: minimum, maxRenderedLeafRootDistance: maxLeafDistance, visibleSegments };
}
function checkMorphFollowing(effect, stem) {
  effect.update(7.5); const neutral = matrices(effect);
  const leaves = effect.group.children.find(mesh => mesh.name === (stem === '甲' ? 'WoodyBranchTipLeaves' : 'ConnectedVineLeaves'));
  const leafBefore = Array.from({ length: leaves.count }, (_, i) => instancePosition(leaves, i).applyMatrix4(effect.group.matrixWorld));
  const anchors = stem === '甲' ? effect.group.userData.branchAttachment.anchors : effect.group.userData.vineAttachment.paths.flatMap(path => path.anchors);
  const sourceBefore = anchors.map(anchor => anchorPoint(anchor).applyMatrix4(anchor.mesh.matrixWorld));
  body.morphTargetInfluences[0] = .65; effect.update(7.5);
  const posed = matrices(effect); effect.update(7.5); assert.deepEqual(matrices(effect), posed, 'Paused posed attachment remains stable');
  const sourceTravel = anchors.map((anchor, i) => anchorPoint(anchor).applyMatrix4(anchor.mesh.matrixWorld).distanceTo(sourceBefore[i]));
  const leafTravel = leafBefore.map((point, i) => instancePosition(leaves, i).applyMatrix4(effect.group.matrixWorld).distanceTo(point));
  assert(Math.max(...sourceTravel) > .025, 'Seeded attachment includes a genuinely moving original right-arm triangle');
  assert(Math.max(...leafTravel) > .025, 'Connected leaves move with the original posed right arm');
  assert.notDeepEqual(posed, neutral);
  const result = { maxRightArmAnchorTravel: Math.max(...sourceTravel), maxConnectedLeafTravel: Math.max(...leafTravel) };
  if (stem === '乙') Object.assign(result, vineGeometryCheck(effect));
  body.morphTargetInfluences[0] = 0; effect.update(7.5); assert.deepEqual(matrices(effect), neutral, 'Morph removal restores identical source attachment matrices');
  return result;
}
for (const quality of ['low', 'high']) {
  await check(`甲 ${quality}: original B face is free of woody roots; transforms/time/mask/disposal`, () => {
    const create = load('lib/planet/surface-stem-accents.ts').createSurfaceStemAccents;
    const start = performance.now(), effect = create('甲', { meshes: [body], quality, allowMorphTargets: true });
    const creationMs = performance.now() - start; model.add(effect.group); const resources = ownedResources(effect);
    try {
      effect.update(0);
      const batches = effect.group.children.filter(mesh => mesh.name.startsWith('NormalRootedWoodyBranches'));
      assert(batches.reduce((n, mesh) => n + mesh.count, 0) >= 10);
      for (const mesh of batches) for (let i = 0; i < mesh.count; i++) {
        const point = instancePosition(mesh, i).applyMatrix4(effect.group.matrixWorld).applyMatrix4(body.matrixWorld.clone().invert());
        assert(!faceBox.containsPoint(point), `Woody root covers original B face at ${point.toArray()}`);
      }
      assert(effect.group.children.length <= 5, 'Bounded branch draw calls');
      for (const material of new Set(effect.group.children.map(mesh => mesh.material))) {
        const shader = { vertexShader: '#include <defaultnormal_vertex>', fragmentShader: '', uniforms: {} };
        material.onBeforeCompile(shader, {});
        assert(shader.vertexShader.includes('mat3 cofactors'), 'Installed Three shader chunk receives the affine normal correction');
      }
      assert(effect.diagnostics.budget.drawCalls <= 6); assert(effect.diagnostics.budget.instances < 1200); assert(effect.diagnostics.budget.triangles < 30000);
      const collision = branchGeometryCheck(effect, quality === 'high');
      effect.update(4.25); const fixed = matrices(effect); effect.update(4.25); assert.deepEqual(matrices(effect), fixed);
      effect.update(-2); effect.update(4.25); assert.deepEqual(matrices(effect), fixed, 'Backward absolute-time seek');
      effect.update(0); const initial = matrices(effect); effect.update(15); effect.update(0); assert.deepEqual(matrices(effect), initial);
      root.scale.set(1.2, .9, 1.1); root.rotation.set(.2, .8, -.1); effect.group.scale.set(.8, 1.3, .7); effect.group.rotation.set(.12, -.2, .16);
      effect.update(7.5); assert(effect.group.userData.branchAttachment.minWorldRootNormalDot > .99999);
      assert(matrices(effect).flat(2).every(Number.isFinite));
      maskRestoration(effect, batches.find(mesh => mesh.count), 0);
      body.morphTargetInfluences[0] = .45; effect.update(7.5);
      const waveCrossings = branchGeometryCheck(effect, quality === 'high').woodyCenterlineCrossings;
      body.morphTargetInfluences[0] = 0; effect.update(7.5);
      observations.push({ stem: '甲', quality, branches: effect.diagnostics.anchorCount, drawCalls: effect.group.children.length,
        minWorldRootNormalDot: effect.group.userData.branchAttachment.minWorldRootNormalDot, ...collision,
        transformedWoodyCenterlineCrossings: branchGeometryCheck(effect, quality === 'high').woodyCenterlineCrossings, productionWaveCenterlineCrossings: waveCrossings,
        creationMs, budget: effect.diagnostics.budget, ...checkMorphFollowing(effect, '甲') });
    } finally {
      effect.dispose(); effect.dispose(); effect.update(20);
      for (const count of resources.values()) assert.equal(count, 1, 'Every owned resource disposed exactly once');
      root.scale.set(1, 1, 1); root.rotation.set(0, 0, 0); body.morphTargetInfluences[0] = 0; delete model.userData.surfaceAttachmentExclusions;
    }
  });
  await check(`乙 ${quality}: connected real-triangle crawl with leaves on its actual stem`, () => {
    const create = load('lib/planet/surface-stem-accents.ts').createSurfaceStemAccents;
    const start = performance.now(), effect = create('乙', { meshes: [body], quality, allowMorphTargets: true });
    const creationMs = performance.now() - start; model.add(effect.group); const resources = ownedResources(effect);
    try {
      assert.equal(effect.diagnostics.mode, 'connected-triangle-short-creeping-vines');
      assert(effect.group.children.length <= 3, 'Segments, joints and leaves have bounded batches');
      assert(effect.diagnostics.budget.drawCalls <= 6); assert(effect.diagnostics.budget.instances < 1200); assert(effect.diagnostics.budget.triangles < 30000);
      const attachment = effect.group.userData.vineAttachment;
      assert(attachment.pathCount >= 4); assert(attachment.leafCount >= attachment.pathCount * 3);
      assert(attachment.segmentCount <= (quality === 'low' ? 192 : 384));
      assert(attachment.paths.every(path => path.anchors.every(anchor => anchor.mesh === body)), 'Never jumps between disconnected body parts');
      for (const path of attachment.paths) {
        assert(path.length > 0 && path.length < 1, 'Bounded short crawl, not full body wrapping');
        for (const anchor of path.anchors) {
          assert(Math.abs(anchor.barycentric.x + anchor.barycentric.y + anchor.barycentric.z - 1) < 1e-7);
          assert(anchor.barycentric.toArray().every(n => n >= -1e-8 && n <= 1 + 1e-8));
        }
        for (let i = 1; i < path.anchors.length; i++) {
          const a = path.anchors[i - 1], b = path.anchors[i];
          if (a.triangle !== b.triangle) {
            assert(anchorPoint(a, false).distanceTo(anchorPoint(b, false)) < 1e-7, 'Cross-triangle anchor is the same exact shared-edge point');
            const matches = [0, 1, 2].filter(j => [0, 1, 2].some(k => vertex(a, j, false).distanceTo(vertex(b, k, false)) < 1e-6));
            assert(matches.length >= 2, 'No jump to a merely nearby disconnected triangle');
          }
        }
      }
      effect.update(7.5); const fixed = matrices(effect); effect.update(7.5); assert.deepEqual(matrices(effect), fixed);
      effect.update(-10); effect.update(7.5); assert.deepEqual(matrices(effect), fixed);
      effect.update(0); const initial = matrices(effect); effect.update(33); effect.update(0); assert.deepEqual(matrices(effect), initial);
      root.scale.set(1.2, .9, 1.1); root.rotation.set(.2, .8, -.1); effect.group.scale.set(.8, 1.3, .7); effect.group.rotation.set(.12, -.2, .16);
      effect.update(7.5); assert(matrices(effect).flat(2).every(Number.isFinite));
      assert(effect.group.userData.vineAttachment.maxLeafRootToStemDistance < 1e-7, 'Every leaf emerges from its own visible stem');
      const leaves = effect.group.children.find(mesh => mesh.name === 'ConnectedVineLeaves');
      const active = Array.from({ length: leaves.count }, (_, i) => i).find(i => { const m = new THREE.Matrix4(); leaves.getMatrixAt(i, m); return Math.abs(m.determinant()) > 1e-14; });
      assert(active !== undefined); maskRestoration(effect, leaves, active);
      observations.push({ stem: '乙', quality, paths: attachment.pathCount, leaves: attachment.leafCount, segments: attachment.segmentCount,
        drawCalls: effect.group.children.length, maxLeafRootToStemDistance: effect.group.userData.vineAttachment.maxLeafRootToStemDistance,
        creationMs, budget: effect.diagnostics.budget, ...vineGeometryCheck(effect), ...checkMorphFollowing(effect, '乙') });
    } finally {
      effect.dispose(); effect.dispose(); effect.update(20);
      for (const count of resources.values()) assert.equal(count, 1);
      root.scale.set(1, 1, 1); root.rotation.set(0, 0, 0); body.morphTargetInfluences[0] = 0; delete model.userData.surfaceAttachmentExclusions;
    }
  });
}
assert.equal(sha(body.geometry.getAttribute('position')), original.position); assert.equal(sha(body.geometry.getAttribute('uv')), original.uv);
const resources = new Set(textures);
model.traverse(mesh => { if (mesh.isMesh) { resources.add(mesh.geometry); for (const material of [mesh.material].flat()) resources.add(material); } });
for (const resource of resources) resource.dispose();
await fs.mkdir(output, { recursive: true });
const failed = checks.filter(check => check.status === 'FAIL').length;
await fs.writeFile(path.join(output, `${phase}.json`), JSON.stringify({ status: failed ? 'FAIL' : 'PASS', phase, original, checks, observations,
  limitations: ['Actual original GLB CPU geometry, transforms and opted-in Gentle_wave_pose=.65; texture images are CPU placeholders.', 'Short connected crawls only, not full-body vines.', 'No skinned meshes or physical mobile GPU claim; unrelated body parts have no continuous collision simulation.'] }, null, 2) + '\n');
if (failed) process.exitCode = 1;
console.log(JSON.stringify({ phase, checks: checks.length, failed, observations }));
