import * as THREE from 'three';
import profile from '../../assets/source-reference/saju-b-rigged-greeting-v001/rig-profile.json' with { type: 'json' };

export { profile as APPROVED_SPIRIT_RIG_PROFILE };
export const rigBoneNames = ['B_Rest', ...Array.from({length: profile.socketSupports}, (_, i) => `B_RightShoulder_${i + 1}`), ...profile.armNames];
export const rigEase = value => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/** Absolute stages shared by the authored GLB clip and the interactive runtime. */
export function rigGreetingPose(progress) {
  if (progress < 0 || progress >= 1) return {lift: 0, wrist: 0, stage: 'idle'};
  if (progress < profile.raiseEnd) return {lift: rigEase(progress / profile.raiseEnd), wrist: 0, stage: 'raise'};
  if (progress < profile.holdEnd) return {lift: 1, wrist: 0, stage: 'hold'};
  if (progress < profile.waveEnd) {
    const t = (progress - profile.holdEnd) / (profile.waveEnd - profile.holdEnd);
    const taper = rigEase(t / .06) * rigEase((1 - t) / .06);
    return {lift: 1, wrist: Math.sin(t * Math.PI * 2 * profile.waveCycles) * taper, stage: 'wave'};
  }
  return {lift: 1 - rigEase((progress - profile.waveEnd) / (1 - profile.waveEnd)), wrist: 0, stage: 'lower'};
}

const xAxis = new THREE.Vector3(1, 0, 0), zAxis = new THREE.Vector3(0, 0, 1);
const secondary = new THREE.Quaternion();
/** Each control blends adjacent support bones. No frame modifies bind positions,
 * skin weights, bone lengths, UVs, source morphs or the neutral sculpture. */
export function applyApprovedRigPose(bones, restPositions, lift, wrist) {
  const amount = THREE.MathUtils.clamp(lift, 0, 1), sway = THREE.MathUtils.clamp(wrist, -1, 1);
  for (let i = 0; i < bones.length; i++) {
    bones[i].position.copy(restPositions[i]); bones[i].quaternion.identity(); bones[i].scale.set(1, 1, 1);
  }
  for (let i = 1; i <= profile.socketSupports; i++) {
    const fraction = i / profile.socketSupports;
    bones[i].position.x += profile.clavicleTravel[0] * amount * fraction;
    bones[i].position.y += profile.clavicleTravel[1] * amount * fraction;
    bones[i].position.z += profile.clavicleTravel[2] * amount * fraction;
    bones[i].quaternion.setFromAxisAngle(xAxis, profile.forwardRadians * amount * fraction)
      .multiply(secondary.setFromAxisAngle(zAxis, profile.shoulderRadians * amount * fraction));
  }
  for (let i = 0; i < profile.armStations.length; i++) {
    const previous = i ? profile.waveFractions[i - 1] : 0;
    bones[profile.socketSupports + 1 + i].quaternion.setFromAxisAngle(zAxis,
      profile.wristRadians * sway * (profile.waveFractions[i] - previous));
  }
}
