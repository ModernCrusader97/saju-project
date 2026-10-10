import * as THREE from 'three';
import { APPROVED_SPIRIT_RIG_PROFILE as profile, rigBoneNames, applyApprovedRigPose } from './approved-spirit-rig-profile.mjs';

/** Owned controls for the separately authored skin rig. The preserved source
 * morph remains available; greeting bone transforms never rewrite geometry. */
export function createApprovedSpiritRigControls(body: THREE.Mesh) {
  const mesh = body as THREE.SkinnedMesh;
  if (!mesh.isSkinnedMesh || mesh.skeleton.bones.length !== rigBoneNames.length ||
    mesh.skeleton.bones.some((bone,i) => bone.name !== rigBoneNames[i])) {
    throw new Error('Approved greeting requires the separately authored B-rig-v001 skeleton.');
  }
  const bones = mesh.skeleton.bones, restPositions = bones.map(bone => bone.position.clone()),
    restQuaternions = bones.map(bone => bone.quaternion.clone()), restScales = bones.map(bone => bone.scale.clone());
  if (bones.some(bone => bone.quaternion.angleTo(new THREE.Quaternion()) > 1e-6 || bone.scale.distanceTo(new THREE.Vector3(1,1,1)) > 1e-6)) {
    throw new Error('Approved rig must begin at its neutral bind pose.');
  }
  const position = mesh.geometry.getAttribute('position'), handVertexIDs: number[] = [];
  for (let id = 0; id < position.count; id++) if (position.getX(id) > .69 && position.getY(id) > .70 && position.getY(id) < .87) handVertexIDs.push(id);
  // A conservative envelope covers skin motion and the retained source study.
  // SkinnedMesh's first-frame box alone would become stale after the arm rises.
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  mesh.boundingBox = mesh.geometry.boundingBox!.clone().expandByScalar(.45);
  mesh.boundingSphere = mesh.boundingBox.getBoundingSphere(new THREE.Sphere());
  const priorRevision = body.userData.approvedSkinPoseRevision;
  let previousLift = NaN, previousWrist = NaN, revision = 0, disposed = false;
  body.userData.approvedSkinPoseRevision = revision;
  return {
    handVertexIDs, controlIndices: [] as number[], controlWeights: [] as number[],
    field: { bones: bones.length, skin: profile.version, maximumInfluences: 2 },
    setPose(lift: number, wrist: number) {
      if (disposed) return;
      if (lift === previousLift && wrist === previousWrist) return;
      applyApprovedRigPose(bones,restPositions,lift,wrist);
      previousLift = lift; previousWrist = wrist; body.userData.approvedSkinPoseRevision = ++revision;
    },
    dispose() {
      if (disposed) return; disposed = true;
      bones.forEach((bone,i) => {bone.position.copy(restPositions[i]); bone.quaternion.copy(restQuaternions[i]); bone.scale.copy(restScales[i]);});
      if (priorRevision === undefined) delete body.userData.approvedSkinPoseRevision;
      else body.userData.approvedSkinPoseRevision = priorRevision;
    },
  };
}
