import * as THREE from 'three';

const LIFT_STEPS = 8;
const ARM_ANGLE = 110 * Math.PI / 180;
const WRIST_ANGLE = .40;
const ARM_PIVOT = new THREE.Vector3(.57, 1.32, .09);
const WRIST_REST = new THREE.Vector3(.67, 1.00, .14);
const Z = new THREE.Vector3(0, 0, 1);
const smoother = (value: number) => {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

interface ArmPoseData {
  positions: Float32Array[];
  normals: Float32Array[];
  bounds: THREE.Box3;
  sphere: THREE.Sphere;
  handVertexIDs: number[];
  field: { weldedNodes: number; freeNodes: number; handNodes: number; iterations: number; relativeResidual: number };
}
// A GLTF clone can share its immutable source geometry. Cached CPU pose arrays
// are immutable; each runtime receives its own attribute objects and geometry.
const poseCache = new WeakMap<THREE.BufferGeometry, ArmPoseData>();
type SourceAttribute = THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
interface AttributeBytes { schema: string; bytes: Uint8Array }
interface VerifiedPoseCache { position: AttributeBytes; normal: AttributeBytes; index: AttributeBytes; data: ArmPoseData }
// The loader reparses the same approved file on stem changes. Keep one immutable
// pose entry across parses, verified against every position/normal/index byte.
// Counts and names alone never select a cached deformation. Nonmatching sources
// can only use their own weak geometry entry and cannot replace this shared one.
let verifiedPoseCache: VerifiedPoseCache | undefined;
const attributeBytes = (attribute: SourceAttribute | null | undefined): AttributeBytes | undefined => {
  if (!(attribute instanceof THREE.BufferAttribute)) return;
  const array = attribute.array;
  return { schema: `${array.constructor.name}:${attribute.itemSize}:${attribute.count}:${attribute.normalized}`,
    bytes: new Uint8Array(array.buffer, array.byteOffset, array.byteLength) };
};
const sameBytes = (a: AttributeBytes | undefined, b: AttributeBytes) => {
  if (!a || a.schema !== b.schema || a.bytes.length !== b.bytes.length) return false;
  for (let i = 0; i < a.bytes.length; i++) if (a.bytes[i] !== b.bytes[i]) return false;
  return true;
};

/** Solve a continuous arm field on the actual B mesh connectivity. The source
 * has no skin or skeleton. Hard constraints retain head, feet and the left side;
 * inverse squared edge lengths prevent short source edges becoming sharp creases.
 * Quintic remapping softens the boundary at the connected shoulder and mitten. */
function deriveArmPoses(source: THREE.BufferGeometry): ArmPoseData {
  const p = source.getAttribute('position'), normal = source.getAttribute('normal'), index = source.index;
  if (!index || !normal || p.count !== 33207 || !source.morphTargetsRelative) {
    throw new Error('Raised arm controls require the original indexed, relative-morph B geometry.');
  }
  const nodeByPosition = new Map<string, number>(), vertexNodes = new Uint32Array(p.count), rest: number[] = [];
  const handVertexIDs: number[] = [];
  for (let id = 0; id < p.count; id++) {
    const x = p.getX(id), y = p.getY(id), z = p.getZ(id);
    const key = `${Math.round(x * 1e6)}:${Math.round(y * 1e6)}:${Math.round(z * 1e6)}`;
    let node = nodeByPosition.get(key);
    if (node === undefined) { node = rest.length / 3; nodeByPosition.set(key, node); rest.push(x, y, z); }
    vertexNodes[id] = node;
    if (x > .69 && y > .70 && y < .87) handVertexIDs.push(id);
  }
  const nodes = rest.length / 3, neighbors = Array.from({ length: nodes }, () => new Set<number>());
  for (let offset = 0; offset < index.count; offset += 3) {
    const a = vertexNodes[index.getX(offset)], b = vertexNodes[index.getX(offset + 1)], c = vertexNodes[index.getX(offset + 2)];
    for (const [x, y] of [[a, b], [b, c], [c, a]]) if (x !== y) { neighbors[x].add(y); neighbors[y].add(x); }
  }
  const flags = new Uint8Array(nodes), free: number[] = [], handles: number[] = [];
  for (let node = 0; node < nodes; node++) {
    const x = rest[node * 3], y = rest[node * 3 + 1], z = rest[node * 3 + 2];
    if (x > .25 && y > .52 && y < 1.40) flags[node] = 1;
    if (x > .64 && y > .61 && y < .96 && Math.abs(z - .16) < .24) flags[node] = 2;
    if (flags[node] === 1) free.push(node);
    else if (flags[node] === 2) handles.push(node);
  }
  const freeID = new Int32Array(nodes).fill(-1); free.forEach((node, id) => { freeID[node] = id; });
  const starts = new Uint32Array(free.length + 1), edgeIDs: number[] = [], edgeValues: number[] = [];
  const diagonal = new Float64Array(free.length), rhs = new Float64Array(free.length);
  for (let id = 0; id < free.length; id++) {
    const node = free[id]; starts[id] = edgeIDs.length;
    for (const other of neighbors[node]) {
      const dx = rest[node * 3] - rest[other * 3], dy = rest[node * 3 + 1] - rest[other * 3 + 1], dz = rest[node * 3 + 2] - rest[other * 3 + 2];
      const weight = 1 / Math.max(dx * dx + dy * dy + dz * dz, 1e-8);
      edgeIDs.push(other); edgeValues.push(weight); diagonal[id] += weight;
      if (flags[other] === 2) rhs[id] += weight;
    }
    if (!diagonal[id]) throw new Error('The original B arm must have connected triangles.');
  }
  starts[free.length] = edgeIDs.length;
  const x = new Float64Array(free.length), residual = rhs.slice(), direction = new Float64Array(free.length),
    z = new Float64Array(free.length), product = new Float64Array(free.length);
  let rz = 0;
  for (let id = 0; id < free.length; id++) { direction[id] = z[id] = residual[id] / diagonal[id]; rz += residual[id] * z[id]; }
  const initialResidual = rz;
  let iterations = 0;
  while (iterations < 800 && rz > initialResidual * 1e-20) {
    for (let id = 0; id < free.length; id++) {
      let value = diagonal[id] * direction[id];
      for (let edge = starts[id]; edge < starts[id + 1]; edge++) {
        const other = freeID[edgeIDs[edge]];
        if (other >= 0) value -= edgeValues[edge] * direction[other];
      }
      product[id] = value;
    }
    let dot = 0;
    for (let id = 0; id < free.length; id++) dot += direction[id] * product[id];
    const alpha = rz / dot;
    let next = 0;
    for (let id = 0; id < free.length; id++) {
      x[id] += alpha * direction[id]; residual[id] -= alpha * product[id]; z[id] = residual[id] / diagonal[id]; next += residual[id] * z[id];
    }
    const beta = next / rz;
    for (let id = 0; id < free.length; id++) direction[id] = z[id] + beta * direction[id];
    rz = next; iterations++;
  }
  const relativeResidual = Math.sqrt(rz / initialResidual);
  if (!Number.isFinite(relativeResidual) || relativeResidual > 1e-7) throw new Error('The original B arm control field did not converge.');
  const weights = new Float64Array(nodes);
  for (const node of handles) weights[node] = 1;
  free.forEach((node, id) => { weights[node] = smoother(x[id]); });

  const positions: Float32Array[] = [], normals: Float32Array[] = [];
  const bounds = new THREE.Box3(), posed = new Float64Array(p.count * 3);
  const point = new THREE.Vector3(), wrist = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let id = 0; id < p.count; id++) bounds.expandByPoint(point.fromBufferAttribute(p, id));
  const accumulated = new Float64Array(nodes * 3), changedNormals = new Uint8Array(nodes);
  const poses: [number, number][] = Array.from({ length: LIFT_STEPS }, (_, id) => [(id + 1) / LIFT_STEPS, 0]);
  poses.push([1, -WRIST_ANGLE], [1, WRIST_ANGLE]);
  for (const [lift, wave] of poses) {
    const angle = ARM_ANGLE * lift;
    wrist.copy(WRIST_REST).sub(ARM_PIVOT).applyAxisAngle(Z, angle).add(ARM_PIVOT); wrist.z += .03 * lift;
    const deltas = new Float32Array(p.count * 3), normalDeltas = new Float32Array(p.count * 3);
    for (let id = 0; id < p.count; id++) {
      const weight = weights[vertexNodes[id]];
      point.fromBufferAttribute(p, id);
      if (weight) {
        point.sub(ARM_PIVOT).applyAxisAngle(Z, angle * weight).add(ARM_PIVOT); point.z += .03 * lift * weight;
        if (wave) {
          const roll = wave * weight * smoother((1.08 - p.getY(id)) / .25), dx = point.x - wrist.x, dy = point.y - wrist.y;
          point.x = wrist.x + dx * Math.cos(roll) - dy * Math.sin(roll);
          point.y = wrist.y + dx * Math.sin(roll) + dy * Math.cos(roll);
        }
        deltas[id * 3] = point.x - p.getX(id); deltas[id * 3 + 1] = point.y - p.getY(id); deltas[id * 3 + 2] = point.z - p.getZ(id);
      }
      // Use exactly the Float32 deltas rendered by native Three morphing.
      point.set(p.getX(id) + deltas[id * 3], p.getY(id) + deltas[id * 3 + 1], p.getZ(id) + deltas[id * 3 + 2]);
      point.toArray(posed, id * 3); bounds.expandByPoint(point);
    }
    accumulated.fill(0); changedNormals.fill(0);
    for (let offset = 0; offset < index.count; offset += 3) {
      const ids = [index.getX(offset), index.getX(offset + 1), index.getX(offset + 2)];
      a.fromArray(posed, ids[0] * 3); b.fromArray(posed, ids[1] * 3).sub(a); c.fromArray(posed, ids[2] * 3).sub(a); b.cross(c);
      const changed = ids.some(id => deltas[id * 3] !== 0 || deltas[id * 3 + 1] !== 0 || deltas[id * 3 + 2] !== 0);
      for (const id of ids) {
        const node = vertexNodes[id]; accumulated[node * 3] += b.x; accumulated[node * 3 + 1] += b.y; accumulated[node * 3 + 2] += b.z;
        if (changed) changedNormals[node] = 1;
      }
    }
    for (let id = 0; id < p.count; id++) {
      const node = vertexNodes[id]; if (!changedNormals[node]) continue;
      point.fromArray(accumulated, node * 3).normalize();
      normalDeltas[id * 3] = point.x - normal.getX(id); normalDeltas[id * 3 + 1] = point.y - normal.getY(id); normalDeltas[id * 3 + 2] = point.z - normal.getZ(id);
    }
    positions.push(deltas); normals.push(normalDeltas);
  }
  bounds.expandByScalar(5e-6);
  const sphere = bounds.getBoundingSphere(new THREE.Sphere());
  return { positions, normals, bounds, sphere, handVertexIDs,
    field: { weldedNodes: nodes, freeNodes: free.length, handNodes: handles.length, iterations, relativeResidual } };
}

export function createApprovedSpiritArmControls(body: THREE.Mesh) {
  const source = body.geometry, sourceDictionary = body.morphTargetDictionary, sourceInfluences = body.morphTargetInfluences;
  const sourcePositions = source.morphAttributes.position, sourceNormals = source.morphAttributes.normal;
  if (!sourceDictionary || !sourceInfluences || !sourcePositions || !sourceNormals || sourcePositions.length !== sourceNormals.length) {
    throw new Error('Original B position and normal morphs are required.');
  }
  let data = poseCache.get(source);
  if (!data) {
    const position = attributeBytes(source.getAttribute('position')), normal = attributeBytes(source.getAttribute('normal')), index = attributeBytes(source.index);
    const shared = verifiedPoseCache;
    if (shared && source.morphTargetsRelative && sameBytes(position, shared.position) && sameBytes(normal, shared.normal) && sameBytes(index, shared.index)) data = shared.data;
    else {
      data = deriveArmPoses(source);
      if (!verifiedPoseCache && position && normal && index) verifiedPoseCache = {
        position: { schema: position.schema, bytes: position.bytes.slice() }, normal: { schema: normal.schema, bytes: normal.bytes.slice() },
        index: { schema: index.schema, bytes: index.bytes.slice() }, data,
      };
    }
    poseCache.set(source, data);
  }
  const geometry = new THREE.BufferGeometry(); geometry.name = `${source.name}:runtime-raised-arm`;
  for (const [name, attribute] of Object.entries(source.attributes)) geometry.setAttribute(name, attribute);
  geometry.setIndex(source.index); geometry.morphTargetsRelative = source.morphTargetsRelative;
  for (const name of ['position', 'normal', 'color'] as const) {
    const attributes = source.morphAttributes[name]; if (attributes) geometry.morphAttributes[name] = attributes.slice();
  }
  geometry.groups = source.groups.map(group => ({ ...group })); geometry.setDrawRange(source.drawRange.start, source.drawRange.count);
  geometry.boundingBox = data.bounds.clone(); geometry.boundingSphere = data.sphere.clone();
  geometry.userData = { ...source.userData };
  const names = [...Array.from({ length: LIFT_STEPS }, (_, id) => `Runtime_arm_raise_${id + 1}`), 'Runtime_wrist_out', 'Runtime_wrist_in'];
  const dictionary = { ...sourceDictionary }, first = sourcePositions.length;
  const derivedPositions = geometry.morphAttributes.position!, derivedNormals = geometry.morphAttributes.normal!;
  names.forEach((name, id) => {
    const position = new THREE.BufferAttribute(data!.positions[id], 3), normal = new THREE.BufferAttribute(data!.normals[id], 3);
    position.name = normal.name = name;
    derivedPositions.push(position); derivedNormals.push(normal);
    dictionary[name] = first + id;
  });
  const influences = [...sourceInfluences, ...names.map(() => 0)];
  body.geometry = geometry; body.morphTargetDictionary = dictionary; body.morphTargetInfluences = influences;
  const controlIndices = names.map((_, id) => first + id), controlWeights = names.map(() => 0);
  let disposed = false;
  return {
    controlIndices, controlWeights, handVertexIDs: data.handVertexIDs, field: data.field,
    setPose(lift: number, wrist: number) {
      if (disposed) return;
      for (let id = first; id < influences.length; id++) influences[id] = 0;
      const amount = THREE.MathUtils.clamp(lift, 0, 1), sway = THREE.MathUtils.clamp(wrist, -1, 1);
      if (amount > 0 && amount < 1) {
        const frame = amount * LIFT_STEPS, low = Math.floor(frame), fraction = frame - low;
        if (low > 0) influences[first + low - 1] = 1 - fraction;
        influences[first + low] = fraction;
      } else if (amount === 1) {
        influences[first + LIFT_STEPS - 1] = 1 - Math.abs(sway);
        if (sway) influences[first + LIFT_STEPS + (sway > 0 ? 1 : 0)] = Math.abs(sway);
      }
      for (let id = 0; id < names.length; id++) controlWeights[id] = influences[first + id];
    },
    dispose() {
      if (disposed) return; disposed = true;
      // Dispose while every derived/rest attribute is still attached, so Three
      // releases native position, normal and morph-texture buffers correctly.
      geometry.dispose();
      body.geometry = source; body.morphTargetDictionary = sourceDictionary; body.morphTargetInfluences = sourceInfluences;
    },
  };
}
