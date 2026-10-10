// Run with: node --test scripts/qa/zodiac-pet-loader.mjs
// Authored animal sources are unavailable. The GLB below is an explicitly
// synthetic loader fixture; it is never shipped or described as a zodiac asset.
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const require = createRequire(import.meta.url);
const { createLoader } = require('./load-ts.cjs');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const branches = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
const animals = ['rat', 'ox', 'tiger', 'rabbit', 'dragon', 'snake', 'horse', 'sheep', 'monkey', 'rooster', 'dog', 'pig'];
const missingHashes = {
  진: '2745a970701c86a3bc74eb0008b597607022a5c7ee576d79b287970ac977d366',
  해: 'd1c6f8625b5fb97cdbde102455cdbf181f335942b7cb0f87aeb07a7fc0fba290',
};
const missingManifest = {
  sourceArchive: { commit: '956fe6e2a7f3de3a0aabe3c59d9d5db3795c7123' },
  pets: Object.fromEntries(branches.map((branch, index) => [branch, {
    branch, animal: animals[index], sourceStatus: 'missing-source', file: null, version: null,
    sha256: null, expectedSha256: missingHashes[branch] ?? null,
    latestApprovedStatus: missingHashes[branch] ? 'missing' : 'unverified',
  }])),
};

function fixtureGLB() {
  const positions = new Float32Array([-1, 0, -.5, 1, 0, -.5, 0, 2, -.5, 0, 1, .5]);
  const indices = new Uint16Array([0, 2, 1, 0, 3, 2, 1, 2, 3, 0, 1, 3]);
  const binary = Buffer.concat([Buffer.from(positions.buffer), Buffer.from(indices.buffer)]);
  const document = {
    asset: { version: '2.0', generator: 'explicit-synthetic-zodiac-loader-test' },
    scene: 0, scenes: [{ nodes: [0] }],
    nodes: [{ name: 'fixture-source-pose', mesh: 0, translation: [3, -2, 5], scale: [1, 2, 1] }],
    meshes: [{ name: 'fixture-original-mesh', primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
    materials: [{ name: 'fixture-original-material', pbrMetallicRoughness: {
      baseColorFactor: [.125, .375, .625, 1], roughnessFactor: .23, metallicFactor: .64,
      baseColorTexture: { index: 0 },
    }, emissiveFactor: [.01, .02, .03], emissiveTexture: { index: 0 } }],
    textures: [{ source: 0 }], images: [{ uri: 'data:image/png;base64,iVBORw0KGgo=' }],
    buffers: [{ byteLength: binary.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positions.byteLength },
      { buffer: 0, byteOffset: positions.byteLength, byteLength: indices.byteLength }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 4, type: 'VEC3', min: [-1, 0, -.5], max: [1, 2, .5] },
      { bufferView: 1, componentType: 5123, count: indices.length, type: 'SCALAR' }],
  };
  const json = Buffer.from(JSON.stringify(document));
  const paddedJSON = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]);
  const result = Buffer.alloc(12 + 8 + paddedJSON.length + 8 + binary.length);
  result.write('glTF'); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(paddedJSON.length, 12); result.writeUInt32LE(0x4e4f534a, 16); paddedJSON.copy(result, 20);
  const offset = 20 + paddedJSON.length;
  result.writeUInt32LE(binary.length, offset); result.writeUInt32LE(0x004e4942, offset + 4); binary.copy(result, offset + 8);
  return result;
}

const fixture = fixtureGLB();
function recordedResources(root) {
  const all = new Set();
  root.traverse(object => {
    if (object.geometry) all.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : object.material ? [object.material] : []) {
      all.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) all.add(value);
    }
  });
  return [...all].map(resource => {
    const row = { resource, disposals: 0 };
    resource.addEventListener('dispose', () => row.disposals++);
    return row;
  });
}

function apiFor({ available = false, expectedSha = sha(fixture), onParse } = {}) {
  const manifest = structuredClone(missingManifest), requests = [], parsed = [];
  if (available) Object.assign(manifest.pets.인, {
    sourceStatus: 'available', file: 'fixture-only.glb', version: 'synthetic-test-only', sha256: expectedSha,
  });
  class OwnedCPUImageLoader extends GLTFLoader {
    constructor() {
      super();
      // Only image decoding is replaced. Actual GLTFLoader decodes fixture
      // mesh data, scene transforms and original material properties.
      this.register(() => ({ name: 'zodiac_qa_cpu_image', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
    }
    async parseAsync(bytes, path) {
      const gltf = await super.parseAsync(bytes, path);
      const row = { gltf, resources: recordedResources(gltf.scene) }; parsed.push(row);
      await onParse?.(row);
      return gltf;
    }
  }
  const loader = createLoader({
    three: THREE,
    'three/addons/loaders/GLTFLoader.js': { GLTFLoader: OwnedCPUImageLoader },
    '../../public/models/zodiac-pets/manifest.json': manifest,
  }, {
    AbortController, DOMException, crypto: webcrypto, Number, Set, Object, Promise,
    fetch: async (url, init) => { requests.push({ url, signal: init?.signal }); return new Response(fixture); },
  });
  return { api: loader.load('lib/planet/spirit-zodiac-pet.ts'), requests, parsed, manifest };
}

test('all twelve branches expose missing authored sources without claiming asset approval', async () => {
  const { api, requests } = apiFor();
  assert.equal(typeof api.loadZodiacPet, 'function', 'the application needs an authored pet loading entry point');
  for (const quality of ['high', 'low']) for (const [index, branch] of branches.entries()) {
    const pet = await api.loadZodiacPet(branch, quality);
    assert.equal(pet.group.userData.pillarRole, 'day-branch');
    assert.equal(pet.group.userData.branch, branch);
    assert.equal(pet.group.userData.animal, animals[index]);
    assert.equal(pet.group.userData.assetStatus, 'procedural-placeholder');
    assert.equal(pet.group.userData.authoredAssetStatus, 'missing-source');
    assert.equal(pet.group.userData.authoredVersion, null);
    assert.equal(pet.group.userData.expectedAuthoredSha256, missingHashes[branch] ?? null);
    assert.equal(pet.group.userData.latestApprovedStatus, missingHashes[branch] ? 'missing' : 'unverified');
    const bounds = new THREE.Box3().setFromObject(pet.group, true), size = bounds.getSize(new THREE.Vector3());
    assert(Math.abs(bounds.min.y) < .002); assert(size.x <= .625); assert(size.y <= .665); assert(size.z <= .855);
    pet.dispose();
  }
  assert.equal(requests.length, 0, 'missing entries must never request guessed model URLs');
});

test('procedural fallback owns resources and stops updates after idempotent disposal', () => {
  const { api } = apiFor();
  const pet = api.createZodiacPet('인');
  const resources = recordedResources(pet.group), parent = new THREE.Group(); parent.add(pet.group);
  assert.equal(typeof pet.dispose, 'function', 'every pet instance must expose ownership disposal');
  pet.dispose(); pet.dispose(); pet.update(20);
  assert(resources.length > 0); assert(resources.every(row => row.disposals === 1));
  assert.equal(pet.group.parent, null); assert.equal(pet.group.children.length, 0);
});

test('checksum verified GLB keeps its original pose, geometry and material while fitting the pet bounds', async () => {
  const { api, requests, parsed } = apiFor({ available: true });
  assert.equal(typeof api.loadZodiacPet, 'function');
  const pet = await api.loadZodiacPet('인');
  assert.equal(requests[0].url, '/models/zodiac-pets/fixture-only.glb');
  assert.equal(pet.group.userData.assetStatus, 'authored-glb');
  assert.equal(pet.group.userData.authoredSha256, sha(fixture));
  assert.equal(pet.group.userData.authoredVersion, 'synthetic-test-only');
  assert.equal(pet.group.userData.latestApprovedStatus, 'unverified');
  const node = parsed[0].gltf.scene.getObjectByName('fixture-source-pose');
  assert.deepEqual(node.position.toArray(), [3, -2, 5]); assert.deepEqual(node.scale.toArray(), [1, 2, 1]);
  const mesh = parsed[0].gltf.scene.getObjectByName('fixture-original-mesh') ?? node;
  const drawable = mesh.isMesh ? mesh : mesh.children.find(object => object.isMesh);
  assert(drawable); assert.equal(drawable.material.roughness, .23); assert.equal(drawable.material.metalness, .64);
  assert.deepEqual(drawable.material.color.toArray(), [.125, .375, .625]);
  assert.equal(drawable.geometry.getAttribute('position').count, 4);
  const positionBytes = Buffer.from(drawable.geometry.getAttribute('position').array.buffer);
  const originalHash = sha(positionBytes);
  const bounds = new THREE.Box3().setFromObject(pet.group, true), size = bounds.getSize(new THREE.Vector3());
  assert(Math.abs(bounds.min.y) < 1e-7); assert(Math.abs((bounds.min.x + bounds.max.x) / 2) < 1e-7);
  assert(size.x <= .62); assert(size.y <= .66); assert(size.z <= .85);
  pet.update(40);
  assert.equal(sha(Buffer.from(drawable.geometry.getAttribute('position').array.buffer)), originalHash);
  assert.deepEqual(node.position.toArray(), [3, -2, 5]);
  pet.dispose(); pet.dispose();
  assert(parsed[0].resources.every(row => row.disposals === 1), 'shared texture slots dispose once');
});

test('separate parses have independent owned resources and disposing one cannot damage the other', async () => {
  const { api, parsed } = apiFor({ available: true });
  assert.equal(typeof api.loadZodiacPet, 'function');
  const [first, second] = await Promise.all([api.loadZodiacPet('인'), api.loadZodiacPet('인')]);
  assert.equal(parsed.length, 2);
  const otherResources = new Set(parsed[1].resources.map(row => row.resource));
  assert(parsed[0].resources.every(row => !otherResources.has(row.resource)));
  first.dispose();
  assert(parsed[0].resources.every(row => row.disposals === 1)); assert(parsed[1].resources.every(row => row.disposals === 0));
  second.dispose(); assert(parsed[1].resources.every(row => row.disposals === 1));
});

test('a mismatched GLB hash falls back explicitly before allocating a model', async () => {
  const { api, parsed } = apiFor({ available: true, expectedSha: '0'.repeat(64) });
  assert.equal(typeof api.loadZodiacPet, 'function');
  const pet = await api.loadZodiacPet('인');
  assert.equal(pet.group.userData.assetStatus, 'procedural-placeholder');
  assert.equal(pet.group.userData.authoredAssetStatus, 'load-error');
  assert.match(pet.group.userData.authoredLoadError, /SHA-256/); assert.equal(parsed.length, 0);
  pet.dispose();
});

test('pre-aborted loads reject without creating a fallback or requesting assets', async () => {
  const { api, requests } = apiFor({ available: true });
  assert.equal(typeof api.loadZodiacPet, 'function');
  const controller = new AbortController(); controller.abort();
  await assert.rejects(api.loadZodiacPet('인', 'high', { signal: controller.signal }), error => error.name === 'AbortError');
  assert.equal(requests.length, 0);
});

test('an abort while GLTF parsing completes disposes the late model and never returns a fallback', async () => {
  let release, ready;
  const held = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { ready = resolve; });
  const { api, requests, parsed } = apiFor({ available: true, onParse: async () => { ready(); await held; } });
  assert.equal(typeof api.loadZodiacPet, 'function');
  const controller = new AbortController(), pending = api.loadZodiacPet('인', 'high', { signal: controller.signal });
  await started; controller.abort(); release();
  await assert.rejects(pending, error => error.name === 'AbortError');
  assert.equal(requests[0].signal, controller.signal);
  assert(parsed[0].resources.every(row => row.disposals === 1));
});

test('the shipped manifest records zero recovered animals and both known missing selected hashes', async () => {
  let shipped;
  try { shipped = JSON.parse(await fs.readFile('public/models/zodiac-pets/manifest.json', 'utf8')); }
  catch { assert.fail('publish a truthful zodiac source manifest before integrating a loader'); }
  assert.equal(shipped.sourceArchive.commit, missingManifest.sourceArchive.commit);
  assert.deepEqual(Object.keys(shipped.pets), branches);
  for (const [index, branch] of branches.entries()) {
    assert.equal(shipped.pets[branch].animal, animals[index]);
    assert.equal(shipped.pets[branch].sourceStatus, 'missing-source');
    assert.equal(shipped.pets[branch].file, null); assert.equal(shipped.pets[branch].sha256, null);
    assert.equal(shipped.pets[branch].expectedSha256, missingHashes[branch] ?? null);
  }
});
