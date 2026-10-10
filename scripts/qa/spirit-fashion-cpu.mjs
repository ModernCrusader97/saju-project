// Real approved GLB CPU contracts. Only browser texture/network I/O is replaced.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const output = path.resolve('outputs/spirit-fashion/cpu'); await fs.mkdir(output, { recursive: true });
const entry = path.join(output, 'runtime.mjs');
await build({ stdin: { contents: `export * from './lib/planet/spirit-fashion'; export * from './lib/planet/spirit-fashion-catalog';
 export * from './lib/planet/spirit-fashion-storage'; export * from './lib/planet/surface-attachment-exclusions'; export * from './lib/planet/surface-stem-accents'; export * from './lib/planet/fashion-surface-projector'; export * from './lib/planet/approved-jade-spirit';`, resolveDir: process.cwd() },
  outfile: entry, bundle: true, platform: 'node', format: 'esm', packages: 'external', plugins: [{ name: 'raw', setup(builder) {
    builder.onResolve({ filter: /\.glsl\?raw$/ }, args => ({ path: path.resolve(args.resolveDir, args.path.slice(0, -4)), namespace: 'raw' }));
    builder.onLoad({ filter: /.*/, namespace: 'raw' }, async args => ({ contents: await fs.readFile(args.path, 'utf8'), loader: 'text' }));
  } }] });
const api = await import(pathToFileURL(entry).href);
const bytes = await fs.readFile('public/spirits/jade-v002/body.glb');
const source = await fs.readFile('assets/source-reference/saju-b-evolving-light-v002/reference/SaJu_Jade_Approved_Static_Material.glb'); assert(bytes.equals(source));
const sha = array => createHash('sha256').update(Buffer.from(array.buffer, array.byteOffset, array.byteLength)).digest('hex');
const hashes = geometry => Object.fromEntries(['position', 'normal', 'uv'].map(key => [key, sha(geometry.attributes[key].array)]).concat([['index', sha(geometry.index.array)]]));
const loader = new GLTFLoader().register(() => ({ name: 'CPU_IMAGE_IO', loadTexture: async () => new THREE.Texture() }));
const parse = () => loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const report = { status: 'RUNNING', glbSHA256: sha(bytes), checks: [], attachments: [], penetration: [], budgets: [], motion: [], masks: [], limits: ['CPU image I/O placeholders; browser QA uses actual textures.', 'Support triangles move; fabric and physical collisions are not simulated.'] };

async function fixture(quality = 'high', stem = '갑') {
  const gltf = await parse(), model = gltf.scene, outer = new THREE.Group(); outer.add(model); model.position.x = -.42; model.scale.z = 1.35;
  let body; const eyes = []; model.traverse(o => { if (o.isMesh && o.geometry.attributes.position.count === 33207) body = o; if (o.isMesh && o.name.includes('almond_gaze')) eyes.push(o); });
  body.morphTargetInfluences?.fill(0); outer.updateMatrixWorld(true);
  const original = hashes(body.geometry), fashion = api.createSpiritFashion({ body, model, eyes, stem, quality });
  return { outer, model, body, eyes, fashion, original };
}
const outfit = { head: 'sprout-pin', face: 'round-sunglasses', neck: 'ribbon-bow', back: 'leaf-brooch' };
const resources = root => { const result = new Set(); root.traverse(o => { if (o.geometry) result.add(o.geometry); for (const material of [o.material].flat().filter(Boolean)) result.add(material); }); return result; };
const matrices = group => { const rows = []; group.traverse(o => { if (o.isInstancedMesh) rows.push({ name: o.name, values: Array.from(o.instanceMatrix.array) }); }); return rows; };
function maskDifference(original, masked) {
  let hidden = 0, total = 0;
  assert.equal(masked.length, original.length);
  for (let row = 0; row < original.length; row++) {
    assert.equal(masked[row].name, original[row].name); assert.equal(masked[row].values.length, original[row].values.length);
    for (let i = 0; i < original[row].values.length; i += 16) {
      total++; const before = original[row].values.slice(i, i + 16), after = masked[row].values.slice(i, i + 16);
      if (before.every((value, j) => value === after[j])) continue;
      assert([0, 1, 2, 4, 5, 6, 8, 9, 10].every(j => after[j] === 0), 'only overlapping attachments may become zero-scale');
      assert.deepEqual(after.slice(12), before.slice(12), 'exclusion must preserve the stable attachment position and identity'); hidden++;
    }
  }
  return { hidden, total };
}

test('empty schema, slot exclusivity, wrong-slot recovery and six item definitions', () => {
  assert.equal(api.FASHION_ITEMS.length, 6); assert.deepEqual(api.normalizeFashion(null), api.EMPTY_FASHION);
  let selection = api.equipFashion(api.EMPTY_FASHION, 'face', 'round-sunglasses');
  selection = api.equipFashion(selection, 'face', 'fitted-mask'); assert.equal(selection.face, 'fitted-mask');
  assert.equal(api.equipFashion(selection, 'head', 'fitted-mask').head, null);
  assert.deepEqual(api.normalizeFashion({ head: 'deleted', face: 'ribbon-bow', neck: ['ribbon-bow'], back: null }), api.EMPTY_FASHION);
  assert.equal(api.fashionStem('계유'), '계'); assert.equal(api.fashionStem('unknown'), '갑'); report.checks.push('validated four-slot schema; two face choices are exclusive');
});
test('version1 browser storage is per stem, repairs missing fields and rejects corrupt/unknown versions', () => {
  for (const raw of [null, '{bad', 'null', '[]', JSON.stringify({ version: 2, outfits: { 갑: outfit } })]) assert.deepEqual(api.decodeWardrobe(raw), api.emptyWardrobe());
  const repaired = api.decodeWardrobe(JSON.stringify({ version: 1, outfits: { 갑: { head: 'sprout-pin', face: 'bad' }, 계: outfit }, arbitrary: 'ignored' }));
  assert.equal(repaired.outfits.갑.head, 'sprout-pin'); assert.equal(repaired.outfits.갑.face, null); assert.deepEqual(repaired.outfits.을, api.EMPTY_FASHION);
  const memory = new Map(), store = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  assert(api.saveWardrobe(store, repaired)); assert.deepEqual(api.readWardrobe(store), repaired);
  const denied = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } };
  assert.deepEqual(api.readWardrobe(denied), api.emptyWardrobe()); assert.equal(api.saveWardrobe(denied, repaired), false);
  report.checks.push('schema v1 recovery, independent ten-stem outfits, denied storage remains usable; no prior fashion schema exists');
});
test('real B is completely unequipped by default; geometry, eyes, UV and depth are preserved', async () => {
  const f = await fixture(); assert.equal(f.fashion.group.children.length, 0); assert.equal(resources(f.fashion.group).size, 0);
  assert.deepEqual(f.model.userData.surfaceAttachmentExclusions, []); assert.deepEqual(hashes(f.body.geometry), f.original); assert.deepEqual(f.model.scale.toArray(), [1, 1, 1.35]);
  assert.equal(f.eyes.length, 2); f.fashion.dispose(); f.fashion.dispose(); assert.equal(f.model.userData.surfaceAttachmentExclusions, undefined);
  report.checks.push('default appearance unchanged; original real B positions/normals/UV/index and eyes preserved');
});

for (const quality of ['low', 'high']) test(`${quality}: real triangle attachment, rotation/depth, penetration and resource budgets`, async () => {
  const f = await fixture(quality), tracked = [];
  for (const config of [outfit, { ...outfit, head: 'crescent-pin', face: 'fitted-mask' }]) {
    f.fashion.set(config); f.fashion.update();
    const before = [...f.fashion.group.children]; f.fashion.set({ ...config }); assert.deepEqual(f.fashion.group.children, before, 'same outfit must reuse resources');
    let triangles = 0, draws = 0; f.fashion.group.traverse(o => { if (!o.isMesh) return; draws++; triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; });
    assert(draws <= 28, `fashion draw budget ${draws}`); assert(triangles <= 16000, `fashion triangle budget ${triangles}`); report.budgets.push({ quality, config, draws, triangles });
    const ray = new THREE.Raycaster(), penetrations = [];
    f.fashion.group.updateWorldMatrix(true, true); f.model.updateWorldMatrix(true, true);
    for (const item of f.fashion.group.children) item.traverse(mesh => {
      if (!mesh.isMesh) return;
      const p = mesh.geometry.attributes.position;
      const toFashion = f.fashion.group.matrixWorld.clone().invert().multiply(mesh.matrixWorld);
      for (let i = 0; i < p.count; i += Math.max(1, Math.floor(p.count / 28))) {
        const point = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(toFashion); const back = item.userData.fashionSlot === 'back';
        const origin = new THREE.Vector3(point.x, point.y, back ? -3 : 3).applyMatrix4(f.fashion.group.matrixWorld);
        const direction = new THREE.Vector3(0, 0, back ? 1 : -1).transformDirection(f.fashion.group.matrixWorld); ray.set(origin, direction); const hit = ray.intersectObject(f.body, false)[0];
        if (!hit) continue; const surface = hit.point.clone().applyMatrix4(f.fashion.group.matrixWorld.clone().invert()); const gap = back ? surface.z - point.z : point.z - surface.z;
        if (gap < -.003) penetrations.push({ mesh: mesh.name, index: i, gap });
      }
    });
    report.penetration.push({ quality, face: config.face, sampledInside: penetrations }); assert.deepEqual(penetrations, [], 'item vertices must remain outside the actual body');
    for (const resource of resources(f.fashion.group)) { const record = { resource, count: 0 }; resource.addEventListener('dispose', () => record.count++); tracked.push(record); }
    for (const rotation of [[0, 0, 0], [.23, .9, -.1], [-.28, 2.15, .14]]) {
      f.model.rotation.set(...rotation); f.outer.rotation.y = .13; f.outer.scale.set(1.2, .91, 1.1); f.fashion.update(); f.outer.updateMatrixWorld(true);
      for (const item of f.fashion.group.children) {
        const support = item.userData.support, anchor = new THREE.Vector3(...support.position);
        const expected = anchor.applyMatrix4(f.fashion.group.matrixWorld), actual = item.getWorldPosition(new THREE.Vector3());
        const n = new THREE.Vector3(...support.normal).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(f.fashion.group.matrixWorld));
        const direction = new THREE.Vector3(0, 0, 1).transformDirection(item.matrixWorld);
        assert(direction.dot(n) > .99999, 'mounted item must point along actual transformed surface normal'); assert(actual.clone().sub(expected).dot(n) > .015);
      }
    }
    f.model.rotation.set(0, 0, 0); f.outer.rotation.set(0, 0, 0); f.outer.scale.set(1, 1, 1); f.fashion.update();
    assert.deepEqual(hashes(f.body.geometry), f.original); assert.equal(f.model.userData.surfaceAttachmentExclusions.length, 4);
    report.attachments.push({ quality, face: config.face, supports: f.fashion.group.userData.diagnostics.triangleSupports });
  }
  f.fashion.set(api.EMPTY_FASHION); assert.equal(f.fashion.group.children.length, 0); assert.deepEqual(f.model.userData.surfaceAttachmentExclusions, []);
  for (const record of tracked) assert.equal(record.count, 1, 'every replaced item geometry/material is disposed once');
  f.fashion.set(outfit); const final = [...resources(f.fashion.group)].map(resource => { const r = { count: 0 }; resource.addEventListener('dispose', () => r.count++); return r; });
  f.fashion.dispose(); f.fashion.dispose(); f.fashion.set(outfit); f.fashion.update(); assert(final.every(r => r.count === 1));
  report.checks.push(`${quality}: six items, four-item combination, transformed triangle supports, sampled body clearance, resource disposal once`);
});

test('support follows a changed actual triangle without moving source vertices during normal operation', async () => {
  const f = await fixture(); f.fashion.set({ ...api.EMPTY_FASHION, head: 'sprout-pin' }); const item = f.fashion.group.children[0], initial = item.position.clone();
  const triangle = item.userData.support.triangle, index = f.body.geometry.index, positions = f.body.geometry.attributes.position;
  const backup = new Map(); for (let j = 0; j < 3; j++) { const id = index.getX(triangle * 3 + j); backup.set(id, positions.getY(id)); positions.setY(id, positions.getY(id) + .02); }
  f.fashion.update(); assert(Math.abs(item.position.y - initial.y - .02) < 1e-6, 'support must resolve the actual current triangle each frame');
  for (const [id, y] of backup) positions.setY(id, y); f.fashion.update(); assert(item.position.distanceTo(initial) < 1e-7); assert.deepEqual(hashes(f.body.geometry), f.original);
  f.fashion.dispose(); report.checks.push('live triangle binding follows a controlled source-pose change; original bytes restored in the test');
});

test('triangle projection index matches native raycasting on real front/back/morph poses', async () => {
  const f = await fixture(), projector = new api.FashionSurfaceProjector(f.body), ray = new THREE.Raycaster();
  f.body.material.side = THREE.DoubleSide;
  for (const morph of [0, .45]) {
    f.body.morphTargetInfluences[0] = morph;
    for (const rotation of [0, .93]) {
      f.model.rotation.y = rotation; f.outer.scale.set(1.13, .9, 1.07); f.outer.updateMatrixWorld(true);
      for (const x of [-.73, -.41, -.23, 0, .23, .41, .73]) for (const y of [1.1, 1.635, 1.76, 2.12]) for (const side of [-1, 1]) {
        const origin = new THREE.Vector3(x, y, side * 3), direction = new THREE.Vector3(0, 0, -side);
        const result = projector.intersect(origin, direction);
        ray.set(origin.clone().applyMatrix4(f.body.matrixWorld), direction.clone().transformDirection(f.body.matrixWorld)); const native = ray.intersectObject(f.body, false)[0];
        assert.equal(!!result, !!native);
        if (!result) continue;
        const index = f.body.geometry.index;
        const point = [0, 1, 2].reduce((sum, i) => sum.addScaledVector(f.body.getVertexPosition(index.getX(result.triangle * 3 + i), new THREE.Vector3()), result.barycentric.getComponent(i)), new THREE.Vector3());
        assert(point.distanceTo(native.point.clone().applyMatrix4(f.body.matrixWorld.clone().invert())) < 1e-8, 'acceleration must preserve the actual triangle hit');
      }
    }
  }
  assert.equal(projector.intersect(new THREE.Vector3(0, 1.7, 3), new THREE.Vector3(.1, 0, -1).normalize()), undefined, 'unsupported oblique rays must use native raycasting');
  projector.dispose(); f.body.morphTargetInfluences[0] = 0; f.fashion.dispose(); report.checks.push('224 real front/back ray comparisons include morph snapshots, rotation/depth and scale; no radius approximation');
});

const nativeLoad = GLTFLoader.prototype.loadAsync, nativeTexture = THREE.TextureLoader.prototype.loadAsync;
GLTFLoader.prototype.loadAsync = async () => parse();
THREE.TextureLoader.prototype.loadAsync = async url => new THREE.Texture({ width: url.endsWith('fields.png') ? 2048 : 1024, height: 1024 });
for (const key of ['갑자', '을축', '계유']) test(`${key}: localized exclusions follow idle/wave and restore exact stable instance poses`, async () => {
  const spirit = await api.loadApprovedSpirit(key, '병인', 'low'), owner = spirit.fashion.group.parent;
  assert.equal(owner.name, 'ApprovedSpiritMotion'); assert.equal(spirit.avatarPivot.userData.surfaceAttachmentExclusions, undefined);
  for (const pose of ['idle', 'wave']) {
    spirit.fashion.set(api.EMPTY_FASHION); spirit.reset(); spirit.update(0); if (pose === 'wave') spirit.triggerReaction();
    const time = pose === 'wave' ? .65 : 2.25; spirit.update(time); const original = matrices(spirit.propGroup);
    spirit.fashion.set(outfit); spirit.update(time); const masked = matrices(spirit.propGroup), delta = maskDifference(original, masked);
    if (key !== '을축') assert(delta.hidden > 0, 'this outfit covers at least one actual branch or bead');
    assert(delta.hidden < delta.total, 'attachments outside the small regions stay active');
    assert.equal(owner.userData.surfaceAttachmentExclusions.length, 4);
    for (const item of spirit.fashion.group.children) {
      const support = new THREE.Vector3(...item.userData.support.position).applyMatrix4(spirit.fashion.group.matrixWorld).applyMatrix4(spirit.propGroup.matrixWorld.clone().invert());
      assert(api.isSurfaceAttachmentExcluded(spirit.propGroup, support), 'region must include its current actual support');
    }
    spirit.fashion.set({ ...outfit, face: 'fitted-mask' }); spirit.update(time);
    spirit.fashion.set(api.EMPTY_FASHION); spirit.update(time); assert.deepEqual(matrices(spirit.propGroup), original, 'replacement/removal restores same seed IDs and matrices');
    spirit.fashion.set(outfit); spirit.update(time); assert.deepEqual(matrices(spirit.propGroup), masked, 're-equip returns the same masks');
    spirit.avatarPivot.rotation.set(.25, 1.03, 0); spirit.update(time); assert.equal(spirit.fashion.group.children.length, 4);
    report.masks.push({ key, pose, time, ...delta });
  }
  spirit.dispose(); spirit.dispose(); report.checks.push(`${key}: motion-root regions, local masks, restorable stable seeds and resources`);
});

test('actual connected vines hide only overlapping points and restore their fixed identities', async () => {
  const f = await fixture('low', '을'), effect = api.createSurfaceStemAccents('乙', { meshes: [f.body], quality: 'low', allowMorphTargets: true });
  f.model.add(effect.group); effect.update(2.25); const original = matrices(effect.group);
  const row = original.find(row => row.name === 'ConnectedVineSegments'); let target;
  for (let i = 0; i < row.values.length; i += 16) {
    const matrix = new THREE.Matrix4().fromArray(row.values, i);
    if (Math.abs(matrix.determinant()) > 1e-12) { target = new THREE.Vector3().setFromMatrixPosition(matrix); break; }
  }
  assert(target); effect.group.updateWorldMatrix(true, false); f.model.updateWorldMatrix(true, false);
  const ownerPoint = target.clone().applyMatrix4(effect.group.matrixWorld).applyMatrix4(f.model.matrixWorld.clone().invert());
  const region = { id: 'qa:small-accessory-vine-overlap', shape: 'sphere', center: ownerPoint.toArray(), radius: .035 };
  f.model.userData.surfaceAttachmentExclusions = [region]; effect.update(2.25); const masked = matrices(effect.group), delta = maskDifference(original, masked);
  assert(delta.hidden > 0 && delta.hidden < delta.total, 'only the small local overlap disappears');
  f.model.userData.surfaceAttachmentExclusions = []; effect.update(2.25); assert.deepEqual(matrices(effect.group), original);
  f.model.userData.surfaceAttachmentExclusions = [region]; effect.update(2.25); assert.deepEqual(matrices(effect.group), masked);
  f.model.rotation.set(.2, .8, -.1); effect.update(2.25); assert(api.isSurfaceAttachmentExcluded(effect.group, target));
  effect.dispose(); effect.dispose(); f.fashion.dispose(); report.masks.push({ key: '을축', probe: 'actual visible vine segment; isolated sphere descriptor', ...delta });
  report.checks.push('actual connected vine overlap probe: local hide, clear/replace and stable segment/leaf IDs; non-overlapping outfit points stay visible');
});

test('actual flame attachment exclusions preserve particle identities and restore original visibility', async () => {
  for (const quality of ['low', 'high']) for (const key of ['병인', '정묘']) {
    const spirit = await api.loadApprovedSpirit(key, '병인', quality); spirit.update(0); spirit.triggerReaction(); spirit.update(.65);
    let fire; spirit.propGroup.traverse(object => { if (object.isInstancedMesh && object.geometry.hasAttribute('aParticle')) fire = object; }); assert(fire);
    const original = Array.from(fire.geometry.attributes.aParticle.array), positions = matrices(spirit.propGroup);
    spirit.fashion.set(outfit); spirit.update(.65); const masked = Array.from(fire.geometry.attributes.aParticle.array); let hidden = 0;
    for (let i = 0; i < original.length; i++) if (masked[i] !== original[i]) { assert.equal(i % 4, 0, 'only visibility age changes'); assert.equal(masked[i], 1); hidden++; }
    assert(hidden < fire.count, 'fire away from accessories remains active'); assert.deepEqual(matrices(spirit.propGroup), positions, 'existing trajectories and stable identities stay unchanged');
    spirit.fashion.set(api.EMPTY_FASHION); spirit.update(.65); assert.deepEqual(Array.from(fire.geometry.attributes.aParticle.array), original);
    spirit.fashion.set(outfit); spirit.update(.65); assert.deepEqual(Array.from(fire.geometry.attributes.aParticle.array), masked);
    report.masks.push({ key, quality, pose: 'wave', hiddenVisibleFlameSources: hidden, totalFlameSources: fire.count }); spirit.dispose(); spirit.dispose();
  }
  report.checks.push('actual 丙/丁 flame-source visibility masks restore particle age/seed data and preserve flight matrices; flight collisions are not simulated');
});

test('ten production stems: accessories and exclusion regions follow real idle and bounded original Gentle_wave_pose', async () => {
  for (const key of ['갑자', '을축', '병인', '정묘', '무진', '기사', '경오', '신미', '임신', '계유']) {
    const spirit = await api.loadApprovedSpirit(key, '병인', 'low'), body = spirit.bodyMesh, owner = spirit.fashion.group.parent;
    const original = hashes(body.geometry), morphHash = sha(body.geometry.morphAttributes.position[0].array);
    assert.equal(owner.name, 'ApprovedSpiritMotion'); assert.equal(spirit.fashion.group.scale.z, 1 / 1.35);
    spirit.fashion.set(outfit); spirit.reset(); spirit.update(0); const start = spirit.fashion.group.children[0].getWorldPosition(new THREE.Vector3());
    spirit.update(1.5); const idle = spirit.fashion.group.children[0].getWorldPosition(new THREE.Vector3()); assert(idle.distanceTo(start) > .001, 'hardware must follow actual idle');
    spirit.reset(); spirit.update(0); spirit.triggerReaction(); let peakTime;
    for (let t = .05; t <= 1.2; t += .05) { spirit.update(t); if (body.morphTargetInfluences[0] > .445) { peakTime = t; break; } }
    assert(peakTime); assert(body.morphTargetInfluences[0] <= .45);
    const waveWeight = body.morphTargetInfluences[0];
    for (const config of [outfit, { ...outfit, head: 'crescent-pin', face: 'fitted-mask' }]) {
      spirit.fashion.set(config); spirit.avatarPivot.rotation.set(.17, .93, -.08); spirit.update(peakTime); spirit.group.updateMatrixWorld(true);
      let samples = 0; const inside = [], ray = new THREE.Raycaster();
      for (const item of spirit.fashion.group.children) {
        const s = item.userData.support, v = [0, 1, 2].map(j => body.getVertexPosition(body.geometry.index.getX(s.triangle * 3 + j), new THREE.Vector3()));
        const actualSupport = v.reduce((sum, p, j) => sum.addScaledVector(p, s.barycentric[j]), new THREE.Vector3()).applyMatrix4(body.matrixWorld);
        const publishedSupport = new THREE.Vector3(...s.position).applyMatrix4(spirit.fashion.group.matrixWorld);
        assert(actualSupport.distanceTo(publishedSupport) < 1e-8, 'fashion must resolve the current morphed triangle');
        const actualNormal = new THREE.Triangle(...v).getNormal(new THREE.Vector3()).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(body.matrixWorld));
        assert(new THREE.Vector3(0, 0, 1).transformDirection(item.matrixWorld).dot(actualNormal) > .99999);
        const pInEffect = actualSupport.clone().applyMatrix4(spirit.propGroup.matrixWorld.clone().invert()); assert(api.isSurfaceAttachmentExcluded(spirit.propGroup, pInEffect));
        const region = owner.userData.surfaceAttachmentExclusions.find(region => region.id.includes(item.userData.fashionItemId)); assert(region);
        item.traverse(mesh => { if (!mesh.isMesh) return; const p = mesh.geometry.attributes.position;
          for (let i = 0; i < p.count; i += Math.max(1, Math.floor(p.count / 8))) {
            const point = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld).applyMatrix4(spirit.fashion.group.matrixWorld.clone().invert());
            const back = item.userData.fashionSlot === 'back', origin = new THREE.Vector3(point.x, point.y, back ? -3 : 3).applyMatrix4(spirit.fashion.group.matrixWorld);
            ray.set(origin, new THREE.Vector3(0, 0, back ? 1 : -1).transformDirection(spirit.fashion.group.matrixWorld)); const hit = ray.intersectObject(body, false)[0]; if (!hit) continue;
            const surface = hit.point.clone().applyMatrix4(spirit.fashion.group.matrixWorld.clone().invert()), gap = back ? surface.z - point.z : point.z - surface.z; samples++;
            if (gap < -.003) inside.push({ item: item.name, mesh: mesh.name, index: i, gap });
            const ownerPoint = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld).applyMatrix4(owner.matrixWorld.clone().invert());
            assert(ownerPoint.toArray().every((value, j) => value >= region.min[j] - 1e-8 && value <= region.max[j] + 1e-8), 'current region must follow current hardware bounds');
          }
        });
      }
      assert.deepEqual(inside, [], 'sampled hardware must stay outside the actual waving body');
      report.motion.push({ key, face: config.face, peakTime, waveWeight, sampledClearanceVertices: samples, sampledInside: inside, owner: owner.name, depth: spirit.avatarPivot.scale.z });
    }
    spirit.reset(); spirit.update(0); assert.equal(body.morphTargetInfluences[0], 0); assert.equal(spirit.fashion.group.children.length, 4);
    assert.deepEqual(hashes(body.geometry), original); assert.equal(sha(body.geometry.morphAttributes.position[0].array), morphHash); spirit.dispose(); spirit.dispose();
  }
  report.checks.push('ten production stems: actual idle, original bounded wave, live triangle normals/supports, current local regions and sampled clearance; reset keeps clothing and restores neutral morph');
});
test.after(async () => { GLTFLoader.prototype.loadAsync = nativeLoad; THREE.TextureLoader.prototype.loadAsync = nativeTexture;
  report.status = report.checks.length === 13 ? 'PASS' : 'FAIL'; await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ status: report.status, checks: report.checks, budgets: report.budgets })); });
