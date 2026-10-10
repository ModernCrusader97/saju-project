// Real instanced matrices and actual approved GLB; no alternate body geometry.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { build } from 'esbuild';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const output = path.resolve(process.env.SAJU_DEW_CPU_OUTPUT || 'outputs/surface-dew-coalescence/cpu');
fs.mkdirSync(output, { recursive: true });
await build({ stdin: { contents: `export {createSurfaceSlidingDew} from './lib/planet/surface-sliding-dew';
export {isSurfaceAttachmentExcluded} from './lib/planet/surface-attachment-exclusions';
export {createApprovedSpiritMotion} from './lib/planet/approved-spirit-motion';`, resolveDir: process.cwd() },
  outfile: path.join(output, 'runtime.mjs'), bundle: true, platform: 'node', format: 'esm', packages: 'external' });
const { createSurfaceSlidingDew, isSurfaceAttachmentExcluded, createApprovedSpiritMotion } = await import(pathToFileURL(path.join(output, 'runtime.mjs')).href);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceBytes = fs.readFileSync('public/spirits/jade-v002/body.glb');
assert.equal(sha(sourceBytes), '0e339d90253c8bbf6a865210f39d200ec3b5c042bcddb7ce669cea5c75c37b84');
const rigBytes = fs.readFileSync('public/spirits/jade-rig-v001/body.glb');
const gltf = await new GLTFLoader().register(() => ({ name: 'CPU_IMAGE_IO', loadTexture: async () => new THREE.Texture() }))
  .parseAsync(rigBytes.buffer.slice(rigBytes.byteOffset, rigBytes.byteOffset + rigBytes.byteLength), '');
const model = gltf.scene; model.position.x = -.42; model.scale.z = 1.35;
let body; model.traverse(o => { if (o.isMesh && o.geometry.getAttribute('position')?.count === 33207) body = o; });
assert(body); body.morphTargetInfluences.fill(0);
const motionRoot = new THREE.Group(); for (const child of [...model.children]) motionRoot.add(child); model.add(motionRoot);
const root = new THREE.Group(); root.add(model); root.updateMatrixWorld(true);
const attributes = () => Object.fromEntries(['position', 'normal', 'uv', 'index'].map(name => {
  const a = name === 'index' ? body.geometry.index.array : body.geometry.getAttribute(name).array;
  return [name, sha(Buffer.from(a.buffer, a.byteOffset, a.byteLength))];
}));
const originalAttributes = attributes();
const report = { sourceSHA256: sha(sourceBytes), sourceHashes: Object.fromEntries(['lib/planet/surface-sliding-dew.ts',
  'lib/planet/surface-attachment-exclusions.ts'].map(f => [f, sha(fs.readFileSync(f))])), tests: [], measurements: {},
  limitations: ['CPU geometry/matrix checks; timings are host measurements, not physical GPU FPS.'] };
function fixture(quality = 'high') {
  const source = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, 14, 14), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const parent = new THREE.Group(); parent.add(source);
  const effect = createSurfaceSlidingDew({ meshes: [source], detailScale: .5, quality }); parent.add(effect.group);
  parent.updateMatrixWorld(true); effect.update(0);
  const mesh = effect.group.children.find(o => o.isInstancedMesh); assert(mesh);
  return { source, parent, effect, mesh, dispose() { effect.dispose(); source.geometry.dispose(); source.material.dispose(); } };
}
function worldMatrix(f, index) { const m = new THREE.Matrix4(); f.mesh.getMatrixAt(index, m); f.parent.updateMatrixWorld(true); return m.premultiply(f.mesh.matrixWorld); }
function volume(f, index) { return Math.abs(worldMatrix(f, index).determinant()); }
function frame(f) {
  assert.equal(f.effect.group.userData.surfaceDew.coalescence, true, 'The feature must merge actual nearby drops.');
  const state = f.effect.group.userData.surfaceDewFrame;
  assert(state && Array.isArray(state.pairs), 'Live lifecycle diagnostics must identify the actual rendered pool.');
  return state;
}
const recorded = name => report.tests.push(name);

test('near drops transfer volume and become one larger rendered bead', () => {
  const f = fixture(); const info = frame(f); const p = info.pairs[0];
  const samples = [];
  for (const age of [.30, .43, .47, .53, .60]) {
    f.effect.update((age - p.phaseOffset) * p.period);
    const live = frame(f).pairs[0], sum = volume(f, 0) + volume(f, 1);
    assert(Math.abs(sum - live.referenceVolume) < 2e-10, `Rendered pair volume conserved at ${age}: ${sum}/${live.referenceVolume}`);
    if (live.mergeFraction > 0) assert(live.contactDistance <= live.contactLimit + 1e-8, 'Only touching same-route beads transfer volume.');
    samples.push({ age, sum, mergeFraction: live.mergeFraction, a: volume(f, 0), b: volume(f, 1) });
  }
  assert(samples[0].b > 0); assert.equal(samples.at(-1).b, 0);
  assert(samples.at(-1).a > samples[0].a);
  f.dispose(); report.measurements.volumeTransfer = samples; recorded('near-contact-and-volume-conservation');
});

test('threshold drop detaches and keeps its world launch while the body moves', () => {
  const f = fixture(); const pairs = frame(f).pairs;
  const index = pairs.findIndex(p => p.canDetach); assert(index >= 0, 'Some merged beads exceed the explicit detachment threshold.');
  const p = pairs[index], launchTime = (.66 - p.phaseOffset) * p.period;
  f.effect.update(launchTime); const launch = worldMatrix(f, index * 2); const a = new THREE.Vector3().setFromMatrixPosition(launch);
  f.parent.position.set(.7, .4, -.3); f.parent.rotation.set(.2, -.5, .13); f.parent.scale.set(.8, 1.2, 1.1);
  f.effect.update(launchTime + .15); const b = new THREE.Vector3().setFromMatrixPosition(worldMatrix(f, index * 2));
  const live = frame(f).pairs[index]; assert.equal(live.state, 'fall');
  const wanted = a.clone().addScaledVector(new THREE.Vector3(...live.launchVelocity), .15)
    .add(new THREE.Vector3(0, -.5 * live.gravity * .15 ** 2, 0));
  assert(b.distanceTo(wanted) < 2e-6, 'Flight must not inherit later body translation, rotation or scale.');
  assert(b.y < a.y, 'The world vertical component falls downward.');
  assert(Math.abs(volume(f, index * 2) - live.referenceVolume) < 2e-11, 'Frozen world volume must also remain independent of later body scale.');
  f.dispose(); report.measurements.detachedWorldError = b.distanceTo(wanted); recorded('world-flight-independent-of-body');
});

test('round released bead starts outside its tilted source plane', () => {
  const f = fixture(); f.source.rotation.x = Math.PI / 6; f.parent.updateMatrixWorld(true);
  const index = frame(f).pairs.findIndex(p => p.canDetach), p = frame(f).pairs[index];
  const time = (1 + .66 - p.phaseOffset) * p.period; f.effect.update(time);
  assert.equal(frame(f).pairs[index].slots[0], 'fall');
  const m = worldMatrix(f, index * 2), center = new THREE.Vector3().setFromMatrixPosition(m);
  const normal = new THREE.Vector3(0, 0, 1).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(f.source.matrixWorld));
  const origin = new THREE.Vector3().applyMatrix4(f.source.matrixWorld);
  const support = Math.sqrt([0, 1, 2].reduce((sum, axis) => sum + new THREE.Vector3().setFromMatrixColumn(m, axis).dot(normal) ** 2, 0));
  const clearance = center.clone().sub(origin).dot(normal) - support;
  assert(clearance >= -1e-7, 'Rounding at release must not bury the bead in the real source plane: ' + clearance);
  f.source.rotation.x = -Math.PI / 6; f.parent.updateMatrixWorld(true);
  f.effect.update((2 + .66 - p.phaseOffset) * p.period);
  assert.notEqual(frame(f).pairs[index].slots[0], 'fall', 'Upward-facing launch planes keep large beads attached instead of launching back into the body.');
  f.dispose(); report.measurements.releasePlaneClearance = clearance; recorded('released-shape-plane-clearance');
});

test('one bounded draw has deterministic seek, dead slots and new condensation', () => {
  for (const quality of ['low', 'high']) {
    const f = fixture(quality), info = frame(f), limit = quality === 'high' ? 80 : 48;
    assert.equal(f.mesh.count, limit); assert.equal(info.pairs.length, limit / 2);
    assert.equal(f.mesh.castShadow, false); assert.equal(f.mesh.receiveShadow, false);
    assert(f.mesh.material.transmission >= .9);
    const p = info.pairs[0], snapshots = new Map();
    for (const t of [-1.7, 0, 3.21, 9.83, 13.37]) { f.effect.update(t); snapshots.set(t, f.mesh.instanceMatrix.array.slice()); }
    for (const t of [13.37, 3.21, 9.83, -1.7, 0]) { f.effect.update(t); assert.deepEqual(f.mesh.instanceMatrix.array, snapshots.get(t)); }
    f.effect.update((.96 - p.phaseOffset) * p.period); assert.equal(volume(f, 0), 0); assert.equal(volume(f, 1), 0);
    assert.equal(frame(f).pairs[0].state, 'wait', 'Empty slots wait for their next condensation cycle.');
    f.effect.update((1.25 - p.phaseOffset) * p.period); assert(volume(f, 0) > 0 && volume(f, 1) > 0);
    assert(frame(f).pairChecks <= limit / 2, 'At most one distance check per fixed route, no all-pairs search.');
    f.dispose();
  }
  recorded('bounded-pool-seek-and-regrowth');
});

test('sparse surface routes remain distinct instead of duplicating bead pairs', () => {
  const source = new THREE.Mesh(new THREE.PlaneGeometry(2, .0451, 3, 3), new THREE.MeshBasicMaterial());
  const parent = new THREE.Group(); parent.add(source);
  const effect = createSurfaceSlidingDew({ meshes: [source], detailScale: .5, quality: 'high' }); parent.add(effect.group);
  parent.updateMatrixWorld(true); effect.update(0);
  const pairs = effect.group.userData.surfaceDewFrame.pairs;
  assert(pairs.length > 1 && pairs.length < 40, 'The bounded seed pool must exercise its sparse fallback.');
  assert.equal(new Set(pairs).size, pairs.length, 'Each retained route owns distinct slots and launch history.');
  report.measurements.sparseRoutes = { pairs: pairs.length, unique: new Set(pairs).size };
  effect.dispose(); source.geometry.dispose(); source.material.dispose(); recorded('sparse-distinct-route-pool');
});

test('actual B matrices including hidden slots repeat byte-for-byte at one time', () => {
  for (const quality of ['low', 'high']) {
    const effect = createSurfaceSlidingDew({ meshes: [body], quality, allowMorphTargets: true, allowSkinning: true }); motionRoot.add(effect.group);
    const motion = createApprovedSpiritMotion(motionRoot, body, '癸'); motion.update(2.25);
    root.updateMatrixWorld(true); effect.update(2.25);
    const mesh = effect.group.children.find(o => o.isInstancedMesh);
    const first = Buffer.from(new Uint8Array(mesh.instanceMatrix.array.buffer));
    motion.update(2.25); effect.update(2.25);
    assert.deepEqual(Buffer.from(mesh.instanceMatrix.array.buffer), first, 'Frozen launch reuse must not inherit another route quaternion in hidden slots.');
    assert.deepEqual(attributes(), originalAttributes); effect.dispose(); motion.dispose();
  }
  recorded('actual-b-repeated-time-exact-matrices');
});

test('exclusion overlap includes bead radius under transformed fashion masks', () => {
  const owner = new THREE.Group(), group = new THREE.Group(); owner.add(group);
  owner.userData.surfaceAttachmentExclusions = [{ id: 'edge', shape: 'box', min: [-.1, -.1, -.1], max: [.1, .1, .1] }];
  assert.equal(isSurfaceAttachmentExcluded(group, new THREE.Vector3(.14, 0, 0)), false, 'Existing point callers keep their behavior.');
  assert.equal(isSurfaceAttachmentExcluded(group, new THREE.Vector3(.14, 0, 0), .05), true, 'A large merged bead must not intersect the mask boundary.');
  group.scale.set(2, .6, 1.4); group.rotation.z = .3; owner.updateMatrixWorld(true);
  const local = group.worldToLocal(new THREE.Vector3(.14, 0, 0));
  assert.equal(isSurfaceAttachmentExcluded(group, local, .05), true, 'Conservative overlap survives rotated nonuniform transforms.');
  recorded('radius-aware-fashion-overlap');
});

process.on('exit', code => { report.success = code === 0 && report.tests.length === 7;
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n'); });
