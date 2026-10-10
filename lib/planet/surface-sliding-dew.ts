import * as THREE from 'three';
import { seeded, type SurfaceAnchor, type SurfacePose } from './mesh-surface';
import { SurfaceTriangleWalker } from './surface-triangle-walk';
import { isSurfaceAttachmentExcluded } from './surface-attachment-exclusions';
import type { SurfaceAccentOptions, SurfaceStemAccents } from './surface-stem-accents';

interface DewSource {
  path: SurfaceAnchor[];
  period: number;
  phase: number;
  radius: number;
}
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const fract = (value: number) => value - Math.floor(value);

/** Clear beads grow, follow real connected triangle edges, then evaporate.
 * Rest gravity sets the route; runtime rigid transforms move the entire route.
 * A bead never switches to a nearby disconnected arm or a sphere projection. */
export function createSurfaceSlidingDew(options: SurfaceAccentOptions): SurfaceStemAccents {
  const walker = new SurfaceTriangleWalker(options.meshes, { allowMorphTargets: options.allowMorphTargets }), sampler = walker.sampler;
  const extent = sampler.bounds.getSize(new THREE.Vector3());
  const unit = options.detailScale ?? Math.min(extent.x, extent.y, extent.z) * .5;
  if (!Number.isFinite(unit) || unit <= 0) throw new RangeError('detailScale must be positive.');
  const high = options.quality !== 'low', budget = high ? 80 : 48;
  const sources: DewSource[] = [];
  const initialPose: SurfacePose = { position: new THREE.Vector3(), normal: new THREE.Vector3() };
  const endPose: SurfacePose = { position: new THREE.Vector3(), normal: new THREE.Vector3() };
  const localBounds = new Map(options.meshes.map(mesh => {
    const box = new THREE.Box3(), vertex = new THREE.Vector3(), positions = mesh.geometry.getAttribute('position');
    for (let index = 0; index < positions.count; index++) box.expandByPoint(vertex.fromBufferAttribute(positions, index));
    return [mesh, box] as const;
  }));
  const inverseMesh = new THREE.Matrix4(), gravity = new THREE.Vector3(), scale = new THREE.Vector3();
  const facialPoint = new THREE.Vector3(), localSize = new THREE.Vector3();
  const avoidsFace = (anchor: SurfaceAnchor): boolean => {
    // The approved B face lies on the front of its upper half. Keep its existing
    // gaze, brows and mouth clear, and retain the same convention in fixtures.
    const box = localBounds.get(anchor.mesh)!;
    box.getSize(localSize);
    if (localSize.z < unit * .1) return true;
    sampler.resolve(anchor, anchor.mesh, initialPose);
    facialPoint.copy(initialPose.position).sub(box.min);
    return !(facialPoint.y > localSize.y * .58 && facialPoint.y < localSize.y * .87 &&
      Math.abs(facialPoint.x - localSize.x * .5) < localSize.x * .31 &&
      facialPoint.z > localSize.z * .66);
  };
  // A fixed upper bound also bounds construction time on tiny disconnected
  // patches. Such patches receive fewer beads rather than invented routes.
  for (let attempt = 0; attempt < budget * 24 && sources.length < budget; attempt++) {
    const anchor = sampler.sample(attempt * 43 + 120);
    if (!avoidsFace(anchor)) continue;
    anchor.mesh.updateWorldMatrix(true, false);
    inverseMesh.copy(anchor.mesh.matrixWorld).invert();
    gravity.set(0, -1, 0).transformDirection(inverseMesh);
    anchor.mesh.getWorldScale(scale);
    const maxScale = Math.max(Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z));
    const length = unit * (.32 + .22 * seeded(attempt + 72)) / maxScale;
    const path = walker.path(anchor, { direction: gravity, length, maxSteps: high ? 96 : 72 });
    if (path.length < 2 || path.some(point => !avoidsFace(point))) continue;
    sampler.resolve(path[0], anchor.mesh, initialPose);
    sampler.resolve(path[path.length - 1], anchor.mesh, endPose);
    if (initialPose.position.distanceToSquared(endPose.position) < Math.pow(unit * .09 / maxScale, 2)) continue;
    sources.push({ path, period: 9 + 6 * seeded(attempt + 872), phase: seeded(attempt + 340),
      radius: unit * (.009 + .014 * seeded(attempt + 72)) });
  }

  const group = new THREE.Group(); group.name = 'SurfaceStemAccents_癸';
  const geometry = new THREE.SphereGeometry(1, high ? 12 : 8, high ? 8 : 6);
  const material = new THREE.MeshPhysicalMaterial({ color: 0xe8ffff, roughness: .045,
    transmission: .97, ior: 1.333, thickness: unit * .04, clearcoat: .65,
    clearcoatRoughness: .045, envMapIntensity: 1.1 });
  material.name = '癸 · clear surface condensation';
  const mesh = new THREE.InstancedMesh(geometry, material, sources.length);
  mesh.name = 'ActualSurfaceSlidingDew'; mesh.frustumCulled = false;
  mesh.castShadow = false; mesh.receiveShadow = false;
  mesh.userData.surfaceNonShadowCaster = true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); group.add(mesh);
  const diagnostics = { supported: sources.length > 0, mode: 'triangle-sliding-condensation',
    anchorCount: sources.length, limitations: [
      'Routes follow connected reference triangle edges in rest-local gravity; rigid transforms and explicitly enabled morph vertex positions preserve attachment.',
      'Condensation, sliding, evaporation and repeat are implemented; bead coalescence and detached falling droplets are omitted.',
      'Each ellipsoid stays outside its current face plane; full collision simulation against other body parts is not performed.',
      'Creation-time face masking preserves gaze and expression; accessory masks hide only local beads without reseeding.',
      'Fixed path/particle budgets do not adapt to later topology, skinning or large scale changes; morphs require explicit opt-in.',
    ] };
  group.userData.surfaceDew = { beads: sources.length, budget,
    pathPoints: sources.reduce((count, source) => count + source.path.length, 0),
    geometryTriangles: geometry.index!.count / 3,
    gravity: 'rest-local', lifecycle: 'condense-slide-evaporate-repeat',
    coalescence: false, detachedDrops: false };

  const current: SurfaceAnchor = { mesh: options.meshes[0], triangle: 0, barycentric: new THREE.Vector3() };
  const pose: SurfacePose = { position: new THREE.Vector3(), normal: new THREE.Vector3() };
  const dummy = new THREE.Object3D();
  const inverseGroup = new THREE.Matrix4(), groupNormalMatrix = new THREE.Matrix3();
  const worldNormal = new THREE.Vector3(), direction = new THREE.Vector3();
  const axisX = new THREE.Vector3(), axisY = new THREE.Vector3();
  let disposed = false;
  function update(time: number): void {
    if (disposed) return;
    if (!Number.isFinite(time)) throw new RangeError('Accent time must be finite.');
    group.updateWorldMatrix(true, false);
    inverseGroup.copy(group.matrixWorld).invert(); groupNormalMatrix.getNormalMatrix(group.matrixWorld);
    for (let index = 0; index < sources.length; index++) {
      const source = sources[index], age = fract(time / source.period + source.phase);
      const life = THREE.MathUtils.smoothstep(age, .06, .28) * (1 - THREE.MathUtils.smoothstep(age, .77, .93));
      // Stay just inside the last real face while evaporating. A path can end
      // exactly at a shared edge whose two face normals are both valid.
      const progress = Math.min(.9995, THREE.MathUtils.smoothstep(age, .38, .77));
      walker.interpolate(source.path, progress, current);
      sampler.resolve(current, group, pose);
      // Normals are covectors. Convert the actual world normal into a direction
      // before orienting the bead under a nonuniform effect parent.
      worldNormal.copy(pose.normal).applyNormalMatrix(groupNormalMatrix);
      direction.copy(worldNormal).transformDirection(inverseGroup);
      dummy.quaternion.setFromUnitVectors(Z, direction);
      const radius = source.radius * life;
      const elongation = 1.05 + .22 * Math.sin(progress * Math.PI);
      dummy.scale.set(radius, radius * elongation, radius * .58);
      // Include all three ellipsoid axes in plane support, rather than burying
      // half of the bead below the polygon. This remains true under skew/scale.
      axisX.copy(X).applyQuaternion(dummy.quaternion);
      axisY.copy(Y).applyQuaternion(dummy.quaternion);
      const support = Math.sqrt(Math.pow(axisX.dot(pose.normal) * dummy.scale.x, 2) +
        Math.pow(axisY.dot(pose.normal) * dummy.scale.y, 2) +
        Math.pow(direction.dot(pose.normal) * dummy.scale.z, 2));
      const offset = (support + unit * .0003 + radius * .05) / direction.dot(pose.normal);
      dummy.position.copy(pose.position).addScaledVector(direction, offset);
      if (life < .0005 || isSurfaceAttachmentExcluded(group, pose.position)) dummy.scale.set(0, 0, 0);
      dummy.updateMatrix(); mesh.setMatrixAt(index, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  function dispose(): void {
    if (disposed) return; disposed = true;
    group.removeFromParent(); mesh.dispose(); geometry.dispose(); material.dispose(); group.clear();
  }
  update(0);
  return { group, update, dispose, diagnostics };
}
