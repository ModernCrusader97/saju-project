// Decode the actual approved source and emitted GLB. Images alone are CPU
// placeholders; positions, indices, original UVs and scene transforms are real.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const basis = 'aa41b1a3601c5254c28bc5a4c853cd5efa50c5cc';
const reference = 'assets/source-reference/saju-b-evolving-light-v002/reference/SaJu_Jade_Approved_Static_Material.glb';
const original = execFileSync('git', ['show', `${basis}:${reference}`], { maxBuffer: 16 * 1024 * 1024 });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const finite = attribute => assert([...attribute.array].every(Number.isFinite));
const rows = [];
for (const file of [reference, 'public/spirits/jade-v002/body.glb']) {
  const bytes = await fs.readFile(file);
  assert(bytes.equals(original), `${file} differs from deployed v29's approved source`);
  const textures = [];
  const loader = new GLTFLoader().register(() => ({
    name: 'qa_owned_cpu_images',
    loadTexture() { const texture = new THREE.Texture(); textures.push(texture); return Promise.resolve(texture); },
  }));
  const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  gltf.scene.updateMatrixWorld(true);
  const meshes = [], geometries = new Set(), materials = new Set();
  gltf.scene.traverse(mesh => {
    if (!mesh.isMesh) return;
    const position = mesh.geometry.getAttribute('position'), uv = mesh.geometry.getAttribute('uv');
    assert(position && uv && position.count === uv.count); finite(position); finite(uv);
    meshes.push({ name: mesh.name, vertices: position.count, uvVertices: uv.count,
      positionSha256: sha(Buffer.from(position.array.buffer, position.array.byteOffset, position.array.byteLength)),
      uvSha256: sha(Buffer.from(uv.array.buffer, uv.array.byteOffset, uv.array.byteLength)),
      worldMatrix: mesh.matrixWorld.toArray() });
    geometries.add(mesh.geometry);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
  });
  assert.equal(meshes.length, 8);
  const bounds = new THREE.Box3().setFromObject(gltf.scene);
  rows.push({ file, bytes: bytes.length, sha256: sha(bytes), meshes,
    bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() } });
  for (const resource of [...geometries, ...materials, ...textures]) resource.dispose();
}
assert.deepEqual(rows[0].meshes, rows[1].meshes); assert.deepEqual(rows[0].bounds, rows[1].bounds);
const source = await fs.readFile('lib/planet/approved-jade-spirit.ts', 'utf8');
assert(source.includes('APPROVED_BODY_PRESENTATION_DEPTH = 1.35'));
assert(source.includes('model.scale.z = APPROVED_BODY_PRESENTATION_DEPTH'));
const report = { status: 'PASS', basis, method: 'Actual Three GLTFLoader CPU decoding of immutable v29 reference and generated runtime GLB',
  presentationDepth: 1.35, rows, limits: ['Texture images are owned CPU placeholders; no GLB rasterization or pet/spirit appearance claim'] };
await fs.mkdir('outputs/sites-v30-qa', { recursive: true });
await fs.writeFile('outputs/sites-v30-qa/approved-glb-cpu.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, meshesPerGLB: rows.map(row => row.meshes.length), bytesPerGLB: rows.map(row => row.bytes), preservedDepth: report.presentationDepth }));
