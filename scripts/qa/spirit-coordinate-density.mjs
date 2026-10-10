// Actual approved GLB triangles, with image I/O alone replaced for CPU decoding.
// Measures the live sphere projection against display-depth-aware rest coordinates.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const out = path.resolve('outputs/spirit-surface-v30');
await fs.mkdir(out, { recursive: true });
const entry = path.join(out, 'density-runtime.mjs');
await build({ stdin: { contents: "export * from './lib/planet/character-rest-coordinates';", resolveDir: process.cwd() },
  outfile: entry, bundle: true, platform: 'node', format: 'esm', packages: 'external' });
const { bindCharacterRestCoordinates } = await import(pathToFileURL(entry).href);
const bytes = await fs.readFile('public/spirits/jade-v002/body.glb');
assert(bytes.equals(await fs.readFile('assets/source-reference/saju-b-evolving-light-v002/reference/SaJu_Jade_Approved_Static_Material.glb')));
const loader = new GLTFLoader().register(() => ({ name: 'CPU_IMAGE_IO', loadTexture: async () => new THREE.Texture() }));
const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const outer = new THREE.Group(), model = gltf.scene;
model.position.x = -.42; model.scale.z = 1.35; outer.add(model);
let body;
model.traverse(mesh => { if (mesh.isMesh && mesh.geometry.getAttribute('position').count === 33207) body = mesh; });
assert(body); body.morphTargetInfluences?.fill(0); outer.updateWorldMatrix(true, true);
const sha = data => createHash('sha256').update(Buffer.from(data.buffer, data.byteOffset, data.byteLength)).digest('hex');
const originals = Object.fromEntries(['position', 'normal', 'uv'].map(name => [name, sha(body.geometry.getAttribute(name).array)]));
const binding = bindCharacterRestCoordinates(outer, [body]);
const position = body.geometry.getAttribute('position'), rest = body.geometry.getAttribute('stemRestPosition'), uv = body.geometry.getAttribute('uv'), index = body.geometry.index;
const toRest = outer.matrixWorld.clone().invert().multiply(body.matrixWorld);
let maximumBindingError = 0;
for (let i = 0; i < position.count; i++) maximumBindingError = Math.max(maximumBindingError,
  new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(toRest).distanceTo(new THREE.Vector3().fromBufferAttribute(rest, i)));
assert(maximumBindingError < 2e-7, 'Rest binding must include the fixed presentation depth');
const rows = [], bounds = new THREE.Box3().setFromObject(body, true), centerX = (bounds.min.x + bounds.max.x) / 2;
function metric(a, b) {
  const aa = a.lengthSq(), ab = a.dot(b), bb = b.lengthSq(), disc = Math.sqrt((aa - bb) ** 2 + 4 * ab ** 2);
  const minimum = Math.sqrt(Math.max(0, (aa + bb - disc) / 2)), maximum = Math.sqrt(Math.max(0, (aa + bb + disc) / 2));
  return { minimum, maximum, anisotropy: maximum / Math.max(minimum, 1e-12), areaDensity: minimum * maximum };
}
for (let offset = 0; offset < index.count; offset += 3) {
  const ids = [0, 1, 2].map(i => index.getX(offset + i));
  const originalPoints = ids.map(i => new THREE.Vector3().fromBufferAttribute(position, i));
  const displayed = originalPoints.map(p => p.clone().applyMatrix4(toRest));
  const e1 = displayed[1].clone().sub(displayed[0]), e2 = displayed[2].clone().sub(displayed[0]);
  const length = e1.length(), u = e1.clone().normalize(), along = e2.dot(u), across = e2.clone().addScaledVector(u, -along).length();
  const area = length * across / 2; if (area < 1e-10) continue;
  const derivatives = values => {
    const du = values[1].clone().sub(values[0]).divideScalar(length);
    const dv = values[2].clone().sub(values[0]).addScaledVector(du, -along).divideScalar(across);
    return [du, dv];
  };
  // This mirrors v30 vertex normalization, interpolation, then fragment normalization.
  const directions = originalPoints.map(p => p.length() > 1e-4 ? p.clone().normalize() : new THREE.Vector3(0, 1, 0));
  const q = directions.reduce((v, p) => v.add(p), new THREE.Vector3()).divideScalar(3), radial = q.clone().normalize();
  const sphere = derivatives(directions).map(d => d.addScaledVector(radial, -d.dot(radial)).divideScalar(q.length()));
  const corrected = derivatives(ids.map(i => new THREE.Vector3().fromBufferAttribute(rest, i)));
  const centroid = displayed.reduce((v, p) => v.add(p), new THREE.Vector3()).divideScalar(3);
  const region = centroid.y > 1.65 ? 'head' : centroid.y < .48 ? 'feet' : Math.abs(centroid.x - centerX) > .52 ? 'arms' : 'torso';
  rows.push({ area, region, sphere: metric(...sphere), rest: metric(...corrected) });
}
function percentile(samples, key, q) {
  const sorted = samples.slice().sort((a, b) => a[key] - b[key]);
  const total = sorted.reduce((sum, x) => sum + x.area, 0); let area = 0;
  for (const x of sorted) { area += x.area; if (area >= total * q) return x[key]; }
  return sorted.at(-1)?.[key];
}
function summarize(subset, mode) {
  const samples = subset.map(row => ({ area: row.area, ...row[mode] }));
  return { triangles: samples.length, area: samples.reduce((sum, x) => sum + x.area, 0),
    minimumDensityP01: percentile(samples, 'minimum', .01), maximumDensityP99: percentile(samples, 'maximum', .99),
    medianAreaDensity: percentile(samples, 'areaDensity', .5), anisotropyP50: percentile(samples, 'anisotropy', .5), anisotropyP95: percentile(samples, 'anisotropy', .95) };
}
const before = summarize(rows, 'sphere'), after = summarize(rows, 'rest');
assert(before.anisotropyP95 > 5, 'Negative control must reproduce radial compression on actual B triangles');
assert(after.anisotropyP95 < 1.001); assert(Math.abs(after.medianAreaDensity - 1) < 1e-4);
const coincident = new Map(); let uvSeamPairs = 0, maximumSeamCoordinateGap = 0;
for (let i = 0; i < position.count; i++) {
  const p = new THREE.Vector3().fromBufferAttribute(position, i), key = p.toArray().join(',');
  const previous = coincident.get(key);
  if (previous !== undefined && (uv.getX(previous) !== uv.getX(i) || uv.getY(previous) !== uv.getY(i))) {
    uvSeamPairs++;
    maximumSeamCoordinateGap = Math.max(maximumSeamCoordinateGap,
      new THREE.Vector3().fromBufferAttribute(rest, previous).distanceTo(new THREE.Vector3().fromBufferAttribute(rest, i)));
  } else if (previous === undefined) coincident.set(key, i);
}
assert(uvSeamPairs > 100); assert.equal(maximumSeamCoordinateGap, 0);
const restHash = sha(rest.array); outer.rotation.set(.2, .7, -.1); outer.scale.setScalar(.8); outer.updateWorldMatrix(true, true);
assert.equal(sha(rest.array), restHash, 'Display motion must not slide the material coordinates');
assert.deepEqual(Object.fromEntries(['position', 'normal', 'uv'].map(name => [name, sha(body.geometry.getAttribute(name).array)])), originals);
binding.dispose(); binding.dispose(); assert.equal(body.geometry.getAttribute('stemRestPosition'), undefined);
const report = { status: 'PASS', sourceSHA256: sha(bytes), vertices: position.count, triangles: rows.length, presentationDepth: 1.35,
  method: 'Area-weighted singular values of the coordinate Jacobian at each real triangle centroid; sphere mode mirrors vertex/fragment normalizations, rest mode uses actual bound Float32 attributes',
  before, after, regions: Object.fromEntries(['head', 'torso', 'arms', 'feet'].map(region => [region, {
    before: summarize(rows.filter(row => row.region === region), 'sphere'), after: summarize(rows.filter(row => row.region === region), 'rest') }])),
  uvSeamPairs, maximumSeamCoordinateGap, maximumBindingError, originalAttributeSHA256: originals,
  limits: ['Measures spatial-coordinate distortion, not final motif frequency or visual quality', 'Intentional directional fire flow and camera foreshortening are distinct from this coordinate metric', 'CPU texture images are placeholders; browser QA loads the real GLB and PNGs'] };
await fs.writeFile(path.join(out, 'coordinate-density.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, triangles: rows.length, before, after, uvSeamPairs, maximumSeamCoordinateGap }));
const geometries = new Set(), materials = new Set(), textures = new Set();
model.traverse(o => { if (!o.isMesh) return; geometries.add(o.geometry); for (const m of [o.material].flat()) { materials.add(m); for (const v of Object.values(m)) if (v?.isTexture) textures.add(v); } });
for (const x of [...geometries, ...materials, ...textures]) x.dispose();
