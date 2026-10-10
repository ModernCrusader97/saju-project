// Save an export, regenerate with the recorded Blender command, then run:
// node scripts/qa/tiger-regeneration-compare.mjs /tmp/tiger-before.glb
// UV packing may vary. Check actual shape/skin/material/idle, and report bytes.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';

const sha = data => createHash('sha256').update(data).digest('hex');
const beforeFile = process.argv[2];
assert(beforeFile, 'Pass the GLB saved before regeneration.');
const manifest = JSON.parse(await fs.readFile('public/models/zodiac-pets/manifest.json', 'utf8'));
const afterFile = `public/models/zodiac-pets/${manifest.pets.인.file}`;

function decode(bytes, file) {
  assert.equal(bytes.subarray(0, 4).toString(), 'glTF');
  const length = bytes.readUInt32LE(12), document = JSON.parse(bytes.subarray(20, 20 + length));
  const binary = bytes.subarray(28 + length);
  const readers = { 5126: ['readFloatLE', 4], 5125: ['readUInt32LE', 4], 5123: ['readUInt16LE', 2], 5121: ['readUInt8', 1] };
  function rows(index) {
    const accessor = document.accessors[index], view = document.bufferViews[accessor.bufferView];
    const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[accessor.type];
    const [read, bytesPerValue] = readers[accessor.componentType];
    const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0), stride = view.byteStride ?? components * bytesPerValue;
    return Array.from({ length: accessor.count }, (_, row) => Array.from({ length: components }, (_, component) => binary[read](start + row * stride + component * bytesPerValue)));
  }
  const hashRows = values => sha([...new Set(values.map(row => JSON.stringify(row)))].sort().join('\n'));
  const meshes = document.meshes.map(mesh => {
    assert.equal(mesh.primitives.length, 1); const primitive = mesh.primitives[0], attributes = primitive.attributes;
    const positions = rows(attributes.POSITION), indices = rows(primitive.indices).flat(), triangles = [];
    for (let i = 0; i < indices.length; i += 3) {
      const points = indices.slice(i, i + 3).map(index => JSON.stringify(positions[index]));
      const pivot = points.indexOf([...points].sort()[0]);
      triangles.push([...points.slice(pivot), ...points.slice(0, pivot)]);
    }
    const normals = rows(attributes.NORMAL), joints = attributes.JOINTS_0 === undefined ? null : rows(attributes.JOINTS_0);
    const weights = attributes.WEIGHTS_0 === undefined ? null : rows(attributes.WEIGHTS_0);
    return { name: mesh.name, triangles: indices.length / 3, positionSetSHA256: hashRows(positions), trianglePositionsSHA256: hashRows(triangles),
      normalsSHA256: hashRows(positions.map((position, i) => [...position, ...normals[i]])),
      skinSHA256: joints ? hashRows(positions.map((position, i) => [...position, ...joints[i], ...weights[i]])) : null };
  }).sort((a, b) => a.name.localeCompare(b.name));
  const clips = document.animations.map(animation => ({ name: animation.name, channels: animation.channels,
    samplers: animation.samplers.map(sampler => ({ interpolation: sampler.interpolation, inputSHA256: sha(JSON.stringify(rows(sampler.input))), outputSHA256: sha(JSON.stringify(rows(sampler.output))) })) }));
  return { file, bytes: bytes.length, sha256: sha(bytes), meshes, clips, nodes: document.nodes, materials: document.materials, skins: document.skins,
    embeddedImages: document.images.map(image => ({ mimeType: image.mimeType })) };
}

const before = decode(await fs.readFile(beforeFile), 'export before regeneration');
const after = decode(await fs.readFile(afterFile), afterFile);
assert.deepEqual(after.meshes, before.meshes, 'actual geometry/normals/skin must survive UV repacking');
assert.deepEqual(after.clips, before.clips, 'actual idle channels and keyframe data must reproduce');
assert.deepEqual(after.nodes, before.nodes); assert.deepEqual(after.materials, before.materials); assert.deepEqual(after.skins, before.skins);
assert.deepEqual(after.embeddedImages, before.embeddedImages); assert.equal(after.sha256, manifest.pets.인.sha256);
const report = { status: 'PASS', method: 'Decode actual GLB accessors and compare canonical shape/normals/skin plus exact animation/material/scene data',
  before: { bytes: before.bytes, sha256: before.sha256 }, after, byteExact: before.sha256 === after.sha256,
  limits: ['UV island coordinates and generated coat PNG bytes can vary under Blender smart-project packing', 'Coat color field is the original vector_paint function; actual exported coat is separately checked by CPU PNG embedding and WebGL captures', 'Not a recovered historical animal or a cross-Blender byte identity claim'] };
await fs.mkdir('outputs/tiger-authored-browser', { recursive: true });
await fs.writeFile('outputs/tiger-authored-browser/regeneration-report.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, meshes: after.meshes.length, clips: after.clips.length, byteExact: report.byteExact, runtimeSHA256: after.sha256 }));
