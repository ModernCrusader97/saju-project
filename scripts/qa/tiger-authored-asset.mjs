// CPU checks decode the shipped authored tiger GLB, not a primitive fixture.
// Run: node --test scripts/qa/tiger-authored-asset.mjs
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const require = createRequire(import.meta.url), { createLoader } = require('./load-ts.cjs');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(await fs.readFile('public/models/zodiac-pets/manifest.json', 'utf8'));
const bytes = await fs.readFile(`public/models/zodiac-pets/${manifest.pets.인.file}`);
const source = JSON.parse(await fs.readFile(manifest.pets.인.recipe, 'utf8'));
const jsonLength = bytes.readUInt32LE(12), document = JSON.parse(bytes.subarray(20, 20 + jsonLength));
const base = 'ee6e9740054394b0bee30563f35e957b49adf4bb';

const parsed = [], mixers = [];
class RecordedAnimationMixer extends THREE.AnimationMixer {
  constructor(root) { super(root); this.stops = 0; this.uncaches = 0; this.seeks = 0; mixers.push(this); }
  setTime(time) { this.seeks++; return super.setTime(time); }
  stopAllAction() { this.stops++; return super.stopAllAction(); }
  uncacheRoot(root) { this.uncaches++; return super.uncacheRoot(root); }
}
class RecordedGLTFLoader extends GLTFLoader {
  constructor() {
    super();
    // Node has no image decoder. Only decoding is replaced; the embedded PNG
    // bytes are checked separately, and browser QA loads its actual pixels.
    this.register(() => ({ name: 'tiger_qa_cpu_image', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
  }
  async parseAsync(buffer, path) {
    const gltf = await super.parseAsync(buffer, path), resources = new Map();
    gltf.scene.traverse(object => {
      const list = [object.geometry, ...(Array.isArray(object.material) ? object.material : [object.material])].filter(Boolean);
      for (const material of Array.isArray(object.material) ? object.material : object.material ? [object.material] : []) {
        for (const value of Object.values(material)) if (value?.isTexture) list.push(value);
      }
      for (const resource of list) if (!resources.has(resource)) {
        const row = { disposals: 0 }; resource.addEventListener('dispose', () => row.disposals++); resources.set(resource, row);
      }
    });
    parsed.push({ gltf, resources }); return gltf;
  }
}

function apiFor() {
  const loader = createLoader({
    three: { ...THREE, AnimationMixer: RecordedAnimationMixer }, 'three/addons/loaders/GLTFLoader.js': { GLTFLoader: RecordedGLTFLoader },
    '../../public/models/zodiac-pets/manifest.json': manifest,
  }, { AbortController, DOMException, crypto: webcrypto, Number, Set, Object, Promise, fetch: async () => new Response(bytes) });
  return loader.load('lib/planet/spirit-zodiac-pet.ts');
}

function sourcePose(pet) {
  pet.group.updateMatrixWorld(true);
  const pose = [];
  pet.group.traverse(object => { if (object.isBone) pose.push({ name: object.name, position: object.position.toArray(), quaternion: object.quaternion.toArray(), scale: object.scale.toArray() }); });
  return pose;
}

function bodyPoints(body, indices) {
  body.updateWorldMatrix(true, false); body.skeleton.update();
  return indices.map(index => body.getVertexPosition(index, new THREE.Vector3()).applyMatrix4(body.matrixWorld));
}

test('new candidate native source, regenerator and GLB have recorded provenance and no external asset dependencies', async () => {
  assert.equal(manifest.pets.인.authorship, 'new-reconstruction');
  assert.equal(manifest.pets.인.originalSourceStatus, 'missing-source');
  assert.equal(manifest.pets.인.latestApprovedStatus, 'new-candidate-unapproved');
  assert.equal(manifest.recoveredOriginalAnimals, 0); assert.equal(manifest.reconstructedAnimals, 1);
  assert.equal(sha(bytes), manifest.pets.인.sha256); assert.equal(sha(bytes), source.runtime.sha256);
  const native = await fs.readFile(source.source.file), generator = await fs.readFile(source.generator.file);
  assert.equal(native.subarray(0, 7).toString(), 'BLENDER');
  assert.equal(sha(native), source.source.sha256); assert.equal(sha(generator), source.generator.sha256);
  assert.deepEqual(source.externalAssets, []);
  assert.equal(document.images.length, 1); assert.equal(document.textures.length, 1);
  assert(document.images.every(image => !image.uri && Number.isInteger(image.bufferView)), 'original coat PNG is embedded in the GLB');
  const view = document.bufferViews[document.images[0].bufferView];
  const binary = bytes.subarray(20 + jsonLength + 8), embeddedPNG = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
  const originalPNG = await fs.readFile(source.coatTexture.file);
  assert.equal(sha(originalPNG), source.coatTexture.sha256); assert.equal(sha(embeddedPNG), sha(originalPNG));
  assert.equal(originalPNG.readUInt32BE(16), 2048); assert.equal(originalPNG.readUInt32BE(20), 2048);
  assert(document.buffers.every(buffer => !buffer.uri), 'runtime GLB is entirely self contained');
  assert(!document.nodes.some(node => /sculpt-seed|Editable_original/.test(node.name ?? '')), 'editable seed shapes never become runtime meshes');
  assert(bytes.length < 2_500_000);
});

test('only tiger manifest changes; eleven animal entries, selected missing hashes and all previous model assets remain exact', async () => {
  const previous = JSON.parse(execFileSync('git', ['show', `${base}:public/models/zodiac-pets/manifest.json`], { encoding: 'utf8' }));
  for (const branch of Object.keys(previous.pets)) if (branch !== '인') assert.deepEqual(manifest.pets[branch], previous.pets[branch]);
  assert.deepEqual(manifest.sourceArchive, previous.sourceArchive);
  const previousAssets = execFileSync('git', ['ls-tree', '-r', '--name-only', base, 'public', 'assets'], { encoding: 'utf8' }).trim().split('\n');
  for (const file of previousAssets) {
    if (file === 'public/models/zodiac-pets/manifest.json') continue;
    const original = execFileSync('git', ['show', `${base}:${file}`], { maxBuffer: 30_000_000 });
    assert.equal(sha(await fs.readFile(file)), sha(original), `previous asset changed: ${file}`);
  }
});

test('actual GLB body is one closed connected surface with original UV coat and no intersecting runtime seed shells', async () => {
  const pet = await apiFor().loadZodiacPet('인');
  assert.equal(pet.group.userData.assetStatus, 'authored-glb');
  const body = pet.group.getObjectByName('Tiger_FusedBody'); assert(body?.isSkinnedMesh);
  const geometry = body.geometry, position = geometry.attributes.position, uv = geometry.attributes.uv;
  assert(uv && uv.count === position.count); assert.equal(geometry.groups.length, 0);
  assert.equal(body.material.metalness, 0); assert(Math.abs(body.material.roughness - .79) < 1e-6); assert(body.material.map);
  assert(position.count > 10000); assert(geometry.index.count / 3 < 33000);
  let triangles = 0; pet.group.traverse(object => { if (object.isMesh) triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3; });
  assert(triangles < 50000);
  const vertices = new Map(), remap = [], edges = new Map(), adjacency = [];
  for (let i = 0; i < position.count; i++) {
    const values = [position.getX(i), position.getY(i), position.getZ(i)]; assert(values.every(Number.isFinite));
    const key = values.map(v => Math.round(v * 1e6)).join(',');
    if (!vertices.has(key)) { vertices.set(key, vertices.size); adjacency.push(new Set()); }
    remap.push(vertices.get(key));
  }
  for (let i = 0; i < geometry.index.count; i += 3) {
    const ids = [0, 1, 2].map(j => remap[geometry.index.getX(i + j)]);
    assert(new Set(ids).size === 3, 'no zero-area triangles after runtime index welding');
    for (let j = 0; j < 3; j++) {
      const a = ids[j], b = ids[(j + 1) % 3], key = a < b ? `${a},${b}` : `${b},${a}`;
      edges.set(key, (edges.get(key) ?? 0) + 1); adjacency[a].add(b); adjacency[b].add(a);
    }
  }
  assert([...edges.values()].every(count => count === 2), 'every welded body edge has exactly two incident triangles');
  const reached = new Set([0]), stack = [0];
  while (stack.length) for (const next of adjacency[stack.pop()]) if (!reached.has(next)) { reached.add(next); stack.push(next); }
  assert.equal(reached.size, vertices.size, 'head, neck, four short limbs, ears and curled tail form one connected body');
  const bounds = new THREE.Box3().setFromObject(pet.group, true), size = bounds.getSize(new THREE.Vector3());
  assert(Math.abs(bounds.min.y) < 1e-7); assert(size.x <= .620001 && size.y <= .660001 && size.z <= .850001);
  pet.group.position.set(1.10, 0, .12);
  const ownerMaxX = .877256453 - .42;
  const petBox = new THREE.Box3().setFromObject(pet.group, true);
  assert(petBox.min.x - ownerMaxX > .30, 'normal pet placement remains separated from the approved B body');
  pet.dispose();
});

test('TigerIdle changes actual skin/head/tail, plants all feet, loops exactly and supports backwards seeking/reset', async () => {
  const pet = await apiFor().loadZodiacPet('인');
  const body = pet.group.getObjectByName('Tiger_FusedBody'), count = body.geometry.attributes.position.count;
  const rest = bodyPoints(body, Array.from({ length: count }, (_, index) => index));
  const feet = rest.flatMap((point, index) => point.y < .075 ? [index] : []);
  const head = rest.flatMap((point, index) => point.y > .43 ? [index] : []).filter((_, index) => index % 50 === 0);
  assert(feet.length > 100); assert(head.length > 30);
  const neutralPose = sourcePose(pet), neutralFeet = bodyPoints(body, feet), neutralHead = bodyPoints(body, head);
  pet.update(1.25); const movingPose = sourcePose(pet), movingFeet = bodyPoints(body, feet), movingHead = bodyPoints(body, head);
  assert.notDeepEqual(movingPose, neutralPose);
  assert(movingFeet.every((point, index) => point.distanceTo(neutralFeet[index]) < 1e-6), 'feet remain rooted during idle');
  assert(movingHead.some((point, index) => point.distanceTo(neutralHead[index]) > .002), 'skinning moves source head vertices');
  pet.update(5); assert.deepEqual(sourcePose(pet), neutralPose);
  pet.update(1001.25); assert.deepEqual(sourcePose(pet), movingPose);
  pet.update(.25); const backwards = sourcePose(pet);
  const independent = await apiFor().loadZodiacPet('인'); independent.update(.25); assert.deepEqual(sourcePose(independent), backwards);
  pet.update(0); assert.deepEqual(sourcePose(pet), neutralPose);
  const sampled = await apiFor().loadZodiacPet('인'); for (let i = 0; i <= 75; i++) sampled.update(i / 60);
  assert.deepEqual(sourcePose(sampled), movingPose, 'absolute clock is independent of frame count');
  pet.dispose(); independent.dispose(); sampled.dispose();
});

test('animated loads own separate resources, stop the mixer and release every parsed resource once', async () => {
  const api = apiFor(), start = parsed.length, mixerStart = mixers.length;
  const first = await api.loadZodiacPet('인'), second = await api.loadZodiacPet('인');
  const rows = parsed.slice(start);
  assert.equal(rows.length, 2);
  assert([...rows[0].resources.keys()].every(resource => !rows[1].resources.has(resource)));
  first.update(1.25); first.dispose(); first.dispose(); first.update(100);
  const owned = mixers[mixerStart];
  assert.equal(owned.stops, 1); assert.equal(owned.uncaches, 1); assert.equal(owned.seeks, 2);
  assert.equal(owned.stats.actions.total, 0); assert.equal(owned.stats.bindings.total, 0);
  assert.equal(mixers[mixerStart + 1].stats.actions.inUse, 1, 'disposing one pet leaves the other idle playing');
  assert([...rows[0].resources.values()].every(row => row.disposals === 1));
  assert([...rows[1].resources.values()].every(row => row.disposals === 0));
  assert.equal(first.group.children.length, 0);
  second.dispose(); assert([...rows[1].resources.values()].every(row => row.disposals === 1));
  assert.equal(mixers[mixerStart + 1].stats.bindings.total, 0);
});
