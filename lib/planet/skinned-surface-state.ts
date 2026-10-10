import * as THREE from 'three';

/** Local rig revisions avoid rebuilding caches for an unchanged paused pose.
 * Other explicitly opted-in skins use their actual GPU skeleton matrices. */
export function skinPoseKey(mesh: THREE.Mesh): string {
  const skin = mesh as THREE.SkinnedMesh;
  if (!skin.isSkinnedMesh) return '';
  if (typeof mesh.userData.approvedSkinPoseRevision === 'number') return `B:${mesh.userData.approvedSkinPoseRevision}`;
  return Array.from(skin.skeleton.boneMatrices ?? []).join(',');
}

export function hasMovingSkinVertex(mesh: THREE.Mesh, id: number): boolean {
  if (!(mesh as THREE.SkinnedMesh).isSkinnedMesh) return false;
  const indices = mesh.geometry.getAttribute('skinIndex'), weights = mesh.geometry.getAttribute('skinWeight');
  if (!indices || !weights) return false;
  for (let slot = 0; slot < 4; slot++) if (weights.getComponent(id,slot) > 0 &&
    (indices.getComponent(id,slot) > 0 || mesh.userData.approvedRigVersion !== 'B-rig-v001')) return true;
  return false;
}
