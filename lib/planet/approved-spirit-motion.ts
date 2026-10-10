import * as THREE from 'three';

// The source is a limited pose study. Larger .55–.60 weights compress wrist
// triangles strongly; .45 is a conservative greeting, still requiring GPU review.
export const APPROVED_SPIRIT_WAVE_MAX_WEIGHT = .45;

export interface ApprovedSpiritMotion {
  update(time: number): void;
  triggerReaction(): void;
  reset(): void;
  dispose(): void;
}

type FaceKind = 'eye' | 'glint' | 'brow' | 'smile';
interface FaceRest {
  object: THREE.Object3D;
  kind: FaceKind;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
  eyeY: number;
}

const STEM_TEMPO: Readonly<Record<string, number>> = {
  甲: 1.04, 乙: 1.12, 丙: .93, 丁: 1.01, 戊: 1.15,
  己: 1.08, 庚: .98, 辛: 1.03, 壬: 1.11, 癸: 1.17,
};
const smooth = (value: number) => value * value * (3 - 2 * value);
// Reduce the time before multiplication so even very large finite times stay finite.
const phase = (time: number, period: number) => (time % period) / period * Math.PI * 2;

function waveEnvelope(progress: number): number {
  if (progress <= 0 || progress >= 1) return 0;
  if (progress < .22) return smooth(progress / .22);
  if (progress < .72) {
    // Two small dips around the raised pose, with zero derivative at both joins.
    const waves = Math.sin((progress - .22) / .5 * Math.PI * 2);
    return 1 - .12 * waves * waves;
  }
  return 1 - smooth((progress - .72) / .28);
}

/** Pass an identity child of avatarPivot containing the original body, face and
 * every attached effect. Display placement/depth and user rotation stay outside
 * this owned child. stemKey is the mapped 甲…癸 key, not the Korean day label.
 * update uses absolute paused/playback time; it never edits
 * original vertex, UV, normal, index or morph-target attributes. */
export function createApprovedSpiritMotion(
  motionRoot: THREE.Object3D, body: THREE.Mesh, stemKey: string,
): ApprovedSpiritMotion {
  const waveIndex = body.morphTargetDictionary?.Gentle_wave_pose;
  const influences = body.morphTargetInfluences;
  const position = body.geometry.getAttribute('position');
  const waveTarget = waveIndex === undefined ? undefined : body.geometry.morphAttributes.position?.[waveIndex];
  if (waveIndex === undefined || !influences || !position || !waveTarget || waveTarget.count !== position.count ||
    (body as THREE.SkinnedMesh).isSkinnedMesh || (body as THREE.InstancedMesh).isInstancedMesh) {
    throw new Error('Approved motion requires the original rigid B Gentle_wave_pose target.');
  }
  if (influences.some(weight => weight !== 0)) throw new Error('Approved motion starts from neutral source morphs.');
  let ancestor: THREE.Object3D | null = body;
  while (ancestor && ancestor !== motionRoot) ancestor = ancestor.parent;
  if (!ancestor) throw new Error('The original B body must belong to the owned motion root.');

  const restPosition = motionRoot.position.clone(), restQuaternion = motionRoot.quaternion.clone();
  const restScale = motionRoot.scale.clone(), restMorphs = [...influences];
  const turn = new THREE.Quaternion(), linearPose = new THREE.Matrix4(), zero = new THREE.Vector3();
  const faces: FaceRest[] = [];
  motionRoot.traverse(object => {
    const kind: FaceKind | undefined = object.name.includes('almond_gaze') ? 'eye' :
      object.name.includes('small_eye_glint') ? 'glint' : object.name.includes('expressive_brow') ? 'brow' :
      object.name.includes('quiet_smile') ? 'smile' : undefined;
    if (kind) faces.push({ object, kind, position: object.position.clone(), quaternion: object.quaternion.clone(),
      scale: object.scale.clone(), eyeY: object.position.y });
  });
  for (const face of faces) if (face.kind === 'glint') {
    const side = face.object.name.endsWith('_-1') ? '_-1' : '_1';
    face.eyeY = faces.find(other => other.kind === 'eye' && other.object.name.endsWith(side))?.position.y ?? face.position.y;
  }

  // Only a setup scan touches the complete mesh. The source wave changes the arm
  // above y=.697; a .10 band contains 1,577 sole candidates. The CPU test proves
  // their minimum equals all 33,207 vertices over allowed roll/scale/wave poses.
  motionRoot.updateWorldMatrix(true, true);
  const bodyToRoot = motionRoot.matrixWorld.clone().invert().multiply(body.matrixWorld);
  const direction = new THREE.Matrix3().setFromMatrix4(bodyToRoot), point = new THREE.Vector3(), delta = new THREE.Vector3();
  linearPose.compose(zero, restQuaternion, restScale);
  const baseline = linearPose.elements;
  let neutralMinimum = Infinity;
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i).applyMatrix4(bodyToRoot);
    neutralMinimum = Math.min(neutralMinimum, baseline[1] * point.x + baseline[5] * point.y + baseline[9] * point.z);
  }
  const soleValues: number[] = [];
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i).applyMatrix4(bodyToRoot);
    const y = baseline[1] * point.x + baseline[5] * point.y + baseline[9] * point.z;
    if (y > neutralMinimum + .10) continue;
    delta.fromBufferAttribute(waveTarget, i);
    if (!body.geometry.morphTargetsRelative) delta.sub(new THREE.Vector3().fromBufferAttribute(position, i));
    delta.applyMatrix3(direction);
    soleValues.push(point.x, point.y, point.z, delta.x, delta.y, delta.z);
  }
  const soles = new Float64Array(soleValues);
  const tempo = STEM_TEMPO[stemKey] ?? 1, duration = 2.4 * tempo;
  let currentTime = 0, reactionStart = 0, reacting = false, queued = false, disposed = false;

  const restore = () => {
    motionRoot.position.copy(restPosition); motionRoot.quaternion.copy(restQuaternion); motionRoot.scale.copy(restScale);
    for (const face of faces) {
      face.object.position.copy(face.position); face.object.quaternion.copy(face.quaternion); face.object.scale.copy(face.scale);
    }
    for (let i = 0; i < restMorphs.length; i++) influences[i] = restMorphs[i];
    motionRoot.updateMatrix();
  };

  const update = (time: number) => {
    if (disposed || !Number.isFinite(time)) return;
    const next = Math.max(0, time);
    if (next < currentTime) { reacting = false; queued = false; }
    currentTime = next;
    // Consume at the exact scheduled boundary, independent of frame rate. Taps
    // during an active cycle coalesce into one continuous, bounded second cycle.
    if (reacting && currentTime >= reactionStart + duration) {
      if (queued) { reactionStart += duration; queued = false; }
      else reacting = false;
      if (reacting && currentTime >= reactionStart + duration) reacting = false;
    }
    const elapsed = reacting ? currentTime - reactionStart : -1;
    const response = elapsed >= 0 ? waveEnvelope(elapsed / duration) : 0;
    const weight = response * APPROVED_SPIRIT_WAVE_MAX_WEIGHT;
    influences[waveIndex] = weight;

    const roll = .005 * Math.sin(phase(currentTime, 7.3 * tempo)) + .001 * response;
    const drift = .009 * Math.sin(phase(currentTime, 8.5 * tempo)) + .002 * response;
    const breathe = 1 + .0015 * (1 - Math.cos(phase(currentTime, 4.8 * tempo)));
    turn.set(0, 0, Math.sin(roll / 2), Math.cos(roll / 2));
    motionRoot.quaternion.copy(restQuaternion).multiply(turn);
    motionRoot.scale.set(restScale.x, restScale.y * breathe, restScale.z);
    motionRoot.position.x = restPosition.x + drift;
    linearPose.compose(zero, motionRoot.quaternion, motionRoot.scale);
    const e = linearPose.elements;
    let minimum = Infinity;
    for (let i = 0; i < soles.length; i += 6) {
      const x = soles[i] + soles[i + 3] * weight, y = soles[i + 1] + soles[i + 4] * weight, z = soles[i + 2] + soles[i + 5] * weight;
      minimum = Math.min(minimum, e[1] * x + e[5] * y + e[9] * z);
    }
    motionRoot.position.y = restPosition.y + neutralMinimum - minimum;

    const blinkPeriod = 5.8 * tempo, idlePhase = currentTime % blinkPeriod;
    const idleBlink = idlePhase > blinkPeriod - .28 ? Math.sin(Math.PI * (idlePhase - (blinkPeriod - .28)) / .28) ** 2 : 0;
    const tapBlink = elapsed >= 0 && elapsed < duration * .2 ? Math.sin(Math.PI * elapsed / (duration * .2)) ** 2 : 0;
    const blinkScale = 1 - .78 * Math.max(idleBlink, tapBlink);
    for (const face of faces) {
      if (face.kind === 'eye') face.object.scale.y = face.scale.y * blinkScale;
      else if (face.kind === 'glint') {
        face.object.scale.y = face.scale.y * blinkScale;
        face.object.position.y = face.eyeY + (face.position.y - face.eyeY) * blinkScale;
      } else if (face.kind === 'brow') face.object.position.y = face.position.y + .006 * response;
      else face.object.scale.x = face.scale.x * (1 + .012 * response);
    }
    motionRoot.updateMatrix();
  };

  return {
    update,
    triggerReaction() {
      if (disposed) return;
      if (reacting) queued = true;
      else { reactionStart = currentTime; reacting = true; }
    },
    reset() {
      if (disposed) return;
      currentTime = 0; reacting = false; queued = false; restore();
    },
    dispose() {
      if (disposed) return;
      restore(); disposed = true;
    },
  };
}
