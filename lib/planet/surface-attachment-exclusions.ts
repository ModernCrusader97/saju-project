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
export function isSurfaceAttachmentExcluded(group: THREE.Object3D, localPosition: THREE.Vector3): boolean {
  let owner: THREE.Object3D | null = group;
  while (owner && !Array.isArray(owner.userData.surfaceAttachmentExclusions)) owner = owner.parent;
  if (!owner) return false;
  const exclusions = owner.userData.surfaceAttachmentExclusions as SurfaceAttachmentExclusion[];
  if (!exclusions.length) return false;
  owner.updateWorldMatrix(true, false); group.updateWorldMatrix(true, false);
  relative.copy(owner.matrixWorld).invert().multiply(group.matrixWorld);
  point.copy(localPosition).applyMatrix4(relative);
  return exclusions.some(region => {
    if (region.shape === 'box') return point.x >= region.min[0] && point.x <= region.max[0] &&
      point.y >= region.min[1] && point.y <= region.max[1] && point.z >= region.min[2] && point.z <= region.max[2];
    return (point.x - region.center[0]) ** 2 + (point.y - region.center[1]) ** 2 +
      (point.z - region.center[2]) ** 2 <= region.radius ** 2;
  });
}
