// CPU integration against the actual approved GLB. Only browser image/network I/O
// is replaced; geometry, materials, transforms, shaders and effects are real.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const output = path.resolve('outputs/ten-stem-materials/cpu');
await fs.mkdir(output, { recursive: true });
const entry = path.join(output, 'runtime.mjs');
await build({
  stdin: { contents: `export * from './lib/planet/approved-jade-spirit';
    export * from './lib/planet/mesh-surface';
    export * from './lib/planet/character-rest-coordinates';`, resolveDir: process.cwd() },
  outfile: entry, bundle: true, platform: 'node', format: 'esm', packages: 'external',
  plugins: [{ name: 'raw-glsl', setup(builder) {
    builder.onResolve({ filter: /\.glsl\?raw$/ }, args => ({ path: path.resolve(args.resolveDir, args.path.slice(0, -4)), namespace: 'raw-glsl' }));
    builder.onLoad({ filter: /.*/, namespace: 'raw-glsl' }, async args => ({ contents: await fs.readFile(args.path, 'utf8'), loader: 'text' }));
  } }],
});
const { loadApprovedSpirit, MeshSurface, bindCharacterRestCoordinates, CHARACTER_REST_ATTRIBUTES } = await import(pathToFileURL(entry).href);
const bytes = await fs.readFile('public/spirits/jade-v002/body.glb');
const source = await fs.readFile('assets/source-reference/saju-b-evolving-light-v002/reference/SaJu_Jade_Approved_Static_Material.glb');
assert(bytes.equals(source), 'Runtime GLB must exactly match its archived source');
const glb = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const sha = array => createHash('sha256').update(Buffer.from(array.buffer, array.byteOffset, array.byteLength)).digest('hex');
const attributeHashes = geometry => Object.fromEntries(['position', 'normal', 'uv'].map(name => [name, sha(geometry.getAttribute(name).array)]).concat([['index', sha(geometry.index.array)]]));
const loader = new GLTFLoader().register(() => ({
  name: 'CPU_IMAGE_IO',
  loadTexture: async index => {
    const texture = new THREE.Texture();
    texture.name = 'CPU glTF image I/O ' + index;
    return texture;
  },
}));
const parse = () => loader.parseAsync(glb.slice(0), '');
const records = [];
let textureBehavior = 'ok';
const nativeLoad = GLTFLoader.prototype.loadAsync;
const nativeTexture = THREE.TextureLoader.prototype.loadAsync;
function track(resource, label, record) {
  const item = { resource, label, count: 0 };
  resource.addEventListener('dispose', () => { item.count++; });
  record.push(item);
}
GLTFLoader.prototype.loadAsync = async function(url) {
  assert.equal(url, '/spirits/jade-v002/body.glb');
  const result = await parse();
  const tracked = [], seen = new Set();
  result.scene.traverse(object => {
    if (!object.isMesh) return;
    for (const resource of [object.geometry, ...[object.material].flat()]) {
      if (seen.has(resource)) continue;
      seen.add(resource); track(resource, resource.type, tracked);
      if (resource.isMaterial) for (const value of Object.values(resource)) if (value?.isTexture && !seen.has(value)) {
        seen.add(value); track(value, 'source texture', tracked);
      }
    }
  });
  records.push({ result, tracked });
  return result;
};
THREE.TextureLoader.prototype.loadAsync = async function(url) {
  assert.match(url, /\/(base-color|fields)\.png$/);
  if (textureBehavior === 'reject' && url.endsWith('fields.png')) throw new Error('Synthetic field texture failure');
  const texture = new THREE.Texture({ width: url.endsWith('fields.png') ? (textureBehavior === 'wrong-size' ? 128 : 2048) : 1024, height: 1024 });
  track(texture, url, records.at(-1).tracked);
  return texture;
};
const reference = await parse();
let referenceBody;
reference.scene.traverse(object => { if (object.isMesh && object.geometry.getAttribute('position').count === 33207) referenceBody = object; });
const expectedHashes = attributeHashes(referenceBody.geometry);
const pairs = [['갑자', '甲'], ['을축', '乙'], ['병인', '丙'], ['정묘', '丁'], ['무진', '戊'], ['기사', '己'], ['경오', '庚'], ['신미', '辛'], ['임신', '壬'], ['계유', '癸']];
const expectedModes = ['normal-rooted-forked-woody-branches', 'connected-triangle-short-creeping-vines', 'triangle-emitted-original-fire', 'triangle-emitted-original-fire', 'triangle-fissure-gravity-sand', 'base-material-only', 'base-material-only', 'base-material-only', 'base-material-only', 'triangle-sliding-condensation'];
const snapshotEffects = group => {
  const result = [];
  group.traverse(object => {
    if (object.isInstancedMesh) result.push(Array.from(object.instanceMatrix.array));
    if (object.geometry) for (const name of ['aParticle', 'aFlow']) {
      const attribute = object.geometry.getAttribute(name);
      if (attribute) result.push(Array.from(attribute.array));
    }
  });
  return result;
};

for (const quality of ['low', 'high']) for (const [index, [key, stem]] of pairs.entries()) {
  test(`${stem} ${quality}: approved material, original B geometry and supported effects`, async () => {
    const spirit = await loadApprovedSpirit(key, '병인', quality);
    try {
      const material = spirit.bodyMesh.material;
      const restAtGeometryDisposal = [];
      spirit.bodyMesh.geometry.addEventListener('dispose', () => {
        restAtGeometryDisposal.push(CHARACTER_REST_ATTRIBUTES.map(name => !!spirit.bodyMesh.geometry.getAttribute(name)));
      });
      if (stem === '己') assert.equal(material.userData.approvedJadeVersion, 'v002', '己 must use approved jade and evolving green light');
      else {
        assert.equal(material.defines?.STEM_KIND, index, 'Body must use the approved stem study recipe');
        assert.match(material.customProgramCacheKey(), /character-rest/);
        assert.equal(material.userData.approvedJadeVersion, undefined);
        for (const name of CHARACTER_REST_ATTRIBUTES) assert.equal(spirit.bodyMesh.geometry.getAttribute(name)?.count, 33207, name);
        const actual = new THREE.Vector3().fromBufferAttribute(spirit.bodyMesh.geometry.getAttribute('stemRestPosition'), 8100);
        const expected = new THREE.Vector3().fromBufferAttribute(spirit.bodyMesh.geometry.getAttribute('position'), 8100);
        spirit.group.updateWorldMatrix(true, true);
        expected.applyMatrix4(spirit.group.matrixWorld.clone().invert().multiply(spirit.bodyMesh.matrixWorld));
        assert(actual.distanceTo(expected) < 1e-6, 'Fixed depth scale must be baked into rest coordinates');
      }
      assert.deepEqual(attributeHashes(spirit.bodyMesh.geometry), expectedHashes);
      assert(spirit.bodyMesh.morphTargetInfluences.every(weight => weight === 0));
      assert.deepEqual(spirit.avatarPivot.scale.toArray(), [1, 1, 1.35]);
      assert.equal(spirit.avatarPivot.position.x, -.42);
      assert.equal(spirit.mapping.bodyStem, key[0]);
      assert.equal(spirit.mapping.petBranch, key[1]);
      assert.equal(spirit.mapping.backgroundStem, '병');
      assert.equal(spirit.propGroup.userData.surfaceAccentDiagnostics?.mode, expectedModes[index]);
      if ([0, 1, 2, 3, 4, 9].includes(index)) assert(spirit.propGroup.children.length > 0);
      else assert.equal(spirit.propGroup.children.length, 0, 'Unsupported geometry effects must stay disabled');
      spirit.update(2.25, 1 / 60);
      const first = snapshotEffects(spirit.propGroup);
      spirit.update(2.25, 1 / 144);
      assert.deepEqual(snapshotEffects(spirit.propGroup), first, 'Absolute time must be deterministic across frame rates');
      spirit.reset(); const initial = snapshotEffects(spirit.propGroup);
      spirit.update(5); spirit.reset(); assert.deepEqual(snapshotEffects(spirit.propGroup), initial);
      spirit.avatarPivot.rotation.y = .8; spirit.group.scale.set(1.2, .9, 1.1); spirit.group.rotation.x = .2;
      spirit.update(1.5);
      assert(snapshotEffects(spirit.propGroup).flat(2).every(Number.isFinite));
      if (stem === '甲') assert(spirit.propGroup.userData.branchAttachment.minWorldRootNormalDot > .99999);
      const tracked = [...records.at(-1).tracked], seen = new Set(tracked.map(item => item.resource));
      spirit.group.traverse(object => {
        for (const resource of [object.isInstancedMesh ? object : null, object.geometry, ...[object.material].flat()].filter(Boolean)) {
          if (seen.has(resource)) continue;
          seen.add(resource); track(resource, resource.type, tracked);
          if (resource.isMaterial) for (const value of Object.values(resource)) if (value?.isTexture && !seen.has(value)) {
            seen.add(value); track(value, 'runtime texture', tracked);
          }
        }
      });
      spirit.dispose(); spirit.dispose(); spirit.update(6); spirit.reset();
      assert.deepEqual(restAtGeometryDisposal, [CHARACTER_REST_ATTRIBUTES.map(() => stem !== '己')], 'Rest attributes must stay attached until geometry disposal releases their GPU buffers');
      for (const name of CHARACTER_REST_ATTRIBUTES) assert.equal(spirit.bodyMesh.geometry.getAttribute(name), undefined, 'Owned geometry restores its original attributes after disposal');
      for (const item of tracked) assert.equal(item.count, 1, `${item.label} must be released exactly once`);
      assert.equal(spirit.group.children.length, 0);
    } finally { spirit.dispose(); }
  });
}

test('real B neutral morph has exact triangle attachment and rejects active morphs', () => {
  const mesh = referenceBody;
  mesh.updateWorldMatrix(true, false);
  const surface = new MeshSurface([mesh]);
  const anchor = surface.sample(482);
  const pose = surface.resolve(anchor, mesh);
  const ids = [0, 1, 2].map(i => mesh.geometry.index.getX(anchor.triangle * 3 + i));
  const points = ids.map(i => new THREE.Vector3().fromBufferAttribute(mesh.geometry.getAttribute('position'), i));
  const expected = points.reduce((sum, point, i) => sum.addScaledVector(point, anchor.barycentric.getComponent(i)), new THREE.Vector3());
  assert(pose.position.distanceTo(expected) < 1e-9);
  mesh.morphTargetInfluences[0] = .5;
  try {
    assert.throws(() => new MeshSurface([mesh]), /morph|Rigid/);
    assert.throws(() => surface.resolve(anchor, mesh), /morph/);
  }
  finally { mesh.morphTargetInfluences[0] = 0; }
});

test('rest binding includes fixed depth and restores prior attributes exactly once', () => {
  const outer = new THREE.Group(), model = new THREE.Group(); outer.add(model); model.scale.z = 1.35;
  const mesh = new THREE.Mesh(referenceBody.geometry.clone(), new THREE.MeshBasicMaterial()); model.add(mesh);
  const prior = new THREE.BufferAttribute(new Float32Array(33207 * 3), 3); mesh.geometry.setAttribute('stemRestPosition', prior);
  const binding = bindCharacterRestCoordinates(outer, [mesh]);
  const hashes = binding.entries[0].attributes.map(attribute => sha(attribute.array));
  outer.rotation.y = .6; outer.scale.setScalar(.8); outer.updateWorldMatrix(true, true);
  assert.deepEqual(binding.entries[0].attributes.map(attribute => sha(attribute.array)), hashes);
  binding.dispose(); binding.dispose();
  assert.equal(mesh.geometry.getAttribute('stemRestPosition'), prior);
  assert.equal(mesh.geometry.getAttribute('stemRestNormal'), undefined);
  mesh.geometry.dispose(); mesh.material.dispose();
});

test('甲 leaves meet transformed branch tip centers under nonuniform presentation', async () => {
  const spirit = await loadApprovedSpirit('갑자', '병인', 'high');
  try {
    spirit.avatarPivot.rotation.set(.2, .7, -.1); spirit.group.scale.set(1.2, .8, 1.1); spirit.update(3);
    const leaves = spirit.propGroup.getObjectByName('WoodyBranchTipLeaves');
    assert(leaves?.isInstancedMesh);
    const branchMatrix = new THREE.Matrix4(), leafMatrix = new THREE.Matrix4();
    for (let i = 0; i < leaves.count / 3; i++) {
      const branch = spirit.propGroup.getObjectByName(`NormalRootedWoodyBranches_${i % 4}`);
      branch.getMatrixAt(Math.floor(i / 4), branchMatrix);
      const positions = branch.geometry.getAttribute('position');
      const tipRows = [22 * 7, 23 * 7 + 12 * 7, (23 + 13) * 7 + 12 * 7];
      for (let j = 0; j < 3; j++) {
        const tip = new THREE.Vector3();
        for (let k = 0; k < 6; k++) tip.add(new THREE.Vector3().fromBufferAttribute(positions, tipRows[j] + k));
        tip.multiplyScalar(1 / 6).applyMatrix4(branchMatrix);
        leaves.getMatrixAt(i * 3 + j, leafMatrix);
        assert(tip.distanceTo(new THREE.Vector3().setFromMatrixPosition(leafMatrix)) < 1e-6, 'Leaves must follow branch transforms, including translation and scale');
      }
    }
  } finally { spirit.dispose(); }
});

for (const behavior of ['reject', 'wrong-size']) test(`jade ${behavior} releases the real GLB and fulfilled textures once`, async () => {
  textureBehavior = behavior;
  try {
    await assert.rejects(loadApprovedSpirit('기사', '병인', 'low'), /textures|atlas/);
    for (const item of records.at(-1).tracked) assert.equal(item.count, 1, item.label);
  } finally { textureBehavior = 'ok'; }
});

test.after(() => {
  GLTFLoader.prototype.loadAsync = nativeLoad;
  THREE.TextureLoader.prototype.loadAsync = nativeTexture;
  console.log(JSON.stringify({ glbSHA256: createHash('sha256').update(bytes).digest('hex'), originalAttributeHashes: expectedHashes, ioBoundary: 'CPU uses real GLB with image I/O placeholders; browser QA loads actual textures' }));
});
