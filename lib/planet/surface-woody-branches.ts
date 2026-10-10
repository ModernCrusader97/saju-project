import * as THREE from 'three';
import { MeshSurface, seeded, type SurfaceAnchor } from './mesh-surface';
import { isSurfaceAttachmentExcluded } from './surface-attachment-exclusions';
import { supportAffineInstanceNormals } from './affine-instance-normals';
import type { SurfaceAccentOptions, SurfaceStemAccents } from './surface-stem-accents';

const Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1), TAU = Math.PI * 2;
interface BranchAnchor { anchor: SurfaceAnchor; length: number; variant: number; roll: number }
interface CollisionFace { triangle: THREE.Triangle; bounds: THREE.Box3; center: THREE.Vector3 }
interface CollisionNode { bounds: THREE.Box3; faces?: CollisionFace[]; children?: CollisionNode[] }

/** A creation-only broad phase over actual posed triangles. Curved sweeps
 * must not perform a complete GLB face scan for every tiny tube segment. */
function createBodyCollisionQuery(meshes: THREE.Mesh[], allowMorphTargets?: boolean): (origin: THREE.Vector3, direction: THREE.Vector3, near: number, far: number) => boolean {
  const faces: CollisionFace[] = [];
  for (const mesh of meshes) {
    const position = mesh.geometry.getAttribute('position'), index = mesh.geometry.index;
    const vertices = Array.from({ length: position.count }, (_, id) => {
      const point = new THREE.Vector3();
      if (allowMorphTargets) mesh.getVertexPosition(id, point); else point.fromBufferAttribute(position, id);
      return point.applyMatrix4(mesh.matrixWorld);
    });
    const count = index?.count ?? position.count;
    for (let offset = 0; offset + 2 < count; offset += 3) {
      const triangle = new THREE.Triangle(...[0, 1, 2].map(i => vertices[index ? index.getX(offset + i) : offset + i]) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]);
      if (triangle.getArea() < 1e-14) continue;
      const bounds = new THREE.Box3().expandByPoint(triangle.a).expandByPoint(triangle.b).expandByPoint(triangle.c);
      faces.push({ triangle, bounds, center: triangle.getMidpoint(new THREE.Vector3()) });
    }
  }
  function build(items: CollisionFace[]): CollisionNode {
    const bounds = items.reduce((box, face) => box.union(face.bounds), new THREE.Box3());
    if (items.length <= 10) return { bounds, faces: items };
    const size = bounds.getSize(new THREE.Vector3()), axis = size.x > size.y && size.x > size.z ? 0 : size.y > size.z ? 1 : 2;
    items.sort((a, b) => a.center.getComponent(axis) - b.center.getComponent(axis));
    const mid = items.length >>> 1;
    return { bounds, children: [build(items.slice(0, mid)), build(items.slice(mid))] };
  }
  const tree = build(faces), ray = new THREE.Ray(), hit = new THREE.Vector3(), boxHit = new THREE.Vector3();
  function intersects(node: CollisionNode, near: number, far: number): boolean {
    if (!ray.intersectBox(node.bounds, boxHit)) return false;
    if (!node.bounds.containsPoint(ray.origin) && boxHit.distanceTo(ray.origin) > far) return false;
    if (node.children) return node.children.some(child => intersects(child, near, far));
    return node.faces!.some(({ triangle }) => {
      if (!ray.intersectTriangle(triangle.a, triangle.b, triangle.c, false, hit)) return false;
      const distance = hit.distanceTo(ray.origin);
      return distance > near && distance < far;
    });
  }
  return (origin, direction, near, far) => { if (far <= near) return false; ray.set(origin, direction); return intersects(tree, near, far); };
}

/** Named eye/brow/mouth parts are transformed into the actual body frame. */
export function createSurfaceFaceGuard(meshes: THREE.Mesh[], worldPadding: number): (anchor: SurfaceAnchor, localPosition: THREE.Vector3) => boolean {
  const boxes = new Map<THREE.Mesh, THREE.Box3>();
  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false);
    const inverse = mesh.matrixWorld.clone().invert(), box = new THREE.Box3();
    (mesh.parent ?? mesh).traverse(object => {
      const part = object as THREE.Mesh;
      if (!part.isMesh || !/almond_gaze|quiet_smile|expressive_brow|small_eye_glint/.test(part.name)) return;
      part.updateWorldMatrix(true, false); part.geometry.computeBoundingBox();
      if (part.geometry.boundingBox) box.union(part.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(part.matrixWorld)));
    });
    if (!box.isEmpty()) {
      const e = inverse.elements;
      box.expandByVector(new THREE.Vector3(Math.hypot(e[0], e[4], e[8]), Math.hypot(e[1], e[5], e[9]), Math.hypot(e[2], e[6], e[10])).multiplyScalar(worldPadding));
      boxes.set(mesh, box);
    }
  }
  return (anchor, point) => boxes.get(anchor.mesh)?.containsPoint(point) ??
    (anchor.mesh.name === 'expressive-element-head' && point.z > .10 && Math.abs(point.x) < .265 && point.y < .23 && point.y > -.23);
}

function merge(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const count = geometries.reduce((n, g) => n + g.getAttribute('position').count, 0);
  const p = new Float32Array(count * 3), n = new Float32Array(count * 3), indices: number[] = []; let offset = 0;
  for (const g of geometries) {
    const position = g.getAttribute('position'); p.set(position.array, offset * 3); n.set(g.getAttribute('normal').array, offset * 3);
    const index = g.index!; for (let i = 0; i < index.count; i++) indices.push(index.getX(i) + offset);
    offset += position.count; g.dispose();
  }
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.BufferAttribute(p, 3)); result.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  result.setIndex(indices); result.computeBoundingSphere(); return result;
}
function tapered(curve: THREE.Curve<THREE.Vector3>, radius: number, segments: number): THREE.BufferGeometry {
  const g = new THREE.TubeGeometry(curve, segments, radius, 6, false), p = g.getAttribute('position');
  for (let row = 0; row <= segments; row++) {
    const t = row / segments, center = curve.getPointAt(t), width = .12 + 1.38 * Math.pow(1 - t, .72);
    for (let j = 0; j <= 6; j++) {
      const i = row * 7 + j;
      p.setXYZ(i, center.x + (p.getX(i) - center.x) * width, center.y + (p.getY(i) - center.y) * width, center.z + (p.getZ(i) - center.z) * width);
    }
  }
  g.computeVertexNormals(); return g;
}
function branchCurves(variant: number): THREE.Curve<THREE.Vector3>[] {
  const bend = .23 + .055 * variant, sign = variant % 2 ? 1 : -1;
  class Trunk extends THREE.Curve<THREE.Vector3> {
    constructor() { super(); }
    getPoint(t: number, out = new THREE.Vector3()) {
      const u = Math.max(0, (t - .28) / .72);
      return out.set(sign * bend * u * u, t, .12 * Math.sin(u * Math.PI * .75) * u * u);
    }
  }
  const trunk = new Trunk(), curves: THREE.Curve<THREE.Vector3>[] = [trunk];
  for (let fork = 0; fork < 2; fork++) {
    const root = trunk.getPoint(.52 + fork * .19);
    const tip = root.clone().add(new THREE.Vector3((fork ? -.28 : .31) * sign, .35 - fork * .05, fork ? .19 : -.16));
    curves.push(new THREE.QuadraticBezierCurve3(root, root.clone().lerp(tip, .55).add(new THREE.Vector3(0, .08, 0)), tip));
  }
  return curves;
}
export function createSurfaceWoodyBranches(options: SurfaceAccentOptions): SurfaceStemAccents {
  const sampler = new MeshSurface(options.meshes, { allowMorphTargets: options.allowMorphTargets });
  const size = sampler.bounds.getSize(new THREE.Vector3()), unit = options.detailScale ?? Math.min(size.x, size.y, size.z) * .5;
  if (!Number.isFinite(unit) || unit <= 0) throw new RangeError('detailScale must be positive.');
  const high = options.quality !== 'low', desired = high ? 44 : 30, group = new THREE.Group(); group.name = 'SurfaceStemAccents_甲';
  const prototypes = Array.from({ length: 4 }, (_, variant) => branchCurves(variant));
  const anchors: BranchAnchor[] = [], worldPoints: THREE.Vector3[] = [];
  const identity = new THREE.Group(), faceExcluded = createSurfaceFaceGuard(options.meshes, Math.max(unit * .15, .08));
  let collisionQuery: ReturnType<typeof createBodyCollisionQuery> | undefined = createBodyCollisionQuery(options.meshes, options.allowMorphTargets);
  const edge = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), tangent = new THREE.Vector3(), binormal = new THREE.Vector3();
  const frame = new THREE.Matrix4(), worldMatrix = new THREE.Matrix4(), worldQuaternion = new THREE.Quaternion(), spin = new THREE.Quaternion();
  const rootWorld = new THREE.Vector3(), normalWorld = new THREE.Vector3(), curvePoint = new THREE.Vector3(), previous = new THREE.Vector3(), delta = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1), zero = new THREE.Vector3(0, 0, 0);
  function orient(anchor: SurfaceAnchor, normal: THREE.Vector3, roll: number): THREE.Quaternion {
    const mesh = anchor.mesh, index = mesh.geometry.index, position = mesh.geometry.getAttribute('position');
    const vertex = (offset: number, out: THREE.Vector3) => {
      const id = index ? index.getX(anchor.triangle * 3 + offset) : anchor.triangle * 3 + offset;
      if (options.allowMorphTargets) mesh.getVertexPosition(id, out); else out.fromBufferAttribute(position, id);
    };
    vertex(0, a); vertex(1, b); edge.subVectors(b, a).transformDirection(mesh.matrixWorld);
    tangent.copy(edge).addScaledVector(normal, -edge.dot(normal)).normalize();
    binormal.crossVectors(tangent, normal).normalize(); frame.makeBasis(tangent, normal, binormal);
    return worldQuaternion.setFromRotationMatrix(frame).multiply(spin.setFromAxisAngle(Y, roll));
  }
  // Check the same piecewise centerlines used by TubeGeometry, rather than a
  // single outward ray that misses curved tips and lateral forks.
  function curvedPathHits(variant: number, matrix: THREE.Matrix4): boolean {
    for (let curveIndex = 0; curveIndex < 3; curveIndex++) {
      const curve = prototypes[variant][curveIndex], steps = curveIndex ? (high ? 12 : 9) : (high ? 22 : 16);
      const first = curveIndex ? 0 : 3; previous.copy(curve.getPointAt(first / steps)).applyMatrix4(matrix);
      for (let step = first + 1; step <= steps; step++) {
        curvePoint.copy(curve.getPointAt(step / steps)).applyMatrix4(matrix); delta.subVectors(curvePoint, previous);
        if (collisionQuery!(previous, delta.clone().normalize(), 1e-6, delta.length() - 1e-6)) return true;
        previous.copy(curvePoint);
      }
    }
    return false;
  }
  try {
    for (let attempt = 0; attempt < desired * 40 && anchors.length < desired; attempt++) {
      const anchor = sampler.sample(attempt * 73 + 193), pose = sampler.resolve(anchor, identity), local = sampler.resolve(anchor, anchor.mesh), mesh = anchor.mesh;
      if (faceExcluded(anchor, local.position)) continue;
      if (pose.normal.y < -.55 && pose.position.y < sampler.bounds.min.y + unit * .14) continue;
      if (mesh.geometry instanceof THREE.TubeGeometry) {
        const uv = mesh.geometry.getAttribute('uv'), index = mesh.geometry.index; let u = 0;
        for (let j = 0; j < 3; j++) { const id = index ? index.getX(anchor.triangle * 3 + j) : anchor.triangle * 3 + j; u += uv.getX(id) * anchor.barycentric.getComponent(j); }
        if (u < .08 || u > .92) continue;
      }
      const length = unit * (.22 + .15 * seeded(attempt + 770));
      if (worldPoints.some(point => point.distanceToSquared(pose.position) < (unit * .13) ** 2)) continue;
      if (collisionQuery(pose.position.clone().addScaledVector(pose.normal, unit * .007), pose.normal, unit * .003, length * .82)) continue;
      const variant = anchors.length % 4, roll = seeded(attempt + 870) * TAU;
      rootWorld.copy(pose.position).addScaledVector(pose.normal, -unit * .006);
      worldMatrix.compose(rootWorld, orient(anchor, pose.normal, roll), one.clone().multiplyScalar(length));
      if (curvedPathHits(variant, worldMatrix)) continue;
      anchors.push({ anchor, length, variant, roll }); worldPoints.push(pose.position.clone());
    }
  } finally { collisionQuery = undefined; }
  const diagnostics = { supported: true, mode: 'normal-rooted-forked-woody-branches', anchorCount: anchors.length,
    limitations: [options.allowMorphTargets ? 'Roots and directions resolve current morph triangles; branch curves remain a rigid shape attached to each root.' : 'Neutral rigid topology only; roots follow actual triangle normals.',
      'Creation-time curved trunk/fork centerline collision filters; branch thickness and unrelated moving body parts have no continuous collision simulation.'] };
  const bark = new THREE.MeshStandardMaterial({ color: 0x795235, roughness: .9 });
  const leafMaterial = new THREE.MeshPhysicalMaterial({ color: 0x98b54e, roughness: .56, side: THREE.DoubleSide, clearcoat: .08 });
  supportAffineInstanceNormals(bark, 'surface-woody-affine-normals-v1');
  supportAffineInstanceNormals(leafMaterial, 'surface-woody-affine-normals-v1');
  const geometries: THREE.BufferGeometry[] = [], branches: THREE.InstancedMesh[] = [];
  const tips = prototypes.map(curves => curves.map(curve => curve.getPoint(1)));
  for (let variant = 0; variant < 4; variant++) {
    const geometry = merge(prototypes[variant].map((curve, i) => tapered(curve, i ? .035 - (i - 1) * .006 : .062, i ? (high ? 12 : 9) : (high ? 22 : 16))));
    geometries.push(geometry);
    const mesh = new THREE.InstancedMesh(geometry, bark, anchors.filter(anchor => anchor.variant === variant).length);
    mesh.name = `NormalRootedWoodyBranches_${variant}`; mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = true; branches.push(mesh); group.add(mesh);
  }
  const leafGeometry = new THREE.BufferGeometry();
  leafGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -.28, .45, .055, 0, 1, .12, .28, .45, .055, 0, .46, .13], 3));
  leafGeometry.setIndex([0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4]); leafGeometry.computeVertexNormals(); geometries.push(leafGeometry);
  const leaves = new THREE.InstancedMesh(leafGeometry, leafMaterial, anchors.length * 3); leaves.name = 'WoodyBranchTipLeaves'; leaves.frustumCulled = false; group.add(leaves);
  const batches = [...branches, leaves], inverse = new THREE.Matrix4(), instance = new THREE.Matrix4(), masked = new THREE.Matrix4();
  const leafDummy = new THREE.Object3D(), localRoot = new THREE.Vector3(), actual = new THREE.Vector3(), scale = new THREE.Vector3();
  const attachment = { branchCount: anchors.length, minWorldRootNormalDot: 1, rootInset: unit * .006, rootInitialStraightFraction: .28,
    hasWoodyForkGeometry: true, anchors: anchors.map(entry => entry.anchor) };
  group.userData.branchAttachment = attachment;
  let disposed = false;
  function update(time: number): void {
    if (disposed) return;
    if (!Number.isFinite(time)) throw new RangeError('Accent time must be finite.');
    group.updateWorldMatrix(true, false); inverse.copy(group.matrixWorld).invert(); const slots = [0, 0, 0, 0]; let minDot = 1;
    for (let i = 0; i < anchors.length; i++) {
      const entry = anchors[i], pose = sampler.resolve(entry.anchor, identity);
      normalWorld.copy(pose.normal); rootWorld.copy(pose.position).addScaledVector(normalWorld, -attachment.rootInset);
      orient(entry.anchor, normalWorld, entry.roll); worldMatrix.compose(rootWorld, worldQuaternion, scale.setScalar(entry.length));
      instance.copy(inverse).multiply(worldMatrix); localRoot.copy(pose.position).applyMatrix4(inverse);
      const excluded = isSurfaceAttachmentExcluded(group, localRoot); masked.copy(instance); if (excluded) masked.scale(zero);
      branches[entry.variant].setMatrixAt(slots[entry.variant]++, masked);
      actual.copy(Y).transformDirection(worldMatrix); minDot = Math.min(minDot, actual.dot(normalWorld));
      for (let j = 0; j < 3; j++) {
        leafDummy.position.copy(tips[entry.variant][j]).applyMatrix4(worldMatrix);
        leafDummy.quaternion.copy(worldQuaternion).multiply(spin.setFromAxisAngle(Z, (j - 1) * .7 + .10 * Math.sin(time * .9 + i + j)))
          .multiply(spin.setFromAxisAngle(Y, .6 * j));
        leafDummy.scale.setScalar(excluded ? 0 : entry.length * (j === 0 ? .31 : .26)); leafDummy.updateMatrix();
        instance.copy(inverse).multiply(leafDummy.matrix); leaves.setMatrixAt(i * 3 + j, instance);
      }
    }
    attachment.minWorldRootNormalDot = minDot; for (const mesh of batches) mesh.instanceMatrix.needsUpdate = true;
  }
  function dispose(): void {
    if (disposed) return; disposed = true; group.removeFromParent();
    for (const mesh of batches) mesh.dispose(); for (const geometry of geometries) geometry.dispose(); bark.dispose(); leafMaterial.dispose(); group.clear();
  }
  update(0); return { group, update, dispose, diagnostics };
}
