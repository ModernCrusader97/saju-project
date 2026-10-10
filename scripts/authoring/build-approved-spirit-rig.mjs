// Append a new skin and bone animation to the approved GLB. Every original
// accessor, bufferView, embedded image, face node, material and morph stays intact.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {APPROVED_SPIRIT_RIG_PROFILE as profile, rigBoneNames, rigEase, rigGreetingPose, applyApprovedRigPose} from '../../lib/planet/approved-spirit-rig-profile.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = path.join(root, 'assets/source-reference/saju-b-evolving-light-v002/reference/SaJu_Jade_Approved_Static_Material.glb');
const output = path.resolve(process.argv.includes('--output') ? process.argv[process.argv.indexOf('--output') + 1] :
  path.join(root, 'assets/source-reference/saju-b-rigged-greeting-v001'));
await fs.mkdir(output, {recursive: true});
const source = await fs.readFile(sourcePath), sha = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(sha(source), profile.sourceSHA256);
const jsonLength = source.readUInt32LE(12), doc = JSON.parse(source.subarray(20, 20 + jsonLength));
const binary = source.subarray(28 + jsonLength, 28 + jsonLength + source.readUInt32LE(20 + jsonLength));
assert.equal(doc.skins?.length ?? 0, 0);
const sourceAccessorCount = doc.accessors.length, sourceViewCount = doc.bufferViews.length, sourceNodeCount = doc.nodes.length;
const original = structuredClone(doc);
const gltf = await new GLTFLoader().register(() => ({name:'AUTHORING_IMAGE_IO', loadTexture: async () => new THREE.Texture()}))
  .parseAsync(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength), '');
let sourceBody; gltf.scene.traverse(o => {if (o.isMesh && o.geometry.attributes.position.count === profile.sourceVertices) sourceBody = o;});
assert(sourceBody);
const position = sourceBody.geometry.attributes.position, index = sourceBody.geometry.index;
const nodeByPosition = new Map(), vertexNodes = new Uint32Array(position.count), rest = [];
for (let id = 0; id < position.count; id++) {
  const xyz = [position.getX(id), position.getY(id), position.getZ(id)], key = xyz.map(v => Math.round(v * 1e6)).join(':');
  let node = nodeByPosition.get(key);
  if (node === undefined) {node = rest.length / 3; nodeByPosition.set(key, node); rest.push(...xyz);}
  vertexNodes[id] = node;
}
const nodeCount = rest.length / 3, neighbors = Array.from({length:nodeCount}, () => new Set());
for (let offset = 0; offset < index.count; offset += 3) {
  const ids = [0,1,2].map(k => vertexNodes[index.getX(offset + k)]);
  for (let k = 0; k < 3; k++) {const a = ids[k], b = ids[(k + 1) % 3]; if (a !== b) {neighbors[a].add(b); neighbors[b].add(a);}}
}
const guide = new THREE.CubicBezierCurve3(...profile.guide.map(p => new THREE.Vector3(...p)));
const points = Array.from({length:513}, (_, i) => guide.getPoint(i / 512)), arc = [0];
for (let i = 1; i < points.length; i++) arc.push(arc.at(-1) + points[i].distanceTo(points[i - 1]));
const flags = new Uint8Array(nodeCount), u = new Float64Array(nodeCount), free = [], freeID = new Int32Array(nodeCount).fill(-1);
const point = new THREE.Vector3();
for (let node = 0; node < nodeCount; node++) {
  point.fromArray(rest, node * 3); let nearest = 0, distance = Infinity;
  for (let i = 0; i < points.length; i++) {const d = point.distanceToSquared(points[i]); if (d < distance) {distance = d; nearest = i;}}
  u[node] = arc[nearest] / arc.at(-1);
  const region = profile.freeRegion, arm = profile.armRegion;
  if (point.x > region.minX && point.y > region.minY && point.y < region.maxY) flags[node] = 1;
  if (point.x > arm.minX && u[node] >= arm.minU && Math.sqrt(distance) < arm.maxRadius) flags[node] = 2;
  if (flags[node] === 1) {freeID[node] = free.length; free.push(node);}
}
// One harmonic solve on the actual welded reference topology, not a sphere or
// screen-space proxy. Complete visible arm rings are fixed to the arm chain.
const diagonal = new Float64Array(free.length), rhs = new Float64Array(free.length), edges = [];
for (let id = 0; id < free.length; id++) {
  const node = free[id], local = [];
  for (const other of neighbors[node]) {
    const d = [0,1,2].reduce((s,k) => s + (rest[node*3+k] - rest[other*3+k])**2, 0), weight = 1 / Math.max(d, 1e-8);
    local.push([other,weight]); diagonal[id] += weight; if (flags[other] === 2) rhs[id] += weight;
  }
  assert(diagonal[id] > 0); edges.push(local);
}
const x = new Float64Array(free.length), residual = rhs.slice(), direction = new Float64Array(free.length),
  z = new Float64Array(free.length), product = new Float64Array(free.length);
let rz = 0;
for (let id = 0; id < free.length; id++) {direction[id] = z[id] = residual[id] / diagonal[id]; rz += residual[id] * z[id];}
const initial = rz; let iterations = 0;
while (iterations++ < 1000 && rz > initial * 1e-20) {
  for (let id = 0; id < free.length; id++) {
    product[id] = diagonal[id] * direction[id];
    for (const [other,weight] of edges[id]) if (freeID[other] >= 0) product[id] -= weight * direction[freeID[other]];
  }
  let dot = 0; for (let id = 0; id < free.length; id++) dot += direction[id] * product[id];
  const alpha = rz / dot; let next = 0;
  for (let id = 0; id < free.length; id++) {x[id] += alpha * direction[id]; residual[id] -= alpha * product[id]; z[id] = residual[id] / diagonal[id]; next += residual[id] * z[id];}
  const beta = next / rz; for (let id = 0; id < free.length; id++) direction[id] = z[id] + beta * direction[id]; rz = next;
}
assert(Math.sqrt(rz / initial) < 1e-7);
const field = new Float64Array(nodeCount);
for (const [id,node] of free.entries()) field[node] = THREE.MathUtils.clamp(x[id],0,1) *
  rigEase((rest[node*3+1] - profile.freeRegion.minY) / profile.freeRegion.lowerFadeSpan);
const skinIndex = new Uint8Array(position.count * 4), skinWeight = new Float32Array(position.count * 4);
const smooth = t => {t = THREE.MathUtils.clamp(t,0,1); return t*t*(3-2*t);};
let movingVertices = 0, armVertices = 0;
for (let id = 0; id < position.count; id++) {
  const node = vertexNodes[id], weights = [];
  if (flags[node] === 2) {
    armVertices++; const stations = profile.armStations; let bone = 0;
    while (bone < stations.length - 1 && u[node] > stations[bone + 1]) bone++;
    const first = profile.socketSupports + 1 + bone;
    if (bone === stations.length - 1) weights.push([first,1]);
    else {const t = smooth((u[node] - stations[bone]) / (stations[bone+1] - stations[bone])); weights.push([first,1-t],[first+1,t]);}
  } else {
    const value = field[node] * profile.socketSupports, low = Math.min(profile.socketSupports - 1, Math.floor(value)), t = value - low;
    weights.push([low,1-t],[low+1,t]);
  }
  weights.filter(w => w[1] > 0).forEach(([bone,weight], slot) => {skinIndex[id*4+slot] = bone; skinWeight[id*4+slot] = weight;});
  if (weights.some(([bone,weight]) => bone > 0 && weight > 0)) movingVertices++;
}
// All rest bone rotations/scales are identity. Their inverse bind matrices use
// the exact positions written to glTF, with the original mesh transform intact.
const pivot = new THREE.Vector3(...profile.socketPivot), worldPositions = [new THREE.Vector3()];
for (let i = 1; i <= profile.socketSupports; i++) worldPositions.push(pivot.clone());
for (const station of profile.armStations) worldPositions.push(guide.getPointAt(station));
const parents = [-1, ...Array(profile.socketSupports).fill(0), ...profile.armStations.map((_,i) => profile.socketSupports + i)];
const bones = [], restPositions = [];
for (let i = 0; i < rigBoneNames.length; i++) {
  const local = worldPositions[i].clone(); if (parents[i] >= 0) local.sub(worldPositions[parents[i]]);
  const bone = new THREE.Bone(); bone.name = rigBoneNames[i]; bone.position.copy(local); bones.push(bone); restPositions.push(local);
  doc.nodes.push({name:bone.name, translation:local.toArray()});
  if (parents[i] >= 0) {
    bones[parents[i]].add(bone);
    (doc.nodes[sourceNodeCount + parents[i]].children ??= []).push(sourceNodeCount + i);
  }
}
const parts = [binary]; let binarySize = binary.length;
function accessor(array, componentType, type, count, target, extra = {}) {
  const padding = (4 - binarySize % 4) % 4; if (padding) {parts.push(Buffer.alloc(padding)); binarySize += padding;}
  const bytes = Buffer.from(array.buffer, array.byteOffset, array.byteLength), view = doc.bufferViews.length;
  doc.bufferViews.push({buffer:0, byteOffset:binarySize, byteLength:bytes.length, ...(target ? {target} : {})});
  parts.push(bytes); binarySize += bytes.length;
  const id = doc.accessors.length; doc.accessors.push({bufferView:view, componentType, type, count, ...extra}); return id;
}
const jointAccessor = accessor(skinIndex,5121,'VEC4',position.count,34962), weightAccessor = accessor(skinWeight,5126,'VEC4',position.count,34962);
const inverseBind = new Float32Array(bones.length * 16);
worldPositions.forEach((p,i) => new THREE.Matrix4().makeTranslation(-p.x,-p.y,-p.z).toArray(inverseBind,i*16));
doc.skins = [{name:'Approved_B_rig_v001', skeleton:sourceNodeCount, joints:bones.map((_,i) => sourceNodeCount+i),
  inverseBindMatrices:accessor(inverseBind,5126,'MAT4',bones.length)}];
const bodyNode = doc.nodes.findIndex(n => doc.meshes[n.mesh]?.primitives.some(p => p.attributes.POSITION === 0));
assert(bodyNode >= 0); doc.nodes[bodyNode].skin = 0;
for (const primitive of doc.meshes[doc.nodes[bodyNode].mesh].primitives) {primitive.attributes.JOINTS_0 = jointAccessor; primitive.attributes.WEIGHTS_0 = weightAccessor;}
doc.scenes[doc.scene ?? 0].nodes.push(sourceNodeCount);
doc.nodes[sourceNodeCount].extras = {approvedRigVersion:profile.version, sourceSHA256:profile.sourceSHA256};
doc.nodes[bodyNode].extras = {...doc.nodes[bodyNode].extras, approvedRigVersion:profile.version, approvedRigMovingVertices:movingVertices};
// Portable authored clip; the interactive runtime evaluates the same absolute
// profile with per-stem tempo, rather than accumulating animation deltas.
const frames = Math.ceil(profile.duration * 60), times = new Float32Array(frames + 1);
const rotations = bones.map(() => new Float32Array((frames+1)*4)), translations = bones.map(() => new Float32Array((frames+1)*3));
for (let frame = 0; frame <= frames; frame++) {
  times[frame] = frame / frames * profile.duration; const pose = rigGreetingPose(frame/frames);
  applyApprovedRigPose(bones,restPositions,pose.lift,pose.wrist);
  bones.forEach((bone,i) => {bone.quaternion.toArray(rotations[i],frame*4); bone.position.toArray(translations[i],frame*3);});
}
const timeAccessor = accessor(times,5126,'SCALAR',times.length,undefined,{min:[0],max:[times.at(-1)]});
const clip = {name:'Rigged_three_wave_greeting_v001',samplers:[],channels:[]};
for (let i = 1; i < bones.length; i++) for (const [key,array,type] of [['rotation',rotations[i],'VEC4'],['translation',translations[i],'VEC3']]) {
  clip.channels.push({sampler:clip.samplers.length,target:{node:sourceNodeCount+i,path:key}});
  clip.samplers.push({input:timeAccessor,output:accessor(array,5126,type,times.length),interpolation:'LINEAR'});
}
(doc.animations ??= []).push(clip);
doc.asset.extras = {...doc.asset.extras, rigDerivative:{version:profile.version, sourceSHA256:profile.sourceSHA256,
  provenance:'New user-requested skin rig; original BIN prefix and original authored attributes preserved. Not recovery of missing a97c418.'}};
const binaryPadding = (4 - binarySize % 4) % 4; if (binaryPadding) {parts.push(Buffer.alloc(binaryPadding)); binarySize += binaryPadding;}
doc.buffers[0].byteLength = binarySize;
const json = Buffer.from(JSON.stringify(doc)), jsonPadding = (4 - json.length % 4) % 4;
const jsonChunk = Buffer.concat([json,Buffer.alloc(jsonPadding,0x20)]), result = Buffer.alloc(12+8+jsonChunk.length+8+binarySize);
result.writeUInt32LE(0x46546c67,0); result.writeUInt32LE(2,4); result.writeUInt32LE(result.length,8);
result.writeUInt32LE(jsonChunk.length,12); result.writeUInt32LE(0x4e4f534a,16); jsonChunk.copy(result,20);
result.writeUInt32LE(binarySize,20+jsonChunk.length); result.writeUInt32LE(0x004e4942,24+jsonChunk.length);
Buffer.concat(parts).copy(result,28+jsonChunk.length);
assert.deepEqual(doc.accessors.slice(0,sourceAccessorCount),original.accessors);
assert.deepEqual(doc.bufferViews.slice(0,sourceViewCount),original.bufferViews);
for (const key of ['images','textures','materials','samplers']) assert.deepEqual(doc[key],original[key]);
assert.deepEqual(doc.animations[0],original.animations[0]);
assert(result.subarray(28+jsonChunk.length,28+jsonChunk.length+binary.length).equals(binary));
const assetName = 'SaJu_B_Rigged_Greeting_v001.glb'; await fs.writeFile(path.join(output,assetName),result);
const manifest = {version:profile.version, sourceSHA256:sha(source), rigGLBSHA256:sha(result), asset:assetName,
  sourceBinaryPrefixPreserved:true, sourceAccessorsPreserved:sourceAccessorCount, sourceBufferViewsPreserved:sourceViewCount,
  vertices:position.count, triangles:index.count/3, movingVertices, armVertices, maxWeightsPerVertex:2,
  field:{weldedNodes:nodeCount,freeNodes:free.length,iterations,relativeResidual:Math.sqrt(rz/initial)},
  bones:rigBoneNames.map((name,i) => ({name,parent:parents[i],restPosition:restPositions[i].toArray(),worldPosition:worldPositions[i].toArray()})),
  clips:doc.animations.map(a => a.name), profileSHA256:sha(await fs.readFile(path.join(root,'assets/source-reference/saju-b-rigged-greeting-v001/rig-profile.json')))};
await fs.writeFile(path.join(output,'rig-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await fs.writeFile(path.join(output,'SHA256SUMS.txt'),`${sha(result)}  ${assetName}\n`);
console.log(`Authored ${profile.version}: ${bones.length} bones, ${movingVertices} moving vertices; original ${binary.length} BIN bytes preserved.`);
