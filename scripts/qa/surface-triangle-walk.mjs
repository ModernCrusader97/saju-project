import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const output = path.resolve('outputs/surface-triangle-walk');
await fs.mkdir(output, { recursive: true });
await build({ stdin: { contents: `export * from './lib/planet/surface-triangle-walk';
  export * from './lib/planet/surface-attachment-exclusions';`, resolveDir: process.cwd() },
  outfile: path.join(output, 'runtime.mjs'), bundle: true, platform: 'node', format: 'esm', packages: 'external' });
const { SurfaceTriangleWalker, isSurfaceAttachmentExcluded } = await import(path.join(output, 'runtime.mjs'));
const bytes = await fs.readFile('public/spirits/jade-v002/body.glb');
const gltf = await new GLTFLoader().register(() => ({ name: 'CPU_IMAGE', loadTexture: async () => new THREE.Texture() }))
  .parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), '');
let body; gltf.scene.traverse(o => { if (o.isMesh && o.geometry.getAttribute('position')?.count === 33207) body = o; });
const start = performance.now(), walker = new SurfaceTriangleWalker([body], { allowMorphTargets: true });
const root = new THREE.Group(); root.add(gltf.scene); gltf.scene.scale.z = 1.35;
const local = new THREE.Group();
const records = [];

test('real B: closed welded UV topology and cross-triangle downward paths', () => {
  assert.equal(walker.stats.triangles, 62124);
  assert.equal(walker.stats.boundaryEdges, 0);
  assert.equal(walker.stats.ambiguousEdges, 0);
  for (let i = 0; i < 100; i++) {
    const anchor = walker.sampler.sample(i * 43 + 120);
    const route = walker.path(anchor, { direction: new THREE.Vector3(0, -1, 0), length: .4 });
    let previous = walker.sampler.resolve(route[0], local).position;
    let maxStep = 0;
    for (let k = 0; k <= 50; k++) {
      const a = walker.interpolate(route, k / 50), pose = walker.sampler.resolve(a, local);
      assert(a.barycentric.toArray().every(v => v >= -1e-8 && v <= 1 + 1e-8));
      assert(Math.abs(a.barycentric.x + a.barycentric.y + a.barycentric.z - 1) < 1e-8);
      if (k) { maxStep = Math.max(maxStep, pose.position.distanceTo(previous)); assert(pose.position.y <= previous.y + 2e-6); }
      previous = pose.position;
    }
    assert(maxStep < .012, 'No teleport at a triangle/UV edge');
    const distance = walker.sampler.resolve(route[0], local).position.distanceTo(previous);
    records.push({ anchors: route.length, distance, maxStep });
  }
  assert(records.filter(r => r.anchors > 2).length >= 85);
  assert(records.reduce((s, r) => s + r.distance, 0) / records.length > .25);
});

test('interpolation preserves its target and arc-length endpoint identity', () => {
  const anchor = walker.sampler.sample(120), route = walker.path(anchor, { direction: new THREE.Vector3(0, -1, 0), length: .4 });
  const target = { mesh: body, triangle: anchor.triangle, barycentric: new THREE.Vector3() };
  assert.equal(walker.interpolate(route, .5, target), target);
  assert.deepEqual(walker.interpolate(route, 1).barycentric.toArray(), route.at(-1).barycentric.toArray());
  assert.equal(walker.interpolate(route, 1).triangle, route.at(-1).triangle);
  assert.throws(() => walker.interpolate(route, NaN));
});

test('open boundaries and separate close surfaces stop rather than project to another part', () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, .0001, 1, 0, .0001, 0, 1, .0001], 3));
  const mesh = new THREE.Mesh(geometry), surface = new SurfaceTriangleWalker([mesh]);
  const route = surface.path({ mesh, triangle: 0, barycentric: new THREE.Vector3(.2, .4, .4) }, { direction: new THREE.Vector3(1, 1, 0), length: 2 });
  assert(route.every(a => a.triangle === 0));
  assert.equal(route.length, 2); assert.equal(surface.stats.boundaryEdges, 6);
  geometry.dispose(); mesh.material.dispose();
});

test('explicit wave support follows actual preserved posed vertices and geometric normals', () => {
  let anchor;
  const morph = body.geometry.morphAttributes.position[0], index = body.geometry.index;
  for (let face = 0; face < index.count / 3; face++) {
    const id = index.getX(face * 3), delta = new THREE.Vector3().fromBufferAttribute(morph, id);
    if (delta.length() > .3) { anchor = { mesh: body, triangle: face, barycentric: new THREE.Vector3(.3, .4, .3) }; break; }
  }
  assert(anchor);
  const before = walker.sampler.resolve(anchor, local).position.clone(); body.morphTargetInfluences[0] = .65;
  const pose = walker.sampler.resolve(anchor, local), vertices = [0, 1, 2].map(j => body.getVertexPosition(index.getX(anchor.triangle * 3 + j), new THREE.Vector3()));
  const expected = vertices[0].clone().multiplyScalar(.3).addScaledVector(vertices[1], .4).addScaledVector(vertices[2], .3).applyMatrix4(body.matrixWorld);
  assert(pose.position.distanceTo(expected) < 1e-8); assert(pose.position.distanceTo(before) > .15);
  const normal = new THREE.Triangle(...vertices).getNormal(new THREE.Vector3()).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(body.matrixWorld));
  assert(pose.normal.dot(normal) > .999999);
  assert.throws(() => new SurfaceTriangleWalker([body]), /neutral/);
  body.morphTargetInfluences[0] = 0;
});

test('accessory exclusions use local model regions and exact stable clear/restore', () => {
  const model = new THREE.Group(), effects = new THREE.Group(); model.add(effects);
  model.rotation.set(.2, .8, -.1); model.scale.set(1.2, .9, 1.35); effects.position.set(.1, .2, 0);
  model.userData.surfaceAttachmentExclusions = [{ id: 'hat', shape: 'box', min: [0, 1, 0], max: [.5, 2, .5] }];
  const inside = new THREE.Vector3(.2, 1.2, .1), outside = new THREE.Vector3(-.8, .5, 0);
  assert(isSurfaceAttachmentExcluded(effects, inside)); assert(!isSurfaceAttachmentExcluded(effects, outside));
  model.userData.surfaceAttachmentExclusions = [];
  assert(!isSurfaceAttachmentExcluded(effects, inside));
  model.userData.surfaceAttachmentExclusions = [{ id: 'mask', shape: 'sphere', center: [.3, 1.4, .1], radius: .12 }];
  assert(isSurfaceAttachmentExcluded(effects, inside));
  delete model.userData.surfaceAttachmentExclusions; assert(!isSurfaceAttachmentExcluded(effects, inside));
});

test('write actual B topology/path evidence', async () => {
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ stats: walker.stats,
    elapsedMs: performance.now() - start, paths: records.length, averageTravel: records.reduce((s, r) => s + r.distance, 0) / records.length,
    maxInterpolationStep: Math.max(...records.map(r => r.maxStep)), actualGLB: true, records }, null, 2) + '\n');
});
