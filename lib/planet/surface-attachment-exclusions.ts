import * as THREE from 'three';

type Point3 = [number, number, number];
/** An accessory publishes its own small region in its model parent's local
 * coordinates. It owns no surface instances and never changes their seeds. */
export type SurfaceAttachmentExclusion =
  | { id: string; shape: 'box'; min: Point3; max: Point3 }
  | { id: string; shape: 'sphere'; center: Point3; radius: number };

const relative = new THREE.Matrix4(), point = new THREE.Vector3();

/** Hide only attachment roots/segments in a current accessory region. Call
 * after constructing the unchanged pose each frame so unequipping restores it.
 * Empty arrays deliberately shadow masks belonging to a different ancestor. */
export function isSurfaceAttachmentExcluded(group: THREE.Object3D, localPosition: THREE.Vector3, localRadius = 0): boolean {
  let owner: THREE.Object3D | null = group;
  while (owner && !Array.isArray(owner.userData.surfaceAttachmentExclusions)) owner = owner.parent;
  if (!owner) return false;
  const exclusions = owner.userData.surfaceAttachmentExclusions as SurfaceAttachmentExclusion[];
  if (!exclusions.length) return false;
  owner.updateWorldMatrix(true, false); group.updateWorldMatrix(true, false);
  relative.copy(owner.matrixWorld).invert().multiply(group.matrixWorld);
  point.copy(localPosition).applyMatrix4(relative);
  // Existing point callers retain their exact behavior. New large beads use a
  // conservative transformed sphere envelope, including nonuniform scale/skew.
  const e = relative.elements, radius = Math.max(0, localRadius);
  const rx = radius * Math.hypot(e[0], e[4], e[8]);
  const ry = radius * Math.hypot(e[1], e[5], e[9]);
  const rz = radius * Math.hypot(e[2], e[6], e[10]);
  return exclusions.some(region => {
    if (region.shape === 'box') return point.x >= region.min[0] - rx && point.x <= region.max[0] + rx &&
      point.y >= region.min[1] - ry && point.y <= region.max[1] + ry && point.z >= region.min[2] - rz && point.z <= region.max[2] + rz;
    return (point.x - region.center[0]) ** 2 + (point.y - region.center[1]) ** 2 +
      (point.z - region.center[2]) ** 2 <= (region.radius + Math.hypot(rx, ry, rz)) ** 2;
  });
}
