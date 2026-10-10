import * as THREE from 'three';
import {hasMovingSkinVertex} from './skinned-surface-state';
import { seeded, type SurfaceAnchor, type SurfacePose } from './mesh-surface';
import { SurfaceTriangleWalker } from './surface-triangle-walk';
import { isSurfaceAttachmentExcluded } from './surface-attachment-exclusions';
import type { SurfaceAccentOptions, SurfaceStemAccents } from './surface-stem-accents';

interface DewSource {
  path: SurfaceAnchor[];
  period: number;
  phase: number;
  radius: number;
  secondRadius: number;
  launchCycle: number | null;
  launchPosition: THREE.Vector3;
  launchVelocity: THREE.Vector3;
  launchRadius: number;
  launches: Map<number, { position: THREE.Vector3; velocity: THREE.Vector3; radius: number }>;
  frame: {
    period: number; phaseOffset: number; canDetach: boolean; age: number; cycle: number;
    state: string; mergeFraction: number; contactDistance: number; contactLimit: number;
    referenceVolume: number; mergedRadius: number; gravity: number; flightSeconds: number;
    launchVelocity: number[]; slots: string[];
  };
}
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const fract = (value: number) => value - Math.floor(value);

const DETACH_AGE = .66;
const FLIGHT_SECONDS = 1.15;
const MAX_LAUNCH_NORMAL_Y = .3;
/** Two fixed slots share one existing connected route. Nearby beads transfer
 * cubic volume, then sufficiently large drops release into world-space flight.
 * No all-pairs collision search, new physics engine, or nearest-surface jump. */
export function createSurfaceSlidingDew(options: SurfaceAccentOptions): SurfaceStemAccents {
  const walker = new SurfaceTriangleWalker(options.meshes, { allowMorphTargets: options.allowMorphTargets, allowSkinning: options.allowSkinning }), sampler = walker.sampler;
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
    const period = 9 + 6 * seeded(attempt + 872), phase = seeded(attempt + 340);
    const radius = unit * (.009 + .014 * seeded(attempt + 72));
    const secondRadius = unit * (.011 + .012 * seeded(attempt + 741));
    const mergedRadius = Math.cbrt(radius ** 3 + secondRadius ** 3);
    sources.push({ path, period, phase, radius, secondRadius, launchCycle: null,
      launchPosition: new THREE.Vector3(), launchVelocity: new THREE.Vector3(), launchRadius: 0, launches: new Map(),
      frame: { period, phaseOffset: phase, canDetach: mergedRadius >= unit * .020,
        age: 0, cycle: 0, state: 'condense', mergeFraction: 0, contactDistance: 0, contactLimit: 0,
        referenceVolume: 0, mergedRadius, gravity: unit * .7, flightSeconds: 0,
        launchVelocity: [0, 0, 0], slots: ['surface', 'surface'] } });
  }
  // Keep original morph-bearing routes when halving the old route pool into
  // two-slot pairs. Read the preserved target attributes, never modify them.
  const movesWithMorph = (source: DewSource): boolean => {
    if (!options.allowMorphTargets && !options.allowSkinning) return false;
    for (const anchor of source.path) {
      const g = anchor.mesh.geometry, p = g.getAttribute('position');
      if (options.allowSkinning) for (let corner = 0; corner < 3; corner++) {
        const id = g.index ? g.index.getX(anchor.triangle * 3 + corner) : anchor.triangle * 3 + corner;
        if (hasMovingSkinVertex(anchor.mesh,id)) return true;
      }
      for (const target of g.morphAttributes.position ?? []) for (let corner = 0; corner < 3; corner++) {
        const offset = anchor.triangle * 3 + corner, id = g.index ? g.index.getX(offset) : offset;
        const dx = target.getX(id) - (g.morphTargetsRelative ? 0 : p.getX(id));
        const dy = target.getY(id) - (g.morphTargetsRelative ? 0 : p.getY(id));
        const dz = target.getZ(id) - (g.morphTargetsRelative ? 0 : p.getZ(id));
        if (dx * dx + dy * dy + dz * dz > unit * unit * .000004) return true;
      }
    }
    return false;
  };
  const moving = sources.filter(movesWithMorph), rest = sources.filter(source => !moving.includes(source));
  const kept = moving.slice(0, budget / 2), remaining = budget / 2 - kept.length;
  const restCount = Math.min(remaining, rest.length);
  for (let i = 0; i < restCount; i++) kept.push(rest[Math.floor(i * rest.length / restCount)]);
  sources.splice(0, sources.length, ...kept);

  const group = new THREE.Group(); group.name = 'SurfaceStemAccents_癸';
  const geometry = new THREE.SphereGeometry(1, high ? 12 : 8, high ? 8 : 6);
  const material = new THREE.MeshPhysicalMaterial({ color: 0xe8ffff, roughness: .045,
    transmission: .97, ior: 1.333, thickness: unit * .04, clearcoat: .65,
    clearcoatRoughness: .045, envMapIntensity: 1.1 });
  material.name = '癸 · clear surface condensation';
  const mesh = new THREE.InstancedMesh(geometry, material, sources.length * 2);
  mesh.name = 'ActualSurfaceSlidingDew'; mesh.frustumCulled = false;
  mesh.castShadow = false; mesh.receiveShadow = false;
  mesh.userData.surfaceNonShadowCaster = true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); group.add(mesh);
  const diagnostics = { supported: sources.length > 0, mode: 'triangle-sliding-coalescing-dew',
    anchorCount: sources.length, limitations: [
      'Routes follow connected reference triangle edges in rest-local gravity; rigid transforms and explicitly enabled morphs/skin vertex positions preserve attachment.',
      'Fixed neighboring pairs on one route merge only within their contact envelope; arbitrary all-pairs fluid interaction is not simulated.',
      'Attached ellipsoids stay outside their current face plane. Flight has a bounded outward launch and world gravity, without full body/ground collision simulation.',
      'Creation-time face masking and radius-aware accessory masks preserve clear regions without reseeding.',
      'World launches retain at most four cycles per route for pause/seek reuse. Reset and reattachment clear them; a cold seek uses the currently supplied pose, not an unavailable historical pose.',
      'Fixed path/particle budgets do not adapt to later topology or large scale changes; morphs and skinning require explicit opt-in.',
    ] };
  group.userData.surfaceDew = { beads: mesh.count, budget, pairs: sources.length,
    pathPoints: sources.reduce((count, source) => count + source.path.length, 0),
    geometryTriangles: geometry.index!.count / 3,
    gravity: 'rest-local-route/world-down-flight', lifecycle: 'condense-slide-merge-release-wait-repeat',
    coalescence: true, detachedDrops: true, detachmentRadius: unit * .020, detachmentAge: DETACH_AGE,
    flightSeconds: FLIGHT_SECONDS, maxLaunchNormalY: MAX_LAUNCH_NORMAL_Y,
    mergeRule: 'rMerged^3 = rA^3 + rB^3; ellipsoid axis product = .58*r^3',
    pairChecksPerUpdate: sources.length, launchCacheEntries: sources.length * 4, allPairsSearch: false };
  const frame = { pairs: sources.map(source => source.frame), pairChecks: 0 };
  group.userData.surfaceDewFrame = frame;

  const current: SurfaceAnchor = { mesh: options.meshes[0], triangle: 0, barycentric: new THREE.Vector3() };
  const pose: SurfacePose = { position: new THREE.Vector3(), normal: new THREE.Vector3() };
  const secondPose: SurfacePose = { position: new THREE.Vector3(), normal: new THREE.Vector3() };
  const dummy = new THREE.Object3D();
  const inverseGroup = new THREE.Matrix4(), groupNormalMatrix = new THREE.Matrix3();
  const worldNormal = new THREE.Vector3(), direction = new THREE.Vector3();
  const axisX = new THREE.Vector3(), axisY = new THREE.Vector3();
  const worldMatrix = new THREE.Matrix4(), localMatrix = new THREE.Matrix4();
  const flightPosition = new THREE.Vector3(), flightScale = new THREE.Vector3();
  const identity = new THREE.Quaternion();
  let previousTime = Number.NaN, previousParent: THREE.Object3D | null = null;
  let disposed = false;
  function contact(source: DewSource, progress: number, target: SurfacePose): void {
    walker.interpolate(source.path, Math.min(.9995, progress), current);
    sampler.resolve(current, group, target);
  }
  function attached(source: DewSource, progress: number, radius: number): void {
    contact(source, progress, pose);
    worldNormal.copy(pose.normal).applyNormalMatrix(groupNormalMatrix);
    direction.copy(worldNormal).transformDirection(inverseGroup);
    dummy.quaternion.setFromUnitVectors(Z, direction);
    const elongation = 1.05 + .22 * Math.sin(progress * Math.PI);
    // Fixed axis product makes cubic-radius volume transfer exact even while
    // the surface bead elongates. The plane-support calculation remains exact.
    dummy.scale.set(radius, radius * elongation, radius * .58 / elongation);
    axisX.copy(X).applyQuaternion(dummy.quaternion); axisY.copy(Y).applyQuaternion(dummy.quaternion);
    const support = Math.sqrt(Math.pow(axisX.dot(pose.normal) * dummy.scale.x, 2) +
      Math.pow(axisY.dot(pose.normal) * dummy.scale.y, 2) + Math.pow(direction.dot(pose.normal) * dummy.scale.z, 2));
    const offset = (support + unit * .0003 + radius * .05) / direction.dot(pose.normal);
    dummy.position.copy(pose.position).addScaledVector(direction, offset);
    dummy.updateMatrix();
  }
  function putAttached(index: number, source: DewSource, progress: number, radius: number): void {
    attached(source, progress, radius);
    if (radius < unit * .000005 || isSurfaceAttachmentExcluded(group, dummy.position, Math.max(dummy.scale.x, dummy.scale.y, dummy.scale.z))) {
      dummy.scale.set(0, 0, 0); source.frame.slots[index % 2] = 'hidden'; dummy.updateMatrix();
    } else source.frame.slots[index % 2] = 'surface';
    mesh.setMatrixAt(index, dummy.matrix);
  }
  function update(time: number): void {
    if (disposed) return;
    if (!Number.isFinite(time)) throw new RangeError('Accent time must be finite.');
    group.updateWorldMatrix(true, false);
    inverseGroup.copy(group.matrixWorld).invert(); groupNormalMatrix.getNormalMatrix(group.matrixWorld);
    const rebase = !Number.isFinite(previousTime) || (time === 0 && previousTime !== 0) || group.parent !== previousParent;
    const worldVolumeScale = Math.abs(group.matrixWorld.determinant());
    frame.pairChecks = 0;
    for (let index = 0; index < sources.length; index++) {
      const source = sources[index], age = fract(time / source.period + source.phase);
      const cycle = Math.floor(time / source.period + source.phase), row = source.frame;
      if (rebase) { source.launchCycle = null; source.launches.clear(); }
      const life = THREE.MathUtils.smoothstep(age, .06, .28) * (1 - THREE.MathUtils.smoothstep(age, .77, .93));
      const progress = .72 * THREE.MathUtils.smoothstep(age, .30, .70);
      const gap = .15 * (1 - THREE.MathUtils.smoothstep(age, .32, .50));
      contact(source, progress + gap, pose); contact(source, progress, secondPose);
      row.contactDistance = pose.position.distanceTo(secondPose.position);
      row.contactLimit = (source.radius + source.secondRadius) * life * 1.08;
      const merge = row.contactDistance <= row.contactLimit ? THREE.MathUtils.smoothstep(age, .42, .50) : 0;
      const firstVolume = source.radius ** 3 + source.secondRadius ** 3 * merge;
      const secondVolume = source.secondRadius ** 3 * (1 - merge);
      row.age = age; row.cycle = cycle; row.mergeFraction = merge; row.flightSeconds = 0;
      row.referenceVolume = .58 * (firstVolume + secondVolume) * life ** 3 * worldVolumeScale;
      row.state = age >= .93 ? 'wait' : age > .77 ? 'evaporate' : age < .30 ? 'condense' : merge < 1 ? 'merge' : 'merged'; frame.pairChecks++;
      const launchProgress = .72 * THREE.MathUtils.smoothstep(DETACH_AGE, .30, .70);
      let release = row.canDetach && age >= DETACH_AGE - 1e-10;
      if (release && !source.launches.has(cycle)) {
        contact(source, launchProgress, pose);
        worldNormal.copy(pose.normal).applyNormalMatrix(groupNormalMatrix);
        // Side/downward faces can release outward and downward together. An
        // upward-facing plane would let gravity return a drop into the body.
        release = worldNormal.y <= MAX_LAUNCH_NORMAL_Y;
      }
      if (release) {
        const flightTime = Math.max(0, time - (cycle + DETACH_AGE - source.phase) * source.period);
        if (source.launchCycle !== cycle) {
          const prior = source.launches.get(cycle);
          if (prior) {
            source.launchPosition.copy(prior.position); source.launchVelocity.copy(prior.velocity); source.launchRadius = prior.radius;
          } else {
            attached(source, launchProgress, row.mergedRadius);
            source.launchRadius = row.mergedRadius * Math.cbrt(worldVolumeScale);
            // The free bead rounds to a vertical ellipsoid. Compute that new
            // shape's exact world-plane support before releasing it.
            const support = source.launchRadius * Math.sqrt(.58 / 1.25 * (worldNormal.x ** 2 + worldNormal.z ** 2) +
              1.25 ** 2 * worldNormal.y ** 2);
            source.launchPosition.copy(pose.position).applyMatrix4(group.matrixWorld)
              .addScaledVector(worldNormal, support + unit * .0003 + source.launchRadius * .05);
            source.launchVelocity.copy(worldNormal).multiplyScalar(unit * .35);
            source.launchVelocity.y = Math.min(-unit * .04, source.launchVelocity.y);
            if (source.launches.size === 4) source.launches.delete(source.launches.keys().next().value!);
            source.launches.set(cycle, { position: source.launchPosition.clone(), velocity: source.launchVelocity.clone(), radius: source.launchRadius });
          }
          source.launchCycle = cycle;
        }
        row.flightSeconds = flightTime; row.launchVelocity[0] = source.launchVelocity.x;
        row.launchVelocity[1] = source.launchVelocity.y; row.launchVelocity[2] = source.launchVelocity.z;
        row.state = flightTime < FLIGHT_SECONDS ? 'fall' : 'wait';
        const fade = 1 - THREE.MathUtils.smoothstep(flightTime, .9, FLIGHT_SECONDS);
        row.referenceVolume = .58 * source.launchRadius ** 3 * fade ** 3;
        flightPosition.copy(source.launchPosition).addScaledVector(source.launchVelocity, flightTime);
        flightPosition.y -= .5 * row.gravity * flightTime ** 2;
        const radius = source.launchRadius * fade;
        flightScale.set(radius * Math.sqrt(.58 / 1.25), radius * 1.25, radius * Math.sqrt(.58 / 1.25));
        worldMatrix.compose(flightPosition, identity, flightScale); localMatrix.copy(inverseGroup).multiply(worldMatrix);
        // The merged source region and the entire moving bead envelope are both
        // masked. Equipping/unequipping never changes launch or seed identities.
        contact(source, launchProgress, pose);
        dummy.position.setFromMatrixPosition(localMatrix);
        const e = localMatrix.elements, envelope = Math.hypot(e[0], e[1], e[2], e[4], e[5], e[6], e[8], e[9], e[10]);
        const hidden = fade === 0 || isSurfaceAttachmentExcluded(group, pose.position, row.mergedRadius * 1.27) ||
          isSurfaceAttachmentExcluded(group, dummy.position, envelope);
        if (hidden) localMatrix.makeScale(0, 0, 0).setPosition(dummy.position);
        mesh.setMatrixAt(index * 2, localMatrix); row.slots[0] = hidden ? 'hidden' : 'fall';
        // Hidden slots must not inherit a previous route's quaternion (or its
        // signed zero basis), including when a cached launch skips attached().
        localMatrix.makeScale(0, 0, 0).setPosition(dummy.position);
        mesh.setMatrixAt(index * 2 + 1, localMatrix); row.slots[1] = 'hidden';
      } else {
        putAttached(index * 2, source, progress + gap, Math.cbrt(firstVolume) * life);
        putAttached(index * 2 + 1, source, progress, Math.cbrt(secondVolume) * life);
      }
    }
    previousTime = time; previousParent = group.parent;
    mesh.instanceMatrix.needsUpdate = true;
  }
  function dispose(): void {
    if (disposed) return; disposed = true;
    for (const source of sources) source.launches.clear();
    group.removeFromParent(); mesh.dispose(); geometry.dispose(); material.dispose(); group.clear();
  }
  update(0);
  return { group, update, dispose, diagnostics };
}
