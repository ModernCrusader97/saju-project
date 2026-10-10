import * as THREE from 'three';
import { seeded, type SurfaceAnchor, type SurfacePose } from './mesh-surface';
import { SurfaceTriangleWalker } from './surface-triangle-walk';
import { isSurfaceAttachmentExcluded } from './surface-attachment-exclusions';
import { createSurfaceFaceGuard } from './surface-woody-branches';
import type { SurfaceAccentOptions, SurfaceStemAccents } from './surface-stem-accents';

const Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1), TAU = Math.PI * 2;
interface Node {
  anchors: SurfaceAnchor[];
  normals: THREE.Vector3[];
  source: THREE.Vector3;
  center: THREE.Vector3;
  fraction: number;
}
interface Leaf {
  anchor: SurfaceAnchor;
  segment: number;
  fraction: number;
  progress: number;
  roll: number;
  revealAge: number;
}
interface Vine {
  anchors: SurfaceAnchor[];
  nodes: Node[];
  leaves: Leaf[];
  length: number;
  segmentOffset: number;
  jointOffset: number;
  phase: number;
  period: number;
}
const smooth = (value: number, from: number, to: number) => {
  const t = THREE.MathUtils.clamp((value - from) / (to - from), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Short connected crawls. Rest-topology edges select stable IDs; the resolved
 * triangle positions/normals follow each current rigid or opted-in morph pose. */
export function createSurfaceCreepingVines(options: SurfaceAccentOptions): SurfaceStemAccents {
  const walker = new SurfaceTriangleWalker(options.meshes, { allowMorphTargets: options.allowMorphTargets });
  const sampler = walker.sampler, size = sampler.bounds.getSize(new THREE.Vector3());
  const unit = options.detailScale ?? Math.min(size.x, size.y, size.z) * .5;
  if (!Number.isFinite(unit) || unit <= 0) throw new RangeError('detailScale must be positive.');
  const high = options.quality !== 'low', desired = high ? 10 : 6, maxSteps = high ? 36 : 24;
  const group = new THREE.Group(); group.name = 'SurfaceStemAccents_乙';
  const identity = new THREE.Group(), faceExcluded = createSurfaceFaceGuard(options.meshes, Math.max(unit * .15, .08));
  const vines: Vine[] = [], roots: THREE.Vector3[] = [];
  const hasMorphSurface = options.allowMorphTargets && options.meshes.some(mesh => mesh.geometry.morphAttributes.position?.length);
  const morphDelta = new THREE.Vector3(), morphVertex = new THREE.Vector3(), baseVertex = new THREE.Vector3();
  // Reserve one stable crawl on an existing moving surface when morphs are
  // enabled. Remaining roots keep the same area-weighted selection; accessory
  // changes and animation never resample any path.
  function hasMovingMorph(anchor: SurfaceAnchor): boolean {
    const mesh = anchor.mesh, position = mesh.geometry.getAttribute('position'), index = mesh.geometry.index;
    return (mesh.geometry.morphAttributes.position ?? []).some(attribute => {
      morphDelta.set(0, 0, 0);
      for (let i = 0; i < 3; i++) {
        const id = index ? index.getX(anchor.triangle * 3 + i) : anchor.triangle * 3 + i;
        morphVertex.fromBufferAttribute(attribute, id);
        if (!mesh.geometry.morphTargetsRelative) morphVertex.sub(baseVertex.fromBufferAttribute(position, id));
        morphDelta.addScaledVector(morphVertex, anchor.barycentric.getComponent(i));
      }
      return morphDelta.applyMatrix3(new THREE.Matrix3().setFromMatrix4(mesh.matrixWorld)).length() > unit * .20;
    });
  }
  let segmentCount = 0, jointCount = 0;

  for (let attempt = 0; attempt < desired * 60 && vines.length < desired; attempt++) {
    const anchor = sampler.sample(attempt * 83 + 631), root = sampler.resolve(anchor, identity);
    if (!vines.length && hasMorphSurface && attempt < desired * 40 && !hasMovingMorph(anchor)) continue;
    if (root.normal.y < -.55 && root.position.y < sampler.bounds.min.y + unit * .14) continue;
    if (roots.some(point => point.distanceToSquared(root.position) < (unit * .24) ** 2)) continue;
    const scale = anchor.mesh.matrixWorld.getMaxScaleOnAxis();
    const direction = new THREE.Vector3((seeded(attempt + 31) - .5) * 1.2, .55 + seeded(attempt + 89), (seeded(attempt + 47) - .5) * .65);
    const anchors = walker.path(anchor, { direction, length: unit * (.48 + .22 * seeded(attempt + 127)) / scale, maxSteps });
    const nodes: Node[] = [];
    let length = 0, rejected = false;
    for (const item of anchors) {
      const local = sampler.resolve(item, item.mesh);
      if (faceExcluded(item, local.position)) { rejected = true; break; }
      const previous = nodes[nodes.length - 1];
      // A shared edge occurs twice: retain both incident face anchors to place
      // the tube outside both planes, while creating a single connected joint.
      if (previous && previous.source.distanceToSquared(local.position) < 1e-16) previous.anchors.push(item);
      else {
        if (previous) length += previous.source.distanceTo(local.position);
        nodes.push({ anchors: [item], normals: [], source: local.position.clone(), center: new THREE.Vector3(), fraction: length });
      }
    }
    if (rejected || nodes.length < 3 || length < unit * .13 / scale) continue;
    // Sharp/ambiguous creases are stopped by the walker. Also reject a corner
    // whose incident normals cannot share a small, outward offset direction.
    for (const node of nodes) {
      const normals = node.anchors.map(item => sampler.resolve(item, identity).normal);
      const average = normals.reduce((sum, normal) => sum.add(normal), new THREE.Vector3()).normalize();
      if (normals.some(normal => average.dot(normal) < .55)) rejected = true;
      node.normals = node.anchors.map(() => new THREE.Vector3());
      node.fraction /= length;
    }
    if (rejected) continue;
    const leaves: Leaf[] = [.27, .61, 1].map((progress, index) => {
      let segment = 0;
      while (segment < nodes.length - 2 && nodes[segment + 1].fraction < progress) segment++;
      const from = nodes[segment].fraction, to = nodes[segment + 1].fraction;
      let lo = 0, hi = .66;
      for (let i = 0; i < 28; i++) {
        const mid = (lo + hi) * .5;
        if (.10 + .90 * smooth(mid, 0, .66) < progress) lo = mid; else hi = mid;
      }
      return { anchor: walker.interpolate(anchors, progress), segment, fraction: (progress - from) / (to - from), progress,
        roll: (index % 2 ? 1 : -1) * .75 + seeded(attempt + index * 17 + 449) * TAU, revealAge: hi };
    });
    vines.push({ anchors, nodes, leaves, length, segmentOffset: segmentCount, jointOffset: jointCount,
      phase: seeded(attempt + 907) * .78, period: 22 + seeded(attempt + 919) * 12 });
    segmentCount += nodes.length - 1; jointCount += nodes.length + 1; roots.push(root.position.clone());
  }

  const tubeGeometry = new THREE.CylinderGeometry(1, 1, 1, high ? 7 : 6, 1, false);
  const jointGeometry = new THREE.SphereGeometry(1, 6, high ? 5 : 4);
  const leafGeometry = new THREE.BufferGeometry();
  leafGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -.29, .44, .045, 0, 1, .12, .29, .44, .045, 0, .46, .13], 3));
  leafGeometry.setIndex([0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4]); leafGeometry.computeVertexNormals();
  const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x587337, roughness: .82 });
  const leafMaterial = new THREE.MeshPhysicalMaterial({ color: 0x91ba4d, roughness: .57, side: THREE.DoubleSide, clearcoat: .07 });
  const segments = new THREE.InstancedMesh(tubeGeometry, stemMaterial, segmentCount);
  const joints = new THREE.InstancedMesh(jointGeometry, stemMaterial, jointCount);
  const leaves = new THREE.InstancedMesh(leafGeometry, leafMaterial, vines.length * 3);
  segments.name = 'ConnectedVineSegments'; joints.name = 'ConnectedVineJoints'; leaves.name = 'ConnectedVineLeaves';
  const batches = [segments, joints, leaves];
  for (const mesh of batches) { mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); }

  const diagnostics = { supported: true, mode: 'connected-triangle-short-creeping-vines', anchorCount: vines.length,
    limitations: ['Short edge-connected crawls only; this does not wrap vines around the entire body.',
      options.allowMorphTargets ? 'Rest-topology paths resolve actual posed morph triangles each frame; skinned surfaces are unsupported.' : 'Neutral rigid topology only; skinned and active morph surfaces are unsupported.',
      'Tube offsets clear their incident triangle planes; unrelated moving parts have no physical collision simulation.'] };
  const attachment = {
    pathCount: vines.length, leafCount: vines.length * 3, segmentCount, jointCount, maxLeafRootToStemDistance: 0,
    paths: vines.map(vine => ({ anchors: vine.anchors, length: vine.length })),
    segmentAnchors: vines.flatMap(vine => vine.nodes.slice(0, -1).map((node, index) => ({
      from: node.anchors[node.anchors.length - 1], to: vine.nodes[index + 1].anchors[0],
    }))),
    radius: unit * .0075, minIncidentPlaneClearance: 0,
  };
  group.userData.vineAttachment = attachment;
  const pose: SurfacePose = { position: new THREE.Vector3(), normal: new THREE.Vector3() };
  const dummy = new THREE.Object3D(), inverse = new THREE.Matrix4(), normals = new THREE.Matrix3(), linear = new THREE.Matrix3();
  const worldPoint = new THREE.Vector3(), worldNormal = new THREE.Vector3(), average = new THREE.Vector3();
  const delta = new THREE.Vector3(), tangent = new THREE.Vector3(), tip = new THREE.Vector3(), leafRoot = new THREE.Vector3(), leafNormal = new THREE.Vector3();
  const spin = new THREE.Quaternion(), wind = new THREE.Quaternion();
  let disposed = false;

  function update(time: number): void {
    if (disposed) return;
    if (!Number.isFinite(time)) throw new RangeError('Accent time must be finite.');
    group.updateWorldMatrix(true, false); inverse.copy(group.matrixWorld).invert();
    normals.getNormalMatrix(group.matrixWorld); linear.setFromMatrix4(group.matrixWorld);
    // Frobenius bounds the largest singular value even with shear from rotated
    // nonuniform parents. A tube's full radial cross-section stays outside each
    // source triangle plane, rather than just placing its centerline outside.
    const e = linear.elements, radiusBound = attachment.radius * Math.hypot(...e);
    let minClearance = Infinity, maxLeafDistance = 0;
    for (let v = 0; v < vines.length; v++) {
      const vine = vines[v], age = THREE.MathUtils.euclideanModulo(time / vine.period + vine.phase, 1);
      const growth = .10 + .90 * smooth(age, 0, .66), life = smooth(age, 0, .10) * (1 - smooth(age, .86, 1));
      for (const node of vine.nodes) {
        average.set(0, 0, 0);
        for (let i = 0; i < node.anchors.length; i++) {
          sampler.resolve(node.anchors[i], group, pose);
          worldPoint.copy(pose.position).applyMatrix4(group.matrixWorld);
          node.normals[i].copy(pose.normal).applyNormalMatrix(normals); average.add(node.normals[i]);
        }
        average.normalize();
        let dot = 1;
        for (let i = 0; i < node.anchors.length; i++) dot = Math.min(dot, average.dot(node.normals[i]));
        const distance = (radiusBound * 1.12 + unit * .0015) / Math.max(dot, .05);
        node.center.copy(worldPoint).addScaledVector(average, distance).applyMatrix4(inverse);
        minClearance = Math.min(minClearance, distance * dot - radiusBound);
      }
      let tipSegment = 0;
      for (let n = 0; n < vine.nodes.length - 1; n++) {
        const from = vine.nodes[n], to = vine.nodes[n + 1];
        const reveal = THREE.MathUtils.clamp((growth - from.fraction) / (to.fraction - from.fraction), 0, 1);
        tip.copy(from.center).lerp(to.center, reveal); delta.copy(tip).sub(from.center);
        dummy.position.copy(from.center).lerp(tip, .5); dummy.quaternion.setFromUnitVectors(Y, tangent.copy(delta).normalize());
        const hidden = !reveal || !life || isSurfaceAttachmentExcluded(group, dummy.position);
        dummy.scale.set(hidden ? 0 : attachment.radius * life, hidden ? 0 : delta.length(), hidden ? 0 : attachment.radius * life);
        dummy.updateMatrix(); segments.setMatrixAt(vine.segmentOffset + n, dummy.matrix);
        if (growth >= from.fraction) tipSegment = n;
      }
      for (let n = 0; n < vine.nodes.length; n++) {
        const node = vine.nodes[n]; dummy.position.copy(node.center); dummy.quaternion.identity();
        dummy.scale.setScalar(node.fraction <= growth && !isSurfaceAttachmentExcluded(group, node.center) ? attachment.radius * life : 0);
        dummy.updateMatrix(); joints.setMatrixAt(vine.jointOffset + n, dummy.matrix);
      }
      const a = vine.nodes[tipSegment], b = vine.nodes[tipSegment + 1];
      tip.copy(a.center).lerp(b.center, THREE.MathUtils.clamp((growth - a.fraction) / (b.fraction - a.fraction), 0, 1));
      dummy.position.copy(tip); dummy.quaternion.identity();
      dummy.scale.setScalar(isSurfaceAttachmentExcluded(group, tip) ? 0 : attachment.radius * life);
      dummy.updateMatrix(); joints.setMatrixAt(vine.jointOffset + vine.nodes.length, dummy.matrix);
      for (let j = 0; j < vine.leaves.length; j++) {
        const leaf = vine.leaves[j];
        leafRoot.copy(vine.nodes[leaf.segment].center).lerp(vine.nodes[leaf.segment + 1].center, leaf.fraction);
        sampler.resolve(leaf.anchor, group, pose);
        worldNormal.copy(pose.normal).applyNormalMatrix(normals); leafNormal.copy(worldNormal).transformDirection(inverse);
        dummy.position.copy(leafRoot); dummy.quaternion.setFromUnitVectors(Y, leafNormal);
        dummy.quaternion.multiply(spin.setFromAxisAngle(Y, leaf.roll)).multiply(wind.setFromAxisAngle(Z, .08 * Math.sin(time * .75 + v * 1.7 + j)));
        const directionScale = delta.copy(Y).applyQuaternion(dummy.quaternion).applyMatrix3(linear).length();
        const bloom = smooth(age, leaf.revealAge, leaf.revealAge + .12);
        dummy.scale.setScalar(growth < leaf.progress || isSurfaceAttachmentExcluded(group, leafRoot) ? 0 : unit * (j === 2 ? .17 : .14) * life * bloom / directionScale);
        dummy.updateMatrix(); leaves.setMatrixAt(v * 3 + j, dummy.matrix);
        maxLeafDistance = Math.max(maxLeafDistance, dummy.position.distanceTo(leafRoot));
      }
    }
    attachment.maxLeafRootToStemDistance = maxLeafDistance;
    attachment.minIncidentPlaneClearance = minClearance === Infinity ? 0 : minClearance;
    for (const mesh of batches) mesh.instanceMatrix.needsUpdate = true;
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true; group.removeFromParent();
    for (const mesh of batches) mesh.dispose();
    tubeGeometry.dispose(); jointGeometry.dispose(); leafGeometry.dispose(); stemMaterial.dispose(); leafMaterial.dispose(); group.clear();
  }
  update(0);
  return { group, update, dispose, diagnostics };
}
